import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FAMILIAS } from '../productos-servicios/pasos/familias';
import type { FamiliaCodigo } from '../productos-servicios/pasos/types';
import { evaluarRegla } from './evaluador-jsonlogic';
import { loadTarifasHorarias } from '../productos-servicios/costing/load-tarifas';
import { calcularPrecio, type PrecioConfig } from './calculador-precio';
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
  CargoPasoCargado,
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
 * Sub-fases CUBIERTAS (auditoría 2026-04-25 + G-M3):
 * - F.2.1 bucle a-i, F.2.2 JsonLogic CONDICIONAL, F.2.3 mecanismos cantidad
 *   (DIRECT/CONVERSION OK; HEREDAR/CALCULADO parciales),
 * - F.2.4 selección perfil heurística (doble/simple), F.2.5 materiales (3 modos
 *   × 3 criterios), F.2.6 multiplicadores, F.2.7 cargos directos a nivel
 *   COTIZACIÓN y a nivel PASO (G-M3), F.2.8 validaciones D.7 (4 de 5 tipos),
 *   F.2.10 tarifas reales del centro de costo, F.2.11 snapshot CotizacionItem,
 *   F.2.12 Tab Precio integration.
 *
 * Pendientes (ver `docs/motor-por-pasos-analisis/auditoria-gaps-2026-04-25.md`):
 * - G-M1: nesting al motor (F.2.13 — `CALCULADO_POR_PASO` devuelve m² crudos).
 * - G-M2: outputs canónicos al jobContext (placeholder — todos `null`).
 * - G-M4: validación EXISTS_OUTPUT real (asume true).
 * - G-M5: T-2 (productividad propia).
 * - G-M6: sub-productos / SELECTOR (DAG).
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

    // JobContext mutable (los pasos PRE pueden mutarlo) + defaults sensatos
    const jobContext: JobContext = {
      caras: 1, // simple faz por defecto (se sobrescribe con input)
      ...input.jobContext,
    };

    // 1b. Cargar tarifas horarias publicadas para el período (F.2.10)
    const periodo = input.periodo ?? this.getPeriodoActual();
    const centroIds = Array.from(
      new Set(
        producto.pasos
          .map((p) => p.maquina?.centroCostoPrincipalId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const tarifasMap = await loadTarifasHorarias(this.prisma as never, {
      tenantId: input.tenantId,
      periodo,
      centroCostoIds: centroIds,
    });

    // 2. ITERAR PASOS EN ORDEN TOPOLÓGICO (orden simple por ahora)
    const pasosEjecutados: PasoEjecutado[] = [];
    let huboErrorEnPasoAnterior = false;

    for (const paso of producto.pasos) {
      if (huboErrorEnPasoAnterior) {
        // Si un paso falló, no avanzamos a los siguientes (D.7 multi-error híbrido)
        break;
      }

      const ejecucion = await this.ejecutarPaso(paso, jobContext, errores, tarifasMap);
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

    // 4. F.2.7 — Aplicar cargos directos a nivel COTIZACIÓN
    const subtotalSinCargosCotizacion = pasosEjecutados.reduce(
      (acc, p) => acc + p.costoTotal,
      0,
    );
    const cargosDirectosCotizacion = this.aplicarCargosCotizacion(
      producto.cargosDirectosCotizacion,
      jobContext,
      subtotalSinCargosCotizacion,
    );

    // 5. COMPONER RESULTADO
    const tiempoTotal = pasosEjecutados.reduce((acc, p) => acc + (p.tiempo?.costo ?? 0), 0);
    const materialesTotal = pasosEjecutados.reduce(
      (acc, p) => acc + (p.materiales?.reduce((m, mat) => m + mat.costoTotal, 0) ?? 0),
      0,
    );
    const cargosDirectosPasoTotal = pasosEjecutados.reduce(
      (acc, p) => acc + (p.cargosDirectosPaso?.reduce((c, cd) => c + cd.monto, 0) ?? 0),
      0,
    );
    const cargosDirectosCotizacionTotal = cargosDirectosCotizacion.reduce(
      (acc, c) => acc + c.monto,
      0,
    );
    const cargosDirectosTotal = cargosDirectosPasoTotal + cargosDirectosCotizacionTotal;
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
      cargosDirectosCotizacion,
    };

    // F.2.12 — Calcular precio a partir del costo + Tab Precio del producto
    if (producto.precioConfigJson) {
      cotizacion.precio = calcularPrecio(
        cotizacion.costos.unitario,
        cantidadEfectiva,
        producto.precioConfigJson as PrecioConfig,
      );
    }

    return { exitoso: true, errores: [], cotizacion };
  }

  /**
   * F.2.11 — Cotiza y persiste el resultado como CotizacionItem con snapshot
   * completo (sub-tema 07 §7).
   *
   * Crea (o agrega a) una Cotizacion + un CotizacionItem con:
   *  - jobContextJson (input del comercial al cotizar)
   *  - snapshotJson (ruta + producto + materiales + valores + cargos +
   *    selección de ruta alternativa)
   *  - costoUnitario, costoTotal, trazabilidadJson
   *
   * Si `cotizacionId` se pasa, agrega item a esa cotización; si no, crea
   * una cotización nueva en estado borrador.
   */
  async cotizarYGuardar(
    input: CotizarInput & { cotizacionId?: string },
  ): Promise<{ result: CotizarOutput; cotizacionId?: string; cotizacionItemId?: string }> {
    const result = await this.cotizar(input);
    if (!result.exitoso || !result.cotizacion) {
      return { result };
    }

    // 1. Encontrar o crear cotización
    let cotizacionId = input.cotizacionId;
    if (!cotizacionId) {
      const nueva = await this.prisma.cotizacion.create({
        data: {
          tenantId: input.tenantId,
          clienteId: input.clienteId ?? null,
          estado: 'borrador',
        },
      });
      cotizacionId = nueva.id;
    }

    // 2. Recuperar producto cargado para construir snapshot completo
    const producto = await this.cargarProductoYRuta(
      input.tenantId,
      input.productoId,
      input.rutaAlternativaId ?? null,
    );

    // 3. Crear CotizacionItem con snapshot
    const item = await this.prisma.cotizacionItem.create({
      data: {
        tenantId: input.tenantId,
        cotizacionId,
        productoId: input.productoId,
        rutaAlternativaId: result.cotizacion.rutaAlternativaId,
        cantidad: result.cotizacion.cantidadEfectiva.toString(),
        jobContextJson: input.jobContext as never,
        snapshotJson: {
          producto: {
            id: producto.productoId,
            codigo: producto.productoCodigo,
            nombre: producto.productoNombre,
            unidadComercial: producto.unidadComercial,
            modoMedidas: producto.modoMedidas,
          },
          ruta: {
            id: producto.rutaId,
            codigo: producto.rutaCodigo,
            nombre: producto.rutaNombre,
            alternativa: producto.rutaAlternativaNombre,
            pasos: producto.pasos.map((p) => ({
              orden: p.rutaPasoOrden,
              familia: p.familiaCodigo,
              maquina: p.maquina?.codigo,
              perfil: p.perfil?.nombre,
              materialesEnSlots: p.slots.map((s) => ({
                slot: s.slotCodigo,
                modo: s.modoSeleccion,
                materialSku: s.materialVariante?.sku,
              })),
            })),
          },
          ejecucion: {
            cantidadEfectiva: result.cotizacion.cantidadEfectiva,
            cantidadPedida: result.cotizacion.cantidadPedida,
            costos: result.cotizacion.costos,
          },
        } as never,
        costoUnitario: result.cotizacion.costos.unitario.toString(),
        costoTotal: result.cotizacion.costos.total.toString(),
        trazabilidadJson: {
          pasos: result.cotizacion.pasos,
          cargosDirectosCotizacion: result.cotizacion.cargosDirectosCotizacion,
        } as never,
      },
    });

    return { result, cotizacionId, cotizacionItemId: item.id };
  }

  // ============================================================================
  // EJECUCIÓN DE UN PASO (sub-tareas a-i — versión MVP)
  // ============================================================================

  /** Devuelve el período actual en formato 'YYYY-MM'. */
  private getPeriodoActual(): string {
    const ahora = new Date();
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  }

  private async ejecutarPaso(
    paso: PasoCargado,
    jobContext: JobContext,
    errores: ErrorMotor[],
    tarifasMap: Map<string, unknown>,
  ): Promise<PasoEjecutado> {
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

    // a.1) F.2.8 — Ejecutar validaciones D.7 declaradas por la familia
    if (familia) {
      const erroresValidacion = this.ejecutarValidaciones(familia, paso, jobContext);
      if (erroresValidacion.length > 0) {
        errores.push(...erroresValidacion);
        return {
          rutaPasoId: paso.rutaPasoId,
          rutaPasoOrden: paso.rutaPasoOrden,
          familiaCodigo: paso.familiaCodigo,
          configPasoId: paso.configPasoId,
          activado: true,
          costoTotal: 0,
        };
      }
    }

    // c) RESOLVER PERFIL automáticamente si aplica (F.2.4 — D.2)
    const perfilResuelto = this.resolverPerfil(paso, jobContext);

    // d) TIEMPO (D.4) — usa el perfil resuelto si difiere del default
    const pasoConPerfil: PasoCargado = perfilResuelto
      ? { ...paso, perfil: perfilResuelto }
      : paso;
    const tiempo = this.calcularTiempo(pasoConPerfil, jobContext, errores, tarifasMap);

    // e) MATERIALES (D.5) — F.2.5: HARDCODED + COMERCIAL_ELIGE + MOTOR_ELIGE_AUTO
    const materiales = await this.calcularMateriales(paso, jobContext);
    const materialesCosto = materiales.reduce((acc, m) => acc + m.costoTotal, 0);

    // f) CARGOS DIRECTOS A NIVEL PASO (G-M3 / D.6)
    //    Base de PORCENTAJE_SOBRE_BASE = subtotal del PASO (tiempo + materiales).
    const subtotalPaso = tiempo.costo + materialesCosto;
    const cargosDirectosPaso = this.aplicarCargosPaso(
      paso.cargosDirectosPaso,
      jobContext,
      subtotalPaso,
    );
    const cargosPasoTotal = cargosDirectosPaso.reduce((acc, c) => acc + c.monto, 0);

    return {
      rutaPasoId: paso.rutaPasoId,
      rutaPasoOrden: paso.rutaPasoOrden,
      familiaCodigo: paso.familiaCodigo,
      configPasoId: paso.configPasoId,
      activado: true,
      tiempo,
      materiales,
      cargosDirectosPaso,
      costoTotal: subtotalPaso + cargosPasoTotal,
      outputsCanonicos: this.calcularOutputs(familia?.outputsCanonicos ?? [], paso, jobContext),
    };
  }

  /**
   * G-M3 — Aplica los cargos directos a nivel PASO.
   *
   * Misma semántica que `aplicarCargosCotizacion`, pero el `subtotalBase` para
   * PORCENTAJE_SOBRE_BASE es el costo del paso (tiempo + materiales), no de la
   * cotización completa.
   *
   * Reutiliza los helpers `evaluarActivacionCargo` y `calcularMontoCargo`,
   * que son genéricos por construcción.
   */
  private aplicarCargosPaso(
    cargos: CargoPasoCargado[],
    jobContext: JobContext,
    subtotalPaso: number,
  ): CargoDirectoEjecutado[] {
    const ejecutados: CargoDirectoEjecutado[] = [];
    for (const cargo of cargos) {
      const activado = this.evaluarActivacionCargo(cargo, jobContext);
      if (!activado) continue;

      const config = (cargo.configOverrideJson ?? cargo.catalogo.configJson) as
        | Record<string, unknown>
        | null;
      const monto = this.calcularMontoCargo(
        cargo.catalogo.modoCalculo,
        config,
        jobContext,
        subtotalPaso,
      );

      ejecutados.push({
        cargoDirectoCatalogoId: cargo.cargoDirectoCatalogoId,
        cargoCodigo: cargo.catalogo.codigo,
        cargoNombre: cargo.catalogo.nombre,
        modoCalculo: cargo.catalogo.modoCalculo as
          | 'MONTO_FIJO_PLANO'
          | 'PORCENTAJE_SOBRE_BASE'
          | 'POR_UNIDAD_INPUT',
        monto,
        detalle: { config, baseCalculo: subtotalPaso, scope: 'PASO' },
      });
    }
    return ejecutados;
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

  /** D.4 — Calcular tiempo del paso (versión MVP + F.2.10 tarifas reales). */
  private calcularTiempo(
    paso: PasoCargado,
    jobContext: JobContext,
    _errores: ErrorMotor[],
    tarifasMap: Map<string, unknown>,
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
        // F.2.3 — Mecanismo de cantidad
        let cantidadEfectiva = this.resolverCantidad(paso, jobContext);
        // F.2.6 — aplicar multiplicadores activos
        cantidadEfectiva = this.aplicarMultiplicadores(cantidadEfectiva, paso, jobContext);
        runMin = (cantidadEfectiva / productividad) * 60;
      }
    }

    const totalMin = Math.ceil(setupMin + runMin + cleanupMin + tiempoFijoMin);

    // F.2.10 — Tarifa horaria real del centro de costo de la máquina (período publicado)
    let tarifaHora = 0;
    if (paso.maquina?.centroCostoPrincipalId) {
      const tarifaDecimal = tarifasMap.get(paso.maquina.centroCostoPrincipalId);
      if (tarifaDecimal != null) {
        tarifaHora = Number(tarifaDecimal);
      }
    }
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

  /** D.5 — Calcular materiales consumidos. F.2.5: soporta los 3 modos de selección. */
  private async calcularMateriales(
    paso: PasoCargado,
    jobContext: JobContext,
  ): Promise<MaterialEjecutado[]> {
    const ejecutados: MaterialEjecutado[] = [];

    for (const slot of paso.slots) {
      const materialResuelto = await this.resolverMaterialSlot(slot, jobContext);
      if (!materialResuelto) continue;

      // Cantidad: depende de la fórmula
      let cantidad = 0;
      if (slot.formula === 'por_unidad_productiva') {
        cantidad = Number(jobContext.cantidad ?? 0);
      } else if (slot.formula === 'por_pieza') {
        cantidad = Number(jobContext.cantidad ?? 0);
      } else if (slot.formula === 'fijo') {
        cantidad = 1;
      } else if (slot.formula === 'por_m2') {
        cantidad = this.calcularM2DesdePiezas(jobContext);
      } else if (slot.formula === 'por_metro_lineal') {
        cantidad = this.calcularMetrosLinealesDesdePiezas(jobContext);
      }

      // F.2.6 — multi-caras (legacy flag)
      if (slot.aplicaMultiCaras && typeof jobContext.caras === 'number') {
        cantidad *= jobContext.caras;
      }
      // F.2.6 — multiplicadores activos
      if (paso.multiplicadoresActivos && paso.multiplicadoresActivos.length > 0) {
        for (const codigoMult of paso.multiplicadoresActivos) {
          if (codigoMult === 'caras' && slot.aplicaMultiCaras) continue;
          const valor = (jobContext as Record<string, unknown>)[codigoMult];
          if (typeof valor === 'number' && valor > 0) {
            cantidad *= valor;
          }
        }
      }

      const precioUnitario = Number(materialResuelto.precioReferencia ?? 0);
      const costoTotal = cantidad * precioUnitario;

      ejecutados.push({
        slotCodigo: slot.slotCodigo,
        materialVarianteId: materialResuelto.id,
        materialNombre: materialResuelto.sku,
        cantidad,
        unidad: 'unidad', // TODO: leer de la materia prima
        precioUnitario,
        costoTotal,
        estrategiaCosto: slot.estrategiaCosto,
        modoSeleccion: slot.modoSeleccion as 'HARDCODED' | 'COMERCIAL_ELIGE' | 'MOTOR_ELIGE_AUTO',
      });
    }

    return ejecutados;
  }

  /**
   * F.2.5 — Resuelve qué material concreto usar según el modo de selección.
   *
   * Modos soportados:
   *  - HARDCODED: usa slot.materialVariante directamente
   *  - COMERCIAL_ELIGE: lee del JobContext la elección del comercial
   *    (key: `slotMaterial_<configPasoId>_<slotCodigo>`); si no eligió,
   *    usa el material default (primero con default=true)
   *  - MOTOR_ELIGE_AUTO: aplica criterio del slot
   *    (MENOR_COSTO / MAYOR_APROVECHAMIENTO / MENOR_CAPACIDAD_QUE_CUMPLA)
   */
  private async resolverMaterialSlot(
    slot: PasoCargado['slots'][number],
    jobContext: JobContext,
  ): Promise<{ id: string; sku: string; precioReferencia: number | null } | null> {
    if (slot.modoSeleccion === 'HARDCODED') {
      return slot.materialVariante ?? null;
    }

    const candidatos = (slot.materialesCandidatosJson ?? []) as Array<{
      variantId: string;
      label?: string;
      default?: boolean;
    }>;
    if (candidatos.length === 0) return null;

    if (slot.modoSeleccion === 'COMERCIAL_ELIGE') {
      // Buscar elección del comercial en el JobContext (formato genérico)
      const slotKey = `slotMaterial_${slot.slotCodigo}`;
      const eleccion = (jobContext as Record<string, unknown>)[slotKey] as string | undefined;
      const elegido = candidatos.find((c) => c.variantId === eleccion);
      const target = elegido ?? candidatos.find((c) => c.default) ?? candidatos[0];
      return await this.cargarVariantePorId(target.variantId);
    }

    if (slot.modoSeleccion === 'MOTOR_ELIGE_AUTO') {
      // Cargar todos los candidatos con su info
      const variantes = await Promise.all(
        candidatos.map((c) => this.cargarVariantePorId(c.variantId)),
      );
      const validos = variantes.filter((v): v is NonNullable<typeof v> => v != null);
      if (validos.length === 0) return null;

      const criterio = slot.criterioMotorAuto ?? 'MENOR_COSTO';

      if (criterio === 'MENOR_COSTO') {
        return validos.sort(
          (a, b) => Number(a.precioReferencia ?? 0) - Number(b.precioReferencia ?? 0),
        )[0];
      }

      if (criterio === 'MAYOR_APROVECHAMIENTO') {
        // Heurística simple: para rollos, el más ancho que sea >= ancho de pieza
        // tiende a aprovechar mejor. Devolver el de mayor anchoMm de variante.
        return validos.sort((a, b) => {
          const anchoA = Number((a as { anchoMm?: number }).anchoMm ?? 0);
          const anchoB = Number((b as { anchoMm?: number }).anchoMm ?? 0);
          return anchoB - anchoA;
        })[0];
      }

      if (criterio === 'MENOR_CAPACIDAD_QUE_CUMPLA') {
        // Necesita criterioInputCampo del JobContext y criterioMaterialCampo de cada variante
        const inputValor = Number(
          (jobContext as Record<string, unknown>)[slot.criterioInputCampo ?? ''] ?? 0,
        );
        const validosOrdenados = validos
          .map((v) => ({
            v,
            cap: Number((v as Record<string, unknown>)[slot.criterioMaterialCampo ?? ''] ?? 0),
          }))
          .filter((x) => x.cap >= inputValor)
          .sort((a, b) => a.cap - b.cap);
        return validosOrdenados[0]?.v ?? null;
      }
    }

    return null;
  }

  /** Carga una variante de materia prima por ID (helper para resolución de materiales). */
  private async cargarVariantePorId(
    variantId: string,
  ): Promise<{ id: string; sku: string; precioReferencia: number | null; anchoMm?: number } | null> {
    const v = await this.prisma.materiaPrimaVariante.findUnique({ where: { id: variantId } });
    if (!v) return null;
    const attrs = v.atributosVarianteJson as Record<string, unknown> | null;
    return {
      id: v.id,
      sku: v.sku,
      precioReferencia: v.precioReferencia ? Number(v.precioReferencia) : null,
      anchoMm: typeof attrs?.anchoMm === 'number' ? attrs.anchoMm : undefined,
    };
  }

  /** Calcula m² totales desde la lista de piezas del JobContext (para fórmula por_m2). */
  private calcularM2DesdePiezas(jobContext: JobContext): number {
    if (!jobContext.piezas || jobContext.piezas.length === 0) return 0;
    return jobContext.piezas.reduce((acc, p) => {
      const m2Pieza = (p.anchoMm * p.altoMm) / 1_000_000;
      return acc + m2Pieza * p.cantidad;
    }, 0);
  }

  /** Metros lineales desde la lista de piezas (para fórmula por_metro_lineal). */
  private calcularMetrosLinealesDesdePiezas(jobContext: JobContext): number {
    if (!jobContext.piezas || jobContext.piezas.length === 0) return 0;
    return jobContext.piezas.reduce((acc, p) => {
      const largoMtsPieza = p.altoMm / 1000;
      return acc + largoMtsPieza * p.cantidad;
    }, 0);
  }

  /**
   * F.2.8 — Ejecuta las validaciones declaradas por la familia (D.7 Tipo B + C).
   *
   * Cada familia puede declarar validaciones tipadas:
   *  - REQUIRES_INPUT: chequea que un campo del JobContext exista y no sea null
   *  - COMPARE: compara dos valores (jobContext vs maquina/material/etc.)
   *  - IN_RANGE: chequea que un valor esté entre min y max
   *  - ONE_OF: chequea que un valor pertenezca a una lista
   *  - EXISTS_OUTPUT: chequea que un output canónico haya sido escrito por algún paso anterior
   *
   * Devuelve array de errores. Si hay al menos 1, el paso falla.
   * Acumula TODOS los errores del mismo paso (multi-error híbrido).
   */
  private ejecutarValidaciones(
    familia: (typeof FAMILIAS)[FamiliaCodigo],
    paso: PasoCargado,
    jobContext: JobContext,
  ): ErrorMotor[] {
    const errores: ErrorMotor[] = [];
    if (!familia.validaciones || familia.validaciones.length === 0) {
      return errores;
    }

    const ctx = jobContext as unknown as Record<string, unknown>;

    for (const v of familia.validaciones) {
      let cumple = true;
      let contextoError: Record<string, unknown> = {};

      if (v.tipo === 'REQUIRES_INPUT') {
        const valor = ctx[v.campo];
        cumple = valor !== undefined && valor !== null && valor !== '';
        contextoError = { campo: v.campo, valor };
      } else if (v.tipo === 'COMPARE') {
        const a = Number(ctx[v.campoJobContext] ?? NaN);
        let b: number = NaN;
        if (v.fuenteB === 'JOBCONTEXT') {
          b = Number(ctx[v.campoB] ?? NaN);
        } else if (v.fuenteB === 'MAQUINA') {
          const params = paso.maquina?.parametrosTecnicosJson as Record<string, unknown> | undefined;
          b = Number(params?.[v.campoB] ?? NaN);
        } else if (v.fuenteB === 'MATERIAL' && v.slotMaterial) {
          const slot = paso.slots.find((s) => s.slotCodigo === v.slotMaterial);
          const attrs = slot?.materialVariante?.atributosVarianteJson as
            | Record<string, unknown>
            | undefined;
          b = Number(attrs?.[v.campoB] ?? NaN);
        } else if (v.fuenteB === 'CONFIG_PASO') {
          const params = paso.paramsPasoJson as Record<string, unknown> | undefined;
          b = Number(params?.[v.campoB] ?? NaN);
        }
        // Si falta uno de los datos, NO se valida (skip silencioso).
        // Validar requiere ambos lados definidos.
        if (Number.isNaN(a) || Number.isNaN(b)) {
          cumple = true;
        } else {
          switch (v.operador) {
            case '<=':
              cumple = a <= b;
              break;
            case '>=':
              cumple = a >= b;
              break;
            case '==':
              cumple = a === b;
              break;
            case '!=':
              cumple = a !== b;
              break;
            case '<':
              cumple = a < b;
              break;
            case '>':
              cumple = a > b;
              break;
          }
        }
        contextoError = { jc: { [v.campoJobContext]: a }, valorB: b, operador: v.operador };
      } else if (v.tipo === 'IN_RANGE') {
        const valor = Number(ctx[v.campo] ?? NaN);
        cumple =
          !Number.isNaN(valor) &&
          (v.min == null || valor >= v.min) &&
          (v.max == null || valor <= v.max);
        contextoError = { campo: v.campo, valor, min: v.min, max: v.max };
      } else if (v.tipo === 'ONE_OF') {
        const valor = String(ctx[v.campo] ?? '');
        cumple = v.valoresPermitidos.includes(valor);
        contextoError = { campo: v.campo, valor, valoresPermitidos: v.valoresPermitidos };
      } else if (v.tipo === 'EXISTS_OUTPUT') {
        // TODO F.2.x — chequear contra outputs acumulados de pasos anteriores
        // Por ahora asumimos que existe (no validamos)
        cumple = true;
      }

      if (!cumple) {
        const mensaje = this.interpolarMensaje(v.mensaje, contextoError, paso, jobContext);
        errores.push({
          codigo: v.codigo,
          severidad: 'ERROR',
          mensaje,
          rutaPasoId: paso.rutaPasoId,
          rutaPasoOrden: paso.rutaPasoOrden,
          familiaCodigo: paso.familiaCodigo,
          contexto: contextoError,
        });
      }
    }
    return errores;
  }

  /** Interpola placeholders {jc.campo}, {maq.campo}, etc. en mensajes de error. */
  private interpolarMensaje(
    template: string,
    contexto: Record<string, unknown>,
    paso: PasoCargado,
    jobContext: JobContext,
  ): string {
    return template.replace(/\{(jc|maq|mat)\.(\w+)\}/g, (_match, fuente: string, campo: string) => {
      if (fuente === 'jc') {
        return String((jobContext as Record<string, unknown>)[campo] ?? '?');
      }
      if (fuente === 'maq') {
        const params = paso.maquina?.parametrosTecnicosJson as Record<string, unknown> | undefined;
        return String(params?.[campo] ?? '?');
      }
      if (fuente === 'mat') {
        // Buscar en cualquier slot
        for (const s of paso.slots) {
          const attrs = s.materialVariante?.atributosVarianteJson as
            | Record<string, unknown>
            | undefined;
          if (attrs && attrs[campo] !== undefined) return String(attrs[campo]);
        }
      }
      return String(contexto[campo] ?? '?');
    });
  }

  /**
   * F.2.3 — Resuelve la CANTIDAD a producir según el mecanismo declarado.
   *
   * 4 mecanismos de D.3:
   *  - DIRECT_FROM_JOBCONTEXT: lee directo `jobContext.cantidad` (default)
   *  - HEREDAR_DEL_OUTPUT_CANONICO: lee output canónico de paso anterior
   *    (config: { campoOutput: 'pliegos_calculados' })
   *  - CALCULADO_POR_PASO: el paso ejecuta cálculo propio (típicamente
   *    nesting). MVP: usa m² total de las piezas para impresion_por_area
   *  - CONVERSION: aplica fórmula a otro valor
   *    (config: { piezasPorCaja: 100 } → ceil(cantidad / piezasPorCaja))
   */
  private resolverCantidad(paso: PasoCargado, jobContext: JobContext): number {
    const mecanismo = paso.mecanismoCantidad ?? 'DIRECT_FROM_JOBCONTEXT';

    if (mecanismo === 'DIRECT_FROM_JOBCONTEXT') {
      return Number(jobContext.cantidad ?? 0);
    }

    if (mecanismo === 'HEREDAR_DEL_OUTPUT_CANONICO') {
      // MVP: leer del jobContext bajo el nombre del output (los pasos PRE
      // que escriben al jobContext aún no están implementados).
      // Por ahora, asumimos que `cantidad` directo cubre el caso simple.
      return Number(jobContext.cantidad ?? 0);
    }

    if (mecanismo === 'CALCULADO_POR_PASO') {
      // F.2.13 PENDIENTE: aquí debería invocarse el algoritmo de nesting correspondiente
      // (shelf-rollo para impresion_por_area, grid-2d-single para impresion_por_hoja con
      // pre_prensa, talonario-grouping para talonarios) y devolver pliegos/m² REAL con
      // desperdicio. Por ahora MVP: para impresion_por_area suma m² cruda de las piezas.
      if (paso.familiaCodigo === 'impresion_por_area' || paso.familiaCodigo === 'plotter_corte') {
        return this.calcularM2DesdePiezas(jobContext);
      }
      return Number(jobContext.cantidad ?? 0);
    }

    if (mecanismo === 'CONVERSION') {
      const config = (paso.mecanismoCantidadConfigJson ?? {}) as Record<string, unknown>;
      const cantidadBase = Number(jobContext.cantidad ?? 0);
      // CONVERSION típica: cajas = ceil(piezas / piezasPorCaja)
      const piezasPorCaja = Number(config.piezasPorCaja ?? 0);
      if (piezasPorCaja > 0) {
        return Math.ceil(cantidadBase / piezasPorCaja);
      }
      // CONVERSION alternativa: talonariosPorCaja
      const talonariosPorCaja = Number(config.talonariosPorCaja ?? 0);
      if (talonariosPorCaja > 0) {
        return Math.ceil(cantidadBase / talonariosPorCaja);
      }
      return cantidadBase;
    }

    return Number(jobContext.cantidad ?? 0);
  }

  /**
   * F.2.4 — Selección automática de perfil dentro de la máquina M-1.
   *
   * Si la máquina tiene varios perfiles (ej: Ricoh "Simple faz" + "Doble faz"),
   * el motor elige el correcto según el JobContext.
   *
   * Heurísticas (MVP):
   *  - Si la familia es `impresion_por_hoja` y jobContext.caras === 2:
   *    buscar perfil con nombre que contenga "doble" o `detalleJson.dobleFaz === true`.
   *  - Si la familia es `impresion_por_hoja` y jobContext.caras === 1:
   *    buscar perfil con "simple" o `dobleFaz === false`.
   *  - Si no hay match heurístico → mantener el perfil default del config.
   *
   * Devuelve el perfil resuelto (o null si no se cambió nada respecto al default).
   */
  private resolverPerfil(
    paso: PasoCargado,
    jobContext: JobContext,
  ): NonNullable<PasoCargado['perfil']> | null {
    if (!paso.perfilesDisponibles || paso.perfilesDisponibles.length <= 1) {
      return null; // no hay alternativas, mantener default
    }

    // Heurística para impresión por hoja según caras
    if (paso.familiaCodigo === 'impresion_por_hoja' && typeof jobContext.caras === 'number') {
      const buscarDoble = jobContext.caras === 2;
      const candidato = paso.perfilesDisponibles.find((p) => {
        if (!p.activo) return false;
        const detalle = (p.detalleJson ?? {}) as Record<string, unknown>;
        const esDobleFaz = detalle.dobleFaz === true || /doble/i.test(p.nombre);
        return buscarDoble ? esDobleFaz : !esDobleFaz;
      });
      if (candidato && candidato.id !== paso.perfilM1Id) {
        return {
          id: candidato.id,
          nombre: candidato.nombre,
          productivityValue: candidato.productivityValue,
          productivityUnit: null,
          setupMin: candidato.setupMin,
          cleanupMin: candidato.cleanupMin,
        };
      }
    }

    // No hubo cambio
    return null;
  }

  /**
   * F.2.7 — Calcula los cargos directos a nivel COTIZACIÓN.
   *
   * Itera los cargos pre-declarados en el producto, evalúa activación
   * (OBLIGATORIO/OPCIONAL/CONDICIONAL) y calcula el monto según el modo:
   *  - MONTO_FIJO_PLANO: lee del config (con override si aplica)
   *  - PORCENTAJE_SOBRE_BASE: % × subtotal de la cotización
   *  - POR_UNIDAD_INPUT: precioPorUnidad × valor del input declarado
   */
  private aplicarCargosCotizacion(
    cargos: ProductoCargado['cargosDirectosCotizacion'],
    jobContext: JobContext,
    subtotalCotizacion: number,
  ): CargoDirectoEjecutado[] {
    const ejecutados: CargoDirectoEjecutado[] = [];
    for (const cargo of cargos) {
      // Activación
      const activado = this.evaluarActivacionCargo(cargo, jobContext);
      if (!activado) continue;

      const config = (cargo.configOverrideJson ?? cargo.catalogo.configJson) as
        | Record<string, unknown>
        | null;
      const monto = this.calcularMontoCargo(
        cargo.catalogo.modoCalculo,
        config,
        jobContext,
        subtotalCotizacion,
      );

      ejecutados.push({
        cargoDirectoCatalogoId: cargo.cargoDirectoCatalogoId,
        cargoCodigo: cargo.catalogo.codigo,
        cargoNombre: cargo.catalogo.nombre,
        modoCalculo: cargo.catalogo.modoCalculo as
          | 'MONTO_FIJO_PLANO'
          | 'PORCENTAJE_SOBRE_BASE'
          | 'POR_UNIDAD_INPUT',
        monto,
        detalle: { config, baseCalculo: subtotalCotizacion },
      });
    }
    return ejecutados;
  }

  private evaluarActivacionCargo(
    cargo: { modoActivacion: string; condicionActivacionJson: unknown; id: string },
    jobContext: JobContext,
  ): boolean {
    if (cargo.modoActivacion === 'OBLIGATORIO') return true;
    if (cargo.modoActivacion === 'OPCIONAL') {
      const opcionales = jobContext.opcionalesActivados ?? {};
      return opcionales[cargo.id] === true;
    }
    if (cargo.modoActivacion === 'CONDICIONAL') {
      const r = evaluarRegla(
        cargo.condicionActivacionJson,
        jobContext as unknown as Record<string, unknown>,
      );
      return r.resultado;
    }
    return false;
  }

  /**
   * F.2.7 — Calcula el monto del cargo según su modoCalculo.
   * Lee del configJson (puede haber override en la asociación producto/paso).
   */
  private calcularMontoCargo(
    modoCalculo: string,
    config: Record<string, unknown> | null,
    jobContext: JobContext,
    subtotalBase: number,
  ): number {
    if (!config) return 0;

    if (modoCalculo === 'MONTO_FIJO_PLANO') {
      // Si hay zonas (ej: viático), buscar la zona elegida en el JobContext
      const zonas = config.zonas as Array<{ codigo: string; monto: number }> | undefined;
      if (zonas && jobContext.zonaInstalacion) {
        const zona = zonas.find((z) => z.codigo === jobContext.zonaInstalacion);
        if (zona) return Number(zona.monto);
      }
      // Sino, usar el monto fijo
      return Number(config.monto ?? 0);
    }

    if (modoCalculo === 'PORCENTAJE_SOBRE_BASE') {
      const pct = Number(config.porcentaje ?? config.porcentajeDefault ?? 0);
      return (subtotalBase * pct) / 100;
    }

    if (modoCalculo === 'POR_UNIDAD_INPUT') {
      const precioPorUnidad = Number(config.precioPorUnidad ?? 0);
      const inputCantidad = String(config.inputCantidad ?? '');
      const valorInput = Number((jobContext as Record<string, unknown>)[inputCantidad] ?? 0);
      return precioPorUnidad * valorInput;
    }

    return 0;
  }

  /**
   * F.2.6 — Aplica los multiplicadores activos del paso a la cantidad base.
   *
   * El paso del producto declara `multiplicadoresActivos: string[]` (ej: ['caras', 'tipoCopia']).
   * Cada multiplicador lee su valor del JobContext y multiplica la cantidad.
   *
   * Multiplicadores soportados (MVP):
   *  - 'caras': multiplica por jobContext.caras (1 simple, 2 doble faz)
   *  - 'tipoCopia': multiplica por jobContext.tipoCopia (1, 2, 3)
   *  - 'hojasPorLibro': multiplica por jobContext.hojasPorLibro (anillado)
   *  - 'cantidadModificacionesPorPieza': multiplica por jobContext.cantidadModificacionesPorPieza
   *  - cualquier otro string: lee dinámicamente del JobContext (truthy default 1)
   */
  private aplicarMultiplicadores(
    cantidadBase: number,
    paso: PasoCargado,
    jobContext: JobContext,
  ): number {
    if (!paso.multiplicadoresActivos || paso.multiplicadoresActivos.length === 0) {
      return cantidadBase;
    }
    let resultado = cantidadBase;
    for (const codigoMult of paso.multiplicadoresActivos) {
      const valor = (jobContext as Record<string, unknown>)[codigoMult];
      if (typeof valor === 'number' && valor > 0) {
        resultado *= valor;
      }
    }
    return resultado;
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
                maquinaM1: {
                  include: { perfilesOperativos: true },
                },
                perfilM1: true,
                slotsMateriales: {
                  include: { materialVariante: true },
                },
                cargosDirectosPaso: {
                  where: { activo: true },
                  include: { cargoDirectoCatalogo: true },
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
            centroCostoPrincipalId: cp.maquinaM1.centroCostoPrincipalId,
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
      perfilesDisponibles: cp.maquinaM1?.perfilesOperativos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        activo: p.activo,
        productivityValue: p.productivityValue ? Number(p.productivityValue) : null,
        setupMin: p.setupMin ? Number(p.setupMin) : null,
        cleanupMin: p.cleanupMin ? Number(p.cleanupMin) : null,
        detalleJson: p.detalleJson,
      })),
      slots: cp.slotsMateriales.map((s) => ({
        id: s.id,
        slotCodigo: s.slotCodigo,
        modoSeleccion: s.modoSeleccion,
        criterioMotorAuto: s.criterioMotorAuto,
        criterioInputCampo: s.criterioInputCampo,
        criterioMaterialCampo: s.criterioMaterialCampo,
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
      cargosDirectosPaso: cp.cargosDirectosPaso.map((c) => ({
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
    }));

    return {
      productoId: producto.id,
      productoCodigo: producto.codigo,
      productoNombre: producto.nombre,
      unidadComercial: producto.unidadComercial,
      modoMedidas: producto.modoMedidas,
      precioConfigJson: producto.precioConfigJson,
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
