import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Card, EmptyState } from '../components/ui';

const WINDOWS = [
  { label: '3 meses', value: 3 },
  { label: '6 meses', value: 6 },
  { label: '1 año', value: 12 },
  { label: 'Histórico', value: 0 },
];

export default function Records() {
  const [exercises, setExercises] = useState([]);
  const [exId, setExId] = useState('');
  const [windowM, setWindowM] = useState(6);
  const [position, setPosition] = useState(''); // '' = cualquiera
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    api.listExercises()
      .then((e) => {
        setExercises(e);
        if (e.length) setExId(e[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!exId) return;
    setFetching(true);
    api.records(exId, windowM, position === '' ? undefined : Number(position))
      .then(setRecords)
      .catch(() => setRecords([]))
      .finally(() => setFetching(false));
  }, [exId, windowM, position]);

  if (loading) return <div className="px-5 pt-8"><p className="text-muted font-body">Cargando…</p></div>;

  if (exercises.length === 0) {
    return (
      <div className="px-5 pt-8">
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight mb-5">Récords</h1>
        <EmptyState title="Sin datos" hint="Crea ejercicios y registra sesiones para ver récords." />
      </div>
    );
  }

  const maxWeight = records.find((r) => r.type === 'MAX_WEIGHT' && !r.repRangeName);
  const bestVolume = records.find((r) => r.type === 'BEST_VOLUME');
  const best1rm = records.find((r) => r.type === 'ESTIMATED_1RM');
  const byRange = records.filter((r) => r.repRangeName);

  return (
    <div className="px-5 pt-8">
      <h1 className="font-display text-4xl font-bold uppercase tracking-tight mb-5">Récords</h1>

      {/* Selector de ejercicio */}
      <select value={exId} onChange={(e) => setExId(e.target.value)}
              className="w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-chalk font-body mb-3 focus:outline-none focus:border-volt/60">
        {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>

      {/* Ventana temporal */}
      <div className="flex gap-1.5 mb-3">
        {WINDOWS.map((w) => (
          <button key={w.value} onClick={() => setWindowM(w.value)}
                  className={`flex-1 py-2 rounded-lg text-xs font-body font-semibold transition-colors ${
                    windowM === w.value ? 'bg-volt text-ink' : 'bg-panel2 text-muted'
                  }`}>
            {w.label}
          </button>
        ))}
      </div>

      {/* Posición de fatiga */}
      <label className="block mb-5">
        <span className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-body">
          Posición en la sesión (fatiga)
        </span>
        <select value={position} onChange={(e) => setPosition(e.target.value)}
                className="w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-chalk font-body focus:outline-none focus:border-volt/60">
          <option value="">Cualquier posición</option>
          {[1, 2, 3, 4, 5, 6].map((p) => <option key={p} value={p}>Como {p}º ejercicio</option>)}
        </select>
      </label>

      {fetching ? (
        <p className="text-muted font-body">Calculando…</p>
      ) : records.length === 0 ? (
        <EmptyState title="Sin récords" hint="No hay datos para este filtro." />
      ) : (
        <div className="space-y-3">
          {/* Los 3 récords principales, destacados */}
          <div className="grid grid-cols-3 gap-2">
            <BigStat label="Peso máx" value={maxWeight?.weight} unit="kg" sub={maxWeight ? `×${maxWeight.reps}` : ''} />
            <BigStat label="1RM est." value={best1rm?.value} unit="kg" sub="" />
            <BigStat label="Volumen" value={bestVolume?.value} unit="" sub={bestVolume ? `${bestVolume.weight}×${bestVolume.reps}` : ''} />
          </div>

          {/* Récords por rango de reps */}
          {byRange.length > 0 && (
            <Card className="p-4">
              <p className="text-xs uppercase tracking-widest text-muted font-body mb-3">Por rango de reps</p>
              <div className="space-y-2">
                {byRange.map((r, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="font-body text-sm">{r.repRangeName}</span>
                    <span className="font-display text-xl">
                      {r.weight}<span className="text-muted text-sm">kg × {r.reps}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {maxWeight?.date && (
            <p className="text-muted text-xs font-body text-center">
              Peso máximo logrado el {new Date(maxWeight.date).toLocaleDateString('es-ES')}
              {maxWeight.routineName && ` · rutina ${maxWeight.routineName}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BigStat({ label, value, unit, sub }) {
  return (
    <Card className="p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted font-body">{label}</p>
      <p className="font-display text-3xl text-volt leading-tight mt-1">
        {value != null ? Number(value).toFixed(value % 1 === 0 ? 0 : 1) : '—'}
      </p>
      <p className="text-[10px] text-muted font-mono">{unit} {sub}</p>
    </Card>
  );
}
