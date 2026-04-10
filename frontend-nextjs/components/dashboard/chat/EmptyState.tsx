"use client";

import React from "react";
import { motion } from "framer-motion";

const EmptyState = React.memo(function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <motion.div
        className="max-w-3xl mx-auto text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Mission Briefing Header */}
        <div className="relative mb-8">
          <div className="inline-block">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-500/10 dark:bg-amber-500/10 border-2 border-blue-400/50 dark:border-amber-400/50 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-blue-500/5 dark:bg-amber-500/5 animate-pulse"></div>
                <svg className="w-7 h-7 text-blue-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L4 7v10c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V7l-8-5zm0 18c-3.31-1-6-5.46-6-9.4V8.3l6-4.45 6 4.45v2.3c0 3.94-2.69 8.4-6 9.4z" />
                  <path d="M10.23 14.83L7.4 12l-1.41 1.41L10.23 17.7l8-8-1.41-1.41z" />
                </svg>
              </div>
              <div className="text-left">
                <h2 className="text-2xl font-bold text-blue-600 dark:text-amber-400 tracking-wider leading-none">
                  SOLDIER<span className="text-blue-500 dark:text-amber-300">IQ</span>
                </h2>
                <div className="text-xs text-slate-500 tracking-widest mt-1">
                  INTELLIGENCE ANALYSIS SYSTEM
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-slate-600 dark:text-slate-400 mb-8 text-sm leading-relaxed">
          Tactical knowledge management system for intelligence operations.
          <br />
          Upload classified documents and query for strategic insights.
        </p>

        {/* Instructions */}
        <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 inline-block">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="tracking-wider">
              SELECT DOCUMENTS FROM REPOSITORY TO BEGIN ANALYSIS
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

export default EmptyState;
