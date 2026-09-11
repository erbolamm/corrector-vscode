/**
 * Preflight de memoria al arrancar — alineado con ApliArte AI.
 *
 * Si la IA local está activa y queda muy poca memoria libre, avisa y ofrece
 * desactivarla. Un modelo más grande que la RAM disponible no deja el equipo
 * «lento»: lo deja sin responder, y en macOS sin swap eso significa comprimir
 * memoria hasta saturar la CPU. Eso no se arregla esperando.
 *
 * El aviso y la decisión se reciben como dependencias para poder probarlos sin
 * arrancar VS Code.
 */

import { formatBytes } from './iaLocal';

/** Por debajo de este umbral no se debe cargar ningún modelo. */
export const UMBRAL_RAM_LIBRE_GB = 1.0;

/** Botón que apaga la IA local, igual que en ApliArte AI. */
export const BOTON_DESACTIVAR = 'Desactivar IA local';

/** Botón para no hacer nada. */
export const BOTON_IGNORAR = 'Ignorar';

export interface PreflightDeps {
  /** ¿Está encendida la IA local ahora mismo? */
  iaLocalActiva(): boolean;
  /** Memoria libre, en bytes. */
  memoriaLibre(): Promise<number>;
  /** Aviso con botones. Devuelve el pulsado, o undefined si se descarta. */
  avisar(mensaje: string, ...botones: string[]): Promise<string | undefined>;
  /** Apaga la IA local de forma persistente. */
  desactivarIaLocal(): Promise<void>;
}

export type ResultadoPreflight = 'no-hacia-falta' | 'desactivada' | 'ignorada';

export function gigabytes(bytes: number): number {
  return bytes / 1024 ** 3;
}

export async function preflightMemoriaIA(deps: PreflightDeps): Promise<ResultadoPreflight> {
  if (!deps.iaLocalActiva()) {
    return 'no-hacia-falta';
  }

  const libre = await deps.memoriaLibre();
  if (gigabytes(libre) >= UMBRAL_RAM_LIBRE_GB) {
    return 'no-hacia-falta';
  }

  const elegido = await deps.avisar(
    `Corrector: queda muy poca memoria libre (${formatBytes(libre)}). ` +
      'Cargar un modelo de IA local podría congelar el equipo.',
    BOTON_DESACTIVAR,
    BOTON_IGNORAR,
  );

  if (elegido !== BOTON_DESACTIVAR) {
    return 'ignorada';
  }

  await deps.desactivarIaLocal();
  return 'desactivada';
}
