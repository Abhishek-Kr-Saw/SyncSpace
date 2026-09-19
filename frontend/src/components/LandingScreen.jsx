import { useState } from 'react';
import { startSandbox, waitForAgent } from '../services/api.js';

/**
 * Landing screen shown before any sandbox is active.
 * Centered branding + "New Project" button that spins up a sandbox.
 */
export default function LandingScreen({ onStartLoading, onSandboxReady }) {
  const [error, setError] = useState(null);

  async function handleNewProject() {
    setError(null);
    onStartLoading();
    try {
      const data = await startSandbox();
      await waitForAgent(data.sandboxId);
      onSandboxReady(data.sandboxId, data.previewUrl);
    } catch (err) {
      setError(err.message);
      onStartLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-2">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="shrink-0">
            <rect width="40" height="40" rx="10" fill="var(--accent)" fillOpacity="0.15" />
            <path d="M12 20L18 14L24 20L18 26Z" fill="var(--accent)" />
            <path d="M18 20L24 14L30 20L24 26Z" fill="var(--accent)" fillOpacity="0.5" />
          </svg>
          <h1 className="text-4xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            SyncSpace
          </h1>
        </div>

        <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
          AI-powered cloud code editor
        </p>

        <button
          onClick={handleNewProject}
          className="mt-4 px-8 py-3 rounded-lg text-base font-medium transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--bg-primary)',
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--accent-hover)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--accent)'}
        >
          New Project
        </button>

        {error && (
          <div className="mt-4 px-4 py-2 rounded-lg text-sm" style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--error)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
          }}>
            {error}
            <button
              onClick={handleNewProject}
              className="ml-3 underline cursor-pointer"
              style={{ color: 'var(--error)' }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <p className="absolute bottom-8 text-xs" style={{ color: 'var(--text-muted)' }}>
        powered by AI
      </p>
    </div>
  );
}
