export interface MooringBuoy {
  id: string;
  name: string;
  lon: number;
  lat: number;
  type: 'OMNI' | 'RAMA';
  depth: string;
  sensorTypes: string[];
}

export const MOORING_BUOYS: MooringBuoy[] = [
  { id: 'AD01', name: 'OMNI AD01', lon: 69.0, lat: 15.0, type: 'OMNI', depth: '3,200 m', sensorTypes: ['SST', 'Salinity', 'Wind Speed', 'Air Temp'] },
  { id: 'AD02', name: 'OMNI AD02', lon: 69.0, lat: 12.0, type: 'OMNI', depth: '3,400 m', sensorTypes: ['SST', 'Salinity', 'Currents'] },
  { id: 'AD06', name: 'OMNI AD06', lon: 67.5, lat: 18.5, type: 'OMNI', depth: '2,800 m', sensorTypes: ['SST', 'Salinity', 'Pressure'] },
  { id: 'BD08', name: 'OMNI BD08', lon: 89.0, lat: 18.0, type: 'OMNI', depth: '2,200 m', sensorTypes: ['SST', 'Salinity', 'Chlorophyll', 'Wind'] },
  { id: 'BD09', name: 'OMNI BD09', lon: 89.0, lat: 15.0, type: 'OMNI', depth: '2,600 m', sensorTypes: ['SST', 'Salinity', 'Wave Height'] },
  { id: 'BD10', name: 'OMNI BD10', lon: 88.0, lat: 12.0, type: 'OMNI', depth: '3,100 m', sensorTypes: ['SST', 'Salinity', 'Pressure'] },
  { id: 'BD11', name: 'OMNI BD11', lon: 84.0, lat: 13.5, type: 'OMNI', depth: '3,300 m', sensorTypes: ['SST', 'Salinity', 'Wind'] },
  { id: 'RAMA_15N', name: 'RAMA 15°N 90°E', lon: 90.0, lat: 15.0, type: 'RAMA', depth: '2,500 m', sensorTypes: ['Fluxes', 'SST', 'Salinity'] },
  { id: 'RAMA_12N', name: 'RAMA 12°N 90°E', lon: 90.0, lat: 12.0, type: 'RAMA', depth: '3,000 m', sensorTypes: ['Fluxes', 'SST', 'Subsurface Temp'] },
  { id: 'RAMA_08N', name: 'RAMA 8°N 90°E', lon: 90.0, lat: 8.0, type: 'RAMA', depth: '3,800 m', sensorTypes: ['Fluxes', 'SST', 'Salinity'] },
  { id: 'RAMA_EQ', name: 'RAMA 0°N 90°E', lon: 90.0, lat: 0.0, type: 'RAMA', depth: '4,200 m', sensorTypes: ['Equatorial Current', 'SST', 'Wind'] },
  { id: 'RAMA_SEY', name: 'RAMA 0°N 67°E', lon: 67.0, lat: 0.0, type: 'RAMA', depth: '4,400 m', sensorTypes: ['Equatorial Current', 'SST', 'Salinity'] },
];
