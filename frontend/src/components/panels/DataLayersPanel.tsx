import { useState } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { datasetsApi } from '@/services/api';
import { normalizeISO } from '@/utils/timeSteps';
import styles from './DataLayersPanel.module.css';

export function DataLayersPanel() {
  const [activeTab, setActiveTab] = useState<'layers' | 'datasets' | 'presets'>('layers');
  const [obsExpanded, setObsExpanded] = useState(true);

  // Store bindings
  const dataset = useOceanStore((s) => s.dataset);
  const setDataset = useOceanStore((s) => s.setDataset);
  const setAvailableTimes = useOceanStore((s) => s.setAvailableTimes);
  const setCurrentTime = useOceanStore((s) => s.setCurrentTime);

  const variable = useOceanStore((s) => s.variable);
  const setVariable = useOceanStore((s) => s.setVariable);

  const showModel = useOceanStore((s) => s.showModelLayer);
  const setShowModel = useOceanStore((s) => s.setShowModelLayer);

  const showArgo = useOceanStore((s) => s.showArgoLayer);
  const setShowArgo = useOceanStore((s) => s.setShowArgoLayer);

  const showGliders = useOceanStore((s) => s.showGliderLayer);
  const setShowGliders = useOceanStore((s) => s.setShowGliderLayer);

  const showCoastline = useOceanStore((s) => s.showCoastline);
  const setShowCoastline = useOceanStore((s) => s.setShowCoastline);

  const showLand = useOceanStore((s) => s.showLandMasses);
  const setShowLand = useOceanStore((s) => s.setShowLandMasses);

  const showAtmosphere = useOceanStore((s) => s.showAtmosphere);
  const setShowAtmosphere = useOceanStore((s) => s.setShowAtmosphere);

  const showHFRadar = useOceanStore((s) => s.showHFRadar);
  const setShowHFRadar = useOceanStore((s) => s.setShowHFRadar);

  const showADCP = useOceanStore((s) => s.showADCP);
  const setShowADCP = useOceanStore((s) => s.setShowADCP);

  const [showMoorings, setShowMoorings] = useState(false);
  const [showBoundaries, setShowBoundaries] = useState(true);

  const handleDatasetChange = async (newId: string) => {
    setDataset(newId);
    try {
      const res = await datasetsApi.times(newId);
      if (Array.isArray(res?.times) && res.times.length > 0) {
        const normalized = res.times.map(normalizeISO);
        setAvailableTimes(normalized);
        setCurrentTime(normalized[0]);
      } else {
        setAvailableTimes([]);
      }
    } catch {
      setAvailableTimes([]);
    }
  };

  const variablesList = [
    {
      id: 'temperature',
      name: 'Sea Surface Temperature (°C)',
      gradient: 'linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)',
    },
    {
      id: 'salinity',
      name: 'Salinity (PSU)',
      gradient: 'linear-gradient(to right, #001133, #0044cc, #0099ff, #66ccff)',
    },
    {
      id: 'currents',
      name: 'Currents (m/s)',
      gradient: 'linear-gradient(to right, #112233, #336699, #66aacc, #99ddff)',
      isCurrents: true,
    },
    {
      id: 'chl',
      name: 'Chlorophyll (mg/m³)',
      gradient: 'linear-gradient(to right, #003300, #009933, #33cc66, #99ff99)',
    },
    {
      id: 'ssh',
      name: 'Sea Surface Height (m)',
      gradient: 'linear-gradient(to right, #000080, #0080ff, #00ffff, #ffff00, #ff0000)',
    },
  ];

  return (
    <aside className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <span className={styles.headerIcon}>🥞</span>
          <span className={styles.headerTitle}>Data & Layers</span>
        </div>
        <button className={styles.expandBtn} title="Expand options">⛶</button>
      </div>

      {/* Segmented Tabs */}
      <div className={styles.tabsRow}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'layers' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('layers')}
        >
          Layers
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'datasets' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('datasets')}
        >
          Datasets
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'presets' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('presets')}
        >
          Presets
        </button>
      </div>

      {/* Panel Scroll Content */}
      <div className={styles.content}>
        {activeTab === 'layers' && (
          <>
            {/* Ocean Model Section */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitleGroup}>
                  <span className={styles.sectionIcon}>🌊</span>
                  <span className={styles.sectionTitle}>Ocean Model</span>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={showModel}
                    onChange={(e) => setShowModel(e.target.checked)}
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div className={styles.dropdownWrap}>
                <select
                  className={styles.select}
                  value={dataset}
                  onChange={(e) => handleDatasetChange(e.target.value)}
                >
                  <option value="godas_indian_ocean">GODAS Global Ocean Reanalysis (NCEP)</option>
                  <option value="incois_las_indian_ocean">INCOIS LAS - Indian Ocean</option>
                  <option value="copernicus_global_multyear_phy_001_030">Copernicus Marine Reanalysis</option>
                </select>
              </div>

              <div className={styles.subTitle}>Variables</div>

              {/* Variables Checkbox List */}
              <div className={styles.variablesList}>
                {variablesList.map((v) => {
                  const isSelected = variable === v.id;
                  return (
                    <div
                      key={v.id}
                      className={`${styles.varItem} ${isSelected ? styles.varSelected : ''}`}
                      onClick={() => setVariable(v.id)}
                    >
                      <label className={styles.checkboxLabel} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => setVariable(v.id)}
                        />
                        <span className={styles.varName}>{v.name}</span>
                      </label>
                      <div className={styles.varVisual}>
                        {v.isCurrents ? (
                          <span className={styles.currentsPattern}>+ + + + +</span>
                        ) : (
                          <div className={styles.gradientBar} style={{ background: v.gradient }} />
                        )}
                        <button className={styles.swapBtn} title="Swap / Configure">⇄</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Observations Section */}
            <div className={styles.section}>
              <div className={styles.sectionHeader} onClick={() => setObsExpanded(!obsExpanded)}>
                <div className={styles.sectionTitleGroup}>
                  <span className={styles.sectionIcon}>🔬</span>
                  <span className={styles.sectionTitle}>Observations</span>
                </div>
                <span className={styles.arrowIcon}>{obsExpanded ? '▴' : '▾'}</span>
              </div>

              {obsExpanded && (
                <div className={styles.obsList}>
                  <div className={styles.obsItem}>
                    <div className={styles.obsLabelGroup}>
                      <span className={styles.obsDotOrange}>●</span>
                      <span>Argo Floats</span>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={showArgo}
                        onChange={(e) => setShowArgo(e.target.checked)}
                      />
                      <span className={styles.slider} />
                    </label>
                  </div>

                  <div className={styles.obsItem}>
                    <div className={styles.obsLabelGroup}>
                      <span className={styles.obsDotPurple}>▲</span>
                      <span>Gliders</span>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={showGliders}
                        onChange={(e) => setShowGliders(e.target.checked)}
                      />
                      <span className={styles.slider} />
                    </label>
                  </div>

                  <div className={styles.obsItem}>
                    <div className={styles.obsLabelGroup}>
                      <span className={styles.obsDotRed}>◆</span>
                      <span>OMNI Moorings</span>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={showMoorings}
                        onChange={(e) => setShowMoorings(e.target.checked)}
                      />
                      <span className={styles.slider} />
                    </label>
                  </div>

                  <div className={styles.obsItem}>
                    <div className={styles.obsLabelGroup}>
                      <span style={{ color: '#00e676', fontWeight: 'bold' }}>📡</span>
                      <span>HF-Radar Coastal</span>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={showHFRadar}
                        onChange={(e) => setShowHFRadar(e.target.checked)}
                      />
                      <span className={styles.slider} />
                    </label>
                  </div>

                  <div className={styles.obsItem}>
                    <div className={styles.obsLabelGroup}>
                      <span style={{ color: '#00bcd4', fontWeight: 'bold' }}>⚓</span>
                      <span>ADCP Profiles</span>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={showADCP}
                        onChange={(e) => setShowADCP(e.target.checked)}
                      />
                      <span className={styles.slider} />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Environment / Map Toggles */}
            <div className={styles.section}>
              <div className={styles.obsItem}>
                <span>Boundaries</span>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={showBoundaries}
                    onChange={(e) => setShowBoundaries(e.target.checked)}
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div className={styles.obsItem}>
                <span>Coastline</span>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={showCoastline}
                    onChange={(e) => setShowCoastline(e.target.checked)}
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div className={styles.obsItem}>
                <span>Continents</span>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={showLand}
                    onChange={(e) => setShowLand(e.target.checked)}
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div className={styles.obsItem}>
                <span>Atmosphere</span>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={showAtmosphere}
                    onChange={(e) => setShowAtmosphere(e.target.checked)}
                  />
                  <span className={styles.slider} />
                </label>
              </div>
            </div>
          </>
        )}

        {activeTab === 'datasets' && (
          <div className={styles.section} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className={styles.sectionTitle} style={{ color: '#00e5ff', fontSize: '13px' }}>
              📁 Catalog of Operational Ocean Models & Reanalyses
            </div>

            {[
              {
                id: 'godas_indian_ocean',
                name: 'GODAS Global Ocean Reanalysis',
                agency: 'NOAA / NCEP',
                resolution: '1/3° x 1° · 40 Depth Levels',
                vars: ['Temperature', 'Salinity', 'Currents', 'SSH'],
              },
              {
                id: 'incois_las_indian_ocean',
                name: 'INCOIS High-Res ROMS Forecast',
                agency: 'INCOIS, India',
                resolution: '1/12° High Resolution (~9km)',
                vars: ['Temperature', 'Salinity', 'Currents', 'Chlorophyll', 'SSH'],
              },
              {
                id: 'copernicus_global_multyear_phy_001_030',
                name: 'Copernicus CMEMS Reanalysis',
                agency: 'EU Copernicus Marine Service',
                resolution: '1/12° Global 3D Grid',
                vars: ['Temperature', 'Salinity', 'Velocities'],
              },
            ].map((d) => (
              <div
                key={d.id}
                onClick={() => handleDatasetChange(d.id)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: dataset === d.id ? '2px solid #00e5ff' : '1px solid rgba(255,255,255,0.1)',
                  backgroundColor: dataset === d.id ? 'rgba(0, 229, 255, 0.12)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#ffffff' }}>{d.name}</div>
                <div style={{ fontSize: '11px', color: '#00e5ff', marginTop: '2px' }}>{d.agency} · {d.resolution}</div>
                <div style={{ fontSize: '10px', color: '#8892b0', marginTop: '6px' }}>
                  Variables: {d.vars.join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'presets' && (
          <div className={styles.section} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className={styles.sectionTitle} style={{ color: '#00e5ff', fontSize: '13px' }}>
              🎨 Oceanographic Display Presets
            </div>

            {[
              {
                title: '🌊 Monsoon Current Velocity Flow',
                desc: 'Surface currents particle streamlines in Arabian Sea',
                apply: () => {
                  useOceanStore.getState().setCurrentRegion('arabian_sea');
                  useOceanStore.getState().setVariable('currents');
                  useOceanStore.getState().setVizMode('particles');
                },
              },
              {
                title: '🌀 Bay of Bengal Salinity Plumes',
                desc: 'Low-salinity river runoff surface visualization',
                apply: () => {
                  useOceanStore.getState().setCurrentRegion('bay_of_bengal');
                  useOceanStore.getState().setVariable('salinity');
                  useOceanStore.getState().setVizMode('surface');
                },
              },
              {
                title: '🌡️ 20°C Isotherm Sub-Surface Mesh',
                desc: '3D Isosurface thermocline layer extraction',
                apply: () => {
                  useOceanStore.getState().setVariable('temperature');
                  useOceanStore.getState().setVizMode('isosurface');
                },
              },
              {
                title: '📡 Full INCOIS Observation Fleet',
                desc: 'Enables Argo Floats, Gliders, ADCP & HF-Radar',
                apply: () => {
                  useOceanStore.getState().setShowArgoLayer(true);
                  useOceanStore.getState().setShowGliderLayer(true);
                  useOceanStore.getState().setShowHFRadar(true);
                  useOceanStore.getState().setShowADCP(true);
                },
              },
            ].map((p, idx) => (
              <div
                key={idx}
                onClick={p.apply}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 229, 255, 0.2)',
                  backgroundColor: 'rgba(10, 25, 47, 0.6)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#00e5ff' }}>{p.title}</div>
                <div style={{ fontSize: '11px', color: '#8892b0', marginTop: '4px' }}>{p.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Action Button */}
      <div className={styles.footer}>
        <button className={styles.addLayerBtn}>+ Add Layer</button>
      </div>
    </aside>
  );
}
