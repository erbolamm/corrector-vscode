/**
 * Tests para memoriaPreflight — el aviso de RAM al arrancar.
 *
 * Es la misma salida que ofrece ApliArte AI: si la IA local está activa y queda
 * muy poca memoria, se avisa y se ofrece desactivarla. Aquí no hay VS Code: el
 * aviso y la decisión entran como dependencias.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOTON_DESACTIVAR,
  BOTON_IGNORAR,
  UMBRAL_RAM_LIBRE_GB,
  gigabytes,
  preflightMemoriaIA,
  type PreflightDeps,
  type ResultadoPreflight,
} from '../src/memoriaPreflight.js';

const GB = 1024 ** 3;

interface Registro {
  resultado: ResultadoPreflight;
  avisos: string[][];
  desactivaciones: number;
}

async function correr(opciones: {
  iaLocalActiva: boolean;
  memoriaLibre: number;
  respuesta?: string | undefined;
}): Promise<Registro> {
  const avisos: string[][] = [];
  let desactivaciones = 0;

  const deps: PreflightDeps = {
    iaLocalActiva: () => opciones.iaLocalActiva,
    memoriaLibre: () => Promise.resolve(opciones.memoriaLibre),
    avisar: (mensaje, ...botones) => {
      avisos.push([mensaje, ...botones]);
      return Promise.resolve(opciones.respuesta);
    },
    desactivarIaLocal: () => {
      desactivaciones += 1;
      return Promise.resolve();
    },
  };

  const resultado = await preflightMemoriaIA(deps);
  return { resultado, avisos, desactivaciones };
}

describe('memoriaPreflight · umbral', () => {
  it('el umbral es 1 GB', () => {
    assert.equal(UMBRAL_RAM_LIBRE_GB, 1.0);
  });

  it('convierte bytes a gigabytes', () => {
    assert.equal(gigabytes(2 * GB), 2);
    assert.equal(gigabytes(512 * 1024 ** 2), 0.5);
  });
});

describe('memoriaPreflight · cuándo avisa', () => {
  it('no hace nada si la IA local está apagada, aunque no haya memoria', async () => {
    const r = await correr({ iaLocalActiva: false, memoriaLibre: 0.1 * GB });
    assert.equal(r.resultado, 'no-hacia-falta');
    assert.deepEqual(r.avisos, [], 'avisó con la IA local apagada');
    assert.equal(r.desactivaciones, 0);
  });

  it('no avisa si hay memoria de sobra', async () => {
    const r = await correr({ iaLocalActiva: true, memoriaLibre: 8 * GB });
    assert.equal(r.resultado, 'no-hacia-falta');
    assert.deepEqual(r.avisos, []);
  });

  it('no avisa justo en el umbral', async () => {
    const r = await correr({ iaLocalActiva: true, memoriaLibre: 1.0 * GB });
    assert.equal(r.resultado, 'no-hacia-falta');
  });

  it('avisa por debajo del umbral, con los dos botones exactos', async () => {
    const r = await correr({ iaLocalActiva: true, memoriaLibre: 0.5 * GB, respuesta: undefined });
    assert.equal(r.avisos.length, 1, 'no avisó con poca memoria');

    const [mensaje, ...botones] = r.avisos[0];
    assert.match(mensaje, /poca memoria libre/);
    assert.match(mensaje, /podría congelar el equipo/);
    assert.deepEqual(botones, [BOTON_DESACTIVAR, BOTON_IGNORAR]);
  });
});

describe('memoriaPreflight · qué decide el usuario', () => {
  it('si pulsa desactivar, apaga la IA local y lo reporta', async () => {
    const r = await correr({ iaLocalActiva: true, memoriaLibre: 0.5 * GB, respuesta: BOTON_DESACTIVAR });
    assert.equal(r.resultado, 'desactivada');
    assert.equal(r.desactivaciones, 1);
  });

  it('si pulsa ignorar, no toca el ajuste', async () => {
    const r = await correr({ iaLocalActiva: true, memoriaLibre: 0.5 * GB, respuesta: BOTON_IGNORAR });
    assert.equal(r.resultado, 'ignorada');
    assert.equal(r.desactivaciones, 0);
  });

  it('si descarta el aviso, no toca el ajuste', async () => {
    const r = await correr({ iaLocalActiva: true, memoriaLibre: 0.5 * GB, respuesta: undefined });
    assert.equal(r.resultado, 'ignorada');
    assert.equal(r.desactivaciones, 0);
  });
});
