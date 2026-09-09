import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOceanStore } from '@/stores/oceanStore';
import { systemApi, observationsApi, datasetsApi } from '@/services/api';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const navigate = useNavigate();
  const argoFloats = useOceanStore((s) => s.argoFloats);
  const gliderTracks = useOceanStore((s) => s.gliderTracks);
  const [health, setHealth] = useState<any>(null);
  const [datasets, setDatasets] = useState<any[]>([]);

  useEffect(() => {
    systemApi.health().then(setHealth).catch(() => {});
    datasetsApi.list().then(setDatasets).catch(() => {});
  }, []);

  const activeArgo = argoFloats.filter((f) => f.status === 'active').length;
  const totalProfiles = argoFloats.reduce((sum, f) => sum + f.profile_count, 0);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Operational overview · INCOIS Ocean Explorer</p>
        </div>
        <button className="btn btn-outline" onClick={() => navigate('/explorer')}>Open Explorer →</button>
      </div>

      <div className={styles.statsGrid}>
        <StatCard icon="◐" label="Argo Floats" value={argoFloats.length} sub={`${activeArgo} active`} accent="var(--layer-argo)" />
        <StatCard icon="▤" label="Total Profiles" value={totalProfiles.toLocaleString()} sub="cumulative" accent="var(--layer-model)" />
        <StatCard icon="≋" label="Glider Tracks" value={gliderTracks.length} sub="active missions" accent="var(--layer-glider)" />
        <StatCard icon="▣" label="Datasets" value={datasets.length} sub="registered" accent="var(--status-online)" />
      </div>

      <div className={styles.grid2}>
        <div className="panel">
          <div className="panel-section-title">System Status</div>
          <div className={styles.statusList}>
            <StatusRow label="API Server" status={health ? 'online' : 'connecting'} detail={health?.status || '...'} />
            <StatusRow label="Data Service" status="online" detail="Synthetic adapter" />
            <StatusRow label="WebGL Renderer" status="client-side" detail="Three.js / WebGL2" />
            <StatusRow label="Argo Network" status="online" detail={`${activeArgo} active floats`} />
            <StatusRow label="Glider Network" status="online" detail={`${gliderTracks.length} tracks`} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-section-title">Datasets</div>
          <div className={styles.datasetList}>
            {datasets.map((d) => (
              <div key={d.id} className={styles.datasetItem}>
                <div>
                  <div className={styles.datasetName}>{d.name}</div>
                  <div className={styles.datasetMeta}>
                    {d.type} · {d.variables?.length || 0} variables · {d.is_synthetic ? 'synthetic' : 'real'}
                  </div>
                </div>
                <span className={`badge ${d.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{d.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-section-title">Active Observations (Sample)</div>
        <div className={styles.floatList}>
          {argoFloats.slice(0, 8).map((f) => (
            <div key={f.float_id} className={styles.floatCard}>
              <div className={styles.floatId}>{f.float_id.replace('INCOIS', '#')}</div>
              <div className={styles.floatPos}>
                {f.latitude.toFixed(2)}°, {f.longitude.toFixed(2)}°
              </div>
              <div className={styles.floatStats}>
                <span>Profiles: {f.profile_count}</span>
                <span>Depth: {f.last_depth}m</span>
              </div>
              <span className={`badge badge-${f.status === 'active' ? 'success' : 'warning'}`}>{f.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent }: { icon: string; label: string; value: any; sub: string; accent: string }) {
  return (
    <div className="panel" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="text-label">{label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
            {value}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `${accent}25`, color: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>{icon}</div>
      </div>
    </div>
  );
}

function StatusRow({ label, status, detail }: { label: string; status: string; detail: string }) {
  const isOnline = status === 'online' || status === 'client-side';
  return (
    <div className={styles.statusRow}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
        <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{detail}</span>
        <span className={`badge ${isOnline ? 'badge-success' : 'badge-warning'}`} style={{ textTransform: 'uppercase' }}>{status}</span>
      </div>
    </div>
  );
}