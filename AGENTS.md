# AGENTS.md — Panduan untuk AI Agent (Smart Posture Corrector)

> Baca file ini PERTAMA sebelum mengerjakan apa pun. Setelah itu baca `DESIGN_ARCHITECTURE.md`
> dan `docs/API_CONTRACT.md`. Bila ada konflik antar dokumen, urutan prioritasnya:
> `AGENTS.md` > `docs/API_CONTRACT.md` > `DESIGN_ARCHITECTURE.md` > dokumen lain.

## 1. Tentang proyek

**Smart Posture Corrector** adalah sistem IoT yang membantu pengguna menyadari kebiasaan duduk membungkuk.
Proyek kuliah (Praktikum Konsep Jaringan, D3 Teknik Informatika PSDKU Lamongan, PENS). Status: **MVP / prototipe**.

Alur singkat:

1. Dua load cell 50 kg di kursi -> ESP32 menentukan kursi `occupied` / `empty` -> kirim via **MQTT**.
2. Saat `occupied`, ESP32-CAM mengirim snapshot JPEG ke backend via **HTTP**.
3. Backend (FastAPI) menjalankan **pose estimation** -> keypoints -> status postur.
4. Backend mengirim status + keypoints + alert ke **PWA** via **WebSocket**.
5. PWA menampilkan **pose skeleton** dan memutar **pengingat suara**.

Produk adalah **alat bantu kebiasaan ergonomi, BUKAN alat medis**, tidak mendiagnosis, dan tidak menjamin penilaian postur klinis.

## 2. Ruang lingkup tugas AI

### Dikerjakan AI (software)

- Backend FastAPI: REST API, MQTT subscriber, endpoint upload frame, WebSocket, database.
- Modul pose estimation dan logika postur (di dalam backend).
- PWA React: dashboard, skeleton, suara, kalibrasi, pengaturan, riwayat.
- Simulator perangkat (MQTT + upload frame) agar software diuji tanpa hardware.
- Docker Compose, test, dokumentasi.

### BUKAN tugas AI (jangan dikerjakan, jangan diubah)

- Firmware ESP32 / ESP32-CAM, wiring, desain mekanis, kalibrasi fisik load cell. Ini dikerjakan tim hardware.
- Face recognition, identifikasi identitas, diagnosis medis, pengukuran sudut tulang belakang klinis.
- Penyimpanan gambar mentah, analitik pihak ketiga, layanan cloud berbayar.
- Dukungan multi-kursi / multi-pengguna (itu pasca-MVP). MVP = **satu kursi, satu pengguna**.

### Pembagian kerja

Sesi ini hanya mengerjakan BACKEND dan SIMULATOR (folder backend/, simulator/,
mosquitto/, docker-compose.yml). JANGAN membuat atau mengubah file di pwa/.
Frontend dikerjakan orang lain dan hanya bergantung pada docs/API_CONTRACT.md.
Bila perlu mengubah kontrak, minta persetujuan dulu dan perbarui file itu.

## 3. Tech stack (tetap, jangan diganti tanpa persetujuan)

| Lapisan   | Teknologi                                                                |
| --------- | ------------------------------------------------------------------------ |
| Backend   | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.x, uvicorn              |
| Database  | SQLite (MVP); skema harus portabel ke PostgreSQL                         |
| Messaging | MQTT (Mosquitto), klien `paho-mqtt` atau `aiomqtt`                       |
| Pose      | MediaPipe Pose + OpenCV (modul dalam backend)                            |
| Frontend  | React + Vite + TypeScript, Tailwind CSS, PWA (manifest + service worker) |
| Infra     | Docker Compose (backend + Mosquitto)                                     |
| Bahasa UI | Indonesia                                                                |

## 4. Struktur repo

```
smart-posture/
├── AGENTS.md
├── DESIGN_ARCHITECTURE.md
├── docs/            # API_CONTRACT, TASKS, TESTING, CONVENTIONS, PROMPTS
├── backend/
│   ├── app/         # main, config, db, models, schemas, mqtt_client, ws_manager,
│   │                # pose, posture_logic, session_service
│   │   └── routes/  # devices, frames, calibration, sessions, alerts
│   └── tests/
├── pwa/             # src/{pages,components,hooks,store}
├── simulator/       # skrip simulasi perangkat
├── mosquitto/
├── docker-compose.yml
└── .env.example
```

## 5. Aturan WAJIB (tidak boleh dilanggar)

### Privasi dan keselamatan

1. **Jangan simpan frame/gambar mentah** ke disk atau database. Proses di memori lalu buang.
   Pengecualian debugging hanya bila diaktifkan eksplisit lewat env `DEBUG_SAVE_FRAMES=true`
   (default `false`) dan harus ada retensi + peringatan di log.
2. Kamera/analisis hanya berjalan saat kursi `occupied` (kecuali kalibrasi yang dimulai pengguna).
3. UI wajib menampilkan indikator kamera aktif dan persetujuan pemantauan sebelum sesi pertama.
4. Teks pengingat harus sopan, tanpa diagnosis dan tanpa menakut-nakuti.
5. Jangan pernah menaruh secret (API key, password) di kode atau frontend. Gunakan `.env`.

### Kebenaran status (anti-halusinasi sistem)

6. Jangan keluarkan `bad_posture` dari satu frame. Wajib: multi-frame + durasi toleransi.
7. Bila tubuh tidak terlihat / confidence rendah -> `pose_unavailable`, **bukan** `bad_posture`.
8. Bila backend/inferensi/perangkat gagal -> `analysis_unavailable` / `offline` / `sensor_error`.
   **Jangan mengarang** status postur.
9. Tombol "Saya mengerti" di PWA hanya mencatat acknowledgment, **bukan** bukti postur baik/buruk.
10. Nilai berat dari load cell berstatus _estimasi_ bila belum dikalibrasi; jangan tampilkan sebagai akurat.

### Kontrak dan perubahan

11. **Jangan mengubah** nama topik MQTT, bentuk payload, endpoint, atau pesan WebSocket
    tanpa memperbarui `docs/API_CONTRACT.md` dan meminta persetujuan pengguna terlebih dahulu.
12. Jangan mengubah skema database tanpa menyertakan migrasi (atau penjelasan reset DB) dan memberi tahu pengguna.
13. Jangan menambah dependensi besar baru tanpa alasan tertulis; utamakan yang sudah ada di stack.

## 6. Batasan perilaku AI

**Tanya dulu (minta konfirmasi) sebelum:**

- mengubah kontrak API / skema DB / struktur folder utama,
- menambah dependensi atau layanan baru,
- menghapus atau menimpa file yang sudah ada isinya,
- memilih nilai ambang postur final (default boleh dipakai, tandai sebagai "perlu validasi").

**Dilarang:**

- menjalankan perintah destruktif (`rm -rf` di luar folder build/cache, `git push --force`, reset database tanpa izin),
- mengklaim fitur selesai tanpa menjalankan test/verifikasi,
- mengerjakan fase berikutnya sebelum fase saat ini diverifikasi,
- membuat fitur di luar `docs/TASKS.md`.

**Bila ragu:** tulis asumsi secara eksplisit di akhir ringkasan, atau ajukan satu pertanyaan spesifik. Jangan menebak diam-diam.

## 7. Alur kerja AI per tugas

1. Baca `AGENTS.md` -> `DESIGN_ARCHITECTURE.md` -> `docs/API_CONTRACT.md` -> bagian relevan di `docs/TASKS.md`.
2. Tulis rencana singkat (file yang akan dibuat/diubah).
3. Implementasikan dalam langkah kecil, patuhi `docs/CONVENTIONS.md`.
4. Jalankan test dan lakukan verifikasi (lihat `docs/TESTING.md`).
5. Centang tugas di `docs/TASKS.md`.
6. Akhiri dengan ringkasan: apa yang dibuat, cara menjalankan, hasil test, asumsi, dan hal yang perlu keputusan manusia.

## 8. Definition of Done (per tugas)

- [ ] Sesuai `docs/API_CONTRACT.md` (tidak ada perubahan kontrak diam-diam).
- [ ] Ada test untuk logika baru; seluruh test lulus.
- [ ] Tidak ada gambar mentah tersimpan; tidak ada secret di kode.
- [ ] Error ditangani dan di-log; tidak ada `except: pass`.
- [ ] README/dokumen terkait diperbarui bila perilaku berubah.
- [ ] Ringkasan akhir ditulis sesuai poin 7.6.

## 9. Perintah umum

```bash
docker compose up -d mosquitto            # broker MQTT
cd backend && uvicorn app.main:app --reload --port 8000
cd backend && pytest -q
cd pwa && npm install && npm run dev
python simulator/run.py --scenario slouch_long --device spc-001
```

## 10. Pertanyaan terbuka (perlu keputusan manusia, jangan diputuskan sendiri oleh AI)

- Posisi kamera: `side` (samping) atau `front` (depan)? Menentukan fitur geometri di `posture_logic.py`
  (default dikonfigurasi lewat `view_mode`).
- Nilai ambang final (toleransi, jumlah frame, confidence) -> ditentukan dari pengujian prototipe.
- Format payload final dari tim hardware (bila berbeda dari `docs/API_CONTRACT.md`).
- Pilihan model pose final (MediaPipe vs alternatif) setelah uji performa.
