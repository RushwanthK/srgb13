import { ShieldCheck } from "lucide-react";
import { DailyTrendChart } from "../components/charts/DailyTrendChart";
import { ErrorByHourChart } from "../components/charts/ErrorByHourChart";
import { ErrorHistogram } from "../components/charts/ErrorHistogram";
import { Card } from "../components/common/Card";
import { KpiCard, KpiGrid } from "../components/common/KpiCard";
import { MetricDefinitions } from "../components/common/MetricDefinitions";
import { QueryState } from "../components/common/States";
import { ComparisonTable } from "../components/tables/ComparisonTable";
import { useAccuracy, useMeta, usePeriodForecasts } from "../hooks/queries";
import { useFilters } from "../hooks/useFilters";
import type { DataQuality } from "../types/api";
import { fmtMW, fmtNum, fmtPct, fmtSignedMW } from "../utils/format";

function QualityTable({ q }: { q: DataQuality }) {
  const rows: [string, number, number][] = [
    ["Raw records received", q.actuals.raw_rows, q.forecasts.raw_rows],
    ["Non-WIND records removed", q.actuals.non_wind_rows, q.forecasts.non_wind_rows],
    ["Invalid records removed (bad time / null / negative)", q.actuals.invalid_rows, q.forecasts.invalid_rows],
    ["Duplicates removed", q.actuals.duplicate_rows, q.forecasts.duplicate_rows],
    ["Valid records used", q.actuals.valid_rows, q.forecasts.valid_rows],
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="pb-2 font-medium">Ingestion (whole fetch window)</th>
            <th className="pb-2 text-right font-medium">FUELHH</th>
            <th className="pb-2 text-right font-medium">WINDFOR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(([label, a, f]) => (
            <tr key={label}>
              <td className="py-1.5 text-ink-2">{label}</td>
              <td className="py-1.5 text-right tabular-nums">{fmtNum(a)}</td>
              <td className="py-1.5 text-right tabular-nums">{fmtNum(f)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {[
          ["Expected delivery hours", q.expected_hours],
          ["Matched (forecast + actual)", q.matched_hours],
          ["Missing as-of forecast", q.missing_forecast_hours],
          ["Missing actual", q.missing_actual_hours],
          ["Excluded from MAPE (actual = 0)", q.mape_excluded_hours],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg bg-subtle px-3 py-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums text-ink">{fmtNum(value as number)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function AccuracyPage() {
  const { filters } = useFilters();
  const query = useAccuracy(filters);
  const period = usePeriodForecasts(filters);
  const meta = useMeta(filters);

  return (
    <QueryState query={query}>
      {(data) => {
        const k = data.kpis;
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-semibold text-ink">Forecast accuracy analysis</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted">
                Quantified error of the forecast available at the decision cutoff, computed over {k.n_matched} matched delivery hours. Metrics use only
                hours with both a forecast and an actual; nothing is interpolated.
              </p>
            </div>

            <KpiGrid>
              <KpiCard label="MAE" value={fmtMW(k.mae_mw)} hint="Lower is better" />
              <KpiCard label="RMSE" value={fmtMW(k.rmse_mw)} hint="Lower is better" />
              <KpiCard label="Bias" value={fmtSignedMW(k.bias_mw)} hint="> 0 over-forecast · < 0 under-forecast" tone={k.bias_mw !== null && Math.abs(k.bias_mw) > 500 ? "bad" : "neutral"} />
              <KpiCard label="MAPE" value={fmtPct(k.mape_pct)} hint={`${k.mape_excluded} zero-actual hours excluded`} />
              <KpiCard label="WAPE" value={fmtPct(k.wape_pct)} hint="Preferred % metric" />
              <KpiCard label="P90 shortfall" value={fmtMW(k.p90_error_mw)} hint="Exceeded in only 1 in 10 hours" tone="warn" />
            </KpiGrid>

            <MetricDefinitions />

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Error by hour of day" subtitle="UK local hour · when is the forecast least reliable?">
                <ErrorByHourChart data={data.by_hour} />
              </Card>
              <Card title="Error distribution" subtitle="Signed hourly error (forecast − actual), 500 MW bins">
                <ErrorHistogram data={data.histogram} />
              </Card>
            </div>

            <Card title="Daily accuracy trend" subtitle="One bar per delivery day">
              <DailyTrendChart data={data.daily} />
            </Card>

            <Card
              title={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-good" aria-hidden /> Data quality and coverage</span>}
              subtitle="Validation applied before analysis: invalid values are dropped, never zero-filled."
            >
              <QualityTable q={data.quality} />
              {meta.data && (
                <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted">
                  {meta.data.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="All delivery hours" subtitle="Sortable · export includes every row in the current filter">
              <QueryState query={period}>
                {(p) => (
                  <ComparisonTable
                    rows={p.rows}
                    pageSize={48}
                    csvFilename={`gridbrick_${filters.scope}_${filters.from ?? p.scope.delivery_from}_${filters.to ?? p.scope.delivery_to}_cutoff${filters.cutoff.replace(":", "")}.csv`}
                  />
                )}
              </QueryState>
            </Card>
          </div>
        );
      }}
    </QueryState>
  );
}
