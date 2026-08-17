import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoTarifaCentroCostoPeriodo,
  Prisma,
  SeccionCentroCostoLinea,
  TipoCentroCosto,
} from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CentroConfiguracionCompleta,
  TarifaSnapshot,
} from './costos.types';
import { CostosMapper } from './costos.mapper';
import { CostosRepartoService } from './costos-reparto.service';
import { CostosValidacionesService } from './costos-validaciones.service';

@Injectable()
export class CostosTarifasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: CostosMapper,
    private readonly reparto: CostosRepartoService,
    private readonly validaciones: CostosValidacionesService,
  ) {}

  /**
   * Recalcula y publica TODO el período, no sólo el centro que se tocó.
   *
   * Los centros no son independientes: lo que gasta la estructura se reparte
   * entre los productivos con peso en su gasto propio, así que cambiar uno
   * mueve la parte que absorben todos los demás. Recalcular de a uno dejaba
   * fotos tomadas en momentos distintos —el primero que se guardaba absorbía
   * la estructura entera y los siguientes cada vez menos—, y sumadas repartían
   * varias veces el mismo pozo.
   *
   * Publicar en el mismo movimiento es lo que hace que el motor cotice con lo
   * que la imprenta acaba de cargar, sin un paso extra que nadie recuerda.
   */
  async recalcularYPublicarPeriodo(auth: CurrentAuth, periodo: string) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
    return this.prisma.$transaction(
      (tx) => this.recalcularYPublicarPeriodoEnTx(auth, normalizedPeriodo, tx),
      { timeout: 15_000 },
    );
  }

  async recalcularYPublicarPeriodoEnTx(
    auth: CurrentAuth,
    periodo: string,
    tx: Prisma.TransactionClient,
  ) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${auth.tenantId}:${normalizedPeriodo}`}))`;
    const centros = await tx.centroCosto.findMany({
      where: { tenantId: auth.tenantId, activo: true },
      select: { id: true, tipoCentro: true },
    });

    const publicados: string[] = [];
    for (const centro of centros) {
      const snapshot = await this.buildTarifaSnapshot(
        auth,
        centro.id,
        normalizedPeriodo,
        tx,
      );
      const valores = {
        costoMensualTotal: snapshot.costoMensualTotal,
        capacidadPractica: snapshot.capacidadPractica,
        tarifaCalculada: snapshot.tarifaCalculada,
        costoMensualManoObra: snapshot.costoMensualManoObra,
        tarifaManoObra: snapshot.tarifaManoObra,
        resumenJson: snapshot.resumenJson,
      };

      // El borrador refleja siempre lo cargado, aunque todavía no dé para
      // publicar (un centro a medio llenar tiene que poder verse en la ficha).
      const estados: EstadoTarifaCentroCostoPeriodo[] = [
        EstadoTarifaCentroCostoPeriodo.BORRADOR,
      ];
      // La estructura no vende horas: su costo ya viaja repartido en los
      // productivos. Publicarle tarifa propia lo cobraría dos veces si algún
      // paso llegara a apuntarle.
      const esProductivo = centro.tipoCentro === TipoCentroCosto.PRODUCTIVO;
      if (esProductivo && snapshot.validaParaPublicar) {
        estados.push(EstadoTarifaCentroCostoPeriodo.PUBLICADA);
        publicados.push(centro.id);
      }

      for (const estado of estados) {
        const anterior =
          estado === EstadoTarifaCentroCostoPeriodo.PUBLICADA
            ? await tx.centroCostoTarifaPeriodo.findUnique({
                where: {
                  tenantId_centroCostoId_periodo_estado: {
                    tenantId: auth.tenantId,
                    centroCostoId: centro.id,
                    periodo: normalizedPeriodo,
                    estado,
                  },
                },
              })
            : null;
        await tx.centroCostoTarifaPeriodo.upsert({
          where: {
            tenantId_centroCostoId_periodo_estado: {
              tenantId: auth.tenantId,
              centroCostoId: centro.id,
              periodo: normalizedPeriodo,
              estado,
            },
          },
          create: {
            tenantId: auth.tenantId,
            centroCostoId: centro.id,
            periodo: normalizedPeriodo,
            estado,
            ...valores,
          },
          update: valores,
        });
        if (
          estado === EstadoTarifaCentroCostoPeriodo.PUBLICADA &&
          (!anterior ||
            !anterior.costoMensualTotal.equals(valores.costoMensualTotal) ||
            !anterior.capacidadPractica.equals(valores.capacidadPractica) ||
            !anterior.tarifaCalculada.equals(valores.tarifaCalculada) ||
            !anterior.tarifaManoObra.equals(valores.tarifaManoObra))
        ) {
          const ultima = await tx.centroCostoTarifaRevision.aggregate({
            where: {
              tenantId: auth.tenantId,
              centroCostoId: centro.id,
              periodo: normalizedPeriodo,
            },
            _max: { revision: true },
          });
          await tx.centroCostoTarifaRevision.create({
            data: {
              tenantId: auth.tenantId,
              centroCostoId: centro.id,
              periodo: normalizedPeriodo,
              revision: (ultima._max.revision ?? 0) + 1,
              ...valores,
              publicadaPorUserId: auth.userId,
              publicadaPor: auth.impersonacion?.actorNombre ?? auth.email,
            },
          });
        }
      }

      // Un borrador inválido en este período corta el carry-forward: si no se
      // elimina la publicación anterior del mismo mes, el motor continúa
      // cotizando con una tarifa que ya no representa la planilla.
      if (!estados.includes(EstadoTarifaCentroCostoPeriodo.PUBLICADA)) {
        await tx.centroCostoTarifaPeriodo.deleteMany({
          where: {
            tenantId: auth.tenantId,
            centroCostoId: centro.id,
            periodo: normalizedPeriodo,
            estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
          },
        });
      }
    }

    return { periodo: normalizedPeriodo, centrosPublicados: publicados.length };
  }

  async calcularTarifaCentro(auth: CurrentAuth, id: string, periodo: string) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
    // Guardar un centro deja al día a todo el período: ver
    // `recalcularYPublicarPeriodo`.
    await this.recalcularYPublicarPeriodo(auth, normalizedPeriodo);
    const snapshot = await this.buildTarifaSnapshot(
      auth,
      id,
      normalizedPeriodo,
    );

    const tarifa = await this.prisma.centroCostoTarifaPeriodo.upsert({
      where: {
        tenantId_centroCostoId_periodo_estado: {
          tenantId: auth.tenantId,
          centroCostoId: id,
          periodo: normalizedPeriodo,
          estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
        },
      },
      create: {
        tenantId: auth.tenantId,
        centroCostoId: id,
        periodo: normalizedPeriodo,
        costoMensualTotal: snapshot.costoMensualTotal,
        capacidadPractica: snapshot.capacidadPractica,
        tarifaCalculada: snapshot.tarifaCalculada,
        costoMensualManoObra: snapshot.costoMensualManoObra,
        tarifaManoObra: snapshot.tarifaManoObra,
        estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
        resumenJson: snapshot.resumenJson,
      },
      update: {
        costoMensualTotal: snapshot.costoMensualTotal,
        capacidadPractica: snapshot.capacidadPractica,
        tarifaCalculada: snapshot.tarifaCalculada,
        costoMensualManoObra: snapshot.costoMensualManoObra,
        tarifaManoObra: snapshot.tarifaManoObra,
        resumenJson: snapshot.resumenJson,
      },
    });

    return {
      tarifaBorrador: this.mapper.toTarifaResponse(tarifa),
      advertencias: snapshot.advertencias,
    };
  }

  async publicarTarifaCentro(auth: CurrentAuth, id: string, periodo: string) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
    const snapshot = await this.buildTarifaSnapshot(
      auth,
      id,
      normalizedPeriodo,
    );

    if (!snapshot.validaParaPublicar) {
      throw new BadRequestException(snapshot.advertencias.join(' '));
    }

    // Publicar uno es publicar el período: al cambiar lo que gasta este
    // centro cambia la parte de la estructura que absorben los otros, y
    // dejarlos con la tarifa anterior los desactualiza en silencio.
    await this.recalcularYPublicarPeriodo(auth, normalizedPeriodo);

    const publicada =
      await this.prisma.centroCostoTarifaPeriodo.findFirstOrThrow({
        where: {
          tenantId: auth.tenantId,
          centroCostoId: id,
          periodo: normalizedPeriodo,
          estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
        },
      });

    return this.mapper.toTarifaResponse(publicada);
  }

  async getCentroTarifas(auth: CurrentAuth, id: string) {
    await this.validaciones.findCentroOrThrow(auth, id);

    const [revisiones, borradores] = await Promise.all([
      this.prisma.centroCostoTarifaRevision.findMany({
        where: { tenantId: auth.tenantId, centroCostoId: id },
        orderBy: [{ periodo: 'desc' }, { revision: 'desc' }],
      }),
      this.prisma.centroCostoTarifaPeriodo.findMany({
        where: {
          tenantId: auth.tenantId,
          centroCostoId: id,
          estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
        },
        orderBy: [{ periodo: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const revisionesPorPeriodo = new Map(
      revisiones.map((revision) => [revision.periodo, revision]),
    );
    const borradoresPendientes = borradores.filter((borrador) => {
      const publicada = revisionesPorPeriodo.get(borrador.periodo);
      return !publicada || borrador.updatedAt > publicada.publicadaEl;
    });

    return [
      ...revisiones.map((revision) => ({
        id: revision.id,
        periodo: revision.periodo,
        revision: revision.revision,
        costoMensualTotal: this.mapper.decimalToNumber(
          revision.costoMensualTotal,
        ),
        capacidadPractica: this.mapper.decimalToNumber(
          revision.capacidadPractica,
        ),
        tarifaCalculada: this.mapper.decimalToNumber(revision.tarifaCalculada),
        costoMensualManoObra: this.mapper.decimalToNumber(
          revision.costoMensualManoObra,
        ),
        tarifaManoObra: this.mapper.decimalToNumber(revision.tarifaManoObra),
        estado: 'publicada' as const,
        resumen: revision.resumenJson,
        createdAt: revision.publicadaEl.toISOString(),
        updatedAt: revision.publicadaEl.toISOString(),
        publicadaPorUserId: revision.publicadaPorUserId,
        publicadaPor: revision.publicadaPor,
      })),
      ...borradoresPendientes.map((tarifa) =>
        this.mapper.toTarifaResponse(tarifa),
      ),
    ].sort(
      (a, b) =>
        b.periodo.localeCompare(a.periodo) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  async buildTarifaSnapshot(
    auth: CurrentAuth,
    centroCostoId: string,
    periodo: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<TarifaSnapshot> {
    const repartoPeriodo = await this.reparto.computeRepartoPeriodo(
      auth,
      periodo,
      db,
    );
    const centro = await this.getCentroConfiguracionEntity(
      auth,
      centroCostoId,
      periodo,
      db,
    );
    // Una sola planilla, tres secciones. Antes esto sumaba cuatro orígenes
    // distintos —componentes, maquinaria, gastos generales y activos fijos—,
    // cada uno con su propia forma de derivar el importe.
    const sumar = (seccion: SeccionCentroCostoLinea) =>
      centro.lineas
        .filter((linea) => linea.seccion === seccion)
        .reduce(
          (acc, linea) => acc.plus(linea.importeMensual),
          new Prisma.Decimal(0),
        );

    const costoMensualGastosGenerales = sumar(
      SeccionCentroCostoLinea.GASTO_GENERAL,
    );
    // Mano de obra = las líneas de empleado. Se persiste aparte para poder
    // cobrar la hora hombre sólo sobre setup/cleanup y no sobre el runtime de
    // máquina. Detectarla por sección es más firme que por categoría, que
    // dependía de que la nómina hubiera etiquetado bien.
    // Ver docs/hora-hombre-setup-cleanup-diseno.md
    const costoMensualManoObra = sumar(SeccionCentroCostoLinea.EMPLEADO);
    const costoMensualActivosFijos = sumar(SeccionCentroCostoLinea.ACTIVO_FIJO);
    const costoMensualTotal = costoMensualGastosGenerales
      .plus(costoMensualManoObra)
      .plus(costoMensualActivosFijos);
    const costoMensualAbsorbidoReparto =
      repartoPeriodo.absorbidoByCentroId.get(centroCostoId) ??
      new Prisma.Decimal(0);
    const advertencias = this.buildAdvertencias(
      centro,
      periodo,
      costoMensualAbsorbidoReparto,
    );
    const desgloseRepartoAbsorbido =
      repartoPeriodo.desgloseByCentroId.get(centroCostoId) ?? [];
    const costoMensualTotalConReparto = costoMensualTotal.plus(
      costoMensualAbsorbidoReparto,
    );
    // Las horas del período, cargadas a mano. `capacidadPractica` se conserva
    // como nombre en el snapshot porque es el contrato con el motor y el ETA.
    const capacidad = centro.capacidadesPeriodo[0];
    const capacidadPractica =
      capacidad?.horasProductivas ?? new Prisma.Decimal(0);
    const tarifaCalculada =
      costoMensualTotalConReparto.gt(0) && capacidadPractica.gt(0)
        ? costoMensualTotalConReparto.div(capacidadPractica)
        : new Prisma.Decimal(0);
    const tarifaManoObra =
      costoMensualManoObra.gt(0) && capacidadPractica.gt(0)
        ? costoMensualManoObra.div(capacidadPractica)
        : new Prisma.Decimal(0);
    const tarifaDirectaSinReparto =
      costoMensualTotal.gt(0) && capacidadPractica.gt(0)
        ? costoMensualTotal.div(capacidadPractica)
        : new Prisma.Decimal(0);
    const tarifaAbsorbidaReparto =
      costoMensualAbsorbidoReparto.gt(0) && capacidadPractica.gt(0)
        ? costoMensualAbsorbidoReparto.div(capacidadPractica)
        : new Prisma.Decimal(0);
    const validaParaPublicar =
      centro.activo &&
      centro.tipoCentro === TipoCentroCosto.PRODUCTIVO &&
      costoMensualTotalConReparto.gt(0) &&
      capacidadPractica.gt(0);

    return {
      centro,
      periodo,
      costoMensualTotal: costoMensualTotalConReparto,
      capacidadPractica,
      tarifaCalculada,
      costoMensualManoObra,
      tarifaManoObra,
      advertencias,
      validaParaPublicar,
      resumenJson: {
        periodo,
        centroCodigo: centro.codigo,
        centroNombre: centro.nombre,
        costoMensualGastosGenerales: this.mapper.decimalToNumber(
          costoMensualGastosGenerales,
        ),
        costoMensualActivosFijos: this.mapper.decimalToNumber(
          costoMensualActivosFijos,
        ),
        costoMensualSinReparto: this.mapper.decimalToNumber(costoMensualTotal),
        costoMensualAbsorbidoReparto: this.mapper.decimalToNumber(
          costoMensualAbsorbidoReparto,
        ),
        desgloseRepartoAbsorbido,
        costoMensualTotal: this.mapper.decimalToNumber(
          costoMensualTotalConReparto,
        ),
        tarifaDirectaSinReparto: this.mapper.decimalToNumber(
          tarifaDirectaSinReparto,
        ),
        tarifaAbsorbidaReparto: this.mapper.decimalToNumber(
          tarifaAbsorbidaReparto,
        ),
        capacidadPractica: this.mapper.decimalToNumber(capacidadPractica),
        tarifaCalculada: this.mapper.decimalToNumber(tarifaCalculada),
        costoMensualManoObra: this.mapper.decimalToNumber(costoMensualManoObra),
        tarifaManoObra: this.mapper.decimalToNumber(tarifaManoObra),
        advertencias,
      },
    };
  }

  async getCentroConfiguracionEntity(
    auth: CurrentAuth,
    id: string,
    periodo: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const centro = await db.centroCosto.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
      include: {
        planta: true,
        lineas: {
          where: { periodo },
          orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
        },
        capacidadesPeriodo: {
          where: { periodo },
        },
        tarifasPeriodo: {
          where: { periodo },
          orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!centro) {
      throw new NotFoundException(`No existe el centro de costo ${id}`);
    }

    return centro;
  }

  buildAdvertencias(
    centro: CentroConfiguracionCompleta,
    periodo: string,
    costoMensualAbsorbidoReparto: Prisma.Decimal = new Prisma.Decimal(0),
  ) {
    const advertencias: string[] = [];
    const costoMensualTotal = this.reparto
      .computeCostoMensualDirectoCentro(centro)
      .plus(costoMensualAbsorbidoReparto);
    const capacidad = centro.capacidadesPeriodo[0] ?? null;

    if (centro.lineas.length === 0) {
      advertencias.push(
        `Todavia no cargaste gastos, empleados ni activos fijos para ${periodo}.`,
      );
    }

    if (!costoMensualTotal.gt(0)) {
      advertencias.push(
        'El costo mensual total debe ser mayor a 0 para calcular una tarifa util.',
      );
    }

    if (centro.tipoCentro === TipoCentroCosto.NO_PRODUCTIVO) {
      return advertencias;
    }

    if (!capacidad) {
      advertencias.push(
        'Todavia no definiste cuantas horas o unidades reales puede producir este centro por mes.',
      );
    } else if (!capacidad.horasProductivas.gt(0)) {
      advertencias.push(
        'Las horas productivas deben ser mayores a 0 para poder publicar una tarifa.',
      );
    }

    return advertencias;
  }

  private async republishTarifasCentrosProductivos(
    auth: CurrentAuth,
    periodo: string,
  ) {
    const centrosProductivos = await this.prisma.centroCosto.findMany({
      where: {
        tenantId: auth.tenantId,
        activo: true,
        tipoCentro: TipoCentroCosto.PRODUCTIVO,
      },
      select: { id: true },
    });

    for (const centro of centrosProductivos) {
      const snapshot = await this.buildTarifaSnapshot(auth, centro.id, periodo);

      if (!snapshot.validaParaPublicar) {
        continue;
      }

      await this.prisma.centroCostoTarifaPeriodo.upsert({
        where: {
          tenantId_centroCostoId_periodo_estado: {
            tenantId: auth.tenantId,
            centroCostoId: centro.id,
            periodo,
            estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
          },
        },
        create: {
          tenantId: auth.tenantId,
          centroCostoId: centro.id,
          periodo,
          costoMensualTotal: snapshot.costoMensualTotal,
          capacidadPractica: snapshot.capacidadPractica,
          tarifaCalculada: snapshot.tarifaCalculada,
          estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
          resumenJson: snapshot.resumenJson,
        },
        update: {
          costoMensualTotal: snapshot.costoMensualTotal,
          capacidadPractica: snapshot.capacidadPractica,
          tarifaCalculada: snapshot.tarifaCalculada,
          resumenJson: snapshot.resumenJson,
        },
      });

      await this.prisma.centroCostoTarifaPeriodo.upsert({
        where: {
          tenantId_centroCostoId_periodo_estado: {
            tenantId: auth.tenantId,
            centroCostoId: centro.id,
            periodo,
            estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
          },
        },
        create: {
          tenantId: auth.tenantId,
          centroCostoId: centro.id,
          periodo,
          costoMensualTotal: snapshot.costoMensualTotal,
          capacidadPractica: snapshot.capacidadPractica,
          tarifaCalculada: snapshot.tarifaCalculada,
          estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
          resumenJson: snapshot.resumenJson,
        },
        update: {
          costoMensualTotal: snapshot.costoMensualTotal,
          capacidadPractica: snapshot.capacidadPractica,
          tarifaCalculada: snapshot.tarifaCalculada,
          resumenJson: snapshot.resumenJson,
        },
      });
    }
  }
}
