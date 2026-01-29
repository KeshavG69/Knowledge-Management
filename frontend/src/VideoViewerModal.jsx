import React, { useRef, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, X, ExternalLink, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const VideoViewerModal = ({ isOpen, document, onClose }) => {
  const videoRef = useRef(null);
  const [videoError, setVideoError] = useState(null);
  const [showSubtitle, setShowSubtitle] = useState(true);

  if (!isOpen || !document) return null;

  const videoSrc = `/api/documents/view/${encodeURIComponent(document.document_id)}${document.kb_name ? `?kb_name=${encodeURIComponent(document.kb_name)}` : ''}`;
  const isYouTube = document.origin_url && document.origin_url.includes("youtube.com");
  let youTubeId = null;
  if (isYouTube) {
    const urlObj = new URL(document.origin_url);
    youTubeId = urlObj.searchParams.get("v");
    if (!youTubeId && urlObj.pathname.startsWith("/embed/")) {
      youTubeId = urlObj.pathname.split("/embed/")[1];
    }
  }

  const startTime = document.start_time;
  const endTime = document.end_time;

  useEffect(() => {
    if (videoRef.current && startTime !== null && !isNaN(startTime) && isFinite(startTime)) {
      const video = videoRef.current;
      const handleLoadedData = () => {
        // Start 2-4 seconds before the citation timestamp for context
        const startTimeSeconds = Math.max(0, startTime - 3);
        console.log(`[VideoViewer] Seeking to timestamp: ${startTimeSeconds}s (citation at ${startTime}s)`);
        video.currentTime = startTimeSeconds;
        video.play().catch(e => console.log('[Video] Autoplay prevented:', e));
      };
      
      if (video.readyState >= 2) { // HAVE_CURRENT_DATA
        handleLoadedData();
      } else {
        video.addEventListener('loadeddata', handleLoadedData);
        return () => video.removeEventListener('loadeddata', handleLoadedData);
      }
    } else if (startTime !== null) {
      console.warn(`[VideoViewer] Invalid timestamp: ${startTime}. Video will start from beginning.`);
    }
  }, [startTime]);

  const handleVideoError = (e) => {
    console.error('[Video] Playback error:', e);
    setVideoError('Failed to load video. The file may be missing or corrupted.');
  };

  const formatTime = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>{document.document_name}</DialogTitle>
              {startTime !== null && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <Clock className="h-3 w-3" />
                  Citation at {formatTime(startTime)}
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="relative w-full">
          {videoError ? (
            <Card className="p-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <p className="text-muted-foreground">{videoError}</p>
                <Button 
                  variant="outline" 
                  onClick={() => window.open(videoSrc, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Try Direct Link
                </Button>
              </div>
            </Card>
          ) : isYouTube && youTubeId ? (
            <div className="relative aspect-video">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${youTubeId}?rel=0${startTime ? `&start=${Math.floor(startTime)}` : ''}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="rounded-md"
              />
            </div>
          ) : (
            <div className="relative">
              <video 
                ref={videoRef}
                controls 
                className="w-full rounded-md"
                src={videoSrc}
                onError={handleVideoError}
                onLoadStart={() => setVideoError(null)}
              />
              {showSubtitle && document.snippet && (
                <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-background/90 backdrop-blur-sm border rounded-md p-3 max-w-[80%] flex items-start gap-2">
                  <p className="text-sm">
                    "{document.snippet.substring(0, 120)}..."
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => setShowSubtitle(false)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoViewerModal;