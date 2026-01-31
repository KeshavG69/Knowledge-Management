import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUIStore = create(
  persist(
    (set) => ({
      // Theme
      theme: 'dark',
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.toggle('dark', theme === 'dark');
      },

      // Modals
      isUploadModalOpen: false,
      isDiscoverSourcesModalOpen: false,
      documentToView: null,

      setIsUploadModalOpen: (open) => set({ isUploadModalOpen: open }),
      setIsDiscoverSourcesModalOpen: (open) => set({ isDiscoverSourcesModalOpen: open }),
      setDocumentToView: (doc) => set({ documentToView: doc }),

      // Sidebar visibility
      isRightSidebarVisible: false,
      setIsRightSidebarVisible: (visible) => set({ isRightSidebarVisible: visible }),

      // Active mode
      activeMode: 'chat',
      setActiveMode: (mode) => set({ activeMode: mode }),

      // Processing status
      processingStatus: {
        is_processing: false,
        task_type: null,
        task_name: null,
        progress: null
      },
      setProcessingStatus: (status) => set({ processingStatus: status }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({ theme: state.theme })
    }
  )
);
