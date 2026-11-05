import asyncio
import logging
from dataclasses import asdict, dataclass
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

logger = logging.getLogger(__name__)

# Model asset path
MODEL_PATH = Path(__file__).resolve().parent / "pose_landmarker_lite.task"

# MediaPipe Pose Landmark mapping index
# 0: nose
# 7: left_ear
# 8: right_ear
# 11: left_shoulder
# 12: right_shoulder
# 23: left_hip
# 24: right_hip
LANDMARK_INDEX_MAP = {
    0: "nose",
    7: "left_ear",
    8: "right_ear",
    11: "left_shoulder",
    12: "right_shoulder",
    23: "left_hip",
    24: "right_hip",
}


@dataclass
class Keypoint:
    name: str
    x: float
    y: float
    visibility: float

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class PoseResult:
    ok: bool
    confidence: float
    keypoints: list[Keypoint]

    def to_dict(self) -> dict:
        return {
            "ok": self.ok,
            "confidence": self.confidence,
            "keypoints": [kp.to_dict() for kp in self.keypoints],
        }


# Lazy loaded singleton landmarker
_landmarker = None


def get_landmarker():
    global _landmarker
    if _landmarker is not None:
        return _landmarker

    if not MODEL_PATH.exists():
        logger.warning("Pose model asset not found at %s", MODEL_PATH)
        return None

    try:
        from mediapipe.tasks.python import BaseOptions
        from mediapipe.tasks.python.vision import (
            PoseLandmarker,
            PoseLandmarkerOptions,
            RunningMode,
        )

        options = PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
            running_mode=RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=0.3,
            min_pose_presence_confidence=0.3,
        )
        _landmarker = PoseLandmarker.create_from_options(options)
        logger.info("PoseLandmarker initialized successfully")
        return _landmarker
    except Exception as e:
        logger.warning("Failed to initialize PoseLandmarker: %s", e)
        return None


def _analyze_sync(jpeg_bytes: bytes) -> PoseResult:
    try:
        if not jpeg_bytes:
            return PoseResult(ok=False, confidence=0.0, keypoints=[])

        np_arr = np.frombuffer(jpeg_bytes, np.uint8)
        img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            logger.warning("cv2.imdecode failed to decode image")
            return PoseResult(ok=False, confidence=0.0, keypoints=[])

        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)

        landmarker = get_landmarker()
        if landmarker is None:
            logger.warning("MediaPipe landmarker is not available")
            return PoseResult(ok=False, confidence=0.0, keypoints=[])

        detection_result = landmarker.detect(mp_image)
        if not detection_result.pose_landmarks:
            return PoseResult(ok=False, confidence=0.0, keypoints=[])

        pose_landmarks = detection_result.pose_landmarks[0]
        extracted_keypoints: list[Keypoint] = []
        visibilities: list[float] = []

        for idx, name in LANDMARK_INDEX_MAP.items():
            if idx < len(pose_landmarks):
                lm = pose_landmarks[idx]
                vis = float(getattr(lm, "visibility", 1.0) or 0.0)
                # MediaPipe Tasks Python sometimes sets visibility to 0.0 if not explicit, fallback presence
                if vis == 0.0 and hasattr(lm, "presence"):
                    vis = float(getattr(lm, "presence", 1.0) or 0.0)

                # Keypoint hanya diambil jika visibility >= 0.1
                if vis >= 0.1:
                    # Clamp koordinat ke 0.0 - 1.0
                    x = max(0.0, min(1.0, float(lm.x)))
                    y = max(0.0, min(1.0, float(lm.y)))
                    extracted_keypoints.append(
                        Keypoint(name=name, x=round(x, 4), y=round(y, 4), visibility=round(vis, 4))
                    )
                    visibilities.append(vis)

        if not extracted_keypoints:
            return PoseResult(ok=False, confidence=0.0, keypoints=[])

        avg_confidence = round(sum(visibilities) / len(visibilities), 4)
        return PoseResult(ok=True, confidence=avg_confidence, keypoints=extracted_keypoints)

    except Exception as e:
        logger.warning("Error during pose analysis: %s", e)
        return PoseResult(ok=False, confidence=0.0, keypoints=[])


async def analyze(jpeg_bytes: bytes) -> PoseResult:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _analyze_sync, jpeg_bytes)
