export interface ChartGeometry {
  left: number;
  right: number;
  top: number;
  bottom: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  plotWidth: number;
  plotHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface ChartMargins {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function computeChartGeometry(
  canvas: HTMLCanvasElement,
  customMargins?: Partial<ChartMargins>
): ChartGeometry {
  const pw = canvas.offsetWidth;
  const ph = canvas.offsetHeight;

  const style = getComputedStyle(canvas);
  const defaultMargins: ChartMargins = {
    left: parseFloat(style.getPropertyValue('--chart-margin-left')) || 48,
    right: parseFloat(style.getPropertyValue('--chart-margin-right')) || 16,
    top: parseFloat(style.getPropertyValue('--chart-margin-top')) || 12,
    bottom: parseFloat(style.getPropertyValue('--chart-margin-bottom')) || 36,
  };

  const margins: ChartMargins = {
    ...defaultMargins,
    ...customMargins,
  };

  return {
    left: margins.left,
    right: margins.right,
    top: margins.top,
    bottom: margins.bottom,
    plotLeft: margins.left,
    plotRight: pw - margins.right,
    plotTop: margins.top,
    plotBottom: ph - margins.bottom,
    plotWidth: pw - margins.left - margins.right,
    plotHeight: ph - margins.top - margins.bottom,
    canvasWidth: pw,
    canvasHeight: ph,
  };
}

export function mapValueToX(
  value: number,
  min: number,
  max: number,
  geometry: ChartGeometry
): number {
  const range = max - min || 1;
  return geometry.plotLeft + ((value - min) / range) * geometry.plotWidth;
}

export function mapValueToY(
  value: number,
  min: number,
  max: number,
  geometry: ChartGeometry
): number {
  const range = max - min || 1;
  return geometry.plotTop + ((max - value) / range) * geometry.plotHeight;
}

export function mapTimeToX(
  time: number,
  minTime: number,
  maxTime: number,
  geometry: ChartGeometry
): number {
  const range = maxTime - minTime || 1;
  return geometry.plotLeft + ((time - minTime) / range) * geometry.plotWidth;
}

export function mapDepthToY(
  depth: number,
  minDepth: number,
  maxDepth: number,
  geometry: ChartGeometry
): number {
  const range = maxDepth - minDepth || 1;
  return geometry.plotTop + ((depth - minDepth) / range) * geometry.plotHeight;
}