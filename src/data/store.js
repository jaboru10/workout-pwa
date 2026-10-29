// Estado global de la app (local-first). Se carga entero en memoria al
// arrancar y cada cambio se persiste en IndexedDB. Los componentes se
// suscriben con useAppState().
import { useSyncExternalStore } from 'react';
import * as db from './db';
import { defaultConfig, newDayExercise, newExercise, normName, normalizeData, SCHEMA_VERSION, uid } from './schema';
import { presetById } from './presets';
import { newSession, sessionExerciseFrom, withPreceding } from '../logic/session';

let state = {
  ready: false,
  error: null,
  backend: null,
  meta: null,
  config: defaultConfig(),
  exercises: [],
  routines: [],
  days: [],
  sessions: [],
};

const listeners = new Set();
const finishHooks = new Set();
let queue = Promise.resolve();

function emit() { listeners.forEach((l) => l()); }
function setState(patch) { state = { ...state, ...patch }; emit(); }

/** Las escrituras se encadenan: nunca se pisan dos escrituras de la misma clave. */
function persist(fn) {
  queue = queue.then(fn).catch((e) => {
    console.error('[ironlog] error guardando', e);
    setState({ error: 'No se ha podido guardar en el móvil. Exporta una copia desde Ajustes.' });
  });
  return queue;
}

const saveKey = (key) => persist(() => db.write(key, state[key]));
const saveSession = (s) => persist(() => db.write(db.sessionKey(s.id), s));

export function getState() { return state; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function useAppState() { return useSyncExternalStore(subscribe, getState, getState); }
export function onSessionFinished(fn) { finishHooks.add(fn); return () => finishHooks.delete(fn); }
export function flush() { return queue; }

export async function init() {
  try {
    const backend = await db.storageBackend();
    const raw = await db.readAll();
    const isNew = !raw.meta;
    const data = normalizeData(raw);
    if (isNew) {
      await db.writeMany([['meta', data.meta], ['config', data.config], ['exercises', []], ['routines', []], ['days', []]]);
    }
    state = { ...state, ...data, ready: true, backend };
    emit();
    db.requestPersistence();
  } catch (e) {
    console.error(e);
    setState({ ready: true, error: 'No se ha podido abrir el almacenamiento del navegador.' });
  }
}

/* ------------------------------------------------------------------ */
/* Selectores                                                          */
/* ------------------------------------------------------------------ */

export const byId = (list) => Object.fromEntries((list || []).map((x) => [x.id, x]));
export const activeRoutine = (s) => s.routines.find((r) => r.active && !r.archived) || null;
export const routineDays = (s, routineId) => s.days
  .filter((d) => d.routineId === routineId && !d.archived)
  .sort((a, b) => (a.order || 0) - (b.order || 0));
export const inProgress = (s) => s.sessions.find((x) => x.status === 'in_progress') || null;
export const doneSessions = (s) => s.sessions
  .filter((x) => x.status === 'done')
  .sort((a, b) => (a.date === b.date
    ? String(b.finishedAt || b.startedAt || '').localeCompare(String(a.finishedAt || a.startedAt || ''))
    : (a.date < b.date ? 1 : -1)));

/* ------------------------------------------------------------------ */
/* Ejercicios                                                          */
/* ------------------------------------------------------------------ */

export function addExercise(data) {
  const ex = newExercise(data);
  setState({ exercises: [...state.exercises, ex] });
  saveKey('exercises');
  return ex;
}

export function updateExercise(id, patch) {
  setState({ exercises: state.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  saveKey('exercises');
}

export function archiveExercise(id) { updateExercise(id, { active: false }); }

/** Busca un ejercicio activo por nombre (sin tildes ni mayúsculas) o lo crea. */
export function findOrCreateExercise({ name, muscleGroup, bodyweight, increment }) {
  const key = normName(name);
  const found = state.exercises.find((e) => e.active && normName(e.name) === key);
  if (found) return found;
  return addExercise({ name, muscleGroup, bodyweight, increment });
}

/* ------------------------------------------------------------------ */
/* Rutinas y días                                                      */
/* ------------------------------------------------------------------ */

export function createRoutine({ name, level = null, type = null, activate = true }) {
  const r = { id: uid(), name: name.trim(), level, type, active: false, archived: false, sourcePresetId: null, createdAt: new Date().toISOString() };
  setState({ routines: [...state.routines, r] });
  saveKey('routines');
  if (activate || !activeRoutine(state)) activateRoutine(r.id);
  return r;
}

export function activateRoutine(id) {
  setState({ routines: state.routines.map((r) => ({ ...r, active: r.id === id && !r.archived })) });
  saveKey('routines');
}

export function updateRoutine(id, patch) {
  setState({ routines: state.routines.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  saveKey('routines');
}

export function archiveRoutine(id) {
  setState({ routines: state.routines.map((r) => (r.id === id ? { ...r, archived: true, active: false } : r)) });
  saveKey('routines');
}

/** Copia una predefinida: rutina + días + ejercicios (casados por nombre). */
export function loadPreset(presetId, { activate = true } = {}) {
  const p = presetById(presetId);
  if (!p) throw new Error('Rutina predefinida no encontrada');
  const routine = {
    id: uid(), name: p.name, level: p.level || null, type: p.type || null,
    active: false, archived: false, sourcePresetId: p.id, createdAt: new Date().toISOString(),
  };
  const days = p.days.map((d, i) => ({
    id: uid(),
    routineId: routine.id,
    name: d.name,
    order: i + 1,
    weekday: d.weekday ?? null,
    archived: false,
    exercises: d.exercises.map((e, k) => {
      const ex = findOrCreateExercise({ name: e.name, muscleGroup: e.muscle, bodyweight: e.bodyweight, increment: e.increment });
      if (!ex.muscleGroup && e.muscle) updateExercise(ex.id, { muscleGroup: e.muscle });
      return newDayExercise(ex.id, k + 1, {
        sets: e.sets, reps: e.reps, rir: e.rir, restSec: e.restSec, role: e.role,
        superset: e.superset, technique: e.technique, notes: e.notes,
      });
    }),
  }));
  setState({ routines: [...state.routines, routine], days: [...state.days, ...days] });
  saveKey('routines');
  saveKey('days');
  if (activate) activateRoutine(routine.id);
  return routine;
}

export function addDay(routineId, { name, weekday = null }) {
  const order = routineDays(state, routineId).length + 1;
  const d = { id: uid(), routineId, name: name.trim(), order, weekday, archived: false, exercises: [] };
  setState({ days: [...state.days, d] });
  saveKey('days');
  return d;
}

export function updateDay(id, patch) {
  setState({ days: state.days.map((d) => (d.id === id ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d)) });
  saveKey('days');
}

export function removeDay(id) { updateDay(id, { archived: true }); }

export function moveDay(id, dir) {
  const d = state.days.find((x) => x.id === id);
  if (!d) return;
  const list = routineDays(state, d.routineId);
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  const orderOf = Object.fromEntries(list.map((x, k) => [x.id, k + 1]));
  setState({ days: state.days.map((x) => (orderOf[x.id] ? { ...x, order: orderOf[x.id] } : x)) });
  saveKey('days');
}

const renumber = (list) => list.map((x, i) => ({ ...x, order: i + 1 }));

export function addDayExercise(dayId, exerciseId, extra = {}) {
  updateDay(dayId, (d) => ({ exercises: renumber([...(d.exercises || []), newDayExercise(exerciseId, (d.exercises || []).length + 1, extra)]) }));
}

export function updateDayExercise(dayId, deId, patch) {
  updateDay(dayId, (d) => ({ exercises: (d.exercises || []).map((x) => (x.id === deId ? { ...x, ...patch } : x)) }));
}

export function removeDayExercise(dayId, deId) {
  updateDay(dayId, (d) => ({ exercises: renumber((d.exercises || []).filter((x) => x.id !== deId)) }));
}

export function moveDayExercise(dayId, deId, dir) {
  updateDay(dayId, (d) => {
    const list = [...(d.exercises || [])].sort((a, b) => a.order - b.order);
    const i = list.findIndex((x) => x.id === deId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return {};
    [list[i], list[j]] = [list[j], list[i]];
    return { exercises: renumber(list) };
  });
}

/* ------------------------------------------------------------------ */
/* Sesiones                                                            */
/* ------------------------------------------------------------------ */

export function startSession(dayId) {
  // Solo una sesión abierta a la vez: si ya hay una, se vuelve a ella.
  const open = inProgress(state);
  if (open) return open;
  const day = dayId ? state.days.find((d) => d.id === dayId) : null;
  const routine = day ? state.routines.find((r) => r.id === day.routineId) : activeRoutine(state);
  const s = newSession({ day, routine, exercisesById: byId(state.exercises), sessions: state.sessions });
  setState({ sessions: [...state.sessions, s] });
  saveSession(s);
  return s;
}

export function updateSession(id, updater) {
  let saved = null;
  setState({
    sessions: state.sessions.map((s) => {
      if (s.id !== id) return s;
      const next = typeof updater === 'function' ? updater(s) : { ...s, ...updater };
      saved = { ...next, updatedAt: new Date().toISOString() };
      return saved;
    }),
  });
  if (saved) saveSession(saved);
  return saved;
}

export function addExerciseToSession(sessionId, exerciseId, atIndex = null) {
  const ex = state.exercises.find((e) => e.id === exerciseId);
  if (!ex) return;
  updateSession(sessionId, (s) => {
    const item = sessionExerciseFrom(ex, { sets: 3, reps: '8-12', rir: null }, state.sessions, 0, s.id);
    const list = [...s.exercises];
    list.splice(atIndex == null ? list.length : atIndex, 0, item);
    return withPreceding({ ...s, exercises: list });
  });
}

export function replaceSessionExercise(sessionId, index, exerciseId) {
  const ex = state.exercises.find((e) => e.id === exerciseId);
  if (!ex) return;
  updateSession(sessionId, (s) => {
    const list = [...s.exercises];
    const old = list[index];
    const item = sessionExerciseFrom(ex, old?.target || { sets: 3, reps: '8-12' }, state.sessions, index + 1, s.id);
    list[index] = item;
    return withPreceding({ ...s, exercises: list });
  });
}

export function moveSessionExercise(sessionId, index, dir) {
  updateSession(sessionId, (s) => {
    const list = [...s.exercises];
    const j = index + dir;
    if (j < 0 || j >= list.length) return s;
    [list[index], list[j]] = [list[j], list[index]];
    return withPreceding({ ...s, exercises: list });
  });
}

export function removeSessionExercise(sessionId, index) {
  updateSession(sessionId, (s) => withPreceding({ ...s, exercises: s.exercises.filter((_, i) => i !== index) }));
}

export function deleteSession(id) {
  setState({ sessions: state.sessions.filter((s) => s.id !== id) });
  persist(() => db.remove(db.sessionKey(id)));
}

export function finishSession(id, { badDay, notes } = {}) {
  const s = updateSession(id, (cur) => ({
    ...cur,
    status: 'done',
    finishedAt: cur.finishedAt || new Date().toISOString(),
    badDay: badDay ?? cur.badDay,
    notes: notes ?? cur.notes,
    rest: null,
    // Las series sin hacer no se guardan: el historial solo tiene lo real.
    exercises: withPreceding({
      exercises: cur.exercises
        .map((x) => ({ ...x, sets: (x.sets || []).filter((st) => st.done) }))
        .filter((x) => x.sets.length > 0),
    }).exercises,
  }));
  if (s) finishHooks.forEach((fn) => { try { fn(s); } catch (e) { console.error(e); } });
  return s;
}

/* ------------------------------------------------------------------ */
/* Configuración                                                       */
/* ------------------------------------------------------------------ */

export function updateConfig(patch) {
  setState({ config: { ...state.config, ...patch } });
  saveKey('config');
}

export function updateServer(patch) {
  setState({ config: { ...state.config, server: { ...state.config.server, ...patch } } });
  saveKey('config');
}

/* ------------------------------------------------------------------ */
/* Exportar / importar / borrar                                        */
/* ------------------------------------------------------------------ */

export function exportPayload({ includeServer = false } = {}) {
  const config = { ...state.config };
  if (!includeServer) config.server = { ...config.server, token: '', username: config.server.username };
  return {
    app: 'iron-log',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    deviceId: state.meta?.deviceId || null,
    meta: state.meta,
    config,
    exercises: state.exercises,
    routines: state.routines,
    days: state.days,
    sessions: state.sessions,
  };
}

/** Sustituye todos los datos locales por los del payload (copia de seguridad). */
export async function replaceAll(payload, { keepServer = true } = {}) {
  if (!payload || !Array.isArray(payload.sessions) || !Array.isArray(payload.exercises)) {
    throw new Error('El archivo no parece una copia de Iron Log.');
  }
  const server = state.config.server;
  const data = normalizeData({ ...payload, meta: { ...(payload.meta || {}), deviceId: state.meta?.deviceId || uid() } });
  if (keepServer) data.config.server = { ...data.config.server, ...server };
  await flush();
  await db.wipe();
  await db.writeMany([
    ['meta', data.meta], ['config', data.config], ['exercises', data.exercises],
    ['routines', data.routines], ['days', data.days],
    ...data.sessions.map((s) => [db.sessionKey(s.id), s]),
  ]);
  state = { ...state, ...data };
  emit();
}

/** Añade datos sin borrar los locales (ejercicios por nombre, el resto por id). */
export async function mergeIn(payload) {
  const data = normalizeData(payload);
  const exMap = {};
  data.exercises.forEach((e) => {
    const local = state.exercises.find((x) => normName(x.name) === normName(e.name));
    exMap[e.id] = local ? local.id : e.id;
  });
  const newExercises = data.exercises.filter((e) => exMap[e.id] === e.id && !state.exercises.some((x) => x.id === e.id));
  const remapSession = (s) => ({ ...s, exercises: s.exercises.map((x) => ({ ...x, exerciseId: exMap[x.exerciseId] || x.exerciseId, precedingExerciseIds: (x.precedingExerciseIds || []).map((p) => exMap[p] || p) })) });
  const remapDay = (d) => ({ ...d, exercises: d.exercises.map((x) => ({ ...x, exerciseId: exMap[x.exerciseId] || x.exerciseId })) });
  const haveS = new Set(state.sessions.map((s) => s.id));
  const haveR = new Set(state.routines.map((r) => r.id));
  const haveD = new Set(state.days.map((d) => d.id));
  const sessions = data.sessions.filter((s) => !haveS.has(s.id)).map(remapSession);
  const routines = data.routines.filter((r) => !haveR.has(r.id)).map((r) => ({ ...r, active: false }));
  const days = data.days.filter((d) => !haveD.has(d.id)).map(remapDay);
  setState({
    exercises: [...state.exercises, ...newExercises],
    routines: [...state.routines, ...routines],
    days: [...state.days, ...days],
    sessions: [...state.sessions, ...sessions],
  });
  if (!activeRoutine(state) && routines.length) activateRoutine(routines[0].id);
  saveKey('exercises'); saveKey('routines'); saveKey('days');
  sessions.forEach(saveSession);
  return { sessions: sessions.length, exercises: newExercises.length, routines: routines.length };
}

export async function wipeAll() {
  await flush();
  await db.wipe();
  const data = normalizeData({});
  await db.writeMany([['meta', data.meta], ['config', data.config], ['exercises', []], ['routines', []], ['days', []]]);
  state = { ...state, ...data, error: null };
  emit();
}

export function clearError() { setState({ error: null }); }
