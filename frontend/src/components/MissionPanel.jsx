import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Send, Shield, StickyNote, Volume2, Brain,
  Mic, MicOff, Edit, Check, X,
  Info, CheckCircle2, Trash2, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ChatMessage from './ChatMessage';

export default function MissionPanel({
  conversation,
  isLoading,
  thinkingMessage,
  query,
  setQuery,
  onSendQuery,
  isRecording,
  onStartRecording,
  onStopRecording,
  isAudioAgentMode,
  selectedDocsCount = 0,
  onGenerateOutput,
  onApproveDocument,
  onEditDocument,
  onCancelEdit,
  onSubmitEdit,
  onEditMessage,
  onApproveEdit,
  editingMessageId,
  editText,
  setEditText,
  onClearSession
}) {
  const messagesEndRef = useRef(null);
  const [documentEditText, setDocumentEditText] = useState({});

  const scrollToBottom = () => {
    messagesEndRef?.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation, thinkingMessage]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendQuery();
    }
  };


  return (
    <div className="h-full flex flex-col bg-background">
      {/* Mission Status Bar */}
      <div className="px-8 py-4 bg-card border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium tracking-wider text-primary">MISSION READY</span>
          </div>
          <div className="h-5 w-px bg-border" />
          <span className="text-sm text-muted-foreground">
            {selectedDocsCount} SOURCES LOADED
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isAudioAgentMode && (
            <div className="px-4 py-2 bg-accent/20 rounded-md flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-accent">AUDIO MODE ACTIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* Conversation Area */}
      <ScrollArea className="flex-1 px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-5">
          {conversation.length === 0 && !isLoading && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Card className="card-mission border-2">
                <CardHeader className="text-center pb-6">
                  <div className="mx-auto mb-6 p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 w-fit">
                    <Shield className="h-12 w-12 text-primary" />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-foreground mb-3">
                    Welcome to Soldier IQ
                  </h2>
                  <p className="text-base text-muted-foreground max-w-lg mx-auto">
                    Your AI-powered tactical assistant for mission-critical intelligence and knowledge management
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground text-center">
                      Quick Actions
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <button
                        onClick={() => setQuery("Summarize the key findings from the selected documents")}
                        className="group p-5 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all hover:shadow-lg"
                      >
                        <StickyNote className="h-7 w-7 text-primary mb-3 mx-auto group-hover:scale-110 transition-transform" />
                        <p className="text-xs font-medium">Summarize</p>
                      </button>
                      <button
                        onClick={() => setQuery("Create an audio overview of the main topics")}
                        className="group p-5 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all hover:shadow-lg"
                      >
                        <Volume2 className="h-7 w-7 text-primary mb-3 mx-auto group-hover:scale-110 transition-transform" />
                        <p className="text-xs font-medium">Audio Brief</p>
                      </button>
                      <button
                        onClick={() => setQuery("Generate a mind map of the concepts")}
                        className="group p-5 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all hover:shadow-lg"
                      >
                        <Brain className="h-7 w-7 text-primary mb-3 mx-auto group-hover:scale-110 transition-transform" />
                        <p className="text-xs font-medium">Mind Map</p>
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 text-center">
                      Sample Queries
                    </h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => setQuery("What are the main themes in these documents?")}
                        className="w-full text-left px-4 py-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm border border-border/50 hover:border-primary/30"
                      >
                        What are the main themes in these documents?
                      </button>
                      <button
                        onClick={() => setQuery("Create a comparison table of key points")}
                        className="w-full text-left px-4 py-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm border border-border/50 hover:border-primary/30"
                      >
                        Create a comparison table of key points
                      </button>
                      <button
                        onClick={() => setQuery("Extract action items and recommendations")}
                        className="w-full text-left px-4 py-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm border border-border/50 hover:border-primary/30"
                      >
                        Extract action items and recommendations
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {Array.isArray(conversation) && conversation.map((message, index) => (
            <div key={message.id || index} className="animate-in fade-in slide-in-from-bottom-3 duration-500">
              <ChatMessage message={message} />

              {/* Document Approval / Edit UI */}
              {message.isGeneratedDocument && message.pendingApproval && !message.isEditing && (
                <div className="mt-3 pt-4 border-t border-border flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => onApproveDocument(message.id)}
                    className="h-9"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEditDocument(message.id)}
                    className="h-9"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              )}

              {/* Edit Mode UI */}
              {message.isGeneratedDocument && message.editMode && (
                <div className="mt-3 pt-4 border-t border-border space-y-3">
                  <div className="text-sm text-muted-foreground">
                    What would you like to change?
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g., Add more detail to step 3..."
                      value={documentEditText[message.id] || ''}
                      onChange={(e) => setDocumentEditText({...documentEditText, [message.id]: e.target.value})}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && documentEditText[message.id]?.trim()) {
                          onSubmitEdit(message.id, documentEditText[message.id]);
                          setDocumentEditText({...documentEditText, [message.id]: ''});
                        }
                      }}
                      className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (documentEditText[message.id]?.trim()) {
                          onSubmitEdit(message.id, documentEditText[message.id]);
                          setDocumentEditText({...documentEditText, [message.id]: ''});
                        }
                      }}
                      disabled={!documentEditText[message.id]?.trim()}
                      className="h-10"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onCancelEdit(message.id);
                        setDocumentEditText({...documentEditText, [message.id]: ''});
                      }}
                      className="h-10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Editing in progress indicator */}
              {message.isGeneratedDocument && message.isEditing && (
                <div className="mt-3 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    Applying edits...
                  </div>
                </div>
              )}

              {/* Approved indicator */}
              {message.isGeneratedDocument && message.approved && (
                <div className="mt-3 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Document approved and saved
                  </div>
                </div>
              )}

              {/* Edit text mode */}
              {editingMessageId === message.id && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full p-3 rounded-md border bg-background text-sm"
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={onApproveEdit}
                      className="h-8"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      APPROVE
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onCancelEdit}
                      className="h-8"
                    >
                      <X className="h-3 w-3 mr-1" />
                      CANCEL
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {thinkingMessage && (
            <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                </div>
                <span className="text-sm text-foreground font-medium">
                  {thinkingMessage}
                </span>
              </div>
            </div>
          )}

          {isLoading && !thinkingMessage && (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Query Input Area */}
      <div className="border-t border-border bg-card p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter mission query..."
                className="w-full px-5 py-4 pr-14 rounded-lg border border-border bg-background text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                rows={2}
                disabled={isLoading}
              />
              <button
                onClick={isRecording ? onStopRecording : onStartRecording}
                className={cn(
                  "absolute right-3 bottom-3 p-2 rounded-md transition-all",
                  isRecording
                    ? "bg-destructive text-destructive-foreground animate-pulse"
                    : "hover:bg-muted"
                )}
                disabled={isLoading}
              >
                {isRecording ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
            </div>
            {conversation.length > 0 && (
              <Button
                onClick={onClearSession}
                disabled={isLoading}
                size="lg"
                variant="ghost"
                className="px-5 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
            <Button
              onClick={() => onSendQuery()}
              disabled={isLoading || !query || typeof query !== 'string' || !query.trim()}
              size="lg"
              className="px-8 text-base"
            >
              <Send className="h-5 w-5 mr-2" />
              SEND
            </Button>
          </div>

          {selectedDocsCount > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>Querying {selectedDocsCount} source{selectedDocsCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}