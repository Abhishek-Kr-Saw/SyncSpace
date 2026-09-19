import { useState, useCallback, useEffect } from 'react';
import { SandboxProvider, useSandbox } from './context/SandboxContext.jsx';
import { loadSession, clearSession } from './utils/session.js';
import LandingScreen from './components/LandingScreen.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import IDELayout from './components/IDELayout.jsx';
import { getAgentUrl } from './config.js';
import './index.css';

/**
 * App states:
 *   'landing'   → no sandbox yet, show New Project button
 *   'loading'   → sandbox is booting, show calm loading screen
 *   'restoring' → probing sessionStorage session liveness (brief spinner)
 *   'ide'       → sandbox ready, show the full IDE
 */
function AppContent() {
  // Initialize state based on whether we have a saved session to probe.
  // This avoids calling setAppState synchronously inside an effect.
  const [appState, setAppState] = useState(() =>
    loadSession() ? 'restoring' : 'landing'
  );
  const { setSandbox } = useSandbox();

  // On mount: if we are in 'restoring', probe the agent to confirm liveness.
  useEffect(() => {
    if (appState !== 'restoring') return;

    const saved = loadSession();
    if (!saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAppState('landing');
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // Quick fetch to see if the agent pod is still running
    fetch(`${getAgentUrl(saved.sandboxId)}/`, { signal: controller.signal })
      .then((res) => {
        clearTimeout(timeout);
        if (res.ok) {
          setSandbox(saved.sandboxId, saved.previewUrl);
          setAppState('ide');
        } else {
          clearSession();
          setAppState('landing');
        }
      })
      .catch(() => {
        clearTimeout(timeout);
        clearSession();
        setAppState('landing');
      });

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  // Only run on mount — appState is 'restoring' only at startup
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartLoading = useCallback((show = true) => {
    setAppState(show ? 'loading' : 'landing');
  }, []);

  const handleSandboxReady = useCallback((newSandboxId, previewUrl) => {
    setSandbox(newSandboxId, previewUrl);
    setAppState('ide');
  }, [setSandbox]);

  switch (appState) {
    case 'restoring':
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <span className="loading-dot" style={{ animationDelay: '0ms' }} />
          <span className="loading-dot" style={{ animationDelay: '200ms', marginLeft: 6 }} />
          <span className="loading-dot" style={{ animationDelay: '400ms', marginLeft: 6 }} />
        </div>
      );
    case 'loading':
      return <LoadingScreen />;
    case 'ide':
      return <IDELayout />;
    default:
      return (
        <LandingScreen
          onStartLoading={handleStartLoading}
          onSandboxReady={handleSandboxReady}
        />
      );
  }
}

export default function App() {
  return (
    <SandboxProvider>
      <AppContent />
    </SandboxProvider>
  );
}
