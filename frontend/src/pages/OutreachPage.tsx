import { useNavigate } from 'react-router-dom';
import styles from './OutreachPage.module.css';

const EXPERIENCES = [
  {
    id: 'explore-ocean',
    title: 'Explore the Ocean',
    desc: 'Take a guided tour of the Indian Ocean in 3D — rotate, zoom, and discover.',
    icon: '⬡',
    color: 'var(--layer-model)',
    tags: ['beginner', '3D', 'interactive'],
  },
  {
    id: 'argo-journey',
    title: 'Follow an Argo Float',
    desc: 'Learn how Argo floats drift through the ocean, collecting temperature and salinity data at different depths.',
    icon: '◎',
    color: 'var(--layer-argo)',
    tags: ['observations', 'Argo', 'science'],
  },
  {
    id: 'ocean-currents',
    title: 'See Ocean Currents',
    desc: 'Watch how monsoon winds drive surface currents across the Arabian Sea and Bay of Bengal.',
    icon: '↗',
    color: 'var(--status-online)',
    tags: ['physics', 'monsoon', 'dynamics'],
  },
  {
    id: 'temperature-map',
    title: 'Explore Temperature',
    desc: 'Discover how ocean temperature varies from the warm surface to the cold deep ocean.',
    icon: '🌡',
    color: 'var(--status-warning)',
    tags: ['temperature', 'climate', 'surface'],
  },
  {
    id: 'salinity-secrets',
    title: 'Salinity Secrets',
    desc: 'Understand why the Bay of Bengal is fresher than the Arabian Sea.',
    icon: '💧',
    color: 'var(--layer-model)',
    tags: ['salinity', 'rivers', 'freshwater'],
  },
  {
    id: 'depth-dive',
    title: 'Dive Through Depth',
    desc: 'Explore the ocean from surface to 2000m depth — see how temperature and light change.',
    icon: '▾',
    color: 'var(--layer-glider)',
    tags: ['depth', 'thermo', 'exploration'],
  },
];

const KNOWLEDGE_CARDS = [
  {
    title: 'What is the Indian Ocean?',
    content: 'The Indian Ocean is the third-largest ocean, covering about 20% of Earth\'s surface. It is bounded by Africa to the west, Asia to the north, Australia to the east, and the Southern Ocean to the south.',
    icon: '🌊',
  },
  {
    title: 'What are Argo Floats?',
    content: 'Argo is a global array of about 4,000 free-drifting profiling floats that measure temperature and salinity throughout the ocean. Each float dives to 2,000m depth and rises to the surface, transmitting data via satellite.',
    icon: '◎',
  },
  {
    title: 'What is INCOIS?',
    content: 'INCOIS (Indian National Centre for Ocean Information Services) is an autonomous body under the Ministry of Earth Sciences that provides ocean information and advisory services to the nation.',
    icon: '🏛',
  },
  {
    title: 'What is a Glider?',
    content: 'Ocean gliders are autonomous underwater vehicles that move through the water column by changing their buoyancy. They can collect data for months, traveling thousands of kilometers.',
    icon: '▤',
  },
];

export function OutreachPage() {
  const navigate = useNavigate();
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>Explore India's Ocean</h1>
          <p className={styles.heroSub}>Learn about the Indian Ocean through interactive experiences — no scientific training required.</p>
          <button className={styles.enterBtn} onClick={() => navigate('/explorer')}>
            Start Exploring →
          </button>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatVal}>70%</span>
            <span className={styles.heroStatLabel}>of Earth is ocean</span>
          </div>
          <div className={styles.heroStat}>
            <span className={styles.heroStatVal}>3</span>
            <span className={styles.heroStatLabel}>major Indian Ocean basins</span>
          </div>
          <div className={styles.heroStat}>
            <span className={styles.heroStatVal}>4,000+</span>
            <span className={styles.heroStatLabel}>Argo floats worldwide</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Interactive Experiences</h2>
        <div className={styles.expGrid}>
          {EXPERIENCES.map((exp) => (
            <div key={exp.id} className={styles.expCard} style={{ '--accent': exp.color } as React.CSSProperties}>
              <div className={styles.expIcon} style={{ background: `${exp.color}25`, color: exp.color }}>{exp.icon}</div>
              <h3 className={styles.expTitle}>{exp.title}</h3>
              <p className={styles.expDesc}>{exp.desc}</p>
              <div className={styles.expTags}>
                {exp.tags.map((t) => <span key={t} className={styles.expTag}>{t}</span>)}
              </div>
              <button className={styles.expBtn} style={{ borderColor: exp.color, color: exp.color }}>Explore</button>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Learn</h2>
        <div className={styles.learnGrid}>
          {KNOWLEDGE_CARDS.map((card) => (
            <div key={card.title} className={styles.learnCard}>
              <div className={styles.learnIcon}>{card.icon}</div>
              <h3 className={styles.learnTitle}>{card.title}</h3>
              <p className={styles.learnContent}>{card.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}