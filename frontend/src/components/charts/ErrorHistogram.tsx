import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistogramBin } from "../../types/api";
import { fmtSignedMW } from "../../utils/format";
import { LegendItem, TooltipBox, TooltipRow } from "./ChartParts";
import { AXIS_TICK, COLORS } from "./theme";

const binColor = (b: HistogramBin) =>
  b.bin_end_mw <= 0 ? COLORS.under : b.bin_start_mw >= 0 ? COLORS.over : COLORS.muted;

/** Distribution of signed hourly errors (forecast − actual). */
export function ErrorHistogram({ data }: { data: HistogramBin[] }) {
  const total = data.reduce((sum, b) => sum + b.count, 0);
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4">
        <LegendItem color={COLORS.under} label="Under-forecast (more wind than expected)" variant="area" />
        <LegendItem color={COLORS.over} label="Over-forecast (wind shortfall)" variant="area" />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }} barCategoryGap={1}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis
              dataKey="bin_start_mw"
              tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
              tick={AXIS_TICK}
              minTickGap={16}
              label={{ value: "Error, MW", position: "insideBottomRight", offset: -2, fontSize: 11, fill: COLORS.axis }}
            />
            <YAxis tick={AXIS_TICK} width={40} allowDecimals={false} label={{ value: "Hours", angle: -90, position: "insideLeft", fontSize: 11, fill: COLORS.axis }} />
            <Tooltip
              cursor={{ fill: COLORS.cursor }}
              content={({ active, payload }) => {
                const b = payload?.[0]?.payload as HistogramBin | undefined;
                if (!active || !b) return null;
                return (
                  <TooltipBox title={`${fmtSignedMW(b.bin_start_mw)} to ${fmtSignedMW(b.bin_end_mw)}`}>
                    <TooltipRow label="Hours" value={b.count} />
                    <TooltipRow label="Share" value={total ? `${((b.count / total) * 100).toFixed(1)}%` : "—"} />
                  </TooltipBox>
                );
              }}
            />
            <Bar dataKey="count" isAnimationActive={false}>
              {data.map((b) => (
                <Cell key={b.bin_start_mw} fill={binColor(b)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
