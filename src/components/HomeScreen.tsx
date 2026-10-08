import React, { useState, useRef } from 'react';
import { User } from 'firebase/auth';
import fieldCardImage from '../assets/images/field_equipo_card_1791086991368.jpg';
import {
  ShoppingCart,
  Mail,
  Sparkles,
  Coins,
  Trophy,
  LogIn,
  LogOut,
  UserCheck,
  Bot,
  Globe2,
  Users,
  Swords,
  Zap,
} from 'lucide-react';
import { TeamCustomization, GlobalStats } from '../types/game';
import { sounds } from '../utils/audio';

interface HomeScreenProps {
  team: TeamCustomization;
  coins: number;
  stats: GlobalStats;
  unlockedAchievementsCount: number;
  totalAchievementsCount: number;
  unreadMailCount: number;
  onlinePlayersCount?: number;
  currentUser?: User | null;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onPlay: () => void;
  onPlayAI?: () => void;
  onTraining?: () => void;
  onOpenTeam: () => void;
  onOpenShop: () => void;
  onOpenMailbox: () => void;
  onOpenAchievements: () => void;
  onOpenOnlinePlayers?: () => void;
  incomingChallenge?: {
    challengerId: string;
    challengerName: string;
    challengerTeam: string;
    roomId: string;
  } | null;
  onAcceptChallenge?: (challenge: any) => void;
  onDeclineChallenge?: () => void;
  onOpenAuth?: () => void;
  onSignOut?: () => void;
}

export default function HomeScreen({
  team,
  coins,
  stats,
  unlockedAchievementsCount,
  totalAchievementsCount,
  unreadMailCount,
  onlinePlayersCount = 1,
  currentUser,
  onPlay,
  onPlayAI,
  onTraining,
  onOpenTeam,
  onOpenShop,
  onOpenMailbox,
  onOpenAchievements,
  onOpenOnlinePlayers,
  incomingChallenge,
  onAcceptChallenge,
  onDeclineChallenge,
  onOpenAuth,
  onSignOut,
}: HomeScreenProps) {
  const [isPlayHovered, setIsPlayHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnterPlay = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsPlayHovered(true);
  };

  const handleMouseLeavePlay = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsPlayHovered(false);
    }, 400);
  };
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#700000] select-none font-sans flex flex-col justify-between">
      {/* Deep Red Background with Stylized Floating Red Circles (Exact to video) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Deep background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#8b0000] via-[#750000] to-[#500000]" />

        {/* Floating Red Circular Bubbles with subtle shadows like in the video */}
        <div className="absolute -top-10 left-20 w-36 h-36 rounded-full bg-[#e60000] shadow-[0_10px_30px_rgba(0,0,0,0.4)] opacity-95" />
        <div className="absolute top-12 left-[36%] w-24 h-24 rounded-full bg-[#ff0000] shadow-[0_8px_25px_rgba(0,0,0,0.35)] opacity-90" />
        <div className="absolute -top-6 left-[58%] w-40 h-40 rounded-full bg-[#e60000] shadow-[0_12px_35px_rgba(0,0,0,0.4)] opacity-95" />
        <div className="absolute top-16 right-10 w-32 h-32 rounded-full bg-[#ff1a1a] shadow-[0_10px_30px_rgba(0,0,0,0.35)] opacity-90" />
        
        {/* Center-left half circle from video */}
        <div className="absolute top-[58%] left-[34%] w-28 h-28 rounded-full bg-[#e60000] shadow-[0_8px_20px_rgba(0,0,0,0.4)] opacity-85" />
        
        {/* Bottom-right darker curved wave */}
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#400000] opacity-75 blur-sm" />
      </div>

      {/* Top Header: Team Info & Logros & Coins */}
      <header className="relative z-10 px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl border-2 border-white/30 shadow-md flex items-center justify-center font-black text-sm text-white"
            style={{ backgroundColor: team.jerseyColor }}
          >
            #{team.playerNumber}
          </div>
          <div>
            <h2 className="text-white font-black text-sm sm:text-base tracking-wider uppercase drop-shadow">
              {team.teamName}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-red-200/90 font-medium mt-0.5">
              <span>Capitán: {team.playerName}</span>
              {team.playerGrl && (
                <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[10px] uppercase shadow-sm">
                  GRL {team.playerGrl}
                </span>
              )}
              {team.playerPosition && (
                <span className="px-1.5 py-0.2 rounded bg-white/20 text-white font-black text-[10px] uppercase">
                  {team.playerPosition}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Online Players Button */}
          {onOpenOnlinePlayers && (
            <button
              onClick={() => {
                sounds.playBounce();
                onOpenOnlinePlayers();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 border border-emerald-400/50 text-emerald-300 font-bold text-xs shadow-md backdrop-blur-md transition-all active:scale-95 group"
              title="Ver Jugadores en Línea y Desafíos 1v1"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <Users className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline uppercase">Online:</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-400/20 text-emerald-300 font-black text-[11px]">
                {onlinePlayersCount}
              </span>
            </button>
          )}

          {/* Button to open Logros */}
          <button
            onClick={() => {
              sounds.playBounce();
              onOpenAchievements();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 border border-amber-400/40 text-amber-300 font-bold text-xs shadow-md backdrop-blur-md transition-all active:scale-95"
            title="Ver Logros y Medallas"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline uppercase">Logros:</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 font-black text-[11px]">
              {unlockedAchievementsCount}/{totalAchievementsCount}
            </span>
          </button>

          {/* Coins badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-amber-400 font-bold text-xs shadow-md backdrop-blur-md">
            <Coins className="w-3.5 h-3.5" />
            <span>{coins}</span>
          </div>

          {/* User Account Pill / Iniciar Sesión button */}
          {currentUser ? (
            <div className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl bg-black/40 border border-emerald-500/40 text-white text-xs shadow-md backdrop-blur-md">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'Usuario'}
                  className="w-5 h-5 rounded-full border border-emerald-400 object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">
                  {currentUser.displayName?.[0] || 'U'}
                </div>
              )}
              <span className="hidden md:inline font-bold text-emerald-300 max-w-[100px] truncate">
                {currentUser.displayName || 'Entrenador'}
              </span>
              {onSignOut && (
                <button
                  onClick={() => {
                    sounds.playBounce();
                    onSignOut();
                  }}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-rose-300 transition-colors"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            onOpenAuth && (
              <button
                onClick={() => {
                  sounds.playBounce();
                  onOpenAuth();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/80 hover:bg-blue-600 border border-blue-400/40 text-white font-bold text-xs shadow-md backdrop-blur-md transition-all active:scale-95"
                title="Iniciar sesión con Google para guardar progreso"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Iniciar Sesión</span>
              </button>
            )
          )}
        </div>
      </header>

      {/* Floating Incoming Challenge Banner */}
      {incomingChallenge && (
        <div className="relative z-20 mx-4 sm:mx-8 mb-2 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/90 via-orange-600/90 to-red-600/90 text-white shadow-[0_10px_30px_rgba(245,158,11,0.5)] border border-amber-300/60 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 animate-bounce">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black/30 border border-white/30 flex items-center justify-center shrink-0">
              <Swords className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black tracking-wider text-amber-200 block">
                ¡DESAFÍO 1v1 RECIBIDO!
              </span>
              <p className="text-xs sm:text-sm font-bold drop-shadow">
                <strong>{incomingChallenge.challengerName}</strong> ({incomingChallenge.challengerTeam}) te desafía a un partido en vivo.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onAcceptChallenge && (
              <button
                onClick={() => {
                  sounds.playWhistle();
                  onAcceptChallenge(incomingChallenge);
                }}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-black text-amber-300 hover:bg-black/80 font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all whitespace-nowrap border border-amber-400/40"
              >
                ¡Aceptar Desafío!
              </button>
            )}
            {onDeclineChallenge && (
              <button
                onClick={() => {
                  sounds.playBounce();
                  onDeclineChallenge();
                }}
                className="px-3 py-2 rounded-xl bg-black/40 hover:bg-black/60 text-white/80 font-bold text-xs uppercase transition-all"
              >
                Rechazar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area (Field Card on Left + Soccer Ball on Right) */}
      <main className="relative z-10 flex-1 flex flex-col md:flex-row items-center justify-around px-6 sm:px-12 pb-6 max-w-6xl mx-auto w-full">
        {/* Left Side: "EQUIPO" Card with Field Background & Silhouette */}
        <div className="flex flex-col items-center group">
          {/* Soccer Field Card */}
          <button
            onClick={() => {
              sounds.playBounce();
              onOpenTeam();
            }}
            className="relative w-64 sm:w-80 md:w-96 h-40 sm:h-48 md:h-56 rounded-2xl overflow-hidden shadow-[0_15px_35px_rgba(0,0,0,0.6)] border-4 border-black/80 transition-all duration-300 transform group-hover:scale-105 active:scale-95 text-left focus:outline-none"
          >
            {/* Field Image */}
            <img
              src={fieldCardImage}
              alt="Cancha de Fútbol"
              className="w-full h-full object-cover filter brightness-90 group-hover:brightness-105 transition-all"
            />
            {/* Dark tint overlay */}
            <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors" />

            {/* "EQUIPO" Big Bold Black Text Centered */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl sm:text-5xl md:text-6xl font-black tracking-widest text-black/90 drop-shadow-[0_2px_10px_rgba(255,255,255,0.4)] uppercase">
                EQUIPO
              </span>
            </div>

            {/* Subtle corner badge */}
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-white/90 uppercase font-semibold flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-amber-400" />
              Personalizar
            </div>
          </button>

          {/* Player Dribbling Ball Silhouette (Exact from Video) */}
          <div className="mt-4 sm:mt-6 w-20 h-24 sm:w-24 sm:h-28 text-black opacity-95 transition-transform duration-300 group-hover:translate-x-1">
            <svg
              viewBox="0 0 100 120"
              fill="currentColor"
              className="w-full h-full filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
            >
              {/* Head */}
              <circle cx="56" cy="18" r="9" />
              {/* Torso leaning forward */}
              <path d="M48 27 L66 29 L58 60 L44 58 Z" />
              {/* Left Arm swinging back */}
              <path d="M48 30 L32 45 L35 50 L50 36 Z" />
              {/* Right Arm forward */}
              <path d="M64 31 L80 44 L77 49 L62 38 Z" />
              {/* Left Leg (kicking/trailing) */}
              <path d="M46 58 L28 85 L34 88 L52 64 Z" />
              <path d="M28 85 L20 104 L26 106 L34 88 Z" />
              {/* Right Leg (planted/dribbling) */}
              <path d="M58 59 L66 84 L58 87 L52 62 Z" />
              <path d="M66 84 L72 106 L78 105 L72 84 Z" />
              {/* Ball near foot */}
              <circle cx="82" cy="112" r="7" />
              <circle cx="82" cy="112" r="4" fill="#ffffff" />
            </svg>
          </div>
        </div>

        {/* Right Side: Big Soccer Ball Illustration (Exact from Video) */}
        <div className="relative mt-2 md:mt-0 flex items-center justify-center">
          {/* Subtle ground shadow */}
          <div className="absolute -bottom-4 w-48 sm:w-60 h-10 bg-black/40 rounded-full blur-md" />

          {/* Stylized Soccer Ball matching the video */}
          <div className="relative w-52 h-52 sm:w-64 sm:h-64 md:w-80 md:h-80 transition-transform duration-500 hover:rotate-12 cursor-pointer">
            <svg viewBox="0 0 200 200" className="w-full h-full filter drop-shadow-2xl">
              {/* Ball base circle */}
              <circle cx="100" cy="100" r="90" fill="#ffffff" stroke="#18181b" strokeWidth="4" />
              {/* Subtle 3D shading */}
              <circle cx="100" cy="100" r="90" fill="url(#ballShade)" opacity="0.3" />

              {/* Central black pentagon */}
              <polygon points="100,70 125,88 115,118 85,118 75,88" fill="#18181b" />

              {/* Surrounding panels & seam lines */}
              {/* Top panel */}
              <polygon points="100,70 100,20 125,25 125,88" fill="none" stroke="#18181b" strokeWidth="3" />
              <polygon points="100,70 100,20 75,25 75,88" fill="none" stroke="#18181b" strokeWidth="3" />
              <polygon points="75,25 100,20 125,25" fill="#18181b" />

              {/* Right panels */}
              <polygon points="125,88 175,70 185,100 115,118" fill="none" stroke="#18181b" strokeWidth="3" />
              <polygon points="175,70 190,85 185,110" fill="#18181b" />

              {/* Bottom right panel */}
              <polygon points="115,118 145,160 110,185 85,118" fill="none" stroke="#18181b" strokeWidth="3" />
              <polygon points="135,165 155,175 125,188" fill="#18181b" />

              {/* Bottom left panel */}
              <polygon points="85,118 55,160 90,185 115,118" fill="none" stroke="#18181b" strokeWidth="3" />
              <polygon points="65,165 45,175 75,188" fill="#18181b" />

              {/* Left panel */}
              <polygon points="75,88 25,70 15,100 85,118" fill="none" stroke="#18181b" strokeWidth="3" />
              <polygon points="25,70 10,85 15,110" fill="#18181b" />

              {/* Shading Gradient Def */}
              <defs>
                <radialGradient id="ballShade" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="70%" stopColor="#000000" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.65" />
                </radialGradient>
              </defs>
            </svg>
          </div>
        </div>
      </main>

      {/* Bottom Action Bar (Green Bar with Black Border from Video: JUGAR, TIENDA, BUZÓN) */}
      <footer className="relative z-20 w-full bg-[#00a854] border-t-4 border-black py-2.5 sm:py-3.5 px-4 sm:px-10 shadow-2xl flex items-center justify-around text-black font-black">
        {/* JUGAR Button (Online Multiplayer by Default + Pop-up 'Jugar con IA' on hover) */}
        <div
          className="relative flex flex-col items-center"
          onMouseEnter={handleMouseEnterPlay}
          onMouseLeave={handleMouseLeavePlay}
        >
          {/* Floating Option: JUGAR CON IA on Hover */}
          {isPlayHovered && (
            <div
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex flex-col items-center z-50 pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
              onMouseEnter={handleMouseEnterPlay}
              onMouseLeave={handleMouseLeavePlay}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  sounds.playKick();
                  setIsPlayHovered(false);
                  if (onPlayAI) onPlayAI();
                  else onPlay();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black font-black text-xs sm:text-sm tracking-wider shadow-[0_12px_30px_rgba(245,158,11,0.6)] border-2 border-black hover:brightness-110 active:scale-95 transition-all whitespace-nowrap cursor-pointer"
                title="Jugar partido individual contra la Inteligencia Artificial"
              >
                <Bot className="w-4 h-4 text-black animate-bounce" />
                <span className="uppercase font-black">JUGAR CON IA</span>
              </button>
              {/* Tooltip arrow downward */}
              <div className="w-2.5 h-2.5 bg-amber-500 rotate-45 -mt-1 border-r-2 border-b-2 border-black" />
            </div>
          )}

          {/* Main JUGAR Button (Searches for Online Match with Real Player) */}
          <button
            onClick={() => {
              sounds.playKick();
              onPlay();
            }}
            className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-1.5 sm:py-2 rounded-xl hover:bg-black/10 transition-transform active:scale-95 group focus:outline-none"
            title="Buscar partido multijugador online contra un jugador real"
          >
            <div className="flex flex-col items-start leading-none">
              <span className="text-xl sm:text-2xl md:text-3xl tracking-wider uppercase font-black">
                JUGAR
              </span>
              <span className="text-[9px] font-black tracking-widest text-emerald-950 uppercase -mt-0.5 opacity-90 hidden sm:inline">
                MULTIJUGADOR 1v1
              </span>
            </div>

            {/* Soccer Player Silhouette Icon */}
            <div className="w-6 h-6 sm:w-7 sm:h-7 text-black transform group-hover:translate-x-0.5 transition-transform">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <circle cx="15" cy="5" r="2.5" />
                <path d="M13 8 L17 9 L15 14 L12 13 Z" />
                <path d="M12 13 L8 17 L6 21 L8 21 L10 18 L13 15 Z" />
                <path d="M15 14 L18 18 L21 21 L22 20 L19 16 Z" />
                <circle cx="5" cy="21" r="2" />
              </svg>
            </div>
          </button>
        </div>

        {/* TIENDA Button */}
        <button
          onClick={() => {
            sounds.playBounce();
            onOpenShop();
          }}
          className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-1.5 sm:py-2 rounded-xl hover:bg-black/10 transition-transform active:scale-95 group focus:outline-none"
        >
          <span className="text-xl sm:text-2xl md:text-3xl tracking-wider uppercase font-black">
            TIENDA
          </span>
          <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-black transform group-hover:scale-110 transition-transform" />
        </button>

        {/* ENTRENAMIENTO Button */}
        <button
          onClick={() => {
            sounds.playKick();
            if (onTraining) onTraining();
            else onPlay();
          }}
          className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-1.5 sm:py-2 rounded-xl hover:bg-black/10 transition-transform active:scale-95 group focus:outline-none"
          title="Modo Entrenamiento: Practica tus tiros, pases y regates libremente"
        >
          <span className="text-xl sm:text-2xl md:text-3xl tracking-wider uppercase font-black">
            ENTRENAMIENTO
          </span>
          {/* Icono de Pelota de Fútbol */}
          <div className="w-6 h-6 sm:w-7 sm:h-7 text-black transform group-hover:rotate-45 transition-transform shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full drop-shadow-sm">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.2" fill="#ffffff" />
              <polygon points="12,7.5 15,9.8 14,13.8 10,13.8 9,9.8" fill="currentColor" />
              <line x1="12" y1="7.5" x2="12" y2="2" stroke="currentColor" strokeWidth="1.8" />
              <line x1="15" y1="9.8" x2="19.5" y2="7.5" stroke="currentColor" strokeWidth="1.8" />
              <line x1="14" y1="13.8" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" />
              <line x1="10" y1="13.8" x2="6" y2="18" stroke="currentColor" strokeWidth="1.8" />
              <line x1="9" y1="9.8" x2="4.5" y2="7.5" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </div>
        </button>

        {/* BUZÓN Button (with RED NOTIFICATION DOT as requested by user) */}
        <button
          onClick={() => {
            sounds.playBounce();
            onOpenMailbox();
          }}
          className="relative flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-1.5 sm:py-2 rounded-xl hover:bg-black/10 transition-transform active:scale-95 group focus:outline-none"
        >
          <span className="text-xl sm:text-2xl md:text-3xl tracking-wider uppercase font-black">
            BUZÓN
          </span>
          <div className="relative">
            <Mail className="w-6 h-6 sm:w-7 sm:h-7 text-black transform group-hover:scale-110 transition-transform" />

            {/* Red Notification Dot if there's unread items */}
            {unreadMailCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow-[0_0_8px_#dc2626] animate-pulse"
                title={`${unreadMailCount} mensajes sin leer`}
              />
            )}
          </div>
        </button>
      </footer>
    </div>
  );
}
