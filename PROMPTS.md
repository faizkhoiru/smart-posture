# PROMPTS.md — Prompt Siap Pakai untuk AI Agent

Awali setiap sesi baru dengan **Prompt Pembuka**, lalu kirim **prompt fase** yang sesuai.

## Prompt Pembuka (setiap sesi baru)
```
Baca AGENTS.md, DESIGN_ARCHITECTURE.md, docs/API_CONTRACT.md, dan docs/TASKS.md.
Patuhi seluruh aturan di AGENTS.md. Ringkas pemahamanmu dalam maksimal 8 poin dan sebutkan
pertanyaan terbuka yang menghambat. Jangan menulis kode dulu.
```

## Fase 0
```
Kerjakan Fase 0 di docs/TASKS.md. Buat struktur repo, docker-compose, konfigurasi Mosquitto, .env.example, README awal.
Berhenti setelah verifikasi Fase 0 dan beri ringkasan sesuai AGENTS.md bagian 7.6.
```

## Fase 1
```
Kerjakan Fase 1 di docs/TASKS.md: backend dasar, model, MQTT subscriber, session_service, offline detection,
GET devices dan latest, beserta unit test. Patuhi docs/API_CONTRACT.md bagian 1 dan 3. Berhenti setelah verifikasi.
```

## Fase 2
```
Kerjakan Fase 2: endpoint upload frame (docs/API_CONTRACT.md bagian 2) dan pose.py dengan MediaPipe.
Pastikan frame tidak pernah ditulis ke disk. Buat skrip uji dari foto. Berhenti setelah verifikasi.
```

## Fase 3
```
Kerjakan Fase 3: posture_logic.py (fungsi murni, view_mode side/front, multi-frame, toleransi, pose_unavailable)
dan endpoint kalibrasi. Gunakan parameter default di DESIGN_ARCHITECTURE.md bagian 6 dan tandai sebagai
"perlu validasi". Tulis unit test sesuai docs/TESTING.md bagian 2. Berhenti setelah semua test lulus.
```

## Fase 4
```
Kerjakan Fase 4: ws_manager, WS /ws/devices/{id} dengan pesan state/pose/alert/alert_clear persis sesuai
docs/API_CONTRACT.md bagian 4, serta endpoint sessions, events, PUT config, alerts/ack, alerts/mute.
Buat skrip WS client untuk verifikasi. Berhenti setelah verifikasi.
```

## Fase 5
```
Kerjakan Fase 5: simulator/run.py dengan skenario di docs/TASKS.md. Satu perintah harus menjalankan alur
duduk -> membungkuk -> pulih -> berdiri dan menghasilkan pesan di WebSocket.
```

## Fase 6
```
Kerjakan Fase 6: PWA React sesuai docs/TASKS.md. Konsumsi WS/REST persis sesuai docs/API_CONTRACT.md,
tanpa data hardcode. Tipe pesan WS di src/types/ws.ts. Uji dengan simulator. Berhenti setelah verifikasi.
```

## Fase 7
```
Kerjakan Fase 7: jalankan 14 skenario di docs/TESTING.md dengan simulator, catat hasil dalam tabel,
perbaiki bug, lakukan pemeriksaan privasi (TESTING.md bagian 5), rapikan README.
```

## Prompt utilitas

**Review sebelum merge**
```
Tinjau perubahan terakhir terhadap AGENTS.md (bagian 5 dan 8) dan docs/API_CONTRACT.md. Daftar pelanggaran,
risiko privasi, dan celah test. Jangan mengubah kode; hanya laporkan.
```

**Debug**
```
Bug: <deskripsi + langkah reproduksi + log>. Cari akar masalah dulu, jelaskan hipotesis, lalu perbaiki dengan
perubahan minimal dan tambahkan test regresi. Jangan mengubah kontrak API.
```

**Sinkronisasi dengan tim hardware**
```
Tim hardware memberi format payload berikut: <tempel>. Bandingkan dengan docs/API_CONTRACT.md bagian 1-2,
daftar perbedaan, usulkan perubahan paling kecil (di sisi backend atau kontrak), dan minta persetujuan sebelum menerapkan.
```

**Tuning ambang postur**
```
Berdasarkan hasil uji: <data>. Usulkan penyesuaian parameter di DESIGN_ARCHITECTURE.md bagian 6 beserta alasannya.
Jangan ubah nilai default tanpa persetujuan; sajikan sebagai usulan.
```
