import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FAMILIAS } from '../productos-servicios/pasos/familias';
import type { FamiliaCodigo } from '../productos-servicios/pasos/types';
import { evaluarRegla } from './evaluador-jsonlogic';
import type {
  CotizarInput,
  CotizarOutput,
  CotizacionResultado,
  PasoEjecutado,
  ErrorMotor,
  ProductoCargado,
  PasoCargado,
  JobContext,
  MaterialEjecutado,
  CargoDirectoEjecutado,
} from './tipos';

/**
 * Motor Universal por Pasos.
 *
 * MVP de F.2 — implementa el bucle base + sub-tareas básicas:
 * - Cargar producto + ruta seleccionada del DB
 * - Iterar pasos en orden
 * - Por cada paso: D.1 activación → D.4 tiempo simple → D.5 materiales HARDCODED
 *   → costos
 * - Acumular trazabilidad
 * - Devolver costo total + trazabilidad + errores
 *
 * NO cubre todavía (van en sub-fases F.2.x):
 * - JsonLogic CONDICIONAL real (devuelve activado=false con mensaje)
 * - Mecanismos cantidad complejos (HEREDAR_DEL_OUTPUT_CANONICO, CALCULADO_POR_PASO)
 * - Selección automática de perfil con regla
 * - COMERCIAL_ELIGE / MOTOR_ELIGE_AUTO de materiales
 * - Multiplicadores avanzados (caras, tipoCopia)
 * - Cargos directos a nivel paso/cotización
 * - Validaciones D.7 declaradas en familia
 * - Sub-productos / selectores
 * - Snapshot
 * - Tab Precio integration
 *
 * Estos se agregan en próximos commits.
 */
@Injectable()
export class MotorUniversalService {
  constructor(private readonly prisma: PrismaService) {}

  async cotizar(input: CotizarInput): Promise<CotizarOutput> {
    const errores: ErrorMotor[] = [];

    // 1. INICIALIZACIÓN
    let producto: ProductoCargado;
    try {
      producto = await this.cargarProductoYRuta(
        input.tenantId,
        input.productoId,
        input.rutaAlternativaId ?? null,
      );
    } catch (err) {
      return {
        exitoso: false,
        errores: [
          {
            codigo: 'producto_no_encontrado',
            severidad: 'ERROR',
            mensaje: err instanceof Error ? err.message : String(err),
            sugerencia: 'Verificar que el producto y la ruta alternativa existen.',
          },
        ],
      };
    }

    // JobContext mutable (los pasos PRE pueden mutarlo)
    const jobContext: JobContext = { ...input.jobContext };

    // 2. ITERAR PASOS EN ORDEN TOPOLÓGICO (orden simple por ahora)
    const pasosEjecutados: PasoEjecutado[] = [];
    let huboErrorEnPasoAnterior = false;

    for (const paso of producto.pasos) {
      if (huboErrorEnPasoAnterior) {
        // Si un paso falló, no avanzamos a los siguientes (D.7 multi-error híbrido)
        break;
      }

      const ejecucion = this.ejecutarPaso(paso, jobContext, errores);
      pasosEjecutados.push(ejecucion);

      // Si este paso generó errores, marcar para no seguir
      if (errores.some((e) => e.rutaPasoId === paso.rutaPasoId && e.severidad === 'ERROR')) {
        huboErrorEnPasoAnterior = true;
      }
    }

    // 3. SI HAY ERRORES, NO COMPONER COTIZACIÓN
    if (errores.length > 0) {
      return { exitoso: false, errores };
    }

    // 4. COMPONER RESULTADO
    const tiempoTotal = pasosEjecutados.reduce((acc, p) => acc + (p.tiempo?.costo ?? 0), 0);
    const materialesTotal = pasosEjecutados.reduce(
      (acc, p) => acc + (p.materiales?.reduce((m, mat) => m + mat.costoTotal, 0) ?? 0),
      0,
    );
    const cargosDirectosTotal = pasosEjecutados.reduce(
      (acc, p) => acc + (p.cargosDirectosPaso?.reduce((c, cd) => c + cd.monto, 0) ?? 0),
      0,
    );
    const total = tiempoTotal + materialesTotal + cargosDirectosTotal;
    const cantidadEfectiva = (jobContext.cantidad ?? 1);

    const cotizacion: CotizacionResultado = {
      productoId: producto.productoId,
      productoNombre: producto.productoNombre,
      rutaAlternativaId: producto.rutaAlternativaId,
      rutaNombre: producto.rutaAlternativaNombre,
      cantidadEfectiva,
      cantidadPedida: input.jobContext.cantidad,
      costos: {
        tiempoTotal,
        materialesTotal,
        cargosDirectosTotal,
        total,
        unitario: cantidadEfectiva > 0 ? total / cantidadEfectiva : 0,
      },
      pasos: pasosEjecutados,
      cargosDirectosCotizacion: [], // TODO: F.2.x
    };

    return { exitoso: true, errores: [], cotizacion };
  }

  // ============================================================================
  // EJECUCIÓN DE UN PASO (sub-tareas a-i — versión MVP)
  // ============================================================================

  private ejecutarPaso(
    paso: PasoCargado,
    jobContext: JobContext,
    errores: ErrorMotor[],
  ): PasoEjecutado {
    const familia = FAMILIAS[paso.familiaCodigo as FamiliaCodigo] as
      | (typeof FAMILIAS)[FamiliaCodigo]
      | undefined;

    // a) ACTIVACIÓN (D.1)
    const activacion = this.evaluarActivacion(paso, jobContext);
    if (!activacion.activado) {
      return {
        rutaPasoId: paso.rutaPasoId,
        rutaPasoOrden: paso.rutaPasoOrden,
        familiaCodigo: paso.familiaCodigo,
        configPasoId: paso.configPasoId,
        activado: false,
        razonNoActivado: activacion.razon,
        costoTotal: 0,
      };
    }

    // d) TIEMPO (D.4) — versión simple MVP
    const tiempo = this.calcularTiempo(paso, jobContext, errores);

    // e) MATERIALES (D.5) — solo HARDCODED por ahora
    const materiales = this.calcularMateriales(paso, jobContext);
    const materialesCosto = materiales.reduce((acc, m) => acc + m.costoTotal, 0);

    return {
      rutaPasoId: paso.rutaPasoId,
      rutaPasoOrden: paso.rutaPasoOrden,
      familiaCodigo: paso.familiaCodigo,
      configPasoId: paso.configPasoId,
      activado: true,
      tiempo,
      materiales,
      cargosDirectosPaso: [], // TODO: F.2.x
      costoTotal: tiempo.costo + materialesCosto,
      outputsCanonicos: this.calcularOutputs(familia?.outputsCanonicos ?? [], paso, jobContext),
    };
  }

  /** D.1 — Decidir si el paso se activa. */
  private evaluarActivacion(
    paso: PasoCargado,
    jobContext: JobContext,
  ): { activado: boolean; razon?: string } {
    const modo = paso.modoActivacion ?? 'OBLIGATORIO';

    if (modo === 'OBLIGATORIO') {
      return { activado: true };
    }

    if (modo === 'OPCIONAL') {
      const opcionales = jobContext.opcionalesActivados ?? {};
      const activadoPorComercial = opcionales[paso.configPasoId] === true;
      return {
        activado: activadoPorComercial,
        razon: activadoPorComercial
          ? undefined
          : 'Paso OPCIONAL no activado por el comercial',
      };
    }

    if (modo === 'CONDICIONAL') {
      // F.2.2: evaluar JsonLogic contra el JobContext
      const evaluacion = evaluarRegla(
        paso.condicionActivacionJson,
        jobContext as unknown as Record<string, unknown>,
      );
      if (evaluacion.error) {
        return {
          activado: false,
          razon: `Error evaluando regla CONDICIONAL: ${evaluacion.error}`,
        };
      }
      return {
        activado: evaluacion.resultado,
        razon: evaluacion.resultado
          ? undefined
          : 'Regla CONDICIONAL no se cumple en el contexto actual',
      };
    }

    return { activado: false, razon: `Modo de activación desconocido: ${modo}` };
  }

  /** D.4 — Calcular tiempo del paso (versión MVP). */
  private calcularTiempo(
    paso: PasoCargado,
    jobContext: JobContext,
    _errores: ErrorMotor[],
  ): NonNullable<PasoEjecutado['tiempo']> {
    const modoTiempo = paso.modoTiempo ?? 'T-1';

    // Setup, cleanup, tiempoFijo: jerarquía override > perfil > familia > 0
    const setupMin =
      paso.setupOverrideMin ?? paso.perfil?.setupMin ?? 0;
    const cleanupMin =
      paso.cleanupOverrideMin ?? paso.perfil?.cleanupMin ?? 0;
    const tiempoFijoMin = paso.tiempoFijoOverrideMin ?? 0;

    let runMin = 0;

    if (modoTiempo === 'T-1') {
      // Fijo: solo el tiempoFijo cuenta
      runMin = 0;
    } else if (modoTiempo === 'T-2') {
      // Productividad propia (no implementado todavía: leer de paramsPaso)
      // Por ahora asumimos productividad nula → run 0 (TODO F.2.x)
      runMin = 0;
    } else if (modoTiempo === 'T-3') {
      // Productividad del perfil — necesita: cantidad y productividad
      const productividad = Number(paso.perfil?.productivityValue ?? 0);
      if (productividad > 0) {
        // Asume que cantidad es la unidad productiva (simplificación MVP)
        const cantidad = Number(jobContext.cantidad ?? 0);
        runMin = (cantidad / productividad) * 60;
      }
    }

    const totalMin = Math.ceil(setupMin + runMin + cleanupMin + tiempoFijoMin);

    // Tarifa horaria (no implementada todavía — depende del centro de costo del perfil)
    // Por ahora usamos un placeholder conservador.
    const tarifaHora = 0; // TODO: F.2.x — leer del CentroCostoTarifaPeriodo
    const costo = (totalMin / 60) * tarifaHora;

    return {
      setupMin,
      runMin,
      cleanupMin,
      tiempoFijoMin,
      totalMin,
      tarifaHora,
      costo,
    };
  }

  /** D.5 — Calcular materiales consumidos (solo HARDCODED en MVP). */
  private calcularMateriales(paso: PasoCargado, jobContext: JobContext): MaterialEjecutado[] {
    const ejecutados: MaterialEjecutado[] = [];

    for (const slot of paso.slots) {
      if (slot.modoSeleccion !== 'HARDCODED') {
        // TODO: F.2.x — implementar COMERCIAL_ELIGE y MOTOR_ELIGE_AUTO
        continue;
      }
      if (!slot.materialVariante) continue;

      // Cantidad: depende de la fórmula (versión MVP: por_unidad_productiva)
      let cantidad = 0;
      if (slot.formula === 'por_unidad_productiva') {
        cantidad = Number(jobContext.cantidad ?? 0);
      } else if (slot.formula === 'por_pieza') {
        cantidad = Number(jobContext.cantidad ?? 0);
      } else if (slot.formula === 'fijo') {
        cantidad = 1;
      }
      // TODO: F.2.x — fórmulas por_m2, por_metro_lineal

      // Multi-caras
      if (slot.aplicaMultiCaras && jobContext.caras === 2) {
        cantidad *= 2;
      }

      const precioUnitario = Number(slot.materialVariante.precioReferencia ?? 0);
      const costoTotal = cantidad * precioUnitario;

      ejecutados.push({
        slotCodigo: slot.slotCodigo,
        materialVarianteId: slot.materialVariante.id,
        materialNombre: slot.materialVariante.sku,
        cantidad,
        unidad: 'unidad', // TODO: leer de la materia prima
        precioUnitario,
        costoTotal,
        estrategiaCosto: slot.estrategiaCosto,
        modoSeleccion: 'HARDCODED',
      });
    }

    return ejecutados;
  }

  /** Outputs canónicos del paso (placeholder MVP — no escribe nada al jobContext). */
  private calcularOutputs(
    canonicos: string[],
    _paso: PasoCargado,
    _jobContext: JobContext,
  ): Record<string, unknown> {
    const outputs: Record<string, unknown> = {};
    for (const c of canonicos) {
      outputs[c] = null; // TODO: F.2.x
    }
    return outputs;
  }

  // ============================================================================
  // CARGA DE DATOS DEL DB
  // ============================================================================

  private async cargarProductoYRuta(
    tenantId: string,
    productoId: string,
    rutaAlternativaIdInput: string | null,
  ): Promise<ProductoCargado> {
    const producto = await this.prisma.producto.findFirst({
      where: { id: productoId, tenantId, activo: true },
      include: {
        rutasAlternativas: {
          where: { activo: true },
          include: {
            ruta: true,
            configPasos: {
              include: {
                rutaPaso: true,
                maquinaM1: true,
                perfilM1: true,
                slotsMateriales: {
                  include: { materialVariante: true },
                },
              },
              orderBy: { rutaPaso: { orden: 'asc' } },
            },
          },
        },
        cargosDirectosCotizacion: {
          include: { cargoDirectoCatalogo: true },
        },
      },
    });

    if (!producto) {
      throw new Error(`Producto no encontrado: ${productoId}`);
    }
    if (producto.rutasAlternativas.length === 0) {
      throw new Error(`Producto ${producto.codigo} no tiene rutas alternativas`);
    }

    // Elegir ruta alternativa: explícita > preferida > primera
    let rutaAlt = rutaAlternativaIdInput
      ? producto.rutasAlternativas.find((r) => r.id === rutaAlternativaIdInput)
      : producto.rutasAlternativas.find((r) => r.esPreferida);
    if (!rutaAlt) rutaAlt = producto.rutasAlternativas[0];

    if (!rutaAlt) {
      throw new Error(`No se pudo elegir ruta alternativa para producto ${producto.codigo}`);
    }

    const pasos: PasoCargado[] = rutaAlt.configPasos.map((cp) => ({
      rutaPasoId: cp.rutaPaso.id,
      rutaPasoOrden: cp.rutaPaso.orden,
      familiaCodigo: cp.rutaPaso.familiaCodigo,
      configPasoId: cp.id,
      modoActivacion: cp.modoActivacion,
      condicionActivacionJson: cp.condicionActivacionJson,
      modoTiempo: cp.modoTiempo,
      mecanismoCantidad: cp.mecanismoCantidad,
      mecanismoCantidadConfigJson: cp.mecanismoCantidadConfigJson,
      multiplicadoresActivos: cp.multiplicadoresActivos,
      paramsPasoJson: cp.paramsPasoJson,
      maquinaM1Id: cp.maquinaM1Id,
      perfilM1Id: cp.perfilM1Id,
      setupOverrideMin: cp.setupOverrideMin ? Number(cp.setupOverrideMin) : null,
      cleanupOverrideMin: cp.cleanupOverrideMin ? Number(cp.cleanupOverrideMin) : null,
      tiempoFijoOverrideMin: cp.tiempoFijoOverrideMin ? Number(cp.tiempoFijoOverrideMin) : null,
      maquina: cp.maquinaM1
        ? {
            id: cp.maquinaM1.id,
            codigo: cp.maquinaM1.codigo,
            nombre: cp.maquinaM1.nombre,
            plantilla: cp.maquinaM1.plantilla,
            parametrosTecnicosJson: cp.maquinaM1.parametrosTecnicosJson as Record<string, unknown> | null,
          }
        : undefined,
      perfil: cp.perfilM1
        ? {
            id: cp.perfilM1.id,
            nombre: cp.perfilM1.nombre,
            productivityValue: cp.perfilM1.productivityValue ? Number(cp.perfilM1.productivityValue) : null,
            productivityUnit: cp.perfilM1.productivityUnit,
            setupMin: cp.perfilM1.setupMin ? Number(cp.perfilM1.setupMin) : null,
            cleanupMin: cp.perfilM1.cleanupMin ? Number(cp.perfilM1.cleanupMin) : null,
          }
        : undefined,
      slots: cp.slotsMateriales.map((s) => ({
        id: s.id,
        slotCodigo: s.slotCodigo,
        modoSeleccion: s.modoSeleccion,
        materialVarianteId: s.materialVarianteId,
        materialesCandidatosJson: s.materialesCandidatosJson,
        estrategiaCosto: s.estrategiaCosto,
        formula: s.formula,
        aplicaMultiCaras: s.aplicaMultiCaras,
        materialVariante: s.materialVariante
          ? {
              id: s.materialVariante.id,
              sku: s.materialVariante.sku,
              precioReferencia: s.materialVariante.precioReferencia
                ? Number(s.materialVariante.precioReferencia)
                : null,
              atributosVarianteJson: s.materialVariante.atributosVarianteJson as Record<string, unknown> | null,
            }
          : undefined,
      })),
    }));

    return {
      productoId: producto.id,
      productoCodigo: producto.codigo,
      productoNombre: producto.nombre,
      unidadComercial: producto.unidadComercial,
      modoMedidas: producto.modoMedidas,
      rutaAlternativaId: rutaAlt.id,
      rutaAlternativaNombre: rutaAlt.nombre,
      rutaId: rutaAlt.ruta.id,
      rutaCodigo: rutaAlt.ruta.codigo,
      rutaNombre: rutaAlt.ruta.nombre,
      pasos,
      cargosDirectosCotizacion: producto.cargosDirectosCotizacion.map((c) => ({
        id: c.id,
        cargoDirectoCatalogoId: c.cargoDirectoCatalogoId,
        modoActivacion: c.modoActivacion,
        condicionActivacionJson: c.condicionActivacionJson,
        configOverrideJson: c.configOverrideJson,
        catalogo: {
          codigo: c.cargoDirectoCatalogo.codigo,
          nombre: c.cargoDirectoCatalogo.nombre,
          modoCalculo: c.cargoDirectoCatalogo.modoCalculo,
          configJson: c.cargoDirectoCatalogo.configJson,
        },
      })),
    };
  }
}
