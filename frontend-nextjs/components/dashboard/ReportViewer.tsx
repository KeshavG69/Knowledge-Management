"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { jsPDF } from "jspdf";

interface ReportViewerProps {
  reportContent: string;
  reportTitle: string;
  onClose: () => void;
}

export default function ReportViewer({ reportContent, reportTitle, onClose }: ReportViewerProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true);

      // Create a new jsPDF instance
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Set up styling
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let yPosition = margin;

      // Add title
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text(reportTitle, margin, yPosition);
      yPosition += 12;

      // Process markdown content
      const lines = reportContent.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if we need a new page
        if (yPosition > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }

        // Skip empty lines but add space
        if (!line.trim()) {
          yPosition += 3;
          continue;
        }

        // Handle H1 headings (# )
        if (line.startsWith('# ')) {
          pdf.setFontSize(16);
          pdf.setFont("helvetica", "bold");
          const text = line.substring(2);
          const wrappedLines = pdf.splitTextToSize(text, maxWidth);
          for (const wrappedLine of wrappedLines) {
            if (yPosition > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(wrappedLine, margin, yPosition);
            yPosition += 8;
          }
          yPosition += 3;
          continue;
        }

        // Handle H2 headings (## )
        if (line.startsWith('## ')) {
          pdf.setFontSize(14);
          pdf.setFont("helvetica", "bold");
          const text = line.substring(3);
          const wrappedLines = pdf.splitTextToSize(text, maxWidth);
          for (const wrappedLine of wrappedLines) {
            if (yPosition > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(wrappedLine, margin, yPosition);
            yPosition += 7;
          }
          yPosition += 2;
          continue;
        }

        // Handle H3 headings (### )
        if (line.startsWith('### ')) {
          pdf.setFontSize(12);
          pdf.setFont("helvetica", "bold");
          const text = line.substring(4);
          const wrappedLines = pdf.splitTextToSize(text, maxWidth);
          for (const wrappedLine of wrappedLines) {
            if (yPosition > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(wrappedLine, margin, yPosition);
            yPosition += 6;
          }
          yPosition += 2;
          continue;
        }

        // Handle unordered list items (- or *)
        if (line.match(/^[\s]*[-*]\s/)) {
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          const indent = line.search(/[-*]/);
          const text = line.substring(line.indexOf(' ', indent) + 1);
          const wrappedLines = pdf.splitTextToSize('• ' + text, maxWidth - indent * 2);
          for (const wrappedLine of wrappedLines) {
            if (yPosition > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(wrappedLine, margin + indent * 2, yPosition);
            yPosition += 5;
          }
          continue;
        }

        // Handle ordered list items (1. 2. etc.)
        if (line.match(/^[\s]*\d+\.\s/)) {
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          const indent = line.search(/\d/);
          const wrappedLines = pdf.splitTextToSize(line.substring(indent), maxWidth - indent * 2);
          for (const wrappedLine of wrappedLines) {
            if (yPosition > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(wrappedLine, margin + indent * 2, yPosition);
            yPosition += 5;
          }
          continue;
        }

        // Handle bold text (**text** or __text__)
        let processedLine = line.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');

        // Handle italic text (*text* or _text_)
        processedLine = processedLine.replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1');

        // Handle inline code (`code`)
        processedLine = processedLine.replace(/`([^`]+)`/g, '$1');

        // Regular paragraph text
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const wrappedLines = pdf.splitTextToSize(processedLine, maxWidth);
        for (const wrappedLine of wrappedLines) {
          if (yPosition > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.text(wrappedLine, margin, yPosition);
          yPosition += 5;
        }
      }

      // Save the PDF
      const fileName = `${reportTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      pdf.save(fileName);

      setDownloading(false);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-200/90 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full h-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-950 border border-blue-200 dark:border-amber-400/30 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 backdrop-blur-sm p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-blue-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <h2 className="text-lg font-bold text-blue-700 dark:text-amber-400 tracking-wider">{reportTitle}</h2>
              <p className="text-[10px] text-slate-500 tracking-wider">GENERATED REPORT</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="tactical-panel px-3 py-2 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors group flex items-center gap-2"
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-tactical-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs text-tactical-green font-semibold tracking-wide">COPIED</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-blue-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold tracking-wide">COPY</span>
                </>
              )}
            </button>

            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="tactical-panel px-3 py-2 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors group flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download as PDF"
            >
              {downloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-600 dark:border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold tracking-wide">DOWNLOADING...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-blue-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold tracking-wide">PDF</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="tactical-panel p-2 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors group"
              title="Close"
            >
              <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div className="flex-1 overflow-y-auto p-6 tactical-scrollbar bg-slate-50 dark:bg-slate-950">
          <div className="prose dark:prose-invert max-w-none font-['Inter',sans-serif]
            text-[15px] leading-[1.9]
            prose-headings:font-bold prose-headings:tracking-tight prose-headings:leading-tight
            dark:prose-headings:text-amber-400 prose-headings:text-blue-600
            prose-p:mb-7 prose-p:leading-[1.9] dark:prose-p:text-slate-100 prose-p:text-slate-800
            prose-ul:my-7 prose-ul:space-y-4 prose-ul:leading-[1.9]
            dark:prose-ul:text-slate-200 prose-ul:text-slate-700
            prose-ol:my-7 prose-ol:space-y-4 prose-ol:leading-[1.9]
            dark:prose-ol:text-slate-200 prose-ol:text-slate-700
            prose-li:mb-3 dark:prose-li:text-slate-200 prose-li:text-slate-700
            dark:prose-strong:text-amber-400 prose-strong:text-blue-700 prose-strong:font-bold
            dark:prose-code:text-amber-300 prose-code:text-blue-600
            dark:prose-code:bg-slate-900/50 prose-code:bg-blue-50
            prose-code:px-2 prose-code:py-1 prose-code:rounded
            dark:prose-a:text-amber-400 prose-a:text-blue-600
            prose-a:no-underline hover:prose-a:underline
            dark:prose-blockquote:text-slate-300 prose-blockquote:text-slate-600
            dark:prose-blockquote:border-amber-400/30 prose-blockquote:border-blue-400/30
            prose-blockquote:pl-6 prose-blockquote:py-2
            prose-h1:text-3xl prose-h1:mb-6 prose-h1:mt-8
            prose-h2:text-2xl prose-h2:mb-5 prose-h2:mt-8
            prose-h3:text-xl prose-h3:mb-4 prose-h3:mt-6
            prose-h4:text-lg prose-h4:mb-3 prose-h4:mt-5"
          >
            <ReactMarkdown>{reportContent}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
