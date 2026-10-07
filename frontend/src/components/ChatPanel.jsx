import { useState, useRef, useEffect, useCallback } from 'react';
import { useSandbox } from '../context/SandboxContext.jsx';
import { invokeAI, getModels } from '../services/api.js';
import { parseSSE } from '../services/parseSSE.js';
import ToolActivityChip from './ToolActivityChip.jsx';

// ─── Lightweight markdown renderer ──────────────────────────────────────────
/**
 * Convert a markdown string to React nodes.
 * Handles: fenced code blocks, inline code, **bold**, *italic*, `code`,
 * # headings (h1–h3), - / * bullet lists, blank-line paragraphs.
 * No external library required.
 */
function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const nodes = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block (``` ... ```)
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      nodes.push(
        <pre
          key={key++}
          style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '10px 12px',
            overflowX: 'auto',
            margin: '6px 0',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: '11px',
            lineHeight: '1.6',
            color: 'var(--text-primary)',
          }}
        >
          {lang && (
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontSize: 10 }}>
              {lang}
            </span>
          )}
          {codeLines.join('\n')}
        </pre>
      );
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const Tag = `h${level}`;
      const sizes = { 1: '1em', 2: '0.9em', 3: '0.85em' };
      nodes.push(
        <Tag
          key={key++}
          style={{
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: sizes[level],
            margin: '8px 0 4px',
          }}
        >
          {inlineMarkdown(headingMatch[2], key)}
        </Tag>
      );
      i++;
      continue;
    }

    // Bullet list items (- or *)
    if (/^[\s]*[-*]\s/.test(line)) {
      const listItems = [];
      while (i < lines.length && /^[\s]*[-*]\s/.test(lines[i])) {
        listItems.push(
          <li key={key++} style={{ marginBottom: 2 }}>
            {inlineMarkdown(lines[i].replace(/^[\s]*[-*]\s/, ''))}
          </li>
        );
        i++;
      }
      nodes.push(
        <ul key={key++} style={{ paddingLeft: 16, margin: '4px 0', listStyleType: 'disc' }}>
          {listItems}
        </ul>
      );
      continue;
    }

    // Numbered list items (1. or 1) )
    if (/^[\s]*\d+[\.)]\s/.test(line)) {
      const listItems = [];
      while (i < lines.length && /^[\s]*\d+[\.)]\s/.test(lines[i])) {
        listItems.push(
          <li key={key++} style={{ marginBottom: 2 }}>
            {inlineMarkdown(lines[i].replace(/^[\s]*\d+[\.)]\s/, ''))}
          </li>
        );
        i++;
      }
      nodes.push(
        <ol key={key++} style={{ paddingLeft: 16, margin: '4px 0', listStyleType: 'decimal' }}>
          {listItems}
        </ol>
      );
      continue;
    }

    // Blank line — paragraph break
    if (line.trim() === '') {
      nodes.push(<div key={key++} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // Normal paragraph line
    nodes.push(
      <p key={key++} style={{ margin: '1px 0', lineHeight: 1.65 }}>
        {inlineMarkdown(line)}
      </p>
    );
    i++;
  }

  return <>{nodes}</>;
}

/** Render inline markdown: **bold**, *italic*, `code` */
function inlineMarkdown(text) {
  // Split on **bold**, *italic*, `code` tokens
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match;
  let k = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<span key={k++}>{text.slice(last, match.index)}</span>);
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={k++} style={{ color: 'var(--text-primary)' }}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      parts.push(<em key={k++}>{token.slice(1, -1)}</em>);
    } else {
      // inline code
      parts.push(
        <code
          key={k++}
          style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            padding: '1px 5px',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: '0.9em',
            color: 'var(--accent)',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) {
    const remainingKey = k;
    parts.push(<span key={remainingKey}>{text.slice(last)}</span>);
  }

  return parts.length > 0 ? parts : text;
}
function ToolRow({ item }) {
  const isRunning = item.status === 'running';
  const isSuccess = item.status === 'success';
  const isError = item.status === 'error';
  
  const color = isRunning ? 'var(--text-secondary)' : isSuccess ? '#10b981' : '#ef4444';
  
  return (
    <div className="flex items-start gap-3 py-1.5 px-2 rounded-md" style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
      <div className="mt-0.5 shrink-0" style={{ color }}>
        {isRunning ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        ) : isSuccess ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        )}
      </div>
      <div className="flex flex-col gap-0.5 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
        <span>{item.label}</span>
        {item.paths && item.paths.length > 0 && (
          <span className="opacity-70 truncate max-w-[200px] sm:max-w-[250px]">
            {item.paths.length > 3 ? `${item.paths.length} files` : item.paths.join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

/**
 * AI Chat panel with frosted glass effect.
 * Handles SSE streaming, tool events, markdown rendering, and agent retries.
 */
export default function ChatPanel({ onToolEvent }) {
  const { sandboxId } = useSandbox();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectingStatus, setConnectingStatus] = useState(null); // "Connecting to agent… (attempt N)"
  const abortRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);


  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(() => {
    try { return localStorage.getItem('syncspace_model') || ''; } catch { return ''; }
  });

  // Load the available models once; keep the saved choice if it still exists
  useEffect(() => {
    let cancelled = false;
    getModels()
      .then((data) => {
        if (cancelled) return;
        setModels(data.models);
        setSelectedModel((current) =>
          data.models.some((m) => m.id === current)
            ? current
            : data.models.some((m) => m.id === data.default)
              ? data.default
              : data.models[0]?.id || ''
        );
      })
      .catch(() => { /* dropdown stays hidden; the backend default is used */ });
    return () => { cancelled = true; };
  }, []);

  function handleModelChange(e) {
    setSelectedModel(e.target.value);
    try { localStorage.setItem('syncspace_model', e.target.value); } catch { /* ignore */ }
  }


  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-grow textarea up to 5 rows
  const rows = Math.min(5, Math.max(1, (input.match(/\n/g) || []).length + 1));

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !sandboxId) return;

    setInput('');
    setIsStreaming(true);
    setConnectingStatus(null);

    const userMsg = { type: 'message', role: 'user', content: text, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
    setMessages((prev) => [...prev, userMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await invokeAI(
        text,
        sandboxId,
        controller.signal,
        (attempt) => setConnectingStatus(`Connecting to agent… (attempt ${attempt})`),
        selectedModel || undefined,
      );
      setConnectingStatus(null);

      for await (const { event, data } of parseSSE(response)) {
        if (event === 'message') {
          if (data.content && data.content.trim()) {
            setMessages((prev) => [
              ...prev, 
              { type: 'message', role: 'assistant', content: data.content, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
            ]);
          }
        } else if (event === 'tool') {
          if (data.status === 'running') {
            setMessages((prev) => [...prev, { type: 'tool', ...data }]);
          } else if (data.status === 'success' || data.status === 'error') {
            setMessages((prev) => {
              const updated = [...prev];
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].type === 'tool' && updated[i].id === data.id) {
                  updated[i] = { ...updated[i], ...data };
                  break;
                }
              }
              return updated;
            });
            if (data.tool === 'update_files') {
              onToolEvent?.('update_files_end', { files: data.paths || [] });
            }
          }
        } else if (event === 'error') {
          setMessages((prev) => [
            ...prev, 
            { type: 'message', role: 'assistant', isError: true, content: `⚠️ Error: ${data.error || 'Something went wrong'}`, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
          ]);
        } else if (event === 'done') {
          break;
        }
      }
    } catch (err) {
      setConnectingStatus(null);
      if (err.name !== 'AbortError') {
        setMessages((prev) => [
          ...prev, 
          { type: 'message', role: 'assistant', isError: true, content: `⚠️ Error: ${err.message}`, timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
        ]);
      }
    } finally {
      setIsStreaming(false);
      setConnectingStatus(null);
      abortRef.current = null;
    }
  }, [input, isStreaming, sandboxId, onToolEvent, selectedModel]);

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-chat)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderLeft: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1C4.13 1 1 3.58 1 6.75c0 1.83 1.06 3.44 2.7 4.5L3 14l3.18-1.59C6.7 12.48 7.34 12.5 8 12.5c3.87 0 7-2.58 7-5.75S11.87 1 8 1z" stroke="var(--accent)" strokeWidth="1.2" fill="none" />
          </svg>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            AI Chat
          </span>
        </div>
        <div className="flex items-center gap-2">
          {connectingStatus && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {connectingStatus}
            </span>
          )}
          {isStreaming && !connectingStatus && (
            <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5" style={{
              backgroundColor: 'rgba(62, 207, 180, 0.1)',
              color: 'var(--accent)',
            }}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
              Working...
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 chat-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" opacity="0.3">
              <path d="M16 2C8.27 2 2 7.16 2 13.5c0 3.66 2.12 6.88 5.4 9L6 28l6.36-3.18c1.12.24 2.36.38 3.64.38 7.73 0 14-5.16 14-11.5S23.73 2 16 2z" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Describe what you want to build
            </p>
          </div>
        )}

        {messages.map((item, i) => {
          if (item.type === 'tool') {
            return <ToolRow key={item.id || i} item={item} />;
          }

          return (
            <div key={i} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[95%] sm:max-w-[90%] rounded-xl px-4 py-3 text-sm leading-relaxed"
                style={{
                  backgroundColor: item.role === 'user'
                    ? 'var(--bg-elevated)'
                    : 'transparent',
                  color: item.isError ? 'var(--error)' : 'var(--text-primary)',
                  border: item.role === 'user' ? '1px solid var(--border)' : 'none',
                }}
              >
                <div className={`break-words ${item.role === 'user' ? 'whitespace-pre-wrap' : ''}`}>
                  {item.role === 'assistant' ? renderMarkdown(item.content) : item.content}
                </div>
                
                {item.timestamp && (
                  <div className={`text-[10px] mt-1.5 opacity-50 ${item.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {item.timestamp}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        {models.length > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <label htmlFor="model-select" className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Model
            </label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={handleModelChange}
              disabled={isStreaming}
              className="text-xs rounded-md px-2 py-1 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                colorScheme: 'dark',
              }}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        )}
        
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask SyncSpace AI…"
            rows={rows}
            className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed py-1"
            style={{ color: 'var(--text-primary)', maxHeight: '120px' }}
            disabled={isStreaming}
          />

          {isStreaming ? (
            <button
              onClick={handleStop}
              className="p-2 rounded-lg transition-colors duration-150 shrink-0 cursor-pointer"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--error)',
              }}
              title="Stop generation"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="3" width="10" height="10" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-2 rounded-lg transition-all duration-150 shrink-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--bg-primary)',
              }}
              title="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8L14 2L8 14L7 9L2 8Z" fill="currentColor" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
