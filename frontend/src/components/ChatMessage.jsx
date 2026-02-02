import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import {
  Copy, Check, ChevronRight, Target, Shield, AlertCircle,
  Info, FileText, Loader2, Wrench, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChatMessage({ message, theme = 'dark', onCopyCode }) {
  const [copiedCode, setCopiedCode] = useState(null);

  const getMessageIcon = (sender) => {
    switch (sender) {
      case 'user':
        return <Target className="h-4 w-4 text-blue-500" />;
      case 'agent':
        return <Shield className="h-4 w-4 text-primary" />;
      case 'system':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getMessageClass = (sender) => {
    switch (sender) {
      case 'user':
        return 'bg-blue-500/10 border-blue-500/30 shadow-blue-500/5';
      case 'agent':
        return 'bg-card border-border shadow-lg';
      case 'system':
        return 'bg-yellow-500/10 border-yellow-500/30';
      default:
        return 'bg-muted border-border';
    }
  };

  const handleCopyCode = async (code, index) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(index);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Custom markdown components
  const components = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      const codeIndex = `${message.id}-${codeString.slice(0, 20)}`;

      return !inline && match ? (
        <div className="relative group my-4 rounded-lg overflow-hidden border border-border/50 bg-black/30">
          <div className="flex items-center justify-between px-4 py-2 bg-black/50 border-b border-border/30">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              {match[1]}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleCopyCode(codeString, codeIndex)}
            >
              {copiedCode === codeIndex ? (
                <>
                  <Check className="h-3 w-3 mr-1 text-green-500" />
                  <span className="text-xs text-green-500">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  <span className="text-xs">Copy</span>
                </>
              )}
            </Button>
          </div>
          <SyntaxHighlighter
            style={theme === 'dark' ? oneDark : oneLight}
            language={match[1]}
            PreTag="div"
            className="!bg-transparent !m-0 text-sm"
            customStyle={{
              margin: 0,
              padding: '1rem',
              background: 'transparent',
            }}
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code
          className="px-1.5 py-0.5 rounded bg-muted/70 border border-border/50 text-sm font-mono text-primary"
          {...props}
        >
          {children}
        </code>
      );
    },
    pre({ children }) {
      return <div className="my-2">{children}</div>;
    },
    p({ children }) {
      return <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>;
    },
    ul({ children }) {
      return <ul className="mb-4 ml-6 list-disc space-y-2">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="mb-4 ml-6 list-decimal space-y-2">{children}</ol>;
    },
    li({ children }) {
      return <li className="leading-relaxed">{children}</li>;
    },
    h1({ children }) {
      return <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0 tracking-tight">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0 tracking-tight">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0 tracking-tight">{children}</h3>;
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-4 border-primary/50 pl-4 italic my-4 text-muted-foreground">
          {children}
        </blockquote>
      );
    },
    table({ children }) {
      return (
        <div className="my-4 overflow-x-auto">
          <table className="w-full border-collapse border border-border rounded-lg">
            {children}
          </table>
        </div>
      );
    },
    th({ children }) {
      return (
        <th className="border border-border bg-muted/50 px-4 py-2 text-left font-semibold">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="border border-border px-4 py-2">
          {children}
        </td>
      );
    },
  };

  return (
    <div
      className={cn(
        'rounded-xl border transition-all animate-in fade-in slide-in-from-bottom-4 duration-500',
        'shadow-sm hover:shadow-md',
        getMessageClass(message.sender)
      )}
    >
      <div className="flex items-start gap-4 p-5">
        {/* Avatar/Icon */}
        <div className={cn(
          "mt-1 p-2 rounded-lg",
          message.sender === 'user' ? 'bg-blue-500/20' :
          message.sender === 'agent' ? 'bg-primary/20' :
          'bg-yellow-500/20'
        )}>
          {getMessageIcon(message.sender)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Sender Label */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
              {message.sender === 'user' ? 'You' :
               message.sender === 'agent' ? 'Soldier IQ' :
               'System'}
            </span>
            {message.isStreaming && (
              <div className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                <span className="text-xs text-muted-foreground italic">thinking...</span>
              </div>
            )}
          </div>

          {/* Tool Calls - Show only during streaming before text */}
          {message.isStreaming && !message.text && message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mb-5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              {message.toolCalls.map((toolCall, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20"
                >
                  <div className="mt-0.5 p-1.5 rounded-md bg-primary/20">
                    {toolCall.status === 'running' ? (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    ) : (
                      <Wrench className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 text-sm space-y-1">
                    <div className="font-medium text-foreground flex items-center gap-2">
                      <span className="capitalize">{toolCall.name}</span>
                      {toolCall.status === 'completed' && toolCall.duration && (
                        <span className="text-xs text-muted-foreground font-normal px-2 py-0.5 rounded-full bg-muted">
                          {(toolCall.duration / 1000).toFixed(2)}s
                        </span>
                      )}
                    </div>
                    {toolCall.args && Object.keys(toolCall.args).length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {toolCall.args.query ? (
                          <span>Searching: <span className="italic">"{toolCall.args.query}"</span></span>
                        ) : (
                          <span>{JSON.stringify(toolCall.args, null, 2)}</span>
                        )}
                      </div>
                    )}
                    {toolCall.resultCount !== undefined && (
                      <div className="text-xs text-primary font-medium">
                        ✓ Found {toolCall.resultCount} result{toolCall.resultCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Message Content */}
          {message.text && (
            <div className={cn(
              'prose prose-sm dark:prose-invert max-w-none',
              'prose-headings:text-foreground prose-p:text-foreground',
              'prose-strong:text-foreground prose-code:text-primary',
              'prose-pre:bg-black/30 prose-pre:border prose-pre:border-border/50',
              message.isStreaming && 'animate-in fade-in duration-300'
            )}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={components}
              >
                {message.text}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />
              )}
            </div>
          )}

          {/* Sources */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                  Referenced Sources ({message.sources.length})
                </span>
              </div>
              <div className="grid gap-2">
                {message.sources.slice(0, 5).map((source, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                  >
                    <ChevronRight className="h-3 w-3 mt-0.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-foreground truncate">
                        {source.document_name}
                      </div>
                      {source.page_number && (
                        <div className="text-xs text-muted-foreground">
                          Page {source.page_number}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {message.sources.length > 5 && (
                  <div className="text-xs text-muted-foreground text-center py-1">
                    +{message.sources.length - 5} more sources
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
