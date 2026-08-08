import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import { CobrosService } from '../administracion/cobros.service';
import type {
  EntregarItemsDto,
  RevertirEntregaDto,
} from './dto/entrega.dto';

/**
 * Entrega en el mostrador (docs/entrega-por-escaneo-diseno.md).
 *
 * El cliente llega con el QR de su orden, el operador lo escanea y se
 * despacha lo que está listo. Dos reglas que definen todo lo de abajo:
 *
 *  - **La entrega es POR ÍTEM.** Un trabajo de 4 productos donde 3 están
 *    terminados se entrega igual; el cuarto queda pendiente de retiro y la
 *    orden NO se cierra. `OrdenTrabajo.estado = 'entregada'` pasa a ser un
 *    derivado: se setea recién cuando todos los ítems tienen `entregadoEl`.
 *  - **Un ítem se entrega sólo si terminó.** "Terminado" no es un campo:
 *    es que todos sus pasos estén en `hecho` (mismo criterio que el tablero
 *    y el tracking público). Un ítem sin ruta materializada se considera
 *    listo — no tiene nada que esperar.
 */
@Injectable()
export class EntregaService {
  private readonly logger = new Logger(EntregaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cobros: CobrosService,
  ) {}

  /**
   * Resuelve el código escaneado (el número de la orden) a lo que el modal
   * del mostrador necesita. Lookup EXACTO y por tenant: el código viene de
   * un QR, no de un buscador.
   */
  async escanear(auth: CurrentAuth, codigo: string) {
    const numero = codigo.trim().toUpperCase();
    const orden = await this.prisma.ordenTrabajo.findFirst({
      where: { tenantId: auth.tenantId, numero },
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            telefonoCodigo: true,
            telefonoNumero: true,
          },
        },
        items: {
          orderBy: { ordenIndice: 'asc' },
          include: {
            pasos: {
              orderBy: { indice: 'asc' },
              select: { estado: true, nombre: true },
            },
          },
        },
      },
    });
    if (!orden) {
      throw new NotFoundException(
        `No encontramos la orden ${numero}. Verificá el código.`,
      );
    }
    if (orden.estado === 'borrador') {
      throw new BadRequestException(
        `${numero} todavía es un borrador: no se emitió al taller.`,
      );
    }
    if (orden.estado === 'cancelada') {
      throw new BadRequestException(`${numero} está cancelada.`);
    }

    const total = Number(orden.total ?? 0);
    const cobrado = Number(orden.cobradoTotal ?? 0);
    return {
      id: orden.id,
      numero: orden.numero,
      estado: orden.estado,
      creadaEl: orden.createdAt.toISOString(),
      cliente: orden.cliente
        ? {
            id: orden.cliente.id,
            nombre: orden.cliente.nombre,
            telefono:
              [orden.cliente.telefonoCodigo, orden.cliente.telefonoNumero]
                .filter(Boolean)
                .join(' ')
                .trim() || null,
          }
        : null,
      total,
      cobrado,
      // Lo que falta cobrar. Nunca negativo: un cobro de más no es un saldo
      // a favor de la orden, es un tema de cuenta corriente.
      saldo: Math.max(0, Math.round((total - cobrado) * 100) / 100),
      items: orden.items.map((item) => this.proyectarItem(item)),
    };
  }

  private proyectarItem(item: {
    id: string;
    nombre: string;
    cantidad: Prisma.Decimal;
    cantidadUnidad: string;
    total: Prisma.Decimal;
    specsJson: Prisma.JsonValue;
    entregadoEl: Date | null;
    entregadoPorNombre: string | null;
    retiradoPorNombre: string | null;
    pasos: Array<{ estado: string; nombre: string }>;
  }) {
    const total = item.pasos.length;
    const hechos = item.pasos.filter((p) => p.estado === 'hecho').length;
    // Sin ruta materializada no hay nada que esperar: se considera listo
    // (mismo criterio que el tablero para los ítems sin pasos).
    const listo = total === 0 || hechos === total;
    const enCurso = item.pasos.find((p) => p.estado !== 'hecho');
    const specs = Array.isArray(item.specsJson)
      ? (item.specsJson as Array<{ etiqueta: string; valor: string }>)
      : [];
    return {
      id: item.id,
      nombre: item.nombre,
      cantidad: Number(item.cantidad),
      cantidadUnidad: item.cantidadUnidad,
      total: Number(item.total),
      // Una línea corta para reconocer el trabajo sin abrir la orden.
      detalle: specs
        .slice(0, 3)
        .map((s) => s.valor)
        .filter(Boolean)
        .join(' · '),
      listo,
      pasosHechos: hechos,
      pasosTotal: total,
      pasoActual: enCurso?.nombre ?? null,
      entregadoEl: item.entregadoEl?.toISOString() ?? null,
      entregadoPorNombre: item.entregadoPorNombre,
      retiradoPorNombre: item.retiradoPorNombre,
    };
  }

  /**
   * Entrega los ítems elegidos y, si vino, registra el cobro.
   *
   * El cobro va PRIMERO y fuera de la transacción de entrega: tiene su
   * propia transacción, numera recibo y habla con integraciones. Si algo
   * falla ahí, no se entregó nada todavía y el error se ve tal cual. Al
   * revés (entregar y que falle el cobro) dejaría el trabajo despachado y
   * la plata sin registrar, que es el error caro.
   */
  async entregar(auth: CurrentAuth, ordenId: string, dto: EntregarItemsDto) {
    const orden = await this.prisma.ordenTrabajo.findFirst({
      where: { id: ordenId, tenantId: auth.tenantId },
      include: {
        items: {
          include: { pasos: { select: { estado: true } } },
        },
      },
    });
    if (!orden) throw new NotFoundException('La orden no existe.');
    if (orden.estado === 'borrador' || orden.estado === 'cancelada') {
      throw new BadRequestException(
        `No se puede entregar una orden ${orden.estado}.`,
      );
    }

    const porId = new Map(orden.items.map((i) => [i.id, i]));
    const aEntregar = dto.itemIds.map((id) => {
      const item = porId.get(id);
      if (!item) {
        throw new BadRequestException(
          'Alguno de los productos no pertenece a esta orden.',
        );
      }
      return item;
    });

    for (const item of aEntregar) {
      if (item.entregadoEl) {
        throw new BadRequestException(
          `"${item.nombre}" ya se había entregado. Actualizá la pantalla.`,
        );
      }
      const total = item.pasos.length;
      const hechos = item.pasos.filter((p) => p.estado === 'hecho').length;
      if (total > 0 && hechos < total) {
        throw new BadRequestException(
          `"${item.nombre}" todavía está en producción: no se puede entregar.`,
        );
      }
    }

    const cobroCreado = dto.cobro
      ? await this.cobros.create(auth, { ...dto.cobro, ordenId: orden.id })
      : null;

    const actor = await this.prisma.empleado.findFirst({
      where: { tenantId: auth.tenantId, userId: auth.userId },
      select: { nombreCompleto: true },
    });
    const firma = actor?.nombreCompleto ?? auth.email;
    const ahora = new Date();
    const ids = aEntregar.map((i) => i.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.ordenTrabajoItem.updateMany({
        where: { id: { in: ids }, tenantId: auth.tenantId },
        data: {
          entregadoEl: ahora,
          entregadoPorNombre: firma,
          retiradoPorNombre: dto.retiraTercero?.nombre ?? null,
          retiradoPorDni: dto.retiraTercero?.dni ?? null,
        },
      });

      // La orden se cierra sola cuando ya no queda nada por retirar.
      const pendientes = await tx.ordenTrabajoItem.count({
        where: { ordenId: orden.id, entregadoEl: null },
      });
      const cerrada = pendientes === 0;
      if (cerrada) {
        await tx.ordenTrabajo.update({
          where: { id: orden.id },
          data: { estado: 'entregada', progresoPct: 100 },
        });
        // `fechaEntregada` es el ancla del pedido de reseña: sólo la primera.
        await tx.ordenTrabajo.updateMany({
          where: { id: orden.id, fechaEntregada: null },
          data: { fechaEntregada: ahora },
        });
      }

      const nombres = aEntregar.map((i) => i.nombre).join(' · ');
      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          tipo: cerrada ? 'estado' : 'nota',
          descripcion: cerrada
            ? `Entrega completa (${ids.length} producto${ids.length === 1 ? '' : 's'}): ${nombres}`
            : `Entrega parcial (${ids.length} de ${orden.items.length}): ${nombres}. Quedan ${pendientes} sin retirar.`,
          usuarioNombre: firma,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            itemIds: ids,
            cerrada,
            ...(dto.retiraTercero
              ? {
                  retiraTercero: {
                    nombre: dto.retiraTercero.nombre,
                    dni: dto.retiraTercero.dni,
                  },
                }
              : {}),
            ...(cobroCreado ? { cobroId: cobroCreado.id } : {}),
          },
        },
      });
    });

    return {
      entregados: ids.length,
      ordenCerrada:
        (await this.prisma.ordenTrabajoItem.count({
          where: { ordenId: orden.id, entregadoEl: null },
        })) === 0,
      cobro: cobroCreado
        ? { id: cobroCreado.id, numeroRecibo: cobroCreado.numeroRecibo }
        : null,
    };
  }

  /**
   * Deshace la entrega de unos ítems (se entregó lo que no era, el cliente
   * devolvió algo). Si la orden estaba cerrada por eso, vuelve a
   * `finalizada`: es el único camino de retroceso desde `entregada`, y por
   * eso NO pasa por `validarTransicion` —que sólo avanza— sino por acá,
   * exigiendo motivo y dejándolo en el historial.
   */
  async revertir(auth: CurrentAuth, ordenId: string, dto: RevertirEntregaDto) {
    const orden = await this.prisma.ordenTrabajo.findFirst({
      where: { id: ordenId, tenantId: auth.tenantId },
      select: { id: true, estado: true, numero: true },
    });
    if (!orden) throw new NotFoundException('La orden no existe.');

    const items = await this.prisma.ordenTrabajoItem.findMany({
      where: {
        id: { in: dto.itemIds },
        ordenId: orden.id,
        tenantId: auth.tenantId,
      },
      select: { id: true, nombre: true, entregadoEl: true },
    });
    if (items.length !== dto.itemIds.length) {
      throw new BadRequestException(
        'Alguno de los productos no pertenece a esta orden.',
      );
    }
    const entregados = items.filter((i) => i.entregadoEl);
    if (entregados.length === 0) {
      throw new BadRequestException('Ninguno de esos productos se entregó.');
    }

    const actor = await this.prisma.empleado.findFirst({
      where: { tenantId: auth.tenantId, userId: auth.userId },
      select: { nombreCompleto: true },
    });
    const firma = actor?.nombreCompleto ?? auth.email;

    await this.prisma.$transaction(async (tx) => {
      await tx.ordenTrabajoItem.updateMany({
        where: { id: { in: entregados.map((i) => i.id) } },
        data: {
          entregadoEl: null,
          entregadoPorNombre: null,
          retiradoPorNombre: null,
          retiradoPorDni: null,
        },
      });
      // La orden ya no está entregada del todo: vuelve a finalizada. Ojo:
      // `fechaEntregada` NO se limpia a propósito (ver schema) — es el ancla
      // del pedido de reseña y ya pudo haber salido.
      if (orden.estado === 'entregada') {
        await tx.ordenTrabajo.update({
          where: { id: orden.id },
          data: { estado: 'finalizada' },
        });
      }
      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          tipo: 'estado',
          descripcion: `Entrega revertida (${entregados.length} producto${entregados.length === 1 ? '' : 's'}): ${dto.motivo.trim()}`,
          usuarioNombre: firma,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            itemIds: entregados.map((i) => i.id),
            motivo: dto.motivo.trim(),
          },
        },
      });
    });

    return { revertidos: entregados.length };
  }
}
