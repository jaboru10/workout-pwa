import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { inProgress, useAppState } from '../data/store';

const items = [
  { to: '/', label: 'Hoy', icon: '◧', end: true },
  { to: '/entrenar', label: 'Entrenar', icon: '▶' },
  { to: '/historial', label: 'Historial', icon: '↺' },
  { to: '/progreso', label: 'Progreso', icon: '◔' },
  { to: '/rutina', label: 'Rutina', icon: '▤' },
];

// Móvil: barra inferior fija (se oculta durante la sesión, que tiene su
// propia barra). Escritorio: rail lateral.
export default function Shell({ children }) {
  const state = useAppState();
  const location = useLocation();
  const navigate = useNavigate();
  const running = inProgress(state);
  const inWorkout = location.pathname.startsWith('/entrenar');
  // En Hoy ya hay una tarjeta grande «Continuar»: la píldora sobraría.
  const showPill = Boolean(running) && !inWorkout && location.pathname !== '/';

  return (
    <div className="min-h-dvh flex">
      <aside className="hidden md:flex sticky top-0 h-dvh shrink-0 flex-col gap-1 border-r border-line bg-panel px-3 py-5 w-56">
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <span className="w-[26px] h-[26px] shrink-0 rounded-[7px] bg-accent" />
          <span className="font-display font-bold text-[17px] uppercase tracking-[0.1em]">Iron Log</span>
        </div>
        {[...items, { to: '/ajustes', label: 'Ajustes', icon: '⚙' }].map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 min-h-[44px] text-sm transition-colors ${
                isActive ? 'bg-accent/15 text-accent font-semibold' : 'text-muted font-medium hover:bg-panel2 hover:text-chalk'
              }`
            }
          >
            <span className="w-5 shrink-0 text-center font-mono text-[15px]">{it.icon}</span>
            <span>{it.label}</span>
            {it.to === '/entrenar' && running && <span className="ml-auto w-2 h-2 rounded-full bg-ok" />}
          </NavLink>
        ))}
      </aside>

      {/* Con sesión abierta la píldora «Volver» flota sobre la barra: se deja
          hueco extra para que no tape el final de la página. */}
      <main className={`flex-1 min-w-0 ${inWorkout ? '' : showPill
        ? 'pb-[calc(136px+env(safe-area-inset-bottom))] md:pb-0'
        : 'pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0'}`}>
        {children}
      </main>

      {showPill && (
        <button
          type="button"
          onClick={() => navigate('/entrenar')}
          className="md:hidden fixed left-3 right-3 z-30 bottom-[calc(80px+env(safe-area-inset-bottom))]
                     flex items-center justify-between gap-3 rounded-2xl bg-ok text-[#0d2a1f] px-4 min-h-[48px]
                     font-semibold shadow-xl shadow-black/40"
        >
          <span className="truncate">Sesión en curso · {running.dayName}</span>
          <span>Volver →</span>
        </button>
      )}

      {!inWorkout && (
        <nav className="md:hidden fixed left-0 right-0 bottom-0 z-20 border-t border-line bg-panel/95 backdrop-blur
                        px-1 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
          <div className="flex justify-around">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) =>
                  `relative flex flex-col items-center justify-center gap-1 rounded-xl min-w-[64px] min-h-[54px] ${
                    isActive ? 'text-accent' : 'text-muted'
                  }`
                }
              >
                <span className="font-mono text-lg leading-none">{it.icon}</span>
                <span className="font-display text-[11px] uppercase tracking-[0.08em]">{it.label}</span>
                {it.to === '/entrenar' && running && <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-ok" />}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

export function PageHeader({ crumb, title, children, back }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-ink/90 backdrop-blur
                       px-4 sm:px-7 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
      <div className="flex items-center gap-3 max-w-app">
        {back && (
          <button
            type="button" onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            aria-label="Volver"
            className="grid place-items-center w-10 h-10 -ml-1 rounded-xl text-xl text-muted hover:text-chalk"
          >
            ←
          </button>
        )}
        <div className="min-w-0 flex-1">
          {crumb && <p className="font-display text-[11px] uppercase tracking-[0.16em] text-muted truncate">{crumb}</p>}
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.02em] leading-tight truncate">{title}</h1>
        </div>
        {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
      </div>
    </header>
  );
}

export function PageBody({ children, className = '' }) {
  return <div className={`px-4 py-5 sm:px-7 sm:py-7 max-w-app ${className}`}>{children}</div>;
}
