# Smart Posture Corrector — Backend & Simulator

Sistem IoT untuk membantu pengguna menyadari kebiasaan duduk membungkuk dengan load cell dan analisis pose berbasis MediaPipe & OpenCV.

> **Catatan Penting:** Proyek ini adalah **alat bantu kebiasaan ergonomi, BUKAN alat medis**, tidak mendiagnosis dan tidak menjamin penilaian postur klinis.

---

## 1. Prasyarat

- **Python**: 3.11+ (disarankan Python 3.11 atau 3.12 untuk kompatibilitas native MediaPipe).
- **Node.js**: 18+ (hanya jika ingin menjalankan Frontend PWA secara lokal).
- **Broker MQTT**: Mosquitto (via Docker Compose atau broker MQTT mandiri).
- **Sistem Operasi**: Windows, macOS, atau Linux.

---

## 2. Setup

1. **Clone repositori**:
   ```bash
   git clone <repo-url>
   cd smart-posture
   ```

2. **Salin file konfigurasi lingkungan**:
   ```bash
   cp .env.example .env
   ```

3. **Install dependensi Backend**:
   ```bash
   cd backend
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate

   pip install -r requirements.txt
   ```

---

## 3. Menjalankan

### A. Menggunakan Docker Compose (Backend + Mosquitto)
```bash
# Menjalankan broker MQTT Mosquitto saja:
docker compose up -d mosquitto

# Menjalankan seluruh stack layanan:
docker compose up -d
```

### B. Menjalankan Backend Secara Lokal
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```
Server akan berjalan di `http://localhost:8000` dengan dokumentasi Swagger di `http://localhost:8000/docs`.

### C. Menjalankan Monitoring WebSocket Klien
Untuk memantau pesan siaran `state`, `pose`, `alert`, dan `alert_clear` secara real-time:
```bash
py backend/scripts/ws_client.py --device spc-001 --url ws://localhost:8000
```

### D. Menjalankan Simulator Perangkat
```bash
py simulator/run.py --scenario full_flow --device spc-001
```

---

## 4. Menjalankan Test & Linter

```bash
cd backend

# Menjalankan seluruh unit & integration test
py -m pytest tests -q

# Menjalankan linter Ruff
py -m ruff check backend/ simulator/
```

---

## 5. Skenario Simulator

Simulator mendukung argumen `--straight <path_gambar>` dan `--slouch <path_gambar>` untuk menguji postur dengan sampel gambar kustom.

| Skenario | Deskripsi |
|---|---|
| `sit_straight` | Duduk (`occupied`), mengirim 10 frame tegak berturut-turut, lalu berdiri (`empty`). |
| `slouch_short` | Duduk, 3 frame tegak, 3 frame bungkuk (< toleransi durasi), 3 frame tegak, lalu berdiri. Status `warning` tanpa alert. |
| `slouch_long` | Duduk, 3 frame tegak, 15 frame bungkuk berturut-turut (memicu `bad_posture` + `alert`), 5 frame tegak (pulih + `alert_clear`), lalu berdiri. |
| `body_not_visible` | Duduk, mengirim 10 frame gelap/tanpa tubuh. Status menjadi `pose_unavailable` tanpa memicu false alert. |
| `stand_up` | Kursi occupied mengirim frame lalu berdiri (`empty`). Menutup sesi dan merangkum durasi. |
| `sensor_error` | Menerbitkan event `sensor_error` (`source="load_left"`), menunggu 2 detik, lalu pulih via `sensor_ok`. |
| `backend_offline` | Menguji pengiriman frame ke URL backend yang salah. Simulator menangani error secara aman tanpa crash. |
| `full_flow` | Alur pengujian lengkap: Duduk tegak -> membungkuk lama (alert) -> tegak kembali (alert clear) -> berdiri. |

---

## 6. Cara Kalibrasi

Proses kalibrasi dilakukan melalui PWA atau endpoint REST API:

1. **Kalibrasi Beban Kosong (Tare)**:
   - Pastikan tidak ada orang atau beban di atas kursi.
   - Panggil `POST /api/devices/{id}/calibrate/load` dengan body:
     ```json
     { "step": "empty" }
     ```
   - Sistem akan merata-ratakan 5 nilai raw load cell terbaru sebagai tare ($0\text{ kg}$).

2. **Kalibrasi Beban Terisi (Scale Factor)**:
   - Letakkan beban terukur standar di kursi (misal $50\text{ kg}$).
   - Panggil `POST /api/devices/{id}/calibrate/load` dengan body:
     ```json
     { "step": "occupied", "known_weight_kg": 50.0 }
     ```
   - Sistem akan menghitung faktor skala konversi raw load cell ke satuan kilogram.

3. **Kalibrasi Postur (Baseline Ergonomi)**:
   - Pengguna duduk tegak ergonomis menghadap monitor selama beberapa detik.
   - Panggil `POST /api/devices/{id}/calibrate/posture` dengan body:
     ```json
     { "frames": 15 }
     ```
   - Sistem menghitung rata-rata sudut dan offset geometri (`side_angle`, `head_offset`) dari frame valid in-memory sebagai acuan dasar (baseline) postur baik.

---

## 7. Known Limitations

- **Sampel Foto Placeholder**: Placeholder default sintetis (`straight.jpg`, `slouch.jpg`, `empty.jpg`) tidak memiliki kontur tubuh manusia sehingga pose estimation mengembalikan `pose_unavailable`. Untuk pengujian inferensi pose nyata, sediakan foto berformat JPEG orang asli (seperti `straight_real.jpg`).
- **Otomasi Status Kamera**: Pada versi MVP, `camera_state` secara otomatis diaktifkan saat kursi `occupied` dan dimatikan saat `empty`.
- **Infrastruktur MQTT**: Untuk deployment produksi stabil, gunakan Mosquitto native / Docker container dengan autentikasi TLS dan kredensial aman.
- **Dukungan MediaPipe pada Python**: MediaPipe secara resmi mendukung Python 3.9–3.12. Pada Python 3.14+, paket menggunakan modul Task Vision yang telah disesuaikan dan memerlukan file model `pose_landmarker_lite.task`.
