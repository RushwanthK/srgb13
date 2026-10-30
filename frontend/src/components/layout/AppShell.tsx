import { CalendarDays, Clock, Moon, Sun, Wind } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { FilterBar } from "./FilterBar";
import { useFilters } from "../../hooks/useFilters";
import { useMeta } from "../../hooks/queries";
import { useTheme } from "../../hooks/useTheme";
import { fmtLongDay } from "../../utils/time";

const NAV = [
  { to: "/", label: "Overview" },
  { to: "/forecasts", label: "Forecast vs Actual" },
  { to: "/accuracy", label: "Accuracy" },
];

export function AppShell() {
  const { search } = useLocation();
  const { filters } = useFilters();
  const meta = useMeta(filters);
  const scope = meta.data?.scope;
  const { theme, toggle } = useTheme();
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-white/5 bg-header text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-emerald-950">
              <Wind className="h-5 w-5" aria-hidden />
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">GridBrick</div>
              <div className="text-[11px] text-emerald-200/70">GB wind forecast decision support</div>
            </div>
          </div>
          <nav className="flex gap-1" aria-label="Main">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={{ pathname: item.to, search }}
                end
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? "bg-emerald-400/15 text-emerald-100" : "text-emerald-100/70 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="ml-auto rounded-md p-2 text-emerald-100/80 transition hover:bg-white/10 hover:text-white"
          >
            <ThemeIcon className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <FilterBar days={meta.data?.delivery_days ?? []} />
          {scope && (
            <div className="mt-2.5 flex flex-wrap items-start gap-x-5 gap-y-1 text-xs text-muted">
              <span className="flex items-start gap-1.5">
                <CalendarDays className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium text-ink-2">{scope.label}:</span> decisions {fmtLongDay(scope.decision_from)} –{" "}
                  {fmtLongDay(scope.decision_to)} · delivery {fmtLongDay(scope.delivery_from)} – {fmtLongDay(scope.delivery_to)}
                </span>
              </span>
              <span className="flex items-start gap-1.5">
                <Clock className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  Decision cutoff <span className="font-medium text-ink-2">{filters.cutoff} UK time on D-1</span>
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-4 py-4 text-xs text-muted sm:px-6">
          <span>
            Data: Elexon BMRS —{" "}
            <a className="underline hover:text-ink-2" href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream" target="_blank" rel="noreferrer">
              FUELHH
            </a>{" "}
            (actual wind) and{" "}
            <a className="underline hover:text-ink-2" href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream" target="_blank" rel="noreferrer">
              WINDFOR
            </a>{" "}
            (wind forecasts). National level, January 2026.
          </span>
          <span>All times shown in UK time (Europe/London). Power in MW.</span>
        </div>
      </footer>
    </div>
  );
}
