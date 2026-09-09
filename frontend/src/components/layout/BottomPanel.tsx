import { useOceanStore } from '@/stores/oceanStore';
import { TimeController } from '../panels/TimeController';
import styles from './BottomPanel.module.css';

export function BottomPanel() {
  const timeBarOpen = useOceanStore((s) => s.timeBarOpen);

  if (!timeBarOpen) return null;

  return (
    <footer className={styles.wrapper}>
      <TimeController />
    </footer>
  );
}