import type { ReactNode } from "react";

/** Shared tooltip chrome for all charts. */
export function TooltipBox({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-44 rounded-lg border border-line bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <div className="mb-1.5 font-semibold text-ink">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function TooltipRow({ color, label, value }: { color?: string; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted">
        {color && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
        {label}
      </span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </div>
  );
}

export function LegendItem({ color, label, variant = "line" }: { color: string; label: string; variant?: "line" | "area" | "dot" | "dashed" }) {
  const swatch =
    variant === "area" ? (
      <span className="inline-block h-3 w-4 rounded-sm" style={{ backgroundColor: color }} />
    ) : variant === "dot" ? (
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
    ) : (
      <span
        className="inline-block w-4 border-t-2"
        style={{ borderColor: color, borderStyle: variant === "dashed" ? "dashed" : "solid" }}
      />
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      {swatch}
      {label}
    </span>
  );
}
