import { useOceanStore } from '@/stores/oceanStore';
import styles from './PanelSection.module.css';

const PRESETS = [
  { id: 'global' as const, name: 'Global', icon: '🌍' },
  { id: 'perspective' as const, name: 'Default', icon: '⬢' },
  { id: 'top' as const, name: 'Top', icon: '◯' },
  { id: 'side' as const, name: 'Side', icon: '▭' },
  { id: 'india' as const, name: 'India', icon: '◉' },
];

export function CameraPresets() {
  const preset = useOceanStore((s) => s.cameraPreset);
  const setPreset = useOceanStore((s) => s.setCameraPreset);
  return (
    <div className={styles.section}>
      <div className="panel-section-title">Camera</div>
      <div className={styles.modeList}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`${styles.modeBtn} ${preset === p.id ? styles.active : ''}`}
            onClick={() => setPreset(p.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreset(p.id); }}}
            role="radio"
            aria-checked={preset === p.id}
            aria-label={p.name}
          >
            <span className={styles.modeIcon} aria-hidden="true">{p.icon}</span>
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
