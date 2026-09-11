/**
 * Motor de IA local para corrección ortográfica.
 * Dos backends: Ollama/LM Studio (si disponible) o transformers.js (autónomo).
 *
 * Autor: Javier Mateo (ApliArte)
 */

import { execFile } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type IABackend = 'none' | 'ollama' | 'lmstudio' | 'transformers';

export interface IAConfig {
    backend: IABackend;
    ollamaEndpoint: string;
    lmstudioEndpoint: string;
    ollamaModel: string;
}

export interface RefinamientoIA {
    textoRefinado: string;
    backend: IABackend;
    modelo: string;
}

export interface InstalledModel {
id: string;
localPath: string;
}

// ─── STATE ──────────────────────────────────────────────────────────────────

let _depsDir: string | null = null;
let _pipelineFn: any = null;
let _generator: any = null;
let _modelLoaded = false;

export const TRANSFORMERS_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';
const PROMPT_CORRECCION = `You are a Spanish spell-checker. Fix ONLY spelling and grammar errors in the following text. Do NOT change meaning, style, or add words. Return ONLY the corrected text, nothing else.

Text: `;

// ─── MEMORY ESTIMATION ───────────────────────────────────────────────────────

/**
 * Estimated model sizes in bytes (q4 quantized).
 * These are rough estimates for the recommended models.
 */
const MODEL_SIZE_ESTIMATES: Record<string, number> = {
  'onnx-community/SmolLM2-360M-Instruct': 280 * 1024 * 1024,     // ~280 MB
  'onnx-community/Qwen2.5-0.5B-Instruct': 380 * 1024 * 1024,      // ~380 MB
};

/**
 * Returns estimated model size in bytes, or a conservative default.
 */
export function estimateModelSize(modelId: string): number {
  return MODEL_SIZE_ESTIMATES[modelId] ?? 500 * 1024 * 1024; // default 500 MB
}

/**
 * Returns available system memory in bytes (best effort, cross-platform).
 * Falls back to a reasonable default if detection fails.
 */
export async function getAvailableMemory(): Promise<number> {
  // Node.js doesn't have a direct API for available memory.
  // We use process.memoryUsage() for heap, but need OS-level free memory.
  // Try to read from /proc/meminfo (Linux) or use sysctl (macOS) or fallback.
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    if (process.platform === 'linux') {
      const { stdout } = await execFileAsync('cat', ['/proc/meminfo']);
      const lines = stdout.split('\n');
      let availableKb = 0;
      for (const line of lines) {
        if (line.startsWith('MemAvailable:')) {
          availableKb = parseInt(line.split(/\s+/)[1], 10);
          break;
        }
      }
      if (availableKb > 0) return availableKb * 1024;
    } else if (process.platform === 'darwin') {
      const { stdout } = await execFileAsync('sysctl', ['-n', 'vm.stats.vm.v_free_count', 'vm.stats.vm.v_page_count']);
      const lines = stdout.trim().split('\n');
      if (lines.length >= 2) {
        const freePages = parseInt(lines[0], 10);
        const pageSize = 4096; // macOS default page size
        return freePages * pageSize;
      }
    }
  } catch {
    // Ignore errors, fall back
  }

  // Conservative fallback: assume 2GB available for VS Code + extension host
  return 2 * 1024 * 1024 * 1024;
}

/**
 * Checks if there's enough memory to load a model.
 * Returns { ok: boolean, available: number, required: number, warning?: string }
 */
export async function checkMemoryForModel(modelId: string): Promise<{
  ok: boolean;
  available: number;
  required: number;
  warning?: string;
}> {
  const required = estimateModelSize(modelId);
  const available = await getAvailableMemory();

  // Reserve 1.5GB for VS Code, OS, other extensions
  const reserved = 1.5 * 1024 * 1024 * 1024;
  const usable = available - reserved;

  if (usable < 0) {
    return {
      ok: false,
      available,
      required,
      warning: `Memoria disponible muy baja (${formatBytes(available)}). VS Code necesita ~1.5 GB.`,
    };
  }

  if (required > usable) {
    return {
      ok: false,
      available,
      required,
      warning: `Modelo requiere ~${formatBytes(required)} pero solo hay ~${formatBytes(usable)} disponibles (reservando 1.5 GB para sistema).`,
    };
  }

  // Warning if tight (less than 500MB headroom)
  if (usable - required < 500 * 1024 * 1024) {
    return {
      ok: true,
      available,
      required,
      warning: `Queda poco margen (${formatBytes(usable - required)}). Considera cerrar otras apps.`,
    };
  }

  return { ok: true, available, required };
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(0) + ' MB';
  }
  return (bytes / 1024).toFixed(0) + ' KB';
}

// ─── PUBLIC API ─────────────────────────────────────────────────────────────

export function setDepsDirectory(dir: string): void {
    _depsDir = dir;
}

/**
 * Detecta qué backends de IA están disponibles localmente.
 */
export async function detectarBackends(config: IAConfig): Promise<IABackend[]> {
    const disponibles: IABackend[] = [];

    // Check Ollama
    if (config.ollamaEndpoint) {
        try {
            const res = await fetch(`${config.ollamaEndpoint}/api/tags`, {
                signal: AbortSignal.timeout(2000),
            });
            if (res.ok) { disponibles.push('ollama'); }
        } catch { /* not available */ }
    }

    // Check LM Studio
    if (config.lmstudioEndpoint) {
        try {
            const res = await fetch(`${config.lmstudioEndpoint}/models`, {
                signal: AbortSignal.timeout(2000),
            });
            if (res.ok) { disponibles.push('lmstudio'); }
        } catch { /* not available */ }
    }

    // Check transformers.js
    if (_modelLoaded || areDepsInstalled()) {
        disponibles.push('transformers');
    }

    return disponibles;
}

/**
 * Refina un texto ya corregido por reglas usando IA local.
 * Retorna null si no hay backend disponible.
 */
export async function refinarConIA(
    texto: string,
    config: IAConfig,
    signal?: AbortSignal,
): Promise<RefinamientoIA | null> {
    // Try Ollama first (best quality, no download needed)
    if (config.backend === 'ollama' || config.backend === 'none') {
        const ollama = await intentarOllama(texto, config, signal);
        if (ollama) { return ollama; }
    }

    // Try LM Studio
    if (config.backend === 'lmstudio' || config.backend === 'none') {
        const lms = await intentarLMStudio(texto, config, signal);
        if (lms) { return lms; }
    }

    // Try transformers.js (last resort — needs download)
    if (config.backend === 'transformers') {
        return await intentarTransformers(texto, signal);
    }

    return null;
}

/**
 * Instala dependencias de transformers.js bajo demanda.
 */
export async function instalarDepsTransformers(
    onProgress?: (msg: string) => void
): Promise<void> {
    const dir = getDepsDir();

    if (areDepsInstalled()) { return; }

    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
        name: 'corrector-ia-local',
        private: true,
        dependencies: {
            '@huggingface/transformers': '^4.0.1',
        },
    }));

    onProgress?.('Instalando transformers.js (primera vez, puede tardar ~1 min)…');

    await new Promise<void>((resolve, reject) => {
        const child = execFile('npm', ['install', '--production'], {
            cwd: dir,
            env: { ...process.env, NODE_ENV: 'production' },
            maxBuffer: 10 * 1024 * 1024,
        }, (error) => {
            if (error) {
                reject(new Error(`npm install falló: ${error.message}`));
            } else {
                resolve();
            }
        });

        child.stderr?.on('data', (data: string) => {
            const line = data.toString().trim();
            if (line) { onProgress?.(line.slice(0, 80)); }
        });
    });
}

/**
 * Carga el modelo de transformers.js.
 * Si ya hay un modelo cargado diferente, lo libera primero (auto-unload).
 * Verifica memoria disponible antes de cargar.
 */
export async function cargarModeloLocal(
    modelId: string = TRANSFORMERS_MODEL,
    onProgress?: (info: { status: string; progress?: number; file?: string }) => void
): Promise<void> {
    // Auto-unload if different model is loaded
    if (_modelLoaded && _currentModelId !== modelId) {
        await descargarModelo();
    }
    if (_modelLoaded && _currentModelId === modelId) {
        return; // Same model already loaded
    }

    // Memory check
    const memCheck = await checkMemoryForModel(modelId);
    if (!memCheck.ok) {
        throw new Error(memCheck.warning ?? 'Memoria insuficiente para cargar el modelo.');
    }
    if (memCheck.warning) {
        onProgress?.({ status: '⚠️ ' + memCheck.warning, progress: 0 });
        // Wait a bit so user sees the warning
        await new Promise(r => setTimeout(r, 1500));
    }

    await ensureImported();

    _generator = await _pipelineFn('text-generation', modelId, {
        dtype: 'q4',
        progress_callback: (data: Record<string, unknown>) => {
            if (onProgress && data.status) {
                onProgress({
                    status: data.status as string,
                    progress: data.progress as number | undefined,
                    file: data.file as string | undefined,
                });
            }
        },
    });

    _modelLoaded = true;
    _currentModelId = modelId;
}

let _currentModelId: string | null = null;

export function isModelLoaded(): boolean {
    return _modelLoaded;
}

export function getCurrentModelId(): string | null {
    return _currentModelId;
}

export async function descargarModelo(): Promise<void> {
    if (_generator) {
        await _generator.dispose?.();
        _generator = null;
        _modelLoaded = false;
        _currentModelId = null;
    }
}

// ─── PRIVATE: OLLAMA ────────────────────────────────────────────────────────

async function intentarOllama(
    texto: string,
    config: IAConfig,
    signal?: AbortSignal,
): Promise<RefinamientoIA | null> {
    const endpoint = config.ollamaEndpoint;
    if (!endpoint) { return null; }

    try {
        // Check if Ollama is running
        const tagsRes = await fetch(`${endpoint}/api/tags`, {
            signal: signal ?? AbortSignal.timeout(2000),
        });
        if (!tagsRes.ok) { return null; }

        // Pick model: user-specified or first available
        let model = config.ollamaModel;
        if (!model) {
            const tags = await tagsRes.json() as { models?: Array<{ name: string }> };
            model = tags.models?.[0]?.name ?? '';
            if (!model) { return null; }
        }

        const res = await fetch(`${endpoint}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt: PROMPT_CORRECCION + texto,
                stream: false,
                options: { temperature: 0.1, num_predict: 512 },
            }),
            signal: signal ?? AbortSignal.timeout(15000),
        });

        if (!res.ok) { return null; }

        const data = await res.json() as { response?: string };
        const refinado = data.response?.trim();
        if (!refinado) { return null; }

        return {
            textoRefinado: refinado,
            backend: 'ollama',
            modelo: model,
        };
    } catch {
        return null;
    }
}

// ─── PRIVATE: LM STUDIO ────────────────────────────────────────────────────

async function intentarLMStudio(
    texto: string,
    config: IAConfig,
    signal?: AbortSignal,
): Promise<RefinamientoIA | null> {
    const endpoint = config.lmstudioEndpoint;
    if (!endpoint) { return null; }

    try {
        const res = await fetch(`${endpoint}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: 'You are a Spanish spell-checker. Fix ONLY spelling and grammar errors. Return ONLY the corrected text.' },
                    { role: 'user', content: texto },
                ],
                temperature: 0.1,
                max_tokens: 512,
                stream: false,
            }),
            signal: signal ?? AbortSignal.timeout(15000),
        });

        if (!res.ok) { return null; }

        const data = await res.json() as {
            choices?: Array<{ message?: { content?: string } }>;
            model?: string;
        };
        const refinado = data.choices?.[0]?.message?.content?.trim();
        if (!refinado) { return null; }

        return {
            textoRefinado: refinado,
            backend: 'lmstudio',
            modelo: data.model ?? 'LM Studio',
        };
    } catch {
        return null;
    }
}

// ─── PRIVATE: TRANSFORMERS.JS ───────────────────────────────────────────────

async function intentarTransformers(
    texto: string,
    signal?: AbortSignal,
): Promise<RefinamientoIA | null> {
    if (!_modelLoaded || !_generator) { return null; }

    try {
        let aborted = false;
        signal?.addEventListener('abort', () => { aborted = true; }, { once: true });

        const messages = [
            { role: 'system', content: 'You are a Spanish spell-checker. Fix ONLY spelling and grammar errors. Return ONLY the corrected text.' },
            { role: 'user', content: texto },
        ];

        const result = await _generator(messages, {
            max_new_tokens: 512,
            temperature: 0.1,
            do_sample: false,
        });

        if (aborted) { return null; }

        // Extract generated text from result
        const generated = Array.isArray(result)
            ? (result[0] as any)?.generated_text
            : (result as any)?.generated_text;

        // The result may include previous messages; extract only the last assistant turn
        let refinado: string;
        if (Array.isArray(generated)) {
            const last = generated[generated.length - 1];
            refinado = (typeof last === 'string' ? last : last?.content ?? '').trim();
        } else {
            refinado = String(generated ?? '').trim();
        }

        if (!refinado) { return null; }

        return {
            textoRefinado: refinado,
            backend: 'transformers',
            modelo: TRANSFORMERS_MODEL.split('/').pop() ?? 'local',
        };
    } catch {
        return null;
    }
}

// ─── PRIVATE: HELPERS ───────────────────────────────────────────────────────

function getDepsDir(): string {
    if (!_depsDir) { throw new Error('Dependencies directory not set.'); }
    return _depsDir;
}

function areDepsInstalled(): boolean {
    if (!_depsDir) { return false; }
    return existsSync(join(_depsDir, 'node_modules', '@huggingface', 'transformers'));
}

async function ensureImported(): Promise<void> {
    if (_pipelineFn) { return; }

    if (!areDepsInstalled()) {
        throw new Error('transformers.js no está instalado. Usa el comando para instalarlo primero.');
    }

    const depsDir = getDepsDir();
    const transformersPath = join(depsDir, 'node_modules', '@huggingface', 'transformers');

    const Module = require('module');
    const originalPaths = Module._nodeModulePaths;
    const depsNodeModules = join(depsDir, 'node_modules');

    if (!require.resolve.paths('')?.includes(depsNodeModules)) {
        Module._nodeModulePaths = function (from: string) {
            const paths = originalPaths.call(this, from);
            if (!paths.includes(depsNodeModules)) {
                paths.unshift(depsNodeModules);
            }
            return paths;
        };
    }

    const mod = await import(transformersPath);
    _pipelineFn = mod.pipeline;
}

// ─── SCAN MODELS DIR ────────────────────────────────────────────────────────

const _SKIP_DIRS = new Set([
    'blobs', 'manifests', 'logs', 'extensions', 'backends',
    'db', 'threads', 'node_modules', 'dist', '.git',
]);

function _scanModelsRecursive(
    baseDir: string,
    currentDir: string,
    depth: number,
    out: InstalledModel[],
): void {
    if (depth > 4) { return; }

    let entries: string[];
    try { entries = readdirSync(currentDir); } catch { return; }

    const subdirs: string[] = [];
    for (const e of entries) {
        try {
            if (statSync(join(currentDir, e)).isDirectory()) {
                subdirs.push(e);
            }
        } catch { /* skip */ }
    }

    // Detect HF cache model directory by name: models--ORG--NAME
    const dirName = currentDir === baseDir
        ? ''
        : currentDir.slice(baseDir.length + 1).split('/').pop() ?? '';
    if (dirName.startsWith('models--')) {
        const parts = dirName.slice('models--'.length).split('--');
        if (parts.length >= 2 && subdirs.includes('snapshots')) {
            try {
                const snapDir = join(currentDir, 'snapshots');
                const hashes = readdirSync(snapDir).filter((h) => {
                    try { return statSync(join(snapDir, h)).isDirectory(); } catch { return false; }
                });
                for (const hash of hashes) {
                    const snapFiles = readdirSync(join(snapDir, hash));
                    if (snapFiles.some((f) => f.endsWith('.onnx') || f.endsWith('.safetensors'))) {
                        out.push({ id: parts.join('/'), localPath: currentDir });
                        return;
                    }
                }
            } catch { /* skip corrupt cache entries */ }
        }
    }

    for (const sub of subdirs) {
        if (_SKIP_DIRS.has(sub)) { continue; }
        _scanModelsRecursive(baseDir, join(currentDir, sub), depth + 1, out);
    }
}

/**
 * Returns all ONNX models found in `modelsDir` or the default HF cache.
 */
export function scanInstalledModels(modelsDir?: string): InstalledModel[] {
    const searchDirs: string[] = [];

    if (modelsDir && modelsDir.trim()) {
        searchDirs.push(modelsDir.trim());
    }

    const defaultCache = join(homedir(), '.cache', 'huggingface', 'hub');
    if (existsSync(defaultCache)) {
        searchDirs.push(defaultCache);
    }

    const results: InstalledModel[] = [];
    const seen = new Set<string>();

    for (const dir of searchDirs) {
        if (!existsSync(dir)) { continue; }
        const models: InstalledModel[] = [];
        _scanModelsRecursive(dir, dir, 0, models);
        for (const m of models) {
            if (!seen.has(m.id)) {
                seen.add(m.id);
                results.push(m);
            }
        }
    }

    return results;
}

/**
 * Detecta la carpeta de modelos configurada en apliarte-ai (extensión separada).
 * Esta función se llama desde el panel provider que tiene acceso a vscode.
 */
export function getApliArteAiModelsDirFromConfig(vscode: any): string | null {
    try {
        const cfg = vscode.workspace.getConfiguration('apliarteAi');
        const rawDir = cfg.get('modelsDir');
        const dir = typeof rawDir === 'string' ? rawDir.trim() : '';
        return dir || null;
    } catch {
        return null;
    }
}

/**
 * Valida una carpeta de modelos compartida:
 * - Existe
 * - Es accesible (lectura)
 * - No tiene path traversal
 * - Contiene al menos un modelo ONNX compatible
 * Retorna { valid: boolean, modelCount: number, reason?: string, models?: InstalledModel[] }
 */
export async function validateSharedModelsDir(dir: string): Promise<{
    valid: boolean;
    modelCount: number;
    reason?: string;
    models?: InstalledModel[];
}> {
    // Security: no traversal
    if (!dir || dir.includes('..') || dir.includes('/../') || dir.includes('\\..')) {
        return { valid: false, modelCount: 0, reason: 'Ruta no válida (path traversal)' };
    }

    // Existence
    if (!existsSync(dir)) {
        return { valid: false, modelCount: 0, reason: 'La carpeta no existe' };
    }

    // Readable
    try {
        readdirSync(dir);
    } catch {
        return { valid: false, modelCount: 0, reason: 'Sin permisos de lectura' };
    }

    // Scan for ONNX models
    const models = scanInstalledModels(dir);
    if (models.length === 0) {
        return { valid: false, modelCount: 0, reason: 'No se encontraron modelos ONNX compatibles' };
    }

    return { valid: true, modelCount: models.length, models };
}
