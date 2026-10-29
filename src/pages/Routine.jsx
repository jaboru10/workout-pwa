import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as store from '../data/store';
import { activeRoutine, byId, routineDays, useAppState } from '../data/store';
import { MUSCLE_GROUPS, ROLES, WEEKDAYS, normName } from '../data/schema';
import { PRESETS, presetStats } from '../data/presets';
import {
  Badge, Button, Card, EmptyState, IconButton, Input, Label, Loading, SectionTitle, Segmented, Select, Sheet, TextArea, Toggle, toast,
} from '../components/ui';
import { PageBody, PageHeader } from '../components/Shell';
import ExercisePicker from '../components/ExercisePicker';
import { fmtRest, restFor } from '../logic/targets';
import { unlockAudio } from '../hooks/device';

export default function Routine() {
  const state = useAppState();
  const [tab, setTab] = useState('routine');
  if (!state.ready) return <PageBody><Loading /></PageBody>;
  const routine = activeRoutine(state);
  return (
    <>
      <PageHeader crumb={routine ? 'Rutina activa' : 'Sin rutina activa'} title={routine?.name || 'Rutina'} />
      <PageBody className="flex flex-col gap-4 max-w-3xl">
        <Segmented options={[['routine', 'Días'], ['library', 'Rutinas'], ['exercises', 'Ejercicios']]} value={tab} onChange={setTab} />
        {tab === 'routine' && <RoutineDays state={state} routine={routine} onLibrary={() => setTab('library')} />}
        {tab === 'library' && <Library state={state} routine={routine} />}
        {tab === 'exercises' && <Exercises state={state} />}
      </PageBody>
    </>
  );
}

/* ----------------------------- Días ----------------------------- */

function RoutineDays({ state, routine, onLibrary }) {
  const navigate = useNavigate();
  const [newDay, setNewDay] = useState('');
  const [rename, setRename] = useState(false);
  const exMap = useMemo(() => byId(state.exercises), [state.exercises]);
  if (!routine) {
    return <EmptyState title="Sin rutina" hint="Carga la F1 (la que haces ahora) o la F2 desde Rutinas." action={<Button onClick={onLibrary}>Elegir rutina</Button>} />;
  }
  const days = routineDays(state, routine.id);
  const totalSets = days.reduce((n, d) => n + d.exercises.reduce((m, e) => m + (Number(e.sets) || 0), 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <Card className="p-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{routine.name}</p>
          <p className="text-xs text-muted">{[routine.level, routine.type].filter(Boolean).join(' · ') || 'Sin clasificar'} · {days.length} días · {totalSets} series/semana</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setRename(true)}>Renombrar</Button>
      </Card>

      {days.map((d, i) => {
        const sets = d.exercises.reduce((n, e) => n + (Number(e.sets) || 0), 0);
        return (
          <Card key={d.id} className="flex items-stretch">
            <button type="button" onClick={() => navigate(`/rutina/dia/${d.id}`)} className="flex-1 min-w-0 text-left p-4">
              <div className="flex items-center gap-2 mb-1">
                {d.weekday ? <Badge tone="accent">{WEEKDAYS[d.weekday - 1].name}</Badge> : <Badge>Sin día fijo</Badge>}
              </div>
              <p className="font-semibold">{d.name}</p>
              <p className="text-xs text-muted mt-0.5">{d.exercises.length} ejercicios · {sets} series</p>
              <p className="text-xs text-muted/80 mt-1 line-clamp-2">
                {[...d.exercises].sort((a, b) => a.order - b.order).map((e) => exMap[e.exerciseId]?.name).filter(Boolean).join(' · ')}
              </p>
            </button>
            <div className="flex flex-col justify-center gap-1.5 pr-3">
              <IconButton label="Subir día" disabled={i === 0} onClick={() => store.moveDay(d.id, -1)} className="w-9 h-9">↑</IconButton>
              <IconButton label="Bajar día" disabled={i === days.length - 1} onClick={() => store.moveDay(d.id, 1)} className="w-9 h-9">↓</IconButton>
            </div>
          </Card>
        );
      })}

      <Card className="p-4 flex gap-2 items-end">
        <div className="flex-1"><Input label="Nuevo día" placeholder="Ej.: Empuje C" value={newDay} onChange={(e) => setNewDay(e.target.value)} /></div>
        <Button onClick={() => {
          if (!newDay.trim()) return;
          const d = store.addDay(routine.id, { name: newDay });
          setNewDay('');
          navigate(`/rutina/dia/${d.id}`);
        }}>Añadir</Button>
      </Card>

      <RenameRoutine open={rename} routine={routine} onClose={() => setRename(false)} />
    </div>
  );
}

function RenameRoutine({ open, routine, onClose }) {
  const [name, setName] = useState(routine.name);
  const [level, setLevel] = useState(routine.level || '');
  const [type, setType] = useState(routine.type || '');
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Rutina"
      footer={<Button className="flex-1" onClick={() => { store.updateRoutine(routine.id, { name: name.trim() || routine.name, level: level || null, type: type || null }); onClose(); }}>Guardar</Button>}
    >
      <div className="flex flex-col gap-3">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="Nivel" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">—</option>{['Principiante', 'Intermedio', 'Avanzado'].map((l) => <option key={l}>{l}</option>)}
        </Select>
        <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">—</option>{['Fuerza', 'Hipertrofia', 'Híbrido'].map((l) => <option key={l}>{l}</option>)}
        </Select>
      </div>
    </Sheet>
  );
}

/* --------------------------- Biblioteca --------------------------- */

function Library({ state, routine }) {
  const [name, setName] = useState('');
  const mine = state.routines.filter((r) => !r.archived);

  function load(p) {
    const already = state.routines.find((r) => r.sourcePresetId === p.id && !r.archived);
    if (already && !confirm(`Ya tienes una copia de «${p.name}». ¿Crear otra copia nueva?`)) return;
    const r = store.loadPreset(p.id);
    toast(`«${r.name}» cargada y activa`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <SectionTitle>Mis rutinas</SectionTitle>
        {mine.length === 0 ? <p className="text-sm text-muted">Todavía no tienes ninguna.</p> : (
          <div className="flex flex-col">
            {mine.map((r) => (
              <div key={r.id} className="flex items-center gap-3 min-h-[56px] border-b border-line last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted">{routineDays(state, r.id).length} días</p>
                </div>
                {routine?.id === r.id ? <Badge tone="ok">Activa</Badge> : (
                  <Button size="sm" variant="ghost" onClick={() => { store.activateRoutine(r.id); toast(`Activa: ${r.name}`); }}>Activar</Button>
                )}
                <Button size="sm" variant="plain" onClick={() => { if (confirm(`¿Archivar «${r.name}»? El historial no se borra.`)) store.archiveRoutine(r.id); }}>Archivar</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle>Cargar rutina predefinida</SectionTitle>
        <div className="flex flex-col gap-2.5">
          {PRESETS.map((p) => {
            const st = presetStats(p);
            return (
              <button key={p.id} type="button" onClick={() => load(p)}
                className={`text-left rounded-2xl border p-3.5 active:scale-[0.99] ${p.featured ? 'border-accent/45 bg-accent/5' : 'border-line bg-panel2'}`}>
                <div className="flex items-center gap-2">
                  <p className="font-semibold flex-1 min-w-0 truncate">{p.name}</p>
                  {p.featured && <Badge tone="accent">Tuya</Badge>}
                </div>
                {p.description && <p className="text-xs text-muted mt-0.5">{p.description}</p>}
                <p className="font-mono text-[11px] text-muted mt-1">{[p.level, p.type].filter(Boolean).join(' · ')} · {st.days} días · {st.sets} series</p>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted mt-3">Se crea una copia tuya y se activa. Los ejercicios con el mismo nombre se reutilizan, así el historial y los récords se mantienen entre rutinas.</p>
      </Card>

      <Card className="p-4 flex gap-2 items-end">
        <div className="flex-1"><Input label="Rutina vacía" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <Button onClick={() => { if (!name.trim()) return; store.createRoutine({ name }); setName(''); toast('Rutina creada y activa'); }}>Crear</Button>
      </Card>
    </div>
  );
}

/* --------------------------- Ejercicios --------------------------- */

function Exercises({ state }) {
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const [picker, setPicker] = useState(false);
  const list = state.exercises
    .filter((e) => e.active && (!q || normName(`${e.name} ${e.muscleGroup}`).includes(normName(q))))
    .sort((a, b) => (a.muscleGroup || 'zz').localeCompare(b.muscleGroup || 'zz', 'es') || a.name.localeCompare(b.name, 'es'));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="flex-1"><Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Button onClick={() => setPicker(true)}>＋ Nuevo</Button>
      </div>
      {list.length === 0 ? <EmptyState title="Sin ejercicios" hint="Se crean al cargar una rutina o desde aquí." /> : (
        <Card className="px-4">
          {list.map((e) => (
            <button key={e.id} type="button" onClick={() => setEdit(e)} className="w-full flex items-center gap-3 min-h-[56px] border-b border-line last:border-0 text-left">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] truncate">{e.name}</span>
                <span className="block text-xs text-muted">{e.muscleGroup || 'Sin grupo'} · +{e.increment} kg{e.bodyweight ? ' · peso corporal' : ''}</span>
              </span>
              <span className="text-muted">›</span>
            </button>
          ))}
        </Card>
      )}
      <ExerciseEditor exercise={edit} onClose={() => setEdit(null)} />
      <ExercisePicker open={picker} title="Nuevo ejercicio" onClose={() => setPicker(false)} onPick={(e) => setEdit(e)} />
    </div>
  );
}

function ExerciseEditor({ exercise, onClose }) {
  const [draft, setDraft] = useState(null);
  const open = Boolean(exercise);
  const d = draft && draft.id === exercise?.id ? draft : exercise;
  if (!open) return null;
  const set = (patch) => setDraft({ ...d, ...patch });
  return (
    <Sheet
      open={open}
      onClose={() => { setDraft(null); onClose(); }}
      title="Ejercicio"
      footer={(
        <>
          <Button variant="danger" onClick={() => { if (confirm('¿Archivar este ejercicio? Su historial se conserva.')) { store.archiveExercise(exercise.id); setDraft(null); onClose(); } }}>Archivar</Button>
          <Button className="flex-1" onClick={() => {
            store.updateExercise(exercise.id, { name: d.name.trim() || exercise.name, muscleGroup: d.muscleGroup, bodyweight: d.bodyweight, increment: Number(d.increment) > 0 ? Number(d.increment) : exercise.increment, notes: d.notes });
            setDraft(null); onClose();
          }}>Guardar</Button>
        </>
      )}
    >
      <div className="flex flex-col gap-3">
        <Input label="Nombre" value={d.name} onChange={(e) => set({ name: e.target.value })} />
        <Select label="Grupo muscular" value={d.muscleGroup || ''} onChange={(e) => set({ muscleGroup: e.target.value })}>
          <option value="">Sin grupo</option>
          {MUSCLE_GROUPS.map((m) => <option key={m}>{m}</option>)}
        </Select>
        <Input label="Incremento de peso (kg)" inputMode="decimal" value={String(d.increment ?? '')} onChange={(e) => set({ increment: e.target.value.replace(',', '.') })}
          hint="Lo que sube la sugerencia cuando completas el rango (mancuernas 2, barra 2,5…)." />
        <Toggle checked={d.bodyweight} onChange={(v) => set({ bodyweight: v })} label="Peso corporal" hint="El peso que apuntes es el lastre." />
        <TextArea label="Notas fijas" value={d.notes || ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Ajuste de la máquina, agarre…" />
      </div>
    </Sheet>
  );
}

/* --------------------------- Editor de día --------------------------- */

export function DayEditor() {
  const { id } = useParams();
  const state = useAppState();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(null);
  const [picker, setPicker] = useState(false);
  const day = state.days.find((d) => d.id === id && !d.archived);
  const exMap = useMemo(() => byId(state.exercises), [state.exercises]);

  if (!state.ready) return <PageBody><Loading /></PageBody>;
  if (!day) return (<><PageHeader title="Día" back="/rutina" /><PageBody><EmptyState title="No encontrado" /></PageBody></>);

  const list = [...day.exercises].sort((a, b) => a.order - b.order);
  const sets = list.reduce((n, e) => n + (Number(e.sets) || 0), 0);
  const editing = edit ? list.find((x) => x.id === edit) : null;

  return (
    <>
      <PageHeader crumb="Editar día" title={day.name} back="/rutina" />
      <PageBody className="flex flex-col gap-3 max-w-3xl">
        <Card className="p-4 flex flex-col gap-3">
          <Input label="Nombre" value={day.name} onChange={(e) => store.updateDay(day.id, { name: e.target.value })} />
          <Select label="Día de la semana (para sugerirlo en Hoy)" value={day.weekday || ''} onChange={(e) => store.updateDay(day.id, { weekday: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Sin día fijo</option>
            {WEEKDAYS.map((w) => <option key={w.n} value={w.n}>{w.name}</option>)}
          </Select>
          <p className="font-mono text-xs text-muted">{list.length} ejercicios · {sets} series</p>
        </Card>

        {list.map((de, i) => {
          const ex = exMap[de.exerciseId];
          return (
            <Card key={de.id} className="flex items-stretch">
              <button type="button" onClick={() => setEdit(de.id)} className="flex-1 min-w-0 text-left p-3.5">
                <p className="font-medium leading-snug">
                  <span className="font-mono text-accent mr-1.5">{de.superset ? `${de.superset}·` : ''}{i + 1}</span>
                  {ex?.name || 'Ejercicio eliminado'}
                </p>
                <p className="font-mono text-xs text-muted mt-1">
                  {de.sets}×{de.reps || '—'}{de.rir != null && de.rir !== '' ? ` · RIR ${de.rir}` : ''} · {fmtRest(restFor(de, state.config))}
                  {de.role ? ` · ${ROLES[de.role]}` : ''}{de.technique === 'biserie' ? ' · biserie' : ''}
                </p>
                {de.notes && <p className="text-xs text-muted/80 mt-1 line-clamp-2">{de.notes}</p>}
              </button>
              <div className="flex flex-col justify-center gap-1.5 pr-3">
                <IconButton label="Subir" disabled={i === 0} onClick={() => store.moveDayExercise(day.id, de.id, -1)} className="w-9 h-9">↑</IconButton>
                <IconButton label="Bajar" disabled={i === list.length - 1} onClick={() => store.moveDayExercise(day.id, de.id, 1)} className="w-9 h-9">↓</IconButton>
              </div>
            </Card>
          );
        })}

        <Button variant="outline" size="lg" onClick={() => setPicker(true)}>＋ Añadir ejercicio</Button>
        <div className="flex gap-2.5">
          <Button variant="ok" size="lg" className="flex-[2]" onClick={() => {
            unlockAudio();
            const open = store.inProgress(store.getState());
            if (open) toast(`Ya tienes abierta «${open.dayName}»: termínala o descártala antes de empezar otra.`, 'danger');
            else store.startSession(day.id);
            navigate('/entrenar');
          }}>Empezar este día ▶</Button>
          <Button variant="danger" size="lg" className="flex-1" onClick={() => { if (confirm('¿Borrar este día de la rutina?')) { store.removeDay(day.id); navigate('/rutina'); } }}>Borrar</Button>
        </div>
      </PageBody>

      <DayExerciseSheet
        key={editing?.id || 'none'}
        open={Boolean(editing)}
        de={editing}
        exercise={editing ? exMap[editing.exerciseId] : null}
        onClose={() => setEdit(null)}
        onSave={(patch) => { store.updateDayExercise(day.id, editing.id, patch); setEdit(null); }}
        onRemove={() => { store.removeDayExercise(day.id, editing.id); setEdit(null); }}
      />
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(e) => store.addDayExercise(day.id, e.id)} />
    </>
  );
}

function DayExerciseSheet({ open, de, exercise, onClose, onSave, onRemove }) {
  const [d, setD] = useState(() => (de ? { ...de, restSec: de.restSec ?? '' } : null));
  if (!open || !d) return null;
  const set = (patch) => setD({ ...d, ...patch });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={exercise?.name || 'Ejercicio'}
      footer={(
        <>
          <Button variant="danger" onClick={() => { if (confirm('¿Quitar este ejercicio del día?')) onRemove(); }}>Quitar</Button>
          <Button className="flex-1" onClick={() => onSave({
            sets: Math.max(1, Number(d.sets) || 1),
            reps: String(d.reps || '').trim(),
            rir: String(d.rir ?? '').trim() === '' ? null : String(d.rir).trim(),
            restSec: Number(d.restSec) > 0 ? Number(d.restSec) : null,
            role: d.role || null,
            superset: d.superset ? String(d.superset).toUpperCase().slice(0, 1) : null,
            technique: d.technique || 'normal',
            notes: d.notes || '',
          })}>Guardar</Button>
        </>
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Series" inputMode="numeric" value={String(d.sets ?? '')} onChange={(e) => set({ sets: e.target.value.replace(/\D/g, '') })} />
          <Input label="Reps" value={d.reps ?? ''} onChange={(e) => set({ reps: e.target.value })} hint="5-8 · 10 · 15+15 · máx" />
          <Input label="RIR objetivo" value={d.rir ?? ''} onChange={(e) => set({ rir: e.target.value })} hint="0 · 1-2" />
          <Input label="Descanso (s)" inputMode="numeric" value={String(d.restSec ?? '')} onChange={(e) => set({ restSec: e.target.value.replace(/\D/g, '') })} hint="Vacío = según rol" />
        </div>
        <div>
          <Label>Rol</Label>
          <Segmented options={[['', '—'], ['F', 'Fuerza'], ['H', 'Hipertrofia'], ['A', 'Accesorio']]} value={d.role || ''} onChange={(v) => set({ role: v || null })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Superserie" value={d.superset || ''} onChange={(e) => set({ superset: e.target.value || null })}>
            <option value="">No</option>{['A', 'B', 'C', 'D'].map((l) => <option key={l} value={l}>Grupo {l}</option>)}
          </Select>
          <Select label="Técnica" value={d.technique || 'normal'} onChange={(e) => set({ technique: e.target.value })}>
            <option value="normal">Normal</option>
            <option value="biserie">Biserie (serie + drop)</option>
          </Select>
        </div>
        <p className="text-xs text-muted">Superserie: los ejercicios seguidos con la misma letra se alternan y el descanso va después del último.</p>
        <TextArea label="Notas" value={d.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
      </div>
    </Sheet>
  );
}
