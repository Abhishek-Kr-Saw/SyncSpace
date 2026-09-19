import PreviewPane from './PreviewPane.jsx';
import CodeEditor from './CodeEditor.jsx';
import TerminalPane from './TerminalPane.jsx';

const TABS = [
  { id: 'preview', label: 'Preview', icon: PreviewIcon },
  { id: 'code', label: 'Code', icon: CodeIcon },
  { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
];

function PreviewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="1.5" y1="5.5" x2="12.5" y2="5.5" stroke="currentColor" strokeWidth="1" />
      <circle cx="3.5" cy="4" r="0.5" fill="currentColor" />
      <circle cx="5.5" cy="4" r="0.5" fill="currentColor" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M5 3.5L2 7L5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 3.5L12 7L9 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 4.5L6 7L3 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="7" y1="10" x2="11" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Right panel with tabbed navigation between Preview, Code, and Terminal.
 * All three panes stay mounted (no remount cost); only the display is toggled.
 * This avoids Tailwind's `hidden` class conflicts and preserves terminal state.
 */
export default function RightPanel({
  selectedFile,
  activeTab = 'preview',
  onTabChange,
  refreshTrigger = 0,
  changedFiles = [],
}) {
  function handleTabChange(tabId) {
    onTabChange?.(tabId);
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Tab bar */}
      <div
        className="flex items-center shrink-0 px-1"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors duration-150 relative cursor-pointer"
              style={{
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <Icon />
              {tab.label}
              {/* Active indicator */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content — all three panes stay mounted; display is toggled via inline style */}
      <div className="flex-1 overflow-hidden relative">
        <div style={{ display: activeTab === 'preview' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
          <PreviewPane refreshTrigger={refreshTrigger} />
        </div>
        <div style={{ display: activeTab === 'code' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
          <CodeEditor
            filePath={selectedFile}
            refreshTrigger={refreshTrigger}
            changedFiles={changedFiles}
          />
        </div>
        <div style={{ display: activeTab === 'terminal' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
          <TerminalPane />
        </div>
      </div>
    </div>
  );
}
