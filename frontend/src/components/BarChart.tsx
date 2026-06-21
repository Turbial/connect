/** Minimal inline SVG horizontal bar chart — no charting library dependency,
 * just enough to compare a handful of bars at a glance. */
export function BarChart({
  bars,
  width = 320,
  barHeight = 18,
  gap = 6,
}: {
  bars: { label: string; value: number }[];
  width?: number;
  barHeight?: number;
  gap?: number;
}) {
  if (bars.length === 0) return null;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const labelWidth = 90;
  const chartWidth = width - labelWidth;
  const height = bars.length * (barHeight + gap);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {bars.map((b, i) => {
        const y = i * (barHeight + gap);
        const barW = Math.max(1, (b.value / max) * chartWidth);
        return (
          <g key={i}>
            <text x={0} y={y + barHeight - 4} fontSize={11} fill="currentColor">{b.label}</text>
            <rect x={labelWidth} y={y} width={barW} height={barHeight} fill="#4a7dff" />
            <text x={labelWidth + barW + 4} y={y + barHeight - 4} fontSize={11} fill="currentColor">{b.value}</text>
          </g>
        );
      })}
    </svg>
  );
}
