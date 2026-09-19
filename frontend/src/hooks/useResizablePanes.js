import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Drag-to-resize hook for N panels laid out horizontally.
 *
 * @param {number[]} initialPx - initial pixel widths for each panel
 * @param {{ min?: number, max?: number }[]} constraints - per-panel min/max px
 * @returns {{ widths: number[], startDrag: (dividerIndex: number, e: MouseEvent) => void }}
 *
 * Usage:
 *   const { widths, startDrag } = useResizablePanes([224, 384], [
 *     { min: 160, max: 400 },
 *     { min: 280, max: 600 },
 *   ]);
 *   // widths[0] → left panel width, widths[1] → center panel width
 *   // <ResizeDivider onDragStart={(e) => startDrag(0, e)} />
 */
export function useResizablePanes(initialPx, constraints = []) {
  const [widths, setWidths] = useState(initialPx);
  const dragState = useRef(null);

  const startDrag = useCallback((dividerIndex, e) => {
    e.preventDefault();
    dragState.current = {
      dividerIndex,
      startX: e.clientX,
      startWidths: [...widths],
    };
  }, [widths]);

  useEffect(() => {
    function onMouseMove(e) {
      if (!dragState.current) return;
      const { dividerIndex, startX, startWidths } = dragState.current;
      const delta = e.clientX - startX;

      setWidths((prev) => {
        const next = [...prev];
        const left = dividerIndex;
        const right = dividerIndex + 1;

        const leftMin = constraints[left]?.min ?? 100;
        const leftMax = constraints[left]?.max ?? 800;
        const rightMin = constraints[right]?.min ?? 100;
        const rightMax = constraints[right]?.max ?? 800;

        let newLeft = startWidths[left] + delta;
        let newRight = startWidths[right] - delta;

        // Clamp left panel
        if (newLeft < leftMin) { newRight += newLeft - leftMin; newLeft = leftMin; }
        if (newLeft > leftMax) { newRight += newLeft - leftMax; newLeft = leftMax; }
        // Clamp right panel
        if (newRight < rightMin) { newLeft += newRight - rightMin; newRight = rightMin; }
        if (newRight > rightMax) { newLeft += newRight - rightMax; newRight = rightMax; }

        next[left] = Math.round(newLeft);
        next[right] = Math.round(newRight);
        return next;
      });
    }

    function onMouseUp() {
      dragState.current = null;
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [constraints]);

  return { widths, startDrag };
}
