from fastapi import APIRouter, Depends

from app.config import settings
from app.schemas import MetaResponse
from app.routes.deps import AnalysisParams, analysis_params, scope_info

router = APIRouter(tags=["meta"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/meta", response_model=MetaResponse)
def meta(params: AnalysisParams = Depends(analysis_params)) -> MetaResponse:
    return MetaResponse(
        scope=scope_info(params),
        delivery_days=params.days,
        default_cutoff=settings.default_cutoff,
        data_sources=[
            "Elexon BMRS FUELHH (actual generation, fuelType=WIND, half-hourly)",
            "Elexon BMRS WINDFOR (national wind forecast, hourly, all published runs)",
        ],
        assumptions=[
            "Decision cutoff is configurable; 10:00 Europe/London on the day before delivery is an illustrative default. "
            "For reference, GB day-ahead auctions close at 09:20 (EPEX 60-min) and 09:50 (N2EX).",
            "For each delivery hour, the forecast used is the latest WINDFOR run published at or before the cutoff. "
            "Later runs are never used.",
            "WINDFOR is hourly, so actuals are averaged over the two half-hours of each hour; "
            "an hour with a missing half-hour is treated as missing.",
            "A delivery day runs 00:00-24:00 Europe/London. Timestamps are stored in UTC and displayed in UK time.",
            "Error = forecast - actual. Positive means wind was over-forecast (less wind arrived than expected).",
            "The P10-P90 likely range for delivery day D uses only errors from delivery days up to D-2 "
            "(outcomes known at the decision cutoff), and needs at least 5 such days. Its observed coverage is reported.",
        ],
    )
