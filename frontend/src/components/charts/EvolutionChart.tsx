import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EvolutionResponse } from "../../types/api";
import { fmtAxisGW, fmtMW, fmtSignedMW } from "../../utils/format";
import { fmtDateTime, fmtHours, toMs } from "../../utils/time";
import { LegendItem, TooltipBox, TooltipRow } from "./ChartParts";
import { AXIS_TICK, COLORS } from "./theme";

interface Point {
  t: number;
  f: number;
  horizon: number;
  kind: "before" | "selected" | "after";
}

const KIND_LABEL = { before: "Earlier run (superseded)", selected: "Run used for the decision", after: "Published after cutoff (not used)" };

/** Every forecast run for one delivery hour, plotted against its publish time. */
export function EvolutionChart({ evo }: { evo: EvolutionResponse }) {
  const points: Point[] = useMemo(
    () =>
      evo.runs.map((r) => ({
        t: toMs(r.publish_time),
        f: r.forecast_mw,
        horizon: r.horizon_hours,
        kind: r.is_selected ? "selected" : r.after_cutoff ? "after" : "before",
      })),
    [evo],
  );
  const cutoffMs = toMs(evo.cutoff_time);
  const deliveryMs = toMs(evo.start_time);
  const domainStart = points.length ? Math.min(points[0].t, cutoffMs) : cutoffMs;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4">
        <LegendItem color={COLORS.muted} label={KIND_LABEL.before} variant="dot" />
        <LegendItem color={COLORS.forecast} label={KIND_LABEL.selected} variant="dot" />
        <LegendItem color={COLORS.over} label={KIND_LABEL.after} variant="dot" />
        <LegendItem color={COLORS.cutoff} label="Decision cutoff" variant="dashed" />
        <LegendItem color={COLORS.actual} label="Actual" variant="dashed" />
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 18, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[domainStart, deliveryMs]}
              tickFormatter={(v: number) => fmtDateTime(v)}
              tick={AXIS_TICK}
              minTickGap={40}
              allowDuplicatedCategory={false}
            />
            <YAxis dataKey="f" tickFormatter={fmtAxisGW} tick={AXIS_TICK} width={44} domain={["auto", "auto"]} label={{ value: "GW", angle: -90, position: "insideLeft", fontSize: 11, fill: COLORS.axis }} />
            <Tooltip
              cursor={{ stroke: COLORS.muted, strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as Point | undefined;
                if (!active || !p) return null;
                return (
                  <TooltipBox title={`Run published ${fmtDateTime(p.t)}`}>
                    <TooltipRow label="Forecast" value={fmtMW(p.f)} />
                    <TooltipRow label="Hours before delivery" value={fmtHours(p.horizon)} />
                    {evo.actual_mw !== null && <TooltipRow label="Error vs actual" value={fmtSignedMW(p.f - evo.actual_mw)} />}
                    <TooltipRow label="Status" value={KIND_LABEL[p.kind]} />
                  </TooltipBox>
                );
              }}
            />
            <Line data={points} dataKey="f" stroke={COLORS.muted} strokeWidth={1} dot={false} isAnimationActive={false} />
            <Scatter data={points.filter((p) => p.kind === "before")} dataKey="f" fill={COLORS.muted} isAnimationActive={false} />
            <Scatter data={points.filter((p) => p.kind === "after")} dataKey="f" fill={COLORS.over} isAnimationActive={false} />
            <Scatter data={points.filter((p) => p.kind === "selected")} dataKey="f" fill={COLORS.forecast} shape="diamond" isAnimationActive={false} />
            <ReferenceLine x={cutoffMs} stroke={COLORS.cutoff} strokeDasharray="5 4" strokeWidth={2} label={{ value: "Cutoff", position: "top", fontSize: 11, fill: COLORS.cutoff }} />
            {evo.actual_mw !== null && (
              <ReferenceLine y={evo.actual_mw} stroke={COLORS.actual} strokeDasharray="5 4" label={{ value: "Actual", position: "insideTopRight", fontSize: 11, fill: COLORS.actual }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
