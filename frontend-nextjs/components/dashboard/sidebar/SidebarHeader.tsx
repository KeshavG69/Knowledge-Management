"use client";

import React from "react";

interface SidebarHeaderProps {
  totalDocs: number;
  selectedCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onUploadClick: () => void;
  uploadStatus: string | null;
}

const SidebarHeader = React.memo(function SidebarHeader({
  totalDocs,
  selectedCount,
  onSelectAll,
  onClearSelection,
  onUploadClick,
  uploadStatus,
}: SidebarHeaderProps) {
  return (
    <>
      {/* Title + Upload Button */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-blue-600 dark:bg-amber-400"></div>
          <h2 className="text-base font-bold text-blue-600 dark:text-amber-400 tracking-wider">
            REPOSITORY
          </h2>
        </div>

        <button
          onClick={onUploadClick}
          disabled={uploadStatus !== null}
          className="tactical-btn tactical-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center justify-center gap-2">
            {uploadStatus === "uploading" ? (
              <>
                <div className="w-4 h-4 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin"></div>
                UPLOADING...
              </>
            ) : uploadStatus === "processing" ? (
              <>
                <div className="w-4 h-4 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin"></div>
                PROCESSING...
              </>
            ) : uploadStatus === "completed" ? (
              <>
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                COMPLETED
              </>
            ) : uploadStatus === "failed" ? (
              <>
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                FAILED
              </>
            ) : (
              <>
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
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                UPLOAD DOCUMENT
              </>
            )}
          </span>
        </button>
      </div>

      {/* Stats Bar */}
      <div className="px-4 py-2 bg-slate-200 dark:bg-slate-800/50 border-b border-slate-300 dark:border-slate-700/30 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 dark:bg-amber-400 rounded-full"></div>
            <span className="text-slate-600 dark:text-slate-400">TOTAL:</span>
            <span className="text-blue-600 dark:text-amber-400 font-mono font-semibold">
              {totalDocs}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-tactical-green rounded-full"></div>
            <span className="text-slate-600 dark:text-slate-400">
              SELECTED:
            </span>
            <span className="text-tactical-green font-mono font-semibold">
              {selectedCount}
            </span>
          </div>
        </div>
      </div>

      {/* Selection Controls */}
      {totalDocs > 0 && (
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-300 dark:border-slate-800">
          <button
            onClick={onSelectAll}
            className="text-xs text-blue-600 dark:text-amber-400 hover:text-blue-700 dark:hover:text-amber-300 tracking-wide font-semibold transition-colors"
          >
            SELECT ALL
          </button>
          {selectedCount > 0 && (
            <button
              onClick={onClearSelection}
              className="text-xs text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 tracking-wide transition-colors"
            >
              CLEAR
            </button>
          )}
        </div>
      )}
    </>
  );
});

export default SidebarHeader;
