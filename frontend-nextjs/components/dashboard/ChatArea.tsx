"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore, DocumentSource } from "@/lib/stores/chatStore";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { chatApi } from "@/lib/api/documents";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import VideoClipViewer from "./VideoClipViewer";

interface SourceWithUrl extends DocumentSource {
  presignedUrl?: string;
}

export default function ChatArea() {
  const {
    messages,
    sessionId,
    isLoading,
    isLoadingSession,
    inputMessage,
    selectedModel,
    setInputMessage,
    addMessage,
    updateLastMessage,
    setLoading,
  } = useChatStore();

  const { selectedDocs, documents } = useDocumentStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track presigned URLs for sources by file_key
  const [sourceUrls, setSourceUrls] = useState<Map<string, string>>(new Map());

  // Video viewer state
  const [videoViewer, setVideoViewer] = useState<{
    isOpen: boolean;
    url: string;
    filename: string;
    clipStart?: number;
    clipEnd?: number;
  }>({
    isOpen: false,
    url: "",
    filename: "",
  });

  // Citation hover state
  const [hoveredCitation, setHoveredCitation] = useState<{
    index: number;
    messageId: string;
    x: number;
    y: number;
  } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch presigned URLs for all sources in messages
  useEffect(() => {
    const fetchUrlsForSources = async () => {
      // Collect all unique file_keys from all messages
      const fileKeysToFetch = new Set<string>();

      messages.forEach(message => {
        if (message.sources) {
          message.sources.forEach((source: DocumentSource) => {
            if (source.file_key && !sourceUrls.has(source.file_key)) {
              fileKeysToFetch.add(source.file_key);
            }
          });
        }
      });

      if (fileKeysToFetch.size === 0) return;

      // Fetch URLs in parallel
      const urlPromises = Array.from(fileKeysToFetch).map(async (fileKey) => {
        try {
          const response = await fetch(`/api/files/presigned-url?file_key=${encodeURIComponent(fileKey)}`);
          if (response.ok) {
            const data = await response.json();
            return { fileKey, url: data.url };
          }
        } catch (error) {
          console.error(`Failed to fetch URL for ${fileKey}:`, error);
        }
        return null;
      });

      const results = await Promise.all(urlPromises);

      // Update sourceUrls map
      setSourceUrls(prev => {
        const newMap = new Map(prev);
        results.forEach(result => {
          if (result) {
            newMap.set(result.fileKey, result.url);
          }
        });
        return newMap;
      });
    };

    fetchUrlsForSources();
  }, [messages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputMessage]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");

    // Add user message
    addMessage({
      id: `${Date.now()}-user`,
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    // Add assistant message placeholder
    addMessage({
      id: `${Date.now()}-assistant`,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    });

    setLoading(true);

    try {
      const documentIds = Array.from(selectedDocs);

      // Extract file names from selected documents
      const fileNames = documentIds
        .map(docId => {
          const doc = documents.find(d => d._id === docId);
          return doc?.file_name;
        })
        .filter((name): name is string => name !== undefined);

      const stream = await chatApi.sendMessage(
        userMessage,
        documentIds,
        sessionId,
        selectedModel,
        fileNames
      );

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let accumulatedSources: DocumentSource[] = [];
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete SSE events (events end with \n\n)
        const events = buffer.split("\n\n");
        buffer = events.pop() || ""; // Keep incomplete event in buffer

        for (const event of events) {
          if (!event.trim()) continue;

          // Parse SSE event format:
          // id: {id}
          // event: {event_type}
          // data: {json}
          const lines = event.split("\n");
          let eventType = "message";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              eventData = line.slice(6).trim();
            }
          }

          // Handle [DONE] signal
          if (eventData === "[DONE]") {
            console.log("Stream completed");
            continue;
          }

          // Skip keepalive comments
          if (event.startsWith(": keepalive")) {
            continue;
          }

          // Parse event data
          try {
            const parsed = JSON.parse(eventData);

            // Handle different event types
            switch (eventType) {
              case "run.started":
                console.log("Run started:", parsed.data?.run_id);
                break;

              case "message.delta":
                // Streaming content chunk
                if (parsed.data?.content) {
                  accumulatedContent += parsed.data.content;
                  updateLastMessage(accumulatedContent, accumulatedSources.length > 0 ? accumulatedSources : undefined);
                }
                break;

              case "tool.started":
                console.log("Tool started:", parsed.data?.tool_name);
                break;

              case "tool.completed":
                console.log("Tool completed:", parsed.data?.tool_name);
                // Extract source citations from search results
                if (parsed.data?.tool_name === "search_knowledge_base" && parsed.data?.result) {
                  try {
                    const results = JSON.parse(parsed.data.result);
                    if (Array.isArray(results)) {
                      // Map all sources (no deduplication)
                      accumulatedSources = results.map((result: any) => ({
                        document_id: result.file_id,
                        filename: result.metadata?.file_name || '',
                        folder_name: result.metadata?.folder_name || '',
                        text: result.text || '',
                        score: result.metadata?.score || 0,
                        file_key: result.metadata?.file_key || '',
                        // Optional video fields
                        video_id: result.metadata?.video_id,
                        video_name: result.metadata?.video_name,
                        clip_start: result.metadata?.clip_start,
                        clip_end: result.metadata?.clip_end,
                        scene_id: result.metadata?.scene_id,
                        key_frame_timestamp: result.metadata?.key_frame_timestamp,
                        keyframe_file_key: result.metadata?.keyframe_file_key,
                      }));
                      // Update current message with sources
                      updateLastMessage(accumulatedContent, accumulatedSources);
                    }
                  } catch (e) {
                    console.error("Failed to parse search results:", e);
                  }
                }
                break;

              case "message.completed":
                // Full message received
                console.log("Message completed");
                if (parsed.data?.content) {
                  accumulatedContent = parsed.data.content;
                  updateLastMessage(accumulatedContent, accumulatedSources.length > 0 ? accumulatedSources : undefined);
                }
                break;

              case "run.completed":
                console.log("Run completed successfully");
                break;

              case "error":
                console.error("Stream error:", parsed.data);
                updateLastMessage(
                  `Error: ${parsed.data?.error || "An error occurred during processing"}`
                );
                break;

              default:
                console.log("Unknown event type:", eventType, parsed);
            }
          } catch (e) {
            console.warn("Failed to parse SSE event:", eventData, e);
          }
        }
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      updateLastMessage(
        `Sorry, an error occurred: ${error.message || "Please try again."}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 relative min-h-0">
      {/* Decorative corner bracket */}
      <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-amber-400/40 z-10"></div>

      {/* Loading Session Overlay */}
      {isLoadingSession && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-400/20 dark:border-amber-400/20 border-t-blue-600 dark:border-t-amber-400 rounded-full animate-spin"></div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-h-0">

        <div className="flex-1 overflow-y-auto p-6 tactical-scrollbar min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="max-w-3xl mx-auto text-center">
              {/* Mission Briefing Header */}
              <div className="relative mb-8">
                <div className="inline-block">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-blue-500/10 dark:bg-amber-500/10 border-2 border-blue-400/50 dark:border-amber-400/50 flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-blue-500/5 dark:bg-amber-500/5 animate-pulse"></div>
                      <svg className="w-7 h-7 text-blue-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L4 7v10c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V7l-8-5zm0 18c-3.31-1-6-5.46-6-9.4V8.3l6-4.45 6 4.45v2.3c0 3.94-2.69 8.4-6 9.4z"/>
                        <path d="M10.23 14.83L7.4 12l-1.41 1.41L10.23 17.7l8-8-1.41-1.41z"/>
                      </svg>
                    </div>
                    <div className="text-left">
                      <h2 className="text-2xl font-bold text-blue-600 dark:text-amber-400 tracking-wider leading-none">
                        SOLDIER<span className="text-blue-500 dark:text-amber-300">IQ</span>
                      </h2>
                      <div className="text-xs text-slate-500 tracking-widest mt-1">
                        INTELLIGENCE ANALYSIS SYSTEM
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-slate-600 dark:text-slate-400 mb-8 text-sm leading-relaxed">
                Tactical knowledge management system for intelligence operations.<br />
                Upload classified documents and query for strategic insights.
              </p>

              {/* Instructions */}
              <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 inline-block">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="tracking-wider">
                    SELECT DOCUMENTS FROM REPOSITORY TO BEGIN ANALYSIS
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6">
            {messages.map((message, idx) => (
              <div
                key={message.id}
                className={`data-load flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div
                  className={`max-w-[85%] relative ${
                    message.role === "user"
                      ? "bg-blue-50 dark:bg-slate-800 border border-blue-300 dark:border-amber-400/30"
                      : "bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/50"
                  }`}
                  style={{
                    clipPath: message.role === "user"
                      ? 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'
                      : 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
                  }}
                >
                  <div className="p-4">
                    {/* Message Header */}
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700/50">
                      {message.role === "assistant" && (
                        <svg className="w-4 h-4 text-blue-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L4 7v10c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V7l-8-5zm0 18c-3.31-1-6-5.46-6-9.4V8.3l6-4.45 6 4.45v2.3c0 3.94-2.69 8.4-6 9.4z"/>
                        </svg>
                      )}
                      <span className={`text-xs tracking-wider font-semibold ${
                        message.role === "user" ? "text-blue-600 dark:text-amber-400" : "text-tactical-green"
                      }`}>
                        {message.role === "user" ? "OPERATOR" : "SYSTEM ANALYSIS"}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-600 font-mono ml-auto">
                        {new Date(message.timestamp).toLocaleTimeString('en-US', {
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>

                    {/* Message Content */}
                    <div className={`${
                      message.role === "user" ? "text-slate-800 dark:text-slate-100 text-sm leading-relaxed" : ""
                    }`}>
                      {message.content ? (
                        message.role === "assistant" ? (
                          <div className="prose dark:prose-invert prose max-w-none font-['Inter',sans-serif]
                            text-[15px] leading-[1.9]
                            prose-headings:font-bold prose-headings:tracking-tight prose-headings:leading-tight prose-headings:font-['Inter',sans-serif]
                            dark:prose-headings:text-amber-400 prose-headings:text-blue-600
                            prose-h1:text-2xl prose-h1:mb-8 prose-h1:mt-12
                            prose-h2:text-xl prose-h2:mb-7 prose-h2:mt-10 prose-h2:font-bold
                            prose-h3:text-lg prose-h3:mb-6 prose-h3:mt-9 prose-h3:font-semibold
                            prose-h4:text-base prose-h4:mb-5 prose-h4:mt-8 prose-h4:font-semibold dark:prose-h4:text-amber-300 prose-h4:text-blue-500
                            prose-p:mb-7 prose-p:leading-[1.9] dark:prose-p:text-slate-100 prose-p:text-slate-800
                            prose-ul:my-7 prose-ul:space-y-4 prose-ul:leading-[1.9]
                            prose-ol:my-7 prose-ol:space-y-4 prose-ol:leading-[1.9]
                            prose-li:leading-[1.9] dark:prose-li:text-slate-100 prose-li:text-slate-800 prose-li:my-2.5
                            prose-li>p:my-3 prose-li>p:leading-[1.9]
                            prose-blockquote:border-l-4 dark:prose-blockquote:border-amber-400/50 prose-blockquote:border-blue-500/50 prose-blockquote:pl-6 prose-blockquote:my-7 prose-blockquote:py-3 prose-blockquote:italic
                            prose-a:text-tactical-green prose-a:no-underline hover:prose-a:underline prose-a:transition-all
                            dark:prose-strong:text-slate-50 prose-strong:text-slate-900 prose-strong:font-bold
                            dark:prose-em:text-slate-200 prose-em:text-slate-700 prose-em:italic
                            dark:prose-code:text-amber-300 prose-code:text-blue-600 dark:prose-code:bg-slate-800/70 prose-code:bg-slate-200 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-[13px] prose-code:font-mono prose-code:before:content-[''] prose-code:after:content-['']
                            dark:prose-pre:bg-slate-800/70 prose-pre:bg-slate-200 dark:prose-pre:border-slate-700/50 prose-pre:border-slate-300 prose-pre:my-7 prose-pre:p-5 prose-pre:rounded-lg prose-pre:overflow-x-auto
                            dark:prose-hr:border-slate-700/50 prose-hr:border-slate-300 prose-hr:my-12 prose-hr:border-t
                            prose-table:my-7 prose-table:text-sm
                            dark:prose-thead:border-slate-700 prose-thead:border-slate-300 prose-thead:border-b-2
                            dark:prose-th:text-amber-400 prose-th:text-blue-600 prose-th:py-3 prose-th:px-4 prose-th:text-left prose-th:font-semibold
                            dark:prose-td:border-slate-800 prose-td:border-slate-200 prose-td:py-3 prose-td:px-4 prose-td:border-t
                            [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                            [&_ul]:list-disc [&_ul]:pl-7
                            [&_ol]:list-decimal [&_ol]:pl-7
                            [&_ul_ul]:my-3 [&_ol_ol]:my-3">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                a: ({ node, href, children, ...props }) => {
                                  // Check if this is a citation link (format: #source-n)
                                  if (href?.startsWith('#source-')) {
                                    const index = parseInt(href.replace('#source-', ''), 10);
                                    if (!isNaN(index) && message.sources && message.sources[index - 1]) {
                                      const sourceId = `source-${message.id}-${index - 1}`;

                                      const source = message.sources[index - 1];
                                      const fileKey = source.file_key;
                                      const finalUrl = sourceUrls.get(fileKey);
                                      const isVideo = source.filename && /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(source.filename);
                                      const hasClipTimes = source.clip_start !== undefined && source.clip_end !== undefined;

                                      return (
                                        <span
                                          className="inline-flex items-center justify-center w-5 h-5 ml-1 mr-0.5 text-[10px] font-bold text-tactical-green bg-tactical-green/10 border border-tactical-green/30 rounded-full cursor-pointer hover:bg-tactical-green/20 transition-colors align-super relative"
                                          onMouseEnter={(e) => {
                                            // Clear any pending timeout
                                            if (hoverTimeoutRef.current) {
                                              clearTimeout(hoverTimeoutRef.current);
                                              hoverTimeoutRef.current = null;
                                            }

                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setHoveredCitation({
                                              index: index - 1,
                                              messageId: message.id,
                                              x: rect.left + rect.width / 2,
                                              y: rect.top,
                                            });
                                          }}
                                          onMouseLeave={() => {
                                            // Delay closing to allow moving to tooltip
                                            hoverTimeoutRef.current = setTimeout(() => {
                                              setHoveredCitation(null);
                                            }, 100);
                                          }}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();

                                            // Clear any pending timeout and close tooltip
                                            if (hoverTimeoutRef.current) {
                                              clearTimeout(hoverTimeoutRef.current);
                                              hoverTimeoutRef.current = null;
                                            }
                                            setHoveredCitation(null);

                                            if (!finalUrl) return;

                                            // For videos with clip times, open in VideoClipViewer
                                            if (isVideo && hasClipTimes) {
                                              setVideoViewer({
                                                isOpen: true,
                                                url: finalUrl,
                                                filename: source.filename,
                                                clipStart: source.clip_start,
                                                clipEnd: source.clip_end,
                                              });
                                            } else {
                                              // For other documents, open in new tab
                                              window.open(finalUrl, '_blank');
                                            }
                                          }}
                                        >
                                          {index}
                                        </span>
                                      );
                                    }
                                  }
                                  // Default link rendering
                                  return <a href={href} {...props} className="text-tactical-green hover:underline">{children}</a>;
                                }
                              }}
                            >
                              {(() => {
                                // Pre-process content to turn [1], [2] into links [[1]](#source-1)
                                // Only process citations after streaming is complete (or for old messages where isStreaming is undefined)
                                let content = message.content || "";
                                if (message.isStreaming !== true && message.sources && message.sources.length > 0) {
                                  // Replace [n] with [[n]](#source-n)
                                  content = content.replace(/\[\s*(\d+)\s*\]/g, (match, id) => {
                                    const index = parseInt(id, 10);
                                    if (index > 0 && index <= message.sources!.length) {
                                      return ` [${index}](#source-${index})`;
                                    }
                                    return match;
                                  });
                                }
                                return content;
                              })()}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          message.content
                        )
                      ) : (
                        <span className="text-slate-500 italic flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin"></div>
                          Processing query...
                        </span>
                      )}
                    </div>

                  </div>

                  {/* Corner decorations */}
                  <div className={`absolute ${
                    message.role === "user" ? "top-0 left-0" : "bottom-0 right-0"
                  } w-2 h-2 border-amber-400/30`} style={{
                    borderWidth: message.role === "user" ? '1px 0 0 1px' : '0 1px 1px 0'
                  }}></div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          {/* Status Bar */}
          <div className="flex items-center justify-between mb-3 text-xs">
            <div className="flex items-center gap-4">
              {/* Document Count */}
              {selectedDocs.size > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="status-indicator status-active"></div>
                  <span className="text-tactical-green tracking-wider">
                    {selectedDocs.size} DOCUMENT{selectedDocs.size !== 1 ? "S" : ""} ACTIVE
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="status-indicator bg-blue-500 dark:bg-amber-400"></div>
                  <span className="text-blue-600 dark:text-amber-400 tracking-wider">
                    GENERAL MODE
                  </span>
                </div>
              )}
            </div>

            {/* System Status */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-600 tracking-wider">STATUS:</span>
              <span className={`font-mono tracking-wider ${
                isLoading ? "text-blue-600 dark:text-amber-400" : "text-tactical-green"
              }`}>
                {isLoading ? "PROCESSING" : "READY"}
              </span>
            </div>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendMessage} className="relative">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedDocs.size === 0
                  ? "ENTER QUERY (NO DOCUMENTS SELECTED - GENERAL MODE)..."
                  : "ENTER QUERY FOR INTELLIGENCE ANALYSIS..."
              }
              disabled={isLoading}
              className="tactical-input pr-14 py-3 resize-none max-h-32 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-slate-600 placeholder:text-xs placeholder:tracking-wider"
              rows={1}
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="absolute right-2 bottom-2 tactical-btn tactical-btn-primary px-3 py-2 disabled:opacity-30"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </form>

          <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-600 text-center tracking-widest">
            ENTER: SUBMIT QUERY  |  SHIFT+ENTER: NEW LINE
          </div>
        </div>
      </div>

      {/* Bottom border accent */}
      <div className="h-px bg-gradient-to-r from-transparent via-blue-400/30 dark:via-amber-400/30 to-transparent"></div>

      {/* Video Clip Viewer Modal */}
      {videoViewer.isOpen && (
        <VideoClipViewer
          videoUrl={videoViewer.url}
          filename={videoViewer.filename}
          clipStart={videoViewer.clipStart}
          clipEnd={videoViewer.clipEnd}
          onClose={() => setVideoViewer({ isOpen: false, url: "", filename: "" })}
        />
      )}

      {/* Citation Hover Tooltip */}
      {hoveredCitation && (() => {
        const message = messages.find(m => m.id === hoveredCitation.messageId);
        const source = message?.sources?.[hoveredCitation.index];

        if (!source) return null;

        return (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: `${hoveredCitation.x}px`,
              top: `${hoveredCitation.y - 10}px`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div
              className="bg-[#252b3b] border border-tactical-green/30 rounded-lg shadow-2xl p-4 max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto"
              onMouseEnter={() => {
                // Clear any pending timeout when entering tooltip
                if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current);
                  hoverTimeoutRef.current = null;
                }
              }}
              onMouseLeave={() => {
                // Close tooltip when leaving
                setHoveredCitation(null);
              }}
            >
              {/* Filename */}
              <div className="text-sm font-semibold text-tactical-green mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="truncate">{source.filename}</span>
              </div>

              {/* Source text preview */}
              <div className="text-xs text-slate-300 dark:text-slate-400 leading-relaxed max-h-64 overflow-y-auto tactical-scrollbar">
                {source.text}
              </div>

              {/* Arrow pointing down */}
              <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full pointer-events-none">
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-tactical-green/30"></div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
