import { apiGet } from "./client";
import type {
  AccuracyResponse,
  EvolutionResponse,
  ForecastsResponse,
  MetaResponse,
  OverviewResponse,
  Scope,
} from "../types/api";

export interface AnalysisFilters {
  scope: Scope;
  cutoff: string;
  from?: string;
  to?: string;
}

export const getMeta = (f: Pick<AnalysisFilters, "scope" | "cutoff">) =>
  apiGet<MetaResponse>("/meta", { scope: f.scope, cutoff: f.cutoff });

export const getOverview = (f: AnalysisFilters) =>
  apiGet<OverviewResponse>("/overview", { scope: f.scope, cutoff: f.cutoff, from: f.from, to: f.to });

export const getAccuracy = (f: AnalysisFilters) =>
  apiGet<AccuracyResponse>("/accuracy", { scope: f.scope, cutoff: f.cutoff, from: f.from, to: f.to });

export const getForecasts = (f: AnalysisFilters & { date?: string }) =>
  apiGet<ForecastsResponse>("/forecasts", {
    scope: f.scope,
    cutoff: f.cutoff,
    date: f.date,
    from: f.date ? undefined : f.from,
    to: f.date ? undefined : f.to,
  });

export const getEvolution = (startTime: string, cutoff: string) =>
  apiGet<EvolutionResponse>("/forecasts/evolution", { start_time: startTime, cutoff });
