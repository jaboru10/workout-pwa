// Construcción y recorrido de una sesión en curso.
import { uid } from '../data/schema';
import { parseReps, parseRir, restFor } from './targets';
import { suggest } from './progression';
import { todayLocal } from '../utils/dates';

function targetFrom(de) {
  return {
    sets: Number(de?.sets) || 3,
    reps: de?.reps ?? '',
    rir: de?.rir ?? null,
    restSec: de?.restSec ?? null,
    role: de?.role ?? null,
    superset: de?.superset ?? null,
    technique: de?.technique || 'normal',
    notes: de?.notes || '',
  };
}

function setEntry(type, plan, rir) {
  return { id: uid(), type, weight: null, reps: null, rir: rir ?? null, done: false, doneAt: null, plan };
}

/** Series iniciales de un ejercicio según objetivo y sugerencia. */
export function buildSets(target, sug) {
  const rir = parseRir(target.rir);
  const reps = parseReps(target.reps);
  const n = Number(target.sets) || 3;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(setEntry('work', { weight: sug?.weight ?? null, reps: sug?.reps?.[i] ?? reps.max ?? null }, rir?.min ?? null));
    if (target.technique === 'biserie') {
      out.push(setEntry('drop', { weight: sug?.dropWeight ?? null, reps: sug?.dropReps ?? reps.parts?.[1] ?? null }, null));
    }
  }
  return out;
}

export function sessionExerciseFrom(exercise, de, sessions, order, excludeId) {
  const target = targetFrom(de);
  const sug = suggest(exercise, target, sessions, excludeId);
  return {
    id: uid(),
    exerciseId: exercise.id,
    order,
    movedFromDayId: null,
    precedingExerciseIds: [],
    target,
    suggestion: { kind: sug.kind, text: sug.text, detail: sug.detail, weight: sug.weight, reps: sug.reps },
    sets: buildSets(target, sug),
    notes: '',
  };
}

export function newSession({ day, routine, exercisesById, sessions }) {
  const id = uid();
  const now = new Date().toISOString();
  const exs = [...(day?.exercises || [])]
    .sort((a, b) => a.order - b.order)
    .filter((de) => exercisesById[de.exerciseId])
    .map((de, i) => sessionExerciseFrom(exercisesById[de.exerciseId], de, sessions, i + 1, id));
  return withPreceding({
    id,
    status: 'in_progress',
    date: todayLocal(),
    startedAt: now,
    finishedAt: null,
    updatedAt: now,
    routineId: routine?.id || null,
    routineName: routine?.name || null,
    dayId: day?.id || null,
    dayName: day?.name || 'Sesión libre',
    badDay: false,
    notes: '',
    rest: null,
    exercises: exs,
  });
}

/** Recalcula el orden real y los ejercicios previos (contexto de fatiga). */
export function withPreceding(session) {
  const exs = (session.exercises || []).map((x, i, arr) => ({
    ...x,
    order: i + 1,
    precedingExerciseIds: arr.slice(0, i).map((p) => p.exerciseId),
  }));
  return { ...session, exercises: exs };
}

/** Grupos de superserie: índices consecutivos con la misma letra. */
export function groups(session) {
  const exs = session.exercises || [];
  const out = [];
  for (let i = 0; i < exs.length; i++) {
    const ss = exs[i].target?.superset;
    const prev = out[out.length - 1];
    if (ss && prev && prev.ss === ss && prev.idx[prev.idx.length - 1] === i - 1) prev.idx.push(i);
    else out.push({ ss: ss || null, idx: [i] });
  }
  return out;
}

/** Etiqueta "A1", "A2"… para ejercicios en superserie (o null). */
export function supersetLabels(session) {
  const labels = {};
  groups(session).forEach((g) => {
    if (g.ss && g.idx.length > 1) g.idx.forEach((ei, k) => { labels[ei] = `${g.ss}${k + 1}`; });
  });
  return labels;
}

/**
 * Orden natural de ejecución: dentro de una superserie se alterna por
 * "rondas" (A1 serie 1, A2 serie 1, A1 serie 2…). Una serie drop va pegada a
 * la de trabajo anterior.
 */
export function executionOrder(session) {
  const exs = session.exercises || [];
  const order = [];
  groups(session).forEach((g) => {
    if (g.idx.length === 1) {
      const ei = g.idx[0];
      (exs[ei].sets || []).forEach((_, si) => order.push({ ei, si }));
      return;
    }
    // Rondas: agrupamos cada serie de trabajo con sus drops/calentamientos siguientes.
    const rounds = g.idx.map((ei) => {
      const chunks = [];
      (exs[ei].sets || []).forEach((s, si) => {
        if (s.type === 'drop' && chunks.length) chunks[chunks.length - 1].push(si);
        else chunks.push([si]);
      });
      return { ei, chunks };
    });
    const maxRounds = Math.max(...rounds.map((r) => r.chunks.length));
    for (let k = 0; k < maxRounds; k++) {
      rounds.forEach((r) => (r.chunks[k] || []).forEach((si) => order.push({ ei: r.ei, si })));
    }
  });
  return order;
}

export function nextPending(session) {
  const order = executionOrder(session);
  return order.find(({ ei, si }) => !session.exercises[ei]?.sets?.[si]?.done) || null;
}

/** Descanso tras marcar (ei, si) como hecha: 0 si toca drop o el siguiente de la superserie. */
export function restAfter(session, ei, si, config) {
  const order = executionOrder(session);
  const pos = order.findIndex((o) => o.ei === ei && o.si === si);
  const next = order.slice(pos + 1).find((o) => !session.exercises[o.ei]?.sets?.[o.si]?.done);
  const ex = session.exercises[ei];
  if (!next) return restFor(ex?.target, config);
  const nextSet = session.exercises[next.ei]?.sets?.[next.si];
  if (next.ei === ei && nextSet?.type === 'drop') return 0;
  // Dentro de una superserie se pasa sin descanso al SIGUIENTE ejercicio del
  // grupo; al volver al primero empieza otra ronda y toca descansar.
  const group = groups(session).find((g) => g.idx.length > 1 && g.idx.includes(ei) && g.idx.includes(next.ei));
  if (group && next.ei !== ei && group.idx.indexOf(next.ei) > group.idx.indexOf(ei)) return 0;
  return restFor(ex?.target, config);
}

/** Valor efectivo de una serie (lo tecleado o, si no, lo planificado). */
export function effective(set) {
  return {
    weight: set.weight ?? set.plan?.weight ?? null,
    reps: set.reps ?? set.plan?.reps ?? null,
  };
}

export function progress(session) {
  let done = 0, total = 0;
  (session?.exercises || []).forEach((x) => (x.sets || []).forEach((s) => {
    if (s.type === 'warmup') return;
    total++;
    if (s.done) done++;
  }));
  return { done, total };
}

export function exerciseDone(ex) {
  const sets = (ex?.sets || []).filter((s) => s.type !== 'warmup');
  return sets.length > 0 && sets.every((s) => s.done);
}

/** Series de aproximación para un peso de trabajo: 40 % ×8, 60 % ×5, 80 % ×3. */
export function warmupSets(workWeight, inc = 2.5) {
  const w = Number(workWeight) || 0;
  if (w <= 0) return [];
  const step = Number(inc) > 0 ? Number(inc) : 2.5;
  const r = (p) => Math.max(step, Math.round((w * p) / step) * step);
  return [[0.4, 8], [0.6, 5], [0.8, 3]]
    .map(([p, reps]) => ({ id: uid(), type: 'warmup', weight: null, reps: null, rir: null, done: false, doneAt: null, plan: { weight: r(p), reps } }))
    .filter((s, i, arr) => i === 0 || s.plan.weight !== arr[i - 1].plan.weight);
}
