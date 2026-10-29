// Prueba de humo de punta a punta en un móvil emulado (Chrome).
// Uso: npm run build && npx vite preview --port 4173 & node e2e/smoke.mjs
// Variables: BASE_URL (por defecto http://localhost:4173/), SHOTS (carpeta de capturas).
import { createRequire } from 'node:module';
// En CI se instala con «npm i --no-save playwright»; en local puede estar instalado globalmente.
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const SHOTS = process.env.SHOTS || 'e2e-shots';
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? '✔' : '✘'} ${name}${extra ? ` — ${extra}` : ''}`);
}

const device = process.env.DEVICE === 'iphone' ? devices['iPhone 13'] : devices['Pixel 7'];
const browser = await chromium.launch();
// Densidad 2: con la del dispositivo real (2,6-3) Chromium headless sin GPU a veces no entrega la captura.
const context = await browser.newContext({ ...device, deviceScaleFactor: 2, locale: 'es-ES', timezoneId: 'Europe/Madrid', acceptDownloads: true });
// Las fuentes de Google no son necesarias para la prueba (y sin red bloquean las capturas).
await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const url = m.location()?.url || '';
  // Las fuentes de Google se bloquean a propósito (la prueba no depende de red externa).
  if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return;
  errors.push(`${m.text()} ${url}`.trim());
});
page.on('requestfailed', (r) => {
  if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) return;
  errors.push(`requestfailed ${r.url()} ${r.failure()?.errorText || ''}`);
});
let n = 0;
const shot = async (name) => page.screenshot({ path: `${SHOTS}/${String(++n).padStart(2, '0')}-${name}.png`, animations: 'disabled' });

await page.goto(BASE);
await page.getByText('Elige tu rutina').waitFor();
await shot('primera-vez');
check('Onboarding visible', true);

await page.getByRole('button', { name: /Javier · F1 2026/ }).click();
await page.getByText(/cargada y activa/).waitFor();
await page.waitForTimeout(400);
await shot('hoy-con-f1');
const startBtn = page.getByRole('button', { name: /Empezar ▶/ });
check('Botón Empezar en Hoy', await startBtn.isVisible());

// Empezar el día de pecho (desde Entrenar → elegir día)
await page.getByRole('button', { name: 'Otro día' }).click();
await page.getByRole('button', { name: /Pecho \+ abdominales/ }).click();
await page.getByText('Ejercicio 1 de 5').waitFor();
await shot('sesion-pecho-inicio');
check('Una pantalla por ejercicio', (await page.getByRole('heading', { level: 2 }).count()) === 1);

// Sin peso la serie no se puede marcar (evita series vacías por un toque sin querer)
check('Sin peso no deja marcar la serie', await page.getByRole('button', { name: 'Escribe el peso' }).isVisible());

// Serie 1: 30 kg × 10, RIR 1
const weight = page.getByLabel('Peso en kilos').first();
const reps = page.getByLabel('Repeticiones').first();
await weight.fill('30');
await reps.fill('10');
await page.getByRole('button', { name: '1', exact: true }).first().click();
await shot('serie1-rellena');
await page.getByRole('button', { name: /✓ Hecha/ }).click();
await page.getByText('Serie 2 de 3').waitFor();
await shot('serie2');
check('Sin temporizador de descanso', (await page.getByText('Descanso').count()) === 0 && (await page.getByRole('button', { name: 'Saltar' }).count()) === 0);

// Serie 2: hereda 30 kg (plan) → solo reps
await page.getByLabel('Repeticiones').first().fill('9');
await page.getByRole('button', { name: /✓ Hecha/ }).click();
// Serie 3 aceptando el plan (peso heredado) con reps tecleadas
await page.getByLabel('Repeticiones').first().fill('8');
await page.getByRole('button', { name: /✓ Hecha/ }).click();
// Ejercicio acabado → pasa solo al siguiente
await page.getByText('Ejercicio 2 de 5').waitFor();
check('Pasa solo al siguiente ejercicio', await page.getByRole('heading', { name: 'Press inclinado con mancuernas' }).isVisible());
await shot('ejercicio2');

// Persistencia: recargar a mitad de sesión
await page.reload();
await page.getByText('Ejercicio 2 de 5').waitFor();
check('La sesión sobrevive a recargar', true);

// Rellenar rápido el resto de series de trabajo aceptando el plan con reps.
for (let i = 0; i < 60; i++) {
  const pending = page.getByRole('button', { name: /✓ Hecha|Escribe el peso|Escribe las reps/ });
  if (!(await pending.count())) {
    await page.waitForTimeout(700); // paso automático al siguiente ejercicio
    if (await pending.count()) continue;
    const next = page.getByRole('button', { name: 'Siguiente →' });
    if (await next.count()) { await next.click(); continue; }
    break;
  }
  const r = page.getByLabel('Repeticiones').first();
  if (!(await r.inputValue()) && !(await r.getAttribute('placeholder'))) await r.fill('10');
  const w = page.getByLabel('Peso en kilos').first();
  if (!(await w.inputValue()) && !(await w.getAttribute('placeholder'))) await w.fill('20');
  await page.getByRole('button', { name: /✓ Hecha/ }).click();
}
await shot('pecho-completo');
await page.getByRole('button', { name: /Terminar ✓/ }).click();
await page.getByText('Terminar sesión').waitFor();
await shot('terminar');
await page.getByRole('button', { name: 'Guardar sesión' }).click();
await page.getByText('minutos').waitFor();
await shot('resumen');
check('Resumen tras guardar', true);

// Segunda sesión del mismo día → la sugerencia debe subir el press plano (10/9/8 no llega a 12 → mantener)
await page.goto(`${BASE}#/entrenar`);
await page.getByRole('button', { name: /Pecho \+ abdominales/ }).click();
await page.getByText('Ejercicio 1 de 5').waitFor();
const sugg = await page.getByText(/Mantén|Sube a/).first().innerText();
check('Sugerencia de progresión basada en la última vez', /Mantén 30 kg/.test(sugg), sugg);
await shot('sugerencia');
// Descartar esta sesión
await page.getByRole('button', { name: 'Opciones de la sesión' }).click();
page.once('dialog', (d) => d.accept());
await page.getByRole('button', { name: 'Descartar sesión' }).click();
await page.waitForURL(/#\/$/);

// Día de hombro: biserie + superserie
await page.goto(`${BASE}#/entrenar`);
await page.getByRole('button', { name: /^Jueves.*Hombro/ }).click();
await page.getByText('Ejercicio 1 de 5').waitFor();
// Ir a la biserie desde la lista de ejercicios
await page.getByRole('button', { name: 'Ver ejercicios' }).click();
await shot('lista-ejercicios');
await page.getByRole('button', { name: /Elevaciones laterales con mancuernas/ }).click();
await page.getByText('Ejercicio 2 de 5').waitFor();
await shot('hombro-biserie');
const dropRows = await page.getByText('↘').count();
check('La biserie crea filas drop', dropRows >= 1, `${dropRows} drops visibles`);
await page.getByRole('button', { name: 'Ver ejercicios' }).click();
await page.getByRole('button', { name: /Encogimientos \+ Pájaros/ }).click();
await page.getByText('Ejercicio 5 de 5').waitFor();
check('La superserie se ve en una sola pantalla', (await page.getByRole('heading', { level: 2 }).count()) === 2);
await shot('superserie');

// Una URL de la versión anterior (sin almohadilla) sigue funcionando
await page.goto(`${BASE}history`);
await page.waitForURL(/#\/historial$/);
check('URL antigua /history redirige a #/historial', true);

// Historial, progreso, rutina, ajustes
await page.goto(`${BASE}#/historial`);
await page.getByText(/^1 sesión$/i).first().waitFor();
await shot('historial');
await page.goto(`${BASE}#/progreso`);
await page.waitForTimeout(400);
await shot('progreso');
check('Progreso muestra 1RM', (await page.getByText('1RM estimado').count()) > 0);
await page.getByRole('button', { name: 'Volumen semanal' }).click();
await shot('progreso-semanal');
await page.goto(`${BASE}#/rutina`);
await page.waitForTimeout(300);
await shot('rutina');
await page.getByRole('button', { name: /Bíceps \/ tríceps/ }).click();
await page.waitForTimeout(300);
await shot('editor-dia');
await page.getByRole('button', { name: /Bíceps 21/ }).click();
await shot('editor-ejercicio');
await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
await page.goto(`${BASE}#/ajustes`);
await shot('ajustes');
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Descargar copia/ }).click()]);
const file = await dl.path();
const json = JSON.parse(fs.readFileSync(file, 'utf8'));
check('Copia JSON con la sesión', Array.isArray(json.sessions) && json.sessions.some((s) => s.status === 'done'), `${json.sessions.length} sesiones`);

// Sin conexión (como en un sótano de gimnasio): con el service worker
// instalado, la app y los datos siguen ahí tras recargar.
await page.evaluate(() => navigator.serviceWorker?.ready);
await page.goto(`${BASE}#/`);
await page.waitForTimeout(500);
await context.setOffline(true);
const errorsBefore = errors.length;
await page.reload();
const offlineOk = await page.getByText(/Sesión en curso|Hoy toca|Continúa/).first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
await shot('sin-conexion');
check('Funciona sin conexión tras recargar', offlineOk);
await context.setOffline(false);
errors.splice(errorsBefore); // los fallos de red esperados estando offline no cuentan

check('Sin errores de JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`);
process.exit(failed.length ? 1 : 0);
