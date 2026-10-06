import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Coins,
  ArrowLeft,
  Search,
  Check,
  Trophy,
  Zap,
  Flame,
  Shield,
  Star,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SHOP_PLAYERS, PlayerData, getPlayerPrice, PlayerPosition } from '../data/players';
import { sounds } from '../utils/audio';

interface ShopModalProps {
  isOpen: boolean;
  coins: number;
  unlockedPlayerIds: string[];
  onClose: () => void;
  onBuyPlayer: (player: PlayerData, price: number) => void;
}

const POSITION_FILTERS: { key: string; label: string }[] = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'POR', label: 'Porteros (POR)' },
  { key: 'DFC', label: 'Centrales (DFC)' },
  { key: 'LI', label: 'Laterales Izq (LI)' },
  { key: 'LD', label: 'Laterales Der (LD)' },
  { key: 'MCD', label: 'Pivotes (MCD)' },
  { key: 'MC', label: 'Medios (MC)' },
  { key: 'MCO', label: 'Mediapuntas (MCO)' },
  { key: 'EI', label: 'Extremos Izq (EI)' },
  { key: 'ED', label: 'Extremos Der (ED)' },
  { key: 'DC', label: 'Delanteros (DC)' },
];

export default function ShopModal({
  isOpen,
  coins,
  unlockedPlayerIds,
  onClose,
  onBuyPlayer,
}: ShopModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('TODOS');
  const [sortBy, setSortBy] = useState<'grl_desc' | 'grl_asc' | 'name'>('grl_desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'owned'>('all');
  const [justPurchasedPlayer, setJustPurchasedPlayer] = useState<PlayerData | null>(null);

  const filteredPlayers = useMemo(() => {
    return SHOP_PLAYERS.filter((player) => {
      const isOwned = unlockedPlayerIds.includes(player.id);
      if (statusFilter === 'available' && isOwned) return false;
      if (statusFilter === 'owned' && !isOwned) return false;

      if (selectedPosition !== 'TODOS' && player.position !== selectedPosition) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = player.name.toLowerCase().includes(q);
        const matchesShort = player.shortName.toLowerCase().includes(q);
        const matchesCountry = player.country.toLowerCase().includes(q);
        return matchesName || matchesShort || matchesCountry;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'grl_desc') return b.grl - a.grl;
      if (sortBy === 'grl_asc') return a.grl - b.grl;
      return a.shortName.localeCompare(b.shortName);
    });
  }, [selectedPosition, searchQuery, sortBy, statusFilter, unlockedPlayerIds]);

  if (!isOpen) return null;

  const handlePurchase = (player: PlayerData) => {
    const price = getPlayerPrice(player.grl);
    if (coins < price || unlockedPlayerIds.includes(player.id)) return;

    sounds.playCheer();
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 },
    });

    onBuyPlayer(player, price);
    setJustPurchasedPlayer(player);
    setTimeout(() => {
      setJustPurchasedPlayer((curr) => (curr?.id === player.id ? null : curr));
    }, 3500);
  };

  const getCardBorder = (grl: number) => {
    if (grl >= 130) {
      return 'border-amber-400/80 shadow-[0_0_20px_rgba(250,204,21,0.35)] bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950';
    }
    if (grl >= 127) {
      return 'border-purple-400/70 shadow-[0_0_16px_rgba(192,132,252,0.3)] bg-gradient-to-br from-purple-950/30 via-slate-900 to-slate-950';
    }
    if (grl >= 124) {
      return 'border-sky-400/60 shadow-[0_0_12px_rgba(56,189,248,0.25)] bg-gradient-to-br from-sky-950/25 via-slate-900 to-slate-950';
    }
    return 'border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)] bg-gradient-to-br from-emerald-950/20 via-slate-900 to-slate-950';
  };

  const getGrlBadge = (grl: number) => {
    if (grl >= 130) {
      return 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 shadow-md';
    }
    if (grl >= 127) {
      return 'bg-gradient-to-r from-purple-500 via-pink-400 to-purple-600 text-white shadow-md';
    }
    if (grl >= 124) {
      return 'bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-600 text-white';
    }
    return 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 text-white';
  };

  const getPositionBadge = (pos: PlayerPosition) => {
    switch (pos) {
      case 'POR':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'DFC':
      case 'LI':
      case 'LD':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'MCD':
      case 'MC':
      case 'MCO':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'EI':
      case 'ED':
      case 'DC':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  const ownedCountInShop = SHOP_PLAYERS.filter((p) => unlockedPlayerIds.includes(p.id)).length;

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen bg-gradient-to-br from-slate-950 via-[#0a0f1d] to-[#040711] text-white font-sans flex flex-col select-none overflow-hidden">
      {/* --- FULLSCREEN HEADER --- */}
      <header className="w-full bg-slate-950/90 border-b border-white/10 px-6 sm:px-10 py-4 flex items-center justify-between shadow-2xl backdrop-blur-md flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all active:scale-95 shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Menú</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-400 shadow-md">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>Tienda Oficial de Jugadores</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black">
                  MUNDIAL
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                {SHOP_PLAYERS.length} Estrellas del Mundial • Cuanto mayor GRL, mayor valor
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/70 border border-amber-400/40 text-amber-300 font-black text-sm sm:text-base shadow-lg">
            <Coins className="w-5 h-5 text-amber-400" />
            <span>{coins} Monedas</span>
          </div>
        </div>
      </header>

      {/* --- PURCHASE SUCCESS TOAST NOTIFICATION --- */}
      {justPurchasedPlayer && (
        <div className="w-full bg-emerald-600/90 border-b border-emerald-400 px-6 py-2 flex items-center justify-center gap-2 text-white text-xs sm:text-sm font-bold animate-pulse shadow-md z-20">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>
            ¡Felicidades! Has fichado a <strong>{justPurchasedPlayer.name}</strong> (GRL {justPurchasedPlayer.grl}, {justPurchasedPlayer.position}). ¡Ya está disponible en tu equipo!
          </span>
        </div>
      )}

      {/* --- FILTER & SEARCH CONTROLS --- */}
      <section className="w-full max-w-7xl mx-auto px-6 pt-4 pb-3 flex flex-col gap-3 flex-shrink-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre, apodo o país..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-white/15 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end flex-wrap">
            {/* Status Filter */}
            <div className="flex rounded-xl bg-slate-900/90 p-1 border border-white/10 text-xs font-bold">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === 'all' ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Todos ({SHOP_PLAYERS.length})
              </button>
              <button
                onClick={() => setStatusFilter('available')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === 'available' ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Por Fichar ({SHOP_PLAYERS.length - ownedCountInShop})
              </button>
              <button
                onClick={() => setStatusFilter('owned')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === 'owned' ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Fichados ({ownedCountInShop})
              </button>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
              <span className="text-slate-400">Orden:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
              >
                <option value="grl_desc" className="bg-slate-900 text-white">Mayor GRL / Valor</option>
                <option value="grl_asc" className="bg-slate-900 text-white">Menor GRL / Valor</option>
                <option value="name" className="bg-slate-900 text-white">Nombre A-Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Position Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {POSITION_FILTERS.map((pos) => (
            <button
              key={pos.key}
              onClick={() => setSelectedPosition(pos.key)}
              className={`px-3 py-1 rounded-xl whitespace-nowrap font-bold transition-all ${
                selectedPosition === pos.key
                  ? 'bg-amber-400 text-slate-950 shadow-md scale-105'
                  : 'bg-slate-900/80 border border-white/10 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {pos.label}
            </button>
          ))}
        </div>
      </section>

      {/* --- MAIN PLAYERS CATALOG GRID (FULLSCREEN SCROLL) --- */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 pb-6 overflow-y-auto">
        {filteredPlayers.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <Trophy className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-lg font-bold text-white">No se encontraron jugadores</h3>
            <p className="text-xs">Prueba con otra búsqueda o filtro de posición.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-2">
            {filteredPlayers.map((player) => {
              const price = getPlayerPrice(player.grl);
              const isOwned = unlockedPlayerIds.includes(player.id);
              const canAfford = coins >= price;

              return (
                <div
                  key={player.id}
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition-all relative overflow-hidden backdrop-blur-md group hover:translate-y-[-2px] ${getCardBorder(
                    player.grl
                  )}`}
                >
                  {/* Top card info */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl" title={player.country}>
                          {player.flag}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg border text-[11px] font-black uppercase tracking-wider ${getPositionBadge(
                            player.position
                          )}`}
                        >
                          {player.position}
                        </span>
                        <span className="text-[11px] text-slate-400">#{player.number}</span>
                      </div>

                      {/* GRL Big Badge */}
                      <div
                        className={`px-2.5 py-1 rounded-xl font-black text-sm tracking-wider flex items-center gap-1 ${getGrlBadge(
                          player.grl
                        )}`}
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>GRL {player.grl}</span>
                      </div>
                    </div>

                    <h3 className="text-white font-black text-base truncate tracking-wide group-hover:text-amber-300 transition-colors">
                      {player.shortName}
                    </h3>
                    <p className="text-slate-400 text-xs truncate mb-3">{player.name}</p>

                    {/* Stats Bars */}
                    <div className="grid grid-cols-4 gap-1.5 mb-4 text-center bg-black/40 p-2 rounded-xl border border-white/5">
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">VEL</div>
                        <div className="text-xs font-black text-sky-400">{player.speed}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">TIR</div>
                        <div className="text-xs font-black text-rose-400">{player.shooting}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">PAS</div>
                        <div className="text-xs font-black text-emerald-400">{player.passing}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">DEF</div>
                        <div className="text-xs font-black text-amber-400">{player.defending}</div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Price & Purchase Action Button */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span className="font-black text-amber-300 text-sm">{price}</span>
                      <span className="text-[10px] text-slate-400">monedas</span>
                    </div>

                    {isOwned ? (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>En Tu Equipo</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handlePurchase(player)}
                        disabled={!canAfford}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md active:scale-95 ${
                          canAfford
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/30'
                            : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                        }`}
                        title={canAfford ? `Fichar a ${player.shortName}` : 'Monedas insuficientes'}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>{canAfford ? 'Fichar' : `Faltan ${price - coins}`}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
