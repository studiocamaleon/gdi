/**
 * Auto-selección de perfil por OPERACIÓN para máquinas de mecanizado.
 *
 * La operación la define el paso: `corte_laser` corta, `grabado_laser` graba.
 * Entre los perfiles de la máquina, nos quedamos con los de esa operación
 * (`detalle.tipoOperacion`); si queda uno solo, ese es el perfil (una máquina
 * con un perfil por operación "funciona sola"). Con varios perfiles de la misma
 * operación (por material×espesor), la desambiguación fina la hace el comercial
 * hasta que el contexto exponga material+espesor (Fase 3).
 *
 * `cnc` NO está acá: su operación no la fija la familia (una fresadora puede
 * cortar o grabar), así que no se puede auto-filtrar por familia.
 */
export const OPERACIONES_POR_FAMILIA: Record<string, string[]> = {
  corte_laser: ['CORTE', 'SEMICORTE'],
  grabado_laser: ['GRABADO'],
};

export interface PerfilConDetalle {
  detalleJson?: unknown;
}

/**
 * Índice del ÚNICO perfil cuya operación matchea la del paso, o `null` si la
 * familia no mapea a una operación, o si hay 0 / >1 candidatos.
 */
export function indicePerfilUnicoPorOperacion(
  familiaCodigo: string,
  perfiles: readonly PerfilConDetalle[],
): number | null {
  const ops = OPERACIONES_POR_FAMILIA[familiaCodigo];
  if (!ops) return null;
  const matches: number[] = [];
  perfiles.forEach((perfil, i) => {
    const detalle = perfil.detalleJson as Record<string, unknown> | null;
    const op = String(detalle?.tipoOperacion ?? '').toUpperCase();
    if (op !== '' && ops.includes(op)) matches.push(i);
  });
  return matches.length === 1 ? matches[0] : null;
}
