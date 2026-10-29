// Interpretación de los objetivos de la plantilla: "5-8", "8", "15+15",
// "máx", "60s" y RIR "1-2".

export function parseReps(input) {
  const s = String(input ?? '').toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, '').trim();
  if (!s) return { kind: 'none', min: null, max: null, label: '' };
  let m;
  if ((m = s.match(/^(\d+)-(\d+)$/))) {
    const a = Number(m[1]); const b = Number(m[2]);
    return { kind: 'range', min: Math.min(a, b), max: Math.max(a, b), label: `${Math.min(a, b)}-${Math.max(a, b)}` };
  }
  if ((m = s.match(/^(\d+)\+(\d+)$/))) {
    const a = Number(m[1]); const b = Number(m[2]);
    return { kind: 'biserie', min: a, max: a, parts: [a, b], label: `${a}+${b}` };
  }
  if ((m = s.match(/^(\d+)s(eg)?$/))) {
    return { kind: 'time', min: Number(m[1]), max: Number(m[1]), label: `${m[1]} s` };
  }
  if ((m = s.match(/^(\d+)$/))) {
    const n = Number(m[1]);
    return { kind: 'fixed', min: n, max: n, label: String(n) };
  }
  if (/m[aá]x|amrap|fallo/.test(s)) return { kind: 'amrap', min: null, max: null, label: 'máx' };
  return { kind: 'special', min: null, max: null, label: String(input) };
}

export function parseRir(input) {
  if (input == null || input === '') return null;
  const s = String(input).replace(/[–—]/g, '-').replace(/\s+/g, '');
  let m;
  if ((m = s.match(/^(\d+)-(\d+)$/))) {
    const a = Number(m[1]); const b = Number(m[2]);
    return { min: Math.min(a, b), max: Math.max(a, b), label: `${Math.min(a, b)}-${Math.max(a, b)}` };
  }
  if ((m = s.match(/^(\d+)\+?$/))) {
    const n = Number(m[1]);
    return { min: n, max: n, label: String(n) };
  }
  return null;
}

export const ROLE_REST = { F: 165, H: 105, A: 60 };

export function restFor(target, config) {
  const r = Number(target?.restSec);
  if (r > 0) return r;
  if (target?.role && ROLE_REST[target.role]) return ROLE_REST[target.role];
  return Number(config?.defaultRestSec) > 0 ? Number(config.defaultRestSec) : 120;
}

export function fmtRest(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Texto corto del objetivo: "4 × 5-8 · RIR 1-2 · 2:45". */
export function targetLine(target, config) {
  if (!target) return '';
  const reps = parseReps(target.reps);
  const rir = parseRir(target.rir);
  const parts = [];
  if (target.sets) parts.push(`${target.sets} × ${reps.label || '—'}`);
  if (rir) parts.push(`RIR ${rir.label}`);
  parts.push(fmtRest(restFor(target, config)));
  return parts.join(' · ');
}
