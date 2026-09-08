import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Button, Card, EmptyState, Loading, Panel } from '../components/ui';
import { PageBody, PageHeader } from '../components/Shell';
import { formatDate, isWithinEditWindow } from '../utils/dates';
import { formatVolume, sessionSets, sessionVolume, short } from '../utils/metrics';

export default function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    Promise.all([api.listSessions(), api.listExercises()])
      .then(([s, e]) => { setSessions(s); setExercises(e); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const exMap = useMemo(() => Object.fromEntries(exercises.map((e) => [e.id, e])), [exercises]);

  async function del(id, e) {
    e.stopPropagation();
    if (!confirm('¿Borrar esta sesión? Los récords se recalcularán.')) return;
    await api.deleteSession(id);
    setSessions(sessions.filter((s) => s.id !== id));
  }

  const filtered = sessions.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const names = (s.exercises || []).map((ex) => exMap[ex.exerciseId]?.name || '').join(' ');
    return `${s.date} ${s.routineName || ''} ${names}`.toLowerCase().includes(q);
  });

  return (
    <>
      <PageHeader crumb={`${sessions.length} sesiones registradas`} title="Historial">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por fecha, rutina o ejercicio…"
          className="w-full sm:w-72 bg-panel2 border border-line rounded-lg px-3 py-2 text-sm
                     placeholder:text-muted/60 focus:outline-none focus:border-accent"
        />
      </PageHeader>

      <PageBody className="flex flex-col gap-2.5">
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={sessions.length === 0 ? 'Sin historial' : 'Sin resultados'}
            hint={sessions.length === 0 ? 'Cuando registres sesiones aparecerán aquí.' : 'Prueba con otro término.'}
            action={sessions.length === 0 ? <Button onClick={() => navigate('/log')}>Registrar sesión</Button> : null}
          />
        ) : (
          <>
            <div className="hidden md:grid gap-3 px-[18px] pb-1
                            [grid-template-columns:minmax(96px,1.7fr)_minmax(0,84px)_minmax(0,116px)_minmax(0,84px)_minmax(0,120px)]
                            font-display text-[11px] uppercase tracking-[0.14em] text-muted">
              <span>Sesión</span><span>Ejercicios</span><span>Volumen</span><span>Series</span>
              <span className="text-right">Acciones</span>
            </div>

            {filtered.map((s) => {
              const isOpen = open === s.id;
              return (
                <Card key={s.id} className={`overflow-hidden ${isOpen ? 'border-accent/40' : ''}`}>
                  <div
                    onClick={() => setOpen(isOpen ? null : s.id)}
                    className="grid gap-3 items-center px-[18px] py-3.5 cursor-pointer
                               [grid-template-columns:minmax(0,1fr)_auto]
                               md:[grid-template-columns:minmax(96px,1.7fr)_minmax(0,84px)_minmax(0,116px)_minmax(0,84px)_minmax(0,120px)]"
                  >
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold">{formatDate(s.date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      <p className="text-xs text-muted truncate">
                        {s.routineName || 'sin rutina'}
                        {s.badDay ? ' · día flojo' : ''}
                        <span className="md:hidden"> · {s.exercises?.length || 0} ejercicios · {formatVolume(sessionVolume(s))}</span>
                      </p>
                    </div>
                    <span className="hidden md:inline font-mono text-sm text-muted">{s.exercises?.length || 0}</span>
                    <span className="hidden md:inline font-mono text-sm">{formatVolume(sessionVolume(s))}</span>
                    <span className="hidden md:inline font-mono text-sm text-muted">{sessionSets(s)}</span>
                    <div className="flex items-center gap-2 justify-end">
                      {isWithinEditWindow(s.date) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/log/${s.id}`); }}
                          className="rounded-md border border-line px-2.5 py-1 text-xs text-muted
                                     hover:text-accent hover:border-accent/45"
                        >
                          Editar
                        </button>
                      )}
                      <button
                        onClick={(e) => del(s.id, e)}
                        className="rounded-md border border-line px-2.5 py-1 text-xs text-muted
                                   hover:text-danger hover:border-danger/50"
                      >
                        Borrar
                      </button>
                      <span className="text-muted text-xs w-3 text-center">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-line px-[18px] py-4 flex flex-col gap-3.5">
                      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
                        {[...(s.exercises || [])].sort((a, b) => a.order - b.order).map((ex, i) => (
                          <Panel key={i} className="p-3.5 min-w-0">
                            <div className="flex items-center gap-2 mb-2 min-w-0">
                              <span className="font-mono text-[13px] text-accent">{ex.order}</span>
                              <span className="text-sm font-medium truncate">{exMap[ex.exerciseId]?.name || '—'}</span>
                              {ex.movedFromDayId && <span className="text-[10px] text-muted shrink-0">movido</span>}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {(ex.sets || []).map((set, si) => (
                                <span key={si} className="font-mono text-xs bg-ink border border-line rounded px-2 py-1 text-muted">
                                  {short(set.weight)}×{set.reps}
                                </span>
                              ))}
                            </div>
                          </Panel>
                        ))}
                      </div>
                      {s.generalNotes && <p className="text-sm text-muted italic">{s.generalNotes}</p>}
                    </div>
                  )}
                </Card>
              );
            })}
          </>
        )}
      </PageBody>
    </>
  );
}
