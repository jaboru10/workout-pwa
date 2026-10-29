import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as store from '../data/store';
import { activeRoutine, byId, inProgress, routineDays, useAppState } from '../data/store';
import { WEEKDAYS } from '../data/schema';
import {
  Badge, Button, Card, Chip, EmptyState, IconButton, Input, Label, Loading, Sheet, Stepper, TextArea, Toggle, toast,
} from '../components/ui';
import { PageBody, PageHeader } from '../components/Shell';
import ExercisePicker from '../components/ExercisePicker';
import { beep, tick, unlockAudio, useNow, useWakeLock, vibrate } from '../hooks/device';
import {
  effective, exerciseDone, nextPending, progress, restAfter, supersetLabels, warmupSets,
} from '../logic/session';
import { fmtRest, parseReps, targetLine } from '../logic/targets';
import { lastPerformance, lastText } from '../logic/progression';
import { bestWeights } from '../logic/records';
import { formatVolume, plannedSets, sessionSets, sessionVolume, short, weightText } from '../logic/metrics';
import { formatDate } from '../utils/dates';
import { uid } from '../data/schema';

const TYPE_LABEL = { work: null, warmup: 'A', drop: 'D' };

export default function Workout() {
  const { sessionId } = useParams();
  const state = useAppState();
  const session = sessionId ? state.sessions.find((s) => s.id === sessionId) : inProgress(state);

  if (!state.ready) return <PageBody><Loading /></PageBody>;
  if (!session) {
    if (sessionId) {
      return (
        <>
          <PageHeader title="Sesión" back="/historial" />
          <PageBody><EmptyState title="No encontrada" hint="Esta sesión ya no existe." /></PageBody>
        </>
      );
    }
    return <DayChooser />;
  }
  return <ActiveWorkout key={session.id} session={session} />;
}

/* ===================================================================== */
/* Elegir día                                                             */
/* ===================================================================== */

function DayChooser() {
  const state = useAppState();
  const navigate = useNavigate();
  const routine = activeRoutine(state);
  const days = routine ? routineDays(state, routine.id) : [];
  const exMap = byId(state.exercises);
  const todayN = ((new Date().getDay() + 6) % 7) + 1;

  function start(dayId) {
    unlockAudio();
    store.startSession(dayId);
    window.scrollTo(0, 0);
  }

  return (
    <>
      <PageHeader crumb={routine ? routine.name : 'Sin rutina activa'} title="Entrenar" />
      <PageBody className="flex flex-col gap-3 max-w-2xl">
        {!routine && (
          <EmptyState
            title="Sin rutina"
            hint="Carga tu rutina (F1 o F2) para tener los ejercicios precargados."
            action={<Button onClick={() => navigate('/rutina')}>Elegir rutina</Button>}
          />
        )}
        {days.map((d) => {
          const sets = (d.exercises || []).reduce((n, e) => n + (Number(e.sets) || 0), 0);
          const isToday = d.weekday === todayN;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => start(d.id)}
              className={`text-left rounded-2xl border p-4 active:scale-[0.99] transition ${
                isToday ? 'border-accent/60 bg-accent/10' : 'border-line bg-panel'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {d.weekday && <Badge tone={isToday ? 'accent' : 'muted'}>{WEEKDAYS[d.weekday - 1].name}</Badge>}
                {isToday && <Badge tone="ok">Hoy</Badge>}
              </div>
              <p className="text-lg font-bold">{d.name}</p>
              <p className="text-xs text-muted mt-0.5">
                {(d.exercises || []).length} ejercicios · {sets} series
              </p>
              <p className="text-xs text-muted/80 mt-1.5 line-clamp-2">
                {(d.exercises || []).slice().sort((a, b) => a.order - b.order).map((e) => exMap[e.exerciseId]?.name).filter(Boolean).join(' · ')}
              </p>
            </button>
          );
        })}
        <Button variant="outline" size="lg" onClick={() => start(null)}>＋ Sesión libre (sin plantilla)</Button>
      </PageBody>
    </>
  );
}

/* ===================================================================== */
/* Sesión en curso / edición                                              */
/* ===================================================================== */

function ActiveWorkout({ session }) {
  const state = useAppState();
  const navigate = useNavigate();
  const editing = session.status === 'done';
  const exMap = useMemo(() => byId(state.exercises), [state.exercises]);
  const best = useMemo(() => bestWeights(state.sessions.filter((s) => s.id !== session.id)), [state.sessions, session.id]);
  const labels = useMemo(() => supersetLabels(session), [session]);
  const now = useNow(1000);
  useWakeLock(Boolean(state.config.keepAwake) && !editing);

  const [focus, setFocus] = useState(null); // {ei, si} elegido a mano
  const [openOverride, setOpenOverride] = useState({});
  const [picker, setPicker] = useState(null); // {mode:'add'|'replace', ei}
  const [menuEi, setMenuEi] = useState(null);
  const [sessionMenu, setSessionMenu] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const pending = editing ? null : nextPending(session);
  const current = focus && session.exercises[focus.ei]?.sets?.[focus.si] ? focus : pending;
  const prog = progress(session);

  // Lleva la serie activa a la vista cuando cambia.
  const lastKey = useRef('');
  useEffect(() => {
    if (!current) return;
    const key = `${current.ei}-${current.si}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    const el = document.getElementById(`set-${key}`);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  }, [current]);

  const update = (fn) => store.updateSession(session.id, fn);

  function patchSet(ei, si, patch) {
    update((s) => ({
      ...s,
      exercises: s.exercises.map((x, i) => (i !== ei ? x : {
        ...x,
        sets: x.sets.map((st, k) => (k !== si ? st : { ...st, ...patch })),
      })),
    }));
  }

  function markDone(ei, si) {
    unlockAudio();
    const ex = session.exercises[ei];
    const set = ex.sets[si];
    const exercise = exMap[ex.exerciseId];
    const eff = effective(set);
    const bw = Boolean(exercise?.bodyweight);
    const weight = eff.weight ?? (bw ? 0 : null);
    if (weight == null) { toast('Pon el peso de la serie', 'danger'); return; }
    if (eff.reps == null || eff.reps <= 0) { toast('Pon las repeticiones', 'danger'); return; }

    const nowIso = new Date().toISOString();
    let after = null;
    update((s) => {
      const exercises = s.exercises.map((x, i) => {
        if (i !== ei) return x;
        const sets = x.sets.map((st, k) => {
          if (k === si) return { ...st, done: true, doneAt: st.doneAt || nowIso, weight, reps: eff.reps };
          // Si cambias el peso, las series siguientes del mismo tipo heredan el nuevo.
          if (k > si && !st.done && st.type === set.type && st.weight == null) {
            return { ...st, plan: { ...(st.plan || {}), weight } };
          }
          return st;
        });
        return { ...x, sets };
      });
      after = { ...s, exercises };
      let rest = s.rest;
      if (!editing && state.config.autoRest !== false && set.type !== 'warmup') {
        const secs = restAfter(after, ei, si, state.config);
        rest = secs > 0 ? { startedAt: nowIso, endsAt: Date.now() + secs * 1000, duration: secs } : null;
      }
      return { ...after, rest };
    });
    tick();
    setFocus(null);
  }

  function undoDone(ei, si) {
    patchSet(ei, si, { done: false, doneAt: null });
  }

  function addSet(ei, type) {
    update((s) => ({
      ...s,
      exercises: s.exercises.map((x, i) => {
        if (i !== ei) return x;
        const sets = [...x.sets];
        if (type === 'warmup') {
          const firstWork = sets.find((st) => st.type === 'work');
          const w = firstWork ? (firstWork.weight ?? firstWork.plan?.weight) : null;
          const ws = warmupSets(w, exMap[x.exerciseId]?.increment);
          if (!ws.length) {
            sets.unshift({ id: uid(), type: 'warmup', weight: null, reps: null, rir: null, done: false, doneAt: null, plan: null });
          } else {
            sets.unshift(...ws);
          }
          return { ...x, sets };
        }
        const sameType = [...sets].reverse().find((st) => st.type === type) || [...sets].reverse().find((st) => st.type === 'work');
        const plan = sameType ? { weight: sameType.weight ?? sameType.plan?.weight ?? null, reps: sameType.reps ?? sameType.plan?.reps ?? null } : null;
        const entry = { id: uid(), type, weight: null, reps: null, rir: type === 'work' ? (sameType?.rir ?? null) : null, done: false, doneAt: null, plan };
        if (type === 'drop') {
          // Pegada a la última serie de trabajo hecha (o a la última de trabajo).
          let at = -1;
          sets.forEach((st, k) => { if (st.type === 'work' && st.done) at = k; });
          if (at < 0) sets.forEach((st, k) => { if (st.type === 'work') at = k; });
          while (at + 1 < sets.length && sets[at + 1].type === 'drop') at++;
          if (plan && plan.weight) plan.weight = Math.round(plan.weight / 2 / 0.5) * 0.5;
          sets.splice(at + 1, 0, entry);
        } else {
          sets.push(entry);
        }
        return { ...x, sets };
      }),
    }));
    setOpenOverride((o) => ({ ...o, [session.exercises[ei].id]: true }));
  }

  function removeSet(ei, si) {
    update((s) => ({
      ...s,
      exercises: s.exercises.map((x, i) => (i !== ei ? x : { ...x, sets: x.sets.filter((_, k) => k !== si) })),
    }));
    setFocus(null);
  }

  function setRest(rest) { update((s) => ({ ...s, rest })); }

  const totalSets = sessionSets(session);
  const elapsed = session.startedAt ? Math.max(0, Math.floor((now - new Date(session.startedAt)) / 1000)) : 0;
  const elapsedLabel = fmtElapsed(elapsed);

  return (
    <div className="min-h-dvh pb-[calc(96px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-line bg-ink/95 backdrop-blur px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          <button
            type="button" aria-label="Volver" onClick={() => navigate(editing ? '/historial' : '/')}
            className="grid place-items-center w-11 h-11 rounded-xl text-xl text-muted hover:text-chalk"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[11px] uppercase tracking-[0.14em] text-muted truncate">
              {editing ? `Editando · ${formatDate(session.date)}` : `En curso · ${elapsedLabel}`}
              {session.badDay ? ' · día flojo' : ''}
            </p>
            <p className="text-[17px] font-bold leading-tight truncate">{session.dayName}</p>
          </div>
          <div className="text-right shrink-0 mr-1">
            <p className="font-mono text-[15px] font-bold leading-none">{prog.done}<span className="text-muted">/{prog.total}</span></p>
            <p className="text-[10px] text-muted uppercase tracking-wide">series</p>
          </div>
          <IconButton label="Opciones de la sesión" onClick={() => setSessionMenu(true)}>⋯</IconButton>
        </div>
        <div className="max-w-3xl mx-auto mt-2 h-1 rounded-full bg-line overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }} />
        </div>
      </header>

      <div className="px-3 pt-3 flex flex-col gap-3 max-w-3xl mx-auto">
        {session.exercises.length === 0 && (
          <EmptyState
            title="Sesión vacía"
            hint="Añade el primer ejercicio."
            action={<Button onClick={() => setPicker({ mode: 'add' })}>＋ Añadir ejercicio</Button>}
          />
        )}

        {session.exercises.map((ex, ei) => {
          const exercise = exMap[ex.exerciseId];
          const open = openOverride[ex.id] ?? (current?.ei === ei);
          return (
            <ExerciseCard
              key={ex.id}
              ex={ex}
              ei={ei}
              exercise={exercise}
              label={labels[ei]}
              open={open}
              onToggle={() => setOpenOverride((o) => ({ ...o, [ex.id]: !open }))}
              current={current}
              config={state.config}
              sessions={state.sessions}
              sessionId={session.id}
              best={best[ex.exerciseId] || 0}
              editing={editing}
              onFocus={(si) => { setFocus({ ei, si }); setOpenOverride((o) => ({ ...o, [ex.id]: true })); }}
              onCloseEditor={() => setFocus(null)}
              onPatch={(si, p) => patchSet(ei, si, p)}
              onDone={(si) => markDone(ei, si)}
              onUndo={(si) => undoDone(ei, si)}
              onRemoveSet={(si) => removeSet(ei, si)}
              onAddSet={(type) => addSet(ei, type)}
              onMenu={() => setMenuEi(ei)}
            />
          );
        })}

        {session.exercises.length > 0 && (
          <Button variant="outline" size="lg" onClick={() => setPicker({ mode: 'add' })}>＋ Añadir ejercicio</Button>
        )}
      </div>

      <BottomBar
        session={session}
        editing={editing}
        now={now}
        config={state.config}
        onRest={setRest}
        onFinish={() => (editing ? navigate(`/resumen/${session.id}`) : setFinishing(true))}
        totalSets={totalSets}
      />

      <ExercisePicker
        open={Boolean(picker)}
        title={picker?.mode === 'replace' ? 'Cambiar ejercicio' : 'Añadir ejercicio'}
        onClose={() => setPicker(null)}
        onPick={(e) => {
          if (picker?.mode === 'replace') store.replaceSessionExercise(session.id, picker.ei, e.id);
          else store.addExerciseToSession(session.id, e.id);
          setFocus(null);
        }}
      />

      <ExerciseMenu
        open={menuEi != null}
        ex={menuEi != null ? session.exercises[menuEi] : null}
        exercise={menuEi != null ? exMap[session.exercises[menuEi]?.exerciseId] : null}
        isFirst={menuEi === 0}
        isLast={menuEi === session.exercises.length - 1}
        onClose={() => setMenuEi(null)}
        onReplace={() => { setPicker({ mode: 'replace', ei: menuEi }); setMenuEi(null); }}
        onMove={(dir) => { store.moveSessionExercise(session.id, menuEi, dir); setMenuEi(null); setFocus(null); }}
        onRemove={() => {
          if (!confirm('¿Quitar este ejercicio de la sesión?')) return;
          store.removeSessionExercise(session.id, menuEi); setMenuEi(null); setFocus(null);
        }}
        onNotes={(notes) => update((s) => ({ ...s, exercises: s.exercises.map((x, i) => (i === menuEi ? { ...x, notes } : x)) }))}
        onHistory={() => { const id = session.exercises[menuEi]?.exerciseId; setMenuEi(null); navigate(`/progreso?ex=${id}`); }}
      />

      <SessionMenu
        open={sessionMenu}
        session={session}
        editing={editing}
        onClose={() => setSessionMenu(false)}
        onChange={(patch) => update((s) => ({ ...s, ...patch }))}
        onDiscard={() => {
          if (!confirm(editing ? '¿Borrar esta sesión del historial?' : '¿Descartar la sesión? No se guardará nada.')) return;
          store.deleteSession(session.id);
          navigate(editing ? '/historial' : '/');
        }}
      />

      <FinishSheet
        open={finishing}
        session={session}
        onClose={() => setFinishing(false)}
        onFinish={({ badDay, notes }) => {
          store.finishSession(session.id, { badDay, notes });
          setFinishing(false);
          navigate(`/resumen/${session.id}`, { replace: true });
        }}
        onDiscard={() => {
          store.deleteSession(session.id);
          setFinishing(false);
          navigate('/', { replace: true });
        }}
      />
    </div>
  );
}

/* ===================================================================== */
/* Tarjeta de ejercicio                                                   */
/* ===================================================================== */

function ExerciseCard({
  ex, ei, exercise, label, open, onToggle, current, config, sessions, sessionId, best, editing,
  onFocus, onCloseEditor, onPatch, onDone, onUndo, onRemoveSet, onAddSet, onMenu,
}) {
  const done = exerciseDone(ex);
  const work = ex.sets.filter((s) => s.type === 'work');
  const workDone = work.filter((s) => s.done).length;
  const last = useMemo(() => (open ? lastPerformance(sessions, ex.exerciseId, sessionId) : null), [open, sessions, ex.exerciseId, sessionId]);
  const reps = parseReps(ex.target?.reps);
  const hasWarmups = ex.sets.some((s) => s.type === 'warmup');
  const bw = Boolean(exercise?.bodyweight);

  return (
    <Card id={`ex-${ei}`} className={`overflow-hidden ${current?.ei === ei ? 'border-accent/50' : ''} ${done && !open ? 'opacity-80' : ''}`}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
        <span className={`grid place-items-center min-w-[34px] h-[34px] px-1 shrink-0 rounded-lg border font-mono text-[13px] font-semibold ${
          done ? 'bg-ok/15 border-ok/40 text-ok' : label ? 'bg-accent/15 border-accent/40 text-accent' : 'bg-panel2 border-line text-muted'
        }`}>
          {done ? '✓' : label || ei + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold leading-snug">{exercise?.name || 'Ejercicio eliminado'}</span>
          <span className="block text-xs text-muted font-mono truncate">
            {targetLine(ex.target, config)}
            {ex.target?.technique === 'biserie' ? ' · biserie' : ''}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1 shrink-0">
          {ex.target?.role && <Badge tone={ex.target.role === 'F' ? 'accent' : 'muted'}>{ex.target.role === 'F' ? 'Fuerza' : ex.target.role === 'H' ? 'Hipert.' : 'Acces.'}</Badge>}
          <span className="font-mono text-xs text-muted">{workDone}/{work.length}</span>
        </span>
      </button>

      {!open && workDone > 0 && (
        <div className="px-3.5 pb-3 -mt-1 flex flex-wrap gap-1.5">
          {ex.sets.filter((s) => s.done && s.type !== 'warmup').map((s) => (
            <span key={s.id} className="font-mono text-[12px] bg-ink border border-line rounded-md px-1.5 py-0.5 text-muted">
              {s.type === 'drop' ? '↘' : ''}{weightText(s.weight, bw)}×{s.reps}{s.rir != null ? `@${s.rir}` : ''}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="border-t border-line px-3.5 pt-3 pb-3.5 flex flex-col gap-2.5">
          {(ex.suggestion?.text || last) && !editing && (
            <div className="rounded-xl bg-panel2 border border-line px-3 py-2.5 text-[13px] leading-snug">
              {last && <p className="text-muted"><span className="text-chalk/80">Última</span> {lastText(last)}</p>}
              {ex.suggestion?.text && (
                <p className={`mt-1 ${ex.suggestion.kind === 'up' ? 'text-ok' : 'text-accent'}`}>
                  {ex.suggestion.kind === 'up' ? '▲ ' : '→ '}{ex.suggestion.text}
                </p>
              )}
              {ex.suggestion?.detail && <p className="mt-1 text-muted">{ex.suggestion.detail}</p>}
            </div>
          )}
          {(ex.target?.notes || ex.notes) && (
            <p className="text-[13px] text-muted leading-snug">
              {ex.target?.notes}{ex.target?.notes && ex.notes ? ' · ' : ''}{ex.notes && <span className="text-chalk/80">{ex.notes}</span>}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            {ex.sets.map((set, si) => {
              const isCurrent = current?.ei === ei && current?.si === si;
              const workIndex = ex.sets.slice(0, si + 1).filter((s) => s.type === 'work').length;
              return isCurrent ? (
                <SetEditor
                  key={set.id}
                  id={`set-${ei}-${si}`}
                  set={set}
                  workIndex={workIndex}
                  workTotal={work.length}
                  exercise={exercise}
                  bw={bw}
                  target={ex.target}
                  best={best}
                  onPatch={(p) => onPatch(si, p)}
                  onDone={() => onDone(si)}
                  onUndo={() => onUndo(si)}
                  onClose={onCloseEditor}
                  onRemove={() => onRemoveSet(si)}
                />
              ) : (
                <SetRow key={set.id} id={`set-${ei}-${si}`} set={set} workIndex={workIndex} bw={bw} onClick={() => onFocus(si)} />
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => onAddSet('work')}>＋ Serie</Button>
            {!hasWarmups && !bw && reps.kind !== 'amrap' && <Button size="sm" variant="ghost" onClick={() => onAddSet('warmup')}>＋ Aproximación</Button>}
            <Button size="sm" variant="ghost" onClick={() => onAddSet('drop')}>＋ Drop</Button>
            <Button size="sm" variant="plain" onClick={onMenu} className="ml-auto">Opciones ⋯</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function setTag(set, workIndex) {
  if (set.type === 'warmup') return 'A';
  if (set.type === 'drop') return '↘';
  return String(workIndex);
}

function SetRow({ id, set, workIndex, bw, onClick }) {
  const eff = effective(set);
  const muted = !set.done;
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl border px-3 min-h-[50px] text-left active:bg-panel2 ${
        set.done ? 'border-line bg-ink' : 'border-dashed border-line bg-transparent'
      }`}
    >
      <span className={`grid place-items-center w-7 h-7 shrink-0 rounded-md font-mono text-[13px] ${
        set.type === 'warmup' ? 'bg-panel2 text-muted' : set.type === 'drop' ? 'bg-accent/10 text-accent' : 'bg-panel2 text-chalk'
      }`}>
        {setTag(set, workIndex)}
      </span>
      <span className={`flex-1 font-mono text-[16px] ${muted ? 'text-muted' : 'text-chalk font-semibold'}`}>
        {weightText(eff.weight, bw)}{!bw && <span className="text-xs text-muted"> kg</span>}
        <span className="text-muted mx-1.5">×</span>
        {eff.reps != null ? eff.reps : '—'}
      </span>
      <span className="font-mono text-xs text-muted w-12 text-right">{set.rir != null ? `RIR ${set.rir}` : ''}</span>
      <span className={`w-6 text-center text-lg ${set.done ? 'text-ok' : 'text-line'}`}>{set.done ? '✓' : '○'}</span>
    </button>
  );
}

function SetEditor({ id, set, workIndex, workTotal, exercise, bw, target, best, onPatch, onDone, onUndo, onClose, onRemove }) {
  const step = Number(exercise?.increment) > 0 ? Number(exercise.increment) : 2.5;
  const eff = effective(set);
  const isPR = set.type === 'work' && best > 0 && Number(eff.weight || 0) > best;
  const title = set.type === 'warmup' ? 'Aproximación' : set.type === 'drop' ? 'Drop (sin descanso)' : `Serie ${workIndex} de ${workTotal}`;
  // Sin peso (y no es de peso corporal) o sin reps la serie no se puede
  // marcar: el botón lleva al campo que falta en vez de guardar una serie vacía.
  const missing = !bw && eff.weight == null ? 'weight' : eff.reps == null ? 'reps' : null;
  const tryDone = () => {
    if (!missing) { onDone(); return; }
    const input = document.querySelector(`#${id} input[aria-label="${missing === 'weight' ? 'Peso en kilos' : 'Repeticiones'}"]`);
    input?.focus();
  };
  const planText = set.plan && (set.plan.weight != null || set.plan.reps != null)
    ? `plan ${set.plan.weight != null ? `${short(set.plan.weight)} kg` : '—'} × ${set.plan.reps ?? '—'}`
    : '';

  return (
    <div id={id} className="rounded-2xl border border-accent/50 bg-accent/[0.06] p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-[15px]">
          {title}
          {set.done && <span className="text-ok ml-2">✓</span>}
        </p>
        <div className="flex items-center gap-2">
          {isPR && <Badge tone="accent">★ Récord</Badge>}
          {planText && <span className="font-mono text-[11px] text-muted">{planText}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
        <div className="min-w-0">
          <Label>{bw ? 'Lastre (kg)' : 'Peso (kg)'}</Label>
          <Stepper
            value={set.weight}
            placeholder={set.plan?.weight}
            step={step}
            onChange={(v) => onPatch({ weight: v })}
            ariaLabel="Peso en kilos"
          />
        </div>
        <div className="min-w-0">
          <Label>Repeticiones</Label>
          <Stepper
            value={set.reps}
            placeholder={set.plan?.reps}
            step={1}
            decimal={false}
            onChange={(v) => onPatch({ reps: v == null ? null : Math.round(v) })}
            ariaLabel="Repeticiones"
          />
        </div>
      </div>

      {set.type === 'work' && (
        <div>
          <Label>RIR · reps que te quedaban{target?.rir != null && target?.rir !== '' ? ` (objetivo ${target.rir})` : ''}</Label>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map((n) => (
              <Chip key={n} active={set.rir === n} className="flex-1" onClick={() => onPatch({ rir: set.rir === n ? null : n })}>
                {n === 4 ? '4+' : n}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {!set.done ? (
        <Button size="lg" variant={missing ? 'ghost' : 'ok'} onClick={tryDone} className="w-full text-[17px]">
          {missing === 'weight' ? 'Escribe el peso' : missing === 'reps' ? 'Escribe las reps'
            : `✓ Hecha · ${weightText(eff.weight, bw)} × ${eff.reps}`}
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onUndo}>Desmarcar</Button>
          <Button className="flex-1" onClick={onClose}>Listo</Button>
        </div>
      )}
      <button type="button" onClick={onRemove} className="self-center text-xs text-muted hover:text-danger min-h-[32px] px-3">
        Borrar esta serie
      </button>
    </div>
  );
}

/* ===================================================================== */
/* Barra inferior: descanso / terminar                                    */
/* ===================================================================== */

function BottomBar({ session, editing, now, config, onRest, onFinish, totalSets }) {
  const rest = session.rest;
  // `now` llega del último tic (puede ir hasta 1 s por detrás): se acota a la
  // duración para que no aparezca 2:31 en un descanso de 2:30.
  const remaining = rest ? Math.min(rest.duration || Infinity, Math.ceil((rest.endsAt - now) / 1000)) : null;
  const firedFor = useRef(null);

  useEffect(() => {
    if (!rest || remaining == null) return;
    if (remaining <= 0 && firedFor.current !== rest.endsAt) {
      firedFor.current = rest.endsAt;
      if (config.sound !== false) beep();
      if (config.vibrate !== false) vibrate();
    }
    if (remaining <= -8) onRest(null); // se oculta sola unos segundos después
  }, [remaining, rest, config.sound, config.vibrate, onRest]);

  const showRest = rest && remaining != null && remaining > -8 && !editing;
  const pct = showRest ? Math.min(1, Math.max(0, 1 - remaining / rest.duration)) : 0;

  return (
    <div className="fixed left-0 right-0 bottom-0 z-30 border-t border-line bg-panel
                    px-3 pt-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
      <div className="max-w-3xl mx-auto">
        {showRest ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className={`font-display text-[11px] uppercase tracking-[0.14em] ${remaining <= 0 ? 'text-ok' : 'text-muted'}`}>
                {remaining <= 0 ? '¡A por la siguiente!' : 'Descanso'}
              </p>
              <p className={`font-mono text-[30px] font-bold leading-none ${remaining <= 0 ? 'text-ok' : remaining <= 10 ? 'text-accent' : 'text-chalk'}`}>
                {remaining <= 0 ? '0:00' : fmtRest(remaining)}
              </p>
              <div className="mt-1.5 h-1 rounded-full bg-line overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${pct * 100}%` }} />
              </div>
            </div>
            <Button size="md" variant="ghost" onClick={() => onRest({ ...rest, endsAt: rest.endsAt - 15000, duration: Math.max(15, rest.duration - 15) })}>−15</Button>
            <Button size="md" variant="ghost" onClick={() => onRest({ ...rest, endsAt: Math.max(rest.endsAt, Date.now()) + 15000, duration: rest.duration + 15 })}>+15</Button>
            <Button size="md" onClick={() => onRest(null)}>Saltar</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex-1 min-w-0">
              <p className="font-display text-[11px] uppercase tracking-[0.14em] text-muted">{editing ? 'Cambios guardados' : 'Hechas'}</p>
              <p className="font-mono text-[15px]">{totalSets} series · {formatVolume(sessionVolume(session))}</p>
            </div>
            <Button size="lg" variant={editing ? 'primary' : 'ok'} onClick={onFinish}>
              {editing ? 'Listo' : 'Terminar ✓'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================================================================== */
/* Menús y hojas                                                          */
/* ===================================================================== */

function ExerciseMenu({ open, ex, exercise, isFirst, isLast, onClose, onReplace, onMove, onRemove, onNotes, onHistory }) {
  const [notes, setNotes] = useState('');
  useEffect(() => { if (open) setNotes(ex?.notes || ''); }, [open, ex]);
  if (!open || !ex) return null;
  return (
    <Sheet open={open} onClose={() => { onNotes(notes); onClose(); }} title={exercise?.name || 'Ejercicio'}>
      <div className="flex flex-col gap-2.5">
        <Button variant="ghost" onClick={onReplace} className="justify-start">⇄ Cambiar por otro ejercicio</Button>
        <div className="flex gap-2.5">
          <Button variant="ghost" className="flex-1" disabled={isFirst} onClick={() => onMove(-1)}>↑ Subir</Button>
          <Button variant="ghost" className="flex-1" disabled={isLast} onClick={() => onMove(1)}>↓ Bajar</Button>
        </div>
        <Button variant="ghost" onClick={onHistory} className="justify-start">◔ Ver progreso de este ejercicio</Button>
        <TextArea label="Nota de hoy" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Molestias, agarre, máquina distinta…" />
        <Button variant="danger" onClick={onRemove}>Quitar de la sesión</Button>
      </div>
    </Sheet>
  );
}

function SessionMenu({ open, session, editing, onClose, onChange, onDiscard }) {
  const [notes, setNotes] = useState(session.notes || '');
  useEffect(() => { if (open) setNotes(session.notes || ''); }, [open, session.notes]);
  return (
    <Sheet open={open} onClose={() => { onChange({ notes }); onClose(); }} title="Sesión">
      <div className="flex flex-col gap-3">
        <Input label="Fecha" type="date" value={session.date} onChange={(e) => e.target.value && onChange({ date: e.target.value })} />
        <Input label="Nombre del día" value={session.dayName || ''} onChange={(e) => onChange({ dayName: e.target.value })} />
        <Toggle checked={session.badDay} onChange={(v) => onChange({ badDay: v })} label="Día flojo" hint="Reps por debajo de lo normal: la sugerencia no subirá peso." />
        <TextArea label="Notas de la sesión" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sensaciones, sueño, molestias…" />
        <Button variant="danger" onClick={onDiscard}>{editing ? 'Borrar sesión' : 'Descartar sesión'}</Button>
      </div>
    </Sheet>
  );
}

function FinishSheet({ open, session, onClose, onFinish, onDiscard }) {
  const [badDay, setBadDay] = useState(session.badDay);
  const [notes, setNotes] = useState(session.notes || '');
  useEffect(() => { if (open) { setBadDay(session.badDay); setNotes(session.notes || ''); } }, [open, session.badDay, session.notes]);
  const done = sessionSets(session);
  const planned = plannedSets(session);
  const pendingCount = session.exercises.reduce((n, x) => n + x.sets.filter((s) => !s.done && s.type !== 'warmup').length, 0);
  const minutes = session.startedAt ? Math.round((Date.now() - new Date(session.startedAt)) / 60000) : 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Terminar sesión"
      footer={done > 0 ? (
        <>
          <Button variant="ghost" className="flex-1" onClick={onClose}>Seguir</Button>
          <Button variant="ok" className="flex-[2]" size="lg" onClick={() => onFinish({ badDay, notes })}>Guardar sesión</Button>
        </>
      ) : (
        <>
          <Button variant="ghost" className="flex-1" onClick={onClose}>Seguir</Button>
          <Button variant="danger" className="flex-1" onClick={onDiscard}>Descartar</Button>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <div><p className="font-mono text-2xl font-bold">{minutes}<span className="text-sm text-muted">′</span></p><p className="text-xs text-muted">duración</p></div>
          <div><p className="font-mono text-2xl font-bold">{done}<span className="text-sm text-muted">/{planned}</span></p><p className="text-xs text-muted">series</p></div>
          <div><p className="font-mono text-2xl font-bold">{formatVolume(sessionVolume(session))}</p><p className="text-xs text-muted">volumen</p></div>
        </div>
        {done === 0 && <p className="text-sm text-danger">No hay ninguna serie marcada como hecha.</p>}
        {done > 0 && pendingCount > 0 && (
          <p className="text-sm text-muted">Quedan {pendingCount} series sin marcar: no se guardarán.</p>
        )}
        <Toggle checked={badDay} onChange={setBadDay} label="Día flojo" hint="Así la próxima sugerencia no subirá peso." />
        <TextArea label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sensaciones, sueño, molestias…" />
      </div>
    </Sheet>
  );
}

function fmtElapsed(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
