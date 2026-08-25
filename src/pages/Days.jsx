import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button, Input, Card, Panel, EmptyState } from '../components/ui';

export default function Days() {
  const [tab, setTab] = useState('days'); // 'days' | 'exercises'
  const [days, setDays] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [d, e] = await Promise.all([api.listDays(), api.listExercises()]);
    setDays(d);
    setExercises(e);
  }

  useEffect(() => {
    reload().catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-5 pt-8">
      <h1 className="font-display text-4xl font-bold uppercase tracking-tight mb-5">Plantilla</h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('days')}
          className={`flex-1 py-2 rounded-lg font-body text-sm font-semibold transition-colors ${
            tab === 'days' ? 'bg-volt text-ink' : 'bg-panel2 text-muted'
          }`}
        >
          Días
        </button>
        <button
          onClick={() => setTab('exercises')}
          className={`flex-1 py-2 rounded-lg font-body text-sm font-semibold transition-colors ${
            tab === 'exercises' ? 'bg-volt text-ink' : 'bg-panel2 text-muted'
          }`}
        >
          Ejercicios
        </button>
      </div>

      {loading ? (
        <p className="text-muted font-body">Cargando…</p>
      ) : tab === 'days' ? (
        <DaysTab days={days} exercises={exercises} onChange={reload} />
      ) : (
        <ExercisesTab exercises={exercises} onChange={reload} />
      )}
    </div>
  );
}

/* ---------- Ejercicios ---------- */
function ExercisesTab({ exercises, onChange }) {
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState('');
  const [bodyweight, setBodyweight] = useState(false);
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createExercise({ name: name.trim(), muscleGroup: muscle.trim(), bodyweight });
      setName(''); setMuscle(''); setBodyweight(false);
      await onChange();
    } finally { setSaving(false); }
  }

  async function remove(id) {
    await api.deleteExercise(id);
    await onChange();
  }

  return (
    <div>
      <Card className="p-4 mb-6 space-y-3">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Press banca" />
        <Input label="Grupo muscular" value={muscle} onChange={(e) => setMuscle(e.target.value)} placeholder="Pecho" />
        <label className="flex items-center gap-2 text-sm font-body text-chalk">
          <input type="checkbox" checked={bodyweight} onChange={(e) => setBodyweight(e.target.checked)}
                 className="accent-volt w-4 h-4" />
          Peso corporal (el peso registrado es el lastre)
        </label>
        <Button onClick={add} disabled={saving} className="w-full">Añadir ejercicio</Button>
      </Card>

      {exercises.length === 0 ? (
        <EmptyState title="Sin ejercicios" hint="Añade los ejercicios que sueles hacer." />
      ) : (
        <div className="space-y-2">
          {exercises.map((ex) => (
            <Panel key={ex.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="font-body font-medium">{ex.name}</p>
                <p className="text-muted text-xs font-body">
                  {ex.muscleGroup || 'Sin grupo'}{ex.bodyweight ? ' · peso corporal' : ''}
                </p>
              </div>
              <button onClick={() => remove(ex.id)} className="text-blood/70 hover:text-blood text-sm font-body px-2">
                Borrar
              </button>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Días ---------- */
function DaysTab({ days, exercises, onChange }) {
  const [newDayName, setNewDayName] = useState('');
  const [editing, setEditing] = useState(null); // día en edición

  async function addDay() {
    if (!newDayName.trim()) return;
    await api.createDay({ name: newDayName.trim(), order: days.length + 1, exercises: [] });
    setNewDayName('');
    await onChange();
  }

  async function removeDay(id) {
    await api.deleteDay(id);
    await onChange();
  }

  const exMap = Object.fromEntries(exercises.map((e) => [e.id, e]));

  return (
    <div>
      <Card className="p-4 mb-6 flex gap-2 items-end">
        <div className="flex-1">
          <Input label="Nuevo día" value={newDayName} onChange={(e) => setNewDayName(e.target.value)}
                 placeholder="Día A · Pecho/Tríceps" />
        </div>
        <Button onClick={addDay}>Añadir</Button>
      </Card>

      {days.length === 0 ? (
        <EmptyState title="Sin días" hint="Crea tu primer día de entrenamiento." />
      ) : (
        <div className="space-y-3">
          {days.map((day) => (
            <Card key={day.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-display text-xl uppercase tracking-wide">{day.name}</p>
                <div className="flex gap-3">
                  <button onClick={() => setEditing(editing?.id === day.id ? null : day)}
                          className="text-muted hover:text-chalk text-sm font-body">
                    {editing?.id === day.id ? 'Cerrar' : 'Editar'}
                  </button>
                  <button onClick={() => removeDay(day.id)}
                          className="text-blood/70 hover:text-blood text-sm font-body">Borrar</button>
                </div>
              </div>

              {(day.exercises || []).length === 0 ? (
                <p className="text-muted text-sm font-body">Sin ejercicios asignados</p>
              ) : (
                <div className="space-y-1.5">
                  {[...day.exercises].sort((a, b) => a.order - b.order).map((te, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm font-body">
                      <span className="text-volt font-mono w-5">{i + 1}</span>
                      <span className="flex-1">{exMap[te.exerciseId]?.name || '—'}</span>
                      <span className="text-muted font-mono text-xs">
                        {te.targetSets}×{te.targetReps}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {editing?.id === day.id && (
                <DayEditor day={day} exercises={exercises} onChange={onChange} onDone={() => setEditing(null)} />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DayEditor({ day, exercises, onChange, onDone }) {
  const [list, setList] = useState(() => [...(day.exercises || [])].sort((a, b) => a.order - b.order));
  const [exId, setExId] = useState('');
  const [sets, setSets] = useState(4);
  const [reps, setReps] = useState('6-8');
  const [saving, setSaving] = useState(false);

  function addRow() {
    if (!exId) return;
    setList([...list, { exerciseId: exId, order: list.length + 1, targetSets: Number(sets), targetReps: reps, notes: '' }]);
    setExId('');
  }

  function move(idx, dir) {
    const next = [...list];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    next.forEach((r, i) => (r.order = i + 1));
    setList(next);
  }

  function removeRow(idx) {
    const next = list.filter((_, i) => i !== idx);
    next.forEach((r, i) => (r.order = i + 1));
    setList(next);
  }

  async function save() {
    setSaving(true);
    try {
      await api.updateDay(day.id, { ...day, exercises: list });
      await onChange();
      onDone();
    } finally { setSaving(false); }
  }

  const exMap = Object.fromEntries(exercises.map((e) => [e.id, e]));

  return (
    <div className="mt-4 pt-4 border-t border-line space-y-3">
      <div className="space-y-2">
        {list.map((r, i) => (
          <div key={i} className="flex items-center gap-2 bg-panel2 rounded-lg p-2">
            <span className="text-volt font-mono text-sm w-5">{i + 1}</span>
            <span className="flex-1 text-sm font-body">{exMap[r.exerciseId]?.name || '—'}</span>
            <span className="text-muted font-mono text-xs">{r.targetSets}×{r.targetReps}</span>
            <div className="flex gap-1">
              <button onClick={() => move(i, -1)} className="text-muted hover:text-chalk px-1">↑</button>
              <button onClick={() => move(i, 1)} className="text-muted hover:text-chalk px-1">↓</button>
              <button onClick={() => removeRow(i)} className="text-blood/70 hover:text-blood px-1">×</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 items-end">
        <label className="flex-1">
          <span className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-body">Ejercicio</span>
          <select value={exId} onChange={(e) => setExId(e.target.value)}
                  className="w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-chalk font-body focus:outline-none focus:border-volt/60">
            <option value="">Elegir…</option>
            {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <div className="w-16">
          <span className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-body">Series</span>
          <input type="number" value={sets} onChange={(e) => setSets(e.target.value)}
                 className="w-full bg-panel2 border border-line rounded-lg px-2 py-2.5 text-chalk font-mono text-center focus:outline-none focus:border-volt/60" />
        </div>
        <div className="w-20">
          <span className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-body">Reps</span>
          <input value={reps} onChange={(e) => setReps(e.target.value)}
                 className="w-full bg-panel2 border border-line rounded-lg px-2 py-2.5 text-chalk font-mono text-center focus:outline-none focus:border-volt/60" />
        </div>
        <Button variant="ghost" onClick={addRow}>＋</Button>
      </div>

      <Button onClick={save} disabled={saving} className="w-full">Guardar día</Button>
    </div>
  );
}
