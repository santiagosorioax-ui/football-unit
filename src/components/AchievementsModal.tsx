import React, { useState } from 'react';
import {
  Trophy,
  X,
  CheckCircle2,
  Lock,
  Award,
  Flame,
  Target,
  Crown,
  Star,
  Shield,
  Zap,
  Clock,
  Play,
  Sparkles,
} from 'lucide-react';
import { Achievement, GlobalStats } from '../types/game';
import { ACHIEVEMENTS } from '../data/achievements';

interface AchievementsModalProps {
  isOpen: boolean;
  unlockedAchievementIds: string[];
  stats: GlobalStats;
  onClose: () => void;
}

export default function AchievementsModal({
  isOpen,
  unlockedAchievementIds,
  stats,
  onClose,
}: AchievementsModalProps) {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  if (!isOpen) return null;

  const getIcon = (iconName: string, isUnlocked: boolean) => {
    const className = `w-6 h-6 ${isUnlocked ? 'text-amber-400' : 'text-slate-500'}`;
    switch (iconName) {
      case 'trophy':
        return <Trophy className={className} />;
      case 'star':
        return <Star className={className} />;
      case 'shield':
        return <Shield className={className} />;
      case 'crown':
        return <Crown className={className} />;
      case 'flame':
        return <Flame className={className} />;
      case 'zap':
        return <Zap className={className} />;
      case 'target':
        return <Target className={className} />;
      case 'award':
        return <Award className={className} />;
      case 'play':
        return <Play className={className} />;
      case 'clock':
        return <Clock className={className} />;
      default:
        return <Sparkles className={className} />;
    }
  };

  const getProgress = (ach: Achievement): { current: number; total: number; pct: number } => {
    let current = 0;
    if (ach.category === 'wins') current = stats.wins;
    else if (ach.category === 'goals') current = stats.totalGoals;
    else if (ach.category === 'matches') current = stats.matchesPlayed;

    const total = ach.requirement;
    const isUnlocked = unlockedAchievementIds.includes(ach.id);
    const pct = isUnlocked ? 100 : Math.min(100, Math.round((current / total) * 100));
    return { current: Math.min(current, total), total, pct };
  };

  const filteredAchievements = ACHIEVEMENTS.filter((ach) => {
    const isUnlocked = unlockedAchievementIds.includes(ach.id);
    if (filter === 'unlocked') return isUnlocked;
    if (filter === 'locked') return !isUnlocked;
    return true;
  });

  const unlockedCount = unlockedAchievementIds.length;
  const totalCount = ACHIEVEMENTS.length;
  const completionPct = Math.round((unlockedCount / totalCount) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none font-sans">
      <div className="relative w-full max-w-3xl max-h-[85vh] rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-[#120505] border border-white/20 shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Top Header */}
        <header className="p-6 border-b border-white/10 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-400 shadow-md">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>Salón de Logros</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  {unlockedCount}/{totalCount}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Desbloquea medallas ganando partidos y acumulando goles
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Global Progress Bar */}
        <div className="px-6 py-4 bg-slate-900/60 border-b border-white/5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold">Progreso Total</span>
            <span className="text-amber-400 font-black">{completionPct}% Completado</span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-white/10">
            <div
              className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 h-full transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>

          {/* Quick Career Stats Summary */}
          <div className="grid grid-cols-4 gap-2 my-1">
            <div className="bg-black/40 border border-white/10 rounded-xl py-1.5 px-2 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Partidos</span>
              <div className="text-sm font-black text-white">{stats.matchesPlayed}</div>
            </div>
            <div className="bg-black/40 border border-emerald-500/30 rounded-xl py-1.5 px-2 text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-400">Victorias</span>
              <div className="text-sm font-black text-emerald-400">{stats.wins}</div>
            </div>
            <div className="bg-black/40 border border-rose-500/30 rounded-xl py-1.5 px-2 text-center">
              <span className="text-[10px] uppercase font-bold text-rose-400">Derrotas</span>
              <div className="text-sm font-black text-rose-400">{stats.losses}</div>
            </div>
            <div className="bg-black/40 border border-amber-400/30 rounded-xl py-1.5 px-2 text-center">
              <span className="text-[10px] uppercase font-bold text-amber-300">Goles</span>
              <div className="text-sm font-black text-amber-300">{stats.totalGoals}</div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                filter === 'all'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15'
              }`}
            >
              Todos ({totalCount})
            </button>
            <button
              onClick={() => setFilter('unlocked')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                filter === 'unlocked'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15'
              }`}
            >
              Desbloqueados ({unlockedCount})
            </button>
            <button
              onClick={() => setFilter('locked')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                filter === 'locked'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15'
              }`}
            >
              Por Desbloquear ({totalCount - unlockedCount})
            </button>
          </div>
        </div>

        {/* Achievement List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
          {filteredAchievements.map((ach) => {
            const isUnlocked = unlockedAchievementIds.includes(ach.id);
            const { current, total, pct } = getProgress(ach);

            return (
              <div
                key={ach.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isUnlocked
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-950/20'
                    : 'bg-slate-950/40 border-white/10 opacity-80'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                      isUnlocked
                        ? 'bg-amber-400/20 border-amber-400/50 text-amber-300 shadow-md'
                        : 'bg-slate-900 border-white/10 text-slate-600'
                    }`}
                  >
                    {isUnlocked ? getIcon(ach.icon, true) : <Lock className="w-5 h-5 text-slate-500" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4
                        className={`font-black text-sm uppercase tracking-wide ${
                          isUnlocked ? 'text-amber-300' : 'text-slate-300'
                        }`}
                      >
                        {ach.title}
                      </h4>
                      {isUnlocked && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Desbloqueado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{ach.description}</p>

                    {/* Progress Bar for Locked */}
                    {!isUnlocked && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-32 bg-slate-800 h-1.5 rounded-full overflow-hidden border border-white/10">
                          <div
                            className="bg-amber-400 h-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">
                          {current} / {total}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-amber-400 font-bold text-xs">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>+{ach.rewardCoins} Monedas</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
