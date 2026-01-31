/**
 * API Configuration
 * Maps frontend API calls to backend endpoints
 */

// Get base API URL from environment or default to empty (uses Vite proxy)
const getBaseUrl = () => {
  // In production, use environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // In development, use Vite proxy (no base URL needed, just /api)
  return '';
};

const BASE_URL = getBaseUrl();

/**
 * API Endpoints
 * All endpoints are prefixed with /api which gets proxied to backend:8000
 */
export const API_ENDPOINTS = {
  // Chat
  query: () => `${BASE_URL}/api/chat`,

  // Documents Management
  listDocuments: (kbName = 'All Knowledge Bases') => {
    // If "All Knowledge Bases", don't filter by folder
    if (kbName === 'All Knowledge Bases') {
      return `${BASE_URL}/api/upload/documents`;
    }
    return `${BASE_URL}/api/upload/documents?folder_name=${encodeURIComponent(kbName)}`;
  },

  deleteDocument: (docId, kbName = null) => {
    return `${BASE_URL}/api/upload/documents/${encodeURIComponent(docId)}`;
  },

  // File Upload (handles all file types - PDFs, videos, etc.)
  uploadDocument: () => `${BASE_URL}/api/upload/documents`,
  uploadVideo: () => `${BASE_URL}/api/upload/documents`, // Same endpoint

  // Knowledge Bases (Folders)
  listKnowledgeBases: () => `${BASE_URL}/api/upload/folders`,
  knowledgeBases: () => `${BASE_URL}/api/upload/folders`,
  knowledgeBase: (kbName) => `${BASE_URL}/api/upload/folders/${encodeURIComponent(kbName)}`,

  // Models
  models: () => `${BASE_URL}/api/models`,

  // Health Check
  health: () => `${BASE_URL}/api/health`,

  // Upload Task Status
  taskStatus: (taskId) => `${BASE_URL}/api/upload/tasks/${encodeURIComponent(taskId)}`,

  // Audio/TTS/STT
  tts: () => `${BASE_URL}/api/tts`,
  stt: () => `${BASE_URL}/api/stt`,
};

export default API_ENDPOINTS;
