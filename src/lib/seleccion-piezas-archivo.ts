import type {
  FuenteGuardada,
  InspeccionVector,
  SeleccionVector,
} from "./geometrias-producto-api";
import {
  nuevaFuenteGeometria,
  type FuenteGeometriaComercial,
} from "./producto-geometrias";

export function incorporarPiezasArchivo(
  fuentes: FuenteGeometriaComercial[],
  interpretadas: FuenteGuardada[],
  nombreArchivo: string,
  fuenteId?: string,
  idsReservados: string[] = [],
) {
  const existente =
    fuentes.find((f) => f.id === fuenteId) ??
    (!fuenteId ? fuentes.find((f) => !f.predeterminada) : undefined);
  const siguientes = [...fuentes];
  interpretadas.forEach((predeterminada, index) => {
    const reemplazada = index === 0 ? existente : undefined;
    const nombreBase = nombreArchivo.replace(/\.(dxf|svg)$/i, "");
    const nombre =
      interpretadas.length > 1
        ? `${nombreBase.slice(0, 105)} · Pieza ${index + 1}`
        : nombreBase.slice(0, 120);
    const nueva = reemplazada ?? {
      ...nuevaFuenteGeometria([
        ...siguientes,
        ...idsReservados.map((id) => ({ id, nombre: id, requerida: false })),
      ]),
      nombre,
    };
    const actualizada = {
      ...nueva,
      ...(!reemplazada?.predeterminada ? { nombre } : {}),
      predeterminada,
      permitirReemplazo: nueva.permitirReemplazo ?? false,
    };
    if (reemplazada)
      siguientes[siguientes.findIndex((f) => f.id === reemplazada.id)] =
        actualizada;
    else siguientes.push(actualizada);
  });
  return siguientes;
}

export function piezasDeCapa(inspeccion: InspeccionVector, capa: string) {
  return (inspeccion.piezas ?? []).filter(
    (p) =>
      inspeccion.entidades.find((e) => e.id === p.exteriorId)?.capa === capa,
  );
}

export function seleccionarPiezasArchivo(
  inspeccion: InspeccionVector,
  exteriorIds: string[],
  actual: SeleccionVector,
): SeleccionVector {
  const exteriores = new Set(exteriorIds);
  const interiores = (inspeccion.piezas ?? [])
    .filter((p) => exteriores.has(p.exteriorId))
    .flatMap((p) => p.interioresIds);
  const operaciones = actual.operaciones.filter(
    (o) => !exteriores.has(o.entidadId),
  );
  for (const entidadId of interiores)
    if (!operaciones.some((o) => o.entidadId === entidadId))
      operaciones.push({ entidadId, tipo: "CORTE_INTERIOR" });
  return {
    ...actual,
    exteriorId: exteriorIds[0] ?? "",
    exteriorIds,
    cerrarExterior: false,
    excluidas: actual.excluidas?.filter(
      (id) => !exteriores.has(id) && !interiores.includes(id),
    ),
    operaciones,
  };
}

export function seleccionInicialArchivo(
  inspeccion: InspeccionVector,
): SeleccionVector {
  const actual: SeleccionVector = {
    exteriorId: inspeccion.sugeridaId,
    unidad: inspeccion.unidadDeclarada ?? "",
    cerrarExterior: false,
    operaciones: [],
    excluidas: [],
  };
  const capa = inspeccion.entidades.find(
    (e) => e.id === inspeccion.sugeridaId,
  )?.capa;
  const piezas = capa == null ? [] : piezasDeCapa(inspeccion, capa);
  if (inspeccion.piezasSugeridas?.length)
    return seleccionarPiezasArchivo(
      inspeccion,
      inspeccion.piezasSugeridas,
      actual,
    );
  return piezas.length
    ? seleccionarPiezasArchivo(
        inspeccion,
        piezas.map((p) => p.exteriorId),
        actual,
      )
    : actual;
}
