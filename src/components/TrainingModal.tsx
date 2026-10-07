import React, { useState } from 'react';
import {
  X,
  Coins,
  Trophy,
  Sparkles,
  Zap,
  CheckCircle2,
  Play,
  Flame,
  ArrowRight,
  Shield,
  Target,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '../utils/audio';
import { TeamCustomization } from '../types/game';

interface TrainingModalProps {
  isOpen: boolean;
  coins: number;
  team: TeamCustomization;
  onClose: () => void;
  onRewardCoins: (amount: number, reason: string) => void;
  onStart3DPractice: (drillType: string) => void;
}

export interface TrainingDrillItem {
  id: string;
  name: string;
  badge: string;
  description: string;
  iconType: 'tiro_libre' | 'penaltis' | 'pases' | 'tiros' | 'regates' | 'centros';
  colorTheme: string;
  gradient: string;
  statBoost: string;
  options: {
    label: string;
    detail: string;
    successMessage: string;
  }[];
}

const TRAINING_DRILLS: TrainingDrillItem[] = [
  {
    id: 'drill_tiro_libre',
    name: 'Tiro Libre',
    badge: 'Faltas con Efecto',
    description: 'Practica tiros con curva y comba por encima de la barrera defensiva para clavar el balón al ángulo.',
    iconType: 'tiro_libre',
    colorTheme: 'amber',
    gradient: 'from-amber-500/20 via-yellow-500/10 to-amber-950/40 border-amber-400/50 hover:border-amber-400',
    statBoost: '+15 Efecto y Rosca',
    options: [
      {
        label: 'Ángulo Izquierdo con Comba',
        detail: 'Tiro suave con efecto interior buscando la escuadra superior izquierda.',
        successMessage: '¡GOLAZO AL ÁNGULO! La pelota superó la barrera con un efecto perfecto a 112 km/h.',
      },
      {
        label: 'Escuadra Derecha Potente',
        detail: 'Disparo con empeine total al palo del arquero con máxima potencia.',
        successMessage: '¡IMPARABLE! Tiro potentísimo que entra pegado al poste derecho.',
      },
      {
        label: 'Tiro Raso por Debajo de la Barrera',
        detail: 'Aprovecha el salto de la defensa para colar el balón por el piso.',
        successMessage: '¡GENIALIDAD! Engañaste a la barrera al saltar y entró junto a la base del poste.',
      },
    ],
  },
  {
    id: 'drill_penaltis',
    name: 'Penaltis',
    badge: 'Punto de Penal',
    description: 'Duelo 1 contra 1 frente al portero desde los 12 pasos. Templanza, engaño visual y definición certera.',
    iconType: 'penaltis',
    colorTheme: 'rose',
    gradient: 'from-rose-500/20 via-pink-500/10 to-rose-950/40 border-rose-400/50 hover:border-rose-400',
    statBoost: '+18 Sangre Fría y Definición',
    options: [
      {
        label: 'Tiro Fuerte al Poste Izquierdo',
        detail: 'Asegurar al rincón bajo izquierdo engañando la mirada del arquero.',
        successMessage: '¡GOOOL DE PENAL! El portero adivinó el lado pero el disparo iba con demasiada colocación.',
      },
      {
        label: 'Picadita al Centro (A lo Panenka)',
        detail: 'Toque sutil por elevación al centro de la portería mientras el portero se tira.',
        successMessage: '¡CLASE PURA! El arquero se arrojó a un lado y la pelota entró flotando con sutileza.',
      },
      {
        label: 'Remate Cruzado al Ángulo Derecho',
        detail: 'Disparo alto y violento a la parte superior derecha inalcanzable.',
        successMessage: '¡FUSILASTE LA RED! Tiro al ángulo imposible de atajar.',
      },
    ],
  },
  {
    id: 'drill_pases',
    name: 'Pases',
    badge: 'Precisión y Visión',
    description: 'Entrena pases rasos al primer toque, triangulaciones rápidas y pases filtrados entre líneas defensivas.',
    iconType: 'pases',
    colorTheme: 'emerald',
    gradient: 'from-emerald-500/20 via-teal-500/10 to-emerald-950/40 border-emerald-400/50 hover:border-emerald-400',
    statBoost: '+14 Visión y Precisión',
    options: [
      {
        label: 'Pase Raso al Pie con Apoyo',
        detail: 'Entrega firme y limpia al pie del mediocentro para controlar los tiempos.',
        successMessage: '¡CONEXIÓN PERFECTA! Pase milimétrico que supera la primera línea de presión rival.',
      },
      {
        label: 'Pase Filtrado al Espacio',
        detail: 'Pase en profundidad rompiendo la espalda de los defensores para tu extremo.',
        successMessage: '¡ASISTENCIA DE LUJO! Balón quirúrgico que deja a tu delantero mano a mano con el arco.',
      },
      {
        label: 'Cambio de Frente Largo',
        detail: 'Envío aéreo de 40 metros de banda a banda para cambiar el ritmo de ataque.',
        successMessage: '¡CAMBIO MAGISTRAL! Balón que baja amortiguado para iniciar un contragolpe letal.',
      },
    ],
  },
  {
    id: 'drill_tiros',
    name: 'Tiros',
    badge: 'Potencia de Remate',
    description: 'Entrenamiento intensivo de disparos potentes desde media distancia y remates al primer toque.',
    iconType: 'tiros',
    colorTheme: 'sky',
    gradient: 'from-sky-500/20 via-blue-500/10 to-sky-950/40 border-sky-400/50 hover:border-sky-400',
    statBoost: '+16 Potencia y Acierto',
    options: [
      {
        label: 'Bomba de Media Distancia (30m)',
        detail: 'Carga de empeine total desde fuera del área grande con máxima fuerza.',
        successMessage: '¡QUÉ ZAPATAZO! Misil a 125 km/h que revienta el travesaño y pica adentro.',
      },
      {
        label: 'Volea al Primer Toque',
        detail: 'Enganchar el balón en el aire sin dejarlo caer tras un rechace defensivo.',
        successMessage: '¡TREMENDA VOLEA! Impacto limpio que entra como un rayo pegado al travesaño.',
      },
      {
        label: 'Tiro Rasante al Rincón',
        detail: 'Disparo con borde interno colocado ajustado a la base del palo derecho.',
        successMessage: '¡TIRO CLÍNICO! La pelota viaja veloz rozando el césped lejos de los guantes del portero.',
      },
    ],
  },
  {
    id: 'drill_regates',
    name: 'Regates',
    badge: 'Habilidad y Fintas',
    description: 'Entrena cambios de ritmo, bicicletas, quiebre de cintura y salidas explosivas en el mano a mano.',
    iconType: 'regates',
    colorTheme: 'purple',
    gradient: 'from-purple-500/20 via-violet-500/10 to-purple-950/40 border-purple-400/50 hover:border-purple-400',
    statBoost: '+17 Agilidad y Control',
    options: [
      {
        label: 'Bicicleta y Salida Explosiva',
        detail: 'Pasa las piernas sobre el balón rápidamente y acelera hacia el espacio.',
        successMessage: '¡DEJASTE AL RIVAL EN EL PISO! Bicicleta eléctrica y desborde imparable por la banda.',
      },
      {
        label: 'Ruleta Marsellesa en Velocidad',
        detail: 'Giro de 360 grados sobre el balón pisándolo con ambos pies.',
        successMessage: '¡MAGIA PURA! Ruleta espectacular que elude a dos defensores al mismo tiempo.',
      },
      {
        label: 'Finta de Cuerpo y Caño',
        detail: 'Amague hacia la derecha y balón por entre las piernas del marcador.',
        successMessage: '¡CAÑO HISTÓRICO! Toda la grada aplaude la genialidad técnica de tu jugador.',
      },
    ],
  },
  {
    id: 'drill_centros',
    name: 'Centros y Remates',
    badge: 'Juego Aéreo',
    description: 'Centros medidos desde las bandas y remates de cabeza o tijera conectando en el punto de penal.',
    iconType: 'centros',
    colorTheme: 'orange',
    gradient: 'from-orange-500/20 via-amber-500/10 to-orange-950/40 border-orange-400/50 hover:border-orange-400',
    statBoost: '+14 Anticipación Aérea',
    options: [
      {
        label: 'Centro con Rosca al Primer Palo',
        detail: 'Envío veloz y tenso para que el delantero anticipe de cabeza al primer poste.',
        successMessage: '¡ANTICIPO LETAL! Cabezazo cruzado al primer palo inatajable para el arquero.',
      },
      {
        label: 'Centro Pasado al Segundo Poste',
        detail: 'Balón colgado al área chica para que el extremo gane por arriba.',
        successMessage: '¡REMATE A QUEMARROPA! Gran salto y testazo picado al suelo que entra con furia.',
      },
      {
        label: 'Pase de la Muerte Atrás',
        detail: 'Desborde hasta la línea de fondo y pase retrasado al punto del penal.',
        successMessage: '¡DEFINICIÓN IMPECABLE! Asistencia perfecta para rematar sin marca de primera intención.',
      },
    ],
  },
];

export default function TrainingModal({
  isOpen,
  coins,
  team,
  onClose,
  onRewardCoins,
  onStart3DPractice,
}: TrainingModalProps) {
  const [activeDrill, setActiveDrill] = useState<TrainingDrillItem | null>(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isPracticing, setIsPracticing] = useState(false);
  const [drillSuccessResult, setDrillSuccessResult] = useState<string | null>(null);
  const [completedDrillsCount, setCompletedDrillsCount] = useState<number>(0);
  const [lastEarnedCoins, setLastEarnedCoins] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleStartDrillAction = (optionIndex: number) => {
    if (!activeDrill) return;
    setSelectedOptionIndex(optionIndex);
    setIsPracticing(true);
    sounds.playKick();

    setTimeout(() => {
      setIsPracticing(false);
      const chosenOption = activeDrill.options[optionIndex];
      setDrillSuccessResult(chosenOption.successMessage);
      sounds.playGoalCelebration();

      // Award 10 coins!
      const reward = 10;
      onRewardCoins(reward, `Entrenamiento de ${activeDrill.name}`);
      setCompletedDrillsCount((c) => c + 1);
      setLastEarnedCoins(reward);

      confetti({
        particleCount: 160,
        spread: 90,
        origin: { y: 0.6 },
      });
    }, 1200);
  };

  const handleResetDrillView = () => {
    setActiveDrill(null);
    setSelectedOptionIndex(null);
    setDrillSuccessResult(null);
  };

  const renderDrillIcon = (type: TrainingDrillItem['iconType']) => {
    switch (type) {
      case 'tiro_libre':
        return <Target className="w-6 h-6 text-amber-400" />;
      case 'penaltis':
        return <Flame className="w-6 h-6 text-rose-400" />;
      case 'pases':
        return <Zap className="w-6 h-6 text-emerald-400" />;
      case 'tiros':
        return <Sparkles className="w-6 h-6 text-sky-400" />;
      case 'regates':
        return <Trophy className="w-6 h-6 text-purple-400" />;
      case 'centros':
        return <Shield className="w-6 h-6 text-orange-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md font-sans select-none overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] rounded-3xl bg-gradient-to-br from-slate-950 via-[#0a0f1d] to-[#040711] border-2 border-white/20 shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Top Header */}
        <header className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between bg-slate-950/80 backdrop-blur-md">
          <div className="flex items-center gap-3.5">
            {/* Animated Soccer Ball Icon */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 shadow-lg shadow-amber-500/30 flex items-center justify-center">
              <div className="w-full h-full rounded-2xl bg-slate-950 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-amber-400">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.2" fill="#ffffff" />
                  <polygon points="12,7.5 15,9.8 14,13.8 10,13.8 9,9.8" fill="#18181b" />
                  <line x1="12" y1="7.5" x2="12" y2="2" stroke="#18181b" strokeWidth="1.8" />
                  <line x1="15" y1="9.8" x2="19.5" y2="7.5" stroke="#18181b" strokeWidth="1.8" />
                  <line x1="14" y1="13.8" x2="18" y2="18" stroke="#18181b" strokeWidth="1.8" />
                  <line x1="10" y1="13.8" x2="6" y2="18" stroke="#18181b" strokeWidth="1.8" />
                  <line x1="9" y1="9.8" x2="4.5" y2="7.5" stroke="#18181b" strokeWidth="1.8" />
                </svg>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase text-amber-400 tracking-wider">
                  Centro de Alto Rendimiento
                </span>
                <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black text-[10px]">
                  +10 MONEDAS POR SESIÓN
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-white flex items-center gap-2">
                Centro de Entrenamiento
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Coins counter */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-amber-400/40 text-amber-300 font-black text-sm shadow-md">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>{coins} Monedas</span>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Reward Alert Banner when 10 coins earned */}
        {lastEarnedCoins && (
          <div className="w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 px-6 py-2.5 font-black text-xs sm:text-sm flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 fill-slate-950" />
              <span>
                ¡Entrenamiento exitoso! Has recibido <strong>+{lastEarnedCoins} monedas</strong> para fichar jugadores en la tienda.
              </span>
            </div>
            <button
              onClick={() => setLastEarnedCoins(null)}
              className="p-1 hover:bg-black/10 rounded-lg text-slate-950"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Active Drill Interactive Challenge Screen */}
          {activeDrill ? (
            <div className="bg-slate-900/90 border-2 border-white/20 rounded-3xl p-5 sm:p-7 space-y-6 backdrop-blur-md shadow-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                    {renderDrillIcon(activeDrill.iconType)}
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider">
                      {activeDrill.badge}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-white uppercase">
                      {activeDrill.name}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 font-black text-xs flex items-center gap-1.5 shadow">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span>Premio: +10 Monedas</span>
                  </div>
                  <button
                    onClick={() => {
                      sounds.playKick();
                      onClose();
                      onStart3DPractice(activeDrill.id);
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-950" />
                    <span>¡Entrenar en el Campo! ⚽</span>
                  </button>
                  <button
                    onClick={handleResetDrillView}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-xs"
                  >
                    Volver
                  </button>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                {activeDrill.description}
              </p>

              {/* Simulation Result or Interactive Practice Options */}
              {drillSuccessResult ? (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 border-2 border-emerald-400 text-center space-y-4 shadow-xl">
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-black text-emerald-400 tracking-wider">
                      ¡Entrenamiento Completado!
                    </span>
                    <h4 className="text-lg sm:text-xl font-black text-white mt-1">
                      {drillSuccessResult}
                    </h4>
                    <p className="text-xs text-amber-300 font-bold mt-2 flex items-center justify-center gap-1.5">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span>Has ganado +10 monedas acreditadas a tu cuenta</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => setDrillSuccessResult(null)}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg active:scale-95"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Entrenar Otra Vez (+10 Monedas)</span>
                    </button>
                    <button
                      onClick={handleResetDrillView}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
                    >
                      Volver a la Lista
                    </button>
                  </div>
                </div>
              ) : isPracticing ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-16 h-16 rounded-full border-4 border-amber-400 border-t-transparent animate-spin flex items-center justify-center">
                    <Zap className="w-6 h-6 text-amber-400 animate-pulse" />
                  </div>
                  <h4 className="text-lg font-black uppercase text-amber-300">
                    Ejecutando Entrenamiento...
                  </h4>
                  <p className="text-xs text-slate-400">
                    Ajustando la pegada, curva y velocidad del balón...
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Elige la jugada técnica a practicar:
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {activeDrill.options.map((option, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-slate-950/80 border border-white/15 hover:border-amber-400 text-left transition-all group shadow-lg flex flex-col justify-between"
                      >
                        <div>
                          <div className="text-xs font-extrabold text-amber-300 mb-1 flex items-center justify-between">
                            <span>Variante {idx + 1}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-black">
                              +10 🪙
                            </span>
                          </div>
                          <h5 className="font-black text-sm text-white group-hover:text-amber-300 transition-colors mb-1.5">
                            {option.label}
                          </h5>
                          <p className="text-[11px] text-slate-400 leading-snug">
                            {option.detail}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center gap-2">
                          <button
                            onClick={() => {
                              sounds.playKick();
                              onClose();
                              onStart3DPractice(activeDrill.id);
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
                          >
                            <Play className="w-3.5 h-3.5 fill-slate-950" />
                            <span>Entrenar en Cancha ⚽</span>
                          </button>
                          <button
                            onClick={() => handleStartDrillAction(idx)}
                            className="w-full sm:w-auto py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs active:scale-95 transition-colors"
                            title="Completar sesión rápida"
                          >
                            Rápido
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action to launch 3D match penalty if this is penalties drill */}
              {activeDrill.id === 'drill_penaltis' && (
                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    ¿Quieres jugar la tanda de penaltis completa en la cancha 3D monumental?
                  </span>
                  <button
                    onClick={() => {
                      onClose();
                      onStart3DPractice('penalties');
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Jugar Tanda de Penaltis 3D</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Training Drills Catalog (Buttons Requested by User) */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>Rutinas de Entrenamiento Técnico</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Selecciona cualquier entrenamiento para realizar la práctica y ganar <strong>10 monedas</strong> por cada uno.
                  </p>
                </div>

                <div className="px-3 py-1 rounded-xl bg-slate-900 border border-white/10 text-xs font-bold text-slate-300">
                  Completados hoy: <strong className="text-amber-400">{completedDrillsCount}</strong>
                </div>
              </div>

              {/* Grid of the 6 Training Drill Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {TRAINING_DRILLS.map((drill) => (
                  <div
                    key={drill.id}
                    onClick={() => {
                      sounds.playBounce();
                      setActiveDrill(drill);
                    }}
                    className={`rounded-2xl border p-4.5 bg-gradient-to-br ${drill.gradient} backdrop-blur-md cursor-pointer transition-all hover:translate-y-[-2px] active:scale-95 group shadow-xl flex flex-col justify-between`}
                  >
                    <div>
                      {/* Top Row: Icon + Badge + 10 Coins Reward Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-slate-950/80 border border-white/15 group-hover:scale-110 transition-transform">
                            {renderDrillIcon(drill.iconType)}
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                              {drill.badge}
                            </span>
                            <div className="text-[10px] font-bold text-slate-400">
                              {drill.statBoost}
                            </div>
                          </div>
                        </div>

                        {/* REWARD BADGE: 10 MONEDAS */}
                        <div className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs shadow-md flex items-center gap-1 group-hover:scale-105 transition-transform">
                          <Coins className="w-3.5 h-3.5 fill-slate-950" />
                          <span>+10</span>
                        </div>
                      </div>

                      {/* Main Title Button Name */}
                      <h4 className="text-base sm:text-lg font-black uppercase text-white group-hover:text-amber-300 transition-colors mb-1.5 flex items-center justify-between">
                        <span>{drill.name}</span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-300 transform group-hover:translate-x-1 transition-transform" />
                      </h4>

                      <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                        {drill.description}
                      </p>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sounds.playKick();
                          onClose();
                          onStart3DPractice(drill.id);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-slate-950" />
                        <span>Ir al Campo ⚽</span>
                      </button>
                      <button
                        onClick={() => {
                          sounds.playBounce();
                          setActiveDrill(drill);
                        }}
                        className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase transition-colors"
                      >
                        Detalles
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Practice in 3D Pitch Action Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/60 to-slate-900 border border-white/15 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Play className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-sm uppercase text-white">
                  Práctica Libre en Cancha 3D Monumental
                </h4>
                <p className="text-xs text-slate-300">
                  Salta al césped con tus 11 titulares para practicar tiros con ratón, regates y pases sin límite de tiempo.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                onStart3DPractice('free');
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 shrink-0"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Entrar a la Cancha 3D</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
