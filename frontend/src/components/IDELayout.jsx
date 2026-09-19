import { useState, useCallback } from 'react';
import FileExplorer from './FileExplorer.jsx';
import ChatPanel from './ChatPanel.jsx';
import RightPanel from './RightPanel.jsx';
import ResizeDivider from './ResizeDivider.jsx';
import { useResizablePanes } from '../hooks/useResizablePanes.js';

// Pane indices: 0 = FileExplorer, 1 = ChatPanel, (right panel = flex-1)
const PANE_CONSTRAINTS = [
  { min: 160, max: 400 }, // file explorer
  { min: 280, max: 600 }, // chat panel
];

/**
 * Main IDE layout — three-column flex grid with drag-to-resize dividers:
 * File Explorer | Chat Panel | Right Panel (Preview/Code/Terminal)
 */
export default function IDELayout() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeRightTab, setActiveRightTab] = useState('preview');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [changedFiles, setChangedFiles] = useState([]);

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
        </div>
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
