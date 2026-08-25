import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Button, Card, Input, EmptyState, RecordBadge } from '../components/ui';

export default function LogSession() {
  const navigate = useNavigate();
  const [days, setDays] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dayId, setDayId] = useState('');
  const [badDay, setBadDay] = useState(false);
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([]); // ejercicios de la sesión

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // { newRecords }

  useEffect(() => {
    Promise.all([api.listDays(), api.listExercises()])
      .then(([d, e]) => { setDays(d); setExercises(e); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const exMap = Object.fromEntries(exercises.map((e) => [e.id, e]));

  // Al elegir un día de plantilla, precargar sus ejercicios
  function loadDay(id) {
    setDayId(id);
    const day = days.find((d) => d.id === id);
    if (!day) { setRows([]); return; }
    const preset = [...(day.exercises || [])]
      .sort((a, b) => a.order - b.order)
      .map((te, i) => ({
        exerciseId: te.exerciseId,
        order: i + 1,
        movedFromDayId: null,
        sets: Array.from({ length: te.targetSets || 3 }, (_, k) => ({
          setNumber: k + 1, weight: '', reps: '', unit: 'kg',
        })),
      }));
    setRows(preset);
  }

  function addExercise() {
    setRows([...rows, {
      exerciseId: exercises[0]?.id || '',
      order: rows.length + 1,
      movedFromDayId: null,
      sets: [{ setNumber: 1, weight: '', reps: '', unit: 'kg' }],
    }]);
  }

  function updateRow(idx, patch) {
    const next = [...rows];
    next[idx] = { ...next[idx], ...patch };
    setRows(next);
  }

  function addSet(rowIdx) {
    const next = [...rows];
    const sets = next[rowIdx].sets;
    sets.push({ setNumber: sets.length + 1, weight: '', reps: '', unit: 'kg' });
    setRows(next);
  }

  function updateSet(rowIdx, setIdx, patch) {
    const next = [...rows];
    next[rowIdx].sets[setIdx] = { ...next[rowIdx].sets[setIdx], ...patch };
    setRows(next);
  }

  function removeSet(rowIdx, setIdx) {
    const next = [...rows];
    next[rowIdx].sets = next[rowIdx].sets.filter((_, i) => i !== setIdx);
    next[rowIdx].sets.forEach((s, i) => (s.setNumber = i + 1));
    setRows(next);
  }

  function removeRow(idx) {
    const next = rows.filter((_, i) => i !== idx);
    next.forEach((r, i) => (r.order = i + 1));
    setRows(next);
  }

  async function save() {
    setSaving(true);
    setResult(null);
    try {
      // Construir el payload calculando precedingExerciseIds (contexto de fatiga)
      const payloadExercises = rows.map((r, i) => ({
        exerciseId: r.exerciseId,
        order: i + 1,
        movedFromDayId: r.movedFromDayId || null,
        precedingExerciseIds: rows.slice(0, i).map((p) => p.exerciseId),
        sets: r.sets
          .filter((s) => s.weight !== '' && s.reps !== '')
          .map((s) => ({
            setNumber: s.setNumber,
            weight: Number(s.weight),
            reps: Number(s.reps),
            unit: s.unit || 'kg',
          })),
      })).filter((r) => r.sets.length > 0);

      const res = await api.createSession({
        date,
        trainingDayId: dayId || null,
        badDay,
        generalNotes: notes,
        exercises: payloadExercises,
      });

      setResult(res);
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="px-5 pt-8"><p className="text-muted font-body">Cargando…</p></div>;

  // Pantalla de resultado con récords
  if (result) {
    const recs = result.newRecords || [];
    return (
      <div className="px-5 pt-8">
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight mb-2">Guardado</h1>
        <p className="text-muted font-body mb-6">Sesión del {new Date(date).toLocaleDateString('es-ES')}</p>

        {recs.length > 0 ? (
          <Card className="p-5 mb-6 border-volt/40">
            <p className="text-volt font-display text-2xl uppercase tracking-wide mb-4">
              ★ {recs.length} {recs.length === 1 ? 'récord' : 'récords'}
            </p>
            <div className="space-y-3">
              {recs.map((r, i) => (
                <div key={i} className="flex items-center justify-between border-b border-line pb-3 last:border-0">
                  <div>
                    <p className="font-body font-medium">{exMap[r.exerciseId]?.name || '—'}</p>
                    <p className="text-muted text-xs font-body">{recordLabel(r.type)}</p>
                  </div>
                  <p className="font-display text-2xl text-volt">
                    {r.weight}<span className="text-sm text-muted">kg × {r.reps}</span>
                  </p>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-5 mb-6">
            <p className="font-body text-muted">Sesión registrada. Sin récords esta vez, a seguir sumando.</p>
          </Card>
        )}

        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => navigate('/')}>Inicio</Button>
          <Button variant="ghost" className="flex-1" onClick={() => { setResult(null); setRows([]); setDayId(''); }}>
            Otra sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-8">
      <h1 className="font-display text-4xl font-bold uppercase tracking-tight mb-5">Registrar</h1>

      <Card className="p-4 mb-4 space-y-3">
        <Input label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-body">Día de plantilla</span>
          <select value={dayId} onChange={(e) => loadDay(e.target.value)}
                  className="w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-chalk font-body focus:outline-none focus:border-volt/60">
            <option value="">Libre (sin plantilla)</option>
            {days.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-body text-chalk">
          <input type="checkbox" checked={badDay} onChange={(e) => setBadDay(e.target.checked)}
                 className="accent-volt w-4 h-4" />
          Día flojo (reps por debajo de lo normal)
        </label>
      </Card>

      {exercises.length === 0 ? (
        <EmptyState title="Sin ejercicios" hint="Crea ejercicios en la pestaña Plantilla primero." />
      ) : (
        <>
          <div className="space-y-3">
            {rows.map((row, ri) => (
              <Card key={ri} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-volt font-mono text-sm">{ri + 1}</span>
                  <select
                    value={row.exerciseId}
                    onChange={(e) => updateRow(ri, { exerciseId: e.target.value })}
                    className="flex-1 bg-panel2 border border-line rounded-lg px-2 py-2 text-chalk font-body text-sm focus:outline-none focus:border-volt/60"
                  >
                    {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  <button onClick={() => removeRow(ri)} className="text-blood/70 hover:text-blood px-1">×</button>
                </div>

                {/* Cabecera de sets */}
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted font-body mb-1 px-1">
                  <span className="w-6">Set</span>
                  <span className="flex-1">Peso (kg)</span>
                  <span className="flex-1">Reps</span>
                  <span className="w-6"></span>
                </div>

                <div className="space-y-1.5">
                  {row.sets.map((s, si) => (
                    <div key={si} className="flex items-center gap-2">
                      <span className="w-6 text-center font-mono text-muted text-sm">{si + 1}</span>
                      <input
                        type="number" inputMode="decimal" step="0.25" placeholder="0"
                        value={s.weight}
                        onChange={(e) => updateSet(ri, si, { weight: e.target.value })}
                        className="flex-1 bg-panel2 border border-line rounded-lg px-2 py-2 text-chalk font-mono text-center focus:outline-none focus:border-volt/60"
                      />
                      <input
                        type="number" inputMode="numeric" placeholder="0"
                        value={s.reps}
                        onChange={(e) => updateSet(ri, si, { reps: e.target.value })}
                        className="flex-1 bg-panel2 border border-line rounded-lg px-2 py-2 text-chalk font-mono text-center focus:outline-none focus:border-volt/60"
                      />
                      <button onClick={() => removeSet(ri, si)} className="w-6 text-muted hover:text-blood">−</button>
                    </div>
                  ))}
                </div>

                <button onClick={() => addSet(ri)}
                        className="text-volt text-xs font-body font-semibold uppercase tracking-wide mt-2 hover:opacity-80">
                  ＋ Añadir serie
                </button>
              </Card>
            ))}
          </div>

          <Button variant="outline" className="w-full mt-3" onClick={addExercise}>
            ＋ Añadir ejercicio
          </Button>

          <Input
            label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Sensaciones, molestias…" className="mt-4"
          />

          <Button
            className="w-full mt-4 mb-4" onClick={save}
            disabled={saving || rows.length === 0}
          >
            {saving ? 'Guardando…' : 'Guardar sesión'}
          </Button>
        </>
      )}
    </div>
  );
}

function recordLabel(type) {
  switch (type) {
    case 'MAX_WEIGHT': return 'Peso máximo';
    case 'BEST_VOLUME': return 'Mejor volumen';
    case 'ESTIMATED_1RM': return '1RM estimado';
    default: return type;
  }
}
