import { createContext, useContext, useState, useCallback } from 'react';
import { saveSession, loadSession } from '../utils/session.js';

const SandboxContext = createContext(null);

/**
 * Provides global sandbox state: sandboxId, previewUrl, and a setter.
 * Nearly every panel needs sandboxId to construct API / WebSocket URLs.
 * On first render, attempts to restore a previous session from sessionStorage.
 */
export function SandboxProvider({ children }) {
  const [sandbox, setSandboxState] = useState(() => {
    // Eagerly read session on provider init — App.jsx probes liveness before using it
    const saved = loadSession();
    return saved ?? { sandboxId: null, previewUrl: null };
  });

  const setSandbox = useCallback((sandboxId, previewUrl) => {
    setSandboxState({ sandboxId, previewUrl });
    saveSession(sandboxId, previewUrl);
  }, []);

  return (
    <SandboxContext.Provider value={{ ...sandbox, setSandbox }}>
      {children}
    </SandboxContext.Provider>
  );
}

/**
 * Hook to consume sandbox state from any component.
 * Returns { sandboxId, previewUrl, setSandbox }.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSandbox() {
  const ctx = useContext(SandboxContext);
  if (!ctx) {
    throw new Error('useSandbox must be used within a SandboxProvider');
  }
  return ctx;
}
