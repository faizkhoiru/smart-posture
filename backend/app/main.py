from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db import init_db
from app.mqtt_client import mqtt_service
from app.routes.calibration import router as calibration_router
from app.routes.devices import router as devices_router
from app.routes.frames import router as frames_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup: Inisialisasi DB tables & MQTT client
    await init_db()
    await mqtt_service.start()
    yield
    # Shutdown: Stop MQTT client
    await mqtt_service.stop()


app = FastAPI(
    title="Smart Posture Corrector API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS Middleware
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handler untuk HTTPException terstandarisasi
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": "http_error",
                "message": str(exc.detail),
            }
        },
    )


# Exception handler untuk error tak terduga (Uniform Error Response)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "internal_server_error",
                "message": "Terjadi kesalahan internal pada server",
            }
        },
    )


# Mount router
app.include_router(devices_router)
app.include_router(frames_router)
app.include_router(calibration_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
