import { useState, useEffect, useRef } from 'react';
import { useSandbox } from '../context/SandboxContext.jsx';
import { waitForPreview } from '../services/api.js';

/**
 * Live preview iframe showing the sandbox's Vite dev server.
 * Waits until the preview origin responds before mounting the iframe.
 *
 * When `refreshTrigger` changes (AI just wrote files), the preview is
 * automatically reloaded after an 800 ms debounce so HMR has time to settle.
 */
export default function PreviewPane({ refreshTrigger = 0 }) {
  const { sandboxId, previewUrl } = useSandbox();
  const [refreshKey, setRefreshKey] = useState(0);
  const [warming, setWarming] = useState(true);
  const [warmupError, setWarmupError] = useState(null);
  const warmingRef = useRef(false);

  // Initial warmup — wait for the preview server to respond on first mount
  useEffect(() => {
    if (!sandboxId) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWarming(true);
    warmingRef.current = true;
    setWarmupError(null);

    waitForPreview(sandboxId, { signal: controller.signal })
      .then(() => {
        setWarming(false);
        warmingRef.current = false;
        setRefreshKey((k) => k + 1);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setWarming(false);
        warmingRef.current = false;
        setWarmupError(err.message || 'Preview failed to start');
      });

    return () => controller.abort();
  }, [sandboxId]);

  // Re-warm after AI writes files — debounced so HMR can finish processing
  useEffect(() => {
    if (!refreshTrigger || !sandboxId || warmingRef.current) return;

    const timer = setTimeout(() => {
      setWarmupError(null);
      setRefreshKey((k) => k + 1); // Reload iframe immediately (HMR already updated the page)
    }, 800);

    return () => clearTimeout(timer);
  }, [refreshTrigger, sandboxId]);

  function handleRefresh() {
    if (!sandboxId) return;
    setWarmupError(null);
    setWarming(true);
    warmingRef.current = true;
    waitForPreview(sandboxId, { timeoutMs: 20000 })
      .catch(() => {})
      .finally(() => {
        setWarming(false);
        warmingRef.current = false;
        setRefreshKey((k) => k + 1);
      });
  }

  if (!previewUrl) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">No preview available</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* URL bar + refresh */}
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded transition-colors duration-150 cursor-pointer"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          title="Refresh preview"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11.5 2.5V5.5H8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10.8 8.5A4 4 0 1 1 10.4 4.5L11.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div
          className="flex-1 px-3 py-1 rounded text-xs truncate"
          style={{
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          {previewUrl}
        </div>
      </div>

      {/* Iframe */}
      <div className="flex-1 relative">
        {(warming || warmupError) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10" style={{ backgroundColor: 'var(--bg-primary)' }}>
            {warming ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="loading-dot" style={{ animationDelay: '0ms' }} />
                  <span className="loading-dot" style={{ animationDelay: '200ms' }} />
                  <span className="loading-dot" style={{ animationDelay: '400ms' }} />
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Waiting for live preview…
                </p>
              </>
            ) : (
              <>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{warmupError}</p>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 rounded-lg text-xs cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  Retry
                </button>
              </>
            )}
          </div>
        )}
        {!warming && (
          <iframe
            key={refreshKey}
            src={previewUrl}
            className="w-full h-full border-0"
            style={{ backgroundColor: '#fff', display: warmupError ? 'none' : 'block' }}
            title="Live Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
      </div>
    </div>
  );
}
