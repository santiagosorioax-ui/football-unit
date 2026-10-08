import React, { useEffect, useState, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  Globe2,
  Users,
  Bot,
  X,
  Sparkles,
  Shield,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  Zap,
  Radio,
  RefreshCw,
} from 'lucide-react';
import {
  createMatchRoom,
  findPublicMatchRoom,
  joinMatchRoom,
  listenToMatchRoom,
  leaveOrCancelMatchRoom,
  updateMatchRoomState,
  getReadableErrorMessage,
  MatchRoomData,
} from '../lib/firebase';
import { TeamCustomization } from '../types/game';
import { sounds } from '../utils/audio';

interface MatchmakingModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: TeamCustomization;
  currentUser: User | null;
  onPlayAI: () => void;
  onMatchFound: (roomData: MatchRoomData, role: 'host' | 'guest') => void;
}

export default function MatchmakingModal({
  isOpen,
  onClose,
  team,
  currentUser,
  onPlayAI,
  onMatchFound,
}: MatchmakingModalProps) {
  const [matchStatus, setMatchStatus] = useState<
    'searching' | 'found' | 'error' | 'code_mode'
  >('searching');
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [currentRoom, setCurrentRoom] = useState<MatchRoomData | null>(null);
  const [userRole, setUserRole] = useState<'host' | 'guest'>('host');
  const [opponent, setOpponent] = useState<{
    name: string;
    teamName: string;
    jerseyColor: string;
    shortsColor: string;
  } | null>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [inputCode, setInputCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeRoomIdRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMatchConfirmedRef = useRef(false);
  const heartbeatTimerRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);

  // Per-tab unique session ID so multiple browser tabs don't collide when testing
  const [playerId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      let sId = sessionStorage.getItem('fu_session_player_id');
      if (!sId) {
        sId =
          (currentUser?.uid ? `${currentUser.uid}_` : 'p_') +
          Date.now().toString(36) +
          '_' +
          Math.random().toString(36).substring(2, 6);
        sessionStorage.setItem('fu_session_player_id', sId);
      }
      return sId;
    }
    return 'player_' + Math.random().toString(36).substring(2, 6);
  });

  const playerName =
    currentUser?.displayName || team.playerName || 'Jugador Real';

  // Search timer
  useEffect(() => {
    let timer: any;
    if (isOpen && matchStatus === 'searching') {
      timer = setInterval(() => {
        setSearchSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, matchStatus]);

  // Clean up previous room listener (never marks abandoned if match was confirmed!)
  const cleanupRoom = async () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (isMatchConfirmedRef.current) {
      return;
    }

    if (activeRoomIdRef.current) {
      const rId = activeRoomIdRef.current;
      activeRoomIdRef.current = null;
      try {
        await leaveOrCancelMatchRoom(rId, playerId);
      } catch (e) {
        console.warn('Error cleaning up room:', e);
      }
    }
  };

  // Trigger match found with bulletproof countdown & single-execution guarantee
  const triggerMatchFound = (room: MatchRoomData, role: 'host' | 'guest') => {
    if (isMatchConfirmedRef.current) return;
    isMatchConfirmedRef.current = true;

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    setMatchStatus('found');
    sounds.playCheer();
    sounds.playWhistle();

    let count = 3;
    setCountdown(count);

    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        sounds.playBounce();
      } else {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        activeRoomIdRef.current = null;
        onMatchFound(room, role);
      }
    }, 1000);
  };

  // Start public matchmaking
  const startPublicMatchmaking = async () => {
    isMatchConfirmedRef.current = false;
    await cleanupRoom();
    setMatchStatus('searching');
    setSearchSeconds(0);
    setErrorMessage(null);
    setOpponent(null);

    // 1. Try to find and join an existing waiting room
    const tryJoinExistingRoom = async (): Promise<boolean> => {
      try {
        const existingRoom = await findPublicMatchRoom(playerId);
        if (existingRoom && existingRoom.id) {
          const joined = await joinMatchRoom(existingRoom.id, {
            id: playerId,
            name: playerName,
            team,
          });

          setUserRole('guest');
          activeRoomIdRef.current = joined.id;
          setCurrentRoom(joined);

          setOpponent({
            name: joined.hostName || 'Rival Online',
            teamName: joined.hostTeam?.teamName || 'Rival FC',
            jerseyColor: joined.hostTeam?.jerseyColor || '#ef4444',
            shortsColor: joined.hostTeam?.shortsColor || '#18181b',
          });

          // Guest also subscribes to the room
          const unsub = listenToMatchRoom(joined.id, (room) => {
            if (!room) return;
            setCurrentRoom(room);
          });
          unsubscribeRef.current = unsub;

          triggerMatchFound(joined, 'guest');
          return true;
        }
      } catch (err) {
        console.warn('Attempt to join room failed, falling back to creating host room:', err);
      }
      return false;
    };

    const didJoin = await tryJoinExistingRoom();
    if (didJoin) return;

    // 2. No room available, create a fresh waiting room as Host
    try {
      setUserRole('host');
      const created = await createMatchRoom({
        id: playerId,
        name: playerName,
        team,
      });

      setCurrentRoom(created);
      activeRoomIdRef.current = created.id;

      // Listen for incoming guest player
      const unsub = listenToMatchRoom(created.id, (room) => {
        if (!room) return;
        setCurrentRoom(room);

        if (
          room.guestId &&
          (room.status === 'starting' || room.status === 'playing') &&
          !isMatchConfirmedRef.current
        ) {
          setOpponent({
            name: room.guestName || 'Rival Online',
            teamName: room.guestTeam?.teamName || 'Rival FC',
            jerseyColor: room.guestTeam?.jerseyColor || '#ef4444',
            shortsColor: room.guestTeam?.shortsColor || '#18181b',
          });
          triggerMatchFound(room, 'host');
        }
      });
      unsubscribeRef.current = unsub;

      // Keep room alive with heartbeat every 4 seconds
      heartbeatTimerRef.current = setInterval(() => {
        if (activeRoomIdRef.current && !isMatchConfirmedRef.current) {
          updateMatchRoomState(activeRoomIdRef.current, {
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }
      }, 4000);
    } catch (err: any) {
      console.error('Matchmaking error:', err);
      setErrorMessage(getReadableErrorMessage(err));
      setMatchStatus('error');
    }
  };

  // Join private room with code
  const handleJoinWithCode = async () => {
    const cleanCode = inputCode.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().trim();
    if (!cleanCode) return;
    sounds.playKick();
    setErrorMessage(null);
    try {
      await cleanupRoom();
      activeRoomIdRef.current = cleanCode;
      const joined = await joinMatchRoom(cleanCode, {
        id: playerId,
        name: playerName,
        team,
      });
      setCurrentRoom(joined);
      setUserRole('guest');

      setOpponent({
        name: joined.hostName || 'Rival Online',
        teamName: joined.hostTeam?.teamName || 'Rival FC',
        jerseyColor: joined.hostTeam?.jerseyColor || '#ef4444',
        shortsColor: joined.hostTeam?.shortsColor || '#18181b',
      });

      const unsub = listenToMatchRoom(cleanCode, (room) => {
        if (!room) return;
        setCurrentRoom(room);
      });
      unsubscribeRef.current = unsub;

      triggerMatchFound(joined, 'guest');
    } catch (err: any) {
      setErrorMessage(getReadableErrorMessage(err));
      setMatchStatus('error');
    }
  };

  // Create private room with code
  const handleCreatePrivateRoom = async () => {
    sounds.playBounce();
    setErrorMessage(null);
    try {
      await cleanupRoom();
      const code = 'GOL' + Math.floor(1000 + Math.random() * 9000);
      setUserRole('host');
      const created = await createMatchRoom(
        {
          id: playerId,
          name: playerName,
          team,
        },
        code
      );
      setCurrentRoom(created);
      activeRoomIdRef.current = created.id;
      setMatchStatus('searching');

      heartbeatTimerRef.current = setInterval(() => {
        if (activeRoomIdRef.current && !isMatchConfirmedRef.current) {
          updateMatchRoomState(activeRoomIdRef.current, {
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }
      }, 4000);

      const unsub = listenToMatchRoom(created.id, (room) => {
        if (!room) return;
        setCurrentRoom(room);
        if (
          room.guestId &&
          (room.status === 'starting' || room.status === 'playing') &&
          !isMatchConfirmedRef.current
        ) {
          setOpponent({
            name: room.guestName || 'Rival Online',
            teamName: room.guestTeam?.teamName || 'Rival FC',
            jerseyColor: room.guestTeam?.jerseyColor || '#ef4444',
            shortsColor: room.guestTeam?.shortsColor || '#18181b',
          });
          triggerMatchFound(room, 'host');
        }
      });
      unsubscribeRef.current = unsub;
    } catch (err: any) {
      setErrorMessage(getReadableErrorMessage(err));
      setMatchStatus('error');
    }
  };

  // Launch on open
  useEffect(() => {
    if (isOpen) {
      startPublicMatchmaking();
    } else {
      cleanupRoom();
    }
    return () => {
      cleanupRoom();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-xl bg-gradient-to-b from-zinc-900 via-zinc-900 to-black rounded-3xl border-2 border-emerald-500/40 shadow-[0_20px_60px_rgba(16,185,129,0.3)] overflow-hidden flex flex-col">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 px-6 pt-6 pb-4 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase">
                  PARTIDO ONLINE 1v1
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase">
                  EN VIVO
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-medium">
                {matchStatus === 'found'
                  ? '¡Emparejamiento exitoso! Conectando a la cancha...'
                  : 'Buscando rival online en tiempo real'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playBounce();
              cleanupRoom();
              onClose();
            }}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            title="Cancelar y volver"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Body */}
        <div className="relative z-10 p-6 flex flex-col items-center">
          {/* SEARCHING STATE */}
          {matchStatus === 'searching' && (
            <div className="w-full flex flex-col items-center">
              {/* Radar Scanner Animation */}
              <div className="relative w-44 h-44 sm:w-52 sm:h-52 my-3 flex items-center justify-center">
                {/* Outer concentric pulsing rings */}
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping opacity-35" />
                <div className="absolute inset-4 rounded-full border border-emerald-400/30" />
                <div className="absolute inset-8 rounded-full border border-emerald-400/20" />
                <div className="absolute inset-14 rounded-full border border-emerald-400/20" />

                {/* Radar Rotating Sweep */}
                <div className="absolute inset-0 rounded-full overflow-hidden">
                  <div
                    className="w-full h-full rounded-full origin-center animate-spin"
                    style={{
                      animationDuration: '3s',
                      background:
                        'conic-gradient(from 0deg, rgba(16,185,129,0.4) 0deg, rgba(16,185,129,0) 90deg, transparent 360deg)',
                    }}
                  />
                </div>

                {/* Center Ball Icon */}
                <div className="relative z-10 w-16 h-16 rounded-full bg-zinc-900 border-2 border-emerald-400 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.5)]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="w-9 h-9 text-emerald-400 animate-spin"
                    style={{ animationDuration: '6s' }}
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <polygon points="12,7.5 15,9.8 14,13.8 10,13.8 9,9.8" fill="currentColor" />
                    <line x1="12" y1="7.5" x2="12" y2="2" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="15" y1="9.8" x2="19.5" y2="7.5" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="14" y1="13.8" x2="18" y2="18" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="10" y1="13.8" x2="6" y2="18" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="9" y1="9.8" x2="4.5" y2="7.5" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>

              {/* Status & Search Timer */}
              <div className="text-center mt-1 mb-4">
                <span className="inline-block px-3 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-emerald-400 text-xs font-mono font-bold tracking-wider mb-2">
                  TIEMPO DE BÚSQUEDA: {formatTime(searchSeconds)}
                </span>
                <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  Buscando rival disponible...
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm mt-1">
                  Emparejando con otro usuario en línea en el servidor oficial de Football Unit.
                </p>
              </div>

              {/* Versus Preview Cards */}
              <div className="w-full grid grid-cols-2 gap-3 p-3 rounded-2xl bg-zinc-800/40 border border-zinc-700/50 mb-5">
                {/* You */}
                <div className="flex flex-col items-center text-center p-2.5 rounded-xl bg-zinc-900/60 border border-emerald-500/30">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border shadow-sm mb-1.5"
                    style={{
                      backgroundColor: team.jerseyColor,
                      borderColor: team.shortsColor,
                      color: '#ffffff',
                    }}
                  >
                    {team.playerNumber || 10}
                  </div>
                  <span className="text-xs font-bold text-white truncate max-w-[120px]">
                    {playerName} (Tú)
                  </span>
                  <span className="text-[10px] text-zinc-400 font-semibold truncate max-w-[120px]">
                    {team.teamName}
                  </span>
                  <span className="mt-1 px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                    {userRole === 'host' ? 'LOCAL' : 'VISITANTE'}
                  </span>
                </div>

                {/* Opponent (Waiting) */}
                <div className="flex flex-col items-center text-center p-2.5 rounded-xl bg-zinc-900/30 border border-dashed border-zinc-700 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-500 font-black text-lg mb-1.5 border border-zinc-700">
                    ?
                  </div>
                  <span className="text-xs font-bold text-zinc-400">
                    Buscando Rival...
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    Servidor en línea
                  </span>
                  <span className="mt-1 px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 text-[9px] font-bold">
                    {userRole === 'host' ? 'VISITANTE' : 'LOCAL'}
                  </span>
                </div>
              </div>

              {/* Room Code Share if Host */}
              {currentRoom && currentRoom.id && (
                <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-800/60 border border-zinc-700 mb-4 text-xs">
                  <span className="text-zinc-400">
                    Código de sala:{' '}
                    <strong className="text-emerald-400 font-mono tracking-wider text-sm">
                      {currentRoom.id}
                    </strong>
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentRoom.id);
                      setCopiedCode(true);
                      sounds.playBounce();
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-semibold text-[11px] transition-all"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FOUND STATE */}
          {matchStatus === 'found' && opponent && (
            <div className="w-full flex flex-col items-center py-4 animate-scale-up">
              <div className="px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-black text-xs tracking-wider uppercase mb-4 flex items-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ¡RIVAL ENCONTRADO!
              </div>

              {/* VS Matchup Showcase */}
              <div className="w-full grid grid-cols-2 gap-4 p-4 rounded-2xl bg-zinc-800/80 border border-zinc-700 mb-6">
                {/* You */}
                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-zinc-900 border border-emerald-500/40 shadow-md">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl border-2 shadow-lg mb-2"
                    style={{
                      backgroundColor: team.jerseyColor,
                      borderColor: team.shortsColor,
                      color: '#ffffff',
                    }}
                  >
                    {team.playerNumber || 10}
                  </div>
                  <span className="text-sm font-black text-white">{playerName}</span>
                  <span className="text-xs text-emerald-400 font-semibold">{team.teamName}</span>
                  <span className="mt-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    {userRole === 'host' ? 'LOCAL' : 'VISITANTE'}
                  </span>
                </div>

                {/* Opponent */}
                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-zinc-900 border border-amber-500/40 shadow-md">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl border-2 shadow-lg mb-2"
                    style={{
                      backgroundColor: opponent.jerseyColor || '#ef4444',
                      borderColor: opponent.shortsColor || '#18181b',
                      color: '#ffffff',
                    }}
                  >
                    9
                  </div>
                  <span className="text-sm font-black text-white">{opponent.name}</span>
                  <span className="text-xs text-amber-400 font-semibold">{opponent.teamName}</span>
                  <span className="mt-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                    {userRole === 'host' ? 'VISITANTE' : 'LOCAL'}
                  </span>
                </div>
              </div>

              {/* Countdown Launch */}
              <div className="flex flex-col items-center">
                <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">
                  Iniciando partido en
                </span>
                <div className="text-5xl font-black text-emerald-400 font-mono animate-bounce drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]">
                  {countdown}
                </div>
              </div>
            </div>
          )}

          {/* CODE / PRIVATE ROOM MODE */}
          {matchStatus === 'code_mode' && (
            <div className="w-full flex flex-col items-center py-2">
              <h3 className="text-base font-bold text-white mb-2">
                Unirse a Sala de Amigo con Código
              </h3>
              <p className="text-xs text-zinc-400 text-center mb-4">
                Ingresa el código que te compartió tu amigo para jugar directamente contra él.
              </p>

              <div className="w-full flex gap-2 mb-4">
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="EJ: GOL482"
                  maxLength={16}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white font-mono font-bold tracking-wider placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleJoinWithCode}
                  disabled={!inputCode.trim()}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black text-xs uppercase transition-all shadow-md active:scale-95"
                >
                  Unirse
                </button>
              </div>

              <div className="w-full border-t border-zinc-800 pt-4 flex flex-col items-center">
                <span className="text-xs text-zinc-400 mb-2">¿Quieres ser el anfitrión?</span>
                <button
                  onClick={handleCreatePrivateRoom}
                  className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white font-bold text-xs transition-all"
                >
                  Crear Nueva Sala Privada con Código
                </button>
              </div>
            </div>
          )}

          {/* ERROR STATE */}
          {matchStatus === 'error' && (
            <div className="w-full flex flex-col items-center py-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center mb-3">
                <X className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                No se pudo conectar a la sala
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mb-4">{errorMessage}</p>
              <button
                onClick={startPublicMatchmaking}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase transition-all shadow-md active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reintentar Búsqueda</span>
              </button>
            </div>
          )}

          {/* Bottom Action Alternatives */}
          <div className="w-full border-t border-zinc-800/80 pt-4 mt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Play AI Immediate Fallback Button as requested by user */}
            <button
              onClick={() => {
                sounds.playKick();
                cleanupRoom();
                onPlayAI();
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-black text-xs transition-all active:scale-95 shadow-sm"
              title="¿No deseas esperar? Juega inmediatamente contra la Inteligencia Artificial"
            >
              <Bot className="w-4 h-4 text-amber-400" />
              <span>Jugar con IA ahora</span>
            </button>

            {/* Toggle Room Code or Cancel */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {matchStatus === 'code_mode' ? (
                <button
                  onClick={() => {
                    sounds.playBounce();
                    startPublicMatchmaking();
                  }}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition-colors"
                >
                  Volver a Búsqueda Rápida
                </button>
              ) : (
                <button
                  onClick={() => {
                    sounds.playBounce();
                    setMatchStatus('code_mode');
                  }}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold text-xs transition-colors"
                >
                  Usar Código Privado
                </button>
              )}

              <button
                onClick={() => {
                  sounds.playBounce();
                  cleanupRoom();
                  onClose();
                }}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
