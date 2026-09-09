import { useEffect, useState } from 'react';
import { systemApi, datasetsApi } from '@/services/api';
import styles from './Page.module.css';

export function AdminPage() {
  const [health, setHealth] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [datasets, setDatasets] = useState<any[]>([]);

  useEffect(() => {
    systemApi.health().then(setHealth).catch(() => {});
    systemApi.metadata().then(setMeta).catch(() => {});
    datasetsApi.list().then(setDatasets).catch(() => {});
  }, []);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Administration</h1>
      <p className={styles.subtitle}>System management and dataset registration</p>

      <div className={styles.grid}>
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-section-title">Service Health</div>
          <pre style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', padding: 12, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(health, null, 2)}
          </pre>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-section-title">API Metadata</div>
          <pre style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', padding: 12, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(meta, null, 2)}
          </pre>
        </div>
      </div>

      <div className="panel" style={{ padding: 20 }}>
        <div className="panel-section-title">Registered Datasets ({datasets.length})</div>
        <pre style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', padding: 12, whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(datasets.map((d) => ({ id: d.id, name: d.name, type: d.type, status: d.status, variables: d.variables.length })), null, 2)}
        </pre>
      </div>

      <div className="panel" style={{ padding: 20 }}>
        <div className="panel-section-title">Note</div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, padding: 12 }}>
          This is a demonstration admin interface. For production deployment, implement proper authentication,
          role-based access control, and audit logging. Dataset registration should validate NetCDF
          compliance against CF conventions before ingestion.
        </p>
      </div>
    </div>
  );
}
