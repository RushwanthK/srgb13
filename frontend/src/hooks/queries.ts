import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getAccuracy, getEvolution, getForecasts, getMeta, getOverview } from "../api/endpoints";
import type { Filters } from "./useFilters";

// Data is historical, so responses can be treated as fresh for the whole session.
const STATIC = { staleTime: Infinity, placeholderData: keepPreviousData } as const;

export const useMeta = (f: Filters) =>
  useQuery({ queryKey: ["meta", f.scope], queryFn: () => getMeta(f), staleTime: Infinity });

export const useOverview = (f: Filters) =>
  useQuery({ queryKey: ["overview", f.scope, f.cutoff, f.from, f.to], queryFn: () => getOverview(f), ...STATIC });

export const useAccuracy = (f: Filters) =>
  useQuery({ queryKey: ["accuracy", f.scope, f.cutoff, f.from, f.to], queryFn: () => getAccuracy(f), ...STATIC });

export const useDayForecasts = (f: Filters, date: string | undefined) =>
  useQuery({
    queryKey: ["forecasts", f.scope, f.cutoff, date],
    queryFn: () => getForecasts({ ...f, date }),
    enabled: Boolean(date),
    ...STATIC,
  });

export const usePeriodForecasts = (f: Filters) =>
  useQuery({
    queryKey: ["forecasts", f.scope, f.cutoff, "period", f.from, f.to],
    queryFn: () => getForecasts({ ...f, date: undefined }),
    ...STATIC,
  });

export const useEvolution = (startTime: string | undefined, cutoff: string) =>
  useQuery({
    queryKey: ["evolution", startTime, cutoff],
    queryFn: () => getEvolution(startTime as string, cutoff),
    enabled: Boolean(startTime),
    ...STATIC,
  });
