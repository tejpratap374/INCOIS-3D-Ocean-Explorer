import { useEffect, useState } from 'react';
import { datasetsApi } from '@/services/api';
import type { Dataset } from '@/types';
import styles from './Page.module.css';

export function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    datasetsApi.list().then(setDatasets).finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Datasets</h1>
      <p className={styles.subtitle}>Registered ocean data sources available to the platform</p>

      {loading ? (
        <div className={styles.loading}><div className="spinner" /> Loading datasets…</div>
      ) : (
        <div className={styles.grid}>
          {datasets.map((d) => (
            <div key={d.id} className={`panel ${styles.card}`}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardTitle}>{d.name}</div>
                  <div className={styles.cardMeta}>{d.id}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <span className={`badge badge-${d.status === 'active' ? 'success' : 'warning'}`}>{d.status}</span>
                  {d.is_synthetic && <span className="badge badge-warning">demo</span>}
                </div>
              </div>

              <p className={styles.cardDesc}>{d.description}</p>

              <div className={styles.specGrid}>
                <Spec label="Type" value={d.type} />
                <Spec label="Format" value={d.format} />
                <Spec label="Source" value={d.source} />
                <Spec label="License" value={d.license} />
                <Spec
                  label="Spatial"
                  value={`${d.spatial_coverage.lat_min}°N – ${d.spatial_coverage.lat_max}°N, ${d.spatial_coverage.lon_min}°E – ${d.spatial_coverage.lon_max}°E`}
                />
                <Spec
                  label="Temporal"
                  value={
                    d.temporal_coverage?.start && d.temporal_coverage?.end
                      ? `${d.temporal_coverage.start.split('T')[0]} → ${d.temporal_coverage.end.split('T')[0]}`
                      : 'N/A'
                  }
                />
                {d.depth_coverage && (
                  <Spec label="Depth" value={`${d.depth_coverage.min} – ${d.depth_coverage.max} m (${d.depth_coverage.levels.length} levels)`} />
                )}
                <Spec label="Variables" value={d.variables.join(', ')} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.spec}>
      <div className="text-label">{label}</div>
      <div className={styles.specValue}>{value}</div>
    </div>
  );
}
