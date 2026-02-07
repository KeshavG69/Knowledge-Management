"use client";

import { useState, useEffect, useRef } from "react";
import { chatSessionsApi, ChatSession } from "@/lib/api/documents";
import { useChatStore } from "@/lib/stores/chatStore";

interface SessionDropdownProps {
  hasUserMessages: boolean;
}

export default function SessionDropdown({ hasUserMessages }: SessionDropdownProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { startNewSession, loadSession, setLoadingSession } = useChatStore();

  // Fetch sessions on component mount
  useEffect(() => {
    fetchSessions();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedSessions = await chatSessionsApi.listSessions();
      setSessions(fetchedSessions);
    } catch (err: any) {
      console.error("Failed to fetch sessions:", err);
      setError(err.message || "Failed to load sessions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionSelect = async (session: ChatSession) => {
    try {
      setLoadingSession(true);
      setIsOpen(false);

      const sessionHistory = await chatSessionsApi.getSession(session.session_id);

      // Convert backend message format to frontend format
      // Filter out system messages - ChatMessage type only accepts "user" | "assistant"
      const formattedMessages = sessionHistory.messages
        .filter((msg) => msg.role === "user" || msg.role === "assistant")
        .map((msg, idx) => ({
          id: `${msg.created_at}-${idx}`,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          timestamp: new Date(msg.created_at * 1000).toISOString(),
          ...(msg.model && { model: msg.model }),
        }));

      // Load session into chat store
      loadSession(session.session_id, formattedMessages);
    } catch (err: any) {
      console.error("Failed to load session:", err);
      setError(err.message || "Failed to load session");
    } finally {
      setLoadingSession(false);
    }
  };

  const handleNewSession = () => {
    startNewSession();
    setIsOpen(false);
    // Refresh sessions list to include the previous session
    fetchSessions();
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this session?")) {
      return;
    }

    try {
      await chatSessionsApi.deleteSession(sessionId);
      // Refresh sessions list
      await fetchSessions();
    } catch (err: any) {
      console.error("Failed to delete session:", err);
      alert(err.message || "Failed to delete session");
    }
  };

  const buttonText = hasUserMessages ? "NEW SESSION" : "PREVIOUS CHATS";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="tactical-btn tactical-btn-primary flex items-center gap-2"
      >
        {!hasUserMessages && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        )}
        {hasUserMessages && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        )}
        <span>{buttonText}</span>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute top-full mt-2 left-0 min-w-[300px] max-w-[400px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-lg z-50 max-h-[400px] overflow-y-auto tactical-scrollbar"
          style={{
            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
          }}
        >
          {/* New Session Option (only show when user has sent messages) */}
          {hasUserMessages && (
            <>
              <button
                onClick={handleNewSession}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-tactical-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm font-semibold text-blue-600 dark:text-amber-400 tracking-wider">
                    START NEW SESSION
                  </span>
                </div>
              </button>
              <div className="px-4 py-2 text-[10px] text-slate-500 dark:text-slate-600 tracking-widest uppercase border-b border-slate-200 dark:border-slate-700">
                Previous Sessions
              </div>
            </>
          )}

          {/* Loading State */}
          {isLoading && sessions.length === 0 && (
            <div className="px-4 py-8 text-center">
              <div className="w-6 h-6 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-500 mt-2">Loading sessions...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="px-4 py-3 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Sessions List */}
          {!isLoading && sessions.length === 0 && !error && (
            <div className="px-4 py-8 text-center text-xs text-slate-500">
              No previous sessions found
            </div>
          )}

          {sessions.length > 0 && (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {sessions.map((session) => (
                <button
                  key={session.session_id}
                  onClick={() => handleSessionSelect(session)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate mb-1">
                        {session.name}
                      </div>
                      {session.message_preview && (
                        <div className="text-xs text-slate-500 dark:text-slate-600 truncate">
                          {session.message_preview}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 dark:text-slate-700 mt-1">
                        {new Date(session.updated_at * 1000).toLocaleString()}
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDeleteSession(session.session_id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                      title="Delete session"
                    >
                      <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
