import React, { useState } from 'react';
import { useOceanStore } from '@/stores/oceanStore';

interface ScienceStory {
  id: string;
  title: string;
  subtitle: string;
  region: string;
  variable: string;
  depth: number;
  vizMode: 'surface' | 'depth_slice' | '3d_volume' | 'isosurface' | 'vectors' | 'particles';
  description: string;
  keyFact: string;
}

const STORIES: ScienceStory[] = [
  {
    id: 'somali_upwelling',
    title: '1. Somali Upwelling & Monsoon Currents',
    subtitle: 'Arabian Sea · Summer Monsoon Dynamic',
    region: 'arabian_sea',
    variable: 'temperature',
    depth: 0,
    vizMode: 'particles',
    description:
      'During the Southwest Monsoon (June–September), intense south-westerly winds drive the Findlater Jet, pulling cold, nutrient-rich deep ocean water to the surface off the Horn of Africa and Oman.',
    keyFact: 'Sea surface temperature drops by up to 5°C along the upwelling zone, boosting biological productivity.',
  },
  {
    id: 'bob_salinity',
    title: '2. Bay of Bengal Freshwater Plumes',
    subtitle: 'Bay of Bengal · Salinity Gradient',
    region: 'bay_of_bengal',
    variable: 'salinity',
    depth: 0,
    vizMode: 'surface',
    description:
      'Massive river discharge from the Ganges, Brahmaputra, and Irrawaddy rivers floods into the northern Bay of Bengal, creating a fresh, low-density surface layer that caps deep ocean heat.',
    keyFact: 'Low-salinity surface waters trap solar heat in the upper 20m, fueling rapid cyclone intensification.',
  },
  {
    id: 'iod_thermocline',
    title: '3. Indian Ocean Dipole (IOD)',
    subtitle: 'Equatorial Indian Ocean · 50m Thermocline',
    region: 'equatorial_io',
    variable: 'temperature',
    depth: 50,
    vizMode: 'depth_slice',
    description:
      'The Indian Ocean Dipole (IOD) features sea surface temperature differences between the western and eastern equatorial Indian Ocean, modulating rainfall patterns across India and Australia.',
    keyFact: 'Positive IOD events trigger enhanced monsoon rainfall across India while causing severe droughts in Indonesia.',
  },
  {
    id: 'incois_network',
    title: '4. INCOIS Observation Network',
    subtitle: 'Global Indian Ocean · Autonomous Fleet',
    region: 'global',
    variable: 'currents',
    depth: 0,
    vizMode: 'vectors',
    description:
      "INCOIS operates India's continuous ocean observing network comprising over 300 Argo floats, underwater Gliders, OMNI deep-sea moorings, HF-Radars, and coastal tide gauges.",
    keyFact: 'Real-time telemetry feeds directly into INCOIS ROMS model data assimilation pipelines.',
  },
];

export const OutreachStoryMode: React.FC = () => {
  const [activeStoryIdx, setActiveStoryIdx] = useState<number | null>(null);
  const setCurrentRegion = useOceanStore((s) => s.setCurrentRegion);
  const setVariable = useOceanStore((s) => s.setVariable);
  const setDepth = useOceanStore((s) => s.setDepth);
  const setVizMode = useOceanStore((s) => s.setVizMode);

  const applyStory = (idx: number) => {
    setActiveStoryIdx(idx);
    const story = STORIES[idx];
    setCurrentRegion(story.region);
    setVariable(story.variable);
    setDepth(story.depth);
    setVizMode(story.vizMode);
  };

  const handleNext = () => {
    const nextIdx = activeStoryIdx === null ? 0 : (activeStoryIdx + 1) % STORIES.length;
    applyStory(nextIdx);
  };

  const handlePrev = () => {
    const prevIdx = activeStoryIdx === null || activeStoryIdx === 0 ? STORIES.length - 1 : activeStoryIdx - 1;
    applyStory(prevIdx);
  };

  if (activeStoryIdx === null) {
    return (
      <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
        <button
          onClick={() => applyStory(0)}
          style={{
            padding: '8px 14px',
            borderRadius: '20px',
            border: '1px solid #00e5ff',
            backgroundColor: 'rgba(10, 25, 47, 0.85)',
            backdropFilter: 'blur(8px)',
            color: '#00e5ff',
            fontWeight: 'bold',
            fontSize: '12px',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0, 229, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>🎓</span> Guided Science Stories
        </button>
      </div>
    );
  }

  const currentStory = STORIES[activeStoryIdx];

  return (
    <div
      style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: 'min(90vw, 540px)',
        backgroundColor: 'rgba(10, 25, 47, 0.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #00e5ff',
        borderRadius: '12px',
        padding: '16px 20px',
        color: '#ffffff',
        boxShadow: '0 8px 32px rgba(0, 229, 255, 0.35)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64ffda', letterSpacing: '1px', fontWeight: 'bold' }}>
          {currentStory.subtitle}
        </div>
        <button
          onClick={() => setActiveStoryIdx(null)}
          style={{ background: 'none', border: 'none', color: '#8892b0', fontSize: '16px', cursor: 'pointer' }}
          title="Exit Story Mode"
        >
          ✕
        </button>
      </div>

      <h4 style={{ margin: '0 0 6px 0', color: '#00e5ff', fontSize: '16px' }}>{currentStory.title}</h4>

      <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#ccd6f6', lineHeight: '1.45' }}>
        {currentStory.description}
      </p>

      <div
        style={{
          backgroundColor: 'rgba(0, 229, 255, 0.08)',
          borderLeft: '3px solid #00e5ff',
          padding: '6px 10px',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#e6f1ff',
          marginBottom: '12px',
        }}
      >
        💡 <strong>Key Oceanographic Finding:</strong> {currentStory.keyFact}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {STORIES.map((_, i) => (
            <div
              key={i}
              onClick={() => applyStory(i)}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: i === activeStoryIdx ? '#00e5ff' : '#233554',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handlePrev}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #233554',
              backgroundColor: '#112240',
              color: '#8892b0',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            ◄ Prev
          </button>
          <button
            onClick={handleNext}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#00e5ff',
              color: '#0a192f',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 229, 255, 0.4)',
            }}
          >
            Next Story ►
          </button>
        </div>
      </div>
    </div>
  );
};
