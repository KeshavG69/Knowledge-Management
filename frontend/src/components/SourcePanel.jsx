import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  FileText, Video, Plus, Search, ChevronRight, ChevronDown,
  Folder, Database, Filter, CheckSquare, Square, MinusSquare,
  Eye, Trash2, RefreshCw, Compass
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SourcePanel({
  documents,
  selectedDocs,
  onDocumentSelect,
  onDocumentDeselect,
  onSelectAll,
  onDeselectAll,
  knowledgeBases,
  selectedKB,
  onKBChange,
  onUpload,
  onDelete,
  onRefresh,
  onDiscover,
  onManageKnowledgeBases = () => {},
  multiKBMode = false,
  selectedKBs = new Set(),
  isLoading = false
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKBs, setExpandedKBs] = useState(new Set()); // Start with all KBs collapsed
  const [filterMode, setFilterMode] = useState('all'); // all, selected, unselected

  const toggleKBExpansion = (kbName) => {
    const newExpanded = new Set(expandedKBs);
    if (newExpanded.has(kbName)) {
      newExpanded.delete(kbName);
    } else {
      newExpanded.add(kbName);
    }
    setExpandedKBs(newExpanded);
  };

  const determineKBName = (doc) => {
    if (!doc) return 'default';
    if (doc.kb_name) return doc.kb_name;
    if (doc.knowledge_base) return doc.knowledge_base;
    if (doc.document_id && doc.document_id.includes(':')) {
      const [prefix] = doc.document_id.split(':', 1);
      return prefix || 'default';
    }
    return 'default';
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchTerm ||
      doc.document_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterMode === 'all' ||
      (filterMode === 'selected' && selectedDocs.has(doc.document_id)) ||
      (filterMode === 'unselected' && !selectedDocs.has(doc.document_id));
    return matchesSearch && matchesFilter;
  });

  const getDocumentsByKB = () => {
    const grouped = {};
    knowledgeBases.forEach(kb => {
      grouped[kb.name] = [];
    });

    filteredDocuments.forEach(doc => {
      const kbName = determineKBName(doc);
      if (!grouped[kbName]) {
        grouped[kbName] = [];
      }
      grouped[kbName].push(doc);
    });

    return grouped;
  };

  const documentsByKB = getDocumentsByKB();
  const activeKBDocs = documentsByKB[selectedKB] || [];
  const selectedInActiveKB = activeKBDocs.filter(doc => selectedDocs.has(doc.document_id)).length;
  const totalInScope = multiKBMode ? documents.length : activeKBDocs.length;
  const selectedInScope = multiKBMode ? selectedDocs.size : selectedInActiveKB;

  const handleSelectAllInKB = (kbName) => {
    const kbDocs = documentsByKB[kbName];
    const allSelected = kbDocs.every(doc => selectedDocs.has(doc.document_id));

    kbDocs.forEach(doc => {
      if (allSelected) {
        onDocumentDeselect(doc.document_id);
      } else {
        onDocumentSelect(doc.document_id);
      }
    });
  };

  const getKBSelectionState = (kbName) => {
    const kbDocs = documentsByKB[kbName];
    if (!kbDocs || kbDocs.length === 0) return 'none';

    const selectedCount = kbDocs.filter(doc => selectedDocs.has(doc.document_id)).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === kbDocs.length) return 'all';
    return 'some';
  };

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold tracking-wider text-primary">SOURCES</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={onManageKnowledgeBases}
              className="h-8 w-8 p-0"
              title="Manage Knowledge Bases"
            >
              <Database className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDiscover}
              className="h-8 w-8 p-0"
              title="Discover Sources"
            >
              <Compass className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onRefresh}
              className="h-8 w-8 p-0"
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onUpload}
              className="h-8 w-8 p-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search sources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <div className="mb-3 text-xs text-muted-foreground">
          {multiKBMode ? (
            <span>{selectedKBs.size} knowledge bases active</span>
          ) : (
            <span>Active KB: {selectedKB || 'default'}</span>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onSelectAll()}
              className="px-2 py-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <CheckSquare className="h-3 w-3" />
            </button>
            <button
              onClick={() => onDeselectAll()}
              className="px-2 py-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <Square className="h-3 w-3" />
            </button>
          </div>
          <div className="flex-1 text-muted-foreground">
            {selectedInScope} of {totalInScope} selected
          </div>
        </div>
      </div>

      {/* Documents List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {knowledgeBases.map(kb => {
            const kbDocs = documentsByKB[kb.name] || [];
            const isExpanded = expandedKBs.has(kb.name);
            const selectionState = getKBSelectionState(kb.name);

            return (
              <div key={kb.name} className="mb-2">
                {/* Knowledge Base Header */}
                <div className="flex items-center gap-1 p-2 hover:bg-muted/50 rounded-md">
                  <button
                    onClick={() => handleSelectAllInKB(kb.name)}
                    className="p-0.5"
                  >
                    {selectionState === 'all' ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : selectionState === 'some' ? (
                      <MinusSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      toggleKBExpansion(kb.name);
                      onKBChange?.(kb.name);
                    }}
                    className="flex-1 flex items-center gap-2 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium flex-1">
                      <span className={cn(selectedKBs.has(kb.name) ? 'text-primary' : '')}>
                        {kb.display_name || kb.name}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({kbDocs.length})
                    </span>
                  </button>
                </div>

                {/* Documents in Knowledge Base */}
                {isExpanded && (
                  <div className="ml-4 mt-1">
                    {kbDocs.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic p-2">
                        No documents
                      </div>
                    ) : (
                      kbDocs.map(doc => {
                        const isVideo = doc.document_name?.includes('.mp4') ||
                                       doc.document_name?.includes('.mov');
                        const isSelected = selectedDocs.has(doc.document_id);

                        return (
                          <div
                            key={doc.document_id}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors",
                              isSelected && "bg-muted/30"
                            )}
                          >
                            <button
                              onClick={() => {
                                if (isSelected) {
                                  onDocumentDeselect(doc.document_id);
                                } else {
                                  onDocumentSelect(doc.document_id);
                                }
                              }}
                              className="p-0.5"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-3 w-3 text-primary" />
                              ) : (
                                <Square className="h-3 w-3 text-muted-foreground" />
                              )}
                            </button>
                            {isVideo ? (
                              <Video className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="text-xs truncate flex-1" title={doc.document_name}>
                              {doc.document_name}
                            </span>
                            <button
                              onClick={() => onDelete(doc.document_id)}
                              className="opacity-0 hover:opacity-100 transition-opacity p-0.5"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <Button
          onClick={onUpload}
          size="sm"
          className="w-full text-xs font-medium tracking-wider"
        >
          <Plus className="h-3 w-3 mr-2" />
          ADD DOCUMENTS
        </Button>
      </div>
    </div>
  );
}
