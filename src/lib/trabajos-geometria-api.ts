import { apiRequest } from "@/lib/api";

export type PuntoNestingOpenNest = { x: number; y: number };

export type SolicitudTrabajoNestingOpenNest = {
  motor?: "collision" | "nfp";
  placa: {
    anchoMm: number;
    altoMm: number;
    margenMm: number;
    maxPlacas: number;
  };
  separacionMm: number;
  timeoutMs?: number;
  semilla?: number;
  piezas: Array<{
    id: string;
    cantidad: number;
    rotaciones: number;
    contorno: PuntoNestingOpenNest[];
    huecos?: Array<{ puntos: PuntoNestingOpenNest[] }>;
  }>;
  claveSolicitud?: string;
};

export type EstadoTrabajoGeometria =
  "pendiente" | "procesando" | "completado" | "fallido" | "cancelado";

export type TrabajoNestingOpenNest = {
  id: string;
  tipo: "geometry.nest-irregular-opennest.v1";
  estado: EstadoTrabajoGeometria;
  creadoEl: string;
  iniciadoEl?: string;
  finalizadoEl?: string;
  correlationId: string;
  progreso: {
    porcentaje: number;
    etapa: "en_cola" | "opennest" | "validando" | "completado";
  };
  resultado?: {
    schemaVersion: 1;
    algoritmo: "opennest-v1" | "grafonest-baseline-v1";
    motor: "collision" | "nfp";
    versionMotor: string;
    cantidadSolicitada: number;
    cantidadColocada: number;
    placasUsadas: number;
    duracionMs: number;
    estrategiaOrientacion?: "uniforme" | "cardinal" | "libre";
    rotacionesPermitidas?: number;
    versionPoliticaOrientacion?: number;
    calidadSolucion?: "BASE_SEGURA" | "OPTIMIZADA";
    optimizacionAgotada?: boolean;
    placements: Array<{
      piezaId: string;
      copia: number;
      placa: number;
      rotacionGrados: number;
      traslacion: PuntoNestingOpenNest;
      contorno: PuntoNestingOpenNest[];
      huecos: PuntoNestingOpenNest[][];
    }>;
    validacion: {
      completa: true;
      dentroDePlaca: true;
      sinSolapamientos: true;
      separacionRespetada: true;
    };
  };
  error?: { codigo: string; mensaje: string };
  cancelacion?: {
    motivo: "usuario" | "obsoleto";
    solicitadaEl: string;
    reemplazadoPor?: string;
  };
};

export function crearTrabajoNestingOpenNest(
  input: SolicitudTrabajoNestingOpenNest,
): Promise<TrabajoNestingOpenNest> {
  return apiRequest("/trabajos-geometria/nesting-irregular", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function consultarTrabajoGeometria(
  id: string,
): Promise<TrabajoNestingOpenNest> {
  return apiRequest(`/trabajos-geometria/${encodeURIComponent(id)}`);
}

export function cancelarTrabajoGeometria(
  id: string,
): Promise<TrabajoNestingOpenNest> {
  return apiRequest(`/trabajos-geometria/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** Polling reutilizable; W3 lo conectará al cotizador vectorial existente. */
export async function esperarTrabajoGeometria(
  inicial: TrabajoNestingOpenNest,
  options?: {
    signal?: AbortSignal;
    intervaloMs?: number;
    timeoutMs?: number;
    onChange?: (trabajo: TrabajoNestingOpenNest) => void;
  },
): Promise<TrabajoNestingOpenNest> {
  let current = inicial;
  const started = Date.now();
  const timeoutMs = options?.timeoutMs ?? 70_000;
  while (current.estado === "pendiente" || current.estado === "procesando") {
    if (options?.signal?.aborted)
      throw new DOMException("Consulta cancelada.", "AbortError");
    if (Date.now() - started >= timeoutMs)
      throw new Error("El cálculo continúa en segundo plano.");
    await delay(options?.intervaloMs ?? 350, options?.signal);
    current = await consultarTrabajoGeometria(current.id);
    options?.onChange?.(current);
  }
  return current;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Consulta cancelada.", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Consulta cancelada.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}
