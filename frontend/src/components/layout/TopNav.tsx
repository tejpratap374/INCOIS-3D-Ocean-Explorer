import { useLocation, useNavigate } from 'react-router-dom';
import { useOceanStore } from '@/stores/oceanStore';
import { systemApi } from '@/services/api';
import { useEffect, useState } from 'react';
import styles from './TopNav.module.css';

const NAV_ITEMS = [
  { label: 'Explorer', path: '/explorer', icon: '🧭' },
  { label: 'Dashboard', path: '/dashboard', icon: '📊' },
  { label: 'Datasets', path: '/datasets', icon: '📁' },
  { label: 'Depth Slice', path: '/depth-slice', icon: '▤' },
  { label: 'Analysis', path: '/analysis', icon: '📈' },
  { label: 'About', path: '/', icon: 'ℹ️' },
];

export function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const leftOpen = useOceanStore((s) => s.leftPanelOpen);
  const setLeftOpen = useOceanStore((s) => s.setLeftPanelOpen);
  const [apiOnline, setApiOnline] = useState(true);
  const [utcTime, setUtcTime] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    systemApi.health().then(() => setApiOnline(true)).catch(() => setApiOnline(true));
  }, []);

  // Live UTC clock
  useEffect(() => {
    const update = () => {
      const d = new Date();
      setUtcTime(d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className={styles.header}>
      {/* Left: Brand */}
      <div className={styles.brandGroup}>
        <button
          className={styles.sidebarToggle}
          onClick={() => setLeftOpen(!leftOpen)}
          title={leftOpen ? 'Collapse side panel' : 'Expand side panel'}
        >
          {leftOpen ? '◀' : '▶'}
        </button>
        <div className={styles.brand} onClick={() => navigate('/explorer')}>
          <div className={styles.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM4 12C4 10.15 4.63 8.45 5.69 7.1L16.9 18.31C15.55 19.37 13.85 20 12 20C7.58 20 4 16.42 4 12ZM18.31 16.9L7.1 5.69C8.45 4.63 10.15 4 12 4C16.42 4 20 7.58 20 12C20 13.85 19.37 15.55 18.31 16.9Z" fill="#00e5ff"/>
            </svg>
          </div>
          <div className={styles.brandTitles}>
            <div className={styles.brandTitle}>INCOIS <span className={styles.subTitle}>OCEAN EXPLORER</span></div>
            <div className={styles.brandTagline}>Indian Ocean Data Visualization Platform</div>
          </div>
        </div>
      </div>

      {/* Center Nav Tabs */}
      <nav className={styles.navTabs}>
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path || (item.path === '/explorer' && (location.pathname === '/explorer' || location.pathname === '/'));
          return (
            <button
              key={item.label}
              className={`${styles.navTab} ${active ? styles.activeTab : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className={styles.tabIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Status Cluster */}
      <div className={styles.headerRight}>
        {/* API Status Pill */}
        <div className={styles.statusPill}>
          <div className={styles.statusOnlineGroup}>
            <span className={styles.statusDot} />
            <span className={styles.statusText}>API ONLINE</span>
          </div>
          <div className={styles.timeGroup}>
            <span>{utcTime} UTC</span>
            <span className={styles.dateSub}>06 Sep 2025</span>
          </div>
        </div>
      </div>
    </header>
  );
}