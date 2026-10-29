import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { activeRoutine, byId, doneSessions, routineDays, useAppState } from '../data/store';
import { Card, EmptyState, Loading, SectionTitle, Segmented, Select, Stat } from '../components/ui';
import { PageBody, PageHeader } from '../components/Shell';
import { computeRecords } from '../logic/records';
import { formatVolume, isWorkSet, muscleSetsByWeek, rmSeries, routineMuscleTargets, short, weeklyVolume, plural } from '../logic/metrics';
import { formatDate } from '../utils/dates';

const WINDOWS = [[3, '3M'], [6, '6M'], [12, '1A'], [0, 'Todo']];

export default function Progress() {
  const state = useAppState();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('ex');
  const exMap = useMemo(() => byId(state.exercises), [state.exercises]);
  const done = useMemo(() => doneSessions(state), [state]);

  if (!state.ready) return <PageBody><Loading /></PageBody>;

  return (
    <>
      <PageHeader crumb="Récords y evolución" title="Progreso" />
      <PageBody className="flex flex-col gap-4 max-w-3xl">
        <Segmented options={[['ex', 'Por ejercicio'], ['week', 'Volumen semanal']]} value={tab} onChange={setTab} />
        {done.length === 0 ? (
          <EmptyState title="Sin datos" hint="Termina tu primera sesión para ver récords y progreso." />
        ) : tab === 'ex' ? (
          <ExerciseProgress sessions={done} exMap={exMap} repRanges={state.config.repRanges} params={params} setParams={setParams} />
        ) : (
          <WeeklyProgress sessions={done} exMap={exMap} state={state} />
        )}
      </PageBody>
    </>
  );
}

function ExerciseProgress({ sessions, exMap, repRanges, params, setParams }) {
  const withHistory = useMemo(() => {
    const ids = new Set();
    sessions.forEach((s) => s.exercises.forEach((x) => { if (x.sets.some(isWorkSet)) ids.add(x.exerciseId); }));
    return [...ids].map((id) => exMap[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [sessions, exMap]);

  // Por defecto, el primer ejercicio de la última sesión (lo más probable es
  // que sea el que quieres mirar), no el primero del abecedario.
  const lastFirst = useMemo(() => sessions[0]?.exercises.find((x) => x.sets.some(isWorkSet))?.exerciseId, [sessions]);
  const wanted = params.get('ex');
  const exId = wanted && withHistory.some((e) => e.id === wanted) ? wanted
    : withHistory.some((e) => e.id === lastFirst) ? lastFirst : withHistory[0]?.id;
  const [windowM, setWindowM] = useState(6);
  const [position, setPosition] = useState('');
  useEffect(() => { setPosition(''); }, [exId]);

  const exercise = exMap[exId];
  const rec = useMemo(() => (exId ? computeRecords(sessions, exId, { windowMonths: windowM, position: position === '' ? null : Number(position), repRanges }) : null), [sessions, exId, windowM, position, repRanges]);
  const series = useMemo(() => rmSeries(sessions, exId, windowM), [sessions, exId, windowM]);
  const recent = useMemo(() => sessions
    .filter((s) => s.exercises.some((x) => x.exerciseId === exId))
    .slice(0, 10), [sessions, exId]);

  if (!withHistory.length) return <EmptyState title="Sin datos" hint="Aún no hay series hechas." />;

  const delta = series.length > 1 ? series[series.length - 1].value - series[0].value : 0;

  return (
    <div className="flex flex-col gap-4">
      <Select value={exId} onChange={(e) => setParams({ ex: e.target.value }, { replace: true })}>
        {withHistory.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </Select>
      <div className="flex gap-2">
        <Segmented className="flex-1" options={WINDOWS} value={windowM} onChange={setWindowM} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <Stat accent label={rec?.maxWeight ? `peso máx · ${formatDate(rec.maxWeight.date, { day: 'numeric', month: 'short' })}` : 'peso máx'}
            value={rec?.maxWeight ? short(rec.maxWeight.value) : '—'} unit={rec?.maxWeight ? 'kg' : ''} sub={rec?.maxWeight ? `× ${rec.maxWeight.reps}` : ''} />
        </Card>
        <Card className="p-4">
          <Stat accent label="1RM estimado" value={rec?.best1rm ? Math.round(rec.best1rm.value) : '—'} unit={rec?.best1rm ? 'kg' : ''}
            sub={rec?.best1rm ? `${short(rec.best1rm.weight)} × ${rec.best1rm.reps}` : ''} />
        </Card>
        <Card className="p-4">
          <Stat label="mejor serie (kg×reps)" value={rec?.bestVolume ? Math.round(rec.bestVolume.value) : '—'}
            sub={rec?.bestVolume ? `${short(rec.bestVolume.weight)} × ${rec.bestVolume.reps}` : ''} />
        </Card>
        <Card className="p-4">
          <Stat label={exercise?.bodyweight ? 'máx reps' : 'series en el periodo'} value={exercise?.bodyweight ? (rec?.maxReps?.value ?? '—') : (rec?.count ?? 0)}
            sub={exercise?.bodyweight && rec?.maxReps ? `con ${short(rec.maxReps.weight)} kg` : ''} />
        </Card>
      </div>

      <Card className="p-4">
        <SectionTitle right={series.length > 1 && (
          <span className={`font-mono text-xs ${delta >= 0 ? 'text-ok' : 'text-danger'}`}>{delta >= 0 ? '+' : ''}{short(Math.round(delta * 10) / 10)} kg</span>
        )}>
          1RM estimado por sesión
        </SectionTitle>
        {series.length < 2 ? (
          <p className="text-sm text-muted py-6 text-center">Hacen falta al menos dos sesiones en el periodo.</p>
        ) : <RMChart points={series} />}
      </Card>

      <Card className="p-4">
        <SectionTitle>Por rango de reps</SectionTitle>
        <Select value={position} onChange={(e) => setPosition(e.target.value)} className="mb-3">
          <option value="">En cualquier posición de la sesión</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => <option key={p} value={p}>Solo cuando fue el {p}º ejercicio</option>)}
        </Select>
        {!rec?.byRange?.length ? <p className="text-sm text-muted">Sin datos para este filtro.</p> : (
          <div className="flex flex-col">
            {rec.byRange.map((r) => (
              <div key={r.rangeName} className="flex items-center justify-between gap-3 min-h-[44px] border-b border-line last:border-0">
                <span className="text-sm">{r.rangeName}</span>
                <span className="font-mono font-bold">{short(r.weight)}<span className="text-xs text-muted font-normal"> kg × {r.reps}</span></span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle>Últimas sesiones</SectionTitle>
        <div className="flex flex-col">
          {recent.map((s) => {
            const sets = s.exercises.filter((x) => x.exerciseId === exId).flatMap((x) => x.sets).filter((st) => st.type !== 'warmup' && st.done);
            return (
              <div key={s.id} className="py-2.5 border-b border-line last:border-0">
                <p className="text-xs text-muted">{formatDate(s.date)} · {s.dayName}{s.badDay ? ' · día flojo' : ''}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {sets.map((st) => (
                    <span key={st.id} className={`font-mono text-[12px] border rounded-md px-1.5 py-0.5 ${st.type === 'drop' ? 'border-accent/30 text-accent' : 'border-line text-chalk/90'}`}>
                      {st.type === 'drop' ? '↘' : ''}{short(st.weight)}×{st.reps}{st.rir != null ? `@${st.rir}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function WeeklyProgress({ sessions, exMap, state }) {
  // 4 semanas + plan caben en un móvil sin desplazamiento lateral.
  const table = useMemo(() => muscleSetsByWeek(sessions, exMap, 4), [sessions, exMap]);
  const weeks = useMemo(() => weeklyVolume(sessions, 8), [sessions]);
  const routine = activeRoutine(state);
  const targets = useMemo(() => routineMuscleTargets(routine ? routineDays(state, routine.id) : [], exMap), [state, routine, exMap]);
  const maxVol = Math.max(1, ...weeks.map((w) => w.volume));

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <SectionTitle right={<span className="font-mono text-[11px] text-muted">plan = {routine?.name || 'sin rutina'}</span>}>Series de trabajo por grupo</SectionTitle>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm border-separate border-spacing-y-1">
            <thead>
              <tr className="text-[11px] text-muted font-display uppercase tracking-[0.1em]">
                <th className="text-left font-normal px-1">Grupo</th>
                {table.weeks.map((w, i) => <th key={w.key} className={`font-normal px-1 ${i === table.weeks.length - 1 ? 'text-accent' : ''}`}>{w.label}</th>)}
                <th className="font-normal px-1">Plan</th>
              </tr>
            </thead>
            <tbody>
              {table.muscles.map((m) => (
                <tr key={m.muscle}>
                  <td className="px-1 truncate max-w-[130px]">{m.muscle}</td>
                  {m.perWeek.map((n, i) => (
                    <td key={i} className={`px-1 text-center font-mono ${i === m.perWeek.length - 1 ? 'text-accent font-bold' : n ? 'text-chalk' : 'text-muted/50'}`}>{n || '·'}</td>
                  ))}
                  <td className="px-1 text-center font-mono text-muted">{targets[m.muscle] || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-2">Cuenta series de trabajo hechas (sin aproximaciones ni drops). Semanas de lunes a domingo.</p>
      </Card>

      <Card className="p-4">
        <SectionTitle right={<span className="font-mono text-xs text-muted">{formatVolume(maxVol)} máx</span>}>Volumen (kg) por semana</SectionTitle>
        <div className="flex items-end gap-1.5 h-[130px]">
          {weeks.map((w, i) => (
            <div key={w.key} className="flex-1 min-w-0 h-full flex flex-col justify-end gap-1.5">
              <div
                title={`${w.label} · ${formatVolume(w.volume)} · ${plural(w.sessions, 'sesión', 'sesiones')}`}
                style={{ height: `${Math.max(2, (w.volume / maxVol) * 100)}%` }}
                className={`rounded-t-md border-t-2 ${i === weeks.length - 1 ? 'bg-accent/20 border-accent' : 'bg-panel2 border-line'}`}
              />
              <span className="font-mono text-[10px] text-muted text-center truncate">{w.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RMChart({ points }) {
  const values = points.map((p) => p.value);
  const lo = Math.min(...values) * 0.97;
  const hi = Math.max(...values) * 1.03;
  const W = 800, H = 220;
  const coords = points.map((p, i) => ({
    x: points.length === 1 ? W / 2 : (i / (points.length - 1)) * W,
    y: H - ((p.value - lo) / (hi - lo || 1)) * (H - 20) - 10,
    ...p,
  }));
  const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const first = coords[0];
  const last = coords[coords.length - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[180px] block overflow-visible">
        {[10, 80, 150, 210].map((y) => <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#2b3140" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <path d={`${line} L${W} ${H} L0 ${H} Z`} fill="rgba(169,123,255,0.14)" />
        <path d={line} fill="none" stroke="#a97bff" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {coords.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r="4" fill="#12151c" stroke="#a97bff" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div className="flex justify-between mt-2 font-mono text-[11px] text-muted">
        <span>{formatDate(first.date, { day: 'numeric', month: 'short' })} · {Math.round(first.value)} kg</span>
        <span>{formatDate(last.date, { day: 'numeric', month: 'short' })} · {Math.round(last.value)} kg</span>
      </div>
    </div>
  );
}
