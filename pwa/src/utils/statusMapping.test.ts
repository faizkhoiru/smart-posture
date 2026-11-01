import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getChairStatusInfo,
  getPostureStatusInfo,
  getDeviceStatusInfo,
  getConnectionStatusInfo
} from './statusMapping';

describe('statusMapping utils', () => {
  it('harus memetakan status kursi dengan benar', () => {
    assert.equal(getChairStatusInfo('occupied').label, 'Pengguna Terdeteksi');
    assert.equal(getChairStatusInfo('empty').label, 'Kursi Kosong');
    assert.equal(getChairStatusInfo('calibrating').label, 'Sedang Kalibrasi');
  });

  it('harus memetakan status postur dengan benar', () => {
    assert.equal(getPostureStatusInfo('good_posture', 'ok').label, 'Postur Baik');
    assert.equal(getPostureStatusInfo('warning', 'ok').label, 'Perlu Perbaikan (Peringatan)');
    assert.equal(getPostureStatusInfo('bad_posture', 'ok').label, 'Perlu Perbaikan (Membungkuk)');
    assert.equal(getPostureStatusInfo('pose_unavailable', 'ok').label, 'Pose Tidak Terlihat');
    assert.equal(getPostureStatusInfo(null, 'ok').label, 'Tidak Aktif');
  });

  it('harus memprioritaskan analisis tidak tersedia saat analysis_unavailable', () => {
    const info = getPostureStatusInfo('good_posture', 'analysis_unavailable');
    assert.equal(info.label, 'Analisis Tidak Tersedia');
    assert.equal(info.variant, 'warning');
  });

  it('harus memetakan status device dengan benar', () => {
    assert.equal(getDeviceStatusInfo('online').label, 'Perangkat Online');
    assert.equal(getDeviceStatusInfo('offline').label, 'Perangkat Offline');
    assert.equal(getDeviceStatusInfo('sensor_error').label, 'Kerusakan Sensor');
  });

  it('harus memetakan status koneksi WebSocket dengan benar', () => {
    assert.equal(getConnectionStatusInfo('connected').label, 'Terhubung');
    assert.equal(getConnectionStatusInfo('reconnecting').label, 'Menghubungkan Ulang...');
    assert.equal(getConnectionStatusInfo('disconnected').label, 'Terputus');
  });
});

