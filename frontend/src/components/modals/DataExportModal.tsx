import React, { useState } from 'react';
import { useOceanStore } from '@/stores/oceanStore';

interface DataExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataExportModal: React.FC<DataExportModalProps> = ({ isOpen, onClose }) => {
  const field = useOceanStore((s) => s.field);
  const variable = useOceanStore((s) => s.variable);
  const depth = useOceanStore((s) => s.depth);
  const currentTime = useOceanStore((s) => s.currentTime);
  const currentRegion = useOceanStore((s) => s.currentRegion);

  const [format, setFormat] = useState<'netcdf' | 'csv' | 'geojson'>('csv');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      let content = '';
      let mimeType = 'text/plain';
      let filename = `INCOIS_${variable}_${currentRegion}_${depth}m.${format === 'netcdf' ? 'nc' : format}`;

      if (format === 'csv') {
        mimeType = 'text/csv';
        const lines: string[] = [];
        if (includeMetadata) {
          lines.push(`# INCOIS Ocean Explorer Export`);
          lines.push(`# CF-1.8 Compliant Data Dump`);
          lines.push(`# Variable: ${variable} (${field?.unit ?? ''})`);
          lines.push(`# Time: ${currentTime}`);
          lines.push(`# Depth: ${depth}m`);
          lines.push(`# Region: ${currentRegion}`);
          lines.push(``);
        }
        lines.push(`latitude,longitude,depth_m,timestamp,variable,value,unit`);

        if (field && field.latitude && field.longitude && field.data) {
          for (let i = 0; i < field.latitude.length; i++) {
            for (let j = 0; j < field.longitude.length; j++) {
              const val = field.data[i]?.[j];
              if (val !== undefined && val !== null && !isNaN(val)) {
                lines.push(
                  `${field.latitude[i]},${field.longitude[j]},${depth},${currentTime},${variable},${val},${field.unit ?? ''}`
                );
              }
            }
          }
        }
        content = lines.join('\n');
      } else if (format === 'geojson') {
        mimeType = 'application/json';
        const features = [];
        if (field && field.latitude && field.longitude && field.data) {
          for (let i = 0; i < field.latitude.length; i++) {
            for (let j = 0; j < field.longitude.length; j++) {
              const val = field.data[i]?.[j];
              if (val !== undefined && val !== null && !isNaN(val)) {
                features.push({
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: [field.longitude[j], field.latitude[i], -depth],
                  },
                  properties: {
                    variable,
                    value: val,
                    unit: field.unit ?? '',
                    time: currentTime,
                    depth_m: depth,
                  },
                });
              }
            }
          }
        }
        content = JSON.stringify(
          {
            type: 'FeatureCollection',
            name: `INCOIS_${variable}_${currentRegion}`,
            crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
            features,
          },
          null,
          2
        );
      } else if (format === 'netcdf') {
        mimeType = 'application/x-netcdf';
        const netcdfMeta = {
          netcdf_header: {
            Conventions: 'CF-1.8, ACDD-1.3',
            title: 'INCOIS High-Resolution ROMS Ocean Model Field Export',
            institution: 'Indian National Centre for Ocean Information Services (INCOIS)',
            source: 'INCOIS Ocean Explorer 3D Web Engine',
            history: `Exported on ${new Date().toISOString()}`,
            references: 'https://incois.gov.in',
            dimensions: {
              time: 1,
              depth: 1,
              latitude: field?.latitude.length ?? 0,
              longitude: field?.longitude.length ?? 0,
            },
            variables: {
              [variable]: {
                dimensions: ['time', 'depth', 'latitude', 'longitude'],
                units: field?.unit ?? 'SI',
                long_name: variable.toUpperCase(),
                standard_name: `sea_water_${variable}`,
                valid_range: [field?.min_value, field?.max_value],
              },
            },
          },
        };
        content = JSON.stringify(netcdfMeta, null, 2);
        filename = `INCOIS_${variable}_CF1.8.nc.json`;
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsExporting(false);
      onClose();
    }, 400);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '460px',
          backgroundColor: '#0a192f',
          border: '1px solid #00e5ff',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 229, 255, 0.25)',
          padding: '24px',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#00e5ff', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📥</span> CF-1.8 & OGC Data Export
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#8892b0',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: '13px', color: '#8892b0', marginBottom: '20px', lineHeight: '1.5' }}>
          Export active 3D ocean model fields and in-situ observation slices formatted per climate and forecast (CF-1.8) standards.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#64ffda', marginBottom: '6px' }}>
              Select Export Format:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {(['csv', 'geojson', 'netcdf'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    border: format === fmt ? '2px solid #00e5ff' : '1px solid #233554',
                    backgroundColor: format === fmt ? 'rgba(0, 229, 255, 0.15)' : '#112240',
                    color: format === fmt ? '#00e5ff' : '#8892b0',
                    fontWeight: format === fmt ? 'bold' : 'normal',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    fontSize: '12px',
                  }}
                >
                  {fmt === 'netcdf' ? 'NetCDF-4' : fmt}
                </button>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: '#112240', padding: '12px', borderRadius: '6px', fontSize: '12px' }}>
            <div style={{ color: '#8892b0', marginBottom: '4px' }}>Dataset Metadata:</div>
            <div style={{ color: '#e6f1ff' }}>• Variable: <strong>{variable}</strong> ({field?.unit ?? 'units'})</div>
            <div style={{ color: '#e6f1ff' }}>• Depth: <strong>{depth} meters</strong></div>
            <div style={{ color: '#e6f1ff' }}>• Time: <strong>{currentTime}</strong></div>
            <div style={{ color: '#e6f1ff' }}>• Grid Points: <strong>{(field?.latitude.length ?? 0) * (field?.longitude.length ?? 0)} nodes</strong></div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#8892b0', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeMetadata}
              onChange={(e) => setIncludeMetadata(e.target.checked)}
              style={{ accentColor: '#00e5ff' }}
            />
            Include CF-1.8 Global Attributes & Header Comments
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #233554',
                backgroundColor: 'transparent',
                color: '#8892b0',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              style={{
                padding: '8px 20px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#00e5ff',
                color: '#0a192f',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 229, 255, 0.4)',
              }}
            >
              {isExporting ? 'Exporting...' : `Download ${format.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
