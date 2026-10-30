import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComparisonRow } from "../../types/api";
import { fmtAxisGW, fmtMW, fmtSignedMW } from "../../utils/format";
import { fmtDateTime, fmtHours, fmtTime, toMs } from "../../utils/time";
import { LegendItem, TooltipBox, TooltipRow } from "./ChartParts";
import { AXIS_TICK, COLORS } from "./theme";

interface Point {
  t: number;
  forecast: number | null;
  actual: number | null;
  band: [number, number] | null;
  row: ComparisonRow;
}

interface Props {
  rows: ComparisonRow[];
  selected?: string;
  onSelect?: (startTime: string) => void;
}

/** One delivery day: as-of forecast, its P10–P90 likely range, and the actual outcome. */
export function ForecastBandChart({ rows, selected, onSelect }: Props) {
  const data: Point[] = useMemo(
    () =>
      rows.map((r) => ({
        t: toMs(r.start_time),
        forecast: r.forecast_mw,
        actual: r.actual_mw,
        band: r.band_low_mw != null && r.band_high_mw != null ? [r.band_low_mw, r.band_high_mw] : null,
        row: r,
      })),
    [rows],
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4">
        <LegendItem color={COLORS.forecast} label="Forecast available at cutoff" />
        <LegendItem color={COLORS.band} label="Likely range of actual (P10–P90 of errors known at decision time)" variant="area" />
        <LegendItem color={COLORS.actual} label="Actual generation" />
        {onSelect && <span className="text-xs text-faint">Click an hour to see how its forecast evolved.</span>}
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 5, right: 10, bottom: 0, left: 0 }}
            onClick={(state: { activeTooltipIndex?: number | string | null } | null) => {
              const index = Number(state?.activeTooltipIndex);
              if (onSelect && Number.isInteger(index) && data[index]) onSelect(data[index].row.start_time);
            }}
            style={{ cursor: onSelect ? "pointer" : undefined }}
          >
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={fmtTime} tick={AXIS_TICK} minTickGap={20} />
            <YAxis tickFormatter={fmtAxisGW} tick={AXIS_TICK} width={44} label={{ value: "GW", angle: -90, position: "insideLeft", fontSize: 11, fill: COLORS.axis }} />
            <Tooltip
              cursor={{ stroke: COLORS.muted, strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as Point | undefined;
                if (!active || !p) return null;
                const r = p.row;
                return (
                  <TooltipBox title={fmtDateTime(r.start_time)}>
                    <TooltipRow color={COLORS.forecast} label="Forecast" value={fmtMW(r.forecast_mw)} />
                    <TooltipRow color={COLORS.actual} label="Actual" value={fmtMW(r.actual_mw)} />
                    <TooltipRow label="Error (F − A)" value={fmtSignedMW(r.error_mw)} />
                    {p.band && <TooltipRow color={COLORS.band} label="Likely range" value={`${fmtMW(p.band[0])} – ${fmtMW(p.band[1])}`} />}
                    <TooltipRow label="Forecast run" value={r.publish_time ? fmtDateTime(r.publish_time) : "unavailable"} />
                    <TooltipRow label="Horizon" value={fmtHours(r.horizon_hours)} />
                  </TooltipBox>
                );
              }}
            />
            <Area dataKey="band" stroke="none" fill={COLORS.band} fillOpacity={0.7} isAnimationActive={false} connectNulls={false} />
            <Line dataKey="forecast" stroke={COLORS.forecast} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="actual" stroke={COLORS.actual} strokeWidth={2} dot={{ r: 2, fill: COLORS.actual, strokeWidth: 0 }} isAnimationActive={false} />
            {selected && <ReferenceLine x={toMs(selected)} stroke={COLORS.cutoff} strokeWidth={2} strokeDasharray="4 3" />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
