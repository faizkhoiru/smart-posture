import datetime
from dataclasses import dataclass

from app.pose import Keypoint, PoseResult
from app.posture_logic import PostureInternalState, decide


@dataclass
class DummyConfig:
    view_mode: str = "side"
    min_visibility: float = 0.5
    warning_min_frames: int = 5
    tolerance_seconds: int = 7
    recovery_frames: int = 3
    angle_tolerance: float = 15.0
    offset_tolerance: float = 0.15


@dataclass
class DummyProfile:
    baseline: dict


def make_pose(
    angle_mode: str = "good",
    side_angle: float = 165.0,
    head_offset: float = 0.0,
    visibility: float = 0.9,
) -> PoseResult:
    # side mode uses ear, shoulder, hip
    # Misal shoulder di (0.5, 0.5)
    # hip di (0.5, 0.8) -> torso height = 0.3
    # ear x = shoulder_x + head_offset * torso_h
    # Jika good: angle lurus mendekati 165
    torso_h = 0.3
    ear_x = 0.5 + head_offset * torso_h
    # Jika slouch/bungkuk: ear maju ke depan (ear_x lebih besar atau angle lebih kecil)
    if angle_mode == "slouch":
        ear_x = 0.5 + 0.35 * torso_h  # deviasi offset > 0.15
        ear_y = 0.3
    else:
        ear_y = 0.2

    kps = [
        Keypoint(name="left_ear", x=ear_x, y=ear_y, visibility=visibility),
        Keypoint(name="left_shoulder", x=0.5, y=0.5, visibility=visibility),
        Keypoint(name="left_hip", x=0.5, y=0.8, visibility=visibility),
    ]
    return PoseResult(ok=True, confidence=visibility, keypoints=kps)


def test_good_posture():
    config = DummyConfig()
    profile = DummyProfile(baseline={"ear_shoulder_hip_angle": 165.0, "head_offset": 0.0})
    state = PostureInternalState()
    now = datetime.datetime(2026, 11, 1, 8, 0, 0, tzinfo=datetime.UTC)

    pose = make_pose("good", head_offset=0.0)
    decision = decide(pose, profile, config, state, now)

    assert decision.status == "good_posture"
    assert decision.alert_clear is False
    assert decision.new_state.warning_frame_count == 0


def test_slouch_short():
    config = DummyConfig(warning_min_frames=5, tolerance_seconds=7)
    profile = DummyProfile(baseline={"ear_shoulder_hip_angle": 165.0, "head_offset": 0.0})
    state = PostureInternalState()
    t0 = datetime.datetime(2026, 11, 1, 8, 0, 0, tzinfo=datetime.UTC)

    # Frame 1: slouch
    pose = make_pose("slouch")
    decision1 = decide(pose, profile, config, state, t0)
    assert decision1.status == "warning"
    assert decision1.new_state.warning_frame_count == 1

    # Frame 3 (baru 3 detik, frame < 5 dan durasi < 7)
    t1 = t0 + datetime.timedelta(seconds=3)
    decision2 = decide(pose, profile, config, decision1.new_state, t1)
    assert decision2.status == "warning"
    assert decision2.new_state.warning_frame_count == 2


def test_slouch_long():
    config = DummyConfig(warning_min_frames=5, tolerance_seconds=7)
    profile = DummyProfile(baseline={"ear_shoulder_hip_angle": 165.0, "head_offset": 0.0})
    state = PostureInternalState()
    t0 = datetime.datetime(2026, 11, 1, 8, 0, 0, tzinfo=datetime.UTC)

    pose = make_pose("slouch")
    current_state = state

    # Simulasikan 5 frame selama 8 detik
    for i in range(5):
        t = t0 + datetime.timedelta(seconds=i * 2)  # detik 0, 2, 4, 6, 8
        decision = decide(pose, profile, config, current_state, t)
        current_state = decision.new_state

    # Pada detik ke-8 (frame ke-5), warning_frame_count=5 dan elapsed=8s >= 7s
    assert decision.status == "bad_posture"
    assert current_state.last_status == "bad_posture"


def test_single_outlier():
    config = DummyConfig()
    profile = DummyProfile(baseline={"ear_shoulder_hip_angle": 165.0, "head_offset": 0.0})
    state = PostureInternalState()
    t0 = datetime.datetime(2026, 11, 1, 8, 0, 0, tzinfo=datetime.UTC)

    # Normal frame
    good_pose = make_pose("good")
    slouch_pose = make_pose("slouch")

    d1 = decide(good_pose, profile, config, state, t0)
    assert d1.status == "good_posture"

    # Satu outlier menyimpang
    d2 = decide(slouch_pose, profile, config, d1.new_state, t0 + datetime.timedelta(seconds=1))
    assert d2.status == "warning"  # Baru warning frame 1, bukan bad_posture

    # Langsung kembali normal
    d3 = decide(good_pose, profile, config, d2.new_state, t0 + datetime.timedelta(seconds=2))
    assert d3.status == "good_posture"


def test_low_visibility():
    config = DummyConfig(min_visibility=0.5)
    profile = DummyProfile(baseline={"ear_shoulder_hip_angle": 165.0, "head_offset": 0.0})
    state = PostureInternalState()
    t0 = datetime.datetime(2026, 11, 1, 8, 0, 0, tzinfo=datetime.UTC)

    # Pose dengan visibility 0.2 < 0.5
    pose = make_pose("good", visibility=0.2)
    decision = decide(pose, profile, config, state, t0)

    assert decision.status == "pose_unavailable"
    assert decision.new_state.warning_frame_count == 0


def test_recovery():
    config = DummyConfig(recovery_frames=3)
    profile = DummyProfile(baseline={"ear_shoulder_hip_angle": 165.0, "head_offset": 0.0})
    # Mulai dari state yang sudah bad_posture
    state = PostureInternalState(
        warning_frame_count=5,
        warning_start_time=datetime.datetime(2026, 11, 1, 8, 0, 0, tzinfo=datetime.UTC),
        recovery_frame_count=0,
        last_status="bad_posture",
    )
    t0 = datetime.datetime(2026, 11, 1, 8, 0, 10, tzinfo=datetime.UTC)
    good_pose = make_pose("good")

    # Frame 1 normal -> belum pulih penuh
    d1 = decide(good_pose, profile, config, state, t0)
    assert d1.status == "bad_posture"
    assert d1.alert_clear is False

    # Frame 2 normal -> belum pulih penuh
    d2 = decide(good_pose, profile, config, d1.new_state, t0 + datetime.timedelta(seconds=1))
    assert d2.status == "bad_posture"
    assert d2.alert_clear is False

    # Frame 3 normal -> pulih penuh! (>= 3 recovery frames)
    d3 = decide(good_pose, profile, config, d2.new_state, t0 + datetime.timedelta(seconds=2))
    assert d3.status == "good_posture"
    assert d3.alert_clear is True
    assert d3.new_state.warning_frame_count == 0


def test_chair_empty_resets():
    state = PostureInternalState(
        warning_frame_count=4,
        warning_start_time=datetime.datetime(2026, 11, 1, 8, 0, 0, tzinfo=datetime.UTC),
        recovery_frame_count=1,
        last_status="warning",
    )
    # Simulasi chair=empty: panggil reset()
    state.reset()

    assert state.warning_frame_count == 0
    assert state.warning_start_time is None
    assert state.recovery_frame_count == 0
    assert state.last_status is None


def test_config_change():
    # Toleransi ketat (offset_tol = 0.05) vs longgar (offset_tol = 0.30)
    strict_config = DummyConfig(
        warning_min_frames=3,
        tolerance_seconds=4,
        offset_tolerance=0.05,
    )
    loose_config = DummyConfig(
        warning_min_frames=3,
        tolerance_seconds=4,
        offset_tolerance=0.30,
    )
    profile = DummyProfile(baseline={"ear_shoulder_hip_angle": 165.0, "head_offset": 0.0})

    # Pose dengan head_offset = 0.10 (menyimpang untuk strict, tapi masuk toleransi untuk loose)
    pose = make_pose("good", head_offset=0.10)
    t0 = datetime.datetime(2026, 11, 1, 8, 0, 0, tzinfo=datetime.UTC)

    d_strict = decide(pose, profile, strict_config, PostureInternalState(), t0)
    d_loose = decide(pose, profile, loose_config, PostureInternalState(), t0)

    # Strict menganggap penyimpangan (warning)
    assert d_strict.status == "warning"
    # Loose menganggap dalam batas toleransi (good_posture)
    assert d_loose.status == "good_posture"
