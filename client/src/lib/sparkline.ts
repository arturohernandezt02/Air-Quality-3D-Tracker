export interface SparklineSegment {
  line: string;
  area: string;
}

export interface SparklineGeometry {
  segments: SparklineSegment[];
  points: { x: number; y: number; value: number; index: number }[];
  min: number | null;
  max: number | null;
  pointCount: number;
  width: number;
  height: number;
}

/**
 * Builds SVG paths for a sparkline. Missing values split the line into
 * separate segments instead of being drawn as zeroes.
 */
export function buildSparkline(
  values: (number | null)[],
  width = 280,
  height = 56,
  padding = 4,
): SparklineGeometry {
  const valid = values.flatMap((value, index) =>
    value === null ? [] : [{ index, value }],
  );

  if (valid.length === 0) {
    return {
      segments: [],
      points: [],
      min: null,
      max: null,
      pointCount: 0,
      width,
      height,
    };
  }

  const min = Math.min(...valid.map((point) => point.value));
  const max = Math.max(...valid.map((point) => point.value));
  const range = max - min || 1;
  const innerWidth = Math.max(width - padding * 2, 1);
  const innerHeight = Math.max(height - padding * 2, 1);
  const baseline = height - padding;

  const xFor = (index: number): number =>
    values.length === 1
      ? width / 2
      : padding + (index / (values.length - 1)) * innerWidth;
  const yFor = (value: number): number =>
    padding + innerHeight - ((value - min) / range) * innerHeight;

  const segments: SparklineSegment[] = [];
  let current: { x: number; y: number; index: number }[] = [];

  const flush = () => {
    if (current.length === 0) {
      return;
    }

    const line = current
      .map(
        (point, position) =>
          `${position === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`,
      )
      .join(" ");
    const first = current[0];
    const last = current[current.length - 1];
    const area =
      current.length > 1
        ? `${line} L${last.x.toFixed(2)},${baseline.toFixed(2)} L${first.x.toFixed(2)},${baseline.toFixed(2)} Z`
        : "";

    segments.push({ line, area });
    current = [];
  };

  let previousIndex: number | null = null;
  for (const point of valid) {
    if (previousIndex !== null && point.index !== previousIndex + 1) {
      flush();
    }

    current.push({
      index: point.index,
      x: xFor(point.index),
      y: yFor(point.value),
    });
    previousIndex = point.index;
  }
  flush();

  return {
    segments,
    points: valid.map((point) => ({
      index: point.index,
      x: xFor(point.index),
      y: yFor(point.value),
      value: point.value,
    })),
    min,
    max,
    pointCount: valid.length,
    width,
    height,
  };
}
