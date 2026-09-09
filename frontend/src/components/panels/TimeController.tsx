import { useEffect, useMemo, useRef, useState } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { generateTimeSteps, normalizeISO, TIME_STEP_INTERVALS } from '@/utils/timeSteps';
import { dataApi } from '@/services/api';
import styles from './TimeController.module.css';

const SPEED_OPTIONS = [1, 2, 4] as const;

export function TimeController() {
  const currentTime = useOceanStore((s) => s.currentTime);
  const setCurrentTime = useOceanStore((s) => s.setCurrentTime);
  const availableTimes = useOceanStore((s) => s.availableTimes);
  const isPlaying = useOceanStore((s) => s.isPlaying);
  const setPlaying = useOceanStore((s) => s.setPlaying);
  const playbackSpeed = useOceanStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useOceanStore((s) => s.setPlaybackSpeed);
  const currentRegion = useOceanStore((s) => s.currentRegion);
  const fetchWeather = useOceanStore((s) => s.fetchWeather);
  const weather = useOceanStore((s) => s.weather);
  const weatherLoading = useOceanStore((s) => s.weatherLoading);
  const weatherError = useOceanStore((s) => s.weatherError);
  const timeBarOpen = useOceanStore((s) => s.timeBarOpen);
  const setTimeBarOpen = useOceanStore((s) => s.setTimeBarOpen);
  const rangeStart = useOceanStore((s) => s.rangeStart);
  const rangeEnd = useOceanStore((s) => s.rangeEnd);
  const setRangeStart = useOceanStore((s) => s.setRangeStart);
  const setRangeEnd = useOceanStore((s) => s.setRangeEnd);
  const timeStart = useOceanStore((s) => s.timeStart);
  const timeEnd = useOceanStore((s) => s.timeEnd);
  const timeStepInterval = useOceanStore((s) => s.timeStepInterval);
  const setTimeStepInterval = useOceanStore((s) => s.setTimeStepInterval);

  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [draftRangeStart, setDraftRangeStart] = useState<string | null>(null);
  const [draftRangeEnd, setDraftRangeEnd] = useState<string | null>(null);
  const [weatherPopupOpen, setWeatherPopupOpen] = useState(false);
  const dateRangeTriggerRef = useRef<HTMLButtonElement>(null);
  const dateRangePopupRef = useRef<HTMLDivElement>(null);
  const weatherTriggerRef = useRef<HTMLButtonElement>(null);
  const weatherPopupRef = useRef<HTMLDivElement>(null);

  // Fetch weather when region changes
  useEffect(() => {
    fetchWeather(currentRegion);
  }, [currentRegion, fetchWeather]);

  // Generate fine-grained timesteps between start date and end date
  const times: string[] = useMemo(() => {
    const startIso = rangeStart || timeStart;
    const endIso = rangeEnd || timeEnd;

    if (startIso && endIso) {
      const generated = generateTimeSteps(startIso, endIso, timeStepInterval);
      if (generated && generated.length > 0) {
        return generated.map(normalizeISO);
      }
    }

    if (availableTimes.length > 0) {
      return availableTimes.map(normalizeISO);
    }

    const now = new Date();
    now.setUTCHours(12, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - (6 - i));
      return d.toISOString();
    });
  }, [availableTimes, rangeStart, rangeEnd, timeStart, timeEnd, timeStepInterval]);

  // Apply date range filter to available times for playback
  const filteredTimes: string[] = useMemo(() => {
    const start = rangeStart ? new Date(normalizeISO(rangeStart)).getTime() : -Infinity;
    const end = rangeEnd ? new Date(normalizeISO(rangeEnd)).getTime() : Infinity;
    return times.filter((t: string) => {
      const time = new Date(t).getTime();
      return time >= start && time <= end;
    });
  }, [times, rangeStart, rangeEnd]);

  // Ensure current time is within range
  const effectiveCurrentIdx = useMemo(() => {
    const targetMs = new Date(normalizeISO(currentTime)).getTime();
    const idx = filteredTimes.findIndex((t) => new Date(t).getTime() === targetMs);
    return idx >= 0 ? idx : 0;
  }, [filteredTimes, currentTime]);

  // Preload frames whenever filteredTimes or variable changes for fluid animation playback
  useEffect(() => {
    if (!filteredTimes.length) return;
    const paramsList = filteredTimes.map((t) => ({
      fieldParams: {
        dataset: useOceanStore.getState().dataset || 'godas_indian_ocean',
        variable: useOceanStore.getState().variable || 'temperature',
        time: t,
        depth: useOceanStore.getState().depth || 0,
        region: currentRegion !== 'global' ? currentRegion : undefined,
        resolution: 160,
      },
      vectorParams: {
        time: t,
        depth: useOceanStore.getState().depth || 0,
        region: currentRegion !== 'global' ? currentRegion : undefined,
        spacing: 8,
      },
    }));
    dataApi.preloadFrames(paramsList);
  }, [filteredTimes, currentRegion]);

  // Sequential playback loop through generated time-step frames
  useEffect(() => {
    if (!isPlaying || !filteredTimes.length) return;

    const intervalMs = 1500 / playbackSpeed;
    const id = setInterval(() => {
      const state = useOceanStore.getState();
      const targetMs = new Date(normalizeISO(state.currentTime)).getTime();
      const currentIdxInFiltered = filteredTimes.findIndex((t) => new Date(t).getTime() === targetMs);

      // Stop automatically when the selected end date is reached
      if (currentIdxInFiltered >= filteredTimes.length - 1) {
        setPlaying(false);
      } else {
        const next = Math.max(0, currentIdxInFiltered + 1);
        setCurrentTime(filteredTimes[next]);
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [isPlaying, filteredTimes, playbackSpeed, setCurrentTime, setPlaying]);

  const handleTogglePlay = () => {
    if (!isPlaying) {
      // If at end date, restart playback from start date
      if (effectiveCurrentIdx >= filteredTimes.length - 1) {
        setCurrentTime(filteredTimes[0]);
      }
      setPlaying(true);
    } else {
      setPlaying(false);
    }
  };

  const goto = (idx: number) => {
    if (!filteredTimes.length) return;
    const clamped = Math.max(0, Math.min(filteredTimes.length - 1, idx));
    setCurrentTime(filteredTimes[clamped]);
  };

  const gotoGlobal = (iso: string) => {
    const norm = normalizeISO(iso);
    setCurrentTime(norm);
    if (rangeStart && rangeEnd) {
      const time = new Date(norm).getTime();
      const start = new Date(normalizeISO(rangeStart)).getTime();
      const end = new Date(normalizeISO(rangeEnd)).getTime();
      if (time < start) setCurrentTime(normalizeISO(rangeStart));
      if (time > end) setCurrentTime(normalizeISO(rangeEnd));
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(normalizeISO(iso));
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }) + ' ' +
           d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  };

  const formatDateShort = (iso: string) => {
    const d = new Date(normalizeISO(iso));
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  };

  const formatDateFull = (iso: string) => {
    const d = new Date(normalizeISO(iso));
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  };

  // Date range picker handlers - use draft state
  const handleDraftRangeStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDraftRangeStart(val ? `${val}T12:00:00.000Z` : null);
  };

  const handleDraftRangeEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDraftRangeEnd(val ? `${val}T12:00:00.000Z` : null);
  };

  const handleRangeApply = () => {
    if (draftRangeStart && draftRangeEnd) {
      setRangeStart(draftRangeStart);
      setRangeEnd(draftRangeEnd);
      // Clamp current time to range
      const time = new Date(currentTime).getTime();
      const start = new Date(draftRangeStart).getTime();
      const end = new Date(draftRangeEnd).getTime();
      if (time < start) setCurrentTime(draftRangeStart);
      if (time > end) setCurrentTime(draftRangeEnd);
    }
    setDateRangeOpen(false);
  };

  const handleRangeCancel = () => {
    setDraftRangeStart(null);
    setDraftRangeEnd(null);
    setDateRangeOpen(false);
  };

  const handleOutsideClick = (event: MouseEvent) => {
    if (dateRangeTriggerRef.current && !dateRangeTriggerRef.current.contains(event.target as Node) &&
        dateRangePopupRef.current && !dateRangePopupRef.current.contains(event.target as Node)) {
      setDateRangeOpen(false);
    }
    if (weatherTriggerRef.current && !weatherTriggerRef.current.contains(event.target as Node) &&
        weatherPopupRef.current && !weatherPopupRef.current.contains(event.target as Node)) {
      setWeatherPopupOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleOutsideClick);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDateRangeOpen(false);
        setWeatherPopupOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Format date for input (YYYY-MM-DD)
  const formatDateInput = (iso: string) => {
    return iso.split('T')[0];
  };

  const parseDateInput = (val: string) => {
    if (!val) return null;
    // Input is YYYY-MM-DD, convert to ISO with noon UTC
    return `${val}T12:00:00.000Z`;
  };

  const dateRangeLabel = rangeStart && rangeEnd
    ? `${formatDateFull(rangeStart)} \u2014 ${formatDateFull(rangeEnd)}`
    : 'Select date range';

  // Weather display helpers
  const iconToEmoji = (iconCode: string) => {
    const map: Record<string, string> = {
      sunny: '☀',
      partly_cloudy: '🌤',
      cloudy: '☁',
      overcast: '☁',
      mist: '🌫',
      patchy_rain: '🌦',
      patchy_snow: '🌨',
      patchy_sleet: '🌧',
      patchy_freezing_drizzle: '🌧',
      thunder: '⛈',
      blowing_snow: '🌨',
      blizzard: '🌨',
      fog: '🌫',
      freezing_fog: '🌫',
      patchy_light_drizzle: '🌦',
      light_drizzle: '🌧',
      freezing_drizzle: '🌧',
      heavy_freezing_drizzle: '🌧',
      patchy_light_rain: '🌦',
      light_rain: '🌦',
      moderate_rain: '🌧',
      heavy_rain: '🌧',
      torrential_rain: '🌧',
      light_freezing_rain: '🌧',
      moderate_freezing_rain: '🌧',
      heavy_freezing_rain: '🌧',
      light_sleet: '🌧',
      light_snow: '🌨',
      patchy_moderate_snow: '🌨',
      moderate_snow: '🌨',
      patchy_heavy_snow: '🌨',
      heavy_snow: '🌨',
      patchy_light_snow: '🌨',
      light_sleet_showers: '🌧',
      light_rain_showers: '🌦',
      moderate_rain_showers: '🌧',
      heavy_rain_showers: '🌧',
      moderate_sleet_showers: '🌧',
      light_snow_showers: '🌨',
      moderate_snow_showers: '🌨',
      heavy_snow_showers: '🌨',
      thunder_rain: '⛈',
      thunder_snow: '⛈',
    };
    return map[iconCode] || '☁';
  };

  const getWeatherDisplay = () => {
    if (weatherLoading) {
      return { temp: '—', condition: 'Loading...', icon: '⏳' };
    }
    if (weatherError || !weather) {
      return { temp: '—', condition: 'Unavailable', icon: '☁' };
    }
    return {
      temp: `${weather.temperature_c}°C`,
      condition: weather.condition,
      icon: iconToEmoji(weather.icon),
    };
  };

  const weatherDisplay = getWeatherDisplay();

  // Initialize draft state from store
  useEffect(() => {
    setDraftRangeStart(rangeStart);
    setDraftRangeEnd(rangeEnd);
  }, [rangeStart, rangeEnd]);

  const handleCloseTimeBar = () => {
    setTimeBarOpen(false);
  };

  const handleClose = () => {
    setDateRangeOpen(false);
    setWeatherPopupOpen(false);
  };

  return (
    <div className={styles.wrap} role="region" aria-label="Time exploration">
      {/* Close button */}
      <button
        className={styles.closeBtn}
        onClick={() => setTimeBarOpen(false)}
        title="Close time controls"
        aria-label="Close time controls"
      >
        ✕
      </button>

      {/* Left playback controls */}
      <div className={styles.leftControls} aria-label="Playback controls">
        <button
          className={`${styles.playBtn} ${isPlaying ? styles.playing : ''}`}
          onClick={handleTogglePlay}
          title={isPlaying ? 'Pause' : 'Play'}
          aria-label={isPlaying ? 'Pause playback' : 'Play playback'}
          aria-pressed={isPlaying}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button className={styles.navBtn} onClick={() => goto(effectiveCurrentIdx - 1)} title="Previous" aria-label="Previous timestep">⏮</button>
        <button className={styles.navBtn} onClick={() => goto(effectiveCurrentIdx + 1)} title="Next" aria-label="Next timestep">⏭</button>

      </div>

      {/* Main timeline - flexible center */}
      <div className={styles.timeline}>
        <div className={styles.sliderWrapper}>
          <div className={styles.slider}>
            <input
              ref={useRef<HTMLInputElement>(null)}
              type="range"
              min={0}
              max={Math.max(0, filteredTimes.length - 1)}
              value={effectiveCurrentIdx}
              onChange={(e) => goto(parseInt(e.target.value))}
              aria-label="Timeline scrubber"
              className={styles.sliderInput}
            />
            <div className={styles.progressTrack} style={{ width: `${filteredTimes.length > 1 ? (effectiveCurrentIdx / (filteredTimes.length - 1)) * 100 : 0}%` }} />
          </div>
          <div className={styles.ticks}>
            {filteredTimes.map((t, i) => {
              const label = formatDateShort(t);
              const step = Math.max(1, Math.ceil(filteredTimes.length / 5));
              const visible = i % step === 0 || i === filteredTimes.length - 1;
              return visible ? (
                <span key={i} className={styles.tickLabel}>{label}</span>
              ) : null;
            })}
          </div>
        </div>
        {/* Current date/time display above thumb */}
        <div className={styles.currentTimeDisplay}>
          <span className={styles.currentTimeLabel}>{formatDateShort(filteredTimes[effectiveCurrentIdx] || currentTime)}</span>
          <span className={styles.currentTimeValue}>{formatTime(filteredTimes[effectiveCurrentIdx] || currentTime)} UTC</span>
        </div>
      </div>


      {/* Date range button with popup */}
      <div className={styles.dateRangeGroup}>
        <button
          ref={dateRangeTriggerRef}
          className={`${styles.dateRangeBtn} ${dateRangeOpen ? styles.active : ''}`}
          onClick={() => setDateRangeOpen(!dateRangeOpen)}
          aria-expanded={dateRangeOpen}
          aria-haspopup="dialog"
          type="button"
        >
          <span aria-hidden="true">📅</span>
          <span>{dateRangeLabel}</span>
        </button>
        {dateRangeOpen && (
          <div
            ref={dateRangePopupRef}
            className={styles.dateRangePopup}
            role="dialog"
            aria-label="Select date range"
          >
            <div className={styles.dateRangeContent}>
              <div className={styles.dateRangeRow}>
                <label className={styles.dateRangeLabel}>From</label>
                <input
                  type="date"
                  className={styles.dateRangeInput}
                  value={rangeStart ? formatDateInput(rangeStart) : ''}
                  onChange={(e) => setRangeStart(parseDateInput(e.target.value))}
                  min={formatDateInput(times[0])}
                  max={formatDateInput(times[times.length - 1])}
                />
              </div>
              <div className={styles.dateRangeRow}>
                <label className={styles.dateRangeLabel}>To</label>
                <input
                  type="date"
                  className={styles.dateRangeInput}
                  value={rangeEnd ? formatDateInput(rangeEnd) : ''}
                  onChange={(e) => setRangeEnd(parseDateInput(e.target.value))}
                  min={formatDateInput(times[0])}
                  max={formatDateInput(times[times.length - 1])}
                />
              </div>
              <div className={styles.dateRangeActions}>
                <button className={styles.dateRangeBtnSecondary} onClick={handleRangeCancel}>Cancel</button>
                <button className={styles.dateRangeBtnPrimary} onClick={handleRangeApply}>Apply</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Time Step Interval control */}
      <div className={styles.speedGroup} title="Step Interval">
        {TIME_STEP_INTERVALS.map((int) => (
          <button
            key={int.minutes}
            className={`${styles.speedBtn} ${timeStepInterval === int.minutes ? styles.active : ''}`}
            onClick={() => setTimeStepInterval(int.minutes)}
            title={`Step by ${int.label}`}
          >
            {int.label}
          </button>
        ))}
      </div>

      {/* Speed control */}
      <div className={styles.speedGroup} title="Playback Speed">
        {[1, 2, 4].map((s) => (
          <button
            key={s}
            className={`${styles.speedBtn} ${playbackSpeed === s ? styles.active : ''}`}
            onClick={() => setPlaybackSpeed(s)}
            aria-pressed={playbackSpeed === s}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Weather - compact card at far right */}
      <div className={styles.weatherGroup}>
        <button
          ref={weatherTriggerRef}
          className={styles.weatherCard}
          onClick={() => setWeatherPopupOpen(!weatherPopupOpen)}
          aria-expanded={weatherPopupOpen}
          aria-haspopup="dialog"
          title="Click for forecast"
          type="button"
        >
          <span className={styles.weatherIcon} aria-hidden="true">{weatherDisplay.icon}</span>
          <div className={styles.weatherText}>
            <span className={styles.weatherTemp}>{weatherDisplay.temp}</span>
            <span className={styles.weatherDesc}>{weatherDisplay.condition}</span>
          </div>
        </button>
        {weatherPopupOpen && weather && (
          <div
            ref={weatherPopupRef}
            className={styles.weatherPopup}
            role="dialog"
            aria-label="Weather forecast"
          >
            <div className={styles.weatherPopupContent}>
              <div className={styles.weatherPopupHeader}>
                <span className={styles.weatherPopupTitle}>Weather Forecast</span>
                <span className={styles.weatherPopupLocation}>{weather.location}</span>
              </div>
              <div className={styles.weatherPopupCurrent}>
                <span className={styles.weatherPopupIcon} aria-hidden="true">{weather.icon}</span>
                <div>
                  <span className={styles.weatherPopupTemp}>{weather.temperature_c}°C</span>
                  <span className={styles.weatherPopupCondition}>{weather.condition}</span>
                </div>
                <div className={styles.weatherPopupDetails}>
                  <span>Humidity: {weather.humidity}%</span>
                  <span>Wind: {weather.wind_kph} km/h {weather.wind_dir}</span>
                  <span>Feels like: {weather.feels_like_c}°C</span>
                </div>
              </div>
              <div className={styles.weatherPopupNote}>
                Source: wttr.in | Observed: {weather.observation_time} UTC
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


