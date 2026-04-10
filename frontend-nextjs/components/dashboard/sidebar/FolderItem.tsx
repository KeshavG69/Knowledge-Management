"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Document } from "@/types";
import DocumentItem from "./DocumentItem";

interface FolderItemProps {
  folderName: string;
  documents: Document[];
  selectedDocs: Set<string>;
  expandedFolders: Set<string>;
  onToggleFolder: (folderName: string) => void;
  onToggleDoc: (docId: string) => void;
  onSelectAllFolder: (folderName: string, anySelected: boolean) => void;
  onDeleteDoc: (docId: string) => void;
  onDeleteFolder: (folderName: string) => void;
  deletingDocId: string | null;
  isDeletingFolder: boolean;
  animationDelay: number;
}

const FolderItem = React.memo(function FolderItem({
  folderName,
  documents: folderDocs,
  selectedDocs,
  expandedFolders,
  onToggleFolder,
  onToggleDoc,
  onSelectAllFolder,
  onDeleteDoc,
  onDeleteFolder,
  deletingDocId,
  isDeletingFolder,
  animationDelay,
}: FolderItemProps) {
  const isExpanded = expandedFolders.has(folderName);
  const folderDocCount = folderDocs.length;

  if (folderDocCount === 0) return null;

  const folderDocIds = folderDocs.map((d) => d.id);
  const anyFolderDocsSelected = folderDocIds.some((id) => selectedDocs.has(id));

  return (
    <div
      className={`data-load ${isDeletingFolder ? "opacity-60 pointer-events-none" : ""}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Folder Header */}
      <div
        className="relative group transition-all duration-200 bg-slate-200 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-700/50 hover:border-blue-400 dark:hover:border-amber-400/30"
        style={{
          clipPath:
            "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
        }}
      >
        <div className="flex items-center gap-2 p-3">
          {/* Expand/Collapse Button */}
          <button
            onClick={() => onToggleFolder(folderName)}
            disabled={isDeletingFolder}
            className="text-blue-600 dark:text-amber-400 hover:text-blue-700 dark:hover:text-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <motion.svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </motion.svg>
          </button>

          {/* Folder Selection Checkbox */}
          <input
            type="checkbox"
            checked={anyFolderDocsSelected}
            disabled={isDeletingFolder}
            onChange={() => onSelectAllFolder(folderName, anyFolderDocsSelected)}
            className="tactical-checkbox disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              anyFolderDocsSelected
                ? "Deselect all documents in folder"
                : "Select all documents in folder"
            }
          />

          {/* Folder Icon or Loader */}
          {isDeletingFolder ? (
            <div className="w-4 h-4 border-2 border-blue-200 dark:border-amber-400/20 border-t-blue-600 dark:border-t-amber-400 rounded-full animate-spin"></div>
          ) : (
            <svg
              className="w-4 h-4 text-blue-600 dark:text-amber-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>
          )}

          {/* Folder Name */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-wide break-words">
              {folderName}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              {folderDocCount} DOCUMENT{folderDocCount !== 1 ? "S" : ""}
            </div>
          </div>

          {/* Delete Folder Button */}
          {!isDeletingFolder && (
            <button
              onClick={() => onDeleteFolder(folderName)}
              className="opacity-0 group-hover:opacity-100 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-all duration-200 p-1"
              title="Delete knowledge base"
            >
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Decorative corner */}
        <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-blue-400/20 dark:border-amber-400/20"></div>
      </div>

      {/* Folder Documents */}
      <AnimatePresence initial={false}>
        {isExpanded && folderDocs.length > 0 && (
          <motion.div
            key="folder-docs"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="ml-6 mt-1 space-y-1 border-l-2 border-slate-300 dark:border-slate-700/30 pl-3">
              {folderDocs.map((doc, index) => (
                <DocumentItem
                  key={doc.id}
                  document={doc}
                  isSelected={selectedDocs.has(doc.id)}
                  onToggle={onToggleDoc}
                  onDelete={onDeleteDoc}
                  isDeleting={deletingDocId === doc.id}
                  index={index}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default FolderItem;
