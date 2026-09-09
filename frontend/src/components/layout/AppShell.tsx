import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';
import styles from './AppShell.module.css';

export function AppShell() {
  return (
    <div className={styles.shell}>
      <TopNav />
      <div className={styles.body}>
        <Outlet />
      </div>
    </div>
  );
}
