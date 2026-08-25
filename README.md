# Iron Log — PWA

App de registro de entrenamiento conectada al backend Spring Boot.

## Stack
- React 18 + Vite
- Tailwind CSS
- React Router
- vite-plugin-pwa (instalable + offline)

## Arranque

```bash
npm install
npm run dev
```

Abre http://localhost:5173

Asegúrate de tener el backend corriendo en http://localhost:8080.
Si tu backend está en otra URL, edita `.env`:

```
VITE_API_URL=http://localhost:8080
```

## Build de producción

```bash
npm run build
npm run preview   # para probar el build localmente
```

Los ficheros quedan en `dist/`. Súbelos a Vercel o Netlify.

## Pantallas
- **Hoy** — resumen del día y últimas sesiones
- **Registrar** — apuntar la sesión real; avisa de récords al guardar
- **Plantilla** — gestionar ejercicios y días (reordenables)
- **Historial** — sesiones pasadas con detalle
- **Récords** — por ejercicio, ventana temporal y posición de fatiga

## Instalar como app
- **Android/Chrome**: menú → "Añadir a pantalla de inicio"
- **iPhone/Safari**: compartir → "Añadir a pantalla de inicio"

## Nota sobre CORS
El backend ya permite `http://localhost:5173` en la config CORS.
Cuando despliegues la PWA, añade su dominio en `SecurityConfig.corsConfigurationSource()`.
