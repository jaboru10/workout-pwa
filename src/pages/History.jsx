import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as store from '../data/store';
import { byId, doneSessions, useAppState } from '../data/store';
import { normName } from '../data/schema';
import { Badge, Button, Card, EmptyState, Input, Loading } from '../components/ui';
import { PageBody, PageHeader } from '../components/Shell';
import { formatDate, parseLocalDate } from '../utils/dates';
import { durationMin, formatVolume, sessionSets, sessionVolume, short, plural } from '../logic/metrics';

export default function History() {
  const state = useAppState();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const exMap = useMemo(() => byId(state.exercises), [state.exercises]);
  const sessions = useMemo(() => doneSessions(state), [state]);

  const filtered = useMemo(() => {
    const term = normName(q);
    if (!term) return sessions;
    return sessions.filter((s) => {
      const names = (s.exercises || []).map((x) => exMap[x.exerciseId]?.name || '').join(' ');
      return normName(`${s.date} ${s.dayName || ''} ${s.routineName || ''} ${names} ${s.notes || ''}`).includes(term);
    });
  }, [sessions, q, exMap]);

  const groups = useMemo(() => {
    const out = [];
    filtered.forEach((s) => {
      const d = parseLocalDate(s.date);
      const key = d ? `${d.getFullYear()}-${d.getMonth()}` : 'x';
      const label = d ? d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : 'Sin fecha';
      if (!out.length || out[out.length - 1].key !== key) out.push({ key, label, items: [] });
      out[out.length - 1].items.push(s);
    });
    return out;
  }, [filtered]);

  if (!state.ready) return <PageBody><Loading /></PageBody>;

  function del(s) {
    if (!confirm(`¿Borrar la sesión del ${formatDate(s.date)}? No se puede deshacer.`)) return;
    store.deleteSession(s.id);
  }

  return (
    <>
      <PageHeader crumb={plural(sessions.length, 'sesión', 'sesiones')} title="Historial" />
      <PageBody className="flex flex-col gap-3 max-w-3xl">
        <Input placeholder="Buscar ejercicio, día, fecha…" value={q} onChange={(e) => setQ(e.target.value)} />
        {sessions.length === 0 ? (
          <EmptyState title="Sin historial" hint="Cuando termines tu primera sesión aparecerá aquí." action={<Button onClick={() => navigate('/entrenar')}>Entrenar</Button>} />
        ) : filtered.length === 0 ? (
          <EmptyState title="Sin resultados" hint="Prueba con otro término." />
        ) : groups.map((g) => (
          <div key={g.key} className="flex flex-col gap-2.5">
            <p className="font-display text-[11px] uppercase tracking-[0.16em] text-muted mt-2 first-letter:uppercase">{g.label}</p>
            {g.items.map((s) => {
              const isOpen = open === s.id;
              return (
                <Card key={s.id} className={isOpen ? 'border-accent/40' : ''}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : s.id)} className="w-full flex items-center gap-3 px-4 min-h-[64px] text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold truncate">{s.dayName}</span>
                      <span className="block text-xs text-muted">
                        {formatDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                        {durationMin(s) ? ` · ${durationMin(s)} min` : ''}
                      </span>
                    </span>
                    {s.badDay && <Badge tone="danger">flojo</Badge>}
                    <span className="font-mono text-xs text-muted text-right shrink-0">{sessionSets(s)} series<br />{formatVolume(sessionVolume(s))}</span>
                    <span className="text-muted text-xs w-3">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-line px-4 py-3 flex flex-col gap-3">
                      {s.exercises.map((x) => (
                        <div key={x.id}>
                          <p className="text-sm font-medium">{x.order}. {exMap[x.exerciseId]?.name || '—'}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {x.sets.map((st) => (
                              <span key={st.id} className={`font-mono text-[12px] border rounded-md px-1.5 py-0.5 ${st.type === 'warmup' ? 'border-line text-muted/70' : st.type === 'drop' ? 'border-accent/30 text-accent' : 'border-line text-muted'}`}>
                                {st.type === 'warmup' ? 'A ' : st.type === 'drop' ? '↘' : ''}{short(st.weight)}×{st.reps}{st.rir != null ? `@${st.rir}` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                      {s.notes && <p className="text-sm text-muted italic">{s.notes}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="flex-1" onClick={() => navigate(`/resumen/${s.id}`)}>Resumen</Button>
                        <Button size="sm" variant="ghost" className="flex-1" onClick={() => navigate(`/entrenar/${s.id}`)}>Editar</Button>
                        <Button size="sm" variant="danger" className="flex-1" onClick={() => del(s)}>Borrar</Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ))}
      </PageBody>
    </>
  );
}
