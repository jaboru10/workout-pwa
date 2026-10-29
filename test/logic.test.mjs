// Pruebas de la lógica pura (sin navegador): npm test
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { presetById } from '../src/data/presets.js';
import { newDayExercise, defaultConfig, uid } from '../src/data/schema.js';
import { newSession, executionOrder, nextPending, restAfter, effective } from '../src/logic/session.js';
import { suggest } from '../src/logic/progression.js';
import { parseReps } from '../src/logic/targets.js';
import { computeRecords } from '../src/logic/records.js';

const config = defaultConfig();

// Convierte un día de la rutina predefinida en {day, exercisesById} como hace el store.
function materialize(presetId, dayIndex) {
  const p = presetById(presetId);
  const exercisesById = {};
  const d = p.days[dayIndex];
  const day = {
    id: uid(), routineId: 'r', name: d.name, order: dayIndex + 1, weekday: d.weekday,
    exercises: d.exercises.map((e, k) => {
      const id = `ex-${e.name}`;
      exercisesById[id] = { id, name: e.name, muscleGroup: e.muscle, bodyweight: e.bodyweight, increment: e.increment ?? 2.5 };
      return newDayExercise(id, k + 1, { sets: e.sets, reps: e.reps, rir: e.rir, restSec: e.restSec, role: e.role, superset: e.superset, technique: e.technique, notes: e.notes });
    }),
  };
  return { day, exercisesById, routine: { id: 'r', name: p.name } };
}

// Marca las series en el orden que propone la app, con peso/reps dados por función.
function runSession(session, fill) {
  let s = session;
  const trace = [];
  for (let guard = 0; guard < 200; guard++) {
    const next = nextPending(s);
    if (!next) break;
    const { ei, si } = next;
    const set = s.exercises[ei].sets[si];
    const { weight, reps, rir } = fill(s.exercises[ei], set, si);
    s = { ...s, exercises: s.exercises.map((x, i) => (i !== ei ? x : { ...x, sets: x.sets.map((st, k) => (k !== si ? st : { ...st, weight, reps, rir, done: true })) })) };
    trace.push({ ei, si, type: set.type, rest: restAfter(s, ei, si, config) });
  }
  return { session: { ...s, status: 'done', date: '2026-10-28', finishedAt: '2026-10-28T19:00:00Z' }, trace };
}

test('parseReps entiende rangos, biseries, máx y fijos', () => {
  assert.deepEqual([parseReps('8-12').kind, parseReps('8-12').min, parseReps('8-12').max], ['range', 8, 12]);
  assert.equal(parseReps('15+15').kind, 'biserie');
  assert.equal(parseReps('máx').kind, 'amrap');
  assert.equal(parseReps('21').kind, 'fixed');
});

test('Miércoles F1: la superserie pullover + lumbares se alterna y el descanso va después del segundo', () => {
  const { day, exercisesById, routine } = materialize('javier-f1-2026', 2);
  const s0 = newSession({ day, routine, exercisesById, sessions: [] });
  const pull = s0.exercises.findIndex((x) => exercisesById[x.exerciseId].name === 'Pullover en polea');
  const lumb = s0.exercises.findIndex((x) => exercisesById[x.exerciseId].name === 'Lumbares');
  const { trace } = runSession(s0, () => ({ weight: 20, reps: 10, rir: 0 }));
  const ss = trace.filter((t) => t.ei === pull || t.ei === lumb);
  assert.deepEqual(ss.map((t) => t.ei), [pull, lumb, pull, lumb, pull, lumb], 'orden alterno');
  ss.forEach((t) => assert.equal(t.rest > 0, t.ei === lumb, `descanso tras ${t.ei === pull ? 'pullover' : 'lumbares'}`));
});

test('Jueves F1: biserie de laterales = 6 series con drop pegado y sin descanso entre ambas mitades', () => {
  const { day, exercisesById, routine } = materialize('javier-f1-2026', 3);
  const s0 = newSession({ day, routine, exercisesById, sessions: [] });
  const lat = s0.exercises.findIndex((x) => exercisesById[x.exerciseId].name === 'Elevaciones laterales con mancuernas');
  const sets = s0.exercises[lat].sets;
  assert.equal(sets.filter((x) => x.type === 'work').length, 6);
  assert.equal(sets.filter((x) => x.type === 'drop').length, 6);
  const { trace } = runSession(s0, (x, set) => ({ weight: set.type === 'drop' ? 5 : 10, reps: 15, rir: 0 }));
  const t = trace.filter((r) => r.ei === lat);
  assert.deepEqual(t.slice(0, 4).map((r) => r.type), ['work', 'drop', 'work', 'drop']);
  t.forEach((r) => assert.equal(r.rest > 0, r.type === 'drop'));
});

test('Doble progresión: 12/12/12 sube peso; 10/9/8 mantiene; un día flojo mantiene el peso', () => {
  const { day, exercisesById, routine } = materialize('javier-f1-2026', 0);
  const press = day.exercises[0];
  const exercise = exercisesById[press.exerciseId];
  const mk = (repsArr, extra = {}) => ({
    id: uid(), status: 'done', date: '2026-10-26', finishedAt: '2026-10-26T19:00:00Z', ...extra,
    exercises: [{ id: uid(), exerciseId: exercise.id, order: 1, sets: repsArr.map((r) => ({ id: uid(), type: 'work', weight: 30, reps: r, rir: 0, done: true })) }],
  });
  const up = suggest(exercise, press, [mk([12, 12, 12])]);
  assert.equal(up.kind, 'up'); assert.equal(up.weight, 32.5);
  const same = suggest(exercise, press, [mk([10, 9, 8])]);
  assert.equal(same.kind, 'same'); assert.equal(same.weight, 30);
  const bad = suggest(exercise, press, [mk([9, 8, 7], { badDay: true })]);
  assert.equal(bad.kind, 'same'); assert.equal(bad.weight, 30);
});

test('Récords: los drops y aproximaciones no cuentan como peso máximo', () => {
  const exId = 'ex-a';
  const sessions = [{
    id: 's1', status: 'done', date: '2026-10-20', exercises: [{ id: 'x', exerciseId: exId, order: 1, sets: [
      { id: 'a', type: 'warmup', weight: 60, reps: 3, done: true },
      { id: 'b', type: 'work', weight: 40, reps: 10, rir: 0, done: true },
      { id: 'c', type: 'drop', weight: 80, reps: 5, done: true },
    ] }],
  }];
  const r = computeRecords(sessions, exId, { windowMonths: 0, repRanges: config.repRanges });
  assert.equal(r.maxWeight.value, 40);
});

test('Las series heredan el peso planificado', () => {
  const set = { type: 'work', weight: null, reps: null, plan: { weight: 30, reps: 10 } };
  assert.deepEqual([effective(set).weight, effective(set).reps], [30, 10]);
});

test('Biserie: con 20+15 en todas las rondas sube el peso de ambas mitades', () => {
  const { day, exercisesById } = materialize('javier-f1-2026', 3);
  const lat = day.exercises.find((d) => exercisesById[d.exerciseId].name === 'Elevaciones laterales con mancuernas');
  const exercise = { ...exercisesById[lat.exerciseId], increment: 2 };
  const sets = [];
  for (let i = 0; i < 6; i++) {
    sets.push({ id: uid(), type: 'work', weight: 10, reps: 20, rir: 0, done: true });
    sets.push({ id: uid(), type: 'drop', weight: 5, reps: 15, done: true });
  }
  const s = { id: 'b', status: 'done', date: '2026-10-22', exercises: [{ id: 'x', exerciseId: exercise.id, order: 2, sets }] };
  const up = suggest(exercise, lat, [s]);
  assert.equal(up.kind, 'up'); assert.equal(up.weight, 12); assert.equal(up.dropWeight, 6);
  // 15 reps en la parte pesada → objetivo 18
  const s2 = { ...s, exercises: [{ ...s.exercises[0], sets: sets.map((x) => (x.type === 'work' ? { ...x, reps: 15 } : x)) }] };
  const same = suggest(exercise, lat, [s2]);
  assert.equal(same.kind, 'same'); assert.deepEqual(same.reps, Array(6).fill(18));
});

test('Pasar de F1 (8-12) a F2 (5-8): estima el peso desde el 1RM', () => {
  const exercise = { id: 'ex-press', name: 'Press plano con mancuernas', increment: 2 };
  const s = { id: 'p', status: 'done', date: '2026-10-26', exercises: [{ id: 'x', exerciseId: exercise.id, order: 1, sets: [12, 12, 11].map((r) => ({ id: uid(), type: 'work', weight: 30, reps: r, rir: 0, done: true })) }] };
  const target = { sets: 3, reps: '5-8', rir: '1-2' };
  const r = suggest(exercise, target, [s]);
  assert.equal(r.kind, 'estimate');
  assert.ok(r.weight > 30 && r.weight <= 36, `peso estimado razonable: ${r.weight}`);
});

test('Máximo de reps (rueda abdominal): +1 rep por serie', () => {
  const exercise = { id: 'ex-rueda', name: 'Rueda abdominal', bodyweight: true };
  const s = { id: 'r', status: 'done', date: '2026-10-26', exercises: [{ id: 'x', exerciseId: exercise.id, order: 5, sets: [20, 10, 8].map((r) => ({ id: uid(), type: 'work', weight: 0, reps: r, rir: 0, done: true })) }] };
  const r = suggest(exercise, { sets: 3, reps: 'máx', rir: '0' }, [s]);
  assert.equal(r.kind, 'reps'); assert.deepEqual(r.reps, [21, 11, 9]);
});

test('Jueves F1: encogimientos + pájaros en superserie y descanso solo al cerrar cada ronda', () => {
  const { day, exercisesById, routine } = materialize('javier-f1-2026', 3);
  const s0 = newSession({ day, routine, exercisesById, sessions: [] });
  const idx = (n) => s0.exercises.findIndex((x) => exercisesById[x.exerciseId].name.startsWith(n));
  const a = idx('Encogimientos'); const b = idx('Pájaros');
  const { trace } = runSession(s0, () => ({ weight: 10, reps: 12, rir: 0 }));
  const t = trace.filter((r) => r.ei === a || r.ei === b);
  assert.deepEqual(t.map((r) => r.ei), [a, b, a, b, a, b]);
  t.forEach((r) => assert.equal(r.rest > 0, r.ei === b));
});

test('Todas las rutinas predefinidas generan sesiones válidas', async () => {
  const { PRESETS } = await import('../src/data/presets.js');
  for (const p of PRESETS) {
    p.days.forEach((_, i) => {
      const { day, exercisesById, routine } = materialize(p.id, i);
      const s = newSession({ day, routine, exercisesById, sessions: [] });
      assert.ok(s.exercises.length > 0, `${p.name} · ${day.name}`);
      const order = executionOrder(s);
      const total = s.exercises.reduce((n, x) => n + x.sets.length, 0);
      assert.equal(order.length, total, `orden completo en ${p.name} · ${day.name}`);
    });
  }
});
