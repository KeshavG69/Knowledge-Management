import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  FileText, Video, Plus, Search, ChevronRight, ChevronDown,
  Folder, Database, Filter, CheckSquare, Square, MinusSquare,
  Eye, Trash2, RefreshCw, Compass, MoreVertical
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
  isLoading = false,
  onDeleteKB = () => {},
  onUploadToKB = () => {}
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKBs, setExpandedKBs] = useState(new Set()); // Start with all KBs collapsed
  const [filterMode, setFilterMode] = useState('all'); // all, selected, unselected
  const [openMenuKB, setOpenMenuKB] = useState(null); // Track which folder menu is open
  const [openMenuDoc, setOpenMenuDoc] = useState(null); // Track which document menu is open

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
    if (!doc) return null;
    // Backend returns folder_name field (case-sensitive, use exactly as-is)
    if (doc.folder_name) return doc.folder_name;
    return null;
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
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-primary" />
            <h2 className="text-base font-bold tracking-wider text-primary">SOURCES</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onManageKnowledgeBases}
              className="h-10 w-10 p-0"
              title="Manage Knowledge Bases"
            >
              <Database className="h-5 w-5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDiscover}
              className="h-10 w-10 p-0"
              title="Discover Sources"
            >
              <Compass className="h-5 w-5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onRefresh}
              className="h-10 w-10 p-0"
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-5 w-5", isLoading && "animate-spin")} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onUpload}
              className="h-10 w-10 p-0"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search sources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 text-sm"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectAll()}
              className="px-3 py-2 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <CheckSquare className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDeselectAll()}
              className="px-3 py-2 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <Square className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 text-muted-foreground">
            {selectedInScope} of {totalInScope} selected
          </div>
        </div>
      </div>

      {/* Documents List */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {knowledgeBases.map(kb => {
            const kbDocs = documentsByKB[kb.name] || [];
            const isExpanded = expandedKBs.has(kb.name);
            const selectionState = getKBSelectionState(kb.name);

            return (
              <div key={kb.name} className="mb-3">
                {/* Knowledge Base Header */}
                <div className="flex items-center gap-2 p-3 hover:bg-muted/50 rounded-md group">
                  <button
                    onClick={() => handleSelectAllInKB(kb.name)}
                    className="p-1"
                  >
                    {selectionState === 'all' ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : selectionState === 'some' ? (
                      <MinusSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground" />
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
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <Folder className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium flex-1">
                      <span className={cn(selectedKBs.has(kb.name) ? 'text-primary' : '')}>
                        {kb.display_name || kb.name}
                      </span>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({kbDocs.length})
                    </span>
                  </button>
                  {/* Three-dot menu */}
                  <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuKB(openMenuKB === kb.name ? null : kb.name);
                      }}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {openMenuKB === kb.name && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuKB(null)}
                        />
                        <div className="absolute right-0 top-8 z-20 w-44 bg-card border border-border rounded-md shadow-lg py-1">
                          <button
                            onClick={() => {
                              onUploadToKB(kb.name);
                              setOpenMenuKB(null);
                            }}
                            className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted flex items-center gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Upload File
                          </button>
                          <button
                            onClick={() => {
                              onDeleteKB(kb.name, kb.display_name || kb.name);
                              setOpenMenuKB(null);
                            }}
                            className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted flex items-center gap-2 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Folder
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Documents in Knowledge Base */}
                {isExpanded && (
                  <div className="ml-6 mt-2">
                    {kbDocs.length === 0 ? (
                      <div className="text-sm text-muted-foreground italic p-3">
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
                              "flex items-center gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors group",
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
                              className="p-1"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4 text-primary" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            {isVideo ? (
                              <Video className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="text-sm truncate flex-1" title={doc.document_name}>
                              {doc.document_name}
                            </span>
                            {/* Three-dot menu for document */}
                            <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuDoc(openMenuDoc === doc.document_id ? null : doc.document_id);
                                }}
                                className="p-1 hover:bg-muted rounded"
                              >
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </button>
                              {openMenuDoc === doc.document_id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setOpenMenuDoc(null)}
                                  />
                                  <div className="absolute right-0 top-8 z-20 w-36 bg-card border border-border rounded-md shadow-lg py-1">
                                    <button
                                      onClick={() => {
                                        onDelete(doc.document_id);
                                        setOpenMenuDoc(null);
                                      }}
                                      className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted flex items-center gap-2 text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Delete File
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
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
      <div className="p-4 border-t border-border">
        <Button
          onClick={onUpload}
          size="lg"
          className="w-full text-sm font-medium tracking-wider"
        >
          <Plus className="h-5 w-5 mr-2" />
          ADD DOCUMENTS
        </Button>
      </div>
    </div>
  );
}
