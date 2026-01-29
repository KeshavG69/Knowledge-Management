import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Send, Shield, StickyNote, Volume2, Brain, Map, FileText,
  Mic, MicOff, Edit, Check, X, ChevronRight, AlertCircle,
  Target, Info, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  setEditText
}) {
  const messagesEndRef = useRef(null);
  const [activeTools, setActiveTools] = useState([]);
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

  const toggleTool = (tool) => {
    setActiveTools(prev =>
      prev.includes(tool)
        ? prev.filter(t => t !== tool)
        : [...prev, tool]
    );
  };

  const getMessageIcon = (sender) => {
    switch (sender) {
      case 'user':
        return <Target className="h-4 w-4" />;
      case 'agent':
        return <Shield className="h-4 w-4" />;
      case 'system':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getMessageClass = (sender) => {
    switch (sender) {
      case 'user':
        return 'bg-primary/10 border-primary/30';
      case 'agent':
        return 'bg-card border-border';
      case 'system':
        return 'bg-destructive/10 border-destructive/30';
      default:
        return 'bg-muted border-border';
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Mission Status Bar */}
      <div className="px-6 py-3 bg-card border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium tracking-wider text-primary">MISSION READY</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs text-muted-foreground">
            {selectedDocsCount} SOURCES LOADED
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isAudioAgentMode && (
            <div className="px-3 py-1 bg-accent/20 rounded-md flex items-center gap-2">
              <Volume2 className="h-3 w-3 text-accent" />
              <span className="text-xs font-medium text-accent">AUDIO MODE ACTIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* Conversation Area */}
      <ScrollArea className="flex-1 px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {conversation.length === 0 && !isLoading && (
            <Card className="card-mission">
              <CardHeader className="text-center pb-6">
                <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
                <h2 className="text-lg font-bold tracking-wider text-primary">
                  SOLDIER IQ TACTICAL ASSISTANT
                </h2>
                <p className="text-xs text-muted-foreground mt-2">
                  Ready to provide mission-critical intelligence and support
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => toggleTool('note')}
                    className={cn(
                      "p-4 rounded-lg border-2 transition-all hover:shadow-md",
                      activeTools.includes('note')
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <StickyNote className="h-6 w-6 text-primary mb-2" />
                    <p className="text-xs font-medium tracking-wider">ADD NOTE</p>
                  </button>
                  <button
                    onClick={() => toggleTool('audio')}
                    className={cn(
                      "p-4 rounded-lg border-2 transition-all hover:shadow-md",
                      activeTools.includes('audio')
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Volume2 className="h-6 w-6 text-primary mb-2" />
                    <p className="text-xs font-medium tracking-wider">AUDIO OVERVIEW</p>
                  </button>
                  <button
                    onClick={() => toggleTool('mindmap')}
                    className={cn(
                      "p-4 rounded-lg border-2 transition-all hover:shadow-md",
                      activeTools.includes('mindmap')
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Brain className="h-6 w-6 text-primary mb-2" />
                    <p className="text-xs font-medium tracking-wider">MIND MAP</p>
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {conversation.map((message, index) => (
            <div
              key={message.id || index}
              className={cn(
                "rounded-lg border p-4 transition-all",
                getMessageClass(message.sender)
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {getMessageIcon(message.sender)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
                      {message.sender === 'user' ? 'OPERATOR' :
                       message.sender === 'agent' ? 'SOLDIER IQ' :
                       'SYSTEM'}
                    </span>
                    {message.sender === 'agent' && !editingMessageId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditMessage(message.id, message.text)}
                        className="h-6 px-2"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {editingMessageId === message.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full p-2 rounded-md border bg-background text-sm"
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
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.text}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Document Approval / Edit UI */}
                  {message.isGeneratedDocument && message.pendingApproval && !message.isEditing && (
                    <div className="mt-4 pt-4 border-t border-border flex gap-2">
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
                    <div className="mt-4 pt-4 border-t border-border space-y-3">
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
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                        Applying edits...
                      </div>
                    </div>
                  )}

                  {/* Approved indicator */}
                  {message.isGeneratedDocument && message.approved && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Document approved and saved
                      </div>
                    </div>
                  )}

                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium tracking-wider text-muted-foreground">
                          SOURCE DOCUMENTS
                        </span>
                      </div>
                      <div className="space-y-1">
                        {message.sources.map((source, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary cursor-pointer"
                          >
                            <ChevronRight className="h-3 w-3" />
                            <span>{source.document_name}</span>
                            {source.page_number && (
                              <span className="text-xs">- Page {source.page_number}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {thinkingMessage && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-sm text-muted-foreground italic">
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
      <div className="border-t border-border bg-card p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter mission query..."
                className="w-full px-4 py-3 pr-12 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                rows={2}
                disabled={isLoading}
              />
              <button
                onClick={isRecording ? onStopRecording : onStartRecording}
                className={cn(
                  "absolute right-2 bottom-2 p-2 rounded-md transition-all",
                  isRecording
                    ? "bg-destructive text-destructive-foreground animate-pulse"
                    : "hover:bg-muted"
                )}
                disabled={isLoading}
              >
                {isRecording ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
            </div>
            <Button
              onClick={onSendQuery}
              disabled={isLoading || !query.trim()}
              size="lg"
              className="px-6"
            >
              <Send className="h-4 w-4 mr-2" />
              SEND
            </Button>
          </div>

          {selectedDocsCount > 0 && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>Querying {selectedDocsCount} source{selectedDocsCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}