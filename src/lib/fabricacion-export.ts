import type { FabricacionVectorial } from "./fabricacion-vectorial";
import type { NestingViewerInput } from "./productos-servicios-api";
import { apiRequest } from "./api";
import type { RecorridoFabricacion } from "./fabricacion-vectorial";
import type { FuenteGuardada } from "./geometrias-producto-api";

type Placement = NestingViewerInput["placements"][number];
type Referencia = Pick<FuenteGuardada["procedencia"], "geometriaId" | "hash">;
type Meta = {
  fabricacion?: FabricacionVectorial;
  propietario?: { interpretacion?: Referencia };
  demandaId?: string;
  segmentacion?: unknown;
  rotacionGrados?: number;
  contornos?: { esHueco?: boolean; puntos: { x: number; y: number }[] }[];
  operaciones?: FuenteGuardada["operaciones"];
};

/** Los pasos de corte antiguos no publicaban propietario. La fuente sigue en
 * su componente: se vincula por identidad de diseño, nunca por nombre/medidas. */
export function vincularFuentesFabricacion(
  result: NestingViewerInput,
  contexto: unknown,
): NestingViewerInput {
  const ctx = contexto as
    | {
        disenosVectoriales?: {
          id: string;
          fuente?: { procedencia?: Referencia };
        }[];
        disenoVectorialFuente?: { procedencia?: Referencia };
      }
    | undefined;
  if (!ctx) return result;
  let cambio = false;
  const placements = result.placements.map((p) => {
    if (fabricacionDePlacement(p) || referencia(result, p)) return p;
    const disenos =
      ctx.disenosVectoriales?.filter(
        (d) => d.id && String(p.pieceId).startsWith(`${d.id}__`),
      ) ?? [];
    const ref =
      disenos.length === 1
        ? disenos[0].fuente?.procedencia
        : !ctx.disenosVectoriales?.length
          ? ctx.disenoVectorialFuente?.procedencia
          : undefined;
    if (!ref?.geometriaId) return p;
    cambio = true;
    const meta = p.meta as Meta | undefined;
    return {
      ...p,
      meta: {
        ...meta,
        propietario: { ...meta?.propietario, interpretacion: ref },
      },
    };
  });
  return cambio ? { ...result, placements } : result;
}

function referencia(result: NestingViewerInput, p: Placement) {
  const meta = p.meta as Meta | undefined;
  if (meta?.fabricacion)
    return {
      geometriaId: meta.fabricacion.geometriaId,
      hash: meta.fabricacion.archivoHash,
    };
  return (
    meta?.propietario?.interpretacion ??
    result.solucionNesting?.problema.demandas.find(
      (d) => d.id === (meta?.demandaId ?? p.pieceId),
    )?.propietario?.interpretacion
  );
}

function requiereDocumento(p: Placement) {
  const doc = fabricacionDePlacement(p);
  return !doc || (doc.formato === "DXF" && !doc.dxfNativo);
}

export function faltanCapasFabricacion(result: NestingViewerInput) {
  return result.placements.some(
    (p) => requiereDocumento(p) && !!referencia(result, p)?.geometriaId,
  );
}

// La caché pertenece al resultado inmutable, sin compartir datos entre cuentas.
const recuperaciones = new WeakMap<
  NestingViewerInput,
  Promise<NestingViewerInput>
>();

/** Recupera capas de interpretaciones anteriores sin recalcular el acomodo ni
 * modificar el snapshot. Verifica su registro contra los contornos colocados. */
export function completarFabricacionNesting(
  result: NestingViewerInput,
): Promise<NestingViewerInput> {
  if (!faltanCapasFabricacion(result)) return Promise.resolve(result);
  const previa = recuperaciones.get(result);
  if (previa) return previa;
  const tarea = recuperar(result).catch((error) => {
    recuperaciones.delete(result);
    throw error;
  });
  recuperaciones.set(result, tarea);
  return tarea;
}

async function recuperar(
  result: NestingViewerInput,
): Promise<NestingViewerInput> {
  const pendientes = result.placements.filter(
    (p) => requiereDocumento(p) && referencia(result, p)?.geometriaId,
  );
  const ids = [
    ...new Set(pendientes.map((p) => referencia(result, p)!.geometriaId)),
  ];
  const documentos = new Map<string, FabricacionVectorial>();
  for (let i = 0; i < ids.length; i += 30) {
    const respuesta = await apiRequest<{ documentos: FabricacionVectorial[] }>(
      "/productos-servicios/geometrias/capas-fabricacion",
      {
        method: "POST",
        body: JSON.stringify({ geometriaIds: ids.slice(i, i + 30) }),
      },
    );
    respuesta.documentos.forEach((d) => documentos.set(d.geometriaId, d));
  }
  return {
    ...result,
    placements: result.placements.map((p) => {
      const ref = referencia(result, p);
      if (!requiereDocumento(p) || !ref?.geometriaId) return p;
      const doc = documentos.get(ref.geometriaId);
      if (!doc || doc.archivoHash !== ref.hash)
        throw new Error(
          "Las capas no coinciden con el archivo usado en este plan.",
        );
      return {
        ...p,
        meta: { ...(p.meta as Meta), fabricacion: registrarDocumento(doc, p) },
      };
    }),
  };
}

function registrarDocumento(
  doc: FabricacionVectorial,
  p: Placement,
): FabricacionVectorial {
  const meta = p.meta as Meta | undefined;
  const fallo = () =>
    new Error(
      "Las capas no coinciden con el contorno colocado. Revisá la interpretación de la pieza antes de descargarla.",
    );
  const exterior = doc.entidades.find((e) => e.rol === "CORTE_EXTERIOR");
  const colocado = meta?.contornos
    ?.filter((c) => !c.esHueco)
    .flatMap((c) => c.puntos);
  if (meta?.segmentacion || !exterior || !colocado?.length) throw fallo();
  const angulo =
    ((meta?.rotacionGrados ?? (p.rotated ? 90 : 0)) * Math.PI) / 180;
  const c = Math.cos(angulo),
    s = Math.sin(angulo);
  const girados = exterior.puntos.map((v) => ({
    x: c * v.x - s * v.y,
    y: s * v.x + c * v.y,
  }));
  const x =
    Math.min(...colocado.map((v) => v.x)) -
    Math.min(...girados.map((v) => v.x));
  const y =
    Math.min(...colocado.map((v) => v.y)) -
    Math.min(...girados.map((v) => v.y));
  const puntos = girados.map((v) => ({ x: v.x + x, y: v.y + y }));
  // La normalización y simplificación del nesting pueden eliminar vértices
  // colineales: se comparan segmentos en ambas direcciones, no índices.
  const sobre = (a: typeof puntos, b: typeof puntos) =>
    a.every((v) =>
      b.some((q, i) => {
        const r = b[(i + 1) % b.length],
          dx = r.x - q.x,
          dy = r.y - q.y;
        const largo2 = dx * dx + dy * dy;
        const t = largo2
          ? Math.max(
              0,
              Math.min(1, ((v.x - q.x) * dx + (v.y - q.y) * dy) / largo2),
            )
          : 0;
        return Math.hypot(v.x - q.x - t * dx, v.y - q.y - t * dy) <= 0.05;
      }),
    );
  if (!sobre(puntos, colocado) || !sobre(colocado, puntos)) throw fallo();
  return { ...doc, transformacion: [c, s, -s, c, x, y] };
}

export function fabricacionDePlacement(
  placement: NestingViewerInput["placements"][number],
) {
  return (placement.meta as { fabricacion?: FabricacionVectorial } | undefined)
    ?.fabricacion;
}

export function recorridosEnPlaca(documento: FabricacionVectorial) {
  const [a, b, c, d, x, y] = documento.transformacion;
  const transformar = (p: { x: number; y: number }) => ({
    x: a * p.x + c * p.y + x,
    y: b * p.x + d * p.y + y,
  });
  return documento.entidades
    .filter((e) => e.conservar)
    .map((e) => ({
      ...e,
      puntos: e.puntos.map(transformar),
      ...(e.texto
        ? {
            texto: {
              ...e.texto,
              ...transformar(e.texto),
              rotacion: e.texto.rotacion + (Math.atan2(b, a) * 180) / Math.PI,
            },
          }
        : {}),
    }));
}

export function recorridosDePlacement(p: Placement): RecorridoFabricacion[] {
  const documento = fabricacionDePlacement(p);
  if (documento) return recorridosEnPlaca(documento);
  return ((p.meta as Meta | undefined)?.operaciones ?? []).map((op) => ({
    ...op,
    rol: op.tipo,
    conservar: true,
    tipoEntidad: "POLYLINE",
    longitudMm: null,
    precisionLongitud: null,
  }));
}
