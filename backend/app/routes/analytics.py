from fastapi import APIRouter, Depends

from app.routes.deps import AnalysisParams, analysis_params, get_service, records, scope_info
from app.schemas import AccuracyResponse, DataQuality, OverviewResponse
from app.services import metrics
from app.services.data_service import WindDataService

router = APIRouter(tags=["analytics"])


@router.get("/overview", response_model=OverviewResponse)
def overview(
    params: AnalysisParams = Depends(analysis_params),
    service: WindDataService = Depends(get_service),
) -> OverviewResponse:
    comp = service.comparison(params.days, params.cutoff)
    return OverviewResponse(
        scope=scope_info(params),
        kpis=metrics.compute_kpis(comp),
        series=records(comp, ["start_time", "forecast_mw", "actual_mw"]),
        daily=metrics.daily_summary(comp),
    )


@router.get("/accuracy", response_model=AccuracyResponse)
def accuracy(
    params: AnalysisParams = Depends(analysis_params),
    service: WindDataService = Depends(get_service),
) -> AccuracyResponse:
    comp = service.comparison(params.days, params.cutoff)
    kpis = metrics.compute_kpis(comp)
    return AccuracyResponse(
        scope=scope_info(params),
        kpis=kpis,
        by_hour=metrics.error_by_hour(comp),
        daily=metrics.daily_summary(comp),
        histogram=metrics.error_histogram(comp),
        quality=DataQuality(
            actuals=service.actuals().report.as_dict(),
            forecasts=service.forecasts().report.as_dict(),
            expected_hours=kpis["n_expected"],
            matched_hours=kpis["n_matched"],
            missing_forecast_hours=kpis["n_missing_forecast"],
            missing_actual_hours=kpis["n_missing_actual"],
            mape_excluded_hours=kpis["mape_excluded"],
        ),
    )
