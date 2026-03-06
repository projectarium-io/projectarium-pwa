'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
  onUndo?: () => void;
  exiting?: boolean;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, options?: { duration?: number; onUndo?: () => void }) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const ICONS: Record<ToastType, ReactNode> = {
  success: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3l9.66 16.59A1 1 0 0120.66 21H3.34a1 1 0 01-.86-1.41L12 3z" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
    </svg>
  ),
};

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'border-emerald-500/50 bg-emerald-950/90 text-emerald-200',
  error: 'border-red-500/50 bg-red-950/90 text-red-200',
  warning: 'border-amber-500/50 bg-amber-950/90 text-amber-200',
  info: 'border-blue-500/50 bg-blue-950/90 text-blue-200',
};

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Animate the progress bar via CSS
    const el = progressRef.current;
    if (el) {
      // Force reflow then animate
      el.style.transform = 'scaleX(1)';
      requestAnimationFrame(() => {
        el.style.transition = `transform ${t.duration}ms linear`;
        el.style.transform = 'scaleX(0)';
      });
    }
  }, [t.duration]);

  return (
    <div
      className={`relative overflow-hidden rounded-lg border backdrop-blur-sm shadow-lg
        ${TYPE_STYLES[t.type]}
        ${t.exiting ? 'animate-toast-out' : 'animate-toast-in'}
        pointer-events-auto max-w-sm w-full`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {ICONS[t.type]}
        <span className="text-sm font-medium flex-1">{t.message}</span>
        {t.onUndo && (
          <button
            onClick={() => { t.onUndo?.(); onDismiss(t.id); }}
            className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded
              bg-white/10 hover:bg-white/20 transition-colors shrink-0"
          >
            Undo
          </button>
        )}
        <button
          onClick={() => onDismiss(t.id)}
          className="text-current opacity-50 hover:opacity-100 transition-opacity shrink-0 ml-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* Progress bar */}
      <div
        ref={progressRef}
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-current opacity-30 origin-left"
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const dismiss = useCallback((id: number) => {
    // Clear auto-dismiss timer
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }

    // Mark as exiting for animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    // Remove after exit animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 200);
  }, []);

  const toast = useCallback((
    message: string,
    type: ToastType = 'info',
    options?: { duration?: number; onUndo?: () => void }
  ) => {
    const id = nextId.current++;
    const duration = options?.duration ?? (options?.onUndo ? 5000 : 3000);

    setToasts(prev => [...prev.slice(-4), { id, message, type, duration, onUndo: options?.onUndo }]);

    const timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);
  }, [dismiss]);

  const value: ToastContextValue = {
    toast,
    success: useCallback((msg: string) => toast(msg, 'success'), [toast]),
    error: useCallback((msg: string) => toast(msg, 'error'), [toast]),
    info: useCallback((msg: string) => toast(msg, 'info'), [toast]),
    warning: useCallback((msg: string) => toast(msg, 'warning'), [toast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
