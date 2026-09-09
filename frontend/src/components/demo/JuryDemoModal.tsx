import { useEffect } from 'react';
import { useJuryDemoStore, JURY_STEPS } from '@/stores/juryDemoStore';
import { useOceanStore } from '@/stores/oceanStore';
import styles from './JuryDemoModal.module.css';

export function JuryDemoModal() {
  const isOpen = useJuryDemoStore((s) => s.isOpen);
  const setOpen = useJuryDemoStore((s) => s.setOpen);
  const currentStepIndex = useJuryDemoStore((s) => s.currentStepIndex);
  const isPlaying = useJuryDemoStore((s) => s.isPlaying);
  const setPlaying = useJuryDemoStore((s) => s.setPlaying);
  const secondsInStep = useJuryDemoStore((s) => s.secondsInStep);
  const setSecondsInStep = useJuryDemoStore((s) => s.setSecondsInStep);
  const nextStep = useJuryDemoStore((s) => s.nextStep);
  const prevStep = useJuryDemoStore((s) => s.prevStep);
  const goToStep = useJuryDemoStore((s) => s.goToStep);

  // Ocean state setters to animate the platform
  const setVariable = useOceanStore((s) => s.setVariable);
  const setDepth = useOceanStore((s) => s.setDepth);
  const setCameraPreset = useOceanStore((s) => s.setCameraPreset);
  const setShowModelLayer = useOceanStore((s) => s.setShowModelLayer);
  const setShowArgoLayer = useOceanStore((s) => s.setShowArgoLayer);
  const setShowGliderLayer = useOceanStore((s) => s.setShowGliderLayer);
  const setShowCurrents = useOceanStore((s) => s.setShowCurrents);
  const setShowParticles = useOceanStore((s) => s.setShowParticles);
  const setOceanPlaying = useOceanStore((s) => s.setPlaying);
  const setPlaybackSpeed = useOceanStore((s) => s.setPlaybackSpeed);
  const setRightPanelOpen = useOceanStore((s) => s.setRightPanelOpen);
  const setLeftPanelOpen = useOceanStore((s) => s.setLeftPanelOpen);

  const step = JURY_STEPS[currentStepIndex];

  // Trigger stage specific ocean state when currentStepIndex changes
  useEffect(() => {
    if (!isOpen) return;

    switch (currentStepIndex) {
      case 0: // Stage 1: Overview
        setVariable('temperature');
        setDepth(0);
        setCameraPreset('india');
        setShowModelLayer(true);
        setShowCurrents(false);
        setShowParticles(false);
        setOceanPlaying(false);
        setLeftPanelOpen(true);
        setRightPanelOpen(true);
        break;

      case 1: // Stage 2: Depth slicing
        setVariable('temperature');
        setDepth(200);
        setCameraPreset('perspective');
        setShowModelLayer(true);
        setLeftPanelOpen(true);
        break;

      case 2: // Stage 3: In-situ fleet
        setShowArgoLayer(true);
        setShowGliderLayer(true);
        setDepth(50);
        setCameraPreset('india');
        break;

      case 3: // Stage 4: Model vs Observation Analytics
        setVariable('temperature');
        setShowModelLayer(true);
        setShowArgoLayer(true);
        setRightPanelOpen(true);
        break;

      case 4: // Stage 5: Temporal circulation
        setShowCurrents(true);
        setShowParticles(true);
        setOceanPlaying(true);
        setPlaybackSpeed(2.0);
        setCameraPreset('india');
        break;
    }
  }, [
    isOpen,
    currentStepIndex,
    setVariable,
    setDepth,
    setCameraPreset,
    setShowModelLayer,
    setShowArgoLayer,
    setShowGliderLayer,
    setShowCurrents,
    setShowParticles,
    setOceanPlaying,
    setPlaybackSpeed,
    setRightPanelOpen,
    setLeftPanelOpen,
  ]);

  // Step countdown timer
  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    const interval = setInterval(() => {
      const { secondsInStep, currentStepIndex } = useJuryDemoStore.getState();
      const currentStepDuration = JURY_STEPS[currentStepIndex].durationSec;

      if (secondsInStep + 1 >= currentStepDuration) {
        if (currentStepIndex < JURY_STEPS.length - 1) {
          nextStep();
        } else {
          setPlaying(false);
        }
      } else {
        setSecondsInStep(secondsInStep + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, isPlaying, nextStep, setPlaying, setSecondsInStep]);

  if (!isOpen) return null;

  // Calculate total seconds elapsed
  let totalElapsedSec = 0;
  for (let i = 0; i < currentStepIndex; i++) {
    totalElapsedSec += JURY_STEPS[i].durationSec;
  }
  totalElapsedSec += secondsInStep;

  const totalDurationSec = JURY_STEPS.reduce((acc, s) => acc + s.durationSec, 0); // 180s = 3 mins
  const progressPercent = Math.min(100, (totalElapsedSec / totalDurationSec) * 100);

  const formatMinSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.badgeLive}>
              <span>●</span> SIH 2026 JURY DEMO FLOW
            </div>
            <div className={styles.titleGroup}>
              <span className={styles.mainTitle}>3-Minute Interactive Presentation Mode</span>
              <span className={styles.subTitle}>MoES · INCOIS 3D Ocean Intelligence Platform</span>
            </div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.timerBox}>
              <span>⏱</span>
              <span>{formatMinSec(totalElapsedSec)} / {formatMinSec(totalDurationSec)}</span>
            </div>
            <button className={styles.closeBtn} onClick={() => setOpen(false)} title="Exit Jury Mode">
              ✕
            </button>
          </div>
        </div>

        {/* Linear Progress Bar */}
        <div className={styles.progressBarContainer}>
          <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Content Body */}
        <div className={styles.body}>
          {/* Left Column: Stage Details & Narration */}
          <div className={styles.leftCol}>
            <div className={styles.stepBadge}>{step.badge}</div>
            <h2 className={styles.stepTitle}>{step.title}</h2>
            <div className={styles.stepSubtitle}>{step.subtitle}</div>

            <div className={styles.narrationBox}>
              <strong>🎙 Jury Speech Prompt:</strong> &ldquo;{step.narration}&rdquo;
            </div>

            <ul className={styles.bulletsList}>
              {step.bullets.map((b, i) => (
                <li key={i} className={styles.bulletItem}>
                  <span className={styles.bulletIcon}>◆</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Column: Live Metrics & Stage Navigator */}
          <div className={styles.rightCol}>
            <div className={styles.metricsCard}>
              <span className="text-label" style={{ color: 'var(--accent-primary)' }}>
                Live Architectural Metrics
              </span>
              {step.metrics.map((m, i) => (
                <div key={i} className={styles.metricRow}>
                  <span className={styles.metricLabel}>{m.label}</span>
                  <span className={styles.metricValue}>{m.value}</span>
                </div>
              ))}
            </div>

            <div className={styles.stepsTimeline}>
              {JURY_STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  className={`${styles.stepDot} ${idx === currentStepIndex ? styles.active : idx < currentStepIndex ? styles.completed : ''}`}
                  onClick={() => goToStep(idx)}
                  title={`Stage ${idx + 1}: ${s.title}`}
                >
                  {idx < currentStepIndex ? '✓' : idx + 1}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className={styles.footer}>
          <div className={styles.footerControls}>
            <button
              className={`btn btn-outline ${currentStepIndex === 0 ? 'disabled' : ''}`}
              onClick={prevStep}
              disabled={currentStepIndex === 0}
            >
              ◀ Previous Stage
            </button>
            <button
              className={styles.playToggleBtn}
              onClick={() => setPlaying(!isPlaying)}
            >
              {isPlaying ? '⏸ Pause Auto-Tour' : '▶ Resume Auto-Tour'}
            </button>
            <button
              className={`btn btn-primary ${currentStepIndex === JURY_STEPS.length - 1 ? 'disabled' : ''}`}
              onClick={nextStep}
              disabled={currentStepIndex === JURY_STEPS.length - 1}
            >
              Next Stage ▶
            </button>
          </div>

          <div className={styles.actionHint}>
            <span>Tip: The 3D scene & parameters automatically configure for each stage</span>
          </div>
        </div>
      </div>
    </div>
  );
}
