import { useCallback, useRef } from 'react';
import styles from './ResizeHandle.module.css';

type Edge = 'left' | 'right';

interface ResizeHandleProps {
  onResize: (width: number) => void;
  edge: Edge;
  initialWidth: number;
  minWidth?: number;
  maxWidth?: number;
}

export function ResizeHandle({ onResize, edge, initialWidth, minWidth = 220, maxWidth = 480 }: ResizeHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const atMinRef = useRef(false);
  const atMaxRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startXRef.current = e.clientX;
      startWidthRef.current = initialWidth;
      atMinRef.current = false;
      atMaxRef.current = false;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startXRef.current;
        let newWidth = startWidthRef.current;
        if (edge === 'right') {
          newWidth += deltaX;
        } else {
          newWidth -= deltaX;
        }
        
        // Track if we're at limits for visual feedback
        atMinRef.current = newWidth <= minWidth;
        atMaxRef.current = newWidth >= maxWidth;
        
        onResize(newWidth);
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        atMinRef.current = false;
        atMaxRef.current = false;
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [onResize, edge, initialWidth, minWidth, maxWidth]
  );

  // Visual feedback class when at limits
  const limitClass = atMinRef.current ? styles.atMin : atMaxRef.current ? styles.atMax : '';

  return (
    <div
      ref={handleRef}
      className={`${styles.handle} ${styles[edge]} ${limitClass}`}
      onMouseDown={handleMouseDown}
      aria-label={edge === 'right' ? 'Resize left panel' : 'Resize right panel'}
      role="separator"
      tabIndex={0}
    />
  );
}