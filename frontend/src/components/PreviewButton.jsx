import { useState, useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { io } from 'socket.io-client';
import { getAgentSocketUrl } from '../config.js';
import { checkPreviewStatus } from '../services/api.js';

/**
 * PreviewButton component shown in the preview toolbar.
 *
 * Requirements:
 * - Stays hidden until the dev server preview is ready.
 * - Becomes ready via `preview:ready` Socket.IO event, with a fallback poll of
 *   GET /api/sandbox/:id/preview-status every 2 seconds that stops when ready or on unmount.
 * - On click, opens the previewUrl in a new tab via window.open(previewUrl, "_blank", "noopener,noreferrer").
 * - Has tooltip/title "Open in new tab", aria-label, and matching Tailwind styling.
 * - Resets ready state when sandbox changes or restarts.
 * - Cleans up listeners and intervals on unmount.
 */
export default function PreviewButton({ sandboxId, previewUrl }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!sandboxId) return;

    let isMounted = true;
    let pollInterval = null;

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const startPolling = () => {
      stopPolling();
      // Immediate poll
      checkPreviewStatus(sandboxId).then((ready) => {
        if (ready && isMounted) {
          setIsReady(true);
          stopPolling();
        }
      });

      // Periodic poll every 2 seconds
      pollInterval = setInterval(async () => {
        const ready = await checkPreviewStatus(sandboxId);
        if (ready && isMounted) {
          setIsReady(true);
          stopPolling();
        }
      }, 2000);
    };

    startPolling();

    // Socket.IO connection for real-time preview readiness
    const socket = io(getAgentSocketUrl(sandboxId), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('preview:ready', (data) => {
      const readyId = typeof data === 'string' ? data : data?.sandboxId;
      if (!readyId || readyId === sandboxId) {
        if (isMounted) {
          setIsReady(true);
          stopPolling();
        }
      }
    });

    // Reset ready state when dev server restarts
    socket.on('preview:reset', (data) => {
      const resetId = typeof data === 'string' ? data : data?.sandboxId;
      if (!resetId || resetId === sandboxId) {
        if (isMounted) {
          setIsReady(false);
          startPolling();
        }
      }
    });

    return () => {
      isMounted = false;
      stopPolling();
      socket.off('preview:ready');
      socket.off('preview:reset');
      socket.disconnect();
    };
  }, [sandboxId]);

  if (!isReady || !previewUrl) {
    return null;
  }

  function handleClick() {
    if (previewUrl) {
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Open in new tab"
      aria-label="Open in new tab"
      className="p-1.5 rounded transition-colors duration-150 cursor-pointer flex items-center justify-center hover:bg-neutral-800/40"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-muted)';
      }}
    >
      <ArrowUpRight className="w-3.5 h-3.5" />
    </button>
  );
}
