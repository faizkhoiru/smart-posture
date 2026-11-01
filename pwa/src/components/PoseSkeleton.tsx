import React, { useEffect, useRef } from 'react';
import type { Keypoint, KeypointName, PostureState } from '../types/ws';

interface PoseSkeletonProps {
  keypoints: Keypoint[];
  confidence: number;
  postureState: PostureState;
  minVisibility?: number;
  cameraState?: 'on' | 'off';
  className?: string;
}

const CONNECTIONS: [KeypointName, KeypointName][] = [
  ['nose', 'left_ear'],
  ['nose', 'right_ear'],
  ['left_ear', 'left_shoulder'],
  ['right_ear', 'right_shoulder'],
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip']
];

export const PoseSkeleton: React.FC<PoseSkeletonProps> = ({
  keypoints,
  confidence,
  postureState,
  minVisibility = 0.5,
  cameraState = 'on',
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const getColor = (posture: PostureState): { stroke: string; fill: string; glow: string } => {
    switch (posture) {
      case 'good_posture':
        return { stroke: '#10b981', fill: '#34d399', glow: 'rgba(16, 185, 129, 0.4)' };
      case 'warning':
        return { stroke: '#f59e0b', fill: '#fbbf24', glow: 'rgba(245, 158, 11, 0.4)' };
      case 'bad_posture':
        return { stroke: '#ef4444', fill: '#f87171', glow: 'rgba(239, 68, 68, 0.4)' };
      default:
        return { stroke: '#94a3b8', fill: '#cbd5e1', glow: 'rgba(148, 163, 184, 0.2)' };
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI display
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Background grid / guide line subtly
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    // Map keypoints by name
    const validKeypoints = new Map<KeypointName, Keypoint>();
    for (const kp of keypoints) {
      if (kp.visibility >= minVisibility) {
        validKeypoints.set(kp.name, kp);
      }
    }

    if (cameraState === 'off' || validKeypoints.size === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const msg = cameraState === 'off' ? 'Kamera nonaktif' : 'Tubuh tidak terdeteksi dalam frame';
      ctx.fillText(msg, width / 2, height / 2);
      return;
    }

    const colors = getColor(postureState);

    // 1. Gambar Garis Koneksi Tulang
    ctx.lineWidth = 3;
    ctx.strokeStyle = colors.stroke;
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [p1Name, p2Name] of CONNECTIONS) {
      const p1 = validKeypoints.get(p1Name);
      const p2 = validKeypoints.get(p2Name);

      if (p1 && p2) {
        const x1 = p1.x * width;
        const y1 = p1.y * height;
        const x2 = p2.x * width;
        const y2 = p2.y * height;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // 2. Gambar Titik Sendi (Joints)
    ctx.shadowBlur = 4;
    for (const kp of validKeypoints.values()) {
      const x = kp.x * width;
      const y = kp.y * height;

      // Lingkaran luar
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = colors.fill;
      ctx.fill();

      // Lingkaran inti
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }, [keypoints, confidence, postureState, minVisibility, cameraState]);

  return (
    <div className={`relative bg-slate-900/90 rounded-xl border border-slate-700/60 overflow-hidden flex flex-col ${className}`}>
      {/* Header Canvas Info */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 backdrop-blur-sm">
          Akurasi: {Math.round(confidence * 100)}%
        </span>
        <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 backdrop-blur-sm">
          {keypoints.filter((k) => k.visibility >= minVisibility).length}/7 Titik
        </span>
      </div>

      {/* Canvas Element */}
      <canvas
        ref={canvasRef}
        className="w-full h-64 md:h-72 touch-none block"
      />

      {/* Bottom Status Caption */}
      <div className="p-2.5 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span>Visualisasi Pose MediaPipe (0–1 norm)</span>
        <span className="font-mono text-[11px] text-slate-400">Toleransi min. {minVisibility}</span>
      </div>
    </div>
  );
};

