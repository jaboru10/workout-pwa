import { useEffect, useRef, useState } from 'react';
import * as store from '../data/store';
import { byId, useAppState } from '../data/store';
import * as sync from '../data/sync';
import { storageEstimate } from '../data/db';
import { downloadCSV, downloadJSON, readJSONFile } from '../data/files';
import { Button, Card, Input, Loading, SectionTitle, Sheet, Toggle, toast } from '../components/ui';
import { PageBody, PageHeader } from '../components/Shell';
import { plural } from '../logic/metrics';

const APP_VERSION = '3.0.0';

const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'nunca');

export default function Settings() {
  const state = useAppState();
  const fileRef = useRef(null);
  const [est, setEst] = useState(null);
  const [importing, setImporting] = useState(null);
  useEffect(() => { storageEstimate().then(setEst); }, []);
  if (!state.ready) return <PageBody><Loading /></PageBody>;
  const cfg = state.config;
  const doneCount = state.sessions.filter((s) => s.status === 'done').length;

  function exportJSON() {
    downloadJSON(store.exportPayload());
    store.updateConfig({ lastExportAt: new Date().toISOString() });
    toast('Copia descargada');
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = await readJSONFile(file);
      if (!Array.isArray(data.sessions)) throw new Error('El archivo no parece una copia de Iron Log.');
      setImporting(data);
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  return (
    <>
      <PageHeader crumb={`Iron Log ${APP_VERSION}`} title="Ajustes" back="/" />
      <PageBody className="flex flex-col gap-4 max-w-2xl">
        <Card className="p-4 flex flex-col gap-3">
          <SectionTitle>Copia de seguridad</SectionTitle>
          <p className="text-sm text-muted">
            Todo se guarda en este móvil ({plural(doneCount, 'sesión', 'sesiones')}). Descarga una copia de vez en cuando o conecta el servidor.
            Última copia descargada: <span className="text-chalk">{fmtWhen(cfg.lastExportAt)}</span>.
          </p>
          <Button onClick={exportJSON}>Descargar copia (JSON)</Button>
          <Button variant="ghost" onClick={() => downloadCSV(state.sessions, byId(state.exercises))}>Exportar series (CSV para Excel o Claude)</Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>Restaurar o importar una copia…</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
        </Card>

        <ServerCard state={state} />

        <Card className="p-4 flex flex-col">
          <SectionTitle>Durante el entrenamiento</SectionTitle>
          <Toggle checked={cfg.keepAwake} onChange={(v) => store.updateConfig({ keepAwake: v })} label="Pantalla siempre encendida" hint="Mientras haya una sesión abierta." />
        </Card>

        <Card className="p-4 flex flex-col gap-2">
          <SectionTitle>Almacenamiento</SectionTitle>
          <p className="text-sm text-muted">
            Motor: <span className="text-chalk">{state.backend === 'idb' ? 'IndexedDB' : state.backend === 'local' ? 'localStorage' : 'memoria (¡no persiste!)'}</span>
            {est?.usage != null && <> · usado <span className="text-chalk">{(est.usage / 1024 / 1024).toFixed(2)} MB</span></>}
            {est?.persisted != null && <> · {est.persisted ? 'protegido contra borrado automático' : 'el navegador podría borrarlo si falta espacio'}</>}
          </p>
          <p className="text-xs text-muted">
            Consejo: en el móvil, abre el menú de Chrome y elige «Añadir a pantalla de inicio». Así se abre como una app y funciona sin conexión.
          </p>
          <Button variant="danger" className="mt-2" onClick={async () => {
            if (!confirm('¿Borrar TODOS los datos de este móvil? Descarga antes una copia si la quieres.')) return;
            if (!confirm('Seguro: se borran sesiones, rutinas y ejercicios.')) return;
            await store.wipeAll();
            toast('Datos borrados');
          }}>Borrar todos los datos</Button>
        </Card>

        <p className="text-center font-mono text-[11px] text-muted pb-4">Iron Log {APP_VERSION} · datos en el dispositivo · {state.meta?.deviceId?.slice(0, 8)}</p>
      </PageBody>

      <ImportSheet data={importing} onClose={() => setImporting(null)} />
    </>
  );
}

function ImportSheet({ data, onClose }) {
  if (!data) return null;
  const n = data.sessions?.length || 0;
  return (
    <Sheet open={Boolean(data)} onClose={onClose} title="Importar copia">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          El archivo tiene {n} sesiones, {data.exercises?.length || 0} ejercicios y {data.routines?.length || 0} rutinas
          {data.exportedAt ? ` (copia del ${new Date(data.exportedAt).toLocaleDateString('es-ES')})` : ''}.
        </p>
        <Button onClick={async () => {
          const r = await store.mergeIn(data);
          toast(`Añadidas ${r.sessions} sesiones, ${r.exercises} ejercicios y ${r.routines} rutinas`);
          onClose();
        }}>Añadir a lo que ya tengo</Button>
        <Button variant="danger" onClick={async () => {
          if (!confirm('Se borrará todo lo de este móvil y se sustituirá por la copia. ¿Seguir?')) return;
          try { await store.replaceAll(data); toast('Copia restaurada'); onClose(); } catch (e) { toast(e.message, 'danger'); }
        }}>Sustituir todo por la copia</Button>
      </div>
    </Sheet>
  );
}

function ServerCard({ state }) {
  const s = state.config.server;
  const [url, setUrl] = useState(s.url || sync.DEFAULT_SERVER);
  const [username, setUsername] = useState(s.username || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState('');
  const connected = Boolean(s.url && s.token);

  async function run(label, fn) {
    setBusy(label);
    try { await fn(); } catch (e) {
      if (e instanceof sync.ConflictError) {
        if (confirm('En el servidor hay una copia más reciente subida desde otro dispositivo.\n\nAceptar = sobrescribirla con la de este móvil.\nCancelar = no hacer nada (puedes bajar la del servidor).')) {
          await sync.pushSnapshot({ force: true });
          toast('Copia subida');
        }
      } else {
        toast(e.message, 'danger');
      }
    } finally { setBusy(''); }
  }

  return (
    <Card className="p-4 flex flex-col gap-3">
      <SectionTitle>Servidor (opcional)</SectionTitle>
      <p className="text-sm text-muted">
        Tu backend de Iron Log guarda una copia de todo al terminar cada sesión y permite pasar los datos a otro dispositivo.
        La app funciona igual sin él.
      </p>
      {connected ? (
        <>
          <p className="text-sm">
            Conectado a <span className="font-mono text-xs break-all">{s.url}</span> como <span className="font-semibold">{s.username}</span>.
            <br /><span className="text-muted">Última subida: {fmtWhen(s.lastSyncAt)}</span>
          </p>
          {s.lastError && <p className="text-sm text-danger">{s.lastError}</p>}
          <Toggle checked={s.autoSync} onChange={(v) => store.updateServer({ autoSync: v })} label="Subir copia al terminar cada sesión" />
          <Button disabled={Boolean(busy)} onClick={() => run('push', async () => { await sync.pushSnapshot(); toast('Copia subida al servidor'); })}>
            {busy === 'push' ? 'Subiendo…' : 'Subir copia ahora'}
          </Button>
          <Button variant="ghost" disabled={Boolean(busy)} onClick={() => run('pull', async () => {
            if (!confirm('Se sustituirán los datos de este móvil por la copia del servidor. ¿Seguir?')) return;
            const r = await sync.pullSnapshot();
            toast(r ? 'Copia del servidor restaurada' : 'El servidor no tiene ninguna copia todavía');
          })}>{busy === 'pull' ? 'Bajando…' : 'Restaurar la copia del servidor'}</Button>
          <Button variant="ghost" disabled={Boolean(busy)} onClick={() => run('legacy', async () => {
            const r = await sync.importLegacy();
            toast(`Importadas ${r.sessions} sesiones y ${r.exercises} ejercicios de la versión anterior`);
          })}>{busy === 'legacy' ? 'Importando…' : 'Importar sesiones de la versión anterior'}</Button>
          <Button variant="plain" onClick={() => sync.disconnect()}>Desconectar</Button>
        </>
      ) : (
        <>
          {s.lastError && <p className="text-sm text-danger">{s.lastError}</p>}
          <Input label="URL del servidor" value={url} onChange={(e) => setUrl(e.target.value)} autoCapitalize="none" autoCorrect="off" inputMode="url" />
          <Input label="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" />
          <Input label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <Button disabled={Boolean(busy) || !url || !username || !password} onClick={() => run('connect', async () => {
            await sync.connect({ url, username, password });
            setPassword('');
            toast('Conectado al servidor');
          })}>{busy === 'connect' ? 'Conectando…' : 'Conectar'}</Button>
        </>
      )}
    </Card>
  );
}
