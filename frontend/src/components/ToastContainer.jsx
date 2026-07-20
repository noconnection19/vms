import React, { useEffect } from 'react';
import {
  CheckCircle,
  WarningCircle,
  Warning,
  Info,
  X,
} from '@phosphor-icons/react';

function ToastItem({ toast, onRemove }) {
  const { id, type, title, message, duration } = toast;

  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(() => {
      onRemove(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onRemove]);

  const config = {
    success: {
      icon: CheckCircle,
      borderColor: 'border-emerald-500/30',
      badgeBg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
      barColor: 'bg-emerald-500',
    },
    error: {
      icon: WarningCircle,
      borderColor: 'border-rose-500/30',
      badgeBg: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
      barColor: 'bg-rose-500',
    },
    warning: {
      icon: Warning,
      borderColor: 'border-amber-500/30',
      badgeBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
      barColor: 'bg-amber-500',
    },
    info: {
      icon: Info,
      borderColor: 'border-blue-500/30',
      badgeBg: 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
      barColor: 'bg-blue-500',
    },
  }[type] || {
    icon: Info,
    borderColor: 'border-slate-800',
    badgeBg: 'bg-slate-800 text-slate-300',
    barColor: 'bg-slate-500',
  };

  const IconComponent = config.icon;

  return (
    <div
      className={`relative w-80 sm:w-96 bg-slate-900/95 backdrop-blur-xl border ${config.borderColor} rounded-2xl p-4 shadow-2xl shadow-slate-950/80 flex items-start gap-3 transition-all duration-300 transform translate-y-0 opacity-100 overflow-hidden pointer-events-auto select-none`}
    >
      {/* Top Auto-dismiss Progress Bar */}
      {duration > 0 && (
        <div
          className={`absolute top-0 left-0 h-0.5 ${config.barColor} opacity-70`}
          style={{
            animation: `shrinkWidth ${duration}ms linear forwards`,
          }}
        />
      )}

      {/* Icon Badge */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${config.badgeBg}`}>
        <IconComponent size={20} weight="duotone" />
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        {title && <h4 className="text-xs font-bold text-white tracking-tight">{title}</h4>}
        <p className="text-xs text-slate-300 leading-relaxed mt-0.5 break-words">{message}</p>
      </div>

      {/* Close Button */}
      <button
        type="button"
        onClick={() => onRemove(id)}
        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
      >
        <X size={14} />
      </button>

      {/* Animation Style */}
      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
