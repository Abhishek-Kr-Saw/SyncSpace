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
  return `http://${sandboxId}.agent.localtest.me`;
}

/**
 * Build the preview URL for a given sandbox.
 */
export function getPreviewUrl(sandboxId) {
  return `http://${sandboxId}.preview.localtest.me`;
}

/**
 * Terminal (Socket.IO) URL for a sandbox.
 */
export function getAgentSocketUrl(sandboxId) {
  return `http://${sandboxId}.agent.localtest.me`;
}


/** Base path for the API gateway (proxied by Vite in dev). */
export const API_BASE = '/api';
