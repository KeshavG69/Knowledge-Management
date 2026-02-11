import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Send, FileText, Video, Tag, Trash2, RefreshCw, Moon, Sun,
  ChevronRight, ChevronDown, Eye, Plus, Compass, MessageSquare,
  BookOpen, Brain, Sparkles, Database, X, ListOrdered, CheckSquare, Volume2, Mic, MicOff, Edit, Check,
  Menu, Settings, LogOut, Home, Users, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import DocumentViewerModal from './DocumentViewerModal';
import VideoViewerModal from './VideoViewerModal';
import UploadModal from './UploadModal';
import DiscoverSourcesModal from './DiscoverSourcesModal';
import { API_ENDPOINTS } from './config';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './components/auth/AuthPage';
import LandingPage from './pages/LandingPage';

// Import military-themed components
import CommandHeader from './components/CommandHeader';
import SourcePanel from './components/SourcePanel';
import MissionPanel from './components/MissionPanel';
import ToolPanel from './components/ToolPanel';

// Import Zustand stores
import { useDocumentStore, useChatStore, useUIStore, useSettingsStore } from './stores';

const API_URL = API_ENDPOINTS.query();

function MainApp() {
  const { user, logout, getAccessToken, getUserId, getOrganizationId } = useAuth();
  const { toast } = useToast();
  const USER_ID = getUserId();
  const ORGANIZATION_ID = getOrganizationId();

  // Document store
  const {
    allDocuments,
    selectedDocs,
    knowledgeBases,
    selectedKB,
    selectedKBs,
    multiKBMode,
    showCreateKBModal,
    showKBModal,
    fetchAllDocuments,
    addSelectedDoc,
    removeSelectedDoc,
    selectAllDocs,
    deselectAllDocs,
    setShowKBModal,
    setShowCreateKBModal,
    createKnowledgeBase,
    deleteKnowledgeBase: deleteKB,
    renameKnowledgeBase: renameKB,
    deleteDocument: deleteDoc,
    setSelectedDocs,
    setSelectedKBs,
    setMultiKBMode,
    setSelectedKB
  } = useDocumentStore();

  // Chat store
  const {
    conversation,
    query,
    isLoading,
    thinkingMessage,
    error,
    lastParsedSources,
    generatedDocuments,
    isGeneratingOutput,
    editingMessageId,
    editText,
    sessionId,
    setQuery,
    setIsLoading,
    setThinkingMessage,
    setError,
    setLastParsedSources,
    addMessage,
    updateMessage,
    setIsGeneratingOutput,
    setEditingMessageId,
    setEditText,
    approveDocument,
    editDocument,
    cancelEdit,
    appendAgentMessage,
    addGeneratedDocument,
    setConversation,
    startNewSession
  } = useChatStore();

  // UI store
  const {
    theme,
    isUploadModalOpen,
    isDiscoverSourcesModalOpen,
    documentToView,
    isRightSidebarVisible,
    activeMode,
    processingStatus,
    setTheme,
    setIsUploadModalOpen,
    setIsDiscoverSourcesModalOpen,
    setDocumentToView,
    setIsRightSidebarVisible,
    setActiveMode
  } = useUIStore();

  // Settings store
  const {
    selectedModel,
    availableModels,
    modelJustChanged,
    selectedVoiceId,
    availableVoices,
    isAudioAgentMode,
    isRecording,
    mediaRecorder,
    setSelectedModel,
    fetchAvailableModels,
    setModelJustChanged,
    setSelectedVoiceId,
    setIsAudioAgentMode,
    setIsRecording,
    setMediaRecorder,
    setAudioChunks,
    setIsTranscribing
  } = useSettingsStore();

  // Legacy refs
  const ttsTriggeredRef = useRef(false);

  // Effects
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('selectedVoiceId', selectedVoiceId);
  }, [selectedVoiceId]);

  useEffect(() => {
    console.log('[chat] conversation state updated', conversation);
  }, [conversation]);

  // Helper functions
  const buildQueryTargets = useCallback(() => {
    const filteredDocs = [];

    selectedDocs.forEach((docId) => {
      if (!docId) return;
      filteredDocs.push(String(docId));
    });

    console.log('[buildQueryTargets] selected documents:', filteredDocs);

    return {
      documents: filteredDocs,
    };
  }, [selectedDocs]);

  // Document handlers (using store functions)
  const handleDocumentSelect = (docId) => {
    addSelectedDoc(docId);
  };

  const handleDocumentDeselect = (docId) => {
    removeSelectedDoc(docId);
  };

  const handleSelectAll = () => {
    selectAllDocs();
  };

  const handleDeselectAll = () => {
    deselectAllDocs();
  };

  const handleDeleteDocument = async (docId) => {
    try {
      await deleteDoc(docId, selectedKB, getAccessToken, getUserId, getOrganizationId);
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    } catch (err) {
      console.error('Error deleting document:', err);
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  // Query handler with streaming
  const handleSendQuery = async (overrideQuery = null) => {
    const queryToSend = overrideQuery || query;
    console.log('[handleSendQuery] Called with:', { overrideQuery, query, queryToSend, type: typeof queryToSend, isLoading });

    // Ensure queryToSend is a string before calling trim
    if (typeof queryToSend !== 'string' || !queryToSend.trim() || isLoading) {
      console.log('[handleSendQuery] Blocked - validation failed');
      return;
    }

    console.log('[handleSendQuery] Proceeding with query:', queryToSend);

    const userMessage = {
      sender: 'user',
      text: queryToSend,
      id: `user-${Date.now()}`
    };

    addMessage(userMessage);
    setIsLoading(true);
    setThinkingMessage("Analyzing your query...");
    setError(null);
    ttsTriggeredRef.current = false;

    try {
      const authToken = await getAccessToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      };

      const { documents: targetDocs } = buildQueryTargets();

      // Extract file names (titles) from selected documents
      const fileNames = targetDocs
        .map(docId => {
          const doc = allDocuments.find(d => String(d._id) === String(docId));
          return doc ? doc.title || doc.filename : null;
        })
        .filter(Boolean); // Remove null values

      if (modelJustChanged) {
        console.log(`[Model Switch] Model changed to ${selectedModel}`);
        setModelJustChanged(false);
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: queryToSend,
          user_id: USER_ID,
          organization_id: ORGANIZATION_ID,
          document_ids: targetDocs,
          file_names: fileNames,
          model: selectedModel,
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedAgentMessage = '';
      let agentMessageAdded = false;
      let bufferedPayload = '';
      let latestSources = [];
      let currentToolCall = null;
      let pendingEventType = null; // Store event type between calls

      const handleStreamPayload = (rawPayload) => {
        const trimmedPayload = rawPayload.trim();
        if (!trimmedPayload || trimmedPayload.startsWith(':')) return;

        // Skip SSE id lines
        if (trimmedPayload.startsWith('id:')) {
          return;
        }

        // Extract SSE event type if present
        let dataPayload = trimmedPayload;

        if (trimmedPayload.startsWith('event:')) {
          // SSE format with event line - store event type for next data line
          pendingEventType = trimmedPayload.replace(/^event:\s*/, '').trim();
          return; // Wait for data line
        }

        if (trimmedPayload.startsWith('data:')) {
          dataPayload = trimmedPayload.replace(/^data:\s*/, '').trim();
        }

        // Skip [DONE] marker
        if (dataPayload === '[DONE]') {
          setThinkingMessage(null);
          if (!agentMessageAdded && accumulatedAgentMessage) {
            appendAgentMessage(accumulatedAgentMessage, latestSources);
            agentMessageAdded = true;
          }
          return;
        }

        try {
          const parsed = JSON.parse(dataPayload);

          // Map Agno SSE events to frontend expectations
          const event = parsed.event || parsed.type || pendingEventType;

          console.log('[query-stream] event', event, parsed);

          // Clear pending event type after using it
          if (pendingEventType) {
            pendingEventType = null;
          }

          if (parsed.sources?.length) {
            latestSources = parsed.sources;
          }

          // Handle different event types
          if (event === 'run.started') {
            setThinkingMessage('Analyzing your query...');
          } else if (event === 'message.delta') {
            // Accumulate message content and show streaming
            const chunkText = parsed.data?.content || parsed.content || '';
            if (chunkText) {
              accumulatedAgentMessage += chunkText;

              // Update conversation with streaming text in real-time
              if (!agentMessageAdded) {
                setConversation(prev => {
                  const prevArray = Array.isArray(prev) ? prev : [];
                  const lastMsg = prevArray[prevArray.length - 1];
                  if (lastMsg?.sender === 'agent' && lastMsg?.isStreaming) {
                    // Update existing streaming message
                    return [
                      ...prevArray.slice(0, -1),
                      { ...lastMsg, text: accumulatedAgentMessage }
                    ];
                  } else {
                    // Create new streaming message
                    return [
                      ...prevArray,
                      {
                        sender: 'agent',
                        text: accumulatedAgentMessage,
                        id: `agent-streaming-${Date.now()}`,
                        isStreaming: true,
                        toolCalls: currentToolCall ? [currentToolCall] : []
                      }
                    ];
                  }
                });
              }
            }
          } else if (event === 'tool.started') {
            const toolName = parsed.data?.tool_name?.replace(/_/g, ' ') || 'tool';
            const toolArgs = parsed.data?.tool_args || {};

            currentToolCall = {
              name: toolName,
              args: toolArgs,
              status: 'running',
              startTime: Date.now()
            };

            // Show tool execution in thinking message
            const argsStr = Object.keys(toolArgs).length > 0
              ? ` with query: "${toolArgs.query || JSON.stringify(toolArgs).slice(0, 50)}"`
              : '';
            setThinkingMessage(`🔧 Searching knowledge base${argsStr}...`);

            // Add tool call to conversation
            setConversation(prev => {
              const prevArray = Array.isArray(prev) ? prev : [];
              const lastMsg = prevArray[prevArray.length - 1];
              if (lastMsg?.sender === 'agent' && lastMsg?.isStreaming) {
                return [
                  ...prevArray.slice(0, -1),
                  {
                    ...lastMsg,
                    toolCalls: [...(lastMsg.toolCalls || []), currentToolCall]
                  }
                ];
              }
              return prevArray;
            });
          } else if (event === 'tool.completed') {
            if (currentToolCall) {
              currentToolCall.status = 'completed';
              currentToolCall.endTime = Date.now();
              currentToolCall.duration = currentToolCall.endTime - currentToolCall.startTime;

              // Parse result if it's a JSON string and extract sources
              const result = parsed.data?.result;
              if (result && typeof result === 'string') {
                try {
                  const parsedResult = JSON.parse(result);
                  if (Array.isArray(parsedResult)) {
                    currentToolCall.resultCount = parsedResult.length;

                    // Extract sources from tool results
                    const sources = parsedResult.map(item => ({
                      document_name: item.metadata?.file_name || item.metadata?.video_name || 'Unknown',
                      page_number: item.metadata?.page_number,
                      snippet: item.text?.substring(0, 200),
                      clip_start: item.metadata?.clip_start,
                      clip_end: item.metadata?.clip_end,
                      score: item.metadata?.score
                    }));

                    // Update latestSources with extracted sources
                    if (sources.length > 0) {
                      latestSources = sources;
                    }
                  }
                } catch (e) {
                  // Not JSON, that's okay
                }
              }
            }
            setThinkingMessage(null);
          } else if (event === 'run.completed' || event === 'message.completed') {
            setThinkingMessage(null);
            const finalMessage = parsed.data?.content || accumulatedAgentMessage;
            if (!agentMessageAdded && finalMessage) {
              // Mark streaming as complete
              setConversation(prev => {
                const prevArray = Array.isArray(prev) ? prev : [];
                const lastMsg = prevArray[prevArray.length - 1];
                if (lastMsg?.sender === 'agent' && lastMsg?.isStreaming) {
                  return [
                    ...prevArray.slice(0, -1),
                    {
                      ...lastMsg,
                      text: finalMessage,
                      isStreaming: false,
                      sources: parsed.data?.sources || latestSources
                    }
                  ];
                } else {
                  return [
                    ...prevArray,
                    {
                      sender: 'agent',
                      text: finalMessage,
                      id: `agent-${Date.now()}`,
                      sources: parsed.data?.sources || latestSources,
                      toolCalls: currentToolCall ? [currentToolCall] : []
                    }
                  ];
                }
              });
              agentMessageAdded = true;
              currentToolCall = null;
            }
          } else if (event === 'error') {
            const message = parsed.data?.message || parsed.message || 'Stream error encountered.';
            setThinkingMessage(null);
            setError(message);
            toast({
              title: 'Stream Error',
              description: message,
              variant: 'destructive',
            });
            if (!agentMessageAdded && accumulatedAgentMessage) {
              appendAgentMessage(accumulatedAgentMessage, latestSources);
              agentMessageAdded = true;
            }
          }
        } catch (e) {
          console.error('Error parsing streamed JSON:', e, dataPayload);
        }
      };

      const extractNextPayload = (buffer) => {
        if (!buffer) return null;

        let idx = 0;
        while (idx < buffer.length && /\s/.test(buffer[idx])) {
          idx += 1;
        }

        if (idx > 0) {
          return { payload: null, length: idx };
        }

        if (buffer.startsWith('data:', idx)) {
          const newlineIndex = buffer.indexOf('\n', idx);
          if (newlineIndex === -1) return null;
          return {
            payload: buffer.slice(idx, newlineIndex),
            length: newlineIndex + 1,
          };
        }

        const startChar = buffer[idx];

        if (startChar === '{' || startChar === '[') {
          let depth = 0;
          let inString = false;
          let escapeNext = false;

          for (let i = idx; i < buffer.length; i += 1) {
            const char = buffer[i];

            if (escapeNext) {
              escapeNext = false;
              continue;
            }

            if (char === '\\') {
              escapeNext = true;
              continue;
            }

            if (char === '"') {
              inString = !inString;
              continue;
            }

            if (inString) continue;

            if (char === '{' || char === '[') {
              depth += 1;
            } else if (char === '}' || char === ']') {
              depth -= 1;
              if (depth === 0) {
                const jsonSegment = buffer.slice(idx, i + 1);
                return {
                  payload: jsonSegment,
                  length: i + 1,
                };
              }
            }
          }

          return null;
        }

        const newlineIndex = buffer.indexOf('\n', idx);
        if (newlineIndex === -1) return null;

        return {
          payload: buffer.slice(idx, newlineIndex),
          length: newlineIndex + 1,
        };
      };

      const flushBufferedPayload = () => {
        while (bufferedPayload.length) {
          const next = extractNextPayload(bufferedPayload);
          if (!next) break;

          const { payload, length } = next;
          if (payload) {
            handleStreamPayload(payload);
          }

          bufferedPayload = bufferedPayload.slice(length);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        console.log('[query-stream] raw chunk', chunk);
        bufferedPayload += chunk;
        flushBufferedPayload();
      }

      flushBufferedPayload();

      if (!agentMessageAdded && accumulatedAgentMessage) {
        appendAgentMessage(accumulatedAgentMessage, latestSources);
        agentMessageAdded = true;
      }

      // Show sidebar if there are sources
      if (latestSources.length) {
        setIsRightSidebarVisible(true);
      }
    } catch (err) {
      console.error('API call failed:', err);
      setError(err.message);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setQuery('');
    }
  };

  // Tool generation
  const handleGenerateTool = async (toolId) => {
    if (toolId === 'stepGuide' || toolId === 'pmcsChecklist') {
      await handleGenerateOutput(toolId);
    } else {
      setIsGeneratingOutput(true);
      setTimeout(() => {
        const newDoc = {
          id: Date.now(),
          title: `${toolId.toUpperCase()} Output`,
          type: toolId,
          content: `Generated ${toolId} content...`,
          timestamp: new Date().toISOString()
        };
        addGeneratedDocument(newDoc);
        setIsGeneratingOutput(false);

        toast({
          title: "Success",
          description: `${toolId} generated successfully`,
        });
      }, 2000);
    }
  };

  const handleGenerateOutput = async (mode) => {
    if (!selectedDocs.size) {
      toast({
        title: "No Documents Selected",
        description: "Please select at least one document to generate output.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingOutput(true);

    const thinkingMessages = {
      stepGuide: "Creating step-by-step guide from selected documents...",
      pmcsChecklist: "Generating PMCS checklist from technical manuals..."
    };
    setThinkingMessage(thinkingMessages[mode] || "Generating document...");

    const { documents: targetDocs } = buildQueryTargets();

    try {
      const authToken = await getAccessToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      };

      const selectedDocDetails = allDocuments.filter(doc => selectedDocs.has(doc.document_id));
      const docEntries = selectedDocDetails.length
        ? selectedDocDetails.map(doc => ({
            name: doc.document_name || doc.title || doc.display_name || doc.filename || doc.document_id,
            summary: doc.summary || doc.snippet || doc.mock_snippet || '',
          }))
        : targetDocs.map(docId => ({ name: docId, summary: '' }));

      if (!docEntries.length) {
        throw new Error('Unable to resolve selected documents. Please reselect and try again.');
      }

      const MAX_SUMMARY_LENGTH = 240;

      const formattedDocList = docEntries
        .map(entry => {
          const summary = entry.summary
            ? entry.summary.replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY_LENGTH)
            : '';
          const suffix = summary ? ` — ${summary}${entry.summary && entry.summary.length > MAX_SUMMARY_LENGTH ? '…' : ''}` : '';
          return `• ${entry.name}${suffix}`;
        })
        .join('\n');

      const lastUserMessage = [...conversation].reverse().find(msg => msg?.sender === 'user' && msg?.text);
      const topicSummary = lastUserMessage
        ? lastUserMessage.text.trim()
        : 'the selected knowledge base documents';

      const MAX_CHAT_MESSAGES = 6;
      const conversationText = conversation
        .filter(msg => msg?.sender && msg?.text && msg.sender !== 'system')
        .slice(-MAX_CHAT_MESSAGES)
        .map(msg => {
          const prefix = msg.sender === 'agent' ? 'Assistant' : 'User';
          const text = msg.text.length > 400 ? `${msg.text.slice(0, 397)}…` : msg.text;
          return `${prefix}: ${text}`;
        })
        .join('\n\n');

      const goalStatement = mode === 'pmcsChecklist'
        ? 'Create a Preventive Maintenance Checks and Services (PMCS) checklist that answers the user request.'
        : 'Create a detailed procedural guide that answers the user request.';

      const baseInstructions = `${goalStatement}\n\nUser input or context:\n${topicSummary}\n\nPrimary references:\n${formattedDocList}\n\nUse these as the backbone of your answer. You may pull additional snippets via librarian_iq_agent if needed, but always cite what you use.`;

      let contextBlock = baseInstructions;
      if (conversationText) {
        contextBlock += `\n\nConversation transcript:\n${conversationText}`;
      }

      let prompt = '';
      switch (mode) {
        case 'stepGuide':
          prompt = `${contextBlock}\n\n**REQUIRED FORMAT: STEP-BY-STEP PROCEDURAL GUIDE (NOT A CHECKLIST)**\n\nGuidance for the response:\n- This MUST be a numbered step-by-step procedure guide format (Step 1, Step 2, etc.), NOT a checkbox checklist\n- Provide sequential numbered steps with sub-steps as needed\n- CRITICAL FORMATTING: Each numbered item (1.1, 1.2, 2.1, 2.2, etc.) MUST be on its own line with a blank line before it\n- For each step, explain the action, the purpose, and any follow-up checks or conditions for success\n- Mention prerequisites, required tools, and safety cautions when present in the sources\n- Focus on procedural tasks like setup, installation, configuration, or operation - NOT maintenance inspection checklists\n- Combine insights from the available references to create the most complete answer you can\n- Append inline document citations to every step`;
          break;
        case 'pmcsChecklist':
          prompt = `${contextBlock}\n\n**REQUIRED FORMAT: PMCS INSPECTION CHECKLIST (NOT A PROCEDURE GUIDE)**\n\nGuidance for the response:\n- This MUST be a checkbox checklist format for preventive maintenance checks and services, NOT a numbered procedure\n- Organize the checklist by logical equipment groupings\n- Each checkbox should describe what to inspect, acceptable conditions, and corrective or follow-up actions\n- Include notes on frequency (Before/Daily/Weekly/Monthly), safety warnings, and signs of impending failure\n- Combine details from the available references to offer the most complete guidance you can\n- Append inline document citations to each checkbox item`;
          break;
        default:
          prompt = `${contextBlock}\n\nProvide a comprehensive structured response with inline citations.`;
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: prompt,
          user_id: USER_ID,
          selected_documents: targetDocs,
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate output (status ${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Unable to read agent response stream.');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let finalText = '';
      let sources = [];

      const processPayload = (rawLine) => {
        const trimmed = rawLine.trim();
        if (!trimmed || trimmed.startsWith(':')) return;

        const payload = trimmed.startsWith('data:')
          ? trimmed.replace(/^data:\s*/, '')
          : trimmed;

        if (!payload) return;

        try {
          const parsed = JSON.parse(payload);

          if (parsed.sources?.length) {
            sources = parsed.sources;
          }

          if (parsed.type === 'error') {
            throw new Error(parsed.message || 'Stream error encountered.');
          }

          if (parsed.type === 'text_chunk' || parsed.type === 'content') {
            const chunkText = parsed.content ?? parsed.data ?? parsed.text ?? '';
            accumulatedText += chunkText;
          }

          if (parsed.type === 'end_of_stream') {
            finalText = parsed.full_text || accumulatedText;
            if (parsed.sources?.length) {
              sources = parsed.sources;
            }
          }
        } catch (streamError) {
          console.error('Error parsing streamed JSON:', streamError, payload);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          processPayload(line);
        }
      }

      if (buffer.trim()) {
        processPayload(buffer);
      }

      reader.releaseLock();

      const outputContent = (finalText || accumulatedText || '').trim();

      if (!outputContent) {
        throw new Error('No output returned from the agent.');
      }

      setThinkingMessage(null);

      const docId = Date.now();
      const agentMessage = {
        sender: 'agent',
        text: outputContent,
        id: `agent-generated-${docId}`,
        isGeneratedDocument: true,
        pendingApproval: true,
        documentType: mode,
        documentTitle: mode === 'stepGuide' ? 'Step-by-Step Guide' : 'PMCS Checklist',
        ...(sources.length ? { sources } : {}),
      };
      addMessage(agentMessage);

      if (sources.length) {
        setLastParsedSources(sources);
        if (activeMode === 'chat') {
          setIsRightSidebarVisible(true);
        }
      }
    } catch (error) {
      console.error('Error generating output:', error);
      setThinkingMessage(null);
      toast({
        title: "Error",
        description: error?.message || "Failed to generate output. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingOutput(false);
    }
  };

  const handleApproveDocument = (messageId) => {
    const message = conversation.find(msg => msg.id === messageId);
    if (message) {
      approveDocument(messageId);
      toast({
        title: "Success",
        description: `${message.documentTitle} approved and saved`,
      });
    }
  };

  const handleEditDocument = (messageId) => {
    editDocument(messageId);
  };

  const handleCancelEdit = (messageId) => {
    cancelEdit(messageId);
  };

  const handleSubmitEdit = async (messageId, editInstructions) => {
    const message = conversation.find(msg => msg.id === messageId);
    if (!message) return;

    updateMessage(messageId, { editMode: false, isEditing: true });

    setThinkingMessage("Applying your edits...");

    try {
      const authToken = await getAccessToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      };

      const { documents: targetDocs } = buildQueryTargets();

      const editPrompt = `You previously generated the following ${message.documentTitle}:\n\n${message.text}\n\nThe user has requested the following changes:\n${editInstructions}\n\nPlease revise the document according to these instructions while maintaining the same format and structure. Keep all inline citations.`;

      const response = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: editPrompt,
          user_id: USER_ID,
          selected_documents: targetDocs,
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to edit document (status ${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Unable to read agent response stream.');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let finalText = '';
      let sources = message.sources || [];

      const processPayload = (rawLine) => {
        const trimmed = rawLine.trim();
        if (!trimmed || trimmed.startsWith(':')) return;

        const payload = trimmed.startsWith('data:')
          ? trimmed.replace(/^data:\s*/, '')
          : trimmed;

        if (!payload) return;

        try {
          const parsed = JSON.parse(payload);

          if (parsed.sources?.length) {
            sources = parsed.sources;
          }

          if (parsed.type === 'text_chunk' || parsed.type === 'content') {
            const chunkText = parsed.content ?? parsed.data ?? parsed.text ?? '';
            accumulatedText += chunkText;
          }

          if (parsed.type === 'end_of_stream') {
            finalText = parsed.full_text || accumulatedText;
            if (parsed.sources?.length) {
              sources = parsed.sources;
            }
          }
        } catch (streamError) {
          console.error('Error parsing streamed JSON:', streamError, payload);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          processPayload(line);
        }
      }

      if (buffer.trim()) {
        processPayload(buffer);
      }

      reader.releaseLock();

      const revisedContent = (finalText || accumulatedText || '').trim();

      if (!revisedContent) {
        throw new Error('No output returned from the agent.');
      }

      setThinkingMessage(null);

      updateMessage(messageId, {
        text: revisedContent,
        sources: sources,
        isEditing: false,
        pendingApproval: true,
      });

      toast({
        title: "Edits Applied",
        description: "Document has been revised. Please review and approve.",
      });

    } catch (error) {
      console.error('Error editing document:', error);
      setThinkingMessage(null);

      updateMessage(messageId, { isEditing: false, editMode: true });

      toast({
        title: "Error",
        description: error?.message || "Failed to apply edits. Please try again.",
        variant: "destructive",
      });
    }
  };

  // TTS and audio
  const playTTS = async (text) => {
    let cleanedText = text.replace(/\([^)]*\.(pdf|docx|txt|md)[^)]*\)/gi, '');
    cleanedText = cleanedText.replace(/[#*`]/g, '').substring(0, 5000);
    console.log('🎵 playTTS called - Original length:', text.length, 'Cleaned length:', cleanedText.length);

    if (!cleanedText || cleanedText.length < 2) {
      console.log('❌ Text too short for TTS');
      return;
    }

    try {
      const authToken = await getAccessToken();
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};

      const response = await fetch(API_ENDPOINTS.tts(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({
          text: cleanedText,
          voice_id: selectedVoiceId
        })
      });

      if (!response.ok) {
        console.error('TTS API Error:', response.status);
        return;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => URL.revokeObjectURL(audioUrl);
      await audio.play();
    } catch (error) {
      console.error('Error playing TTS:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await transcribeAudio(blob);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      toast({
        title: "Error",
        description: "Failed to start recording",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  };

  const transcribeAudio = async (audioBlob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'recording.webm');

      const authToken = await getAccessToken();
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};

      const response = await fetch(API_ENDPOINTS.stt(), {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();
      if (data.text) {
        const transcribedText = data.text;
        setQuery(transcribedText);

        if (isAudioAgentMode) {
          console.log('[STT] Auto-submitting query in audio agent mode:', transcribedText);
          setTimeout(() => {
            handleSendQuery(transcribedText);
          }, 50);
        }
      }
    } catch (err) {
      console.error('Error transcribing audio:', err);
      toast({
        title: "Error",
        description: "Failed to transcribe audio",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  // KB management handlers
  const handleCreateKB = async (name, displayName, description) => {
    try {
      await createKnowledgeBase(name, displayName, description);
      await fetchAllDocuments(getAccessToken, getUserId, getOrganizationId);
      toast({
        title: 'Success',
        description: `Knowledge base "${displayName}" created successfully`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteKB = async (kbName, displayName) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the knowledge base "${displayName}"? This will permanently delete all documents in this knowledge base.`
    );

    if (!confirmed) return;

    try {
      await deleteKB(kbName);
      await fetchAllDocuments(getAccessToken, getUserId, getOrganizationId);
      toast({
        title: 'Success',
        description: `Knowledge base "${displayName}" deleted successfully`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleRenameKB = async (kbName, newDisplayName) => {
    const trimmedName = newDisplayName?.trim();
    if (!trimmedName) return;

    try {
      await renameKB(kbName, trimmedName);
      await fetchAllDocuments(getAccessToken, getUserId, getOrganizationId);
      toast({
        title: 'Success',
        description: `Knowledge base renamed to "${trimmedName}"`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to rename knowledge base',
        variant: 'destructive',
      });
    }
  };

  // KB modal handlers
  const handleKBModalDocSelection = (newSelectedDocs) => {
    const next = new Set(newSelectedDocs);
    setSelectedDocs(next);
  };

  const handleKBSelectionChange = (kbs, mode) => {
    const next = new Set(kbs);
    setSelectedKBs(next);
    setMultiKBMode(mode);
    if (!mode && next.size === 1) {
      const [onlyKB] = Array.from(next);
      if (onlyKB) {
        setSelectedKB(onlyKB);
      }
    }
  };

  // Initial load and sync effects
  useEffect(() => {
    fetchAllDocuments(getAccessToken, getUserId, getOrganizationId);
    fetchAvailableModels(getAccessToken);
  }, [fetchAllDocuments, fetchAvailableModels, getAccessToken, getUserId, getOrganizationId]);

  useEffect(() => {
    if (!knowledgeBases.length) {
      return;
    }

    const kbNames = new Set(knowledgeBases.map((kb) => kb.name));
    const fallbackKB = knowledgeBases[0]?.name;

    if (!selectedKB || !kbNames.has(selectedKB)) {
      if (fallbackKB) {
        setSelectedKB(fallbackKB);
        setSelectedKBs(new Set([fallbackKB]));
      }
    }

    if (multiKBMode) {
      const validSelections = Array.from(selectedKBs).filter((kbName) => kbNames.has(kbName));
      if (validSelections.length !== selectedKBs.size) {
        setSelectedKBs(new Set(validSelections));
      }
    } else if (selectedKB && (!selectedKBs.has(selectedKB) || selectedKBs.size !== 1)) {
      setSelectedKBs(new Set([selectedKB]));
    }
  }, [knowledgeBases, selectedKB, selectedKBs, multiKBMode]);

  useEffect(() => {
    if (!multiKBMode && selectedKB) {
      setSelectedKBs(new Set([selectedKB]));
    }
  }, [multiKBMode, selectedKB]);

  const handleConnectInoc = () => {
    toast({
      title: 'Connect to INOC Service Desk',
      description: 'Launching INOC Service Desk connection…',
    });
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <Toaster />

      <CommandHeader
        theme={theme}
        setTheme={setTheme}
        user={user}
        onLogout={logout}
        activeMode={activeMode}
        onModeChange={setActiveMode}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        availableModels={availableModels}
        onConnectInoc={handleConnectInoc}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-96 border-r border-border">
          <SourcePanel
            documents={allDocuments}
            selectedDocs={selectedDocs}
            onDocumentSelect={handleDocumentSelect}
            onDocumentDeselect={handleDocumentDeselect}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            knowledgeBases={knowledgeBases}
            selectedKB={selectedKB}
            onKBChange={setSelectedKB}
            onUpload={() => setIsUploadModalOpen(true)}
            onDelete={handleDeleteDocument}
            onRefresh={() => fetchAllDocuments(getAccessToken, getUserId, getOrganizationId)}
            onDiscover={() => setIsDiscoverSourcesModalOpen(true)}
            onManageKnowledgeBases={() => {
              fetchAllDocuments(getAccessToken, getUserId, getOrganizationId);
              setShowKBModal(true);
            }}
            multiKBMode={multiKBMode}
            selectedKBs={selectedKBs}
            isLoading={processingStatus.is_processing}
            onDeleteKB={handleDeleteKB}
            onUploadToKB={(kbName) => {
              setSelectedKB(kbName);
              setIsUploadModalOpen(true);
            }}
          />
        </div>

        <div className="flex-1">
          <MissionPanel
            conversation={conversation}
            isLoading={isLoading}
            thinkingMessage={thinkingMessage}
            query={query}
            setQuery={setQuery}
            onSendQuery={handleSendQuery}
            isRecording={isRecording}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            isAudioAgentMode={isAudioAgentMode}
            selectedDocsCount={selectedDocs.size}
            onGenerateOutput={handleGenerateTool}
            onApproveDocument={handleApproveDocument}
            onEditDocument={handleEditDocument}
            onCancelEdit={handleCancelEdit}
            onSubmitEdit={handleSubmitEdit}
            onEditMessage={(id, text) => {
              setEditingMessageId(id);
              setEditText(text);
            }}
            onApproveEdit={() => {
              setEditingMessageId(null);
              setEditText('');
            }}
            editingMessageId={editingMessageId}
            editText={editText}
            setEditText={setEditText}
            onClearSession={startNewSession}
          />
        </div>

        {activeMode === 'studio' && (
          <div className="w-96 border-l border-border">
            <ToolPanel
              sources={lastParsedSources}
              generatedDocuments={generatedDocuments}
              isGeneratingOutput={isGeneratingOutput}
              onGenerateTool={handleGenerateTool}
              onOpenDocument={(doc) => setDocumentToView(doc)}
              onSaveOutput={() => {
                toast({
                  title: "Success",
                  description: "Output saved successfully",
                });
              }}
              activeMode={activeMode}
              selectedDocsCount={selectedDocs.size}
              isAudioAgentMode={isAudioAgentMode}
              onToggleAudioAgent={() => setIsAudioAgentMode(!isAudioAgentMode)}
              selectedVoiceId={selectedVoiceId}
              onVoiceChange={setSelectedVoiceId}
              availableVoices={availableVoices}
              onTestVoice={() => playTTS("Hello, this is a voice preview test.")}
            />
          </div>
        )}

        {activeMode === 'chat' && isRightSidebarVisible && lastParsedSources.length > 0 && (
          <div className="w-[28rem] border-l border-border bg-card flex flex-col h-full overflow-hidden">
            <div className="p-5 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Sources</h3>
                <Button
                  variant="ghost"
                  size="default"
                  onClick={() => setIsRightSidebarVisible(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-4">
                {lastParsedSources.map((source, idx) => (
                  <Card
                    key={idx}
                    className="p-4 cursor-pointer hover:bg-muted/50"
                    onClick={() => setDocumentToView(source)}
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-base font-medium">{source.document_name}</p>
                        {source.page_number && (
                          <p className="text-sm text-muted-foreground">Page {source.page_number}</p>
                        )}
                        {source.snippet && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {source.snippet}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={() => {
          fetchAllDocuments(getAccessToken, getUserId, getOrganizationId);
          setIsUploadModalOpen(false);
        }}
        selectedKB={selectedKB}
        knowledgeBases={knowledgeBases}
      />

      <DiscoverSourcesModal
        isOpen={isDiscoverSourcesModalOpen}
        onClose={() => setIsDiscoverSourcesModalOpen(false)}
      />

      {documentToView && (
        documentToView.document_name?.includes('.mp4') || documentToView.document_name?.includes('.mov') ? (
          <VideoViewerModal
            isOpen={!!documentToView}
            onClose={() => setDocumentToView(null)}
            document={documentToView}
          />
        ) : (
          <DocumentViewerModal
            isOpen={!!documentToView}
            onClose={() => setDocumentToView(null)}
            document={documentToView}
          />
        )
      )}

      {showKBModal && (
        <KnowledgeBaseModal
          isOpen={showKBModal}
          onClose={() => {
            setShowKBModal(false);
            fetchAllDocuments(getAccessToken, getUserId, getOrganizationId);
          }}
          knowledgeBases={knowledgeBases}
          selectedKBs={selectedKBs}
          multiKBMode={multiKBMode}
          onSelectionChange={handleKBSelectionChange}
          documents={allDocuments}
          selectedDocs={selectedDocs}
          onDocSelectionChange={handleKBModalDocSelection}
          onCreateKB={() => setShowCreateKBModal(true)}
          onDeleteKB={handleDeleteKB}
          onRenameKB={handleRenameKB}
        />
      )}

      {showCreateKBModal && (
        <CreateKnowledgeBaseModal
          isOpen={showCreateKBModal}
          onClose={() => setShowCreateKBModal(false)}
          onSubmit={handleCreateKB}
        />
      )}
    </div>
  );
}

// Loading component
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Shield className="h-16 w-16 text-primary animate-pulse mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Loading SoldierIQ...</h2>
      </div>
    </div>
  );
}

// Root App with auth wrapper
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

// App content with auth check
function AppContent() {
  const { user, loading } = useAuth();
  const [showAuthPage, setShowAuthPage] = useState(false);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    // Show landing page by default, or auth page if user clicked CTA
    if (showAuthPage) {
      return <AuthPage onBack={() => setShowAuthPage(false)} />;
    }
    return (
      <LandingPage
        onGetStarted={() => setShowAuthPage(true)}
        onLogin={() => setShowAuthPage(true)}
      />
    );
  }

  return <MainApp />;
}

// Knowledge Base Modal
function KnowledgeBaseModal({ isOpen, onClose, knowledgeBases, selectedKBs, multiKBMode, onSelectionChange, documents, selectedDocs, onDocSelectionChange, onCreateKB, onDeleteKB, onRenameKB }) {
  const [renamingKB, setRenamingKB] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const docsByKB = useMemo(() => {
    const map = new Map();
    knowledgeBases.forEach((kb) => map.set(kb.name, []));
    documents.forEach((doc) => {
      const kbName = doc.kb_name || doc.knowledge_base || (doc.document_id?.includes(':') ? doc.document_id.split(':', 1)[0] : 'default');
      if (!map.has(kbName)) {
        map.set(kbName, []);
      }
      map.get(kbName).push(doc);
    });
    return map;
  }, [documents, knowledgeBases]);

  const getSelectionState = (kbName) => {
    const kbDocs = docsByKB.get(kbName) || [];
    if (!kbDocs.length) return 'none';
    const selectedCount = kbDocs.filter((doc) => selectedDocs.has(doc.document_id)).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === kbDocs.length) return 'all';
    return 'some';
  };

  const handleKBToggle = (kbName) => {
    const kbDocs = docsByKB.get(kbName) || [];
    const state = getSelectionState(kbName);
    const next = new Set(selectedDocs);
    if (state === 'all') {
      kbDocs.forEach((doc) => next.delete(doc.document_id));
    } else {
      kbDocs.forEach((doc) => next.add(doc.document_id));
    }
    onDocSelectionChange(next);
  };

  const handleKBIncludeToggle = (kbName) => {
    const next = new Set(selectedKBs);
    if (next.has(kbName)) {
      next.delete(kbName);
    } else {
      next.add(kbName);
    }
    onSelectionChange(next, next.size > 1);
  };

  const handleDocToggle = (docId) => {
    const next = new Set(selectedDocs);
    if (next.has(docId)) {
      next.delete(docId);
    } else {
      next.add(docId);
    }
    onDocSelectionChange(next);
  };

  const startRename = (kbName, currentDisplayName) => {
    setRenamingKB(kbName);
    setRenameValue(currentDisplayName || kbName);
  };

  const submitRename = (kbName, e) => {
    e.preventDefault();
    if (renameValue.trim()) {
      onRenameKB(kbName, renameValue.trim());
    }
    setRenamingKB(null);
    setRenameValue('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Knowledge Base Selection</h2>
            <p className="text-sm text-muted-foreground">Select knowledge bases and documents to include in queries.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {knowledgeBases.length === 0 && (
            <div className="text-sm text-muted-foreground">No knowledge bases available.</div>
          )}

          {knowledgeBases.map((kb) => {
            const kbDocs = docsByKB.get(kb.name) || [];
            const selectionState = getSelectionState(kb.name);
            const includeKB = selectedKBs.has(kb.name);

            return (
              <div key={kb.name} className="border rounded-lg">
                <div className="flex flex-wrap items-center gap-3 justify-between p-4 bg-muted/40">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectionState === 'all'}
                      ref={(el) => {
                        if (el) el.indeterminate = selectionState === 'some';
                      }}
                      onChange={() => handleKBToggle(kb.name)}
                      className="h-4 w-4"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{kb.display_name || kb.name}</span>
                        <span className="text-xs text-muted-foreground">({kbDocs.length} docs)</span>
                      </div>
                      {kb.description && (
                        <p className="text-xs text-muted-foreground">{kb.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={includeKB}
                        onChange={() => handleKBIncludeToggle(kb.name)}
                        className="h-4 w-4"
                      />
                      Include KB
                    </label>
                    <Button size="icon" variant="ghost" onClick={() => startRename(kb.name, kb.display_name)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onDeleteKB(kb.name, kb.display_name || kb.name)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {renamingKB === kb.name && (
                  <form onSubmit={(e) => submitRename(kb.name, e)} className="p-4 border-t flex items-center gap-2 bg-muted/20">
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="flex-1"
                      placeholder="New display name"
                    />
                    <Button type="submit" size="sm">Save</Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRenamingKB(null);
                        setRenameValue('');
                      }}
                    >
                      Cancel
                    </Button>
                  </form>
                )}

                {kbDocs.length > 0 && (
                  <div className="p-4 border-t space-y-2 bg-background max-h-48 overflow-y-auto">
                    {kbDocs.map((doc) => {
                      const isSelected = selectedDocs.has(doc.document_id);
                      const isVideo = doc.document_name?.match(/\.(mp4|mov)$/i);
                      return (
                        <label key={doc.document_id} className="flex items-center gap-3 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleDocToggle(doc.document_id)}
                            className="h-4 w-4"
                          />
                          {isVideo ? (
                            <Video className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="truncate" title={doc.document_name}>{doc.document_name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t bg-muted/30 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedDocs.size} document{selectedDocs.size === 1 ? '' : 's'} selected
            {multiKBMode && ' • Multi-KB mode active'}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCreateKB}>
              <Plus className="h-4 w-4 mr-2" />
              Create KB
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Create Knowledge Base Modal
function CreateKnowledgeBaseModal({ isOpen, onClose, onSubmit }) {
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedName = displayName.trim();
    if (!trimmedName) return;
    const kbName = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    onSubmit(kbName || trimmedName, trimmedName, description.trim());
    setDisplayName('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background border rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Create Knowledge Base</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g., Maintenance Procedures"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                placeholder="Brief description of this knowledge base"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!displayName.trim()}>Create</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;