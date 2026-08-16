import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { regionalDelTenant } from '../common/regional';
import { claveFechaEnZona, instanteDe } from '../common/zona';
import { PrismaService } from '../prisma/prisma.service';
import {
  evaluarCupon,
  normalizarCodigoCupon,
  planDescuentoCupon,
  type CuponEvaluable,
  type ItemCarrito,
} from './cupon-reglas';
import type {
  ActualizarCuponDto,
  CrearCuponDto,
  ListarCuponesDto,
  ValidarCuponDto,
} from './dto/cupones.dto';

type Alcance = { ref: string | null; nombre: string | null };
type EstadoCupon = 'VIGENTE' | 'PAUSADO' | 'VENCIDO' | 'AGOTADO' | 'PROGRAMADO';
type ItemCotizadoConCupon = {
  cotizacionItemId: string;
  codigo: string;
  subtotal: number;
  descuentoTipo?: string | null;
  descuentoValor?: number | null;
  descuentoMonto?: number | null;
  descuentoCuponId?: string | null;
};

@Injectable()
export class CuponesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(auth: CurrentAuth, filtros: ListarCuponesDto) {
    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    const hoy = claveFechaEnZona(new Date(), regional.zonaHoraria);
    const busqueda = filtros.busqueda?.trim();
    const where: Prisma.CuponWhereInput = {
      tenantId: auth.tenantId,
      ...(busqueda
        ? {
            OR: [
              { codigo: { contains: busqueda, mode: 'insensitive' } },
              { descripcion: { contains: busqueda, mode: 'insensitive' } },
              { alcanceNombre: { contains: busqueda, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    // El estado efectivo compara usoCount con usoMax (columna contra columna),
    // algo que Prisma no expresa en `where`. Se filtra antes de paginar para
    // mantener total y páginas correctos, sin el corte silencioso de 200.
    const [rows, todas, redencionesMes] = await Promise.all([
      this.prisma.cupon.findMany({ where, orderBy: { createdAt: 'desc' } }),
      this.prisma.cupon.findMany({
        where: { tenantId: auth.tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cuponRedencion.aggregate({
        where: {
          tenantId: auth.tenantId,
          estado: 'CONSUMIDA',
          consumidaEl: {
            gte: instanteDe(
              `${hoy.slice(0, 7)}-01`,
              '00:00',
              regional.zonaHoraria,
            ),
          },
        },
        _count: { _all: true },
        _sum: { montoAplicado: true },
      }),
    ]);
    const filtradas = filtros.estado
      ? rows.filter((row) => this.estadoDe(row, hoy) === filtros.estado)
      : rows;
    const skip = filtros.skip ?? 0;
    const limit = filtros.limit ?? 24;
    const estados = todas.map((row) => this.estadoDe(row, hoy));
    return {
      items: filtradas
        .slice(skip, skip + limit)
        .map((c) => this.proyectar(c, hoy)),
      total: filtradas.length,
      skip,
      limit,
      metricas: {
        total: todas.length,
        vigentes: estados.filter((estado) => estado === 'VIGENTE').length,
        porVencer: todas.filter((row) => this.porVencer(row, hoy)).length,
        agotados: estados.filter((estado) => estado === 'AGOTADO').length,
        redencionesMes: redencionesMes._count._all,
        descontadoMes: Number(redencionesMes._sum.montoAplicado ?? 0),
      },
    };
  }

  async crear(auth: CurrentAuth, dto: CrearCuponDto) {
    const codigo = normalizarCodigoCupon(dto.codigo);
    this.validarReglas(
      dto.tipo,
      dto.valor,
      dto.vigenciaDesde,
      dto.vigenciaHasta,
    );
    const alcance = await this.resolverAlcance(
      auth.tenantId,
      dto.alcanceTipo ?? 'ORDEN',
      dto.alcanceRef ?? null,
    );
    const actor = await this.actor(auth);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const cupon = await tx.cupon.create({
          data: {
            tenantId: auth.tenantId,
            codigo,
            descripcion: this.textoOpcional(dto.descripcion),
            tipo: dto.tipo,
            valor: dto.valor,
            alcanceTipo: dto.alcanceTipo ?? 'ORDEN',
            alcanceRef: alcance.ref,
            alcanceNombre: alcance.nombre,
            montoMinimo: dto.montoMinimo ?? null,
            vigenciaDesde: this.fechaDb(dto.vigenciaDesde),
            vigenciaHasta: this.fechaDb(dto.vigenciaHasta),
            usoMax: dto.usoMax ?? null,
            creadoPorId: auth.userId,
            creadoPorNombre: actor,
            actualizadoPorId: auth.userId,
            actualizadoPorNombre: actor,
          },
        });
        await this.evento(tx, auth, actor, cupon, 'CREADO', 'Cupón creado.', {
          despues: this.snapshot(cupon),
        });
        return this.proyectar(cupon);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(`Ya existe un cupón "${codigo}".`);
      }
      throw error;
    }
  }

  async actualizar(auth: CurrentAuth, id: string, dto: ActualizarCuponDto) {
    const existente = await this.exigir(auth, id);
    const tipo = dto.tipo ?? existente.tipo;
    const valor = dto.valor ?? Number(existente.valor);
    const desde =
      dto.vigenciaDesde !== undefined
        ? dto.vigenciaDesde
        : this.fechaClave(existente.vigenciaDesde);
    const hasta =
      dto.vigenciaHasta !== undefined
        ? dto.vigenciaHasta
        : this.fechaClave(existente.vigenciaHasta);
    this.validarReglas(tipo, valor, desde, hasta);
    const alcanceTipo = dto.alcanceTipo ?? existente.alcanceTipo;
    const alcanceRef =
      dto.alcanceRef !== undefined ? dto.alcanceRef : existente.alcanceRef;
    const alcance = await this.resolverAlcance(
      auth.tenantId,
      alcanceTipo,
      alcanceRef,
    );
    const usoMax = dto.usoMax !== undefined ? dto.usoMax : existente.usoMax;
    if (
      usoMax != null &&
      usoMax < existente.usoCount &&
      !dto.confirmarUsoMaxMenor
    ) {
      throw new BadRequestException(
        `El límite es menor que los ${existente.usoCount} usos actuales. Confirmá explícitamente para guardar el cambio.`,
      );
    }
    const actor = await this.actor(auth);
    const actualizado = await this.prisma.$transaction(async (tx) => {
      const result = await tx.cupon.updateMany({
        where: { id, tenantId: auth.tenantId, version: dto.version },
        data: {
          ...(dto.descripcion !== undefined
            ? { descripcion: this.textoOpcional(dto.descripcion) }
            : {}),
          ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
          ...(dto.valor !== undefined ? { valor: dto.valor } : {}),
          alcanceTipo,
          alcanceRef: alcance.ref,
          alcanceNombre: alcance.nombre,
          ...(dto.montoMinimo !== undefined
            ? { montoMinimo: dto.montoMinimo }
            : {}),
          ...(dto.vigenciaDesde !== undefined
            ? { vigenciaDesde: this.fechaDb(dto.vigenciaDesde) }
            : {}),
          ...(dto.vigenciaHasta !== undefined
            ? { vigenciaHasta: this.fechaDb(dto.vigenciaHasta) }
            : {}),
          ...(dto.usoMax !== undefined ? { usoMax: dto.usoMax } : {}),
          ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
          version: { increment: 1 },
          actualizadoPorId: auth.userId,
          actualizadoPorNombre: actor,
        },
      });
      if (result.count !== 1) {
        throw new ConflictException(
          'El cupón fue modificado por otra persona. Recargá la lista antes de volver a guardar.',
        );
      }
      const cupon = await tx.cupon.findUniqueOrThrow({ where: { id } });
      const tipoEvento =
        dto.activo === true
          ? 'REACTIVADO'
          : dto.activo === false
            ? 'PAUSADO'
            : 'EDITADO';
      await this.evento(
        tx,
        auth,
        actor,
        cupon,
        tipoEvento,
        tipoEvento === 'EDITADO'
          ? 'Reglas del cupón actualizadas.'
          : tipoEvento === 'PAUSADO'
            ? 'Cupón pausado.'
            : 'Cupón reactivado.',
        { antes: this.snapshot(existente), despues: this.snapshot(cupon) },
      );
      return cupon;
    });
    return this.proyectar(actualizado);
  }

  async validar(auth: CurrentAuth, dto: ValidarCuponDto) {
    const [cupon, regional] = await Promise.all([
      this.prisma.cupon.findUnique({
        where: {
          tenantId_codigo: {
            tenantId: auth.tenantId,
            codigo: normalizarCodigoCupon(dto.codigo),
          },
        },
      }),
      regionalDelTenant(this.prisma, auth.tenantId),
    ]);
    if (!cupon)
      throw new NotFoundException('No existe un cupón con ese código.');
    const items = this.itemsDe(dto);
    const resultado = evaluarCupon(this.aEvaluable(cupon), {
      ahora: new Date(),
      zonaHoraria: regional.zonaHoraria,
      clienteId: dto.clienteId ?? null,
      items,
    });
    if (!resultado.ok) throw new BadRequestException(resultado.motivo);
    const plan = planDescuentoCupon(
      this.aEvaluable(cupon),
      items,
      resultado.alcanzadas,
      regional.moneda.decimales,
    );
    return {
      cupon: this.proyectar(cupon),
      alcanzadas: resultado.alcanzadas,
      plan,
      montoAplicado:
        cupon.tipo === 'MONTO'
          ? plan.reduce((suma, linea) => suma + linea.valor, 0)
          : null,
    };
  }

  /**
   * Reserva atómicamente los usos incluidos en un presupuesto que sale al
   * cliente. Revalida alcance y montos contra snapshots del backend.
   */
  async reservarParaPresupuesto(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    cotizacionId: string,
    clienteId: string | null,
    items: ItemCotizadoConCupon[],
  ) {
    const ids = Array.from(
      new Set(
        items
          .map((item) => item.descuentoCuponId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (ids.length === 0) return;
    const [cupones, referencias, regional, actor] = await Promise.all([
      tx.cupon.findMany({
        where: { tenantId: auth.tenantId, id: { in: ids } },
      }),
      tx.cotizacionItem.findMany({
        where: {
          tenantId: auth.tenantId,
          cotizacionId,
          id: { in: items.map((item) => item.cotizacionItemId) },
        },
        select: {
          id: true,
          productoId: true,
          producto: {
            select: {
              codigo: true,
              subcategoriaComercial: {
                select: {
                  codigo: true,
                  categoria: { select: { codigo: true } },
                },
              },
            },
          },
        },
      }),
      regionalDelTenant(tx, auth.tenantId),
      this.actor(auth),
    ]);
    if (cupones.length !== ids.length) {
      throw new BadRequestException(
        'Algún cupón aplicado ya no existe o pertenece a otro negocio.',
      );
    }
    const porId = new Map(referencias.map((item) => [item.id, item]));
    const contextoItems: ItemCarrito[] = items.map((item) => {
      const ref = porId.get(item.cotizacionItemId);
      return {
        key: item.cotizacionItemId,
        productoId: ref?.productoId ?? null,
        productoCodigo: ref?.producto.codigo ?? item.codigo,
        categoriaCodigo:
          ref?.producto.subcategoriaComercial.categoria.codigo ?? null,
        subcategoriaCodigo: ref?.producto.subcategoriaComercial.codigo ?? null,
        neto: item.subtotal + Number(item.descuentoMonto ?? 0),
      };
    });

    for (const cupon of cupones) {
      const existente = await tx.cuponRedencion.findUnique({
        where: {
          cuponId_cotizacionId: { cuponId: cupon.id, cotizacionId },
        },
      });
      if (existente && existente.estado !== 'LIBERADA') continue;
      const evaluable = this.aEvaluable(cupon);
      const evaluacion = evaluarCupon(evaluable, {
        ahora: new Date(),
        zonaHoraria: regional.zonaHoraria,
        clienteId,
        items: contextoItems,
      });
      if (!evaluacion.ok) throw new BadRequestException(evaluacion.motivo);
      this.validarPlanPersistido(
        cupon,
        items,
        contextoItems,
        evaluacion.alcanzadas,
        regional.redondeoPrecio === 'entero' ? 0 : regional.moneda.decimales,
      );
      const tomado = await tx.cupon.updateMany({
        where: {
          id: cupon.id,
          tenantId: auth.tenantId,
          version: cupon.version,
          activo: true,
          ...(cupon.usoMax != null ? { usoCount: { lt: cupon.usoMax } } : {}),
        },
        data: { usoCount: { increment: 1 } },
      });
      if (tomado.count !== 1) {
        throw new ConflictException(
          `El cupón ${cupon.codigo} cambió o se quedó sin usos mientras se enviaba el presupuesto.`,
        );
      }
      const monto = items
        .filter((item) => item.descuentoCuponId === cupon.id)
        .reduce((suma, item) => suma + Number(item.descuentoMonto ?? 0), 0);
      if (existente) {
        await tx.cuponRedencion.update({
          where: { id: existente.id },
          data: {
            estado: 'RESERVADA',
            montoAplicado: monto,
            actorId: auth.userId,
            actorNombre: actor,
            liberadaEl: null,
            liberadaMotivo: null,
          },
        });
      } else {
        await tx.cuponRedencion.create({
          data: {
            tenantId: auth.tenantId,
            cuponId: cupon.id,
            cotizacionId,
            estado: 'RESERVADA',
            montoAplicado: monto,
            actorId: auth.userId,
            actorNombre: actor,
          },
        });
      }
    }
  }

  /** Devuelve reservas no consumidas sin borrar su rastro. */
  async liberarReservasPresupuesto(
    tx: Prisma.TransactionClient,
    tenantId: string,
    cotizacionId: string,
    motivo: string,
  ) {
    const reservas = await tx.cuponRedencion.findMany({
      where: { tenantId, cotizacionId, estado: 'RESERVADA' },
      select: { id: true, cuponId: true },
    });
    for (const reserva of reservas) {
      const liberada = await tx.cuponRedencion.updateMany({
        where: { id: reserva.id, estado: 'RESERVADA' },
        data: {
          estado: 'LIBERADA',
          liberadaEl: new Date(),
          liberadaMotivo: motivo,
        },
      });
      if (liberada.count === 1) {
        await tx.$executeRaw`
          UPDATE "Cupon" SET "usoCount" = GREATEST("usoCount" - 1, 0)
          WHERE "id" = ${reserva.cuponId}::uuid
            AND "tenantId" = ${tenantId}::uuid`;
      }
    }
  }

  async historial(auth: CurrentAuth, id: string) {
    const cupon = await this.exigir(auth, id);
    const [eventos, redenciones] = await Promise.all([
      this.prisma.cuponEvento.findMany({
        where: { tenantId: auth.tenantId, cuponId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cuponRedencion.findMany({
        where: { tenantId: auth.tenantId, cuponId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          cotizacion: { select: { id: true, numero: true } },
          orden: { select: { id: true, numero: true } },
        },
      }),
    ]);
    return {
      cupon: this.proyectar(cupon),
      eventos: eventos.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        descripcion: e.descripcion,
        actor: e.actorNombre,
        fecha: e.createdAt.toISOString(),
      })),
      redenciones: redenciones.map((r) => ({
        id: r.id,
        estado: r.estado,
        montoAplicado: Number(r.montoAplicado),
        presupuesto: r.cotizacion,
        orden: r.orden,
        actor: r.actorNombre,
        fecha: (r.consumidaEl ?? r.createdAt).toISOString(),
        liberadaEl: r.liberadaEl?.toISOString() ?? null,
        liberadaMotivo: r.liberadaMotivo,
      })),
    };
  }

  async eliminar(auth: CurrentAuth, id: string) {
    const cupon = await this.exigir(auth, id);
    const actor = await this.actor(auth);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const redenciones = await tx.cuponRedencion.count({
            where: { tenantId: auth.tenantId, cuponId: cupon.id },
          });
          if (redenciones > 0) {
            throw new BadRequestException(
              `${cupon.codigo} ya tiene historial de uso. Pausalo para conservar la trazabilidad.`,
            );
          }
          await this.evento(
            tx,
            auth,
            actor,
            cupon,
            'ELIMINADO',
            'Cupón eliminado.',
          );
          await tx.cupon.delete({ where: { id: cupon.id } });
          return { id: cupon.id, codigo: cupon.codigo };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2034')
      ) {
        throw new ConflictException(
          'El cupón recibió un uso mientras se intentaba eliminar. Pausalo y conservá su historial.',
        );
      }
      throw error;
    }
  }

  private async exigir(auth: CurrentAuth, id: string) {
    const cupon = await this.prisma.cupon.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!cupon) throw new NotFoundException('El cupón no existe.');
    return cupon;
  }

  private validarReglas(
    tipo: string,
    valor: number,
    desde: string | null | undefined,
    hasta: string | null | undefined,
  ) {
    if (tipo === 'PORCENTAJE' && valor > 100) {
      throw new BadRequestException('El porcentaje no puede superar el 100%.');
    }
    if (desde && hasta && desde > hasta) {
      throw new BadRequestException(
        'La vigencia desde no puede ser posterior al vencimiento.',
      );
    }
  }

  private async resolverAlcance(
    tenantId: string,
    tipo: string,
    ref: string | null | undefined,
  ): Promise<Alcance> {
    if (tipo === 'ORDEN') return { ref: null, nombre: null };
    if (!ref?.trim()) {
      throw new BadRequestException('Elegí a qué aplica el cupón.');
    }
    if (tipo === 'CATEGORIA') {
      const categoria = await this.prisma.productoCategoriaComercial.findFirst({
        where: { codigo: ref, activo: true },
        select: { codigo: true, nombre: true },
      });
      if (!categoria)
        throw new BadRequestException(
          'La categoría no existe o está inactiva.',
        );
      return { ref: categoria.codigo, nombre: categoria.nombre };
    }
    if (tipo === 'SUBCATEGORIA') {
      const subcategoria =
        await this.prisma.productoSubcategoriaComercial.findFirst({
          where: { codigo: ref, activo: true, categoria: { activo: true } },
          select: {
            codigo: true,
            nombre: true,
            categoria: { select: { nombre: true } },
          },
        });
      if (!subcategoria) {
        throw new BadRequestException(
          'La subcategoría no existe o está inactiva.',
        );
      }
      return {
        ref: subcategoria.codigo,
        nombre: `${subcategoria.categoria.nombre} › ${subcategoria.nombre}`,
      };
    }
    if (tipo === 'PRODUCTO') {
      const esUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          ref,
        );
      const producto = await this.prisma.producto.findFirst({
        where: {
          tenantId,
          activo: true,
          OR: [{ codigo: ref }, ...(esUuid ? [{ id: ref }] : [])],
        },
        select: { id: true, codigo: true, nombre: true },
      });
      if (!producto)
        throw new BadRequestException('El producto no existe o está inactivo.');
      return {
        ref: producto.id,
        nombre: `${producto.codigo} · ${producto.nombre}`,
      };
    }
    if (tipo === 'CLIENTE') {
      if (!/^[0-9a-f-]{36}$/i.test(ref)) {
        throw new BadRequestException(
          'La referencia del cliente no es válida.',
        );
      }
      const cliente = await this.prisma.cliente.findFirst({
        where: { tenantId, id: ref, activo: true },
        select: { id: true, nombre: true },
      });
      if (!cliente)
        throw new BadRequestException('El cliente no existe o está inactivo.');
      return { ref: cliente.id, nombre: cliente.nombre };
    }
    throw new BadRequestException('El alcance del cupón no es válido.');
  }

  private itemsDe(dto: ValidarCuponDto): ItemCarrito[] {
    return dto.items.map((i) => ({
      key: i.key,
      productoId: i.productoId ?? null,
      productoCodigo: i.productoCodigo ?? null,
      categoriaCodigo: i.categoriaCodigo ?? null,
      subcategoriaCodigo: i.subcategoriaCodigo ?? null,
      neto: i.neto,
    }));
  }

  private validarPlanPersistido(
    cupon: { id: string; codigo: string; tipo: string; valor: Prisma.Decimal },
    items: ItemCotizadoConCupon[],
    contextoItems: ItemCarrito[],
    alcanzadas: string[],
    decimales: number,
  ) {
    const plan = planDescuentoCupon(
      { tipo: cupon.tipo, valor: Number(cupon.valor) },
      contextoItems,
      alcanzadas,
      decimales,
    );
    const esperado = new Map(plan.map((linea) => [linea.key, linea]));
    const aplicados = items.filter(
      (item) => item.descuentoCuponId === cupon.id,
    );
    if (aplicados.length !== plan.length) {
      throw new BadRequestException(
        `El cupón ${cupon.codigo} debe aplicarse completo a todos los productos alcanzados.`,
      );
    }
    const tolerancia = 1 / 10 ** decimales / 2;
    for (const item of aplicados) {
      const linea = esperado.get(item.cotizacionItemId);
      const real =
        cupon.tipo === 'MONTO'
          ? Number(item.descuentoMonto ?? 0)
          : Number(item.descuentoValor ?? 0);
      if (
        !linea ||
        item.descuentoTipo !== linea.tipo ||
        Math.abs(real - linea.valor) > tolerancia
      ) {
        throw new BadRequestException(
          `La distribución aplicada no coincide con el cupón ${cupon.codigo}. Volvé a aplicarlo.`,
        );
      }
    }
  }

  private aEvaluable(cupon: {
    codigo: string;
    tipo: string;
    valor: Prisma.Decimal;
    alcanceTipo: string;
    alcanceRef: string | null;
    montoMinimo: Prisma.Decimal | null;
    vigenciaDesde: Date | null;
    vigenciaHasta: Date | null;
    usoMax: number | null;
    usoCount: number;
    activo: boolean;
  }): CuponEvaluable {
    return {
      codigo: cupon.codigo,
      tipo: cupon.tipo,
      valor: Number(cupon.valor),
      alcanceTipo: cupon.alcanceTipo,
      alcanceRef: cupon.alcanceRef,
      montoMinimo: cupon.montoMinimo != null ? Number(cupon.montoMinimo) : null,
      vigenciaDesde: this.fechaClave(cupon.vigenciaDesde),
      vigenciaHasta: this.fechaClave(cupon.vigenciaHasta),
      usoMax: cupon.usoMax,
      usoCount: cupon.usoCount,
      activo: cupon.activo,
    };
  }

  private proyectar(
    cupon: Parameters<CuponesService['aEvaluable']>[0] & {
      id: string;
      descripcion: string | null;
      alcanceNombre: string | null;
      version: number;
      creadoPorNombre: string | null;
      actualizadoPorNombre: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    hoy?: string,
  ) {
    return {
      id: cupon.id,
      codigo: cupon.codigo,
      descripcion: cupon.descripcion,
      tipo: cupon.tipo as 'PORCENTAJE' | 'MONTO',
      valor: Number(cupon.valor),
      alcanceTipo: cupon.alcanceTipo,
      alcanceRef: cupon.alcanceRef,
      alcanceNombre: cupon.alcanceNombre,
      montoMinimo: cupon.montoMinimo != null ? Number(cupon.montoMinimo) : null,
      vigenciaDesde: this.fechaClave(cupon.vigenciaDesde),
      vigenciaHasta: this.fechaClave(cupon.vigenciaHasta),
      usoMax: cupon.usoMax,
      usoCount: cupon.usoCount,
      activo: cupon.activo,
      estado: hoy ? this.estadoDe(cupon, hoy) : undefined,
      version: cupon.version,
      creadoPor: cupon.creadoPorNombre,
      actualizadoPor: cupon.actualizadoPorNombre,
      createdAt: cupon.createdAt.toISOString(),
      updatedAt: cupon.updatedAt.toISOString(),
    };
  }

  private estadoDe(
    cupon: {
      activo: boolean;
      usoMax: number | null;
      usoCount: number;
      vigenciaDesde: Date | null;
      vigenciaHasta: Date | null;
    },
    hoy: string,
  ): EstadoCupon {
    if (!cupon.activo) return 'PAUSADO';
    if (cupon.usoMax != null && cupon.usoCount >= cupon.usoMax)
      return 'AGOTADO';
    const desde = this.fechaClave(cupon.vigenciaDesde);
    const hasta = this.fechaClave(cupon.vigenciaHasta);
    if (desde && desde > hoy) return 'PROGRAMADO';
    if (hasta && hasta < hoy) return 'VENCIDO';
    return 'VIGENTE';
  }

  private porVencer(
    cupon: {
      activo: boolean;
      vigenciaHasta: Date | null;
      usoMax: number | null;
      usoCount: number;
    },
    hoy: string,
  ) {
    if (this.estadoDe({ ...cupon, vigenciaDesde: null }, hoy) !== 'VIGENTE')
      return false;
    const hasta = this.fechaClave(cupon.vigenciaHasta);
    if (!hasta) return false;
    const dias = Math.round(
      (this.fechaDb(hasta)!.getTime() - this.fechaDb(hoy)!.getTime()) /
        86_400_000,
    );
    return dias >= 0 && dias <= 14;
  }

  private fechaDb(fecha: string | null | undefined): Date | null {
    if (!fecha) return null;
    const value = new Date(`${fecha}T00:00:00.000Z`);
    if (
      Number.isNaN(value.getTime()) ||
      value.toISOString().slice(0, 10) !== fecha
    ) {
      throw new BadRequestException(`La fecha "${fecha}" no existe.`);
    }
    return value;
  }

  private fechaClave(fecha: Date | null | undefined) {
    return fecha?.toISOString().slice(0, 10) ?? null;
  }

  private textoOpcional(texto: string | null | undefined) {
    return texto?.trim() || null;
  }

  private async actor(auth: CurrentAuth) {
    if (auth.impersonacion) return auth.impersonacion.actorNombre;
    if (auth.mcp) return auth.mcp.credencialNombre;
    const user = await this.prisma.user.findFirst({
      where: { id: auth.userId },
      select: { nombreCompleto: true, email: true },
    });
    return user?.nombreCompleto ?? user?.email ?? auth.email ?? 'Usuario';
  }

  private snapshot(cupon: {
    descripcion: string | null;
    tipo: string;
    valor: Prisma.Decimal;
    alcanceTipo: string;
    alcanceRef: string | null;
    alcanceNombre: string | null;
    montoMinimo: Prisma.Decimal | null;
    vigenciaDesde: Date | null;
    vigenciaHasta: Date | null;
    usoMax: number | null;
    usoCount: number;
    activo: boolean;
    version: number;
  }) {
    return {
      descripcion: cupon.descripcion,
      tipo: cupon.tipo,
      valor: Number(cupon.valor),
      alcanceTipo: cupon.alcanceTipo,
      alcanceRef: cupon.alcanceRef,
      alcanceNombre: cupon.alcanceNombre,
      montoMinimo: cupon.montoMinimo != null ? Number(cupon.montoMinimo) : null,
      vigenciaDesde: this.fechaClave(cupon.vigenciaDesde),
      vigenciaHasta: this.fechaClave(cupon.vigenciaHasta),
      usoMax: cupon.usoMax,
      usoCount: cupon.usoCount,
      activo: cupon.activo,
      version: cupon.version,
    };
  }

  private evento(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    actor: string,
    cupon: { id: string; codigo: string },
    tipo: string,
    descripcion: string,
    datosJson?: unknown,
  ) {
    return tx.cuponEvento.create({
      data: {
        tenantId: auth.tenantId,
        cuponId: cupon.id,
        codigo: cupon.codigo,
        tipo,
        descripcion,
        actorId: auth.userId,
        actorNombre: actor,
        datosJson: datosJson as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
