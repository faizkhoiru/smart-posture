# API_CONTRACT.md — Kontrak Data (sumber kebenaran antarmuka)

> Perubahan pada file ini harus disetujui pengguna dan diberitahukan ke tim hardware.
> Semua timestamp: ISO 8601 UTC (contoh `2026-11-01T08:30:00Z`). `device_id` contoh: `spc-001`.

## 1. MQTT (hardware -> backend)

Broker: Mosquitto. QoS 1 untuk `event` dan `status`; QoS 0 untuk `telemetry`. Gambar **tidak** lewat MQTT.

| Topik | Arah | Keterangan |
|---|---|---|
| `spc/{device_id}/telemetry` | HW -> BE | Berkala (~1–2 detik) |
| `spc/{device_id}/status` | HW -> BE | Heartbeat ~10 detik; Last Will = `offline` (retained) |
| `spc/{device_id}/event` | HW -> BE | Perubahan okupansi, kamera, error |
| `spc/{device_id}/config/set` | BE -> HW | Konfigurasi baru |
| `spc/{device_id}/config/state` | HW -> BE | Konfigurasi aktif (retained) |

### telemetry
```json
{
  "device_id": "spc-001",
  "timestamp": "2026-11-01T08:30:00Z",
  "load_left_raw": 123456,
  "load_right_raw": 120987,
  "load_total_kg": 62.4,
  "load_is_estimate": true,
  "presence": true,
  "camera_state": "on",
  "rssi": -58,
  "firmware_version": "0.1.0"
}
```
`load_total_kg` boleh `null` bila belum dikalibrasi. `load_is_estimate=true` bila belum dikalibrasi dengan beban standar.

### status
```json
{ "device_id": "spc-001", "state": "online", "timestamp": "2026-11-01T08:30:10Z" }
```
`state`: `online` | `offline`.

### event
```json
{
  "device_id": "spc-001",
  "timestamp": "2026-11-01T08:30:02Z",
  "type": "occupied",
  "detail": null
}
```
`type`: `occupied` | `empty` | `sensor_error` | `sensor_ok` | `camera_on` | `camera_off`.
Untuk `sensor_error`, `detail` berisi `{"source":"load_left|load_right|hx711|camera","reason":"..."}`.

### config/set (BE -> HW)
```json
{ "occupied_threshold": 20.0, "release_threshold": 10.0, "debounce_ms": 2000, "capture_interval_ms": 1000 }
```

## 2. Upload frame (ESP32-CAM -> backend)

`POST /api/devices/{device_id}/frames`
- Header: `X-Device-Key: <kunci>`
- Body `multipart/form-data`: `image` (JPEG), `timestamp` (ISO 8601)
- Batas: ukuran <= 500 KB (konfigurasi `MAX_FRAME_BYTES`), `Content-Type: image/jpeg`, rate limit `MAX_FPS_PER_DEVICE` (default 3)

| Kode | Arti |
|---|---|
| 202 | Diterima, diproses |
| 400 | Format/ukuran tidak valid |
| 401 | Kunci perangkat salah |
| 404 | Device tidak terdaftar |
| 409 | Kursi tidak `occupied` (frame diabaikan) |
| 429 | Melebihi rate limit |

Respons 202: `{ "accepted": true }`. Gambar tidak disimpan.

## 3. REST API (PWA -> backend)

| Metode & Path | Fungsi | Body / Respons utama |
|---|---|---|
| `GET /api/devices` | Daftar perangkat | `[{id,name,status,last_seen}]` |
| `GET /api/devices/{id}/latest` | Status terbaru | `{chair,posture,camera,device,load,updated_at}` |
| `POST /api/devices/{id}/calibrate/load` | Kalibrasi beban | body `{step:"empty"\|"occupied", known_weight_kg?}` -> `{ok,profile}` |
| `POST /api/devices/{id}/calibrate/posture` | Baseline postur | body `{frames?:int}` -> `{ok,baseline,warnings[]}` |
| `GET /api/devices/{id}/sessions` | Riwayat sesi | query `limit,offset` |
| `GET /api/devices/{id}/events` | Riwayat event postur | query `limit,offset,status` |
| `PUT /api/devices/{id}/config` | Ubah pengaturan | body `DeviceConfig` parsial -> publish `config/set` |
| `POST /api/devices/{id}/alerts/ack` | Catat pengakuan | `{event_id}` -> `{ok}` |
| `POST /api/devices/{id}/alerts/mute` | Jeda pengingat | `{minutes:int}` -> `{muted_until}` |

Format error seragam:
```json
{ "error": { "code": "device_not_found", "message": "Perangkat tidak ditemukan" } }
```

## 4. WebSocket (backend -> PWA)

`WS /ws/devices/{device_id}`. Backend menyiarkan; klien hanya mendengarkan (aksi lewat REST).
Saat tersambung, backend langsung mengirim satu pesan `state` terbaru.

### state
```json
{
  "type": "state",
  "chair": "occupied",
  "posture": "good_posture",
  "camera": "on",
  "device": "online",
  "analysis": "ok",
  "load": { "kg": 62.4, "is_estimate": true },
  "muted_until": null,
  "updated_at": "2026-11-01T08:30:05Z"
}
```
Nilai: `chair` = `empty|occupied|calibrating`; `posture` = `good_posture|warning|bad_posture|pose_unavailable|null`;
`camera` = `on|off`; `device` = `online|offline|sensor_error`; `analysis` = `ok|analysis_unavailable`.

### pose
```json
{
  "type": "pose",
  "timestamp": "2026-11-01T08:30:05Z",
  "confidence": 0.87,
  "keypoints": [
    { "name": "left_ear", "x": 0.42, "y": 0.18, "visibility": 0.93 },
    { "name": "right_ear", "x": 0.55, "y": 0.18, "visibility": 0.90 },
    { "name": "left_shoulder", "x": 0.35, "y": 0.40, "visibility": 0.95 },
    { "name": "right_shoulder", "x": 0.62, "y": 0.40, "visibility": 0.94 },
    { "name": "left_hip", "x": 0.38, "y": 0.75, "visibility": 0.88 },
    { "name": "right_hip", "x": 0.60, "y": 0.75, "visibility": 0.87 }
  ]
}
```
Koordinat 0–1 (kiri-atas = 0,0). Nama keypoint: `nose,left_ear,right_ear,left_shoulder,right_shoulder,left_hip,right_hip`.

### alert
```json
{
  "type": "alert",
  "event_id": 123,
  "level": "bad_posture",
  "message": "Postur Anda mulai membungkuk. Silakan tegakkan tubuh secara perlahan agar lebih nyaman.",
  "remind_interval_s": 60,
  "timestamp": "2026-11-01T08:31:00Z"
}
```

### alert_clear
```json
{ "type": "alert_clear", "timestamp": "2026-11-01T08:31:30Z" }
```
