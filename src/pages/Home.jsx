import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Card, EmptyState } from '../components/ui';

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listSessions(), api.listDays()])
      .then(([s, d]) => { setSessions(s); setDays(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const lastSession = sessions[0];
  const trainedToday = lastSession?.date === today;

  return (
    <div className="px-5 pt-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <p className="text-muted text-xs uppercase tracking-widest font-body">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight mt-1">
            Hola, {user?.username}
          </h1>
        </div>
        <button onClick={logout} className="text-muted text-xs font-body hover:text-chalk">Salir</button>
      </header>

      {loading ? (
        <p className="text-muted font-body">Cargando…</p>
      ) : (
        <>
          <Card className="p-5 mb-4">
            {trainedToday ? (
              <div>
                <p className="text-volt font-body text-sm font-semibold uppercase tracking-wide">✓ Entreno hecho hoy</p>
                <p className="font-display text-3xl uppercase mt-1">
                  {lastSession.exercises?.length || 0} ejercicios
                </p>
                <Button variant="ghost" className="mt-4" onClick={() => navigate('/history')}>
                  Ver detalle
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-muted font-body text-sm">Aún no has entrenado hoy</p>
                <p className="font-display text-3xl uppercase mt-1 tracking-tight">A por ello</p>
                <Button className="mt-4" onClick={() => navigate('/log')}>
                  Registrar sesión
                </Button>
              </div>
            )}
          </Card>

          {days.length === 0 && (
            <EmptyState
              title="Sin plantilla"
              hint="Crea tus días de entrenamiento y añade ejercicios para empezar."
              action={<Button onClick={() => navigate('/days')}>Crear plantilla</Button>}
            />
          )}

          {sessions.length > 0 && (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-widest text-muted font-body mb-3">Últimas sesiones</p>
              <div className="space-y-2">
                {sessions.slice(0, 3).map((s) => (
                  <Card key={s.id} className="p-4 flex items-center justify-between"
                        onClick={() => navigate('/history')}>
                    <div>
                      <p className="font-body font-medium">
                        {new Date(s.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-muted text-sm font-body">{s.exercises?.length || 0} ejercicios</p>
                    </div>
                    {s.badDay && <span className="text-muted text-xs font-body">día flojo</span>}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
