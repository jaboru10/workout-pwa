// Utilidades de dispositivo: reloj, pantalla encendida, sonido y vibración.
// Pensado para Chrome en el móvil (Android) y Chrome/Safari en iPhone
// (WebKit: sin vibración, el audio necesita un toque previo).
import { useEffect, useRef, useState } from 'react';

export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    const onVis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [intervalMs, enabled]);
  return now;
}

/** Mantiene la pantalla encendida mientras `enabled` (Screen Wake Lock API). */
export function useWakeLock(enabled) {
  const lock = useRef(null);
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return undefined;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible' || lock.current) return;
        lock.current = await navigator.wakeLock.request('screen');
        lock.current.addEventListener?.('release', () => { lock.current = null; });
        if (cancelled) { lock.current?.release?.(); lock.current = null; }
      } catch { /* denegado o no soportado */ }
    };
    acquire();
    const onVis = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      lock.current?.release?.().catch(() => {});
      lock.current = null;
    };
  }, [enabled]);
}

let audioCtx = null;

/** Debe llamarse dentro de un toque del usuario (iOS no deja sonar sin él). */
export function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* sin audio */ }
}

export function beep({ times = 3, freq = 880, ms = 160, gap = 120 } = {}) {
  try {
    if (!audioCtx) return;
    let t = audioCtx.currentTime + 0.02;
    for (let i = 0; i < times; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === times - 1 ? freq * 1.25 : freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + ms / 1000 + 0.02);
      t += (ms + gap) / 1000;
    }
  } catch { /* sin audio */ }
}

export function vibrate(pattern = [200, 100, 200]) {
  try { navigator.vibrate?.(pattern); } catch { /* sin vibración */ }
}

export function tick() {
  try { navigator.vibrate?.(15); } catch { /* nada */ }
}
