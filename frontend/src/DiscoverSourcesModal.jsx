import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Search, Loader2, ExternalLink, Download } from 'lucide-react';
import { API_ENDPOINTS } from './config';

const DiscoverSourcesModal = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedSources, setSuggestedSources] = useState([]);

  const handleDiscover = async () => {
    setIsLoading(true);
    setSuggestedSources([]);
    
    try {
      const response = await fetch(API_ENDPOINTS.discoverSources(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setSuggestedSources(data.sources || []);
      
      if (data.sources && data.sources.length === 0) {
        toast({
          title: "No sources found",
          description: "Try a different search query.",
        });
      }
    } catch (error) {
      console.error('Error discovering sources:', error);
      toast({
        title: "Error",
        description: "Failed to discover sources. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleIngest = async (source) => {
    toast({
      title: "Feature coming soon",
      description: "Direct source ingestion will be available in the next update.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Discover New Sources</DialogTitle>
          <DialogDescription>
            Search for relevant documents and resources to add to your knowledge base.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="search-description" className="text-sm font-medium">
              What are you looking for?
            </label>
            <Textarea
              id="search-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., 'latest military training manuals' or 'tactical operations guides'"
              className="min-h-[100px]"
            />
          </div>

          <Button
            onClick={handleDiscover}
            disabled={isLoading || !description.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Discover Sources
              </>
            )}
          </Button>

          {suggestedSources.length > 0 && (
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">Suggested Sources</h3>
              <ScrollArea className="h-[300px] rounded-md border p-2">
                <div className="space-y-2">
                  {suggestedSources.map((source) => (
                    <Card key={source.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <CardTitle className="text-sm font-medium leading-none">
                              {source.title}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {source.type}
                            </CardDescription>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleIngest(source)}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          {source.url}
                        </a>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DiscoverSourcesModal;