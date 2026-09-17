import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DOLAR_COBERTURA,
  normalizarDolar,
  tieneCobertura,
  type PaisDolar,
} from './dolar-api';
import {
  DOLAR_ANTIGUEDAD_MAX_MS,
  DOLAR_REFRESH_MS,
  type CotizacionDolar,
  type DolarResponse,
} from './cotizaciones.types';

type Cache = {
  cotizaciones: CotizacionDolar[];
  consultadoEn: string | null;
  reintentarEn: number;
  fallo: boolean;
};

@Injectable()
export class CotizacionesService {
  private readonly logger = new Logger(CotizacionesService.name);
  // Sólo datos públicos; máximo ocho entradas por proceso, compartidas entre tenants.
  private readonly cache = new Map<PaisDolar, Cache>();
  private readonly pendientes = new Map<PaisDolar, Promise<Cache>>();

  constructor(private readonly prisma: PrismaService) {}

  async dolar(tenantId: string): Promise<DolarResponse> {
    const empresa = await this.prisma.datosEmpresa.findUnique({
      where: { tenantId },
      select: { paisCodigo: true },
    });
    const pais = empresa?.paisCodigo || 'AR';
    if (!tieneCobertura(pais))
      return {
        paisCodigo: pais,
        monedaLocal: null,
        estado: 'sin_cobertura',
        principalId: null,
        campoPrincipal: 'venta',
        cotizaciones: [],
        consultadoEn: null,
        proximaConsultaEn: null,
      };

    let datos = this.cache.get(pais);
    if (!datos || datos.reintentarEn <= Date.now()) {
      let pendiente = this.pendientes.get(pais);
      if (!pendiente) {
        pendiente = this.actualizar(pais).finally(() =>
          this.pendientes.delete(pais),
        );
        this.pendientes.set(pais, pendiente);
      }
      datos = await pendiente;
    }
    const config = DOLAR_COBERTURA[pais];
    const principal = datos.cotizaciones.find((c) => c.id === config.principal);
    const antigua =
      principal &&
      Date.now() - Date.parse(principal.fechaActualizacion) >
        DOLAR_ANTIGUEDAD_MAX_MS;
    return {
      paisCodigo: pais,
      monedaLocal: config.moneda,
      estado: !principal
        ? 'no_disponible'
        : datos.fallo || antigua
          ? 'sin_actualizar'
          : 'disponible',
      principalId: config.principal,
      campoPrincipal: config.campo,
      cotizaciones: datos.cotizaciones,
      consultadoEn: datos.consultadoEn,
      proximaConsultaEn: new Date(datos.reintentarEn).toISOString(),
    };
  }

  private async actualizar(pais: PaisDolar): Promise<Cache> {
    let datos: Cache;
    try {
      const response = await fetch(DOLAR_COBERTURA[pais].url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const cotizaciones = normalizarDolar(pais, await response.json());
      datos = {
        cotizaciones,
        consultadoEn: new Date().toISOString(),
        reintentarEn: Date.now() + DOLAR_REFRESH_MS,
        fallo: false,
      };
    } catch {
      this.logger.warn(`DolarAPI: no se pudo actualizar ${pais}`);
      const anterior = this.cache.get(pais);
      datos = {
        cotizaciones: anterior?.cotizaciones ?? [],
        consultadoEn: anterior?.consultadoEn ?? null,
        reintentarEn: Date.now() + 60_000,
        fallo: true,
      };
    }
    this.cache.set(pais, datos);
    return datos;
  }
}
