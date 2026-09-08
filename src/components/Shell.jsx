import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const items = [
  { to: '/', label: 'Hoy', icon: '◧', end: true },
  { to: '/log', label: 'Registrar', icon: '＋' },
  { to: '/days', label: 'Plantilla', icon: '▤' },
  { to: '/records', label: 'Progreso', icon: '◔' },
  { to: '/history', label: 'Historial', icon: '↺' },
];

// Shell de escritorio: rail lateral fijo (iconos por debajo de lg, iconos +
// texto a partir de lg) y barra inferior en móvil. El contenido nunca tiene
// ancho fijo: se estira hasta max-w-app y respira con padding fluido.
export default function Shell({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex">
      <aside className="hidden sm:flex sticky top-0 h-screen shrink-0 flex-col gap-1 border-r border-line
                        bg-panel px-3 py-5 w-[68px] lg:w-56 transition-[width]">
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <span className="w-[26px] h-[26px] shrink-0 rounded-[7px] bg-accent" />
          <span className="hidden lg:inline font-display font-bold text-[17px] uppercase tracking-[0.1em] whitespace-nowrap">
            Iron Log
          </span>
        </div>

        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            title={it.label}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-accent/15 text-accent font-semibold'
                  : 'text-muted font-medium hover:bg-panel2 hover:text-chalk'
              }`
            }
          >
            <span className="w-5 shrink-0 text-center font-mono text-[15px]">{it.icon}</span>
            <span className="hidden lg:inline whitespace-nowrap">{it.label}</span>
          </NavLink>
        ))}

        <div className="mt-auto px-2">
          <div className="h-px bg-line mb-3" />
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-[26px] h-[26px] shrink-0 rounded-full bg-panel2
                             border border-line text-xs font-semibold uppercase">
              {(user?.username || '?').slice(0, 1)}
            </span>
            <div className="hidden lg:block min-w-0">
              <p className="text-[13px] font-semibold truncate">{user?.username}</p>
              <button onClick={logout} className="text-[11px] text-muted hover:text-danger">Salir</button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 pb-20 sm:pb-0">{children}</main>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-line
                      bg-panel/95 backdrop-blur px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex justify-around">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-lg px-2 py-1 min-w-[56px] ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              <span className="font-mono text-lg leading-none">{it.icon}</span>
              <span className="font-display text-[10px] uppercase tracking-[0.1em]">{it.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

// Cabecera de página común: miga + título + acciones, pegada al hacer scroll.
export function PageHeader({ crumb, title, children }) {
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-5 border-b border-line
                       bg-ink/85 backdrop-blur px-5 py-4 sm:px-7">
      <div className="min-w-0 flex-1 basis-60">
        {crumb && (
          <p className="font-display text-[11px] uppercase tracking-[0.16em] text-muted">{crumb}</p>
        )}
        <h1 className="mt-0.5 text-2xl sm:text-[26px] font-bold tracking-[-0.02em] leading-tight">{title}</h1>
      </div>
      {children && <div className="flex items-center gap-2.5 flex-wrap">{children}</div>}
    </header>
  );
}

export function PageBody({ children, className = '' }) {
  return <div className={`px-5 py-6 sm:px-7 sm:py-7 max-w-app ${className}`}>{children}</div>;
}
