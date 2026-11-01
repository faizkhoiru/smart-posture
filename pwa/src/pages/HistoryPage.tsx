import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import type { SittingSession, PostureEvent } from '../types/api';
import { getPostureStatusInfo } from '../utils/statusMapping';

interface HistoryPageProps {
  deviceId: string;
}

type HistoryTab = 'sessions' | 'events';

export const HistoryPage: React.FC<HistoryPageProps> = ({ deviceId }) => {
  const [activeTab, setActiveTab] = useState<HistoryTab>('sessions');

  // State Sesi Duduk
  const [sessions, setSessions] = useState<SittingSession[]>([]);
  const [sessionPage, setSessionPage] = useState<number>(0);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const sessionPageSize = 4;

  // State Event Postur
  const [events, setEvents] = useState<PostureEvent[]>([]);
  const [eventPage, setEventPage] = useState<number>(0);
  const [eventFilter, setEventFilter] = useState<string>('');
  const [eventsLoading, setEventsLoading] = useState<boolean>(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const eventPageSize = 5;

  // Fetch Sesi
  const loadSessions = useCallback(() => {
    setSessionsLoading(true);
    setSessionsError(null);
    apiClient
      .getSessions(deviceId, {
        limit: sessionPageSize,
        offset: sessionPage * sessionPageSize
      })
      .then((data) => {
        setSessions(data);
        setSessionsLoading(false);
      })
      .catch((err) => {
        setSessionsError(err?.message || 'Gagal memuat riwayat sesi duduk.');
        setSessionsLoading(false);
      });
  }, [deviceId, sessionPage]);

  // Fetch Event
  const loadEvents = useCallback(() => {
    setEventsLoading(true);
    setEventsError(null);
    apiClient
      .getEvents(deviceId, {
        limit: eventPageSize,
        offset: eventPage * eventPageSize,
        status: eventFilter || undefined
      })
      .then((data) => {
        setEvents(data);
        setEventsLoading(false);
      })
      .catch((err) => {
        setEventsError(err?.message || 'Gagal memuat riwayat event postur.');
        setEventsLoading(false);
      });
  }, [deviceId, eventPage, eventFilter]);

  useEffect(() => {
    if (activeTab === 'sessions') {
      loadSessions();
    } else {
      loadEvents();
    }
  }, [activeTab, loadSessions, loadEvents]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins} mnt ${secs} dtk`;
    return `${secs} detik`;
  };

  const formatDate = (isoStr: string): string => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Riwayat Sesi & Event Postur</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Pantau histori durasi duduk, keteraturan postur ergonomis, dan log peringatan.
            </p>
          </div>

          {/* Sub Tab Switcher */}
          <div className="flex p-1 bg-slate-800/80 rounded-xl border border-slate-700/60 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'sessions'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sesi Duduk
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'events'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Log Event Postur
            </button>
          </div>
        </div>

        {/* ================= TAB 1: SESI DUDUK ================= */}
        {activeTab === 'sessions' && (
          <div className="space-y-4 animate-fadeIn">
            {sessionsLoading ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin inline-block" />
                <p>Memuat daftar sesi...</p>
              </div>
            ) : sessionsError ? (
              <div className="p-6 bg-slate-800/40 rounded-xl text-center space-y-3 border border-slate-700/40">
                <p className="text-xs text-rose-400">{sessionsError}</p>
                <button
                  onClick={loadSessions}
                  className="px-4 py-1.5 bg-slate-700 text-xs text-slate-200 rounded-lg hover:bg-slate-600 transition"
                >
                  Coba Lagi
                </button>
              </div>
            ) : sessions.length === 0 ? (
              /* Empty State Ramah */
              <div className="py-12 text-center space-y-2.5">
                <div className="text-3xl">🪑</div>
                <h4 className="text-sm font-semibold text-slate-200">Belum Ada Sesi Duduk</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Sesi duduk akan otomatis dicatat setiap kali Anda menduduki kursi dan diakhiri saat Anda berdiri.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => {
                  const goodPct = Math.round(
                    (session.good_s / (session.total_sit_s || 1)) * 100
                  );
                  return (
                    <div
                      key={session.id}
                      className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 transition hover:border-slate-600/70"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-200">
                              Sesi #{session.id}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              • {formatDate(session.started_at)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            Total Duduk:{' '}
                            <strong className="text-slate-200">
                              {formatDuration(session.total_sit_s)}
                            </strong>{' '}
                            (Baik: {formatDuration(session.good_s)}, Bungkuk:{' '}
                            {formatDuration(session.bad_s)})
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <span
                            className={`text-sm font-mono font-bold ${
                              goodPct >= 80
                                ? 'text-emerald-400'
                                : goodPct >= 50
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {goodPct}% Tegak
                          </span>
                          <div className="text-[11px] text-slate-400">
                            {session.alert_count}x Peringatan
                          </div>
                        </div>
                      </div>

                      {/* Bar Visual Rasio Postur */}
                      <div className="w-full h-2 rounded-full bg-slate-900 mt-3 overflow-hidden flex">
                        <div
                          style={{ width: `${goodPct}%` }}
                          className="bg-emerald-500 h-full transition-all"
                          title={`Postur Baik: ${goodPct}%`}
                        />
                        <div
                          style={{ width: `${100 - goodPct}%` }}
                          className="bg-rose-500 h-full transition-all"
                          title={`Postur Membungkuk: ${100 - goodPct}%`}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Kontrol Pagination Sesi */}
                <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
                  <button
                    onClick={() => setSessionPage((prev) => Math.max(0, prev - 1))}
                    disabled={sessionPage === 0}
                    className="px-3 py-1.5 bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 rounded-lg transition"
                  >
                    ← Sebelumnya
                  </button>
                  <span>Halaman {sessionPage + 1}</span>
                  <button
                    onClick={() => setSessionPage((prev) => prev + 1)}
                    disabled={sessions.length < sessionPageSize}
                    className="px-3 py-1.5 bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 rounded-lg transition"
                  >
                    Berikutnya →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: LOG EVENT POSTUR ================= */}
        {activeTab === 'events' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Filter Bar Status */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400 mr-1">Filter:</span>
              {[
                { key: '', label: 'Semua' },
                { key: 'good_posture', label: 'Baik' },
                { key: 'warning', label: 'Peringatan' },
                { key: 'bad_posture', label: 'Membungkuk' },
                { key: 'pose_unavailable', label: 'Tidak Terlihat' }
              ].map((f) => {
                const isSelected = eventFilter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => {
                      setEventFilter(f.key);
                      setEventPage(0);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {eventsLoading ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin inline-block" />
                <p>Memuat log event postur...</p>
              </div>
            ) : eventsError ? (
              <div className="p-6 bg-slate-800/40 rounded-xl text-center space-y-3 border border-slate-700/40">
                <p className="text-xs text-rose-400">{eventsError}</p>
                <button
                  onClick={loadEvents}
                  className="px-4 py-1.5 bg-slate-700 text-xs text-slate-200 rounded-lg hover:bg-slate-600 transition"
                >
                  Coba Lagi
                </button>
              </div>
            ) : events.length === 0 ? (
              /* Empty State Ramah */
              <div className="py-12 text-center space-y-2.5">
                <div className="text-3xl">📝</div>
                <h4 className="text-sm font-semibold text-slate-200">Tidak Ada Log Event</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Belum ada event postur yang sesuai dengan filter yang dipilih saat ini.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {events.map((evt) => {
                  const info = getPostureStatusInfo(evt.status, 'ok');
                  return (
                    <div
                      key={evt.id}
                      className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border shrink-0 ${info.colorClasses}`}
                        >
                          {info.label}
                        </span>
                        <div>
                          <div className="text-xs text-slate-300">
                            Durasi: <strong className="text-slate-100">{evt.durasi} detik</strong> •{' '}
                            <span className="font-mono text-slate-400">
                              Akurasi: {Math.round(evt.confidence * 100)}%
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {formatDate(evt.timestamp)}
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-400 self-end sm:self-center">
                        {evt.acknowledged_at ? (
                          <span className="text-emerald-400 font-medium">✓ Diakui Pengguna</span>
                        ) : evt.status === 'bad_posture' ? (
                          <span className="text-amber-400">Belum di-ACK</span>
                        ) : (
                          <span>Otomatis</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Kontrol Pagination Event */}
                <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
                  <button
                    onClick={() => setEventPage((prev) => Math.max(0, prev - 1))}
                    disabled={eventPage === 0}
                    className="px-3 py-1.5 bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 rounded-lg transition"
                  >
                    ← Sebelumnya
                  </button>
                  <span>Halaman {eventPage + 1}</span>
                  <button
                    onClick={() => setEventPage((prev) => prev + 1)}
                    disabled={events.length < eventPageSize}
                    className="px-3 py-1.5 bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 rounded-lg transition"
                  >
                    Berikutnya →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
