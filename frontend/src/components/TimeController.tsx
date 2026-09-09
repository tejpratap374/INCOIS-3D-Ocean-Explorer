import { useOceanStore } from '@/stores/oceanStore';

export function TimeController() {
  const {
    currentTime,
    availableTimes,
    setCurrentTime,
    isPlaying,
    setPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    rangeStart,
    rangeEnd,
    setRangeStart,
    setRangeEnd,
    vizMode,
    setVizMode,
  } = useOceanStore();

  const handleTimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentTime(e.target.value);
    setVizMode('surface' as any);
  };

  const playPause = () => setPlaying(!isPlaying);
  const speedChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setPlaybackSpeed(Number(e.target.value));

  return (
    <div className="time-controller">
      <label>Time:</label>
      <select
        value={currentTime}
        onChange={handleTimeChange}
        disabled={!availableTimes.length}
      >
        {availableTimes.map((t) => (
          <option key={t} value={t}>
            {new Date(t).toLocaleTimeString()}
          </option>
        ))}
      </select>
      <label>
        {' '}
        {isPlaying ? '⏸️ Pause' : '▶️ Play'}
        <input
          type="checkbox"
          checked={isPlaying}
          onChange={playPause}
          style={{ marginLeft: '0.5rem' }}
        />
      </label>
      <span>Speed: {' '}
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.5"
          value={playbackSpeed}
          onChange={speedChange}
          style={{ width: '120px' }}
        />
      </span>
      <div style={{ fontSize: '0.75rem', marginLeft: '1rem' }}>
        {rangeStart && rangeEnd && (
          `${new Date(rangeStart).toLocaleTimeString()} – ${new Date(rangeEnd).toLocaleTimeString()}`
        )}
      </div>
    </div>
  );
}