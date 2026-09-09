import type { FuenteDisenoVectorial } from "@/components/comercial/diseno-vectorial-cotizador";
import type { FuenteGuardada } from "./geometrias-producto-api";
import type { ConfiguracionGeometriasComerciales } from "./producto-geometrias";
import type { ProductoRecetaRevision } from "./productos-servicios-api";

export function idsFuentesVectorialesHeredadas(
  componentes: ProductoRecetaRevision["componentes"] = [],
) {
  return new Set(
    componentes.flatMap((c) => {
      if (c.configuracionJson?.piezas?.length) return [];
      return (c.configuracionJson?.bindings ?? []).flatMap((b) => {
        const campo = b.regla?.fuente
          ? b.regla.fuente.tipo === "PADRE"
            ? b.regla.fuente.campo
            : undefined
          : (b.regla?.campoPadre ?? b.padreClave);
        return b.clave === "disenoVectorialFuente" &&
          ["PADRE", "FORMULA"].includes(b.origen) &&
          (!b.regla || b.regla.operador === "COPIAR") &&
          campo?.startsWith("geometriasVectoriales.")
          ? [campo.slice("geometriasVectoriales.".length)]
          : [];
      });
    }),
  );
}

export type PiezaVectorialCotizacion = {
  id: string;
  nombre: string;
  cantidadPorUnidad: number;
  fuente: FuenteDisenoVectorial;
};

export function admiteColeccionVectorial(
  estructura: string | undefined,
  familia: string | undefined,
) {
  // Hilo caliente conserva su editor de segmentación y encastres.
  return (
    estructura !== "COMPUESTO" &&
    Boolean(familia) &&
    familia !== "corte_hilo_caliente"
  );
}

export function esFuenteInterpretada(
  fuente: FuenteDisenoVectorial,
): fuente is FuenteGuardada {
  return fuente.schemaVersion === 2 && Boolean(fuente.procedencia?.geometriaId);
}

/** null significa que aún se usan los diseños iniciales; [] es una eliminación explícita. */
export function piezasVectorialesIniciales(
  piezas: PiezaVectorialCotizacion[] | null | undefined,
  configuracion: ConfiguracionGeometriasComerciales,
  principal: FuenteDisenoVectorial | null,
  fuentes: Record<string, FuenteDisenoVectorial>,
): PiezaVectorialCotizacion[] {
  if (piezas != null) return piezas;
  const iniciales = configuracion.fuentes.flatMap((f, i) => {
    const fuente =
      (i === 0 ? principal : null) ?? fuentes[f.id] ?? f.predeterminada;
    return fuente
      ? [{ id: f.id, nombre: f.nombre, cantidadPorUnidad: 1, fuente }]
      : [];
  });
  if (!iniciales.length && principal)
    iniciales.push({
      id: "principal",
      nombre: principal.nombreArchivo
        .replace(/\.(svg|dxf)$/i, "")
        .slice(0, 120),
      cantidadPorUnidad: 1,
      fuente: principal,
    });
  return iniciales;
}

export function piezasVectorialesValidas(
  piezas: PiezaVectorialCotizacion[],
  cantidadProductos = 1,
) {
  return (
    Number.isSafeInteger(cantidadProductos) &&
    cantidadProductos > 0 &&
    piezas.length > 0 &&
    piezas.length <= 30 &&
    new Set(piezas.map((p) => p.id)).size === piezas.length &&
    piezas.every(
      (p) =>
        p.nombre.trim() &&
        Number.isSafeInteger(p.cantidadPorUnidad) &&
        p.cantidadPorUnidad > 0 &&
        p.cantidadPorUnidad <= 10000 &&
        p.fuente.svg &&
        p.fuente.anchoFinalMm > 0,
    )
  );
}

/** El servidor deriva medidas/recorridos; no deben viajar restos del editor rectangular. */
export function aplicarColeccionVectorial(
  contexto: Record<string, unknown>,
  piezas: PiezaVectorialCotizacion[],
) {
  for (const clave of [
    "piezas",
    "medidaCustomMm",
    "medidaPredefinidaId",
    "medidaPredefinidaNombre",
    "piezaAnchoMaxMm",
    "piezaAltoMaxMm",
    "piezaAreaTotalM2",
    "piezaPerimetroTotalM",
    "disenoVectorialFuente",
    "disenoVectorialCacheKey",
    "geometriaVectorial",
  ])
    delete contexto[clave];
  contexto.disenosVectoriales = piezas;
}
