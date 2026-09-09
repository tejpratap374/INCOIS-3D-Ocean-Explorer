import { useOceanStore } from '@/stores/oceanStore';
import styles from './QuickMetricCards.module.css';

const CARDS = [
  {
    id: 'temperature',
    name: 'Temperature',
    unit: '°C',
    icon: '🌡️',
    sparkPath: 'M 0 16 Q 15 8, 30 14 T 60 6 T 90 12',
    color: '#ff4d4d',
  },
  {
    id: 'salinity',
    name: 'Salinity',
    unit: 'PSU',
    icon: '💧',
    sparkPath: 'M 0 10 Q 15 16, 30 8 T 60 14 T 90 6',
    color: '#38bdf8',
  },
  {
    id: 'currents',
    name: 'Currents',
    unit: 'm/s',
    icon: '🌊',
    sparkPath: 'M 0 14 Q 15 6, 30 12 T 60 8 T 90 14',
    color: '#00e5ff',
  },
  {
    id: 'chl',
    name: 'Chlorophyll',
    unit: 'mg/m³',
    icon: '🍃',
    sparkPath: 'M 0 12 Q 15 14, 30 6 T 60 16 T 90 8',
    color: '#34d399',
  },
  {
    id: 'ssh',
    name: 'Sea Surface Height',
    unit: 'm',
    icon: '🥞',
    sparkPath: 'M 0 8 Q 15 14, 30 6 T 60 12 T 90 10',
    color: '#fbbf24',
  },
];

export function QuickMetricCards() {
  const currentVar = useOceanStore((s) => s.variable);
  const setVariable = useOceanStore((s) => s.setVariable);

  return (
    <div className={styles.container}>
      {CARDS.map((card) => {
        const isActive = currentVar === card.id;
        return (
          <div
            key={card.id}
            className={`${styles.card} ${isActive ? styles.activeCard : ''}`}
            onClick={() => setVariable(card.id)}
          >
            <div className={styles.cardHeader}>
              <span className={styles.icon}>{card.icon}</span>
              <div className={styles.titleGroup}>
                <span className={styles.name}>{card.name}</span>
                <span className={styles.unit}>{card.unit}</span>
              </div>
            </div>
            {/* Sparkline Graph */}
            <svg className={styles.sparkline} viewBox="0 0 90 20">
              <path
                d={card.sparkPath}
                fill="none"
                stroke={isActive ? '#00e5ff' : card.color}
                strokeWidth="1.8"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
