import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HourStat } from "../../types/api";
import { fmtMW, fmtSignedMW } from "../../utils/format";
import { LegendItem, TooltipBox, TooltipRow } from "./ChartParts";
import { AXIS_TICK, COLORS } from "./theme";

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** MAE and bias by local hour of day: when in the day is the forecast least reliable? */
export function ErrorByHourChart({ data }: { data: HourStat[] }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4">
        <LegendItem color={COLORS.forecast} label="MAE" variant="area" />
        <LegendItem color={COLORS.over} label="Bias (F − A)" />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="hour" tickFormatter={(h: number) => String(h).padStart(2, "0")} tick={AXIS_TICK} interval="preserveStartEnd" minTickGap={6} />
            <YAxis tick={AXIS_TICK} width={52} tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`} label={{ value: "MW", angle: -90, position: "insideLeft", fontSize: 11, fill: COLORS.axis }} />
            <ReferenceLine y={0} stroke={COLORS.muted} />
            <Tooltip
              cursor={{ fill: COLORS.cursor }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as HourStat | undefined;
                if (!active || !p) return null;
                return (
                  <TooltipBox title={`${hourLabel(p.hour)}–${hourLabel((p.hour + 1) % 24)} UK`}>
                    <TooltipRow color={COLORS.forecast} label="MAE" value={fmtMW(p.mae_mw)} />
                    <TooltipRow color={COLORS.over} label="Bias" value={fmtSignedMW(p.bias_mw)} />
                    <TooltipRow label="P10 / P90 error" value={`${fmtSignedMW(p.p10_error_mw)} / ${fmtSignedMW(p.p90_error_mw)}`} />
                    <TooltipRow label="Hours" value={p.n} />
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
