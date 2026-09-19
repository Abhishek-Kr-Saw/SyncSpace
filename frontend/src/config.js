/**
 * SyncSpace URL configuration.
 *
 * All sandbox-specific URLs are derived from the sandboxId.
 * Change the base domain here when moving between local dev and deployment.
 */

const BASE_DOMAIN = 'localhost';

/**
 * Build the agent URL for a given sandbox.
 * Routed through Vite's dev proxy to bypass CORS/DNS issues with local subdomains.
 */
export function getAgentUrl(sandboxId) {
  // Use relative URL so requests go to Vite server (localhost:5173), which proxies them.
  return `/agent-proxy/${sandboxId}`;
}

/**
 * Build the preview URL for a given sandbox.
 * This is the Vite dev server running inside the sandbox container.
 */
export function getPreviewUrl(sandboxId) {
  return `http://${sandboxId}.preview.${BASE_DOMAIN}`;
}

/** Base path for the API gateway (proxied by Vite in dev). */
export const API_BASE = '/api';
