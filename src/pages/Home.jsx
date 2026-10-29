import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as store from '../data/store';
import { activeRoutine, byId, doneSessions, inProgress, routineDays, useAppState } from '../data/store';
import { WEEKDAYS } from '../data/schema';
import { PRESETS, presetStats } from '../data/presets';
import { Badge, Button, Card, IconButton, Loading, SectionTitle, toast } from '../components/ui';
import { PageBody, PageHeader } from '../components/Shell';
import { unlockAudio } from '../hooks/device';
import { daysSince, formatDate, parseLocalDate } from '../utils/dates';
import { formatVolume, muscleSetsByWeek, routineMuscleTargets, sessionSets, sessionVolume, durationMin, plural } from '../logic/metrics';
import { progress } from '../logic/session';

export default function Home() {
  const state = useAppState();
  const navigate = useNavigate();
  const routine = activeRoutine(state);
  const days = useMemo(() => (routine ? routineDays(state, routine.id) : []), [state, routine]);
  const exMap = useMemo(() => byId(state.exercises), [state.exercises]);
  const done = useMemo(() => doneSessions(state), [state]);
  const running = inProgress(state);
  const todayN = ((new Date().getDay() + 6) % 7) + 1;

  const suggested = useMemo(() => {
    if (!days.length) return null;
    const byWeekday = days.find((d) => d.weekday === todayN);
    if (byWeekday) return { day: byWeekday, reason: 'today' };
    if (days.some((d) => d.weekday)) {
      const next = [...days].filter((d) => d.weekday).sort((a, b) => ((a.weekday - todayN + 7) % 7) - ((b.weekday - todayN + 7) % 7))[0];
      return { day: next, reason: 'rest' };
    }
    const lastDayId = done.find((s) => s.dayId && days.some((d) => d.id === s.dayId))?.dayId;
    const i = days.findIndex((d) => d.id === lastDayId);
    return { day: days[(i + 1) % days.length], reason: 'rotation' };
  }, [days, todayN, done]);

  const trainedToday = done.find((s) => daysSince(s.date) === 0);

  const week = useMemo(() => {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const flags = Array(7).fill(null);
    done.forEach((s) => {
      const d = parseLocalDate(s.date);
      if (d && d >= monday) flags[(d.getDay() + 6) % 7] = s;
    });
    return flags;
  }, [done]);

  const muscles = useMemo(() => {
    const table = muscleSetsByWeek(done, exMap, 1);
    const targets = routineMuscleTargets(days, exMap);
    const names = new Set([...Object.keys(targets), ...table.muscles.map((m) => m.muscle)]);
    return [...names]
      .map((m) => ({ muscle: m, done: table.muscles.find((x) => x.muscle === m)?.perWeek[0] || 0, target: targets[m] || 0 }))
      .sort((a, b) => b.target - a.target || b.done - a.done);
  }, [done, exMap, days]);

  if (!state.ready) return <PageBody><Loading /></PageBody>;

  const needsBackup = done.length > 0
    && !(state.config.server.token && state.config.server.lastSyncAt && daysSince(state.config.server.lastSyncAt.slice(0, 10)) <= 7)
    && (!state.config.lastExportAt || daysSince(state.config.lastExportAt.slice(0, 10)) > 7);

  function start(dayId) {
    unlockAudio();
    store.startSession(dayId);
    navigate('/entrenar');
  }

  function choosePreset(id) {
    const r = store.loadPreset(id);
    toast(`Rutina «${r.name}» cargada y activa`);
  }

  return (
    <>
      <PageHeader
        crumb={new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        title="Hoy"
      >
        <IconButton label="Ajustes" onClick={() => navigate('/ajustes')}>⚙</IconButton>
      </PageHeader>

      <PageBody className="flex flex-col gap-4 max-w-3xl">
        {state.error && (
          <Card className="p-4 border-danger/50">
            <p className="text-sm text-danger">{state.error}</p>
            <Button size="sm" variant="ghost" className="mt-2" onClick={store.clearError}>Entendido</Button>
          </Card>
        )}

        {!routine && (
          <Card className="p-5 flex flex-col gap-3 border-accent/40">
            <div>
              <p className="font-display text-[11px] uppercase tracking-[0.16em] text-accent">Primer paso</p>
              <p className="text-[22px] font-bold mt-1 leading-tight">Elige tu rutina</p>
              <p className="text-sm text-muted mt-1">Se cargan los días, ejercicios, series, reps, RIR y descansos. Luego puedes cambiar lo que quieras.</p>
            </div>
            {PRESETS.filter((p) => p.featured).map((p) => {
              const st = presetStats(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePreset(p.id)}
                  className="text-left rounded-2xl border border-line bg-panel2 p-4 active:scale-[0.99]"
                >
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted mt-0.5">{p.description}</p>
                  <p className="font-mono text-xs text-muted mt-1.5">{st.days} días · {st.exercises} ejercicios · {st.sets} series/semana</p>
                </button>
              );
            })}
            <Button variant="plain" onClick={() => navigate('/rutina')}>Ver todas las rutinas →</Button>
          </Card>
        )}

        {running ? (
          <ContinueCard session={running} onContinue={() => navigate('/entrenar')} />
        ) : routine && suggested && (
          <Card className="p-5 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className={`font-display text-[11px] uppercase tracking-[0.16em] ${suggested.reason === 'rest' ? 'text-muted' : 'text-accent'}`}>
                  {trainedToday ? 'Ya has entrenado hoy' : suggested.reason === 'today' ? 'Hoy toca' : suggested.reason === 'rest' ? 'Hoy no toca gimnasio · el siguiente' : 'Siguiente día'}
                </p>
                {suggested.day.weekday && <Badge>{WEEKDAYS[suggested.day.weekday - 1].name}</Badge>}
              </div>
              <p className="text-[26px] font-bold tracking-[-0.02em] leading-tight mt-1">{suggested.day.name}</p>
              <p className="text-sm text-muted mt-1">
                {(suggested.day.exercises || []).length} ejercicios · {(suggested.day.exercises || []).reduce((n, e) => n + (Number(e.sets) || 0), 0)} series
              </p>
            </div>
            <ol className="flex flex-col gap-1">
              {[...(suggested.day.exercises || [])].sort((a, b) => a.order - b.order).map((de) => (
                <li key={de.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{exMap[de.exerciseId]?.name || '—'}</span>
                  <span className="font-mono text-xs text-muted shrink-0">{de.sets}×{de.reps}{de.rir != null && de.rir !== '' ? ` @${de.rir}` : ''}</span>
                </li>
              ))}
            </ol>
            <div className="flex gap-2.5">
              <Button size="lg" variant="ok" className="flex-[2]" onClick={() => start(suggested.day.id)}>Empezar ▶</Button>
              <Button size="lg" variant="ghost" className="flex-1" onClick={() => navigate('/entrenar')}>Otro día</Button>
            </div>
          </Card>
        )}

        <Card className="p-4">
          <SectionTitle right={<span className="font-mono text-xs text-muted">{plural(week.filter(Boolean).length, 'sesión', 'sesiones')}</span>}>
            Esta semana
          </SectionTitle>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w, i) => {
              const s = week[i];
              const planned = days.find((d) => d.weekday === w.n);
              const isToday = w.n === todayN;
              return (
                <button
                  key={w.n}
                  type="button"
                  onClick={() => s && navigate(`/resumen/${s.id}`)}
                  className={`rounded-xl py-2 text-center border min-h-[58px] ${
                    s ? 'bg-ok/15 border-ok/40' : isToday ? 'border-accent/60 bg-accent/10' : 'bg-panel2 border-line'
                  }`}
                >
                  <p className={`font-mono text-[11px] ${isToday ? 'text-accent' : 'text-muted'}`}>{w.short}</p>
                  <p className={`mt-0.5 text-[15px] font-bold ${s ? 'text-ok' : 'text-muted'}`}>{s ? '✓' : planned ? '·' : ''}</p>
                </button>
              );
            })}
          </div>
        </Card>

        {routine && muscles.length > 0 && (
          <Card className="p-4">
            <SectionTitle right={<span className="font-mono text-[11px] text-muted">hechas / plan</span>}>Series por grupo · semana</SectionTitle>
            <div className="flex flex-col gap-2">
              {muscles.map((m) => {
                const pct = m.target ? Math.min(1, m.done / m.target) : m.done ? 1 : 0;
                return (
                  <div key={m.muscle} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-center">
                    <span className="text-sm truncate">{m.muscle}</span>
                    <span className="font-mono text-xs text-muted">{m.done}/{m.target || '—'}</span>
                    <div className="col-span-2 h-1.5 rounded-full bg-line overflow-hidden mt-1">
                      <div className={`h-full ${pct >= 1 ? 'bg-ok' : 'bg-accent'}`} style={{ width: `${pct * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {needsBackup && (
          <Card className="p-4 border-accent/40 flex items-center gap-3">
            <p className="text-sm flex-1">Tus datos solo están en este móvil. Haz una copia de seguridad de vez en cuando.</p>
            <Button size="sm" onClick={() => navigate('/ajustes')}>Copia</Button>
          </Card>
        )}

        {done.length > 0 && (
          <Card className="p-4">
            <SectionTitle right={<button type="button" className="text-xs text-muted hover:text-accent min-h-[32px]" onClick={() => navigate('/historial')}>Ver todo</button>}>
              Últimas sesiones
            </SectionTitle>
            <div className="flex flex-col">
              {done.slice(0, 4).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navigate(`/resumen/${s.id}`)}
                  className="flex items-center justify-between gap-3 min-h-[54px] border-b border-line last:border-0 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium truncate">{s.dayName}</span>
                    <span className="block text-xs text-muted">{formatDate(s.date)}{durationMin(s) ? ` · ${durationMin(s)} min` : ''}{s.badDay ? ' · día flojo' : ''}</span>
                  </span>
                  <span className="font-mono text-xs text-muted shrink-0 text-right">{sessionSets(s)} series<br />{formatVolume(sessionVolume(s))}</span>
                </button>
              ))}
            </div>
          </Card>
        )}
      </PageBody>
    </>
  );
}

function ContinueCard({ session, onContinue }) {
  const p = progress(session);
  const minutes = session.startedAt ? Math.round((Date.now() - new Date(session.startedAt)) / 60000) : 0;
  return (
    <Card className="p-5 border-ok/50 flex flex-col gap-3">
      <div>
        <p className="font-display text-[11px] uppercase tracking-[0.16em] text-ok">Sesión en curso</p>
        <p className="text-[24px] font-bold leading-tight mt-1">{session.dayName}</p>
        <p className="text-sm text-muted mt-1">{p.done}/{p.total} series · empezada hace {minutes} min</p>
      </div>
      <Button size="lg" variant="ok" onClick={onContinue}>Continuar ▶</Button>
    </Card>
  );
}
