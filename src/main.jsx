import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import * as store from './data/store';
import { installAutoSync } from './data/sync';
import Shell from './components/Shell';
import { Toaster } from './components/ui';
import Home from './pages/Home';
import Workout from './pages/Workout';
import Summary from './pages/Summary';
import History from './pages/History';
import Progress from './pages/Progress';
import Routine, { DayEditor } from './pages/Routine';
import Settings from './pages/Settings';

// El service worker de la PWA activa versiones nuevas en segundo plano
// (skipWaiting + clientsClaim), pero una pestaña abierta seguiría con el JS
// viejo: recargamos una vez cuando el nuevo SW toma el control, salvo en
// mitad de una sesión (no interrumpimos un entrenamiento).
// Rutas con almohadilla (/#/entrenar): funcionan igual en Railway (raíz) que
// en GitHub Pages (/workout-pwa/), sin depender de reescrituras del servidor,
// y la URL siempre queda dentro del ámbito del service worker (offline).
// Las URLs antiguas sin almohadilla (/log, /entrenar…) se convierten aquí.
(() => {
  const base = import.meta.env.BASE_URL; // '/' o '/workout-pwa/'
  const { pathname, search, hash } = window.location;
  if (hash) return;
  if (pathname === base) return;
  if (!pathname.startsWith(base.replace(/\/$/, ''))) return;
  const rest = pathname.slice(base.length - 1) || '/';
  window.history.replaceState(null, '', `${base}#${rest.startsWith('/') ? rest : `/${rest}`}${search}`);
})();

if ('serviceWorker' in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    if (store.inProgress(store.getState()) && window.location.hash.startsWith('#/entrenar')) return;
    reloaded = true;
    window.location.reload();
  });
}

store.init();
installAutoSync();

function App() {
  // Guarda lo pendiente si la pestaña pasa a segundo plano (bloquear móvil).
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') store.flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  return (
    <HashRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/entrenar" element={<Workout />} />
          <Route path="/entrenar/:sessionId" element={<Workout />} />
          <Route path="/resumen/:id" element={<Summary />} />
          <Route path="/historial" element={<History />} />
          <Route path="/progreso" element={<Progress />} />
          <Route path="/rutina" element={<Routine />} />
          <Route path="/rutina/dia/:id" element={<DayEditor />} />
          <Route path="/ajustes" element={<Settings />} />
          {/* Rutas de la versión anterior */}
          <Route path="/log" element={<Navigate to="/entrenar" replace />} />
          <Route path="/days" element={<Navigate to="/rutina" replace />} />
          <Route path="/records" element={<Navigate to="/progreso" replace />} />
          <Route path="/history" element={<Navigate to="/historial" replace />} />
          <Route path="/login" element={<Navigate to="/ajustes" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
      <Toaster />
    </HashRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
