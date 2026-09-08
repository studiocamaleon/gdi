import { recalcularOperacionesCongeladas } from './procesamiento-corte';
import {
  aplicarRepartoCorte,
  planificarRepartoCorte,
} from './repartir-operaciones-corte';
import { createHash } from 'node:crypto';
import { ControlConsolidacionProduccion } from '../ordenes-trabajo/consolidacion-produccion';
import {
  claveOperacionNesting,
  controlPrecedenciasNesting,
} from './precedencias-nesting-compuesto';
import type {
  AnalisisNestingCompuestoShadow,
  ComponenteFabricadoCosteado,
  LoteNestingCompuestoSnapshot,
  PasoEjecutado,
} from './tipos';

type Participante = {
  componente: ComponenteFabricadoCosteado;
  paso: PasoEjecutado;
};
const redondear = (n: number) => Math.round(n * 1e6) / 1e6;

/** Agrupa operaciones sobre un layout ya congelado. Nunca llama al nester.
 * La misma configuración publicada es necesaria: un perfil/máquina iguales
 * no bastan para garantizar iguales pasadas, potencia o preparación. */
export function consolidarCortesRegistrados(
  origen: LoteNestingCompuestoSnapshot,
  componentes: ComponenteFabricadoCosteado[],
  precedencias: ControlConsolidacionProduccion = controlPrecedenciasNesting({
    componentes,
  }),
): AnalisisNestingCompuestoShadow['grupos'] {
  const grupos = new Map<string, Participante[]>();
  for (const componente of componentes) {
    if (componente.politicaEjecucion !== 'INDEPENDIENTE') continue;
    for (const paso of componente.pasos ?? []) {
      const n = paso.nestingResult;
      const t = paso.tiempo;
      if (
        !paso.activado ||
        (paso.familiaCodigo !== 'corte_laser' && !t?.procesamientoCorte) ||
        paso.tercerizado ||
        n?.layoutRegistradoLoteId !== origen.id ||
        n.loteNestingCompuesto ||
        !n.maquina?.id ||
        !t ||
        t.origenTiempo === 'manual_comercial' ||
        !paso.configPasoId ||
        !Number.isFinite(t.tarifaHora) ||
        t.tarifaHora! < 0 ||
        (paso.materiales ?? []).some(
          (m) =>
            m.costoTotal !== 0 &&
            !(t.procesamientoCorte && m.estrategiaCosto === 'uso_herramienta'),
        ) ||
        Boolean(t.procesamientoCorte && paso.cargosDirectosPaso?.length)
      )
        continue;
      const firma = createHash('sha256')
        .update(
          JSON.stringify({
            layout: origen.id,
            configuracion: paso.configPasoId,
            maquina: n.maquina.id,
            perfil: n.perfil?.id,
            operacionesCorte: t.procesamientoCorte
              ? {
                  firma: t.procesamientoCorte.firmaConfiguracion,
                  redondeo: t.procesamientoCorte.redondeo,
                }
              : null,
            tecnologia: n.tecnologia,
            centro: t.centroCostoId,
            tarifa: t.tarifaHora,
            dotacion: t.dotacionOperarios,
            nivel: paso.nivelAplicado,
            setup: t.setupMin,
            cleanup: t.cleanupMin,
          }),
        )
        .digest('hex');
      const miembros = grupos.get(firma) ?? [];
      miembros.push({ componente, paso });
      grupos.set(firma, miembros);
    }
  }

  const resultados: AnalisisNestingCompuestoShadow['grupos'] = [];
  for (const [firma, miembros] of grupos) {
    if (
      miembros.length < 2 ||
      new Set(miembros.map((m) => m.componente.codigo)).size !== miembros.length
    )
      continue;
    const id = `corte-registrado-${firma.slice(0, 16)}`;
    const base = miembros[0].paso;
    const tiempo = base.tiempo!;
    const setupTotal = tiempo.setupMin;
    const cleanupTotal = tiempo.cleanupMin;
    const preparacionMin = setupTotal + cleanupTotal;
    const costoPreparacion = redondear(
      (preparacionMin / 60) * tiempo.tarifaHora!,
    );
    const costoPreparacionAnterior = costoPreparacion * miembros.length;
    const codigos = new Set(miembros.map((m) => m.componente.codigo));
    const placements = origen.nestingResult.placements.filter((p) =>
      codigos.has((p.meta as { componenteCodigo: string }).componenteCodigo),
    );
    // El contrato conserva el plan completo (demanda y trayectorias comunes).
    // Sólo se comparte cuando todos sus diseños reciben esta misma operación;
    // un subconjunto necesita primero un plan de corte propio, sin trayectorias
    // de componentes que usan otra configuración.
    if (
      !placements.length ||
      placements.length !== origen.nestingResult.placements.length ||
      miembros.some((m) => m.paso.tiempo!.costo + 0.000001 < costoPreparacion)
    )
      continue;
    const operaciones = miembros.map((m) =>
      claveOperacionNesting(m.componente.codigo, m.paso.rutaPasoId),
    );
    const motivoPrecedencias = precedencias.motivoIncompatible(operaciones);
    if (motivoPrecedencias) {
      resultados.push({
        id,
        firmaVersion: 1,
        firmaCompatibilidad: firma,
        participantes: miembros.map(({ componente, paso }) => ({
          componenteCodigo: componente.codigo,
          productoId: componente.productoId,
          pasoClave: paso.configPasoId,
          rutaPasoId: paso.rutaPasoId,
          pasoNombre: paso.nombreVisible ?? 'Corte láser',
          piezas: [
            ...new Set(paso.nestingResult!.placements.map((p) => p.pieceId)),
          ],
        })),
        independiente: {
          sustratos: origen.nestingResult.cantidadCalculada,
          aprovechamientoPct: origen.nestingResult.aprovechamientoPct,
        },
        consolidado: {
          algoritmo: 'irregular-2d-bottom-left-v1',
          sustratos: origen.nestingResult.cantidadCalculada,
          aprovechamientoPct: origen.nestingResult.aprovechamientoPct,
          substrates: origen.nestingResult.substrates,
          placements,
        },
        diferencia: { sustratos: 0, ahorroPct: 0, ahorroPotencial: false },
        aplicacion: {
          aplicado: false,
          motivoNoAplicado: motivoPrecedencias,
          costoMaterialIndependiente: 0,
          costoMaterialConsolidado: 0,
          costoPreparacionIndependiente: costoPreparacionAnterior,
          costoPreparacionConsolidado: costoPreparacionAnterior,
          ahorroCostoTotal: 0,
        },
      });
      continue;
    }
    let procesamientoCorte:
      | ReturnType<typeof recalcularOperacionesCongeladas>
      | undefined;
    let repartoCorte: ReturnType<typeof planificarRepartoCorte> | undefined;
    const costoOperacionAnterior = miembros.reduce(
      (s, m) => s + m.paso.costoTotal,
      0,
    );
    if (tiempo.procesamientoCorte) {
      try {
        procesamientoCorte = recalcularOperacionesCongeladas(
          miembros.map((m) => m.paso.tiempo!.procesamientoCorte!),
          origen.nestingResult,
        );
        repartoCorte = planificarRepartoCorte(
          procesamientoCorte,
          miembros.map((m) => m.paso),
          miembros.map((m) => m.paso.nestingResult!.placements.length),
          id,
        );
        const nuevo = repartoCorte.reduce(
          (s, r) =>
            s +
            r.tiempo.costo +
            r.materiales.reduce((n, m) => n + m.costoTotal, 0),
          0,
        );
        if (
          nuevo >
          miembros.reduce(
            (s, m) =>
              s +
              m.paso.tiempo!.costo +
              m.paso.tiempo!.procesamientoCorte!.desgasteCosto,
            0,
          ) +
            1e-6
        )
          continue;
      } catch {
        continue;
      }
    }
    precedencias.confirmar(operaciones);
    let preparacionAcumulada = 0;
    let setupAcumulado = 0;
    let cleanupAcumulado = 0;
    const participantes = miembros.map(({ componente, paso }, index) => {
      const piezas = paso.nestingResult!.placements;
      const proporcion = piezas.length / placements.length;
      const ultimo = index === miembros.length - 1;
      const asignado = ultimo
        ? redondear(costoPreparacion - preparacionAcumulada)
        : redondear(costoPreparacion * proporcion);
      const setup = ultimo
        ? redondear(setupTotal - setupAcumulado)
        : redondear(setupTotal * proporcion);
      const cleanup = ultimo
        ? redondear(cleanupTotal - cleanupAcumulado)
        : redondear(cleanupTotal * proporcion);
      preparacionAcumulada += asignado;
      setupAcumulado += setup;
      cleanupAcumulado += cleanup;
      const t = paso.tiempo!;
      const diferencia = repartoCorte
        ? aplicarRepartoCorte(paso, repartoCorte[index])
        : asignado - costoPreparacion;
      const costoAnterior = componente.costoTotal;
      const cantidadBase =
        componente.costoUnitario > 0
          ? costoAnterior / componente.costoUnitario
          : 0;
      if (!repartoCorte) {
        t.totalMin = redondear(
          t.totalMin - t.setupMin - t.cleanupMin + setup + cleanup,
        );
        t.setupMin = setup;
        t.cleanupMin = cleanup;
        t.costo = redondear(t.costo + diferencia);
      }
      paso.costoTotal = redondear(paso.costoTotal + diferencia);
      componente.costoTotal = redondear(componente.costoTotal + diferencia);
      if (cantidadBase > 0)
        componente.costoUnitario = componente.costoTotal / cantidadBase;
      paso.nestingResult!.loteNestingCompuesto = {
        loteId: id,
        firmaCompatibilidad: firma,
        esPasoOperativo: index === 0,
      };
      return {
        componenteCodigo: componente.codigo,
        productoId: componente.productoId,
        pasoClave: paso.configPasoId,
        rutaPasoId: paso.rutaPasoId,
        piezas: [...new Set(piezas.map((p) => p.pieceId))],
        areaUtilMm2:
          origen.participantes.find(
            (p) => p.componenteCodigo === componente.codigo,
          )?.areaUtilMm2 ?? 0,
        porcentajeAsignacion: redondear(proporcion * 100),
        costoMaterialAsignado: 0,
        costoPreparacionAsignado: asignado,
        esPasoOperativo: index === 0,
      };
    });
    const nestingResult = {
      ...origen.nestingResult,
      placements,
      piezasAcomodadas: placements.length,
      maquina: base.nestingResult!.maquina,
      perfil: base.nestingResult!.perfil,
      layoutRegistradoLoteId: origen.id,
      costingPreview: undefined,
      outputsCanonicos: undefined,
    };
    const lote: LoteNestingCompuestoSnapshot = {
      id,
      procesamientoCorte,
      layoutOrigenLoteId: origen.id,
      versionContrato: 1,
      estado: 'CONGELADO',
      firmaCompatibilidad: firma,
      materialVarianteId: origen.materialVarianteId,
      materialNombre: origen.materialNombre,
      participantes,
      nestingResult,
      costoMaterialTotal: 0,
      costoPreparacionTotal: costoPreparacion,
      costoTotalAsignado: redondear(
        miembros.reduce((s, m) => s + m.paso.costoTotal, 0),
      ),
      duracionEstimadaMin: redondear(
        miembros.reduce((s, m) => s + m.paso.tiempo!.totalMin, 0),
      ),
    };
    resultados.push({
      id,
      firmaVersion: 1,
      firmaCompatibilidad: firma,
      participantes: participantes.map((p, i) => ({
        ...p,
        pasoNombre: miembros[i].paso.nombreVisible ?? 'Corte láser',
      })),
      independiente: {
        sustratos: nestingResult.cantidadCalculada,
        aprovechamientoPct: nestingResult.aprovechamientoPct,
      },
      consolidado: {
        algoritmo: 'irregular-2d-bottom-left-v1',
        sustratos: nestingResult.cantidadCalculada,
        aprovechamientoPct: nestingResult.aprovechamientoPct,
        substrates: nestingResult.substrates,
        placements,
      },
      diferencia: { sustratos: 0, ahorroPct: 0, ahorroPotencial: false },
      aplicacion: {
        aplicado: true,
        costoMaterialIndependiente: 0,
        costoMaterialConsolidado: 0,
        costoPreparacionIndependiente: costoPreparacionAnterior,
        costoPreparacionConsolidado: costoPreparacion,
        ahorroCostoTotal: redondear(
          procesamientoCorte
            ? costoOperacionAnterior -
                miembros.reduce((s, m) => s + m.paso.costoTotal, 0)
            : costoPreparacionAnterior - costoPreparacion,
        ),
      },
      lote,
    });
  }
  return resultados;
}
