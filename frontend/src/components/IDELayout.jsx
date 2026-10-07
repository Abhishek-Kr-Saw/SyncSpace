import { useState, useCallback } from 'react';
import FileExplorer from './FileExplorer.jsx';
import ChatPanel from './ChatPanel.jsx';
import RightPanel from './RightPanel.jsx';
import ResizeDivider from './ResizeDivider.jsx';
import { useResizablePanes } from '../hooks/useResizablePanes.js';
import { useSandbox } from '../context/SandboxContext.jsx';

// Pane indices: 0 = FileExplorer, 1 = ChatPanel, (right panel = flex-1)
const PANE_CONSTRAINTS = [
  { min: 160, max: 400 }, // file explorer
  { min: 280, max: 600 }, // chat panel
];

/**
 * Main IDE layout — three-column flex grid with drag-to-resize dividers:
 * File Explorer | Chat Panel | Right Panel (Preview/Code/Terminal)
 */
export default function IDELayout({ onGoHome }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeRightTab, setActiveRightTab] = useState('preview');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [changedFiles, setChangedFiles] = useState([]);

  const { projectTitle } = useSandbox();

  // Resizable panes: initial widths in px for [explorer, chat]
  const { widths, startDrag } = useResizablePanes([224, 384], PANE_CONSTRAINTS);

  // When user clicks a file in the explorer, open it in the code editor
  const handleFileSelect = useCallback((filePath) => {
    setSelectedFile(filePath);
    setActiveRightTab('code');
  }, []);

  // When the AI agent completes an update_files tool call, refresh explorer + editor + preview
  const handleToolEvent = useCallback((eventType, payload) => {
    if (eventType === 'update_files_end') {
      setChangedFiles(payload?.files || []);
      setRefreshTrigger((t) => t + 1);
    }
  }, []);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary)',
        // Disable text selection while dragging
        userSelect: 'none',
      }}
    >
      {/* Top bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          flexShrink: 0,
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="var(--accent)" fillOpacity="0.15" />
            <path d="M12 20L18 14L24 20L18 26Z" fill="var(--accent)" />
            <path d="M18 20L24 14L30 20L24 26Z" fill="var(--accent)" fillOpacity="0.5" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            SyncSpace
          </span>
          {projectTitle && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                {projectTitle}
              </span>
            </>
          )}
        </div>
        
        <button
          onClick={onGoHome}
          className="px-3 py-1.5 rounded-md flex items-center gap-2 text-sm transition-colors"
          style={{ 
            color: 'var(--text-secondary)',
            backgroundColor: 'transparent',
            border: '1px solid var(--border)'
          }}
          onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'; }}
          onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          Back to Home
        </button>
      </header>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File Explorer */}
        <div style={{ width: widths[0], flexShrink: 0, overflow: 'hidden' }}>
          <FileExplorer
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            refreshTrigger={refreshTrigger}
            changedFiles={changedFiles}
          />
        </div>

        <ResizeDivider onDragStart={(e) => startDrag(0, e)} />

        {/* Chat Panel */}
        <div style={{ width: widths[1], flexShrink: 0, overflow: 'hidden' }}>
          <ChatPanel onToolEvent={handleToolEvent} />
        </div>

        <ResizeDivider onDragStart={(e) => startDrag(1, e)} />

        {/* Right Panel — remaining space */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <RightPanel
            selectedFile={selectedFile}
            activeTab={activeRightTab}
            onTabChange={setActiveRightTab}
            refreshTrigger={refreshTrigger}
            changedFiles={changedFiles}
          />
        </div>
      </div>
    </div>
  );
}
