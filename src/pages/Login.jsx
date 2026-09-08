import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components/ui';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) { navigate('/'); return null; }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Algo ha fallado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Panel de marca: solo en pantallas anchas, nunca roba espacio al formulario. */}
      <div className="hidden lg:flex flex-col justify-between bg-panel border-r border-line p-12">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg bg-accent" />
          <span className="font-display font-bold text-lg uppercase tracking-[0.1em]">Iron Log</span>
        </div>
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.16em] text-accent">Registro de entrenamiento</p>
          <p className="mt-4 text-5xl font-bold tracking-[-0.03em] leading-[1.05] text-balance">
            Cada serie cuenta.<br />Cada récord queda.
          </p>
          <p className="mt-5 text-muted max-w-[46ch] text-pretty">
            Apunta peso y reps con el teclado, sin soltar las manos del portátil, y mira cómo se mueve tu 1RM
            estimado semana a semana.
          </p>
        </div>
        <p className="font-mono text-xs text-muted">v2 · evo</p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm mx-auto">
          <div className="lg:hidden mb-10">
            <h1 className="font-display text-6xl font-bold uppercase leading-[0.85] tracking-tight">
              Iron<br /><span className="text-accent">Log</span>
            </h1>
            <p className="text-muted mt-3 text-sm">Cada serie cuenta. Cada récord queda.</p>
          </div>

          <h2 className="text-2xl font-bold tracking-[-0.02em] mb-6 hidden lg:block">Entrar</h2>

          <form onSubmit={submit} className="space-y-4">
            <Input
              label="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="javier"
              autoCapitalize="none"
              autoComplete="username"
              autoFocus
            />
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />

            {error && <p className="text-danger text-sm">{error}</p>}

            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? 'Un momento…' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
