import React from 'react';

interface ConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export const CONSENT_STORAGE_KEY = 'spc_monitoring_consent_accepted';

export const ConsentModal: React.FC<ConsentModalProps> = ({ isOpen, onAccept }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0d0e17]/95 border border-white/10 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] flex flex-col gap-5 text-slate-100">
        <div className="flex items-center gap-3.5 border-b border-white/10 pb-4">
          <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-2xl shrink-0">
            🌱
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Persetujuan Pemantauan Postur
            </h2>
            <p className="text-xs text-slate-400">Smart Posture Corrector (Alat Bantu Ergonomi)</p>
          </div>
        </div>

        <div className="text-xs sm:text-sm text-slate-300 space-y-3.5 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
          <p>
            Selamat datang! Sebelum memulai sesi pertama, mohon pahami prinsip kerja dan komitmen privasi sistem ini:
          </p>

          <div className="space-y-3">
            <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5">
              <strong className="text-white block mb-0.5">1. Alat Bantu Kebiasaan, Bukan Medis</strong>
              <p className="text-xs text-slate-400">
                Sistem ini dirancang semata-mata untuk mengingatkan Anda agar duduk dengan rileks dan tegak. Sistem ini <span className="text-amber-300 font-medium">bukan perangkat medis</span> dan tidak mendiagnosis kelainan tulang belakang.
              </p>
            </div>

            <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5">
              <strong className="text-white block mb-0.5">2. Privasi Terjamin (No Image Stored)</strong>
              <p className="text-xs text-slate-400">
                Kamera hanya aktif saat Anda menduduki kursi. Foto diolah secara temporer di memori untuk mengambil titik sendi (skeleton) dan <span className="text-emerald-300 font-medium">seketika dihapus tanpa disimpan</span> ke penyimpanan server maupun database.
              </p>
            </div>

            <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5">
              <strong className="text-white block mb-0.5">3. Kendali & Kenyamanan Anda</strong>
              <p className="text-xs text-slate-400">
                Anda bebas mematikan suara, menjeda pengingat ("Jeda 5 menit"), atau menghentikan pemantauan cukup dengan berdiri dari kursi kapan saja.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row gap-2 justify-end">
          <button
            onClick={onAccept}
            className="w-full sm:w-auto px-6 py-2.5 bg-white text-slate-950 hover:bg-slate-200 rounded-full text-xs sm:text-sm font-bold transition shadow-lg shadow-white/10 active:scale-95"
          >
            Saya Mengerti & Mulai Pemantauan
          </button>
        </div>
      </div>
    </div>
  );
};
