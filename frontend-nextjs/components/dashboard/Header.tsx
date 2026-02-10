"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";
import { useChatStore } from "@/lib/stores/chatStore";
import ModelSelector from "./ModelSelector";
import ThemeToggle from "../ThemeToggle";
import SessionDropdown from "./SessionDropdown";

export default function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { messages } = useChatStore();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const openCalendly = () => {
    const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/priceiq/30min';
    if (typeof window !== 'undefined' && window.Calendly) {
      window.Calendly.initPopupWidget({ url: calendlyUrl });
    } else {
      // Fallback to opening in new tab if Calendly widget hasn't loaded yet
      window.open(calendlyUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Check if user has sent any messages in the current session
  const hasUserMessages = messages.some((msg) => msg.role === "user");

  const getCurrentDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).toUpperCase();
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-amber-400/20 flex items-center justify-between px-6 relative z-30">
      {/* Decorative corner brackets */}
      <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-amber-400/40"></div>
      <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-amber-400/40"></div>

      <div className="flex items-center gap-6">
        {/* Logo & Status */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-400/50 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-amber-500/5 animate-pulse"></div>
              <svg className="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L4 7v10c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V7l-8-5zm0 18c-3.31-1-6-5.46-6-9.4V8.3l6-4.45 6 4.45v2.3c0 3.94-2.69 8.4-6 9.4z"/>
                <path d="M10.23 14.83L7.4 12l-1.41 1.41L10.23 17.7l8-8-1.41-1.41z"/>
              </svg>
            </div>
            <div className="absolute -top-1 -right-1">
              <div className="status-indicator status-active"></div>
            </div>
          </div>

          <div>
            <h1 className="text-xl font-bold text-blue-600 dark:text-amber-400 tracking-wider leading-none">
              SOLDIER<span className="text-blue-500 dark:text-amber-300">IQ</span>
            </h1>
            <div className="text-[10px] text-slate-500 dark:text-slate-500 tracking-widest mt-0.5">
              INTEL MANAGEMENT SYSTEM
            </div>
          </div>
        </div>

        {/* Model Selector */}
        <div className="ml-4">
          <ModelSelector />
        </div>

        {/* Session Dropdown */}
        <div className="ml-4">
          <SessionDropdown hasUserMessages={hasUserMessages} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Create Ticket Button */}
        <button
          onClick={() => {
            // TODO: Implement service desk ticket creation
            console.log('Create ticket clicked');
          }}
          className="px-3 py-2 border border-blue-400/50 dark:border-amber-400/50 bg-blue-500/10 dark:bg-amber-500/10 hover:bg-blue-500/20 dark:hover:bg-amber-500/20 text-blue-600 dark:text-amber-400 font-semibold text-xs tracking-wider transition-all duration-200"
          style={{
            clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
          }}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            CREATE A TICKET
          </span>
        </button>

        {/* Automated Agent Chat Button */}
        <button
          onClick={() => {
            // TODO: Implement automated agent chat
            console.log('Automated agent chat clicked');
          }}
          className="px-3 py-2 border border-blue-400/50 dark:border-amber-400/50 bg-blue-500/10 dark:bg-amber-500/10 hover:bg-blue-500/20 dark:hover:bg-amber-500/20 text-blue-600 dark:text-amber-400 font-semibold text-xs tracking-wider transition-all duration-200"
          style={{
            clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
          }}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            AUTOMATED AGENT CHAT
          </span>
        </button>

        {/* Live Agent Button */}
        <button
          onClick={openCalendly}
          className="px-3 py-2 border border-blue-400/50 dark:border-amber-400/50 bg-blue-500/10 dark:bg-amber-500/10 hover:bg-blue-500/20 dark:hover:bg-amber-500/20 text-blue-600 dark:text-amber-400 font-semibold text-xs tracking-wider transition-all duration-200"
          style={{
            clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
          }}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            LIVE AGENT
          </span>
        </button>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Profile */}
        <div className="relative">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowMenu(prev => !prev);
          }}
          className="flex items-center gap-3 px-3 py-2 border border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-amber-400/40 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all duration-200 relative group z-50"
          style={{
            clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
          }}
        >
          {/* User Avatar */}
          <div className="relative">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500/20 to-blue-600/20 dark:from-amber-500/20 dark:to-amber-600/20 border border-blue-400/50 dark:border-amber-400/50 flex items-center justify-center">
              <span className="text-blue-600 dark:text-amber-400 font-bold text-sm">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white dark:bg-slate-900 border border-tactical-green flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-tactical-green rounded-full"></div>
            </div>
          </div>

          {/* User Info */}
          <div className="text-left hidden sm:block">
            <div className="text-xs text-blue-600 dark:text-amber-400/90 font-semibold tracking-wide">
              OPERATOR
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 font-mono truncate max-w-[150px]">
              {user?.email}
            </div>
          </div>

          {/* Dropdown Arrow */}
          <svg
            className={`w-4 h-4 text-slate-500 dark:text-slate-500 transition-transform duration-200 ${showMenu ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-[100]"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
            />
            <div className="fixed top-16 right-6 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-amber-400/20 shadow-2xl z-[200] tactical-panel">
              <div className="p-2">
                {/* Settings Option */}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    // TODO: Navigate to settings page
                  }}
                  className="w-full text-left px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-amber-400 border border-transparent hover:border-blue-400/30 dark:hover:border-amber-400/30 transition-all duration-200 text-sm font-semibold tracking-wide mb-1"
                  style={{
                    clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
                  }}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    SETTINGS
                  </span>
                </button>

                {/* Logout Option */}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    handleLogout();
                  }}
                  className="w-full text-left px-4 py-2.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-400/30 dark:hover:border-red-500/30 transition-all duration-200 text-sm font-semibold tracking-wide"
                  style={{
                    clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
                  }}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    LOGOUT
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Bottom scan line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent"></div>
    </header>
  );
}
