# Smart Posture Corrector — Frontend PWA

Aplikasi Web Progresif (PWA) berbasis **React 18 + TypeScript (Strict) + Vite + Tailwind CSS** untuk sistem pemantau kebiasaan postur duduk ergonomis (**Smart Posture Corrector**).

Aplikasi ini bertindak murni sebagai klien penampil (*display & user interface*) yang terhubung ke backend FastAPI melalui **WebSocket** (mendengarkan stream telemetry, pose, dan alert) dan **REST API** (melakukan aksi kalibrasi, pengakuan alert, jeda pengingat, dan pengaturan konfigurasi).

---

## 🚀 Fitur Utama (Fase 6 Selesai)

1. **Dashboard Real-Time:**
   - **Header Informasi:** Nama perangkat, status heartbeat, waktu update terakhir, dan indikator privasi status kamera (`camera_state = on/off`).
   - **Hero Status Utama:** Memetakan status kombinasi: *Kursi Kosong*, *Pengguna Terdeteksi (Postur Baik / Perlu Perbaikan)*, *Analisis Tidak Tersedia*, atau *Pose Tidak Terlihat*.
   - **Visualisasi Pose Skeleton Canvas:** Merender 7 keypoints MediaPipe (`nose`, `left/right_ear`, `left/right_shoulder`, `left/right_hip`) dan garis segmen tulang anatomis secara dinamis.
   - **Panel Ringkasan:** Menampilkan beban kursi dari load cell (dengan label *Estimasi* sebelum kalibrasi), kategori postur, dan jaminan privasi (*no image stored*).

2. **Sistem Pengingat Ramah & Audio Web Speech API:**
   - Pengingat suara berbahasa Indonesia (`lang="id-ID"`).
   - **Kepatuhan Autoplay (Skenario 11):** Tombol eksplisit *"Aktifkan Suara"* untuk mengizinkan audio peramban. Jika belum diaktifkan, tampil instruksi jelas dan tidak menganggap audio berhasil diputar.
   - **Kontrol Alert:** Tombol *"Saya Mengerti"* (`POST /alerts/ack`) dan *"Jeda 5 Menit"* (`POST /alerts/mute` dengan hitungan mundur).
   - Otomatis disembunyikan saat menerima sinyal pemulihan `alert_clear`.

3. **Wizard Kalibrasi 3 Langkah:**
   - **Langkah 1:** Kosongkan kursi → Rekam titik nol (*Tare*).
   - **Langkah 2:** Duduki kursi → Masukkan bobot acuan (kg) untuk mengkalibrasi faktor skala (*Scale*).
   - **Langkah 3:** Duduk tegak normal → Rekam 10 frame geometris tulang belakang sebagai *Baseline* acuan.
   - Ringkasan hasil nilai tare, skala, sudut baseline, dan catatan peringatan.

4. **Pengaturan Sistem & Toleransi Postur:**
   - Konfigurasi ambang beban (*occupied* & *release threshold*).
   - Durasi toleransi membungkuk sebelum alarm (*tolerance_seconds*).
   - Batas minimum frame warning (*warning_min_frames*).
   - Interval pengulangan suara (*remind_interval*).
   - Mode orientasi kamera (*view_mode: side / front*).
   - Validasi input form ramah dan konfirmasi penyimpanan (`PUT /config`).

5. **Riwayat Sesi & Log Event:**
   - Timeline sesi duduk dengan statistik durasi dan persentase postur tegak vs bungkuk.
   - Log event postur dengan penyaringan status (*Semua, Baik, Peringatan, Membungkuk, Tidak Terlihat*) dan paginasi.

6. **Persetujuan Pemantauan Awal (Privasi by Design):**
   - Modal konfirmasi persetujuan etis & penegasan sistem non-medis sebelum sesi pertama dimulai. Tersimpan di `localStorage`.

---

## 🛠️ Prasyarat

- **Node.js** v20+ atau v24+
- **NPM** v10+

---

## 📦 Instalasi

Masuk ke folder `pwa/` dan pasang dependensi:

```bash
cd pwa
npm install
```

Salin file lingkungan:

```bash
cp .env.example .env
```

Isi `.env` default:
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
VITE_DEFAULT_DEVICE_ID=spc-001
```

---

## 💻 Cara Menjalankan

### 1. Menjalankan Mock Server (Tanpa Backend Nyata)
Mock server menyimulasikan REST API dan WebSocket lengkap dengan berbagai skenario postur dan okupansi:

```bash
cd pwa
npm run mock
```

Mock server akan aktif di:
- **REST API:** `http://localhost:8000/api`
- **WebSocket:** `ws://localhost:8000/ws/devices/spc-001`

*Opsi skenario CLI:*
```bash
npm run mock -- --scenario slouch_long
```
Pilihan skenario: `sit_straight`, `slouch_short`, `slouch_long`, `body_not_visible`, `stand_up`, `sensor_error`, `backend_offline`.

### 2. Menjalankan Frontend PWA (Dev Server)
Di terminal baru:

```bash
cd pwa
npm run dev
```

Buka peramban di: **`http://localhost:5173`**

---

## 🧪 Pengujian & Verifikasi

### Menjalankan Unit Test
Menguji logika murni pemetaan status dan logika pengingat/mute:

```bash
npm test
```

### Memeriksa Type-Check TypeScript
```bash
npm run lint
```

### Menjalankan Verifikasi Integrasi End-to-End dengan Mock Server
Jalankan salah satu skrip verifikasi otomatis berikut:

```bash
# Verifikasi Lengkap Integrasi Dashboard & WS
npx tsx mock/verify-integration.ts

# Verifikasi Fase 6B (Pengingat Suara, ACK & Mute slouch_long)
npx tsx mock/verify-phase6b.ts

# Verifikasi Fase 6C (Wizard Kalibrasi, Config PUT, Riwayat Pagination)
npx tsx mock/verify-phase6c.ts
```

### Build Produksi PWA
```bash
npm run build
```
Hasil build produksi beserta Service Worker (`dist/sw.js`) dan Web App Manifest (`dist/manifest.webmanifest`) akan tersimpan di direktori `pwa/dist/`.

