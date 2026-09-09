import { useState } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import styles from './FloatingMapToolbar.module.css';

export function FloatingMapToolbar() {
  const [activeTool, setActiveTool] = useState<string>('compass');
  const setCameraPreset = useOceanStore((s) => s.setCameraPreset);
  const setProbeLocation = useOceanStore((s) => s.setProbeLocation);

  const handleResetCamera = () => {
    setCameraPreset('global');
  };

  return (
    <div className={styles.toolbar}>
      {/* 1. Compass / Navigation (Active Blue Circle) */}
      <button
        className={`${styles.toolBtn} ${activeTool === 'compass' ? styles.toolBtnActive : ''}`}
        onClick={() => setActiveTool('compass')}
        title="Compass Navigation"
      >
        🎯
      </button>

      {/* 2. Hand Pan */}
      <button
        className={`${styles.toolBtn} ${activeTool === 'pan' ? styles.toolBtnActive : ''}`}
        onClick={() => setActiveTool('pan')}
        title="Pan Map"
      >
        ✋
      </button>

      {/* 3. Zoom In */}
      <button
        className={styles.toolBtn}
        onClick={() => setActiveTool('zoomin')}
        title="Zoom In"
      >
        🔍<sup>+</sup>
      </button>

      {/* 4. Zoom Out */}
      <button
        className={styles.toolBtn}
        onClick={() => setActiveTool('zoomout')}
        title="Zoom Out"
      >
        🔍<sup>-</sup>
      </button>

      {/* 5. Reset Globe View */}
      <button
        className={styles.toolBtn}
        onClick={handleResetCamera}
        title="Reset Globe View"
      >
        🌐
      </button>

      {/* 6. Measure Ruler */}
      <button
        className={`${styles.toolBtn} ${activeTool === 'measure' ? styles.toolBtnActive : ''}`}
        onClick={() => setActiveTool('measure')}
        title="Measure Distance"
      >
        📏
      </button>

      {/* 7. Select Area Box */}
      <button
        className={`${styles.toolBtn} ${activeTool === 'box' ? styles.toolBtnActive : ''}`}
        onClick={() => setActiveTool('box')}
        title="Select Region Box"
      >
        ⛶
      </button>

      {/* 8. Probe Inspector */}
      <button
        className={`${styles.toolBtn} ${activeTool === 'probe' ? styles.toolBtnActive : ''}`}
        onClick={() => {
          setActiveTool('probe');
          setProbeLocation({ lat: 15.0, lon: 75.0 });
        }}
        title="Probe Inspector"
      >
        🎯
      </button>
    </div>
  );
}
