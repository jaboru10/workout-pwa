// Utilidades de fecha. Las sesiones guardan la fecha como 'YYYY-MM-DD' LOCAL
// (nunca timestamp UTC), así que hay que parsearla a medianoche local:
// new Date('2026-08-31') la interpretaría como UTC y en España se vería
// como el día anterior.

// Ventana de edición (IL-003): solo se pueden editar sesiones recientes.
export const EDIT_WINDOW_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Fecha de hoy como 'YYYY-MM-DD' local (toISOString daría la fecha UTC). */
export function todayLocal() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 'YYYY-MM-DD' → Date a medianoche local. */
export function parseLocalDate(str) {
  if (!str) return null;
  const [y, m, d] = String(str).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Días completos transcurridos desde la fecha dada hasta hoy (0 = hoy). */
export function daysSince(str) {
  const date = parseLocalDate(str);
  if (!date) return Infinity;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - date) / MS_PER_DAY);
}

/** ¿La sesión sigue dentro de la ventana de edición de 7 días? */
export function isWithinEditWindow(str) {
  return daysSince(str) <= EDIT_WINDOW_DAYS;
}

/** Formatea 'YYYY-MM-DD' para mostrar, sin desfase de zona horaria. */
export function formatDate(str, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const date = parseLocalDate(str);
  return date ? date.toLocaleDateString('es-ES', opts) : '—';
}
