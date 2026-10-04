import React from 'react';
import { ShoppingCart, Coins, Check, Sparkles, X } from 'lucide-react';

interface ShopModalProps {
  isOpen: boolean;
  coins: number;
  unlockedItems: string[];
  onClose: () => void;
  onBuyItem: (itemId: string, price: number) => void;
}

const shopCatalog = [
  { id: 'ball_gold', name: 'Balón Copa de Oro', price: 150, description: 'Balón dorado brillante con reflejos metálicos.', type: 'ball' },
  { id: 'ball_fire', name: 'Balón Fuego Carmesí', price: 200, description: 'Efecto llameante de alta velocidad en los tiros.', type: 'ball' },
  { id: 'boots_speed', name: 'Botas Supersónicas', price: 250, description: 'Aumento estético de velocidad en carrera.', type: 'perk' },
  { id: 'stadium_night', name: 'Estadio Nocturno Pro', price: 300, description: 'Iluminación especial de focos de noche.', type: 'theme' },
];

export default function ShopModal({
  isOpen,
  coins,
  unlockedItems,
  onClose,
  onBuyItem,
}: ShopModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none font-sans">
      <div className="relative w-full max-w-lg bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wide">Tienda Football Unit</h2>
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
                <Coins className="w-3.5 h-3.5" />
                <span>{coins} Monedas disponibles</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {shopCatalog.map((item) => {
            const isOwned = unlockedItems.includes(item.id);
            const canAfford = coins >= item.price;

            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{item.name}</h3>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs font-bold text-amber-400">
                    <Coins className="w-3 h-3" />
                    <span>{item.price} Monedas</span>
                  </div>
                </div>

                <div>
                  {isOwned ? (
                    <button
                      disabled
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-emerald-400 text-xs font-bold flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Comprado
                    </button>
                  ) : (
                    <button
                      onClick={() => onBuyItem(item.id, item.price)}
                      disabled={!canAfford}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                        canAfford
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Comprar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
