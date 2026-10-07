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
  const widthsRef = useRef(initialPx);
  const constraintsRef = useRef(constraints);
  const dragState = useRef(null);

  // Keep refs in sync for stable callbacks
  useEffect(() => { widthsRef.current = widths; }, [widths]);
  useEffect(() => { constraintsRef.current = constraints; }, [constraints]);

  const startDrag = useCallback((dividerIndex, e) => {
    // Only intercept primary pointer (button 0 for mouse, touch is usually 0)
    if (e.button !== undefined && e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();

    // Capture pointer to divider so events fire even when dragging over iframes
    if (e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    // Disable iframe pointer events globally while dragging, and show resize cursor
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const styleEl = document.createElement('style');
    styleEl.id = 'drag-resize-styles';
    styleEl.innerHTML = 'iframe { pointer-events: none !important; }';
    document.head.appendChild(styleEl);

    dragState.current = {
      dividerIndex,
      startX: e.clientX,
      startWidths: [...widthsRef.current],
      target: e.currentTarget,
      pointerId: e.pointerId
    };
  }, []);

  useEffect(() => {
    function onPointerMove(e) {
      if (!dragState.current) return;
      const { dividerIndex, startX, startWidths } = dragState.current;
      const delta = e.clientX - startX;

      const currentWidths = [...widthsRef.current];
      const left = dividerIndex;
      const right = dividerIndex + 1;

      const leftMin = constraintsRef.current[left]?.min ?? 100;
      let leftMax = constraintsRef.current[left]?.max ?? window.innerWidth;
      
      // Respect viewport and neighboring panels' min widths
      let reservedSpace = 0;
      for (let i = right; i < constraintsRef.current.length; i++) {
         reservedSpace += constraintsRef.current[i]?.min ?? 0;
      }
      
      const availableViewport = window.innerWidth - reservedSpace;
      if (leftMax > availableViewport) {
          leftMax = availableViewport;
      }

      let newLeft = startWidths[left] + delta;

      if (newLeft < leftMin) newLeft = leftMin;
      if (newLeft > leftMax) newLeft = leftMax;
      
      newLeft = Math.round(newLeft);

      if (currentWidths[left] !== newLeft) {
        // If the right neighbor is tracked (fixed widths), ensure sum stays constant
        if (startWidths.length > right) {
            let newRight = startWidths[right] - (newLeft - startWidths[left]);
            const rightMin = constraintsRef.current[right]?.min ?? 100;
            const rightMax = constraintsRef.current[right]?.max ?? window.innerWidth;
            
            if (newRight < rightMin) {
                newLeft -= (rightMin - newRight);
                newRight = rightMin;
            }
            if (newRight > rightMax) {
                newLeft -= (rightMax - newRight);
                newRight = rightMax;
            }
            if (currentWidths[left] !== newLeft || currentWidths[right] !== newRight) {
                const next = [...currentWidths];
                next[left] = newLeft;
                next[right] = newRight;
                setWidths(next);
            }
        } else {
            // Flexible right neighbor (flex-1) absorbs the change
            const next = [...currentWidths];
            next[left] = newLeft;
            setWidths(next);
        }
      }
    }

    function onPointerUp() {
      if (!dragState.current) return;
      const { target, pointerId } = dragState.current;
      
      if (target && target.releasePointerCapture) {
          try { target.releasePointerCapture(pointerId); } catch(err) {}
      }
      
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      const styleEl = document.getElementById('drag-resize-styles');
      if (styleEl) styleEl.remove();

      dragState.current = null;
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      
      // Cleanup global styles in case component unmounts during drag
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      const styleEl = document.getElementById('drag-resize-styles');
      if (styleEl) styleEl.remove();
    };
  }, []);

  return { widths, startDrag };
}
