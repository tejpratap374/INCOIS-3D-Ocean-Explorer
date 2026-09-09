import { useOceanStore } from '@/stores/oceanStore';
import styles from './PanelSection.module.css';

const VARIABLES = [
  { id: 'temperature', name: 'Temperature', unit: '°C', icon: '🌡' },
  { id: 'salinity', name: 'Salinity', unit: 'PSU', icon: '💧' },
  { id: 'speed', name: 'Current Speed', unit: 'm/s', icon: '🌊' },
  { id: 'chl', name: 'Chlorophyll', unit: 'mg/m³', icon: '🌿' },
];

export function VariableSelector() {
  const variable = useOceanStore((s) => s.variable);
  const setVariable = useOceanStore((s) => s.setVariable);

  return (
    <div className={styles.section}>
      <div className="panel-section-title">Variable</div>
      <div className={styles.varList}>
        {VARIABLES.map((v) => (
          <button
            key={v.id}
            className={`${styles.varBtn} ${variable === v.id ? styles.active : ''}`}
            onClick={() => setVariable(v.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setVariable(v.id); }}}
            role="radio"
            aria-checked={variable === v.id}
            aria-label={`${v.name} (${v.unit})`}
          >
            <span className={styles.varIcon} aria-hidden="true">{v.icon}</span>
            <span className={styles.varName}>{v.name}</span>
            <span className={styles.varUnit}>{v.unit}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
