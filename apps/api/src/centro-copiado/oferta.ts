import { CENTRO_COPIADO_FORMATOS } from './centro-copiado.domain';
import { variantesCubre, type VariantePapel } from './adaptador';

export interface FormatosPorGramaje {
  gramaje: number | null;
  tamanos: string[];
}

export interface PapelConfig {
  materiaPrimaId: string;
  gramajes?: number[];
  /** Ausente/null conserva la oferta general. [] no ofrece ningún formato. */
  formatosPorGramaje?: FormatosPorGramaje[] | null;
}

export function formatosProduciblesPorGramaje(
  variantes: VariantePapel[],
): FormatosPorGramaje[] {
  return [...new Set(variantes.map((v) => v.gramajeGr))].map((gramaje) => ({
    gramaje,
    tamanos: CENTRO_COPIADO_FORMATOS.filter((f) =>
      variantes.some(
        (v) =>
          v.gramajeGr === gramaje &&
          variantesCubre(v, {
            preset: f.nombre,
            anchoMm: f.anchoMm,
            altoMm: f.altoMm,
          }),
      ),
    ).map((f) => f.nombre),
  }));
}

/** La omisión de gramaje no permite saltar una oferta explícita. */
export function formatoOfrecido(
  papel: PapelConfig | undefined,
  gramaje: number | null | undefined,
  tamano: string,
  gramajesDisponibles: Array<number | null>,
): boolean {
  if (papel?.formatosPorGramaje == null) return true;
  const disponibles = [...new Set(gramajesDisponibles)];
  const efectivo =
    gramaje ?? (disponibles.length === 1 ? disponibles[0] : undefined);
  if (efectivo === undefined || !disponibles.includes(efectivo)) return false;
  return papel.formatosPorGramaje.some(
    (regla) => regla.gramaje === efectivo && regla.tamanos.includes(tamano),
  );
}

export function errorOfertaPapel(
  papel: PapelConfig,
  variantes: VariantePapel[],
): string | null {
  if (papel.formatosPorGramaje == null) return null;
  const reglas = papel.formatosPorGramaje;
  if (new Set(reglas.map((r) => r.gramaje)).size !== reglas.length)
    return 'Los formatos por gramaje no pueden repetir un gramaje.';
  const producibles = formatosProduciblesPorGramaje(variantes);
  for (const regla of reglas) {
    const posible = producibles.find((p) => p.gramaje === regla.gramaje);
    if (
      !posible ||
      (papel.gramajes?.length &&
        (regla.gramaje == null || !papel.gramajes.includes(regla.gramaje)))
    )
      return 'El gramaje de la oferta no está disponible para ese papel.';
    if (regla.tamanos.some((t) => !posible.tamanos.includes(t)))
      return 'Uno de los tamaños ofrecidos no se puede producir con ese papel y gramaje.';
  }
  return null;
}
