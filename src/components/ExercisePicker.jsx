import { useMemo, useState } from 'react';
import { addExercise, useAppState } from '../data/store';
import { MUSCLE_GROUPS, normName } from '../data/schema';
import { Button, Input, Select, Sheet, Toggle } from './ui';

/** Hoja para elegir un ejercicio existente o crear uno nuevo al vuelo. */
export default function ExercisePicker({ open, onClose, onPick, title = 'Elegir ejercicio' }) {
  const state = useAppState();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [muscle, setMuscle] = useState('');
  const [bw, setBw] = useState(false);

  const list = useMemo(() => {
    const term = normName(q);
    return state.exercises
      .filter((e) => e.active)
      .filter((e) => !term || normName(`${e.name} ${e.muscleGroup}`).includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [state.exercises, q]);

  const exact = list.some((e) => normName(e.name) === normName(q));

  function close() {
    setQ(''); setCreating(false); setMuscle(''); setBw(false);
    onClose();
  }

  function create() {
    if (!q.trim()) return;
    const ex = addExercise({ name: q.trim(), muscleGroup: muscle, bodyweight: bw });
    onPick(ex);
    close();
  }

  return (
    <Sheet open={open} onClose={close} title={title}>
      <div className="flex flex-col gap-3">
        <Input
          placeholder="Buscar o escribir uno nuevo…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setCreating(false); }}
          autoFocus
        />

        {q.trim() && !exact && (
          creating ? (
            <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4 flex flex-col gap-3">
              <p className="text-sm">Nuevo ejercicio: <span className="font-semibold">{q.trim()}</span></p>
              <Select label="Grupo muscular" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
                <option value="">Elegir…</option>
                {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
              <Toggle checked={bw} onChange={setBw} label="Peso corporal" hint="El peso que apuntes será el lastre." />
              <Button onClick={create}>Crear y añadir</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setCreating(true)} className="justify-start">
              ＋ Crear «{q.trim()}»
            </Button>
          )
        )}

        <div className="flex flex-col">
          {list.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => { onPick(e); close(); }}
              className="flex items-center justify-between gap-3 min-h-[52px] border-b border-line text-left active:bg-panel2"
            >
              <span className="min-w-0">
                <span className="block text-[15px] truncate">{e.name}</span>
                <span className="block text-xs text-muted">{e.muscleGroup || 'Sin grupo'}{e.bodyweight ? ' · peso corporal' : ''}</span>
              </span>
              <span className="text-muted">›</span>
            </button>
          ))}
          {list.length === 0 && !q.trim() && (
            <p className="text-sm text-muted py-6 text-center">Aún no hay ejercicios. Escribe un nombre para crear el primero.</p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
