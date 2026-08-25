// Componentes UI base — encapsulan el sistema de diseño (dark, volt accent)

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const base = 'font-body font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-volt text-ink hover:bg-[#c4ee2a] active:bg-[#b3dd1e]',
    ghost: 'bg-panel2 text-chalk hover:bg-line',
    danger: 'bg-transparent text-blood hover:bg-blood/10 border border-blood/30',
    outline: 'bg-transparent text-chalk border border-line hover:border-muted',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input({ label, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-body">{label}</span>}
      <input
        className={`w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-chalk font-body
                    placeholder:text-muted/60 focus:outline-none focus:border-volt/60 transition-colors ${className}`}
        {...props}
      />
    </label>
  );
}

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`bg-panel border border-line rounded-xl ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Panel({ children, className = '' }) {
  return <div className={`bg-panel2 border border-line rounded-lg ${className}`}>{children}</div>;
}

// Badge de récord — el momento "encendido"
export function RecordBadge({ label }) {
  return (
    <span className="inline-flex items-center gap-1 bg-volt/15 text-volt text-[11px] font-body font-semibold
                     uppercase tracking-wide px-2 py-0.5 rounded-md border border-volt/30 animate-ignite">
      ★ {label}
    </span>
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="text-center py-16 px-6">
      <p className="font-display text-2xl text-chalk uppercase tracking-wide">{title}</p>
      {hint && <p className="text-muted text-sm mt-2 font-body">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
