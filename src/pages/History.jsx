import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Card, EmptyState } from '../components/ui';
import { formatDate, isWithinEditWindow } from '../utils/dates';

export default function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    Promise.all([api.listSessions(), api.listExercises()])
      .then(([s, e]) => { setSessions(s); setExercises(e); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const exMap = Object.fromEntries(exercises.map((e) => [e.id, e]));

  async function del(id, e) {
    e.stopPropagation();
    if (!confirm('¿Borrar esta sesión? Los récords se recalcularán.')) return;
    await api.deleteSession(id);
    setSessions(sessions.filter((s) => s.id !== id));
  }

  if (loading) return <div className="px-5 pt-8"><p className="text-muted font-body">Cargando…</p></div>;

  return (
    <div className="px-5 pt-8">
      <h1 className="font-display text-4xl font-bold uppercase tracking-tight mb-5">Historial</h1>

      {sessions.length === 0 ? (
        <EmptyState title="Sin historial" hint="Cuando registres sesiones aparecerán aquí." />
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <Card key={s.id} className="overflow-hidden">
              <div className="p-4 flex items-center justify-between cursor-pointer"
                   onClick={() => setOpen(open === s.id ? null : s.id)}>
                <div>
                  <p className="font-display text-xl uppercase tracking-wide">
                    {formatDate(s.date)}
                  </p>
                  <p className="text-muted text-sm font-body">
                    {s.exercises?.length || 0} ejercicios
                    {s.routineName && ` · ${s.routineName}`}
                    {s.badDay && ' · día flojo'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Solo las sesiones dentro de la ventana de 7 días son editables (IL-003) */}
                  {isWithinEditWindow(s.date) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/log/${s.id}`); }}
                      className="text-volt/80 hover:text-volt text-sm font-body"
                    >
                      Editar
                    </button>
                  )}
                  <button onClick={(e) => del(s.id, e)} className="text-blood/60 hover:text-blood text-sm font-body">
                    Borrar
                  </button>
                  <span className="text-muted">{open === s.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {open === s.id && (
                <div className="px-4 pb-4 border-t border-line pt-3 space-y-3">
                  {[...(s.exercises || [])].sort((a, b) => a.order - b.order).map((ex, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-volt font-mono text-sm">{ex.order}</span>
                        <span className="font-body font-medium text-sm">{exMap[ex.exerciseId]?.name || '—'}</span>
                        {ex.movedFromDayId && <span className="text-muted text-[10px] font-body">movido</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {ex.sets.map((set, si) => (
                          <span key={si} className="font-mono text-xs bg-panel2 rounded px-2 py-1 text-muted">
                            {set.weight}×{set.reps}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {s.generalNotes && (
                    <p className="text-muted text-sm font-body italic pt-2">{s.generalNotes}</p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
