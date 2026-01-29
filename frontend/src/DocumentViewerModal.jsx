import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, FileText, Loader2 } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`; // Using local worker file from public folder

const DocumentViewerModal = ({ isOpen, document, onClose }) => {
  const documentRef = useRef(document);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfDocument, setPdfDocument] = useState(null); // To store the loaded PDF document object
  const [isSearching, setIsSearching] = useState(false); // To indicate search is in progress
  const [snippetToHighlight, setSnippetToHighlight] = useState(''); // State for the snippet
  const [pdfError, setPdfError] = useState(null); // State for PDF loading errors
  const pageContainerRef = useRef(null); // Ref for the PDF container div
  const pageRef = useRef(null); // Ref for the Page component's main div
  const [modalWidth, setModalWidth] = useState(null);

  useEffect(() => {
    documentRef.current = document;
    console.log('[PDFView documentRef Effect] documentRef.current updated. document_name:', documentRef.current ? documentRef.current.document_name : 'N/A', 'page_number_to_open:', documentRef.current ? documentRef.current.page_number_to_open : 'N/A', '(type:', typeof (documentRef.current ? documentRef.current.page_number_to_open : undefined) + ')');
  }, [document]);

  useEffect(() => {
    const setWidth = () => {
      if (pageContainerRef.current) {
        setModalWidth(pageContainerRef.current.clientWidth);
      }
    };
    if (isOpen) {
      // A small delay might be necessary for the ref to be populated after the modal is rendered
      setTimeout(setWidth, 50);
      window.addEventListener('resize', setWidth);
    }
    return () => {
      window.removeEventListener('resize', setWidth);
    };
  }, [isOpen]);

  // Function to clear highlights
  const clearHighlightsFromPage = (pageElement) => {
    if (!pageElement) {
      console.log('[PDFView ClearHighlight] Page element ref not available.');
      return;
    }
    const textLayer = pageElement.querySelector('.react-pdf__Page__textContent');
    if (!textLayer) {
      console.log('[PDFView ClearHighlight] Text layer not found within page element.');
      return;
    }
    console.log('[PDFView] Clearing existing highlights from text layer...');
    const highlights = textLayer.querySelectorAll('mark.custom-highlight');
    console.log(`[PDFView] Found ${highlights.length} highlight(s) to clear.`);

    const marks = Array.from(highlights);

    marks.forEach(mark => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(window.document.createTextNode(mark.textContent), mark);
        parent.normalize();
      }
    });
    console.log('[PDFView] Finished clearing highlights.');
  };

  // Function to apply highlights – takes the rendered page element and snippet explicitly
  const applyHighlightingOnRenderedPage = (pageElement, snippetToHighlight, pageNumber) => {
    if (!pageElement || !snippetToHighlight) {
      return;
    }

    console.log(`[PDFView] Attempting to highlight on page ${pageNumber}.`);

    const normalizeForComparison = (text) => (text || '').toLowerCase().replace(/[^a-z0-9]/gi, '');

    const findOriginalOffset = (textNode, normalizedOffset) => {
        let tempNormalizedCount = 0;
        for (let i = 0; i < textNode.nodeValue.length; i++) {
            if (tempNormalizedCount >= normalizedOffset) {
                return i;
            }
            if (normalizeForComparison(textNode.nodeValue[i]).length > 0) {
                tempNormalizedCount++;
            }
        }
        return textNode.nodeValue.length; // Fallback to the end of the node
    };

    const normalizedSnippet = normalizeForComparison(snippetToHighlight);

    const textLayer = pageElement.querySelector('.react-pdf__Page__textContent');
    if (!textLayer) {
      console.warn(`[PDFView] Text layer not found for highlighting on page ${pageNumber}.`);
      return;
    }

    const walker = window.document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT, null, false);
    const allTextNodes = [];
    let node;
    while (node = walker.nextNode()) {
      allTextNodes.push(node);
    }

    if (allTextNodes.length === 0) {
      console.warn('[PDFView] No text nodes found on page', pageNumber);
      return;
    }

    const concatenatedNormalizedText = allTextNodes.map(node => normalizeForComparison(node.nodeValue)).join('');
    const startIndexInConcatenatedText = concatenatedNormalizedText.indexOf(normalizedSnippet);

    if (startIndexInConcatenatedText === -1) {
      console.warn('[PDFView] Snippet NOT found on page', pageNumber);
      return;
    }

    console.log('[PDFView] Snippet found. Calculating highlight range.');
    const endIndexInConcatenatedText = startIndexInConcatenatedText + normalizedSnippet.length;

    let startNode, endNode;
    let startOffset = -1, endOffset = -1;
    let currentNormalizedCharCount = 0;

    for (const textNode of allTextNodes) {
      const normalizedNodeLength = normalizeForComparison(textNode.nodeValue).length;
      const nodeStartOffsetInPage = currentNormalizedCharCount;
      const nodeEndOffsetInPage = currentNormalizedCharCount + normalizedNodeLength;

      if (startOffset === -1 && nodeEndOffsetInPage >= startIndexInConcatenatedText) {
        startNode = textNode;
        const normalizedStartOffsetInNode = startIndexInConcatenatedText - nodeStartOffsetInPage;
        startOffset = findOriginalOffset(textNode, normalizedStartOffsetInNode);
      }

      if (endOffset === -1 && nodeEndOffsetInPage >= endIndexInConcatenatedText) {
        endNode = textNode;
        const normalizedEndOffsetInNode = endIndexInConcatenatedText - nodeStartOffsetInPage;
        endOffset = findOriginalOffset(textNode, normalizedEndOffsetInNode);
      }
      
      if (startOffset !== -1 && endOffset !== -1) break;

      currentNormalizedCharCount += normalizedNodeLength;
    }

    if (startNode && endNode && startOffset !== -1 && endOffset !== -1) {
            try {
        const totalMatchLength = endIndexInConcatenatedText - startIndexInConcatenatedText;
        let processedChars = 0;
        currentNormalizedCharCount = 0;

        for (const textNode of allTextNodes) {
          const normalizedLen = normalizeForComparison(textNode.nodeValue).length;
          const nodeStart = currentNormalizedCharCount;
          const nodeEnd = nodeStart + normalizedLen;

          // Determine overlap between this node and the match range
          const overlapStart = Math.max(nodeStart, startIndexInConcatenatedText);
          const overlapEnd = Math.min(nodeEnd, endIndexInConcatenatedText);

          if (overlapStart < overlapEnd) {
            // Map normalized offsets back to original offsets within this node
            const startOffsetOrig = findOriginalOffset(textNode, overlapStart - nodeStart);
            const endOffsetOrig = findOriginalOffset(textNode, overlapEnd - nodeStart);

            const text = textNode.nodeValue;
            const before = text.slice(0, startOffsetOrig);
            const matchText = text.slice(startOffsetOrig, endOffsetOrig);
            const after = text.slice(endOffsetOrig);

            const parent = textNode.parentNode;
            const frag = window.document.createDocumentFragment();
            if (before) frag.appendChild(window.document.createTextNode(before));

            const mark = window.document.createElement('mark');
            mark.classList.add('custom-highlight');
            mark.style.backgroundColor = 'yellow';
            mark.style.color = 'black';
            mark.textContent = matchText;
            frag.appendChild(mark);

            if (after) frag.appendChild(window.document.createTextNode(after));

            parent.replaceChild(frag, textNode);
          }

          currentNormalizedCharCount += normalizedLen;
          processedChars += Math.max(0, overlapEnd - overlapStart);
          if (processedChars >= totalMatchLength) {
            break; // done highlighting entire snippet
          }
        }
        console.log('[PDFView] Highlight applied successfully (node-based).');
      } catch (e) {
        console.error('[PDFView] Error applying node-based highlight:', e);
      }
    } else {
      console.error('[PDFView] Could not determine start/end nodes for highlighting.');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      // Modal is closing, full reset
      setPageNumber(1);
      setPdfDocument(null);
      setIsSearching(false);
      setSnippetToHighlight('');
      return;
    }

    // Modal is open or opening
    if (document) {
      console.log('[PDFView Effect] Document prop changed or modal opened. document_name:', document.document_name, 'page_number_to_open:', document.page_number_to_open, '(type:', typeof document.page_number_to_open + ')');
      // A new document is being set (or modal is opening with a document)
      // Initial state reset for new document, except for pdfDocument which is handled by its own loading cycle.
      setPageNumber(1); // Default to page 1 initially
      setIsSearching(true); // Assume searching or navigation will occur

      if (document.snippet_to_highlight) {
        console.log('[PDFView Effect] Setting snippetToHighlight from prop:', document.snippet_to_highlight.substring(0,30)+'...');
        setSnippetToHighlight(document.snippet_to_highlight);
      } else {
        console.log('[PDFView Effect] Clearing snippetToHighlight (no snippet in prop)');
        setSnippetToHighlight('');
      }

      // Logic to navigate/search if pdfDocument is already loaded
      if (pdfDocument) {
        if (typeof document.page_number_to_open === 'number' && document.page_number_to_open > 0 && document.page_number_to_open <= pdfDocument.numPages) {
          console.log(`[PDFView Effect - PDF Ready] Navigating directly to page: ${document.page_number_to_open}`);
          setPageNumber(document.page_number_to_open);
          setIsSearching(false);
        } else if (document.snippet_to_highlight) {
          if (typeof document.page_number_to_open === 'number') { // Log if page_number was invalid
             console.warn(`[PDFView Effect - PDF Ready] Invalid page_number_to_open: ${document.page_number_to_open}. Max pages: ${pdfDocument.numPages}. Falling back to snippet search.`);
          }
          console.log('[PDFView Effect - PDF Ready] Attempting findPageWithSnippet with snippet:', document.snippet_to_highlight.substring(0,30)+'...');
          findPageWithSnippet(pdfDocument, document.snippet_to_highlight);
        } else {
          console.log('[PDFView Effect - PDF Ready] No valid page_number and no snippet. Defaulting to page 1.');
          setPageNumber(1);
          setIsSearching(false);
        }
      } else {
        // pdfDocument is not loaded yet, onDocumentLoadSuccess will handle navigation/search
        console.log('[PDFView Effect] pdfDocument not yet loaded. onDocumentLoadSuccess will handle navigation.');
      }
    } else {
      // Modal is open, but no document
      setPageNumber(1);
      // setPdfDocument(null); // This is usually handled by the <Document file=...> prop change
      setIsSearching(false);
      setSnippetToHighlight('');
      setPdfError(null); // Clear any previous PDF loading error
    }
  }, [isOpen, document, pdfDocument]);

  const onDocumentLoadError = (error) => {
    console.error('[PDFView] Error while loading document:', error.message);
    setPdfError(error.message);
    setPdfDocument(null); // Clear any previous PDF
    setNumPages(null);
  };


  const findPageWithSnippet = async (pdf, snippet) => {
    if (!pdf || !snippet) return;
    console.log(`[PDFView] Searching for snippet: "${snippet.substring(0, 30)}..."`);
    setIsSearching(true);
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');

        if (i < 4) { // Log text content for the first 3 pages for general debugging
          console.log(`[PDFView DEBUG] Page ${i} Raw Text Content (General):`, pageText);
        }

        // Aggressive normalization for pageText to match snippet normalization
        let normalizedPageText = pageText.toLowerCase();
        normalizedPageText = normalizedPageText.replace(/\s+/g, ' '); // Collapse all whitespace
        normalizedPageText = normalizedPageText.replace(/[^a-z0-9 ]/g, ''); // Remove non-alphanumeric (keeps spaces)
        normalizedPageText = normalizedPageText.trim();

        // The snippet received from props is already normalized in App.jsx
        if (normalizedPageText.includes(snippet)) { // snippet is already lowercased and normalized
          console.log(`[PDFView] Snippet found on page ${i}`);
          setPageNumber(i);
          setIsSearching(false);
          return; 
        }
      } catch (error) {
        console.error(`[PDFView] Error getting text from page ${i}:`, error);
      }
    }
    console.log('[PDFView] Snippet not found in document.');
    setIsSearching(false);
  };

  const onDocumentLoadSuccess = useCallback((loadedPdf) => {
    // Log the 'document' prop as captured by useCallback's closure
    console.log('[PDFView onDocumentLoadSuccess] Document prop from useCallback closure:', document ? { name: document.document_name, page_number_to_open: document.page_number_to_open, type: typeof document.page_number_to_open } : 'null/undefined');
    
    const currentDocument = documentRef.current; // Use the latest document from the ref
    // Log documentRef.current
    console.log('[PDFView onDocumentLoadSuccess] documentRef.current:', currentDocument ? { name: currentDocument.document_name, page_number_to_open: currentDocument.page_number_to_open, type: typeof currentDocument.page_number_to_open } : 'null/undefined');
    console.log(`[PDFView] Document loaded successfully: ${loadedPdf.numPages} pages. Current document prop (from closure): ${document ? document.document_name : 'N/A'}`);
    setNumPages(loadedPdf.numPages);
    setPdfDocument(loadedPdf); // Store the loaded PDF document instance

    if (currentDocument) { // Check if currentDocument (from ref) prop exists
      const targetPage = currentDocument.page_number_to_open !== undefined && currentDocument.page_number_to_open !== null ? parseInt(currentDocument.page_number_to_open, 10) : NaN;
      console.log(`[PDFView onDocumentLoadSuccess DEBUG] Checking navigation (using ref): 
        currentDocument.page_number_to_open: ${currentDocument.page_number_to_open} (type: ${typeof currentDocument.page_number_to_open}), 
        parsed targetPage: ${targetPage} (type: ${typeof targetPage}), 
        loadedPdf.numPages: ${loadedPdf.numPages} (type: ${typeof loadedPdf.numPages}),
        Condition 1 (!isNaN(targetPage)): ${!isNaN(targetPage)},
        Condition 2 (targetPage > 0): ${targetPage > 0},
        Condition 3 (targetPage <= loadedPdf.numPages): ${targetPage <= loadedPdf.numPages}`);
      if (!isNaN(targetPage) && targetPage > 0 && targetPage <= loadedPdf.numPages) {
        console.log(`[PDFView onDocumentLoadSuccess] Navigating directly to page: ${targetPage}`);
        setPageNumber(targetPage);
        setIsSearching(false);
      } else if (currentDocument.snippet_to_highlight) { // Fallback to snippet if page_number_to_open is not valid or not present
        if (currentDocument.page_number_to_open !== undefined && currentDocument.page_number_to_open !== null) { // Log if page_number was provided but invalid
            console.warn(`[PDFView onDocumentLoadSuccess] Invalid page_number_to_open: ${currentDocument.page_number_to_open} (parsed as ${targetPage}). Max pages: ${loadedPdf.numPages}. Falling back to snippet search.`);
        }
        console.log('[PDFView onDocumentLoadSuccess] Attempting findPageWithSnippet with prop snippet:', currentDocument.snippet_to_highlight.substring(0,30)+'...');
        findPageWithSnippet(loadedPdf, currentDocument.snippet_to_highlight);
      } else {
        console.log('[PDFView onDocumentLoadSuccess] No page number or snippet. Defaulting to page 1 or current.');
        // setPageNumber(1); // Or maintain current page if preferred
        setIsSearching(false);
      }
    } else {
      console.warn('[PDFView onDocumentLoadSuccess] Document prop (from ref) is null or undefined.');
      setPageNumber(1); // Default to page 1 if no document context
      setIsSearching(false);
    }
  }, [findPageWithSnippet]); // Removed document from deps, using ref instead

  // Effect for managing highlights when relevant props change
  useEffect(() => {
    // Clear highlights if snippet is removed, page changes, or PDF changes
    if (pageRef.current) { // Use pageRef
      clearHighlightsFromPage(pageRef.current);
    }
    // If there's a snippet and PDF is loaded, attempt to highlight (onRenderSuccess will also try)
    if (snippetToHighlight && pdfDocument && !isSearching && pageContainerRef.current) {
        // applyHighlightingOnRenderedPage(); // onRenderSuccess is preferred
    }
  }, [pageNumber, snippetToHighlight, pdfDocument]); // Removed numPages, isSearching as direct deps for this primary effect

  // This function will be called by the Page component once it's rendered
  const handlePageRenderSuccess = () => {
    console.log(`[PDFView] Page ${pageNumber} rendered successfully. Scheduling highlight attempt.`);
    setTimeout(() => {
      console.log(`[PDFView] Attempting highlight after short delay for page ${pageNumber}.`);
      applyHighlightingOnRenderedPage(pageRef.current, snippetToHighlight, pageNumber);
    }, 100); // Delay of 100ms, can be adjusted
  };

  function goToPrevPage() {
    setPageNumber((prevPageNumber) => Math.max(prevPageNumber - 1, 1));
  }

  function goToNextPage() {
    setPageNumber((prevPageNumber) => Math.min(prevPageNumber + 1, numPages));
  }



  const documentOptions = useMemo(() => ({
    GlobalWorkerOptions: pdfjs.GlobalWorkerOptions,
  }), []); // pdfjs.GlobalWorkerOptions is stable after initial setup

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {document ? document.document_name : 'Loading...'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-6 pb-6">
          {numPages && (
            <div className="flex items-center justify-center gap-4 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevPage}
                disabled={pageNumber <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm font-medium">
                Page {pageNumber} of {numPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={pageNumber >= numPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
          
          <div className="relative bg-muted rounded-lg overflow-hidden" ref={pageContainerRef}>
            {pdfError ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                Error: {pdfError}
              </div>
            ) : (
              <Document
                file={document.document_id ? `/api/documents/view/${document.document_id}${document.kb_name ? `?kb_name=${encodeURIComponent(document.kb_name)}` : ''}` : null}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                options={documentOptions}
                loading={
                  <div className="flex items-center justify-center p-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                    {isSearching ? "Searching for snippet..." : "Loading PDF..."}
                  </div>
                }
                className="flex items-center justify-center"
              >
                {numPages && (
                  <Page
                    key={`page_${pageNumber}`}
                    pageNumber={pageNumber}
                    inputRef={pageRef}
                    onRenderSuccess={handlePageRenderSuccess}
                    renderTextLayer={true}
                    width={modalWidth ? modalWidth : undefined}
                    className="shadow-lg"
                  />
                )}
              </Document>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentViewerModal;
