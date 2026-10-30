// One palette for every chart so "forecast" and "actual" always look the same.
// Values are CSS variables (defined in index.css) so charts follow light/dark mode.
export const COLORS = {
  forecast: "var(--chart-forecast)",
  actual: "var(--chart-actual)",
  band: "var(--chart-band)",
  over: "var(--chart-over)", // over-forecast (shortfall risk)
  under: "var(--chart-under)", // under-forecast
  muted: "var(--chart-muted)",
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
  cutoff: "var(--chart-cutoff)",
  cursor: "var(--chart-cursor)",
  surface: "var(--color-surface)",
} as const;

export const AXIS_TICK = { fontSize: 11, fill: COLORS.axis } as const;
export const AXIS_LABEL = { fontSize: 11, fill: COLORS.axis } as const;
