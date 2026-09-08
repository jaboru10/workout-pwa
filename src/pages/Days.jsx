import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import {
  Button, Card, EmptyState, Input, Label, Loading, Panel, SectionTitle, Select,
} from '../components/ui';
import { PageBody, PageHeader } from '../components/Shell';

const TABS = [['routines', 'Rutinas'], ['days', 'Días'], ['exercises', 'Ejercicios']];

export default function Days() {
  const [tab, setTab] = useState('routines');
  const [routines, setRoutines] = useState([]);
  const [active, setActive] = useState(null);
  const [days, setDays] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [r, a, d, e] = await Promise.all([
      api.listRoutines(),
      api.activeRoutine(),
      api.listDays(),
      api.listExercises(),
    ]);
    setRoutines(r); setActive(a); setDays(d); setExercises(e);
  }

  useEffect(() => { reload().catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <>
      <PageHeader crumb={active ? `${active.name} · rutina activa` : 'Sin rutina activa'} title="Plantilla">
        <div className="flex gap-1 bg-panel2 border border-line rounded-xl p-1">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                tab === key ? 'bg-accent text-accentInk' : 'text-muted hover:text-chalk'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </PageHeader>

      <PageBody>
        {loading ? <Loading /> : tab === 'routines' ? (
          <RoutinesTab routines={routines} active={active} onChange={reload} />
        ) : tab === 'days' ? (
          <DaysTab days={days} exercises={exercises} active={active} onChange={reload} />
        ) : (
          <ExercisesTab exercises={exercises} onChange={reload} />
        )}
      </PageBody>
    </>
  );
}

/* ---------- Rutinas (IL-004) ---------- */
const LEVELS = ['Principiante', 'Intermedio', 'Avanzado'];
const TYPES = ['Fuerza', 'Hipertrofia', 'Híbrido'];

function RoutinesTab({ routines, active, onChange }) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('Principiante');
  const [type, setType] = useState('Fuerza');
  const [saving, setSaving] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createRoutine({ name: name.trim(), level, type });
      setName('');
      await onChange();
    } finally { setSaving(false); }
  }

  async function activate(id) { await api.activateRoutine(id); await onChange(); }

  async function remove(id) {
    if (!confirm('¿Archivar esta rutina? Sus días y el historial no se borran.')) return;
    await api.deleteRoutine(id);
    await onChange();
  }

  return (
    <div className="grid gap-5 items-start xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="flex flex-col gap-5 min-w-0">
        <Card className="p-5 flex flex-col gap-3.5">
          <SectionTitle>Nueva rutina</SectionTitle>
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Push/Pull/Legs" />
          <div className="flex gap-3">
            <Select label="Nivel" value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
            <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <Button onClick={create} disabled={saving}>Crear desde cero</Button>
          <Button variant="ghost" onClick={() => setShowPresets((v) => !v)}>
            {showPresets ? 'Ocultar predefinidas' : 'Explorar predefinidas'}
          </Button>
        </Card>

        {showPresets && <PresetsList onUsed={onChange} />}
      </div>

      <div className="min-w-0">
        {routines.length === 0 ? (
          <EmptyState title="Sin rutinas" hint="Crea una desde cero o copia una predefinida." />
        ) : (
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
            {routines.map((r) => {
              const isActive = active?.id === r.id;
              return (
                <Panel
                  key={r.id}
                  className={`p-4 flex flex-col gap-3 min-w-0 ${isActive ? 'border-accent/45 bg-accent/10' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold flex items-center gap-2 min-w-0">
                      <span className="truncate">{r.name}</span>
                      {isActive && (
                        <span className="shrink-0 font-display text-[10px] uppercase tracking-[0.12em]
                                         text-accentInk bg-accent rounded px-1.5 py-0.5">
                          Activa
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {[r.level, r.type].filter(Boolean).join(' · ') || 'Sin clasificar'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-auto">
                    {!isActive && (
                      <button onClick={() => activate(r.id)} className="text-[13px] text-muted hover:text-accent">
                        Activar
                      </button>
                    )}
                    <button onClick={() => remove(r.id)} className="text-[13px] text-muted hover:text-danger">
                      Archivar
                    </button>
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Buscador en cascada de 3 escalones: Nivel → Tipo → Rutina.
function PresetsList({ onUsed }) {
  const [presets, setPresets] = useState(null);
  const [busy, setBusy] = useState('');
  const [selLevel, setSelLevel] = useState(null);
  const [selType, setSelType] = useState(null);

  useEffect(() => { api.listPresets().then(setPresets).catch(() => setPresets([])); }, []);

  async function use(id) {
    setBusy(id);
    try { await api.usePreset(id); await onUsed(); } finally { setBusy(''); }
  }

  if (presets === null) return <Loading what="Cargando predefinidas" />;
  if (presets.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted">
          Aún no hay predefinidas cargadas. Se cargan por script de seed en la base de datos.
        </p>
      </Card>
    );
  }

  const levelOrder = ['Principiante', 'Intermedio', 'Avanzado'];
  const levels = levelOrder.filter((l) => presets.some((p) => p.level === l));
  const typesForLevel = (lvl) => [...new Set(presets.filter((p) => p.level === lvl && p.type).map((p) => p.type))];
  const routinesFor = (lvl, t) => presets.filter((p) => p.level === lvl && p.type === t);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-1.5 text-xs mb-3.5">
        <button
          onClick={() => { setSelLevel(null); setSelType(null); }}
          className={selLevel ? 'text-muted hover:text-chalk' : 'text-accent'}
        >
          Predefinidas
        </button>
        {selLevel && (
          <>
            <span className="text-muted">›</span>
            <button onClick={() => setSelType(null)} className={selType ? 'text-muted hover:text-chalk' : 'text-accent'}>
              {selLevel}
            </button>
          </>
        )}
        {selType && (<><span className="text-muted">›</span><span className="text-accent">{selType}</span></>)}
      </div>

      {!selLevel && (
        <div className="flex flex-col gap-2">
          <Label>Elige nivel</Label>
          {levels.map((l) => (
            <button
              key={l}
              onClick={() => setSelLevel(l)}
              className="flex items-center justify-between gap-3 rounded-lg bg-panel2 border border-line
                         px-3.5 py-2.5 hover:border-accent/45 hover:text-accent"
            >
              <span className="text-sm">{l}</span>
              <span className="font-mono text-xs text-muted">{presets.filter((p) => p.level === l).length} rutinas ›</span>
            </button>
          ))}
        </div>
      )}

      {selLevel && !selType && (
        <div className="flex flex-col gap-2">
          <Label>Elige tipo</Label>
          {typesForLevel(selLevel).map((t) => (
            <button
              key={t}
              onClick={() => setSelType(t)}
              className="flex items-center justify-between gap-3 rounded-lg bg-panel2 border border-line
                         px-3.5 py-2.5 hover:border-accent/45 hover:text-accent"
            >
              <span className="text-sm">{t}</span>
              <span className="font-mono text-xs text-muted">{routinesFor(selLevel, t).length} rutinas ›</span>
            </button>
          ))}
        </div>
      )}

      {selLevel && selType && (
        <div className="flex flex-col gap-2">
          {routinesFor(selLevel, selType).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 border-b border-line pb-2.5 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted">{p.templateDays?.length || 0} días</p>
              </div>
              <button
                onClick={() => use(p.id)}
                disabled={busy === p.id}
                className="text-[13px] text-muted hover:text-accent disabled:opacity-40 shrink-0"
              >
                {busy === p.id ? 'Copiando…' : 'Usar'}
              </button>
            </div>
          ))}
          <p className="text-[11px] text-muted mt-2">
            Al usar una predefinida se crea una copia personal modificable y se activa. La original queda intacta.
          </p>
        </div>
      )}
    </Card>
  );
}

/* ---------- Ejercicios ---------- */
function ExercisesTab({ exercises, onChange }) {
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState('');
  const [bodyweight, setBodyweight] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createExercise({ name: name.trim(), muscleGroup: muscle.trim(), bodyweight });
      setName(''); setMuscle(''); setBodyweight(false);
      await onChange();
    } finally { setSaving(false); }
  }

  async function remove(id) { await api.deleteExercise(id); await onChange(); }

  const filtered = exercises.filter((e) =>
    `${e.name} ${e.muscleGroup || ''}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="grid gap-5 items-start xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <Card className="p-5 flex flex-col gap-3.5 min-w-0">
        <SectionTitle>Nuevo ejercicio</SectionTitle>
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Press banca" />
        <Input label="Grupo muscular" value={muscle} onChange={(e) => setMuscle(e.target.value)} placeholder="Pecho" />
        <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
          <input
            type="checkbox" checked={bodyweight} onChange={(e) => setBodyweight(e.target.checked)}
            className="accent-accent w-4 h-4"
          />
          Peso corporal (el peso registrado es el lastre)
        </label>
        <Button onClick={add} disabled={saving}>Añadir ejercicio</Button>
      </Card>

      <div className="min-w-0 flex flex-col gap-3">
        <Input placeholder="Buscar ejercicio…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {filtered.length === 0 ? (
          <EmptyState title="Sin ejercicios" hint="Añade los ejercicios que sueles hacer." />
        ) : (
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            {filtered.map((ex) => (
              <Panel key={ex.id} className="p-3.5 flex items-center justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="font-medium truncate">{ex.name}</p>
                  <p className="text-xs text-muted truncate">
                    {ex.muscleGroup || 'Sin grupo'}{ex.bodyweight ? ' · peso corporal' : ''}
                  </p>
                </div>
                <button onClick={() => remove(ex.id)} className="text-[13px] text-muted hover:text-danger shrink-0">
                  Borrar
                </button>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Días ---------- */
function DaysTab({ days, exercises, active, onChange }) {
  const [newDayName, setNewDayName] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const exMap = useMemo(() => Object.fromEntries(exercises.map((e) => [e.id, e])), [exercises]);
  const selected = days.find((d) => d.id === selectedId) || days[0] || null;

  async function addDay() {
    if (!newDayName.trim()) return;
    await api.createDay({ name: newDayName.trim(), order: days.length + 1, exercises: [] });
    setNewDayName('');
    await onChange();
  }

  async function removeDay(id) {
    if (!confirm('¿Borrar este día de la plantilla?')) return;
    await api.deleteDay(id);
    if (selectedId === id) setSelectedId(null);
    await onChange();
  }

  if (!active) {
    return (
      <EmptyState
        title="Sin rutina activa"
        hint="Activa o crea una rutina en la pestaña Rutinas para añadirle días."
      />
    );
  }

  return (
    <div className="grid gap-5 items-start xl:grid-cols-[300px_minmax(0,1fr)]">
      <Card className="p-5 flex flex-col gap-3.5 min-w-0">
        <SectionTitle>Días de {active.name}</SectionTitle>
        <div className="flex gap-2 items-end">
          <Input
            label="Nuevo día"
            value={newDayName}
            onChange={(e) => setNewDayName(e.target.value)}
            placeholder="Día A · Pecho/Tríceps"
          />
          <Button onClick={addDay} className="shrink-0">Añadir</Button>
        </div>

        {days.length === 0 ? (
          <p className="text-sm text-muted">Crea el primer día de esta rutina.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {days.map((day) => {
              const isSel = selected?.id === day.id;
              return (
                <button
                  key={day.id}
                  onClick={() => setSelectedId(day.id)}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left ${
                    isSel ? 'bg-accent/12 border-accent/45' : 'bg-panel2 border-line hover:border-accent/40'
                  }`}
                >
                  <span className="text-sm font-semibold truncate">{day.name}</span>
                  <span className="font-mono text-xs text-muted shrink-0">
                    {(day.exercises || []).length} ej
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {selected ? (
        <DayEditor
          key={selected.id}
          day={selected}
          exMap={exMap}
          exercises={exercises}
          onChange={onChange}
          onDelete={() => removeDay(selected.id)}
        />
      ) : (
        <EmptyState title="Ningún día" hint="Crea un día para empezar a asignarle ejercicios." />
      )}
    </div>
  );
}

function DayEditor({ day, exercises, exMap, onChange, onDelete }) {
  const [list, setList] = useState(() => [...(day.exercises || [])].sort((a, b) => a.order - b.order));
  const [exId, setExId] = useState('');
  const [sets, setSets] = useState(4);
  const [reps, setReps] = useState('6-8');
  const [saving, setSaving] = useState(false);

  const mutate = (fn) => setList((prev) => {
    const next = prev.map((r) => ({ ...r }));
    fn(next);
    next.forEach((r, i) => (r.order = i + 1));
    return next;
  });

  function addRow() {
    if (!exId) return;
    mutate((next) => next.push({
      exerciseId: exId, order: next.length + 1, targetSets: Number(sets), targetReps: reps, notes: '',
    }));
    setExId('');
  }

  function move(idx, dir) {
    mutate((next) => {
      const j = idx + dir;
      if (j < 0 || j >= next.length) return;
      [next[idx], next[j]] = [next[j], next[idx]];
    });
  }

  async function save() {
    setSaving(true);
    try {
      await api.updateDay(day.id, { ...day, exercises: list });
      await onChange();
    } finally { setSaving(false); }
  }

  const totalSets = list.reduce((n, r) => n + Number(r.targetSets || 0), 0);

  return (
    <Card className="p-6 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <p className="font-display text-[11px] uppercase tracking-[0.16em] text-muted">Editando día</p>
          <p className="mt-1 text-2xl font-bold tracking-[-0.02em] text-balance">{day.name}</p>
          <p className="mt-1 font-mono text-xs text-muted">{list.length} ejercicios · {totalSets} series objetivo</p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="danger" size="sm" onClick={onDelete}>Borrar día</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar día'}</Button>
        </div>
      </div>

      <div className="grid gap-2 px-1 pb-2
                      [grid-template-columns:24px_minmax(64px,1fr)_minmax(0,66px)_minmax(0,86px)_82px]
                      font-display text-[11px] uppercase tracking-[0.14em] text-muted">
        <span>#</span><span>Ejercicio</span><span>Series</span><span>Reps</span>
        <span className="text-right">Orden</span>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted py-4">Sin ejercicios asignados todavía.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {list.map((r, i) => (
            <div
              key={i}
              className="grid gap-2 items-center rounded-xl bg-panel2 border border-line px-2.5 py-2
                         [grid-template-columns:24px_minmax(64px,1fr)_minmax(0,66px)_minmax(0,86px)_82px]"
            >
              <span className="text-center font-mono text-[13px] text-accent">{i + 1}</span>
              <span className="text-sm truncate">{exMap[r.exerciseId]?.name || '—'}</span>
              <input
                value={r.targetSets ?? ''}
                onChange={(e) => mutate((next) => { next[i].targetSets = e.target.value; })}
                inputMode="numeric"
                className="w-full min-w-0 bg-ink border border-line rounded-lg px-2 py-1.5 text-center
                           font-mono text-[13px] focus:outline-none focus:border-accent"
              />
              <input
                value={r.targetReps ?? ''}
                onChange={(e) => mutate((next) => { next[i].targetReps = e.target.value; })}
                className="w-full min-w-0 bg-ink border border-line rounded-lg px-2 py-1.5 text-center
                           font-mono text-[13px] focus:outline-none focus:border-accent"
              />
              <div className="flex gap-1 justify-end">
                {[['↑', -1], ['↓', 1]].map(([glyph, dir]) => (
                  <button
                    key={glyph}
                    onClick={() => move(i, dir)}
                    className="w-6 h-6 rounded-md border border-line text-muted text-xs
                               hover:text-accent hover:border-accent/45"
                  >
                    {glyph}
                  </button>
                ))}
                <button
                  onClick={() => mutate((next) => next.splice(i, 1))}
                  className="w-6 h-6 rounded-md border border-line text-muted text-xs
                             hover:text-danger hover:border-danger/50"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2.5 items-end mt-5 pt-5 border-t border-line">
        <div className="flex-1 basis-52 min-w-0">
          <Select label="Ejercicio" value={exId} onChange={(e) => setExId(e.target.value)}>
            <option value="">Elegir…</option>
            {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        </div>
        <div className="w-20">
          <Input label="Series" value={sets} onChange={(e) => setSets(e.target.value)} inputMode="numeric" className="text-center font-mono" />
        </div>
        <div className="w-24">
          <Input label="Reps" value={reps} onChange={(e) => setReps(e.target.value)} className="text-center font-mono" />
        </div>
        <Button variant="ghost" onClick={addRow}>Añadir</Button>
      </div>
    </Card>
  );
}
