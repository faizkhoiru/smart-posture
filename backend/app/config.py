from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ===== Backend =====
    APP_ENV: str = "development"
    DATABASE_URL: str = "sqlite:///./smart_posture.db"
    CORS_ORIGINS: str = "http://localhost:5173"

    # ===== MQTT =====
    MQTT_HOST: str = "localhost"
    MQTT_PORT: int = 1883
    MQTT_USERNAME: str | None = None
    MQTT_PASSWORD: str | None = None
    MQTT_TOPIC_PREFIX: str = "spc"

    # ===== Perangkat =====
    DEVICE_API_KEY: str = "change-me"
    HEARTBEAT_TIMEOUT_S: int = 30

    # ===== Frame / Pose =====
    MAX_FRAME_BYTES: int = 512000
    MAX_FPS_PER_DEVICE: int = 3
    DEBUG_SAVE_FRAMES: bool = False

    # ===== Parameter postur (default, divalidasi lewat pengujian) =====
    VIEW_MODE: Literal["side", "front"] = "side"
    MIN_VISIBILITY: float = 0.5
    WARNING_MIN_FRAMES: int = 5
    TOLERANCE_SECONDS: int = 7
    RECOVERY_FRAMES: int = 3
    REMIND_INTERVAL_S: int = 60
    CAPTURE_FPS: int = 1


settings = Settings()

