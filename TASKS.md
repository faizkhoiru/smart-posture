# TASKS.md — Rencana Kerja dan Checklist

> AI: kerjakan **per fase**, berhenti di akhir fase, lalu tunggu instruksi. Centang `[x]` setelah terverifikasi.
> Jangan mengerjakan fase berikutnya sebelum fase saat ini lulus verifikasi.

## Fase 0 — Fondasi repo
- [x] Struktur folder sesuai `AGENTS.md` bagian 4
- [x] `docker-compose.yml` (backend + Mosquitto), `mosquitto/mosquitto.conf`
- [x] `.env.example`, `README.md` awal
- **Verifikasi:** `docker compose up -d mosquitto` berjalan; `mosquitto_pub/sub` berfungsi

## Fase 1 — Backend dasar dan MQTT
- [x] Konfigurasi (`config.py`), koneksi DB, semua model
- [x] `mqtt_client.py`: subscribe telemetry/status/event, simpan `LoadCellReading`
- [x] `session_service.py`: buka sesi saat `occupied`, tutup saat `empty`, hitung durasi
- [x] Deteksi `offline` bila tanpa heartbeat > `HEARTBEAT_TIMEOUT_S`
- [x] `GET /api/devices`, `GET /api/devices/{id}/latest`
- [x] Unit test `session_service`
- **Verifikasi:** publish event dummy lewat `mosquitto_pub` -> sesi tercatat di DB

## Fase 2 — Upload frame dan pose estimation
- [x] `POST /api/devices/{id}/frames` (validasi, rate limit, `X-Device-Key`, tanpa simpan gambar)
- [x] `pose.py` (MediaPipe) -> `PoseResult` (keypoints bernama, visibility)
- [x] Skrip uji pose dari file foto
- **Verifikasi:** foto tegak menghasilkan keypoints; tidak ada file gambar tertulis ke disk

## Fase 3 — Logika postur dan kalibrasi
- [x] `posture_logic.py` (fungsi murni; fitur geometri `side`/`front`; multi-frame; toleransi)
- [x] `calibrate/load` dan `calibrate/posture`
- [x] Unit test skenario: tegak, bungkuk sebentar, bungkuk lama, tubuh tak terlihat, pulih
- **Verifikasi:** semua unit test lulus; parameter bisa diubah lewat `DeviceConfig`

## Fase 4 — WebSocket dan REST pendukung
- [x] `ws_manager.py` dan `WS /ws/devices/{id}` (pesan `state/pose/alert/alert_clear`)
- [x] Integrasi hasil `posture_logic` dan okupansi ke WebSocket
- [x] `sessions`, `events`, `PUT config` (publish `config/set`), `alerts/ack`, `alerts/mute`
- [x] Skrip WS client untuk verifikasi
- **Verifikasi:** simulator -> pesan WS sesuai `API_CONTRACT.md`

## Fase 5 — Simulator
- [x] `simulator/run.py` dengan skenario: `sit_straight`, `slouch_short`, `slouch_long`,
      `body_not_visible`, `stand_up`, `sensor_error`, `backend_offline`
- **Verifikasi:** satu perintah menjalankan alur duduk -> berdiri dan menghasilkan event di WS

## Fase 6 — PWA
- [x] Setup Vite + React + TS + Tailwind + manifest + service worker
- [x] Hook WebSocket (auto-reconnect, banner offline)
- [x] Dashboard: status, panel skeleton (canvas), ringkasan
- [x] Pengingat: teks, suara (id-ID), "Aktifkan suara", "Saya mengerti", "Jeda 5 menit"
- [x] Wizard kalibrasi, pengaturan, riwayat
- [x] Persetujuan pemantauan dan indikator kamera aktif
- **Verifikasi:** simulator menggerakkan UI tanpa data hardcode; responsif di ponsel

## Fase 7 — Integrasi, pengujian, dokumentasi
- [x] Jalankan 14 skenario di `docs/TESTING.md`, catat hasil
- [x] Ukur metrik (latensi, false alarm); sesuaikan parameter
- [x] Uji dengan hardware asli (minimal ESP32-CAM) bila tersedia (disimulasikan via simulator)
- [x] Rapikan `README.md`

## Backlog pasca-MVP (JANGAN dikerjakan sekarang)
- Multi-kursi / multi-perangkat, profil pengguna ganda
- Notifikasi browser dan pengingat istirahat
- Analisis tren mingguan dan ekspor laporan
- Inferensi pose di perangkat tepi, penyimpanan opt-in untuk evaluasi
