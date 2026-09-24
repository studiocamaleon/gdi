import { validarSeleccionStockAlEmitir } from './seleccion-stock-emision';
import { exigirContinuidadCompromiso } from '../suscripciones/contratacion-pendiente';
import { comprasPorNecesidad } from '../compras/cobertura-compra';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type NecesidadMaterialOt } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { leerMaterialesOrden } from '../ordenes-trabajo/materiales-orden.consulta';
import type { MaterialesOrden } from '../ordenes-trabajo/materiales-orden';
import { InventarioService } from './inventario.service';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { normalizeMaterialUnit } from './material-units';
import { bloquearVariantesStock, reservasPorSaldo } from './stock-reservas';
import {
  ComandoReservasDto,
  PoliticaReservasDto,
} from './dto/comando-reservas.dto';
import {
  OrigenMovimientoStockMateriaPrimaDto as Origen,
  TipoMovimientoStockMateriaPrimaDto as Tipo,
} from './dto/registrar-movimiento-stock.dto';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const positivo = (v: Prisma.Decimal) => Prisma.Decimal.max(0, v);
const equivalente = (a: string, b: string) =>
  a === b || [a, b].every((u) => ['hoja', 'placa'].includes(u));
const esUuid = (value: string) =>
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const ceroPolitica = {
  modo: 'AL_EMITIR',
  habilitada: false,
  incluirConsumibles: false,
  version: 0,
};

@Injectable()
export class ReservasMaterialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventario: InventarioService,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}

  async politica(tenantId: string) {
    return (
      (await this.prisma.politicaReservasMaterial.findUnique({
        where: { tenantId },
      })) ?? ceroPolitica
    );
  }

  async guardarPolitica(tenantId: string, data: PoliticaReservasDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.capacidades.exigirOperacionTx(
        tx,
        tenantId,
        ['reservas', 'existencias'],
        data.habilitada ? ['reservas', 'existencias'] : [],
      );
      // Serializa también la primera activación (todavía no existe la fila).
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`politica-reservas:${tenantId}`}, 0))::text`;
      await tx.$queryRaw`SELECT "tenantId" FROM "PoliticaReservasMaterial" WHERE "tenantId"=${tenantId}::uuid FOR UPDATE`;
      const actual = await tx.politicaReservasMaterial.findUnique({
        where: { tenantId },
      });
      if ((actual?.version ?? 0) !== data.version)
        throw new ConflictException(
          'La configuración cambió. Actualizá antes de guardar.',
        );
      if (
        (!data.habilitada ||
          (actual && actual.incluirConsumibles !== data.incluirConsumibles)) &&
        (await tx.reservaMaterialOt.count({
          where: { tenantId, cantidad: { gt: 0 } },
        }))
      )
        throw new ConflictException(
          'Primero consumí o liberá las reservas pendientes para desactivar el control o cambiar su alcance.',
        );
      if (
        (!data.habilitada ||
          (actual && actual.incluirConsumibles !== data.incluirConsumibles)) &&
        (await tx.coberturaCompra.count({
          where: {
            tenantId,
            cantidad: { gt: tx.coberturaCompra.fields.recibida },
            linea: {
              orden: { estado: { in: ['BORRADOR', 'EMITIDA', 'PARCIAL'] } },
            },
            necesidad: {
              estado: 'ACTIVA',
              orden: { estado: { in: ['pendiente', 'produccion'] } },
            },
          },
        }))
      )
        throw new ConflictException(
          'Hay compras vinculadas a OTs. Recibilas o cerrá su saldo antes de cambiar el control de reservas.',
        );
      return tx.politicaReservasMaterial.upsert({
        where: { tenantId },
        create: {
          tenantId,
          modo: data.modo ?? 'AL_EMITIR',
          habilitada: data.habilitada,
          incluirConsumibles: data.incluirConsumibles,
        },
        update: {
          modo: data.modo ?? actual?.modo ?? 'AL_EMITIR',
          habilitada: data.habilitada,
          incluirConsumibles: data.incluirConsumibles,
          version: { increment: 1 },
        },
      });
    });
  }

  private async bloquearOrden(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const rows = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM "OrdenTrabajo" WHERE id=${id}::uuid AND "tenantId"=${tenantId}::uuid FOR UPDATE`;
    if (!rows.length)
      throw new NotFoundException('Orden de trabajo no encontrada.');
  }

  private async politicaTx(tx: Prisma.TransactionClient, tenantId: string) {
    await tx.$queryRaw`SELECT "tenantId" FROM "PoliticaReservasMaterial" WHERE "tenantId"=${tenantId}::uuid FOR SHARE`;
    return (
      (await tx.politicaReservasMaterial.findUnique({ where: { tenantId } })) ??
      ceroPolitica
    );
  }

  private async auditar(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ordenId: string,
    accion: string,
    detalle: object,
    auth?: CurrentAuth,
    clave: string = randomUUID(),
    huella = '',
  ) {
    await tx.operacionReservasMaterial.create({
      data: {
        tenantId,
        ordenId,
        accion,
        clave,
        huella,
        actorUsuarioId: auth?.impersonacion?.actorUserId ?? auth?.userId,
        actorNombre:
          auth?.impersonacion?.actorNombre ??
          auth?.mcp?.credencialNombre ??
          auth?.email ??
          'Sistema',
        detalleJson: detalle as Prisma.InputJsonObject,
      },
    });
  }

  /** Recorta sólo lo pendiente: jamás modifica consumos ni el saldo físico. */
  private async limitarReservas(
    tx: Prisma.TransactionClient,
    tenantId: string,
    necesidadId: string,
    limite: Prisma.Decimal,
  ) {
    const rows = await tx.reservaMaterialOt.findMany({
      where: { tenantId, necesidadId, cantidad: { gt: 0 } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    let restante = positivo(limite);
    for (const row of rows) {
      const mantener = Prisma.Decimal.min(row.cantidad, restante);
      if (!mantener.eq(row.cantidad))
        await tx.reservaMaterialOt.update({
          where: { id: row.id },
          data: { cantidad: mantener },
        });
      restante = restante.minus(mantener);
    }
  }

  private async reconciliar(
    tx: Prisma.TransactionClient,
    tenantId: string,
    materiales: MaterialesOrden,
    incluirConsumibles: boolean,
  ) {
    const ordenId = materiales.ordenId;
    const existentes = await tx.necesidadMaterialOt.findMany({
      where: { tenantId, ordenId },
    });
    await bloquearVariantesStock(tx, tenantId, [
      ...existentes.map((n) => n.varianteId),
      ...materiales.necesidades.map((n) => n.varianteId),
    ]);
    const catalogo = await tx.materiaPrimaVariante.findMany({
      where: {
        tenantId,
        id: {
          in: materiales.necesidades.map((n) => n.varianteId).filter(esUuid),
        },
      },
      include: { materiaPrima: true },
    });
    for (const m of materiales.necesidades) {
      const old = existentes.find((n) => n.varianteId === m.varianteId);
      const variante = catalogo.find((v) => v.id === m.varianteId);
      if (!variante) continue; // Se muestra como pendiente en la lectura, nunca se inventa una variante.
      const unidad = normalizeMaterialUnit(
        variante.unidadStock ?? variante.materiaPrima.unidadStock,
      );
      const manualVigente =
        old?.fuente === 'MANUAL' && old.revision === materiales.revision;
      const excluido =
        !incluirConsumibles &&
        m.origenes.every((o) => o.tipo === 'consumible') &&
        !manualVigente;
      const valida =
        m.estado === 'calculada' &&
        m.cantidad !== null &&
        m.unidad &&
        equivalente(m.unidad, unidad);
      const manualVencida = old?.fuente === 'MANUAL' && !manualVigente;
      const cantidad = manualVigente
        ? old.cantidad
        : valida && !excluido && !manualVencida
          ? D(m.cantidad!)
          : (old?.consumida ?? D(0));
      if (old && cantidad.lt(old.consumida))
        throw new ConflictException(
          `La nueva necesidad de ${m.nombre} es menor que lo ya consumido. No se puede modificar ese consumo desde la cotización.`,
        );
      const motivoRevision = manualVigente
        ? null
        : excluido
          ? 'Consumible fuera del control de reservas.'
          : old?.fuente === 'MANUAL'
            ? 'La OT cambió. Volvé a confirmar la cantidad manual.'
            : !valida
              ? 'Confirmá la cantidad necesaria en la unidad de stock actual.'
              : null;
      const estado = motivoRevision
        ? excluido
          ? 'EXCLUIDA'
          : 'REVISAR'
        : 'ACTIVA';
      const data = {
        nombre: m.nombre,
        unidad,
        revision: manualVencida ? old.revision : materiales.revision,
        cantidad,
        fuente: old?.fuente === 'MANUAL' ? 'MANUAL' : 'SNAPSHOT',
        estado,
        motivoRevision,
        origenesJson: m.origenes as unknown as Prisma.InputJsonArray,
      };
      const n = await tx.necesidadMaterialOt.upsert({
        where: {
          tenantId_ordenId_varianteId: {
            tenantId,
            ordenId,
            varianteId: m.varianteId,
          },
        },
        create: { tenantId, ordenId, varianteId: m.varianteId, ...data },
        update: data,
      });
      await this.limitarReservas(
        tx,
        tenantId,
        n.id,
        estado === 'ACTIVA' ? cantidad.minus(n.consumida) : D(0),
      );
    }
    for (const n of existentes.filter(
      (n) => !materiales.necesidades.some((m) => m.varianteId === n.varianteId),
    )) {
      if (n.consumida.gt(0))
        throw new ConflictException(
          `No se puede quitar ${n.nombre}: tiene consumo registrado.`,
        );
      await this.limitarReservas(tx, tenantId, n.id, D(0));
      await tx.necesidadMaterialOt.update({
        where: { id: n.id },
        data: {
          estado: 'RETIRADA',
          cantidad: 0,
          revision: materiales.revision,
        },
      });
    }
    await tx.ordenTrabajo.update({
      where: { id: ordenId },
      data: { materialesRevision: materiales.revision },
    });
  }

  /** Reutilizado por emisión, edición y reserva explícita; requiere los locks
   * de OT y variantes que toma reconciliar. Nunca mueve stock físico. */
  private async reservarDisponible(
    tx: Prisma.TransactionClient,
    tenantId: string,
    necesidades: NecesidadMaterialOt[],
  ) {
    const cambios: object[] = [];
    for (const n of necesidades.filter((n) => n.estado === 'ACTIVA')) {
      const propias = await tx.reservaMaterialOt.aggregate({
        where: { tenantId, necesidadId: n.id },
        _sum: { cantidad: true },
      });
      let faltante = positivo(
        n.cantidad.minus(n.consumida).minus(propias._sum.cantidad ?? 0),
      );
      const stocks = await tx.stockMateriaPrimaVariante.findMany({
        where: {
          tenantId,
          varianteId: n.varianteId,
          cantidadDisponible: { gt: 0 },
          ubicacion: { activo: true, almacen: { activo: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      const reservadas = await reservasPorSaldo(tx, tenantId, [n.varianteId]);
      for (const stock of stocks) {
        if (faltante.lte(0)) break;
        const libre = positivo(
          stock.cantidadDisponible.minus(
            reservadas.get(`${n.varianteId}:${stock.ubicacionId}`) ?? 0,
          ),
        );
        const cantidad = Prisma.Decimal.min(faltante, libre);
        if (cantidad.lte(0)) continue;
        const r = await tx.reservaMaterialOt.upsert({
          where: {
            tenantId_necesidadId_ubicacionId: {
              tenantId,
              necesidadId: n.id,
              ubicacionId: stock.ubicacionId,
            },
          },
          create: {
            tenantId,
            necesidadId: n.id,
            ubicacionId: stock.ubicacionId,
            cantidad,
          },
          update: { cantidad: { increment: cantidad } },
        });
        cambios.push({ reservaId: r.id, reservada: cantidad.toNumber() });
        faltante = faltante.minus(cantidad);
      }
    }
    return cambios;
  }

  /** alEmitir se usa sólo en las dos rutas de emisión, dentro de su transacción.
   * Editar una OT histórica no la incorpora al control accidentalmente. */
  async sincronizarOrdenTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ordenId: string,
    opciones: { alEmitir?: boolean; auth?: CurrentAuth } = {},
  ) {
    // El llamador toma este mismo lock antes de cualquier escritura/lock de OT.
    await this.capacidades.exigirOperacionTx(tx, tenantId, ['identidad']);
    if (opciones.alEmitir) {
      await this.bloquearOrden(tx, tenantId, ordenId);
      await validarSeleccionStockAlEmitir(tx, tenantId, ordenId);
    }
    const control = await tx.ordenTrabajo.findFirst({
      where: { tenantId, id: ordenId },
      select: { materialesControlados: true },
    });
    if (
      !(await this.capacidades.incluida(tenantId, 'reservas', tx)) ||
      !(await this.capacidades.incluida(tenantId, 'existencias', tx))
    ) {
      if (control?.materialesControlados)
        throw new ConflictException(
          'La orden tiene control de materiales previo. Resolvé su continuidad antes de modificarla con un plan sin reservas.',
        );
      // Emitir una OT nueva sigue siendo válido. No crea necesidades,
      // reservas ni movimientos como efecto de un complemento excluido.
      return;
    }
    if (!control?.materialesControlados && !opciones.alEmitir) return;
    await this.bloquearOrden(tx, tenantId, ordenId);
    const { orden, materiales } = await leerMaterialesOrden(
      tx,
      tenantId,
      ordenId,
    );
    if (['borrador', 'cancelada'].includes(orden.estado)) return;
    if (
      orden.materialesControlados &&
      orden.materialesRevision === materiales.revision
    )
      return;
    const politica = await this.politicaTx(tx, tenantId);
    if (!orden.materialesControlados && !politica.habilitada) return;
    await exigirContinuidadCompromiso(tx, tenantId, [
      'reservas',
      'existencias',
    ]);
    await this.reconciliar(
      tx,
      tenantId,
      materiales,
      politica.incluirConsumibles,
    );
    if (!orden.materialesControlados) {
      await tx.ordenTrabajo.update({
        where: { id: ordenId },
        data: { materialesControlados: true },
      });
    }
    const cambios =
      politica.habilitada &&
      politica.modo === 'AL_EMITIR' &&
      ['pendiente', 'produccion'].includes(orden.estado)
        ? await this.reservarDisponible(
            tx,
            tenantId,
            await tx.necesidadMaterialOt.findMany({
              where: { tenantId, ordenId },
            }),
          )
        : [];
    await this.auditar(
      tx,
      tenantId,
      ordenId,
      opciones.alEmitir ? 'emision' : 'sincronizar',
      {
        revision: materiales.revision,
        modo: politica.modo,
        cambios,
      },
      opciones.auth,
    );
  }

  async exigirReaperturaTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ordenId: string,
  ) {
    await this.capacidades.exigirOperacionTx(tx, tenantId, ['identidad']);
    const pendientes = await tx.necesidadMaterialOt.count({
      where: {
        tenantId,
        ordenId,
        estado: { not: 'CANCELADA' },
        cantidad: { gt: tx.necesidadMaterialOt.fields.consumida },
      },
    });
    if (pendientes) {
      await this.capacidades.exigirTodas(
        tenantId,
        ['reservas', 'existencias'],
        tx,
      );
      await exigirContinuidadCompromiso(tx, tenantId, [
        'reservas',
        'existencias',
      ]);
    }
  }

  async cancelarOrdenTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ordenId: string,
    auth?: CurrentAuth,
  ) {
    // El llamador toma este mismo lock antes de cualquier escritura/lock de OT.
    await this.capacidades.exigirOperacionTx(tx, tenantId, ['identidad']);
    await this.bloquearOrden(tx, tenantId, ordenId);
    const needs = await tx.necesidadMaterialOt.findMany({
      where: { tenantId, ordenId },
    });
    if (!needs.length) return;
    await bloquearVariantesStock(
      tx,
      tenantId,
      needs.map((n) => n.varianteId),
    );
    await tx.reservaMaterialOt.updateMany({
      where: {
        tenantId,
        necesidadId: { in: needs.map((n) => n.id) },
        cantidad: { gt: 0 },
      },
      data: { cantidad: 0 },
    });
    await tx.necesidadMaterialOt.updateMany({
      where: { tenantId, ordenId },
      data: { estado: 'CANCELADA' },
    });
    await this.auditar(
      tx,
      tenantId,
      ordenId,
      'cancelar',
      { reservasLiberadas: true },
      auth,
    );
  }

  async ejecutar(
    auth: CurrentAuth,
    ordenId: string,
    comando: ComandoReservasDto,
  ) {
    const tenantId = auth.tenantId;
    const huella = createHash('sha256')
      .update(
        JSON.stringify([
          ordenId,
          comando.accion,
          comando.revision,
          comando.varianteId,
          comando.ubicacionId,
          comando.cantidad,
          comando.unidad,
          comando.motivo,
        ]),
      )
      .digest('hex');
    return this.prisma.$transaction(
      async (tx) => {
        const cierre = ['consumir', 'liberar'].includes(comando.accion);
        await this.capacidades.exigirOperacionTx(
          tx,
          tenantId,
          cierre ? ['identidad'] : ['reservas', 'existencias'],
        );
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`operacion-reserva:${tenantId}:${comando.clave}`}, 0))::text`;
        await this.bloquearOrden(tx, tenantId, ordenId);
        const anterior = await tx.operacionReservasMaterial.findUnique({
          where: { tenantId_clave: { tenantId, clave: comando.clave } },
        });
        if (anterior) {
          if (anterior.huella !== huella)
            throw new ConflictException(
              'La clave de operación ya se utilizó con otros datos.',
            );
          return { ok: true, repetida: true };
        }
        if (!cierre)
          await exigirContinuidadCompromiso(tx, tenantId, [
            'reservas',
            'existencias',
          ]);
        const { orden, materiales } = await leerMaterialesOrden(
          tx,
          tenantId,
          ordenId,
        );
        // Consumir/liberar cierra necesidades existentes; no descubre ni reserva
        // materiales nuevos como efecto secundario, incluso si el plan los incluye.
        const soloContinuidad = cierre;
        if (soloContinuidad && !orden.materialesControlados)
          throw new ConflictException(
            'Sólo se pueden cerrar reservas existentes con el plan actual.',
          );
        if (comando.revision !== materiales.revision)
          throw new ConflictException(
            'La OT cambió. Actualizá los materiales antes de continuar.',
          );
        if (['borrador', 'cancelada'].includes(orden.estado))
          throw new ConflictException(
            'Esta orden no admite operaciones de materiales.',
          );
        if (
          !orden.materialesControlados &&
          !['pendiente', 'produccion'].includes(orden.estado)
        )
          throw new ConflictException(
            'El control se inicia en órdenes pendientes o en producción.',
          );
        const politica = await this.politicaTx(tx, tenantId);
        if (!politica.habilitada && !cierre)
          throw new ConflictException(
            'Activá las reservas por OT en Stock antes de continuar.',
          );
        if (!soloContinuidad) {
          await this.reconciliar(
            tx,
            tenantId,
            materiales,
            politica.incluirConsumibles,
          );
          await tx.ordenTrabajo.update({
            where: { id: ordenId },
            data: { materialesControlados: true },
          });
        }
        const necesidades = await tx.necesidadMaterialOt.findMany({
          where: {
            tenantId,
            ordenId,
            ...(comando.varianteId ? { varianteId: comando.varianteId } : {}),
          },
        });
        if (cierre)
          await bloquearVariantesStock(
            tx,
            tenantId,
            necesidades.map((n) => n.varianteId),
          );
        if (
          comando.varianteId &&
          (!necesidades.length ||
            !materiales.necesidades.some(
              (m) => m.varianteId === comando.varianteId,
            ))
        )
          throw new NotFoundException('Material no encontrado en esta orden.');
        if (
          ['consumir', 'definir'].includes(comando.accion) &&
          !comando.varianteId
        )
          throw new BadRequestException('Elegí un material.');
        const cambios: object[] = [];
        if (comando.accion === 'definir') {
          const n = necesidades[0];
          if (
            !comando.cantidad ||
            !comando.motivo?.trim() ||
            comando.unidad !== n.unidad
          )
            throw new BadRequestException(
              'Indicá una cantidad positiva, su unidad de stock y el motivo.',
            );
          if (D(comando.cantidad).lt(n.consumida))
            throw new ConflictException(
              'La necesidad no puede ser menor que lo consumido.',
            );
          await tx.necesidadMaterialOt.update({
            where: { id: n.id },
            data: {
              cantidad: comando.cantidad,
              revision: materiales.revision,
              fuente: 'MANUAL',
              estado: 'ACTIVA',
              motivoRevision: null,
            },
          });
          await this.limitarReservas(
            tx,
            tenantId,
            n.id,
            D(comando.cantidad).minus(n.consumida),
          );
          cambios.push({
            varianteId: n.varianteId,
            cantidad: comando.cantidad,
            unidad: n.unidad,
            motivo: comando.motivo.trim(),
          });
          if (
            politica.modo === 'AL_EMITIR' &&
            ['pendiente', 'produccion'].includes(orden.estado)
          ) {
            cambios.push(
              ...(await this.reservarDisponible(
                tx,
                tenantId,
                await tx.necesidadMaterialOt.findMany({
                  where: { tenantId, id: n.id },
                }),
              )),
            );
          }
        } else if (comando.accion === 'liberar') {
          for (const n of necesidades) {
            const reservas = await tx.reservaMaterialOt.findMany({
              where: { tenantId, necesidadId: n.id, cantidad: { gt: 0 } },
            });
            cambios.push(
              ...reservas.map((r) => ({
                reservaId: r.id,
                liberada: r.cantidad.toNumber(),
              })),
            );
            await this.limitarReservas(tx, tenantId, n.id, D(0));
          }
        } else if (comando.accion === 'reservar') {
          if (!['pendiente', 'produccion'].includes(orden.estado))
            throw new ConflictException(
              'Sólo se reserva para órdenes pendientes o en producción.',
            );
          cambios.push(
            ...(await this.reservarDisponible(tx, tenantId, necesidades)),
          );
        } else if (comando.accion === 'consumir') {
          const n = necesidades[0];
          if (n.estado !== 'ACTIVA')
            throw new ConflictException(
              'Revisá primero la necesidad de este material.',
            );
          if (!comando.ubicacionId || !comando.cantidad)
            throw new BadRequestException(
              'Indicá la ubicación reservada y la cantidad consumida.',
            );
          const reserva = await tx.reservaMaterialOt.findUnique({
            where: {
              tenantId_necesidadId_ubicacionId: {
                tenantId,
                necesidadId: n.id,
                ubicacionId: comando.ubicacionId,
              },
            },
          });
          if (!reserva || reserva.cantidad.lt(comando.cantidad))
            throw new ConflictException(
              'La cantidad supera la reserva de esa ubicación.',
            );
          const stock = await tx.stockMateriaPrimaVariante.findFirstOrThrow({
            where: {
              tenantId,
              varianteId: n.varianteId,
              ubicacionId: comando.ubicacionId,
            },
          });
          await tx.reservaMaterialOt.update({
            where: { id: reserva.id },
            data: { cantidad: { decrement: comando.cantidad } },
          });
          const movimiento = await this.inventario.registrarMovimientoTx(
            tx,
            auth,
            {
              varianteId: n.varianteId,
              ubicacionId: comando.ubicacionId,
              cantidad: comando.cantidad,
              tipo: Tipo.egreso,
              origen: Origen.consumo_produccion,
              costoUnitario: stock.costoPromedio.toNumber(),
              referenciaTipo: 'orden_trabajo',
              referenciaId: ordenId,
              notas:
                comando.motivo?.trim() || 'Consumo desde materiales de la OT',
            },
          );
          await tx.necesidadMaterialOt.update({
            where: { id: n.id },
            data: { consumida: { increment: comando.cantidad } },
          });
          await tx.consumoMaterialOt.create({
            data: {
              tenantId,
              necesidadId: n.id,
              reservaId: reserva.id,
              movimientoId: movimiento.movimientoId,
              cantidad: comando.cantidad,
              costoUnitario: stock.costoPromedio,
            },
          });
          cambios.push({
            movimientoId: movimiento.movimientoId,
            consumida: comando.cantidad,
            unidad: n.unidad,
            ubicacionId: comando.ubicacionId,
          });
        }
        await this.auditar(
          tx,
          tenantId,
          ordenId,
          comando.accion,
          { revision: materiales.revision, cambios },
          auth,
          comando.clave,
          huella,
        );
        return { ok: true, repetida: false };
      },
      { timeout: 20000 },
    );
  }

  async consultar(tenantId: string, ordenId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const { orden, materiales } = await leerMaterialesOrden(
          tx,
          tenantId,
          ordenId,
        );
        const politica =
          (await tx.politicaReservasMaterial.findUnique({
            where: { tenantId },
          })) ?? ceroPolitica;
        const necesidades = await tx.necesidadMaterialOt.findMany({
          where: { tenantId, ordenId },
          include: {
            reservas: {
              where: { tenantId, cantidad: { gt: 0 } },
              include: { ubicacion: { include: { almacen: true } } },
            },
          },
        });
        const compras = await comprasPorNecesidad(
          tx,
          tenantId,
          necesidades.map((n) => n.id),
        );
        const ids = materiales.necesidades
          .map((n) => n.varianteId)
          .filter(esUuid);
        const variantes = await tx.materiaPrimaVariante.findMany({
          where: { tenantId, id: { in: ids } },
          include: { materiaPrima: true },
        });
        const stocks = await tx.stockMateriaPrimaVariante.findMany({
          where: {
            tenantId,
            varianteId: { in: ids },
            ubicacion: { activo: true, almacen: { activo: true } },
          },
        });
        const reservadas = await reservasPorSaldo(tx, tenantId, ids);
        return {
          ...materiales,
          control: {
            habilitado: politica.habilitada,
            modoReserva: politica.modo,
            iniciado: orden.materialesControlados,
            estadoOrden: orden.estado,
            materiales: materiales.necesidades.map((m) => {
              const n = necesidades.find((n) => n.varianteId === m.varianteId);
              const variante = variantes.find((v) => v.id === m.varianteId);
              const unidad = variante
                ? normalizeMaterialUnit(
                    variante.unidadStock ?? variante.materiaPrima.unidadStock,
                  )
                : null;
              const vigente = n?.revision === materiales.revision;
              const manual = vigente && n?.fuente === 'MANUAL';
              const excluida =
                !politica.incluirConsumibles &&
                m.origenes.every((o) => o.tipo === 'consumible') &&
                !manual;
              const valido =
                !!unidad &&
                m.estado === 'calculada' &&
                m.cantidad !== null &&
                !!m.unidad &&
                equivalente(m.unidad, unidad);
              const manualVencida = !!n && n.fuente === 'MANUAL' && !vigente;
              const cantidad = manual
                ? n.cantidad.toNumber()
                : valido && !excluida && !manualVencida
                  ? m.cantidad
                  : null;
              const consumida = n?.consumida.toNumber() ?? 0;
              const reservada =
                n?.reservas
                  .reduce((s, r) => s.plus(r.cantidad), D(0))
                  .toNumber() ?? 0;
              const saldos = stocks.filter(
                (s) => s.varianteId === m.varianteId,
              );
              const fisico = saldos.reduce(
                (s, r) => s.plus(r.cantidadDisponible),
                D(0),
              );
              const libre = saldos.reduce(
                (s, r) =>
                  s.plus(
                    positivo(
                      r.cantidadDisponible.minus(
                        reservadas.get(`${r.varianteId}:${r.ubicacionId}`) ?? 0,
                      ),
                    ),
                  ),
                D(0),
              );
              const pendiente =
                cantidad === null
                  ? null
                  : Math.max(0, cantidad - consumida - reservada);
              return {
                necesidadId: n?.id ?? null,
                enCompra: n ? (compras.get(n.id)?.cantidad.toNumber() ?? 0) : 0,
                compras: n ? (compras.get(n.id)?.compras ?? []) : [],
                varianteId: m.varianteId,
                unidad,
                cantidad,
                consumida,
                reservada,
                fisico: fisico.toNumber(),
                libre: libre.toNumber(),
                pendiente,
                faltante:
                  pendiente === null
                    ? null
                    : Number(
                        Math.max(0, pendiente - libre.toNumber()).toFixed(8),
                      ),
                fuente: manual ? 'manual' : 'calculo',
                revisar: cantidad === null && !excluida,
                excluida,
                motivo: !variante
                  ? 'La variante ya no está disponible.'
                  : !vigente && n?.fuente === 'MANUAL'
                    ? 'La OT cambió: volvé a confirmar la necesidad.'
                    : cantidad === null && !excluida
                      ? 'Confirmá la cantidad en unidad de stock.'
                      : null,
                reservas:
                  n?.reservas.map((r) => ({
                    ubicacionId: r.ubicacionId,
                    nombre: `${r.ubicacion.almacen.nombre} · ${r.ubicacion.nombre}`,
                    cantidad: r.cantidad.toNumber(),
                  })) ?? [],
              };
            }),
          },
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async listarReservas(
    tenantId: string,
    varianteId: string,
    ubicacionId?: string,
  ) {
    return this.prisma.reservaMaterialOt.findMany({
      where: {
        tenantId,
        ubicacionId,
        cantidad: { gt: 0 },
        necesidad: { tenantId, varianteId },
      },
      select: {
        id: true,
        cantidad: true,
        necesidad: {
          select: {
            unidad: true,
            orden: { select: { id: true, numero: true } },
          },
        },
        ubicacion: {
          select: { nombre: true, almacen: { select: { nombre: true } } },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
  }
}
