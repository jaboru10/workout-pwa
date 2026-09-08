// Componentes UI base del refactor: acento violeta sobre fondo azulado neutro,
// Archivo Narrow para etiquetas y JetBrains Mono para toda cifra.

export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'font-body font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const sizes = {
    sm: 'text-[13px] px-3 py-2',
    md: 'text-sm px-4 py-2.5',
    lg: 'text-[15px] px-5 py-3',
  };
  const variants = {
    primary: 'bg-accent text-accentInk hover:bg-[#b98fff] active:bg-[#9a68f5]',
    ghost: 'bg-panel2 text-chalk border border-line hover:border-accent/45 hover:text-accent',
    outline: 'bg-transparent text-muted border border-dashed border-line hover:text-accent hover:border-accent/45',
    danger: 'bg-transparent text-danger/80 border border-danger/30 hover:bg-danger/10 hover:text-danger',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Label({ children }) {
  return (
    <span className="block font-display text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">
      {children}
    </span>
  );
}

const fieldBase =
  'w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-chalk font-body text-[15px] ' +
  'placeholder:text-muted/60 focus:outline-none focus:border-accent transition-colors';

export function Input({ label, className = '', ...props }) {
  return (
    <label className="block min-w-0">
      {label && <Label>{label}</Label>}
      <input className={`${fieldBase} ${className}`} {...props} />
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

// Celda numérica de la tabla de series. `pr` la enciende cuando el peso
// supera el récord vigente del ejercicio.
export function NumCell({ pr = false, filled = false, className = '', ...props }) {
  return (
    <input
      className={`w-full min-w-0 rounded-lg px-2.5 py-2 text-center font-mono text-[15px] font-medium text-chalk
                  border transition-colors focus:outline-none focus:border-accent focus:bg-panel2
                  ${filled ? 'bg-panel2' : 'bg-ink'} ${pr ? 'border-accent animate-pr' : 'border-line'} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`bg-panel border border-line rounded-2xl ${className}`} {...props}>{children}</div>
  );
}

export function Panel({ children, className = '', ...props }) {
  return (
    <div className={`bg-panel2 border border-line rounded-xl ${className}`} {...props}>{children}</div>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-4">
      <p className="font-display text-[11px] uppercase tracking-[0.16em] text-muted">{children}</p>
      {right}
    </div>
  );
}

export function Stat({ label, value, unit, sub, accent = false }) {
  return (
    <div className="min-w-0">
      <p className={`font-mono text-[26px] font-bold leading-none ${accent ? 'text-accent' : 'text-chalk'}`}>
        {value}
        {unit && <span className="text-[13px] text-muted font-normal">{unit}</span>}
      </p>
      <p className="mt-1 text-xs text-muted">{label}</p>
      {sub && <p className="text-[11px] text-muted/80 font-mono">{sub}</p>}
    </div>
  );
}

export function RecordBadge({ label }) {
  return (
    <span className="inline-flex items-center gap-1 bg-accent/15 text-accent text-[11px] font-semibold
                     uppercase tracking-wide px-2 py-0.5 rounded-md border border-accent/35 animate-pr">
      ★ {label}
    </span>
  );
}

export function Kbd({ children }) {
  return (
    <span className="font-mono text-[12px] text-chalk bg-panel2 border border-line rounded px-1.5 py-0.5">
      {children}
    </span>
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="text-center py-16 px-6 border border-dashed border-line rounded-2xl">
      <p className="font-display text-2xl text-chalk uppercase tracking-wide">{title}</p>
      {hint && <p className="text-muted text-sm mt-2 max-w-prose mx-auto">{hint}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function Loading({ what = 'Cargando' }) {
  return <p className="text-muted font-mono text-sm">{what}…</p>;
}
