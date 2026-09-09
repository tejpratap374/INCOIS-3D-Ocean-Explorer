import { useOceanStore } from '@/stores/oceanStore';
import styles from './LayerManager.module.css';

const layers = [
  { key: 'model', label: 'Ocean Model', icon: 'M', color: 'var(--layer-model)', getShow: (s: any) => s.showModelLayer, setShow: (s: any) => s.setShowModelLayer, meta: (s: any) => (s.showModelLayer ? 'Visible' : 'Hidden') },
  { key: 'currents', label: 'Currents', icon: '↗', color: 'var(--status-online)', getShow: (s: any) => s.showCurrents, setShow: (s: any) => s.setShowCurrents, meta: (s: any) => (s.showCurrents ? 'Visible' : 'Hidden') },
  { key: 'particles', label: 'Particle Flow', icon: '∴', color: 'var(--status-warning)', getShow: (s: any) => s.showParticles, setShow: (s: any) => s.setShowParticles, meta: (s: any) => (s.showParticles ? 'Visible' : 'Hidden') },
  { key: 'argo', label: 'Argo Floats', icon: 'A', color: 'var(--layer-argo)', getShow: (s: any) => s.showArgoLayer, setShow: (s: any) => s.setShowArgoLayer, meta: (s: any) => `${s.argoFloats.length} floats` },
  { key: 'glider', label: 'Glider Tracks', icon: 'G', color: 'var(--layer-glider)', getShow: (s: any) => s.showGliderLayer, setShow: (s: any) => s.setShowGliderLayer, meta: (s: any) => `${s.gliderTracks.length} active` },
  { key: 'coastline', label: 'Coastline', icon: '⊕', color: 'var(--text-tertiary)', getShow: (s: any) => s.showCoastline, setShow: (s: any) => s.setShowCoastline, meta: (s: any) => (s.showCoastline ? 'Visible' : 'Hidden') },
  { key: 'land', label: 'Continents', icon: '🌍', color: 'var(--status-online)', getShow: (s: any) => s.showLandMasses, setShow: (s: any) => s.setShowLandMasses, meta: (s: any) => (s.showLandMasses ? 'Visible' : 'Hidden') },
  { key: 'atmosphere', label: 'Atmosphere', icon: '☁', color: 'var(--accent-secondary)', getShow: (s: any) => s.showAtmosphere, setShow: (s: any) => s.setShowAtmosphere, meta: (s: any) => (s.showAtmosphere ? 'Visible' : 'Hidden') },
] as const;

export function LayerManager() {
  const store = useOceanStore();

  return (
    <div className={styles.section}>
      <div className="panel-section-title">DATA LAYERS</div>
      <div className={styles.layerList}>
        {layers.map((layer) => {
          const show = layer.getShow(store);
          const setShow = layer.setShow(store);
          const meta = layer.meta(store);
          return (
            <div
              key={layer.key}
              className={styles.layerRow}
              onClick={() => setShow(!show)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShow(!show); }}}
            >
              <div className={styles.layerIcon} style={{ background: layer.color }}>{layer.icon}</div>
              <div className={styles.layerInfo}>
                <div className={styles.layerName}>{layer.label}</div>
                <div className={styles.layerMeta}>{meta}</div>
              </div>
              <div className={`${styles.layerToggle} toggle ${show ? 'active' : ''}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}