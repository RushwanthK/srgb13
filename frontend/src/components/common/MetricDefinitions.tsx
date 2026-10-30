import { Info } from "lucide-react";

export const METRIC_DEFINITIONS = [
  { name: "Error", formula: "Forecast − Actual (MW)", meaning: "Positive = over-forecast: less wind arrived than expected, so the buyer would be short." },
  { name: "MAE", formula: "mean(|F − A|)", meaning: "Typical size of a miss, in MW. Lower is better." },
  { name: "RMSE", formula: "√mean((F − A)²)", meaning: "Like MAE but punishes large misses more. Lower is better." },
  { name: "Bias", formula: "mean(F − A)", meaning: "Systematic tendency. > 0 over-forecasts, < 0 under-forecasts. Closer to 0 is better." },
  { name: "MAPE", formula: "mean(|F − A| / A) × 100", meaning: "Average % miss per hour. Hours with zero actual are excluded; inflated when wind is low." },
  { name: "WAPE", formula: "Σ|F − A| / Σ|A| × 100", meaning: "Total miss as % of total wind output. Robust to low-wind hours; preferred % metric." },
  { name: "P90 shortfall", formula: "90th percentile of (F − A)", meaning: "In 9 of 10 hours, wind fell short of the forecast by less than this. A practical buffer size." },
  { name: "Coverage", formula: "matched hours / expected hours", meaning: "Share of delivery hours with both an as-of forecast and an actual." },
];

export function MetricDefinitions() {
  return (
    <details className="group rounded-xl border border-line bg-surface shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-semibold text-ink">
        <Info className="h-4 w-4 text-brand" aria-hidden />
        Metric definitions
        <span className="ml-auto text-xs font-normal text-muted group-open:hidden">Show</span>
        <span className="ml-auto hidden text-xs font-normal text-muted group-open:inline">Hide</span>
      </summary>
      <dl className="grid gap-x-6 gap-y-3 border-t border-line px-5 py-4 text-sm md:grid-cols-2">
        {METRIC_DEFINITIONS.map((m) => (
          <div key={m.name}>
            <dt className="font-medium text-ink">
              {m.name} <code className="ml-1 rounded bg-subtle px-1.5 py-0.5 text-xs text-muted">{m.formula}</code>
            </dt>
            <dd className="mt-0.5 text-muted">{m.meaning}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
