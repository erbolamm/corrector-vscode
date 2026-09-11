/**
 * Tests para iaLocalPanel — contrato del panel de IA local.
 *
 * Cubre cuatro cosas que se rompen en silencio cuando nadie las vigila:
 *  1. Las opciones del webview y su CSP (postura de seguridad).
 *  2. El cableado de ids entre el HTML que genera el panel y media/iaLocal.js.
 *  3. El enrutado de mensajes del webview (y que un comando malo no rompa nada).
 *  4. El preflight de memoria y su salida: poder desactivar la IA local.
 *
 * `vscode` y `./iaLocal` se sustituyen por dobles antes de cargar el panel. Los
 * dobles no son un capricho: sin ellos estos tests dependerían de la RAM libre de
 * la máquina y del caché de HuggingFace del que los ejecuta, y fallarían en otro
 * equipo sin que nada estuviera roto.
 *
 * Por eso el panel se carga con require() y no con import: un import se evalúa
 * antes que cualquier línea del test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '..', '..');
const GB = 1024 ** 3;

// ─── Doble de vscode ──────────────────────────────────────────────────────────

interface FakeUri {
  fsPath: string;
  toString(): string;
}

const configUpdates: Array<{ key: string; value: unknown }> = [];

const vscodeStub = {
  Uri: {
    file: (p: string): FakeUri => ({ fsPath: p, toString: () => `file://${p}` }),
    joinPath: (base: FakeUri, ...parts: string[]): FakeUri => {
      const joined = [base.fsPath, ...parts].join('/');
      return { fsPath: joined, toString: () => `file://${joined}` };
    },
  },
  workspace: {
    getConfiguration: (_section?: string) => ({
      get: <T>(_key: string, fallback?: T): T | undefined => fallback,
      update: (key: string, value: unknown): Promise<void> => {
        configUpdates.push({ key, value });
        return Promise.resolve();
      },
    }),
  },
  window: {
    showErrorMessage: (): Promise<undefined> => Promise.resolve(undefined),
    showOpenDialog: (): Promise<undefined> => Promise.resolve(undefined),
  },
  ConfigurationTarget: { Global: 1 },
};

// ─── Doble de iaLocal ─────────────────────────────────────────────────────────

interface IaLocalDoble {
  memoriaLibre: number;
  modelosInstalados: unknown[];
  modeloActual: string | null;
}

const iaLocal: IaLocalDoble = {
  memoriaLibre: 8 * GB,
  modelosInstalados: [],
  modeloActual: null,
};

const iaLocalStub = {
  async checkMemoryForModel(_modelId: string) {
    const reservado = 1.5 * GB;
    const util = iaLocal.memoriaLibre - reservado;
    const requerido = 300 * 1024 ** 2;
    if (util < 0) {
      return {
        ok: false,
        available: iaLocal.memoriaLibre,
        required: requerido,
        warning: 'Memoria disponible muy baja. VS Code necesita ~1.5 GB.',
      };
    }
    if (requerido > util) {
      return {
        ok: true,
        available: iaLocal.memoriaLibre,
        required: requerido,
        warning: 'El modelo requiere más memoria de la disponible.',
      };
    }
    return { ok: true, available: iaLocal.memoriaLibre, required: requerido };
  },
  estimateModelSize: () => 300 * 1024 ** 2,
  formatBytes: (bytes: number) => `${(bytes / GB).toFixed(1)} GB`,
  scanInstalledModels: () => iaLocal.modelosInstalados,
  isModelLoaded: () => iaLocal.modeloActual !== null,
  getCurrentModelId: () => iaLocal.modeloActual,
  getApliArteAiModelsDirFromConfig: () => null,
  validateSharedModelsDir: async () => ({ valid: true, modelCount: 0 }),
  detectarBackends: async () => [],
  refinarConIA: async () => '',
  instalarDepsTransformers: async () => undefined,
  cargarModeloLocal: async () => undefined,
  descargarModelo: async () => undefined,
  downloadModelSecure: async () => undefined,
  validateModelIdForDownload: () => ({ allowed: true }),
  removeModelDir: () => undefined,
  setDepsDirectory: () => undefined,
};

// ─── Carga del panel con los dobles puestos ───────────────────────────────────

interface ModuleLoader {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
}

const loader = require('node:module') as ModuleLoader;
const originalLoad = loader._load;
loader._load = function (request: string, parent: unknown, isMain: boolean): unknown {
  if (request === 'vscode') {
    return vscodeStub;
  }
  const desdeElPanel =
    typeof (parent as { filename?: string })?.filename === 'string' &&
    (parent as { filename: string }).filename.endsWith('iaLocalPanel.js');
  if (request === './iaLocal' && desdeElPanel) {
    return iaLocalStub;
  }
  return originalLoad.call(this as unknown as ModuleLoader, request, parent, isMain);
};

interface GlobalStateLike {
  get<T>(key: string, fallback?: T): T | undefined;
  update(key: string, value: unknown): Promise<void>;
}

interface PanelProviderInstance {
  resolveWebviewView(view: unknown, context: unknown, token: unknown): void;
  dispose(): void;
}

interface PanelProviderClass {
  new (extensionUri: FakeUri, globalState: GlobalStateLike): PanelProviderInstance;
  readonly viewType: string;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { IAPanelProvider } = require('../src/iaLocalPanel.js') as {
  IAPanelProvider: PanelProviderClass;
};

// ─── Arnés ────────────────────────────────────────────────────────────────────

interface PostedMessage {
  type?: string;
  [key: string]: unknown;
}

interface Harness {
  provider: PanelProviderInstance;
  posted: PostedMessage[];
  updates: Array<{ key: string; value: unknown }>;
  html: () => string;
  options: () => { enableScripts?: boolean; localResourceRoots?: FakeUri[] };
  deliver: (data: unknown) => void;
  types: () => string[];
}

interface HarnessOptions {
  /** Estado que devuelve globalState.get(key, fallback). */
  globalState?: Record<string, unknown>;
  /** Memoria libre simulada, en bytes. */
  memoriaLibre?: number;
  modeloActual?: string | null;
}

function createHarness(opciones: HarnessOptions = {}): Harness {
  const posted: PostedMessage[] = [];
  let onMessage: ((data: unknown) => unknown) | undefined;
  let assignedOptions: { enableScripts?: boolean; localResourceRoots?: FakeUri[] } = {};
  let assignedHtml = '';

  configUpdates.length = 0;
  iaLocal.memoriaLibre = opciones.memoriaLibre ?? 8 * GB;
  iaLocal.modelosInstalados = [];
  iaLocal.modeloActual = opciones.modeloActual ?? null;

  const webview = {
    get options() {
      return assignedOptions;
    },
    set options(value: { enableScripts?: boolean; localResourceRoots?: FakeUri[] }) {
      assignedOptions = value;
    },
    get html() {
      return assignedHtml;
    },
    set html(value: string) {
      assignedHtml = value;
    },
    asWebviewUri: (uri: FakeUri) => ({ toString: () => `webview://test/${uri.toString()}` }),
    postMessage: (data: PostedMessage) => {
      posted.push(data);
      return Promise.resolve(true);
    },
    onDidReceiveMessage: (cb: (data: unknown) => unknown) => {
      onMessage = cb;
      return { dispose: () => undefined };
    },
  };

  const globalStateValues = opciones.globalState ?? {};
  const globalState: GlobalStateLike = {
    get: <T>(key: string, fallback?: T): T | undefined =>
      key in globalStateValues ? (globalStateValues[key] as T) : fallback,
    update: (): Promise<void> => Promise.resolve(),
  };

  const provider = new IAPanelProvider(
    { fsPath: rootDir, toString: () => `file://${rootDir}` },
    globalState,
  );
  provider.resolveWebviewView({ webview }, {}, {});

  return {
    provider,
    posted,
    updates: configUpdates,
    html: () => assignedHtml,
    options: () => assignedOptions,
    deliver: (data: unknown) => {
      onMessage?.(data);
    },
    types: () => posted.map((m) => m.type ?? '(sin type)'),
  };
}

/** Deja correr las microtareas y los timers ya vencidos. */
const tick = (): Promise<void> => new Promise<void>((resolve) => setImmediate(resolve));

function leerMedia(nombre: string): string {
  return fs.readFileSync(path.join(rootDir, 'media', nombre), 'utf8');
}

const conDeps = (extra: HarnessOptions = {}): Harness =>
  createHarness({ globalState: { iaLocal_depsInstalled: true }, ...extra });

// ─── Opciones del webview ─────────────────────────────────────────────────────

describe('iaLocalPanel · opciones del webview', () => {
  it('declara el viewType que espera package.json', () => {
    assert.equal(IAPanelProvider.viewType, 'corrector.iaLocalPanel');
  });

  it('habilita scripts, porque el panel los necesita', () => {
    assert.equal(createHarness().options().enableScripts, true);
  });

  it('acota localResourceRoots a la extensión y no al disco entero', () => {
    const roots = createHarness().options().localResourceRoots;
    assert.equal(roots?.length, 1);
    assert.equal(roots?.[0].fsPath, rootDir);
  });

  it('sirve un HTML con contenido', () => {
    assert.ok(createHarness().html().length > 500);
  });
});

// ─── CSP y seguridad del HTML ─────────────────────────────────────────────────

describe('iaLocalPanel · CSP y seguridad del HTML', () => {
  it('declara una CSP sin unsafe-inline para scripts', () => {
    const html = createHarness().html();
    const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
    assert.match(csp, /default-src 'self'/);
    const scriptSrc = csp.match(/script-src ([^;]+)/)?.[1] ?? '';
    assert.ok(scriptSrc.includes("'self'"), 'script-src debe permitir el propio webview');
    assert.ok(
      !scriptSrc.includes('unsafe-inline'),
      'script-src no puede permitir unsafe-inline: la CSP estricta es la que hace falta',
    );
  });

  it('no deja manejadores de eventos inline, que la CSP bloquearía', () => {
    const html = createHarness().html();
    assert.equal(/\son[a-z]+\s*=/i.test(html), false, 'hay un on* inline en el HTML');
  });

  it('incluye el interruptor sol/luna que exige el Kit de Marca', () => {
    assert.ok(createHarness().html().includes('id="theme-toggle"'));
  });
});

// ─── Cableado de ids con el script del webview ────────────────────────────────

describe('iaLocalPanel · cableado con media/iaLocal.js', () => {
  it('referencia los dos recursos del panel y existen en disco', () => {
    const html = createHarness().html();
    assert.ok(html.includes('iaLocal.css'), 'el HTML no enlaza iaLocal.css');
    assert.ok(html.includes('iaLocal.js'), 'el HTML no enlaza iaLocal.js');
    assert.ok(fs.existsSync(path.join(rootDir, 'media', 'iaLocal.css')));
    assert.ok(fs.existsSync(path.join(rootDir, 'media', 'iaLocal.js')));
  });

  it('todo id que busca el script existe en el HTML del panel', () => {
    const html = createHarness().html();
    const script = leerMedia('iaLocal.js');

    const ids = new Set<string>();
    for (const match of script.matchAll(/\$\('([^']+)'\)/g)) {
      ids.add(match[1]);
    }
    for (const match of script.matchAll(/getElementById\('([^']+)'\)/g)) {
      ids.add(match[1]);
    }

    assert.ok(
      ids.size >= 10,
      `la extracción de ids se ha roto: solo encontró ${ids.size}`,
    );

    const huerfanos = [...ids].filter((id) => !html.includes(`id="${id}"`));
    assert.deepEqual(
      huerfanos,
      [],
      `ids que el script busca y el HTML no define: ${huerfanos.join(', ')}`,
    );
  });

  it('el botón de desactivar que añade el script cabe en el hueco de mensajes', () => {
    const script = leerMedia('iaLocal.js');
    assert.ok(
      script.includes("'error-section'"),
      'el script ya no usa el hueco donde se pinta el aviso de memoria',
    );
  });
});

// ─── Enrutado de mensajes ─────────────────────────────────────────────────────

describe('iaLocalPanel · enrutado de mensajes', () => {
  it('webviewReady manda los modelos recomendados enseguida', () => {
    const h = createHarness();
    h.deliver({ command: 'webviewReady' });
    assert.ok(h.types().includes('recommendedModels'));
  });

  it('webviewReady manda el estado con el modelo vacío y sin instalados', async () => {
    const h = createHarness();
    h.deliver({ command: 'webviewReady' });
    await tick();

    const status = h.posted.find((m) => m.type === 'statusUpdate');
    assert.ok(status, `no llegó statusUpdate; llegaron: ${h.types().join(', ')}`);
    assert.equal(status.currentModel, null);
    assert.deepEqual(status.installedModels, []);
  });

  it('requestStatus responde con el estado y la carpeta de modelos', async () => {
    const h = createHarness();
    h.deliver({ command: 'requestStatus' });
    await tick();

    const status = h.posted.find((m) => m.type === 'statusUpdate');
    assert.ok(status);
    assert.equal(typeof status.modelsDir, 'string');
  });

  it('acepta type además de command', async () => {
    const h = createHarness();
    h.deliver({ type: 'requestStatus' });
    await tick();
    assert.ok(h.types().includes('statusUpdate'));
  });

  it('un comando desconocido no responde nada y no lanza', () => {
    const h = createHarness();
    assert.doesNotThrow(() => h.deliver({ command: 'comandoQueNoExiste' }));
    assert.deepEqual(h.posted, []);
  });

  it('requestInstalledModels devuelve un array', () => {
    const h = createHarness();
    h.deliver({ command: 'requestInstalledModels' });
    const msg = h.posted.find((m) => m.type === 'installedModels');
    assert.ok(msg);
    assert.ok(Array.isArray(msg.models));
  });
});

// ─── Validación al cargar modelos ─────────────────────────────────────────────

describe('iaLocalPanel · validación de loadModel', () => {
  it('rechaza un id con path traversal', () => {
    const h = createHarness();
    h.deliver({ command: 'loadModel', modelId: '../../etc/passwd' });
    const error = h.posted.find((m) => m.type === 'error');
    assert.ok(error, 'no se rechazó el path traversal');
    assert.equal(error.message, 'Modelo no válido.');
  });

  it('rechaza un id que no es texto', () => {
    const h = createHarness();
    h.deliver({ command: 'loadModel', modelId: 42 });
    assert.equal(h.posted.find((m) => m.type === 'error')?.message, 'ID de modelo no válido.');
  });

  it('pide instalar transformers.js antes de cargar nada', () => {
    const h = createHarness();
    h.deliver({ command: 'loadModel', modelId: 'onnx-community/Qwen2.5-0.5B-Instruct' });
    const error = h.posted.find((m) => m.type === 'error');
    assert.ok(error, 'cargó un modelo sin tener las dependencias');
    assert.match(String(error.message), /Instala primero transformers\.js/);
  });
});

// ─── Preflight de memoria dentro del panel ────────────────────────────────────

describe('iaLocalPanel · memoria y salida del usuario', () => {
  const MODELO = 'onnx-community/Qwen2.5-0.5B-Instruct';

  it('sin memoria ni para arrancar, se ofrece desactivar la IA local', async () => {
    const h = conDeps({ memoriaLibre: 1.0 * GB });
    h.deliver({ command: 'loadModel', modelId: MODELO });
    await tick();

    const error = h.posted.find((m) => m.type === 'error');
    assert.ok(error, 'no avisó de la falta de memoria');
    assert.equal(
      error.canDisableIaLocal,
      true,
      'el aviso no ofrece salida: el usuario se queda encerrado',
    );
  });

  it('con memoria justa avisa pero deja continuar, y también ofrece desactivar', async () => {
    const h = conDeps({ memoriaLibre: 1.6 * GB });
    h.deliver({ command: 'loadModel', modelId: MODELO });
    await tick();

    const aviso = h.posted.find((m) => m.type === 'warning');
    assert.ok(aviso, `no avisó; llegaron: ${h.types().join(', ')}`);
    assert.equal(aviso.modelId, MODELO);
    assert.equal(aviso.canDisableIaLocal, true);
  });

  it('con memoria de sobra carga el modelo de verdad', async () => {
    const h = conDeps({ memoriaLibre: 8 * GB });
    h.deliver({ command: 'loadModel', modelId: MODELO });
    await tick();

    assert.ok(h.types().includes('modelLoaded'), `no cargó; llegaron: ${h.types().join(', ')}`);
    assert.equal(h.posted.some((m) => m.type === 'error'), false);
  });

  it('desactivar desde el panel apaga el ajuste y refresca el estado', async () => {
    const h = createHarness();
    h.deliver({ command: 'disableIaLocal' });
    await tick();

    assert.deepEqual(h.updates, [{ key: 'iaLocal', value: false }]);
    assert.ok(h.types().includes('iaLocalDisabled'), 'no confirmó la desactivación');
    assert.ok(h.types().includes('statusUpdate'), 'no refrescó el estado');
  });
});

// ─── Ciclo de vida ────────────────────────────────────────────────────────────

describe('iaLocalPanel · ciclo de vida', () => {
  it('después de dispose no se postea nada más', () => {
    const h = createHarness();
    h.deliver({ command: 'webviewReady' });
    assert.ok(h.posted.length > 0);

    h.provider.dispose();
    const antes = h.posted.length;
    h.deliver({ command: 'webviewReady' });
    assert.equal(h.posted.length, antes, 'el panel sigue posteando después de dispose()');
  });
});
