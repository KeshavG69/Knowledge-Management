"use client";

import { useState, useCallback, useMemo } from "react";
import { useAuthStore } from "@/lib/stores/authStore";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { useDocuments, useKnowledgeBases } from "@/lib/hooks/useDocuments";
import { useUploadDocument } from "@/lib/hooks/useUploadDocument";
import { useDeleteDocument, useDeleteKnowledgeBase } from "@/lib/hooks/useDeleteDocument";
import SidebarHeader from "./sidebar/SidebarHeader";
import FolderTree from "./sidebar/FolderTree";
import UploadModal from "./sidebar/UploadModal";

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);

  // Server state via React Query (cached, deduped)
  const { data: documents = [], isLoading } = useDocuments(user?.organization_id);
  const { data: knowledgeBases = [] } = useKnowledgeBases(user?.organization_id);

  // Mutations
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();
  const deleteKBMutation = useDeleteKnowledgeBase();

  // Client-side selection state (stays in Zustand)
  const {
    selectedDocs,
    uploadStatus,
    deletingKB,
    toggleDocSelection,
    selectAllDocs,
    deselectAllDocs,
    selectFolderDocs,
    deselectFolderDocs,
    uploadDocuments,
    uploadYouTubeVideo,
  } = useDocumentStore();

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const totalDocs = Array.isArray(documents) ? documents.length : 0;

  const folderList = useMemo(() => {
    const allFolders = new Set<string>();
    (Array.isArray(knowledgeBases) ? knowledgeBases : []).forEach((kb) =>
      allFolders.add(kb.name)
    );
    (Array.isArray(documents) ? documents : []).forEach((doc) => {
      const folder = doc.folder_name || "Uncategorized";
      allFolders.add(folder);
    });
    return Array.from(allFolders).sort();
  }, [knowledgeBases, documents]);

  const handleUploadClick = useCallback(() => {
    setShowUploadModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowUploadModal(false);
  }, []);

  const handleUpload = useCallback(
    async (files: File[], folderName: string) => {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(folderName);
        return next;
      });
      await uploadDocuments(files, folderName);
    },
    [uploadDocuments]
  );

  const handleYouTubeUpload = useCallback(
    async (url: string, folderName: string) => {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(folderName);
        return next;
      });
      await uploadYouTubeVideo(url, folderName);
    },
    [uploadYouTubeVideo]
  );

  const handleToggleFolder = useCallback((folderName: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
      }
      return next;
    });
  }, []);

  const handleSelectAllFolder = useCallback(
    (folderName: string, anySelected: boolean) => {
      if (anySelected) {
        deselectFolderDocs(folderName);
      } else {
        selectFolderDocs(folderName);
      }
    },
    [selectFolderDocs, deselectFolderDocs]
  );

  const handleDeleteDoc = useCallback(
    async (docId: string) => {
      if (confirm("Delete this document?")) {
        try {
          setDeletingDocId(docId);
          await deleteMutation.mutateAsync({ docId, organizationId: user?.organization_id || "" });
        } catch {
          // error handled by mutation
        } finally {
          setDeletingDocId(null);
        }
      }
    },
    [deleteMutation]
  );

  const handleDeleteFolder = useCallback(
    async (folderName: string) => {
      if (
        confirm(
          `Delete knowledge base "${folderName}"? This will delete all documents in it.`
        )
      ) {
        try {
          await deleteKBMutation.mutateAsync({ folderName, organizationId: user?.organization_id || "" });
          setExpandedFolders((prev) => {
            const next = new Set(prev);
            next.delete(folderName);
            return next;
          });
        } catch {
          // error handled by mutation
        }
      }
    },
    [deleteKBMutation]
  );

  return (
    <div className="flex-1 bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-amber-400/20 flex flex-col relative">
      <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-blue-400/40 dark:border-amber-400/40 z-10"></div>

      <SidebarHeader
        totalDocs={totalDocs}
        selectedCount={selectedDocs.size}
        onSelectAll={selectAllDocs}
        onClearSelection={deselectAllDocs}
        onUploadClick={handleUploadClick}
        uploadStatus={uploadStatus}
      />

      <div className="flex-1 overflow-y-auto tactical-scrollbar p-4">
        <FolderTree
          documents={documents}
          knowledgeBases={knowledgeBases}
          selectedDocs={selectedDocs}
          expandedFolders={expandedFolders}
          onToggleFolder={handleToggleFolder}
          onToggleDoc={toggleDocSelection}
          onSelectAllFolder={handleSelectAllFolder}
          onDeleteDoc={handleDeleteDoc}
          onDeleteFolder={handleDeleteFolder}
          deletingDocId={deletingDocId}
          deletingKB={deletingKB}
          isLoading={isLoading}
        />
      </div>

      <UploadModal
        isOpen={showUploadModal}
        onClose={handleCloseModal}
        folders={folderList}
        onUpload={handleUpload}
        onYouTubeUpload={handleYouTubeUpload}
        uploadStatus={uploadStatus}
      />
    </div>
  );
}
