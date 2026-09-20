import { nombreMaterialCompra } from './nombre-material-compra';
import { leerMaterialesOrden } from '../ordenes-trabajo/materiales-orden.consulta';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UnidadMateriaPrima } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import { InventarioService } from '../inventario/inventario.service';
import { ReservasMaterialService } from '../inventario/reservas-material.service';
import {
  bloquearVariantesStock,
  reservasPorSaldo,
} from '../inventario/stock-reservas';
import {
  materialPriceContext,
  normalizeMaterialUnit,
} from '../inventario/material-units';
import {
  OrigenMovimientoStockMateriaPrimaDto as Origen,
  TipoMovimientoStockMateriaPrimaDto as Tipo,
} from '../inventario/dto/registrar-movimiento-stock.dto';
import { UnidadMateriaPrimaDto } from '../inventario/dto/upsert-materia-prima.dto';
import {
  CrearCompraDto,
  OfertaCompraDto,
  AccionCompraDto,
  RecibirCompraDto,
} from './dto/compras.dto';
import { estimarReposicion, fechaCivil } from './plazos-compra';
import {
  comprasPorNecesidad,
  ESTADOS_COMPRA_ABIERTA,
} from './cobertura-compra';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const mismasUnidades = (a: string, b: string) =>
  normalizeMaterialUnit(a) === normalizeMaterialUnit(b) ||
  [a, b].every((u) => ['HOJA', 'PLACA'].includes(u.toUpperCase()));
const pos = (v: Prisma.Decimal) => Prisma.Decimal.max(0, v);
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const includeCompra = {
  ubicacion: { include: { almacen: true } },
  lineas: {
    orderBy: { posicion: 'asc' },
    include: {
      coberturas: {
        include: {
          necesidad: {
            include: {
              orden: { select: { id: true, numero: true, estado: true } },
            },
          },
        },
      },
    },
  },
  recepciones: {
    orderBy: { createdAt: 'desc' },
    include: { detalles: true, ubicacion: { select: { nombre: true } } },
  },
} satisfies Prisma.OrdenCompraInclude;
@Injectable()
export class ComprasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventario: InventarioService,
    private readonly reservas: ReservasMaterialService,
  ) {}
  private precios(auth: CurrentAuth) {
    if (
      auth.permisos
        ? !auth.permisos.has('finanzas.ver_margenes')
        : auth.role !== 'ADMINISTRADOR'
    )
      throw new ForbiddenException(
        'Se necesita permiso para ver costos y precios de compra.',
      );
  }
  private actor(auth: CurrentAuth) {
    return (
      auth.impersonacion?.actorNombre ??
      auth.mcp?.credencialNombre ??
      auth.email
    );
  }
  private async bloqueo(tx: Prisma.TransactionClient, tenantId: string) {
    // Compras → OTs ordenadas → política → variantes ordenadas. Ningún escritor de OT toma este lock.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`compras:${tenantId}`},0))::text`;
  }
  private async operacion(
    auth: CurrentAuth,
    clave: string,
    accion: string,
    payload: unknown,
    run: (
      tx: Prisma.TransactionClient,
    ) => Promise<{ ordenId: string; [k: string]: unknown }>,
  ) {
    this.precios(auth);
    const huella = createHash('sha256')
      .update(JSON.stringify({ accion, payload }))
      .digest('hex');
    return this.prisma.$transaction(
      async (tx) => {
        await this.bloqueo(tx, auth.tenantId);
        const previa = await tx.operacionCompra.findUnique({
          where: { tenantId_clave: { tenantId: auth.tenantId, clave } },
        });
        if (previa) {
          if (previa.huella !== huella)
            throw new ConflictException(
              'Esta operación ya se usó con otros datos.',
            );
          return previa.resultado;
        }
        const resultado = await run(tx);
        await tx.operacionCompra.create({
          data: {
            tenantId: auth.tenantId,
            clave,
            huella,
            accion,
            ordenId: resultado.ordenId,
            actor: this.actor(auth),
            resultado: json(resultado),
          },
        });
        return resultado;
      },
      { timeout: 30000 },
    );
  }
  private async orden(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const orden = await tx.ordenCompra.findFirst({
      where: { tenantId, id },
      include: includeCompra,
    });
    if (!orden) throw new NotFoundException('Compra no encontrada.');
    return orden;
  }
  private async ubicacion(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const item = await tx.almacenMateriaPrimaUbicacion.findFirst({
      where: { id, tenantId, activo: true, almacen: { activo: true } },
    });
    if (!item)
      throw new BadRequestException(
        'Elegí una ubicación de depósito activa de esta empresa.',
      );
    return item;
  }
  private async bloquearOrdenes(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ids: string[],
    variantes: string[] = [],
  ) {
    for (const id of [...new Set(ids)].sort()) {
      await tx.$queryRaw`SELECT id FROM "OrdenTrabajo" WHERE "tenantId"=${tenantId}::uuid AND id=${id}::uuid FOR UPDATE`;
    }
    await tx.$queryRaw`SELECT "tenantId" FROM "PoliticaReservasMaterial" WHERE "tenantId"=${tenantId}::uuid FOR SHARE`;
    const necesidades = await tx.necesidadMaterialOt.findMany({
      where: { tenantId, ordenId: { in: ids } },
      select: { varianteId: true },
    });
    const actuales: string[] = [];
    for (const id of [...new Set(ids)].sort())
      actuales.push(
        ...(
          await leerMaterialesOrden(tx, tenantId, id)
        ).materiales.necesidades.map((n) => n.varianteId),
      );
    await bloquearVariantesStock(tx, tenantId, [
      ...actuales,
      ...variantes,
      ...necesidades.map((n) => n.varianteId),
    ]);
    for (const id of [...new Set(ids)].sort())
      await this.reservas.sincronizarOrdenTx(tx, tenantId, id);
  }
  async catalogo(auth: CurrentAuth) {
    this.precios(auth);
    const tenantId = auth.tenantId;
    const [proveedores, variantes, ubicaciones, empresa] = await Promise.all([
      this.prisma.proveedor.findMany({
        where: { tenantId, activo: true },
        select: {
          id: true,
          nombre: true,
          reposicionDias: true,
          reposicionTipo: true,
        },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.materiaPrimaVariante.findMany({
        where: { tenantId, activo: true, materiaPrima: { activo: true } },
        select: {
          id: true,
          nombreVariante: true,
          atributosVarianteJson: true,
          unidadCompra: true,
          unidadStock: true,
          unidadUso: true,
          unidadPrecio: true,
          precioReferencia: true,
          moneda: true,
          equivalenciaCompra: true,
          equivalenciasJson: true,
          proveedorReferenciaId: true,
          materiaPrima: {
            select: {
              nombre: true,
              unidadCompra: true,
              unidadStock: true,
              unidadUso: true,
              templateId: true,
            },
          },
          ofertasCompra: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.almacenMateriaPrimaUbicacion.findMany({
        where: { tenantId, activo: true, almacen: { activo: true } },
        select: {
          id: true,
          nombre: true,
          almacen: { select: { nombre: true } },
        },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.datosEmpresa.findUnique({
        where: { tenantId },
        select: { monedaCodigo: true },
      }),
    ]);
    return {
      proveedores,
      variantes: variantes.map((v) => ({
        ...v,
        nombreDisplay: nombreMaterialCompra(v),
        contextoUnidades: materialPriceContext(v),
      })),
      ubicaciones,
      monedaStock: empresa?.monedaCodigo ?? 'ARS',
      unidades: Object.values(UnidadMateriaPrima),
    };
  }
  async guardarOferta(auth: CurrentAuth, data: OfertaCompraDto) {
    this.precios(auth);
    return this.prisma.$transaction(async (tx) => {
      const tenantId = auth.tenantId;
      await this.bloqueo(tx, tenantId);
      await bloquearVariantesStock(tx, tenantId, [data.varianteId]);
      const proveedor = await tx.proveedor.findFirst({
        where: { id: data.proveedorId, tenantId, activo: true },
      });
      const variante = await tx.materiaPrimaVariante.findFirst({
        where: {
          id: data.varianteId,
          tenantId,
          activo: true,
          materiaPrima: { activo: true },
        },
        include: { materiaPrima: true },
      });
      if (!proveedor || !variante)
        throw new BadRequestException('Proveedor o material no disponible.');
      const where = {
        tenantId_proveedorId_varianteId: {
          tenantId,
          proveedorId: data.proveedorId,
          varianteId: data.varianteId,
        },
      };
      const actual = await tx.ofertaCompra.findUnique({ where });
      if ((actual?.version ?? 0) !== data.version)
        throw new ConflictException(
          'La oferta cambió. Actualizá antes de guardar.',
        );
      const unidadStock =
        variante.unidadStock ?? variante.materiaPrima.unidadStock;
      this.validarFactor(data.unidadCompra, unidadStock, data.factorStock);
      if (!/^[A-Z]{3}$/.test(data.moneda))
        throw new BadRequestException('Moneda no válida.');
      const { version, ...resto } = data;
      const values = {
        ...resto,
        tenantId,
        unidadStock,
        codigoProveedor: data.codigoProveedor?.trim() || null,
        reposicionDias: data.reposicionDias ?? null,
        reposicionTipo:
          data.reposicionDias == null
            ? null
            : (data.reposicionTipo ?? proveedor.reposicionTipo),
        precio: data.precio ?? null,
        multiplo: data.multiplo ?? null,
        vigenteHasta: data.vigenteHasta ? fechaCivil(data.vigenteHasta) : null,
      };
      return tx.ofertaCompra.upsert({
        where,
        create: values,
        update: { ...values, version: { increment: 1 } },
      });
    });
  }
  private validarFactor(compra: string, stock: string, factor: number) {
    if (!Number.isFinite(factor) || factor <= 0)
      throw new BadRequestException(
        'Confirmá el contenido de la unidad de compra en stock.',
      );
    const a = normalizeMaterialUnit(compra),
      b = normalizeMaterialUnit(stock);
    if (
      (a === b || [a, b].every((u) => ['hoja', 'placa'].includes(u))) &&
      factor !== 1
    )
      throw new BadRequestException(
        'Para la misma unidad el contenido debe ser 1.',
      );
  }
  async necesidades(auth: CurrentAuth, page = 1) {
    return this.prisma.$transaction(
      async (tx) => {
        const tenantId = auth.tenantId;
        const where = {
          tenantId,
          estado: { in: ['ACTIVA', 'REVISAR'] },
          orden: { estado: { in: ['pendiente', 'produccion'] } },
        };
        const [rows, total] = await Promise.all([
          tx.necesidadMaterialOt.findMany({
            where,
            include: {
              orden: { select: { id: true, numero: true } },
              reservas: true,
              variante: {
                include: {
                  materiaPrima: true,
                  proveedorReferencia: {
                    select: {
                      id: true,
                      nombre: true,
                      reposicionDias: true,
                      reposicionTipo: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            skip: (page - 1) * 50,
            take: 50,
          }),
          tx.necesidadMaterialOt.count({ where }),
        ]);
        const incoming = await comprasPorNecesidad(
          tx,
          tenantId,
          rows.map((n) => n.id),
          true,
        );
        const variantes = [...new Set(rows.map((n) => n.varianteId))];
        const stock = await tx.stockMateriaPrimaVariante.findMany({
          where: {
            tenantId,
            varianteId: { in: variantes },
            ubicacion: { activo: true, almacen: { activo: true } },
          },
        });
        const holds = await reservasPorSaldo(tx, tenantId, variantes);
        return {
          page,
          total,
          pageSize: 50,
          data: rows.map((n) => {
            const reservada = n.reservas.reduce(
              (a, r) => a.plus(r.cantidad),
              D(0),
            );
            const pendiente = pos(
              n.cantidad.minus(n.consumida).minus(reservada),
            );
            const compra = incoming.get(n.id);
            const libre = stock
              .filter((s) => s.varianteId === n.varianteId)
              .reduce(
                (a, s) =>
                  a.plus(
                    pos(
                      s.cantidadDisponible.minus(
                        holds.get(`${s.varianteId}:${s.ubicacionId}`) ?? 0,
                      ),
                    ),
                  ),
                D(0),
              );
            return {
              id: n.id,
              orden: n.orden,
              varianteId: n.varianteId,
              nombre: n.nombre,
              unidad: n.unidad,
              revision: n.revision,
              revisar: n.estado !== 'ACTIVA',
              cantidad: n.cantidad,
              reservada,
              consumida: n.consumida,
              pendiente,
              enCompra: compra?.cantidad ?? D(0),
              porCubrir: pos(pendiente.minus(compra?.cantidad ?? 0)),
              libre,
              compras: compra?.compras ?? [],
              proveedor: n.variante.proveedorReferencia,
            };
          }),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async listar(auth: CurrentAuth, page = 1, estado?: string) {
    this.precios(auth);
    const where = { tenantId: auth.tenantId, ...(estado ? { estado } : {}) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.ordenCompra.findMany({
        where,
        include: { lineas: true, ubicacion: { include: { almacen: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * 50,
        take: 50,
      }),
      this.prisma.ordenCompra.count({ where }),
    ]);
    return { data, total, page, pageSize: 50 };
  }
  async detalle(auth: CurrentAuth, id: string) {
    this.precios(auth);
    return this.prisma.$transaction((tx) => this.orden(tx, auth.tenantId, id), {
      isolationLevel: 'RepeatableRead',
    });
  }
  async crear(auth: CurrentAuth, data: CrearCompraDto) {
    return this.operacion(auth, data.clave, 'crear', data, async (tx) => {
      const tenantId = auth.tenantId;
      const proveedor = await tx.proveedor.findFirst({
        where: { id: data.proveedorId, tenantId, activo: true },
      });
      if (!proveedor) throw new BadRequestException('Proveedor no disponible.');
      await this.ubicacion(tx, tenantId, data.ubicacionId);
      if (!/^[A-Z]{3}$/.test(data.moneda))
        throw new BadRequestException('Moneda no válida.');
      const empresa = await tx.datosEmpresa.findUnique({
        where: { tenantId },
        select: { monedaCodigo: true },
      });
      const monedaStock = empresa?.monedaCodigo ?? 'ARS';
      if (data.moneda === monedaStock && data.tipoCambio !== 1)
        throw new BadRequestException(
          'El cambio debe ser 1 cuando las monedas coinciden.',
        );
      const fechaPedido = fechaCivil(data.fechaPedido);
      const solicitudes = data.lineas.flatMap((l) => l.asignaciones);
      if (
        new Set(solicitudes.map((a) => a.necesidadId)).size !==
        solicitudes.length
      )
        throw new BadRequestException(
          'No repitas una necesidad en la misma compra.',
        );
      const necesidades = await tx.necesidadMaterialOt.findMany({
        where: { tenantId, id: { in: solicitudes.map((a) => a.necesidadId) } },
      });
      if (necesidades.length !== solicitudes.length)
        throw new BadRequestException(
          'Hay una necesidad que no pertenece a esta empresa.',
        );
      await this.bloquearOrdenes(
        tx,
        tenantId,
        necesidades.map((n) => n.ordenId),
        data.lineas.map((l) => l.varianteId),
      );
      if (
        solicitudes.length &&
        !(await tx.politicaReservasMaterial.findUnique({ where: { tenantId } }))
          ?.habilitada
      )
        throw new ConflictException(
          'Activá las reservas por OT para vincular compras a necesidades.',
        );
      await bloquearVariantesStock(tx, tenantId, [
        ...data.lineas.map((l) => l.varianteId),
        ...necesidades.map((n) => n.varianteId),
      ]);
      const vigentes = await tx.necesidadMaterialOt.findMany({
        where: { tenantId, id: { in: solicitudes.map((a) => a.necesidadId) } },
        include: { reservas: true, orden: true },
      });
      const previas = await comprasPorNecesidad(
        tx,
        tenantId,
        solicitudes.map((a) => a.necesidadId),
        true,
      );
      const ultimo = await tx.ordenCompra.aggregate({
        where: { tenantId },
        _max: { numero: true },
      });
      const orden = await tx.ordenCompra.create({
        data: {
          tenantId,
          numero: (ultimo._max.numero ?? 0) + 1,
          proveedorId: proveedor.id,
          proveedorNombre: proveedor.nombre,
          ubicacionId: data.ubicacionId,
          fechaPedido,
          moneda: data.moneda,
          monedaStock,
          tipoCambio: data.tipoCambio,
          notas: data.notas?.trim() || null,
          creadoPor: this.actor(auth),
        },
      });
      for (const [posicion, l] of data.lineas.entries()) {
        const variante = await tx.materiaPrimaVariante.findFirst({
          where: {
            id: l.varianteId,
            tenantId,
            activo: true,
            materiaPrima: { activo: true },
          },
          include: { materiaPrima: true },
        });
        if (!variante) throw new BadRequestException('Material no disponible.');
        const unidadStock =
          variante.unidadStock ?? variante.materiaPrima.unidadStock;
        this.validarFactor(l.unidadCompra, unidadStock, l.factorStock);
        const oferta = await tx.ofertaCompra.findUnique({
          where: {
            tenantId_proveedorId_varianteId: {
              tenantId,
              proveedorId: proveedor.id,
              varianteId: l.varianteId,
            },
          },
        });
        if (oferta?.activo) {
          if (oferta.vigenteHasta && oferta.vigenteHasta < fechaPedido)
            throw new BadRequestException(
              'La oferta del proveedor venció. Actualizala antes de comprar.',
            );
          if (
            oferta.unidadStock !== unidadStock ||
            oferta.unidadCompra !== l.unidadCompra ||
            !oferta.factorStock.eq(l.factorStock)
          )
            throw new ConflictException(
              'La presentación cambió. Actualizá la oferta o el borrador.',
            );
          if (
            D(l.cantidad).lt(oferta.minimo) ||
            (oferta.multiplo && !D(l.cantidad).mod(oferta.multiplo).eq(0))
          )
            throw new BadRequestException(
              'La cantidad no respeta el mínimo o múltiplo de compra del proveedor.',
            );
        }
        const cantidadStock = D(l.cantidad)
          .mul(l.factorStock)
          .toDecimalPlaces(8);
        if (cantidadStock.lte(0) || cantidadStock.gte(1e12))
          throw new BadRequestException(
            'Cantidad de stock fuera del rango permitido.',
          );
        const dias = oferta?.activo
          ? (oferta.reposicionDias ?? proveedor.reposicionDias)
          : proveedor.reposicionDias;
        const tipo =
          oferta?.activo && oferta.reposicionDias != null
            ? oferta.reposicionTipo
            : proveedor.reposicionTipo;
        if (
          l.asignaciones
            .reduce((a, c) => a.plus(c.cantidad), D(0))
            .gt(cantidadStock)
        )
          throw new BadRequestException(
            'Las asignaciones superan la cantidad comprada.',
          );
        for (const a of l.asignaciones) {
          const n = vigentes.find((n) => n.id === a.necesidadId)!;
          const pendiente = pos(
            n.cantidad
              .minus(n.consumida)
              .minus(n.reservas.reduce((s, r) => s.plus(r.cantidad), D(0)))
              .minus(previas.get(n.id)?.cantidad ?? 0),
          );
          if (
            n.estado !== 'ACTIVA' ||
            !['pendiente', 'produccion'].includes(n.orden.estado) ||
            n.revision !== a.revision ||
            n.varianteId !== l.varianteId ||
            !mismasUnidades(unidadStock, n.unidad)
          )
            throw new ConflictException(
              'La necesidad cambió o requiere revisión. Actualizá Materiales en la OT.',
            );
          if (D(a.cantidad).gt(pendiente))
            throw new ConflictException(
              'La cantidad supera el faltante sin cobertura. Otra compra o reserva pudo cubrirlo.',
            );
        }
        const lineaCreada = await tx.lineaOrdenCompra.create({
          data: {
            tenantId,
            ordenId: orden.id,
            varianteId: l.varianteId,
            posicion,
            nombre: nombreMaterialCompra(variante),
            unidadCompra: l.unidadCompra,
            unidadStock,
            factorStock: l.factorStock,
            cantidad: l.cantidad,
            precio: l.precio,
            plazoDias: dias,
            plazoTipo: tipo,
            fechaEstimada: estimarReposicion(fechaPedido, dias, tipo),
            fechaConfirmada: l.fechaConfirmada
              ? fechaCivil(l.fechaConfirmada)
              : null,
            ofertaSnapshot: json(
              oferta?.activo
                ? oferta
                : {
                    origen: 'manual',
                    reposicionDias: dias,
                    reposicionTipo: tipo,
                  },
            ),
          },
        });
        if (l.asignaciones.length)
          await tx.coberturaCompra.createMany({
            data: l.asignaciones.map((a) => ({
              tenantId,
              lineaId: lineaCreada.id,
              necesidadId: a.necesidadId,
              revision: a.revision,
              cantidad: a.cantidad,
            })),
          });
      }
      return { ordenId: orden.id };
    });
  }
  async actuar(auth: CurrentAuth, id: string, data: AccionCompraDto) {
    return this.operacion(
      auth,
      data.clave,
      data.accion,
      { id, ...data },
      async (tx) => {
        const tenantId = auth.tenantId;
        const orden = await this.orden(tx, tenantId, id);
        if (orden.version !== data.version)
          throw new ConflictException(
            'La compra cambió. Actualizá antes de continuar.',
          );
        const cerrada = ['CANCELADA', 'CERRADA', 'RECIBIDA'].includes(
          orden.estado,
        );
        if (cerrada)
          throw new ConflictException('Esta compra ya está cerrada.');
        if (data.accion === 'fecha') {
          if (!data.lineaId || !orden.lineas.some((l) => l.id === data.lineaId))
            throw new BadRequestException('Línea no encontrada.');
          await tx.lineaOrdenCompra.update({
            where: { id: data.lineaId },
            data: {
              fechaConfirmada: data.fechaConfirmada
                ? fechaCivil(data.fechaConfirmada)
                : null,
            },
          });
        } else if (data.accion === 'emitir') {
          if (orden.estado !== 'BORRADOR')
            throw new ConflictException('Sólo se puede emitir un borrador.');
          if (
            !(await tx.proveedor.findFirst({
              where: { id: orden.proveedorId, tenantId, activo: true },
            }))
          )
            throw new ConflictException('El proveedor está inhabilitado.');
          await this.ubicacion(tx, tenantId, orden.ubicacionId);
          await this.bloquearOrdenes(
            tx,
            tenantId,
            orden.lineas.flatMap((l) =>
              l.coberturas.map((c) => c.necesidad.ordenId),
            ),
            orden.lineas.map((l) => l.varianteId),
          );
          await bloquearVariantesStock(
            tx,
            tenantId,
            orden.lineas.map((l) => l.varianteId),
          );
          const yaPedidas = await comprasPorNecesidad(
            tx,
            tenantId,
            orden.lineas.flatMap((l) => l.coberturas.map((c) => c.necesidadId)),
          );
          for (const l of orden.lineas) {
            const v = await tx.materiaPrimaVariante.findFirst({
              where: {
                id: l.varianteId,
                tenantId,
                activo: true,
                materiaPrima: { activo: true },
              },
              include: { materiaPrima: true },
            });
            if (
              !v ||
              !mismasUnidades(
                v.unidadStock ?? v.materiaPrima.unidadStock,
                l.unidadStock,
              )
            )
              throw new ConflictException(
                'Un material cambió o fue inhabilitado. Prepará una compra actualizada.',
              );
            for (const c of l.coberturas) {
              const n = await tx.necesidadMaterialOt.findUniqueOrThrow({
                where: { id: c.necesidadId },
                include: { orden: true, reservas: true },
              });
              if (
                n.revision !== c.revision ||
                n.estado !== 'ACTIVA' ||
                !['pendiente', 'produccion'].includes(n.orden.estado)
              )
                throw new ConflictException(
                  'Una OT cambió. Cancelá el borrador y prepará sus necesidades actualizadas.',
                );
              if (
                c.cantidad.gt(
                  pos(
                    n.cantidad
                      .minus(n.consumida)
                      .minus(
                        n.reservas.reduce((a, r) => a.plus(r.cantidad), D(0)),
                      )
                      .minus(yaPedidas.get(n.id)?.cantidad ?? 0),
                  ),
                )
              )
                throw new ConflictException(
                  'La OT ya tiene stock reservado u otra compra emitida. Revisá la cantidad de la compra.',
                );
            }
          }
        } else {
          if (!data.motivo?.trim())
            throw new BadRequestException(
              'Indicá el motivo de cierre o cancelación.',
            );
          if (
            data.accion === 'cancelar' &&
            orden.lineas.some((l) => l.recibida.gt(0))
          )
            throw new ConflictException(
              'Ya hubo recepciones. Usá Cerrar saldo pendiente.',
            );
          if (
            data.accion === 'cerrar' &&
            !ESTADOS_COMPRA_ABIERTA.includes(orden.estado)
          )
            throw new ConflictException(
              'Sólo se cierra el saldo de una compra emitida.',
            );
        }
        await tx.ordenCompra.update({
          where: { id },
          data: {
            version: { increment: 1 },
            ...(data.accion === 'emitir'
              ? { estado: 'EMITIDA' }
              : data.accion === 'cancelar'
                ? { estado: 'CANCELADA', motivoCierre: data.motivo!.trim() }
                : data.accion === 'cerrar'
                  ? { estado: 'CERRADA', motivoCierre: data.motivo!.trim() }
                  : {}),
          },
        });
        return { ordenId: id };
      },
    );
  }
  async recibir(auth: CurrentAuth, id: string, data: RecibirCompraDto) {
    return this.operacion(
      auth,
      data.clave,
      'recibir',
      { id, ...data },
      async (tx) => {
        const tenantId = auth.tenantId;
        const orden = await this.orden(tx, tenantId, id);
        if (orden.version !== data.version)
          throw new ConflictException(
            'La compra cambió. Revisá las cantidades pendientes.',
          );
        if (!ESTADOS_COMPRA_ABIERTA.includes(orden.estado))
          throw new ConflictException(
            'Emití la compra antes de registrar su recepción.',
          );
        if (
          new Set(data.lineas.map((l) => l.lineaId)).size !== data.lineas.length
        )
          throw new BadRequestException(
            'No repitas una línea en la recepción.',
          );
        await this.ubicacion(tx, tenantId, data.ubicacionId);
        const empresa = await tx.datosEmpresa.findUnique({
          where: { tenantId },
          select: { monedaCodigo: true },
        });
        if ((empresa?.monedaCodigo ?? 'ARS') !== orden.monedaStock)
          throw new ConflictException(
            'Cambió la moneda de stock de la empresa. Revisá la compra antes de recibir.',
          );
        await this.bloquearOrdenes(
          tx,
          tenantId,
          orden.lineas.flatMap((l) =>
            l.coberturas.map((c) => c.necesidad.ordenId),
          ),
          orden.lineas.map((l) => l.varianteId),
        );
        await bloquearVariantesStock(
          tx,
          tenantId,
          orden.lineas.map((l) => l.varianteId),
        );
        const politica = await tx.politicaReservasMaterial.findUnique({
          where: { tenantId },
        });
        const recepcion = await tx.recepcionCompra.create({
          data: {
            tenantId,
            ordenId: id,
            ubicacionId: data.ubicacionId,
            referencia: data.referencia?.trim() || null,
            notas: data.notas?.trim() || null,
            actor: this.actor(auth),
          },
        });
        for (const r of data.lineas) {
          const l = orden.lineas.find((l) => l.id === r.lineaId);
          if (!l)
            throw new BadRequestException(
              'La línea no pertenece a esta compra.',
            );
          if (D(r.cantidad).gt(l.cantidad.minus(l.recibida)))
            throw new ConflictException(
              'La cantidad recibida supera el saldo de la compra.',
            );
          const v = await tx.materiaPrimaVariante.findFirst({
            where: { id: l.varianteId, tenantId },
            include: { materiaPrima: true },
          });
          if (
            !v ||
            !mismasUnidades(
              v.unidadStock ?? v.materiaPrima.unidadStock,
              l.unidadStock,
            )
          )
            throw new ConflictException(
              'Cambió la unidad de stock del material.',
            );
          const teorica = D(r.cantidad).mul(l.factorStock).toDecimalPlaces(8);
          const esPeso =
            ['KG', 'GRAMO'].includes(l.unidadCompra) &&
            ['HOJA', 'PLACA', 'UNIDAD'].includes(l.unidadStock);
          if (!esPeso && !teorica.eq(r.cantidadStock))
            throw new BadRequestException(
              'La cantidad de stock debe coincidir con la conversión congelada en la compra.',
            );
          if (
            ['HOJA', 'PLACA', 'UNIDAD', 'PIEZA'].includes(l.unidadStock) &&
            !D(r.cantidadStock).isInteger()
          )
            throw new BadRequestException(
              'Recibí una cantidad entera de placas, hojas o unidades.',
            );
          const costo = l.precio
            .mul(r.cantidad)
            .mul(orden.tipoCambio)
            .div(r.cantidadStock)
            .toDecimalPlaces(6);
          if (costo.lte(0) || costo.gte(1e8))
            throw new BadRequestException(
              'El costo convertido queda fuera del rango permitido.',
            );
          const movimiento = await this.inventario.registrarMovimientoTx(
            tx,
            auth,
            {
              varianteId: l.varianteId,
              ubicacionId: data.ubicacionId,
              tipo: Tipo.ingreso,
              origen: Origen.compra,
              cantidad: r.cantidadStock,
              unidad: normalizeMaterialUnit(
                l.unidadStock,
              ) as UnidadMateriaPrimaDto,
              costoUnitario: costo.toNumber(),
              referenciaTipo: 'recepcion_compra',
              referenciaId: recepcion.id,
              notas: `OC-${String(orden.numero).padStart(6, '0')}${data.referencia ? ' · ' + data.referencia : ''}`,
            },
          );
          let disponible = D(r.cantidadStock);
          const reservas: Array<{
            necesidadId: string;
            ordenId: string;
            cantidad: number;
          }> = [];
          for (const c of [...l.coberturas].sort(
            (a, b) =>
              a.necesidad.createdAt.getTime() -
                b.necesidad.createdAt.getTime() || a.id.localeCompare(b.id),
          )) {
            const pendiente = pos(c.cantidad.minus(c.recibida));
            const entrega = Prisma.Decimal.min(disponible, pendiente);
            if (entrega.lte(0)) continue;

            // Una necesidad editada/cancelada pierde su cobertura; el ingreso queda libre.
            const n = await tx.necesidadMaterialOt.findUniqueOrThrow({
              where: { id: c.necesidadId },
              include: { reservas: true, orden: true },
            });
            if (
              politica?.habilitada &&
              n.revision === c.revision &&
              n.estado === 'ACTIVA' &&
              ['pendiente', 'produccion'].includes(n.orden.estado)
            ) {
              const falta = pos(
                n.cantidad
                  .minus(n.consumida)
                  .minus(n.reservas.reduce((a, x) => a.plus(x.cantidad), D(0))),
              );
              const cantidad = Prisma.Decimal.min(entrega, falta);
              if (cantidad.gt(0)) {
                disponible = disponible.minus(cantidad);
                await tx.coberturaCompra.update({
                  where: { id: c.id },
                  data: { recibida: { increment: cantidad } },
                });
                await tx.reservaMaterialOt.upsert({
                  where: {
                    tenantId_necesidadId_ubicacionId: {
                      tenantId,
                      necesidadId: n.id,
                      ubicacionId: data.ubicacionId,
                    },
                  },
                  create: {
                    tenantId,
                    necesidadId: n.id,
                    ubicacionId: data.ubicacionId,
                    cantidad,
                  },
                  update: { cantidad: { increment: cantidad } },
                });
                reservas.push({
                  necesidadId: n.id,
                  ordenId: n.ordenId,
                  cantidad: cantidad.toNumber(),
                });
              }
            }
          }
          await tx.detalleRecepcionCompra.create({
            data: {
              tenantId,
              recepcionId: recepcion.id,
              lineaId: l.id,
              movimientoId: movimiento.movimientoId,
              cantidadCompra: r.cantidad,
              cantidadStock: r.cantidadStock,
              costoStock: costo,
              reservasJson: json(reservas),
            },
          });
          await tx.lineaOrdenCompra.update({
            where: { id: l.id },
            data: { recibida: { increment: r.cantidad } },
          });
        }
        const lineas = await tx.lineaOrdenCompra.findMany({
          where: { tenantId, ordenId: id },
        });
        await tx.ordenCompra.update({
          where: { id },
          data: {
            version: { increment: 1 },
            estado: lineas.every((l) => l.recibida.eq(l.cantidad))
              ? 'RECIBIDA'
              : 'PARCIAL',
          },
        });
        return { ordenId: id, recepcionId: recepcion.id };
      },
    );
  }
}
