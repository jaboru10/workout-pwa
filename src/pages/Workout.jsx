import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as store from '../data/store';
import { activeRoutine, byId, inProgress, routineDays, useAppState } from '../data/store';
import { WEEKDAYS } from '../data/schema';
import {
  Badge, Button, Chip, EmptyState, IconButton, Input, Label, Loading, Sheet, Stepper, TextArea, Toggle, toast,
} from '../components/ui';
import { PageBody, PageHeader } from '../components/Shell';
import ExercisePicker from '../components/ExercisePicker';
import { tick, useWakeLock } from '../hooks/device';
import {
  effective, executionOrder, exerciseDone, groups, nextPending, progress, supersetLabels, warmupSets,
} from '../logic/session';
import { targetLine } from '../logic/targets';
import { lastPerformance } from '../logic/progression';
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
/* Sesión en curso / edición: una pantalla por ejercicio                  */
/* ===================================================================== */

// Cada pantalla es un ejercicio (o los ejercicios de una superserie, que se
// hacen alternos y conviene ver juntos). Solo lo necesario para apuntar.
function ActiveWorkout({ session }) {
  const state = useAppState();
  const navigate = useNavigate();
  const editing = session.status === 'done';
  const exMap = useMemo(() => byId(state.exercises), [state.exercises]);
  const best = useMemo(() => bestWeights(state.sessions.filter((s) => s.id !== session.id)), [state.sessions, session.id]);
  const labels = useMemo(() => supersetLabels(session), [session]);
  const screens = useMemo(() => groups(session).map((g) => g.idx), [session]);
  useWakeLock(Boolean(state.config.keepAwake) && !editing);

  const screenOf = (ei) => Math.max(0, screens.findIndex((idx) => idx.includes(ei)));
  const [screen, setScreen] = useState(() => {
    const p = editing ? null : nextPending(session);
    return p ? screenOf(p.ei) : 0;
  });
  const [focus, setFocus] = useState(null); // {ei, si} elegido a mano
  const [picker, setPicker] = useState(null); // {mode:'add'|'replace', ei}
  const [menuEi, setMenuEi] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [sessionMenu, setSessionMenu] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const si = Math.min(screen, Math.max(0, screens.length - 1));
  const idxs = screens[si] || [];
  const order = executionOrder(session);
  const pendingHere = editing ? null
    : order.find((o) => idxs.includes(o.ei) && !session.exercises[o.ei]?.sets?.[o.si]?.done) || null;
  const current = focus && idxs.includes(focus.ei) && session.exercises[focus.ei]?.sets?.[focus.si] ? focus : pendingHere;
  const prog = progress(session);
  const isLast = si >= screens.length - 1;

  // En superseries la serie siguiente puede quedar más abajo: se lleva a la vista.
  const curKey = current ? `${current.ei}-${current.si}` : '';
  const prevKey = useRef(curKey);
  useEffect(() => {
    if (curKey && prevKey.current && curKey !== prevKey.current) {
      document.getElementById(`set-${curKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    prevKey.current = curKey;
  }, [curKey]);

  function goTo(n) {
    setFocus(null);
    setScreen(Math.max(0, n));
    window.scrollTo({ top: 0 });
  }

  const update = (fn) => store.updateSession(session.id, fn);

  function patchSet(ei, k, patch) {
    update((s) => ({
      ...s,
      exercises: s.exercises.map((x, i) => (i !== ei ? x : { ...x, sets: x.sets.map((st, j) => (j !== k ? st : { ...st, ...patch })) })),
    }));
  }

  function markDone(ei, k) {
    const ex = session.exercises[ei];
    const set = ex.sets[k];
    const bw = Boolean(exMap[ex.exerciseId]?.bodyweight);
    const eff = effective(set);
    const weight = eff.weight ?? (bw ? 0 : null);
    if (weight == null) { toast('Pon el peso de la serie', 'danger'); return; }
    if (eff.reps == null || eff.reps <= 0) { toast('Pon las repeticiones', 'danger'); return; }

    const nowIso = new Date().toISOString();
    const after = {
      ...session,
      rest: null,
      exercises: session.exercises.map((x, i) => {
        if (i !== ei) return x;
        return {
          ...x,
          sets: x.sets.map((st, j) => {
            if (j === k) return { ...st, done: true, doneAt: st.doneAt || nowIso, weight, reps: eff.reps };
            // Si cambias el peso, las series siguientes del mismo tipo heredan el nuevo.
            if (j > k && !st.done && st.type === set.type && st.weight == null) return { ...st, plan: { ...(st.plan || {}), weight } };
            return st;
          }),
        };
      }),
    };
    update(() => after);
    tick();
    setFocus(null);
    // Ejercicio acabado: pasa solo al siguiente que quede pendiente.
    const next = editing ? null : nextPending(after);
    if (next && !idxs.includes(next.ei)) setTimeout(() => goTo(screenOf(next.ei)), 450);
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
          if (!ws.length) sets.unshift({ id: uid(), type: 'warmup', weight: null, reps: null, rir: null, done: false, doneAt: null, plan: null });
          else sets.unshift(...ws);
          return { ...x, sets };
        }
        const sameType = [...sets].reverse().find((st) => st.type === type) || [...sets].reverse().find((st) => st.type === 'work');
        const plan = sameType ? { weight: sameType.weight ?? sameType.plan?.weight ?? null, reps: sameType.reps ?? sameType.plan?.reps ?? null } : null;
        const entry = { id: uid(), type, weight: null, reps: null, rir: type === 'work' ? (sameType?.rir ?? null) : null, done: false, doneAt: null, plan };
        if (type === 'drop') {
          // Pegada a la última serie de trabajo hecha (o a la última de trabajo).
          let at = -1;
          sets.forEach((st, j) => { if (st.type === 'work' && st.done) at = j; });
          if (at < 0) sets.forEach((st, j) => { if (st.type === 'work') at = j; });
          while (at + 1 < sets.length && sets[at + 1].type === 'drop') at++;
          if (plan && plan.weight) plan.weight = Math.round(plan.weight / 2 / 0.5) * 0.5;
          sets.splice(at + 1, 0, entry);
        } else {
          sets.push(entry);
        }
        return { ...x, sets };
      }),
    }));
  }

  function removeSet(ei, k) {
    update((s) => ({ ...s, exercises: s.exercises.map((x, i) => (i !== ei ? x : { ...x, sets: x.sets.filter((_, j) => j !== k) })) }));
    setFocus(null);
  }

  const finish = () => (editing ? navigate(`/resumen/${session.id}`) : setFinishing(true));
  const screenDone = idxs.length > 0 && idxs.every((ei) => exerciseDone(session.exercises[ei]));

  return (
    <div className="min-h-dvh pb-[calc(96px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-line bg-ink/95 backdrop-blur px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center gap-2 max-w-xl mx-auto">
          <button
            type="button" aria-label="Volver" onClick={() => navigate(editing ? '/historial' : '/')}
            className="grid place-items-center w-11 h-11 rounded-xl text-xl text-muted hover:text-chalk"
          >
            ←
          </button>
          <button type="button" onClick={() => setListOpen(true)} className="min-w-0 flex-1 text-left min-h-[44px]" aria-label="Ver ejercicios">
            <p className="font-display text-[11px] uppercase tracking-[0.14em] text-muted truncate">
              {editing ? `Editando · ${formatDate(session.date)}` : session.dayName}{session.badDay ? ' · día flojo' : ''}
            </p>
            <p className="text-[16px] font-semibold leading-tight">
              {screens.length ? `Ejercicio ${si + 1} de ${screens.length}` : 'Sin ejercicios'} <span className="text-muted text-sm">▾</span>
            </p>
          </button>
          <IconButton label="Opciones de la sesión" onClick={() => setSessionMenu(true)}>⋯</IconButton>
        </div>
        <div className="max-w-xl mx-auto mt-2 h-1 rounded-full bg-line overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }} />
        </div>
      </header>

      <main className="px-4 pt-5 flex flex-col gap-8 max-w-xl mx-auto">
        {session.exercises.length === 0 && (
          <EmptyState
            title="Sesión vacía"
            hint="Añade el primer ejercicio."
            action={<Button onClick={() => setPicker({ mode: 'add' })}>＋ Añadir ejercicio</Button>}
          />
        )}
        {idxs.map((ei) => {
          const ex = session.exercises[ei];
          return (
            <FocusExercise
              key={ex.id}
              ex={ex}
              ei={ei}
              exercise={exMap[ex.exerciseId]}
              label={labels[ei]}
              current={current}
              sessions={state.sessions}
              sessionId={session.id}
              best={best[ex.exerciseId] || 0}
              editing={editing}
              onFocus={(k) => setFocus({ ei, si: k })}
              onCloseEditor={() => setFocus(null)}
              onPatch={(k, p) => patchSet(ei, k, p)}
              onDone={(k) => markDone(ei, k)}
              onUndo={(k) => patchSet(ei, k, { done: false, doneAt: null })}
              onRemoveSet={(k) => removeSet(ei, k)}
              onAddSet={(type) => addSet(ei, type)}
              onMenu={() => setMenuEi(ei)}
            />
          );
        })}
      </main>

      {screens.length > 0 && (
        <div className="fixed left-0 right-0 bottom-0 z-30 border-t border-line bg-panel px-3 pt-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2.5 max-w-xl mx-auto">
            <Button size="lg" variant="ghost" className="flex-1" disabled={si === 0} onClick={() => goTo(si - 1)}>← Anterior</Button>
            {!isLast ? (
              <Button size="lg" variant={screenDone ? 'primary' : 'ghost'} className="flex-[1.4]" onClick={() => goTo(si + 1)}>Siguiente →</Button>
            ) : (
              <Button size="lg" variant={editing ? 'primary' : 'ok'} className="flex-[1.4]" onClick={finish}>{editing ? 'Listo' : 'Terminar ✓'}</Button>
            )}
          </div>
        </div>
      )}

      <ExerciseList
        open={listOpen}
        onClose={() => setListOpen(false)}
        screens={screens}
        session={session}
        exMap={exMap}
        current={si}
        onGo={(n) => { setListOpen(false); goTo(n); }}
        onAdd={() => { setListOpen(false); setPicker({ mode: 'add' }); }}
      />

      <ExercisePicker
        open={Boolean(picker)}
        title={picker?.mode === 'replace' ? 'Cambiar ejercicio' : 'Añadir ejercicio'}
        onClose={() => setPicker(null)}
        onPick={(e) => {
          if (picker?.mode === 'replace') store.replaceSessionExercise(session.id, picker.ei, e.id);
          else { store.addExerciseToSession(session.id, e.id); goTo(9999); }
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
        onAddSet={(type) => { addSet(menuEi, type); setMenuEi(null); }}
        onReplace={() => { setPicker({ mode: 'replace', ei: menuEi }); setMenuEi(null); }}
        onMove={(dir) => { store.moveSessionExercise(session.id, menuEi, dir); setMenuEi(null); goTo(screenOf(menuEi + dir)); }}
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
        onFinish={() => { setSessionMenu(false); finish(); }}
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
/* Un ejercicio a pantalla completa                                       */
/* ===================================================================== */

function FocusExercise({
  ex, ei, exercise, label, current, sessions, sessionId, best, editing,
  onFocus, onCloseEditor, onPatch, onDone, onUndo, onRemoveSet, onAddSet, onMenu,
}) {
  const work = ex.sets.filter((s) => s.type === 'work');
  const last = useMemo(() => lastPerformance(sessions, ex.exerciseId, sessionId), [sessions, ex.exerciseId, sessionId]);
  const bw = Boolean(exercise?.bodyweight);
  const lastLine = last ? last.work.map((s) => `${weightText(s.weight, bw)}×${s.reps}`).join(' · ') : '';

  return (
    <section id={`ex-${ei}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {label && <p className="font-display text-[11px] uppercase tracking-[0.14em] text-accent mb-1">Superserie {label}</p>}
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.01em]">{exercise?.name || 'Ejercicio eliminado'}</h2>
          <p className="font-mono text-[13px] text-muted mt-1">
            {targetLine(ex.target)}{ex.target?.technique === 'biserie' ? ' · biserie' : ''}
          </p>
        </div>
        <IconButton label="Opciones del ejercicio" onClick={onMenu}>⋯</IconButton>
      </div>

      {!editing && (lastLine || ex.suggestion?.text) && (
        <div className="mt-3 text-[14px] leading-snug">
          {lastLine && <p className="text-muted">Última: <span className="font-mono text-chalk/90">{lastLine}</span></p>}
          {ex.suggestion?.text && (
            <p className={`mt-0.5 ${ex.suggestion.kind === 'up' ? 'text-ok' : 'text-accent'}`}>
              {ex.suggestion.kind === 'up' ? '▲ ' : '→ '}{ex.suggestion.text}
            </p>
          )}
        </div>
      )}
      {ex.notes && <p className="mt-2 text-[13px] text-chalk/80">{ex.notes}</p>}

      <div className="mt-4 flex flex-col gap-2">
        {ex.sets.map((set, k) => {
          const isCurrent = current?.ei === ei && current?.si === k;
          const workIndex = ex.sets.slice(0, k + 1).filter((s) => s.type === 'work').length;
          return isCurrent ? (
            <SetEditor
              key={set.id}
              id={`set-${ei}-${k}`}
              set={set}
              workIndex={workIndex}
              workTotal={work.length}
              exercise={exercise}
              bw={bw}
              target={ex.target}
              best={best}
              onPatch={(p) => onPatch(k, p)}
              onDone={() => onDone(k)}
              onUndo={() => onUndo(k)}
              onClose={onCloseEditor}
              onRemove={() => onRemoveSet(k)}
            />
          ) : (
            <SetRow key={set.id} id={`set-${ei}-${k}`} set={set} workIndex={workIndex} bw={bw} onClick={() => onFocus(k)} />
          );
        })}
      </div>
      <Button size="sm" variant="plain" className="mt-2" onClick={() => onAddSet('work')}>＋ Añadir serie</Button>
    </section>
  );
}

function ExerciseList({ open, onClose, screens, session, exMap, current, onGo, onAdd }) {
  return (
    <Sheet open={open} onClose={onClose} title={session.dayName || 'Ejercicios'}>
      <div className="flex flex-col gap-1.5">
        {screens.map((idx, n) => {
          const exs = idx.map((ei) => session.exercises[ei]);
          const work = exs.flatMap((x) => x.sets.filter((s) => s.type === 'work'));
          const done = work.filter((s) => s.done).length;
          const complete = exs.every((x) => exerciseDone(x));
          return (
            <button
              key={exs[0].id}
              type="button"
              onClick={() => onGo(n)}
              className={`w-full flex items-center gap-3 rounded-xl border px-3 min-h-[52px] text-left ${
                n === current ? 'border-accent/60 bg-accent/10' : 'border-line bg-panel2'
              }`}
            >
              <span className={`grid place-items-center w-7 h-7 shrink-0 rounded-md font-mono text-[13px] ${complete ? 'bg-ok/15 text-ok' : 'bg-ink text-muted'}`}>
                {complete ? '✓' : n + 1}
              </span>
              <span className="flex-1 min-w-0 truncate">{exs.map((x) => exMap[x.exerciseId]?.name || '—').join(' + ')}</span>
              <span className="font-mono text-xs text-muted shrink-0">{done}/{work.length}</span>
            </button>
          );
        })}
        <Button variant="outline" className="mt-2" onClick={onAdd}>＋ Añadir ejercicio</Button>
      </div>
    </Sheet>
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

  return (
    <div id={id} className="scroll-mt-24 scroll-mb-28 rounded-2xl border border-accent/50 bg-accent/[0.06] p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-[15px]">
          {title}
          {set.done && <span className="text-ok ml-2">✓</span>}
        </p>
        {isPR && <Badge tone="accent">★ Récord</Badge>}
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
/* Menús y hojas                                                          */
/* ===================================================================== */

function ExerciseMenu({ open, ex, exercise, isFirst, isLast, onClose, onAddSet, onReplace, onMove, onRemove, onNotes, onHistory }) {
  const [notes, setNotes] = useState('');
  useEffect(() => { if (open) setNotes(ex?.notes || ''); }, [open, ex]);
  if (!open || !ex) return null;
  return (
    <Sheet open={open} onClose={() => { onNotes(notes); onClose(); }} title={exercise?.name || 'Ejercicio'}>
      <div className="flex flex-col gap-2.5">
        <div className="flex gap-2.5">
          {!exercise?.bodyweight && <Button variant="ghost" className="flex-1" onClick={() => onAddSet('warmup')}>＋ Aproximación</Button>}
          <Button variant="ghost" className="flex-1" onClick={() => onAddSet('drop')}>＋ Drop</Button>
        </div>
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

function SessionMenu({ open, session, editing, onClose, onChange, onFinish, onDiscard }) {
  const [notes, setNotes] = useState(session.notes || '');
  useEffect(() => { if (open) setNotes(session.notes || ''); }, [open, session.notes]);
  return (
    <Sheet open={open} onClose={() => { onChange({ notes }); onClose(); }} title="Sesión">
      <div className="flex flex-col gap-3">
        <Input label="Fecha" type="date" value={session.date} onChange={(e) => e.target.value && onChange({ date: e.target.value })} />
        <Input label="Nombre del día" value={session.dayName || ''} onChange={(e) => onChange({ dayName: e.target.value })} />
        <Toggle checked={session.badDay} onChange={(v) => onChange({ badDay: v })} label="Día flojo" hint="Reps por debajo de lo normal: la sugerencia no subirá peso." />
        <TextArea label="Notas de la sesión" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sensaciones, sueño, molestias…" />
        <Button variant={editing ? 'primary' : 'ok'} onClick={onFinish}>{editing ? 'Listo' : 'Terminar sesión'}</Button>
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
        <div className="grid grid-cols-2 gap-3">
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
