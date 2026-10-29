// Métricas derivadas de las sesiones (todo en cliente).
import { parseLocalDate } from '../utils/dates';

/** Serie que cuenta como trabajo efectivo: hecha, de trabajo, con reps. */
export function isWorkSet(set) {
  return set && set.done && (set.type || 'work') === 'work' && Number(set.reps) > 0;
}

/** Serie que suma kilos (trabajo o drop, hecha). Los calentamientos no cuentan. */
export function countsForVolume(set) {
  return set && set.done && (set.type || 'work') !== 'warmup' && Number(set.reps) > 0;
}

export function setVolume(set) {
  if (!countsForVolume(set)) return 0;
  const w = Number(set.weight || 0);
  const r = Number(set.reps || 0);
  return w > 0 && r > 0 ? w * r : 0;
}

export function sessionVolume(session) {
  return (session?.exercises || []).reduce(
    (t, ex) => t + (ex.sets || []).reduce((s, set) => s + setVolume(set), 0), 0);
}

/** Series de trabajo hechas (los drops y calentamientos no suman series). */
export function sessionSets(session) {
  return (session?.exercises || []).reduce((n, ex) => n + (ex.sets || []).filter(isWorkSet).length, 0);
}

export function plannedSets(session) {
  return (session?.exercises || []).reduce(
    (n, ex) => n + (ex.sets || []).filter((s) => (s.type || 'work') === 'work').length, 0);
}

export function est1RM(weight, reps) {
  const w = Number(weight || 0);
  const r = Number(reps || 0);
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
}

export function best1RMForExercise(session, exerciseId) {
  return (session?.exercises || [])
    .filter((ex) => ex.exerciseId === exerciseId)
    .flatMap((ex) => ex.sets || [])
    .filter(isWorkSet)
    .reduce((max, s) => Math.max(max, est1RM(s.weight, s.reps)), 0);
}

export function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const shift = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - shift);
  return d;
}

export function weekKey(date) {
  return startOfWeek(date).getTime();
}

/** Semanas naturales (lunes a domingo), de la más antigua a la actual. */
export function weekBuckets(weeks = 8) {
  const thisWeek = startOfWeek(new Date());
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - i * 7);
    out.push({ key: start.getTime(), start, label: `${start.getDate()}/${start.getMonth() + 1}` });
  }
  return out;
}

export function weeklyVolume(sessions, weeks = 10) {
  const buckets = weekBuckets(weeks).map((b) => ({ ...b, volume: 0, sets: 0, sessions: 0 }));
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  (sessions || []).forEach((s) => {
    if (s.status !== 'done') return;
    const d = parseLocalDate(s.date);
    const b = d && byKey.get(weekKey(d));
    if (!b) return;
    b.volume += sessionVolume(s);
    b.sets += sessionSets(s);
    b.sessions += 1;
  });
  return buckets;
}

/**
 * Series de trabajo por grupo muscular y semana.
 * → { weeks: [bucket], muscles: [{ muscle, perWeek: [n…], total }] }
 */
export function muscleSetsByWeek(sessions, exercisesById, weeks = 6) {
  const buckets = weekBuckets(weeks);
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  const table = new Map();
  (sessions || []).forEach((s) => {
    if (s.status !== 'done') return;
    const d = parseLocalDate(s.date);
    const i = d ? idx.get(weekKey(d)) : undefined;
    if (i === undefined) return;
    (s.exercises || []).forEach((ex) => {
      const muscle = exercisesById[ex.exerciseId]?.muscleGroup || 'Sin grupo';
      const n = (ex.sets || []).filter(isWorkSet).length;
      if (!n) return;
      if (!table.has(muscle)) table.set(muscle, Array(buckets.length).fill(0));
      table.get(muscle)[i] += n;
    });
  });
  const muscles = [...table.entries()]
    .map(([muscle, perWeek]) => ({ muscle, perWeek, total: perWeek.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);
  return { weeks: buckets, muscles };
}

/** Series objetivo por grupo muscular en la rutina (suma de las series de todos sus días). */
export function routineMuscleTargets(days, exercisesById) {
  const out = {};
  (days || []).forEach((d) => (d.exercises || []).forEach((de) => {
    const muscle = exercisesById[de.exerciseId]?.muscleGroup || 'Sin grupo';
    out[muscle] = (out[muscle] || 0) + (Number(de.sets) || 0);
  }));
  return out;
}

export function rmSeries(sessions, exerciseId, months = 6) {
  const from = new Date();
  from.setMonth(from.getMonth() - (months || 600));
  return (sessions || [])
    .filter((s) => {
      if (s.status !== 'done') return false;
      const d = parseLocalDate(s.date);
      return d && (!months || d >= from) && best1RMForExercise(s, exerciseId) > 0;
    })
    .map((s) => ({ date: s.date, value: best1RMForExercise(s, exerciseId) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function formatVolume(kg) {
  if (!kg) return '0 kg';
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`;
}

// «1 sesión» / «3 sesiones».
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Peso de una serie para mostrar: en ejercicios de peso corporal «PC» o
// «PC+10» (lastre); en el resto los kilos.
export function weightText(weight, bw) {
  const w = Number(weight || 0);
  if (bw) return w > 0 ? `PC+${short(w)}` : 'PC';
  return weight == null || weight === '' ? '—' : short(w);
}

export function short(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return '—';
  return v % 1 === 0 ? String(v) : String(Math.round(v * 100) / 100);
}

export function durationMin(session) {
  if (!session?.startedAt) return null;
  const end = session.finishedAt ? new Date(session.finishedAt) : new Date();
  const ms = end - new Date(session.startedAt);
  return ms > 0 ? Math.round(ms / 60000) : null;
}
