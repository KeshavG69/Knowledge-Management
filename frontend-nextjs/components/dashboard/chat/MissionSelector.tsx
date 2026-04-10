"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface Mission {
  id: string;
  name: string;
  createdAt: string;
}

interface MissionSelectorProps {
  missions: Mission[];
  currentMissionId: string | null;
  onSelect: (mission: Mission) => void;
  onCreate: () => void;
}

const MissionSelector = React.memo(function MissionSelector({
  missions,
  currentMissionId,
  onSelect,
  onCreate,
}: MissionSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  const currentMissionName = currentMissionId
    ? missions.find((m) => m.id === currentMissionId)?.name || "Select Mission"
    : "Select Mission";

  const handleSelect = (mission: Mission) => {
    onSelect(mission);
    setShowDropdown(false);
  };

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-6 py-3">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 tracking-wider">
          MISSION:
        </span>
        <div className="relative flex-1 max-w-md" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full flex items-center justify-between tactical-input px-3 py-2 text-sm hover:border-blue-400 dark:hover:border-amber-400 transition-colors"
          >
            <span className="truncate text-slate-800 dark:text-slate-100 font-medium">
              {currentMissionName}
            </span>
            <svg
              className={`w-4 h-4 text-slate-500 transition-transform ${
                showDropdown ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xl z-50 max-h-64 overflow-y-auto tactical-scrollbar"
              >
                {missions.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                    No missions found. Create one to get started.
                  </div>
                ) : (
                  missions.map((mission) => (
                    <button
                      key={mission.id}
                      onClick={() => handleSelect(mission)}
                      className={`w-full px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800 ${
                        mission.id === currentMissionId
                          ? "bg-blue-100 dark:bg-slate-800"
                          : ""
                      }`}
                    >
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                        {mission.name}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-600 mt-1 font-mono">
                        {new Date(mission.createdAt).toLocaleString()}
                      </div>
                    </button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* New Mission Button */}
        <button
          onClick={onCreate}
          className="tactical-btn tactical-btn-primary p-2 flex items-center justify-center"
          title="Create New Mission"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>
    </div>
  );
});

export default MissionSelector;
