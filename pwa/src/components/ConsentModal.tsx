import React from 'react';

interface ConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export const CONSENT_STORAGE_KEY = 'spc_monitoring_consent_accepted';

export const ConsentModal: React.FC<ConsentModalProps> = ({ isOpen, onAccept }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-slate-100">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xl shrink-0">
            🌱
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              Persetujuan Pemantauan Postur
            </h2>
            <p className="text-xs text-slate-400">Smart Posture Corrector (Alat Bantu Ergonomi)</p>
          </div>
        </div>

        <div className="text-xs sm:text-sm text-slate-300 space-y-3 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
          <p>
            Selamat datang! Sebelum memulai sesi pertama, mohon pahami prinsip kerja dan komitmen privasi sistem ini:
          </p>

          <div className="space-y-2.5">
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/40">
              <strong className="text-slate-100 block mb-0.5">1. Alat Bantu Kebiasaan, Bukan Medis</strong>
              <p className="text-xs text-slate-400">
                Sistem ini dirancang semata-mata untuk mengingatkan Anda agar duduk dengan rileks dan tegak. Sistem ini <span className="text-amber-300 font-medium">bukan perangkat medis</span> dan tidak mendiagnosis kelainan tulang belakang.
              </p>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/40">
              <strong className="text-slate-100 block mb-0.5">2. Privasi Terjamin (No Image Stored)</strong>
              <p className="text-xs text-slate-400">
                Kamera hanya aktif saat Anda menduduki kursi. Foto diolah secara temporer di memori untuk mengambil titik sendi (skeleton) dan <span className="text-emerald-300 font-medium">seketika dihapus tanpa disimpan</span> ke penyimpanan server maupun database.
              </p>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/40">
              <strong className="text-slate-100 block mb-0.5">3. Kendali & Kenyamanan Anda</strong>
              <p className="text-xs text-slate-400">
                Anda bebas mematikan suara, menjeda pengingat ("Jeda 5 menit"), atau menghentikan pemantauan cukup dengan berdiri dari kursi kapan saja.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row gap-2 justify-end">
          <button
            onClick={onAccept}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-md shadow-indigo-600/20"
          >
            Saya Mengerti & Mulai Pemantauan
          </button>
        </div>
      </div>
    </div>
  );
};

