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
import { Upload, Link, File, Loader2, FileText, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_ENDPOINTS } from './config';

const UploadModal = ({ isOpen, onClose, onUploadSuccess, selectedKB = 'default', knowledgeBases = [] }) => {
  const { toast } = useToast();
  const [mode, setMode] = useState('file'); // 'file', 'youtube', 'text', or 'webpage'
  const [selectedFile, setSelectedFile] = useState(null);
  const [youtubeURL, setYoutubeURL] = useState('');
  const [textInput, setTextInput] = useState('');
  const [webpageURL, setWebpageURL] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [targetKB, setTargetKB] = useState(selectedKB); // Local state for KB selection

  React.useEffect(() => {
    if (isOpen) {
      setTargetKB(selectedKB);
    }
  }, [isOpen, selectedKB]);

  const handleFileChange = (event) => {
    setMode('file');
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (mode === 'youtube') {
      if (!youtubeURL.trim()) {
        toast({
          title: "Error",
          description: "Please enter a YouTube link.",
          variant: "destructive",
        });
        return;
      }
      setIsUploading(true);
      try {
        const resp = await fetch(API_ENDPOINTS.ingestYoutube(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: youtubeURL.trim(), kb_name: targetKB }),
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.detail || 'YouTube ingest failed');
        
        toast({
          title: "Success",
          description: "YouTube video has been added to your knowledge base.",
        });
        
        if (onUploadSuccess) onUploadSuccess();
      } catch (err) {
        toast({
          title: "Error",
          description: err.message || 'An unexpected error occurred.',
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
      return;
    }

    if (mode === 'text') {
      if (!textInput.trim() || !documentTitle.trim()) {
        toast({
          title: "Error",
          description: "Please provide both document title and text content.",
          variant: "destructive",
        });
        return;
      }
      setIsUploading(true);
      try {
        const resp = await fetch(API_ENDPOINTS.addText(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title: documentTitle.trim(),
            content: textInput.trim(),
            kb_name: targetKB 
          }),
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.detail || 'Text document creation failed');
        
        toast({
          title: "Success",
          description: "Text document has been added to your knowledge base.",
        });
        
        if (onUploadSuccess) onUploadSuccess();
      } catch (err) {
        toast({
          title: "Error",
          description: err.message || 'An unexpected error occurred.',
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
      return;
    }

    if (mode === 'webpage') {
      if (!webpageURL.trim()) {
        toast({
          title: "Error",
          description: "Please enter a webpage URL.",
          variant: "destructive",
        });
        return;
      }
      setIsUploading(true);
      try {
        const resp = await fetch(API_ENDPOINTS.ingestWebpage(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webpageURL.trim(), kb_name: targetKB }),
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.detail || 'Webpage ingest failed');
        
        toast({
          title: "Success",
          description: "Webpage has been added to your knowledge base.",
        });
        
        if (onUploadSuccess) onUploadSuccess();
      } catch (err) {
        toast({
          title: "Error",
          description: err.message || 'An unexpected error occurred.',
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // File mode
    if (mode === 'file' && !selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file first.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('kb_name', targetKB);
    
    // Debug logging
    console.log('[UPLOAD DEBUG] targetKB:', targetKB);
    console.log('[UPLOAD DEBUG] FormData kb_name:', formData.get('kb_name'));

    try {
      const endpoint = selectedFile && (selectedFile.type.startsWith('video/') || selectedFile.type.startsWith('audio/')) ?
        API_ENDPOINTS.uploadVideo() :
        API_ENDPOINTS.uploadDocument();
        
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Upload failed');
      }

      toast({
        title: "Success",
        description: "File has been uploaded successfully.",
      });

      if (onUploadSuccess) {
        onUploadSuccess();
      }

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

  const resetModal = () => {
    setSelectedFile(null);
    setYoutubeURL('');
    setTextInput('');
    setWebpageURL('');
    setDocumentTitle('');
    setMode('file');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        resetModal();
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Add to Knowledge Base</DialogTitle>
          <DialogDescription>
            Add content to your knowledge base. Upload files, paste text, add webpages, or provide YouTube links.
            <br />
            <span className="text-sm font-medium text-primary mt-2 inline-block">
              Target: {knowledgeBases.find(kb => kb.name === targetKB)?.display_name || targetKB}
            </span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
            <Button
              variant={mode === 'file' ? 'default' : 'ghost'}
              className="flex-1"
              onClick={() => setMode('file')}
            >
              <File className="h-4 w-4 mr-2" />
              File Upload
            </Button>
            <Button
              variant={mode === 'text' ? 'default' : 'ghost'}
              className="flex-1"
              onClick={() => setMode('text')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Text Input
            </Button>
            <Button
              variant={mode === 'webpage' ? 'default' : 'ghost'}
              className="flex-1"
              onClick={() => setMode('webpage')}
            >
              <Globe className="h-4 w-4 mr-2" />
              Webpage
            </Button>
            <Button
              variant={mode === 'youtube' ? 'default' : 'ghost'}
              className="flex-1"
              onClick={() => setMode('youtube')}
            >
              <Link className="h-4 w-4 mr-2" />
              YouTube
            </Button>
          </div>

          {/* Knowledge Base Selection */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">Knowledge Base</label>
            <Select value={targetKB} onValueChange={setTargetKB}>
              <SelectTrigger>
                <SelectValue placeholder="Select knowledge base" />
              </SelectTrigger>
              <SelectContent>
                {knowledgeBases.map((kb) => (
                  <SelectItem key={kb.name} value={kb.name}>
                    {kb.display_name || kb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          {mode === 'file' && (
            <div className="grid gap-2">
              <label
                htmlFor="file-upload"
                className={cn(
                  "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                  selectedFile && "border-primary bg-muted/30"
                )}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    {selectedFile ? (
                      <span className="font-semibold">{selectedFile.name}</span>
                    ) : (
                      <>
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, TXT, MP4, MOV, MP3, WAV supported
                  </p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".txt,.pdf,.mp4,.mov,.webm,.mkv,.mp3,.wav,.m4a"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          )}

          {/* Text Input */}
          {mode === 'text' && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="document-title" className="text-sm font-medium">
                  Document Title
                </label>
                <Input
                  id="document-title"
                  type="text"
                  placeholder="Enter document title..."
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="text-content" className="text-sm font-medium">
                  Text Content
                </label>
                <textarea
                  id="text-content"
                  className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Paste or type your text content here..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Webpage URL */}
          {mode === 'webpage' && (
            <div className="grid gap-2">
              <label htmlFor="webpage-url" className="text-sm font-medium">
                Webpage URL
              </label>
              <Input
                id="webpage-url"
                type="url"
                placeholder="https://example.com/article"
                value={webpageURL}
                onChange={(e) => setWebpageURL(e.target.value)}
              />
            </div>
          )}

          {/* YouTube URL */}
          {mode === 'youtube' && (
            <div className="grid gap-2">
              <label htmlFor="youtube-url" className="text-sm font-medium">
                YouTube URL
              </label>
              <Input
                id="youtube-url"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeURL}
                onChange={(e) => setYoutubeURL(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={
              isUploading ||
              (mode === 'file' && !selectedFile) ||
              (mode === 'youtube' && !youtubeURL.trim()) ||
              (mode === 'text' && (!textInput.trim() || !documentTitle.trim())) ||
              (mode === 'webpage' && !webpageURL.trim())
            }
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {mode === 'text' ? 'Adding...' : 
                 mode === 'webpage' ? 'Processing...' : 
                 mode === 'youtube' ? 'Processing...' : 'Uploading...'}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {mode === 'text' ? 'Add Text' :
                 mode === 'webpage' ? 'Add Webpage' :
                 mode === 'youtube' ? 'Add Video' : 'Upload File'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadModal;
