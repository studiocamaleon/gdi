/**
 * Modelo universal (C.1.3) — Shadow Logger
 *
 * Helper que compara dos cotizaciones en shape canónica (v1 via adapter vs v2
 * nativo) y persiste el diff en CotizacionShadowLog. Usado por el dispatcher
 * cuando `ProductoServicio.motorPreferido = SHADOW`.
 *
 * El log se escribe best-effort: si falla la escritura, no se propaga el error
 * (el usuario recibe el resultado v1 sin interrupción).
 */
import { createHash } from 'node:crypto';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';
import type { CotizacionCanonica } from '../dto/cotizacion-canonica.dto';

export type AnomaliaShadow = {
  tipo: 'bucket_mismatch' | 'pasos_extra_en_v2' | 'pasos_faltantes_en_v2' | 'total_difiere' | 'error_v2';
  detalle: string;
};

function computarAnomalias(v1: CotizacionCanonica, v2: CotizacionCanonica): AnomaliaShadow[] {
  const anomalias: AnomaliaShadow[] = [];

  const tolerancia = 0.01; // centavo
  if (Math.abs(v1.total - v2.total) > tolerancia) {
    anomalias.push({
      tipo: 'total_difiere',
      detalle: `v1.total=${v1.total}, v2.total=${v2.total}, diff=${(v1.total - v2.total).toFixed(2)}`,
    });
  }

  const buckets: Array<keyof CotizacionCanonica['subtotales']> = ['centroCosto', 'materiasPrimas', 'cargosFlat'];
  for (const b of buckets) {
    const a = v1.subtotales[b];
    const bv = v2.subtotales[b];
    if (Math.abs(a - bv) > tolerancia) {
      anomalias.push({
        tipo: 'bucket_mismatch',
        detalle: `subtotales.${b}: v1=${a}, v2=${bv}, diff=${(a - bv).toFixed(2)}`,
      });
    }
  }

  const pasosV1 = new Set(v1.pasos.map((p) => p.nombre));
  const pasosV2 = new Set(v2.pasos.map((p) => p.nombre));
  for (const p of pasosV2) {
    if (!pasosV1.has(p)) {
      anomalias.push({ tipo: 'pasos_extra_en_v2', detalle: `paso "${p}" presente en v2 pero no en v1` });
    }
  }
  for (const p of pasosV1) {
    if (!pasosV2.has(p)) {
      anomalias.push({ tipo: 'pasos_faltantes_en_v2', detalle: `paso "${p}" presente en v1 pero falta en v2` });
    }
  }

  return anomalias;
}

function hashInput(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

export async function logShadowDiff(
  prisma: PrismaService,
  auth: CurrentAuth,
  params: {
    productoServicioId: string;
    productoVarianteId: string | null;
    motorCodigo: string;
    input: unknown;
    v1: CotizacionCanonica;
    v2: CotizacionCanonica | { error: string };
  },
): Promise<void> {
  try {
    const v2IsError = 'error' in params.v2;
    const v2Result = v2IsError ? null : (params.v2 as CotizacionCanonica);
    const totalV2 = v2Result?.total ?? 0;
    const diffAbs = Math.abs(params.v1.total - totalV2);
    const diffPct = params.v1.total > 0 ? (diffAbs / params.v1.total) * 100 : 0;

    const anomalias: AnomaliaShadow[] = v2IsError
      ? [{ tipo: 'error_v2', detalle: (params.v2 as { error: string }).error }]
      : computarAnomalias(params.v1, v2Result!);

    await prisma.cotizacionShadowLog.create({
      data: {
        tenantId: auth.tenantId,
        productoServicioId: params.productoServicioId,
        productoVarianteId: params.productoVarianteId,
        motorCodigo: params.motorCodigo,
        inputHash: hashInput(params.input),
        totalV1: params.v1.total as unknown as never,
        totalV2: totalV2 as unknown as never,
        diffAbsoluto: diffAbs as unknown as never,
        diffPct,
        subtotalesV1: params.v1.subtotales as never,
        subtotalesV2: (v2Result?.subtotales ?? {}) as never,
        anomalias: anomalias as unknown as never,
      },
    });
  } catch (err) {
    // Best-effort: no bloquear la cotización principal si el log falla.
    // eslint-disable-next-line no-console
    console.error('[shadow-logger] No se pudo persistir CotizacionShadowLog:', err);
  }
}
