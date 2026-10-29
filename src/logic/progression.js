// Sugerencia de carga para hoy a partir de la última vez (doble progresión).
//
// Reglas (documento F2, apartado 7):
//  · Rango "min-max": si en la última sesión todas las series de trabajo
//    llegaron al máximo del rango con el RIR objetivo (o más), se sube el
//    incremento del ejercicio y se vuelve al mínimo. Si no, mismo peso y +1 rep.
//  · Si el rango cambia mucho (p. ej. de 8-12 a 5-8) se estima el peso desde
//    el 1RM de la última sesión (Epley).
//  · Biserie "15+15": la parte pesada sube 15 → 18 → 20; con 20 + 15 en todas
//    las rondas se sube el peso (p. ej. 10 + 5 → 12 + 6 kg).
//  · "máx": mismo peso (o lastre) y +1 rep por serie.
//  · Si la última fue "día flojo" y no se llegó, se repite el peso.
import { parseReps, parseRir } from './targets';
import { est1RM, isWorkSet, short } from './metrics';
import { formatDate } from '../utils/dates';

export function lastPerformance(sessions, exerciseId, excludeId = null) {
  const candidates = (sessions || [])
    .filter((s) => s.status === 'done' && s.id !== excludeId)
    .sort((a, b) => (a.date === b.date
      ? String(b.finishedAt || '').localeCompare(String(a.finishedAt || ''))
      : (a.date < b.date ? 1 : -1)));
  for (const s of candidates) {
    const exs = (s.exercises || []).filter((x) => x.exerciseId === exerciseId);
    if (!exs.length) continue;
    const sets = exs.flatMap((x) => x.sets || []);
    const work = sets.filter(isWorkSet);
    if (!work.length) continue;
    const drops = sets.filter((st) => st.done && st.type === 'drop' && Number(st.reps) > 0);
    return { sessionId: s.id, date: s.date, badDay: Boolean(s.badDay), dayName: s.dayName || '', work, drops };
  }
  return null;
}

function roundDown(w, inc) {
  const step = Number(inc) > 0 ? Number(inc) : 2.5;
  return Math.max(step, Math.floor(w / step + 1e-9) * step);
}

const fmtSet = (s) => `${short(s.weight)}×${s.reps}${s.rir != null ? `@${s.rir}` : ''}`;

export function lastText(last) {
  if (!last) return '';
  const main = last.work.map(fmtSet).join(' · ');
  const drops = last.drops.length ? ` (drop ${last.drops.map(fmtSet).join(' · ')})` : '';
  return `${formatDate(last.date, { day: 'numeric', month: 'short' })}: ${main}${drops}${last.badDay ? ' · día flojo' : ''}`;
}

/**
 * → { kind, weight, reps: [por serie], dropWeight, dropReps, text, detail, last }
 *   kind: 'first' | 'up' | 'same' | 'estimate' | 'reps' | 'info'
 */
export function suggest(exercise, target, sessions, excludeId = null) {
  const reps = parseReps(target?.reps);
  const rir = parseRir(target?.rir);
  const inc = Number(exercise?.increment) > 0 ? Number(exercise.increment) : 2.5;
  const nSets = Math.max(1, Number(target?.sets) || 3);
  const last = exercise ? lastPerformance(sessions, exercise.id, excludeId) : null;
  const res = { kind: 'first', weight: null, reps: Array(nSets).fill(null), dropWeight: null, dropReps: null, text: '', detail: '', last };

  if (reps.kind === 'biserie') res.dropReps = reps.parts[1];

  if (!last) {
    if (reps.kind === 'amrap') res.text = 'Primera vez: el máximo de reps con buena técnica.';
    else if (reps.kind === 'biserie') res.text = `Primera vez: ${reps.parts[0]} reps pesadas y sin descanso ${reps.parts[1]} con la mitad de peso.`;
    else if (reps.max) res.text = `Primera vez: elige un peso para unas ${reps.max} reps${rir ? ` a RIR ${rir.label}` : ''}.`;
    if (reps.kind === 'biserie') res.reps = Array(nSets).fill(reps.parts[0]);
    else if (reps.max) res.reps = Array(nSets).fill(reps.max);
    return res;
  }

  const work = last.work;
  const topW = Math.max(0, ...work.map((s) => Number(s.weight || 0)));
  const atTop = work.filter((s) => Number(s.weight || 0) === topW);
  const repsAt = (i) => Number((work[i] || work[work.length - 1]).reps || 0);
  res.weight = topW > 0 ? topW : (exercise?.bodyweight ? 0 : null);

  // --- Máximo de repeticiones -------------------------------------------
  if (reps.kind === 'amrap') {
    res.kind = 'reps';
    res.reps = Array.from({ length: nSets }, (_, i) => repsAt(i) + 1);
    res.text = `Mismo ${topW > 0 ? `peso (${short(topW)} kg)` : 'ejercicio'} · busca ${res.reps.join(' · ')}`;
    if (Math.max(...work.map((s) => Number(s.reps))) >= 20) res.detail = 'Ya pasas de 20: prueba una variante más difícil o añade lastre.';
    return res;
  }

  // --- Biserie (parte pesada + drop) ------------------------------------
  if (reps.kind === 'biserie') {
    const [base, dropBase] = reps.parts;
    const dropTop = last.drops.length ? Math.max(...last.drops.map((s) => Number(s.weight || 0))) : null;
    const heavyOk = atTop.length === work.length && work.every((s) => Number(s.reps) >= 20);
    const dropsOk = last.drops.length >= work.length && last.drops.every((s) => Number(s.reps) >= dropBase);
    if (heavyOk && dropsOk && topW > 0) {
      res.kind = 'up';
      res.weight = topW + inc;
      res.dropWeight = dropTop != null ? dropTop + inc / 2 : null;
      res.reps = Array(nSets).fill(base);
      res.text = `Sube a ${short(res.weight)}${res.dropWeight != null ? ` + ${short(res.dropWeight)}` : ''} kg y vuelve a ${base} + ${dropBase}`;
    } else {
      res.kind = 'same';
      res.dropWeight = dropTop;
      res.reps = Array.from({ length: nSets }, (_, i) => {
        const r = repsAt(i);
        return r >= 18 ? 20 : r >= base ? 18 : base;
      });
      res.text = `Mantén ${short(topW)}${dropTop != null ? ` + ${short(dropTop)}` : ''} kg · parte pesada: ${res.reps.join(' · ')}`;
    }
    return res;
  }

  // --- Rango / fijo -----------------------------------------------------
  if (reps.kind === 'range' || reps.kind === 'fixed') {
    const avg = work.reduce((n, s) => n + Number(s.reps), 0) / work.length;
    const newRange = avg > reps.max + 2 || avg < reps.min - 2;
    if (newRange && topW > 0) {
      if (exercise?.bodyweight) {
        res.kind = 'info';
        res.reps = Array(nSets).fill(reps.max);
        res.text = `Rango nuevo (${reps.label}): ajusta el lastre${avg > reps.max ? ' hacia arriba' : ' hacia abajo'} desde ${short(topW)} kg.`;
        return res;
      }
      const e1 = Math.max(...work.map((s) => est1RM(s.weight, s.reps)));
      const toFailure = reps.max + (rir?.min ?? 0);
      const w = roundDown(e1 / (1 + toFailure / 30), inc);
      res.kind = 'estimate';
      res.weight = w;
      res.reps = Array(nSets).fill(reps.max);
      res.text = `Rango nuevo (${reps.label}): ~${short(w)} kg, estimado desde tu 1RM (${Math.round(e1)} kg).`;
      res.detail = 'Primera sesión del rango: ajusta si la primera serie sale muy fácil o muy dura.';
      return res;
    }

    const rirOk = (s) => !rir || s.rir == null || Number(s.rir) >= rir.min;
    const allHit = atTop.length === work.length && atTop.length >= Math.min(nSets, work.length)
      && atTop.every((s) => Number(s.reps) >= reps.max && rirOk(s));

    if (allHit && !(exercise?.bodyweight && topW === 0)) {
      res.kind = 'up';
      res.weight = topW + inc;
      res.reps = Array(nSets).fill(reps.min);
      res.text = `Sube a ${short(res.weight)} kg y vuelve a ${reps.min}${reps.min !== reps.max ? `-${reps.max}` : ''} reps`;
      const pct = topW > 0 ? Math.round((inc / topW) * 100) : 0;
      if (pct > 10) res.detail = `Es un +${pct} %: si no salen ${reps.min}, quédate en ${short(topW)} kg y suma reps.`;
      return res;
    }
    if (allHit && exercise?.bodyweight && topW === 0) {
      res.kind = 'up';
      res.weight = 0;
      res.reps = Array(nSets).fill(reps.max);
      res.text = `Llegas al tope sin lastre: añade un poco de lastre o sube reps.`;
      return res;
    }

    res.kind = 'same';
    res.reps = Array.from({ length: nSets }, (_, i) => Math.min(reps.max, Math.max(reps.min, repsAt(i) + 1)));
    res.text = last.badDay
      ? `La última fue día flojo: repite ${topW > 0 ? `${short(topW)} kg` : 'el peso'} · busca ${res.reps.join(' · ')}`
      : `Mantén ${topW > 0 ? `${short(topW)} kg` : 'el peso'} · busca ${res.reps.join(' · ')}`;
    const lowRir = rir && work.some((s) => s.rir != null && Number(s.rir) < rir.min);
    if (lowRir) res.detail = `La última vez bajaste del RIR ${rir.label}: no subas hasta llegar con margen.`;
    return res;
  }

  // --- Otros (tiempo, especial) ------------------------------------------
  res.kind = 'info';
  res.reps = Array.from({ length: nSets }, (_, i) => repsAt(i));
  res.text = `Última: ${work.map(fmtSet).join(' · ')}`;
  return res;
}
