from pathlib import Path

import cv2
import numpy as np

samples_dir = Path("simulator/samples")
samples_dir.mkdir(parents=True, exist_ok=True)

# 1. empty.jpg (hitam kosong 320x480)
empty_img = np.zeros((480, 320, 3), dtype=np.uint8)
cv2.imwrite(str(samples_dir / "empty.jpg"), empty_img)

# 2. straight.jpg placeholder
straight_img = np.zeros((480, 320, 3), dtype=np.uint8)
cv2.putText(
    straight_img, "STRAIGHT POSE", (30, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2
)
cv2.imwrite(str(samples_dir / "straight.jpg"), straight_img)

# 3. slouch.jpg placeholder
slouch_img = np.zeros((480, 320, 3), dtype=np.uint8)
cv2.putText(
    slouch_img, "SLOUCH POSE", (40, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2
)
cv2.imwrite(str(samples_dir / "slouch.jpg"), slouch_img)

# 4. Salin person_sample.jpg jika tersedia
src = Path("backend/scripts/person_sample.jpg")
if src.exists():
    real = cv2.imread(str(src))
    cv2.imwrite(str(samples_dir / "straight_real.jpg"), real)

print("SAMPLE_IMAGES_GENERATED")
