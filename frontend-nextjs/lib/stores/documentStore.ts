import { create } from 'zustand';
import { Document, KnowledgeBase } from '@/types';
import { documentsApi } from '../api/documents';

// Helper function for background polling
const startBackgroundPolling = (
  uploadedDocIds: string[],
  maxFileSizeMB: number,
  get: any,
  set: any
) => {
  // Calculate dynamic polling interval based on file size
  const calculatePollingInterval = (sizeMB: number): number => {
    if (sizeMB < 1) {
      return 1500; // Small files: 1.5 seconds
    } else if (sizeMB < 5) {
      return 2500; // Medium files (1-5MB): 2.5 seconds
    } else if (sizeMB < 20) {
      return 4000; // Large files (5-20MB): 4 seconds
    } else if (sizeMB < 50) {
      return 6000; // Very large files (20-50MB): 6 seconds
    } else if (sizeMB < 100) {
      return 10000; // Huge files (50-100MB): 10 seconds
    } else {
      return 15000; // Massive files (>100MB): 15 seconds
    }
  };

  const pollingIntervalMs = calculatePollingInterval(maxFileSizeMB);
  console.log(`📊 Background polling started: ${pollingIntervalMs}ms interval (max file size: ${maxFileSizeMB.toFixed(2)}MB)`);

  // Poll SPECIFIC documents by ID to check for status updates (more efficient)
  const pollInterval = setInterval(async () => {
    try {
      // Fetch each document by ID to check status
      const statusChecks = await Promise.all(
        uploadedDocIds.map(docId => documentsApi.getDocument(docId))
      );

      // Update documents in store with latest status
      const currentDocs = get().documents;
      const updatedDocs = currentDocs.map((doc: Document) => {
        const updatedDoc = statusChecks.find(d => d._id === doc._id);
        return updatedDoc || doc;
      });
      set({ documents: updatedDocs });

      // Check if all uploaded documents are completed/failed
      const stillProcessing = statusChecks.filter(d => d.status === 'processing');

      if (stillProcessing.length === 0) {
        // All documents processed
        clearInterval(pollInterval);
        set({ uploadStatus: 'completed' });

        // Refresh the full list once to ensure we have latest data
        await get().fetchDocuments();
        await get().fetchKnowledgeBases();

        // Clear status after 2 seconds
        setTimeout(() => {
          set({ uploadStatus: null, uploadProgress: null });
        }, 2000);
      }
    } catch (error: any) {
      console.error('Polling error:', error);
      clearInterval(pollInterval);
      set({ uploadStatus: 'failed', error: error.message, uploadProgress: null });
    }
  }, pollingIntervalMs); // Dynamic interval based on file size
};

interface DocumentState {
  // State
  documents: Document[];
  knowledgeBases: KnowledgeBase[];
  selectedKB: string | null;
  selectedDocs: Set<string>;
  isLoading: boolean;
  error: string | null;
  uploadStatus: string | null;
  uploadProgress: { current: number; total: number } | null;

  // Actions
  fetchDocuments: () => Promise<void>;
  fetchKnowledgeBases: () => Promise<void>;
  uploadDocuments: (files: File[], folderName: string) => Promise<void>;
  deleteDocument: (docId: string) => Promise<void>;
  deleteKnowledgeBase: (folderName: string) => Promise<void>;
  setSelectedKB: (kb: string | null) => void;
  toggleDocSelection: (docId: string) => void;
  selectAllDocs: () => void;
  deselectAllDocs: () => void;
  selectFolderDocs: (folderName: string) => void;
  deselectFolderDocs: (folderName: string) => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  // State
  documents: [],
  knowledgeBases: [],
  selectedKB: null,
  selectedDocs: new Set(),
  isLoading: false,
  error: null,
  uploadStatus: null,
  uploadProgress: null,

  // Actions
  fetchDocuments: async () => {
    try {
      set({ isLoading: true, error: null });
      const docs = await documentsApi.listDocuments();
      set({ documents: Array.isArray(docs) ? docs : [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false, documents: [] });
    }
  },

  fetchKnowledgeBases: async () => {
    try {
      const kbs = await documentsApi.listFolders();
      set({ knowledgeBases: Array.isArray(kbs) ? kbs : [] });
    } catch (error: any) {
      console.error('Failed to fetch knowledge bases:', error);
      set({ knowledgeBases: [] });
    }
  },

  uploadDocuments: async (files, folderName) => {
    try {
      set({ error: null, uploadStatus: 'uploading', uploadProgress: { current: 0, total: files.length } });

      // Calculate largest file size for dynamic polling interval
      const fileSizesInMB = files.map(f => f.size / (1024 * 1024));
      const maxFileSizeMB = Math.max(...fileSizesInMB);

      // Optimistic update: Add placeholder documents immediately (no isLoading, keeps existing docs)
      const existingDocs = get().documents;
      const placeholderDocs = files.map((file, index) => ({
        _id: `temp_${Date.now()}_${index}`, // Temporary ID
        file_name: file.name,
        folder_name: folderName,
        user_id: '',
        organization_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'processing' as const,
        processing_stage: 'uploading',
        processing_stage_description: 'Uploading file to server...',
      }));

      // Add placeholders to existing documents (don't replace)
      set({ documents: [...placeholderDocs, ...existingDocs] });

      // Upload files - backend creates real documents and starts ingestion
      await documentsApi.uploadDocuments(files, folderName);

      // Fetch documents to get the real IDs from backend
      await get().fetchDocuments();
      await get().fetchKnowledgeBases();

      // Get the real document IDs for the files we just uploaded
      const uploadedDocs = get().documents.filter(
        d => d.folder_name === folderName &&
             d.status === 'processing' &&
             !d._id.startsWith('temp_') // Real IDs from backend
      );
      const uploadedDocIds = uploadedDocs.map(d => d._id);

      if (uploadedDocIds.length === 0) {
        // No processing documents found, might already be completed
        set({ uploadStatus: 'completed' });
        setTimeout(() => {
          set({ uploadStatus: null, uploadProgress: null });
        }, 2000);
        return;
      }

      // Set to processing status - at this point upload is done and ingestion started
      set({ uploadStatus: 'processing' });

      // Start background polling (non-blocking) - function returns immediately
      startBackgroundPolling(uploadedDocIds, maxFileSizeMB, get, set);

      // Function returns here - modal can close while polling continues in background

    } catch (error: any) {
      set({ error: error.message, uploadStatus: 'failed', uploadProgress: null });
      throw error;
    }
  },

  deleteDocument: async (docId) => {
    try {
      await documentsApi.deleteDocument(docId);
      await get().fetchDocuments();
      await get().fetchKnowledgeBases();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteKnowledgeBase: async (folderName) => {
    try {
      await documentsApi.deleteFolder(folderName);
      await get().fetchDocuments();
      await get().fetchKnowledgeBases();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  setSelectedKB: (kb) => set({ selectedKB: kb }),

  toggleDocSelection: (docId) => {
    const selectedDocs = new Set(get().selectedDocs);
    if (selectedDocs.has(docId)) {
      selectedDocs.delete(docId);
    } else {
      selectedDocs.add(docId);
    }
    set({ selectedDocs });
  },

  selectAllDocs: () => {
    const { documents } = get();
    const docIds = Array.isArray(documents) ? documents.map(d => d._id) : [];
    set({ selectedDocs: new Set(docIds) });
  },

  deselectAllDocs: () => set({ selectedDocs: new Set() }),

  selectFolderDocs: (folderName) => {
    const { documents, selectedDocs } = get();
    const folderDocIds = Array.isArray(documents)
      ? documents.filter(d => d.folder_name === folderName).map(d => d._id)
      : [];
    const newSelected = new Set(selectedDocs);
    folderDocIds.forEach(id => newSelected.add(id));
    set({ selectedDocs: newSelected });
  },

  deselectFolderDocs: (folderName) => {
    const { documents, selectedDocs } = get();
    const folderDocIds = Array.isArray(documents)
      ? documents.filter(d => d.folder_name === folderName).map(d => d._id)
      : [];
    const newSelected = new Set(selectedDocs);
    folderDocIds.forEach(id => newSelected.delete(id));
    set({ selectedDocs: newSelected });
  },
}));
