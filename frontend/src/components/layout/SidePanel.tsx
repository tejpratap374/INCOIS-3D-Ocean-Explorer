import { useOceanStore } from '@/stores/oceanStore';
import { LayerManager } from '../panels/LayerManager';
import { DepthControl } from '../panels/DepthControl';
import { RegionSelector } from '../panels/RegionSelector';
import { ResizeHandle } from './ResizeHandle';
import styles from './SidePanel.module.css';

interface SidePanelProps {
  className?: string;
}

export function SidePanel({ className }: SidePanelProps) {
  const leftOpen = useOceanStore((s) => s.leftPanelOpen);
  const setLeftOpen = useOceanStore((s) => s.setLeftPanelOpen);
  const leftPanelWidth = useOceanStore((s) => s.leftPanelWidth);
  const setLeftPanelWidth = useOceanStore((s) => s.setLeftPanelWidth);

  return (
    <>
      {/* Backdrop when drawer is open on mobile */}
      {leftOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setLeftOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Collapsible drawer panel */}
      <aside
        className={`${styles.wrapper} ${leftOpen ? styles.open : styles.closed} ${className || ''}`}
        style={{ width: leftOpen ? leftPanelWidth : 0 }}
        aria-label="Exploration controls"
      >
        <div className={styles.panel}>
          <div className={styles.header}>
            <span className={styles.headerTitle}>EXPLORE</span>
            <button
              className={styles.closeBtn}
              onClick={() => setLeftOpen(false)}
              title="Close controls"
              aria-label="Close exploration controls"
              aria-expanded="true"
            >
              ✕
            </button>
          </div>
          <div className={styles.content}>
            <RegionSelector />
            <div className={styles.divider} />
            <LayerManager />
            <div className={styles.divider} />
            <DepthControl />
          </div>
          <ResizeHandle onResize={setLeftPanelWidth} edge="right" initialWidth={leftPanelWidth} minWidth={220} maxWidth={480} />
        </div>
      </aside>

      
    </>
  );
}