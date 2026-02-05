"use client";

import { useState, useRef } from "react";
import { useDocumentStore } from "@/lib/stores/documentStore";

export default function Sidebar() {
  const {
    documents,
    knowledgeBases,
    selectedDocs,
    isLoading,
    uploadStatus,
    uploadProgress,
    toggleDocSelection,
    selectAllDocs,
    deselectAllDocs,
    selectFolderDocs,
    deselectFolderDocs,
    uploadDocuments,
    deleteDocument,
    deleteKnowledgeBase,
  } = useDocumentStore();

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFolderName, setSelectedFolderName] = useState<string>("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    setShowUploadModal(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!selectedFolderName || !selectedFolderName.trim()) {
      alert("Please enter a folder name");
      return;
    }

    // Keep modal open and show uploading state
    setIsUploading(true);
    const fileNames = Array.from(files).map(f => f.name);
    setUploadingFiles(fileNames);

    try {
      const filesArray = Array.from(files);
      const targetFolder = selectedFolderName.trim();

      // Auto-expand the folder to show files appearing
      setExpandedFolders(prev => {
        const next = new Set(prev);
        next.add(targetFolder);
        return next;
      });

      await uploadDocuments(filesArray, targetFolder);

      // Upload successful, close modal
      setShowUploadModal(false);
      setSelectedFolderName("");
    } catch (error: any) {
      console.error("Upload failed:", error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      setUploadingFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleProceedWithUpload = () => {
    if (!selectedFolderName || !selectedFolderName.trim()) {
      alert("Please enter a folder name");
      return;
    }
    // Don't close modal - wait for file selection
    fileInputRef.current?.click();
  };

  const handleDeleteKB = async (folderName: string) => {
    if (confirm(`Delete knowledge base "${folderName}"? This will delete all documents in it.`)) {
      try {
        await deleteKnowledgeBase(folderName);
        setExpandedFolders(prev => {
          const next = new Set(prev);
          next.delete(folderName);
          return next;
        });
      } catch (error) {
        console.error("Failed to delete KB:", error);
      }
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (confirm("Delete this document?")) {
      try {
        await deleteDocument(docId);
      } catch (error) {
        console.error("Failed to delete document:", error);
      }
    }
  };

  const toggleFolder = (folderName: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
      }
      return next;
    });
  };

  // Group documents by folder
  const documentsByFolder = (Array.isArray(documents) ? documents : []).reduce((acc, doc) => {
    const folder = doc.folder_name || 'Uncategorized';
    if (!acc[folder]) {
      acc[folder] = [];
    }
    acc[folder].push(doc);
    return acc;
  }, {} as Record<string, typeof documents>);

  // Get all folders (from KB list + any folders in documents)
  const allFolders = new Set<string>();
  (Array.isArray(knowledgeBases) ? knowledgeBases : []).forEach(kb => allFolders.add(kb.name));
  Object.keys(documentsByFolder).forEach(folder => allFolders.add(folder));
  const folderList = Array.from(allFolders).sort();

  const totalDocs = Array.isArray(documents) ? documents.length : 0;

  return (
    <div className="flex-1 bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-amber-400/20 flex flex-col relative">
      {/* Decorative corner bracket */}
      <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-blue-400/40 dark:border-amber-400/40 z-10"></div>

      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-blue-600 dark:bg-amber-400"></div>
          <h2 className="text-base font-bold text-blue-600 dark:text-amber-400 tracking-wider">
            DOCUMENT REPOSITORY
          </h2>
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUploadClick}
          disabled={uploadStatus !== null}
          className="tactical-btn tactical-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center justify-center gap-2">
            {uploadStatus === 'uploading' ? (
              <>
                <div className="w-4 h-4 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin"></div>
                UPLOADING...
              </>
            ) : uploadStatus === 'processing' ? (
              <>
                <div className="w-4 h-4 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin"></div>
                PROCESSING...
              </>
            ) : uploadStatus === 'completed' ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                COMPLETED
              </>
            ) : uploadStatus === 'failed' ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                FAILED
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                UPLOAD DOCUMENT
              </>
            )}
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".txt,.pdf,.doc,.docx,.xlsx,.xls,.csv,.md,.markdown,.zip,.dot,.docm,.dotm,.rtf,.odt,.ppt,.pptx,.pptm,.pot,.potx,.potm,.html,.htm,.xml,.epub,.rst,.org,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.heic,.mp4,.mov,.avi,.mkv,.webm,.flv,.mp3,.wav,.m4a,.aac,.flac,.ogg"
        />
      </div>

      {/* Stats Bar */}
      <div className="px-4 py-2 bg-slate-200 dark:bg-slate-800/50 border-b border-slate-300 dark:border-slate-700/30 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 dark:bg-amber-400 rounded-full"></div>
            <span className="text-slate-600 dark:text-slate-400">TOTAL:</span>
            <span className="text-blue-600 dark:text-amber-400 font-mono font-semibold">{totalDocs}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-tactical-green rounded-full"></div>
            <span className="text-slate-600 dark:text-slate-400">SELECTED:</span>
            <span className="text-tactical-green font-mono font-semibold">{selectedDocs.size}</span>
          </div>
        </div>
      </div>

      {/* Folder Tree */}
      <div className="flex-1 overflow-y-auto tactical-scrollbar p-4">
        {/* Selection Controls */}
        {totalDocs > 0 && (
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-300 dark:border-slate-800">
            <button
              onClick={selectAllDocs}
              className="text-xs text-blue-600 dark:text-amber-400 hover:text-blue-700 dark:hover:text-amber-300 tracking-wide font-semibold transition-colors"
            >
              SELECT ALL
            </button>
            {selectedDocs.size > 0 && (
              <button
                onClick={deselectAllDocs}
                className="text-xs text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 tracking-wide transition-colors"
              >
                CLEAR
              </button>
            )}
          </div>
        )}

        {/* Documents Tree */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-200 dark:border-amber-400/20 border-t-blue-600 dark:border-t-amber-400 rounded-full animate-spin mb-4"></div>
            <div className="text-slate-500 text-sm">LOADING REPOSITORY...</div>
          </div>
        ) : folderList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-16 h-16 text-slate-400 dark:text-slate-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-slate-500 text-sm mb-2">NO DOCUMENTS</div>
            <div className="text-slate-600 text-xs">
              Create a knowledge base and upload documents
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {folderList.map((folderName, folderIdx) => {
              const folderDocs = documentsByFolder[folderName] || [];
              const isExpanded = expandedFolders.has(folderName);
              const folderDocCount = folderDocs.length;

              // Check if all documents in folder are selected
              const folderDocIds = folderDocs.map(d => d._id);
              const allFolderDocsSelected = folderDocIds.length > 0 && folderDocIds.every(id => selectedDocs.has(id));
              const someFolderDocsSelected = folderDocIds.some(id => selectedDocs.has(id)) && !allFolderDocsSelected;

              // Don't show folders with 0 documents
              if (folderDocCount === 0) {
                return null;
              }

              return (
                <div
                  key={folderName}
                  className="data-load"
                  style={{ animationDelay: `${folderIdx * 30}ms` }}
                >
                  {/* Folder Header */}
                  <div
                    className="relative group transition-all duration-200 bg-slate-200 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-700/50 hover:border-blue-400 dark:hover:border-amber-400/30"
                    style={{
                      clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                    }}
                  >
                    <div className="flex items-center gap-2 p-3">
                      {/* Expand/Collapse Button */}
                      <button
                        onClick={() => toggleFolder(folderName)}
                        className="text-blue-600 dark:text-amber-400 hover:text-blue-700 dark:hover:text-amber-300 transition-colors"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      {/* Folder Selection Checkbox */}
                      <input
                        type="checkbox"
                        checked={allFolderDocsSelected}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = someFolderDocsSelected;
                          }
                        }}
                        onChange={() => {
                          if (allFolderDocsSelected) {
                            deselectFolderDocs(folderName);
                          } else {
                            selectFolderDocs(folderName);
                          }
                        }}
                        className="tactical-checkbox"
                        title={allFolderDocsSelected ? "Deselect all documents in folder" : "Select all documents in folder"}
                      />

                      {/* Folder Icon */}
                      <svg className="w-4 h-4 text-blue-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                      </svg>

                      {/* Folder Name */}
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-wide">
                          {folderName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {folderDocCount} DOCUMENT{folderDocCount !== 1 ? 'S' : ''}
                        </div>
                      </div>

                      {/* Delete Folder Button */}
                      <button
                        onClick={() => handleDeleteKB(folderName)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-all duration-200 p-1"
                        title="Delete knowledge base"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Decorative corner */}
                    <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-blue-400/20 dark:border-amber-400/20"></div>
                  </div>

                  {/* Folder Documents */}
                  {isExpanded && folderDocs.length > 0 && (
                    <div className="ml-6 mt-1 space-y-1 border-l-2 border-slate-300 dark:border-slate-700/30 pl-3">
                      {folderDocs.map((doc, docIdx) => (
                        <div
                          key={doc._id}
                          className="relative bg-slate-100 dark:bg-slate-800/30 border border-slate-300 dark:border-slate-700/40 hover:border-blue-400 dark:hover:border-amber-400/30 hover:bg-slate-200 dark:hover:bg-slate-800/50 transition-all duration-200 group"
                          style={{
                            clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)',
                          }}
                        >
                          <div className="flex items-start gap-2 p-2">
                            <input
                              type="checkbox"
                              checked={selectedDocs.has(doc._id)}
                              onChange={() => toggleDocSelection(doc._id)}
                              className="tactical-checkbox mt-1"
                              disabled={doc.status === 'processing'}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">
                                  {doc.file_name}
                                </div>
                                {doc.status === 'processing' && (
                                  <div className="w-3 h-3 border border-blue-200 dark:border-amber-400/20 border-t-blue-600 dark:border-t-amber-400 rounded-full animate-spin flex-shrink-0"></div>
                                )}
                                {doc.status === 'failed' && (
                                  <svg className="w-3 h-3 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                )}
                              </div>
                              {doc.status === 'processing' && doc.processing_stage_description && (
                                <div className="text-[9px] text-blue-600 dark:text-amber-400/70 mt-0.5">
                                  {doc.processing_stage_description}
                                </div>
                              )}
                              {doc.status === 'failed' && doc.error && (
                                <div className="text-[9px] text-red-500 dark:text-red-400 mt-0.5">
                                  {doc.error}
                                </div>
                              )}
                              {(!doc.status || doc.status === 'completed') && (
                                <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                                  {doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: '2-digit'
                                  }).toUpperCase() : 'N/A'}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteDoc(doc._id)}
                              className="opacity-0 group-hover:opacity-100 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-all duration-200 p-1"
                              title="Delete document"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Modal - Enter/Select Folder */}
      {showUploadModal && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={() => {
              if (!isUploading) {
                setShowUploadModal(false);
                setSelectedFolderName("");
              }
            }}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-amber-400/30 w-full max-w-md shadow-2xl tactical-panel">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-1 h-6 bg-amber-400"></div>
                  <h3 className="text-base font-bold text-amber-400 tracking-wider">
                    {isUploading ? 'UPLOADING FILES' : 'SELECT FOLDER'}
                  </h3>
                </div>

                {isUploading ? (
                  // Uploading state
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-slate-800/50 border border-amber-400/20">
                      <div className="w-5 h-5 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin flex-shrink-0"></div>
                      <div className="flex-1">
                        <div className="text-sm text-slate-200 font-semibold">
                          Uploading {uploadingFiles.length} file{uploadingFiles.length !== 1 ? 's' : ''}...
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          To: {selectedFolderName}
                        </div>
                      </div>
                    </div>

                    {/* File list */}
                    <div className="max-h-48 overflow-y-auto tactical-scrollbar space-y-1">
                      {uploadingFiles.map((fileName, idx) => (
                        <div key={idx} className="text-xs text-slate-400 py-1 px-2 bg-slate-800/30 border border-slate-700/30 flex items-center gap-2">
                          <div className="w-1 h-1 bg-amber-400 rounded-full"></div>
                          <span className="truncate">{fileName}</span>
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-slate-600 text-center">
                      Please wait while files are being uploaded...
                    </div>
                  </div>
                ) : (
                  // Folder selection state
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-slate-500 tracking-widest mb-2 uppercase">
                        Folder Name (New or Existing)
                      </label>
                      <input
                        type="text"
                        list="existing-folders"
                        value={selectedFolderName}
                        onChange={(e) => setSelectedFolderName(e.target.value)}
                        placeholder="e.g., CSS VSAT"
                        className="tactical-input"
                        autoFocus
                      />
                      {folderList.length > 0 && (
                        <datalist id="existing-folders">
                          {folderList.map((folder) => (
                            <option key={folder} value={folder} />
                          ))}
                        </datalist>
                      )}
                      <div className="text-[10px] text-slate-600 mt-2">
                        {folderList.length > 0 ? (
                          <>Type a new name or select from existing folders</>
                        ) : (
                          <>Enter a name for your first folder</>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={handleProceedWithUpload}
                      disabled={!selectedFolderName.trim()}
                      className="tactical-btn tactical-btn-primary w-full disabled:opacity-50"
                    >
                      PROCEED WITH UPLOAD
                    </button>
                  </div>
                )}

                {!isUploading && (
                  <div className="flex gap-2 pt-4 mt-4 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setShowUploadModal(false);
                        setSelectedFolderName("");
                      }}
                      className="tactical-btn flex-1"
                    >
                      CANCEL
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
