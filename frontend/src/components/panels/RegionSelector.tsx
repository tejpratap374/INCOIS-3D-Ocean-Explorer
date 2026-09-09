import { useOceanStore } from '@/stores/oceanStore';
import styles from './RegionSelector.module.css';

const REGIONS = [
  { id: 'world', name: 'Whole World' },
  { id: 'indian_ocean', name: 'Indian Ocean' },
  { id: 'arabian_sea', name: 'Arabian Sea' },
  { id: 'bay_of_bengal', name: 'Bay of Bengal' },
  { id: 'somali_jet', name: 'Somali Jet' },
  { id: 'equatorial_jet', name: 'Equatorial Jet' },
  { id: 'pacific_ocean', name: 'Pacific Ocean' },
  { id: 'atlantic_ocean', name: 'Atlantic Ocean' },
  { id: 'southern_ocean', name: 'Southern Ocean' },
  { id: 'arctic_ocean', name: 'Arctic Ocean' },
];

export function RegionSelector() {
  const currentRegion = useOceanStore((s) => s.currentRegion);
  const setCurrentRegion = useOceanStore((s) => s.setCurrentRegion);

  return (
    <div className={styles.section}>
      <div className="panel-section-title">REGION</div>
      <div className={styles.selectorWrapper}>
        <select
          className={styles.selector}
          value={currentRegion}
          onChange={(e) => setCurrentRegion(e.target.value)}
        >
          {REGIONS.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
        <div className={styles.arrow}>&#9662;</div>
      </div>
    </div>
  );
}
