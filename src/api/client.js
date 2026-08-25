// Cliente API. La URL base se toma de la variable de entorno VITE_API_URL,
// con fallback a localhost para desarrollo.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Sesión expirada');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error ${res.status}`);
  }

  // algunos endpoints (DELETE) no devuelven cuerpo
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return null;
}

export const api = {
  // --- Auth ---
  register: (username, password) =>
    request('/api/auth/register', { method: 'POST', body: { username, password }, auth: false }),
  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', body: { username, password }, auth: false }),

  // --- Ejercicios ---
  listExercises: () => request('/api/exercises'),
  createExercise: (ex) => request('/api/exercises', { method: 'POST', body: ex }),
  updateExercise: (id, ex) => request(`/api/exercises/${id}`, { method: 'PUT', body: ex }),
  deleteExercise: (id) => request(`/api/exercises/${id}`, { method: 'DELETE' }),

  // --- Días de entrenamiento ---
  listDays: () => request('/api/training-days'),
  createDay: (day) => request('/api/training-days', { method: 'POST', body: day }),
  updateDay: (id, day) => request(`/api/training-days/${id}`, { method: 'PUT', body: day }),
  deleteDay: (id) => request(`/api/training-days/${id}`, { method: 'DELETE' }),

  // --- Sesiones ---
  listSessions: () => request('/api/sessions'),
  getSession: (id) => request(`/api/sessions/${id}`),
  createSession: (session) => request('/api/sessions', { method: 'POST', body: session }),
  updateSession: (id, session) => request(`/api/sessions/${id}`, { method: 'PUT', body: session }),
  deleteSession: (id) => request(`/api/sessions/${id}`, { method: 'DELETE' }),

  // --- Récords ---
  records: (exerciseId, windowMonths = 6, position) => {
    const params = new URLSearchParams({ windowMonths: String(windowMonths) });
    if (position != null) params.set('position', String(position));
    return request(`/api/records/${exerciseId}?${params.toString()}`);
  },

  // --- Configuración ---
  getConfig: () => request('/api/config'),
  updateConfig: (config) => request('/api/config', { method: 'PUT', body: config }),
};
