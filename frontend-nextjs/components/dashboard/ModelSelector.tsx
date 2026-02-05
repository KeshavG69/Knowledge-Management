"use client";

import { useState, useEffect, useRef } from "react";
import { useChatStore } from "@/lib/stores/chatStore";
import { modelsApi, Model } from "@/lib/api/models";

export default function ModelSelector() {
  const { selectedModel, setSelectedModel } = useChatStore();
  const [models, setModels] = useState<Model[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const modelsList = await modelsApi.list();
        setModels(modelsList);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch models:", error);
        setIsLoading(false);
      }
    };

    fetchModels();
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  }, [isOpen]);

  const selectedModelData = models.find((m) => m.id === selectedModel);

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className="tactical-panel px-4 py-2 bg-slate-100 dark:bg-slate-800/50">
        <span className="text-xs text-slate-500 tracking-wider">LOADING...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="tactical-panel px-4 py-2 hover:border-blue-400 dark:hover:border-amber-400/50 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all group flex items-center gap-2 z-50"
      >
        <svg className="w-4 h-4 text-blue-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <div className="flex flex-col items-start">
          <span className="text-[9px] text-slate-500 tracking-widest leading-none">MODEL</span>
          <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-blue-700 dark:group-hover:text-amber-400 font-semibold tracking-wide leading-tight">
            {selectedModelData?.name || "Select Model"}
          </span>
        </div>
        <svg
          className={`w-3 h-3 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[100]"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div
            className="fixed w-72 bg-white dark:bg-slate-900 border border-blue-200 dark:border-amber-400/20 shadow-2xl z-[200] tactical-panel max-h-96 overflow-y-auto tactical-scrollbar"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
            }}
          >
            <div className="p-2">
              <div className="text-[10px] text-slate-500 tracking-widest px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                SELECT AI MODEL
              </div>
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleModelSelect(model.id)}
                  className={`w-full text-left px-3 py-2.5 text-sm font-semibold tracking-wide transition-all duration-200 mt-1 ${
                    selectedModel === model.id
                      ? "bg-blue-50 dark:bg-amber-400/10 text-blue-700 dark:text-amber-400 border border-blue-200 dark:border-amber-400/30"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-amber-400 border border-transparent hover:border-blue-200 dark:hover:border-amber-400/30"
                  }`}
                  style={{
                    clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {selectedModel === model.id && (
                        <svg className="w-4 h-4 text-blue-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span>{model.name}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 tracking-wider">
                    {model.id}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
