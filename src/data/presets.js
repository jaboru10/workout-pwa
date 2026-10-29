// Rutinas predefinidas incluidas en la app. Al cargarlas se crea una copia
// personal (rutina + días + ejercicios). Los ejercicios se casan por nombre
// normalizado, así la F1 y la F2 comparten historial y récords.
//
// x(nombre, grupo, series, reps, rir, descanso_s, rol, opciones)

function x(name, muscle, sets, reps, rir = null, restSec = null, role = null, opts = {}) {
  return {
    name, muscle, sets, reps, rir, restSec, role,
    bodyweight: Boolean(opts.bw),
    superset: opts.ss || null,
    technique: opts.tech || 'normal',
    notes: opts.notes || '',
    increment: opts.inc,
  };
}
const day = (name, weekday, exercises) => ({ name, weekday, exercises });

// ---------------------------------------------------------------------------
// Javier · F1 2026: la rutina que haces ahora (documento rutina-gym-f1-2026).
// 3 series en todo, doble progresión 8-12 a RIR 0.
// ---------------------------------------------------------------------------
const F1 = {
  id: 'javier-f1-2026',
  name: 'Javier · F1 2026',
  level: 'Avanzado',
  type: 'Híbrido',
  featured: true,
  description: 'Tu rutina actual: un grupo por día, 3 series, 8-12 reps a RIR 0.',
  days: [
    day('Pecho + abdominales', 1, [
      x('Press plano con mancuernas', 'Pecho', 3, '8-12', '0', 150, 'H'),
      x('Press inclinado con mancuernas', 'Pecho', 3, '8-12', '0', 150, 'H'),
      x('Fondos lastrados', 'Pecho', 3, '8-12', '0', 150, 'H', { bw: true, notes: 'El peso es el lastre. Ahora: 15 kg.' }),
      x('Cruces en polea', 'Pecho', 3, '8-12', '0', 90, 'H'),
      x('Rueda abdominal', 'Abdomen', 3, 'máx', '0', 75, 'A', { bw: true, notes: 'Progresión por reps (~20 / 10 / 8).' }),
    ]),
    day('Pierna', 2, [
      x('Extensión de cuádriceps', 'Cuádriceps', 3, '10-12', '0', 90, 'H'),
      x('Femoral acostado', 'Isquios', 3, '10-12', '0', 90, 'H'),
      x('Prensa', 'Cuádriceps', 3, '8-10', '0', 150, 'H'),
      x('Hack', 'Cuádriceps', 3, '8-10', '0', 150, 'H'),
      x('Femoral sentado', 'Isquios', 3, '10-12', '0', 90, 'H'),
      x('Aductor', 'Aductores', 3, '10-12', '0', 75, 'A'),
      x('Abductor', 'Glúteo', 3, '10-12', '0', 75, 'A', { notes: 'Máquina sentado abriendo las piernas.' }),
    ]),
    day('Espalda + abdominales', 3, [
      x('Remo alto (espalda alta)', 'Espalda', 3, '10-12', '0', 120, 'H'),
      x('Jalón ancho agarre neutro', 'Espalda', 3, '10-12', '0', 120, 'H'),
      x('Remo con barra', 'Espalda', 3, '8-10', '0', 150, 'H'),
      x('Remo en máquina de placas', 'Espalda', 3, '10-12', '0', 120, 'H'),
      x('Pullover en polea', 'Espalda', 3, '10-12', '0', 90, 'H', { ss: 'A' }),
      x('Lumbares', 'Lumbar', 3, '10-12', '0', 90, 'A', { ss: 'A', bw: true }),
      x('Máquina de abdominales', 'Abdomen', 3, '10-15', '0', 60, 'A'),
    ]),
    day('Hombro', 4, [
      x('Press de hombro con mancuernas', 'Hombro', 3, '8-10', '0', 150, 'H'),
      x('Elevaciones laterales con mancuernas', 'Deltoides lateral', 6, '15+15', '0', 105, 'H', {
        tech: 'biserie', notes: 'Biserie: 15 reps con 10 kg y sin descanso 15 con 5 kg.',
      }),
      x('Press de hombro en multipower', 'Hombro', 3, '8-10', '0', 150, 'H'),
      x('Laterales en máquina', 'Deltoides lateral', 3, '10-12', '0', 90, 'H'),
      x('Encogimientos', 'Trapecio', 3, '10-12', '0', 90, 'A', { ss: 'A' }),
      x('Pájaros (deltoides posterior)', 'Deltoides posterior', 3, '10-12', '0', 90, 'H', { ss: 'A' }),
    ]),
    day('Bíceps / tríceps + abdominales', 5, [
      x('Bíceps unilateral con mancuerna', 'Bíceps', 3, '8-10', '0', 90, 'H'),
      x('Press francés', 'Tríceps', 3, '8-10', '0', 90, 'H'),
      x('Martillo en máquina', 'Bíceps', 3, '8-12', '0', 75, 'H'),
      x('Tríceps en polea sobre la cabeza', 'Tríceps', 3, '8-12', '0', 75, 'H'),
      x('Bíceps 21', 'Bíceps', 3, '21', '0', 90, 'H', { notes: '7 parciales abajo + 7 arriba + 7 completas.' }),
      x('Tríceps en polea', 'Tríceps', 3, '8-12', '0', 75, 'H'),
      x('Elevaciones de piernas colgado', 'Abdomen', 3, 'máx', '0', 60, 'A', { bw: true }),
    ]),
  ],
};

// ---------------------------------------------------------------------------
// Javier · F2 · Opción A (borrador): Empuje/Tracción + Pierna, día pesado y
// día de volumen (documento rutina-gym-f2-exploracion, apartado 5).
// ---------------------------------------------------------------------------
const F2A = {
  id: 'javier-f2-opcion-a',
  name: 'Javier · F2 · Opción A (borrador)',
  level: 'Avanzado',
  type: 'Híbrido',
  featured: true,
  description: 'Empuje/Tracción + Pierna. Pesado 5-8 a RIR 1-2 y volumen 8-15. Exploración, no cerrada.',
  days: [
    day('Tracción B · volumen', 1, [
      x('Jalón ancho agarre neutro', 'Espalda', 3, '10-12', '0-1', 90, 'H'),
      x('Remo en máquina de placas', 'Espalda', 3, '10-12', '0-1', 90, 'H'),
      x('Pájaros (deltoides posterior)', 'Deltoides posterior', 3, '12-15', '0-1', 75, 'H', { ss: 'A' }),
      x('Laterales en polea', 'Deltoides lateral', 3, '12-15', '0-1', 75, 'H', { ss: 'A' }),
      x('Curl inclinado con mancuernas', 'Bíceps', 3, '10-12', '0-1', 75, 'H', { notes: 'Bíceps estirado (sustituye a los 21s).' }),
      x('Encogimientos', 'Trapecio', 3, '10-12', '1', 75, 'A'),
    ]),
    day('Pierna', 2, [
      x('Hack', 'Cuádriceps', 3, '6-8', '1-2', 165, 'F', { notes: 'Siempre primero. Orden fijo.' }),
      x('Peso muerto rumano', 'Isquios', 3, '6-10', '2', 150, 'F', { notes: 'Semanas 1-2: 2 series a RIR 3 (agujetas antes del rodaje).' }),
      x('Prensa', 'Cuádriceps', 3, '10-12', '1', 120, 'H'),
      x('Femoral sentado', 'Isquios', 3, '8-12', '0-1', 90, 'H', { notes: 'Antes que el acostado.' }),
      x('Extensión de cuádriceps', 'Cuádriceps', 3, '10-15', '0', 90, 'H', { notes: 'Última serie: parciales en estiramiento (opcional).' }),
      x('Femoral acostado', 'Isquios', 2, '10-12', '0', 90, 'H', { notes: 'Opcional.' }),
      x('Aductor', 'Aductores', 2, '12-15', '0-1', 60, 'A', { ss: 'A' }),
      x('Abductor', 'Glúteo', 2, '12-15', '0-1', 60, 'A', { ss: 'A' }),
      x('Gemelo de pie', 'Gemelos', 3, '8-12', '1', 90, 'H', { notes: 'Pausa de 1-2 s abajo, gemelo estirado.' }),
    ]),
    day('Empuje A · pesado', 3, [
      x('Press plano con mancuernas', 'Pecho', 4, '5-8', '1-2', 165, 'F'),
      x('Fondos lastrados', 'Pecho', 3, '5-8', '1-2', 150, 'F', { bw: true, notes: 'El peso es el lastre.' }),
      x('Press de hombro en multipower', 'Hombro', 3, '5-8', '1-2', 150, 'F'),
      x('Laterales en máquina', 'Deltoides lateral', 3, '10-15', '0-1', 75, 'H'),
      x('Tríceps en polea sobre la cabeza', 'Tríceps', 3, '8-12', '0-1', 90, 'H'),
      x('Máquina de abdominales', 'Abdomen', 3, '10-15', '0-1', 60, 'A'),
    ]),
    day('Tracción A · pesado', 4, [
      x('Remo con barra', 'Espalda', 3, '5-8', '1-2', 165, 'F', { notes: '48 h después del peso muerto rumano: vigila la zona lumbar.' }),
      x('Jalón ancho agarre neutro', 'Espalda', 3, '6-8', '1-2', 150, 'F', { notes: 'Pesado (o dominadas lastradas).' }),
      x('Remo alto (espalda alta)', 'Espalda', 3, '8-12', '1', 120, 'H'),
      x('Pullover en polea', 'Espalda', 2, '10-15', '0', 90, 'H'),
      x('Bíceps unilateral con mancuerna', 'Bíceps', 3, '6-10', '1', 90, 'H'),
      x('Martillo en máquina', 'Bíceps', 2, '10-12', '0', 75, 'H'),
      x('Gemelo de pie', 'Gemelos', 3, '10-15', '0-1', 75, 'H'),
      x('Rueda abdominal', 'Abdomen', 3, 'máx', '0-1', 75, 'A', { bw: true }),
    ]),
    day('Empuje B · volumen', 5, [
      x('Press inclinado con mancuernas', 'Pecho', 3, '8-12', '1', 120, 'H'),
      x('Cruces en polea', 'Pecho', 3, '10-15', '0', 90, 'H'),
      x('Elevaciones laterales con mancuernas', 'Deltoides lateral', 4, '15+15', '0', 105, 'H', {
        tech: 'biserie',
        notes: 'Biserie 10 kg + 5 kg. Sube la parte pesada 15 → 18 → 20; con 20 + 15 en las 4 rondas pasa a 12 + 6 kg.',
      }),
      x('Press de hombro con mancuernas', 'Hombro', 2, '8-12', '1', 120, 'H', { notes: 'Opcional.' }),
      x('Press francés', 'Tríceps', 3, '8-12', '1', 90, 'H'),
      x('Tríceps en polea', 'Tríceps', 3, '10-15', '0', 75, 'H'),
      x('Elevaciones de piernas colgado', 'Abdomen', 3, 'máx', '0-1', 60, 'A', { bw: true }),
    ]),
  ],
};

// ---------------------------------------------------------------------------
// Clásicas (las mismas que el seed del backend).
// ---------------------------------------------------------------------------
const c = (name, muscle, sets, reps, bw) => x(name, muscle, sets, reps, null, null, null, { bw });
const CLASSICS = [
  { id: 'full-body-3', name: 'Full Body 3 días', level: 'Principiante', type: 'Fuerza', days: [
    day('Día A', null, [c('Sentadilla', 'Pierna', 3, '5'), c('Press banca', 'Pecho', 3, '5'), c('Remo con barra', 'Espalda', 3, '5'), c('Press militar', 'Hombro', 3, '8'), c('Curl bíceps', 'Bíceps', 2, '10')]),
    day('Día B', null, [c('Peso muerto', 'Pierna', 1, '5'), c('Press militar', 'Hombro', 3, '5'), c('Jalón al pecho', 'Espalda', 3, '8'), c('Press inclinado', 'Pecho', 3, '8'), c('Extensión tríceps', 'Tríceps', 2, '10')]),
    day('Día C', null, [c('Sentadilla', 'Pierna', 3, '5'), c('Press banca', 'Pecho', 3, '5'), c('Remo con barra', 'Espalda', 3, '5'), c('Elevaciones laterales', 'Deltoides lateral', 3, '12'), c('Plancha', 'Core', 3, '60s', true)]),
  ] },
  { id: 'stronglifts-5x5', name: 'StrongLifts 5x5', level: 'Principiante', type: 'Fuerza', days: [
    day('Entreno A', null, [c('Sentadilla', 'Pierna', 5, '5'), c('Press banca', 'Pecho', 5, '5'), c('Remo con barra', 'Espalda', 5, '5')]),
    day('Entreno B', null, [c('Sentadilla', 'Pierna', 5, '5'), c('Press militar', 'Hombro', 5, '5'), c('Peso muerto', 'Pierna', 1, '5')]),
  ] },
  { id: 'upper-lower-4', name: 'Upper/Lower 4 días', level: 'Intermedio', type: 'Híbrido', days: [
    day('Superior A', 1, [c('Press banca', 'Pecho', 4, '6-8'), c('Remo con barra', 'Espalda', 4, '6-8'), c('Press militar', 'Hombro', 3, '8-10'), c('Jalón al pecho', 'Espalda', 3, '10'), c('Curl bíceps', 'Bíceps', 3, '12'), c('Extensión tríceps', 'Tríceps', 3, '12')]),
    day('Inferior A', 2, [c('Sentadilla', 'Pierna', 4, '6-8'), c('Peso muerto rumano', 'Isquios', 3, '8-10'), c('Prensa', 'Cuádriceps', 3, '10-12'), c('Curl femoral', 'Isquios', 3, '12'), c('Gemelo de pie', 'Gemelos', 4, '15')]),
    day('Superior B', 4, [c('Press inclinado', 'Pecho', 4, '8-10'), c('Remo con mancuerna', 'Espalda', 4, '10'), c('Elevaciones laterales', 'Deltoides lateral', 4, '12-15'), c('Face pull', 'Deltoides posterior', 3, '15'), c('Curl martillo', 'Bíceps', 3, '12'), c('Fondos', 'Tríceps', 3, '10', true)]),
    day('Inferior B', 5, [c('Peso muerto', 'Pierna', 3, '5'), c('Zancadas', 'Pierna', 3, '10'), c('Prensa', 'Cuádriceps', 4, '12'), c('Extensión de cuádriceps', 'Cuádriceps', 3, '15'), c('Gemelo sentado', 'Gemelos', 4, '20')]),
  ] },
  { id: 'ppl-6', name: 'Push/Pull/Legs (6 días)', level: 'Intermedio', type: 'Hipertrofia', days: [
    day('Empuje', null, [c('Press banca', 'Pecho', 4, '8'), c('Press militar', 'Hombro', 4, '10'), c('Press inclinado con mancuernas', 'Pecho', 3, '10'), c('Elevaciones laterales', 'Deltoides lateral', 4, '15'), c('Tríceps en polea', 'Tríceps', 3, '12'), c('Fondos', 'Tríceps', 3, '12', true)]),
    day('Tirón', null, [c('Dominadas', 'Espalda', 4, '8', true), c('Remo con barra', 'Espalda', 4, '8'), c('Jalón al pecho', 'Espalda', 3, '10'), c('Face pull', 'Deltoides posterior', 3, '15'), c('Curl bíceps barra', 'Bíceps', 4, '10'), c('Curl martillo', 'Bíceps', 3, '12')]),
    day('Pierna', null, [c('Sentadilla', 'Pierna', 4, '8'), c('Peso muerto rumano', 'Isquios', 3, '10'), c('Prensa', 'Cuádriceps', 4, '12'), c('Curl femoral', 'Isquios', 3, '12'), c('Extensión de cuádriceps', 'Cuádriceps', 3, '15'), c('Gemelo de pie', 'Gemelos', 4, '20')]),
  ] },
  { id: 'weider-5', name: 'Weider 5 días', level: 'Intermedio', type: 'Hipertrofia', days: [
    day('Pecho', 1, [c('Press banca', 'Pecho', 4, '10'), c('Press inclinado con mancuernas', 'Pecho', 4, '10'), c('Aperturas', 'Pecho', 3, '12'), c('Fondos', 'Tríceps', 3, '12', true)]),
    day('Espalda', 2, [c('Dominadas', 'Espalda', 4, '8', true), c('Remo con barra', 'Espalda', 4, '10'), c('Jalón al pecho', 'Espalda', 3, '12'), c('Remo con mancuerna', 'Espalda', 3, '10'), c('Peso muerto', 'Pierna', 3, '8')]),
    day('Hombro', 3, [c('Press militar', 'Hombro', 4, '10'), c('Elevaciones laterales', 'Deltoides lateral', 4, '15'), c('Elevaciones frontales', 'Hombro', 3, '12'), c('Face pull', 'Deltoides posterior', 3, '15'), c('Pájaros (deltoides posterior)', 'Deltoides posterior', 3, '15')]),
    day('Brazo', 4, [c('Curl bíceps barra', 'Bíceps', 4, '10'), c('Curl martillo', 'Bíceps', 3, '12'), c('Curl concentrado', 'Bíceps', 3, '12'), c('Tríceps en polea', 'Tríceps', 4, '12'), c('Press francés', 'Tríceps', 3, '10')]),
    day('Pierna', 5, [c('Sentadilla', 'Pierna', 4, '10'), c('Prensa', 'Cuádriceps', 4, '12'), c('Extensión de cuádriceps', 'Cuádriceps', 3, '15'), c('Curl femoral', 'Isquios', 3, '12'), c('Gemelo de pie', 'Gemelos', 4, '20')]),
  ] },
  { id: 'arnold-6', name: 'Arnold Split (6 días)', level: 'Avanzado', type: 'Hipertrofia', days: [
    day('Pecho/Espalda', null, [c('Press banca', 'Pecho', 4, '10'), c('Press inclinado', 'Pecho', 4, '10'), c('Dominadas', 'Espalda', 4, '8', true), c('Remo con barra', 'Espalda', 4, '10'), c('Aperturas', 'Pecho', 3, '12'), c('Pullover en polea', 'Espalda', 3, '12')]),
    day('Hombro/Brazo', null, [c('Press militar', 'Hombro', 4, '10'), c('Elevaciones laterales', 'Deltoides lateral', 4, '15'), c('Curl bíceps barra', 'Bíceps', 4, '10'), c('Press francés', 'Tríceps', 4, '10'), c('Curl martillo', 'Bíceps', 3, '12'), c('Tríceps en polea', 'Tríceps', 3, '12')]),
    day('Pierna', null, [c('Sentadilla', 'Pierna', 4, '10'), c('Prensa', 'Cuádriceps', 4, '12'), c('Peso muerto rumano', 'Isquios', 3, '10'), c('Extensión de cuádriceps', 'Cuádriceps', 3, '15'), c('Curl femoral', 'Isquios', 3, '12'), c('Gemelo de pie', 'Gemelos', 4, '20')]),
  ] },
  { id: 'phul-4', name: 'PHUL 4 días', level: 'Intermedio', type: 'Híbrido', days: [
    day('Superior fuerza', 1, [c('Press banca', 'Pecho', 4, '5'), c('Remo con barra', 'Espalda', 4, '5'), c('Press militar', 'Hombro', 3, '6'), c('Jalón al pecho', 'Espalda', 3, '8'), c('Curl bíceps', 'Bíceps', 3, '8'), c('Extensión tríceps', 'Tríceps', 3, '8')]),
    day('Inferior fuerza', 2, [c('Sentadilla', 'Pierna', 4, '5'), c('Peso muerto', 'Pierna', 4, '5'), c('Prensa', 'Cuádriceps', 3, '10'), c('Curl femoral', 'Isquios', 3, '10'), c('Gemelo de pie', 'Gemelos', 4, '12')]),
    day('Superior hipertrofia', 4, [c('Press inclinado con mancuernas', 'Pecho', 4, '12'), c('Remo con mancuerna', 'Espalda', 4, '12'), c('Elevaciones laterales', 'Deltoides lateral', 4, '15'), c('Aperturas', 'Pecho', 3, '12'), c('Curl martillo', 'Bíceps', 3, '12'), c('Tríceps en polea', 'Tríceps', 3, '15')]),
    day('Inferior hipertrofia', 5, [c('Sentadilla frontal', 'Pierna', 4, '12'), c('Peso muerto rumano', 'Isquios', 4, '12'), c('Prensa', 'Cuádriceps', 4, '15'), c('Extensión de cuádriceps', 'Cuádriceps', 3, '15'), c('Curl femoral', 'Isquios', 3, '15'), c('Gemelo sentado', 'Gemelos', 4, '20')]),
  ] },
];

export const PRESETS = [F1, F2A, ...CLASSICS];

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) || null;
}

export function presetStats(p) {
  const exercises = p.days.reduce((n, d) => n + d.exercises.length, 0);
  const sets = p.days.reduce((n, d) => n + d.exercises.reduce((m, e) => m + e.sets, 0), 0);
  return { days: p.days.length, exercises, sets };
}
