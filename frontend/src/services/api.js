import { API_BASE, getAgentUrl } from '../config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RETRY_STATUSES = new Set([404, 502, 503, 504]);

/**
 * Normalize agent file paths so "/src/App.jsx" and "src/App.jsx" match.
 */
export function normalizeFilePath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^workspace\//, '');
}

async function fetchWithRetry(url, options = {}, { retries = 20, delayMs = 500 } = {}) {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      lastError = new Error(`${res.status} ${res.statusText}`);
      if (!RETRY_STATUSES.has(res.status) || options.signal?.aborted) {
        throw lastError;
      }
    } catch (err) {
      lastError = err;
      if (err?.name === 'AbortError' || options.signal?.aborted) throw err;
    }
    await sleep(delayMs);
  }

  throw lastError || new Error(`Request failed: ${url}`);
}

/**
 * Start a new sandbox environment.
 * @returns {Promise<{ sandboxId: string, previewUrl: string }>}
 */
export async function startSandbox() {
  let retries = 15;
  let lastError;

  while (retries > 0) {
    const res = await fetch(`${API_BASE}/sandbox/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit', // Bypass Nginx ingress cookie affinity to avoid sticking to wrong pod
    });

    if (res.ok) {
      return res.json();
    }

    lastError = new Error(`Failed to start sandbox: ${res.status} ${res.statusText}`);
    
    // If it's a 404, we likely hit the agent pod instead of the server due to backend label collision. Retry.
    if (res.status === 404) {
      console.warn(`[Expected] Hit agent pod instead of server pod (backend label collision). Retrying... (${retries} left)`);
      retries--;
      await sleep(500);
      continue;
    }
    
    throw lastError;
  }
  
  throw lastError;
}

/** Poll the sandbox agent until it answers. */
export async function waitForAgent(sandboxId, { timeoutMs = 60000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${getAgentUrl(sandboxId)}/`);
      if (res.ok) return;
      lastError = new Error(`Agent not ready: ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await sleep(500);
  }

  throw lastError || new Error('Sandbox agent did not become ready in time');
}

/** Poll the preview origin (via Vite proxy) until Vite responds. */
export async function waitForPreview(sandboxId, { timeoutMs = 90000, signal } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const res = await fetch(`/preview-proxy/${sandboxId}/`, { signal, cache: 'no-store' });
      if (res.ok) return;
      lastError = new Error(`Preview not ready: ${res.status}`);
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      lastError = err;
    }
    await sleep(1000);
  }

  throw lastError || new Error('Preview did not become ready in time');
}

/**
 * List all files in the sandbox project.
 * @param {string} sandboxId
 * @returns {Promise<string[]>}
 */
export async function listFiles(sandboxId, { signal } = {}) {
  const res = await fetchWithRetry(
    `${getAgentUrl(sandboxId)}/list-files`,
    { signal },
    { retries: 25, delayMs: 400 },
  );
  const data = await res.json();
  return (data.files || []).map(normalizeFilePath);
}

/**
 * Read the content of one or more files.
 * @param {string} sandboxId
 * @param {string[]} files - relative file paths
 * @returns {Promise<Array<Record<string, string>>>}
 */
export async function readFiles(sandboxId, files, { signal } = {}) {
  const query = files.map(normalizeFilePath).join(',');
  const res = await fetchWithRetry(
    `${getAgentUrl(sandboxId)}/read-files?files=${encodeURIComponent(query)}`,
    { signal },
    { retries: 15, delayMs: 400 },
  );
  const data = await res.json();
  return data.files;
}

/** Pull string content for a requested path out of the agent read-files payload. */
export function extractFileContent(fileResults, requestedPath) {
  const wanted = normalizeFilePath(requestedPath);
  for (const fileObj of fileResults || []) {
    for (const [key, content] of Object.entries(fileObj)) {
      if (normalizeFilePath(key) === wanted) return content ?? '';
    }
  }
  if (fileResults?.[0]) return Object.values(fileResults[0])[0] ?? '';
  return '';
}

/**
 * Update (or create) files in the sandbox.
 * @param {string} sandboxId
 * @param {Array<{ file: string, content: string }>} files
 * @returns {Promise<object>}
 */
export async function updateFiles(sandboxId, files) {
  const res = await fetch(`${getAgentUrl(sandboxId)}/update-files`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update files: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Invoke the AI agent with a user message.
 * Retries up to 8 times on 502/503/504 (agent pod cold-starting).
 * Calls onRetry(attempt) between retries so the UI can show a status.
 *
 * @param {string} message
 * @param {string} projectId - the sandboxId
 * @param {AbortSignal} [signal] - optional abort signal
 * @param {(attempt: number) => void} [onRetry] - called before each retry
 * @returns {Promise<Response>}
 */
export async function invokeAI(message, projectId, signal, onRetry) {
  const MAX_RETRIES = 8;
  const RETRY_DELAY_MS = 1000;
  const RETRYABLE = new Set([502, 503, 504]);

  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    if (attempt > 0) {
      onRetry?.(attempt);
      await sleep(RETRY_DELAY_MS);
    }

    try {
      const res = await fetch(`${API_BASE}/ai/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, projectId }),
        signal,
      });

      if (res.ok) return res;

      lastError = new Error(`AI invocation failed: ${res.status} ${res.statusText}`);

      if (!RETRYABLE.has(res.status)) throw lastError;
    } catch (err) {
      if (err?.name === 'AbortError' || signal?.aborted) throw err;
      lastError = err;
      // Network errors (ECONNREFUSED, etc.) are also retryable
    }
  }

  throw lastError || new Error('AI agent did not become ready in time');
}
