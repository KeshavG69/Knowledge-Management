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

export interface Flashcard {
  front: string;
  back: string;
}

export interface FlashcardData {
  title: string;
  cards: Flashcard[];
  workflow_id: string;
  card_count?: number;
  document_count?: number;
}

export interface FlashcardResponse {
  status: string;
  data: FlashcardData;
}

export const flashcardsApi = {
  /**
   * Generate flashcards from documents
   */
  generate: async (documentIds: string[]): Promise<FlashcardData> => {
    const userParams = getUserParams();
    if (!userParams) {
      throw new Error('User not authenticated');
    }

    const response = await apiClient.post<FlashcardResponse>('/flashcards/generate', {
      document_ids: documentIds,
      user_id: userParams.user_id,
      organization_id: userParams.organisation_id,
    });
    return response.data.data;
  },
};
