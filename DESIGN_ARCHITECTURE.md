# DESIGN_ARCHITECTURE.md — Arsitektur dan Alur Input–Output

Dokumen ini menjelaskan **apa masuk, apa keluar, dan siapa bertanggung jawab** pada setiap bagian sistem.
Skema pesan yang presisi ada di `docs/API_CONTRACT.md`.

## 1. Gambaran umum

```
 ┌────────────┐  HX711  ┌──────────────┐  UART/Wi-Fi   ┌─────────────┐
 │ Load Cell  │────────▶│ ESP32 DevKit │──── trigger ─▶│  ESP32-CAM  │
 │  50kg × 2  │         │ (okupansi)   │               │  (OV2640)   │
 └────────────┘         └──────┬───────┘               └──────┬──────┘
                               │ MQTT (telemetry/status/event)│ HTTP POST (JPEG)
                               ▼                              ▼
                        ┌──────────────────────────────────────────┐
                        │           BACKEND (FastAPI)              │
                        │  mqtt_client │ routes/frames │ pose.py   │
                        │  session_service │ posture_logic         │
                        │  REST API │ ws_manager │ SQLite          │
                        └───────────────────┬──────────────────────┘
                                            │ WebSocket (state/pose/alert)
                                            ▼
                                   ┌─────────────────┐
                                   │   React PWA     │
                                   │ skeleton + suara│
                                   └─────────────────┘
```

Cakupan AI: kotak **BACKEND**, **PWA**, dan **simulator**. Kotak sebelah kiri (hardware) berada di luar tanggung jawab AI.

## 2. Komponen dan tanggung jawab

| Komponen | Tanggung jawab | Bukan tanggung jawab |
|---|---|---|
| ESP32 DevKit (hardware) | Baca load cell, tentukan okupansi, picu kamera, kirim MQTT | Analisis postur |
| ESP32-CAM (hardware) | Ambil snapshot, upload JPEG | Pose estimation, penyimpanan gambar |
| `mqtt_client.py` | Subscribe telemetry/status/event, publish config | Keputusan postur |
| `routes/frames.py` | Validasi dan terima JPEG, teruskan ke pose | Menyimpan gambar |
| `pose.py` | JPEG -> keypoints + confidence (MediaPipe) | Menentukan "membungkuk" |
| `posture_logic.py` | Keypoints -> status postur (multi-frame, baseline) | Akses jaringan/DB langsung |
| `session_service.py` | Buka/tutup sesi duduk, akumulasi durasi | Pose |
| `ws_manager.py` | Siarkan pesan ke klien PWA per device | Logika bisnis |
| PWA | Tampilkan status, skeleton, suara, kontrol pengguna | Analisis citra |

Prinsip: `posture_logic.py` adalah **fungsi murni** (input -> output, tanpa I/O) agar mudah diuji unit.

## 3. Input dan output per komponen

| Komponen | Input | Output |
|---|---|---|
| ESP32 -> Backend | — | MQTT `telemetry`, `status`, `event` |
| ESP32-CAM -> Backend | — | `POST /frames` (multipart: `image`, `timestamp`) |
| `mqtt_client` | Pesan MQTT | Panggilan ke `session_service`; baris `LoadCellReading`; update status device |
| `routes/frames` | JPEG + header `X-Device-Key` | `202 Accepted` + hasil diproses di background; error 4xx |
| `pose` | Array gambar (decoded) | `PoseResult{keypoints[], confidence, ok}` |
| `posture_logic` | `PoseResult`, `CalibrationProfile`, `DeviceConfig`, state sebelumnya | `PostureDecision{status, features, new_state}` |
| `session_service` | Event okupansi | `SittingSession` dibuka/ditutup; ringkasan |
| `ws_manager` | Pesan terformat | Siaran `state` / `pose` / `alert` / `alert_clear` ke PWA |
| PWA | Pesan WebSocket + REST | Tampilan, suara, panggilan `ack`/`mute`/`config`/`calibrate` |

## 4. Alur data end-to-end

1. **Duduk**: ESP32 -> MQTT `event{occupied}`. Backend membuka `SittingSession`, mengirim `state{chair:occupied}`.
2. **Capture**: ESP32-CAM mengunggah frame (mulai ~1 fps). Backend memvalidasi dan memproses di memori.
3. **Pose**: `pose.py` menghasilkan keypoints. Bila bagian penting tidak terlihat atau confidence rendah -> `pose_unavailable`.
4. **Keputusan**: `posture_logic` menghitung fitur geometri, membandingkan dengan baseline, memperbarui penghitung `warning`.
5. **Konfirmasi**: `warning` bertahan >= durasi toleransi **dan** >= N frame berturut-turut -> `bad_posture`.
6. **Notifikasi**: backend mengirim `pose` (tiap frame valid), `state`, dan `alert` (saat `bad_posture`).
7. **Pengingat**: PWA menampilkan skeleton + teks, memutar suara (bila diaktifkan pengguna), mengulang sesuai interval kecuali dijeda.
8. **Pulih**: postur kembali normal -> `good_posture`, backend mengirim `alert_clear`.
9. **Berdiri**: ESP32 -> `event{empty}`. Kamera berhenti, sesi ditutup, ringkasan disimpan.

## 5. State machine

### 5.1 Kursi (`chair`)
`empty` <-> `occupied` (ditentukan hardware; backend hanya mengikuti event). `calibrating` berlaku saat wizard kalibrasi berjalan.

### 5.2 Postur (`posture`) — hanya berjalan saat `chair = occupied`
```
 occupied ──▶ (tunggu frame valid)
   ├─ keypoints tidak layak ─────────────────▶ pose_unavailable
   ├─ dalam toleransi ──────────────────────▶ good_posture
   └─ menyimpang ─▶ warning ─┬─ pulih ───────▶ good_posture
                             └─ bertahan ≥ T dan ≥ N frame ─▶ bad_posture
 bad_posture ─ pulih (≥ M frame normal) ────▶ good_posture (+ alert_clear)
 backend/inferensi gagal ───────────────────▶ analysis_unavailable
 chair=empty ───────────────────────────────▶ (reset state postur)
```

### 5.3 Perangkat (`device`)
`online` | `offline` (tidak ada heartbeat > `HEARTBEAT_TIMEOUT_S`) | `sensor_error` (dilaporkan hardware).
Saat `sensor_error`, okupansi tidak dianggap valid dan analisis dihentikan.

## 6. Logika deteksi postur

**Lapisan keputusan:** (1) okupansi, (2) kelayakan pose, (3) konfirmasi temporal.

**Keypoints yang dipakai:** `left_ear`, `right_ear`, `left_shoulder`, `right_shoulder`, `left_hip`, `right_hip` (+ `nose` opsional).
Koordinat ternormalisasi 0–1; `visibility` 0–1.

**Kelayakan pose:** semua keypoint wajib untuk `view_mode` aktif harus `visibility >= MIN_VISIBILITY`.

**Fitur geometri (dikonfigurasi lewat `view_mode`):**
- `side`: sudut telinga–bahu–pinggul, dan offset horizontal telinga terhadap bahu (dinormalisasi tinggi torso).
- `front`: rasio jarak vertikal telinga–bahu terhadap lebar bahu, dan kemiringan garis bahu.

**Penyimpangan** = selisih fitur terhadap baseline > `TOLERANCE` (per fitur, dari `CalibrationProfile`).

**Parameter default (semua HARUS divalidasi lewat pengujian, bukan nilai final):**

| Parameter | Default | Keterangan |
|---|---|---|
| `MIN_VISIBILITY` | 0.5 | Batas visibility keypoint |
| `WARNING_MIN_FRAMES` | 5 | Frame berturut-turut menyimpang |
| `TOLERANCE_SECONDS` | 7 | Durasi `warning` sebelum `bad_posture` |
| `RECOVERY_FRAMES` | 3 | Frame normal berturut-turut untuk kembali `good_posture` |
| `REMIND_INTERVAL_S` | 60 | Jeda ulang pengingat |
| `CAPTURE_FPS` | 1 | Frekuensi snapshot awal |
| `HEARTBEAT_TIMEOUT_S` | 30 | Batas offline |

## 7. Model data (ringkas)

| Entitas | Isi utama |
|---|---|
| `Device` | id, nama, status, last_seen, firmware_version |
| `DeviceConfig` | ambang okupansi, debounce, min_visibility, tolerance_seconds, warning_min_frames, remind_interval, view_mode, camera_state |
| `LoadCellReading` | timestamp, raw_left, raw_right, estimated_load, presence, sensor_status |
| `PostureEvent` | timestamp, status, confidence, keypoints terpilih, durasi, acknowledged_at (**tanpa frame**) |
| `SittingSession` | started_at, ended_at, total_sit_s, good_s, bad_s, alert_count |
| `CalibrationProfile` | tare, scale, baseline fitur/keypoints, toleransi, calibrated_at |

## 8. Penanganan kegagalan (degradasi yang benar)

| Kejadian | Perilaku sistem |
|---|---|
| Backend/Wi-Fi terputus | ESP32 tetap deteksi okupansi; PWA tampilkan `analysis_unavailable`/`offline`; reconnect otomatis |
| Frame gagal diproses | Lewati frame, log, jangan ubah status ke `bad_posture` |
| Tubuh keluar frame / gelap | `pose_unavailable` |
| Load cell terputus | `sensor_error`, okupansi tidak valid |
| Kamera/kursi bergeser | Sarankan kalibrasi ulang (turunnya confidence berulang) |
| Audio diblokir browser | PWA tampilkan instruksi "Aktifkan suara"; jangan anggap audio berhasil |
| WebSocket putus (PWA) | Auto-reconnect dengan backoff + banner offline |

## 9. Privasi by design

- Gambar diproses di memori dan dibuang; hanya keypoints terpilih yang disimpan.
- Kamera hanya saat `occupied` (kecuali kalibrasi oleh pengguna). Indikator kamera aktif di UI.
- Tanpa face recognition. Persetujuan pemantauan sebelum sesi pertama.
- HTTPS/WSS dan autentikasi perangkat (`X-Device-Key`) di deployment nyata.

## 10. Keputusan arsitektur (ADR ringkas)

| Keputusan | Alasan |
|---|---|
| Pose dijalankan di backend, bukan ESP32-CAM/browser | ESP32-CAM tidak mampu inferensi pose akurat; browser tidak boleh jadi sumber kebenaran |
| MQTT untuk telemetri, HTTP untuk gambar | Payload gambar besar; multipart HTTP lebih sederhana dan andal |
| Pose sebagai modul dalam FastAPI | MVP satu kursi satu pengguna; kurangi kompleksitas service terpisah |
| SQLite untuk MVP | Tanpa server tambahan; skema portabel ke PostgreSQL |
| `posture_logic` fungsi murni | Mudah diuji unit tanpa hardware/jaringan |
| Keputusan postur di backend, PWA hanya menampilkan | Satu sumber kebenaran; mencegah klien memalsukan status |
