/**
 * SM.5 — Consumibles + desgaste de máquina absorbidos automáticamente.
 *
 * Antes el usuario tenía que declarar manualmente "Tinta UV", "Clics CMYK",
 * "Toner negro" etc. como `ProcesoOperacionMaterial`. Pero esa info ya está
 * en la maquinaria (`MaquinaConsumible` por perfil + `MaquinaComponenteDesgaste`).
 *
 * Este módulo es función pura: recibe la maquina (con sus relaciones cargadas),
 * el perfil operativo del paso, y el contexto del trabajo (layout + cantidad),
 * y devuelve `MaterialConsumido[]` listos para concatenar al bucket
 * `materialesConsumidos` del paso. Cada item lleva `fuente` distintiva
 * (`MaquinaConsumible` o `MaquinaDesgaste`) para que el frontend pueda
 * mostrarlos como secciones separadas en el desglose de costos.
 *
 * Contrato:
 *   - `consumoBase` se interpreta como "cantidad consumible / unidad base".
 *     Ejemplo: tinta CMYK con `unidad=ML, consumoBase=15` significa "15 ml por
 *     unidad base". La unidad base se deriva del layout + de la `unidad` del
 *     consumible (ver `unidadesBaseParaConsumible`).
 *   - Tipos sensibles a caras (TONER, TINTA, BARNIZ, PRIMER, RESINA, POLVO)
 *     se duplican cuando `perfil.dobleFaz=true`. Otros tipos (ADHESIVO,
 *     LUBRICANTE, OTRO) se aplican una sola vez.
 *   - Desgaste se prorratea: `costo_paso = (uso_paso / vida_util) × precio`.
 *     `unidadDesgaste=HORAS` requiere el tiempo del paso — todavía no implementado.
 */
import type { NestingResultUnion } from '../engine/nesting-runner';
import type { MaterialConsumido } from './material-plantillas';

// ──────────────── Shape de inputs (subset del query Prisma) ────────────────

export type MaquinaConsumibleRuntime = {
  id: string;
  perfilOperativoId: string | null;
  nombre: string;
  tipo: string; // TipoConsumibleMaquina enum
  unidad: string; // UnidadConsumoMaquina enum
  consumoBase: unknown; // Decimal | null
  rendimientoEstimado: unknown; // Decimal | null
  activo: boolean;
  materiaPrimaVariante: {
    id: string;
    sku: string;
    nombreVariante: string | null;
    precioReferencia: unknown; // Decimal | null
  };
};

export type MaquinaDesgasteRuntime = {
  id: string;
  nombre: string;
  tipo: string; // TipoComponenteDesgasteMaquina enum
  vidaUtilEstimada: unknown; // Decimal | null
  unidadDesgaste: string; // UnidadDesgasteMaquina enum
  modoProrrateo: string | null;
  activo: boolean;
  materiaPrimaVariante: {
    id: string;
    sku: string;
    nombreVariante: string | null;
    precioReferencia: unknown; // Decimal | null
  };
};

export type PerfilRuntime = {
  id: string;
  dobleFaz: boolean;
  productivityUnit: string | null; // UnidadProduccionMaquina enum
} | null;

export type ConsumiblesContext = {
  cantidadPedida: number;
  layout: NestingResultUnion | null;
  perfil: PerfilRuntime;
};

// ──────────────── Helpers de unidades base ────────────────

/** Tipos de consumible que escalan con cantidad de caras (tinta, toner, etc.). */
const TIPOS_SENSIBLES_CARAS = new Set([
  'TONER',
  'TINTA',
  'BARNIZ',
  'PRIMER',
  'RESINA',
  'POLVO',
]);

function areaUtilM2(layout: NestingResultUnion | null): number {
  if (!layout) return 0;
  if (layout.algoritmo === 'nesting-rollo') return layout.result.usefulAreaM2;
  if (layout.algoritmo === 'nesting-hoja') {
    const r = layout.result;
    return (
      (r.pliegoElegido.anchoMm * r.pliegoElegido.altoMm * r.pliegosNecesarios) /
      1_000_000
    );
  }
  // placa-rigida: aproximado como piezasPorPlaca × pieza
  if (layout.algoritmo === 'nesting-placa-rigida') {
    const r = layout.result;
    const placas = Math.ceil(1 / Math.max(1, r.piezasPorPlaca));
    // Piezas por placa × área pieza no está expuesta directo, esto es approx.
    // Si necesitamos precisión, agregar `placaAreaUtilM2` al result en el futuro.
    return placas;
  }
  return 0;
}

function metrosLineales(layout: NestingResultUnion | null): number {
  if (layout?.algoritmo === 'nesting-rollo') {
    return layout.result.consumedLengthMm / 1000;
  }
  return 0;
}

/** "Unidades productivas" del paso: pliegos, placas, copias, piezas. */
function unidadesProductivasDelLayout(
  layout: NestingResultUnion | null,
  cantidadPedida: number,
): number {
  if (!layout) return cantidadPedida;
  if (layout.algoritmo === 'nesting-hoja') return layout.result.pliegosNecesarios;
  if (layout.algoritmo === 'nesting-placa-rigida') {
    return Math.ceil(cantidadPedida / Math.max(1, layout.result.piezasPorPlaca));
  }
  // rollo: cantidadPedida representa # piezas (cada pieza = 1 corrida)
  return cantidadPedida;
}

/**
 * Mapea la unidad declarada del consumible a la "unidad base" del paso (cuántas
 * unidades base se trabajaron). El `consumoBase` luego se multiplica por esto.
 *   - ML / LITRO / GRAMO / KG: por m² impreso
 *   - M2 → por m² impreso
 *   - METRO_LINEAL → por metro consumido (rollo)
 *   - PAGINA / A4_EQUIV / UNIDAD → por unidad productiva (pliego / copia / pieza)
 */
function unidadesBaseParaConsumible(
  unidadConsumible: string,
  ctx: ConsumiblesContext,
): number {
  switch (unidadConsumible.toUpperCase()) {
    case 'ML':
    case 'LITRO':
    case 'GRAMO':
    case 'KG':
    case 'M2':
      return areaUtilM2(ctx.layout);
    case 'METRO_LINEAL':
      return metrosLineales(ctx.layout);
    case 'PAGINA':
    case 'A4_EQUIV':
    case 'UNIDAD':
      return unidadesProductivasDelLayout(ctx.layout, ctx.cantidadPedida);
    default:
      return ctx.cantidadPedida;
  }
}

function unidadesBaseParaDesgaste(
  unidadDesgaste: string,
  ctx: ConsumiblesContext,
): number {
  switch (unidadDesgaste.toUpperCase()) {
    case 'M2':
      return areaUtilM2(ctx.layout);
    case 'METROS_LINEALES':
      return metrosLineales(ctx.layout);
    case 'COPIAS_A4_EQUIV':
    case 'PIEZAS':
    case 'CICLOS':
      return unidadesProductivasDelLayout(ctx.layout, ctx.cantidadPedida);
    case 'HORAS':
      // TODO: requiere tiempo del paso (setupMin + productivoMin) que
      // todavía no se calcula antes de los materiales. Pendiente de refactor.
      return 0;
    default:
      return 0;
  }
}

function decimalToNumber(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nombreLegible(
  base: string,
  variante: { sku: string; nombreVariante: string | null },
): string {
  return variante.nombreVariante?.trim() || base || variante.sku;
}

// ──────────────── Función principal — Consumibles ────────────────

/**
 * Construye los `MaterialConsumido` automáticos a partir de los consumibles
 * configurados en la máquina (filtrados por perfil operativo del paso).
 *
 * Filtrado: incluye consumibles cuyo `perfilOperativoId` coincide con el
 * paso O es null (aplica a toda la máquina).
 */
export function construirConsumiblesDelPerfil(
  consumibles: MaquinaConsumibleRuntime[] | undefined,
  ctx: ConsumiblesContext,
): MaterialConsumido[] {
  if (!consumibles || consumibles.length === 0) return [];
  const perfilId = ctx.perfil?.id ?? null;
  const dobleFaz = Boolean(ctx.perfil?.dobleFaz);

  return consumibles
    .filter(
      (c) =>
        c.activo &&
        (c.perfilOperativoId === null || c.perfilOperativoId === perfilId),
    )
    .map((c): MaterialConsumido | null => {
      const consumoBase = decimalToNumber(c.consumoBase);
      if (consumoBase <= 0) return null;
      const unidadesBase = unidadesBaseParaConsumible(c.unidad, ctx);
      if (unidadesBase <= 0) return null;
      const aplicaCaras = TIPOS_SENSIBLES_CARAS.has(c.tipo.toUpperCase());
      const factorCaras = aplicaCaras && dobleFaz ? 2 : 1;
      const cantidad = unidadesBase * consumoBase * factorCaras;
      if (cantidad <= 0) return null;
      const precioUnitario = decimalToNumber(c.materiaPrimaVariante.precioReferencia);
      return {
        nombre: nombreLegible(c.nombre, c.materiaPrimaVariante),
        cantidad: Math.round(cantidad * 10000) / 10000,
        unidad: c.unidad.toLowerCase(),
        precioUnitario,
        costo: cantidad * precioUnitario,
        fuente: 'MaquinaConsumible',
      };
    })
    .filter((m): m is MaterialConsumido => m !== null);
}

// ──────────────── Función principal — Desgaste ────────────────

/**
 * Prorratea el costo de los componentes de desgaste según el uso del paso.
 *   costo_paso = (uso_paso / vida_util) × precio_componente
 *
 * Filtrado: incluye solo componentes activos. No filtra por perfil porque el
 * desgaste es a nivel de máquina (todos los perfiles lo desgastan).
 */
export function construirDesgasteDelPaso(
  componentesDesgaste: MaquinaDesgasteRuntime[] | undefined,
  ctx: ConsumiblesContext,
): MaterialConsumido[] {
  if (!componentesDesgaste || componentesDesgaste.length === 0) return [];
  return componentesDesgaste
    .filter((c) => c.activo)
    .map((c): MaterialConsumido | null => {
      const vidaUtil = decimalToNumber(c.vidaUtilEstimada);
      if (vidaUtil <= 0) return null;
      const usoPaso = unidadesBaseParaDesgaste(c.unidadDesgaste, ctx);
      if (usoPaso <= 0) return null;
      const precioComponente = decimalToNumber(c.materiaPrimaVariante.precioReferencia);
      if (precioComponente <= 0) return null;
      const costoProrrateado = (usoPaso / vidaUtil) * precioComponente;
      return {
        nombre: `${nombreLegible(c.nombre, c.materiaPrimaVariante)} (desgaste)`,
        cantidad: Math.round((usoPaso / vidaUtil) * 1000000) / 1000000,
        unidad: c.unidadDesgaste.toLowerCase(),
        precioUnitario: precioComponente,
        costo: costoProrrateado,
        fuente: 'MaquinaDesgaste',
      };
    })
    .filter((m): m is MaterialConsumido => m !== null);
}
