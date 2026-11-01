# TASKS.md — Rencana Kerja dan Checklist

> AI: kerjakan **per fase**, berhenti di akhir fase, lalu tunggu instruksi. Centang `[x]` setelah terverifikasi.
> Jangan mengerjakan fase berikutnya sebelum fase saat ini lulus verifikasi.

## Fase 0 — Fondasi repo
- [ ] Struktur folder sesuai `AGENTS.md` bagian 4
- [ ] `docker-compose.yml` (backend + Mosquitto), `mosquitto/mosquitto.conf`
- [ ] `.env.example`, `README.md` awal
- **Verifikasi:** `docker compose up -d mosquitto` berjalan; `mosquitto_pub/sub` berfungsi

## Fase 1 — Backend dasar dan MQTT
- [ ] Konfigurasi (`config.py`), koneksi DB, semua model
- [ ] `mqtt_client.py`: subscribe telemetry/status/event, simpan `LoadCellReading`
- [ ] `session_service.py`: buka sesi saat `occupied`, tutup saat `empty`, hitung durasi
- [ ] Deteksi `offline` bila tanpa heartbeat > `HEARTBEAT_TIMEOUT_S`
- [ ] `GET /api/devices`, `GET /api/devices/{id}/latest`
- [ ] Unit test `session_service`
- **Verifikasi:** publish event dummy lewat `mosquitto_pub` -> sesi tercatat di DB

## Fase 2 — Upload frame dan pose estimation
- [ ] `POST /api/devices/{id}/frames` (validasi, rate limit, `X-Device-Key`, tanpa simpan gambar)
- [ ] `pose.py` (MediaPipe) -> `PoseResult` (keypoints bernama, visibility)
- [ ] Skrip uji pose dari file foto
- **Verifikasi:** foto tegak menghasilkan keypoints; tidak ada file gambar tertulis ke disk

## Fase 3 — Logika postur dan kalibrasi
- [ ] `posture_logic.py` (fungsi murni; fitur geometri `side`/`front`; multi-frame; toleransi)
- [ ] `calibrate/load` dan `calibrate/posture`
- [ ] Unit test skenario: tegak, bungkuk sebentar, bungkuk lama, tubuh tak terlihat, pulih
- **Verifikasi:** semua unit test lulus; parameter bisa diubah lewat `DeviceConfig`

## Fase 4 — WebSocket dan REST pendukung
- [ ] `ws_manager.py` dan `WS /ws/devices/{id}` (pesan `state/pose/alert/alert_clear`)
- [ ] Integrasi hasil `posture_logic` dan okupansi ke WebSocket
- [ ] `sessions`, `events`, `PUT config` (publish `config/set`), `alerts/ack`, `alerts/mute`
- [ ] Skrip WS client untuk verifikasi
- **Verifikasi:** simulator -> pesan WS sesuai `API_CONTRACT.md`

## Fase 5 — Simulator
- [ ] `simulator/run.py` dengan skenario: `sit_straight`, `slouch_short`, `slouch_long`,
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
- [ ] Jalankan 14 skenario di `docs/TESTING.md`, catat hasil
- [ ] Ukur metrik (latensi, false alarm); sesuaikan parameter
- [ ] Uji dengan hardware asli (minimal ESP32-CAM) bila tersedia
- [ ] Rapikan `README.md`

## Backlog pasca-MVP (JANGAN dikerjakan sekarang)
- Multi-kursi / multi-perangkat, profil pengguna ganda
- Notifikasi browser dan pengingat istirahat
- Analisis tren mingguan dan ekspor laporan
- Inferensi pose di perangkat tepi, penyimpanan opt-in untuk evaluasi
