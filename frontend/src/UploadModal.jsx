import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, FileText, X, Folder, FolderPlus, File, Video, Music, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_ENDPOINTS } from './config';
import { useAuth } from './contexts/AuthContext';

/**
 * UploadModal - Multi-file upload with folder selection
 *
 * Features:
 * - Multiple file upload support
 * - Choose existing folder OR create new folder
 * - Polls background task until completion
 * - Resets state after upload or modal close
 *
 * Folder name handling (CASE-SENSITIVE):
 * - Existing folders: Preserves exact case from kb.name
 * - New folders: Preserves exact case as typed by user
 */
const UploadModal = ({ isOpen, onClose, onUploadSuccess, selectedKB = 'default', knowledgeBases = [] }) => {
  const { toast } = useToast();
  const { getUserId, getOrganizationId } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [folderMode, setFolderMode] = useState('existing'); // 'existing' or 'new'
  const [targetKB, setTargetKB] = useState(selectedKB);
  const [newFolderName, setNewFolderName] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setTargetKB(selectedKB);
      setFolderMode('existing');
    }
  }, [isOpen, selectedKB]);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    // Validate files
    if (selectedFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one file.",
        variant: "destructive",
      });
      return;
    }

    // Validate folder selection
    // IMPORTANT: Folder names are CASE-SENSITIVE in the database
    // - Both new and existing folders preserve exact case as entered/selected
    let folderNameToUse = '';

    if (folderMode === 'new') {
      if (!newFolderName.trim()) {
        toast({
          title: "Error",
          description: "Please enter a folder name.",
          variant: "destructive",
        });
        return;
      }
      // Use folder name exactly as user typed it (case-sensitive)
      folderNameToUse = newFolderName.trim();
    } else {
      if (!targetKB) {
        toast({
          title: "Error",
          description: "Please select a folder.",
          variant: "destructive",
        });
        return;
      }
      // Use existing folder name exactly as-is (case-sensitive)
      folderNameToUse = targetKB;
    }

    setIsUploading(true);
    const formData = new FormData();

    // Append all files
    selectedFiles.forEach(file => {
      formData.append('files', file); // Backend expects 'files' (plural)
    });

    formData.append('folder_name', folderNameToUse); // Backend expects 'folder_name'
    formData.append('user_id', getUserId()); // ObjectId from env
    formData.append('organization_id', getOrganizationId()); // ObjectId from env

    console.log('[UPLOAD] folder_name:', folderNameToUse, 'user_id:', getUserId(), 'org_id:', getOrganizationId(), 'files:', selectedFiles.length);

    try {
      const endpoint = API_ENDPOINTS.uploadDocument(); // Same endpoint for all files

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Upload failed');
      }

      // Backend returns: { success, message, data: { task_id, status, ... } }
      const taskId = result.data?.task_id;

      toast({
        title: "Processing",
        description: `${selectedFiles.length} file(s) queued. Processing in background...`,
      });

      // Calculate timeout based on file sizes
      // Base timeout: 100 seconds + 100 seconds per MB
      const totalSizeMB = selectedFiles.reduce((sum, file) => sum + (file.size / 1024 / 1024), 0);
      const calculatedTimeout = Math.max(100, Math.min(3000, 100 + Math.ceil(totalSizeMB * 100)));

      console.log(`[UPLOAD] Total size: ${totalSizeMB.toFixed(2)} MB, Timeout: ${calculatedTimeout}s`);

      // Poll task status until completed
      if (taskId) {
        await pollTaskStatus(taskId, calculatedTimeout);
      }

      toast({
        title: "Success",
        description: `${selectedFiles.length} file(s) uploaded successfully${folderMode === 'new' ? ` to new folder "${newFolderName}"` : ''}.`,
      });

      // Reset modal state before closing
      resetModal();

      if (onUploadSuccess) {
        onUploadSuccess();
      }

      // Close modal
      onClose();

    } catch (error) {
      toast({
        title: "Error",
        description: error.message || 'An unexpected error occurred.',
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const pollTaskStatus = async (taskId, timeoutSeconds = 60) => {
    const pollInterval = 10000; // 10 seconds between checks
    const maxAttempts = Math.ceil(timeoutSeconds / (pollInterval / 1000));

    console.log(`[TASK ${taskId}] Starting polling: ${maxAttempts} attempts (${timeoutSeconds}s timeout)`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const statusEndpoint = API_ENDPOINTS.taskStatus(taskId);
        const response = await fetch(statusEndpoint);
        const result = await response.json();

        if (!response.ok) {
          throw new Error('Failed to check task status');
        }

        const status = result.data?.status;
        console.log(`[TASK ${taskId}] Status: ${status}, Attempt: ${attempt + 1}`);

        if (status === 'completed') {
          console.log(`[TASK ${taskId}] ✅ Completed successfully`);
          return true;
        } else if (status === 'failed') {
          const errorMsg = result.data?.error || 'Processing failed';
          throw new Error(errorMsg);
        }

        // Status is 'queued' or 'processing', wait and retry
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error(`[TASK ${taskId}] Polling error:`, error);
        throw error;
      }
    }

    // Timeout after max attempts
    throw new Error('Processing timeout - please refresh to check status');
  };

  const resetModal = () => {
    setSelectedFiles([]);
    setFolderMode('existing');
    setNewFolderName('');
    setTargetKB(selectedKB); // Reset to initial selected KB
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        resetModal();
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Upload Files</DialogTitle>
          <DialogDescription className="text-base">
            Upload documents, images, videos, and audio files to your knowledge base.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">

          {/* Folder Selection Mode */}
          <div className="grid gap-4">
            <label className="text-base font-medium">Choose Destination</label>

            {/* Card-based mode selection */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFolderMode('existing')}
                className={cn(
                  "flex flex-col items-center gap-3 p-5 rounded-lg border-2 transition-all hover:shadow-md",
                  folderMode === 'existing'
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border hover:border-primary/50"
                )}
              >
                <Folder className={cn(
                  "h-8 w-8",
                  folderMode === 'existing' ? "text-primary" : "text-muted-foreground"
                )} />
                <div className="text-center">
                  <p className={cn(
                    "text-sm font-medium",
                    folderMode === 'existing' ? "text-primary" : "text-foreground"
                  )}>
                    Existing Folder
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select from your folders
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFolderMode('new')}
                className={cn(
                  "flex flex-col items-center gap-3 p-5 rounded-lg border-2 transition-all hover:shadow-md",
                  folderMode === 'new'
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border hover:border-primary/50"
                )}
              >
                <FolderPlus className={cn(
                  "h-8 w-8",
                  folderMode === 'new' ? "text-primary" : "text-muted-foreground"
                )} />
                <div className="text-center">
                  <p className={cn(
                    "text-sm font-medium",
                    folderMode === 'new' ? "text-primary" : "text-foreground"
                  )}>
                    New Folder
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a new folder
                  </p>
                </div>
              </button>
            </div>

            {/* Existing Folder Dropdown */}
            {folderMode === 'existing' && (
              <Select value={targetKB} onValueChange={setTargetKB}>
                <SelectTrigger className="text-base h-11">
                  <SelectValue placeholder="Select existing folder" />
                </SelectTrigger>
                <SelectContent>
                  {knowledgeBases.map((kb) => (
                    <SelectItem key={kb.name} value={kb.name} className="text-base">
                      {kb.display_name || kb.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* New Folder Input */}
            {folderMode === 'new' && (
              <div className="grid gap-2">
                <Input
                  placeholder="Enter new folder name (e.g., Technical Documentation)"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="text-base h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Folder names are case-sensitive. The folder will be created automatically when you upload files.
                </p>
              </div>
            )}
          </div>

          {/* File Upload */}
          <div className="grid gap-3">
            <label className="text-base font-medium">Upload Files</label>
            <label
              htmlFor="file-upload"
              className={cn(
                "relative flex flex-col items-center justify-center w-full min-h-[180px] border-2 border-dashed rounded-xl cursor-pointer transition-all",
                selectedFiles.length > 0
                  ? "border-primary bg-primary/5 hover:bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              )}
            >
              <div className="flex flex-col items-center justify-center py-8 px-6">
                <div className="relative mb-4">
                  <div className={cn(
                    "p-4 rounded-full transition-all",
                    selectedFiles.length > 0
                      ? "bg-primary/20"
                      : "bg-muted"
                  )}>
                    <Upload className={cn(
                      "w-10 h-10 transition-colors",
                      selectedFiles.length > 0
                        ? "text-primary"
                        : "text-muted-foreground"
                    )} />
                  </div>
                </div>

                <p className="mb-2 text-base font-medium">
                  <span className={cn(
                    "transition-colors",
                    selectedFiles.length > 0 ? "text-primary" : "text-foreground"
                  )}>
                    Click to upload
                  </span>
                  <span className="text-muted-foreground"> or drag and drop</span>
                </p>

                <div className="flex items-center gap-4 mt-3 mb-2 flex-wrap justify-center">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Documents</span>
                  </div>
                  <div className="h-3 w-px bg-border" />
                  <div className="flex items-center gap-1.5">
                    <Image className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Images</span>
                  </div>
                  <div className="h-3 w-px bg-border" />
                  <div className="flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Videos</span>
                  </div>
                  <div className="h-3 w-px bg-border" />
                  <div className="flex items-center gap-1.5">
                    <Music className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Audio</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Multiple files allowed
                </p>
              </div>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept=".txt,.pdf,.doc,.docx,.xlsx,.xls,.csv,.md,.markdown,.zip,.dot,.docm,.dotm,.rtf,.odt,.ppt,.pptx,.pptm,.pot,.potx,.potm,.html,.htm,.xml,.epub,.rst,.org,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.heic,.mp4,.mov,.avi,.mkv,.webm,.flv,.mp3,.wav,.m4a,.aac,.flac,.ogg"
                onChange={handleFileChange}
                multiple
              />
            </label>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto p-3 border rounded-lg bg-muted/20">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Selected Files ({selectedFiles.length})
                </p>
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-background border rounded-md"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="flex-shrink-0 h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isUploading} size="lg">
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={
              isUploading ||
              selectedFiles.length === 0 ||
              (folderMode === 'existing' && !targetKB) ||
              (folderMode === 'new' && !newFolderName.trim())
            }
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 mr-2" />
                Upload {selectedFiles.length > 0 ? `${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}` : 'Files'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadModal;
