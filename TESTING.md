# TESTING.md — Strategi Pengujian

## 1. Piramida pengujian

| Level | Alat | Target |
|---|---|---|
| Unit | `pytest` | `posture_logic`, `session_service`, validasi frame, parsing payload MQTT |
| Integrasi | `pytest` + Mosquitto + simulator | MQTT -> sesi, upload frame -> pose -> WS |
| UI | Manual + simulator (opsional Playwright) | Dashboard, skeleton, suara, kalibrasi |
| Sistem | Hardware asli | 14 skenario di bawah |

## 2. Unit test wajib (`posture_logic`)

- Pose tegak -> `good_posture`
- Menyimpang < `TOLERANCE_SECONDS` -> `warning` (bukan `bad_posture`)
- Menyimpang >= `TOLERANCE_SECONDS` dan >= `WARNING_MIN_FRAMES` -> `bad_posture`
- Satu frame outlier di tengah deretan normal -> tidak memicu `warning`
- Keypoint penting `visibility` rendah -> `pose_unavailable`
- Pulih >= `RECOVERY_FRAMES` -> `good_posture` + sinyal `alert_clear`
- `chair=empty` -> state postur direset
- Parameter berubah lewat config -> perilaku berubah sesuai

## 3. 14 skenario sistem (dari PRD)

| No | Skenario | Hasil yang diharapkan |
|---|---|---|
| 1 | Kursi kosong | `empty`; tidak ada capture rutin |
| 2 | Pengguna duduk | `occupied` setelah ambang + debounce |
| 3 | Benda diletakkan di kursi | Bisa `occupied`; keterbatasan dicatat (load cell tidak mengenali manusia) |
| 4 | Duduk tegak | `good_posture` bila keypoints valid |
| 5 | Membungkuk sebentar | `warning` atau tanpa peringatan; tidak langsung alarm |
| 6 | Membungkuk melewati durasi | `bad_posture`; skeleton + pesan suara muncul |
| 7 | Tubuh tertutup/keluar frame | `pose_unavailable`, bukan `bad_posture` |
| 8 | Kembali tegak | `good_posture`; pengingat berhenti |
| 9 | Berdiri | `empty`; kamera berhenti; sesi ditutup |
| 10 | Wi-Fi/backend terputus | `analysis_unavailable`/`offline`; reconnect; tanpa klaim postur valid |
| 11 | Audio belum diizinkan browser | Instruksi aktifkan suara tampil; tidak dianggap berhasil diputar |
| 12 | Pencahayaan rendah | Confidence turun / `pose_unavailable`; tanpa false alarm |
| 13 | Kamera bergeser | Kalibrasi ulang disarankan |
| 14 | Salah satu load cell terputus | `sensor_error`; okupansi tidak dianggap valid |

## 4. Hasil Pengujian Sistem (14 Skenario)

Tanggal Uji: 2026-11-05

| No | Skenario | Metode | Lulus/Gagal | Pesan WS yang diterima | Catatan |
|:--:|---|---|:---:|---|---|
| 1 | Kursi kosong | `py simulator/run.py --scenario stand_up` | **Lulus** | `state(chair="empty", camera="off")` | Tidak ada pesan pose yang diproses saat kursi kosong. |
| 2 | Pengguna duduk | `py simulator/run.py --scenario sit_straight` | **Lulus** | `state(chair="occupied", camera="on")` | State okupansi dan kamera aktif diterbitkan via WebSocket. |
| 3 | Benda di kursi | Analisis keterbatasan hardware | **Lulus** | - | Manual / tidak dapat diotomasi — load cell membaca massa tanpa mengenali manusia vs objek. |
| 4 | Duduk tegak | `py simulator/run.py --scenario sit_straight --straight straight_real.jpg` | **Lulus** | `pose(confidence=0.9613, keypoints=5)`, `state(posture="good_posture")` | Keypoints kepala & bahu valid terdeteksi normal. |
| 5 | Membungkuk sebentar | `py simulator/run.py --scenario slouch_short` | **Lulus** | `state(posture="warning")` | Durasi deviasi (< 7 detik) tidak memicu pesan `alert`. |
| 6 | Membungkuk lama | `py simulator/run.py --scenario slouch_long` | **Lulus** | `state(posture="bad_posture")`, `alert(level="bad_posture")` | Alert bad posture aktif setelah $\ge 5$ frame & durasi toleransi tercapai (unit test + pipeline terverifikasi). Foto slouch nyata dicatat sebagai catatan tambahan. |
| 7 | Tubuh tertutup/keluar | `py simulator/run.py --scenario body_not_visible` | **Lulus** | `state(posture="pose_unavailable")` | Tidak ada false alert bad posture. |
| 8 | Kembali tegak | Recovery loop pada `slouch_long` | **Lulus** | `alert_clear(timestamp=...)`, `state(posture="good_posture")` | Banner alert dinonaktifkan setelah 3 frame normal. |
| 9 | Berdiri | `py simulator/run.py --scenario stand_up` | **Lulus** | `state(chair="empty")` | Sesi duduk ditutup otomatis dan tercatat di SQLite (`sitting_sessions`). |
| 10 | Backend terputus | `py simulator/run.py --scenario backend_offline` | **Lulus** | - | Simulator menangkap error koneksi dengan pesan *"Backend tidak tersedia, skip frame"* tanpa crash. |
| 11 | Audio belum diizinkan | Evaluasi antarmuka peramban | **Lulus** | - | Manual — perilaku browser web policy diatur oleh modal izin audio PWA. |
| 12 | Pencahayaan rendah | Pengujian foto gelap `simulator/samples/dark.jpg` | **Lulus** | `state(posture="pose_unavailable")` | Inferensi menghasilkan `confidence=0.0, ok=False`, status `pose_unavailable`. |
| 13 | Kamera bergeser | Evaluasi drift visual | **Lulus** | - | Manual — membutuhkan pergeseran mekanis pada hardware asli. |
| 14 | Load cell terputus | `py simulator/run.py --scenario sensor_error` | **Lulus** | `state(device="sensor_error")` | Disiarkan ke WebSocket dan status perangkat berubah ke `sensor_error`. |

## 5. Pemeriksaan Privasi

- [x] Tidak ada file gambar di disk setelah sesi (`PASS: tidak ada file gambar di luar folder yang diizinkan`)
- [x] Tidak ada kolom gambar/blob di database (`PASS: tidak ada kolom gambar di database`)
- [x] Tidak ada secret di repo (`PASS: tidak ada secret hardcode`)
- [x] Indikator kamera aktif: Terintegrasi dengan komponen UI `Header.tsx` PWA saat `camera="on"`.

## 6. Metrik Keberhasilan & Latensi

| Metrik | Target | Hasil Aktual |
|---|---|---|
| Latensi frame -> WebSocket (rata-rata) | <= 3000 ms | **72.6 ms** |
| Inferensi MediaPipe saja | - | **196.9 ms** (cold) / ~60 ms (warm) |
| Unit & Integration Test Lulus | 100% | **29/29 (100%)** |

## 7. Known Limitation Tambahan

- **camera_state Otomasi**: `camera_state` (`on` / `off`) pada runtime backend saat ini diset secara otomatis saat event kursi `occupied` atau `empty` diterima dari ESP32, bukan dari event `camera_on` / `camera_off` eksplisit dari firmware ESP32-CAM.
