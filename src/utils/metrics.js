// Métricas derivadas de las sesiones. Todo se calcula en cliente a partir de
// lo que ya devuelve /api/sessions: no hace falta endpoint nuevo.
import { parseLocalDate } from './dates';

/** Volumen de una serie: peso × reps (kg). */
export function setVolume(set) {
  const w = Number(set?.weight || 0);
  const r = Number(set?.reps || 0);
  return w > 0 && r > 0 ? w * r : 0;
}

/** Volumen total de una sesión (kg). */
export function sessionVolume(session) {
  return (session?.exercises || []).reduce(
    (total, ex) => total + (ex.sets || []).reduce((sub, s) => sub + setVolume(s), 0),
    0
  );
}

/** Nº de series con peso y reps completos. */
export function sessionSets(session) {
  return (session?.exercises || []).reduce((n, ex) => n + (ex.sets || []).filter((s) => setVolume(s) > 0).length, 0);
}

/** 1RM estimado (Epley). Devuelve 0 si la serie está incompleta. */
export function est1RM(weight, reps) {
  const w = Number(weight || 0);
  const r = Number(reps || 0);
  if (w <= 0 || r <= 0) return 0;
  return w * (1 + r / 30);
}

/** Mejor 1RM estimado de un ejercicio dentro de una sesión. */
export function best1RMForExercise(session, exerciseId) {
  return (session?.exercises || [])
    .filter((ex) => ex.exerciseId === exerciseId)
    .flatMap((ex) => ex.sets || [])
    .reduce((max, s) => Math.max(max, est1RM(s.weight, s.reps)), 0);
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const shift = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - shift);
  return d;
}

/**
 * Volumen agregado por semana natural, de la más antigua a la actual.
 * → [{ key, label, volume }] con `weeks` posiciones, incluidas las vacías.
 */
export function weeklyVolume(sessions, weeks = 10) {
  const thisWeek = startOfWeek(new Date());
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - i * 7);
    buckets.push({ key: start.getTime(), start, label: `${start.getDate()}/${start.getMonth() + 1}`, volume: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  (sessions || []).forEach((s) => {
    const date = parseLocalDate(s.date);
    if (!date) return;
    const bucket = byKey.get(startOfWeek(date).getTime());
    if (bucket) bucket.volume += sessionVolume(s);
  });
  return buckets;
}

/** Serie temporal de 1RM estimado de un ejercicio, por sesión, de antigua a nueva. */
export function rmSeries(sessions, exerciseId, months = 6) {
  const from = new Date();
  from.setMonth(from.getMonth() - (months || 240));
  return (sessions || [])
    .filter((s) => {
      const d = parseLocalDate(s.date);
      return d && (!months || d >= from) && best1RMForExercise(s, exerciseId) > 0;
    })
    .map((s) => ({ date: s.date, value: best1RMForExercise(s, exerciseId) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Formatea kilos grandes: 14 200 → "14.2 t". */
export function formatVolume(kg) {
  if (!kg) return '0';
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`;
}

/** Redondeo corto para mostrar pesos: 82.5 → "82.5", 80 → "80". */
export function short(n) {
  const v = Number(n || 0);
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}
