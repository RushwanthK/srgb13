import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyPoint } from "../../types/api";
import { fmtMW, fmtPct, fmtSignedMW } from "../../utils/format";
import { fmtDay } from "../../utils/time";
import { LegendItem, TooltipBox, TooltipRow } from "./ChartParts";
import { AXIS_TICK, COLORS } from "./theme";

/** Daily MAE and bias across the period: spot the days the forecast struggled. */
export function DailyTrendChart({ data }: { data: DailyPoint[] }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4">
        <LegendItem color={COLORS.forecast} label="Daily MAE" variant="area" />
        <LegendItem color={COLORS.over} label="Daily bias (F − A)" />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="delivery_day" tickFormatter={(d: string) => fmtDay(d).replace(/^\w+ /, "")} tick={AXIS_TICK} minTickGap={12} />
            <YAxis tick={AXIS_TICK} width={52} tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`} label={{ value: "MW", angle: -90, position: "insideLeft", fontSize: 11, fill: COLORS.axis }} />
            <ReferenceLine y={0} stroke={COLORS.muted} />
            <Tooltip
              cursor={{ fill: COLORS.cursor }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as DailyPoint | undefined;
                if (!active || !p) return null;
                return (
                  <TooltipBox title={fmtDay(p.delivery_day)}>
                    <TooltipRow color={COLORS.forecast} label="MAE" value={fmtMW(p.mae_mw)} />
                    <TooltipRow color={COLORS.over} label="Bias" value={fmtSignedMW(p.bias_mw)} />
                    <TooltipRow label="WAPE" value={fmtPct(p.wape_pct)} />
                    <TooltipRow label="Mean forecast / actual" value={`${fmtMW(p.mean_forecast_mw)} / ${fmtMW(p.mean_actual_mw)}`} />
                    <TooltipRow label="Matched hours" value={p.n_matched} />
                  </TooltipBox>
                );
              }}
            />
            <Bar dataKey="mae_mw" fill={COLORS.forecast} fillOpacity={0.8} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Line dataKey="bias_mw" stroke={COLORS.over} strokeWidth={2} dot={{ r: 2, fill: COLORS.over, strokeWidth: 0 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
