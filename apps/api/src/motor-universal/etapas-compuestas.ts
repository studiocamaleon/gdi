import type { PasoEjecutado } from './tipos';

type ComponenteVinculable = {
  codigo: string;
  plantillaCodigo?: string;
  cantidad: number;
  jobContext: Record<string, unknown>;
};

function esRegistro(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function piezasDelComponente(componente: ComponenteVinculable) {
  const piezas = Array.isArray(componente.jobContext.piezas)
    ? componente.jobContext.piezas
    : [];
  return piezas.flatMap((pieza) => {
    if (!esRegistro(pieza)) return [];
    const cantidad = Number(pieza.cantidad);
    const anchoMm = Number(pieza.anchoMm);
    const altoMm = Number(pieza.altoMm);
    return cantidad > 0 && anchoMm > 0 && altoMm > 0
      ? [{ ...pieza, cantidad, anchoMm, altoMm }]
      : [];
  });
}

/**
 * Contexto estándar de una operación que trabaja sobre componentes. Una
 * vinculación a la plantilla incluye también todas sus ocurrencias creadas al
 * cotizar, y publica magnitudes agregadas sin borrar la cantidad del padre.
 */
export function agregarContextoComponentesVinculados(args: {
  contextoPadre: Record<string, unknown>;
  componentes: ComponenteVinculable[];
  codigosPlantilla: string[];
}): Record<string, unknown> {
  const codigos = new Set(args.codigosPlantilla);
  const vinculados = args.componentes.filter((componente) =>
    codigos.has(componente.plantillaCodigo ?? componente.codigo),
  );
  if (!vinculados.length) return { ...args.contextoPadre };

  const piezas = vinculados.flatMap(piezasDelComponente);
  const cantidadPiezas = vinculados.reduce((total, componente) => {
    const piezasComponente = piezasDelComponente(componente);
    return (
      total +
      (piezasComponente.length
        ? piezasComponente.reduce(
            (subtotal, pieza) => subtotal + pieza.cantidad,
            0,
          )
        : Number(componente.cantidad))
    );
  }, 0);
  const areaM2 = piezas.reduce(
    (total, pieza) =>
      total + (pieza.anchoMm * pieza.altoMm * pieza.cantidad) / 1_000_000,
    0,
  );
  const perimetroM = piezas.reduce(
    (total, pieza) =>
      total + ((2 * (pieza.anchoMm + pieza.altoMm)) / 1_000) * pieza.cantidad,
    0,
  );

  return {
    ...args.contextoPadre,
    cantidadComponentes: cantidadPiezas,
    cantidadPiezasComponentes: cantidadPiezas,
    componentesVinculados: vinculados.map((componente) => componente.codigo),
    ...(piezas.length
      ? {
          piezas,
          piezaAreaTotalM2: areaM2,
          piezaPerimetroTotalM: perimetroM,
          piezaAnchoMaxMm: Math.max(...piezas.map((pieza) => pieza.anchoMm)),
          piezaAltoMaxMm: Math.max(...piezas.map((pieza) => pieza.altoMm)),
        }
      : {}),
  };
}

function rutaPasoIdDelContenedor(clave: string) {
  return clave.replace(/^(ruta|extra):/, '');
}

/**
 * Convierte los cálculos privados de una etapa compuesta en un único paso
 * operativo. El costo ya fue calculado por el motor; acá sólo se consolida la
 * proyección que consumen cotización, OT y Tablero.
 */
export function consolidarEtapasCompuestas(
  pasos: PasoEjecutado[],
): PasoEjecutado[] {
  const grupos = new Map<string, PasoEjecutado[]>();
  for (const paso of pasos) {
    if (!paso.contenedorClave) continue;
    const actuales = grupos.get(paso.contenedorClave) ?? [];
    actuales.push(paso);
    grupos.set(paso.contenedorClave, actuales);
  }
  if (!grupos.size) return pasos;

  const emitidos = new Set<string>();
  const resultado: PasoEjecutado[] = [];

  for (const paso of pasos) {
    const clave = paso.contenedorClave;
    if (!clave) {
      resultado.push(paso);
      continue;
    }
    if (emitidos.has(clave)) continue;
    emitidos.add(clave);

    const internos = grupos.get(clave) ?? [];
    const activos = internos.filter((item) => item.activado);
    const base = activos[0] ?? internos[0];
    if (!base) continue;

    const tiempos = activos.flatMap((item) =>
      item.tiempo ? [item.tiempo] : [],
    );
    const centrosIds = new Set(
      tiempos.flatMap((item) =>
        item.centroCostoId ? [item.centroCostoId] : [],
      ),
    );
    const centrosNombres = new Set(
      tiempos.flatMap((item) =>
        item.centroCostoNombre ? [item.centroCostoNombre] : [],
      ),
    );
    const maquinas = new Set(
      tiempos.flatMap((item) => (item.maquinaId ? [item.maquinaId] : [])),
    );
    const tarifas = new Set(
      tiempos.flatMap((item) =>
        Number.isFinite(item.tarifaHora) ? [item.tarifaHora!] : [],
      ),
    );

    const tiempo = tiempos.length
      ? {
          ...tiempos[0],
          setupMin: tiempos.reduce((total, item) => total + item.setupMin, 0),
          runMin: tiempos.reduce((total, item) => total + item.runMin, 0),
          cleanupMin: tiempos.reduce(
            (total, item) => total + item.cleanupMin,
            0,
          ),
          tiempoFijoMin: tiempos.reduce(
            (total, item) => total + item.tiempoFijoMin,
            0,
          ),
          extraMin: tiempos.reduce(
            (total, item) => total + Number(item.extraMin ?? 0),
            0,
          ),
          tiemposExtra: tiempos.flatMap((item) => item.tiemposExtra ?? []),
          totalMin: tiempos.reduce((total, item) => total + item.totalMin, 0),
          centroCostoId: centrosIds.size === 1 ? [...centrosIds][0] : null,
          centroCostoNombre:
            centrosNombres.size === 1
              ? [...centrosNombres][0]
              : centrosNombres.size > 1
                ? 'Varios centros'
                : null,
          maquinaId: maquinas.size === 1 ? [...maquinas][0] : null,
          tarifaHora:
            centrosNombres.size === 1 && tarifas.size === 1
              ? [...tarifas][0]
              : undefined,
          dotacionOperarios: Math.max(
            1,
            ...tiempos.map((item) => Number(item.dotacionOperarios ?? 1)),
          ),
          costo: tiempos.reduce((total, item) => total + item.costo, 0),
        }
      : undefined;

    resultado.push({
      ...base,
      rutaPasoId: rutaPasoIdDelContenedor(clave),
      rutaPasoOrden: Math.min(...internos.map((item) => item.rutaPasoOrden)),
      nombreVisible: base.contenedorNombre ?? 'Etapa compuesta',
      contenedorClave: null,
      contenedorNombre: null,
      pasoInternoCodigo: null,
      componentesCodigos: [
        ...new Set(internos.flatMap((item) => item.componentesCodigos ?? [])),
      ],
      activado: activos.length > 0,
      tiempo,
      materiales: activos.flatMap((item) => item.materiales ?? []),
      cargosDirectosPaso: activos.flatMap(
        (item) => item.cargosDirectosPaso ?? [],
      ),
      operacionesIncorporacion: activos.flatMap(
        (item) => item.operacionesIncorporacion ?? [],
      ),
      operacionesInternas: internos.map((item) => ({
        codigo: item.pasoInternoCodigo ?? item.rutaPasoId ?? item.familiaCodigo,
        nombre: item.nombreVisible ?? item.familiaCodigo,
        familiaCodigo: item.familiaCodigo,
        activada: item.activado,
        duracionMin: item.tiempo?.totalMin ?? 0,
        costoTotal: item.costoTotal,
        configPasoId: item.configPasoId,
        rutaPasoId: item.rutaPasoId,
        rutaPasoOrden: item.rutaPasoOrden,
        razonNoActivado: item.razonNoActivado,
        activadoPorDependencia: item.activadoPorDependencia,
        centroCostoId: item.tiempo?.centroCostoId ?? null,
        centroCostoNombre: item.tiempo?.centroCostoNombre ?? null,
        tiempo: item.tiempo,
        materiales: item.materiales,
        cargosDirectosPaso: item.cargosDirectosPaso,
        mutacionAplicada: item.mutacionAplicada,
        componentesCodigos: item.componentesCodigos,
        nestingResult: item.nestingResult,
      })),
      tercerizado: false,
      proveedorId: null,
      plazoProveedorDias: null,
      costoTotal: activos.reduce((total, item) => total + item.costoTotal, 0),
      outputsCanonicos: Object.assign(
        {},
        ...activos.map((item) => item.outputsCanonicos ?? {}),
      ),
    });
  }

  return resultado.sort(
    (a, b) =>
      a.rutaPasoOrden - b.rutaPasoOrden ||
      a.rutaPasoId.localeCompare(b.rutaPasoId),
  );
}
