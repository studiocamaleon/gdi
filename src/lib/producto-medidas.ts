import type {
  MedidaPredefinidaProducto,
  ProductoDetalle,
  ProductoListItem,
} from "@/lib/productos-servicios";

export type MedidaDraft = MedidaPredefinidaProducto;

function numberFromMaybe(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function medidaLabel(
  medida: Pick<MedidaPredefinidaProducto, "nombre" | "anchoMm" | "altoMm"> & {
    tipo?: MedidaPredefinidaProducto["tipo"];
  },
) {
  const fallback =
    medida.tipo === "pliego_util"
      ? "Plancha completa"
      : `${medida.anchoMm} x ${medida.altoMm} mm`;
  return medida.nombre?.trim() || fallback;
}

/** La plancha no declara dims: se resuelve en runtime (pliego − márgenes). */
export function esMedidaPliegoUtil(
  medida: Pick<MedidaPredefinidaProducto, "tipo">,
): boolean {
  return medida.tipo === "pliego_util";
}

export function getMedidasPredefinidas(
  producto: Pick<
    ProductoListItem | ProductoDetalle,
    "medidasPredefinidasJson" | "medidaDefaultAnchoMm" | "medidaDefaultAltoMm"
  >,
): MedidaPredefinidaProducto[] {
  if (Array.isArray(producto.medidasPredefinidasJson) && producto.medidasPredefinidasJson.length > 0) {
    const medidas = producto.medidasPredefinidasJson
      .map((medida, index) => ({
        id: medida.id || `medida-${index + 1}`,
        nombre:
          medida.nombre ||
          (medida.tipo === "pliego_util"
            ? "Plancha completa"
            : `${medida.anchoMm} x ${medida.altoMm} mm`),
        anchoMm: numberFromMaybe(medida.anchoMm),
        altoMm: numberFromMaybe(medida.altoMm),
        esDefault: medida.esDefault === true,
        ...(medida.tipo === "pliego_util" ? { tipo: "pliego_util" as const } : {}),
      }))
      // La plancha (pliego_util) pasa sin dims: las resuelve el sheet en
      // runtime. Las fijas sin dims siguen siendo inválidas.
      .filter(
        (medida) =>
          medida.tipo === "pliego_util" ||
          (medida.anchoMm > 0 && medida.altoMm > 0),
      );
    if (medidas.some((medida) => medida.esDefault)) return medidas;
    return medidas.map((medida, index) => ({ ...medida, esDefault: index === 0 }));
  }

  const anchoMm = numberFromMaybe(producto.medidaDefaultAnchoMm);
  const altoMm = numberFromMaybe(producto.medidaDefaultAltoMm);
  if (anchoMm <= 0 || altoMm <= 0) return [];
  return [
    {
      id: "default",
      nombre: `${anchoMm} x ${altoMm} mm`,
      anchoMm,
      altoMm,
      esDefault: true,
    },
  ];
}

export function getMedidaDefault(producto: Parameters<typeof getMedidasPredefinidas>[0]) {
  const medidas = getMedidasPredefinidas(producto);
  return medidas.find((medida) => medida.esDefault) ?? medidas[0] ?? null;
}

export function normalizeMedidasDraft(medidas: MedidaDraft[]) {
  const validas = medidas
    .map((medida, index) => ({
      id: medida.id || `medida-${index + 1}`,
      nombre:
        medida.nombre?.trim() ||
        (medida.tipo === "pliego_util"
          ? "Plancha completa"
          : `${medida.anchoMm} x ${medida.altoMm} mm`),
      anchoMm: numberFromMaybe(medida.anchoMm),
      altoMm: numberFromMaybe(medida.altoMm),
      esDefault: medida.esDefault === true,
      ...(medida.tipo === "pliego_util" ? { tipo: "pliego_util" as const } : {}),
    }))
    // La plancha se guarda sin dims (0×0): las resuelve el sheet al cotizar.
    .filter(
      (medida) =>
        medida.tipo === "pliego_util" ||
        (medida.anchoMm > 0 && medida.altoMm > 0),
    );

  if (validas.length === 0) return [];
  const defaultIndex = validas.findIndex((medida) => medida.esDefault);
  return validas.map((medida, index) => ({
    ...medida,
    esDefault: defaultIndex >= 0 ? index === defaultIndex : index === 0,
  }));
}
