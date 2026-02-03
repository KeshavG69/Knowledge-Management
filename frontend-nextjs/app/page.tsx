"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/authStore";

export default function Home() {
  const router = useRouter();
  const { user, isInitializing } = useAuthStore();

  useEffect(() => {
    // Auto-redirect if already logged in
    if (!isInitializing && user) {
      router.push("/dashboard");
    }
  }, [user, isInitializing, router]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Tactical background effects */}
      <div className="absolute inset-0 scan-lines opacity-30"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900/10 via-slate-950 to-slate-950"></div>

      {/* Navigation */}
      <nav className="relative z-10 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-400/10 border-2 border-amber-400/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-amber-400 tracking-wider">KNOWLEDGE SYSTEM</h1>
                <p className="text-[9px] text-slate-500 tracking-widest">TACTICAL INTELLIGENCE PLATFORM</p>
              </div>
            </div>

            {/* Auth buttons */}
            <div className="flex items-center gap-3">
              <Link
                href="/auth/login"
                className="tactical-panel px-6 py-2 hover:border-amber-400/50 transition-all group"
              >
                <span className="text-sm text-slate-300 group-hover:text-amber-400 tracking-wider font-semibold">
                  SIGN IN
                </span>
              </Link>
              <Link
                href="/auth/signup"
                className="px-6 py-2 bg-amber-400 hover:bg-amber-500 transition-colors border-2 border-amber-400"
              >
                <span className="text-sm text-slate-950 tracking-wider font-bold">
                  GET STARTED
                </span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="space-y-8">
              <div className="inline-block tactical-panel px-4 py-2 bg-amber-400/10">
                <span className="text-xs text-amber-400 tracking-widest font-bold">
                  ● OPERATIONAL INTELLIGENCE
                </span>
              </div>

              <h2 className="text-5xl font-bold text-slate-100 leading-tight">
                Your Knowledge.
                <br />
                <span className="text-amber-400">Weaponized.</span>
              </h2>

              <p className="text-lg text-slate-400 leading-relaxed">
                Transform documents into tactical intelligence. Upload, analyze, and interact with your knowledge base using AI-powered chat, mind maps, and advanced workflows.
              </p>

              {/* Features */}
              <div className="space-y-3">
                {[
                  "AI-Powered Document Analysis",
                  "Interactive Mind Map Generation",
                  "Real-time Conversational Search",
                  "Multi-Document Intelligence",
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-tactical-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-slate-300 tracking-wide">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="flex items-center gap-4 pt-4">
                <Link
                  href="/auth/signup"
                  className="px-8 py-4 bg-amber-400 hover:bg-amber-500 transition-colors border-2 border-amber-400 group"
                >
                  <span className="text-base text-slate-950 tracking-wider font-bold flex items-center gap-2">
                    DEPLOY NOW
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </Link>
                <Link
                  href="/auth/login"
                  className="px-8 py-4 tactical-panel hover:border-amber-400/50 transition-all group"
                >
                  <span className="text-base text-slate-300 group-hover:text-amber-400 tracking-wider font-semibold">
                    SIGN IN
                  </span>
                </Link>
              </div>
            </div>

            {/* Right: Visual */}
            <div className="relative">
              <div className="tactical-panel p-8 bg-slate-900/30 relative">
                {/* Mock terminal */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-tactical-green"></div>
                    <span className="text-xs text-slate-500 font-mono ml-2">tactical-terminal</span>
                  </div>

                  <div className="space-y-2 font-mono text-sm">
                    <div className="text-tactical-green">$ initializing knowledge-system...</div>
                    <div className="text-slate-400">✓ Documents uploaded</div>
                    <div className="text-slate-400">✓ AI analysis complete</div>
                    <div className="text-slate-400">✓ Mind map generated</div>
                    <div className="text-amber-400 flex items-center gap-2">
                      <span className="animate-pulse">▸</span> System ready
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-800">
                    {[
                      { label: "DOCUMENTS", value: "1,234" },
                      { label: "QUERIES", value: "5.6K" },
                      { label: "UPTIME", value: "99.9%" },
                    ].map((stat, i) => (
                      <div key={i} className="text-center">
                        <div className="text-2xl font-bold text-amber-400">{stat.value}</div>
                        <div className="text-[9px] text-slate-500 tracking-widest mt-1">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 border-2 border-amber-400/20 animate-pulse"></div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 border-2 border-tactical-green/20 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-slate-100 mb-4">
              TACTICAL <span className="text-amber-400">CAPABILITIES</span>
            </h3>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Advanced AI-powered workflows to transform your documents into actionable intelligence
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                ),
                title: "AI Chat",
                description: "Conversational interface to query your knowledge base with natural language",
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                ),
                title: "Mind Maps",
                description: "Generate interactive visual representations of document relationships and concepts",
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                ),
                title: "Workflows",
                description: "Automated intelligence products including reports, flashcards, and presentations",
              },
            ].map((feature, i) => (
              <div key={i} className="tactical-panel p-6 bg-slate-900/30 hover:border-amber-400/50 transition-all group">
                <div className="w-12 h-12 mb-4 bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {feature.icon}
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-slate-100 mb-2 group-hover:text-amber-400 transition-colors">
                  {feature.title}
                </h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500 tracking-wider">
              © 2025 KNOWLEDGE SYSTEM. ALL RIGHTS RESERVED.
            </div>
            <div className="text-xs text-slate-600 font-mono">
              TACTICAL VISUALIZATION SYSTEM v1.0
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
