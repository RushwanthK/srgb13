import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useMemo, useState } from "react";
import type { ComparisonRow } from "../../types/api";
import { downloadCsv, toCsv, type CsvColumn } from "../../utils/csv";
import { fmtNum, fmtSignedPct } from "../../utils/format";
import { fmtDateTime, fmtHours } from "../../utils/time";

type SortKey = "start_time" | "publish_time" | "horizon_hours" | "forecast_mw" | "actual_mw" | "error_mw" | "abs_error_mw" | "pct_error";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "start_time", label: "Delivery (UK)" },
  { key: "publish_time", label: "Forecast run (UK)" },
  { key: "horizon_hours", label: "Horizon", numeric: true },
  { key: "forecast_mw", label: "Forecast MW", numeric: true },
  { key: "actual_mw", label: "Actual MW", numeric: true },
  { key: "error_mw", label: "Error MW", numeric: true },
  { key: "abs_error_mw", label: "|Error| MW", numeric: true },
  { key: "pct_error", label: "% error", numeric: true },
];

const STATUS_LABEL: Record<ComparisonRow["status"], string> = {
  ok: "",
  missing_forecast: "No forecast before cutoff",
  missing_actual: "No actual",
  missing_both: "No data",
};

const CSV_COLUMNS: CsvColumn<ComparisonRow>[] = [
  { header: "delivery_start_utc", value: (r) => r.start_time },
  { header: "delivery_day", value: (r) => r.delivery_day },
  { header: "decision_cutoff_utc", value: (r) => r.cutoff_time },
  { header: "forecast_publish_time_utc", value: (r) => r.publish_time },
  { header: "horizon_hours", value: (r) => r.horizon_hours },
  { header: "forecast_mw", value: (r) => r.forecast_mw },
  { header: "actual_mw", value: (r) => r.actual_mw },
  { header: "error_mw", value: (r) => r.error_mw },
  { header: "abs_error_mw", value: (r) => r.abs_error_mw },
  { header: "pct_error", value: (r) => r.pct_error },
  { header: "band_low_mw", value: (r) => r.band_low_mw },
  { header: "band_high_mw", value: (r) => r.band_high_mw },
  { header: "status", value: (r) => r.status },
];

function compare(a: ComparisonRow, b: ComparisonRow, key: SortKey): number {
  const x = a[key];
  const y = b[key];
  if (x === null && y === null) return 0;
  if (x === null) return 1; // nulls always last
  if (y === null) return -1;
  return x < y ? -1 : x > y ? 1 : 0;
}

interface Props {
  rows: ComparisonRow[];
  csvFilename: string;
  pageSize?: number;
  selected?: string;
  onSelect?: (startTime: string) => void;
}

export function ComparisonTable({ rows, csvFilename, pageSize, selected, onSelect }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "start_time", dir: 1 });
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const c = compare(a, b, sort.key);
      // keep nulls last regardless of direction
      return a[sort.key] === null || b[sort.key] === null ? c : c * sort.dir;
    });
    return copy;
  }, [rows, sort]);

  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = pageSize ? sorted.slice(current * pageSize, (current + 1) * pageSize) : sorted;

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "abs_error_mw" ? -1 : 1 }));
    setPage(0);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          {rows.length} delivery hours · click a column to sort · error = forecast − actual
        </span>
        <button
          type="button"
          onClick={() => downloadCsv(csvFilename, toCsv(sorted, CSV_COLUMNS))}
          className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-2 shadow-sm hover:bg-subtle"
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="min-w-full text-sm">
          <thead className="bg-subtle text-xs uppercase tracking-wide text-muted">
            <tr>
              {COLUMNS.map((c) => {
                const active = sort.key === c.key;
                const Icon = active ? (sort.dir === 1 ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2 font-medium ${c.numeric ? "text-right" : "text-left"}`}>
                    <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-ink">
                      {c.label}
                      <Icon className={`h-3 w-3 ${active ? "text-ink" : "text-faint"}`} aria-hidden />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((r) => (
              <tr
                key={r.start_time}
                onClick={onSelect ? () => onSelect(r.start_time) : undefined}
                className={`${onSelect ? "cursor-pointer hover:bg-brand-soft" : ""} ${selected === r.start_time ? "bg-warn-soft" : ""}`}
              >
                <td className="whitespace-nowrap px-3 py-1.5 text-ink">{fmtDateTime(r.start_time)}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-muted">
                  {r.publish_time ? fmtDateTime(r.publish_time) : <span className="text-warn">{STATUS_LABEL[r.status]}</span>}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted">{fmtHours(r.horizon_hours)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.forecast_mw)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {r.actual_mw === null ? <span className="text-warn">{STATUS_LABEL.missing_actual}</span> : fmtNum(r.actual_mw)}
                </td>
                <td
                  className={`px-3 py-1.5 text-right font-medium tabular-nums ${
                    r.error_mw === null ? "" : r.error_mw > 0 ? "text-bad" : "text-under"
                  }`}
                >
                  {r.error_mw === null ? "—" : `${r.error_mw > 0 ? "+" : ""}${fmtNum(r.error_mw)}`}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.abs_error_mw)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted">{fmtSignedPct(r.pct_error)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageSize && pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted">
          <button
            type="button"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            className="rounded-md border border-line-strong p-1 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          Page {current + 1} of {pages}
          <button
            type="button"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
            className="rounded-md border border-line-strong p-1 disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
