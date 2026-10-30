"""FastAPI application entry point."""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.elexon_client import ElexonUnavailable
from app.routes import analytics, forecasts, meta

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    app = FastAPI(
        title="GridBrick Wind Forecast API",
        version="1.0.0",
        description="As-of wind forecast selection and accuracy analytics on Elexon BMRS data.",
        docs_url=f"{API_PREFIX}/docs",
        openapi_url=f"{API_PREFIX}/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    @app.exception_handler(ElexonUnavailable)
    def elexon_unavailable(_: Request, exc: ElexonUnavailable) -> JSONResponse:
        logging.getLogger(__name__).error("Upstream failure: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"detail": f"Elexon data is temporarily unavailable. {exc}"},
        )

    for router in (meta.router, analytics.router, forecasts.router):
        app.include_router(router, prefix=API_PREFIX)
    return app


app = create_app()
