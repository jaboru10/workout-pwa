import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Card, EmptyState, Loading, Panel, SectionTitle, Stat } from '../components/ui';
import { PageBody, PageHeader } from '../components/Shell';
import { formatDate, parseLocalDate, todayLocal } from '../utils/dates';
import { formatVolume, sessionSets, sessionVolume, weeklyVolume } from '../utils/metrics';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [days, setDays] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listSessions(), api.listDays(), api.listExercises(), api.activeRoutine()])
      .then(([s, d, e, r]) => { setSessions(s); setDays(d); setExercises(e); setRoutine(r); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = todayLocal();
  const lastSession = sessions[0];
  const trainedToday = lastSession?.date === today;
  const exMap = useMemo(() => Object.fromEntries(exercises.map((e) => [e.id, e])), [exercises]);
  const weeks = useMemo(() => weeklyVolume(sessions, 10), [sessions]);
  const maxWeekVolume = Math.max(1, ...weeks.map((w) => w.volume));

  // Días de la semana actual con sesión registrada.
  const trainedThisWeek = useMemo(() => {
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const flags = [false, false, false, false, false, false, false];
    sessions.forEach((s) => {
      const d = parseLocalDate(s.date);
      if (d && d >= monday) flags[(d.getDay() + 6) % 7] = true;
    });
    return flags;
  }, [sessions]);

  const weekVolume = weeks[weeks.length - 1]?.volume || 0;
  const weekSessions = trainedThisWeek.filter(Boolean).length;

  // Día sugerido: el siguiente de la plantilla tras el último entrenado.
  const suggestedDay = useMemo(() => {
    if (days.length === 0) return null;
    const lastDayId = sessions.find((s) => s.trainingDayId)?.trainingDayId;
    const idx = days.findIndex((d) => d.id === lastDayId);
    return days[(idx + 1) % days.length] || days[0];
  }, [days, sessions]);

  return (
    <>
      <PageHeader
        crumb={new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`Hola, ${user?.username || ''}`}
      >
        <span className="font-mono text-xs text-muted border border-line rounded-lg px-2.5 py-1.5 bg-panel">
          {routine?.name || 'sin rutina activa'}
        </span>
        <Button onClick={() => navigate('/log')}>Registrar sesión</Button>
      </PageHeader>

      <PageBody className="flex flex-col gap-5">
        {loading ? (
          <Loading />
        ) : (
          <>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Card className="p-6 flex flex-col gap-5 min-w-0">
                {trainedToday ? (
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-display text-[11px] uppercase tracking-[0.16em] text-ok">Entreno hecho hoy</p>
                      <p className="mt-1.5 text-[30px] font-bold tracking-[-0.02em] leading-tight">
                        {lastSession.exercises?.length || 0} ejercicios · {sessionSets(lastSession)} series
                      </p>
                      <p className="mt-2 text-sm text-muted">
                        {formatVolume(sessionVolume(lastSession))} de volumen
                        {lastSession.routineName ? ` · ${lastSession.routineName}` : ''}
                      </p>
                    </div>
                    <Button variant="ghost" onClick={() => navigate('/history')}>Ver detalle</Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-display text-[11px] uppercase tracking-[0.16em] text-accent">
                        {suggestedDay ? 'Toca hoy' : 'Sin plantilla'}
                      </p>
                      <p className="mt-1.5 text-[30px] font-bold tracking-[-0.02em] leading-tight text-balance">
                        {suggestedDay ? suggestedDay.name : 'A por ello'}
                      </p>
                      <p className="mt-2 text-sm text-muted">
                        {suggestedDay
                          ? `${suggestedDay.exercises?.length || 0} ejercicios · ${(suggestedDay.exercises || []).reduce((n, e) => n + (e.targetSets || 0), 0)} series objetivo`
                          : 'Crea tus días de entrenamiento para tener sugerencia diaria.'}
                      </p>
                    </div>
                    <Button size="lg" onClick={() => navigate('/log')}>Empezar →</Button>
                  </div>
                )}

                {suggestedDay && (suggestedDay.exercises || []).length > 0 && (
                  <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
                    {[...suggestedDay.exercises].sort((a, b) => a.order - b.order).map((te, i) => (
                      <Panel key={i} className="px-3.5 py-3 flex items-baseline justify-between gap-2.5 min-w-0">
                        <span className="text-sm truncate">{exMap[te.exerciseId]?.name || '—'}</span>
                        <span className="font-mono text-[13px] text-muted shrink-0">
                          {te.targetSets}×{te.targetReps}
                        </span>
                      </Panel>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6 flex flex-col gap-4 min-w-0">
                <SectionTitle>Esta semana</SectionTitle>
                <div className="flex gap-1.5">
                  {WEEKDAYS.map((d, i) => (
                    <div
                      key={d}
                      className={`flex-1 rounded-lg py-2.5 text-center border ${
                        trainedThisWeek[i] ? 'bg-accent/15 border-accent/40' : 'bg-panel2 border-line'
                      }`}
                    >
                      <p className="font-mono text-[11px] text-muted">{d}</p>
                      <p className={`mt-0.5 text-sm font-semibold ${trainedThisWeek[i] ? 'text-accent' : 'text-muted'}`}>
                        {trainedThisWeek[i] ? '●' : '·'}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="h-px bg-line" />
                <div className="grid grid-cols-2 gap-4">
                  <Stat label="sesiones" value={weekSessions} />
                  <Stat label="volumen" value={formatVolume(weekVolume)} />
                </div>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card className="p-6 min-w-0">
                <SectionTitle
                  right={<span className="font-mono text-xs text-muted">{formatVolume(maxWeekVolume)} máx</span>}
                >
                  Volumen semanal · 10 semanas
                </SectionTitle>
                <div className="flex items-end gap-2 h-[150px]">
                  {weeks.map((w, i) => (
                    <div key={w.key} className="flex-1 min-w-0 h-full flex flex-col justify-end gap-2">
                      <div
                        title={`${w.label} · ${formatVolume(w.volume)}`}
                        style={{ height: `${Math.max(2, (w.volume / maxWeekVolume) * 100)}%` }}
                        className={`rounded-t-md border-t-2 ${
                          i === weeks.length - 1 ? 'bg-accent/20 border-accent' : 'bg-panel2 border-line'
                        }`}
                      />
                      <span className="font-mono text-[10px] text-muted text-center truncate">{w.label}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6 min-w-0">
                <SectionTitle
                  right={
                    sessions.length > 0 && (
                      <button onClick={() => navigate('/history')} className="text-xs text-muted hover:text-accent">
                        Ver todo
                      </button>
                    )
                  }
                >
                  Últimas sesiones
                </SectionTitle>
                {sessions.length === 0 ? (
                  <EmptyState
                    title="Sin sesiones"
                    hint="Cuando registres la primera aparecerá aquí."
                    action={<Button onClick={() => navigate('/log')}>Registrar sesión</Button>}
                  />
                ) : (
                  <div className="flex flex-col">
                    {sessions.slice(0, 5).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => navigate('/history')}
                        className="flex items-center justify-between gap-3 py-3 border-b border-line last:border-0 text-left hover:text-accent"
                      >
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium">{formatDate(s.date)}</p>
                          <p className="text-xs text-muted truncate">
                            {s.exercises?.length || 0} ejercicios
                            {s.routineName ? ` · ${s.routineName}` : ''}
                            {s.badDay ? ' · día flojo' : ''}
                          </p>
                        </div>
                        <span className="font-mono text-sm text-muted shrink-0">{formatVolume(sessionVolume(s))}</span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {days.length === 0 && (
              <EmptyState
                title="Sin plantilla"
                hint="Crea tus días de entrenamiento y añade ejercicios para tener sugerencia diaria y precarga al registrar."
                action={<Button onClick={() => navigate('/days')}>Crear plantilla</Button>}
              />
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
