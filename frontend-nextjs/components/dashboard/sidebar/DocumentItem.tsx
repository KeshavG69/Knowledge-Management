"use client";

import React from "react";
import { motion } from "framer-motion";
import { Document } from "@/types";

interface DocumentItemProps {
  document: Document;
  isSelected: boolean;
  onToggle: (docId: string) => void;
  onDelete: (docId: string) => void;
  isDeleting: boolean;
  index?: number;
}

const DocumentItem = React.memo(function DocumentItem({
  document: doc,
  isSelected,
  onToggle,
  onDelete,
  isDeleting,
  index = 0,
}: DocumentItemProps) {
  const isFailed = doc.status === "failed";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`relative bg-slate-100 dark:bg-slate-800/30 border border-slate-300 dark:border-slate-700/40 transition-all duration-200 group ${
        isDeleting
          ? "opacity-60"
          : isFailed
            ? "opacity-50"
            : "hover:border-blue-400 dark:hover:border-amber-400/30 hover:bg-slate-200 dark:hover:bg-slate-800/50"
      }`}
      style={{
        clipPath:
          "polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)",
      }}
    >
      <div className="flex items-start gap-2 p-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(doc.id)}
          className="tactical-checkbox mt-1"
          disabled={doc.status === "processing" || isFailed || isDeleting}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <div className="text-xs font-medium text-slate-700 dark:text-slate-200 break-words flex-1">
              {doc.file_name}
            </div>
            {isDeleting && (
              <div className="w-3 h-3 border border-red-200 dark:border-red-400/20 border-t-red-600 dark:border-t-red-400 rounded-full animate-spin flex-shrink-0"></div>
            )}
            {!isDeleting && doc.status === "processing" && (
              <div className="w-3 h-3 border border-blue-200 dark:border-amber-400/20 border-t-blue-600 dark:border-t-amber-400 rounded-full animate-spin flex-shrink-0"></div>
            )}
          </div>
          {isDeleting && (
            <div className="text-[9px] text-red-600 dark:text-red-400 mt-0.5">
              Deleting document...
            </div>
          )}
          {!isDeleting &&
            doc.status === "processing" &&
            doc.processing_stage_description && (
              <div className="text-[9px] text-blue-600 dark:text-amber-400/70 mt-0.5">
                {doc.processing_stage_description}
              </div>
            )}
          {!isDeleting && doc.status === "failed" && doc.error && (
            <div className="text-[9px] text-red-500 dark:text-red-400 mt-0.5">
              {doc.error}
            </div>
          )}
          {!isDeleting && (!doc.status || doc.status === "completed") && (
            <div className="text-[10px] text-slate-600 font-mono mt-0.5">
              {doc.created_at
                ? new Date(doc.created_at)
                    .toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                    })
                    .toUpperCase()
                : "N/A"}
            </div>
          )}
        </div>
        {!isDeleting && (
          <button
            onClick={() => onDelete(doc.id)}
            className={`text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-all duration-200 p-1 flex-shrink-0 ${
              isFailed
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100"
            }`}
            title="Delete document"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  );
});

export default DocumentItem;
