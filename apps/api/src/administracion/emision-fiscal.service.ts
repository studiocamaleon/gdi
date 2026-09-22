import {
  BadRequestException,
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { ComprobanteEmision, Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { bloquearCupoUsuarios } from '../suscripciones/cupos-usuarios';
import { regionalDelTenant } from '../common/regional';
import { AfipSdkProvider } from './invoicing/afip-sdk.provider';
import { ManualProvider } from './invoicing/manual.provider';
import { FacturacionOrdenesService } from './facturacion-ordenes.service';
import type {
  EmitirInput,
  EmitirResultado,
  InvoicingProvider,
  LetraProvider,
} from './invoicing/invoicing-provider';
import {
  CBTE_TIPO,
  CBTE_TIPO_CON_RETENCION,
  texto,
} from './invoicing/codigos-arca';

const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const ACTIVAS = ['preparando', 'enviando', 'verificar'];

/** La admisión se confirma antes de la red. Nunca se reenvía un intento incierto. */
@Injectable()
export class EmisionFiscalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manual: ManualProvider,
    private readonly afip: AfipSdkProvider,
    private readonly facturacion: FacturacionOrdenesService,
    private readonly capacidades: CapacidadesEmpresaService = new CapacidadesEmpresaService(
      prisma,
    ),
  ) {}

  private proveedor(codigo: string): InvoicingProvider {
    if (codigo === 'manual') return this.manual;
    if (codigo === 'afipsdk' && this.afip.disponible) return this.afip;
    throw new ServiceUnavailableException(
      'El proveedor fiscal configurado no está disponible. Revisá la integración antes de emitir.',
    );
  }

  private async exigirNueva(tx: Prisma.TransactionClient, auth: CurrentAuth) {
    await this.capacidades.exigirOperacionTx(
      tx,
      auth.tenantId,
      ['fiscal_argentina'],
      ['fiscal_argentina'],
    );
    if ((await regionalDelTenant(tx, auth.tenantId)).paisCodigo !== 'AR')
      throw new ConflictException(
        'Los comprobantes ARCA corresponden al circuito argentino.',
      );
  }

  private exigirPermiso(auth: CurrentAuth, tipo: string) {
    const permiso =
      tipo === 'nota_credito'
        ? 'administracion.anular'
        : 'administracion.gestionar';
    if (!auth.permisos?.has(permiso))
      throw new ForbiddenException(
        'No tenés permiso para operar este comprobante.',
      );
  }

  async emitir(auth: CurrentAuth, id: string) {
    let admision: { intento: ComprobanteEmision; nueva: boolean };
    try {
      admision = await this.prisma.$transaction(async (tx) => {
        await this.exigirNueva(tx, auth);
        const c = await tx.comprobante.findFirst({
          where: { id, tenantId: auth.tenantId },
          include: {
            puntoVenta: true,
            comprobanteOrigen: { include: { puntoVenta: true } },
          },
        });
        if (!c) throw new NotFoundException('No se encontró el comprobante.');
        this.exigirPermiso(auth, c.tipo);
        const anterior = await tx.comprobanteEmision.findFirst({
          where: { tenantId: auth.tenantId, comprobanteId: id },
          orderBy: [{ creadaEl: 'desc' }, { id: 'desc' }],
        });
        if (
          anterior &&
          (ACTIVAS.includes(anterior.estado) || c.estado === 'emitido')
        )
          return { intento: anterior, nueva: false };
        if (c.estado !== 'borrador' || c.numero !== null)
          throw new ConflictException(
            'Sólo se puede enviar un borrador sin un envío anterior pendiente de verificar.',
          );
        const legadoPendiente = await tx.comprobante.findFirst({
          where: {
            tenantId: auth.tenantId,
            puntoVentaId: c.puntoVentaId,
            tipo: c.tipo,
            letra: c.letra,
            estado: 'borrador',
            numero: { not: null },
          },
          select: { id: true },
        });
        if (legadoPendiente)
          throw new ConflictException(
            'Hay un envío anterior con número fiscal sin resultado verificado. Revisá ese comprobante antes de continuar con esta serie.',
          );
        const config = await tx.configuracionFiscal.findUnique({
          where: { tenantId: auth.tenantId },
        });
        if (!config || !c.puntoVenta.activo)
          throw new BadRequestException(
            'Revisá el emisor y el punto de venta activo.',
          );
        const provider = this.proveedor(config.proveedorFacturacion);
        if (provider.codigo !== 'manual') {
          if (c.puntoVenta.modalidad !== 'web_services')
            throw new BadRequestException(
              'La emisión automática necesita un punto de venta de Web Services.',
            );
          const conexion = await tx.integracionTenant.findFirst({
            where: {
              tenantId: auth.tenantId,
              proveedor: 'AFIP',
              estado: 'CONECTADA',
            },
          });
          if (!conexion)
            throw new ConflictException(
              'Verificá y activá la integración ARCA antes de emitir.',
            );
        }
        await this.validarCompromiso(tx, auth.tenantId, c);
        const receptor = objeto(c.receptorSnapshot);
        const input: EmitirInput = {
          idempotencyKey: c.idempotencyKey,
          emisorCuit: config.cuit,
          tipo: c.tipo as EmitirInput['tipo'],
          letra: c.letra as LetraProvider,
          puntoVenta: c.puntoVenta.numero,
          numero: null,
          fecha: c.fecha.toISOString().slice(0, 10),
          receptor: {
            razonSocial: texto(
              receptor.razonSocial,
              texto(receptor.nombre, 'Consumidor Final'),
            ),
            cuit: texto(receptor.cuit) || null,
            condicionFiscal: texto(
              receptor.condicionFiscal,
              'consumidor_final',
            ),
          },
          items: c.itemsJson as unknown as EmitirInput['items'],
          netoGravado: Number(c.netoGravado),
          ivaTotal: Number(c.ivaTotal),
          ivaPorAlicuota:
            c.ivaPorAlicuota as unknown as EmitirInput['ivaPorAlicuota'],
          total: Number(c.total),
          moneda: c.moneda as 'ARS' | 'USD',
          cotizacion: c.cotizacion ? Number(c.cotizacion) : undefined,
          condicionVenta: c.condicionVenta ?? undefined,
          vencimiento: c.vencimiento?.toISOString().slice(0, 10) ?? null,
          leyenda: c.leyenda,
          asociados:
            c.comprobanteOrigen?.numero != null
              ? [
                  {
                    tipo: c.comprobanteOrigen.tipo,
                    puntoVenta: c.comprobanteOrigen.puntoVenta.numero,
                    numero: c.comprobanteOrigen.numero,
                    fecha: c.comprobanteOrigen.fecha.toISOString().slice(0, 10),
                    cuit: config.cuit,
                    tipoArca: (c.comprobanteOrigen.leyenda ===
                    'OPERACIÓN SUJETA A RETENCIÓN'
                      ? CBTE_TIPO_CON_RETENCION
                      : CBTE_TIPO)[
                      `${c.comprobanteOrigen.tipo}:${c.comprobanteOrigen.letra}`
                    ],
                  },
                ]
              : undefined,
        };
        const ambiente =
          provider.codigo === 'manual' ? 'local' : this.afip.environment;
        const cuitOperativo =
          provider.codigo === 'manual'
            ? config.cuit
            : this.afip.cuitOperativo(config.cuit);
        const tipo = (
          c.leyenda === 'OPERACIÓN SUJETA A RETENCIÓN'
            ? CBTE_TIPO_CON_RETENCION
            : CBTE_TIPO
        )[`${c.tipo}:${c.letra}`];
        if (provider.codigo !== 'manual' && !tipo)
          throw new BadRequestException(
            'Este tipo de comprobante no está integrado con ARCA.',
          );
        const serie = [
          provider.codigo,
          ambiente,
          provider.codigo === 'manual' ? auth.tenantId : cuitOperativo,
          c.puntoVenta.numero,
          tipo ?? `${c.tipo}:${c.letra}`,
        ].join(':');
        const intento = await tx.comprobanteEmision.create({
          data: {
            tenantId: auth.tenantId,
            comprobanteId: id,
            proveedor: provider.codigo,
            ambiente,
            cuitOperativo,
            serie,
            serieActiva: serie,
            estado: 'preparando',
            solicitudJson: json(input),
            emisorJson: json({ config, puntoVenta: c.puntoVenta }),
            solicitadaPorId: auth.userId,
            detalle: 'Preparando el envío. Todavía no se solicitó el CAE.',
          },
        });
        await tx.comprobante.update({
          where: { id },
          data: { estado: 'en_proceso' },
        });
        return { intento, nueva: true };
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException(
          'Hay otro envío fiscal pendiente para este punto de venta y tipo. Verificá su resultado antes de continuar.',
        );
      throw e;
    }
    if (!admision.nueva)
      return { aplicada: false, detalle: admision.intento.detalle };
    let intento = admision.intento;
    const provider = this.proveedor(intento.proveedor);
    const input = intento.solicitudJson as unknown as EmitirInput;
    try {
      const ultimo =
        provider.codigo === 'manual'
          ? null
          : await provider.ultimoNumero(
              input.puntoVenta,
              input.tipo,
              input.letra,
              input.emisorCuit ?? undefined,
              input,
            );
      if (
        provider.codigo !== 'manual' &&
        (ultimo === null || !Number.isSafeInteger(ultimo) || ultimo < 0)
      )
        throw new ServiceUnavailableException(
          'ARCA no confirmó el último número. No se envió el comprobante.',
        );
      intento = await this.prisma.$transaction(async (tx) => {
        await this.exigirNueva(tx, auth);
        const vigente = await tx.comprobanteEmision.findUniqueOrThrow({
          where: { id: intento.id },
        });
        if (vigente.estado !== 'preparando')
          throw new ConflictException(
            'La preparación ya terminó. Actualizá el comprobante.',
          );
        const c = await tx.comprobante.findFirstOrThrow({
          where: { id, tenantId: auth.tenantId },
          include: { puntoVenta: true },
        });
        const config = await tx.configuracionFiscal.findUnique({
          where: { tenantId: auth.tenantId },
        });
        if (
          !isDeepStrictEqual(
            json({ config, puntoVenta: c.puntoVenta }),
            intento.emisorJson,
          )
        )
          throw new ConflictException(
            'Cambió la configuración fiscal durante la preparación. Revisá los datos antes de emitir.',
          );
        if (
          provider.codigo !== 'manual' &&
          !(await tx.integracionTenant.findFirst({
            where: {
              tenantId: auth.tenantId,
              proveedor: 'AFIP',
              estado: 'CONECTADA',
            },
          }))
        )
          throw new ConflictException(
            'La integración fue desconectada durante la preparación.',
          );
        this.exigirEntorno(intento);
        await this.validarCompromiso(tx, auth.tenantId, c);
        const clave = {
          tenantId: auth.tenantId,
          puntoVentaId: c.puntoVentaId,
          tipo: c.tipo,
          letra: c.letra,
        };
        const contador = await tx.comprobanteContador.upsert({
          where: { tenantId_puntoVentaId_tipo_letra: clave },
          create: { ...clave, ultimo: ultimo === null ? 1 : ultimo + 1 },
          update: { ultimo: ultimo === null ? { increment: 1 } : ultimo + 1 },
        });
        const numero = contador.ultimo;
        const updated = await tx.comprobanteEmision.update({
          where: { id: intento.id },
          data: {
            numero,
            solicitudJson: json({ ...input, numero }),
            estado: 'enviando',
            enviadaEl: new Date(),
            detalle: 'Envío admitido. Esperando el resultado fiscal.',
          },
        });
        await tx.comprobante.update({
          where: { id },
          data: {
            numero,
            emisorSnapshot: intento.emisorJson as Prisma.InputJsonValue,
          },
        });
        return updated;
      });
    } catch (e) {
      await this.cancelarPreparacion(
        intento,
        'La preparación terminó sin enviar. Revisá el plan, la configuración y la conexión.',
      );
      throw e;
    }
    let resultado: EmitirResultado | undefined;
    try {
      resultado = await provider.emitir(
        intento.solicitudJson as unknown as EmitirInput,
      );
      return await this.aplicar(intento, resultado);
    } catch {
      await this.marcarIncierta(
        intento,
        'No se pudo confirmar el resultado del envío. Consultá ARCA antes de volver a facturar.',
        resultado?.raw,
      );
      return {
        aplicada: false,
        detalle:
          'Envío pendiente de verificación. No se volverá a enviar automáticamente.',
      };
    }
  }

  private exigirEntorno(intento: ComprobanteEmision) {
    if (intento.proveedor !== 'afipsdk') return;
    const input = intento.solicitudJson as unknown as EmitirInput;
    if (
      this.afip.environment !== intento.ambiente ||
      this.afip.cuitOperativo(input.emisorCuit ?? '') !== intento.cuitOperativo
    )
      throw new ConflictException(
        'El entorno fiscal cambió. Restablecé la configuración del envío original para consultar su resultado.',
      );
  }

  /** Un GET remoto no autoriza un segundo POST, incluso si todavía no encuentra CAE. */
  async consultar(auth: CurrentAuth, id: string) {
    const intento = await this.prisma.$transaction(async (tx) => {
      await this.capacidades.exigirOperacionTx(tx, auth.tenantId, [
        'identidad',
      ]);
      const comprobante = await tx.comprobante.findFirst({
        where: { id, tenantId: auth.tenantId },
        select: { id: true, tipo: true },
      });
      if (!comprobante)
        throw new NotFoundException('No se encontró el comprobante.');
      this.exigirPermiso(auth, comprobante.tipo);
      return tx.comprobanteEmision.findFirst({
        where: { tenantId: auth.tenantId, comprobanteId: id },
        orderBy: [{ creadaEl: 'desc' }, { id: 'desc' }],
      });
    });
    if (!intento)
      throw new ConflictException(
        'Este comprobante no tiene un envío registrado para consultar.',
      );
    if (!ACTIVAS.includes(intento.estado))
      return { aplicada: false, detalle: intento.detalle };
    if (intento.estado === 'preparando') {
      if (Date.now() - intento.creadaEl.getTime() < 120_000)
        return {
          aplicada: false,
          detalle:
            'La preparación sigue en curso. Volvé a consultar en un momento.',
        };
      const cerrada = await this.cancelarPreparacion(
        intento,
        'Preparación vencida, cerrada sin envío. Se puede revisar el borrador.',
      );
      return {
        aplicada: false,
        detalle: cerrada
          ? 'Se cerró la preparación vencida. No se había enviado el comprobante.'
          : 'El envío avanzó durante la consulta. Volvé a consultar su resultado.',
      };
    }
    await this.prisma.comprobanteEmision.update({
      where: { id: intento.id },
      data: { consultadaEl: new Date(), consultadaPorId: auth.userId },
    });
    this.exigirEntorno(intento);
    const input = intento.solicitudJson as unknown as EmitirInput;
    const provider = this.proveedor(intento.proveedor);
    try {
      const resultado =
        intento.proveedor === 'manual'
          ? await this.manual.emitir(input)
          : await provider.consultarEmitido(
              input.puntoVenta,
              input.tipo,
              input.letra,
              intento.numero!,
              input.emisorCuit ?? undefined,
              input,
            );
      if (resultado?.estado === 'emitido')
        return await this.aplicar(intento, resultado);
    } catch {
      await this.marcarIncierta(
        intento,
        'La consulta no confirmó un comprobante coincidente. Revisá la conexión y consultá nuevamente.',
      );
      return {
        aplicada: false,
        detalle:
          'No se pudo confirmar el resultado. El envío sigue pendiente de verificación.',
      };
    }
    await this.marcarIncierta(
      intento,
      'ARCA todavía no confirmó un comprobante coincidente. No se reenvió la solicitud.',
    );
    return {
      aplicada: false,
      detalle:
        'Todavía no hay un resultado confirmado. No se reenvió la solicitud.',
    };
  }

  private async cancelarPreparacion(
    intento: ComprobanteEmision,
    detalle: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await bloquearCupoUsuarios(tx, intento.tenantId);
      const n = await tx.comprobanteEmision.updateMany({
        where: {
          id: intento.id,
          tenantId: intento.tenantId,
          estado: 'preparando',
        },
        data: {
          estado: 'sin_envio',
          serieActiva: null,
          finalizadaEl: new Date(),
          detalle,
        },
      });
      if (n.count)
        await tx.comprobante.update({
          where: { id: intento.comprobanteId },
          data: { estado: 'borrador' },
        });
      return n.count > 0;
    });
  }

  private async marcarIncierta(
    intento: ComprobanteEmision,
    detalle: string,
    respuesta?: unknown,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await bloquearCupoUsuarios(tx, intento.tenantId);
      const n = await tx.comprobanteEmision.updateMany({
        where: {
          id: intento.id,
          tenantId: intento.tenantId,
          estado: { in: ['enviando', 'verificar'] },
        },
        data: {
          estado: 'verificar',
          detalle,
          ...(respuesta === undefined
            ? {}
            : { respuestaJson: json(respuesta) }),
        },
      });
      if (n.count)
        await tx.comprobante.update({
          where: { id: intento.comprobanteId },
          data: { estado: 'por_verificar' },
        });
    });
  }

  private async aplicar(
    intento: ComprobanteEmision,
    resultado: EmitirResultado,
  ) {
    if (resultado.estado === 'en_cola') {
      await this.marcarIncierta(
        intento,
        'El proveedor recibió la solicitud y todavía no confirmó el CAE.',
        resultado.raw,
      );
      return {
        aplicada: false,
        detalle: 'Pendiente de confirmación del proveedor.',
      };
    }
    if (
      resultado.estado === 'emitido' &&
      (resultado.numero !== intento.numero ||
        (intento.proveedor !== 'manual' &&
          (!/^\d{14}$/.test(resultado.cae) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(resultado.caeVencimiento) ||
            !Number.isFinite(Date.parse(resultado.caeVencimiento)))))
    )
      throw new ConflictException(
        'La respuesta fiscal no coincide con el envío registrado.',
      );
    return this.prisma.$transaction(async (tx) => {
      // Un resultado de un envío ya autorizado debe persistirse aunque el plan
      // haya cambiado mientras ARCA respondía. No inicia una operación nueva.
      await bloquearCupoUsuarios(tx, intento.tenantId);
      const actual = await tx.comprobanteEmision.findUniqueOrThrow({
        where: { id: intento.id },
      });
      if (!['enviando', 'verificar'].includes(actual.estado))
        return { aplicada: false, detalle: actual.detalle };
      const emitido = resultado.estado === 'emitido';
      const detalle = emitido
        ? 'Comprobante registrado correctamente.'
        : 'El proveedor rechazó el comprobante.';
      await tx.comprobanteEmision.update({
        where: { id: intento.id },
        data: {
          estado: resultado.estado,
          serieActiva: null,
          finalizadaEl: new Date(),
          respuestaJson: json(resultado.raw ?? {}),
          detalle,
        },
      });
      await tx.comprobante.update({
        where: { id: intento.comprobanteId },
        data: {
          estado: emitido ? 'emitido' : 'rechazado',
          numero: emitido ? intento.numero : null,
          providerRaw: json(resultado.raw ?? {}),
          ...(emitido
            ? {
                cae: resultado.cae || null,
                caeVencimiento: resultado.caeVencimiento
                  ? new Date(resultado.caeVencimiento)
                  : null,
              }
            : { rechazoJson: json({ errores: resultado.errores }) }),
        },
      });
      if (emitido)
        await this.facturacion.alEmitirComprobanteTx(
          tx,
          intento.tenantId,
          intento.comprobanteId,
        );
      return { aplicada: emitido, detalle };
    });
  }

  private async validarCompromiso(
    tx: Prisma.TransactionClient,
    tenantId: string,
    c: {
      id: string;
      tipo: string;
      comprobanteOrigenId: string | null;
      total: Prisma.Decimal;
      moneda: string;
      letra: string;
      clienteId: string | null;
    },
  ) {
    if (c.tipo === 'factura')
      return this.facturacion.validarTope(tx, tenantId, c.id);
    if (!c.comprobanteOrigenId)
      throw new BadRequestException(
        'La nota necesita un comprobante de origen.',
      );
    const origen = await tx.comprobante.findFirst({
      where: {
        id: c.comprobanteOrigenId,
        tenantId,
        estado: 'emitido',
        anuladoEl: null,
        tipo: 'factura',
      },
    });
    if (
      !origen ||
      origen.moneda !== c.moneda ||
      origen.letra !== c.letra ||
      origen.clienteId !== c.clienteId
    )
      throw new BadRequestException(
        'La nota debe corresponder a la factura, el cliente, la letra y la moneda originales.',
      );
    const origenEmisor = objeto(objeto(origen.emisorSnapshot).config);
    const emisorActual = await tx.configuracionFiscal.findUnique({
      where: { tenantId },
      select: { cuit: true },
    });
    if (origenEmisor.cuit && origenEmisor.cuit !== emisorActual?.cuit)
      throw new ConflictException(
        'El emisor actual no coincide con la factura que querés corregir.',
      );
    if (c.tipo === 'nota_credito') {
      const anteriores = await tx.comprobante.aggregate({
        where: {
          tenantId,
          comprobanteOrigenId: origen.id,
          id: { not: c.id },
          tipo: 'nota_credito',
          OR: [
            { estado: { in: ['emitido', 'en_proceso', 'por_verificar'] } },
            { estado: 'borrador', numero: { not: null } },
          ],
          anuladoEl: null,
        },
        _sum: { total: true },
      });
      if (
        Number(c.total) >
        Number(origen.total) - Number(anteriores._sum.total ?? 0) + 0.001
      )
        throw new ConflictException(
          'La factura ya está acreditada o tiene otra nota pendiente. No se puede acreditar dos veces.',
        );
    }
  }
}
