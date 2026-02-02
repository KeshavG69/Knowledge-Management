import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import {
  Shield,
  Search,
  Video,
  MessageSquare,
  Database,
  Lock,
  Zap,
  CheckCircle2,
  ArrowRight,
  Play
} from 'lucide-react';

export default function LandingPage({ onGetStarted, onLogin }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Animated Grid Background */}
      <div className="fixed inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            animation: 'grid-scan 20s linear infinite'
          }}
        />
      </div>

      {/* Spotlight Effect */}
      <div
        className="fixed pointer-events-none opacity-30 blur-3xl"
        style={{
          width: '600px',
          height: '600px',
          left: `${mousePosition.x - 300}px`,
          top: `${mousePosition.y - 300}px`,
          background: 'radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, transparent 70%)',
          transition: 'all 0.3s ease-out'
        }}
      />

      {/* Noise Texture */}
      <div
        className="fixed inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' /%3E%3C/svg%3E")'
        }}
      />

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&family=Exo+2:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap');

        @keyframes grid-scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(50px); }
        }

        @keyframes scan-line {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }

        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slide-up {
          animation: slide-up 0.8s ease-out forwards;
        }

        .scan-line {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.8), transparent);
          animation: scan-line 8s linear infinite;
        }

        .military-border {
          position: relative;
        }

        .military-border::before {
          content: '';
          position: absolute;
          inset: -2px;
          background: linear-gradient(45deg,
            rgba(34, 197, 94, 0.3) 0%,
            transparent 50%,
            rgba(34, 197, 94, 0.3) 100%
          );
          z-index: -1;
          animation: pulse-glow 3s ease-in-out infinite;
        }

        .feature-card {
          transition: all 0.3s ease;
        }

        .feature-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(34, 197, 94, 0.1);
        }

        .feature-card:hover .feature-icon {
          transform: scale(1.1) rotate(5deg);
          color: rgba(34, 197, 94, 1);
        }

        .feature-icon {
          transition: all 0.3s ease;
        }
      `}</style>

      {/* Scan Line Effect */}
      <div className="scan-line" />

      {/* Navigation */}
      <nav className="relative z-50 border-b border-green-500/20 backdrop-blur-sm bg-black/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Shield className="h-10 w-10 text-green-500" />
                <div className="absolute inset-0 blur-lg bg-green-500/30 animate-pulse" />
              </div>
              <div>
                <h1
                  className="text-2xl font-bold tracking-wider"
                  style={{ fontFamily: "'Rajdhani', sans-serif" }}
                >
                  SOLDIER<span className="text-green-500">IQ</span>
                </h1>
                <p
                  className="text-[10px] text-green-500/80 tracking-[0.3em] uppercase"
                  style={{ fontFamily: "'Share Tech Mono', monospace" }}
                >
                  Tactical Intelligence System
                </p>
              </div>
            </div>

            <Button
              onClick={onLogin}
              variant="outline"
              className="border-green-500/50 text-green-500 hover:bg-green-500/10 hover:border-green-500"
              style={{ fontFamily: "'Rajdhani', sans-serif" }}
            >
              <Lock className="h-4 w-4 mr-2" />
              LOGIN
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className={`text-center ${isVisible ? 'animate-slide-up' : 'opacity-0'}`}>
            {/* Status Indicator */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/5 mb-8">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span
                className="text-xs text-green-500 tracking-wider uppercase"
                style={{ fontFamily: "'Share Tech Mono', monospace" }}
              >
                System Online • Secure Connection Established
              </span>
            </div>

            <h1
              className="text-7xl md:text-8xl font-bold mb-6 leading-none"
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                textShadow: '0 0 40px rgba(34, 197, 94, 0.3)'
              }}
            >
              INTELLIGENCE
              <br />
              <span className="text-green-500">AT THE SPEED</span>
              <br />
              OF THOUGHT
            </h1>

            <p
              className="text-xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed"
              style={{ fontFamily: "'Exo 2', sans-serif" }}
            >
              AI-powered knowledge management system for tactical operations.
              Search documents and videos instantly. Deploy intelligence in real-time.
              <span className="text-green-500 font-semibold"> Mission-critical decisions require mission-ready intelligence.</span>
            </p>

            <div className="flex items-center justify-center gap-4 mb-16">
              <Button
                onClick={onGetStarted}
                size="lg"
                className="military-border bg-green-500 text-black hover:bg-green-400 px-8 py-6 text-lg font-bold tracking-wider"
                style={{ fontFamily: "'Rajdhani', sans-serif" }}
              >
                <Play className="h-5 w-5 mr-2" />
                INITIATE MISSION
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>

              <Button
                onClick={onLogin}
                size="lg"
                variant="outline"
                className="border-green-500/50 text-green-500 hover:bg-green-500/10 px-8 py-6 text-lg font-bold tracking-wider"
                style={{ fontFamily: "'Rajdhani', sans-serif" }}
              >
                VETERAN ACCESS
              </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto pt-8 border-t border-green-500/20">
              {[
                { value: '< 100ms', label: 'Query Response' },
                { value: '99.9%', label: 'System Uptime' },
                { value: 'Unlimited', label: 'Knowledge Base' }
              ].map((stat, i) => (
                <div
                  key={i}
                  className="text-center"
                  style={{
                    animation: `slide-up 0.8s ease-out ${0.2 + i * 0.1}s forwards`,
                    opacity: 0
                  }}
                >
                  <div
                    className="text-3xl font-bold text-green-500 mb-1"
                    style={{ fontFamily: "'Share Tech Mono', monospace" }}
                  >
                    {stat.value}
                  </div>
                  <div
                    className="text-sm text-gray-500 uppercase tracking-wider"
                    style={{ fontFamily: "'Rajdhani', sans-serif" }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2
              className="text-5xl font-bold mb-4"
              style={{ fontFamily: "'Rajdhani', sans-serif" }}
            >
              TACTICAL <span className="text-green-500">CAPABILITIES</span>
            </h2>
            <p
              className="text-gray-400 text-lg"
              style={{ fontFamily: "'Exo 2', sans-serif" }}
            >
              Advanced AI systems engineered for mission-critical operations
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Search,
                title: 'Semantic Intelligence Search',
                description: 'Natural language queries across all documents and multimedia. Find needle-in-haystack intel instantly.',
                specs: ['Vector Search', 'Multi-Modal', 'Real-Time Indexing']
              },
              {
                icon: Video,
                title: 'Video Intelligence Analysis',
                description: 'Frame-by-frame video processing with scene detection. Search video content as easily as text.',
                specs: ['Scene Detection', 'Timestamp Navigation', 'Auto Transcription']
              },
              {
                icon: MessageSquare,
                title: 'AI Tactical Assistant',
                description: 'Conversational AI trained on your knowledge base. Get instant answers with source citations.',
                specs: ['Context-Aware', 'Multi-Turn Dialog', 'Source Tracking']
              },
              {
                icon: Database,
                title: 'Secure Knowledge Vault',
                description: 'Military-grade encryption for classified intelligence. Organize by missions, units, or operations.',
                specs: ['End-to-End Encryption', 'Access Control', 'Audit Logs']
              },
              {
                icon: Zap,
                title: 'Lightning Deployment',
                description: 'Sub-100ms query responses. Built for high-stakes, time-critical decision making.',
                specs: ['Edge Caching', 'CDN Delivery', 'Auto-Scaling']
              },
              {
                icon: Shield,
                title: 'Zero-Trust Architecture',
                description: 'JWT authentication, role-based access control, and complete data isolation.',
                specs: ['JWT Tokens', 'RBAC', 'Data Isolation']
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="feature-card group relative p-6 rounded-lg border border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent backdrop-blur-sm"
                style={{
                  animation: `slide-up 0.6s ease-out ${0.1 + i * 0.05}s forwards`,
                  opacity: 0
                }}
              >
                <div className="feature-icon mb-4 text-green-500">
                  <feature.icon className="h-12 w-12" strokeWidth={1.5} />
                </div>

                <h3
                  className="text-xl font-bold mb-2 text-white"
                  style={{ fontFamily: "'Rajdhani', sans-serif" }}
                >
                  {feature.title}
                </h3>

                <p
                  className="text-gray-400 mb-4 text-sm leading-relaxed"
                  style={{ fontFamily: "'Exo 2', sans-serif" }}
                >
                  {feature.description}
                </p>

                <div className="flex flex-wrap gap-2">
                  {feature.specs.map((spec, j) => (
                    <span
                      key={j}
                      className="text-xs px-2 py-1 rounded border border-green-500/30 text-green-500/80"
                      style={{ fontFamily: "'Share Tech Mono', monospace" }}
                    >
                      {spec}
                    </span>
                  ))}
                </div>

                {/* Hover Corner Accents */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-green-500/0 group-hover:border-green-500/50 transition-all duration-300" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-green-500/0 group-hover:border-green-500/50 transition-all duration-300" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Readiness Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative p-12 rounded-lg border-2 border-green-500/30 bg-gradient-to-br from-green-500/10 to-black backdrop-blur">
            {/* Corner Decorations */}
            <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-green-500" />
            <div className="absolute top-0 right-0 w-20 h-20 border-t-4 border-r-4 border-green-500" />
            <div className="absolute bottom-0 left-0 w-20 h-20 border-b-4 border-l-4 border-green-500" />
            <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-green-500" />

            <div className="text-center">
              <h2
                className="text-4xl md:text-5xl font-bold mb-6"
                style={{ fontFamily: "'Rajdhani', sans-serif" }}
              >
                MISSION <span className="text-green-500">READINESS</span>
                <br />
                STARTS NOW
              </h2>

              <p
                className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto"
                style={{ fontFamily: "'Exo 2', sans-serif" }}
              >
                Join intelligence teams already using SoldierIQ for tactical operations worldwide.
                Deploy in under 60 seconds.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                <Button
                  onClick={onGetStarted}
                  size="lg"
                  className="military-border bg-green-500 text-black hover:bg-green-400 px-10 py-6 text-xl font-bold tracking-wider w-full sm:w-auto"
                  style={{ fontFamily: "'Rajdhani', sans-serif" }}
                >
                  BEGIN DEPLOYMENT
                  <ArrowRight className="h-6 w-6 ml-2" />
                </Button>

                <Button
                  onClick={onLogin}
                  size="lg"
                  variant="outline"
                  className="border-2 border-green-500/50 text-green-500 hover:bg-green-500/10 px-10 py-6 text-xl font-bold tracking-wider w-full sm:w-auto"
                  style={{ fontFamily: "'Rajdhani', sans-serif" }}
                >
                  RETURNING USER
                </Button>
              </div>

              <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
                {[
                  'No Credit Card Required',
                  'Instant Access',
                  'Military-Grade Security'
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span style={{ fontFamily: "'Exo 2', sans-serif" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-green-500/20 mt-20 py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-green-500" />
              <span
                className="text-sm text-gray-500"
                style={{ fontFamily: "'Share Tech Mono', monospace" }}
              >
                SOLDIER<span className="text-green-500">IQ</span> © 2025 • CLASSIFIED
              </span>
            </div>

            <div
              className="text-xs text-gray-600 tracking-wider"
              style={{ fontFamily: "'Share Tech Mono', monospace" }}
            >
              SYSTEM STATUS: OPERATIONAL • SECURITY LEVEL: MAXIMUM
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
