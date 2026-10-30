import { AlertTriangle, Inbox, Loader2, RotateCw } from "lucide-react";
import type { ReactNode } from "react";

export function Loading({ label = "Loading Elexon data…" }: { label?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-sm text-muted" role="status">
      <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden />
      {label}
      <span className="text-xs text-faint">The first load downloads January's data from Elexon (a few seconds).</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-bad/30 bg-bad-soft p-6 text-center">
      <AlertTriangle className="h-6 w-6 text-bad" aria-hidden />
      <div>
        <p className="font-medium text-bad">Could not load data</p>
        <p className="mt-1 max-w-xl text-sm text-bad">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md bg-bad px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          <RotateCw className="h-4 w-4" aria-hidden /> Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted">
      <Inbox className="h-6 w-6 text-faint" aria-hidden />
      <p className="font-medium text-ink-2">{title}</p>
      {children}
    </div>
  );
}

interface QueryLike<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/** Renders loading / error states and only calls `children` once data exists. */
export function QueryState<T>({ query, children }: { query: QueryLike<T>; children: (data: T) => ReactNode }) {
  if (query.isPending) return <Loading />;
  if (query.isError || query.data === undefined) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <>{children(query.data)}</>;
}
