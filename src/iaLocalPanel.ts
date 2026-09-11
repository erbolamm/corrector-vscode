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
  estimateModelSize,
  getApliArteAiModelsDirFromConfig,
  validateSharedModelsDir,
} from './iaLocal';

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

  constructor(extensionUri: vscode.Uri, globalState: vscode.Memento) {
    this._extensionUri = extensionUri;
    this._globalState = globalState;
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

          case 'requestInstalledModels': {
            const modelsDir = this._getModelsDir();
            const installed: InstalledModel[] = scanInstalledModels(modelsDir);
            this._post({ type: 'installedModels', models: installed });
            break;
          }

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
  }

  private _getModelsDir(): string {
    return (
      vscode.workspace.getConfiguration('corrector').get<string>('modelsDir', '') || ''
    );
  }

  private _areDepsInstalled(): boolean {
    // Read from globalState cache set by installer
    return this._globalState.get<boolean>('iaLocal_depsInstalled', false);
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
      this._post({ type: 'error', message: memCheck.warning ?? 'Memoria insuficiente.' });
      return;
    }
    if (memCheck.warning) {
      // Show warning but allow proceeding
      this._post({
        type: 'warning',
        message: memCheck.warning,
        modelId,
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

    const cfg = vscode.workspace.getConfiguration('corrector');
    await cfg.update('modelsDir', folderPath, vscode.ConfigurationTarget.Global);

    this._sendStatus();
  }

  // ── HuggingFace search ──────────────────────────────────────────────────

  private async _searchHuggingFace(query: string): Promise<void> {
    if (!query || query.trim().length < 3) {
      this._post({ type: 'searchResults', results: [] });
      return;
    }

    const q = encodeURIComponent(query.trim());

    try {
      // Search for ONNX models compatible with transformers.js
      const url = `https://huggingface.co/api/models?q=${q}&onnx=true&sort=downloads&direction=-1&limit=12`;

      const res = await fetch(url);

      if (!res.ok) {
        this._post({
          type: 'searchResults',
          results: [],
        });
        return;
      }

      const data = (await res.json()) as Array<Record<string, any>>;

      const results = data
        .filter((m) => {
          // Only show models that are likely compatible (small, instruction-tuned)
          const id: string = (m.id || '') as string;
          const downloads: number = (m.downloads || 0) as number;
          // Filter: must be onnx, reasonable downloads, small models preferred
          return (
            (m.gguf || m.onnx || id.includes('onnx')) &&
            downloads > 0
          );
        })
        .slice(0, 10)
        .map((m) => ({
          id: m.id as string,
          repoId: m.id as string,
          downloads: m.downloads as number,
          sha: 'onnx',
          modelId: m.id as string,
        }));

      this._post({ type: 'searchResults', results });
    } catch {
      // Network errors → silently return empty results
      this._post({ type: 'searchResults', results: [] });
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

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src https://huggingface.co;">
  <link rel="stylesheet" href="${cssUri}">
  <title>IA Local — Corrector</title>
</head>
<body>
  <!-- Theme toggle -->
  <div id="theme-toggle" class="theme-toggle" title="Alternar tema claro/oscuro" role="button" tabindex="0" aria-label="Alternar tema claro/oscuro">
    <svg id="icon-sun" class="theme-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="5"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></g></svg>
    <svg id="icon-moon" class="theme-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>
  </div>

  <!-- Status bar -->
  <div id="status-bar">
    <div id="status-dot" class="no-deps"></div>
    <div id="status-label">IA local: sin instalar</div>
    <div id="current-model"></div>
  </div>

  <!-- Content -->
  <div id="content">
    <!-- Recommended models -->
    <section>
      <div class="section-header">Modelos recomendados</div>
      <p style="font-size:10px;color:var(--vscode-descriptionForeground);margin-bottom:6px;">
        Para corrección ortográfica no hace falta un modelo grande.
        Qwen 2.5 0.5B es suficiente y usa poca memoria.
      </p>
      <div id="recommended-models"></div>
    </section>

    <!-- Installed models -->
    <section>
      <div class="section-header" id="installed-section-header" style="display:none;">Modelos en disco</div>
      <p style="font-size:10px;color:var(--vscode-descriptionForeground);margin-bottom:6px;" id="installed-description" hidden>
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
    <section>
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
    <section>
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

  <script src="${jsUri}"></script>
  <script>
    document.getElementById('btn-choose-folder').addEventListener('click', function() {
      window.parent.postMessage({ type: 'vscodeApi', command: 'chooseModelsDir' }, '*');
    });
    document.getElementById('btn-search').addEventListener('click', function() {
      var input = document.getElementById('search-input');
      var query = input.value.trim();
      if (query.length >= 3) {
        window.parent.postMessage({ type: 'vscodeApi', command: 'searchHuggingFace', query: query }, '*');
      }
    });
  </script>
</body>
</html>`;
  }
}
