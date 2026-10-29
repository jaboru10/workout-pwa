// Récords por ejercicio (port del RecordService del backend), con dos
// cambios: solo cuentan las series de trabajo hechas (ni calentamientos ni
// la parte "drop" de una biserie) y, en ejercicios de peso corporal, se
// lleva también el récord de repeticiones.
import { parseLocalDate } from '../utils/dates';
import { est1RM, isWorkSet } from './metrics';

export const RECORD_LABEL = {
  MAX_WEIGHT: 'Peso máximo',
  BEST_VOLUME: 'Mejor serie (kg × reps)',
  ESTIMATED_1RM: '1RM estimado',
  MAX_REPS: 'Más repeticiones',
};

function eachWorkSet(sessions, exerciseId, { windowMonths = 0, position = null, excludeId = null } = {}) {
  const from = windowMonths ? new Date(new Date().setMonth(new Date().getMonth() - windowMonths)) : null;
  const out = [];
  (sessions || []).forEach((s) => {
    if (s.status !== 'done' || s.id === excludeId) return;
    const d = parseLocalDate(s.date);
    if (from && d && d < from) return;
    (s.exercises || []).forEach((ex) => {
      if (ex.exerciseId !== exerciseId) return;
      if (position != null && Number(ex.order) !== Number(position)) return;
      (ex.sets || []).forEach((set) => {
        if (isWorkSet(set)) out.push({ set, session: s, ex });
      });
    });
  });
  return out;
}

function pick(entry, type, value, rangeName = null) {
  return {
    type,
    rangeName,
    value,
    weight: Number(entry.set.weight || 0),
    reps: Number(entry.set.reps || 0),
    date: entry.session.date,
    sessionId: entry.session.id,
    position: entry.ex.order,
    dayName: entry.session.dayName || null,
  };
}

/**
 * → { maxWeight, bestVolume, best1rm, maxReps, byRange: [], count }
 */
export function computeRecords(sessions, exerciseId, opts = {}) {
  const { repRanges = [] } = opts;
  const sets = eachWorkSet(sessions, exerciseId, opts);
  let maxWeight = null, bestVolume = null, best1rm = null, maxReps = null;
  const byRange = new Map();

  for (const e of sets) {
    const w = Number(e.set.weight || 0);
    const r = Number(e.set.reps || 0);
    if (!maxReps || r > maxReps.value || (r === maxReps.value && w > maxReps.weight)) maxReps = pick(e, 'MAX_REPS', r);
    if (w <= 0) continue;
    if (!maxWeight || w > maxWeight.value || (w === maxWeight.value && r > maxWeight.reps)) maxWeight = pick(e, 'MAX_WEIGHT', w);
    const vol = w * r;
    if (!bestVolume || vol > bestVolume.value) bestVolume = pick(e, 'BEST_VOLUME', vol);
    const rm = est1RM(w, r);
    if (!best1rm || rm > best1rm.value) best1rm = pick(e, 'ESTIMATED_1RM', rm);
    const range = repRanges.find((rr) => r >= rr.min && r <= rr.max);
    if (range) {
      const cur = byRange.get(range.name);
      if (!cur || w > cur.value || (w === cur.value && r > cur.reps)) byRange.set(range.name, pick(e, 'MAX_WEIGHT', w, range.name));
    }
  }
  const ordered = repRanges.map((rr) => byRange.get(rr.name)).filter(Boolean);
  return { maxWeight, bestVolume, best1rm, maxReps, byRange: ordered, count: sets.length };
}

/**
 * Récords que bate una sesión respecto a todo el historial anterior.
 * Solo se anuncian si ya había historial del ejercicio (la primera vez no es récord).
 */
export function newRecordsFor(session, sessions, exercisesById) {
  const out = [];
  const seen = new Set();
  (session.exercises || []).forEach((ex) => {
    if (seen.has(ex.exerciseId)) return;
    seen.add(ex.exerciseId);
    const before = computeRecords(sessions, ex.exerciseId, { excludeId: session.id });
    if (!before.count) return;
    const mine = computeRecords([{ ...session, status: 'done' }], ex.exerciseId);
    const bw = exercisesById[ex.exerciseId]?.bodyweight;
    const check = (key, type) => {
      const a = mine[key];
      const b = before[key];
      if (a && b && a.value > b.value + 1e-9) out.push({ ...a, type, exerciseId: ex.exerciseId, previous: b.value });
    };
    check('maxWeight', 'MAX_WEIGHT');
    check('best1rm', 'ESTIMATED_1RM');
    if (bw && !(mine.maxWeight?.value > 0)) check('maxReps', 'MAX_REPS');
  });
  return out;
}

/** Mejor peso histórico por ejercicio, para encender la celda al teclear un récord. */
export function bestWeights(sessions) {
  const best = {};
  (sessions || []).forEach((s) => {
    if (s.status !== 'done') return;
    (s.exercises || []).forEach((ex) => (ex.sets || []).forEach((set) => {
      if (!isWorkSet(set)) return;
      const w = Number(set.weight || 0);
      if (w > (best[ex.exerciseId] || 0)) best[ex.exerciseId] = w;
    }));
  });
  return best;
}
