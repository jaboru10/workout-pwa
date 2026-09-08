import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import {
  Button, Card, EmptyState, Input, Kbd, Loading, NumCell, Panel, SectionTitle, Select, Stat,
} from '../components/ui';
import { PageBody, PageHeader } from '../components/Shell';
import { EDIT_WINDOW_DAYS, formatDate, isWithinEditWindow, todayLocal } from '../utils/dates';
import { est1RM, formatVolume, setVolume, short } from '../utils/metrics';

export default function LogSession() {
  const navigate = useNavigate();
  // Con :sessionId en la ruta la pantalla trabaja en modo edición (PUT);
  // sin él, en modo creación (POST) como siempre.
  const { sessionId } = useParams();
  const editing = Boolean(sessionId);

  const [days, setDays] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [sessionRoutineName, setSessionRoutineName] = useState(null);
  const [bests, setBests] = useState({}); // exerciseId → mejor peso histórico
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [date, setDate] = useState(todayLocal());
  const [dayId, setDayId] = useState('');
  const [badDay, setBadDay] = useState(false);
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([]);

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // { session, newRecords }

  // Autoguardado (solo en modo edición): 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
  const [autoStatus, setAutoStatus] = useState('idle');
  const [hydrated, setHydrated] = useState(false);
  const savedSigRef = useRef(null);

  // Celda con el cursor, para que el pad de ajuste rápido sepa a quién aplicar.
  const [focus, setFocus] = useState({ r: 0, s: 0, f: 'w' });
  const [prCell, setPrCell] = useState(null);

  useEffect(() => {
    const base = [api.listDays(), api.listExercises(), api.activeRoutine(), api.listSessions()];
    const all = editing ? [...base, api.getSession(sessionId)] : base;

    Promise.all(all)
      .then(([d, e, routine, sessions, session]) => {
        setDays(d);
        setExercises(e);
        setActiveRoutine(routine);

        // Mejor peso por ejercicio calculado del historial: permite marcar el
        // récord en el momento de teclearlo, sin esperar al guardado.
        const best = {};
        (sessions || []).forEach((s) => (s.exercises || []).forEach((ex) => {
          (ex.sets || []).forEach((set) => {
            const w = Number(set.weight || 0);
            if (w > (best[ex.exerciseId] || 0)) best[ex.exerciseId] = w;
          });
        }));
        setBests(best);

        if (!session) return;
        if (!isWithinEditWindow(session.date)) {
          setLoadError(`Esta sesión tiene más de ${EDIT_WINDOW_DAYS} días y ya no se puede editar.`);
          return;
        }
        setSessionRoutineName(session.routineName || null);
        prefill(session);
        setHydrated(true);
      })
      .catch((err) => setLoadError(err.message || 'No se ha podido cargar la sesión'))
      .finally(() => setLoading(false));
  }, [sessionId, editing]);

  const contentSig = JSON.stringify({ date, dayId, badDay, notes, rows });

  // Autoguardado con debounce, silencioso: mantiene la caché de récords al día
  // pero no abre la pantalla de récords (esa sigue siendo del botón Guardar).
  useEffect(() => {
    if (!editing || !hydrated || result) return;
    if (savedSigRef.current === null) { savedSigRef.current = contentSig; return; }
    if (contentSig === savedSigRef.current) return;

    const payload = buildPayload();
    if (payload.exercises.length === 0) return;

    setAutoStatus('dirty');
    const timer = setTimeout(async () => {
      setAutoStatus('saving');
      try {
        await api.updateSession(sessionId, payload);
        savedSigRef.current = contentSig;
        setAutoStatus('saved');
      } catch {
        setAutoStatus('error');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [contentSig, editing, hydrated, result, sessionId]);

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

  const exMap = useMemo(() => Object.fromEntries(exercises.map((e) => [e.id, e])), [exercises]);

  // Un ejercicio con soft delete no viene en la lista activa: si la sesión
  // editada lo usa hay que ofrecerlo igual o el select lo cambiaría sin avisar.
  function optionsFor(exerciseId) {
    if (!exerciseId || exMap[exerciseId]) return exercises;
    return [...exercises, { id: exerciseId, name: 'Ejercicio eliminado' }];
  }

  function loadDay(id) {
    if (rows.length > 0 && !confirm('Se reemplazarán los ejercicios actuales por los de la plantilla. ¿Seguir?')) return;
    setDayId(id);
    const day = days.find((d) => d.id === id);
    if (!day) { setRows([]); return; }
    setRows(
      [...(day.exercises || [])]
        .sort((a, b) => a.order - b.order)
        .map((te, i) => ({
          exerciseId: te.exerciseId,
          order: i + 1,
          movedFromDayId: null,
          targetReps: te.targetReps,
          sets: Array.from({ length: te.targetSets || 3 }, (_, k) => ({
            setNumber: k + 1, weight: '', reps: '', unit: 'kg',
          })),
        }))
    );
  }

  /* ---------- edición de filas y series ---------- */
  const mutate = useCallback((fn) => {
    setRows((prev) => {
      const next = prev.map((r) => ({ ...r, sets: r.sets.map((s) => ({ ...s })) }));
      fn(next);
      next.forEach((r, i) => { r.order = i + 1; r.sets.forEach((s, k) => (s.setNumber = k + 1)); });
      return next;
    });
  }, []);

  function addExercise() {
    mutate((next) => next.push({
      exerciseId: exercises[0]?.id || '',
      order: next.length + 1,
      movedFromDayId: null,
      sets: [{ setNumber: 1, weight: '', reps: '', unit: 'kg' }],
    }));
  }

  // `repeat` hereda peso y reps de la última serie: es lo que se quiere el 90%
  // de las veces y ahorra teclear dos números.
  function addSet(rowIdx, repeat) {
    mutate((next) => {
      const sets = next[rowIdx].sets;
      const last = sets[sets.length - 1];
      sets.push({
        setNumber: sets.length + 1,
        weight: repeat && last ? last.weight : '',
        reps: repeat && last ? last.reps : '',
        unit: 'kg',
      });
    });
    const target = rows[rowIdx].sets.length; // índice de la nueva serie
    setTimeout(() => focusCell(rowIdx, target, 'w'), 20);
  }

  function updateSet(rowIdx, setIdx, patch) {
    mutate((next) => { next[rowIdx].sets[setIdx] = { ...next[rowIdx].sets[setIdx], ...patch }; });
    if (patch.weight != null) {
      const best = bests[rows[rowIdx]?.exerciseId];
      if (best && Number(patch.weight) > best) {
        setPrCell(`${rowIdx}-${setIdx}`);
        setTimeout(() => setPrCell(null), 1300);
      }
    }
  }

  const removeSet = (rowIdx, setIdx) => mutate((next) => { next[rowIdx].sets.splice(setIdx, 1); });
  const removeRow = (idx) => mutate((next) => { next.splice(idx, 1); });

  /* ---------- navegación con teclado ---------- */
  function focusCell(r, s, f) {
    const el = document.querySelector(`[data-cell="${r}-${s}-${f}"]`);
    if (el) { el.focus(); el.select?.(); }
  }

  function bump(delta) {
    const { r, s, f } = focus;
    const row = rows[r];
    if (!row?.sets[s]) return;
    const key = f === 'w' ? 'weight' : 'reps';
    const value = Math.max(0, Math.round((Number(row.sets[s][key] || 0) + delta) * 100) / 100);
    updateSet(r, s, { [key]: String(value) });
  }

  function copyPrevious() {
    const { r, s } = focus;
    if (s === 0) return;
    mutate((next) => { next[r].sets[s] = { ...next[r].sets[s - 1], setNumber: s + 1 }; });
  }

  // Enter avanza peso → reps → serie siguiente (creándola si hace falta),
  // ↑↓ salta de serie y de ejercicio, +/− ajustan el valor de la celda.
  function onCellKeyDown(e, r, s, f) {
    const row = rows[r];
    if (e.key === 'Enter') {
      e.preventDefault();
      if (f === 'w') return focusCell(r, s, 'r');
      if (s < row.sets.length - 1) return focusCell(r, s + 1, 'w');
      return addSet(r, true);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (s < row.sets.length - 1) focusCell(r, s + 1, f);
      else if (r < rows.length - 1) focusCell(r + 1, 0, f);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (s > 0) focusCell(r, s - 1, f);
      else if (r > 0) focusCell(r - 1, rows[r - 1].sets.length - 1, f);
      return;
    }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); bump(f === 'w' ? 2.5 : 1); return; }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); bump(f === 'w' ? -2.5 : -1); }
  }

  // ⌘/Ctrl+D duplica la serie anterior en la celda enfocada.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); copyPrevious(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, rows]);

  /* ---------- guardado ---------- */
  function buildPayload() {
    const payloadExercises = rows.map((r, i) => ({
      exerciseId: r.exerciseId,
      order: i + 1,
      movedFromDayId: r.movedFromDayId || null,
      precedingExerciseIds: rows.slice(0, i).map((p) => p.exerciseId),
      sets: r.sets
        .filter((s) => s.weight !== '' && s.reps !== '')
        .map((s) => ({ setNumber: s.setNumber, weight: Number(s.weight), reps: Number(s.reps), unit: s.unit || 'kg' })),
    })).filter((r) => r.sets.length > 0);

    return { date, trainingDayId: dayId || null, badDay, generalNotes: notes, exercises: payloadExercises };
  }

  async function save() {
    setSaving(true);
    setResult(null);
    try {
      const payload = buildPayload();
      const res = editing
        ? await api.updateSession(sessionId, payload)
        : await api.createSession(payload);
      savedSigRef.current = contentSig;
      setAutoStatus('saved');
      setResult(res);
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  /* ---------- totales de la sesión ---------- */
  const totals = useMemo(() => {
    let sets = 0, volume = 0, top = 0, prs = 0, best1rm = 0;
    rows.forEach((r) => r.sets.forEach((s) => {
      const v = setVolume(s);
      if (v > 0) {
        sets++; volume += v;
        if (v > top) top = v;
        best1rm = Math.max(best1rm, est1RM(s.weight, s.reps));
        const best = bests[r.exerciseId];
        if (best && Number(s.weight) > best) prs++;
      }
    }));
    return { sets, volume, top, prs, best1rm };
  }, [rows, bests]);

  if (loading) return <PageBody><Loading /></PageBody>;

  if (loadError) {
    return (
      <>
        <PageHeader crumb="Historial" title="Editar sesión" />
        <PageBody>
          <EmptyState
            title="No editable"
            hint={loadError}
            action={<Button onClick={() => navigate('/history')}>Volver al historial</Button>}
          />
        </PageBody>
      </>
    );
  }

  /* ---------- pantalla de resultado ---------- */
  if (result) {
    const recs = result.newRecords || [];
    return (
      <>
        <PageHeader
          crumb={`Sesión del ${formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}`}
          title={editing ? 'Actualizado' : 'Guardado'}
        />
        <PageBody className="flex flex-col gap-5 max-w-3xl">
          {recs.length > 0 ? (
            <Card className="p-6 border-accent/40">
              <p className="font-display text-2xl uppercase tracking-wide text-accent mb-4">
                ★ {recs.length} {recs.length === 1 ? 'récord' : 'récords'}
              </p>
              <div className="flex flex-col">
                {recs.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 py-3 border-b border-line last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium">{exMap[r.exerciseId]?.name || '—'}</p>
                      <p className="text-xs text-muted">{recordLabel(r.type)}</p>
                    </div>
                    <p className="font-mono text-xl font-bold text-accent shrink-0">
                      {short(r.weight)}<span className="text-[13px] text-muted font-normal">kg × {r.reps}</span>
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="p-6">
              <p className="text-muted">Sesión registrada. Sin récords esta vez, a seguir sumando.</p>
            </Card>
          )}

          <div className="flex flex-wrap gap-2.5">
            <Button onClick={() => navigate('/')}>Inicio</Button>
            {editing ? (
              <Button variant="ghost" onClick={() => navigate('/history')}>Historial</Button>
            ) : (
              <Button variant="ghost" onClick={() => { setResult(null); setRows([]); setDayId(''); }}>
                Otra sesión
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate('/records')}>Ver progreso</Button>
          </div>
        </PageBody>
      </>
    );
  }

  const focusedRow = rows[focus.r];
  const focusLabel = focusedRow
    ? `${exMap[focusedRow.exerciseId]?.name || 'ejercicio'} · serie ${focus.s + 1} · ${focus.f === 'w' ? 'peso' : 'reps'}`
    : '—';

  return (
    <>
      <PageHeader
        crumb={`Rutina: ${editing ? (sessionRoutineName || 'sin rutina') : (activeRoutine?.name || 'sin rutina activa')}`}
        title={editing ? 'Editar sesión' : 'Registrar sesión'}
      >
        {editing && <AutoSaveStatus status={autoStatus} />}
        <Button onClick={save} disabled={saving || rows.length === 0}>
          {saving ? 'Guardando…' : editing ? 'Guardar y ver récords' : 'Guardar sesión'}
        </Button>
      </PageHeader>

      <PageBody className="grid gap-5 items-start xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 flex flex-col gap-3.5">
          <Card className="p-4 flex flex-wrap items-end gap-4">
            <div className="w-40 shrink-0">
              <Input label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="font-mono" />
            </div>
            <div className="flex-1 basis-56 min-w-0">
              <Select label="Día de plantilla" value={dayId} onChange={(e) => loadDay(e.target.value)}>
                <option value="">Libre (sin plantilla)</option>
                {days.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted cursor-pointer pb-2.5">
              <input
                type="checkbox" checked={badDay} onChange={(e) => setBadDay(e.target.checked)}
                className="accent-accent w-4 h-4"
              />
              Día flojo
            </label>
          </Card>

          {exercises.length === 0 ? (
            <EmptyState title="Sin ejercicios" hint="Crea ejercicios en Plantilla antes de registrar una sesión." />
          ) : (
            <>
              {rows.map((row, ri) => {
                const rowVolume = row.sets.reduce((n, s) => n + setVolume(s), 0);
                const done = row.sets.filter((s) => setVolume(s) > 0).length;
                const rowBest1rm = row.sets.reduce((m, s) => Math.max(m, est1RM(s.weight, s.reps)), 0);
                return (
                  <Card key={ri} className="overflow-hidden">
                    <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                      <span className="grid place-items-center w-6 h-6 shrink-0 rounded-md bg-accent/15
                                       border border-accent/35 font-mono text-xs text-accent">
                        {ri + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <select
                          value={row.exerciseId}
                          onChange={(e) => mutate((next) => { next[ri].exerciseId = e.target.value; })}
                          className="w-full bg-transparent text-base font-semibold text-chalk border-0 p-0
                                     focus:outline-none cursor-pointer hover:text-accent"
                        >
                          {optionsFor(row.exerciseId).map((e) => (
                            <option key={e.id} value={e.id} className="bg-panel">{e.name}</option>
                          ))}
                        </select>
                        <p className="font-mono text-[12px] text-muted">
                          {done}/{row.sets.length} series
                          {row.targetReps ? ` · objetivo ${row.targetReps}` : ''}
                          {rowBest1rm ? ` · 1RM ~${Math.round(rowBest1rm)}kg` : ''}
                        </p>
                      </div>
                      <span className="font-mono text-xs text-muted shrink-0 hidden sm:inline">
                        {rowVolume ? formatVolume(rowVolume) : '—'}
                      </span>
                      <button
                        onClick={() => removeRow(ri)}
                        title="Quitar ejercicio"
                        className="shrink-0 w-7 h-7 rounded-md border border-line text-muted
                                   hover:text-danger hover:border-danger/50"
                      >
                        ×
                      </button>
                    </div>

                    <div className="px-4 pt-2.5 pb-1 grid gap-2 items-center
                                    [grid-template-columns:28px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,64px)_32px]
                                    font-display text-[11px] uppercase tracking-[0.14em] text-muted">
                      <span>#</span><span>Peso kg</span><span>Reps</span>
                      <span className="text-right">Vol</span><span />
                    </div>

                    <div className="px-4 pb-4 flex flex-col gap-1.5">
                      {row.sets.map((s, si) => {
                        const prev = row.sets[si - 1];
                        const best = bests[row.exerciseId];
                        const isPR = best && Number(s.weight || 0) > best && Number(s.reps || 0) > 0;
                        const volume = setVolume(s);
                        return (
                          <div
                            key={si}
                            className="grid gap-2 items-center
                                       [grid-template-columns:28px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,64px)_32px]"
                          >
                            <span className={`text-center font-mono text-[13px] ${isPR ? 'text-accent' : 'text-muted'}`}>
                              {si + 1}
                            </span>
                            <NumCell
                              data-cell={`${ri}-${si}-w`}
                              inputMode="decimal" step="0.25" type="number"
                              placeholder={prev?.weight || '—'}
                              value={s.weight}
                              filled={s.weight !== ''}
                              pr={prCell === `${ri}-${si}`}
                              onFocus={() => setFocus({ r: ri, s: si, f: 'w' })}
                              onChange={(e) => updateSet(ri, si, { weight: e.target.value })}
                              onKeyDown={(e) => onCellKeyDown(e, ri, si, 'w')}
                            />
                            <NumCell
                              data-cell={`${ri}-${si}-r`}
                              inputMode="numeric" type="number"
                              placeholder={prev?.reps || '—'}
                              value={s.reps}
                              filled={s.reps !== ''}
                              onFocus={() => setFocus({ r: ri, s: si, f: 'r' })}
                              onChange={(e) => updateSet(ri, si, { reps: e.target.value })}
                              onKeyDown={(e) => onCellKeyDown(e, ri, si, 'r')}
                            />
                            <span className="text-right font-mono text-[13px] text-muted">
                              {volume ? Math.round(volume) : '·'}
                            </span>
                            <button
                              onClick={() => removeSet(ri, si)}
                              title="Quitar serie"
                              className="text-muted hover:text-danger text-lg leading-none"
                            >
                              −
                            </button>
                          </div>
                        );
                      })}

                      <div className="flex flex-wrap gap-2 mt-1">
                        <Button size="sm" variant="ghost" onClick={() => addSet(ri, false)}>＋ Serie</Button>
                        <Button size="sm" variant="outline" onClick={() => addSet(ri, true)}>Repetir última</Button>
                      </div>
                    </div>
                  </Card>
                );
              })}

              <Button variant="outline" className="w-full py-4" onClick={addExercise}>＋ Añadir ejercicio</Button>

              <Input
                label="Notas"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sensaciones, molestias…"
              />
            </>
          )}
        </div>

        {/* Rail derecho: resumen vivo, pad de ajuste y leyenda de teclado.
            Se queda pegado en pantallas anchas y pasa debajo en las estrechas. */}
        <aside className="min-w-0 flex flex-col gap-3.5 xl:sticky xl:top-[104px]">
          <Card className="p-5 border-accent/35">
            <SectionTitle>Sesión en curso</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="series" value={totals.sets} />
              <Stat label="volumen" value={formatVolume(totals.volume)} />
              <Stat label="récords" value={totals.prs} accent />
              <Stat label="1RM estimado" value={totals.best1rm ? Math.round(totals.best1rm) : '—'} unit={totals.best1rm ? 'kg' : ''} />
            </div>
            <Button className="w-full mt-4" size="lg" onClick={save} disabled={saving || rows.length === 0}>
              {saving ? 'Guardando…' : editing ? 'Guardar y ver récords' : 'Guardar sesión'}
            </Button>
            {editing && (
              <p className="text-xs text-muted text-center mt-2">
                Los cambios se guardan solos. Pulsa solo si quieres ver los récords.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle>Ajuste rápido</SectionTitle>
            <p className="text-[13px] text-muted mb-3">
              Se aplica a la celda con el cursor: <span className="text-chalk font-mono">{focusLabel}</span>
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[-5, -2.5, 2.5, 5].map((d) => (
                <button
                  key={d}
                  onClick={() => bump(focus.f === 'w' ? d : Math.sign(d))}
                  className="rounded-lg border border-line bg-panel2 py-2.5 font-mono text-[13px]
                             hover:border-accent/45 hover:text-accent"
                >
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
            </div>
            <Button size="sm" variant="ghost" className="w-full mt-2" onClick={copyPrevious}>
              Copiar serie anterior
            </Button>
          </Card>

          <Card className="p-5">
            <SectionTitle>Teclado</SectionTitle>
            <div className="flex flex-col gap-2.5 text-[13px] text-muted">
              <div className="flex items-center justify-between gap-3"><span>Peso → reps → serie nueva</span><Kbd>Enter</Kbd></div>
              <div className="flex items-center justify-between gap-3"><span>Subir / bajar de serie</span><Kbd>↑ ↓</Kbd></div>
              <div className="flex items-center justify-between gap-3"><span>Sumar / restar 2.5 kg</span><Kbd>+ −</Kbd></div>
              <div className="flex items-center justify-between gap-3"><span>Repetir serie anterior</span><Kbd>⌘ D</Kbd></div>
            </div>
          </Card>

          <Panel className="p-4">
            <p className="text-xs text-muted">
              Los huecos vacíos muestran en gris lo que hiciste en la serie anterior: pulsa
              {' '}<Kbd>Enter</Kbd>{' '} para heredarlo y seguir.
            </p>
          </Panel>
        </aside>
      </PageBody>
    </>
  );
}

function AutoSaveStatus({ status }) {
  const map = {
    idle: { text: '', cls: '' },
    dirty: { text: 'Sin guardar…', cls: 'text-muted' },
    saving: { text: 'Guardando…', cls: 'text-muted' },
    saved: { text: 'Guardado ✓', cls: 'text-ok' },
    error: { text: 'Error al guardar', cls: 'text-danger' },
  };
  const { text, cls } = map[status] || map.idle;
  if (!text) return null;
  return <span className={`font-mono text-xs border border-line rounded-lg px-2.5 py-1.5 bg-panel ${cls}`}>{text}</span>;
}

function recordLabel(type) {
  switch (type) {
    case 'MAX_WEIGHT': return 'Peso máximo';
    case 'BEST_VOLUME': return 'Mejor volumen';
    case 'ESTIMATED_1RM': return '1RM estimado';
    default: return type;
  }
}
