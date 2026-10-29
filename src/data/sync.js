// Servidor opcional (backend Spring Boot de Iron Log). La app funciona sin
// él; si está configurado, sube una copia completa (/api/snapshot) al
// terminar cada sesión y permite restaurarla en otro dispositivo.
import * as store from './store';
import { uid } from './schema';

export const DEFAULT_SERVER = import.meta.env.VITE_API_URL || 'https://workout-tracker-production.up.railway.app';

export class ConflictError extends Error {
  constructor(meta) {
    super('El servidor tiene una copia más reciente subida desde otro dispositivo.');
    this.meta = meta;
  }
}

export function normalizeUrl(url) {
  let u = String(url || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/+$/, '');
}

async function call(path, { method = 'GET', body, token, url } = {}) {
  const server = store.getState().config.server;
  const base = normalizeUrl(url || server.url);
  if (!base) throw new Error('No hay servidor configurado.');
  const headers = { 'Content-Type': 'application/json' };
  const t = token ?? server.token;
  if (t) headers.Authorization = `Bearer ${t}`;
  let res;
  try {
    res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('No se puede contactar con el servidor (¿sin conexión o servidor parado?).');
  }
  if (res.status === 401 || res.status === 403) {
    if (path !== '/api/auth/login') store.updateServer({ token: '', lastError: 'La sesión del servidor ha caducado: vuelve a conectar.' });
    throw new Error(path === '/api/auth/login' ? 'Usuario o contraseña incorrectos.' : 'Sesión del servidor caducada: vuelve a conectar.');
  }
  if (res.status === 409) throw new ConflictError(await res.json().catch(() => null));
  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Error ${res.status} del servidor`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : null;
}

export async function connect({ url, username, password }) {
  const base = normalizeUrl(url);
  const data = await call('/api/auth/login', { method: 'POST', url: base, token: '', body: { username, password } });
  store.updateServer({ url: base, username, token: data.token, connectedAt: new Date().toISOString(), lastError: null });
  return data;
}

export function disconnect() {
  store.updateServer({ token: '', connectedAt: null, lastError: null });
}

export function isConnected() {
  const s = store.getState().config.server;
  return Boolean(s.url && s.token);
}

export async function remoteMeta() {
  return call('/api/snapshot/meta');
}

export async function pushSnapshot({ force = false } = {}) {
  const state = store.getState();
  await store.flush();
  const meta = await call('/api/snapshot', {
    method: 'PUT',
    body: {
      data: store.exportPayload(),
      deviceId: state.meta?.deviceId || null,
      baseUpdatedAt: state.config.server.lastRemoteUpdatedAt || null,
      force,
    },
  });
  store.updateServer({ lastSyncAt: new Date().toISOString(), lastRemoteUpdatedAt: meta?.updatedAt || null, lastError: null });
  return meta;
}

export async function pullSnapshot() {
  const res = await call('/api/snapshot');
  if (!res || !res.data) return null;
  await store.replaceAll(res.data, { keepServer: true });
  store.updateServer({ lastSyncAt: new Date().toISOString(), lastRemoteUpdatedAt: res.updatedAt || null, lastError: null });
  return res;
}

/** Tras terminar una sesión: sube la copia sin molestar si algo falla. */
export function installAutoSync() {
  return store.onSessionFinished(() => {
    const s = store.getState().config.server;
    if (!s.autoSync || !s.url || !s.token) return;
    pushSnapshot().catch((e) => {
      store.updateServer({ lastError: e instanceof ConflictError ? 'Conflicto: hay una copia más nueva en el servidor. Revisa Ajustes.' : e.message });
    });
  });
}

/* ------------------------------------------------------------------ */
/* Importar los datos de la versión anterior (API de dominio)          */
/* ------------------------------------------------------------------ */

export async function importLegacy() {
  const [exercises, routines, sessions] = await Promise.all([
    call('/api/exercises'), call('/api/routines'), call('/api/sessions'),
  ]);
  const days = [];
  for (const r of routines || []) {
    const list = await call(`/api/training-days?routineId=${encodeURIComponent(r.id)}`);
    (list || []).forEach((d) => days.push(d));
  }
  const legacyLoose = await call('/api/training-days').catch(() => []);
  (legacyLoose || []).forEach((d) => { if (!days.some((x) => x.id === d.id)) days.push(d); });
  const dayName = Object.fromEntries(days.map((d) => [d.id, d.name]));

  const payload = {
    exercises: (exercises || []).map((e) => ({
      id: e.id, name: e.name, muscleGroup: e.muscleGroup || '', bodyweight: Boolean(e.bodyweight), active: e.active !== false,
    })),
    routines: (routines || []).map((r) => ({ id: r.id, name: r.name, level: r.level || null, type: r.type || null, active: false, archived: false })),
    days: days.map((d) => ({
      id: d.id, routineId: d.routineId || null, name: d.name, order: d.order || 0, weekday: null, archived: false,
      exercises: (d.exercises || []).map((x, i) => ({
        id: uid(), exerciseId: x.exerciseId, order: x.order || i + 1, sets: x.targetSets || 3, reps: x.targetReps || '', rir: null, notes: x.notes || '',
      })),
    })),
    sessions: (sessions || []).map((s) => ({
      id: s.id,
      status: 'done',
      date: String(s.date).slice(0, 10),
      startedAt: `${String(s.date).slice(0, 10)}T12:00:00.000Z`,
      finishedAt: `${String(s.date).slice(0, 10)}T13:00:00.000Z`,
      routineId: s.routineId || null,
      routineName: s.routineName || null,
      dayId: s.trainingDayId || null,
      dayName: dayName[s.trainingDayId] || s.routineName || 'Sesión',
      badDay: Boolean(s.badDay),
      notes: s.generalNotes || '',
      exercises: (s.exercises || []).map((x, i) => ({
        id: uid(),
        exerciseId: x.exerciseId,
        order: x.order || i + 1,
        movedFromDayId: x.movedFromDayId || null,
        precedingExerciseIds: x.precedingExerciseIds || [],
        target: {},
        sets: (x.sets || []).map((st) => ({
          id: uid(), type: 'work', weight: st.weight == null ? null : Number(st.weight), reps: Number(st.reps) || 0,
          rir: st.rpe == null ? null : Math.max(0, Math.round(10 - Number(st.rpe))), done: true, plan: null,
        })),
      })),
    })),
  };
  return store.mergeIn(payload);
}
