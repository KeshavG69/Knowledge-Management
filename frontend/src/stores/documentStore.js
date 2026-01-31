import { create } from 'zustand';
import { API_ENDPOINTS } from '../config';

export const useDocumentStore = create((set, get) => ({
  // State
  allDocuments: [],
  documentsByKB: {},
  selectedDocs: new Set(),
  activeDocumentId: null,
  selectedDocumentDetails: { summary: '', tags: [] },
  removeMode: false,
  kbError: null,
  isKnowledgeExpanded: true,

  // Knowledge Base state
  knowledgeBases: [],
  selectedKB: null,
  selectedKBs: new Set(),
  isKBExpanded: false,
  multiKBMode: false,

  // Modals
  showCreateKBModal: false,
  showKBModal: false,

  // Actions
  setAllDocuments: (docs) => set({ allDocuments: docs }),

  setDocumentsByKB: (grouped) => set({ documentsByKB: grouped }),

  setSelectedDocs: (docs) => set({ selectedDocs: new Set(docs) }),

  addSelectedDoc: (docId) => set((state) => {
    const newSet = new Set(state.selectedDocs);
    newSet.add(docId);
    return { selectedDocs: newSet };
  }),

  removeSelectedDoc: (docId) => set((state) => {
    const newSet = new Set(state.selectedDocs);
    newSet.delete(docId);
    return { selectedDocs: newSet };
  }),

  selectAllDocs: () => {
    const { documentsByKB, selectedKB } = get();
    const documents = documentsByKB[selectedKB] || [];
    set({ selectedDocs: new Set(documents.map(d => d.document_id)) });
  },

  deselectAllDocs: () => set({ selectedDocs: new Set() }),

  setActiveDocumentId: (id) => set({ activeDocumentId: id }),

  setSelectedDocumentDetails: (details) => set({ selectedDocumentDetails: details }),

  setRemoveMode: (mode) => set({ removeMode: mode }),

  setKbError: (error) => set({ kbError: error }),

  setIsKnowledgeExpanded: (expanded) => set({ isKnowledgeExpanded: expanded }),

  // Knowledge Base actions
  setKnowledgeBases: (kbs) => set({ knowledgeBases: kbs }),

  setSelectedKB: (kb) => set({ selectedKB: kb }),

  setSelectedKBs: (kbs) => set({ selectedKBs: new Set(kbs) }),

  setIsKBExpanded: (expanded) => set({ isKBExpanded: expanded }),

  setMultiKBMode: (mode) => set({ multiKBMode: mode }),

  setShowCreateKBModal: (show) => set({ showCreateKBModal: show }),

  setShowKBModal: (show) => set({ showKBModal: show }),

  // Async actions
  fetchAllDocuments: async (getAccessToken, getUserId, getOrganizationId) => {
    try {
      const authToken = await getAccessToken();
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};

      // Add user_id and organization_id as query parameters
      const userId = getUserId();
      const orgId = getOrganizationId();
      const baseUrl = API_ENDPOINTS.listDocuments('All Knowledge Bases');

      // Build query string
      const params = new URLSearchParams();
      if (userId) params.append('user_id', userId);
      if (orgId) params.append('organization_id', orgId);

      const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;

      const response = await fetch(url, { headers });
      const result = await response.json();

      // Map backend fields to frontend fields
      const docs = (result.data || []).map(doc => ({
        ...doc,
        document_id: doc._id,           // Map _id to document_id
        document_name: doc.file_name,   // Map file_name to document_name
      }));

      set({ allDocuments: docs });

      // Group by folder_name
      const grouped = {};
      docs.forEach((doc) => {
        const kbName = doc.folder_name || null;
        if (kbName) {
          if (!grouped[kbName]) {
            grouped[kbName] = [];
          }
          grouped[kbName].push(doc);
        }
      });

      set({ documentsByKB: grouped, kbError: null });

      // Derive knowledge bases from documents (no separate API call needed)
      const uniqueFolders = [...new Set(docs.map(doc => doc.folder_name).filter(Boolean))];
      const kbs = uniqueFolders.map((folderName) => ({
        name: folderName,
        display_name: folderName,
        description: `Knowledge base: ${folderName}`,
      }));

      set({ knowledgeBases: kbs });

      // Auto-select first KB if none selected
      const { selectedKB } = get();
      if (!selectedKB && kbs.length > 0) {
        set({
          selectedKB: kbs[0].name,
          selectedKBs: new Set([kbs[0].name])
        });
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
      set({ kbError: err.message });
      throw err;
    }
  },

  fetchKnowledgeBases: async (getAccessToken) => {
    // No longer needed - folders are derived from documents
    // Keeping this function for backward compatibility but it does nothing
    console.log('[documentStore] fetchKnowledgeBases is deprecated - folders derived from documents');
  },

  deleteDocument: async (docId, selectedKB, getAccessToken, getUserId, getOrganizationId) => {
    try {
      const authToken = await getAccessToken();
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};

      const response = await fetch(API_ENDPOINTS.deleteDocument(docId, selectedKB), {
        method: 'DELETE',
        headers,
      });

      if (response.ok) {
        await get().fetchAllDocuments(getAccessToken, getUserId, getOrganizationId);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting document:', err);
      throw err;
    }
  },

  createKnowledgeBase: async (name, displayName, description) => {
    const response = await fetch(API_ENDPOINTS.knowledgeBases(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, display_name: displayName, description })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to create knowledge base');
    }
  },

  deleteKnowledgeBase: async (kbName) => {
    const response = await fetch(API_ENDPOINTS.knowledgeBase(kbName), {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to delete knowledge base');
    }

    // If deleted KB was selected, clear selection
    const { selectedKB } = get();
    if (selectedKB === kbName) {
      set({ selectedKB: null, selectedKBs: new Set() });
    }
  },

  renameKnowledgeBase: async (kbName, newDisplayName) => {
    const trimmedName = newDisplayName?.trim();
    if (!trimmedName) return;

    const response = await fetch(API_ENDPOINTS.knowledgeBase(kbName), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: trimmedName,
        description: `Updated knowledge base: ${trimmedName}`
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to rename knowledge base');
    }
  },
}));
