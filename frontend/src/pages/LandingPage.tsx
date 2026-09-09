import { useNavigate } from 'react-router-dom';
import { OceanScene } from '@/features/ocean/OceanScene';
import styles from './LandingPage.module.css';

const features = [
  { num: '01', title: '3D Ocean Visualization', desc: 'Explore ocean conditions across space, depth and time.' },
  { num: '02', title: 'Live Observations', desc: 'View Argo floats, gliders and in-situ observations.' },
  { num: '03', title: 'Model vs Observation', desc: 'Compare model outputs with observational data.' },
  { num: '04', title: 'Public Outreach', desc: 'Understand ocean science through interactive visualization.' },
];

const exploreAreas = [
  { title: 'SPACE', desc: 'Explore ocean regions interactively.' },
  { title: 'DEPTH', desc: 'Inspect ocean conditions across depth.' },
  { title: 'TIME', desc: 'Move through available model and observation times.' },
  { title: 'VARIABLES', desc: 'Temperature • Salinity • Current Speed • Chlorophyll' },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          <h1 className={styles.title}>
            <span className={styles.titleMain}>INCOIS</span>
            <span className={styles.titleSub}>OCEAN EXPLORER</span>
          </h1>
          <p className={styles.tagline}>3D Ocean Intelligence & Visualization Platform</p>
          <p className={styles.desc}>
            Explore India's ocean across space, depth, and time — combining numerical model outputs,
            Argo profiling floats, and glider observations in an interactive 3D environment.
          </p>
          <button className={styles.enterBtn} onClick={() => navigate('/explorer')}>
            <span>Enter Ocean Explorer</span>
            <span className={styles.arrow}>→</span>
          </button>
          <div className={styles.actions}>
            <button className={styles.actionLink} onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button className={styles.actionLink} onClick={() => navigate('/analysis')}>Analysis</button>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.oceanPreview}>
            <OceanScene />
          </div>
        </div>
      </div>

      <div className={styles.features}>
        {features.map((f) => (
          <div key={f.title} className={styles.featureCard}>
            <div className={styles.featureNum}>{f.num}</div>
            <h3 className={styles.featureTitle}>{f.title}</h3>
            <p className={styles.featureDesc}>{f.desc}</p>
          </div>
        ))}
      </div>

      <div className={styles.exploreSection}>
        <h2 className={styles.exploreTitle}>WHAT YOU CAN EXPLORE</h2>
        <div className={styles.exploreGrid}>
          {exploreAreas.map((a) => (
            <div key={a.title} className={styles.exploreCard}>
              <div className={styles.exploreCardTitle}>{a.title}</div>
              <p className={styles.exploreCardDesc}>{a.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>READY TO EXPLORE THE OCEAN?</h2>
        <p className={styles.ctaDesc}>
          Navigate through ocean data in an interactive 3D environment.
        </p>
        <button className={styles.enterBtn} onClick={() => navigate('/explorer')}>
          <span>Launch Ocean Explorer</span>
          <span className={styles.arrow}>→</span>
        </button>
      </div>

      <div className={styles.footer}>
        <span className={styles.footerBrand}>INCOIS OCEAN EXPLORER</span>
        <span className={styles.footerNote}>Ministry of Earth Sciences · Government of India</span>
      </div>
    </div>
  );
}