import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { Scope } from "../types/api";

export const DEFAULT_CUTOFF = "10:00";
const CUTOFF_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface Filters {
  scope: Scope;
  cutoff: string;
  from?: string;
  to?: string;
  date?: string;
}

/** Global filters live in the URL so every view is shareable and survives refresh. */
export function useFilters() {
  const [params, setParams] = useSearchParams();

  const filters: Filters = useMemo(() => {
    const scope: Scope = params.get("scope") === "delivery" ? "delivery" : "decision";
    const cutoffParam = params.get("cutoff") ?? "";
    return {
      scope,
      cutoff: CUTOFF_RE.test(cutoffParam) ? cutoffParam : DEFAULT_CUTOFF,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      date: params.get("date") ?? undefined,
    };
  }, [params]);

  const update = useCallback(
    (changes: Partial<Record<keyof Filters, string | undefined>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === "") next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // Changing scope changes the set of valid delivery days, so day filters are reset.
  const setScope = useCallback(
    (scope: Scope) => update({ scope, from: undefined, to: undefined, date: undefined }),
    [update],
  );

  return { filters, update, setScope };
}
