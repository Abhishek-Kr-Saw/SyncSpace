import { useState, useEffect, useCallback, useMemo } from 'react';
import { listFiles, normalizeFilePath } from '../services/api.js';
import { useSandbox } from '../context/SandboxContext.jsx';

/**
 * Build a tree structure from a flat list of file paths.
 * Each node: { name, path, isDir, children: [] }
 */
function buildTree(filePaths) {
  const root = { name: 'root', path: '', isDir: true, children: [] };

  for (const fp of filePaths) {
    const parts = fp.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const partPath = parts.slice(0, i + 1).join('/');

      let existing = current.children.find((c) => c.name === part);
      if (!existing) {
        existing = {
          name: part,
          path: partPath,
          isDir: !isLast,
          children: [],
        };
        current.children.push(existing);
      }
      current = existing;
    }
  }

  // Sort: directories first, then alphabetically
  function sortChildren(node) {
    node.children.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortChildren);
  }
  sortChildren(root);

  return root.children;
}

/** Icon for file type based on extension. */
function FileIcon({ name, isDir, isOpen }) {
  if (isDir) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
        {isOpen ? (
          <path d="M1.5 3.5h4l1.5 1.5h7v8h-13z" stroke="var(--accent)" strokeWidth="1.2" fill="var(--accent)" fillOpacity="0.15" />
        ) : (
          <path d="M1.5 3.5h4l1.5 1.5h7v8h-13z" stroke="var(--text-muted)" strokeWidth="1.2" fill="none" />
        )}
      </svg>
    );
  }

  const ext = name.split('.').pop();
  let color = 'var(--text-muted)';
  if (['jsx', 'js'].includes(ext)) color = '#f7df1e';
  else if (['css'].includes(ext)) color = '#42a5f5';
  else if (['html'].includes(ext)) color = '#e44d26';
  else if (['json'].includes(ext)) color = '#8bc34a';
  else if (['md'].includes(ext)) color = '#90a4ae';
  else if (['svg', 'png', 'jpg'].includes(ext)) color = '#ab47bc';

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <rect x="3" y="1.5" width="10" height="13" rx="1.5" stroke={color} strokeWidth="1.2" fill="none" />
      <line x1="5.5" y1="5" x2="10.5" y2="5" stroke={color} strokeWidth="0.8" opacity="0.5" />
      <line x1="5.5" y1="7.5" x2="10.5" y2="7.5" stroke={color} strokeWidth="0.8" opacity="0.5" />
      <line x1="5.5" y1="10" x2="8.5" y2="10" stroke={color} strokeWidth="0.8" opacity="0.5" />
    </svg>
  );
}

/** Single tree node (recursive). */
function TreeNode({ node, depth, onFileSelect, selectedFile, highlightedFiles }) {
  const [isOpen, setIsOpen] = useState(depth < 1);
  const isHighlighted = highlightedFiles.has(node.path);
  const isSelected = selectedFile === node.path;

  function handleClick() {
    if (node.isDir) {
      setIsOpen((o) => !o);
    } else {
      onFileSelect(node.path);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className={`
          w-full flex items-center gap-2 px-2 py-1 text-left text-sm rounded cursor-pointer
          transition-all duration-200
          ${isHighlighted ? 'file-highlight' : ''}
        `}
        style={{
          paddingLeft: `${depth * 16 + 8}px`,
          backgroundColor: isSelected ? 'var(--accent-bg)' : 'transparent',
          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {node.isDir && (
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            className="shrink-0 transition-transform duration-150"
            style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            <path d="M3 1.5L7 5L3 8.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
        {!node.isDir && <span className="w-[10px]" />}
        <FileIcon name={node.name} isDir={node.isDir} isOpen={isOpen} />
        <span className="truncate">{node.name}</span>
      </button>

      {node.isDir && isOpen && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              highlightedFiles={highlightedFiles}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * File explorer sidebar.
 * Fetches file list from sandbox agent, builds a tree view.
 *
 * Highlight fix (A3):
 *  - Both changedFiles and tree node paths are normalized before comparison.
 *  - The highlight effect re-runs whenever refreshTrigger changes so that
 *    a stable changedFiles reference (same array) still triggers the animation.
 */
export default function FileExplorer({ onFileSelect, selectedFile, refreshTrigger, changedFiles = [] }) {
  const { sandboxId } = useSandbox();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [highlightedFiles, setHighlightedFiles] = useState(new Set());

  const fetchFiles = useCallback(async () => {
    if (!sandboxId) return;
    try {
      setError(null);
      const fileList = await listFiles(sandboxId);
      setFiles(fileList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sandboxId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFiles();
  }, [fetchFiles, refreshTrigger]);

  // Briefly highlight files the agent just wrote.
  // Depends on both changedFiles AND refreshTrigger so that even if the
  // changedFiles array reference doesn't change, a new trigger re-runs this.
  useEffect(() => {
    if (!changedFiles.length) return;

    // Normalize all paths to avoid /workspace/ prefix mismatches
    const normalized = new Set(changedFiles.map(normalizeFilePath));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlightedFiles(normalized);

    const timer = setTimeout(() => setHighlightedFiles(new Set()), 1600);
    return () => clearTimeout(timer);
  // refreshTrigger ensures the effect re-runs even when changedFiles reference is stable
  }, [refreshTrigger, changedFiles]);

  const tree = useMemo(() => buildTree(files), [files]);

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Files
        </span>
        <button
          onClick={fetchFiles}
          className="p-1 rounded transition-colors duration-150 cursor-pointer"
          title="Refresh file list"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11.5 2.5V5.5H8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10.8 8.5A4 4 0 1 1 10.4 4.5L11.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1 file-tree-scrollbar">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="loading-dot" style={{ animationDelay: '0ms' }} />
            <span className="loading-dot ml-1" style={{ animationDelay: '150ms' }} />
            <span className="loading-dot ml-1" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {error && (
          <div className="px-3 py-4 text-xs" style={{ color: 'var(--error)' }}>
            <p className="mb-2">{error}</p>
            <button
              onClick={fetchFiles}
              className="underline cursor-pointer"
              style={{ color: 'var(--error)' }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            onFileSelect={onFileSelect}
            selectedFile={selectedFile}
            highlightedFiles={highlightedFiles}
          />
        ))}
      </div>
    </div>
  );
}
