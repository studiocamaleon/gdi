import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { regionalDelTenant } from '../common/regional';
import { CotizacionesService } from './cotizaciones.service';
import { DOLAR_ANTIGUEDAD_MAX_MS } from './cotizaciones.types';
import type {
  SolicitudTipoCambio,
  TipoCambioConfig,
  TipoCambioSnapshot,
} from './tipo-cambio.types';

export function factorCambioMaterial(
  moneda: string | null | undefined,
  cambio: TipoCambioSnapshot,
): number {
  const origen = moneda?.trim().toUpperCase() || cambio.monedaDestino;
  if (origen === cambio.monedaDestino) return 1;
  if (origen !== 'USD')
    throw new BadRequestException(
      `No hay conversión de ${origen} a ${cambio.monedaDestino}. Configurá el costo en USD o ${cambio.monedaDestino}.`,
    );
  if (
    cambio.tasa === null ||
    !Number.isFinite(cambio.tasa) ||
    cambio.tasa <= 0
  ) {
    throw new BadRequestException(
      `Falta un tipo de cambio válido de USD a ${cambio.monedaDestino}. Configurá una tasa manual o actualizá la cotización automática.`,
    );
  }
  return cambio.tasa;
}

@Injectable()
export class TipoCambioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cotizaciones: CotizacionesService,
  ) {}

  async configuracion(tenantId: string): Promise<TipoCambioConfig> {
    const datos = await this.prisma.datosEmpresa.findUnique({
      where: { tenantId },
      select: { monedaCodigo: true, tipoCambioConfig: true },
    });
    const destino = datos?.monedaCodigo ?? 'ARS';
    const config = datos?.tipoCambioConfig as Partial<TipoCambioConfig> | null;
    return {
      modo: config?.modo === 'manual' ? 'manual' : 'automatico',
      referencia: config?.referencia ?? null,
      tasaManual:
        config?.monedaDestino === destino ? (config.tasaManual ?? null) : null,
      monedaDestino: destino,
    };
  }

  async guardarConfiguracion(tenantId: string, input: SolicitudTipoCambio) {
    const regional = await regionalDelTenant(this.prisma, tenantId);
    this.validarSolicitud(input);
    const config: TipoCambioConfig = {
      modo: input.modo ?? 'automatico',
      referencia: input.referencia ?? null,
      tasaManual: input.modo === 'manual' ? input.tasa! : null,
      monedaDestino: regional.moneda.codigo,
    };
    await this.prisma.datosEmpresa.upsert({
      where: { tenantId },
      create: { tenantId, tipoCambioConfig: config },
      update: { tipoCambioConfig: config },
    });
    return config;
  }

  /** La API sólo acepta una decisión; fechas, fuente y autor los firma el servidor. */
  async crear(
    tenantId: string,
    usuarioId: string | null,
    input: SolicitudTipoCambio = {},
  ): Promise<TipoCambioSnapshot> {
    const snapshot = await this.resolver(tenantId, usuarioId, input);
    await this.prisma.tipoCambioCotizacion.create({
      data: {
        id: snapshot.id,
        tenantId,
        snapshotJson: snapshot as unknown as Prisma.InputJsonObject,
      },
    });
    return snapshot;
  }

  async obtener(tenantId: string, id: string): Promise<TipoCambioSnapshot> {
    const registro = await this.prisma.tipoCambioCotizacion.findFirst({
      where: { id, tenantId },
    });
    if (!registro)
      throw new NotFoundException(
        'No se encontró el tipo de cambio de esta cotización.',
      );
    return registro.snapshotJson as unknown as TipoCambioSnapshot;
  }

  async obtenerParaCotizar(
    tenantId: string,
    id: string,
  ): Promise<TipoCambioSnapshot> {
    const [snapshot, regional] = await Promise.all([
      this.obtener(tenantId, id),
      regionalDelTenant(this.prisma, tenantId),
    ]);
    if (snapshot.monedaDestino !== regional.moneda.codigo)
      throw new BadRequestException(
        'Cambió la moneda de la empresa. Actualizá el tipo de cambio y recotizá todo el documento.',
      );
    return snapshot;
  }

  async resolver(
    tenantId: string,
    usuarioId: string | null = null,
    input: SolicitudTipoCambio = {},
  ): Promise<TipoCambioSnapshot> {
    this.validarSolicitud(input);
    const [regional, config] = await Promise.all([
      regionalDelTenant(this.prisma, tenantId),
      this.configuracion(tenantId),
    ]);
    const modo = input.modo ?? config.modo;
    const snapshot: TipoCambioSnapshot = {
      version: 1,
      id: randomUUID(),
      monedaOrigen: 'USD',
      monedaDestino: regional.moneda.codigo,
      paisCodigo: regional.paisCodigo,
      modo,
      origen: input.modo ? 'documento' : 'empresa',
      tasa: null,
      referencia: input.referencia ?? config.referencia ?? '',
      fuente: modo === 'manual' ? 'Manual' : 'DolarAPI',
      fechaFuente: null,
      capturadoEn: new Date().toISOString(),
      usuarioId,
      observacion: null,
    };
    if (snapshot.monedaDestino === 'USD')
      return {
        ...snapshot,
        modo: 'misma_moneda',
        tasa: 1,
        fuente: 'Misma moneda',
        referencia: 'USD',
      };
    if (modo === 'manual') {
      snapshot.tasa =
        input.modo === 'manual' ? (input.tasa ?? null) : config.tasaManual;
      snapshot.referencia = 'Manual';
      if (!snapshot.tasa)
        snapshot.observacion =
          'Completá la tasa manual para la moneda actual de la empresa.';
      return snapshot;
    }
    const dolar = await this.cotizaciones.dolar(tenantId);
    const referencia = snapshot.referencia || dolar.principalId;
    const tasa = dolar.cotizaciones.find((c) => c.id === referencia);
    const destinoCompatible =
      dolar.monedaLocal === snapshot.monedaDestino ||
      (dolar.monedaLocal === 'VES' && snapshot.monedaDestino === 'VED');
    if (
      !destinoCompatible ||
      dolar.estado !== 'disponible' ||
      !tasa ||
      Date.now() - Date.parse(tasa.fechaActualizacion) > DOLAR_ANTIGUEDAD_MAX_MS
    ) {
      snapshot.observacion = `No hay una tasa automática vigente de USD a ${snapshot.monedaDestino}. Podés ingresar una tasa manual.`;
      return snapshot;
    }
    snapshot.tasa = tasa[dolar.campoPrincipal];
    snapshot.referencia = `${tasa.nombre} · ${dolar.campoPrincipal === 'venta' ? 'venta' : (tasa.tipoReferencia ?? 'referencia')}`;
    snapshot.fechaFuente = tasa.fechaActualizacion;
    return snapshot;
  }

  private validarSolicitud(input: SolicitudTipoCambio) {
    if (
      input.modo === 'manual' &&
      (!Number.isFinite(input.tasa) ||
        input.tasa! <= 0 ||
        input.tasa! > 1_000_000_000)
    )
      throw new BadRequestException(
        'Ingresá un tipo de cambio manual mayor que cero.',
      );
    if (
      input.modo !== undefined &&
      input.modo !== 'manual' &&
      input.modo !== 'automatico'
    )
      throw new BadRequestException('El modo de cambio no es válido.');
  }
}
