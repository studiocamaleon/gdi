/**
 * Tecnología de una máquina, derivada de sus parámetros técnicos (o de la
 * plantilla como fallback). Espejo backend de `getMachineTechnology`
 * (src/lib/maquinaria-tecnologias.ts): el ruteo de estaciones "por tecnología"
 * (docs/estaciones-reglas-diseno.md) necesita esta señal en el paso, y se
 * deriva de la máquina en LECTURA — no se persiste (una sola fuente de verdad).
 */

/** Catálogo de tecnologías conocidas (sync con `tecnologiaMaquinaItems`). */
export const TECNOLOGIAS_MAQUINA = [
  'laser',
  'eco_solvente',
  'uv',
  'latex',
  'sublimacion',
  'dtf_textil',
  'dtf_uv',
  'inkjet',
] as const;

const DIACRITICOS = /[̀-ͯ]/g;

export function normalizarTecnologiaMaquina(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return null;
  const normalized = raw
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .normalize('NFD')
    .replace(DIACRITICOS, '');

  if (['solvente', 'eco_solvente', 'ecosolvente', 'eco'].includes(normalized)) {
    return 'eco_solvente';
  }
  if (['uv', 'ultravioleta'].includes(normalized)) return 'uv';
  if (normalized === 'latex') return 'latex';
  if (normalized === 'laser') return 'laser';
  if (normalized === 'sublimacion') return 'sublimacion';
  if (['dtf_textil', 'dtftextil'].includes(normalized)) return 'dtf_textil';
  if (['dtf_uv', 'dtfuv'].includes(normalized)) return 'dtf_uv';
  if (normalized === 'inkjet') return 'inkjet';

  return (TECNOLOGIAS_MAQUINA as readonly string[]).includes(normalized)
    ? normalized
    : null;
}

type MaquinaTecnologia = {
  plantilla?: string | null;
  parametrosTecnicosJson?: unknown;
  capacidadesAvanzadasJson?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Tecnología de la máquina, o null si no se puede derivar. */
export function resolverTecnologiaMaquina(
  maquina: MaquinaTecnologia | null | undefined,
): string | null {
  if (!maquina) return null;
  const params = asRecord(maquina.parametrosTecnicosJson);
  const avanzadas = asRecord(maquina.capacidadesAvanzadasJson);
  const explicit =
    normalizarTecnologiaMaquina(params.tecnologia) ??
    normalizarTecnologiaMaquina(params.tecnologiaMaquina) ??
    normalizarTecnologiaMaquina(avanzadas.tecnologiaMaquina);
  if (explicit) return explicit;

  const plantilla =
    typeof maquina.plantilla === 'string'
      ? maquina.plantilla.toLowerCase()
      : '';
  if (plantilla === 'impresora_laser') return 'laser';
  // Los plotters CAD son siempre inkjet (tecnología fija por plantilla).
  if (plantilla === 'plotter_cad') return 'inkjet';
  return null;
}
