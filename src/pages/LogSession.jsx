import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Button, Card, Input, EmptyState, RecordBadge } from '../components/ui';
import { EDIT_WINDOW_DAYS, formatDate, isWithinEditWindow, todayLocal } from '../utils/dates';

export default function LogSession() {
  const navigate = useNavigate();
  // Con :sessionId en la ruta la pantalla trabaja en modo edición (PUT);
  // sin él, en modo creación (POST) como siempre.
  const { sessionId } = useParams();
  const editing = Boolean(sessionId);

  const [days, setDays] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [date, setDate] = useState(todayLocal());
  const [dayId, setDayId] = useState('');
  const [badDay, setBadDay] = useState(false);
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([]); // ejercicios de la sesión

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // { session, newRecords }

  useEffect(() => {
    const base = [api.listDays(), api.listExercises()];
    const all = editing ? [...base, api.getSession(sessionId)] : base;

    Promise.all(all)
      .then(([d, e, session]) => {
        setDays(d);
        setExercises(e);
        if (!session) return;
        if (!isWithinEditWindow(session.date)) {
          setLoadError(`Esta sesión tiene más de ${EDIT_WINDOW_DAYS} días y ya no se puede editar.`);
          return;
        }
        prefill(session);
      })
      .catch((err) => setLoadError(err.message || 'No se ha podido cargar la sesión'))
      .finally(() => setLoading(false));
  }, [sessionId, editing]);

  // Vuelca una sesión guardada en el formulario (los inputs son controlados
  // con strings, de ahí la conversión de peso/reps).
  function prefill(session) {
    setDate(session.date || todayLocal());
    setDayId(session.trainingDayId || '');
    setBadDay(Boolean(session.badDay));
    setNotes(session.generalNotes || '');
    setRows(
      [...(session.exercises || [])]
        .sort((a, b) => a.order - b.order)
        .map((se, i) => ({
          exerciseId: se.exerciseId,
          order: i + 1,
          movedFromDayId: se.movedFromDayId || null,
          sets: [...(se.sets || [])]
            .sort((a, b) => a.setNumber - b.setNumber)
            .map((s, k) => ({
              setNumber: k + 1,
              weight: s.weight == null ? '' : String(s.weight),
              reps: s.reps == null ? '' : String(s.reps),
              unit: s.unit || 'kg',
            })),
        }))
    );
  }

  const exMap = Object.fromEntries(exercises.map((e) => [e.id, e]));

  // Un ejercicio borrado (soft delete) no viene en la lista activa. Si la
  // sesión editada lo usa, hay que ofrecerlo igualmente en el desplegable o
  // el select cambiaría el ejercicio de la fila sin avisar al guardar.
  function optionsFor(exerciseId) {
    if (!exerciseId || exMap[exerciseId]) return exercises;
    return [...exercises, { id: exerciseId, name: 'Ejercicio eliminado' }];
  }

  // Al elegir un día de plantilla, precargar sus ejercicios
  function loadDay(id) {
    // Cargar la plantilla pisa lo que haya escrito: confirmar antes de perderlo.
    if (rows.length > 0 && !confirm('Se reemplazarán los ejercicios actuales por los de la plantilla. ¿Seguir?')) {
      return;
    }
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

      const payload = {
        date,
        trainingDayId: dayId || null,
        badDay,
        generalNotes: notes,
        exercises: payloadExercises,
      };

      // Ambos endpoints devuelven { session, newRecords }, así que la pantalla
      // de resultado sirve igual para crear y para editar.
      const res = editing
        ? await api.updateSession(sessionId, payload)
        : await api.createSession(payload);

      setResult(res);
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="px-5 pt-8"><p className="text-muted font-body">Cargando…</p></div>;

  if (loadError) {
    return (
      <div className="px-5 pt-8">
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight mb-5">Editar</h1>
        <EmptyState
          title="No editable"
          hint={loadError}
          action={<Button onClick={() => navigate('/history')}>Volver al historial</Button>}
        />
      </div>
    );
  }

  // Pantalla de resultado con récords
  if (result) {
    const recs = result.newRecords || [];
    return (
      <div className="px-5 pt-8">
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight mb-2">
          {editing ? 'Actualizado' : 'Guardado'}
        </h1>
        <p className="text-muted font-body mb-6">
          Sesión del {formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

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
          {editing ? (
            <Button variant="ghost" className="flex-1" onClick={() => navigate('/history')}>
              Historial
            </Button>
          ) : (
            <Button variant="ghost" className="flex-1" onClick={() => { setResult(null); setRows([]); setDayId(''); }}>
              Otra sesión
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-8">
      <h1 className="font-display text-4xl font-bold uppercase tracking-tight mb-5">
        {editing ? 'Editar sesión' : 'Registrar'}
      </h1>

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
                    {optionsFor(row.exerciseId).map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
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
            className="w-full mt-4" onClick={save}
            disabled={saving || rows.length === 0}
          >
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar sesión'}
          </Button>

          {editing && (
            <Button variant="ghost" className="w-full mt-2 mb-4" onClick={() => navigate('/history')} disabled={saving}>
              Cancelar
            </Button>
          )}
          {!editing && <div className="mb-4" />}
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
