import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { byId, useAppState } from '../data/store';
import { Badge, Button, Card, EmptyState, Loading, SectionTitle, Stat } from '../components/ui';
import { PageBody, PageHeader } from '../components/Shell';
import { RECORD_LABEL, newRecordsFor } from '../logic/records';
import { durationMin, est1RM, formatVolume, isWorkSet, sessionSets, sessionVolume, weightText } from '../logic/metrics';
import { formatDate } from '../utils/dates';

export default function Summary() {
  const { id } = useParams();
  const state = useAppState();
  const navigate = useNavigate();
  const session = state.sessions.find((s) => s.id === id);
  const exMap = useMemo(() => byId(state.exercises), [state.exercises]);
  const records = useMemo(() => (session ? newRecordsFor(session, state.sessions, exMap) : []), [session, state.sessions, exMap]);

  if (!state.ready) return <PageBody><Loading /></PageBody>;
  if (!session) {
    return (
      <>
        <PageHeader title="Sesión" back="/historial" />
        <PageBody><EmptyState title="No encontrada" action={<Button onClick={() => navigate('/')}>Inicio</Button>} /></PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader crumb={formatDate(session.date, { weekday: 'long', day: 'numeric', month: 'long' })} title={session.dayName} back="/" />
      <PageBody className="flex flex-col gap-4 max-w-3xl">
        <Card className="p-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="minutos" value={durationMin(session) ?? '—'} />
            <Stat label="series" value={sessionSets(session)} />
            <Stat label="volumen" value={formatVolume(sessionVolume(session))} />
          </div>
          {(session.badDay || session.notes) && (
            <div className="mt-4 flex flex-col gap-1.5">
              {session.badDay && <Badge tone="danger">Día flojo</Badge>}
              {session.notes && <p className="text-sm text-muted italic">{session.notes}</p>}
            </div>
          )}
        </Card>

        {records.length > 0 && (
          <Card className="p-5 border-accent/45">
            <p className="font-display text-xl uppercase tracking-wide text-accent mb-3">★ {records.length} {records.length === 1 ? 'récord' : 'récords'}</p>
            <div className="flex flex-col">
              {records.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2.5 border-b border-line last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{exMap[r.exerciseId]?.name || '—'}</p>
                    <p className="text-xs text-muted">{RECORD_LABEL[r.type]} · antes {short(r.previous)}</p>
                  </div>
                  <p className="font-mono text-lg font-bold text-accent shrink-0">
                    {r.type === 'MAX_REPS' ? `${r.reps} reps` : r.type === 'ESTIMATED_1RM' ? `${short(Math.round(r.value * 10) / 10)} kg` : `${short(r.weight)} kg × ${r.reps}`}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-4">
          <SectionTitle>Ejercicios</SectionTitle>
          <div className="flex flex-col gap-3">
            {session.exercises.map((x) => {
              const work = x.sets.filter(isWorkSet);
              const bw = Boolean(exMap[x.exerciseId]?.bodyweight);
              const top = bw ? null : work.reduce((b, s) => (est1RM(s.weight, s.reps) > est1RM(b?.weight, b?.reps) ? s : b), null);
              return (
                <div key={x.id} className="border-b border-line last:border-0 pb-3 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium min-w-0 truncate">{x.order}. {exMap[x.exerciseId]?.name || '—'}</p>
                    {top && <span className="font-mono text-xs text-muted shrink-0">1RM ~{Math.round(est1RM(top.weight, top.reps))}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {x.sets.map((s) => (
                      <span key={s.id} className={`font-mono text-[12px] border rounded-md px-1.5 py-0.5 ${
                        s.type === 'warmup' ? 'border-line text-muted/70' : s.type === 'drop' ? 'border-accent/30 text-accent' : 'border-line text-chalk/90'
                      }`}>
                        {s.type === 'warmup' ? 'A ' : s.type === 'drop' ? '↘' : ''}{weightText(s.weight, bw)}×{s.reps}{s.rir != null ? `@${s.rir}` : ''}
                      </span>
                    ))}
                  </div>
                  {x.notes && <p className="text-xs text-muted italic mt-1">{x.notes}</p>}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-wrap gap-2.5">
          <Button className="flex-1" onClick={() => navigate('/')}>Inicio</Button>
          <Button variant="ghost" className="flex-1" onClick={() => navigate(`/entrenar/${session.id}`)}>Editar</Button>
          <Button variant="ghost" className="flex-1" onClick={() => navigate('/historial')}>Historial</Button>
        </div>
      </PageBody>
    </>
  );
}
