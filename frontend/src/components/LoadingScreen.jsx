/**
 * Loading screen shown while the sandbox is booting.
 * Calm pulsing dots + status text.
 */
export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <h1 className="text-3xl font-semibold tracking-tight mb-8" style={{ color: 'var(--text-primary)' }}>
        SyncSpace
      </h1>

      {/* Pulsing dots */}
      <div className="flex items-center gap-2 mb-6">
        <span className="loading-dot" style={{ animationDelay: '0ms' }} />
        <span className="loading-dot" style={{ animationDelay: '200ms' }} />
        <span className="loading-dot" style={{ animationDelay: '400ms' }} />
      </div>

      <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
        Starting your sandbox environment…
      </p>

      <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
        Scheduling container • Waiting for agent
      </p>
    </div>
  );
}
