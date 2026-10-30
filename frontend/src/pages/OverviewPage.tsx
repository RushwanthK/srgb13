import { Lightbulb } from "lucide-react";
import { ActualVsForecastChart } from "../components/charts/ActualVsForecastChart";
import { Card } from "../components/common/Card";
import { KpiCard, KpiGrid } from "../components/common/KpiCard";
import { QueryState } from "../components/common/States";
import { useOverview } from "../hooks/queries";
import { useFilters } from "../hooks/useFilters";
import type { DailyPoint, Kpis } from "../types/api";
import { fmtGW, fmtMW, fmtPct, fmtSignedMW } from "../utils/format";
import { fmtDay } from "../utils/time";

function takeaways(k: Kpis, daily: DailyPoint[]): string[] {
  const out: string[] = [];
  if (k.mae_mw !== null && k.wape_pct !== null && k.mean_actual_mw !== null) {
    out.push(
      `On a typical hour the forecast available at decision time missed actual wind by ${fmtMW(k.mae_mw)} — about ${fmtPct(k.wape_pct)} of average output (${fmtGW(k.mean_actual_mw)}).`,
    );
  }
  if (k.bias_mw !== null) {
    out.push(
      k.bias_mw > 0
        ? `Forecasts were systematically optimistic: on average ${fmtMW(k.bias_mw)} more wind was forecast than arrived. Relying on the raw forecast would have left the book short.`
        : `Forecasts were systematically pessimistic: on average ${fmtMW(Math.abs(k.bias_mw))} less wind was forecast than arrived, risking over-procurement.`,
    );
  }
  if (k.p90_error_mw !== null && k.p90_error_mw > 0) {
    out.push(
      `In 9 out of 10 hours the wind shortfall versus forecast was below ${fmtMW(k.p90_error_mw)}. Holding roughly this much extra cover would have protected against shortfall in ~90% of hours.`,
    );
  }
  const worst = daily.filter((d) => d.mae_mw !== null).sort((a, b) => (b.mae_mw ?? 0) - (a.mae_mw ?? 0))[0];
  if (worst) {
    out.push(`The hardest delivery day was ${fmtDay(worst.delivery_day)} (MAE ${fmtMW(worst.mae_mw)}, bias ${fmtSignedMW(worst.bias_mw)}). See it on the Forecast vs Actual page.`);
  }
  return out;
}

export function OverviewPage() {
  const { filters } = useFilters();
  const query = useOverview(filters);

  return (
    <QueryState query={query}>
      {(data) => {
        const k = data.kpis;
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-semibold text-ink">How reliable is the wind forecast at decision time?</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted">
                For every delivery hour we take the latest national wind forecast that had been published by the decision cutoff — exactly
                what the trading desk could have seen — and compare it with metered wind generation.
              </p>
            </div>

            <KpiGrid>
              <KpiCard
                label="Coverage"
                value={fmtPct(k.coverage_pct)}
                hint={`${k.n_matched} of ${k.n_expected} delivery hours matched`}
                tone={k.coverage_pct !== null && k.coverage_pct < 95 ? "warn" : "neutral"}
              />
              <KpiCard label="MAE" value={fmtMW(k.mae_mw)} hint="Typical hourly miss" />
              <KpiCard label="RMSE" value={fmtMW(k.rmse_mw)} hint="Penalises big misses" />
              <KpiCard
                label="Bias"
                value={fmtSignedMW(k.bias_mw)}
                hint={k.bias_mw !== null && k.bias_mw > 0 ? "Over-forecast on average" : "Under-forecast on average"}
                tone={k.bias_mw !== null && Math.abs(k.bias_mw) > 500 ? "bad" : "neutral"}
              />
              <KpiCard label="MAPE" value={fmtPct(k.mape_pct)} hint={`${k.mape_excluded} zero-actual hours excluded`} />
              <KpiCard label="WAPE" value={fmtPct(k.wape_pct)} hint="Total miss ÷ total wind" />
            </KpiGrid>

            <Card title={<span className="inline-flex items-center gap-1.5"><Lightbulb className="h-4 w-4 text-warn" aria-hidden /> What this means for procurement</span>}>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
                {takeaways(k, data.daily).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">
                Scope note: this portal quantifies wind forecast quality only. Total procurement volume also depends on demand, which is outside the
                pilot's data scope.
              </p>
            </Card>

            <Card title="Actual vs forecast wind generation" subtitle="Hourly, national level · forecast = latest run published before the cutoff">
              <ActualVsForecastChart series={data.series} />
            </Card>
          </div>
        );
      }}
    </QueryState>
  );
}
