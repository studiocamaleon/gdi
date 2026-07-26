import { BadRequestException, Injectable } from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { claveFechaEnZona } from '../common/zona';
import { regionalDelTenant } from '../common/regional';
import {
  granularidad,
  parseRango,
  periodoAnterior,
  type Granularidad,
  type Rango,
} from './periodo';
import type { RangoReporteDto } from './dto/rango-reporte.dto';

/**
 * `meta` que acompaña cada payload del Panel: la honestidad viaja del
 * backend (fuente, límites, si hay o no comparativa) — el front no la
 * inventa. Cada reporte suma sus propios `limites`.
 */
export type MetaReporte = {
  fuente: string;
  limites: string[];
  /** El período anterior no tiene datos: los deltas van en null. */
  sinComparativa: boolean;
  rango: { desde: string; hasta: string };
  rangoAnterior: { desde: string; hasta: string };
  granularidad: Granularidad;
};

/** La fecha calendario del borde, en la zona del rango (no la del proceso). */
const iso = (fecha: Date, zona: string) => claveFechaEnZona(fecha, zona);

/**
 * Cimiento del módulo Panel: resuelve el rango una vez y arma la `meta`
 * base. Cada service de dominio (rentabilidad, ventas, …) la recibe y la
 * completa. `sinComparativa` lo decide cada dominio según si su período
 * anterior trajo datos; acá arranca en false y se puede pisar.
 */
@Injectable()
export class ReportesService {
  constructor(readonly prisma: PrismaService) {}

  /**
   * El rango se interpreta en la ZONA del tenant: "2026-07-01" es la
   * medianoche de SU taller, y el default "este mes" es el mes que corre
   * en su reloj de pared (no en el del server).
   */
  async resolverRango(
    tenantId: string,
    query: RangoReporteDto,
  ): Promise<{ rango: Rango; anterior: Rango }> {
    const { zonaHoraria } = await regionalDelTenant(this.prisma, tenantId);
    try {
      const rango = parseRango(query.desde, query.hasta, new Date(), zonaHoraria);
      return { rango, anterior: periodoAnterior(rango) };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Rango inválido.',
      );
    }
  }

  metaBase(
    rango: Rango,
    anterior: Rango,
    fuente: string,
    extra?: { limites?: string[]; sinComparativa?: boolean },
  ): MetaReporte {
    return {
      fuente,
      limites: extra?.limites ?? [],
      sinComparativa: extra?.sinComparativa ?? false,
      rango: { desde: iso(rango.desde, rango.zona), hasta: iso(rango.hasta, rango.zona) },
      rangoAnterior: {
        desde: iso(anterior.desde, anterior.zona),
        hasta: iso(anterior.hasta, anterior.zona),
      },
      granularidad: granularidad(rango),
    };
  }

  /** El módulo no muta datos: acá sólo se leen agregados por tenant. */
  tenantId(auth: CurrentAuth): string {
    return auth.tenantId;
  }
}
