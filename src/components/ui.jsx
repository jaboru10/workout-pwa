// Componentes base. Acento violeta sobre fondo azulado, Archivo Narrow para
// etiquetas y JetBrains Mono para cifras. Todo pensado para el pulgar:
// objetivos táctiles de 44 px o más y textos de entrada de 16 px (si no,
// el iPhone hace zoom al enfocar).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-body font-semibold rounded-xl transition-colors select-none '
    + 'disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]';
  const sizes = {
    sm: 'text-[13px] px-3 min-h-[38px]',
    md: 'text-[15px] px-4 min-h-[46px]',
    lg: 'text-base px-5 min-h-[54px]',
  };
  const variants = {
    primary: 'bg-accent text-accentInk hover:bg-[#b98fff] active:bg-[#9a68f5]',
    ok: 'bg-ok text-[#0d2a1f] hover:brightness-110',
    ghost: 'bg-panel2 text-chalk border border-line hover:border-accent/45 hover:text-accent',
    outline: 'bg-transparent text-muted border border-dashed border-line hover:text-accent hover:border-accent/45',
    danger: 'bg-transparent text-danger border border-danger/35 hover:bg-danger/10',
    plain: 'bg-transparent text-muted hover:text-chalk',
  };
  return (
    <button type="button" className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function IconButton({ children, label, className = '', ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid place-items-center w-11 h-11 shrink-0 rounded-xl border border-line bg-panel2 text-chalk
                  hover:border-accent/45 hover:text-accent active:scale-95 disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Label({ children, className = '' }) {
  return (
    <span className={`block font-display text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5 ${className}`}>
      {children}
    </span>
  );
}

export const fieldBase =
  'w-full bg-panel2 border border-line rounded-xl px-3 min-h-[46px] text-chalk font-body text-base ' +
  'placeholder:text-muted/60 focus:outline-none focus:border-accent transition-colors';

export function Input({ label, className = '', hint, ...props }) {
  return (
    <label className="block min-w-0">
      {label && <Label>{label}</Label>}
      <input className={`${fieldBase} ${className}`} {...props} />
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, className = '', ...props }) {
  return (
    <label className="block min-w-0">
      {label && <Label>{label}</Label>}
      <textarea className={`${fieldBase} py-2.5 min-h-[88px] ${className}`} {...props} />
    </label>
  );
}

export function Select({ label, children, className = '', ...props }) {
  return (
    <label className="block min-w-0">
      {label && <Label>{label}</Label>}
      <select className={`${fieldBase} ${className}`} {...props}>{children}</select>
    </label>
  );
}

/** Convierte "32,5" o "32.5" en número; '' → null. */
export function parseNum(text) {
  if (text == null) return null;
  const s = String(text).replace(',', '.').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const showNum = (n) => (n == null || n === '' ? '' : String(Math.round(Number(n) * 100) / 100));

/**
 * Número con teclado numérico del móvil. Usa type="text" + inputMode porque
 * en iPhone el teclado decimal en español escribe coma y type="number" la
 * rechaza.
 */
export function NumberField({ value, onChange, placeholder, decimal = true, className = '', ...props }) {
  const [text, setText] = useState(showNum(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(showNum(value)); }, [value]);
  return (
    <input
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      autoComplete="off"
      value={text}
      placeholder={placeholder == null ? '' : showNum(placeholder)}
      onFocus={(e) => { focused.current = true; e.target.select(); }}
      onBlur={() => { focused.current = false; setText(showNum(value)); }}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.,]/g, '');
        setText(t);
        onChange(parseNum(t));
      }}
      className={`w-full min-w-0 bg-ink border border-line rounded-xl text-center font-mono text-[19px] font-semibold
                  text-chalk placeholder:text-muted/55 focus:outline-none focus:border-accent min-h-[50px] ${className}`}
      {...props}
    />
  );
}

/** − [número] + con pasos táctiles grandes. */
export function Stepper({ value, placeholder, onChange, step = 1, min = 0, decimal = true, unit, ariaLabel }) {
  const base = value ?? placeholder ?? 0;
  const bump = (d) => {
    const v = Math.max(min, Math.round((Number(base || 0) + d) * 100) / 100);
    onChange(v);
  };
  return (
    <div className="flex items-stretch gap-1.5 min-w-0">
      <button
        type="button" aria-label={`Restar ${step}`} onClick={() => bump(-step)}
        className="w-11 shrink-0 rounded-xl border border-line bg-panel2 text-xl font-semibold text-muted active:bg-line active:text-chalk"
      >
        −
      </button>
      <div className="relative flex-1 min-w-0">
        <NumberField value={value} placeholder={placeholder} onChange={onChange} decimal={decimal} aria-label={ariaLabel} />
        {unit && <span className="pointer-events-none absolute right-2 bottom-1 font-mono text-[10px] text-muted">{unit}</span>}
      </div>
      <button
        type="button" aria-label={`Sumar ${step}`} onClick={() => bump(step)}
        className="w-11 shrink-0 rounded-xl border border-line bg-panel2 text-xl font-semibold text-muted active:bg-line active:text-chalk"
      >
        +
      </button>
    </div>
  );
}

export function Chip({ active, children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`min-h-[40px] min-w-[40px] px-3 rounded-xl border font-mono text-[15px] font-semibold transition-colors ${
        active ? 'bg-accent text-accentInk border-accent' : 'bg-panel2 text-muted border-line hover:text-chalk'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`flex gap-1 bg-panel2 border border-line rounded-xl p-1 ${className}`}>
      {options.map(([key, label]) => (
        <button
          key={String(key)}
          type="button"
          onClick={() => onChange(key)}
          className={`flex-1 rounded-lg px-3 min-h-[36px] text-[13px] font-semibold transition-colors ${
            value === key ? 'bg-accent text-accentInk' : 'text-muted hover:text-chalk'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-center justify-between gap-4 min-h-[48px] cursor-pointer">
      <span className="min-w-0">
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className="relative shrink-0">
        <input type="checkbox" className="peer sr-only" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
        <span className="block w-12 h-7 rounded-full bg-line peer-checked:bg-accent transition-colors" />
        <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-chalk transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Card({ children, className = '', ...props }) {
  return <div className={`bg-panel border border-line rounded-2xl ${className}`} {...props}>{children}</div>;
}

export function Panel({ children, className = '', ...props }) {
  return <div className={`bg-panel2 border border-line rounded-xl ${className}`} {...props}>{children}</div>;
}

export function SectionTitle({ children, right, className = '' }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 mb-3 ${className}`}>
      <p className="font-display text-[11px] uppercase tracking-[0.16em] text-muted">{children}</p>
      {right}
    </div>
  );
}

export function Stat({ label, value, unit, sub, accent = false }) {
  return (
    <div className="min-w-0">
      <p className={`font-mono text-[24px] font-bold leading-none ${accent ? 'text-accent' : 'text-chalk'}`}>
        {value}
        {unit && <span className="text-[13px] text-muted font-normal ml-0.5">{unit}</span>}
      </p>
      <p className="mt-1 text-xs text-muted">{label}</p>
      {sub && <p className="text-[11px] text-muted/80 font-mono">{sub}</p>}
    </div>
  );
}

export function Badge({ children, tone = 'muted', className = '' }) {
  const tones = {
    muted: 'bg-panel2 text-muted border-line',
    accent: 'bg-accent/15 text-accent border-accent/35',
    ok: 'bg-ok/15 text-ok border-ok/35',
    danger: 'bg-danger/10 text-danger border-danger/35',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-display text-[10px]
                      uppercase tracking-[0.1em] ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="text-center py-12 px-6 border border-dashed border-line rounded-2xl">
      <p className="font-display text-xl text-chalk uppercase tracking-wide">{title}</p>
      {hint && <p className="text-muted text-sm mt-2 max-w-prose mx-auto">{hint}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Loading({ what = 'Cargando' }) {
  return <p className="text-muted font-mono text-sm">{what}…</p>;
}

/** Hoja inferior (modal) a pantalla casi completa en el móvil. */
export function Sheet({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div aria-hidden="true" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[88dvh] flex flex-col bg-panel border border-line
                      rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
          <p className="text-lg font-bold tracking-[-0.01em] truncate">{title}</p>
          <IconButton label="Cerrar" onClick={onClose} className="w-10 h-10">✕</IconButton>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t border-line px-5 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] flex gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* --------------------------- avisos (toasts) --------------------------- */

const toastListeners = new Set();
export function toast(message, tone = 'ok') {
  const t = { id: Math.random().toString(36).slice(2), message, tone };
  toastListeners.forEach((l) => l(t));
}

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const add = (t) => {
      setItems((prev) => [...prev.slice(-2), t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), t.tone === 'danger' ? 5000 : 2600);
    };
    toastListeners.add(add);
    return () => toastListeners.delete(add);
  }, []);
  if (!items.length) return null;
  return createPortal(
    <div className="fixed left-0 right-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
          className={`pointer-events-auto max-w-md w-full rounded-xl border px-4 py-3 text-sm font-medium shadow-xl ${
            t.tone === 'danger' ? 'bg-[#2a1517] border-danger/40 text-danger' : 'bg-panel2 border-accent/40 text-chalk'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>,
    document.body
  );
}
