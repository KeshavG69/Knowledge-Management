import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Volume2, Video, Brain, FileText, ListOrdered, CheckSquare,
  Edit, Play, Download, Save, Clock, Activity, Map,
  BookOpen, Target, Award, ChevronRight, Settings,
  FileOutput, Folder, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ToolPanel({
  sources = [],
  generatedDocuments = [],
  isGeneratingOutput,
  onGenerateTool,
  onOpenDocument,
  onSaveOutput,
  activeMode = 'chat',
  selectedDocsCount = 0,
  isAudioAgentMode = false,
  onToggleAudioAgent,
  selectedVoiceId,
  onVoiceChange,
  availableVoices = [],
  onTestVoice
}) {
  const [activeToolCategory, setActiveToolCategory] = useState(null);

  const tools = [
    {
      id: 'stepGuide',
      title: 'STEP-BY-STEP GUIDE',
      icon: ListOrdered,
      description: 'Generate procedural instructions',
      category: 'generation',
      color: 'text-blue-500'
    },
    {
      id: 'pmcsChecklist',
      title: 'PMCS CHECKLIST',
      icon: CheckSquare,
      description: 'Create maintenance checklist',
      category: 'generation',
      color: 'text-green-500'
    },
    {
      id: 'audio',
      title: 'AUDIO OVERVIEW',
      icon: Volume2,
      description: 'Generate tactical audio briefing',
      category: 'media',
      color: 'text-purple-500'
    },
    {
      id: 'video',
      title: 'VIDEO OVERVIEW',
      icon: Video,
      description: 'Create visual training materials',
      category: 'media',
      color: 'text-orange-500'
    },
    {
      id: 'mindmap',
      title: 'MIND MAP',
      icon: Brain,
      description: 'Visual concept mapping',
      category: 'analysis',
      color: 'text-indigo-500'
    },
    {
      id: 'report',
      title: 'REPORTS',
      icon: FileText,
      description: 'Generate mission reports',
      category: 'analysis',
      color: 'text-red-500'
    }
  ];

  const handleToolClick = (tool) => {
    if (isGeneratingOutput) return;
    onGenerateTool(tool.id);
  };

  const getToolsByCategory = (category) => {
    return tools.filter(tool => tool.category === category);
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold tracking-wider text-primary">OUTPUT MODES</h2>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Mission support tools and generators
        </p>
      </div>

      {/* Tools Grid */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Generation Tools */}
          <div>
            <h3 className="text-xs font-bold tracking-wider text-muted-foreground mb-3">
              DOCUMENT GENERATION
            </h3>
            <div className="space-y-2">
              {getToolsByCategory('generation').map(tool => (
                <Button
                  key={tool.id}
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => handleToolClick(tool)}
                  disabled={isGeneratingOutput || selectedDocsCount === 0}
                >
                  <tool.icon className={cn("h-4 w-4 mr-2", tool.color)} />
                  {tool.title}
                </Button>
              ))}
            </div>
          </div>

          {/* Media Tools */}
          <div>
            <h3 className="text-xs font-bold tracking-wider text-muted-foreground mb-3">
              MEDIA GENERATION
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {getToolsByCategory('media').map(tool => (
                <Card
                  key={tool.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    "hover:border-primary/50",
                    isGeneratingOutput && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => handleToolClick(tool)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center text-center space-y-2">
                      <tool.icon className={cn("h-8 w-8", tool.color)} />
                      <h4 className="text-xs font-bold tracking-wider">
                        {tool.title}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {tool.description}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 absolute top-2 right-2"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Analysis Tools */}
          <div>
            <h3 className="text-xs font-bold tracking-wider text-muted-foreground mb-3">
              ANALYSIS & REPORTS
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {getToolsByCategory('analysis').map(tool => (
                <Card
                  key={tool.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    "hover:border-primary/50",
                    isGeneratingOutput && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => handleToolClick(tool)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center text-center space-y-2">
                      <tool.icon className={cn("h-8 w-8", tool.color)} />
                      <h4 className="text-xs font-bold tracking-wider">
                        {tool.title}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {tool.description}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 absolute top-2 right-2"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Audio Agent Settings */}
          <div>
            <h3 className="text-xs font-bold tracking-wider text-muted-foreground mb-3">
              AUDIO SETTINGS
            </h3>
            <div className="space-y-3">
              <Button
                variant={isAudioAgentMode ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={onToggleAudioAgent}
              >
                <Volume2 className="h-4 w-4 mr-2" />
                Audio Agent {isAudioAgentMode ? 'ON' : 'OFF'}
              </Button>
              <p className="text-xs text-muted-foreground px-2">
                Toggle for audio-optimized responses
              </p>

              {/* Voice Selection */}
              <div className="space-y-2">
                <label className="text-xs font-medium px-2">Voice Selection</label>
                <Select value={selectedVoiceId} onValueChange={onVoiceChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVoices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">{voice.name}</span>
                          <span className="text-xs text-muted-foreground">{voice.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {onTestVoice && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={onTestVoice}
                  >
                    <Volume2 className="h-3 w-3 mr-1" />
                    Test Voice
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Output Section */}
      <div className="border-t border-border">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-bold tracking-wider text-muted-foreground">
                GENERATED DOCUMENTS
              </h3>
            </div>
            {generatedDocuments.length > 0 && (
              <span className="text-xs text-muted-foreground">
                ({generatedDocuments.length})
              </span>
            )}
          </div>

          {generatedDocuments.length === 0 ? (
            <div className="text-xs text-muted-foreground italic text-center py-4">
              Generated documents will appear here
            </div>
          ) : (
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {generatedDocuments.map((doc, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => onOpenDocument(doc)}
                  >
                    {doc.type === 'stepGuide' ?
                      <ListOrdered className="h-3 w-3 text-muted-foreground flex-shrink-0" /> :
                      doc.type === 'pmcsChecklist' ?
                      <CheckSquare className="h-3 w-3 text-muted-foreground flex-shrink-0" /> :
                      <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    }
                    <span className="text-xs truncate flex-1">
                      {doc.title || `Output ${index + 1}`}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSaveOutput(doc);
                        }}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Sources Reference */}
        {sources && sources.length > 0 && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <Folder className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-bold tracking-wider text-muted-foreground">
                ACTIVE SOURCES
              </h3>
            </div>
            <div className="space-y-1">
              {sources.slice(0, 3).map((source, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary cursor-pointer"
                  onClick={() => onOpenDocument(source)}
                >
                  <ChevronRight className="h-3 w-3" />
                  <span className="truncate">{source.document_name}</span>
                </div>
              ))}
              {sources.length > 3 && (
                <div className="text-xs text-muted-foreground italic">
                  +{sources.length - 3} more sources
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}