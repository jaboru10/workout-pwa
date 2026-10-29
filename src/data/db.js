// Persistencia local (IndexedDB vía idb-keyval) con caída a localStorage y,
// en último término, a memoria. Todo el estado de la app vive en el móvil:
//   'meta'      → { schemaVersion, deviceId, createdAt }
//   'config'    → preferencias + servidor opcional
//   'exercises' → [Exercise]
//   'routines'  → [Routine]
//   'days'      → [Day]
//   's:<id>'    → Session (una clave por sesión: escribir una serie no
//                 reescribe todo el historial)
import { createStore, get, set, del, entries, setMany, clear } from 'idb-keyval';

const SESSION_PREFIX = 's:';
let backend = null; // 'idb' | 'local' | 'memory'
let idbStore = null;
const memory = new Map();
// Copia profunda compatible con navegadores antiguos (structuredClone falta en iOS < 15.4).
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function lsKey(k) { return `ironlog:${k}`; }

async function detect() {
  if (backend) return backend;
  try {
    if (typeof indexedDB === 'undefined') throw new Error('sin IndexedDB');
    idbStore = createStore('ironlog-v3', 'kv');
    await set('__probe', 1, idbStore);
    await del('__probe', idbStore);
    backend = 'idb';
  } catch {
    try {
      localStorage.setItem(lsKey('__probe'), '1');
      localStorage.removeItem(lsKey('__probe'));
      backend = 'local';
    } catch {
      backend = 'memory';
    }
  }
  return backend;
}

export async function storageBackend() { return detect(); }

export async function readAll() {
  const kind = await detect();
  const out = { meta: null, config: null, exercises: null, routines: null, days: null, sessions: [] };
  const take = (key, value) => {
    if (key.startsWith(SESSION_PREFIX)) out.sessions.push(value);
    else if (key in out) out[key] = value;
  };
  if (kind === 'idb') {
    for (const [k, v] of await entries(idbStore)) take(String(k), v);
  } else if (kind === 'local') {
    for (let i = 0; i < localStorage.length; i++) {
      const full = localStorage.key(i);
      if (!full || !full.startsWith('ironlog:')) continue;
      try { take(full.slice(8), JSON.parse(localStorage.getItem(full))); } catch { /* clave corrupta */ }
    }
  } else {
    for (const [k, v] of memory) take(k, clone(v));
  }
  return out;
}

export async function write(key, value) {
  const kind = await detect();
  if (kind === 'idb') return set(key, value, idbStore);
  if (kind === 'local') return localStorage.setItem(lsKey(key), JSON.stringify(value));
  memory.set(key, clone(value));
}

export async function remove(key) {
  const kind = await detect();
  if (kind === 'idb') return del(key, idbStore);
  if (kind === 'local') return localStorage.removeItem(lsKey(key));
  memory.delete(key);
}

export async function writeMany(pairs) {
  const kind = await detect();
  if (kind === 'idb') return setMany(pairs, idbStore);
  for (const [k, v] of pairs) await write(k, v);
}

export async function wipe() {
  const kind = await detect();
  if (kind === 'idb') return clear(idbStore);
  if (kind === 'local') {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ironlog:')) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    return;
  }
  memory.clear();
}

export const sessionKey = (id) => `${SESSION_PREFIX}${id}`;

/** Pide al navegador que no borre los datos por falta de espacio. */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function storageEstimate() {
  try {
    const est = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    return { usage: est?.usage ?? null, quota: est?.quota ?? null, persisted: persisted ?? null };
  } catch {
    return { usage: null, quota: null, persisted: null };
  }
}
