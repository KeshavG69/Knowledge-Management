"use client";

import React, { useEffect, useRef } from "react";
import { TAKCredentials } from "@/lib/api/documents";

interface ChatInputProps {
  inputMessage: string;
  isLoading: boolean;
  selectedDocsCount: number;
  takEnabled: boolean;
  takCredentials: TAKCredentials | null;
  onSend: (e: React.FormEvent) => void;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

const ChatInput = React.memo(function ChatInput({
  inputMessage,
  isLoading,
  selectedDocsCount,
  takEnabled,
  takCredentials,
  onSend,
  onChange,
  onKeyDown,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputMessage]);

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-4 flex-shrink-0">
      <div className="max-w-5xl mx-auto">
        {/* Status Bar */}
        <div className="flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center gap-4">
            {selectedDocsCount > 0 ? (
              <div className="flex items-center gap-2">
                <div className="status-indicator status-active"></div>
                <span className="text-tactical-green tracking-wider">
                  {selectedDocsCount} DOCUMENT
                  {selectedDocsCount !== 1 ? "S" : ""} ACTIVE
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

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-600 tracking-wider">
                STATUS:
              </span>
              <span
                className={`font-mono tracking-wider ${
                  isLoading
                    ? "text-blue-600 dark:text-amber-400"
                    : "text-tactical-green"
                }`}
              >
                {isLoading ? "PROCESSING" : "READY"}
              </span>
            </div>

            {takEnabled && takCredentials && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/30 dark:bg-green-400/10 dark:border-green-400/30">
                <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-bold text-green-600 dark:text-green-400 tracking-wider">
                  TAK ACTIVE
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={onSend} className="relative">
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              selectedDocsCount === 0
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
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              </svg>
            )}
          </button>
        </form>

        <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-600 text-center tracking-widest">
          ENTER: SUBMIT QUERY | SHIFT+ENTER: NEW LINE
        </div>
      </div>
    </div>
  );
});

export default ChatInput;
