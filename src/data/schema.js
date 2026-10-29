// Modelo de datos de la PWA v3 (local-first). Todo es JSON plano para poder
// exportarlo, subirlo al servidor como copia y leerlo desde Claude.
//
// Exercise   { id, name, muscleGroup, bodyweight, increment, active, notes, createdAt }
// Routine    { id, name, level, type, active, archived, sourcePresetId, createdAt }
// Day        { id, routineId, name, order, weekday(1-7|null), archived,
//              exercises: [DayExercise] }
// DayExercise{ id, exerciseId, order, sets, reps, rir, restSec, role('F'|'H'|'A'|null),
//              superset('A'|'B'|…|null), technique('normal'|'biserie'), notes }
// Session    { id, status('in_progress'|'done'), date 'YYYY-MM-DD', startedAt, finishedAt,
//              routineId, routineName, dayId, dayName, badDay, notes, rest, updatedAt,
//              exercises: [SessionExercise] }
// SessionExercise { id, exerciseId, order, movedFromDayId, precedingExerciseIds,
//              target {sets, reps, rir, restSec, role, superset, technique, notes},
//              suggestion, sets: [SetEntry], notes }
// SetEntry   { id, type('work'|'warmup'|'drop'), weight, reps, rir, done, doneAt,
//              plan { weight, reps } }

export const SCHEMA_VERSION = 1;

export const MUSCLE_GROUPS = [
  'Pecho', 'Espalda', 'Hombro', 'Deltoides lateral', 'Deltoides posterior', 'Trapecio',
  'Bíceps', 'Tríceps', 'Antebrazo', 'Cuádriceps', 'Isquios', 'Glúteo', 'Aductores',
  'Gemelos', 'Abdomen', 'Lumbar', 'Pierna', 'Core', 'Otro',
];

export const ROLES = { F: 'Fuerza', H: 'Hipertrofia', A: 'Accesorio' };

export const WEEKDAYS = [
  { n: 1, short: 'L', name: 'Lunes' },
  { n: 2, short: 'M', name: 'Martes' },
  { n: 3, short: 'X', name: 'Miércoles' },
  { n: 4, short: 'J', name: 'Jueves' },
  { n: 5, short: 'V', name: 'Viernes' },
  { n: 6, short: 'S', name: 'Sábado' },
  { n: 7, short: 'D', name: 'Domingo' },
];

export function uid() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch { /* contexto no seguro */ }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Nombre normalizado para casar ejercicios: sin tildes, minúsculas, espacios simples. */
export function normName(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Incremento de peso por defecto según el material que sugiere el nombre. */
export function defaultIncrement(name) {
  const n = normName(name);
  if (n.includes('mancuerna')) return 2;
  return 2.5;
}

export function defaultConfig() {
  return {
    repRanges: [
      { name: 'Fuerza', min: 1, max: 5 },
      { name: 'Fuerza-hipertrofia', min: 6, max: 8 },
      { name: 'Hipertrofia', min: 9, max: 12 },
      { name: 'Resistencia', min: 13, max: 30 },
    ],
    sound: true,
    vibrate: true,
    keepAwake: true,
    autoRest: true,
    defaultRestSec: 120,
    lastExportAt: null,
    server: {
      url: '',
      username: '',
      token: '',
      connectedAt: null,
      lastSyncAt: null,
      lastRemoteUpdatedAt: null,
      autoSync: true,
      lastError: null,
    },
  };
}

export function newExercise({ name, muscleGroup = '', bodyweight = false, increment, notes = '' }) {
  return {
    id: uid(),
    name: String(name || '').trim(),
    muscleGroup,
    bodyweight: Boolean(bodyweight),
    increment: Number(increment) > 0 ? Number(increment) : defaultIncrement(name),
    active: true,
    notes,
    createdAt: new Date().toISOString(),
  };
}

export function newDayExercise(exerciseId, order, extra = {}) {
  return {
    id: uid(),
    exerciseId,
    order,
    sets: 3,
    reps: '8-12',
    rir: '1',
    restSec: null,
    role: null,
    superset: null,
    technique: 'normal',
    notes: '',
    ...extra,
  };
}

/** Rellena campos que falten (datos importados o de versiones anteriores). */
export function normalizeData(raw) {
  const cfgDefaults = defaultConfig();
  const config = { ...cfgDefaults, ...(raw.config || {}) };
  config.server = { ...cfgDefaults.server, ...(raw.config?.server || {}) };
  if (!Array.isArray(config.repRanges) || config.repRanges.length === 0) config.repRanges = cfgDefaults.repRanges;

  const exercises = (raw.exercises || []).map((e) => ({
    active: true, bodyweight: false, muscleGroup: '', notes: '',
    ...e,
    increment: Number(e.increment) > 0 ? Number(e.increment) : defaultIncrement(e.name),
  }));
  const routines = (raw.routines || []).map((r) => ({ active: false, archived: false, ...r }));
  const days = (raw.days || []).map((d) => ({
    archived: false, weekday: null, order: 0,
    ...d,
    exercises: (d.exercises || []).map((x, i) => ({
      id: x.id || uid(), order: i + 1, sets: 3, reps: '8-12', rir: null, restSec: null,
      role: null, superset: null, technique: 'normal', notes: '',
      ...x,
    })),
  }));
  const sessions = (raw.sessions || []).map((s) => ({
    status: 'done', badDay: false, notes: '', rest: null,
    ...s,
    exercises: (s.exercises || []).map((x, i) => ({
      id: x.id || uid(), order: i + 1, precedingExerciseIds: [], target: {}, notes: '',
      ...x,
      sets: (x.sets || []).map((st) => ({
        id: st.id || uid(), type: 'work', rir: null, done: true, plan: null,
        ...st,
      })),
    })),
  }));
  const meta = { schemaVersion: SCHEMA_VERSION, deviceId: uid(), createdAt: new Date().toISOString(), ...(raw.meta || {}) };
  return { meta, config, exercises, routines, days, sessions };
}
