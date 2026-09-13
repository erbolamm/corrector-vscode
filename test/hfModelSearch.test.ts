/**
 * Filtro de resultados de Hugging Face para el buscador del panel.
 * Descarta GGUF sin artefactos ONNX; no exige red.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterCompatibleModels,
  hasOnnxArtifacts,
  inferArchitectureFromTags,
  estimateModelSizeFromHF,
  toSearchResultModel,
  type HFModelSearchResult,
} from '../src/hfModelSearch.js';

const GB = 1024 * 1024 * 1024;

function model(partial: Partial<HFModelSearchResult> & { id: string }): HFModelSearchResult {
  return {
    downloads: 10,
    modelId: partial.id,
    ...partial,
  };
}

describe('hasOnnxArtifacts', () => {
  it('acepta tag onnx', () => {
    assert.equal(hasOnnxArtifacts(model({ id: 'onnx-community/a', tags: ['onnx'] })), true);
  });

  it('acepta fichero .onnx', () => {
    assert.equal(
      hasOnnxArtifacts(model({ id: 'onnx-community/a', siblings: [{ rfilename: 'model.onnx', size: 10 }] })),
      true,
    );
  });

  it('acepta library transformers.js', () => {
    assert.equal(
      hasOnnxArtifacts(model({ id: 'onnx-community/a', library_name: 'transformers.js' })),
      true,
    );
  });

  it('rechaza GGUF puro', () => {
    assert.equal(
      hasOnnxArtifacts(model({
        id: 'someone/llama-gguf',
        tags: ['gguf'],
        library_name: 'transformers',
        siblings: [{ rfilename: 'model.gguf', size: 99 }],
      })),
      false,
    );
  });

  it('acepta un modelo con ONNX y GGUF a la vez', () => {
    assert.equal(
      hasOnnxArtifacts(model({
        id: 'onnx-community/both',
        tags: ['onnx', 'gguf'],
        siblings: [
          { rfilename: 'model.onnx', size: 10 },
          { rfilename: 'model.gguf', size: 20 },
        ],
      })),
      true,
    );
  });
});

describe('filterCompatibleModels', () => {
  it('quita GGUF puro, ceros de descargas y deja ONNX (también si hay GGUF extra)', () => {
    const kept = filterCompatibleModels([
      model({ id: 'onnx-community/ok', tags: ['onnx'], downloads: 100 }),
      model({ id: 'someone/gguf', tags: ['gguf'], downloads: 999 }),
      model({
        id: 'onnx-community/both',
        tags: ['onnx', 'gguf'],
        siblings: [{ rfilename: 'decoder.onnx' }],
        downloads: 50,
      }),
      model({ id: 'onnx-community/zero', tags: ['onnx'], downloads: 0 }),
    ]);
    assert.deepEqual(kept.map((m) => m.id), ['onnx-community/ok', 'onnx-community/both']);
  });

  it('corta a 12 resultados', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      model({ id: `onnx-community/m${i}`, tags: ['onnx'], downloads: i + 1 }),
    );
    assert.equal(filterCompatibleModels(many).length, 12);
  });
});

describe('inferArchitectureFromTags / estimateModelSizeFromHF', () => {
  it('saca arquitectura de un tag conocido', () => {
    assert.equal(inferArchitectureFromTags(['text-generation', 'qwen2']), 'Qwen');
  });

  it('usa safetensors.total si viene', () => {
    assert.equal(
      estimateModelSizeFromHF(model({ id: 'x/y', safetensors: { total: 42 } })),
      42,
    );
  });

  it('suma tamaños de siblings si no hay safetensors', () => {
    assert.equal(
      estimateModelSizeFromHF(model({
        id: 'x/y',
        siblings: [{ rfilename: 'a.onnx', size: 10 }, { rfilename: 'b.onnx', size: 5 }],
      })),
      15,
    );
  });
});

describe('toSearchResultModel', () => {
  it('marca descargado, cargado y memoria recomendada', () => {
    const hit = model({
      id: 'onnx-community/SmolLM2-360M-Instruct',
      tags: ['onnx', 'smollm'],
      downloads: 1200,
      siblings: [{ rfilename: 'model.onnx', size: 280 * 1024 * 1024 }],
    });
    const downloaded = toSearchResultModel(hit, {
      installedIds: new Set([hit.id]),
      currentModelId: null,
      isLoaded: false,
    });
    assert.equal(downloaded.status, 'downloaded');
    assert.equal(downloaded.format, 'ONNX');
    assert.equal(downloaded.compatible, true);

    const loaded = toSearchResultModel(hit, {
      installedIds: new Set([hit.id]),
      currentModelId: hit.id,
      isLoaded: true,
    });
    assert.equal(loaded.status, 'loaded');
    assert.equal(loaded.sizeBytes, 280 * 1024 * 1024);
    assert.equal(loaded.recommendedMemory, ((280 * 1024 * 1024 + 1.5 * GB) / GB).toFixed(1) + ' GB');
  });
});
