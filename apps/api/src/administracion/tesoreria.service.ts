import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import type { CurrentAuth } from '../auth/auth.types';
import { regionalDelTenant } from '../common/regional';
import { instanteDe, sumarDiasAClave } from '../common/zona';
import { PrismaService } from '../prisma/prisma.service';
import { CobrosService } from './cobros.service';
import type {
  AcreditarValorDto,
  AjusteFondosDto,
  ArqueoDto,
  ConciliarMovimientoDto,
  DepositarValorDto,
  EditarCuentaFondosDto,
  MovimientosFondosQueryDto,
  RechazarValorDto,
  RevertirOperacionValorDto,
  TransferenciaDto,
  UpsertCuentaFondosDto,
} from './dto/tesoreria.dto';
import {
  ejecutarTransaccionFondos,
  fechaNegocio,
  redondearFondos,
  registrarMovimientoFondos,
  resolverActorFondos,
} from './fondos-ledger';

@Injectable()
export class TesoreriaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cobros: CobrosService,
  ) {}

  /** Cuentas y posición, sin sumar monedas incompatibles. */
  async resumen(auth: CurrentAuth) {
    await this.cobros.barrerVencidos(auth.tenantId);
    const { moneda } = await regionalDelTenant(this.prisma, auth.tenantId);
    const [cuentas, pendientes, valores] = await Promise.all([
      this.prisma.cuentaFondos.findMany({
        where: {
          tenantId: auth.tenantId,
          tipo: { notIn: ['cartera_valores', 'cartera_valores_legacy'] },
        },
        orderBy: [{ activo: 'desc' }, { tipo: 'asc' }, { nombre: 'asc' }],
        include: {
          movimientos: {
            orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
            take: 1,
            select: { fecha: true },
          },
        },
      }),
      this.prisma.cobro.groupBy({
        by: ['moneda'],
        where: {
          tenantId: auth.tenantId,
          anuladoEl: null,
          estadoAcreditacion: 'pendiente',
          metodoPago: { tipo: { not: 'cheque_echeq' } },
        },
        _sum: { disponibleReal: true },
      }),
      this.prisma.valor.groupBy({
        by: ['moneda'],
        where: {
          tenantId: auth.tenantId,
          origen: 'tercero',
          estado: { in: ['cartera', 'depositado'] },
        },
        _sum: { importe: true },
      }),
    ]);

    const lista = cuentas.map((cuenta) => ({
      id: cuenta.id,
      tipo: cuenta.tipo,
      nombre: cuenta.nombre,
      banco: cuenta.banco,
      cbuAlias: cuenta.cbuAlias,
      moneda: cuenta.moneda,
      saldo: Number(cuenta.saldo),
      permiteSaldoNegativo: cuenta.permiteSaldoNegativo,
      ultimoMovimiento: cuenta.movimientos[0]?.fecha.toISOString() ?? null,
      activo: cuenta.activo,
    }));
    const activas = lista.filter((cuenta) => cuenta.activo);
    const posiciones = Object.fromEntries(
      [...new Set(activas.map((cuenta) => cuenta.moneda))].map((codigo) => [
        codigo,
        redondearFondos(
          activas
            .filter((cuenta) => cuenta.moneda === codigo)
            .reduce((suma, cuenta) => suma + cuenta.saldo, 0),
        ),
      ]),
    );
    const pendientePorMoneda = Object.fromEntries(
      pendientes.map((fila) => [
        fila.moneda,
        Number(fila._sum.disponibleReal ?? 0),
      ]),
    );
    const valoresPorMoneda = Object.fromEntries(
      valores.map((fila) => [fila.moneda, Number(fila._sum.importe ?? 0)]),
    );
    const locales = activas.filter((cuenta) => cuenta.moneda === moneda.codigo);

    return {
      monedaLocal: moneda.codigo,
      cuentas: lista,
      kpis: {
        posicionLocal: posiciones[moneda.codigo] ?? 0,
        posiciones,
        efectivo: locales
          .filter((cuenta) => cuenta.tipo === 'caja')
          .reduce((suma, cuenta) => suma + cuenta.saldo, 0),
        bancos: locales
          .filter(
            (cuenta) => cuenta.tipo === 'banco' || cuenta.tipo === 'billetera',
          )
          .reduce((suma, cuenta) => suma + cuenta.saldo, 0),
        cajasActivas: locales.filter((cuenta) => cuenta.tipo === 'caja').length,
        cuentasLocales: locales.filter((cuenta) => cuenta.tipo !== 'caja')
          .length,
        aAcreditar: pendientePorMoneda[moneda.codigo] ?? 0,
        aAcreditarPorMoneda: pendientePorMoneda,
        valoresEnCartera: valoresPorMoneda[moneda.codigo] ?? 0,
        valoresPorMoneda,
      },
    };
  }

  async crearCuenta(auth: CurrentAuth, payload: UpsertCuentaFondosDto) {
    const actor = await resolverActorFondos(this.prisma, auth);
    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    return ejecutarTransaccionFondos(this.prisma, async (tx) => {
      const cuenta = await tx.cuentaFondos.create({
        data: {
          tenantId: auth.tenantId,
          tipo: payload.tipo,
          nombre: payload.nombre.trim(),
          banco: payload.banco?.trim() || null,
          cbuAlias: payload.cbuAlias?.trim() || null,
          moneda: payload.moneda ?? regional.moneda.codigo,
          permiteSaldoNegativo: payload.permiteSaldoNegativo ?? false,
        },
      });
      await tx.cuentaFondosEvento.create({
        data: {
          tenantId: auth.tenantId,
          cuentaId: cuenta.id,
          tipo: 'creada',
          actorUserId: actor.userId,
          actorNombre: actor.nombre,
          detalleJson: {
            tipo: cuenta.tipo,
            moneda: cuenta.moneda,
            permiteSaldoNegativo: cuenta.permiteSaldoNegativo,
          },
        },
      });
      if ((payload.saldoInicial ?? 0) > 0) {
        await registrarMovimientoFondos(tx, {
          tenantId: auth.tenantId,
          cuentaId: cuenta.id,
          fecha: new Date(),
          tipo: 'entrada',
          monto: payload.saldoInicial!,
          concepto: 'Saldo inicial de la cuenta',
          origenTipo: 'saldo_inicial',
          actor,
          operacionId: randomUUID(),
          estadoConciliacion: 'conciliado',
        });
      }
      return { id: cuenta.id };
    });
  }

  async editarCuenta(
    auth: CurrentAuth,
    id: string,
    payload: EditarCuentaFondosDto,
  ) {
    const actor = await resolverActorFondos(this.prisma, auth);
    return ejecutarTransaccionFondos(this.prisma, async (tx) => {
      const actual = await tx.cuentaFondos.findFirst({
        where: { id, tenantId: auth.tenantId },
      });
      if (!actual) throw new NotFoundException('No se encontró la cuenta.');
      if (payload.moneda && payload.moneda !== actual.moneda) {
        const movimientos = await tx.movimientoFondos.count({
          where: { tenantId: auth.tenantId, cuentaId: id },
        });
        if (movimientos > 0 || Number(actual.saldo) !== 0) {
          throw new BadRequestException(
            'La moneda sólo puede cambiarse antes del primer movimiento y con saldo cero.',
          );
        }
      }
      if (payload.activo === false) {
        if (Number(actual.saldo) !== 0) {
          throw new BadRequestException(
            'Para desactivar una cuenta su saldo debe ser cero.',
          );
        }
        const [pendientes, defaults] = await Promise.all([
          tx.cobro.count({
            where: {
              tenantId: auth.tenantId,
              cuentaDestinoId: id,
              anuladoEl: null,
              estadoAcreditacion: 'pendiente',
            },
          }),
          tx.metodoPago.count({
            where: {
              tenantId: auth.tenantId,
              cuentaDestinoId: id,
              activo: true,
            },
          }),
        ]);
        if (pendientes > 0 || defaults > 0) {
          throw new BadRequestException(
            'La cuenta tiene acreditaciones pendientes o métodos de pago activos asociados.',
          );
        }
      }
      const actualizada = await tx.cuentaFondos.update({
        where: { id },
        data: {
          tipo: payload.tipo,
          nombre: payload.nombre?.trim(),
          banco:
            payload.banco === undefined
              ? undefined
              : payload.banco.trim() || null,
          cbuAlias:
            payload.cbuAlias === undefined
              ? undefined
              : payload.cbuAlias.trim() || null,
          moneda: payload.moneda,
          permiteSaldoNegativo: payload.permiteSaldoNegativo,
          activo: payload.activo,
        },
      });
      await tx.cuentaFondosEvento.create({
        data: {
          tenantId: auth.tenantId,
          cuentaId: id,
          tipo:
            payload.activo === false
              ? 'desactivada'
              : payload.activo === true && !actual.activo
                ? 'activada'
                : 'editada',
          actorUserId: actor.userId,
          actorNombre: actor.nombre,
          detalleJson: { antes: actual, despues: actualizada },
        },
      });
      return { id: actualizada.id };
    });
  }

  async movimientos(
    auth: CurrentAuth,
    cuentaId: string,
    filtros: MovimientosFondosQueryDto = {},
  ) {
    const [cuenta, regional] = await Promise.all([
      this.prisma.cuentaFondos.findFirst({
        where: { id: cuentaId, tenantId: auth.tenantId },
        select: { id: true },
      }),
      regionalDelTenant(this.prisma, auth.tenantId),
    ]);
    if (!cuenta) throw new NotFoundException('No se encontró la cuenta.');
    const page = filtros.page ?? 1;
    const pageSize = filtros.pageSize ?? 25;
    const where: Prisma.MovimientoFondosWhereInput = {
      tenantId: auth.tenantId,
      cuentaId,
      ...(filtros.q
        ? {
            OR: [
              { concepto: { contains: filtros.q, mode: 'insensitive' } },
              { referencia: { contains: filtros.q, mode: 'insensitive' } },
              { actorNombre: { contains: filtros.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(filtros.origenTipo ? { origenTipo: filtros.origenTipo } : {}),
      ...(filtros.estadoConciliacion
        ? { estadoConciliacion: filtros.estadoConciliacion }
        : {}),
      ...(filtros.desde || filtros.hasta
        ? {
            fecha: {
              ...(filtros.desde
                ? {
                    gte: instanteDe(
                      filtros.desde,
                      '00:00',
                      regional.zonaHoraria,
                    ),
                  }
                : {}),
              ...(filtros.hasta
                ? {
                    lt: instanteDe(
                      sumarDiasAClave(filtros.hasta, 1),
                      '00:00',
                      regional.zonaHoraria,
                    ),
                  }
                : {}),
            },
          }
        : {}),
    };
    const [total, movimientos] = await Promise.all([
      this.prisma.movimientoFondos.count({ where }),
      this.prisma.movimientoFondos.findMany({
        where,
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { orden: { select: { id: true, numero: true } } },
      }),
    ]);
    return {
      items: movimientos.map((movimiento) => ({
        id: movimiento.id,
        fecha: movimiento.fecha.toISOString(),
        createdAt: movimiento.createdAt.toISOString(),
        tipo: movimiento.tipo,
        monto: Number(movimiento.monto),
        concepto: movimiento.concepto,
        origenTipo: movimiento.origenTipo,
        ordenId: movimiento.orden?.id ?? null,
        ordenNumero: movimiento.orden?.numero ?? null,
        saldoPosterior: Number(movimiento.saldoPosterior),
        estadoConciliacion: movimiento.estadoConciliacion,
        conciliadoEl: movimiento.conciliadoEl?.toISOString() ?? null,
        conciliadoPorNombre: movimiento.conciliadoPorNombre,
        referencia: movimiento.referencia,
        notas: movimiento.notas,
        actorNombre: movimiento.actorNombre,
        operacionId: movimiento.operacionId,
        tipoCambio: movimiento.tipoCambio
          ? Number(movimiento.tipoCambio)
          : null,
      })),
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async transferir(auth: CurrentAuth, payload: TransferenciaDto) {
    if (payload.desdeCuentaId === payload.haciaCuentaId) {
      throw new BadRequestException('Elegí dos cuentas distintas.');
    }
    if (payload.idempotencyKey) {
      const existente = await this.prisma.movimientoFondos.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: auth.tenantId,
            idempotencyKey: payload.idempotencyKey,
          },
        },
        select: { operacionId: true },
      });
      if (existente) return { ok: true, operacionId: existente.operacionId };
    }
    const actor = await resolverActorFondos(this.prisma, auth);
    const operacionId = randomUUID();
    try {
      await ejecutarTransaccionFondos(this.prisma, async (tx) => {
        const [desde, hacia] = await Promise.all([
          tx.cuentaFondos.findFirst({
            where: {
              id: payload.desdeCuentaId,
              tenantId: auth.tenantId,
              activo: true,
            },
          }),
          tx.cuentaFondos.findFirst({
            where: {
              id: payload.haciaCuentaId,
              tenantId: auth.tenantId,
              activo: true,
            },
          }),
        ]);
        if (!desde || !hacia) {
          throw new NotFoundException('No se encontró alguna cuenta activa.');
        }
        const cruzada = desde.moneda !== hacia.moneda;
        if (cruzada && !payload.montoDestino) {
          throw new BadRequestException(
            `Indicá cuánto llegó en ${hacia.moneda}; el origen está en ${desde.moneda}.`,
          );
        }
        const montoDestino = cruzada ? payload.montoDestino! : payload.monto;
        const tipoCambio = cruzada
          ? Math.round((montoDestino / payload.monto) * 10_000) / 10_000
          : null;
        const ahora = new Date();
        const salida = await registrarMovimientoFondos(tx, {
          tenantId: auth.tenantId,
          cuentaId: desde.id,
          fecha: ahora,
          tipo: 'salida',
          monto: payload.monto,
          concepto: `Transferencia a ${hacia.nombre}`,
          origenTipo: 'transferencia',
          actor,
          operacionId,
          idempotencyKey: payload.idempotencyKey,
          tipoCambio,
          referencia: payload.referencia,
          notas: payload.notas,
        });
        const entrada = await registrarMovimientoFondos(tx, {
          tenantId: auth.tenantId,
          cuentaId: hacia.id,
          fecha: ahora,
          tipo: 'entrada',
          monto: montoDestino,
          concepto: `Transferencia desde ${desde.nombre}`,
          origenTipo: 'transferencia',
          actor,
          operacionId,
          transferenciaParId: salida.id,
          tipoCambio,
          referencia: payload.referencia,
          notas: payload.notas,
        });
        await tx.movimientoFondos.update({
          where: { id: salida.id },
          data: { transferenciaParId: entrada.id },
        });
      });
    } catch (error) {
      if (
        payload.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existente = await this.prisma.movimientoFondos.findUniqueOrThrow({
          where: {
            tenantId_idempotencyKey: {
              tenantId: auth.tenantId,
              idempotencyKey: payload.idempotencyKey,
            },
          },
          select: { operacionId: true },
        });
        return { ok: true, operacionId: existente.operacionId };
      }
      throw error;
    }
    return { ok: true, operacionId };
  }

  async arqueo(auth: CurrentAuth, cuentaId: string, payload: ArqueoDto) {
    if (payload.idempotencyKey) {
      const existente = await this.prisma.movimientoFondos.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: auth.tenantId,
            idempotencyKey: payload.idempotencyKey,
          },
        },
      });
      if (existente) return { diferencia: 0, idempotente: true };
    }
    const actor = await resolverActorFondos(this.prisma, auth);
    return ejecutarTransaccionFondos(this.prisma, async (tx) => {
      const cuenta = await tx.cuentaFondos.findFirst({
        where: { id: cuentaId, tenantId: auth.tenantId, activo: true },
      });
      if (!cuenta) throw new NotFoundException('No se encontró la cuenta.');
      if (cuenta.tipo !== 'caja') {
        throw new BadRequestException('El arqueo aplica sólo a cajas.');
      }
      const diferencia = redondearFondos(
        payload.contado - Number(cuenta.saldo),
      );
      if (diferencia === 0) return { diferencia: 0 };
      await registrarMovimientoFondos(tx, {
        tenantId: auth.tenantId,
        cuentaId,
        fecha: new Date(),
        tipo: diferencia > 0 ? 'entrada' : 'salida',
        monto: Math.abs(diferencia),
        concepto: `Arqueo de caja · ${diferencia > 0 ? 'sobrante' : 'faltante'}`,
        origenTipo: 'ajuste_arqueo',
        actor,
        operacionId: randomUUID(),
        idempotencyKey: payload.idempotencyKey,
        notas: payload.notas,
        estadoConciliacion: 'diferencia',
      });
      return { diferencia };
    });
  }

  async ajustar(auth: CurrentAuth, cuentaId: string, payload: AjusteFondosDto) {
    if (payload.idempotencyKey) {
      const existente = await this.prisma.movimientoFondos.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: auth.tenantId,
            idempotencyKey: payload.idempotencyKey,
          },
        },
      });
      if (existente) return { ok: true, id: existente.id };
    }
    const actor = await resolverActorFondos(this.prisma, auth);
    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    try {
      return await ejecutarTransaccionFondos(this.prisma, async (tx) => {
        const movimiento = await registrarMovimientoFondos(tx, {
          tenantId: auth.tenantId,
          cuentaId,
          fecha: fechaNegocio(payload.fecha, regional.zonaHoraria),
          tipo: payload.tipo,
          monto: payload.monto,
          concepto: payload.concepto.trim(),
          origenTipo: 'ajuste_manual',
          actor,
          operacionId: randomUUID(),
          idempotencyKey: payload.idempotencyKey,
          referencia: payload.referencia,
          notas: payload.notas,
          estadoConciliacion: 'diferencia',
        });
        return { ok: true, id: movimiento.id };
      });
    } catch (error) {
      if (
        payload.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existente = await this.prisma.movimientoFondos.findUniqueOrThrow({
          where: {
            tenantId_idempotencyKey: {
              tenantId: auth.tenantId,
              idempotencyKey: payload.idempotencyKey,
            },
          },
        });
        return { ok: true, id: existente.id };
      }
      throw error;
    }
  }

  async conciliar(
    auth: CurrentAuth,
    cuentaId: string,
    movimientoId: string,
    payload: ConciliarMovimientoDto,
  ) {
    const actor = await resolverActorFondos(this.prisma, auth);
    const movimiento = await this.prisma.movimientoFondos.findFirst({
      where: { id: movimientoId, cuentaId, tenantId: auth.tenantId },
    });
    if (!movimiento)
      throw new NotFoundException('No se encontró el movimiento.');
    await this.prisma.movimientoFondos.update({
      where: { id: movimientoId },
      data: {
        estadoConciliacion: payload.estado,
        notas: payload.notas?.trim() || movimiento.notas,
        conciliadoEl: payload.estado === 'conciliado' ? new Date() : null,
        conciliadoPorId: payload.estado === 'conciliado' ? actor.userId : null,
        conciliadoPorNombre:
          payload.estado === 'conciliado' ? actor.nombre : null,
      },
    });
    return { ok: true };
  }

  async valores(auth: CurrentAuth) {
    const valores = await this.prisma.valor.findMany({
      where: { tenantId: auth.tenantId },
      include: {
        cliente: { select: { nombre: true } },
        proveedor: { select: { nombre: true } },
        cobro: {
          select: {
            id: true,
            numeroRecibo: true,
            disponibleReal: true,
            anuladoEl: true,
          },
        },
        cuentaDeposito: { select: { id: true, nombre: true } },
        pagos: {
          select: {
            id: true,
            numero: true,
            anuladoEl: true,
            cuentaOrigen: { select: { id: true, nombre: true } },
          },
          take: 1,
        },
        eventos: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
      orderBy: [{ fechaPago: 'asc' }, { createdAt: 'desc' }],
    });
    return valores.map((valor) => ({
      id: valor.id,
      origen: valor.origen,
      formato: valor.formato,
      modalidad: valor.modalidad,
      numero: valor.numero,
      banco: valor.banco,
      identificadorBancario: valor.identificadorBancario,
      importe: Number(valor.importe),
      moneda: valor.moneda,
      fechaEmision: valor.fechaEmision?.toISOString() ?? null,
      fechaPago: valor.fechaPago?.toISOString() ?? null,
      estado: valor.estado,
      motivoRechazo: valor.motivoRechazo,
      depositadoEl: valor.depositadoEl?.toISOString() ?? null,
      acreditadoEl: valor.acreditadoEl?.toISOString() ?? null,
      endosadoEl: valor.endosadoEl?.toISOString() ?? null,
      debitadoEl: valor.debitadoEl?.toISOString() ?? null,
      anuladoEl: valor.anuladoEl?.toISOString() ?? null,
      rechazadoEl: valor.rechazadoEl?.toISOString() ?? null,
      clienteNombre: valor.cliente?.nombre ?? null,
      proveedorNombre: valor.proveedor?.nombre ?? null,
      cobroId: valor.cobro?.id ?? null,
      numeroRecibo: valor.cobro?.numeroRecibo ?? null,
      cobroAnulado: Boolean(valor.cobro?.anuladoEl),
      cuentaDeposito: valor.cuentaDeposito,
      pagoId: valor.pagos[0]?.id ?? null,
      pagoNumero: valor.pagos[0]?.numero ?? null,
      pagoAnulado: Boolean(valor.pagos[0]?.anuladoEl),
      cuentaOrigen: valor.pagos[0]?.cuentaOrigen ?? null,
      eventos: valor.eventos.map((evento) => ({
        id: evento.id,
        tipo: evento.tipo,
        actorNombre: evento.actorNombre,
        detalle: evento.detalleJson,
        createdAt: evento.createdAt.toISOString(),
      })),
    }));
  }

  async depositarValor(
    auth: CurrentAuth,
    valorId: string,
    payload: DepositarValorDto,
  ) {
    const actor = await resolverActorFondos(this.prisma, auth);
    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    return ejecutarTransaccionFondos(this.prisma, async (tx) => {
      const [valor, cuenta] = await Promise.all([
        tx.valor.findFirst({
          where: { id: valorId, tenantId: auth.tenantId, origen: 'tercero' },
          include: { cobro: true },
        }),
        tx.cuentaFondos.findFirst({
          where: {
            id: payload.cuentaDestinoId,
            tenantId: auth.tenantId,
            activo: true,
          },
        }),
      ]);
      if (!valor) throw new NotFoundException('No se encontró el valor.');
      if (!cuenta)
        throw new NotFoundException('No se encontró la cuenta destino.');
      if (
        valor.estado === 'depositado' &&
        valor.cuentaDepositoId === cuenta.id
      ) {
        return { ok: true, idempotente: true };
      }
      if (valor.estado !== 'cartera') {
        throw new ConflictException(
          `El valor está ${valor.estado}; no puede depositarse.`,
        );
      }
      if (cuenta.tipo !== 'banco' && cuenta.tipo !== 'billetera') {
        throw new BadRequestException(
          'Un cheque sólo puede depositarse en una cuenta bancaria o billetera compatible.',
        );
      }
      if (cuenta.moneda !== valor.moneda) {
        throw new BadRequestException(
          `El valor está en ${valor.moneda} y la cuenta en ${cuenta.moneda}.`,
        );
      }
      const fecha = fechaNegocio(payload.fecha, regional.zonaHoraria);
      const actualizado = await tx.valor.updateMany({
        where: { id: valor.id, tenantId: auth.tenantId, estado: 'cartera' },
        data: {
          estado: 'depositado',
          cuentaDepositoId: cuenta.id,
          depositadoEl: fecha,
        },
      });
      if (actualizado.count === 0) {
        throw new ConflictException('El valor fue operado por otro usuario.');
      }
      if (valor.cobroId) {
        await tx.cobro.update({
          where: { id: valor.cobroId },
          data: { cuentaDestinoId: cuenta.id },
        });
      }
      await tx.valorEvento.create({
        data: {
          tenantId: auth.tenantId,
          valorId: valor.id,
          tipo: 'depositado',
          actorUserId: actor.userId,
          actorNombre: actor.nombre,
          detalleJson: {
            cuentaId: cuenta.id,
            cuentaNombre: cuenta.nombre,
            fecha: fecha.toISOString(),
            notas: payload.notas?.trim() || null,
          },
        },
      });
      return { ok: true };
    });
  }

  async acreditarValor(
    auth: CurrentAuth,
    valorId: string,
    payload: AcreditarValorDto,
  ) {
    if (payload.idempotencyKey) {
      const existente = await this.prisma.movimientoFondos.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: auth.tenantId,
            idempotencyKey: payload.idempotencyKey,
          },
        },
      });
      if (existente) return { ok: true, idempotente: true };
    }
    const actor = await resolverActorFondos(this.prisma, auth);
    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    return ejecutarTransaccionFondos(this.prisma, async (tx) => {
      const valor = await tx.valor.findFirst({
        where: { id: valorId, tenantId: auth.tenantId, origen: 'tercero' },
        include: {
          cobro: { include: { orden: { select: { id: true, numero: true } } } },
          cuentaDeposito: true,
        },
      });
      if (!valor) throw new NotFoundException('No se encontró el valor.');
      if (valor.estado === 'acreditado') {
        return { ok: true, idempotente: true };
      }
      if (valor.estado !== 'depositado') {
        throw new ConflictException(
          `El valor está ${valor.estado}; primero debe estar depositado.`,
        );
      }
      if (!valor.cuentaDeposito || !valor.cobro || valor.cobro.anuladoEl) {
        throw new BadRequestException(
          'El valor no tiene un cobro vigente y una cuenta de depósito.',
        );
      }
      const fecha = payload.fecha
        ? fechaNegocio(payload.fecha, regional.zonaHoraria)
        : new Date();
      const actualizado = await tx.valor.updateMany({
        where: { id: valor.id, tenantId: auth.tenantId, estado: 'depositado' },
        data: { estado: 'acreditado', acreditadoEl: fecha },
      });
      if (actualizado.count === 0) {
        throw new ConflictException('El valor fue operado por otro usuario.');
      }
      await tx.cobro.updateMany({
        where: {
          id: valor.cobro.id,
          tenantId: auth.tenantId,
          anuladoEl: null,
          estadoAcreditacion: 'pendiente',
        },
        data: { estadoAcreditacion: 'acreditado' },
      });
      await registrarMovimientoFondos(tx, {
        tenantId: auth.tenantId,
        cuentaId: valor.cuentaDeposito.id,
        fecha,
        tipo: 'entrada',
        monto: Number(valor.cobro.disponibleReal),
        concepto: valor.cobro.orden?.numero
          ? `Acreditación cheque · ${valor.cobro.orden.numero}`
          : `Acreditación cheque ${valor.numero}`,
        origenTipo: 'valor',
        actor,
        cobroId: valor.cobro.id,
        valorId: valor.id,
        ordenId: valor.cobro.orden?.id ?? null,
        operacionId: randomUUID(),
        idempotencyKey: payload.idempotencyKey,
        referencia: payload.referencia,
        notas: payload.notas,
      });
      await tx.valorEvento.create({
        data: {
          tenantId: auth.tenantId,
          valorId: valor.id,
          tipo: 'acreditado',
          actorUserId: actor.userId,
          actorNombre: actor.nombre,
          detalleJson: {
            cuentaId: valor.cuentaDeposito.id,
            fecha: fecha.toISOString(),
            importe: Number(valor.cobro.disponibleReal),
          },
        },
      });
      return { ok: true };
    });
  }

  /**
   * Corrige un depósito cargado por error. No lo marca rechazado: el valor
   * vuelve a cartera y la auditoría conserva qué se deshizo y por qué.
   */
  async revertirDepositoValor(
    auth: CurrentAuth,
    valorId: string,
    payload: RevertirOperacionValorDto,
  ) {
    const actor = await resolverActorFondos(this.prisma, auth);
    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    return ejecutarTransaccionFondos(this.prisma, async (tx) => {
      const valor = await tx.valor.findFirst({
        where: { id: valorId, tenantId: auth.tenantId, origen: 'tercero' },
        include: { cuentaDeposito: true },
      });
      if (!valor) throw new NotFoundException('No se encontró el valor.');
      if (valor.estado !== 'depositado') {
        throw new ConflictException(
          `El valor está ${valor.estado}; sólo se puede deshacer un depósito pendiente de acreditar.`,
        );
      }
      const fecha = payload.fecha
        ? fechaNegocio(payload.fecha, regional.zonaHoraria)
        : new Date();
      const actualizado = await tx.valor.updateMany({
        where: {
          id: valor.id,
          tenantId: auth.tenantId,
          estado: 'depositado',
        },
        data: {
          estado: 'cartera',
          cuentaDepositoId: null,
          depositadoEl: null,
        },
      });
      if (actualizado.count === 0) {
        throw new ConflictException('El valor fue operado por otro usuario.');
      }
      if (valor.cobroId) {
        await tx.cobro.updateMany({
          where: { id: valor.cobroId, tenantId: auth.tenantId },
          data: { cuentaDestinoId: null },
        });
      }
      await tx.valorEvento.create({
        data: {
          tenantId: auth.tenantId,
          valorId: valor.id,
          tipo: 'deposito_revertido',
          actorUserId: actor.userId,
          actorNombre: actor.nombre,
          detalleJson: {
            fecha: fecha.toISOString(),
            motivo: payload.motivo.trim(),
            cuentaId: valor.cuentaDepositoId,
            cuentaNombre: valor.cuentaDeposito?.nombre ?? null,
          },
        },
      });
      return { ok: true };
    });
  }

  /** Deshace una acreditación errónea con un contramovimiento auditable. */
  async revertirAcreditacionValor(
    auth: CurrentAuth,
    valorId: string,
    payload: RevertirOperacionValorDto,
  ) {
    if (payload.idempotencyKey) {
      const existente = await this.prisma.movimientoFondos.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: auth.tenantId,
            idempotencyKey: payload.idempotencyKey,
          },
        },
      });
      if (existente) return { ok: true, idempotente: true };
    }
    const actor = await resolverActorFondos(this.prisma, auth);
    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    return ejecutarTransaccionFondos(this.prisma, async (tx) => {
      const valor = await tx.valor.findFirst({
        where: { id: valorId, tenantId: auth.tenantId, origen: 'tercero' },
        include: {
          cobro: true,
          cuentaDeposito: true,
          movimientos: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!valor) throw new NotFoundException('No se encontró el valor.');
      if (valor.estado !== 'acreditado') {
        throw new ConflictException(
          `El valor está ${valor.estado}; sólo se puede deshacer una acreditación confirmada.`,
        );
      }
      if (!valor.cuentaDeposito || !valor.cobro) {
        throw new BadRequestException(
          'No se puede identificar el ingreso que debe revertirse.',
        );
      }
      const fecha = payload.fecha
        ? fechaNegocio(payload.fecha, regional.zonaHoraria)
        : new Date();
      const actualizado = await tx.valor.updateMany({
        where: {
          id: valor.id,
          tenantId: auth.tenantId,
          estado: 'acreditado',
        },
        data: { estado: 'depositado', acreditadoEl: null },
      });
      if (actualizado.count === 0) {
        throw new ConflictException('El valor fue operado por otro usuario.');
      }
      await tx.cobro.updateMany({
        where: {
          id: valor.cobro.id,
          tenantId: auth.tenantId,
          anuladoEl: null,
        },
        data: { estadoAcreditacion: 'pendiente' },
      });
      const ingreso = valor.movimientos.find(
        (movimiento) => movimiento.tipo === 'entrada',
      );
      await registrarMovimientoFondos(tx, {
        tenantId: auth.tenantId,
        cuentaId: valor.cuentaDeposito.id,
        fecha,
        tipo: 'salida',
        monto: Number(valor.cobro.disponibleReal),
        concepto: `Corrección acreditación cheque ${valor.numero}: ${payload.motivo.trim()}`,
        origenTipo: 'valor',
        actor,
        cobroId: valor.cobro.id,
        valorId: valor.id,
        operacionId: randomUUID(),
        idempotencyKey: payload.idempotencyKey,
        reversionDeId: ingreso?.id ?? null,
        notas: payload.motivo.trim(),
        estadoConciliacion: 'diferencia',
      });
      await tx.valorEvento.create({
        data: {
          tenantId: auth.tenantId,
          valorId: valor.id,
          tipo: 'acreditacion_revertida',
          actorUserId: actor.userId,
          actorNombre: actor.nombre,
          detalleJson: {
            fecha: fecha.toISOString(),
            motivo: payload.motivo.trim(),
            cuentaId: valor.cuentaDeposito.id,
          },
        },
      });
      return { ok: true };
    });
  }

  async rechazarValor(
    auth: CurrentAuth,
    valorId: string,
    payload: RechazarValorDto,
  ) {
    const actor = await resolverActorFondos(this.prisma, auth);
    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    return ejecutarTransaccionFondos(this.prisma, async (tx) => {
      const valor = await tx.valor.findFirst({
        where: { id: valorId, tenantId: auth.tenantId, origen: 'tercero' },
        include: { cobro: true, cuentaDeposito: true, movimientos: true },
      });
      if (!valor) throw new NotFoundException('No se encontró el valor.');
      if (valor.estado === 'rechazado') {
        return { ok: true, idempotente: true };
      }
      if (!['cartera', 'depositado', 'acreditado'].includes(valor.estado)) {
        throw new ConflictException(
          `El valor está ${valor.estado}; no puede rechazarse.`,
        );
      }
      const fecha = payload.fecha
        ? fechaNegocio(payload.fecha, regional.zonaHoraria)
        : new Date();
      if (valor.estado === 'acreditado') {
        if (!valor.cuentaDeposito || !valor.cobro) {
          throw new BadRequestException(
            'No se puede identificar el ingreso a revertir.',
          );
        }
        const original = valor.movimientos.find(
          (movimiento) => movimiento.tipo === 'entrada',
        );
        await registrarMovimientoFondos(tx, {
          tenantId: auth.tenantId,
          cuentaId: valor.cuentaDeposito.id,
          fecha,
          tipo: 'salida',
          monto: Number(valor.cobro.disponibleReal),
          concepto: `Cheque rechazado ${valor.numero}: ${payload.motivo.trim()}`,
          origenTipo: 'valor',
          actor,
          cobroId: valor.cobro.id,
          valorId: valor.id,
          operacionId: randomUUID(),
          idempotencyKey: payload.idempotencyKey,
          reversionDeId: original?.id ?? null,
          estadoConciliacion: 'diferencia',
        });
      }
      await tx.valor.update({
        where: { id: valor.id },
        data: {
          estado: 'rechazado',
          rechazadoEl: fecha,
          motivoRechazo: payload.motivo.trim(),
        },
      });
      if (valor.cobroId) {
        await tx.cobro.updateMany({
          where: { id: valor.cobroId, tenantId: auth.tenantId },
          data: { estadoAcreditacion: 'rechazado' },
        });
      }
      await tx.valorEvento.create({
        data: {
          tenantId: auth.tenantId,
          valorId: valor.id,
          tipo: 'rechazado',
          actorUserId: actor.userId,
          actorNombre: actor.nombre,
          detalleJson: {
            fecha: fecha.toISOString(),
            motivo: payload.motivo.trim(),
            revirtioFondos: valor.estado === 'acreditado',
          },
        },
      });
      return { ok: true };
    });
  }
}
