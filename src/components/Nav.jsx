import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'Hoy', icon: '⌂' },
  { to: '/log', label: 'Registrar', icon: '＋' },
  { to: '/days', label: 'Plantilla', icon: '▤' },
  { to: '/history', label: 'Historial', icon: '↺' },
  { to: '/records', label: 'Récords', icon: '★' },
];

export default function Nav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-panel/95 backdrop-blur
                    border-t border-line px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-20">
      <div className="flex justify-around">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-2 py-1 rounded-lg min-w-[56px] transition-colors ${
                isActive ? 'text-volt' : 'text-muted hover:text-chalk'
              }`
            }
          >
            <span className="text-lg leading-none">{it.icon}</span>
            <span className="text-[10px] font-body font-medium uppercase tracking-wide">{it.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
