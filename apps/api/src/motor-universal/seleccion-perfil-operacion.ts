/**
 * Auto-selección de perfil por OPERACIÓN para máquinas de mecanizado.
 *
 * La operación la define el paso: `corte_laser` corta, `grabado_laser` graba.
 * Entre los perfiles de la máquina, nos quedamos con los de esa operación
 * (`detalle.tipoOperacion`). Cuando el sustrato ya está resuelto, se prioriza
 * el perfil que cubre su materia prima y espesor; un override explícito del
 * comercial se resuelve antes de llegar a este selector.
 *
 * `cnc` NO está acá: su operación no la fija la familia (una fresadora puede
 * cortar o grabar), así que no se puede auto-filtrar por familia.
 */
export const OPERACIONES_POR_FAMILIA: Record<string, string[]> = {
  corte_laser: ['CORTE'],
  grabado_laser: ['GRABADO'],
};

export interface PerfilConDetalle {
  detalleJson?: unknown;
}

export interface ContextoMaterialPerfil {
  materiaPrimaId?: string | null;
  canonicalMaterialKey?: string | null;
  espesorMm?: number | null;
}

function valoresMaterial(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return raw
    .map(String)
    .map((item) => item.trim())
    .filter(Boolean);
}

function numeroFinito(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numero = Number(value);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Índice del ÚNICO perfil cuya operación matchea la del paso, o `null` si la
 * familia no mapea a una operación, o si hay 0 / >1 candidatos.
 */
export function indicePerfilUnicoPorOperacion(
  familiaCodigo: string,
  perfiles: readonly PerfilConDetalle[],
  contextoMaterial?: ContextoMaterialPerfil | null,
): number | null {
  const ops = OPERACIONES_POR_FAMILIA[familiaCodigo];
  if (!ops) return null;
  const matchesOperacion: number[] = [];
  perfiles.forEach((perfil, i) => {
    const detalle = perfil.detalleJson as Record<string, unknown> | null;
    const op = String(detalle?.tipoOperacion ?? '').toUpperCase();
    if (op !== '' && ops.includes(op)) matchesOperacion.push(i);
  });
  if (!contextoMaterial) {
    return matchesOperacion.length === 1 ? matchesOperacion[0] : null;
  }

  const materialId = contextoMaterial.materiaPrimaId?.trim() || null;
  const canonicalKey =
    contextoMaterial.canonicalMaterialKey?.trim().toUpperCase() || null;
  const espesor = numeroFinito(contextoMaterial.espesorMm);
  if (!materialId && !canonicalKey && !(espesor && espesor > 0)) {
    return matchesOperacion.length === 1 ? matchesOperacion[0] : null;
  }

  const candidatos = matchesOperacion.flatMap((indice) => {
    const detalle = (perfiles[indice].detalleJson ?? {}) as Record<
      string,
      unknown
    >;
    const materiales = valoresMaterial(detalle.material);
    const coincideMaterial =
      materiales.length === 0 ||
      (materialId ? materiales.includes(materialId) : false) ||
      (canonicalKey
        ? materiales.some((item) => item.toUpperCase() === canonicalKey)
        : false);
    if (!coincideMaterial) return [];

    const min = numeroFinito(detalle.espesorMinMm);
    const max = numeroFinito(detalle.espesorMaxMm);
    if (
      espesor != null &&
      espesor > 0 &&
      ((min != null && espesor < min) || (max != null && espesor > max))
    ) {
      return [];
    }

    // Un perfil vinculado al material gana sobre uno legado/genérico. Entre
    // rangos superpuestos gana el más estrecho; empates quedan ambiguos.
    const materialEspecifico = materiales.length > 0 ? 1 : 0;
    const espesorEspecifico = min != null || max != null ? 1 : 0;
    const amplitud =
      min != null && max != null && max >= min
        ? max - min
        : Number.POSITIVE_INFINITY;
    return [{ indice, materialEspecifico, espesorEspecifico, amplitud }];
  });

  if (candidatos.length === 0) return null;
  if (!(espesor != null && espesor > 0)) {
    const sinRango = candidatos.filter(
      (candidato) => candidato.espesorEspecifico === 0,
    );
    if (sinRango.length !== 1) return null;
    return sinRango[0].indice;
  }

  candidatos.sort(
    (a, b) =>
      b.materialEspecifico - a.materialEspecifico ||
      b.espesorEspecifico - a.espesorEspecifico ||
      a.amplitud - b.amplitud,
  );
  const mejor = candidatos[0];
  const segundo = candidatos[1];
  if (
    segundo &&
    segundo.materialEspecifico === mejor.materialEspecifico &&
    segundo.espesorEspecifico === mejor.espesorEspecifico &&
    segundo.amplitud === mejor.amplitud
  ) {
    return null;
  }
  return mejor.indice;
}
