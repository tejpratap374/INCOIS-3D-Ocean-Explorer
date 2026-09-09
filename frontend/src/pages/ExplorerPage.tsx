import { DataLayersPanel } from '@/components/panels/DataLayersPanel';
import { GlobeViewportOverlays } from '@/components/panels/GlobeViewportOverlays';
import { RightSidebarPanel } from '@/components/panels/RightSidebarPanel';
import { DetailPanel } from '@/components/panels/DetailPanel';
import { OceanScene } from '@/features/ocean/OceanScene';
import { useOceanStore } from '@/stores/oceanStore';
import styles from './ExplorerPage.module.css';

export function ExplorerPage() {
  const leftOpen = useOceanStore((s) => s.leftPanelOpen);
  const detailOpen = useOceanStore((s) => s.detailPanelOpen);
  const selectedArgoId = useOceanStore((s) => s.selectedArgoId);
  const selectedGliderId = useOceanStore((s) => s.selectedGliderId);

  const showDetail = detailOpen || Boolean(selectedArgoId || selectedGliderId);

  return (
    <div className={styles.page}>
      {/* Left Sidebar: Data & Layers */}
      {leftOpen && <DataLayersPanel />}

      {/* Center Column: Globe Viewport */}
      <main className={styles.centerColumn}>
        <div className={styles.globeWrap}>
          <GlobeViewportOverlays />
          <OceanScene />
        </div>
      </main>

      {/* Right Sidebar: Region Info + Quick View + Time Control */}
      <RightSidebarPanel />

      {/* Device Observations & Ocean Models Detail Overlay */}
      {showDetail && <DetailPanel />}
    </div>
  );
}
