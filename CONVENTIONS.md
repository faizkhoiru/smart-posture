# CONVENTIONS.md — Standar Kode dan Kerja

## Umum
- Bahasa kode, nama variabel, dan komentar teknis: **Inggris**. Teks UI dan pesan pengguna: **Indonesia**.
- Kode kecil dan terfokus; satu fungsi satu tugas. Hindari duplikasi.
- Jangan tinggalkan kode mati, `print` debug, atau `TODO` tanpa isu/tugas terkait.

## Python (backend)
- Python 3.11+, type hints wajib pada fungsi publik. Format: `ruff format`; lint: `ruff check`.
- Pydantic v2 untuk semua skema request/response/pesan; jangan kirim `dict` mentah ke klien.
- Konfigurasi hanya lewat `config.py` (pydantic-settings) yang membaca `.env`.
- `posture_logic.py` dan fungsi geometri: **murni** (tanpa I/O, tanpa waktu sistem; waktu dikirim sebagai argumen).
- Logging pakai modul `logging`; jangan log data sensitif atau isi gambar. Tidak ada `except: pass`.
- Operasi berat (decode JPEG, pose) jangan memblokir event loop: gunakan thread pool / `run_in_executor`.

## TypeScript / React (PWA)
- TypeScript `strict`. Komponen fungsional + hooks. Tipe pesan WS didefinisikan di satu berkas (`src/types/ws.ts`) mengikuti `API_CONTRACT.md`.
- State global minimal (Zustand/Context); data server lewat satu modul API.
- Tailwind untuk styling; responsif mobile-first. Aksesibilitas dasar: label, kontras, fokus.
- Suara: Web Speech API `lang="id-ID"`; wajib ada tombol aktivasi (aturan autoplay).

## Penamaan
- Python: `snake_case` (fungsi/variabel), `PascalCase` (kelas). TS: `camelCase`, komponen `PascalCase`.
- Topik MQTT, kunci JSON, dan status: `snake_case` persis seperti di `API_CONTRACT.md`.
- Status resmi: `empty, occupied, calibrating, good_posture, warning, bad_posture, pose_unavailable, analysis_unavailable, sensor_error, offline`.

## Git
- Branch: `main` (stabil), `feat/<nama>`, `fix/<nama>`.
- Commit: *Conventional Commits* — `feat: ...`, `fix: ...`, `docs: ...`, `test: ...`, `chore: ...`.
- Satu commit = satu perubahan logis. Jangan commit `.env`, model besar, atau file gambar.
- Pull/merge hanya setelah test lulus.

## Konfigurasi dan secret
- Semua nilai tunable (ambang, FPS, timeout) ada di `.env`/`DeviceConfig`, bukan hardcode.
- `.env` tidak di-commit; `.env.example` selalu diperbarui bersama perubahan config.

## Dokumentasi
- Perubahan kontrak -> perbarui `docs/API_CONTRACT.md` dalam commit yang sama.
- Perubahan perilaku/cara menjalankan -> perbarui `README.md`.
