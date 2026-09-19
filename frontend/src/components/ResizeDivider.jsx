import { useState } from 'react';

/**
 * Thin vertical drag handle between resizable panes.
 * Shows an accent glow on hover; calls onDragStart on mousedown.
 */
export default function ResizeDivider({ onDragStart }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseDown={onDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '4px',
        flexShrink: 0,
        cursor: 'col-resize',
        backgroundColor: hovered ? 'var(--accent)' : 'var(--border)',
        opacity: hovered ? 0.7 : 1,
        transition: 'background-color 0.15s, opacity 0.15s',
        position: 'relative',
        zIndex: 10,
      }}
      title="Drag to resize"
    />
  );
}
