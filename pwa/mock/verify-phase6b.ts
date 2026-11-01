import { WebSocket } from 'ws';

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPhase6bVerification() {
  console.log('================================================================');
  console.log('  VERIFIKASI FASE 6B: PENGINGAT SUARA, ALERT, ACK & MUTE (slouch_long)');
  console.log('================================================================');

  const ws = new WebSocket('ws://localhost:8000/ws/devices/spc-001');

  let alertMessageReceived: any = null;
  let alertClearReceived = false;
  let mutedStateReceived = false;
  let politeTextVerified = false;

  ws.on('open', () => {
    console.log('[1/4] WebSocket terhubung ke mock server.');
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());

    if (msg.type === 'alert') {
      alertMessageReceived = msg;
      console.log('  🔔 Pesan Alert diterima via WS:', JSON.stringify(msg));

      // Verifikasi pesan ramah & non-medis
      const text = msg.message.toLowerCase();
      const isPolite = text.includes('silakan') || text.includes('perlahan') || text.includes('lebih nyaman');
      const noMedical = !text.includes('skoliosis') && !text.includes('penyakit') && !text.includes('klinis');
      politeTextVerified = isPolite && noMedical;
    }

    if (msg.type === 'alert_clear') {
      alertClearReceived = true;
      console.log('  🌿 Pesan Alert Clear diterima via WS (postur kembali normal).');
    }

    if (msg.type === 'state' && msg.muted_until) {
      mutedStateReceived = true;
      console.log('  🔇 State terupdate dengan status muted_until:', msg.muted_until);
    }
  });

  // Tunggu koneksi WS stabil
  await wait(1500);

  // 1. Picu skenario slouch_long
  console.log('\n[2/4] Memicu skenario "slouch_long" ke mock server...');
  const scenarioRes = await fetch('http://localhost:8000/api/mock/scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'slouch_long' })
  });
  const scenarioData = await scenarioRes.json();
  console.log('  Aktifkan skenario:', scenarioData);

  console.log('  Menunggu deteksi temporal: warning -> bad_posture -> alert (5 detik)...');
  await wait(5500);

  if (!alertMessageReceived) {
    console.error('  ❌ Gagal: Tidak menerima alert dalam 5 detik.');
    process.exit(1);
  }

  console.log('  ✓ Pesan Alert berhasil diterima:', alertMessageReceived.message);
  console.log('  ✓ Verifikasi nada teks sopan & non-medis:', politeTextVerified ? 'LULUS (Sopan & Etis)' : 'GAGAL');

  // 2. Uji POST /alerts/ack ("Saya Mengerti")
  console.log('\n[3/4] Menguji tombol "Saya Mengerti" (POST /api/devices/spc-001/alerts/ack)...');
  const ackRes = await fetch('http://localhost:8000/api/devices/spc-001/alerts/ack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id: alertMessageReceived.event_id })
  });
  const ackData = await ackRes.json();
  console.log('  ✓ Response ACK:', ackData);

  // 3. Uji POST /alerts/mute ("Jeda 5 Menit")
  console.log('\n[4/4] Menguji tombol "Jeda 5 Menit" (POST /api/devices/spc-001/alerts/mute)...');
  const muteRes = await fetch('http://localhost:8000/api/devices/spc-001/alerts/mute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minutes: 5 })
  });
  const muteData = await muteRes.json();
  console.log('  ✓ Response Mute:', muteData);

  await wait(1000);
  console.log('  ✓ State muted_until tersiar ke klien WS:', mutedStateReceived ? 'YA' : 'TIDAK');

  // 4. Uji Pemulihan (alert_clear saat kembali tegak)
  console.log('\n[Opsional] Menguji pemulihan (alert_clear) saat kembali tegak (sit_straight)...');
  await fetch('http://localhost:8000/api/mock/scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'sit_straight' })
  });
  await wait(2000);
  console.log('  ✓ Sinyal alert_clear diterima:', alertClearReceived ? 'YA (Pengingat disembunyikan otomatis)' : 'TIDAK');

  ws.close();

  if (alertMessageReceived && politeTextVerified && ackData.ok && muteData.muted_until && mutedStateReceived && alertClearReceived) {
    console.log('\n================================================================');
    console.log('  HASIL AKHIR: SELURUH PENGUJIAN FASE 6B LULUS DENGAN SUKSES!');
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.error('\n❌ Ada langkah verifikasi yang gagal.\n');
    process.exit(1);
  }
}

runPhase6bVerification();

