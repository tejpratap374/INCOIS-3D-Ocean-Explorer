import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage';
import { ExplorerPage } from '@/pages/ExplorerPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DatasetsPage } from '@/pages/DatasetsPage';
import { DepthSlicePage } from '@/pages/DepthSlicePage';
import { ObservationsPage } from '@/pages/ObservationsPage';
import { AnalysisPage } from '@/pages/AnalysisPage';
import { OutreachPage } from '@/pages/OutreachPage';
import { AdminPage } from '@/pages/AdminPage';
import { AppShell } from '@/components/layout/AppShell';
import { useEffect } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { datasetsApi, observationsApi } from '@/services/api';
import { normalizeISO } from '@/utils/timeSteps';

function Bootstrap() {
  const setAvailableTimes = useOceanStore((s) => s.setAvailableTimes);
  const setArgoFloats = useOceanStore((s) => s.setArgoFloats);
  const setGliderTracks = useOceanStore((s) => s.setGliderTracks);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const timesRes = await datasetsApi.times('godas_indian_ocean');
        if (mounted && Array.isArray(timesRes?.times) && timesRes.times.length) {
          const normalized = timesRes.times.map(normalizeISO);
          setAvailableTimes(normalized);
          // Set default currentTime to first dataset timestamp
          useOceanStore.getState().setCurrentTime(normalized[0]);
        }
        const argo = await observationsApi.getArgo({ limit: 200 });
        if (mounted && Array.isArray(argo?.floats)) setArgoFloats(argo.floats);
        const gliders = await observationsApi.getGliders({});
        if (mounted && Array.isArray(gliders?.tracks)) setGliderTracks(gliders.tracks);
      } catch (e) {
        console.error('Bootstrap load failed', e);
      }
    })();
    return () => { mounted = false; };
  }, [setAvailableTimes, setArgoFloats, setGliderTracks]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <Bootstrap />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<AppShell />}>
          <Route path="/explorer" element={<ExplorerPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/datasets" element={<DatasetsPage />} />
          <Route path="/depth-slice" element={<DepthSlicePage />} />
          <Route path="/observations" element={<ObservationsPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/outreach" element={<OutreachPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
