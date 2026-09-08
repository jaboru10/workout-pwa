import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Days from './pages/Days';
import LogSession from './pages/LogSession';
import History from './pages/History';
import Records from './pages/Records';
import Shell from './components/Shell';

function Protected() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected />}>
            <Route path="/" element={<Home />} />
            <Route path="/days" element={<Days />} />
            <Route path="/log" element={<LogSession />} />
            {/* Misma pantalla en modo edición (IL-010) */}
            <Route path="/log/:sessionId" element={<LogSession />} />
            <Route path="/history" element={<History />} />
            <Route path="/records" element={<Records />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
