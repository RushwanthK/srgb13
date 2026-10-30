import { useMemo } from "react";
import { Brush, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeriesPoint } from "../../types/api";
import { fmtAxisGW, fmtMW, fmtSignedMW } from "../../utils/format";
import { fmtAxisDay, fmtDateTime, toMs } from "../../utils/time";
import { LegendItem, TooltipBox, TooltipRow } from "./ChartParts";
import { AXIS_TICK, COLORS } from "./theme";

interface Point {
  t: number;
  forecast: number | null;
  actual: number | null;
}

/** Month-long hourly view of the as-of forecast against actual wind generation. */
export function ActualVsForecastChart({ series }: { series: SeriesPoint[] }) {
  const data: Point[] = useMemo(
    () => series.map((p) => ({ t: toMs(p.start_time), forecast: p.forecast_mw, actual: p.actual_mw })),
    [series],
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4">
        <LegendItem color={COLORS.forecast} label="Forecast available at cutoff" />
        <LegendItem color={COLORS.actual} label="Actual generation" />
        <span className="text-xs text-faint">Drag the handles below the chart to zoom.</span>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={fmtAxisDay}
              tick={AXIS_TICK}
              minTickGap={30}
            />
            <YAxis tickFormatter={fmtAxisGW} tick={AXIS_TICK} width={44} label={{ value: "GW", angle: -90, position: "insideLeft", fontSize: 11, fill: COLORS.axis }} />
            <Tooltip
              cursor={{ stroke: COLORS.muted, strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as Point | undefined;
                if (!active || !p) return null;
                const error = p.forecast !== null && p.actual !== null ? p.forecast - p.actual : null;
                return (
                  <TooltipBox title={fmtDateTime(p.t)}>
                    <TooltipRow color={COLORS.forecast} label="Forecast" value={fmtMW(p.forecast)} />
                    <TooltipRow color={COLORS.actual} label="Actual" value={fmtMW(p.actual)} />
                    <TooltipRow label="Error (F − A)" value={fmtSignedMW(error)} />
                  </TooltipBox>
                );
              }}
            />
            <Line type="monotone" dataKey="actual" stroke={COLORS.actual} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="forecast" stroke={COLORS.forecast} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Brush dataKey="t" height={22} stroke={COLORS.forecast} fill={COLORS.surface} tickFormatter={fmtAxisDay} travellerWidth={8} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
