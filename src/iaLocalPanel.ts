/**
 * IA Local Panel — WebviewViewProvider
 * Provides a VS Code sidebar panel for managing local AI models (transformers.js).
 *
 * Autor: Javier Mateo (ApliArte)
 */

import * as vscode from 'vscode';
import {
  detectarBackends,
  instalarDepsTransformers,
  cargarModeloLocal,
  descargarModelo,
  isModelLoaded,
  getCurrentModelId,
  scanInstalledModels,
  IAConfig,
  InstalledModel,
  checkMemoryForModel,
  getApliArteAiModelsDirFromConfig,
  validateSharedModelsDir,
  downloadModelSecure,
  SecureDownloadResult,
  validateModelIdForDownload,
  refinarConIA,
} from './iaLocal';
import { MotorCorrector } from './corrector';
import {
  filterCompatibleModels,
  toSearchResultModel,
  type HFModelSearchResult,
} from './hfModelSearch';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ModelEntry {
  id: string;
  label: string;
  size: string;
  recommended?: boolean;
}

const RECOMMENDED_MODELS: ModelEntry[] = [
  {
    id: 'onnx-community/SmolLM2-360M-Instruct',
    label: 'SmolLM2 360M (mínimo)',
    size: '~250MB',
    recommended: false,
  },
  {
    id: 'onnx-community/Qwen2.5-0.5B-Instruct',
    label: 'Qwen 2.5 0.5B (recomendado)',
    size: '~350MB',
    recommended: true,
  },
];

export class IAPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'corrector.iaLocalPanel';

  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;
  private readonly _globalState: vscode.Memento;
  private readonly _getMotor?: () => MotorCorrector;

  constructor(
    extensionUri: vscode.Uri,
    globalState: vscode.Memento,
    getMotor?: () => MotorCorrector,
  ) {
    this._extensionUri = extensionUri;
    this._globalState = globalState;
    this._getMotor = getMotor;
  }

  dispose(): void {
    this._view = undefined;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data: Record<string, any>) => {
      const command: string = data.command || data.type;

      try {
        switch (command) {
          case 'webviewReady':
            // Send initial state
            this._sendStatus();
            this._post({ type: 'recommendedModels', models: RECOMMENDED_MODELS });
            break;

          case 'corregirTexto': {
            const texto = typeof data.text === 'string' ? data.text : '';
            if (!texto.trim()) {
              this._post({
                type: 'resultadoCorreccion',
                textoOriginal: '',
                textoCorregido: '',
                correcciones: [],
                totalCorrecciones: 0,
                idioma: 'es',
                refinadoIa: null,
              });
              break;
            }

            const motor = this._getMotor ? this._getMotor() : undefined;
            const res = motor ? motor.corregir(texto) : {
              textoOriginal: texto,
              textoCorregido: texto,
              correcciones: [],
              totalCorrecciones: 0,
              idioma: 'es' as const,
            };

            let refinadoIa: string | null = null;
            if (data.usarIa || isModelLoaded()) {
              const cfg = vscode.workspace.getConfiguration('corrector');
              const rawBackend = cfg.get<string>('iaBackend', 'auto');
              let backend: IAConfig['backend'] = 'none';
              if (isModelLoaded()) {
                backend = 'transformers';
              } else if (rawBackend === 'ollama' || rawBackend === 'lmstudio' || rawBackend === 'transformers') {
                backend = rawBackend;
              }

              const iaConfig: IAConfig = {
                backend,
                ollamaEndpoint: cfg.get<string>('ollamaEndpoint', 'http://localhost:11434'),
                lmstudioEndpoint: cfg.get<string>('lmstudioEndpoint', 'http://localhost:1234/v1'),
                ollamaModel: cfg.get<string>('ollamaModel', ''),
              };
              try {
                const base = res.totalCorrecciones > 0 ? res.textoCorregido : texto;
                const ref = await refinarConIA(base, iaConfig);
                if (ref && ref.textoRefinado && ref.textoRefinado !== base) {
                  refinadoIa = ref.textoRefinado;
                }
              } catch {
                // Silently ignore IA failure
              }
            }

            this._post({
              type: 'resultadoCorreccion',
              textoOriginal: res.textoOriginal,
              textoCorregido: res.textoCorregido,
              correcciones: res.correcciones,
              totalCorrecciones: res.totalCorrecciones,
              idioma: res.idioma,
              refinadoIa,
            });
            break;
          }

          case 'enviarAChat': {
            const texto = typeof data.text === 'string' ? data.text : '';
            if (texto.trim()) {
              await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: texto,
                isPartialQuery: false,
              });
            }
            break;
          }

          case 'copiarTexto': {
            const texto = typeof data.text === 'string' ? data.text : '';
            if (texto) {
              await vscode.env.clipboard.writeText(texto);
              this._post({ type: 'textoCopiado' });
            }
            break;
          }

          case 'requestStatus':
            this._sendStatus();
            break;

          case 'requestRecommendedModels':
            this._post({ type: 'recommendedModels', models: RECOMMENDED_MODELS });
            break;

          case 'installDeps':
            await this._installDeps();
            break;

          case 'loadModel':
            await this._loadModel(data.modelId as string);
            break;

          case 'unloadModel':
            await this._unloadModel();
            break;

          case 'chooseModelsDir':
            await this._chooseModelsDir();
            break;

          case 'searchHuggingFace':
            await this._searchHuggingFace(data.query as string);
            break;

          case 'downloadModel':
            await this._downloadModel(data.modelId as string);
            break;

          case 'requestInstalledModels': {
            const modelsDir = this._getModelsDir();
            const installed: InstalledModel[] = scanInstalledModels(modelsDir);
            this._post({ type: 'installedModels', models: installed });
            break;
          }

          case 'useSharedFolder':
            if (data.path && typeof data.path === 'string') {
              await this._globalState.update('iaLocal_modelsDir', data.path);
              try {
                await vscode.workspace
                  .getConfiguration('corrector')
                  .update('modelsDir', data.path, vscode.ConfigurationTarget.Global);
              } catch {
                // Main process schema cache fallback: globalState already persisted
              }
              await this._sendStatus();
            }
            break;

          case 'openExtension': {
            const ext = data.id as string;
            if (ext === 'apliarte-ai') {
              const hasAi = Boolean(vscode.extensions?.getExtension?.('apliarte.apliarte-ai'));
              if (hasAi) {
                try {
                  await vscode.commands.executeCommand('apliarteAi.chatView.focus');
                } catch {
                  await vscode.commands.executeCommand('workbench.view.extension.apliarteAi');
                }
              } else {
                await vscode.commands.executeCommand('workbench.extensions.search', 'apliarte.apliarte-ai');
              }
            } else if (ext === 'keymaster') {
              const hasKm = Boolean(
                vscode.extensions?.getExtension?.('apliarte.keymaster') ||
                vscode.extensions?.getExtension?.('apliarte.key-master')
              );
              if (hasKm) {
                try {
                  await vscode.commands.executeCommand('keymasterShortcuts.focus');
                } catch {
                  await vscode.commands.executeCommand('workbench.view.extension.keymasterShortcuts');
                }
              } else {
                await vscode.commands.executeCommand('workbench.extensions.search', 'apliarte.keymaster');
              }
            }
            break;
          }

          case 'disableIaLocal':
            await this._disableIaLocal();
            break;

          default:
            break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this._post({ type: 'error', message: msg });
      }
    });
  }

  // ── Webview message helper ──────────────────────────────────────────────

  private _post(data: Record<string, any>): void {
    this._view?.webview.postMessage(data);
  }

  // ── Status ──────────────────────────────────────────────────────────────

  private async _sendStatus(): Promise<void> {
    const modelsDir = this._getModelsDir();
    const installed: InstalledModel[] = scanInstalledModels(modelsDir);
    const currentModelId = getCurrentModelId();
    const isLoaded = isModelLoaded();

    let memoryInfo: { available: number; required: number } | null = null;
    if (currentModelId) {
      const memCheck = await checkMemoryForModel(currentModelId);
      memoryInfo = { available: memCheck.available, required: memCheck.required };
    }

    // Detectar y validar carpeta compartida con apliarte-ai
    let sharedFolderInfo: {
      isShared: boolean;
      path?: string;
      valid?: boolean;
      modelCount?: number;
      reason?: string;
    } = { isShared: false };

    const apliarteDir = getApliArteAiModelsDirFromConfig(vscode);
    if (apliarteDir) {
      const validation = await validateSharedModelsDir(apliarteDir);
      sharedFolderInfo = {
        isShared: true,
        path: apliarteDir,
        valid: validation.valid,
        modelCount: validation.modelCount,
        reason: validation.reason,
      };
    }

    this._post({
      type: 'statusUpdate',
      isModelLoaded: isLoaded,
      isDepsInstalled: this._areDepsInstalled(),
      modelsDir,
      currentModel: currentModelId,
      installedModels: installed,
      memoryInfo,
      sharedFolder: sharedFolderInfo,
    });

    const hasAi = Boolean(vscode.extensions?.getExtension?.('apliarte.apliarte-ai'));
    const hasKm = Boolean(
      vscode.extensions?.getExtension?.('apliarte.keymaster') ||
      vscode.extensions?.getExtension?.('apliarte.key-master')
    );
    this._post({
      type: 'ecosystemStatus',
      installed: {
        'apliarte-ai': hasAi,
        'corrector': true,
        'keymaster': hasKm,
      },
    });
  }

  private _getModelsDir(): string {
    const fromGlobal = this._globalState.get<string>('iaLocal_modelsDir', '');
    if (fromGlobal && fromGlobal.trim()) {
      return fromGlobal.trim();
    }
    const explicit = vscode.workspace.getConfiguration('corrector').get<string>('modelsDir', '');
    if (explicit && explicit.trim()) {
      return explicit.trim();
    }
    const apliarteDir = getApliArteAiModelsDirFromConfig(vscode);
    if (apliarteDir && apliarteDir.trim()) {
      return apliarteDir.trim();
    }
    return '';
  }

  private _areDepsInstalled(): boolean {
    // Read from globalState cache set by installer
    return this._globalState.get<boolean>('iaLocal_depsInstalled', false);
  }

  /**
   * Apaga la IA local desde el propio panel, cuando el preflight de memoria
   * impide cargar un modelo. Es la misma salida que ofrece el aviso de arranque
   * en ApliArte AI: el usuario no se queda encerrado con un aviso sin acción.
   */
  private async _disableIaLocal(): Promise<void> {
    await vscode.workspace
      .getConfiguration('corrector')
      .update('iaLocal', false, vscode.ConfigurationTarget.Global);
    this._post({ type: 'iaLocalDisabled' });
    await this._sendStatus();
  }

  // ── Install deps ─────────────────────────────────────────────────────────

  private async _installDeps(): Promise<void> {
    this._post({
      type: 'progress',
      message: 'Instalando transformers.js…',
      progress: 0,
    });

    await instalarDepsTransformers((msg: string) => {
      this._post({ type: 'progress', message: msg });
    });

    // Cache installed state
    await this._globalState.update('iaLocal_depsInstalled', true);

    this._post({ type: 'depsInstalled' });
    this._post({
      type: 'progress',
      message: 'transformers.js instalado.',
      progress: 100,
    });

    // Hide progress after a short delay
    setTimeout(() => {
      this._post({ type: 'statusUpdate' });
    }, 1500);
  }

  // ── Load model ───────────────────────────────────────────────────────────

  private async _loadModel(modelId: string): Promise<void> {
    // Validate model ID — no path traversal
    if (!modelId || typeof modelId !== 'string') {
      this._post({ type: 'error', message: 'ID de modelo no válido.' });
      return;
    }
    if (modelId.includes('..') || modelId.includes('/../')) {
      this._post({ type: 'error', message: 'Modelo no válido.' });
      return;
    }

    if (!this._areDepsInstalled()) {
      this._post({
        type: 'error',
        message: 'Instala primero transformers.js (botón Instalar).',
      });
      return;
    }

    // Pre-check memory and show warning to user before starting
    const memCheck = await checkMemoryForModel(modelId);
    if (!memCheck.ok) {
      // Se ofrece desactivar la IA local: si no hay memoria ni para arrancar,
      // el usuario necesita una salida, no solo un aviso.
      this._post({
        type: 'error',
        message: memCheck.warning ?? 'Memoria insuficiente.',
        canDisableIaLocal: true,
      });
      return;
    }
    if (memCheck.warning) {
      // Show warning but allow proceeding
      this._post({
        type: 'warning',
        message: memCheck.warning,
        modelId,
        canDisableIaLocal: true,
      });
      // Wait for user to acknowledge (they'll click load again)
      return;
    }

    this._post({
      type: 'progress',
      message: 'Descargando modelo…',
      progress: 0,
    });

    try {
      // Download the model
      await cargarModeloLocal(modelId, (info: { status: string; progress?: number; file?: string }) => {
        const pct = info.progress != null ? Math.round(info.progress) : null;
        this._post({
          type: 'progress',
          message: `${info.status}${info.file ? ' — ' + info.file.slice(0, 40) : ''}`,
          progress: pct,
        });
      });

      await this._globalState.update('iaLocal_currentModel', modelId);
      this._post({ type: 'modelLoaded', modelId });
      this._post({ type: 'statusUpdate' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._post({ type: 'error', message: 'Error cargando modelo: ' + msg });
    }
  }

  // ── Unload model ────────────────────────────────────────────────────────

  private async _unloadModel(): Promise<void> {
    try {
      await descargarModelo();
      await this._globalState.update('iaLocal_currentModel', undefined);
      this._post({ type: 'modelUnloaded' });
      this._post({ type: 'statusUpdate' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._post({ type: 'error', message: 'Error liberando modelo: ' + msg });
    }
  }

  // ── Choose models folder ─────────────────────────────────────────────────

  private async _chooseModelsDir(): Promise<void> {
    const result = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Elegir carpeta de modelos',
      title: 'Carpeta donde se guardarán los modelos de IA local',
    });

    if (!result || result.length === 0) {
      return;
    }

    const folderPath = result[0].fsPath;

    // Basic path traversal check
    if (folderPath.includes('..')) {
      vscode.window.showErrorMessage(
        'La ruta contiene elementos no válidos.',
      );
      return;
    }

    await this._globalState.update('iaLocal_modelsDir', folderPath);
    try {
      const cfg = vscode.workspace.getConfiguration('corrector');
      await cfg.update('modelsDir', folderPath, vscode.ConfigurationTarget.Global);
    } catch {
      // Main process schema cache fallback
    }

    await this._sendStatus();
  }

  // ── HuggingFace search ──────────────────────────────────────────────────

  private async _searchHuggingFace(query: string): Promise<void> {
    if (!query || query.trim().length < 3) {
      this._post({ type: 'searchResults', results: [] });
      return;
    }

    const q = encodeURIComponent(query.trim());

    try {
      // Search for ONNX/Transformers.js compatible models
      // Use tags filter for ONNX and sort by downloads
      const url = `https://huggingface.co/api/models?q=${q}&filter=onnx&sort=downloads&direction=-1&limit=15`;

      const res = await fetch(url);

      if (!res.ok) {
        this._post({
          type: 'searchResults',
          results: [],
        });
        return;
      }

      const data = (await res.json()) as HFModelSearchResult[];

      // Get installed models to determine status
      const modelsDir = this._getModelsDir();
      const installed: InstalledModel[] = scanInstalledModels(modelsDir);
      const installedIds = new Set(installed.map(m => m.id));
      const currentModelId = getCurrentModelId();
      const isModelLoadedNow = isModelLoaded();

      const results = filterCompatibleModels(data).map((m) =>
        toSearchResultModel(m, {
          installedIds,
          currentModelId,
          isLoaded: isModelLoadedNow,
        }),
      );

      this._post({ type: 'searchResults', results });
    } catch {
      // Network errors → silently return empty results
      this._post({ type: 'searchResults', results: [] });
    }
  }

  // ── Download model ────────────────────────────────────────────────────────

  private async _downloadModel(modelId: string): Promise<void> {
    const modelsDir = this._getModelsDir();
    if (!modelsDir) {
      this._post({ type: 'error', message: 'Configura primero la carpeta de modelos (botón "Elegir carpeta…")' });
      return;
    }

    // Validate model ID
    const validation = validateModelIdForDownload(modelId);
    if (!validation.allowed) {
      this._post({ type: 'error', message: validation.reason ?? 'Modelo no permitido' });
      return;
    }

    // Check memory before downloading
    const memCheck = await checkMemoryForModel(modelId);
    if (!memCheck.ok) {
      this._post({
        type: 'error',
        message: memCheck.warning ?? 'Memoria insuficiente para descargar este modelo.',
        canDisableIaLocal: true,
      });
      return;
    }

    this._post({
      type: 'progress',
      message: 'Descargando modelo…',
      progress: 0,
    });

    try {
      const result: SecureDownloadResult = await downloadModelSecure(
        modelId,
        modelsDir,
        (info: { status: string; progress?: number; downloaded?: number; total?: number }) => {
          const pct = info.progress != null ? Math.round(info.progress) : null;
          this._post({
            type: 'progress',
            message: info.status,
            progress: pct,
          });
        }
      );

      if (!result.success) {
        this._post({ type: 'error', message: result.error ?? 'Error en la descarga' });
        return;
      }

      // Refresh installed models list
      const installed: InstalledModel[] = scanInstalledModels(modelsDir);
      this._post({ type: 'installedModels', models: installed });
      this._post({ type: 'downloadComplete', modelId });

      // Also refresh search results if they're visible
      // We could re-search, but for now just notify
      this._post({ type: 'statusUpdate' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._post({ type: 'error', message: 'Error descargando modelo: ' + msg });
    }
  }

  // ── HTML ────────────────────────────────────────────────────────────────

  private _getHtml(webview: vscode.Webview): string {
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'iaLocal.css'),
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'iaLocal.js'),
    );
    const iconCorrectorUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'icons', 'corrector.png'),
    );
    const iconAiUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'icons', 'apliarte-ai.png'),
    );
    const iconKeymasterUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'icons', 'keymaster.png'),
    );

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' ${webview.cspSource ?? ''}; script-src 'self' ${webview.cspSource ?? ''}; style-src 'self' ${webview.cspSource ?? ''} 'unsafe-inline'; connect-src https://huggingface.co;">
  <link rel="stylesheet" href="${cssUri}">
  <title>Corrector e IA Local</title>
</head>
<body>
  <!-- Barra de Navegación del Ecosistema ApliArte -->
  <header class="ecosystem-bar">
    <div class="ecosystem-brand">
      <span class="ecosystem-title">APLIARTE</span>
    </div>
    <div class="ecosystem-apps">
      <button class="app-btn active" id="btn-app-corrector" data-id="corrector" title="Corrector (Activo)">
        <img src="${iconCorrectorUri}" alt="Corrector" class="app-icon" />
        <span class="app-dot active"></span>
      </button>
      <button class="app-btn" id="btn-app-ai" data-id="apliarte-ai" title="ApliArte AI">
        <img src="${iconAiUri}" alt="ApliArte AI" class="app-icon" />
        <span class="app-dot" id="dot-app-ai"></span>
      </button>
      <button class="app-btn" id="btn-app-keymaster" data-id="keymaster" title="KeyMaster">
        <img src="${iconKeymasterUri}" alt="KeyMaster" class="app-icon" />
        <span class="app-dot" id="dot-app-keymaster"></span>
      </button>
    </div>
  </header>

  <!-- Theme toggle (mantenido oculto por compatibilidad) -->
  <div id="theme-toggle" class="hidden" aria-hidden="true">
    <svg id="icon-sun" class="hidden" aria-hidden="true"></svg>
    <svg id="icon-moon" class="hidden" aria-hidden="true"></svg>
  </div>

  <!-- Content -->
  <div id="content">
    <!-- SECCIÓN 1: CORRECTOR RÁPIDO DIRECTO -->
    <section id="corrector-section" class="corrector-card">
      <div class="section-header-row">
        <div class="section-title-wrap">
          <span class="section-icon">✍️</span>
          <span class="section-header">Corrector Rápido</span>
        </div>
        <span id="char-counter" class="subtle-count">0 caracteres</span>
      </div>

      <div class="input-wrap">
        <textarea
          id="editor-input"
          placeholder="Escribe o pega aquí tu texto o prompt para corregir..."
          rows="4"
          spellcheck="false"
        ></textarea>
      </div>

      <div class="action-buttons-row">
        <button id="btn-corregir" class="btn btn-primary" title="Corregir ortografía y gramática">
          ✏️ Corregir
        </button>
        <button id="btn-enviar-chat" class="btn" title="Enviar texto corregido directamente al Chat de Antigravity / Copilot" disabled>
          🚀 Enviar al Chat
        </button>
        <button id="btn-copiar-resultado" class="btn" title="Copiar texto al portapapeles" disabled>
          📋 Copiar
        </button>
      </div>

      <!-- Contenedor de resultado de corrección -->
      <div id="resultado-wrap" class="hidden">
        <div class="resultado-header-row">
          <span id="badge-resultado" class="badge"></span>
          <span id="label-idioma" class="subtle-count"></span>
        </div>

        <div id="box-texto-corregido" class="result-box" contenteditable="true" title="Texto corregido (puedes editarlo si quieres)"></div>

        <div id="lista-cambios" class="cambios-wrap hidden"></div>
      </div>
    </section>

    <!-- SECCIÓN 2: IA LOCAL Y MODELOS (PLEGABLE) -->
    <details id="details-ia-local" class="accordion-section">
      <summary class="accordion-summary">
        <span class="accordion-icon">🧠</span>
        <span class="accordion-title">Modelos e IA Local (Opcional)</span>
      </summary>

      <div class="accordion-body">
        <!-- Status bar -->
        <div id="status-bar">
          <div id="status-dot" class="no-deps"></div>
          <div id="status-label">IA local: sin instalar</div>
          <div id="current-model"></div>
        </div>

        <!-- Recommended models -->
        <section class="inner-block">
          <div class="section-header">Modelos recomendados</div>
          <p class="section-desc">
            Para corrección ortográfica no hace falta un modelo grande.
            Qwen 2.5 0.5B es suficiente y usa poca memoria.
          </p>
          <div id="recommended-models"></div>
        </section>

        <!-- Installed models -->
        <section class="inner-block">
          <div class="section-header" id="installed-section-header" style="display:none;">Modelos en disco</div>
          <p class="section-desc" id="installed-description" hidden>
            Modelos ya descargados que puedes cargar directamente.
          </p>
          <div id="installed-models"></div>
        </section>

        <!-- Progress -->
        <div id="progress-section">
          <div id="progress-label">Procesando…</div>
          <div id="progress-track">
            <div id="progress-fill"></div>
          </div>
        </div>

        <!-- Error -->
        <div id="error-section"></div>

        <!-- Folder -->
        <section class="inner-block">
          <div class="section-header">Carpeta de modelos</div>
          <div id="folder-section">
            <div id="folder-path" class="empty">Sin carpeta configurada</div>
            <div id="folder-actions">
              <button class="btn" id="btn-choose-folder">Elegir carpeta…</button>
              <div id="shared-notice" class="hidden">📁 Carpeta compartida con ApliArte AI</div>
            </div>
          </div>

          <!-- Shared folder with ApliArte AI -->
          <div id="shared-folder-section" class="hidden">
            <div class="section-header">📁 Carpeta detectada en ApliArte AI</div>
            <div id="shared-folder-info">
              <div id="shared-folder-path" class="path"></div>
              <div id="shared-folder-status"></div>
              <div id="shared-folder-actions"></div>
            </div>
          </div>
        </section>

        <!-- Search -->
        <section class="inner-block">
          <div class="section-header">Buscar modelos</div>
          <div id="search-section">
            <div id="search-input-row">
              <input
                id="search-input"
                type="text"
                placeholder="Buscar en HuggingFace (3+ caracteres)…"
                autocomplete="off"
                spellcheck="false"
              />
              <button class="btn" id="btn-search">Buscar</button>
            </div>
            <div id="search-results"></div>
          </div>
        </section>
      </div>
    </details>
  </div>

  <script src="${jsUri}"></script>
</body>
</html>`;
  }
}
