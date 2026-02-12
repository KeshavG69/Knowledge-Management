"use client";

import { useState } from "react";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { mindmapApi, MindMapResponse } from "@/lib/api/mindmap";
import { flashcardsApi, FlashcardData } from "@/lib/api/flashcards";
import MindMapViewer from "./MindMapViewer";
import ReportStudio from "./ReportStudio";
import FlashcardViewer from "./FlashcardViewer";
import PodcastGenerator from "../PodcastGenerator";

interface WorkflowOption {
  id: string;
  title: string;
  icon: React.ReactNode;
  available: boolean;
  description: string;
}

interface WorkflowPanelProps {
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

export default function WorkflowPanel({ isCollapsed: externalCollapsed, onToggleCollapse }: WorkflowPanelProps = {}) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mindMapData, setMindMapData] = useState<MindMapResponse | null>(null);
  const [showReportStudio, setShowReportStudio] = useState(false);
  const [flashcardData, setFlashcardData] = useState<FlashcardData | null>(null);
  const [showPodcastGenerator, setShowPodcastGenerator] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedDocs, documents } = useDocumentStore();
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const setIsCollapsed = (value: boolean) => {
    if (onToggleCollapse) {
      onToggleCollapse(value);
    } else {
      setInternalCollapsed(value);
    }
  };

  const workflows: WorkflowOption[] = [
    {
      id: "audio-overview",
      title: "Audio Overview",
      available: true,
      description: "Generate an AI-powered podcast discussion about your documents",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      ),
    },
    {
      id: "video-overview",
      title: "Video Overview",
      available: false,
      description: "Create a video summary with visual representations",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: "mind-map",
      title: "Mind Map",
      available: true,
      description: "Generate an interactive mind map from your knowledge base",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
    },
    {
      id: "reports",
      title: "Reports",
      available: true,
      description: "Generate comprehensive reports and summaries",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: "flashcards",
      title: "Flashcards",
      available: true,
      description: "Create study flashcards from your documents",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: "quiz",
      title: "Quiz",
      available: false,
      description: "Generate interactive quizzes to test knowledge",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      id: "infographic",
      title: "Infographic",
      available: false,
      description: "Design visual infographics from your data",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
    },
    {
      id: "slide-deck",
      title: "Slide Deck",
      available: false,
      description: "Create presentation slides automatically",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      ),
    },
  ];

  const handleWorkflowClick = async (workflow: WorkflowOption) => {
    if (!workflow.available) {
      return; // Do nothing for unavailable workflows
    }

    setSelectedWorkflow(workflow.id);
    setError(null);

    // Handle mind map generation
    if (workflow.id === "mind-map") {
      // Check if documents are selected
      if (selectedDocs.size === 0) {
        setError("Please select at least one document to generate a mind map");
        setTimeout(() => setError(null), 5000);
        return;
      }

      try {
        setIsGenerating(true);

        // Convert Set to Array of document IDs
        const documentIds = Array.from(selectedDocs);

        // Call API to generate mind map
        const response = await mindmapApi.generate(documentIds);

        // Show mind map viewer
        setMindMapData(response);
        setIsGenerating(false);
      } catch (err: any) {
        console.error("Failed to generate mind map:", err);
        setError(err.response?.data?.detail || "Failed to generate mind map. Please try again.");
        setIsGenerating(false);
        setTimeout(() => setError(null), 5000);
      }
    }

    // Handle flashcards generation
    if (workflow.id === "flashcards") {
      // Check if documents are selected
      if (selectedDocs.size === 0) {
        setError("Please select at least one document to generate flashcards");
        setTimeout(() => setError(null), 5000);
        return;
      }

      try {
        setIsGenerating(true);

        // Convert Set to Array of document IDs
        const documentIds = Array.from(selectedDocs);

        // Call API to generate flashcards
        const response = await flashcardsApi.generate(documentIds);

        // Show flashcard viewer
        setFlashcardData(response);
        setIsGenerating(false);
      } catch (err: any) {
        console.error("Failed to generate flashcards:", err);
        setError(err.response?.data?.detail || "Failed to generate flashcards. Please try again.");
        setIsGenerating(false);
        setTimeout(() => setError(null), 5000);
      }
    }

    // Handle reports workflow
    if (workflow.id === "reports") {
      setShowReportStudio(true);
    }

    // Handle audio overview workflow (podcast)
    if (workflow.id === "audio-overview") {
      // Check if documents are selected
      if (selectedDocs.size === 0) {
        setError("Please select at least one document to generate an audio overview");
        setTimeout(() => setError(null), 5000);
        return;
      }
      setShowPodcastGenerator(true);
    }
  };

  const handleCloseMindMap = () => {
    setMindMapData(null);
    setSelectedWorkflow(null);
  };

  const handleCloseFlashcards = () => {
    setFlashcardData(null);
    setSelectedWorkflow(null);
  };

  const handleCloseReportStudio = () => {
    setShowReportStudio(false);
    setSelectedWorkflow(null);
  };

  const handleClosePodcast = () => {
    setShowPodcastGenerator(false);
    setSelectedWorkflow(null);
  };

  // Collapsed state - show vertical workflow buttons
  if (isCollapsed) {
    return (
      <div className="w-14 bg-slate-100 dark:bg-slate-950 border-l border-slate-300 dark:border-slate-800 flex flex-col relative">
        {/* Expand button */}
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full p-3 hover:bg-slate-200 dark:hover:bg-slate-900 transition-colors border-b border-slate-300 dark:border-slate-800 group flex items-center justify-center"
          title="Expand Workflow Panel"
        >
          <svg className="w-5 h-5 text-blue-600 dark:text-amber-400 group-hover:text-blue-700 dark:group-hover:text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* Vertical workflow buttons */}
        <div className="flex-1 overflow-y-auto tactical-scrollbar">
          <div className="flex flex-col gap-2 p-2">
            {workflows.map((workflow) => (
              <button
                key={workflow.id}
                onClick={() => handleWorkflowClick(workflow)}
                disabled={!workflow.available}
                className={`relative p-2 flex items-center justify-center transition-all group ${
                  workflow.available
                    ? 'bg-white dark:bg-slate-900/50 hover:bg-blue-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/50 hover:border-blue-400 dark:hover:border-amber-400/50 cursor-pointer'
                    : 'bg-slate-100 dark:bg-slate-900/30 border border-slate-300 dark:border-slate-800/30 opacity-50 blur-[0.5px] cursor-not-allowed'
                }`}
                title={workflow.title + (workflow.available ? '' : ' (Coming Soon)')}
              >
                {/* Coming Soon Dot */}
                {!workflow.available && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-slate-400 dark:bg-slate-600 rounded-full"></div>
                )}

                {/* Icon */}
                <div className={workflow.available ? 'text-blue-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-600'}>
                  {workflow.icon}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950 border-l border-slate-300 dark:border-slate-800 flex flex-col relative">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <h2 className="text-sm font-bold text-blue-600 dark:text-amber-400 tracking-wider">WORKFLOW</h2>
          </div>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
            title="Collapse Workflow Panel"
          >
            <svg className="w-4 h-4 text-slate-500 hover:text-blue-600 dark:hover:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mt-1 tracking-wider">
          GENERATE INTELLIGENCE PRODUCTS
        </p>
      </div>

      {/* Workflow Grid */}
      <div className="flex-1 overflow-y-auto p-4 tactical-scrollbar">
        <div className="grid grid-cols-2 gap-3">
          {workflows.map((workflow) => (
            <button
              key={workflow.id}
              onClick={() => handleWorkflowClick(workflow)}
              disabled={!workflow.available}
              className={`relative tactical-panel p-3 text-left transition-all group ${
                workflow.available
                  ? 'hover:border-blue-400 dark:hover:border-amber-400/50 cursor-pointer'
                  : 'opacity-50 blur-[0.5px] cursor-not-allowed'
              }`}
              title={workflow.description}
            >
              {/* Coming Soon Badge */}
              {!workflow.available && (
                <div className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-slate-300 dark:bg-slate-700 border border-slate-400 dark:border-slate-600 text-[8px] font-bold text-slate-600 dark:text-slate-400 tracking-wider">
                  SOON
                </div>
              )}

              {/* Icon */}
              <div className={`mb-2 ${workflow.available ? 'text-blue-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-600'}`}>
                {workflow.icon}
              </div>

              {/* Title */}
              <div className={`text-[10px] font-semibold tracking-wider leading-tight ${
                workflow.available ? 'text-slate-800 dark:text-slate-200 group-hover:text-blue-700 dark:group-hover:text-amber-400' : 'text-slate-500 dark:text-slate-600'
              }`}>
                {workflow.title}
              </div>
            </button>
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-4 tactical-panel p-3 bg-blue-50 dark:bg-slate-900/30">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-tactical-green mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="text-[10px] text-tactical-green font-semibold tracking-wider mb-1">
                ACTIVE WORKFLOWS
              </div>
              <div className="text-[9px] text-slate-600 dark:text-slate-500 leading-relaxed">
                Audio Overview, Mind Maps, Reports, and Flashcards available. Select documents to generate intelligence products.
              </div>
            </div>
          </div>
        </div>

        {/* Selected Documents Info */}
        {selectedDocs.size > 0 && (
          <div className="mt-4 tactical-panel p-3 bg-blue-50 dark:bg-amber-900/20 border-blue-200 dark:border-amber-400/30">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-3 h-3 text-blue-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[10px] text-blue-700 dark:text-amber-400 font-semibold tracking-wider">
                {selectedDocs.size} DOCUMENT{selectedDocs.size !== 1 ? 'S' : ''} SELECTED
              </span>
            </div>
            <div className="text-[9px] text-slate-600 dark:text-slate-400">
              Ready to generate intelligence products
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 tactical-panel p-3 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-400/30">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-[10px] text-red-700 dark:text-red-400 font-semibold tracking-wider mb-1">
                  ERROR
                </div>
                <div className="text-[9px] text-red-600 dark:text-red-300 leading-relaxed">
                  {error}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {isGenerating && (
        <div className="absolute inset-0 bg-slate-100/90 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center">
            <div className="inline-block w-12 h-12 border-2 border-blue-600 dark:border-amber-400 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm text-blue-700 dark:text-amber-400 font-semibold tracking-wider">
              {selectedWorkflow === 'audio-overview' && 'GENERATING AUDIO OVERVIEW'}
              {selectedWorkflow === 'mind-map' && 'GENERATING MIND MAP'}
              {selectedWorkflow === 'flashcards' && 'GENERATING FLASHCARDS'}
              {selectedWorkflow === 'reports' && 'GENERATING REPORT'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Analyzing {selectedDocs.size} document{selectedDocs.size !== 1 ? 's' : ''}...</p>
          </div>
        </div>
      )}

      {/* Mind Map Viewer Modal */}
      {mindMapData && (
        <MindMapViewer mindMapData={mindMapData} onClose={handleCloseMindMap} />
      )}

      {/* Flashcard Viewer Modal */}
      {flashcardData && (
        <FlashcardViewer flashcardData={flashcardData} onClose={handleCloseFlashcards} />
      )}

      {/* Report Studio Modal - Rendered outside of workflow panel */}
      {showReportStudio && (
        <ReportStudio onClose={handleCloseReportStudio} />
      )}

      {/* Podcast Generator Modal */}
      {showPodcastGenerator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <PodcastGenerator 
            selectedDocumentIds={Array.from(selectedDocs)} 
            onClose={handleClosePodcast}
          />
        </div>
      )}
    </div>
  );
}
