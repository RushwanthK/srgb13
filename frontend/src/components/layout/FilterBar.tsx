import { Info, RotateCcw } from "lucide-react";
import { useLocation } from "react-router-dom";
import { DEFAULT_CUTOFF, useFilters } from "../../hooks/useFilters";
import type { Scope } from "../../types/api";
import { fmtDay } from "../../utils/time";

const SCOPES: { value: Scope; label: string; hint: string }[] = [
  { value: "decision", label: "Decisions in Jan", hint: "Purchase decisions made 1–31 Jan 2026 (delivery 2 Jan – 1 Feb)" },
  { value: "delivery", label: "Deliveries in Jan", hint: "Power delivered 1–31 Jan 2026 (decisions 31 Dec – 30 Jan)" },
];

const CUTOFF_PRESETS = [
  { value: "09:20", label: "09:20", hint: "EPEX GB 60-min day-ahead auction gate closure" },
  { value: "09:50", label: "09:50", hint: "N2EX (Nord Pool) GB day-ahead auction gate closure" },
  { value: DEFAULT_CUTOFF, label: "10:00", hint: "Illustrative default used in this pilot" },
];

const selectClass =
  "rounded-md border border-line-strong bg-surface px-2 py-1.5 text-sm text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function FilterBar({ days }: { days: string[] }) {
  const { filters, update, setScope } = useFilters();
  const { pathname } = useLocation();
  const showRange = pathname !== "/forecasts";

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-muted">January 2026 interpretation</legend>
        <div className="inline-flex rounded-lg border border-line-strong bg-subtle p-0.5" role="radiogroup">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={filters.scope === s.value}
              title={s.hint}
              onClick={() => setScope(s.value)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                filters.scope === s.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="cutoff" className="mb-1 flex items-center gap-1 text-xs font-medium text-muted">
          Decision cutoff (UK, day before)
          <span title="The brief does not fix a decision time. 10:00 is an illustrative default; GB day-ahead auctions close at 09:20 (EPEX) and 09:50 (N2EX).">
            <Info className="h-3.5 w-3.5 text-faint" aria-hidden />
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            id="cutoff"
            type="time"
            step={60}
            value={filters.cutoff}
            onChange={(e) => e.target.value && update({ cutoff: e.target.value.slice(0, 5) })}
            className={`${selectClass} w-28 tabular-nums`}
          />
          {CUTOFF_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              title={p.hint}
              onClick={() => update({ cutoff: p.value })}
              className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
                filters.cutoff === p.value
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line-strong text-muted hover:border-faint"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {showRange && days.length > 0 && (
        <div>
          <span className="mb-1 block text-xs font-medium text-muted">Delivery days</span>
          <div className="flex items-center gap-1.5">
            <select
              aria-label="From delivery day"
              className={selectClass}
              value={filters.from ?? days[0]}
              onChange={(e) => update({ from: e.target.value === days[0] ? undefined : e.target.value })}
            >
              {days.filter((d) => !filters.to || d <= filters.to).map((d) => (
                <option key={d} value={d}>
                  {fmtDay(d)}
                </option>
              ))}
            </select>
            <span className="text-faint">–</span>
            <select
              aria-label="To delivery day"
              className={selectClass}
              value={filters.to ?? days[days.length - 1]}
              onChange={(e) => update({ to: e.target.value === days[days.length - 1] ? undefined : e.target.value })}
            >
              {days.filter((d) => !filters.from || d >= filters.from).map((d) => (
                <option key={d} value={d}>
                  {fmtDay(d)}
                </option>
              ))}
            </select>
            {(filters.from || filters.to) && (
              <button
                type="button"
                onClick={() => update({ from: undefined, to: undefined })}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-subtle"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> All days
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
