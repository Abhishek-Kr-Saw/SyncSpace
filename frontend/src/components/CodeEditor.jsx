import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useSandbox } from '../context/SandboxContext.jsx';
import { readFiles, updateFiles, extractFileContent, normalizeFilePath } from '../services/api.js';

/**
 * Code editor: displays file content in a textarea with line numbers.
 * Supports manual edits + Save button (Ctrl/Cmd+S).
 *
 * Refresh behaviour:
 *  - When the currently-open file is in `changedFiles` (AI just wrote it),
 *    always reload regardless of dirty state.
 *  - When `refreshTrigger` fires for an unrelated file and the user has
 *    unsaved changes, skip the reload to avoid clobbering the user's work.
 */
export default function CodeEditor({ filePath, refreshTrigger = 0, changedFiles = [] }) {
  const { sandboxId } = useSandbox();
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const dirtyRef = useRef(false);

  // Update ref after every render — useLayoutEffect runs synchronously after DOM paint
  // so it won't cause cascading re-renders (unlike updating during render).
  useLayoutEffect(() => {
    dirtyRef.current = content !== originalContent;
  });

  const fetchFile = useCallback(async (signal, { showLoading = true } = {}) => {
    if (!filePath || !sandboxId) return;
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const files = await readFiles(sandboxId, [filePath], { signal });
      const fileContent = extractFileContent(files, filePath);
      if (signal?.aborted) return;
      setContent(fileContent);
      setOriginalContent(fileContent);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setError(err.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filePath, sandboxId]);

  // Full reload whenever the selected file or sandbox changes
  useEffect(() => {
    if (!filePath || !sandboxId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContent('');
      setOriginalContent('');
      return;
    }
    dirtyRef.current = false;
    const controller = new AbortController();
    fetchFile(controller.signal, { showLoading: true });
    return () => controller.abort();
  }, [filePath, sandboxId, fetchFile]);

  // Silent refresh on trigger — always reload if the current file was changed by the agent
  useEffect(() => {
    if (!refreshTrigger || !filePath || !sandboxId) return;

    const currentFileNorm = normalizeFilePath(filePath);
    const changedNorm = (changedFiles || []).map(normalizeFilePath);
    const currentFileChanged = changedNorm.includes(currentFileNorm);

    // Skip if the user has unsaved work AND the agent didn't touch this file
    if (dirtyRef.current && !currentFileChanged) return;

    const controller = new AbortController();
    fetchFile(controller.signal, { showLoading: false });
    return () => controller.abort();
  }, [refreshTrigger, filePath, sandboxId, changedFiles, fetchFile]);

  async function handleSave() {
    if (!filePath || !sandboxId) return;
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);
      await updateFiles(sandboxId, [{ file: normalizeFilePath(filePath), content }]);
      setOriginalContent(content);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    // Handle Tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      setContent(newContent);
      requestAnimationFrame(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2;
      });
    }
  }

  const hasChanges = content !== originalContent;
  const lines = content.split('\n');
  const fileName = filePath ? filePath.split('/').pop() : '';

  if (!filePath) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
        <div className="text-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto mb-3" opacity="0.3">
            <rect x="6" y="3" width="20" height="26" rx="3" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" />
            <line x1="11" y1="10" x2="21" y2="10" stroke="var(--text-muted)" strokeWidth="1" opacity="0.5" />
            <line x1="11" y1="14" x2="21" y2="14" stroke="var(--text-muted)" strokeWidth="1" opacity="0.5" />
            <line x1="11" y1="18" x2="17" y2="18" stroke="var(--text-muted)" strokeWidth="1" opacity="0.5" />
          </svg>
          <p className="text-sm">Select a file to edit</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* File tab */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            {fileName}
          </span>
          {hasChanges && (
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent)' }} title="Unsaved changes" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-xs" style={{ color: 'var(--success)' }}>Saved ✓</span>
          )}
          {error && (
            <span className="text-xs" style={{ color: 'var(--error)' }}>{error}</span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="px-3 py-1 rounded text-xs font-medium transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: hasChanges ? 'var(--accent)' : 'var(--bg-elevated)',
              color: hasChanges ? 'var(--bg-primary)' : 'var(--text-muted)',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading-dot" style={{ animationDelay: '0ms' }} />
            <span className="loading-dot ml-1" style={{ animationDelay: '150ms' }} />
            <span className="loading-dot ml-1" style={{ animationDelay: '300ms' }} />
          </div>
        ) : (
          <div className="flex h-full overflow-auto code-scrollbar">
            {/* Line numbers */}
            <div
              className="shrink-0 text-right pr-3 pl-3 py-3 select-none text-xs leading-[1.7]"
              style={{
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-primary)',
                borderRight: '1px solid var(--border)',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              }}
            >
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="flex-1 p-3 bg-transparent outline-none resize-none text-xs leading-[1.7]"
              style={{
                color: 'var(--text-primary)',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                tabSize: 2,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
