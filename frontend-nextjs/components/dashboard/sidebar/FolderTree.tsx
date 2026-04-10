"use client";

import React, { useMemo } from "react";
import { Document, KnowledgeBase } from "@/types";
import FolderItem from "./FolderItem";

interface FolderTreeProps {
  documents: Document[];
  knowledgeBases: KnowledgeBase[];
  selectedDocs: Set<string>;
  expandedFolders: Set<string>;
  onToggleFolder: (folderName: string) => void;
  onToggleDoc: (docId: string) => void;
  onSelectAllFolder: (folderName: string, anySelected: boolean) => void;
  onDeleteDoc: (docId: string) => void;
  onDeleteFolder: (folderName: string) => void;
  deletingDocId: string | null;
  deletingKB: string | null;
  isLoading: boolean;
}

const FolderTree = React.memo(function FolderTree({
  documents,
  knowledgeBases,
  selectedDocs,
  expandedFolders,
  onToggleFolder,
  onToggleDoc,
  onSelectAllFolder,
  onDeleteDoc,
  onDeleteFolder,
  deletingDocId,
  deletingKB,
  isLoading,
}: FolderTreeProps) {
  const documentsByFolder = useMemo(() => {
    return (Array.isArray(documents) ? documents : []).reduce(
      (acc, doc) => {
        const folder = doc.folder_name || "Uncategorized";
        if (!acc[folder]) {
          acc[folder] = [];
        }
        acc[folder].push(doc);
        return acc;
      },
      {} as Record<string, Document[]>
    );
  }, [documents]);

  const folderList = useMemo(() => {
    const allFolders = new Set<string>();
    (Array.isArray(knowledgeBases) ? knowledgeBases : []).forEach((kb) =>
      allFolders.add(kb.name)
    );
    Object.keys(documentsByFolder).forEach((folder) =>
      allFolders.add(folder)
    );
    return Array.from(allFolders).sort();
  }, [knowledgeBases, documentsByFolder]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-200 dark:border-amber-400/20 border-t-blue-600 dark:border-t-amber-400 rounded-full animate-spin mb-4"></div>
        <div className="text-slate-500 text-sm">LOADING REPOSITORY...</div>
      </div>
    );
  }

  if (folderList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg
          className="w-16 h-16 text-slate-400 dark:text-slate-700 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <div className="text-slate-500 text-sm mb-2">NO DOCUMENTS</div>
        <div className="text-slate-600 text-xs">
          Create a knowledge base and upload documents
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {folderList.map((folderName, folderIdx) => (
        <FolderItem
          key={folderName}
          folderName={folderName}
          documents={documentsByFolder[folderName] || []}
          selectedDocs={selectedDocs}
          expandedFolders={expandedFolders}
          onToggleFolder={onToggleFolder}
          onToggleDoc={onToggleDoc}
          onSelectAllFolder={onSelectAllFolder}
          onDeleteDoc={onDeleteDoc}
          onDeleteFolder={onDeleteFolder}
          deletingDocId={deletingDocId}
          isDeletingFolder={deletingKB === folderName}
          animationDelay={folderIdx * 30}
        />
      ))}
    </div>
  );
});

export default FolderTree;
