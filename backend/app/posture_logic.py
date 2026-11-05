import datetime
import math
from dataclasses import dataclass
from typing import Any, Literal

PostureState = Literal["good_posture", "warning", "bad_posture", "pose_unavailable"]


@dataclass
class PostureInternalState:
    warning_frame_count: int = 0
    warning_start_time: datetime.datetime | None = None
    recovery_frame_count: int = 0
    last_status: PostureState | None = None

    def reset(self) -> None:
        self.warning_frame_count = 0
        self.warning_start_time = None
        self.recovery_frame_count = 0
        self.last_status = None


@dataclass
class PostureDecision:
    status: PostureState
    features: dict[str, float]
    alert_clear: bool
    new_state: PostureInternalState


def _calculate_angle(
    p1: tuple[float, float],
    p2: tuple[float, float],
    p3: tuple[float, float],
) -> float:
    """Menghitung sudut (dalam derajat) di p2 antara segmen p1-p2 dan p3-p2."""
    v1 = (p1[0] - p2[0], p1[1] - p2[1])
    v2 = (p3[0] - p2[0], p3[1] - p2[1])
    dot = v1[0] * v2[0] + v1[1] * v2[1]
    mag1 = math.hypot(v1[0], v1[1])
    mag2 = math.hypot(v2[0], v2[1])
    if mag1 * mag2 == 0:
        return 180.0
    cosine = dot / (mag1 * mag2)
    cosine = max(-1.0, min(1.0, cosine))
    return math.degrees(math.acos(cosine))


def compute_features(
    keypoints_dict: dict[str, Any],
    view_mode: str,
) -> dict[str, float]:
    features: dict[str, float] = {}

    if view_mode == "side":
        # Gunakan telinga, bahu, hip kiri atau kanan yang visibility-nya lebih tinggi
        left_avail = (
            "left_ear" in keypoints_dict
            and "left_shoulder" in keypoints_dict
            and "left_hip" in keypoints_dict
        )
        right_avail = (
            "right_ear" in keypoints_dict
            and "right_shoulder" in keypoints_dict
            and "right_hip" in keypoints_dict
        )

        angles: list[float] = []
        head_offsets: list[float] = []

        if left_avail:
            ear = keypoints_dict["left_ear"]
            sh = keypoints_dict["left_shoulder"]
            hip = keypoints_dict["left_hip"]
            ang = _calculate_angle((ear.x, ear.y), (sh.x, sh.y), (hip.x, hip.y))
            angles.append(ang)
            torso_h = max(0.05, abs(hip.y - sh.y))
            offset = (ear.x - sh.x) / torso_h
            head_offsets.append(offset)

        if right_avail:
            ear = keypoints_dict["right_ear"]
            sh = keypoints_dict["right_shoulder"]
            hip = keypoints_dict["right_hip"]
            ang = _calculate_angle((ear.x, ear.y), (sh.x, sh.y), (hip.x, hip.y))
            angles.append(ang)
            torso_h = max(0.05, abs(hip.y - sh.y))
            offset = (ear.x - sh.x) / torso_h
            head_offsets.append(offset)

        if angles:
            features["ear_shoulder_hip_angle"] = sum(angles) / len(angles)
            features["head_offset"] = sum(head_offsets) / len(head_offsets)
        else:
            features["ear_shoulder_hip_angle"] = 160.0
            features["head_offset"] = 0.0

    elif view_mode == "front":
        sh_l = keypoints_dict.get("left_shoulder")
        sh_r = keypoints_dict.get("right_shoulder")
        ear_l = keypoints_dict.get("left_ear")
        ear_r = keypoints_dict.get("right_ear")

        if sh_l and sh_r:
            shoulder_width = max(0.05, math.hypot(sh_r.x - sh_l.x, sh_r.y - sh_l.y))
            features["shoulder_slope"] = abs(sh_l.y - sh_r.y) / shoulder_width
            ratios: list[float] = []
            if ear_l:
                ratios.append(max(0.0, sh_l.y - ear_l.y) / shoulder_width)
            if ear_r:
                ratios.append(max(0.0, sh_r.y - ear_r.y) / shoulder_width)
            if ratios:
                features["ear_shoulder_ratio"] = sum(ratios) / len(ratios)
            else:
                features["ear_shoulder_ratio"] = 0.5
        else:
            features["shoulder_slope"] = 0.0
            features["ear_shoulder_ratio"] = 0.5

    return features


def decide(
    pose: Any,
    profile: Any | None,
    config: Any,
    state: PostureInternalState,
    now: datetime.datetime,
) -> PostureDecision:
    """Fungsi murni untuk evaluasi postur (zero I/O)."""
    # 1. Kelayakan Pose
    if not pose.ok or not pose.keypoints:
        return PostureDecision(
            status="pose_unavailable",
            features={},
            alert_clear=False,
            new_state=PostureInternalState(
                warning_frame_count=0,
                warning_start_time=None,
                recovery_frame_count=0,
                last_status="pose_unavailable",
            ),
        )

    kp_map = {kp.name: kp for kp in pose.keypoints}
    view_mode = getattr(config, "view_mode", "side")
    min_vis = getattr(config, "min_visibility", 0.5)

    # Validasi keypoint wajib
    if view_mode == "side":
        # Minimal salah satu sisi (kiri atau kanan: ear, shoulder, hip) harus visible
        left_valid = (
            kp_map.get("left_ear")
            and kp_map["left_ear"].visibility >= min_vis
            and kp_map.get("left_shoulder")
            and kp_map["left_shoulder"].visibility >= min_vis
            and kp_map.get("left_hip")
            and kp_map["left_hip"].visibility >= min_vis
        )
        right_valid = (
            kp_map.get("right_ear")
            and kp_map["right_ear"].visibility >= min_vis
            and kp_map.get("right_shoulder")
            and kp_map["right_shoulder"].visibility >= min_vis
            and kp_map.get("right_hip")
            and kp_map["right_hip"].visibility >= min_vis
        )
        if not (left_valid or right_valid):
            return PostureDecision(
                status="pose_unavailable",
                features={},
                alert_clear=False,
                new_state=PostureInternalState(
                    warning_frame_count=0,
                    warning_start_time=None,
                    recovery_frame_count=0,
                    last_status="pose_unavailable",
                ),
            )
    else:  # front
        has_sh = (
            kp_map.get("left_shoulder")
            and kp_map["left_shoulder"].visibility >= min_vis
            and kp_map.get("right_shoulder")
            and kp_map["right_shoulder"].visibility >= min_vis
        )
        has_ear = (
            (kp_map.get("left_ear") and kp_map["left_ear"].visibility >= min_vis)
            or (kp_map.get("right_ear") and kp_map["right_ear"].visibility >= min_vis)
        )
        if not (has_sh and has_ear):
            return PostureDecision(
                status="pose_unavailable",
                features={},
                alert_clear=False,
                new_state=PostureInternalState(
                    warning_frame_count=0,
                    warning_start_time=None,
                    recovery_frame_count=0,
                    last_status="pose_unavailable",
                ),
            )

    # 2. Hitung Fitur Geometri
    features = compute_features(kp_map, view_mode)

    # 3. Cek Penyimpangan
    is_deviating = False
    if profile is not None and getattr(profile, "baseline", None):
        baseline = profile.baseline
        angle_tol = getattr(config, "angle_tolerance", 15.0)
        offset_tol = getattr(config, "offset_tolerance", 0.15)

        if view_mode == "side":
            base_angle = baseline.get("ear_shoulder_hip_angle") or baseline.get("side_angle", 165.0)
            base_offset = baseline.get("head_offset", 0.0)

            angle_diff = abs(features.get("ear_shoulder_hip_angle", 165.0) - base_angle)
            offset_diff = abs(features.get("head_offset", 0.0) - base_offset)

            if angle_diff > angle_tol or offset_diff > offset_tol:
                is_deviating = True
        elif view_mode == "front":
            base_ratio = baseline.get("ear_shoulder_ratio", 0.5)
            base_slope = baseline.get("shoulder_slope", 0.0)
            ratio_diff = abs(features.get("ear_shoulder_ratio", 0.5) - base_ratio)
            slope_diff = abs(features.get("shoulder_slope", 0.0) - base_slope)

            if ratio_diff > 0.15 or slope_diff > 0.10:
                is_deviating = True
    else:
        # Jika belum ada kalibrasi, anggap good_posture
        is_deviating = False

    # 4 & 5. Konfirmasi Temporal dan Recovery
    warning_min_frames = getattr(config, "warning_min_frames", 5)
    tolerance_seconds = getattr(config, "tolerance_seconds", 7)
    recovery_frames = getattr(config, "recovery_frames", 3)

    new_state = PostureInternalState(
        warning_frame_count=state.warning_frame_count,
        warning_start_time=state.warning_start_time,
        recovery_frame_count=state.recovery_frame_count,
        last_status=state.last_status,
    )
    alert_clear = False

    if is_deviating:
        new_state.recovery_frame_count = 0
        new_state.warning_frame_count += 1
        if new_state.warning_start_time is None:
            new_state.warning_start_time = now

        elapsed_sec = (now - new_state.warning_start_time).total_seconds()
        if new_state.warning_frame_count >= warning_min_frames and elapsed_sec >= tolerance_seconds:
            status = "bad_posture"
        else:
            status = "warning"
        new_state.last_status = status
        return PostureDecision(
            status=status,
            features=features,
            alert_clear=False,
            new_state=new_state,
        )
    else:
        # Frame Normal
        new_state.recovery_frame_count += 1
        was_bad = state.last_status == "bad_posture"
        was_warning = state.last_status == "warning"

        if was_bad:
            # Dari bad_posture butuh konfirmasi M frame normal (recovery_frames)
            if new_state.recovery_frame_count >= recovery_frames:
                status = "good_posture"
                alert_clear = True
                new_state.warning_frame_count = 0
                new_state.warning_start_time = None
                new_state.recovery_frame_count = recovery_frames
            else:
                status = "bad_posture"
        elif was_warning:
            # Jika sebelumnya baru warning (belum bad_posture), outlier langsung kembali ke good_posture
            status = "good_posture"
            new_state.warning_frame_count = 0
            new_state.warning_start_time = None
            new_state.recovery_frame_count = recovery_frames
        else:
            # Sebelumnya memang good_posture atau None
            status = "good_posture"
            new_state.warning_frame_count = 0
            new_state.warning_start_time = None
            new_state.recovery_frame_count = recovery_frames

        new_state.last_status = status
        return PostureDecision(
            status=status,
            features=features,
            alert_clear=alert_clear,
            new_state=new_state,
        )
