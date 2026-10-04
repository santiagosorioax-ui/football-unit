import React, { useState } from 'react';
import { ArrowLeft, Check, Sparkles, Shirt } from 'lucide-react';
import { TeamCustomization } from '../types/game';

interface TeamScreenProps {
  customization: TeamCustomization;
  onSave: (updated: TeamCustomization) => void;
  onBack: () => void;
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

export default function TeamScreen({ customization, onSave, onBack }: TeamScreenProps) {
  const [data, setData] = useState<TeamCustomization>(customization);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = () => {
    onSave(data);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div className="relative w-screen h-screen overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 text-white font-sans p-4 sm:p-8 select-none">
      {/* Top Navigation */}
      <header className="max-w-4xl mx-auto flex items-center justify-between border-b border-white/10 pb-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Menú
        </button>

        <h1 className="text-xl sm:text-2xl font-black italic tracking-wide uppercase text-red-400 flex items-center gap-2">
          <Shirt className="w-6 h-6 text-red-500" />
          Personalización de Equipo
        </h1>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg transition-transform active:scale-95"
        >
          <Check className="w-4 h-4" />
          {savedNotice ? '¡Guardado!' : 'Guardar'}
        </button>
      </header>

      <main className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
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

              {/* Player Number */}
              <span
                className="text-4xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                style={{
                  color: data.jerseyColor === '#f8fafc' ? '#18181b' : '#ffffff',
                }}
              >
                {data.playerNumber}
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-90 truncate max-w-[90px]"
                style={{
                  color: data.jerseyColor === '#f8fafc' ? '#18181b' : '#ffffff',
                }}
              >
                {data.playerName || 'JUGADOR'}
              </span>
            </div>

            {/* Shorts */}
            <div
              className="w-20 h-14 rounded-b-xl border-2 border-t-0 border-white/20 shadow-md transition-colors duration-300 flex"
              style={{ backgroundColor: data.shortsColor }}
            >
              <div className="w-1/2 border-r border-black/20" />
              <div className="w-1/2" />
            </div>

            {/* Ball Icon Next to Player */}
            <div className="absolute -bottom-3 right-4 w-12 h-12 rounded-full bg-white border-2 border-slate-900 shadow-xl flex items-center justify-center overflow-hidden">
              <div className="w-4 h-4 bg-slate-900 rotate-45 transform" />
            </div>
          </div>

          <div className="mt-6 text-center">
            <h3 className="text-lg font-bold text-white">{data.teamName || 'Mi Equipo'}</h3>
            <p className="text-xs text-slate-400">Capitán #{data.playerNumber} - {data.playerName || 'Jugador'}</p>
          </div>
        </section>

        {/* Right Column: Customization Controls */}
        <section className="space-y-6">
          {/* Identity Info */}
          <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Datos de tu Equipo
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre del Equipo</label>
                <input
                  type="text"
                  value={data.teamName}
                  maxLength={24}
                  onChange={(e) => setData({ ...data, teamName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white text-sm focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nombre del Jugador</label>
                  <input
                    type="text"
                    value={data.playerName}
                    maxLength={14}
                    onChange={(e) => setData({ ...data, playerName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white text-sm focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Dorsal / Número (1-99)</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={data.playerNumber}
                    onChange={(e) => {
                      const num = parseInt(e.target.value, 10);
                      setData({ ...data, playerNumber: isNaN(num) ? 10 : Math.min(Math.max(1, num), 99) });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white text-sm focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Jersey Color Picker */}
          <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Color de Camiseta Principal
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {colorPresets.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setData({ ...data, jerseyColor: c.hex })}
                  className="w-9 h-9 rounded-xl border-2 transition-transform hover:scale-110 flex items-center justify-center shadow-md"
                  style={{
                    backgroundColor: c.hex,
                    borderColor: data.jerseyColor === c.hex ? '#f87171' : 'rgba(255,255,255,0.2)',
                    boxShadow: data.jerseyColor === c.hex ? '0 0 10px rgba(239,68,68,0.6)' : undefined,
                  }}
                  title={c.name}
                >
                  {data.jerseyColor === c.hex && (
                    <Check
                      className="w-4 h-4"
                      style={{ color: c.hex === '#f8fafc' ? '#000000' : '#ffffff' }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Shorts Color Picker */}
          <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Color del Pantalón
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {colorPresets.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setData({ ...data, shortsColor: c.hex })}
                  className="w-9 h-9 rounded-xl border-2 transition-transform hover:scale-110 flex items-center justify-center shadow-md"
                  style={{
                    backgroundColor: c.hex,
                    borderColor: data.shortsColor === c.hex ? '#f87171' : 'rgba(255,255,255,0.2)',
                  }}
                  title={c.name}
                >
                  {data.shortsColor === c.hex && (
                    <Check
                      className="w-4 h-4"
                      style={{ color: c.hex === '#f8fafc' ? '#000000' : '#ffffff' }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Save & Ready Button */}
          <button
            onClick={() => {
              handleSave();
              onBack();
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black tracking-wider uppercase shadow-xl transition-all active:scale-95"
          >
            Guardar y Volver a Inicio
          </button>
        </section>
      </main>
    </div>
  );
}
