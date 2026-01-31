import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export const useChatStore = create((set, get) => ({
  // State
  conversation: [],
  query: '',
  isLoading: false,
  thinkingMessage: null,
  error: null,
  lastParsedSources: [],
  sessionId: uuidv4(), // Initialize with a UUID

  // Generated outputs
  generatedDocuments: [],
  isGeneratingOutput: false,
  editingMessageId: null,
  editText: '',

  // Actions
  setConversation: (messagesOrUpdater) => set((state) => {
    // Handle both direct array and updater function
    const newConversation = typeof messagesOrUpdater === 'function'
      ? messagesOrUpdater(state.conversation)
      : messagesOrUpdater;

    // Ensure it's always an array
    return { conversation: Array.isArray(newConversation) ? newConversation : [] };
  }),

  addMessage: (message) => set((state) => ({
    conversation: [...state.conversation, message]
  })),

  updateMessage: (messageId, updates) => set((state) => ({
    conversation: state.conversation.map(msg =>
      msg.id === messageId ? { ...msg, ...updates } : msg
    )
  })),

  setQuery: (query) => set({ query }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setThinkingMessage: (message) => set({ thinkingMessage: message }),

  setError: (error) => set({ error }),

  setLastParsedSources: (sources) => set({ lastParsedSources: sources }),

  setGeneratedDocuments: (docs) => set({ generatedDocuments: docs }),

  addGeneratedDocument: (doc) => set((state) => ({
    generatedDocuments: [...state.generatedDocuments, doc]
  })),

  setIsGeneratingOutput: (generating) => set({ isGeneratingOutput: generating }),

  setEditingMessageId: (id) => set({ editingMessageId: id }),

  setEditText: (text) => set({ editText: text }),

  clearConversation: () => set({
    conversation: [],
    query: '',
    error: null,
    lastParsedSources: []
  }),

  // Create a new session with a new UUID
  startNewSession: () => set({
    sessionId: uuidv4(),
    conversation: [],
    query: '',
    error: null,
    lastParsedSources: [],
    generatedDocuments: [],
    thinkingMessage: null,
    editingMessageId: null,
    editText: ''
  }),

  // Helper to append agent message with sources
  appendAgentMessage: (text, sources = []) => {
    if (!text) return;

    const message = {
      sender: 'agent',
      text,
      id: `agent-${Date.now()}`,
      ...(sources.length ? { sources } : {}),
    };

    set((state) => ({
      conversation: [...state.conversation, message],
      lastParsedSources: sources.length ? sources : state.lastParsedSources
    }));
  },

  // Approve a generated document
  approveDocument: (messageId) => {
    const state = get();
    const message = state.conversation.find(msg => msg.id === messageId);

    if (message) {
      const newDoc = {
        id: Date.now(),
        type: message.documentType,
        title: message.documentTitle,
        content: message.text,
        createdAt: new Date().toISOString(),
        sources: message.sources || [],
      };

      set((state) => ({
        generatedDocuments: [...state.generatedDocuments, newDoc],
        conversation: state.conversation.map(msg =>
          msg.id === messageId
            ? { ...msg, pendingApproval: false, approved: true }
            : msg
        )
      }));
    }
  },

  // Edit a document message
  editDocument: (messageId) => {
    set((state) => ({
      conversation: state.conversation.map(msg =>
        msg.id === messageId
          ? { ...msg, pendingApproval: false, editMode: true }
          : msg
      )
    }));
  },

  // Cancel edit mode
  cancelEdit: (messageId) => {
    set((state) => ({
      conversation: state.conversation.map(msg =>
        msg.id === messageId
          ? { ...msg, editMode: false, pendingApproval: true, editText: '' }
          : msg
      )
    }));
  },
}));
