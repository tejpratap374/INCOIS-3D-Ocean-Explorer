import { useOceanStore } from '@/stores/oceanStore';
import type { VisualizationMode } from '@/types';
import styles from './PanelSection.module.css';

const MODES: { id: VisualizationMode; name: string; icon: string }[] = [
  { id: 'surface', name: 'Surface', icon: '▣' },
  { id: 'depth_slice', name: 'Depth Slice', icon: '▤' },
  { id: '3d_volume', name: '3D Volume', icon: '⬡' },
  { id: 'isosurface', name: 'Isosurface', icon: '◫' },
  { id: 'vectors', name: 'Vectors', icon: '↗' },
  { id: 'particles', name: 'Particles', icon: '⋯' },
];

export function VisualizationModeSelector() {
  const vizMode = useOceanStore((s) => s.vizMode);
  const setVizMode = useOceanStore((s) => s.setVizMode);
  const isosurfaceValue = useOceanStore((s) => s.isosurfaceValue);
  const setIsosurfaceValue = useOceanStore((s) => s.setIsosurfaceValue);
  const variable = useOceanStore((s) => s.variable);
  const field = useOceanStore((s) => s.field);

  const unit = variable === 'temperature' ? '°C' : variable === 'salinity' ? 'PSU' : 'mg/m³';
  const minVal = field?.min_value ?? (variable === 'temperature' ? 5 : 30);
  const maxVal = field?.max_value ?? (variable === 'temperature' ? 35 : 38);

  return (
    <div className={styles.section}>
      <div className="panel-section-title">Visualization</div>
      <div className={styles.modeList}>
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`${styles.modeBtn} ${vizMode === m.id ? styles.active : ''}`}
            onClick={() => setVizMode(m.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setVizMode(m.id); }}}
            role="radio"
            aria-checked={vizMode === m.id}
            aria-label={m.name}
          >
            <span className={styles.modeIcon} aria-hidden="true">{m.icon}</span>
            {m.name}
          </button>
        ))}
      </div>

      {vizMode === 'isosurface' && (
        <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#90caf9', marginBottom: '4px' }}>
            <span>Target Isosurface:</span>
            <strong>{isosurfaceValue.toFixed(1)} {unit}</strong>
          </div>
          <input
            type="range"
            min={minVal}
            max={maxVal}
            step={0.5}
            value={isosurfaceValue}
            onChange={(e) => setIsosurfaceValue(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#0288d1', cursor: 'pointer' }}
          />
        </div>
      )}
    </div>
  );
}
