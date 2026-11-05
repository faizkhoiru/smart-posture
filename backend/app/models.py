import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    TypeDecorator,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class UTCDateTime(TypeDecorator):
    """Memastikan objek datetime selalu aware UTC di SQLite maupun PostgreSQL."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            if value.tzinfo is None:
                value = value.replace(tzinfo=datetime.UTC)
            else:
                value = value.astimezone(datetime.UTC)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=datetime.UTC)
        return value


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), default="Smart Chair")
    status: Mapped[str] = mapped_column(String(32), default="offline")
    last_seen: Mapped[datetime.datetime | None] = mapped_column(UTCDateTime, nullable=True)
    firmware_version: Mapped[str | None] = mapped_column(String(32), nullable=True)

    config: Mapped["DeviceConfig | None"] = relationship(
        "DeviceConfig", back_populates="device", uselist=False, cascade="all, delete-orphan"
    )
    readings: Mapped[list["LoadCellReading"]] = relationship(
        "LoadCellReading", back_populates="device", cascade="all, delete-orphan"
    )
    events: Mapped[list["PostureEvent"]] = relationship(
        "PostureEvent", back_populates="device", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["SittingSession"]] = relationship(
        "SittingSession", back_populates="device", cascade="all, delete-orphan"
    )
    calibrations: Mapped[list["CalibrationProfile"]] = relationship(
        "CalibrationProfile", back_populates="device", cascade="all, delete-orphan"
    )


class DeviceConfig(Base):
    __tablename__ = "device_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(64), ForeignKey("devices.id"), unique=True)

    occupied_threshold: Mapped[float] = mapped_column(Float, default=20.0)
    release_threshold: Mapped[float] = mapped_column(Float, default=10.0)
    debounce_ms: Mapped[int] = mapped_column(Integer, default=2000)
    capture_interval_ms: Mapped[int] = mapped_column(Integer, default=1000)
    min_visibility: Mapped[float] = mapped_column(Float, default=0.5)
    tolerance_seconds: Mapped[int] = mapped_column(Integer, default=7)
    warning_min_frames: Mapped[int] = mapped_column(Integer, default=5)
    remind_interval: Mapped[int] = mapped_column(Integer, default=60)
    view_mode: Mapped[str] = mapped_column(String(16), default="side")
    camera_state: Mapped[str] = mapped_column(String(16), default="off")

    device: Mapped["Device"] = relationship("Device", back_populates="config")


class LoadCellReading(Base):
    __tablename__ = "load_cell_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(64), ForeignKey("devices.id"))
    timestamp: Mapped[datetime.datetime] = mapped_column(UTCDateTime)
    load_left_raw: Mapped[int | None] = mapped_column(Integer, nullable=True)
    load_right_raw: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_load: Mapped[float | None] = mapped_column(Float, nullable=True)
    load_is_estimate: Mapped[bool] = mapped_column(Boolean, default=True)
    presence: Mapped[bool] = mapped_column(Boolean, default=False)
    sensor_status: Mapped[str] = mapped_column(String(32), default="ok")

    device: Mapped["Device"] = relationship("Device", back_populates="readings")


class PostureEvent(Base):
    __tablename__ = "posture_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(64), ForeignKey("devices.id"))
    timestamp: Mapped[datetime.datetime] = mapped_column(UTCDateTime)
    status: Mapped[str] = mapped_column(String(32))
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    keypoints: Mapped[list[dict]] = mapped_column(JSON, default=list)
    durasi: Mapped[int] = mapped_column(Integer, default=0)
    acknowledged_at: Mapped[datetime.datetime | None] = mapped_column(UTCDateTime, nullable=True)

    device: Mapped["Device"] = relationship("Device", back_populates="events")


class SittingSession(Base):
    __tablename__ = "sitting_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(64), ForeignKey("devices.id"))
    started_at: Mapped[datetime.datetime] = mapped_column(UTCDateTime)
    ended_at: Mapped[datetime.datetime | None] = mapped_column(UTCDateTime, nullable=True)
    total_sit_s: Mapped[int] = mapped_column(Integer, default=0)
    good_s: Mapped[int] = mapped_column(Integer, default=0)
    bad_s: Mapped[int] = mapped_column(Integer, default=0)
    alert_count: Mapped[int] = mapped_column(Integer, default=0)

    device: Mapped["Device"] = relationship("Device", back_populates="sessions")


class CalibrationProfile(Base):
    __tablename__ = "calibration_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(64), ForeignKey("devices.id"))
    tare: Mapped[float | None] = mapped_column(Float, nullable=True)
    scale: Mapped[float | None] = mapped_column(Float, nullable=True)
    baseline: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    calibrated_at: Mapped[datetime.datetime] = mapped_column(UTCDateTime)

    device: Mapped["Device"] = relationship("Device", back_populates="calibrations")
