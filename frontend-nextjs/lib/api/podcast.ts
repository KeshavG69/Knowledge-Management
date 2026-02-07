import apiClient from './client';

export interface PodcastEpisode {
  _id: string;
  organization_id: string;
  document_ids: string[];
  title?: string;
  summary?: string;
  audio_file_key?: string;
  status: 'processing' | 'script_generated' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  script?: any;
}

export interface PodcastGenerationResponse {
  episode_id: string;
  status: string;
  message: string;
}

// Helper to get user info from localStorage
const getUserParams = () => {
  if (typeof window === 'undefined') return null;
  
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.organization_id) {
        return {
          organization_id: user.organization_id
        };
      }
    } catch (e) {
      console.error('Failed to parse user from localStorage:', e);
    }
  }
  return null;
};

export const podcastApi = {
  // Start podcast generation
  generatePodcast: async (documentIds: string[]): Promise<PodcastGenerationResponse> => {
    const userParams = getUserParams();
    if (!userParams) {
      throw new Error('User organization not found');
    }

    const response = await apiClient.post<PodcastGenerationResponse>('/podcasts/generate', {
      organization_id: userParams.organization_id,
      document_ids: documentIds
    });

    return response.data;
  },

  // Get podcast status/result by episode ID
  getPodcastStatus: async (episodeId: string): Promise<PodcastEpisode> => {
    const response = await apiClient.get<PodcastEpisode>(`/podcasts/${episodeId}`);
    return response.data;
  },
  
  // Get Presigned URL for Audio
  // Assuming there is a generic file access endpoint or we use the file_key directly with a signer
  // For now, let's assume the backend might provide a signed URL or we use the existing s3-signer if available.
  // But based on the backend implementation, the client receives a file_key. 
  // We might need a way to fetch the actual URL.
  // Checking backend routers/files.py or similar would be good, but for now we will stick to the core podcast endpoints.
};
