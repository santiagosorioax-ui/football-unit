import React from 'react';
import {
  Users,
  X,
  Swords,
  Shield,
  Circle,
  Sparkles,
  Bot,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { UserPresenceData } from '../lib/firebase';
import { sounds } from '../utils/audio';

interface OnlinePlayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onlinePlayers: UserPresenceData[];
  currentUserId: string;
  onChallengePlayer: (player: UserPresenceData) => void;
  onAcceptChallenge: (challenge: NonNullable<UserPresenceData['incomingChallenge']>) => void;
  incomingChallenge?: UserPresenceData['incomingChallenge'] | null;
  onPlayQuickMatch: () => void;
}

export default function OnlinePlayersModal({
  isOpen,
  onClose,
  onlinePlayers,
  currentUserId,
  onChallengePlayer,
  onAcceptChallenge,
  incomingChallenge,
  onPlayQuickMatch,
}: OnlinePlayersModalProps) {
  if (!isOpen) return null;

  // Filter out self from list
  const otherPlayers = onlinePlayers.filter((p) => p.userId !== currentUserId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-zinc-900 via-zinc-900 to-black rounded-3xl border-2 border-emerald-500/40 shadow-[0_20px_60px_rgba(16,185,129,0.25)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-24 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 px-6 pt-6 pb-4 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white uppercase tracking-wide">
                  JUGADORES EN LÍNEA
                </h2>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  {onlinePlayers.length} Conectados
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-medium">
                Desafía a otros directores técnicos a un partido 1v1 en tiempo real
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playBounce();
              onClose();
            }}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Incoming Challenge Banner */}
        {incomingChallenge && (
          <div className="relative z-10 mx-6 mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/10 border-2 border-amber-500/60 shadow-lg animate-pulse flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/30 text-amber-300 flex items-center justify-center">
                <Swords className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-amber-400 block">
                  ¡DESAFÍO RECIBIDO!
                </span>
                <p className="text-xs font-bold text-white">
                  <strong>{incomingChallenge.challengerName}</strong> te ha retado a un partido con{' '}
                  <span className="text-amber-300">{incomingChallenge.challengerTeam}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                sounds.playWhistle();
                onAcceptChallenge(incomingChallenge);
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md whitespace-nowrap"
            >
              ¡Aceptar Desafío!
            </button>
          </div>
        )}

        {/* Players List */}
        <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-3">
          {otherPlayers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-zinc-500 mb-3">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                No hay otros rivales en la sala en este instante
              </h3>
              <p className="text-xs text-zinc-400 max-w-xs mb-5">
                Abre otra pestaña del juego para probar el multijugador 1v1 o inicia una búsqueda rápida automática.
              </p>
              <button
                onClick={() => {
                  sounds.playKick();
                  onClose();
                  onPlayQuickMatch();
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all"
              >
                <Zap className="w-4 h-4" />
                <span>Buscar Rival Aleatorio</span>
              </button>
            </div>
          ) : (
            otherPlayers.map((player) => {
              const statusColors = {
                menu: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
                matchmaking: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
                in_match: 'bg-red-500/20 text-red-400 border-red-500/40',
              };

              const statusLabels = {
                menu: 'Disponible',
                matchmaking: 'Buscando Rival',
                in_match: 'En Partido',
              };

              return (
                <div
                  key={player.userId}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-800/50 hover:bg-zinc-800/80 border border-zinc-700/60 transition-all group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Team Kit Badge */}
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm border-2 shadow-md shrink-0"
                      style={{
                        backgroundColor: player.jerseyColor || '#2563eb',
                        borderColor: player.shortsColor || '#ffffff',
                        color: '#ffffff',
                      }}
                    >
                      {player.playerNumber || 10}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[200px]">
                          {player.displayName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase shrink-0 ${
                            statusColors[player.status] || statusColors.menu
                          }`}
                        >
                          {statusLabels[player.status] || 'Disponible'}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-400 font-medium truncate block max-w-[180px]">
                        {player.teamName}
                      </span>
                    </div>
                  </div>

                  {/* Challenge Button */}
                  <button
                    onClick={() => {
                      sounds.playWhistle();
                      onChallengePlayer(player);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 shrink-0"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Desafiar</span>
                    <span className="sm:hidden">Retar</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="relative z-10 px-6 py-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-400">
            Tu equipo:{' '}
            <strong className="text-white">
              {onlinePlayers.find((p) => p.userId === currentUserId)?.teamName || 'Local'}
            </strong>
          </div>
          <button
            onClick={() => {
              sounds.playKick();
              onClose();
              onPlayQuickMatch();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>Búsqueda Rápida 1v1</span>
          </button>
        </div>
      </div>
    </div>
  );
}
