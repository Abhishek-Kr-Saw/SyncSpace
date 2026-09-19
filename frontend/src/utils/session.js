/**
 * Session storage helpers for sandbox persistence.
 * Extracted to a separate file so SandboxContext can export both
 * components and utility functions without violating react-refresh rules.
 */

const SESSION_KEY = 'syncspace_session';

/** Persist sandbox session to sessionStorage so page reloads restore state. */
export function saveSession(sandboxId, previewUrl) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ sandboxId, previewUrl }));
  } catch {
    // Ignore storage errors (private browsing, quota)
  }
}

/** Read back the stored session, or return null. */
export function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { sandboxId, previewUrl } = JSON.parse(raw);
    if (sandboxId && previewUrl) return { sandboxId, previewUrl };
  } catch {
    // Ignore parse errors
  }
  return null;
}

/** Clear the stored session (e.g. on probe failure or explicit logout). */
export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore
  }
}
