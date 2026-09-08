import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { Card, EmptyState, Loading, Label, SectionTitle, Stat } from '../components/ui';
import { PageBody, PageHeader } from '../components/Shell';
import { formatDate } from '../utils/dates';
import { rmSeries, short } from '../utils/metrics';

const WINDOWS = [
  { label: '3M', value: 3 },
  { label: '6M', value: 6 },
  { label: '1A', value: 12 },
  { label: 'Todo', value: 0 },
];

export default function Records() {
  const [exercises, setExercises] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [exId, setExId] = useState('');
  const [windowM, setWindowM] = useState(6);
  const [position, setPosition] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    Promise.all([api.listExercises(), api.listSessions()])
      .then(([e, s]) => {
        setExercises(e);
        setSessions(s);
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

  // La curva de 1RM estimado sale de las sesiones ya cargadas: sin endpoint nuevo.
  const series = useMemo(() => rmSeries(sessions, exId, windowM), [sessions, exId, windowM]);

  if (loading) return <PageBody><Loading /></PageBody>;

  if (exercises.length === 0) {
    return (
      <>
        <PageHeader title="Progreso" />
        <PageBody>
          <EmptyState title="Sin datos" hint="Crea ejercicios y registra sesiones para ver récords y progreso." />
        </PageBody>
      </>
    );
  }

  const maxWeight = records.find((r) => r.type === 'MAX_WEIGHT' && !r.repRangeName);
  const bestVolume = records.find((r) => r.type === 'BEST_VOLUME');
  const best1rm = records.find((r) => r.type === 'ESTIMATED_1RM');
  const byRange = records.filter((r) => r.repRangeName);

  const first = series[0]?.value || 0;
  const last = series[series.length - 1]?.value || 0;
  const delta = last - first;

  return (
    <>
      <PageHeader crumb="Récords y evolución" title="Progreso">
        <select
          value={exId}
          onChange={(e) => setExId(e.target.value)}
          className="bg-panel2 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
        >
          {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <div className="flex gap-1 bg-panel2 border border-line rounded-xl p-1">
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              onClick={() => setWindowM(w.value)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
                windowM === w.value ? 'bg-accent text-accentInk' : 'text-muted hover:text-chalk'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <PageBody className="flex flex-col gap-5">
        <Card className="p-6 min-w-0">
          <SectionTitle
            right={
              series.length > 1 && (
                <span className={`font-mono text-xs ${delta >= 0 ? 'text-ok' : 'text-danger'}`}>
                  {delta >= 0 ? '+' : ''}{short(delta)} kg en el periodo
                </span>
              )
            }
          >
            1RM estimado · {exercises.find((e) => e.id === exId)?.name}
          </SectionTitle>

          {series.length < 2 ? (
            <p className="text-sm text-muted py-8 text-center">
              Hacen falta al menos dos sesiones con este ejercicio en el periodo elegido.
            </p>
          ) : (
            <RMChart points={series} />
          )}
        </Card>

        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          <Card className="p-5">
            <SectionTitle>Peso máximo</SectionTitle>
            <Stat
              accent
              label={maxWeight?.date ? formatDate(maxWeight.date, { day: 'numeric', month: 'short', year: 'numeric' }) : 'sin datos'}
              value={maxWeight ? short(maxWeight.weight) : '—'}
              unit={maxWeight ? 'kg' : ''}
              sub={maxWeight ? `×${maxWeight.reps}` : ''}
            />
          </Card>
          <Card className="p-5">
            <SectionTitle>1RM estimado</SectionTitle>
            <Stat accent label="mejor del periodo" value={best1rm ? short(best1rm.value) : '—'} unit={best1rm ? 'kg' : ''} />
          </Card>
          <Card className="p-5">
            <SectionTitle>Mejor volumen</SectionTitle>
            <Stat
              label="serie única"
              value={bestVolume ? Math.round(bestVolume.value) : '—'}
              sub={bestVolume ? `${short(bestVolume.weight)}×${bestVolume.reps}` : ''}
            />
          </Card>
          <Card className="p-5">
            <SectionTitle>Sesiones con el ejercicio</SectionTitle>
            <Stat label="en el periodo" value={series.length} />
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-2 items-start">
          <Card className="p-6 min-w-0">
            <SectionTitle>Filtrar por fatiga</SectionTitle>
            <Label>Posición en la sesión</Label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-[15px]
                         focus:outline-none focus:border-accent"
            >
              <option value="">Cualquier posición</option>
              {[1, 2, 3, 4, 5, 6].map((p) => <option key={p} value={p}>Como {p}º ejercicio</option>)}
            </select>
            <p className="text-xs text-muted mt-2.5">
              Compara tus marcas cuando el ejercicio va primero contra cuando llega con fatiga acumulada.
            </p>
            {fetching && <p className="font-mono text-xs text-muted mt-3">Calculando…</p>}
          </Card>

          <Card className="p-6 min-w-0">
            <SectionTitle>Por rango de reps</SectionTitle>
            {byRange.length === 0 ? (
              <p className="text-sm text-muted">Sin récords por rango para este filtro.</p>
            ) : (
              <div className="flex flex-col">
                {byRange.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2.5 border-b border-line last:border-0">
                    <span className="text-sm">{r.repRangeName}</span>
                    <span className="font-mono text-lg font-bold">
                      {short(r.weight)}<span className="text-xs text-muted font-normal">kg × {r.reps}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}

// Línea de 1RM estimado. SVG con viewBox: escala con el contenedor sin JS.
function RMChart({ points }) {
  const values = points.map((p) => p.value);
  const lo = Math.min(...values) * 0.97;
  const hi = Math.max(...values) * 1.03;
  const W = 800, H = 240;
  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * W,
    y: H - ((p.value - lo) / (hi - lo || 1)) * (H - 20) - 10,
    ...p,
  }));
  const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');

  return (
    <div className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[240px] block overflow-visible">
        {[10, 85, 160, 230].map((y) => (
          <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#2b3140" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={`${line} L${W} ${H} L0 ${H} Z`} fill="rgba(169,123,255,0.14)" />
        <path
          d={line} fill="none" stroke="#a97bff" strokeWidth="2.5"
          strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        />
        {coords.map((c, i) => (
          <circle
            key={i} cx={c.x} cy={c.y} r="4" fill="#12151c" stroke="#a97bff" strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="flex justify-between mt-2.5 font-mono text-[10px] text-muted gap-1">
        {coords.map((c, i) => (
          <span key={i} className="truncate" title={`${formatDate(c.date)} · ${short(c.value)} kg`}>
            {formatDate(c.date, { day: 'numeric', month: 'short' })}
          </span>
        ))}
      </div>
    </div>
  );
}
