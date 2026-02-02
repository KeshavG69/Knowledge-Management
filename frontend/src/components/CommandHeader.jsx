import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Moon, Sun, BarChart3, User, Shield,
  MessageSquare, Sparkles, ChevronDown, LogOut, HelpCircle, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import demoVideo from '@/assets/SoldierIQ.mp4';

export default function CommandHeader({
  theme,
  setTheme,
  user,
  onLogout,
  activeMode = 'chat',
  onModeChange,
  selectedModel,
  onModelChange,
  availableModels = [],
  onConnectInoc,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Parse email to extract first and last name
  const parseEmailToName = (email) => {
    if (!email) return { firstName: '', lastName: '' };

    const username = email.split('@')[0];
    let parts = [];

    // Strategy 1: Try to split by common delimiters
    if (username.includes('.')) {
      parts = username.split('.');
    } else if (username.includes('_')) {
      parts = username.split('_');
    } else if (username.includes('-')) {
      parts = username.split('-');
    } else {
      // Strategy 2: Try to detect camelCase pattern
      const camelCaseMatch = username.match(/([a-z]+)([A-Z][a-z]*)/);
      if (camelCaseMatch) {
        parts = [camelCaseMatch[1], camelCaseMatch[2]];
      } else {
        // Strategy 3: Split in middle
        const mid = Math.ceil(username.length / 2);
        parts = [username.substring(0, mid), username.substring(mid)];
      }
    }

    let firstName = parts[0] || '';
    let lastName = parts[1] || '';

    firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    lastName = lastName.charAt(0).toUpperCase() + lastName.slice(1);

    return { firstName, lastName };
  };

  const parsedName = useMemo(() => {
    if (user) {
      // Use firstName and lastName from authenticated user
      if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`.trim();
      }
      // Fallback: parse from email if name not available
      if (user.email) {
        const { firstName, lastName } = parseEmailToName(user.email);
        return `${firstName} ${lastName}`.trim();
      }
    }
    return '';
  }, [user]);

  const getAvatarInitials = () => {
    // Use firstName and lastName from authenticated user
    if (user?.firstName && user?.lastName) {
      return (user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase();
    }
    // Fallback to email
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleLogout = () => {
    setDropdownOpen(false);
    onLogout();
  };

  const closeHelpModal = () => {
    setHelpModalOpen(false);
  };

  return (
    <>
      <header className="w-full h-20 bg-card border-b border-border flex items-center justify-between px-8 shadow-sm">
        {/* Left Section - Title and Mission Context */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-primary tracking-wide">SOLDIER IQ</h1>
              <p className="text-sm text-muted-foreground tracking-wider">TACTICAL INTEL SYSTEM</p>
            </div>
          </div>
        </div>

        {/* Center Section - Mode Toggle */}
        <div className="flex items-center">
          <div className="flex bg-muted rounded-lg p-1.5">
            <button
              onClick={() => onModeChange('chat')}
              className={cn(
                "px-8 py-3 rounded-md font-medium text-base transition-all flex items-center gap-2",
                activeMode === 'chat'
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="h-5 w-5" />
              CHAT
            </button>
            <button
              onClick={() => onModeChange('studio')}
              className={cn(
                "px-8 py-3 rounded-md font-medium text-base transition-all flex items-center gap-2",
                activeMode === 'studio'
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="h-5 w-5" />
              STUDIO
            </button>
          </div>
        </div>

        {/* Right Section - Controls and User */}
        <div className="flex items-center gap-4">
          {/* Model Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground uppercase">Model</span>
            <Select value={selectedModel} onValueChange={onModelChange}>
              <SelectTrigger className="w-[260px] h-11 text-sm">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.length > 0 ? (
                  availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                      {model.provider_label && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          [{model.provider_label}]
                        </span>
                      )}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="anthropic/claude-sonnet-4.5">
                    Claude Sonnet 4.5 [Anthropic]
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Connect to INOC Service Desk Button */}
          <Button
            size="default"
            className="whitespace-nowrap text-sm"
            onClick={onConnectInoc}
          >
            Connect to INOC Service Desk
          </Button>

          {/* Analytics */}
          <Button
            variant="ghost"
            size="default"
            className="text-muted-foreground hover:text-foreground"
          >
            <BarChart3 className="h-5 w-5 mr-2" />
            <span className="text-sm font-medium tracking-wider">ANALYTICS</span>
          </Button>

          {/* Help Button with Rainbow Border */}
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
              background: 'linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #ff0000)',
              backgroundSize: '300% 300%',
              animation: 'gradient 3s linear infinite',
              padding: '2px',
              borderRadius: '8px',
            }}
          >
            <style>{`
              @keyframes gradient {
                0% { background-position: 0% 50%; }
                100% { background-position: 100% 50%; }
              }
            `}</style>
            <button
              onClick={() => setHelpModalOpen(true)}
              className="bg-card text-foreground hover:bg-muted px-3 py-2 rounded-md transition-colors flex items-center justify-center"
              title="Watch SoldierIQ at a glance"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="default"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* User Menu */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-base">
                  {getAvatarInitials()}
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50">
                  <div className="p-3">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-base font-medium text-foreground">
                        {parsedName || user.name || 'User'}
                      </p>
                      {user.email && (
                        <p className="text-sm text-muted-foreground">
                          {user.email}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-base text-foreground hover:bg-muted rounded-md transition-colors mt-2"
                    >
                      <LogOut className="h-5 w-5" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button
              variant="ghost"
              size="default"
              className="text-muted-foreground hover:text-foreground"
            >
              <User className="h-5 w-5" />
            </Button>
          )}
        </div>
      </header>

      {/* Help Modal */}
      {helpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                SoldierIQ at a glance
              </h2>
              <button
                onClick={closeHelpModal}
                className="p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Modal Body - Video Container */}
            <div className="p-6">
              <div className="w-full bg-black rounded-lg overflow-hidden">
                <video
                  width="100%"
                  height="600"
                  controls
                  controlsList="nodownload"
                  className="w-full bg-black"
                >
                  <source src={demoVideo} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Video Controls Info */}
              
            </div>
          </div>
        </div>
      )}
    </>
  );
}