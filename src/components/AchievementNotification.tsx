import React, { useEffect } from 'react';
import { Trophy, Sparkles, X, Award } from 'lucide-react';
import { Achievement } from '../types/game';

interface AchievementNotificationProps {
  achievement: Achievement | null;
  onDismiss: () => void;
}

export default function AchievementNotification({
  achievement,
  onDismiss,
}: AchievementNotificationProps) {
  useEffect(() => {
    if (!achievement) return;

    const timer = setTimeout(() => {
      onDismiss();
    }, 5500);

    return () => clearTimeout(timer);
  }, [achievement, onDismiss]);

  if (!achievement) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto max-w-md w-[92vw] sm:w-[420px] animate-bounce">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/90 border-2 border-amber-400 p-4 shadow-[0_0_35px_rgba(251,191,36,0.6)] backdrop-blur-xl text-white">
        {/* Shiny top glow */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-12 bg-amber-400/30 blur-xl pointer-events-none" />

        <div className="flex items-center gap-3.5 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 border border-yellow-200 flex items-center justify-center text-slate-950 shadow-lg flex-shrink-0 animate-pulse">
            <Trophy className="w-7 h-7 fill-slate-950" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-black uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              <span>¡LOGRO DESBLOQUEADO!</span>
            </div>
            <h4 className="text-white font-black text-base truncate drop-shadow">
              {achievement.title}
            </h4>
            <p className="text-slate-300 text-xs truncate">
              {achievement.description}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <button
              onClick={onDismiss}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 font-black text-[11px] flex items-center gap-1">
              <Award className="w-3 h-3" />
              +{achievement.rewardCoins}
            </span>
          </div>
        </div>

        {/* Bottom progress indicator */}
        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-3">
          <div className="bg-gradient-to-r from-amber-400 to-yellow-300 h-full w-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}
