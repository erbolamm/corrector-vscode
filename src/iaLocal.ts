/**
 * Motor de IA local para corrección ortográfica.
 * Dos backends: Ollama/LM Studio (si disponible) o transformers.js (autónomo).
 *
 * Autor: Javier Mateo (ApliArte)
 */

import { execFile } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

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

// ─── STATE ──────────────────────────────────────────────────────────────────

let _depsDir: string | null = null;
let _pipelineFn: any = null;
let _generator: any = null;
let _modelLoaded = false;

const TRANSFORMERS_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';
const PROMPT_CORRECCION = `You are a Spanish spell-checker. Fix ONLY spelling and grammar errors in the following text. Do NOT change meaning, style, or add words. Return ONLY the corrected text, nothing else.

Text: `;

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
 */
export async function cargarModeloLocal(
    onProgress?: (info: { status: string; progress?: number; file?: string }) => void
): Promise<void> {
    if (_modelLoaded) { return; }

    await ensureImported();

    _generator = await _pipelineFn('text-generation', TRANSFORMERS_MODEL, {
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
}

export function isModelLoaded(): boolean {
    return _modelLoaded;
}

export async function descargarModelo(): Promise<void> {
    if (_generator) {
        await _generator.dispose?.();
        _generator = null;
        _modelLoaded = false;
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
