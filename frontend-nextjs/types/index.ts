// Auth Types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organization_id: string;
}

// Document Types
export interface Document {
  _id: string;
  file_name: string;
  folder_name?: string;
  user_id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  file_url?: string;
  // Processing status fields
  status?: 'processing' | 'completed' | 'failed';
  processing_stage?: string;
  processing_stage_description?: string;
  processing_progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  error?: string;
  completed_at?: string;
  failed_at?: string;
}

// Knowledge Base Types
export interface KnowledgeBase {
  name: string;
  folder_name: string;
  document_count: number;
  display_name: string;
}

// Chat Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  sources?: any[]; // Sources specific to this message
}

export interface SourceReference {
  document_id: string;
  filename: string;
  page_number?: number;
  snippet?: string;
  folder_name?: string;
}
