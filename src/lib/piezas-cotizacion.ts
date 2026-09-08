import type {
  ProductoRecetaRevision,
  CotizarResponse,
} from "./productos-servicios-api";
import type { ConfiguracionGeometriasComerciales } from "./producto-geometrias";

type Fuente = ConfiguracionGeometriasComerciales["fuentes"][number];
export type GrupoPiezasCotizacion = {
  id: string;
  nombre: string;
  filas: Array<{
    id: string;
    nombre: string;
    fuente: Fuente;
    porProducto?: number;
    total?: number;
  }>;
};

/** La pertenencia se toma de la interpretación guardada, nunca del nombre del archivo. */
export function agruparPiezasCotizacion(
  fuentes: Fuente[],
  componentes: ProductoRecetaRevision["componentes"],
  cantidad: number,
  calculados?: NonNullable<
    CotizarResponse["cotizacion"]
  >["componentesFabricados"],
): GrupoPiezasCotizacion[] {
  const usadas = new Set<string>();
  const grupos: GrupoPiezasCotizacion[] = [];
  for (const c of componentes) {
    const filas: GrupoPiezasCotizacion["filas"] = [];
    const resueltos = calculados?.filter(
      (r) => (r.plantillaCodigo ?? r.codigo) === c.codigo,
    );
    const cantidadResuelta = resueltos?.length
      ? resueltos.reduce((n, r) => n + r.cantidad, 0)
      : undefined;
    const lineal =
      c.formula === "por_unidad" && !c.configuracionJson?.repeticion?.permitida;
    for (const p of c.configuracionJson?.piezas ?? []) {
      if (!p.fuente) continue;
      const fuente = fuentes.find(
        (f) =>
          f.predeterminada?.procedencia.geometriaId ===
          p.fuente.procedencia.geometriaId,
      );
      if (!fuente) continue;
      usadas.add(fuente.id);
      const porProducto = lineal ? c.cantidad * p.cantidadPorUnidad : undefined;
      const total =
        cantidadResuelta !== undefined
          ? cantidadResuelta * p.cantidadPorUnidad
          : porProducto !== undefined
            ? porProducto * cantidad
            : undefined;
      filas.push({
        id: `${c.id}-${p.id}`,
        nombre: p.nombre,
        fuente,
        porProducto,
        total,
      });
    }
    if (filas.length) grupos.push({ id: c.id, nombre: c.nombre, filas });
  }
  const restantes = fuentes.filter((f) => !usadas.has(f.id));
  if (restantes.length)
    grupos.push({
      id: "producto",
      nombre: "Diseños del producto",
      filas: restantes.map((fuente) => ({
        id: fuente.id,
        nombre: fuente.nombre,
        fuente,
      })),
    });
  return grupos;
}
