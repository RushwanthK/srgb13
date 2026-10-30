import { ChevronLeft, ChevronRight, Clock, History } from "lucide-react";
import { useMemo, useState } from "react";
import { EvolutionChart } from "../components/charts/EvolutionChart";
import { ForecastBandChart } from "../components/charts/ForecastBandChart";
import { Card } from "../components/common/Card";
import { KpiCard, KpiGrid } from "../components/common/KpiCard";
import { EmptyState, ErrorState, Loading, QueryState } from "../components/common/States";
import { ComparisonTable } from "../components/tables/ComparisonTable";
import { useDayForecasts, useEvolution, useMeta } from "../hooks/queries";
import { useFilters } from "../hooks/useFilters";
import type { ComparisonRow, EvolutionResponse } from "../types/api";
import { fmtMW, fmtPct, fmtSignedMW } from "../utils/format";
import { fmtDateTime, fmtDay, fmtHours, fmtTime, londonHour } from "../utils/time";

const DEFAULT_HOUR = 17; // evening peak is the most relevant hour to inspect first

function dayStats(rows: ComparisonRow[]) {
  const withBand = rows.filter((r) => r.actual_mw !== null && r.band_low_mw != null && r.band_high_mw != null);
  const inBand = withBand.filter((r) => r.actual_mw! >= r.band_low_mw! && r.actual_mw! <= r.band_high_mw!).length;
  const errors = rows.map((r) => r.error_mw).filter((e): e is number => e !== null);
  const horizons = rows.map((r) => r.horizon_hours).filter((h): h is number => h !== null);
  return {
    inBand,
    bandTotal: withBand.length,
    maxShortfall: errors.length ? Math.max(...errors) : null,
    minHorizon: horizons.length ? Math.min(...horizons) : null,
    maxHorizon: horizons.length ? Math.max(...horizons) : null,
  };
}

function evolutionSummary(evo: EvolutionResponse): string {
  const n = evo.runs.length;
  const last = evo.runs[n - 1];
  const parts = [`${n} forecast runs were issued for this hour before delivery.`];
  if (evo.selected_publish_time && evo.selected_forecast_mw !== null) {
    parts.push(`At the ${evo.cutoff} cutoff the latest run (published ${fmtDateTime(evo.selected_publish_time)}) said ${fmtMW(evo.selected_forecast_mw)}.`);
  } else {
    parts.push("No run had been published by the cutoff, so this hour has no usable forecast.");
  }
  if (last && last.after_cutoff) {
    parts.push(`The final pre-delivery run said ${fmtMW(last.forecast_mw)} — information the desk could not have used.`);
  }
  if (evo.actual_mw !== null) parts.push(`Actual: ${fmtMW(evo.actual_mw)}.`);
  return parts.join(" ");
}

export function ForecastVsActualPage() {
  const { filters, update } = useFilters();
  const meta = useMeta(filters);
  const days = meta.data?.delivery_days ?? [];
  const date = filters.date && days.includes(filters.date) ? filters.date : days[0];
  const query = useDayForecasts(filters, date);
  const [picked, setPicked] = useState<string>();

  const rows = query.data?.rows ?? [];
  const selected = useMemo(() => {
    if (picked && rows.some((r) => r.start_time === picked)) return picked;
    return (rows.find((r) => londonHour(r.start_time) === DEFAULT_HOUR) ?? rows[0])?.start_time;
  }, [picked, rows]);
  const evolution = useEvolution(selected, filters.cutoff);

  if (meta.isPending) return <Loading />;
  if (meta.isError) return <ErrorState error={meta.error} onRetry={() => meta.refetch()} />;

  const index = date ? days.indexOf(date) : -1;
  const goTo = (d: string | undefined) => d && update({ date: d });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Forecast vs actual for a delivery day</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            What the desk saw at the cutoff, how uncertain it was, and what actually happened.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Previous day" disabled={index <= 0} onClick={() => goTo(days[index - 1])} className="rounded-md border border-line-strong bg-surface p-1.5 shadow-sm disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <select
            aria-label="Delivery day"
            value={date}
            onChange={(e) => goTo(e.target.value)}
            className="rounded-md border border-line-strong bg-surface px-2 py-1.5 text-sm shadow-sm"
          >
            {days.map((d) => (
              <option key={d} value={d}>
                Delivery {fmtDay(d)}
              </option>
            ))}
          </select>
          <button type="button" aria-label="Next day" disabled={index >= days.length - 1} onClick={() => goTo(days[index + 1])} className="rounded-md border border-line-strong bg-surface p-1.5 shadow-sm disabled:opacity-40">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <QueryState query={query}>
        {(data) => {
          const s = dayStats(data.rows);
          return (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-brand/25 bg-brand-soft px-4 py-3 text-sm text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-warn" aria-hidden />
                  Decision cutoff <strong className="font-semibold">{data.cutoff_time ? fmtDateTime(data.cutoff_time) : "—"}</strong>
                </span>
                <span>
                  Forecast run used{" "}
                  <strong className="font-semibold">{data.runs_used.length ? data.runs_used.map(fmtDateTime).join(", ") : "none available"}</strong>
                </span>
                <span>
                  Horizon <strong className="font-semibold">{fmtHours(s.minHorizon)} – {fmtHours(s.maxHorizon)}</strong> ahead
                </span>
              </div>

              <KpiGrid>
                <KpiCard label="Day MAE" value={fmtMW(data.kpis.mae_mw)} hint="Average hourly miss" />
                <KpiCard label="Day bias" value={fmtSignedMW(data.kpis.bias_mw)} hint="> 0 means wind fell short" tone={(data.kpis.bias_mw ?? 0) > 0 ? "bad" : "good"} />
                <KpiCard label="Worst shortfall" value={fmtMW(s.maxShortfall !== null && s.maxShortfall > 0 ? s.maxShortfall : 0)} hint="Largest hourly over-forecast" />
                <KpiCard label="Mean actual" value={fmtMW(data.kpis.mean_actual_mw)} hint="Average wind output" />
                <KpiCard
                  label="Within range"
                  value={s.bandTotal ? `${s.inBand}/${s.bandTotal}` : "—"}
                  hint={`Hours inside the P10–P90 range · ${fmtPct(data.band_coverage_pct)} across scope (target 80%)`}
                />
                <KpiCard label="Coverage" value={`${data.kpis.n_matched}/${data.kpis.n_expected}`} hint="Hours with forecast and actual" />
              </KpiGrid>

              <Card
                title={`Delivery ${fmtDay(date!)}: forecast at cutoff vs actual`}
                subtitle={`Shaded range = P10–P90 of the same hour's errors on delivery days up to D-2 only (known at decision time). Back-tested: actual fell inside ${fmtPct(data.band_coverage_pct)} of ${data.band_hours_evaluated} hours vs the nominal 80%.`}
              >
                {s.bandTotal === 0 && data.rows.length > 0 && (
                  <p className="mb-3 rounded-md bg-warn-soft px-3 py-2 text-xs text-warn">
                    No likely range for this day: it needs at least {data.band_min_history_days} past delivery days of errors (on or before D-2).
                  </p>
                )}                {data.rows.length ? <ForecastBandChart rows={data.rows} selected={selected} onSelect={setPicked} /> : <EmptyState title="No delivery hours for this day" />}
              </Card>

              <Card
                title={
                  <span className="inline-flex items-center gap-1.5">
                    <History className="h-4 w-4 text-brand" aria-hidden />
                    Forecast evolution{selected ? ` · delivery hour ${fmtTime(selected)}` : ""}
                  </span>
                }
                subtitle="Every WINDFOR run for this hour. Only runs published by the cutoff could inform the decision."
                actions={
                  <select
                    aria-label="Delivery hour"
                    value={selected}
                    onChange={(e) => setPicked(e.target.value)}
                    className="rounded-md border border-line-strong bg-surface px-2 py-1 text-xs shadow-sm"
                  >
                    {data.rows.map((r) => (
                      <option key={r.start_time} value={r.start_time}>
                        {fmtTime(r.start_time)}
                      </option>
                    ))}
                  </select>
                }
              >
                <QueryState query={evolution}>
                  {(evo) =>
                    evo.runs.length ? (
                      <>
                        <p className="mb-3 text-sm text-ink-2">{evolutionSummary(evo)}</p>
                        <EvolutionChart evo={evo} />
                      </>
                    ) : (
                      <EmptyState title="No forecast runs found for this hour" />
                    )
                  }
                </QueryState>
              </Card>

              <Card title="Hourly detail" subtitle="Click a row to inspect its forecast evolution.">
                <ComparisonTable rows={data.rows} csvFilename={`gridbrick_${date}_cutoff${filters.cutoff.replace(":", "")}.csv`} selected={selected} onSelect={setPicked} />
              </Card>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
