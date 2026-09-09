import { useEffect, useState } from 'react';
import { observationsApi } from '@/services/api';
import type { ArgoFloat, GliderTrack } from '@/types';
import styles from './ObservationsPage.module.css';

export function ObservationsPage() {
  const [floats, setFloats] = useState<ArgoFloat[]>([]);
  const [gliders, setGliders] = useState<GliderTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'argo' | 'gliders'>('argo');

  useEffect(() => {
    Promise.all([
      observationsApi.getArgo({ limit: 200 }),
      observationsApi.getGliders({}),
    ]).then(([a, g]) => {
      setFloats(a.floats);
      setGliders(g.tracks);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>In-Situ Observations</h1>
        <p className={styles.subtitle}>Real-time Argo floats and glider tracks in the Indian Ocean</p>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'argo' ? styles.activeTab : ''}`} onClick={() => setTab('argo')}>
          Argo Floats <span className="badge badge-info">{floats.length}</span>
        </button>
        <button className={`${styles.tab} ${tab === 'gliders' ? styles.activeTab : ''}`} onClick={() => setTab('gliders')}>
          Glider Tracks <span className="badge badge-info">{gliders.length}</span>
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}><div className="spinner" /> Loading observations…</div>
      ) : (
        <>
          {tab === 'argo' && (
            <div className={styles.grid}>
              {floats.map((f) => (
                <div key={f.float_id} className={`panel ${styles.card}`}>
                  <div className={styles.cardTop}>
                    <div>
                      <div className={styles.floatId}>{f.float_id}</div>
                      <div className={styles.floatPos}>{f.latitude.toFixed(3)}°N · {f.longitude.toFixed(3)}°E</div>
                    </div>
                    <span className={`badge ${f.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{f.status}</span>
                  </div>
                  <div className={styles.cardStats}>
                    <div className={styles.stat}>
                      <span className={styles.statVal}>{f.profile_count}</span>
                      <span className={styles.statLabel}>Profiles</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statVal}>{f.last_depth || '–'}</span>
                      <span className={styles.statLabel}>Last Depth (m)</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statVal}>{f.depth_max ? `0 – ${f.depth_max}m` : '–'}</span>
                      <span className={styles.statLabel}>Operating Depth</span>
                    </div>
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.lastSeen}>Updated {new Date(f.last_timestamp).toLocaleString()}</span>
                    <span className={styles.vars}>{f.variables.join(', ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'gliders' && (
            <div className={styles.grid}>
              {gliders.map((t) => (
                <div key={t.glider_id} className={`panel ${styles.card}`}>
                  <div className={styles.cardTop}>
                    <div>
                      <div className={styles.floatId}>{t.name}</div>
                      <div className={styles.floatPos}>{t.glider_id} · {t.mission_id}</div>
                    </div>
                    <span className="badge badge-success">active</span>
                  </div>
                  <div className={styles.cardStats}>
                    <div className={styles.stat}>
                      <span className={styles.statVal}>{t.total_observations}</span>
                      <span className={styles.statLabel}>Observations</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statVal}>{t.duration_hours?.toFixed(1)}</span>
                      <span className={styles.statLabel}>Duration (h)</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statVal}>{t.variables.length}</span>
                      <span className={styles.statLabel}>Variables</span>
                    </div>
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.lastSeen}>{new Date(t.start_time).toLocaleString()} →</span>
                    <span className={styles.vars}>{t.variables.join(', ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}