import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ArchivoScope,
  Prisma,
  type Cotizacion,
  type OrdenTrabajoItem,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type { CurrentAuth } from '../auth/auth.types';
import { firmaActor } from '../common/firma-actor';
import { PrismaService } from '../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { referenciaBorrador } from '../ordenes-trabajo/numero-orden';
import type { CrearOrdenTrabajoItemDto } from '../ordenes-trabajo/dto/crear-orden-trabajo.dto';

type ItemBorrador = CrearOrdenTrabajoItemDto & {
  personalPrevistoJson?: Prisma.JsonValue;
  recetaSnapshotJson?: Prisma.JsonValue;
  fidelizacionDescuentoNeto?: number;
  archivosIds?: string[];
};
type EmisionBorrador = {
  items: ItemBorrador[];
  fechaEntrega?: string;
  canalVenta?: string;
  cargosDirectos?: number;
  cargos?: Prisma.JsonValue;
  validezDias?: number;
  tratamientoFiscal?: string;
  fidelizacionCanjePuntos?: number;
  importesConCanjeDistribuido?: boolean;
};
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value));
const fecha = (value: Date | null) => value?.toISOString().slice(0, 10);
// Identidad estable por origen: un doble clic o una respuesta perdida no duplica borradores.
function destinoId(tipo: string, id: string) {
  const hex = createHash('sha256')
    .update(`cambiar-borrador:${tipo}:${id}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

@Injectable()
export class CambiarTipoBorradorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}

  async cambiar(
    auth: CurrentAuth,
    tipo: 'orden' | 'presupuesto',
    id: string,
    version: string,
  ) {
    if (
      !auth.permisos?.has('comercial.ordenes.gestionar') ||
      !auth.permisos?.has('comercial.presupuestos.gestionar')
    )
      throw new ForbiddenException(
        'Necesitás permiso para gestionar órdenes y presupuestos.',
      );
    return this.prisma.$transaction(
      async (tx) => {
        await this.capacidades.exigirOperacionTx(tx, auth.tenantId, [
          'cotizacion',
          'ordenes',
          'presupuestos',
        ]);
        return tipo === 'orden'
          ? this.aPresupuesto(tx, auth, id, version)
          : this.aOrden(tx, auth, id, version);
      },
      { timeout: 20000 },
    );
  }

  private exigirRevision(actual: Date, version: string) {
    if (actual.toISOString() !== version)
      throw new ConflictException(
        'El borrador cambió. Recargalo antes de cambiar el tipo.',
      );
  }

  private async aPresupuesto(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    id: string,
    version: string,
  ) {
    await tx.$queryRaw`SELECT id FROM "OrdenTrabajo" WHERE id = ${id}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
    const orden = await tx.ordenTrabajo.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        items: {
          where: { parentItemId: null },
          orderBy: { ordenIndice: 'asc' },
        },
        _count: {
          select: {
            pasos: true,
            cobros: true,
            aplicacionesCobro: true,
            comprobantes: true,
            comprobanteOrdenes: true,
          },
        },
      },
    });
    if (!orden) throw new NotFoundException('No se encontró el borrador.');
    const nuevoId = destinoId('presupuesto', id);
    const existente = await tx.cotizacion.findFirst({
      where: { id: nuevoId, tenantId: auth.tenantId },
    });
    if (
      existente &&
      orden.estado === 'cancelada' &&
      orden.estadoAlCancelar === 'borrador'
    )
      return { id: existente.id, tipo: 'presupuesto' as const };
    if (
      orden.estado !== 'borrador' ||
      orden.fechaEmision ||
      orden.publicToken ||
      Object.values(orden._count).some(Boolean) ||
      Number(orden.cobradoTotal) ||
      Number(orden.facturadoTotal)
    )
      throw new ConflictException(
        'Sólo se puede cambiar el tipo de una OT en borrador, sin emisión, producción ni pagos.',
      );
    this.exigirRevision(orden.updatedAt, version);
    if (!orden.items.length || orden.items.some((i) => !i.cotizacionItemId))
      throw new ConflictException(
        'El borrador necesita todos sus productos cotizados.',
      );
    const fuente = orden.cotizacionId
      ? await tx.cotizacion.findFirst({
          where: { id: orden.cotizacionId, tenantId: auth.tenantId },
        })
      : null;
    const anio = new Date().getFullYear();
    const contador = await tx.cotizacionContador.upsert({
      where: { tenantId_anio: { tenantId: auth.tenantId, anio } },
      create: { tenantId: auth.tenantId, anio, ultimo: 1 },
      update: { ultimo: { increment: 1 } },
    });
    const numero = `PRES-${anio}-${String(contador.ultimo).padStart(4, '0')}`;
    const cfg = await tx.configuracionPresupuestos.findUnique({
      where: { tenantId: auth.tenantId },
    });
    await tx.cotizacion.create({
      data: {
        id: nuevoId,
        tenantId: auth.tenantId,
        numero,
        estado: 'borrador',
        notificarWhatsapp: false,
        clienteId: orden.clienteId,
        proyectoCampanaId: orden.proyectoCampanaId,
        vendedorEmpleadoId: orden.vendedorEmpleadoId,
        canalVenta: orden.canalVenta,
        observaciones: orden.observaciones,
        tipoCambioId: fuente?.tipoCambioId,
        subtotal: orden.subtotal,
        impuestos: orden.impuestos,
        total: orden.total,
        senaSugeridaPct: cfg?.senaSugeridaPctDefault ?? 50,
        cargosDirectosCotizacionJson: orden.cargosDirectosJson ?? Prisma.DbNull,
        ...this.fidelizacion(orden),
      },
    });
    const mapa = await this.copiarSnapshots(
      tx,
      auth.tenantId,
      nuevoId,
      orden.items.map((i) => i.cotizacionItemId!),
    );
    const archivos = await tx.archivo.findMany({
      where: {
        tenantId: auth.tenantId,
        generado: false,
        eliminadoEl: null,
        OR: [
          { ordenId: id },
          { ordenItemId: { in: orden.items.map((i) => i.id) } },
        ],
      },
      select: { id: true, ordenItemId: true },
    });
    const items: ItemBorrador[] = orden.items.map((i) => ({
      ...this.itemComercial(i),
      cotizacionItemId: mapa.get(i.cotizacionItemId!)!,
      archivosIds: archivos
        .filter((a) => a.ordenItemId === i.id)
        .map((a) => a.id),
    }));
    await tx.cotizacion.update({
      where: { id: nuevoId },
      data: {
        emisionJson: json({
          items,
          fechaEntrega: fecha(orden.fechaEntrega),
          canalVenta: orden.canalVenta,
          cargosDirectos: Number(orden.cargosDirectos ?? 0),
          cargos: orden.cargosDirectosJson ?? [],
          validezDias: cfg?.validezDiasDefault ?? 15,
          tratamientoFiscal: orden.tratamientoFiscal,
          fidelizacionCanjePuntos: orden.fidelizacionCanjePuntos,
          importesConCanjeDistribuido: true,
        }),
      },
    });
    await tx.ordenTrabajo.update({
      where: { id },
      data: {
        estado: 'cancelada',
        estadoAlCancelar: 'borrador',
        canceladaEl: new Date(),
        motivoCancelacion: `Borrador cambiado a presupuesto ${numero}.`,
        canceladaPorId: auth.userId,
        canceladaPorNombre: firmaActor(auth, auth.email),
      },
    });
    await tx.archivo.updateMany({
      where: { tenantId: auth.tenantId, id: { in: archivos.map((a) => a.id) } },
      data: {
        scope: ArchivoScope.COTIZACION,
        cotizacionId: nuevoId,
        ordenId: null,
        ordenItemId: null,
      },
    });
    for (const i of orden.items)
      await tx.planEntregaItem.updateMany({
        where: { tenantId: auth.tenantId, ordenItemId: i.id },
        data: {
          ordenItemId: null,
          cotizacionItemId: mapa.get(i.cotizacionItemId!),
        },
      });
    await this.moverReservas(
      tx,
      auth.tenantId,
      { ordenId: id },
      { ordenId: null, cotizacionId: nuevoId },
    );
    await this.eventos(
      tx,
      auth,
      id,
      nuevoId,
      `Borrador cambiado a presupuesto ${numero}.`,
      'presupuesto',
    );
    return { id: nuevoId, tipo: 'presupuesto' as const };
  }

  private async aOrden(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    id: string,
    version: string,
  ) {
    await tx.$queryRaw`SELECT id FROM "Cotizacion" WHERE id = ${id}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
    const presupuesto = await tx.cotizacion.findFirst({
      where: { id, tenantId: auth.tenantId, numero: { not: null } },
      include: { _count: { select: { ordenesTrabajo: true } } },
    });
    if (!presupuesto)
      throw new NotFoundException('No se encontró el borrador.');
    const nuevoId = destinoId('orden', id);
    const existente = await tx.ordenTrabajo.findFirst({
      where: { id: nuevoId, tenantId: auth.tenantId },
    });
    if (existente && presupuesto.estado === 'descartado')
      return { id: existente.id, tipo: 'orden' as const };
    if (
      presupuesto.estado !== 'borrador' ||
      !presupuesto.versionVigente ||
      presupuesto.fechaEmision ||
      presupuesto.fechaEnvio ||
      presupuesto.publicToken ||
      presupuesto._count.ordenesTrabajo
    )
      throw new ConflictException(
        'Sólo se puede cambiar el tipo de un presupuesto en borrador, sin enviar ni convertir.',
      );
    this.exigirRevision(presupuesto.updatedAt, version);
    const emision = presupuesto.emisionJson as unknown as EmisionBorrador;
    if (
      !emision?.items?.length ||
      emision.items.some((i) => !i.cotizacionItemId)
    )
      throw new ConflictException(
        'El borrador necesita todos sus productos cotizados.',
      );
    // Los presupuestos nativos descuentan el canje en el total, mientras que
    // la OT lo distribuye en sus líneas. Los que vienen de OT ya lo traen aplicado.
    const importes = distribuirCanjeBorrador(
      emision,
      Number(presupuesto.fidelizacionCanjeMonto),
    );
    const cotizacionId = randomUUID();
    await tx.cotizacion.create({
      data: {
        id: cotizacionId,
        tenantId: auth.tenantId,
        clienteId: presupuesto.clienteId,
        proyectoCampanaId: presupuesto.proyectoCampanaId,
        vendedorEmpleadoId: presupuesto.vendedorEmpleadoId,
        tipoCambioId: presupuesto.tipoCambioId,
        canalVenta: presupuesto.canalVenta,
        notificarWhatsapp: false,
        subtotal: presupuesto.subtotal,
        impuestos: presupuesto.impuestos,
        total: presupuesto.total,
        cargosDirectosCotizacionJson:
          presupuesto.cargosDirectosCotizacionJson ?? Prisma.DbNull,
      },
    });
    const mapa = await this.copiarSnapshots(
      tx,
      auth.tenantId,
      cotizacionId,
      emision.items.map((i) => i.cotizacionItemId),
      id,
    );
    await tx.ordenTrabajo.create({
      data: {
        id: nuevoId,
        tenantId: auth.tenantId,
        numero: referenciaBorrador(),
        estado: 'borrador',
        cotizacionId,
        clienteId: presupuesto.clienteId,
        proyectoCampanaId: presupuesto.proyectoCampanaId,
        vendedorEmpleadoId: presupuesto.vendedorEmpleadoId,
        observaciones: presupuesto.observaciones,
        canalVenta: presupuesto.canalVenta,
        fechaEntrega: emision.fechaEntrega
          ? new Date(emision.fechaEntrega)
          : null,
        subtotal: importes.subtotal ?? presupuesto.subtotal,
        impuestos: importes.impuestos ?? presupuesto.impuestos,
        total: presupuesto.total,
        cargosDirectos: importes.cargosDirectos ?? emision.cargosDirectos ?? 0,
        cargosDirectosJson: importes.cargos ?? emision.cargos ?? Prisma.DbNull,
        descuentoTotal: emision.items.reduce(
          (s, i) => s + Number(i.descuentoMonto ?? 0),
          0,
        ),
        tratamientoFiscal: emision.tratamientoFiscal ?? 'FISCAL',
        ...this.fidelizacion(presupuesto),
      },
    });
    // Se trasladan adjuntos, no bytes. Los PDF generados siguen en su documento histórico.
    await tx.archivo.updateMany({
      where: {
        tenantId: auth.tenantId,
        cotizacionId: id,
        scope: ArchivoScope.COTIZACION,
        generado: false,
        eliminadoEl: null,
      },
      data: { scope: ArchivoScope.ORDEN, ordenId: nuevoId, cotizacionId },
    });
    for (const [indice, i] of importes.items.entries()) {
      const cotizacionItemId = mapa.get(i.cotizacionItemId)!;
      const snapshot = await tx.cotizacionItem.findUniqueOrThrow({
        where: { id: cotizacionItemId },
      });
      const item = await tx.ordenTrabajoItem.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: nuevoId,
          cotizacionItemId,
          codigo: i.codigo,
          nombre: i.nombre,
          familia: i.familia,
          categoriaComercial: i.categoriaComercial ?? '',
          subcategoriaComercial: i.subcategoriaComercial ?? '',
          cantidad: i.cantidad,
          cantidadUnidad: i.cantidadUnidad,
          fechaEntrega: i.fechaEntrega ? new Date(i.fechaEntrega) : null,
          subtotal: i.subtotal,
          impuestos: i.impuestos,
          total: i.total,
          ordenIndice: indice,
          descuentoTipo: i.descuentoTipo,
          descuentoValor: i.descuentoValor,
          descuentoMonto: i.descuentoMonto,
          descuentoCuponId: i.descuentoCuponId,
          fidelizacionDescuentoNeto: i.fidelizacionDescuentoNeto ?? 0,
          listoEnMostrador: i.listoEnMostrador ?? false,
          specsJson: json(i.specs ?? []),
          adicionalesJson: json(i.adicionales ?? []),
          recetaRevisionId: snapshot.recetaRevisionId,
          recetaVersion: snapshot.recetaVersion,
          recetaHuella: snapshot.recetaHuella,
          recetaSnapshotJson:
            i.recetaSnapshotJson ??
            this.recetaDelSnapshot(snapshot.snapshotJson) ??
            Prisma.DbNull,
          personalPrevistoJson:
            i.personalPrevistoJson &&
            typeof i.personalPrevistoJson === 'object' &&
            !Array.isArray(i.personalPrevistoJson)
              ? { ...i.personalPrevistoJson, cotizacionItemId }
              : Prisma.DbNull,
        },
      });
      if (i.archivosIds?.length)
        await tx.archivo.updateMany({
          where: {
            tenantId: auth.tenantId,
            ordenId: nuevoId,
            id: { in: i.archivosIds },
          },
          data: {
            scope: ArchivoScope.ORDEN_ITEM,
            ordenId: null,
            ordenItemId: item.id,
          },
        });
      await tx.planEntregaItem.updateMany({
        where: {
          tenantId: auth.tenantId,
          cotizacionItemId: i.cotizacionItemId,
          ordenItemId: null,
        },
        data: { cotizacionItemId, ordenItemId: item.id },
      });
    }
    await tx.cotizacion.update({
      where: { id },
      data: { estado: 'descartado' },
    });
    await this.moverReservas(
      tx,
      auth.tenantId,
      { cotizacionId: id, ordenId: null },
      { cotizacionId, ordenId: nuevoId },
    );
    await this.eventos(
      tx,
      auth,
      nuevoId,
      id,
      `Borrador ${presupuesto.numero} cambiado a orden de trabajo.`,
      'orden',
    );
    return { id: nuevoId, tipo: 'orden' as const };
  }

  private recetaDelSnapshot(
    snapshot: Prisma.JsonValue,
  ): Prisma.InputJsonValue | null {
    const receta = (
      snapshot as { receta?: { bom?: Prisma.InputJsonValue } } | null
    )?.receta;
    return receta?.bom ?? null;
  }

  private itemComercial(i: OrdenTrabajoItem): ItemBorrador {
    return {
      cotizacionItemId: i.cotizacionItemId!,
      codigo: i.codigo,
      nombre: i.nombre,
      familia: i.familia,
      categoriaComercial: i.categoriaComercial,
      subcategoriaComercial: i.subcategoriaComercial,
      cantidad: Number(i.cantidad),
      cantidadUnidad: i.cantidadUnidad,
      fechaEntrega: fecha(i.fechaEntrega),
      subtotal: Number(i.subtotal),
      impuestos: Number(i.impuestos),
      total: Number(i.total),
      descuentoTipo: i.descuentoTipo as ItemBorrador['descuentoTipo'],
      descuentoValor:
        i.descuentoValor == null ? null : Number(i.descuentoValor),
      descuentoMonto:
        i.descuentoMonto == null ? null : Number(i.descuentoMonto),
      descuentoCuponId: i.descuentoCuponId,
      specs: (i.specsJson ?? []) as unknown as ItemBorrador['specs'],
      adicionales: (i.adicionalesJson ?? []) as string[],
      listoEnMostrador: i.listoEnMostrador,
      fidelizacionDescuentoNeto: Number(i.fidelizacionDescuentoNeto),
      personalPrevistoJson: i.personalPrevistoJson,
      recetaSnapshotJson: i.recetaSnapshotJson,
    };
  }

  private fidelizacion(
    c: Pick<
      Cotizacion,
      | 'fidelizacionMargenBase'
      | 'fidelizacionPuntosEstimados'
      | 'fidelizacionCanjePuntos'
      | 'fidelizacionCanjeMonto'
      | 'fidelizacionSnapshotJson'
    >,
  ) {
    return {
      fidelizacionMargenBase: c.fidelizacionMargenBase,
      fidelizacionPuntosEstimados: c.fidelizacionPuntosEstimados,
      fidelizacionCanjePuntos: c.fidelizacionCanjePuntos,
      fidelizacionCanjeMonto: c.fidelizacionCanjeMonto,
      fidelizacionSnapshotJson: c.fidelizacionSnapshotJson ?? Prisma.DbNull,
    };
  }

  private async copiarSnapshots(
    tx: Prisma.TransactionClient,
    tenantId: string,
    cotizacionId: string,
    ids: string[],
    origenId?: string,
  ) {
    const originales = await tx.cotizacionItem.findMany({
      where: {
        tenantId,
        id: { in: ids },
        ...(origenId ? { cotizacionId: origenId } : {}),
      },
    });
    if (originales.length !== ids.length || new Set(ids).size !== ids.length)
      throw new ConflictException(
        'Faltan snapshots de los productos del borrador.',
      );
    const mapa = new Map<string, string>();
    for (const original of originales) {
      const {
        id,
        createdAt: _creada,
        updatedAt: _actualizada,
        ...datos
      } = original;
      const nueva = await tx.cotizacionItem.create({
        data: {
          ...datos,
          jobContextJson: datos.jobContextJson ?? Prisma.JsonNull,
          snapshotJson: datos.snapshotJson ?? Prisma.JsonNull,
          id: randomUUID(),
          cotizacionId,
          trazabilidadJson: datos.trazabilidadJson ?? Prisma.DbNull,
          precioConfigSnapshotJson:
            datos.precioConfigSnapshotJson ?? Prisma.DbNull,
          impuestosSnapshotJson: datos.impuestosSnapshotJson ?? Prisma.DbNull,
          comisionesSnapshotJson: datos.comisionesSnapshotJson ?? Prisma.DbNull,
          precioEspecialClienteSnapshotJson:
            datos.precioEspecialClienteSnapshotJson ?? Prisma.DbNull,
        },
      });
      mapa.set(id, nueva.id);
    }
    return mapa;
  }

  private async moverReservas(
    tx: Prisma.TransactionClient,
    tenantId: string,
    origen: { ordenId?: string | null; cotizacionId?: string },
    destino: { ordenId: string | null; cotizacionId: string },
  ) {
    await tx.fidelizacionReserva.updateMany({
      where: { tenantId, ...origen, estado: 'RESERVADA' },
      data: destino,
    });
    await tx.cuponRedencion.updateMany({
      where: { tenantId, ...origen, estado: 'RESERVADA' },
      data: destino,
    });
  }

  private async eventos(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    ordenId: string,
    cotizacionId: string,
    descripcion: string,
    destino: string,
  ) {
    const firma = {
      usuarioId: auth.userId,
      usuarioNombre: firmaActor(auth, auth.email),
    };
    await tx.ordenTrabajoEvento.create({
      data: {
        tenantId: auth.tenantId,
        ordenId,
        tipo: 'cambio_tipo_borrador',
        descripcion,
        ...firma,
        datosJson: { destino, cotizacionId },
      },
    });
    await tx.cotizacionEvento.create({
      data: {
        tenantId: auth.tenantId,
        cotizacionId,
        tipo: 'cambio_tipo_borrador',
        descripcion,
        ...firma,
      },
    });
  }
}

function distribuirCanjeBorrador(emision: EmisionBorrador, canje: number) {
  if (!canje || emision.importesConCanjeDistribuido)
    return { items: emision.items };
  const sinIva = emision.tratamientoFiscal === 'SIN_COMPROBANTE';
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const total =
    emision.items.reduce((s, i) => s + (sinIva ? i.subtotal : i.total), 0) +
    (emision.cargosDirectos ?? 0);
  if (total <= 0) return { items: emision.items };
  let restante = canje;
  const items = emision.items.map((i, indice) => {
    const base = sinIva ? i.subtotal : i.total;
    const rebaja = Math.min(
      base,
      indice === emision.items.length - 1
        ? restante
        : r2((canje * base) / total),
    );
    restante = r2(restante - rebaja);
    const factor = base > 0 ? (base - rebaja) / base : 1;
    const subtotal = r2(i.subtotal * factor),
      bruto = r2(i.total * factor);
    return {
      ...i,
      subtotal,
      impuestos: r2(bruto - subtotal),
      total: bruto,
      fidelizacionDescuentoNeto: r2(i.subtotal - subtotal),
    };
  });
  const cargosDirectos = r2((emision.cargosDirectos ?? 0) - restante);
  const factorCargo =
    (emision.cargosDirectos ?? 0) > 0
      ? cargosDirectos / emision.cargosDirectos!
      : 1;
  const cargos = Array.isArray(emision.cargos)
    ? emision.cargos.map((c) => {
        if (!c || typeof c !== 'object' || Array.isArray(c)) return c;
        return {
          ...c,
          montoNeto: r2(Number(c.montoNeto ?? 0) * factorCargo),
          impuestoMonto: r2(Number(c.impuestoMonto ?? 0) * factorCargo),
          total: r2(Number(c.total ?? 0) * factorCargo),
        };
      })
    : emision.cargos;
  return {
    items,
    subtotal: r2(items.reduce((s, i) => s + i.subtotal, 0)),
    impuestos: sinIva ? 0 : r2(items.reduce((s, i) => s + i.impuestos, 0)),
    cargosDirectos,
    cargos,
  };
}
