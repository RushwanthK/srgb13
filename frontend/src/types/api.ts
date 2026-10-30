// Mirrors backend/app/schemas.py. Datetimes are UTC ISO strings; dates are YYYY-MM-DD.

export type Scope = "decision" | "delivery";
export type RowStatus = "ok" | "missing_forecast" | "missing_actual" | "missing_both";

export interface ScopeInfo {
  scope: Scope;
  label: string;
  description: string;
  decision_from: string;
  decision_to: string;
  delivery_from: string;
  delivery_to: string;
  cutoff: string;
  timezone: string;
}

export interface Kpis {
  n_expected: number;
  n_matched: number;
  n_missing_forecast: number;
  n_missing_actual: number;
  coverage_pct: number | null;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
  mape_pct: number | null;
  mape_excluded: number;
  wape_pct: number | null;
  p10_error_mw: number | null;
  p90_error_mw: number | null;
  p90_abs_error_mw: number | null;
  max_abs_error_mw: number | null;
  mean_actual_mw: number | null;
}

export interface MetaResponse {
  scope: ScopeInfo;
  delivery_days: string[];
  default_cutoff: string;
  data_sources: string[];
  assumptions: string[];
}

export interface SeriesPoint {
  start_time: string;
  forecast_mw: number | null;
  actual_mw: number | null;
}

export interface DailyPoint {
  delivery_day: string;
  n_matched: number;
  mean_forecast_mw: number | null;
  mean_actual_mw: number | null;
  mae_mw: number | null;
  bias_mw: number | null;
  wape_pct: number | null;
}

export interface OverviewResponse {
  scope: ScopeInfo;
  kpis: Kpis;
  series: SeriesPoint[];
  daily: DailyPoint[];
}

export interface ComparisonRow {
  start_time: string;
  delivery_day: string;
  cutoff_time: string;
  publish_time: string | null;
  forecast_mw: number | null;
  actual_mw: number | null;
  error_mw: number | null;
  abs_error_mw: number | null;
  pct_error: number | null;
  horizon_hours: number | null;
  status: RowStatus;
  band_low_mw?: number | null;
  band_high_mw?: number | null;
}

export interface ForecastsResponse {
  scope: ScopeInfo;
  date: string | null;
  cutoff_time: string | null;
  runs_used: string[];
  kpis: Kpis;
  rows: ComparisonRow[];
  band_coverage_pct: number | null;
  band_hours_evaluated: number;
  band_min_history_days: number;
}

export interface EvolutionRun {
  publish_time: string;
  forecast_mw: number;
  horizon_hours: number;
  is_selected: boolean;
  after_cutoff: boolean;
}

export interface EvolutionResponse {
  start_time: string;
  cutoff: string;
  cutoff_time: string;
  selected_publish_time: string | null;
  selected_forecast_mw: number | null;
  actual_mw: number | null;
  runs: EvolutionRun[];
}

export interface HourStat {
  hour: number;
  n: number;
  mae_mw: number | null;
  bias_mw: number | null;
  p10_error_mw: number | null;
  p90_error_mw: number | null;
}

export interface HistogramBin {
  bin_start_mw: number;
  bin_end_mw: number;
  count: number;
}

export interface QualityReport {
  raw_rows: number;
  non_wind_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  valid_rows: number;
}

export interface DataQuality {
  actuals: QualityReport;
  forecasts: QualityReport;
  expected_hours: number;
  matched_hours: number;
  missing_forecast_hours: number;
  missing_actual_hours: number;
  mape_excluded_hours: number;
}

export interface AccuracyResponse {
  scope: ScopeInfo;
  kpis: Kpis;
  by_hour: HourStat[];
  daily: DailyPoint[];
  histogram: HistogramBin[];
  quality: DataQuality;
}
