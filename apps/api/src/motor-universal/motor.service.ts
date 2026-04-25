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
  NestingEjecutado,
} from './tipos';
import {
  runNestingForPaso,
  runNestingForPrePrensa,
  type NestingDispatchResult,
} from './nesting-dispatcher';
import { calcularOutputsCanonicos } from './outputs-canonicos';

/**
 * G-M9 — Resuelve la unidad efectiva de un material consumido. Cuando la
 * fórmula del slot tiene dimensión implícita (`por_m2`, `por_metro_lineal`),
 * la unidad del consumo es esa dimensión. Para el resto (`fijo`, `por_pieza`,
 * `por_unidad_productiva`), se hereda la unidad de stock de la materia prima
 * (PLIEGO, ROLLO, METRO_LINEAL, UNIDAD, KG, M2, etc.) en minúsculas para
 * presentación humana. Si no hay info, fallback `'unidad'` para no romper.
 */
function unidadEfectivaDeFormula(
  formula: string,
  unidadStock: string | null | undefined,
): string {
  switch (formula) {
    case 'por_m2':
      return 'm2';
    case 'por_metro_lineal':
      return 'm_lineales';
    case 'por_pieza':
    case 'por_unidad_productiva':
    case 'fijo':
      return unidadStock ? unidadStock.toLowerCase() : 'unidad';
    default:
      return unidadStock ? unidadStock.toLowerCase() : 'unidad';
  }
}

/**
 * G-M2 — Mapeo familia → output canónico que hereda por default cuando
 * `mecanismoCantidad = HEREDAR_DEL_OUTPUT_CANONICO` y no se especificó
 * `campoOutput` en `mecanismoCantidadConfigJson`. Convención: cada familia
 * espera el output natural del paso anterior.
 */
function defaultOutputParaHeredar(familiaCodigo: string): string | null {
  switch (familiaCodigo) {
    case 'impresion_por_hoja':
      return 'pliegos_calculados';
    case 'corte_guillotina':
      return 'pliegos_impresos';
    case 'laminado':
      return 'pliegos_impresos';
    case 'barniz':
      return 'pliegos_impresos';
    case 'plegado':
      return 'pliegos_impresos';
    case 'troquelado_digital':
      return 'pliegos_impresos';
    case 'engomado_emblocado':
      return 'pliegos_impresos';
    case 'encuadernado_engrapado':
    case 'encuadernado_anillado':
      return 'pliegos_impresos';
    case 'modificacion_post':
      return 'piezas_cortadas';
    default:
      return null;
  }
}

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
 * Sub-fases CUBIERTAS (auditoría 2026-04-25 + G-M3 + G-M1 + G-M2):
 * - F.2.1 bucle a-i, F.2.2 JsonLogic CONDICIONAL, F.2.3 mecanismos cantidad
 *   (DIRECT, CONVERSION, HEREDAR_DEL_OUTPUT_CANONICO real (G-M2),
 *   CALCULADO_POR_PASO con nesting real (G-M1)),
 * - F.2.4 selección perfil heurística (doble/simple), F.2.5 materiales (3 modos
 *   × 3 criterios), F.2.6 multiplicadores, F.2.7 cargos directos a nivel
 *   COTIZACIÓN y a nivel PASO (G-M3), F.2.8 validaciones D.7 (5/5 tipos —
 *   EXISTS_OUTPUT real con G-M2/G-M4), F.2.9 outputs canónicos al jobContext
 *   con look-ahead pre_prensa (G-M2), F.2.10 tarifas reales del centro de
 *   costo, F.2.11 snapshot CotizacionItem, F.2.12 Tab Precio integration,
 *   F.2.13 nesting (shelf-rollo + grid-2d-single, G-M1).
 *
 * Pendientes (ver `docs/motor-por-pasos-analisis/auditoria-gaps-2026-04-25.md`):
 * - G-M6: sub-productos / SELECTOR (DAG).
 * - G-M7/M8: nesting MAYOR_APROVECHAMIENTO real con cada candidato + perfil
 *   con regla declarativa.
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

    // G-M2 — Si el producto declara `medidaDefault` (modoMedidas FIJA o
    // COMERCIAL_ELIGE) y el comercial NO cargó `piezas[]` ni `medidaCustomMm`,
    // sintetizamos `medidaCustomMm` para que el dispatcher de nesting
    // (pre_prensa look-ahead) tenga una pieza válida con la que correr el
    // grid 2D. Esto preserva el contrato: cuando el modelador declara medidas
    // fijas en el producto, el comercial no necesita repetirlas al cotizar.
    if (
      !jobContext.piezas &&
      !jobContext.medidaCustomMm &&
      producto.medidaDefaultAnchoMm &&
      producto.medidaDefaultAltoMm
    ) {
      jobContext.medidaCustomMm = {
        anchoMm: producto.medidaDefaultAnchoMm,
        altoMm: producto.medidaDefaultAltoMm,
      };
    }

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
    /**
     * G-M2 — Outputs canónicos publicados por pasos anteriores. Cada paso
     * puede leer de aquí (HEREDAR_DEL_OUTPUT_CANONICO) y escribir lo suyo.
     * Se materializa también como flat keys en `jobContext` para que las
     * validaciones COMPARE/REQUIRES_INPUT puedan referenciarlos.
     */
    const outputsAcumulados = new Set<string>();
    let huboErrorEnPasoAnterior = false;

    for (let i = 0; i < producto.pasos.length; i++) {
      if (huboErrorEnPasoAnterior) {
        // Si un paso falló, no avanzamos a los siguientes (D.7 multi-error híbrido)
        break;
      }
      const paso = producto.pasos[i];
      const pasosSiguientes = producto.pasos.slice(i + 1);

      const ejecucion = await this.ejecutarPaso(
        paso,
        jobContext,
        errores,
        tarifasMap,
        pasosSiguientes,
        outputsAcumulados,
      );
      pasosEjecutados.push(ejecucion);

      // Si este paso generó errores, marcar para no seguir
      if (errores.some((e) => e.rutaPasoId === paso.rutaPasoId && e.severidad === 'ERROR')) {
        huboErrorEnPasoAnterior = true;
        continue;
      }

      // G-M2 — Mergear outputs canónicos al jobContext mutado para que los
      // siguientes pasos puedan leerlos (HEREDAR_DEL_OUTPUT_CANONICO) o
      // validar su existencia (EXISTS_OUTPUT).
      if (ejecucion.outputsCanonicos) {
        for (const [key, value] of Object.entries(ejecucion.outputsCanonicos)) {
          if (value === null || value === undefined) continue;
          (jobContext as Record<string, unknown>)[key] = value;
          outputsAcumulados.add(key);
        }
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
    pasosSiguientes: PasoCargado[] = [],
    outputsAcumulados: Set<string> = new Set(),
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
      const erroresValidacion = this.ejecutarValidaciones(
        familia,
        paso,
        jobContext,
        outputsAcumulados,
      );
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

    // b) G-F2 — Resolver máquina M-2 si el paso tiene candidatas. El comercial
    //    puede elegir vía `jobContext[\`maquinaSeleccionada_${configPasoId}\`]`.
    //    Si no eligió, gana esPreferida o la primera (orden ya es preferidas
    //    primero, después orden ascendente). Si no hay candidatas, mantiene M-1.
    const pasoConMaquina = this.resolverMaquinaM2(paso, jobContext);

    // c) RESOLVER PERFIL automáticamente si aplica (F.2.4 — D.2)
    const perfilResuelto = this.resolverPerfil(pasoConMaquina, jobContext);
    paso = pasoConMaquina; // todo lo siguiente usa el paso con máquina resuelta

    // c.1) RESOLVER MATERIAL PRELIMINAR (necesario para el nesting de pliegos
    //      o rollos: el algoritmo necesita conocer las dimensiones del sustrato).
    //      Si el slot principal no se puede resolver, el dispatcher devuelve null y
    //      se cae al fallback de m² crudos / cantidad directa.
    const slotPrincipal = paso.slots[0] ?? null;
    const materialPreliminar = slotPrincipal
      ? await this.resolverMaterialSlot(slotPrincipal, jobContext, paso)
      : null;

    // d) NESTING (G-M1 — F.2.13): si el paso usa CALCULADO_POR_PASO y la familia
    //    está soportada por el dispatcher, ejecutamos el algoritmo correspondiente
    //    (shelf-rollo o grid-2d-single) y obtenemos cantidadCalculada con
    //    desperdicio real. Resultado se propaga a tiempo y materiales.
    let nestingDispatch: NestingDispatchResult | null = null;
    if (paso.mecanismoCantidad === 'CALCULADO_POR_PASO') {
      nestingDispatch = runNestingForPaso(paso, jobContext, materialPreliminar);
    }

    // d.1) G-M2 — Look-ahead pre_prensa: si el paso es pre_prensa, busca el
    //      siguiente impresion_por_hoja, toma su material + máquina y corre
    //      grid-2d-single con info sintetizada. El resultado se usa solo para
    //      poblar outputs canónicos (`pliegos_calculados`, `poses_por_pliego`,
    //      `imposicion_calculada`, `cortes_calculados`); el TIEMPO de pre_prensa
    //      sigue siendo T-1 fijo.
    if (!nestingDispatch && paso.familiaCodigo === 'pre_prensa') {
      nestingDispatch = await runNestingForPrePrensa(
        paso,
        jobContext,
        pasosSiguientes,
        (slot, jc) => this.resolverMaterialSlot(slot, jc),
      );
    }

    // e) TIEMPO (D.4) — usa el perfil resuelto si difiere del default; si hay
    //    nesting, su cantidadCalculada se usa como cantidad efectiva del paso.
    const pasoConPerfil: PasoCargado = perfilResuelto
      ? { ...paso, perfil: perfilResuelto }
      : paso;
    const tiempo = this.calcularTiempo(
      pasoConPerfil,
      jobContext,
      errores,
      tarifasMap,
      nestingDispatch,
    );

    // f) MATERIALES (D.5) — F.2.5: HARDCODED + COMERCIAL_ELIGE + MOTOR_ELIGE_AUTO.
    //    Si hay nesting con cantidad calculada, usamos esa cantidad para fórmulas
    //    compatibles (por_metro_lineal con shelf-rollo, por_unidad_productiva con
    //    grid-2d-single → pliegos).
    const materiales = await this.calcularMateriales(paso, jobContext, nestingDispatch);
    const materialesCosto = materiales.reduce((acc, m) => acc + m.costoTotal, 0);

    // g) CARGOS DIRECTOS A NIVEL PASO (G-M3 / D.6)
    //    Base de PORCENTAJE_SOBRE_BASE = subtotal del PASO (tiempo + materiales).
    const subtotalPaso = tiempo.costo + materialesCosto;
    const cargosDirectosPaso = this.aplicarCargosPaso(
      paso.cargosDirectosPaso,
      jobContext,
      subtotalPaso,
    );
    const cargosPasoTotal = cargosDirectosPaso.reduce((acc, c) => acc + c.monto, 0);

    const nestingResult: NestingEjecutado | undefined = nestingDispatch
      ? {
          algorithm: nestingDispatch.algorithm,
          cantidadCalculada: nestingDispatch.cantidadCalculada,
          unidad: nestingDispatch.unidad,
          aprovechamientoPct: nestingDispatch.aprovechamientoPct,
          substrates: nestingDispatch.substrates,
          placements: nestingDispatch.placements,
          piezasPorPliego: nestingDispatch.piezasPorPliego,
          consumedLengthMm: nestingDispatch.consumedLengthMm,
          piezasAcomodadas: nestingDispatch.piezasAcomodadas,
        }
      : undefined;

    // h) G-M2 — Outputs canónicos: la familia declara qué publica al jobContext.
    //    Cantidad efectiva del paso depende del mecanismo:
    //      - DIRECT_FROM_JOBCONTEXT: jobContext.cantidad
    //      - HEREDAR_DEL_OUTPUT_CANONICO: ya resuelto en calcularTiempo
    //      - CALCULADO_POR_PASO: nestingDispatch.cantidadCalculada
    //      - CONVERSION: piezas/unidades de empaque (ya calculado por resolverCantidad)
    const cantidadEfectiva = nestingDispatch
      ? nestingDispatch.cantidadCalculada
      : this.resolverCantidad(paso, jobContext, null);

    const outputsCanonicos = calcularOutputsCanonicos(familia, {
      paso,
      jobContext,
      tiempo,
      materiales,
      nestingDispatch,
      cantidadEfectiva,
    });

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
      outputsCanonicos,
      nestingResult,
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
    nestingDispatch: NestingDispatchResult | null = null,
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
      // G-M5 — Productividad PROPIA del paso (típico de pasos M-0 manuales:
      // embalaje, conteo, lijado, modificacion_post, instalacion). Soporta:
      //
      //  1) `paramsPaso.horasEstimadas`: input absoluto en HORAS. El comercial
      //     o el modelador estiman directamente cuántas horas tarda el paso
      //     (independiente de cantidad). Útil para `diseno_grafico` y casos
      //     donde no hay productividad estable.
      //  2) `jobContext[campoOverride]` con `campoOverride = paramsPaso.campoHorasJobContext`:
      //     permite que el comercial sobrescriba en runtime (ej. T-4 INPUT_MANUAL
      //     queda cubierto vía este path: el comercial ingresa el valor del RIP
      //     del láser).
      //  3) `paramsPaso.productivityValue`: cantidad/hora del operario.
      //     `runMin = (cantidadEfectiva × multiplicadores) / productividad × 60`.
      //  4) Fallback: 0 (tiempo fijo y/o cleanup cubren el caso).
      const params = (paso.paramsPasoJson ?? {}) as Record<string, unknown>;
      const campoOverride = typeof params.campoHorasJobContext === 'string'
        ? params.campoHorasJobContext
        : null;
      const horasOverride = campoOverride
        ? Number((jobContext as Record<string, unknown>)[campoOverride])
        : NaN;
      const horasParams = Number(params.horasEstimadas ?? NaN);
      const productividadPropia = Number(params.productivityValue ?? 0);

      if (Number.isFinite(horasOverride) && horasOverride > 0) {
        runMin = horasOverride * 60;
      } else if (Number.isFinite(horasParams) && horasParams > 0) {
        runMin = horasParams * 60;
      } else if (productividadPropia > 0) {
        let cantidadEfectiva = this.resolverCantidad(paso, jobContext, nestingDispatch);
        cantidadEfectiva = this.aplicarMultiplicadores(cantidadEfectiva, paso, jobContext);
        runMin = (cantidadEfectiva / productividadPropia) * 60;
      }
    } else if (modoTiempo === 'T-3') {
      // Productividad del perfil — necesita: cantidad y productividad
      const productividad = Number(paso.perfil?.productivityValue ?? 0);
      if (productividad > 0) {
        // F.2.3 — Mecanismo de cantidad (nesting tiene prioridad si aplica)
        let cantidadEfectiva = this.resolverCantidad(paso, jobContext, nestingDispatch);
        // F.2.6 — aplicar multiplicadores activos
        cantidadEfectiva = this.aplicarMultiplicadores(cantidadEfectiva, paso, jobContext);
        // Para T-3 con shelf-rollo, la productividad suele estar en m²/h y la
        // cantidadCalculada del nesting está en metros lineales. Convertimos a m²
        // multiplicando por el ancho útil del rollo (que viene en el sustrato).
        if (
          nestingDispatch?.algorithm === 'shelf-rollo' &&
          paso.perfil?.productivityUnit === 'M2_H'
        ) {
          const ancho = nestingDispatch.substrates[0]?.kind === 'roll'
            ? nestingDispatch.substrates[0].widthMm / 1000
            : 0;
          cantidadEfectiva = nestingDispatch.cantidadCalculada * ancho; // m_lin × ancho_m = m²
        }
        runMin = (cantidadEfectiva / productividad) * 60;
      }
    }

    const totalMin = Math.ceil(setupMin + runMin + cleanupMin + tiempoFijoMin);

    // F.2.10 — Tarifa horaria. Prioridades:
    //   1. Centro de costo de la máquina (período publicado) — comportamiento principal.
    //   2. G-M5: `paramsPaso.tarifaHoraOperario` para pasos M-0 (T-2 sin máquina).
    //   3. G-M5: `paramsPaso.tarifaFija` (monto absoluto del paso, no por hora).
    //      Cuando se declara tarifaFija el costo ES la tarifaFija, ignorando totalMin
    //      × tarifaHora. Útil para `diseno_grafico` cobrado como cargo único.
    let tarifaHora = 0;
    if (paso.maquina?.centroCostoPrincipalId) {
      const tarifaDecimal = tarifasMap.get(paso.maquina.centroCostoPrincipalId);
      if (tarifaDecimal != null) {
        tarifaHora = Number(tarifaDecimal);
      }
    }
    const params = (paso.paramsPasoJson ?? {}) as Record<string, unknown>;
    if (tarifaHora === 0) {
      const tarifaOperario = Number(params.tarifaHoraOperario ?? 0);
      if (tarifaOperario > 0) tarifaHora = tarifaOperario;
    }
    const tarifaFija = Number(params.tarifaFija ?? 0);
    const costo = tarifaFija > 0 ? tarifaFija : (totalMin / 60) * tarifaHora;

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
    nestingDispatch: NestingDispatchResult | null = null,
  ): Promise<MaterialEjecutado[]> {
    const ejecutados: MaterialEjecutado[] = [];

    for (const slot of paso.slots) {
      const materialResuelto = await this.resolverMaterialSlot(slot, jobContext, paso);
      if (!materialResuelto) continue;

      // Cantidad: depende de la fórmula. Si hay nesting, ajustamos a la
      // cantidad real con desperdicio.
      let cantidad = 0;
      if (slot.formula === 'por_unidad_productiva') {
        // G-M9 fix (validación end-to-end 2026-04-25): la cantidad de
        // material por_unidad_productiva debe respetar el mecanismo del paso:
        //   - CALCULADO_POR_PASO con nesting → cantidadCalculada (pliegos).
        //   - HEREDAR_DEL_OUTPUT_CANONICO → output del paso anterior
        //     (ej. impresion_por_hoja hereda pliegos_calculados de pre_prensa).
        //   - DIRECT_FROM_JOBCONTEXT / CONVERSION → vía resolverCantidad.
        // Antes leía siempre `jobContext.cantidad` cuando no había nesting,
        // lo que causaba que tarjetas consumiera 1000 pliegos en vez de 18.
        cantidad = this.resolverCantidad(paso, jobContext, nestingDispatch);
      } else if (slot.formula === 'por_pieza') {
        cantidad = Number(jobContext.cantidad ?? 0);
      } else if (slot.formula === 'fijo') {
        cantidad = 1;
      } else if (slot.formula === 'por_m2') {
        if (nestingDispatch?.algorithm === 'shelf-rollo') {
          // Shelf-rollo cobra por m² consumidos del rollo (no útiles): largo × ancho
          const sub = nestingDispatch.substrates[0];
          if (sub?.kind === 'roll') {
            cantidad = (sub.lengthMm * sub.widthMm) / 1_000_000;
          }
        } else {
          cantidad = this.calcularM2DesdePiezas(jobContext);
        }
      } else if (slot.formula === 'por_metro_lineal') {
        if (nestingDispatch?.algorithm === 'shelf-rollo' && nestingDispatch.consumedLengthMm) {
          cantidad = nestingDispatch.consumedLengthMm / 1000;
        } else {
          cantidad = this.calcularMetrosLinealesDesdePiezas(jobContext);
        }
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
        // G-M9: la unidad efectiva depende de la fórmula del slot. Para
        // fórmulas con dimensión implícita (`por_m2`, `por_metro_lineal`)
        // usamos esa unidad. Para `fijo`, `por_pieza`, `por_unidad_productiva`
        // heredamos la unidad de stock de la materia prima (PLIEGO, ROLLO,
        // METRO_LINEAL, UNIDAD, etc.) en minúsculas.
        unidad: unidadEfectivaDeFormula(slot.formula, materialResuelto.unidadStock),
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
    /**
     * G-M7: si se pasa `paso`, MAYOR_APROVECHAMIENTO ejecuta el dispatcher
     * de nesting con CADA candidato y elige el de mayor aprovechamientoPct
     * (en vez de la heurística "más ancho"). Si no se pasa, mantiene la
     * heurística (compat para callers que no necesitan nesting real).
     */
    paso?: PasoCargado,
  ): Promise<{
    id: string;
    sku: string;
    precioReferencia: number | null;
    unidadStock?: string | null;
    atributosVarianteJson?: Record<string, unknown> | null;
  } | null> {
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
        // G-M7: si recibimos `paso`, corremos el dispatcher de nesting con cada
        // candidato y elegimos el de mayor `aprovechamientoPct`. Si el dispatcher
        // no aplica para ningún candidato (familia no soportada), caemos a la
        // heurística histórica (más ancho = mejor para rollos).
        if (paso) {
          const evaluados = validos.map((v) => {
            const dispatch = runNestingForPaso(paso, jobContext, {
              id: v.id,
              atributosVarianteJson: (v.atributosVarianteJson ?? null) as
                | Record<string, unknown>
                | null,
            });
            return { v, aprovechamiento: dispatch?.aprovechamientoPct ?? -1 };
          });
          const conNesting = evaluados.filter((e) => e.aprovechamiento >= 0);
          if (conNesting.length > 0) {
            conNesting.sort((a, b) => b.aprovechamiento - a.aprovechamiento);
            return conNesting[0].v;
          }
          // Ningún candidato cubierto por nesting → fallback heurístico.
        }
        // Heurística (fallback): el más ancho gana (favorece rollos grandes).
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
  ): Promise<{
    id: string;
    sku: string;
    precioReferencia: number | null;
    anchoMm?: number;
    /** G-M9: unidad de stock heredada (PLIEGO, METRO_LINEAL, etc.). */
    unidadStock?: string | null;
    /** G-M7: necesario para correr nesting con cada candidato. */
    atributosVarianteJson?: Record<string, unknown> | null;
  } | null> {
    const v = await this.prisma.materiaPrimaVariante.findUnique({
      where: { id: variantId },
      include: { materiaPrima: { select: { unidadStock: true } } },
    });
    if (!v) return null;
    const attrs = v.atributosVarianteJson as Record<string, unknown> | null;
    return {
      id: v.id,
      sku: v.sku,
      precioReferencia: v.precioReferencia ? Number(v.precioReferencia) : null,
      anchoMm: typeof attrs?.anchoMm === 'number' ? attrs.anchoMm : undefined,
      // Variante puede tener override; sino hereda de la materia prima padre.
      unidadStock: v.unidadStock ?? v.materiaPrima?.unidadStock ?? null,
      atributosVarianteJson: attrs,
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
    outputsAcumulados: Set<string> = new Set(),
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
        // G-M2 / G-M4 — Chequear que el output canónico haya sido publicado
        // por algún paso anterior (registrado en outputsAcumulados).
        cumple = outputsAcumulados.has(v.outputCanonico);
        contextoError = {
          outputCanonico: v.outputCanonico,
          outputsDisponibles: Array.from(outputsAcumulados),
        };
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
  private resolverCantidad(
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null = null,
  ): number {
    const mecanismo = paso.mecanismoCantidad ?? 'DIRECT_FROM_JOBCONTEXT';

    if (mecanismo === 'DIRECT_FROM_JOBCONTEXT') {
      return Number(jobContext.cantidad ?? 0);
    }

    if (mecanismo === 'HEREDAR_DEL_OUTPUT_CANONICO') {
      // G-M2: lee el output canónico publicado por un paso anterior. La key
      // se determina por:
      //  1) `mecanismoCantidadConfigJson.campoOutput` (override explícito).
      //  2) Default por familia (mapeo abajo).
      const config = (paso.mecanismoCantidadConfigJson ?? {}) as Record<string, unknown>;
      const campoExplicito = typeof config.campoOutput === 'string' ? config.campoOutput : null;
      const campo = campoExplicito ?? defaultOutputParaHeredar(paso.familiaCodigo);
      if (campo) {
        const v = (jobContext as Record<string, unknown>)[campo];
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
      }
      // Fallback histórico: si el output no fue publicado, cae a cantidad
      // directa para no romper cotizaciones donde pre_prensa todavía no
      // escribe outputs (G-M1 sin look-ahead).
      return Number(jobContext.cantidad ?? 0);
    }

    if (mecanismo === 'CALCULADO_POR_PASO') {
      // G-M1: si el dispatcher devolvió nesting, usar la cantidad calculada
      // con desperdicio real (m_lineales para shelf-rollo, pliegos para grid).
      if (nestingDispatch) {
        return nestingDispatch.cantidadCalculada;
      }
      // Fallback histórico: m² crudos de las piezas (sin desperdicio) cuando
      // la familia no tiene algoritmo soportado por el dispatcher.
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
   * G-F2 — Resuelve qué máquina usar cuando el paso tiene candidatas M-2.
   *
   * Prioridad:
   *  1. Override del comercial: `jobContext[\`maquinaSeleccionada_${configPasoId}\`]`
   *     o `jobContext[\`maquinaSeleccionada_${rutaPasoId}\`]` (clave alternativa).
   *  2. Candidata `esPreferida = true` (las candidatas vienen ordenadas con
   *     preferidas primero, así que la primera de la lista cumple).
   *  3. Si no hay candidatas: usar la M-1 default (`maquinaM1Id`).
   *
   * Devuelve un nuevo `PasoCargado` con `maquina` (y perfilesDisponibles)
   * apuntando a la M-2 elegida, o el `paso` original si no había candidatas.
   */
  private resolverMaquinaM2(paso: PasoCargado, jobContext: JobContext): PasoCargado {
    if (!paso.maquinasCandidatas || paso.maquinasCandidatas.length === 0) {
      return paso; // sin candidatas, mantiene M-1 default
    }

    const ctx = jobContext as unknown as Record<string, unknown>;
    const keyById = `maquinaSeleccionada_${paso.configPasoId}`;
    const keyByPasoId = `maquinaSeleccionada_${paso.rutaPasoId}`;
    const eleccion =
      typeof ctx[keyById] === 'string' ? (ctx[keyById] as string) :
      typeof ctx[keyByPasoId] === 'string' ? (ctx[keyByPasoId] as string) :
      null;

    let elegida = eleccion
      ? paso.maquinasCandidatas.find((c) => c.maquinaId === eleccion || c.id === eleccion)
      : null;
    if (!elegida) {
      elegida = paso.maquinasCandidatas[0]; // ya viene ordenada (preferida primero)
    }

    return {
      ...paso,
      maquinaM1Id: elegida.maquinaId,
      maquina: elegida.maquina,
      perfilesDisponibles: elegida.perfilesOperativos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        activo: p.activo,
        productivityValue: p.productivityValue,
        setupMin: p.setupMin,
        cleanupMin: p.cleanupMin,
        detalleJson: p.detalleJson,
      })),
      // Reset perfil M-1 (se vuelve a resolver con resolverPerfil sobre los
      // perfiles de la nueva máquina).
      perfil: elegida.perfilesOperativos[0]
        ? {
            id: elegida.perfilesOperativos[0].id,
            nombre: elegida.perfilesOperativos[0].nombre,
            productivityValue: elegida.perfilesOperativos[0].productivityValue,
            productivityUnit: elegida.perfilesOperativos[0].productivityUnit,
            setupMin: elegida.perfilesOperativos[0].setupMin,
            cleanupMin: elegida.perfilesOperativos[0].cleanupMin,
          }
        : paso.perfil,
      perfilM1Id: elegida.perfilesOperativos[0]?.id ?? paso.perfilM1Id,
    };
  }

  /**
   * F.2.4 / G-M8 — Selección automática de perfil dentro de la máquina M-1.
   *
   * Estrategia (en orden):
   *  1. **Regla declarativa** (G-M8): cada perfil puede declarar
   *     `detalleJson.reglaSeleccion: JsonLogic`. El motor evalúa la regla
   *     contra el JobContext y elige el PRIMER perfil activo cuya regla
   *     devuelve `true`. Esto cubre cualquier criterio (caras, gramaje,
   *     tipo trabajo, calidad, etc.) sin código por familia.
   *  2. **Heurística legacy** (fallback): para `impresion_por_hoja` con
   *     `jobContext.caras`, busca perfil "doble"/"simple" por nombre o
   *     `detalleJson.dobleFaz`. Útil cuando los perfiles del seed no
   *     declaran reglas explícitas.
   *  3. Si nada match → mantener perfil default del config.
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

    const ctx = jobContext as unknown as Record<string, unknown>;

    // ─── 1. G-M8 — Regla declarativa por perfil ──────────────────────
    for (const perfil of paso.perfilesDisponibles) {
      if (!perfil.activo) continue;
      const detalle = (perfil.detalleJson ?? {}) as Record<string, unknown>;
      const regla = detalle.reglaSeleccion ?? detalle.condicion ?? null;
      if (regla === null || regla === undefined) continue;
      const evaluacion = evaluarRegla(regla, ctx);
      if (evaluacion.error) continue; // regla mal formada → ignorar perfil
      if (evaluacion.resultado === true && perfil.id !== paso.perfilM1Id) {
        return {
          id: perfil.id,
          nombre: perfil.nombre,
          productivityValue: perfil.productivityValue,
          productivityUnit: null,
          setupMin: perfil.setupMin,
          cleanupMin: perfil.cleanupMin,
        };
      }
    }

    // ─── 2. Heurística legacy: impresión por hoja según caras ────────
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
                  include: {
                    materialVariante: {
                      include: { materiaPrima: { select: { unidadStock: true } } },
                    },
                  },
                },
                maquinasCandidatas: {
                  where: { activo: true },
                  orderBy: [{ esPreferida: 'desc' }, { orden: 'asc' }],
                  include: {
                    maquina: { include: { perfilesOperativos: true } },
                  },
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
      maquinasCandidatas: cp.maquinasCandidatas.map((mc) => ({
        id: mc.id,
        maquinaId: mc.maquinaId,
        esPreferida: mc.esPreferida,
        orden: mc.orden,
        maquina: {
          id: mc.maquina.id,
          codigo: mc.maquina.codigo,
          nombre: mc.maquina.nombre,
          plantilla: mc.maquina.plantilla,
          centroCostoPrincipalId: mc.maquina.centroCostoPrincipalId,
          parametrosTecnicosJson: mc.maquina.parametrosTecnicosJson as Record<string, unknown> | null,
        },
        perfilesOperativos: mc.maquina.perfilesOperativos.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          activo: p.activo,
          productivityValue: p.productivityValue ? Number(p.productivityValue) : null,
          productivityUnit: p.productivityUnit,
          setupMin: p.setupMin ? Number(p.setupMin) : null,
          cleanupMin: p.cleanupMin ? Number(p.cleanupMin) : null,
          detalleJson: p.detalleJson,
        })),
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
              unidadStock:
                s.materialVariante.unidadStock ??
                s.materialVariante.materiaPrima?.unidadStock ??
                null,
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
      medidaDefaultAnchoMm: producto.medidaDefaultAnchoMm
        ? Number(producto.medidaDefaultAnchoMm)
        : null,
      medidaDefaultAltoMm: producto.medidaDefaultAltoMm
        ? Number(producto.medidaDefaultAltoMm)
        : null,
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
