import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import type { AnularCobroDto, CrearCobroDto } from './dto/cobro.dto';
import { FacturacionOrdenesService } from './facturacion-ordenes.service';
import { RecibosService } from './recibos.service';
import { NotificacionesCobrosService } from '../integraciones/notificaciones/notificaciones-cobros.service';
import { formatearMoneda } from '../common/moneda';
import { regionalDelTenant } from '../common/regional';
import {
  ejecutarTransaccionFondos,
  fechaNegocio,
  registrarMovimientoFondos,
  resolverActorFondos,
  sumarDiasHabiles,
  type ActorFondos,
} from './fondos-ledger';
import {
  bancoValorNormalizado,
  claveInstrumentoValor,
  numeroValorNormalizado,
} from './valor-identidad';

/**
 * Cobros — el registro de cómo entra la plata, con las tres cifras:
 * bruto (facturado/cobrado) → neto acreditado (menos comisión + IVA
 * s/comisión) → disponible real (menos retenciones).
 * Ver docs/modulo-administracion-diseno.md §6.
 */
@Injectable()
export class CobrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly facturacionOrdenes: FacturacionOrdenesService,
    private readonly recibos: RecibosService,
    private readonly avisos: NotificacionesCobrosService,
  ) {}

  /** Cálculo canónico de las tres cifras. */
  calcularCifras(input: {
    montoBruto: number;
    comisionPctAplicada: number;
    ivaComisionPct: number;
    retencionesTotal: number;
  }) {
    const comisionMonto = (input.montoBruto * input.comisionPctAplicada) / 100;
    const comisionIvaMonto = (comisionMonto * input.ivaComisionPct) / 100;
    const netoAcreditado = input.montoBruto - comisionMonto - comisionIvaMonto;
    const disponibleReal = netoAcreditado - input.retencionesTotal;
    const r = (n: number) => Math.round(n * 100) / 100;
    return {
      comisionMonto: r(comisionMonto),
      comisionIvaMonto: r(comisionIvaMonto),
      netoAcreditado: r(netoAcreditado),
      disponibleReal: r(disponibleReal),
    };
  }

  async findAll(auth: CurrentAuth, filtros?: { ordenId?: string }) {
    const cobros = await this.prisma.cobro.findMany({
      where: {
        tenantId: auth.tenantId,
        anuladoEl: null,
        ...(filtros?.ordenId ? { ordenId: filtros.ordenId } : {}),
      },
      include: {
        metodoPago: { select: { nombre: true, tipo: true } },
        cuentaDestino: { select: { nombre: true } },
        cliente: { select: { nombre: true } },
        retenciones: true,
        valores: { select: { id: true, estado: true, numero: true } },
      },
      orderBy: { fecha: 'desc' },
      take: 200,
    });
    return cobros.map((cobro) => this.toResponse(cobro));
  }

  async create(auth: CurrentAuth, payload: CrearCobroDto) {
    if (payload.idempotencyKey) {
      const existente = await this.prisma.cobro.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: auth.tenantId,
            idempotencyKey: payload.idempotencyKey,
          },
        },
        select: { id: true },
      });
      if (existente) return this.findOne(auth, existente.id);
    }
    const [metodo, cuenta, orden, cliente] = await Promise.all([
      this.prisma.metodoPago.findFirst({
        where: {
          id: payload.metodoPagoId,
          tenantId: auth.tenantId,
          activo: true,
        },
      }),
      payload.cuentaDestinoId
        ? this.prisma.cuentaFondos.findFirst({
            where: {
              id: payload.cuentaDestinoId,
              tenantId: auth.tenantId,
              activo: true,
              tipo: { notIn: ['cartera_valores', 'cartera_valores_legacy'] },
            },
          })
        : Promise.resolve(null),
      payload.ordenId
        ? this.prisma.ordenTrabajo.findFirst({
            where: { id: payload.ordenId, tenantId: auth.tenantId },
            select: {
              id: true,
              numero: true,
              clienteId: true,
              estado: true,
            },
          })
        : null,
      payload.clienteId
        ? this.prisma.cliente.findFirst({
            where: { id: payload.clienteId, tenantId: auth.tenantId },
            select: { id: true },
          })
        : null,
    ]);
    if (!metodo)
      throw new NotFoundException('No se encontró el método de pago.');
    if (payload.ordenId && !orden) {
      throw new NotFoundException('No se encontró la orden.');
    }
    if (payload.clienteId && !cliente) {
      throw new NotFoundException('No se encontró el cliente.');
    }
    if (
      orden?.clienteId &&
      payload.clienteId &&
      orden.clienteId !== payload.clienteId
    ) {
      throw new BadRequestException(
        'La orden y el cobro pertenecen a clientes distintos.',
      );
    }
    if (orden && orden.estado === 'borrador') {
      throw new BadRequestException(
        'No se pueden registrar cobros sobre un borrador: emití la orden primero.',
      );
    }
    // Cobrar contra algo que ya se dio de baja deja plata imputada a una venta
    // que no existe. Si el cliente igual pagó, va como cobro sin orden y queda
    // a cuenta.
    if (orden && orden.estado === 'cancelada') {
      throw new BadRequestException(
        'La orden está cancelada: no se le pueden registrar cobros.',
      );
    }

    const esCheque = metodo.tipo === 'cheque_echeq';
    if (!esCheque && !payload.cuentaDestinoId) {
      throw new BadRequestException(
        'Elegí una cuenta destino para registrar el cobro.',
      );
    }
    if (!esCheque && !cuenta) {
      throw new NotFoundException('No se encontró una cuenta destino activa.');
    }
    if (esCheque && !payload.valor) {
      throw new BadRequestException(
        'Los cobros con cheque/echeq requieren los datos del valor.',
      );
    }
    if (!esCheque && payload.valor) {
      throw new BadRequestException(
        'Sólo los métodos de tipo cheque/echeq llevan datos de valor.',
      );
    }
    if (payload.valor?.origen && payload.valor.origen !== 'tercero') {
      throw new BadRequestException(
        'Un cheque recibido en un cobro siempre es un valor de tercero.',
      );
    }
    const modalidadValor = payload.valor
      ? (payload.valor.modalidad ??
        (payload.valor.fechaPago ? 'diferido' : 'comun'))
      : null;
    if (modalidadValor === 'diferido' && !payload.valor?.fechaPago) {
      throw new BadRequestException(
        'Un cheque diferido requiere su fecha de pago.',
      );
    }
    if (modalidadValor === 'comun' && payload.valor?.fechaPago) {
      throw new BadRequestException(
        'Un cheque común no lleva fecha de pago diferida.',
      );
    }

    const retenciones = payload.retenciones ?? [];
    const retencionesTotal = retenciones.reduce((s, r) => s + r.monto, 0);
    const cifras = this.calcularCifras({
      montoBruto: payload.montoBruto,
      comisionPctAplicada: payload.comisionPctAplicada,
      ivaComisionPct: Number(metodo.ivaComisionPct),
      retencionesTotal,
    });
    if (cifras.disponibleReal <= 0) {
      throw new BadRequestException(
        'Las comisiones y retenciones no pueden consumir todo el cobro ni dejarlo negativo.',
      );
    }

    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    const fecha = fechaNegocio(payload.fecha, regional.zonaHoraria);
    if (payload.valor?.fechaEmision && payload.valor.fechaPago) {
      const emision = fechaNegocio(
        payload.valor.fechaEmision,
        regional.zonaHoraria,
      );
      const pago = fechaNegocio(payload.valor.fechaPago, regional.zonaHoraria);
      if (pago < emision) {
        throw new BadRequestException(
          'La fecha de pago del cheque no puede ser anterior a su emisión.',
        );
      }
    }
    const acreditaInmediato = !esCheque && metodo.plazoAcreditacionDias === 0;
    const fechaAcreditacionEstimada = esCheque
      ? payload.valor?.fechaPago
        ? fechaNegocio(payload.valor.fechaPago, regional.zonaHoraria)
        : null
      : sumarDiasHabiles(
          fecha,
          metodo.plazoAcreditacionDias,
          regional.zonaHoraria,
        );
    const periodoFiscal = payload.fecha.slice(0, 7);
    const clienteId = payload.clienteId ?? orden?.clienteId ?? null;

    const { moneda } = regional;
    if (!esCheque && cuenta && cuenta.moneda !== moneda.codigo) {
      throw new BadRequestException(
        `El cobro está en ${moneda.codigo} y la cuenta seleccionada en ${cuenta.moneda}. Elegí una cuenta en ${moneda.codigo}.`,
      );
    }
    const actor = await resolverActorFondos(this.prisma, auth);
    const usuarioNombre = actor.nombre;
    const claveValor = payload.valor
      ? claveInstrumentoValor(
          payload.valor.origen,
          payload.valor.banco,
          payload.valor.numero,
        )
      : null;

    if (claveValor) {
      const duplicado = await this.prisma.valor.findFirst({
        where: { tenantId: auth.tenantId, claveInstrumento: claveValor },
        select: { numero: true, banco: true },
      });
      if (duplicado) {
        throw new ConflictException(
          `El cheque/eCheq ${duplicado.numero} de ${duplicado.banco} ya está registrado.`,
        );
      }
    }

    let cobroId: string;
    try {
      cobroId = await ejecutarTransaccionFondos(this.prisma, async (tx) => {
        // El número de recibo se asigna acá y no después: un cobro registrado
        // sin comprobante sería un cobro sin respaldo para el cliente.
        const numeroRecibo = await this.recibos.numerar(
          tx,
          auth.tenantId,
          fecha,
        );
        const cobro = await tx.cobro.create({
          data: {
            tenantId: auth.tenantId,
            clienteId,
            ordenId: orden?.id ?? null,
            fecha,
            numeroRecibo,
            referencia: payload.referencia ?? null,
            registradoPorNombre: usuarioNombre,
            idempotencyKey: payload.idempotencyKey ?? null,
            metodoPagoId: metodo.id,
            cuentaDestinoId: esCheque ? null : cuenta!.id,
            // La del negocio: el campo existía con default 'ARS' y nadie lo
            // escribía, así que un tenant CLP registraba cobros "en pesos".
            moneda: moneda.codigo,
            montoBruto: payload.montoBruto,
            comisionPctAplicada: payload.comisionPctAplicada,
            comisionMonto: cifras.comisionMonto,
            comisionIvaMonto: cifras.comisionIvaMonto,
            netoAcreditado: cifras.netoAcreditado,
            retencionesTotal,
            disponibleReal: cifras.disponibleReal,
            fechaAcreditacionEstimada,
            estadoAcreditacion: acreditaInmediato ? 'acreditado' : 'pendiente',
            notas: payload.notas ?? null,
            retenciones: {
              create: retenciones.map((r) => ({
                tenantId: auth.tenantId,
                direccion: 'sufrida',
                regimen: r.regimen,
                jurisdiccion: r.jurisdiccion ?? null,
                base: r.base,
                alicuota: r.alicuota,
                monto: r.monto,
                nroComprobante: r.nroComprobante ?? null,
                periodoFiscal,
              })),
            },
          },
        });

        if (esCheque && payload.valor) {
          const valor = await tx.valor.create({
            data: {
              tenantId: auth.tenantId,
              origen: payload.valor.origen,
              formato: payload.valor.formato,
              modalidad: modalidadValor!,
              numero: numeroValorNormalizado(payload.valor.numero),
              banco: bancoValorNormalizado(payload.valor.banco),
              claveInstrumento: claveValor!,
              identificadorBancario:
                payload.valor.identificadorBancario?.trim() || null,
              moneda: moneda.codigo,
              // El bruto salda comercialmente la factura; el valor físico es lo
              // que realmente entregó el cliente después de retenciones.
              importe: cifras.disponibleReal,
              fechaEmision: payload.valor.fechaEmision
                ? fechaNegocio(payload.valor.fechaEmision, regional.zonaHoraria)
                : null,
              fechaPago: payload.valor.fechaPago
                ? fechaNegocio(payload.valor.fechaPago, regional.zonaHoraria)
                : null,
              estado: 'cartera',
              clienteId,
              cobroId: cobro.id,
            },
          });
          await tx.valorEvento.create({
            data: {
              tenantId: auth.tenantId,
              valorId: valor.id,
              tipo: 'recibido',
              actorUserId: actor.userId,
              actorNombre: actor.nombre,
              detalleJson: {
                cobroId: cobro.id,
                numeroRecibo,
                clienteId,
                fecha: fecha.toISOString(),
              },
            },
          });
        }

        // El movimiento de fondos (y el saldo) sólo cuando la plata ENTRA:
        // medios inmediatos ya; con plazo o cheque, al acreditar.
        if (acreditaInmediato) {
          await registrarMovimientoFondos(tx, {
            tenantId: auth.tenantId,
            cuentaId: cuenta!.id,
            fecha,
            tipo: 'entrada',
            monto: cifras.disponibleReal,
            concepto: orden ? `Cobro ${orden.numero}` : 'Cobro registrado',
            origenTipo: 'cobro',
            actor,
            cobroId: cobro.id,
            ordenId: orden?.id ?? null,
            operacionId: randomUUID(),
            referencia: payload.referencia,
            notas: payload.notas,
          });
        }

        // Eje comercial: un cobro desde cuenta corriente puede cancelar varias
        // órdenes FIFO. El eje fiscal se matchea aparte contra facturas.
        const aplicaciones =
          await this.facturacionOrdenes.aplicarCobroComercial(
            tx,
            auth.tenantId,
            cobro.id,
          );
        await this.facturacionOrdenes.matchearCobro(
          tx,
          auth.tenantId,
          cobro.id,
        );

        if (orden) {
          await tx.ordenTrabajoEvento.create({
            data: {
              tenantId: auth.tenantId,
              ordenId: orden.id,
              tipo: 'nota',
              descripcion: `Cobro registrado: ${formatearMoneda(payload.montoBruto, moneda, { decimales: 0 })} · ${metodo.nombre}${esCheque ? ' (valor en cartera)' : ''}`,
              usuarioNombre,
              usuarioId: auth.userId,
              origen: 'usuario',
              datosJson: {
                cobroId: cobro.id,
                montoBruto: payload.montoBruto,
                netoAcreditado: cifras.netoAcreditado,
                disponibleReal: cifras.disponibleReal,
                metodo: metodo.nombre,
              },
            },
          });
        } else {
          for (const aplicacion of aplicaciones) {
            await tx.ordenTrabajoEvento.create({
              data: {
                tenantId: auth.tenantId,
                ordenId: aplicacion.ordenId,
                tipo: 'nota',
                descripcion: `Cobro de cuenta corriente aplicado: ${formatearMoneda(aplicacion.monto, moneda, { decimales: 0 })} · ${metodo.nombre}`,
                usuarioNombre,
                usuarioId: auth.userId,
                origen: 'usuario',
                datosJson: {
                  cobroId: cobro.id,
                  montoAplicado: aplicacion.monto,
                  metodo: metodo.nombre,
                },
              },
            });
          }
        }

        // El link del recibo nace con el cobro: el aviso de WhatsApp sale
        // enseguida y sin link no hay nada que mostrarle al cliente.
        await this.recibos.emitirEnlace(tx, auth.tenantId, cobro.id);

        return cobro.id;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        JSON.stringify(error.meta?.target).includes('claveInstrumento')
      ) {
        throw new ConflictException(
          'Ese cheque/eCheq ya fue registrado. Revisá el número y el banco.',
        );
      }
      if (
        payload.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existente = await this.prisma.cobro.findUniqueOrThrow({
          where: {
            tenantId_idempotencyKey: {
              tenantId: auth.tenantId,
              idempotencyKey: payload.idempotencyKey,
            },
          },
          select: { id: true },
        });
        return this.findOne(auth, existente.id);
      }
      throw error;
    }

    // Post-commit y sin `await`: ni el PDF ni Wati pueden voltear un cobro ya
    // registrado. El PDF se puede rehacer desde el endpoint si falla.
    this.recibos.materializarPdfEnSegundoPlano(cobroId);
    void this.avisos.avisar(cobroId);

    return this.findOne(auth, cobroId);
  }

  /** Acreditación manual de un cobro electrónico pendiente. */
  async acreditar(auth: CurrentAuth, id: string) {
    const cobro = await this.prisma.cobro.findFirst({
      where: { id, tenantId: auth.tenantId, anuladoEl: null },
      include: {
        metodoPago: { select: { tipo: true, nombre: true } },
        orden: { select: { id: true, numero: true } },
      },
    });
    if (!cobro) throw new NotFoundException('No se encontró el cobro.');
    if (cobro.estadoAcreditacion === 'acreditado') {
      return this.findOne(auth, cobro.id);
    }
    if (cobro.metodoPago.tipo === 'cheque_echeq') {
      throw new BadRequestException(
        'Los cheques se acreditan desde la cartera de valores.',
      );
    }
    if (!cobro.cuentaDestinoId) {
      throw new BadRequestException(
        'El cobro no tiene una cuenta destino. Asignala antes de acreditarlo.',
      );
    }
    const actor = await resolverActorFondos(this.prisma, auth);
    await this.acreditarUno({
      id: cobro.id,
      tenantId: auth.tenantId,
      cuentaDestinoId: cobro.cuentaDestinoId,
      disponibleReal: Number(cobro.disponibleReal),
      ordenId: cobro.orden?.id ?? null,
      ordenNumero: cobro.orden?.numero ?? null,
      actor,
    });
    return this.findOne(auth, cobro.id);
  }

  /** Los cobros electrónicos que todavía no acreditaron, con su fecha. */
  async pendientesAcreditacion(auth: CurrentAuth) {
    await this.barrerVencidos(auth.tenantId);
    const cobros = await this.prisma.cobro.findMany({
      where: {
        tenantId: auth.tenantId,
        anuladoEl: null,
        estadoAcreditacion: 'pendiente',
      },
      include: {
        metodoPago: { select: { nombre: true, tipo: true } },
        cuentaDestino: { select: { nombre: true } },
        cliente: { select: { nombre: true } },
        orden: { select: { id: true, numero: true } },
        valores: { select: { estado: true, numero: true } },
      },
      orderBy: [{ fechaAcreditacionEstimada: 'asc' }, { fecha: 'asc' }],
    });
    return cobros.map((cobro) => ({
      id: cobro.id,
      fecha: cobro.fecha.toISOString(),
      fechaAcreditacionEstimada:
        cobro.fechaAcreditacionEstimada?.toISOString() ?? null,
      metodoNombre: cobro.metodoPago.nombre,
      metodoTipo: cobro.metodoPago.tipo,
      cuentaDestinoNombre: cobro.cuentaDestino?.nombre ?? null,
      clienteNombre: cobro.cliente?.nombre ?? null,
      ordenId: cobro.orden?.id ?? null,
      ordenNumero: cobro.orden?.numero ?? null,
      montoBruto: Number(cobro.montoBruto),
      netoAcreditado: Number(cobro.netoAcreditado),
      disponibleReal: Number(cobro.disponibleReal),
      moneda: cobro.moneda,
      // Los cheques no se acreditan desde acá: van por la cartera de valores.
      esCheque: cobro.metodoPago.tipo === 'cheque_echeq',
      valorEstado: cobro.valores[0]?.estado ?? null,
      valorNumero: cobro.valores[0]?.numero ?? null,
    }));
  }

  /**
   * Acredita los cobros electrónicos cuya fecha estimada ya pasó.
   * Idempotente y seguro ante concurrencia (el UPDATE condicional decide
   * quién gana), así que lo pueden llamar a la vez el cron y una lectura
   * de Tesorería. Los cheques quedan afuera: acreditan vía su Valor.
   * @param tenantId acota a un tenant; sin él barre todos (cron nocturno).
   */
  async barrerVencidos(tenantId?: string) {
    const vencidos = await this.prisma.cobro.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        anuladoEl: null,
        estadoAcreditacion: 'pendiente',
        fechaAcreditacionEstimada: { not: null, lte: new Date() },
        cuentaDestinoId: { not: null },
        metodoPago: { tipo: { not: 'cheque_echeq' } },
      },
      select: {
        id: true,
        tenantId: true,
        cuentaDestinoId: true,
        disponibleReal: true,
        fechaAcreditacionEstimada: true,
        orden: { select: { id: true, numero: true } },
      },
      take: 500,
    });

    let acreditados = 0;
    for (const cobro of vencidos) {
      if (!cobro.cuentaDestinoId) continue;
      const ok = await this.acreditarUno({
        id: cobro.id,
        tenantId: cobro.tenantId,
        cuentaDestinoId: cobro.cuentaDestinoId,
        disponibleReal: Number(cobro.disponibleReal),
        ordenId: cobro.orden?.id ?? null,
        ordenNumero: cobro.orden?.numero ?? null,
        // El movimiento lleva la fecha en que la plata realmente entró,
        // no la del barrido: si el job corrió tarde, el saldo corrido
        // igual queda ordenado.
        fecha: cobro.fechaAcreditacionEstimada ?? undefined,
        actor: { userId: null, nombre: 'Sistema' },
      });
      if (ok) acreditados += 1;
    }
    return acreditados;
  }

  /**
   * Transición pendiente → acreditado + movimiento de entrada, en una sola
   * transacción. Devuelve false si otro proceso la hizo primero.
   */
  private async acreditarUno(cobro: {
    id: string;
    tenantId: string;
    cuentaDestinoId: string;
    disponibleReal: number;
    ordenId: string | null;
    ordenNumero: string | null;
    fecha?: Date;
    actor: ActorFondos;
  }) {
    return ejecutarTransaccionFondos(this.prisma, async (tx) => {
      const { count } = await tx.cobro.updateMany({
        where: {
          id: cobro.id,
          tenantId: cobro.tenantId,
          anuladoEl: null,
          estadoAcreditacion: 'pendiente',
        },
        data: { estadoAcreditacion: 'acreditado' },
      });
      if (count === 0) return false;
      await registrarMovimientoFondos(tx, {
        tenantId: cobro.tenantId,
        cuentaId: cobro.cuentaDestinoId,
        fecha: cobro.fecha ?? new Date(),
        tipo: 'entrada',
        monto: cobro.disponibleReal,
        concepto: cobro.ordenNumero
          ? `Acreditación cobro ${cobro.ordenNumero}`
          : 'Acreditación de cobro',
        origenTipo: 'cobro',
        actor: cobro.actor,
        cobroId: cobro.id,
        ordenId: cobro.ordenId,
        operacionId: randomUUID(),
      });
      return true;
    });
  }

  /**
   * Anula sin borrar: revierte el dinero efectivamente ingresado, libera las
   * imputaciones y deja actor/motivo congelados para auditoría.
   */
  async anular(auth: CurrentAuth, id: string, payload: AnularCobroDto) {
    const actor = await resolverActorFondos(this.prisma, auth);
    return ejecutarTransaccionFondos(this.prisma, async (tx) => {
      const cobro = await tx.cobro.findFirst({
        where: { id, tenantId: auth.tenantId },
        include: {
          movimientos: { orderBy: { createdAt: 'asc' } },
          valores: true,
          orden: { select: { id: true, numero: true } },
        },
      });
      if (!cobro) throw new NotFoundException('No se encontró el cobro.');
      if (cobro.anuladoEl) {
        return { ok: true, idempotente: true };
      }
      const valor = cobro.valores[0];
      if (valor?.estado === 'endosado') {
        throw new ConflictException(
          'El cheque fue endosado a un proveedor. Primero anulá ese pago para devolverlo a cartera.',
        );
      }

      const ingreso = cobro.movimientos.find(
        (movimiento) => movimiento.tipo === 'entrada',
      );
      const yaRevertido = ingreso
        ? cobro.movimientos.some(
            (movimiento) => movimiento.reversionDeId === ingreso.id,
          )
        : false;
      if (ingreso && !yaRevertido) {
        await registrarMovimientoFondos(tx, {
          tenantId: auth.tenantId,
          cuentaId: ingreso.cuentaId,
          fecha: new Date(),
          tipo: 'salida',
          monto: Number(ingreso.monto),
          concepto: `Anulación de cobro${cobro.numeroRecibo ? ` ${cobro.numeroRecibo}` : ''}`,
          origenTipo: 'cobro',
          actor,
          cobroId: cobro.id,
          ordenId: cobro.orden?.id ?? null,
          operacionId: randomUUID(),
          idempotencyKey: payload.idempotencyKey,
          reversionDeId: ingreso.id,
          notas: payload.motivo,
          estadoConciliacion: 'diferencia',
        });
      }

      await tx.cobro.update({
        where: { id: cobro.id },
        data: {
          anuladoEl: new Date(),
          anuladoPorId: actor.userId,
          anuladoPorNombre: actor.nombre,
          motivoAnulacion: payload.motivo.trim(),
          estadoAcreditacion: 'anulado',
        },
      });
      if (
        valor &&
        ['cartera', 'depositado', 'acreditado'].includes(valor.estado)
      ) {
        await tx.valor.update({
          where: { id: valor.id },
          data: {
            estado: 'rechazado',
            rechazadoEl: new Date(),
            motivoRechazo: `Cobro anulado: ${payload.motivo.trim()}`,
          },
        });
        await tx.valorEvento.create({
          data: {
            tenantId: auth.tenantId,
            valorId: valor.id,
            tipo: 'cobro_anulado',
            actorUserId: actor.userId,
            actorNombre: actor.nombre,
            detalleJson: { motivo: payload.motivo.trim() },
          },
        });
      }
      await this.facturacionOrdenes.revertirCobro(tx, auth.tenantId, cobro.id);
      return { ok: true };
    });
  }

  async findOne(auth: CurrentAuth, id: string) {
    const cobro = await this.prisma.cobro.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        metodoPago: { select: { nombre: true, tipo: true } },
        cuentaDestino: { select: { nombre: true } },
        cliente: { select: { nombre: true } },
        retenciones: true,
        valores: { select: { id: true, estado: true, numero: true } },
      },
    });
    if (!cobro) throw new NotFoundException('No se encontró el cobro.');
    return this.toResponse(cobro);
  }

  private toResponse(cobro: {
    id: string;
    fecha: Date;
    ordenId: string | null;
    clienteId: string | null;
    montoBruto: unknown;
    comisionPctAplicada: unknown;
    comisionMonto: unknown;
    comisionIvaMonto: unknown;
    netoAcreditado: unknown;
    retencionesTotal: unknown;
    disponibleReal: unknown;
    moneda: string;
    fechaAcreditacionEstimada: Date | null;
    estadoAcreditacion: string;
    notas: string | null;
    numeroRecibo?: string | null;
    referencia?: string | null;
    anuladoEl?: Date | null;
    anuladoPorNombre?: string | null;
    motivoAnulacion?: string | null;
    metodoPago: { nombre: string; tipo: string };
    cuentaDestino: { nombre: string } | null;
    cliente: { nombre: string } | null;
    retenciones: Array<{
      regimen: string;
      jurisdiccion: string | null;
      base: unknown;
      alicuota: unknown;
      monto: unknown;
      nroComprobante: string | null;
    }>;
    valores: Array<{ id: string; estado: string; numero: string }>;
  }) {
    return {
      id: cobro.id,
      fecha: cobro.fecha.toISOString(),
      ordenId: cobro.ordenId,
      clienteId: cobro.clienteId,
      clienteNombre: cobro.cliente?.nombre ?? null,
      numeroRecibo: cobro.numeroRecibo ?? null,
      referencia: cobro.referencia ?? null,
      metodoNombre: cobro.metodoPago.nombre,
      metodoTipo: cobro.metodoPago.tipo,
      cuentaDestinoNombre: cobro.cuentaDestino?.nombre ?? null,
      montoBruto: Number(cobro.montoBruto),
      comisionPctAplicada: Number(cobro.comisionPctAplicada),
      comisionMonto: Number(cobro.comisionMonto),
      comisionIvaMonto: Number(cobro.comisionIvaMonto),
      netoAcreditado: Number(cobro.netoAcreditado),
      retencionesTotal: Number(cobro.retencionesTotal),
      disponibleReal: Number(cobro.disponibleReal),
      moneda: cobro.moneda,
      fechaAcreditacionEstimada:
        cobro.fechaAcreditacionEstimada?.toISOString() ?? null,
      estadoAcreditacion: cobro.estadoAcreditacion,
      anuladoEl: cobro.anuladoEl?.toISOString() ?? null,
      anuladoPorNombre: cobro.anuladoPorNombre ?? null,
      motivoAnulacion: cobro.motivoAnulacion ?? null,
      notas: cobro.notas,
      retenciones: cobro.retenciones.map((r) => ({
        regimen: r.regimen,
        jurisdiccion: r.jurisdiccion,
        base: Number(r.base),
        alicuota: Number(r.alicuota),
        monto: Number(r.monto),
        nroComprobante: r.nroComprobante,
      })),
      valor: cobro.valores[0]
        ? {
            id: cobro.valores[0].id,
            estado: cobro.valores[0].estado,
            numero: cobro.valores[0].numero,
          }
        : null,
    };
  }
}
