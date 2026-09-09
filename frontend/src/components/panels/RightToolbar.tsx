import styles from './RightToolbar.module.css';

const tools = [
  { id: 'select', label: 'Select', icon: '⌖', title: 'Select (Q)' },
  { id: 'measure', label: 'Measure', icon: '📏', title: 'Measure Distance (M)' },
  { id: 'draw', label: 'Draw', icon: '✏️', title: 'Draw Annotation (D)' },
  { id: 'download', label: 'Download', icon: '⬇', title: 'Download Data (S)' },
  { id: 'fullscreen', label: 'Fullscreen', icon: '⛶', title: 'Toggle Fullscreen (F)' },
] as const;

export function RightToolbar() {
  return (
    <div className={styles.toolbar} aria-label="Globe tools">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={styles.toolBtn}
          title={tool.title}
          aria-label={tool.label}
        >
          <span className={styles.toolIcon} aria-hidden="true">{tool.icon}</span>
          <span className={styles.toolLabel}>{tool.label}</span>
        </button>
      ))}
    </div>
  );
}