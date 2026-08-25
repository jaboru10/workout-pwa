import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components/ui';

export default function Login() {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
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
      if (mode === 'login') await login(username, password);
      else await register(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Algo ha fallado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 max-w-md mx-auto">
      <div className="mb-10">
        <h1 className="font-display text-7xl font-bold uppercase leading-[0.85] tracking-tight">
          Iron<br /><span className="text-volt">Log</span>
        </h1>
        <p className="text-muted font-body mt-3 text-sm">
          Cada serie cuenta. Cada récord queda.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="javier"
          autoCapitalize="none"
          autoComplete="username"
        />
        <Input
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />

        {error && <p className="text-blood text-sm font-body">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </Button>
      </form>

      <button
        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
        className="text-muted text-sm font-body mt-6 text-center hover:text-chalk transition-colors"
      >
        {mode === 'login' ? '¿Primera vez? Crea tu cuenta' : '¿Ya tienes cuenta? Entra'}
      </button>
    </div>
  );
}
