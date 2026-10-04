import React from 'react';
import { Mail, CheckCheck, Trash2, Trophy, AlertTriangle, XCircle, Bell, X } from 'lucide-react';
import { MailboxMessage } from '../types/game';

interface MailboxModalProps {
  isOpen: boolean;
  messages: MailboxMessage[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onDeleteMessage: (id: string) => void;
  onClaimReward: (id: string, reward: number) => void;
}

export default function MailboxModal({
  isOpen,
  messages,
  onClose,
  onMarkAllRead,
  onDeleteMessage,
  onClaimReward,
}: MailboxModalProps) {
  if (!isOpen) return null;

  const unreadCount = messages.filter((m) => !m.read).length;

  const getTypeIcon = (type: MailboxMessage['type']) => {
    switch (type) {
      case 'win':
        return <Trophy className="w-5 h-5 text-amber-400" />;
      case 'loss':
        return <XCircle className="w-5 h-5 text-rose-400" />;
      case 'abandon':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'system':
      default:
        return <Bell className="w-5 h-5 text-sky-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none font-sans">
      <div className="relative w-full max-w-lg bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="relative p-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400">
              <Mail className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wide">Buzón de Mensajes</h2>
              <p className="text-xs text-slate-400">
                {unreadCount > 0 ? `${unreadCount} mensaje(s) sin leer` : 'Todo al día'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-slate-300 font-medium transition-colors flex items-center gap-1"
                title="Marcar todos como leídos"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Leer todos</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Mail className="w-12 h-12 mx-auto text-slate-600 mb-2 opacity-50" />
              <p className="text-sm">Tu buzón está vacío.</p>
              <p className="text-xs text-slate-500">Aquí aparecerá el resumen de tus victorias, derrotas y abandonos.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-2xl border transition-all ${
                  msg.read
                    ? 'bg-slate-950/40 border-white/5 opacity-80'
                    : 'bg-slate-950/90 border-red-500/30 shadow-lg'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-900 border border-white/10">
                      {getTypeIcon(msg.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{msg.title}</h3>
                        {!msg.read && (
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">{msg.timestamp}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteMessage(msg.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                    title="Eliminar mensaje"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-300 mt-2.5 leading-relaxed pl-1">
                  {msg.body}
                </p>

                {msg.reward && !msg.read && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-400">
                      Recompensa: +{msg.reward} Monedas
                    </span>
                    <button
                      onClick={() => onClaimReward(msg.id, msg.reward!)}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-transform active:scale-95"
                    >
                      Reclamar
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
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
