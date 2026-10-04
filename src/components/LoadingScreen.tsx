import React, { useEffect, useState } from 'react';
import heroImage from '../assets/images/football_unit_hero_1791083886852.jpg';
import { sounds } from '../utils/audio';

interface LoadingScreenProps {
  onComplete: () => void;
  durationSeconds?: number;
}

const loadingTips = [
  'Iniciando motor 3D y renderizado...',
  'Preparando el césped del estadio...',
  'Calibrando física del balón y gravedad...',
  'Entrenando tácticas de la IA rival...',
  'Alineando porterías y banderines...',
  'Ajustando la cámara de seguimiento...',
  '¡Todo listo para el saque inicial!',
];

export default function LoadingScreen({
  onComplete,
  durationSeconds = 20,
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  useEffect(() => {
    const startTime = performance.now();
    const durationMs = durationSeconds * 1000;

    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const currentProgress = Math.min((elapsed / durationMs) * 100, 100);
      setProgress(currentProgress);

      const tipIdx = Math.min(
        Math.floor((currentProgress / 100) * loadingTips.length),
        loadingTips.length - 1
      );
      setCurrentTipIndex(tipIdx);

      if (currentProgress >= 100) {
        clearInterval(interval);
        sounds.playWhistle(true);
        setTimeout(() => {
          onComplete();
        }, 400);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [durationSeconds, onComplete]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-sans flex flex-col justify-between p-6 md:p-12 z-50">
      {/* Background Hero Image with Dark Blend */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src={heroImage}
          alt="Football Unit Player"
          className="w-full h-full object-cover object-center opacity-85 brightness-95"
        />
        {/* Dark Vignette Overlay to match the video aesthetic */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/20 to-black/70" />
      </div>

      {/* Top Left: Logo & Title (FOOTBALL UNIT) */}
      <div className="relative z-10 pt-4 md:pt-6">
        <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black italic tracking-tighter text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)] uppercase leading-none">
          FOOTBALL
        </h1>

        {/* Horizontal Red Banner with "UNIT" */}
        <div className="relative mt-2 -ml-6 md:-ml-12 w-80 sm:w-96 md:w-[480px] h-12 md:h-16 bg-gradient-to-r from-red-600 via-red-600/90 to-transparent flex items-center px-8 md:px-14 shadow-lg border-y border-red-500/40">
          <span className="text-2xl sm:text-3xl md:text-4xl font-black italic tracking-wider text-white uppercase drop-shadow-md">
            UNIT
          </span>
        </div>
      </div>

      {/* Right Bottom Decorative Red Gradient Band (from the video) */}
      <div className="absolute right-0 bottom-16 w-1/3 sm:w-1/4 h-12 md:h-14 bg-gradient-to-l from-red-600/90 via-red-700/60 to-transparent pointer-events-none" />

      {/* Bottom Area: Subtitle, Animated Red Loading Bar under the boy */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 md:pb-6">
        {/* Left Tagline from the video */}
        <div className="space-y-1">
          <p className="text-xs sm:text-sm font-semibold tracking-[0.25em] text-slate-300 uppercase drop-shadow">
            THE JOURNEY OF MODERN FOOTBALL
          </p>
          <p className="text-[11px] text-red-400 font-mono tracking-wider">
            {loadingTips[currentTipIndex]}
          </p>
        </div>

        {/* The Red Loading Bar (under the boy) */}
        <div className="w-full max-w-sm md:max-w-md mx-auto md:mx-0 flex flex-col items-center md:items-start gap-2">
          {/* Animated Red Bar Frame */}
          <div className="relative w-full h-8 sm:h-9 bg-red-950/80 rounded-2xl p-1 border-2 border-red-600/70 shadow-[0_0_20px_rgba(220,38,38,0.5)] overflow-hidden backdrop-blur-md">
            {/* The Animated Filling Red Gradient */}
            <div
              className="h-full bg-gradient-to-r from-red-700 via-red-600 to-red-500 rounded-xl relative transition-all duration-100 ease-out shadow-inner flex items-center justify-end pr-2"
              style={{ width: `${Math.max(progress, 3)}%` }}
            >
              {/* Light Shimmer Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse rounded-xl" />
            </div>

            {/* Glowing Accent Point */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full blur-[2px] opacity-75 pointer-events-none transition-all duration-100"
              style={{
                left: `calc(${progress}% - 8px)`,
                display: progress < 5 || progress > 98 ? 'none' : 'block',
              }}
            />
          </div>

          {/* Percentage Progress (without seconds) */}
          <div className="w-full flex items-center justify-between text-xs font-mono font-medium text-slate-400 px-1">
            <span>Cargando...</span>
            <span className="text-red-400 font-semibold">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
