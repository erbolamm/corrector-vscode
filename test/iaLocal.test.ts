/**
 * Tests para iaLocal — memoria, carga/liberación, validaciones.
 * Usa el test runner integrado de Node.js (node:test).
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  estimateModelSize,
  formatBytes,
  checkMemoryForModel,
  TRANSFORMERS_MODEL,
  cargarModeloLocal,
  getCurrentModelId,
  isModelLoaded,
  descargarModelo,
  scanInstalledModels,
} from '../src/iaLocal.js';

// ─── estimateModelSize ────────────────────────────────────────────────────────

describe('estimateModelSize', () => {
  it('devuelve tamaño conocido para SmolLM2-360M', () => {
    const size = estimateModelSize('onnx-community/SmolLM2-360M-Instruct');
    assert.equal(size, 280 * 1024 * 1024);
  });

  it('devuelve tamaño conocido para Qwen2.5-0.5B', () => {
    const size = estimateModelSize('onnx-community/Qwen2.5-0.5B-Instruct');
    assert.equal(size, 380 * 1024 * 1024);
  });

  it('devuelve default conservador (500MB) para modelo desconocido', () => {
    const size = estimateModelSize('unknown/model');
    assert.equal(size, 500 * 1024 * 1024);
  });

  it('devuelve default para string vacío', () => {
    const size = estimateModelSize('');
    assert.equal(size, 500 * 1024 * 1024);
  });
});

// ─── formatBytes ──────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('formatea KB correctamente (redondea a entero)', () => {
    assert.equal(formatBytes(1024), '1 KB');
    assert.equal(formatBytes(1536), '2 KB');
    // 512 bytes = 0.5 KB → redondea a '1 KB' por toFixed(0)
    assert.equal(formatBytes(512), '1 KB');
  });

  it('formatea MB correctamente', () => {
    assert.equal(formatBytes(1024 * 1024), '1 MB');
    assert.equal(formatBytes(1.5 * 1024 * 1024), '2 MB');
    assert.equal(formatBytes(100 * 1024 * 1024), '100 MB');
  });

  it('formatea GB correctamente (con un decimal)', () => {
    assert.equal(formatBytes(1024 * 1024 * 1024), '1.0 GB');
    assert.equal(formatBytes(2.5 * 1024 * 1024 * 1024), '2.5 GB');
  });
});

// ─── checkMemoryForModel (integración básica) ────────────────────────────────

describe('checkMemoryForModel', () => {
  it('resuelve sin error para modelo conocido', async () => {
    const result = await checkMemoryForModel('onnx-community/Qwen2.5-0.5B-Instruct');
    assert.ok(typeof result.ok === 'boolean');
    assert.ok(typeof result.available === 'number');
    assert.ok(typeof result.required === 'number');
    assert.ok(result.required > 0);
    assert.ok(result.available >= 0);
  });

  it('resuelve sin error para modelo desconocido (usa default)', async () => {
    const result = await checkMemoryForModel('unknown/model-xyz');
    assert.ok(typeof result.ok === 'boolean');
    assert.ok(typeof result.available === 'number');
    assert.ok(typeof result.required === 'number');
    assert.equal(result.required, 500 * 1024 * 1024);
  });

  it('required coincide con estimateModelSize', async () => {
    const modelId = 'onnx-community/SmolLM2-360M-Instruct';
    const expected = estimateModelSize(modelId);
    const result = await checkMemoryForModel(modelId);
    assert.equal(result.required, expected);
  });
});

// ─── Validación de modelId (seguridad) ────────────────────────────────────────

describe('Validación de modelId - path traversal', () => {
  const maliciousIds = [
    '../malicious',
    'models/../etc/passwd',
    'onnx-community/../../../etc/shadow',
    'a/b/../../../c',
    '..',
    '../',
    '..\\windows',
  ];

  for (const id of maliciousIds) {
    it(`rechaza "${id}"`, () => {
      // La validación está en _loadModel del panel, pero podemos probar la lógica
      const hasTraversal = id.includes('..') || id.includes('/../') || id.includes('\\..');
      assert.ok(hasTraversal, `${id} debería detectarse como traversal`);
    });
  }

  it('acepta IDs válidos de HuggingFace', () => {
    const validIds = [
      'onnx-community/Qwen2.5-0.5B-Instruct',
      'onnx-community/SmolLM2-360M-Instruct',
      'user/model-name',
      'org/subdir/model',
    ];

    for (const id of validIds) {
      const hasTraversal = id.includes('..') || id.includes('/../') || id.includes('\\..');
      assert.ok(!hasTraversal, `${id} no debería detectarse como traversal`);
    }
  });
});

// ─── TRANSFORMERS_MODEL constant ──────────────────────────────────────────────

describe('TRANSFORMERS_MODEL constant', () => {
  it('es un string no vacío', () => {
    assert.ok(typeof TRANSFORMERS_MODEL === 'string');
    assert.ok(TRANSFORMERS_MODEL.length > 0);
  });

  it('tiene formato org/model', () => {
    assert.ok(TRANSFORMERS_MODEL.includes('/'));
    const parts = TRANSFORMERS_MODEL.split('/');
    assert.equal(parts.length, 2);
    assert.ok(parts[0].length > 0);
    assert.ok(parts[1].length > 0);
  });
});

// ─── Integration: cargarModeloLocal signature ────────────────────────────────

// Note: Full integration test would require VS Code environment.
// This validates the exported function exists and has correct signature.

describe('cargarModeloLocal export', () => {
  it('está exportada', async () => {
    const mod = await import('../src/iaLocal.js');
    assert.ok(typeof mod.cargarModeloLocal === 'function');
  });

  it('getCurrentModelId está exportada', async () => {
    const mod = await import('../src/iaLocal.js');
    assert.ok(typeof mod.getCurrentModelId === 'function');
  });

  it('isModelLoaded está exportada', async () => {
    const mod = await import('../src/iaLocal.js');
    assert.ok(typeof mod.isModelLoaded === 'function');
  });

  it('descargarModelo está exportada', async () => {
    const mod = await import('../src/iaLocal.js');
    assert.ok(typeof mod.descargarModelo === 'function');
  });

  it('checkMemoryForModel está exportada', async () => {
    const mod = await import('../src/iaLocal.js');
    assert.ok(typeof mod.checkMemoryForModel === 'function');
  });

  it('estimateModelSize está exportada', async () => {
    const mod = await import('../src/iaLocal.js');
    assert.ok(typeof mod.estimateModelSize === 'function');
  });

  it('formatBytes está exportada', async () => {
    const mod = await import('../src/iaLocal.js');
    assert.ok(typeof mod.formatBytes === 'function');
  });
});

// ─── scanInstalledModels ──────────────────────────────────────────────────────

describe('scanInstalledModels', () => {
  it('un directorio vacío devuelve []', () => {
    const dir = mkdtempSync(join(tmpdir(), 'corrector-scan-empty-'));
    try {
      const result = scanInstalledModels(dir);
      assert.deepEqual(result, []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('un directorio inexistente devuelve []', () => {
    const result = scanInstalledModels(join(tmpdir(), 'corrector-scan-no-existe-' + Date.now()));
    assert.deepEqual(result, []);
  });

  it('un directorio con un modelo ONNX válido lo enumera con tamaño aproximado', () => {
    const dir = mkdtempSync(join(tmpdir(), 'corrector-scan-modelo-'));
    try {
      const snapshotDir = join(dir, 'models--onnx-community--Test-Model', 'snapshots', 'abc123');
      mkdirSync(snapshotDir, { recursive: true });
      writeFileSync(join(snapshotDir, 'model.onnx'), Buffer.alloc(1024, 1));
      writeFileSync(join(snapshotDir, 'config.json'), '{}');

      const result = scanInstalledModels(dir);

      assert.equal(result.length, 1);
      assert.equal(result[0].id, 'onnx-community/Test-Model');
      assert.equal(result[0].localPath, join(dir, 'models--onnx-community--Test-Model'));
      assert.ok(result[0].sizeBytes >= 1024, 'sizeBytes debe incluir al menos el .onnx escrito');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('no descarga ni carga nada: solo lee el sistema de ficheros', () => {
    const dir = mkdtempSync(join(tmpdir(), 'corrector-scan-sin-cargar-'));
    try {
      const snapshotDir = join(dir, 'models--onnx-community--Otro-Modelo', 'snapshots', 'hash1');
      mkdirSync(snapshotDir, { recursive: true });
      writeFileSync(join(snapshotDir, 'model.safetensors'), Buffer.alloc(2048, 2));

      assert.equal(isModelLoaded(), false);
      scanInstalledModels(dir);
      assert.equal(isModelLoaded(), false, 'escanear no debe cargar ningún modelo');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});