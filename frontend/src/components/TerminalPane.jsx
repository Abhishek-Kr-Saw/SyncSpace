import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io } from 'socket.io-client';
import { useSandbox } from '../context/SandboxContext.jsx';
import { getAgentUrl } from '../config.js';
import '@xterm/xterm/css/xterm.css';

/**
 * Terminal pane — xterm.js wired to the sandbox's PTY via Socket.IO.
 * Handles resize, buffered replay, and connection errors.
 */
export default function TerminalPane() {
  const { sandboxId } = useSandbox();
  const termRef = useRef(null);
  const containerRef = useRef(null);
  const socketRef = useRef(null);
  const fitAddonRef = useRef(null);

  useEffect(() => {
    if (!sandboxId || !containerRef.current) return;

    // Create terminal
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      theme: {
        background: '#0d0e14',
        foreground: '#e4e4e7',
        cursor: '#3ecfb4',
        cursorAccent: '#0d0e14',
        selectionBackground: 'rgba(62, 207, 180, 0.2)',
        black: '#1c1e2b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#3ecfb4',
        white: '#e4e4e7',
        brightBlack: '#5b5e6b',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#5eead4',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect Socket.IO through the Vite proxy
    const agentUrl = getAgentUrl(sandboxId);
    const socket = io('/', {
      path: `${agentUrl}/socket.io`,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      term.write('\x1b[32m● Connected to sandbox\x1b[0m\r\n');
      try {
        fitAddon.fit();
        socket.emit('terminal-resize', { cols: term.cols, rows: term.rows });
      } catch {
        // Ignore fit errors if the pane is still hidden
      }
    });

    socket.on('terminal-output', (data) => {
      term.write(data);
    });

    socket.on('connect_error', (err) => {
      term.write(`\x1b[31m● Connection error: ${err.message}\x1b[0m\r\n`);
    });

    socket.on('disconnect', (reason) => {
      term.write(`\x1b[33m● Disconnected: ${reason}\x1b[0m\r\n`);
    });

    // Send input to PTY
    term.onData((data) => {
      socket.emit('terminal-input', data);
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        const dims = { cols: term.cols, rows: term.rows };
        socket.emit('terminal-resize', dims);
      } catch {
        // Ignore resize errors during teardown
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      socket.disconnect();
      term.dispose();
      socketRef.current = null;
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sandboxId]);

  return (
    <div className="h-full flex flex-col">
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{
          backgroundColor: '#0d0e14',
          padding: '8px',
        }}
      />
    </div>
  );
}
