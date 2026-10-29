// Exportación e importación de ficheros (copia de seguridad y datos para Claude).
import { todayLocal } from '../utils/dates';

function download(name, mime, text) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadJSON(payload) {
  download(`ironlog-copia-${todayLocal()}.json`, 'application/json', JSON.stringify(payload, null, 1));
}

const csvCell = (v) => {
  if (v == null) return '';
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Una fila por serie: fácil de abrir en Excel/Sheets o de pasar a Claude. */
export function sessionsCSV(sessions, exercisesById) {
  const head = ['fecha', 'rutina', 'dia', 'orden', 'ejercicio', 'grupo', 'serie', 'tipo', 'kg', 'reps', 'rir', 'objetivo_reps', 'objetivo_rir', 'dia_flojo', 'notas'];
  const rows = [head.join(';')];
  [...sessions]
    .filter((s) => s.status === 'done')
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .forEach((s) => (s.exercises || []).forEach((x) => {
      let n = 0;
      (x.sets || []).forEach((st) => {
        if ((st.type || 'work') === 'work') n++;
        const ex = exercisesById[x.exerciseId];
        rows.push([
          s.date, s.routineName || '', s.dayName || '', x.order, ex?.name || x.exerciseId, ex?.muscleGroup || '',
          (st.type || 'work') === 'work' ? n : '', st.type || 'work',
          st.weight ?? '', st.reps ?? '', st.rir ?? '', x.target?.reps ?? '', x.target?.rir ?? '',
          s.badDay ? 'si' : '', s.notes || '',
        ].map(csvCell).join(';'));
      });
    }));
  return rows.join('\n');
}

export function downloadCSV(sessions, exercisesById) {
  // BOM para que Excel abra bien las tildes.
  download(`ironlog-series-${todayLocal()}.csv`, 'text/csv;charset=utf-8', `﻿${sessionsCSV(sessions, exercisesById)}`);
}

export function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('No se ha podido leer el archivo.'));
    r.onload = () => {
      try { resolve(JSON.parse(String(r.result))); } catch { reject(new Error('El archivo no es un JSON válido.')); }
    };
    r.readAsText(file);
  });
}
