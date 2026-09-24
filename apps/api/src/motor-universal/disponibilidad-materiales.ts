import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { reservasPorSaldo } from '../inventario/stock-reservas';
import { normalizeMaterialUnit } from '../inventario/material-units';
import { materialesDeCotizaciones } from '../ordenes-trabajo/materiales-cotizacion.proyeccion';
import type { PasoEjecutado, CotizacionResultado, ErrorMotor } from './tipos';

export const contextoStockCotizacion =
  new AsyncLocalStorage<DisponibilidadCotizacion>();

export function necesidadesDePasos(pasos: PasoEjecutado[]) {
  return materialesDeCotizaciones([
    { id: 'evaluacion', nombre: 'Trabajo', cotizacion: { pasos } },
  ]).necesidades;
}

/** Disponibilidad de una consulta. Nunca crea reservas ni movimientos. */
export class DisponibilidadCotizacion {
  componentes = 0;
  readonly usados = new Map<string, number>();
  private readonly saldos = new Map<
    string,
    { cantidad: number; unidad: string | null }
  >();
  constructor(
    readonly prisma: PrismaService,
    readonly tenantId: string,
    private readonly previos: Array<{
      varianteId: string;
      cantidad: number | null;
      unidad: string | null;
    }> = [],
    private readonly ordenTrabajoId?: string,
  ) {}

  async saldo(id: string) {
    if (!this.saldos.has(id)) {
      const saldo = await this.prisma.$transaction(
        async (tx) => {
          const [variante, stocks, reservas] = await Promise.all([
            tx.materiaPrimaVariante.findFirst({
              where: { id, tenantId: this.tenantId },
              include: { materiaPrima: true },
            }),
            tx.stockMateriaPrimaVariante.findMany({
              where: {
                tenantId: this.tenantId,
                varianteId: id,
                ubicacion: { activo: true, almacen: { activo: true } },
              },
            }),
            reservasPorSaldo(tx, this.tenantId, [id], this.ordenTrabajoId),
          ]);
          return {
            cantidad: stocks.reduce(
              (n, s) =>
                n +
                Math.max(
                  0,
                  s.cantidadDisponible
                    .minus(reservas.get(`${id}:${s.ubicacionId}`) ?? 0)
                    .toNumber(),
                ),
              0,
            ),
            unidad: variante
              ? normalizeMaterialUnit(
                  variante.unidadStock ?? variante.materiaPrima.unidadStock,
                )
              : null,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      this.saldos.set(id, saldo);
    }
    return this.saldos.get(id)!;
  }

  registrar(pasos: PasoEjecutado[]) {
    for (const m of necesidadesDePasos(pasos))
      this.usados.set(
        m.varianteId,
        (this.usados.get(m.varianteId) ?? 0) + (m.cantidad ?? Infinity),
      );
  }

  async evaluar(pasos: PasoEjecutado[], varianteId: string) {
    const demanda = necesidadesDePasos(pasos).find(
      (m) => m.varianteId === varianteId,
    );
    return this.evaluarCantidad(
      varianteId,
      demanda?.cantidad ?? null,
      demanda?.unidad ?? null,
    );
  }

  async evaluarCantidad(
    varianteId: string,
    necesario: number | null,
    unidad: string | null,
    credito = 0,
  ) {
    const saldo = await this.saldo(varianteId);
    const anterior = this.previos
      .filter((m) => m.varianteId === varianteId)
      .reduce(
        (sum, m) =>
          sum +
          (m.cantidad != null &&
          normalizeMaterialUnit(m.unidad ?? '') === saldo.unidad
            ? m.cantidad
            : Infinity),
        0,
      );
    const libre = Math.max(
      0,
      saldo.cantidad -
        anterior -
        Math.max(0, (this.usados.get(varianteId) ?? 0) - credito),
    );
    const verificable =
      necesario != null &&
      normalizeMaterialUnit(unidad ?? '') === saldo.unidad &&
      !!saldo.unidad;
    return {
      libre,
      necesario,
      unidad: saldo.unidad,
      alcanza: verificable && necesario <= libre + 1e-8,
    };
  }

  /** Verificación del consumo definitivo, después de consolidar todos los componentes. */
  async validar(cotizacion: CotizacionResultado): Promise<ErrorMotor[]> {
    const pasos: PasoEjecutado[] = [];
    type Nodo = {
      pasos?: PasoEjecutado[];
      componentesFabricados?: Nodo[];
      componentes?: Nodo[];
    };
    const visitar = (c: Nodo) => {
      pasos.push(...(c.pasos ?? []));
      for (const hijo of c.componentesFabricados ?? c.componentes ?? [])
        visitar(hijo);
    };
    visitar(cotizacion);
    const seleccionados = pasos.flatMap((p) =>
      (p.materiales ?? [])
        .filter((m) => m.seleccionStock)
        .map((m) => ({ paso: p, material: m })),
    );
    if (!seleccionados.length) return [];
    const total = materialesDeCotizaciones([
      { id: 'total', nombre: 'Trabajo', cotizacion },
    ]);
    this.usados.clear();
    const errores: ErrorMotor[] = [];
    for (const { paso, material } of seleccionados) {
      const demanda = total.necesidades.find(
        (m) => m.varianteId === material.materialVarianteId,
      );
      const disponible = await this.evaluarCantidad(
        material.materialVarianteId,
        demanda?.cantidad ?? null,
        demanda?.unidad ?? null,
      );
      const contexto = {
        configPasoId: paso.configPasoId,
        slotCodigo: material.slotCodigo,
        recomendadoVarianteId: material.materialVarianteId,
        alternativas: material.seleccionStock!.alternativas.map((alternativa) =>
          alternativa.id === material.materialVarianteId
            ? { id: alternativa.id, ...disponible }
            : alternativa,
        ),
      };
      material.seleccionStock!.estado = disponible.alcanza
        ? 'disponible'
        : 'requiere_reposicion';
      if (
        !disponible.alcanza &&
        material.seleccionStock!.politica === 'PREFERIR_DISPONIBLES'
      )
        errores.push({
          codigo: 'material_auto_requiere_reposicion',
          severidad: 'WARNING',
          mensaje: `${material.materialDisplayName}: la cotización requiere reposición para cubrir el consumo conjunto del trabajo.`,
          rutaPasoId: paso.rutaPasoId,
          contexto,
        });
      if (
        !disponible.alcanza &&
        material.seleccionStock!.politica === 'SOLO_DISPONIBLES'
      )
        errores.push({
          codigo: 'material_auto_sin_stock_suficiente',
          severidad: 'ERROR',
          mensaje: `${material.materialDisplayName}: el stock libre no alcanza para el consumo conjunto del trabajo.`,
          sugerencia:
            'Elegí un material explícitamente para cotizar con reposición o revisá la disponibilidad.',
          rutaPasoId: paso.rutaPasoId,
          contexto,
        });
    }
    return errores;
  }
}
