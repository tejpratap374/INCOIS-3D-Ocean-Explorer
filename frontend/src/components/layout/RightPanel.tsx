import { useState } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { ColorbarEditor } from '../panels/ColorbarEditor';
import { VerticalExaggeration } from '../panels/VerticalExaggeration';
import { DepthRuler } from '../panels/DepthRuler';
import { ResizeHandle } from './ResizeHandle';
import { DataExportModal } from '../modals/DataExportModal';
import styles from './RightPanel.module.css';

export function RightPanel() {
  const rightOpen = useOceanStore((s) => s.rightPanelOpen);
  const setRightOpen = useOceanStore((s) => s.setRightPanelOpen);
  const rightPanelWidth = useOceanStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = useOceanStore((s) => s.setRightPanelWidth);
  const variable = useOceanStore((s) => s.variable);

  const [exportModalOpen, setExportModalOpen] = useState(false);

  const variableLabels: Record<string, string> = {
    temperature: 'Temperature',
    salinity: 'Salinity',
    speed: 'Current Speed',
    chl: 'Chlorophyll',
  };

  return (
    <>
      {/* Backdrop when drawer is open on mobile */}
      {rightOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setRightOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Collapsible drawer panel */}
      <aside
        className={`${styles.wrapper} ${rightOpen ? styles.open : ''}`}
        style={{ width: rightPanelWidth }}
        aria-label="View and style controls"
      >
        <div className={styles.panel}>
          <div className={styles.header}>
            <span className={styles.headerTitle}>View & Style</span>
            <button
              className={styles.closeBtn}
              onClick={() => setRightOpen(false)}
              title="Close panel"
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>
          <div className={styles.content}>
            {/* Depth ruler - compact synchronized indicator */}
            <DepthRuler />
            <div className={styles.divider} />
            {/* Current variable reference (not a selector - use bottom ribbon for switching) */}
            <div className={styles.currentVar}>
              <span className={styles.currentVarLabel}>Variable</span>
              <span className={styles.currentVarValue}>{variableLabels[variable] || variable}</span>
            </div>
            <div className={styles.divider} />
            <ColorbarEditor />
            <div className={styles.divider} />
            <VerticalExaggeration />

            <div className={styles.divider} />
            <button
              onClick={() => setExportModalOpen(true)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #00e5ff',
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
                color: '#00e5ff',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span>📥</span> Export CF-1.8 / OGC Data
            </button>
          </div>
          {rightOpen && <ResizeHandle onResize={setRightPanelWidth} edge="left" initialWidth={rightPanelWidth} minWidth={200} maxWidth={360} />}
        </div>
      </aside>

      <DataExportModal isOpen={exportModalOpen} onClose={() => setExportModalOpen(false)} />

      {/* Fixed toggle button on right edge - visible when panel is collapsed */}
      {!rightOpen && (
        <button
          className={styles.fixedToggle}
          onClick={() => setRightOpen(true)}
          title="Open view & style panel"
          aria-label="Open view & style panel"
        >
          ◀
        </button>
      )}
    </>
  );
}