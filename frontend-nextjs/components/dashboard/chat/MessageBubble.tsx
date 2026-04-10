"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage } from "@/types";
import { DocumentSource } from "@/lib/stores/chatStore";

interface MessageBubbleProps {
  message: ChatMessage;
  sourceUrls: Map<string, string>;
  animationDelay: number;
  onCitationHover: (
    index: number,
    messageId: string,
    x: number,
    y: number
  ) => void;
  onCitationLeave: () => void;
  onCitationClick: (source: DocumentSource, url: string | undefined) => void;
}

const PROSE_CLASSES = `prose dark:prose-invert prose max-w-none font-['Inter',sans-serif]
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
  [&_ul_ul]:my-3 [&_ol_ol]:my-3`;

function processContent(message: ChatMessage): string {
  let content = message.content || "";
  if (
    message.isStreaming !== true &&
    message.sources &&
    message.sources.length > 0
  ) {
    content = content.replace(/\[\s*(\d+)\s*\]/g, (match, id) => {
      const index = parseInt(id, 10);
      if (index > 0 && index <= message.sources!.length) {
        return ` [${index}](#source-${index})`;
      }
      return match;
    });
  }
  return content;
}

const MessageBubble = React.memo(function MessageBubble({
  message,
  sourceUrls,
  animationDelay,
  onCitationHover,
  onCitationLeave,
  onCitationClick,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`data-load flex ${isUser ? "justify-end" : "justify-start"}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div
        className={`max-w-[85%] relative ${
          isUser
            ? "bg-blue-50 dark:bg-slate-800 border border-blue-300 dark:border-amber-400/30"
            : "bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/50"
        }`}
        style={{
          clipPath: isUser
            ? "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)"
            : "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
        }}
      >
        <div className="p-4">
          {/* Message Header */}
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700/50">
            {!isUser && (
              <svg
                className="w-4 h-4 text-blue-600 dark:text-amber-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2L4 7v10c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V7l-8-5zm0 18c-3.31-1-6-5.46-6-9.4V8.3l6-4.45 6 4.45v2.3c0 3.94-2.69 8.4-6 9.4z" />
              </svg>
            )}
            <span
              className={`text-xs tracking-wider font-semibold ${
                isUser
                  ? "text-blue-600 dark:text-amber-400"
                  : "text-tactical-green"
              }`}
            >
              {isUser ? "OPERATOR" : "SYSTEM ANALYSIS"}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-600 font-mono ml-auto">
              {new Date(message.timestamp).toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>

          {/* Message Content */}
          <div
            className={
              isUser
                ? "text-slate-800 dark:text-slate-100 text-sm leading-relaxed"
                : ""
            }
          >
            {message.content ? (
              !isUser ? (
                <div className={PROSE_CLASSES}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ node, href, children, ...props }) => {
                        if (href?.startsWith("#source-")) {
                          const index = parseInt(
                            href.replace("#source-", ""),
                            10
                          );
                          if (
                            !isNaN(index) &&
                            message.sources &&
                            message.sources[index - 1]
                          ) {
                            const source = message.sources[
                              index - 1
                            ] as DocumentSource;
                            const fileKey = source.file_key;
                            const finalUrl = sourceUrls.get(fileKey);

                            return (
                              <span
                                className="inline-flex items-center justify-center w-5 h-5 ml-1 mr-0.5 text-[10px] font-bold text-tactical-green bg-tactical-green/10 border border-tactical-green/30 rounded-full cursor-pointer hover:bg-tactical-green/20 transition-colors align-super relative"
                                onMouseEnter={(e) => {
                                  const rect =
                                    e.currentTarget.getBoundingClientRect();
                                  onCitationHover(
                                    index - 1,
                                    message.id,
                                    rect.left + rect.width / 2,
                                    rect.top
                                  );
                                }}
                                onMouseLeave={onCitationLeave}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onCitationClick(source, finalUrl);
                                }}
                              >
                                {index}
                              </span>
                            );
                          }
                        }
                        return (
                          <a
                            href={href}
                            {...props}
                            className="text-tactical-green hover:underline"
                          >
                            {children}
                          </a>
                        );
                      },
                    }}
                  >
                    {processContent(message)}
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
        <div
          className={`absolute ${
            isUser ? "top-0 left-0" : "bottom-0 right-0"
          } w-2 h-2 border-amber-400/30`}
          style={{
            borderWidth: isUser ? "1px 0 0 1px" : "0 1px 1px 0",
          }}
        ></div>
      </div>
    </div>
  );
});

export default MessageBubble;
