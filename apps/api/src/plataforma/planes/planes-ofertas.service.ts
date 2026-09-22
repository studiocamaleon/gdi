import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { PaddleService } from '../../cobro/paddle.service';
import { autorizarEdicionPlanes } from './autorizar-edicion-planes';
import type { ContenidoPlan } from './catalogo-planes';
import { problemasPublicacionPlan } from './validacion-planes';
import {
  incluirOferta,
  presentarOferta,
  type OfertaCompleta,
} from './ofertas-planes';
import type {
  ActivarOfertaDto,
  RetirarOfertaDto,
  RetirarPlanAnteriorDto,
} from './planes-ofertas.controller';

@Injectable()
export class PlanesOfertasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paddle: PaddleService,
  ) {}

  async estado(borradorId: string) {
    const borrador = await this.prisma.planBorrador.findUnique({
      where: { id: borradorId },
    });
    if (!borrador) throw new NotFoundException('No se encontró el borrador.');
    const plan = await this.prisma.plan.findUnique({
      where: { codigo: borrador.codigo },
      include: { ofertaActual: { include: incluirOferta } },
    });
    return {
      entorno: this.paddle.entorno,
      paddleHabilitado: this.paddle.habilitado,
      revision: plan?.revisionOferta ?? 0,
      actual: plan?.ofertaActual ? presentarOferta(plan.ofertaActual) : null,
    };
  }

  async activar(auth: CurrentAuth, dto: ActivarOfertaDto) {
    // Autorización antes de consultar la pasarela y otra vez al escribir.
    await this.prisma.$transaction((tx) => autorizarEdicionPlanes(tx, auth));
    if (dto.entorno !== this.paddle.entorno || !this.paddle.habilitado)
      throw new BadRequestException(
        'Paddle no está disponible en el entorno seleccionado.',
      );
    if (
      !Number.isInteger(dto.revision) ||
      dto.revision < 0 ||
      typeof dto.motivo !== 'string' ||
      dto.motivo.trim().length < 5 ||
      dto.motivo.trim().length > 500
    )
      throw new BadRequestException('Indicá una revisión y un motivo válidos.');
    if (
      typeof dto.registroPublico !== 'boolean' ||
      typeof dto.recomendado !== 'boolean' ||
      (dto.trialDias != null &&
        (!Number.isInteger(dto.trialDias) ||
          dto.trialDias < 1 ||
          dto.trialDias > 90)) ||
      (dto.registroPublico && !dto.trialDias)
    )
      throw new BadRequestException(
        'El alta pública requiere un plazo de prueba de 1 a 90 días.',
      );
    const version = await this.prisma.planVersion.findUnique({
      where: { id: dto.versionId },
      include: { borrador: true },
    });
    if (!version)
      throw new NotFoundException('No se encontró la versión publicada.');
    const p = version.contenido as unknown as ContenidoPlan;
    const errores = problemasPublicacionPlan(p, version.catalogoVersion);
    if (![1, 2].includes(version.catalogoVersion) || errores.length)
      throw new BadRequestException(
        errores.length ? errores : 'Catálogo no soportado.',
      );
    if (
      !Array.isArray(dto.precios) ||
      dto.precios.length < 1 ||
      dto.precios.length > 5 ||
      new Set(dto.precios.map((i) => i.priceId)).size !== dto.precios.length ||
      new Set(dto.precios.map((i) => `${i.tipo}:${i.ciclo}`)).size !==
        dto.precios.length
    )
      throw new BadRequestException(
        'Los precios deben ser únicos por ítem y ciclo.',
      );
    if (
      p.comercial &&
      (dto.registroPublico !== (p.comercial.acceso === 'publico') ||
        dto.trialDias !== p.comercial.trialDias)
    )
      throw new BadRequestException(
        'La visibilidad y la prueba deben coincidir con la versión publicada.',
      );
    const anual = dto.precios.some((i) => i.ciclo === 'anual');
    const esperados = [
      'base:mensual',
      ...(p.comercial?.implementacion ? ['implementacion:unico'] : []),
      ...(anual ? ['base:anual'] : []),
      ...(p.adicionalesPermitidos
        ? ['usuario:mensual', ...(anual ? ['usuario:anual'] : [])]
        : []),
    ];
    if (
      dto.precios.length !== esperados.length ||
      dto.precios.some(
        (i) =>
          !esperados.includes(`${i.tipo}:${i.ciclo}`) ||
          !/^pri_[a-z0-9]{26}$/.test(i.priceId),
      )
    )
      throw new BadRequestException(
        'Vinculá el plan y sus adicionales para cada ciclo ofrecido.',
      );

    const comprobados = await Promise.all(
      dto.precios.map(async (i) => {
        const importe =
          i.tipo === 'implementacion'
            ? p.comercial?.implementacion
            : i.tipo === 'base'
              ? p.precios?.[i.ciclo as 'mensual' | 'anual']
              : p.precios?.[
                  i.ciclo === 'mensual' ? 'usuarioMensual' : 'usuarioAnual'
                ];
        if (!importe)
          throw new BadRequestException(
            `Definí el precio ${i.tipo} ${i.ciclo} y publicá una nueva versión.`,
          );
        const remoto = await this.paddle
          .leerPrecioOferta(i.priceId)
          .catch(() => {
            throw new BadRequestException(
              'No se pudo verificar el precio en Paddle. Revisá el identificador y la conexión antes de activar la oferta.',
            );
          });
        if (
          !remoto ||
          remoto.status !== 'active' ||
          remoto.product?.status !== 'active' ||
          remoto.type !== 'standard' ||
          remoto.taxMode !== 'external' ||
          remoto.unitPrice.currencyCode !== 'USD' ||
          Number(remoto.unitPrice.amount) !== Math.round(importe * 100) ||
          (i.ciclo === 'unico'
            ? remoto.billingCycle !== null
            : remoto.billingCycle?.frequency !== 1 ||
              remoto.billingCycle.interval !==
                (i.ciclo === 'mensual' ? 'month' : 'year')) ||
          remoto.trialPeriod !== null ||
          remoto.unitPriceOverrides.length > 0 ||
          remoto.quantity.minimum !== 1 ||
          (i.tipo === 'implementacion' && remoto.quantity.maximum !== 1) ||
          remoto.quantity.maximum < 1
        )
          throw new BadRequestException(
            `El precio ${i.tipo} ${i.ciclo} no coincide con la versión: revisá importe en USD, ciclo, estado activo, impuestos separados (external), cantidad mínima 1 y ausencia de prueba o precios por país en Paddle.`,
          );
        return {
          ...i,
          entorno: dto.entorno,
          productId: remoto.productId,
          importe,
          moneda: 'USD',
          cantidadMaxima: Math.min(10000, remoto.quantity.maximum),
        };
      }),
    );

    await this.prisma.$transaction(async (tx) => {
      await autorizarEdicionPlanes(tx, auth);
      const anterior = await tx.plan.findUnique({
        where: { codigo: version.codigo },
      });
      const existente = await tx.planOferta.findUnique({
        where: {
          versionId_entorno: { versionId: version.id, entorno: dto.entorno },
        },
        include: incluirOferta,
      });
      if (existente && !mismaOferta(existente, dto))
        throw new ConflictException(
          'Esta versión ya tiene condiciones comerciales inmutables. Publicá otra versión para cambiarlas.',
        );
      if (existente && anterior?.ofertaActualId === existente.id) return;
      if ((anterior?.revisionOferta ?? 0) !== dto.revision)
        throw new ConflictException(
          'La oferta cambió. Recargá antes de activarla.',
        );
      if (anterior && !anterior.comercialVersionado)
        throw new ConflictException(
          'Este código pertenece al catálogo anterior. Usá un código de propuesta independiente para preservar sus contratos.',
        );
      if (!existente) {
        const ids = dto.precios.map((i) => i.priceId);
        const usados = await tx.planOfertaPrecio.count({
          where: { entorno: dto.entorno, priceId: { in: ids } },
        });
        const legacy = await tx.plan.count({
          where: {
            OR: [
              { paddlePriceId: { in: ids } },
              { paddlePriceIdAnual: { in: ids } },
              { preciosLegacy: { some: { priceId: { in: ids } } } },
            ],
          },
        });
        if (usados || legacy)
          throw new ConflictException(
            'Un precio ya identifica otro contrato. Creá precios nuevos para esta versión.',
          );
      }
      const plan =
        anterior ??
        (await tx.plan.create({
          data: {
            codigo: version.codigo,
            nombre: p.nombre,
            descripcion: p.descripcion,
            precioMensual: p.precios!.mensual!,
            moneda: 'USD',
            // Fallback cerrado: toda nueva suscripción debe llevar su versión.
            featuresJson: {
              funciones: p.funciones,
              usuariosMax: p.usuariosIncluidos,
              storageGb: p.almacenamientoGb,
            },
            comercialVersionado: true,
            publico: true,
            orden: version.borrador.orden,
          },
        }));
      const oferta =
        existente ??
        (await tx.planOferta.create({
          data: {
            planId: plan.id,
            versionId: version.id,
            entorno: dto.entorno,
            registroPublico: dto.registroPublico,
            recomendado: dto.recomendado,
            trialDias: dto.trialDias ?? null,
            creadaPorId: auth.userId,
            motivo: dto.motivo.trim(),
            precios: { create: comprobados },
          },
        }));
      await tx.plan.update({
        where: { id: plan.id },
        data: {
          ofertaActualId: oferta.id,
          revisionOferta: { increment: 1 },
          publico: p.comercial?.acceso !== 'invitacion',
          nombre: p.nombre,
          descripcion: p.descripcion,
          precioMensual: p.precios!.mensual!,
          precioAnual: p.precios?.anual,
          trialDias: dto.trialDias,
          registroPublico: dto.registroPublico,
          recomendado: dto.recomendado,
        },
      });
      await tx.plataformaEvento.create({
        data: {
          staffUserId: auth.userId,
          tipo: 'plan_oferta_activada',
          descripcion: `Activó la oferta de ${p.nombre} · versión ${version.numero} (${dto.entorno})`,
          datosJson: {
            ofertaId: oferta.id,
            versionId: version.id,
            anterior: anterior?.ofertaActualId ?? null,
            motivo: dto.motivo.trim(),
          },
        },
      });
    });
    return this.estado(version.borradorId);
  }

  async retirar(auth: CurrentAuth, dto: RetirarOfertaDto) {
    return this.prisma.$transaction(async (tx) => {
      await autorizarEdicionPlanes(tx, auth);
      if (
        typeof dto.motivo !== 'string' ||
        dto.motivo.trim().length < 5 ||
        dto.motivo.trim().length > 500
      )
        throw new BadRequestException('Indicá el motivo del retiro.');
      const oferta = await tx.planOferta.findUnique({
        where: { id: dto.ofertaId },
      });
      if (!oferta) throw new NotFoundException('La oferta no existe.');
      const cambio = await tx.plan.updateMany({
        where: {
          id: oferta.planId,
          ofertaActualId: oferta.id,
          revisionOferta: dto.revision,
        },
        data: { ofertaActualId: null, revisionOferta: { increment: 1 } },
      });
      if (cambio.count !== 1)
        throw new ConflictException('La oferta cambió. Recargá la vista.');
      await tx.plataformaEvento.create({
        data: {
          staffUserId: auth.userId,
          tipo: 'plan_oferta_retirada',
          descripcion: 'Retiró una oferta de nuevas contrataciones',
          datosJson: { ofertaId: oferta.id, motivo: dto.motivo.trim() },
        },
      });
      return { ok: true };
    });
  }
  async retirarAnterior(auth: CurrentAuth, dto: RetirarPlanAnteriorDto) {
    return this.prisma.$transaction(async (tx) => {
      await autorizarEdicionPlanes(tx, auth);
      if (
        !Number.isInteger(dto.revision) ||
        dto.revision < 0 ||
        typeof dto.motivo !== 'string' ||
        dto.motivo.trim().length < 5 ||
        dto.motivo.trim().length > 500
      )
        throw new BadRequestException(
          'Indicá una revisión y un motivo válidos.',
        );
      const plan = await tx.plan.findUnique({ where: { id: dto.planId } });
      if (!plan) throw new NotFoundException('No se encontró el plan.');
      if (plan.comercialVersionado)
        throw new ConflictException(
          'Gestioná este plan desde su oferta comercial.',
        );
      if (plan.revisionOferta !== dto.revision || !plan.publico)
        throw new ConflictException('El catálogo cambió. Recargá la vista.');
      const reemplazo = await tx.plan.findFirst({
        where: {
          activo: true,
          publico: true,
          comercialVersionado: true,
          ofertaActual: { entorno: this.paddle.entorno, registroPublico: true },
        },
        select: { id: true },
      });
      if (!reemplazo)
        throw new ConflictException(
          'Activá primero una nueva oferta con registro disponible en este entorno.',
        );
      await tx.plan.update({
        where: { id: plan.id },
        data: {
          publico: false,
          registroPublico: false,
          recomendado: false,
          revisionOferta: { increment: 1 },
        },
      });
      await tx.plataformaEvento.create({
        data: {
          staffUserId: auth.userId,
          tipo: 'plan_anterior_retirado',
          descripcion: `Retiró ${plan.nombre} de nuevas altas y contrataciones`,
          datosJson: {
            planId: plan.id,
            revision: dto.revision,
            motivo: dto.motivo.trim(),
            anterior: {
              publico: plan.publico,
              registroPublico: plan.registroPublico,
              recomendado: plan.recomendado,
            },
          },
        },
      });
      return { ok: true };
    });
  }
}

function mismaOferta(oferta: OfertaCompleta, dto: ActivarOfertaDto) {
  return (
    oferta.trialDias === (dto.trialDias ?? null) &&
    oferta.registroPublico === dto.registroPublico &&
    oferta.recomendado === dto.recomendado &&
    oferta.precios.length === dto.precios.length &&
    dto.precios.every((p) =>
      oferta.precios.some(
        (v) =>
          v.priceId === p.priceId && v.tipo === p.tipo && v.ciclo === p.ciclo,
      ),
    )
  );
}
