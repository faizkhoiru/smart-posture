async function runPhase6cVerification() {
  console.log('================================================================');
  console.log('  VERIFIKASI FASE 6C: WIZARD KALIBRASI, PENGATURAN & RIWAYAT');
  console.log('================================================================');

  const BASE_URL = 'http://localhost:8000';
  const DEVICE_ID = 'spc-001';

  // 1. Uji Wizard Kalibrasi 3 Tahap
  console.log('\n[1/3] Menguji Wizard Kalibrasi Langkah demi Langkah...');

  // Tahap 1: Tare Kursi Kosong
  const tareRes = await fetch(`${BASE_URL}/api/devices/${DEVICE_ID}/calibrate/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 'empty' })
  });
  const tareData = await tareRes.json();
  console.log('  ✓ Tahap 1 (Tare Kursi Kosong):', tareData.ok ? 'OK' : 'GAGAL', tareData.profile);

  // Tahap 2: Beban Duduk (Scale)
  const scaleRes = await fetch(`${BASE_URL}/api/devices/${DEVICE_ID}/calibrate/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 'occupied', known_weight_kg: 68.5 })
  });
  const scaleData = await scaleRes.json();
  console.log('  ✓ Tahap 2 (Bobot Terisi):', scaleData.ok ? 'OK' : 'GAGAL', scaleData.profile);

  // Tahap 3: Baseline Postur Tegak
  const postureRes = await fetch(`${BASE_URL}/api/devices/${DEVICE_ID}/calibrate/posture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frames: 10 })
  });
  const postureData = await postureRes.json();
  console.log('  ✓ Tahap 3 (Baseline Geometri Postur):', postureData.ok ? 'OK' : 'GAGAL', postureData.baseline);

  const calibrationOk = tareData.ok && scaleData.ok && postureData.ok;

  // 2. Uji Pengaturan (Config)
  console.log('\n[2/3] Menguji Pengaturan Konfigurasi (GET & PUT)...');
  const getCfgRes = await fetch(`${BASE_URL}/api/devices/${DEVICE_ID}/config`);
  const initialCfg = await getCfgRes.json();
  console.log('  ✓ Konfigurasi Aktif:', `tolerance=${initialCfg.tolerance_seconds}s, remind=${initialCfg.remind_interval}s, view=${initialCfg.view_mode}`);

  const updateCfgRes = await fetch(`${BASE_URL}/api/devices/${DEVICE_ID}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tolerance_seconds: 10,
      remind_interval: 90,
      view_mode: 'front'
    })
  });
  const updateData = await updateCfgRes.json();
  console.log('  ✓ Pembaruan Konfigurasi (PUT):', updateData.ok ? 'OK' : 'GAGAL', `tolerance=${updateData.config.tolerance_seconds}s, view=${updateData.config.view_mode}`);

  const configOk = updateData.ok && updateData.config.tolerance_seconds === 10;

  // 3. Uji Riwayat (Sessions & Events + Pagination & Filter)
  console.log('\n[3/3] Menguji Riwayat Sesi & Event (Pagination + Filter)...');

  // Sesi Duduk Pagination
  const sessionPage1 = await (await fetch(`${BASE_URL}/api/devices/${DEVICE_ID}/sessions?limit=2&offset=0`)).json();
  const sessionPage2 = await (await fetch(`${BASE_URL}/api/devices/${DEVICE_ID}/sessions?limit=2&offset=2`)).json();
  console.log(`  ✓ Sesi Duduk: Hal 1 (${sessionPage1.length} sesi, ID #${sessionPage1[0]?.id}), Hal 2 (${sessionPage2.length} sesi, ID #${sessionPage2[0]?.id})`);

  // Event Postur Filter Status
  const allEvents = await (await fetch(`${BASE_URL}/api/devices/${DEVICE_ID}/events?limit=5`)).json();
  const badPostureEvents = await (await fetch(`${BASE_URL}/api/devices/${DEVICE_ID}/events?status=bad_posture`)).json();
  console.log(`  ✓ Event Postur: Total ${allEvents.length} event. Terfilter 'bad_posture': ${badPostureEvents.length} event.`);

  const historyOk = sessionPage1.length > 0 && badPostureEvents.every((e: any) => e.status === 'bad_posture');

  if (calibrationOk && configOk && historyOk) {
    console.log('\n================================================================');
    console.log('  HASIL AKHIR: SELURUH VERIFIKASI FASE 6C BERHASIL 100%!');
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.error('\n❌ Ada verifikasi yang gagal pada Fase 6C.\n');
    process.exit(1);
  }
}

runPhase6cVerification();

