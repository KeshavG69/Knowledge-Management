import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_ENDPOINTS } from '../config';

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // Model settings
      selectedModel: 'gemini-2.5-pro-preview-05-06',
      availableModels: [],
      previousModel: 'gemini-2.5-pro-preview-05-06',
      modelJustChanged: false,

      setSelectedModel: (model) => {
        const { selectedModel } = get();
        if (model !== selectedModel) {
          set({
            previousModel: selectedModel,
            selectedModel: model,
            modelJustChanged: true
          });
        }
      },

      setAvailableModels: (models) => set({ availableModels: models }),

      setModelJustChanged: (changed) => set({ modelJustChanged: changed }),

      fetchAvailableModels: async (getAccessToken) => {
        try {
          const authToken = await getAccessToken();
          const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
          const response = await fetch(API_ENDPOINTS.models(), { headers });
          const data = await response.json();

          if (data.models) {
            set({ availableModels: data.models });
            console.log('[fetchAvailableModels] Loaded models:', data.models);
          }
        } catch (err) {
          console.error('Error fetching available models:', err);
          set({
            availableModels: [
              {
                id: 'gemini-2.5-pro-preview-05-06',
                name: 'Gemini 2.5 Pro (Preview)',
                provider: 'cloud',
                provider_label: 'Cloud'
              }
            ]
          });
        }
      },

      // Voice settings
      selectedVoiceId: 'en-US-Chirp3-HD-Charon',
      availableVoices: [
        { id: 'en-US-Chirp3-HD-Charon', name: 'Charon', description: 'Deep, Authoritative Male (Commands & Briefings)' },
        { id: 'en-US-Chirp3-HD-Zephyr', name: 'Zephyr', description: 'Professional Female (Training & Education)' },
        { id: 'en-US-Chirp3-HD-Fenrir', name: 'Fenrir', description: 'Strong, Commanding Male (Operations)' },
        { id: 'en-US-Chirp3-HD-Aoede', name: 'Aoede', description: 'Articulate Female (Explanations & Q&A)' },
        { id: 'en-US-Neural2-A', name: 'Neural2-A', description: 'Standard Male (Fallback)' }
      ],

      setSelectedVoiceId: (voiceId) => set({ selectedVoiceId: voiceId }),

      // Audio agent mode
      isAudioAgentMode: false,
      isRecording: false,
      mediaRecorder: null,
      audioChunks: [],
      isTranscribing: false,
      ttsTriggeredRef: { current: false },

      setIsAudioAgentMode: (mode) => set({ isAudioAgentMode: mode }),
      setIsRecording: (recording) => set({ isRecording: recording }),
      setMediaRecorder: (recorder) => set({ mediaRecorder: recorder }),
      setAudioChunks: (chunks) => set({ audioChunks: chunks }),
      setIsTranscribing: (transcribing) => set({ isTranscribing: transcribing }),
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        selectedVoiceId: state.selectedVoiceId,
        isAudioAgentMode: state.isAudioAgentMode
      })
    }
  )
);
