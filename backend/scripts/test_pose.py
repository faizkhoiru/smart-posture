import asyncio
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.pose import analyze  # noqa: E402


async def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: py scripts/test_pose.py <path_foto.jpg>")
        sys.exit(1)

    file_path = sys.argv[1]
    try:
        with open(file_path, "rb") as f:
            jpeg_bytes = f.read()
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        sys.exit(1)

    result = await analyze(jpeg_bytes)

    print("=" * 50)
    print(f"ok: {result.ok}")
    print(f"confidence: {result.confidence}")
    print(f"jumlah keypoint terdeteksi: {len(result.keypoints)}")
    print("=" * 50)

    if result.keypoints:
        print(f"{'Name':<16} | {'X':<8} | {'Y':<8} | {'Visibility':<10}")
        print("-" * 50)
        for kp in result.keypoints:
            print(f"{kp.name:<16} | {kp.x:<8.4f} | {kp.y:<8.4f} | {kp.visibility:<10.4f}")


if __name__ == "__main__":
    asyncio.run(main())
