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

Format catatan hasil: tabel `No | Lulus/Gagal | Catatan | Tanggal`.

## 4. Metrik keberhasilan (target awal MVP, harus divalidasi)

| Metrik | Target |
|---|---|
| Deteksi okupansi | >= 95% pada skenario uji |
| False trigger okupansi | <= 5% (kursi kosong, gangguan ringan) |
| Ketersediaan upload frame | >= 95% pada jaringan stabil |
| Delay event ke PWA | <= 3 detik setelah inferensi selesai |
| False alarm postur | < 10% pada skenario uji internal (definisikan label dan jumlah sampel) |
| Operasi kontinu | >= 4 jam |
| Kalibrasi | <= 5 menit oleh pengguna uji |

## 5. Pemeriksaan privasi (wajib sebelum selesai)

- [ ] Tidak ada file gambar di disk setelah sesi (`find . -name "*.jpg"` kosong di folder data)
- [ ] Tidak ada kolom gambar/blob di database
- [ ] Indikator kamera aktif muncul di UI saat `camera=on`
- [ ] Tidak ada secret di repo (`git grep -i "key\|password\|secret"` ditinjau)

## 6. Cara menjalankan

```bash
cd backend && pytest -q
python simulator/run.py --scenario slouch_long --device spc-001
```
