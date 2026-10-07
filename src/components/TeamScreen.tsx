import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Check,
  Sparkles,
  Shirt,
  Search,
  Star,
  Trophy,
  Shield,
  Zap,
  Flame,
  UserCheck,
  Lock,
  ShoppingCart,
  LayoutGrid,
  X,
  Crown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '../utils/audio';
import { TeamCustomization } from '../types/game';
import {
  WORLD_CUP_PLAYERS,
  PlayerData,
  PlayerPosition,
  getPlayerPrice,
  getPlayerById,
  DEFAULT_LINEUP_IDS,
} from '../data/players';

interface TeamScreenProps {
  customization: TeamCustomization;
  unlockedPlayerIds?: string[];
  onSave: (updated: TeamCustomization) => void;
  onBack: () => void;
  onOpenShop?: () => void;
}

const colorPresets = [
  { name: 'Azul Real', hex: '#2563eb' },
  { name: 'Rojo Furia', hex: '#dc2626' },
  { name: 'Verde Césped', hex: '#16a34a' },
  { name: 'Amarillo Oro', hex: '#eab308' },
  { name: 'Blanco Puro', hex: '#f8fafc' },
  { name: 'Negro Élite', hex: '#18181b' },
  { name: 'Morado Real', hex: '#9333ea' },
  { name: 'Naranja Fuego', hex: '#ea580c' },
  { name: 'Turquesa', hex: '#06b6d4' },
];

const positionFilters: { key: string; label: string; count: number }[] = [
  { key: 'TODOS', label: 'Todos', count: WORLD_CUP_PLAYERS.length },
  { key: 'POR', label: 'Porteros (POR)', count: WORLD_CUP_PLAYERS.filter((p) => p.position === 'POR').length },
  { key: 'DFC', label: 'Centrales (DFC)', count: WORLD_CUP_PLAYERS.filter((p) => p.position === 'DFC').length },
  { key: 'LI', label: 'Laterales Izq (LI)', count: WORLD_CUP_PLAYERS.filter((p) => p.position === 'LI').length },
  { key: 'LD', label: 'Laterales Der (LD)', count: WORLD_CUP_PLAYERS.filter((p) => p.position === 'LD').length },
  { key: 'MCD', label: 'Pivotes (MCD)', count: WORLD_CUP_PLAYERS.filter((p) => p.position === 'MCD').length },
  { key: 'MC', label: 'Medios (MC)', count: WORLD_CUP_PLAYERS.filter((p) => p.position === 'MC').length },
  { key: 'MCO', label: 'Mediapuntas (MCO)', count: WORLD_CUP_PLAYERS.filter((p) => p.position === 'MCO').length },
  { key: 'EI', label: 'Extremos Izq (EI)', count: WORLD_CUP_PLAYERS.filter((p) => p.position === 'EI').length },
  { key: 'ED', label: 'Extremos Der (ED)', count: WORLD_CUP_PLAYERS.filter((p) => p.position === 'ED').length },
  { key: 'DC', label: 'Delanteros (DC)', count: WORLD_CUP_PLAYERS.filter((p) => p.position === 'DC').length },
];

const HIGHLIGHTED_IDS = [
  'messi',
  'cristiano_ronaldo',
  'haaland',
  'neymar',
  'bellingham',
  'marcelo',
  'dibu_martinez',
];

interface PitchSlot {
  slot: number;
  label: string;
  role: PlayerPosition;
  topPct: number;
  leftPct: number;
}

const PITCH_SLOTS: PitchSlot[] = [
  // Delantera (Attack)
  { slot: 10, label: 'Extremo Izquierdo', role: 'EI', topPct: 15, leftPct: 18 },
  { slot: 9, label: 'Delantero Centro', role: 'DC', topPct: 10, leftPct: 50 },
  { slot: 8, label: 'Extremo Derecho', role: 'ED', topPct: 15, leftPct: 82 },

  // Mediocampo (Midfield)
  { slot: 6, label: 'Mediocentro Izq', role: 'MC', topPct: 37, leftPct: 26 },
  { slot: 5, label: 'Pivote Defensivo', role: 'MCD', topPct: 47, leftPct: 50 },
  { slot: 7, label: 'Mediocentro Der', role: 'MC', topPct: 37, leftPct: 74 },

  // Defensa (Defense)
  { slot: 4, label: 'Lateral Izquierdo', role: 'LI', topPct: 69, leftPct: 14 },
  { slot: 3, label: 'Central Izq', role: 'DFC', topPct: 73, leftPct: 38 },
  { slot: 2, label: 'Central Der', role: 'DFC', topPct: 73, leftPct: 62 },
  { slot: 1, label: 'Lateral Derecho', role: 'LD', topPct: 69, leftPct: 86 },

  // Portería (Goalkeeper)
  { slot: 0, label: 'Portero', role: 'POR', topPct: 89, leftPct: 50 },
];

export default function TeamScreen({
  customization,
  unlockedPlayerIds = [],
  onSave,
  onBack,
  onOpenShop,
}: TeamScreenProps) {
  const [data, setData] = useState<TeamCustomization>(() => ({
    ...customization,
    lineup: customization.lineup || DEFAULT_LINEUP_IDS,
  }));
  const [activeTab, setActiveTab] = useState<'cancha' | 'players' | 'kit'>('cancha');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('TODOS');
  const [onlyHighlights, setOnlyHighlights] = useState(false);
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'unlocked' | 'locked'>('unlocked');
  const [savedNotice, setSavedNotice] = useState(false);
  const [autoEquipNotice, setAutoEquipNotice] = useState<string | null>(null);

  // Slot currently selected to swap on pitch
  const [activeSwapSlot, setActiveSwapSlot] = useState<PitchSlot | null>(null);
  const [swapSearch, setSwapSearch] = useState('');
  const [selectedSlotForSwap, setSelectedSlotForSwap] = useState<number | null>(null);

  // Selected captain player object
  const currentCaptain = useMemo(() => {
    if (data.playerId) {
      return WORLD_CUP_PLAYERS.find((p) => p.id === data.playerId);
    }
    return (
      WORLD_CUP_PLAYERS.find((p) => p.shortName.toLowerCase() === data.playerName.toLowerCase()) ||
      WORLD_CUP_PLAYERS.slice(-1)[0]
    );
  }, [data.playerId, data.playerName]);

  // Current lineup mapping with fallbacks
  const currentLineup = useMemo(() => {
    return data.lineup || DEFAULT_LINEUP_IDS;
  }, [data.lineup]);

  // Average GRL of current 11 on the pitch
  const averageGrl = useMemo(() => {
    const playerObjects = Object.values(currentLineup)
      .map((id) => getPlayerById(id))
      .filter((p): p is PlayerData => p !== undefined);

    if (playerObjects.length === 0) return 80;
    const sum = playerObjects.reduce((acc, p) => acc + p.grl, 0);
    return Math.round(sum / playerObjects.length);
  }, [currentLineup]);

  // Filtered player list for Tab 2 (Catálogo)
  const filteredPlayers = useMemo(() => {
    return WORLD_CUP_PLAYERS.filter((player) => {
      const isUnlocked = unlockedPlayerIds.includes(player.id);
      if (ownershipFilter === 'unlocked' && !isUnlocked) return false;
      if (ownershipFilter === 'locked' && isUnlocked) return false;

      if (onlyHighlights && !HIGHLIGHTED_IDS.includes(player.id)) {
        return false;
      }
      if (selectedPosition !== 'TODOS' && player.position !== selectedPosition) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = player.name.toLowerCase().includes(query);
        const matchesShort = player.shortName.toLowerCase().includes(query);
        const matchesCountry = player.country.toLowerCase().includes(query);
        return matchesName || matchesShort || matchesCountry;
      }
      return true;
    }).sort((a, b) => b.grl - a.grl);
  }, [selectedPosition, searchQuery, onlyHighlights, ownershipFilter, unlockedPlayerIds]);

  // Filtered available players for Swap Modal
  const availableSwapPlayers = useMemo(() => {
    return unlockedPlayerIds
      .map((id) => getPlayerById(id))
      .filter((p): p is PlayerData => p !== undefined)
      .filter((player) => {
        if (!swapSearch.trim()) return true;
        const q = swapSearch.toLowerCase();
        return (
          player.name.toLowerCase().includes(q) ||
          player.shortName.toLowerCase().includes(q) ||
          player.country.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Prioritize exact position match
        if (activeSwapSlot) {
          const aMatch = a.position === activeSwapSlot.role;
          const bMatch = b.position === activeSwapSlot.role;
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
        }
        return b.grl - a.grl;
      });
  }, [unlockedPlayerIds, swapSearch, activeSwapSlot]);

  // Handle setting a player in a pitch slot
  const handleAssignPlayerToSlot = (slot: number, playerId: string) => {
    const player = getPlayerById(playerId);
    if (!player) return;

    sounds.playBounce();

    // Check if this player was already in another slot -> swap them!
    const updatedLineup = { ...currentLineup };
    let existingSlot: number | null = null;
    for (const [s, id] of Object.entries(updatedLineup)) {
      if (id === playerId && Number(s) !== slot) {
        existingSlot = Number(s);
        break;
      }
    }

    if (existingSlot !== null) {
      // Swap the player currently in target slot into the previous slot
      updatedLineup[existingSlot] = updatedLineup[slot];
    }
    updatedLineup[slot] = playerId;

    const nextData: TeamCustomization = {
      ...data,
      lineup: updatedLineup,
    };

    // If slot 9 (DC / captain) was changed, also sync captain if desired
    if (slot === 9 && !data.playerId) {
      nextData.playerName = player.shortName;
      nextData.playerNumber = player.number;
      nextData.playerId = player.id;
      nextData.playerGrl = player.grl;
      nextData.playerPosition = player.position;
      nextData.playerCountry = player.country;
    }

    setData(nextData);
    onSave(nextData);
    setActiveSwapSlot(null);
  };

  // Set captain
  const handleSelectCaptain = (player: PlayerData) => {
    sounds.playCheer();
    const nextData: TeamCustomization = {
      ...data,
      playerName: player.shortName,
      playerNumber: player.number,
      playerId: player.id,
      playerGrl: player.grl,
      playerPosition: player.position,
      playerCountry: player.country,
    };
    setData(nextData);
    onSave(nextData);
  };

  // Handle clicking a slot on the pitch:
  // If another slot is already selected, this swaps their positions on the pitch!
  // If no slot is selected, this selects this slot so user can swap with another or open bench.
  const handlePitchSlotClick = (slot: PitchSlot) => {
    // If user already had a slot selected for swapping
    if (selectedSlotForSwap !== null) {
      if (selectedSlotForSwap === slot.slot) {
        // Clicked same slot -> deselect
        setSelectedSlotForSwap(null);
        return;
      }

      // Swap players between selectedSlotForSwap and slot.slot directly!
      const slotA = selectedSlotForSwap;
      const slotB = slot.slot;
      const playerAId = currentLineup[slotA] || DEFAULT_LINEUP_IDS[slotA];
      const playerBId = currentLineup[slotB] || DEFAULT_LINEUP_IDS[slotB];

      const playerA = getPlayerById(playerAId);
      const playerB = getPlayerById(playerBId);

      const updatedLineup = {
        ...currentLineup,
        [slotA]: playerBId,
        [slotB]: playerAId,
      };

      const nextData: TeamCustomization = {
        ...data,
        lineup: updatedLineup,
      };

      setData(nextData);
      onSave(nextData);
      setSelectedSlotForSwap(null);
      sounds.playBounce();

      setAutoEquipNotice(
        `¡Posición cambiada! ${playerA?.shortName || 'Jugador'} ⇄ ${playerB?.shortName || 'Jugador'}`
      );
      setTimeout(() => setAutoEquipNotice(null), 3500);
      return;
    }

    // No slot currently selected -> Select this slot
    setSelectedSlotForSwap(slot.slot);
    sounds.playBounce();
  };

  // --- "EQUIPAR MEJOR" (AUTO-EQUIP BEST PLAYERS) ---
  const handleAutoEquipBest = () => {
    const owned = unlockedPlayerIds
      .map((id) => getPlayerById(id))
      .filter((p): p is PlayerData => p !== undefined)
      .sort((a, b) => b.grl - a.grl);

    if (owned.length === 0) return;

    const used = new Set<string>();
    const newLineup: { [slot: number]: string } = {};

    const PITCH_POSITIONS_CONFIG: {
      slot: number;
      exactRole: PlayerPosition;
      secondaryRoles: PlayerPosition[];
    }[] = [
      { slot: 0, exactRole: 'POR', secondaryRoles: [] },
      { slot: 1, exactRole: 'LD', secondaryRoles: ['LI', 'DFC'] },
      { slot: 2, exactRole: 'DFC', secondaryRoles: ['LD', 'LI', 'MCD'] },
      { slot: 3, exactRole: 'DFC', secondaryRoles: ['LI', 'LD', 'MCD'] },
      { slot: 4, exactRole: 'LI', secondaryRoles: ['LD', 'DFC'] },
      { slot: 5, exactRole: 'MCD', secondaryRoles: ['MC', 'MCO'] },
      { slot: 6, exactRole: 'MC', secondaryRoles: ['MCD', 'MCO'] },
      { slot: 7, exactRole: 'MC', secondaryRoles: ['MCO', 'MCD'] },
      { slot: 8, exactRole: 'ED', secondaryRoles: ['EI', 'DC'] },
      { slot: 9, exactRole: 'DC', secondaryRoles: ['ED', 'EI', 'MCO'] },
      { slot: 10, exactRole: 'EI', secondaryRoles: ['ED', 'DC'] },
    ];

    // Pass 1: exact role match with highest GRL
    for (const cfg of PITCH_POSITIONS_CONFIG) {
      const candidate = owned.find((p) => !used.has(p.id) && p.position === cfg.exactRole);
      if (candidate) {
        newLineup[cfg.slot] = candidate.id;
        used.add(candidate.id);
      }
    }

    // Pass 2: secondary compatible roles with highest GRL
    for (const cfg of PITCH_POSITIONS_CONFIG) {
      if (!newLineup[cfg.slot]) {
        const candidate = owned.find(
          (p) => !used.has(p.id) && cfg.secondaryRoles.includes(p.position)
        );
        if (candidate) {
          newLineup[cfg.slot] = candidate.id;
          used.add(candidate.id);
        }
      }
    }

    // Pass 3: any remaining slots filled by highest remaining GRL
    for (const cfg of PITCH_POSITIONS_CONFIG) {
      if (!newLineup[cfg.slot]) {
        const candidate = owned.find((p) => !used.has(p.id));
        if (candidate) {
          newLineup[cfg.slot] = candidate.id;
          used.add(candidate.id);
        } else {
          newLineup[cfg.slot] = DEFAULT_LINEUP_IDS[cfg.slot] || 'starter_dc';
        }
      }
    }

    // Captain: best overall crack among the chosen 11
    const lineupPlayers = Object.values(newLineup)
      .map((id) => getPlayerById(id))
      .filter((p): p is PlayerData => p !== undefined)
      .sort((a, b) => b.grl - a.grl);

    const bestCaptain = lineupPlayers[0] || owned[0];

    const updatedData: TeamCustomization = {
      ...data,
      lineup: newLineup,
      playerId: bestCaptain.id,
      playerName: bestCaptain.shortName,
      playerNumber: bestCaptain.number,
      playerGrl: bestCaptain.grl,
      playerPosition: bestCaptain.position,
      playerCountry: bestCaptain.country,
    };

    setData(updatedData);
    onSave(updatedData);
    setSelectedSlotForSwap(null);

    sounds.playCheer();
    confetti({
      particleCount: 160,
      spread: 90,
      origin: { y: 0.6 },
    });

    const newAvg = Math.round(
      lineupPlayers.reduce((acc, p) => acc + p.grl, 0) / Math.max(1, lineupPlayers.length)
    );

    setAutoEquipNotice(
      `¡Equipo optimizado con tus mejores jugadores! GRL Promedio: ${newAvg} (Capitán: ${bestCaptain.shortName})`
    );
    setTimeout(() => setAutoEquipNotice(null), 4500);
  };

  const handleSave = () => {
    onSave(data);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const getPositionBadgeColor = (pos: PlayerPosition) => {
    switch (pos) {
      case 'POR':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'DFC':
      case 'LI':
      case 'LD':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'MCD':
      case 'MC':
      case 'MCO':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'EI':
      case 'ED':
      case 'DC':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const getGrlGradient = (grl: number) => {
    if (grl >= 128) {
      return 'from-amber-400 via-yellow-300 to-amber-500 text-slate-950 border-amber-300 shadow-[0_0_15px_rgba(250,204,21,0.6)]';
    }
    if (grl >= 125) {
      return 'from-purple-500 via-pink-400 to-purple-600 text-white border-pink-300 shadow-[0_0_12px_rgba(236,72,153,0.5)]';
    }
    if (grl >= 120) {
      return 'from-blue-500 via-sky-400 to-indigo-600 text-white border-sky-300';
    }
    return 'from-emerald-500 via-teal-400 to-emerald-600 text-white border-emerald-300';
  };

  return (
    <div className="relative w-screen h-screen overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-[#120505] text-white font-sans p-4 sm:p-8 select-none">
      {/* Top Header */}
      <header className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>

          <div>
            <h1 className="text-xl sm:text-2xl font-black italic tracking-wide uppercase text-red-400 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-400" />
              Gestión de Equipo & Cancha Titular
            </h1>
            <p className="text-xs text-slate-400">
              Formación 4-3-3 • Cambia posiciones y equipa a tus mejores cracks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Selector */}
          <div className="flex rounded-xl bg-slate-950/80 p-1 border border-white/10">
            <button
              onClick={() => setActiveTab('cancha')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'cancha'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cancha (11)
            </button>
            <button
              onClick={() => setActiveTab('players')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'players'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              Catálogo ({WORLD_CUP_PLAYERS.length})
            </button>
            <button
              onClick={() => setActiveTab('kit')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'kit'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shirt className="w-3.5 h-3.5" />
              Uniforme
            </button>
          </div>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg transition-transform active:scale-95"
          >
            <Check className="w-4 h-4" />
            {savedNotice ? '¡Guardado!' : 'Guardar'}
          </button>
        </div>
      </header>

      {/* Auto-equip feedback toast */}
      {autoEquipNotice && (
        <div className="max-w-4xl mx-auto mb-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-between shadow-2xl animate-bounce">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 fill-slate-950" />
            <span>{autoEquipNotice}</span>
          </div>
          <button onClick={() => setAutoEquipNotice(null)} className="p-1 hover:bg-black/10 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: CANCHA TÁCTICA INTERACTIVA CON TUS 11 JUGADORES */}
      {/* ========================================================= */}
      {activeTab === 'cancha' && (
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
          {/* Action Bar: Equipar Mejor + Stats Summary */}
          <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-4 text-left w-full sm:w-auto">
              <div
                className="w-12 h-12 rounded-2xl border-2 border-white/30 flex items-center justify-center font-black text-lg text-white shadow-md shrink-0"
                style={{ backgroundColor: data.jerseyColor }}
              >
                #{data.playerNumber}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-extrabold text-sky-400 tracking-wider">
                    Formación 4-3-3
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
                    ⭐ GRL Promedio: {averageGrl}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black uppercase text-white tracking-wide">
                  {data.teamName}
                </h2>
                <p className="text-xs text-slate-300 flex items-center gap-1.5 flex-wrap">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Capitán: <strong className="text-white">{data.playerName}</strong> (GRL {data.playerGrl})
                  </span>
                </p>
              </div>
            </div>

            {/* BUTTON "EQUIPAR MEJOR" */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                onClick={handleAutoEquipBest}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.5)] transition-all active:scale-95 flex items-center gap-2.5 cursor-pointer group"
                title="El juego analiza todos tus jugadores fichados y coloca a los de mayor GRL en tu 11 titular"
              >
                <Zap className="w-5 h-5 fill-slate-950 group-hover:scale-125 transition-transform" />
                <span className="text-sm font-black">Equipar Mejor</span>
              </button>
            </div>
          </div>

          {/* Interactive Position Swap Helper Bar */}
          {selectedSlotForSwap !== null && (() => {
            const selectedSlotObj = PITCH_SLOTS.find((p) => p.slot === selectedSlotForSwap);
            const selPlayerId = currentLineup[selectedSlotForSwap] || DEFAULT_LINEUP_IDS[selectedSlotForSwap];
            const selPlayer = getPlayerById(selPlayerId);
            return (
              <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-2 border-amber-400 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-white shadow-[0_0_30px_rgba(245,158,11,0.3)] animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase text-amber-300 tracking-wider">
                      Modo Intercambio de Posición Activo
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-white">
                      Has seleccionado a <strong className="text-amber-300">{selPlayer?.shortName}</strong> ({selectedSlotObj?.role}, GRL {selPlayer?.grl}). Haz clic en <u>otro jugador de la cancha</u> para cambiarlos de posición directamente.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      if (selectedSlotObj) setActiveSwapSlot(selectedSlotObj);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Sustituir por Fichaje</span>
                  </button>
                  <button
                    onClick={() => setSelectedSlotForSwap(null)}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white font-bold text-xs"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            );
          })()}

          {/* REALISTIC 2D SOCCER PITCH (CANCHA DE FÚTBOL) */}
          <div className="relative w-full max-w-3xl h-[640px] sm:h-[680px] mx-auto rounded-3xl overflow-hidden border-4 border-slate-950 shadow-2xl shadow-emerald-950/40 bg-gradient-to-b from-[#15803d] to-[#14532d]">
            {/* Lawn mower stripe pattern overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-25"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 45px, transparent 45px, transparent 90px)',
              }}
            />

            {/* Regulatory Pitch Lines */}
            <div className="absolute inset-4 border-2 border-white/40 rounded-2xl pointer-events-none">
              {/* Halfway line */}
              <div className="absolute top-1/2 left-0 right-0 border-b-2 border-white/40" />

              {/* Center circle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-white/40 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-white/70" />
              </div>

              {/* Top Goal Box (Rival Goal Line) */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 border-2 border-t-0 border-white/40 rounded-b-xl" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-8 border-2 border-t-0 border-white/40 rounded-b-md" />
              <div className="absolute top-16 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white/70" />

              {/* Bottom Goal Box (Home Goal Line) */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-20 border-2 border-b-0 border-white/40 rounded-t-xl" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-8 border-2 border-b-0 border-white/40 rounded-t-md" />
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white/70" />
            </div>

            {/* Corner tags */}
            <div className="absolute top-5 left-6 text-[10px] uppercase font-black tracking-widest text-white/50 pointer-events-none">
              ⬆️ Ataque (Portería Rival)
            </div>
            <div className="absolute bottom-5 left-6 text-[10px] uppercase font-black tracking-widest text-white/50 pointer-events-none">
              ⬇️ Defensa (Tu Portería)
            </div>

            {/* 11 PLAYERS POSITIONED ON THE PITCH */}
            {PITCH_SLOTS.map((slot) => {
              const assignedPlayerId = currentLineup[slot.slot] || DEFAULT_LINEUP_IDS[slot.slot];
              const player = getPlayerById(assignedPlayerId);
              const isCaptain = data.playerId === player?.id || data.playerName === player?.shortName;
              const isSelected = selectedSlotForSwap === slot.slot;

              return (
                <div
                  key={slot.slot}
                  style={{
                    top: `${slot.topPct}%`,
                    left: `${slot.leftPct}%`,
                  }}
                  onClick={() => handlePitchSlotClick(slot)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10 transition-transform duration-200 ${
                    isSelected ? 'scale-125 z-30' : 'hover:scale-110 active:scale-95'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    {/* Player Token Card */}
                    <div className="relative">
                      {/* Realistic Footballer Token */}
                      <div
                        className={`w-12 h-14 sm:w-14 sm:h-16 rounded-xl border-2 flex flex-col items-center justify-between py-1 font-black relative overflow-hidden transition-all ${
                          isSelected
                            ? 'border-amber-400 ring-4 ring-amber-400/80 shadow-[0_0_25px_rgba(250,204,21,0.9)] animate-pulse'
                            : 'border-white/90 shadow-[0_4px_15px_rgba(0,0,0,0.6)] group-hover:border-amber-400 group-hover:shadow-[0_0_15px_rgba(250,204,21,0.6)]'
                        }`}
                        style={{
                          background: `linear-gradient(180deg, ${slot.role === 'POR' ? '#10b981' : data.jerseyColor} 0%, rgba(15,23,42,0.95) 100%)`,
                        }}
                      >
                        {/* Mini Player Head Silhouette with styled hair */}
                        <div className="w-5 h-5 rounded-full bg-amber-200 border border-white/60 relative overflow-hidden shrink-0 shadow-inner mt-0.5">
                          <div className="absolute top-0 inset-x-0 h-2 bg-stone-900 rounded-t-full" />
                          <div className="absolute top-2 left-1 w-1 h-1 rounded-full bg-slate-900" />
                          <div className="absolute top-2 right-1 w-1 h-1 rounded-full bg-slate-900" />
                        </div>

                        {/* Jersey Number */}
                        <span className="text-white text-xs sm:text-sm font-black drop-shadow tracking-tight">
                          #{player?.number || 10}
                        </span>

                        {/* Captain crown */}
                        {isCaptain && (
                          <div className="absolute top-0.5 right-0.5 p-0.5 bg-amber-400 rounded-bl-lg text-slate-950">
                            <Crown className="w-2.5 h-2.5 fill-slate-950" />
                          </div>
                        )}
                      </div>

                      {/* GRL Floating Pill */}
                      <div
                        className={`absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-lg font-black text-[9px] sm:text-[10px] border border-white/40 shadow-md ${getGrlGradient(
                          player?.grl || 80
                        )}`}
                      >
                        {player?.grl || 80}
                      </div>

                      {/* Position Tag */}
                      <div className="absolute -top-1 -left-1 px-1 py-0.2 rounded bg-black/80 text-white font-black text-[8px] uppercase border border-white/20">
                        {slot.role}
                      </div>
                    </div>

                    {/* Player Name and Flag Label */}
                    <div
                      className={`mt-1 px-2 py-0.5 rounded-lg border text-center max-w-[95px] shadow-md transition-colors ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold'
                          : 'bg-slate-950/85 border-white/20 text-white group-hover:border-amber-400'
                      }`}
                    >
                      <div
                        className={`text-[10px] sm:text-[11px] truncate leading-tight ${
                          isSelected ? 'font-black text-slate-950' : 'font-black text-white drop-shadow'
                        }`}
                      >
                        {player?.shortName || slot.label}
                      </div>
                      <div className="text-[9px] flex items-center justify-center gap-1">
                        <span>{player?.flag}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSwapSlot(slot);
                          }}
                          className={`text-[8px] font-black uppercase underline hover:scale-105 ${
                            isSelected ? 'text-slate-950' : 'text-amber-300'
                          }`}
                          title="Sustituir por otro fichaje de tu banquillo"
                        >
                          Fichajes
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-white/10 rounded-2xl p-4 text-xs text-slate-300 max-w-3xl mx-auto">
            <p>
              💡 <strong>Instrucciones:</strong> Haz clic en un jugador y luego en otro para <strong>intercambiar sus posiciones en la cancha</strong>. O haz clic en <strong>"Fichajes"</strong> para sustituirlo por cualquiera de tus estrellas compradas en la tienda.
            </p>
            {onOpenShop && (
              <button
                onClick={onOpenShop}
                className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 font-black text-xs uppercase flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Ir a la Tienda</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL PARA CAMBIAR JUGADOR EN LA POSICIÓN (SWAP MODAL) */}
      {/* ========================================================= */}
      {activeSwapSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none font-sans">
          <div className="relative w-full max-w-2xl max-h-[85vh] rounded-3xl bg-slate-900 border border-white/20 shadow-2xl flex flex-col overflow-hidden text-white">
            {/* Header */}
            <header className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/80">
              <div>
                <span className="text-[11px] font-extrabold uppercase text-amber-400 tracking-wider">
                  Sustitución en Cancha
                </span>
                <h3 className="text-lg font-black uppercase text-white flex items-center gap-2">
                  <span>{activeSwapSlot.label}</span>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs border border-emerald-500/30">
                    Posición: {activeSwapSlot.role}
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setActiveSwapSlot(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Current occupant card */}
            <div className="p-4 bg-slate-950/50 border-b border-white/10 flex items-center justify-between">
              {(() => {
                const currentId = currentLineup[activeSwapSlot.slot] || DEFAULT_LINEUP_IDS[activeSwapSlot.slot];
                const currentP = getPlayerById(currentId);
                const isCap = data.playerId === currentP?.id;
                return (
                  <div className="flex items-center gap-3 w-full justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl border border-white/40 flex items-center justify-center font-black text-white text-sm"
                        style={{ backgroundColor: data.jerseyColor }}
                      >
                        #{currentP?.number || 10}
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Titular Actual:</div>
                        <div className="font-black text-white text-sm flex items-center gap-1.5">
                          <span>{currentP?.shortName}</span>
                          <span>{currentP?.flag}</span>
                          <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[10px] font-black">
                            GRL {currentP?.grl}
                          </span>
                          {isCap && (
                            <span className="px-1.5 py-0.2 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-400/40 text-[9px] font-black">
                              Capitán
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {currentP && !isCap && (
                      <button
                        onClick={() => handleSelectCaptain(currentP)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 hover:bg-amber-500/30 font-bold text-xs flex items-center gap-1"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>Hacer Capitán</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Search bar for swap */}
            <div className="p-4 border-b border-white/5 bg-slate-950/30">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar entre tus jugadores fichados..."
                  value={swapSearch}
                  onChange={(e) => setSwapSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Available Players List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {availableSwapPlayers.map((player) => {
                const currentSlotPlayerId = currentLineup[activeSwapSlot.slot];
                const isCurrentlyHere = currentSlotPlayerId === player.id;
                const isPositionMatch = player.position === activeSwapSlot.role;
                const isCaptain = data.playerId === player.id;

                return (
                  <div
                    key={player.id}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isCurrentlyHere
                        ? 'bg-emerald-950/30 border-emerald-500/50'
                        : isPositionMatch
                        ? 'bg-slate-950/70 border-amber-500/30 hover:border-amber-400'
                        : 'bg-slate-950/40 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* GRL badge */}
                      <div
                        className={`w-10 h-10 rounded-xl border flex flex-col items-center justify-center font-black text-xs ${getGrlGradient(
                          player.grl
                        )}`}
                      >
                        <span>{player.grl}</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-white text-sm">{player.shortName}</span>
                          <span>{player.flag}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-black border uppercase ${getPositionBadgeColor(
                              player.position
                            )}`}
                          >
                            {player.position}
                          </span>
                          {isPositionMatch && (
                            <span className="text-[10px] text-emerald-400 font-bold">★ Posición Natural</span>
                          )}
                          {isCaptain && (
                            <span className="px-1.5 py-0.2 rounded bg-yellow-400 text-slate-950 text-[9px] font-black flex items-center gap-0.5">
                              <Crown className="w-2.5 h-2.5" /> Capitán
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          VEL {player.speed} • TIR {player.shooting} • PAS {player.passing} • DEF {player.defending}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCaptain && (
                        <button
                          onClick={() => handleSelectCaptain(player)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300"
                          title="Hacer Capitán"
                        >
                          <Crown className="w-4 h-4" />
                        </button>
                      )}

                      {isCurrentlyHere ? (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30">
                          ✓ Ya Titular
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAssignPlayerToSlot(activeSwapSlot.slot, player.id)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                        >
                          Colocar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: CATÁLOGO DE JUGADORES (300 JUGADORES) */}
      {/* ========================================================= */}
      {activeTab === 'players' && (
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
          {/* CURRENT SELECTED CAPTAIN HIGHLIGHT BANNER */}
          {currentCaptain && (
            <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-red-950/40 border border-amber-500/40 rounded-3xl p-5 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div
                  className={`w-20 h-24 rounded-2xl bg-gradient-to-tr ${getGrlGradient(
                    currentCaptain.grl
                  )} border-2 flex flex-col items-center justify-center font-black shadow-xl shrink-0`}
                >
                  <span className="text-[10px] font-bold tracking-wider opacity-80 uppercase">GRL</span>
                  <span className="text-3xl font-black leading-none">{currentCaptain.grl}</span>
                  <span className="text-[11px] font-extrabold uppercase mt-0.5">{currentCaptain.position}</span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{currentCaptain.flag}</span>
                    <span className="text-xs font-semibold text-slate-300 uppercase">{currentCaptain.country}</span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-black text-[10px] uppercase border border-amber-400/30">
                      Capitán Activo
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wide">
                    {currentCaptain.name}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Dorsal #{currentCaptain.number} • Pie preferido: {currentCaptain.preferredFoot} • Equipo: {data.teamName}
                  </p>
                </div>
              </div>

              {/* Stat Gauges */}
              <div className="grid grid-cols-4 gap-3 bg-black/40 p-3.5 rounded-2xl border border-white/10 shrink-0 w-full md:w-auto">
                <div className="text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Ritmo</div>
                  <div className="text-lg font-black text-amber-400">{currentCaptain.speed}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Tiro</div>
                  <div className="text-lg font-black text-rose-400">{currentCaptain.shooting}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Pase</div>
                  <div className="text-lg font-black text-sky-400">{currentCaptain.passing}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Defensa</div>
                  <div className="text-lg font-black text-emerald-400">{currentCaptain.defending}</div>
                </div>
              </div>
            </div>
          )}

          {/* SEARCH & FILTERS BAR */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 backdrop-blur-md space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar jugador o país..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-white/15 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Ownership Filter Pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-xl bg-slate-950 p-1 border border-white/10 text-xs font-bold">
                  <button
                    onClick={() => setOwnershipFilter('unlocked')}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      ownershipFilter === 'unlocked' ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Mis Fichados ({unlockedPlayerIds.length})
                  </button>
                  <button
                    onClick={() => setOwnershipFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      ownershipFilter === 'all' ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Todos ({WORLD_CUP_PLAYERS.length})
                  </button>
                  <button
                    onClick={() => setOwnershipFilter('locked')}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      ownershipFilter === 'locked' ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    En Tienda ({WORLD_CUP_PLAYERS.length - unlockedPlayerIds.length})
                  </button>
                </div>

                {/* Quick Filter: Requested 7 Superstars */}
                <button
                  onClick={() => setOnlyHighlights(!onlyHighlights)}
                  className={`px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    onlyHighlights
                      ? 'bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.6)]'
                      : 'bg-white/10 text-amber-400 hover:bg-white/15 border border-amber-400/30'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 fill-amber-400" />
                  <span>Top Cracks</span>
                </button>
              </div>
            </div>

            {/* Position filter chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {positionFilters.map((pos) => (
                <button
                  key={pos.key}
                  onClick={() => setSelectedPosition(pos.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedPosition === pos.key
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-slate-950/80 text-slate-400 hover:text-white border border-white/10'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {/* PLAYERS GRID (300 JUGADORES) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredPlayers.map((player) => {
              const isSelected = data.playerId === player.id || data.playerName === player.shortName;
              const isHighlight = HIGHLIGHTED_IDS.includes(player.id);
              const isUnlocked = unlockedPlayerIds.includes(player.id);

              return (
                <div
                  key={player.id}
                  className={`relative p-4 rounded-2xl transition-all duration-200 border flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-900 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] ring-2 ring-amber-400/40'
                      : isHighlight
                      ? 'bg-slate-950/90 border-amber-500/40 hover:border-amber-400 hover:bg-slate-900/90'
                      : 'bg-slate-950/80 border-white/10 hover:border-white/30 hover:bg-slate-900/70'
                  }`}
                >
                  {/* Top card info */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      {/* GRL Badge */}
                      <div
                        className={`w-14 h-16 rounded-xl bg-gradient-to-tr ${getGrlGradient(
                          player.grl
                        )} border flex flex-col items-center justify-center font-black shadow-md`}
                      >
                        <span className="text-[9px] font-bold uppercase opacity-80">GRL</span>
                        <span className="text-xl font-black leading-none">{player.grl}</span>
                      </div>

                      {/* Position & Country */}
                      <div className="text-right">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-black border uppercase ${getPositionBadgeColor(
                            player.position
                          )}`}
                        >
                          {player.position}
                        </span>
                        <div className="flex items-center justify-end gap-1 text-xs text-slate-400 mt-1 font-semibold">
                          <span>{player.country}</span>
                          <span>{player.flag}</span>
                        </div>
                        {isUnlocked ? (
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5 justify-end mt-0.5">
                            <Check className="w-3 h-3" /> Fichado
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5 justify-end mt-0.5">
                            <Lock className="w-3 h-3" /> En Tienda
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Player Name */}
                    <div className="mb-2">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-black text-white text-base leading-snug truncate">
                          {player.shortName}
                        </h3>
                        {isHighlight && <Flame className="w-4 h-4 text-amber-400 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{player.name}</p>
                    </div>

                    {/* Stats Mini Bar */}
                    <div className="grid grid-cols-4 gap-1.5 py-2 px-2 bg-slate-900/80 rounded-xl border border-white/5 text-[10px] mb-3 text-center">
                      <div>
                        <span className="text-slate-400 block">RIT</span>
                        <span className="font-bold text-amber-300">{player.speed}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">TIR</span>
                        <span className="font-bold text-rose-300">{player.shooting}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">PAS</span>
                        <span className="font-bold text-sky-300">{player.passing}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">DEF</span>
                        <span className="font-bold text-emerald-300">{player.defending}</span>
                      </div>
                    </div>
                  </div>

                  {/* Select or Buy button */}
                  {isUnlocked ? (
                    <button
                      onClick={() => handleSelectCaptain(player)}
                      className={`w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          Capitán Titular
                        </>
                      ) : (
                        'Elegir Capitán'
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => onOpenShop && onOpenShop()}
                      className="w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 bg-amber-500/20 border border-amber-400/40 text-amber-300 hover:bg-amber-500/30 shadow-md active:scale-95"
                    >
                      <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
                      <span>Fichar ({getPlayerPrice(player.grl)} 🪙)</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {filteredPlayers.length === 0 && (
            <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-white/10">
              No se encontraron jugadores con ese filtro de búsqueda.
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: PERSONALIZAR EQUIPACIÓN Y COLORES */}
      {/* ========================================================= */}
      {activeTab === 'kit' && (
        <main className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 pb-12">
          {/* Left Column: Player & Kit Live Visualizer */}
          <section className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center relative backdrop-blur-md shadow-2xl">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-6">
              Vista Previa de Uniforme
            </span>

            {/* Stylized Player Doll Preview */}
            <div className="relative w-48 h-64 flex flex-col items-center justify-center">
              {/* Player Head */}
              <div className="w-14 h-14 rounded-full bg-amber-200 border-2 border-amber-300 shadow-md relative">
                <div className="absolute top-2 left-3 right-3 h-3 bg-slate-800 rounded-t-full" />
              </div>

              {/* Jersey Body */}
              <div
                className="relative w-28 h-32 rounded-2xl shadow-xl flex flex-col items-center justify-center border-2 border-white/20 transition-colors duration-300"
                style={{ backgroundColor: data.jerseyColor }}
              >
                {/* Sleeves */}
                <div
                  className="absolute -left-4 top-2 w-5 h-12 rounded-l-xl border-l-2 border-white/20"
                  style={{ backgroundColor: data.jerseyColor }}
                />
                <div
                  className="absolute -right-4 top-2 w-5 h-12 rounded-r-xl border-r-2 border-white/20"
                  style={{ backgroundColor: data.jerseyColor }}
                />

                {/* Jersey Number */}
                <span className="text-3xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {data.playerNumber}
                </span>

                {/* Captain Badge */}
                <span className="absolute bottom-1 px-2 py-0.5 bg-black/50 text-[10px] font-black uppercase tracking-wider text-amber-300 rounded">
                  {data.playerName}
                </span>
              </div>

              {/* Shorts */}
              <div
                className="w-24 h-14 rounded-b-xl border-2 border-t-0 border-white/20 shadow-md transition-colors duration-300"
                style={{ backgroundColor: data.shortsColor }}
              />

              {/* Socks & Cleats */}
              <div className="flex gap-4 mt-1">
                <div className="w-4 h-10 bg-slate-800 rounded-b-md border border-white/20" />
                <div className="w-4 h-10 bg-slate-800 rounded-b-md border border-white/20" />
              </div>
            </div>

            <div className="mt-6 text-center">
              <h3 className="font-black text-lg text-white uppercase tracking-wide">
                {data.teamName}
              </h3>
              <p className="text-xs text-slate-400">
                Capitán: {data.playerName} • Dorsal #{data.playerNumber}
              </p>
            </div>
          </section>

          {/* Right Column: Customization Controls */}
          <section className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 space-y-6 backdrop-blur-md shadow-2xl">
            {/* Team Name Input */}
            <div>
              <label className="block text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-2">
                Nombre de tu Club
              </label>
              <input
                type="text"
                value={data.teamName}
                maxLength={24}
                onChange={(e) => setData({ ...data, teamName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-bold focus:outline-none focus:border-red-500 transition-colors"
                placeholder="Ej. Football Unit FC"
              />
            </div>

            {/* Jersey Color Selector */}
            <div>
              <label className="block text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-2">
                Color de la Camiseta
              </label>
              <div className="grid grid-cols-5 gap-2.5">
                {colorPresets.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setData({ ...data, jerseyColor: color.hex })}
                    className={`h-10 rounded-xl transition-all transform flex items-center justify-center border-2 ${
                      data.jerseyColor === color.hex
                        ? 'scale-110 border-white shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  >
                    {data.jerseyColor === color.hex && (
                      <Check
                        className={`w-4 h-4 ${
                          color.hex === '#f8fafc' || color.hex === '#eab308'
                            ? 'text-black'
                            : 'text-white'
                        }`}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Shorts Color Selector */}
            <div>
              <label className="block text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-2">
                Color del Pantalón
              </label>
              <div className="grid grid-cols-5 gap-2.5">
                {colorPresets.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setData({ ...data, shortsColor: color.hex })}
                    className={`h-10 rounded-xl transition-all transform flex items-center justify-center border-2 ${
                      data.shortsColor === color.hex
                        ? 'scale-110 border-white shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  >
                    {data.shortsColor === color.hex && (
                      <Check
                        className={`w-4 h-4 ${
                          color.hex === '#f8fafc' || color.hex === '#eab308'
                            ? 'text-black'
                            : 'text-white'
                        }`}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Rival Jersey Color Selector */}
            <div>
              <label className="block text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-2">
                Color del Rival
              </label>
              <div className="grid grid-cols-5 gap-2.5">
                {colorPresets.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setData({ ...data, rivalColor: color.hex })}
                    className={`h-10 rounded-xl transition-all transform flex items-center justify-center border-2 ${
                      data.rivalColor === color.hex
                        ? 'scale-110 border-white shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  >
                    {data.rivalColor === color.hex && (
                      <Check
                        className={`w-4 h-4 ${
                          color.hex === '#f8fafc' || color.hex === '#eab308'
                            ? 'text-black'
                            : 'text-white'
                        }`}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
