import { apiRequest } from "@/lib/api";

/**
 * Métricas históricas del ETA — contrato con /eta/*.
 * Ver docs/eta-metricas-historicas-diseno.md
 */

/** Precisión de las promesas ya cerradas (GET /eta/precision). */
export type PrecisionEta = {
  /** Promesas con finReal (ya cerradas). */
  cerradas: number;
  /** De ésas, las que tenían ETA estimable (error medible). */
  muestras: number;
  sinEstimar: number;
  coberturaPct: number;
  maeMin: number | null;
  medianaAbsMin: number | null;
  p90AbsMin: number | null;
  /** Media del error con signo: + = tiende a terminar TARDE. */
  sesgoMin: number | null;
  dentro4hPct: number | null;
  dentro1dPct: number | null;
  tardePct: number | null;
};

/** Sesgo estimado-vs-real de una familia + la corrección sugerida. */
export type SesgoFamiliaEta = {
  familiaCodigo: string;
  familiaNombre?: string | null;
  muestras: number;
  medianaEstimadoMin: number;
  medianaRealMin: number;
  /** Real − estimado (+ = tarda MÁS de lo estimado). */
  sesgoMin: number;
  sesgoPct: number;
  /** Mediana real como corrección sugerida; null = calibrado o sin evidencia. */
  duracionSugeridaMin: number | null;
};

/** Salud del modelo (GET /eta/salud). */
export type SaludEta = {
  cobertura: {
    promesas: number;
    conEtaPct: number;
    sinEstimarPct: number;
    parcialPct: number;
  };
  sesgoFamilias: SesgoFamiliaEta[];
};

/** Fila de la serie diaria de cola por estación (GET /eta/colas). */
export type ColaEstacionEta = {
  id: string;
  fecha: string;
  estacionKey: string;
  estacionNombre: string;
  colaMin: number;
  /** Prisma Decimal → string en JSON; coercer con Number en el consumidor. */
  horizonteDias: string | null;
  esperaP50Min: number;
  esperaP90Min: number;
  contencionMax: number;
  utilizacion5dPct: string;
  pasosEnPlan: number;
};

function qs(rango?: { desde?: string; hasta?: string }): string {
  const params = new URLSearchParams();
  if (rango?.desde) params.set("desde", rango.desde);
  if (rango?.hasta) params.set("hasta", rango.hasta);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function getEtaPrecision(rango?: { desde?: string; hasta?: string }) {
  return apiRequest<PrecisionEta>(`/eta/precision${qs(rango)}`);
}

export function getEtaSalud() {
  return apiRequest<SaludEta>(`/eta/salud`);
}

export function getEtaColas(filtro?: {
  estacion?: string;
  desde?: string;
  hasta?: string;
}) {
  const params = new URLSearchParams();
  if (filtro?.estacion) params.set("estacion", filtro.estacion);
  if (filtro?.desde) params.set("desde", filtro.desde);
  if (filtro?.hasta) params.set("hasta", filtro.hasta);
  const s = params.toString();
  return apiRequest<ColaEstacionEta[]>(`/eta/colas${s ? `?${s}` : ""}`);
}

/** Dispara la foto del día para este tenant (backfill / "actualizar ahora"). */
export function dispararEtaSnapshot() {
  return apiRequest<{ ok: boolean }>(`/eta/snapshot`, { method: "POST" });
}
