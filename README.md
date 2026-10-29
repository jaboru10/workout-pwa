# Iron Log 3 — registro de entrenamiento (PWA)

App para apuntar el gimnasio desde el móvil (pensada para Chrome en el
teléfono): eliges el día, la app te propone el peso y las reps según la última
vez, marcas cada serie con un toque y arranca sola el descanso.

**App:** https://jaboru10.github.io/workout-pwa/ (se publica sola en cada push a `master`).

## Cómo se usa en el gimnasio

1. **Hoy** muestra el día que toca según la rutina activa → **Empezar ▶**.
2. Cada ejercicio trae la última sesión y la sugerencia (doble progresión):
   «Sube a 32,5 kg y vuelve a 8», «Mantén 30 kg · busca 11 · 10 · 9»…
3. En la serie actual: ajusta peso (−/+ según el incremento del ejercicio) y
   reps, toca el RIR y **✓ Hecha**. Si coincide con lo propuesto, es un toque.
4. El descanso arranca solo (pitido y vibración al acabar, −15/+15/Saltar).
   En superseries pasa al siguiente ejercicio sin descanso; en la biserie de
   laterales salta a la mitad ligera (↘) sin descanso.
5. **Terminar ✓** → resumen con récords. Si fue un mal día, marca «Día flojo»
   y la próxima sugerencia no subirá peso.

Durante la sesión la pantalla no se apaga y, si cierras Chrome o se queda sin
batería, la sesión sigue ahí al volver.

## Instalar en el móvil

- **Android / Chrome:** menú ⋮ → «Añadir a pantalla de inicio» (o «Instalar app»).
- **iPhone:** compartir → «Añadir a pantalla de inicio».

Instalada, se abre a pantalla completa y funciona **sin conexión**.

## Dónde están los datos

Todo se guarda **en el propio móvil** (IndexedDB). No hace falta servidor ni
cuenta. Para no perder nada:

- **Ajustes → Descargar copia (JSON)** de vez en cuando (la app te lo recuerda).
- **Ajustes → Exportar series (CSV)** para Excel o para analizarlo con Claude.
- Opcional: **Ajustes → Servidor** conecta con el backend
  ([workout-tracker](https://github.com/jaboru10/workout-tracker)), que guarda
  una copia al terminar cada sesión y permite pasar los datos a otro dispositivo.
  Desde ahí también se importan las sesiones de la versión anterior.

## Rutinas incluidas

- **Javier · F1 2026** — la rutina actual (L pecho, M pierna, X espalda, J hombro, V brazos; 3 series, 8-12 a RIR 0).
- **Javier · F2 · Opción A (borrador)** — exploración: Empuje/Tracción + Pierna, día pesado 5-8 a RIR 1-2 y día de volumen.
- Clásicas: Full Body 3, StrongLifts 5×5, Upper/Lower 4, PPL 6, Weider 5, Arnold 6, PHUL 4.

Todo es editable en **Rutina** (días, ejercicios, series, reps, RIR, descanso,
superseries, técnica y notas). Los ejercicios con el mismo nombre comparten
historial entre rutinas, así que pasar de F1 a F2 no pierde los récords.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # lógica: progresión, superseries, biseries, récords
npm run build && npx vite preview --port 4173 &
node e2e/smoke.mjs # E2E en un móvil simulado (necesita playwright)
```

- React 18 + Vite 5 + Tailwind 3, `vite-plugin-pwa` (offline) e `idb-keyval`.
- Rutas con almohadilla (`/#/entrenar`): funciona igual en la raíz (Railway) que
  en una subcarpeta (GitHub Pages, `VITE_BASE=/workout-pwa/`).
- `VITE_API_URL`: servidor por defecto que se propone en Ajustes.

### Estructura

```
src/data      almacenamiento local, store, rutinas predefinidas, sync y copias
src/logic     objetivos de reps/RIR, progresión, récords, métricas y orden de la sesión
src/pages     Hoy, Entrenar, Resumen, Historial, Progreso, Rutina, Ajustes
e2e/          prueba de punta a punta en móvil
test/         pruebas de la lógica
```
