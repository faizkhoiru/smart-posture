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
        return { stroke: '#34d399', fill: '#10b981', glow: 'rgba(52, 211, 153, 0.6)' };
      case 'warning':
        return { stroke: '#fbbf24', fill: '#f59e0b', glow: 'rgba(251, 191, 36, 0.6)' };
      case 'bad_posture':
        return { stroke: '#f87171', fill: '#ef4444', glow: 'rgba(248, 113, 113, 0.6)' };
      default:
        return { stroke: '#a78bfa', fill: '#8b5cf6', glow: 'rgba(167, 139, 250, 0.4)' };
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

    // Futuristic grid background
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Center ergonomic spine guide line subtly
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Map keypoints by name
    const validKeypoints = new Map<KeypointName, Keypoint>();
    for (const kp of keypoints) {
      if (kp.visibility >= minVisibility) {
        validKeypoints.set(kp.name, kp);
      }
    }

    if (cameraState === 'off' || validKeypoints.size === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const msg = cameraState === 'off' ? 'Kamera nonaktif' : 'Tubuh tidak terdeteksi dalam frame';
      ctx.fillText(msg, width / 2, height / 2);
      return;
    }

    const colors = getColor(postureState);

    // 1. Gambar Garis Koneksi Tulang dengan efek neon glow
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = colors.stroke;
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [startName, endName] of CONNECTIONS) {
      const p1 = validKeypoints.get(startName);
      const p2 = validKeypoints.get(endName);
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    }

    // 2. Gambar Sendi / Keypoints sebagai node neon
    for (const [, kp] of validKeypoints.entries()) {
      const cx = kp.x * width;
      const cy = kp.y * height;

      // Outer glow circle
      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = colors.fill;
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = 14;
      ctx.fill();

      // Inner bright core
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.fill();
    }
  }, [keypoints, confidence, postureState, minVisibility, cameraState]);

  return (
    <div className={`relative flex flex-col items-center justify-center rounded-2xl overflow-hidden bg-[#0a0b12]/90 border border-white/10 ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-64 sm:h-80 block"
      />
      {/* Floating Confidence Badge */}
      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-black/60 backdrop-blur-md border border-white/10 text-slate-300">
        Conf: <span className="text-purple-300 font-semibold">{Math.round(confidence * 100)}%</span>
      </div>
    </div>
  );
};
