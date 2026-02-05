import apiClient from './client';

// Helper to get user info from localStorage
const getUserParams = () => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.id && user.organization_id) {
        return {
          user_id: user.id,
          organisation_id: user.organization_id
        };
      }
    } catch (e) {
      console.error('Failed to parse user from localStorage:', e);
    }
  }
  return null;
};

export interface FormatSuggestion {
  name: string;
  description: string;
  prompt: string;
}

export interface SuggestionsResponse {
  status: 'not_found' | 'processing' | 'completed' | 'failed';
  suggestions: FormatSuggestion[] | null;
  error?: string;
  created_at?: string;
  updated_at?: string;
}

export const reportsApi = {
  // Trigger format suggestions generation
  triggerFormatSuggestions: async (documentIds: string[]): Promise<{ workflow_id: string; status: string; message: string }> => {
    const userParams = getUserParams();
    if (!userParams) {
      throw new Error('User not authenticated');
    }

    const response = await apiClient.post('/report-suggestions/suggest-formats', {
      document_ids: documentIds,
      user_id: userParams.user_id,
      organization_id: userParams.organisation_id,
    });

    return response.data;
  },

  // Get format suggestions (for polling)
  getSuggestions: async (documentIds: string[]): Promise<SuggestionsResponse> => {
    const response = await apiClient.post<SuggestionsResponse>('/report-suggestions/get-suggestions', {
      document_ids: documentIds,
    });

    return response.data;
  },

  // Generate report with streaming
  generateReport: async (
    documentIds: string[],
    prompt: string
  ): Promise<ReadableStream> => {
    const userParams = getUserParams();
    if (!userParams) {
      throw new Error('User not authenticated');
    }

    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('No access token found');
    }

    // Use fetch for SSE streaming
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reports/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        document_ids: documentIds,
        prompt,
        user_id: userParams.user_id,
        organization_id: userParams.organisation_id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Report generation failed');
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    return response.body;
  },
};
