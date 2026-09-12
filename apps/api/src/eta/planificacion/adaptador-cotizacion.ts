import { admitePasoSinMaquina } from '../../productos-servicios/pasos/ruteo-maquina';
import { demandaDesdeTiempo } from '../motor/demanda-humana';
/** Adaptación F6 aislada. Consume cotizaciones del servidor, nunca JSON de cliente.
 * Reutiliza planes completos por cantidad; no prorratea tiempos ni corta placas.
 */
import { createHash } from 'node:crypto';
import type {
  CotizacionResultado,
  PasoEjecutado,
  ComponenteFabricadoCosteado,
  NestingEjecutado,
  MaterialEjecutado,
} from '../../motor-universal/tipos';
import {
  reducirGrafoAClaves,
  validarYOrdenarGrafo,
  type NodoGrafoProduccion,
  type AristaGrafoProduccion,
} from '../../ordenes-trabajo/grafo-produccion';
import { resolverFamilia } from '../../productos-servicios/pasos/familias';
import {
  motivoSinEstacion,
  resolverEstacionDePaso,
} from '../motor/tablero-tipos';
import {
  proponerEntregasPiloto,
  type EntradaPiloto,
  type OperacionPiloto,
} from './prototipo-entregas';

export type FuenteCotizacionF6 = {
  tenantId: string;
  /** Identifica una misma solicitud efectiva, excluyendo sólo su cantidad. */
  configuracionId: string;
  id: string;
  cotizacion: CotizacionResultado;
};
export type PiezaF6 = {
  id: string;
  nombre: string;
  porProducto: number;
  geometriaHash: string;
};
export type PlanGeometricoF6 = {
  /** El nesting rectangular se conserva entero por lote, sin asignar sus poses. */
  modo?: 'LOTE_COMPLETO';
  cantidadProductos: number;
  fuenteId: string;
  operacion: string;
  origenOperacion: string | null;
  placas: number;
  piezas: PiezaF6[];
  /** Referencias a copias enteras del snapshot original, sin duplicar CAD. */
  layouts: Array<{
    huella: string;
    placasIndices: number[];
    contenido: Record<string, number>;
  }>;
};
type NodoAdaptado = {
  operacion: OperacionPiloto;
  paso: PasoEjecutado;
  revision: string;
  ambito: string;
  plan: PlanGeometricoF6 | null;
};
type Ambito = {
  pasos: PasoEjecutado[];
  grafoProduccion?: CotizacionResultado['grafoProduccion'];
  componentes?: ComponenteFabricadoCosteado[];
  revision: string;
  cantidad: number;
  analisis?: CotizacionResultado['analisisNestingCompuesto'];
};
const hash = (v: unknown): string =>
  createHash('sha256')
    .update(
      JSON.stringify(v, (_k, x: unknown) =>
        x && typeof x === 'object' && !Array.isArray(x)
          ? Object.fromEntries(
              Object.entries(x).sort(([a], [b]) => a.localeCompare(b)),
            )
          : x,
      ),
    )
    .digest('hex');
const entero = (n: number) => Number.isSafeInteger(n) && n > 0;
const valido = (n: number) => Number.isFinite(n) && n >= 0;
/** El desgaste puede estar parametrizado en la máquina sin existir en stock.
 * Su identidad es la máquina y su componente/herramienta, nunca el ID vacío. */
function identidadConsumo(m: MaterialEjecutado, paso: PasoEjecutado): string {
  return m.tipoLineaCosto === 'DESGASTE_MAQUINA'
    ? `desgaste:${paso.tiempo?.maquinaId}:${m.slotCodigo}`
    : m.materialVarianteId;
}
function exigir(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion)
    throw new Error(`No se puede planificar esta cotización: ${mensaje}`);
}
const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

function resumirPlan(
  n: NestingEjecutado,
  cantidad: number,
  fuente: string,
  operacion: string,
  piezasHeredadas?: PiezaF6[],
): PlanGeometricoF6 {
  exigir(
    n.substrates.length &&
      n.substrates.every((s) => s.kind === 'sheet' && s.count === 1),
    'el piloto requiere placas físicas individualizadas.',
  );
  exigir(
    !n.loteNestingCompuesto && !n.layoutRegistradoLoteId,
    'el lote consolidado entre componentes requiere su adaptador operativo.',
  );
  const piezas =
    n.demandaNesting?.map((d) => ({
      id: d.id,
      nombre: d.propietario?.piezaNombre ?? d.id,
      porProducto: d.cantidad / cantidad,
      geometriaHash: hash(d.geometria),
    })) ?? piezasHeredadas;
  exigir(
    piezas?.length &&
      piezas.every((p) => entero(p.porProducto)) &&
      new Set(piezas.map((p) => p.id)).size === piezas.length,
    'falta demanda vectorial exacta por producto.',
  );
  const balance = new Map(piezas.map((p) => [p.id, 0]));
  const placas = Array.from(
    { length: n.substrates.length },
    () => [] as NestingEjecutado['placements'],
  );
  for (const p of n.placements) {
    exigir(
      balance.has(p.pieceId) &&
        Number.isInteger(p.substrateIndex) &&
        p.substrateIndex! >= 0 &&
        p.substrateIndex! < placas.length &&
        !p.panelCount,
      'hay una pieza desconocida, panelizada o sin placa.',
    );
    exigir(
      [p.xMm, p.yMm, p.widthMm, p.heightMm].every(valido) &&
        p.widthMm > 0 &&
        p.heightMm > 0,
      'hay posiciones inválidas.',
    );
    const placa = n.substrates[p.substrateIndex!];
    exigir(
      placa.kind === 'sheet' &&
        p.xMm + p.widthMm <= placa.widthMm + 0.01 &&
        p.yMm + p.heightMm <= placa.heightMm + 0.01,
      'hay piezas fuera de la placa.',
    );
    balance.set(p.pieceId, balance.get(p.pieceId)! + 1);
    placas[p.substrateIndex!].push(p);
  }
  exigir(
    n.piezasAcomodadas === n.placements.length &&
      piezas.every((p) => balance.get(p.id) === p.porProducto * cantidad),
    'el contenido de las placas no coincide con la demanda.',
  );
  const layouts = new Map<string, PlanGeometricoF6['layouts'][number]>();
  placas.forEach((ps, index) => {
    exigir(ps.length, 'hay placas sin contenido.');
    const contenido = Object.create(null) as Record<string, number>;
    ps.forEach((p) => {
      contenido[p.pieceId] = (contenido[p.pieceId] ?? 0) + 1;
    });
    // Incluye recorridos/capas, omite identidad de copia y etiquetas del usuario.
    const posiciones = ps
      .map((p) => ({
        id: p.pieceId,
        x: p.xMm,
        y: p.yMm,
        w: p.widthMm,
        h: p.heightMm,
        rotacion: objeto(p.meta).rotacionGrados ?? p.rotated,
        contornos: objeto(p.meta).contornos,
        operaciones: objeto(p.meta).operaciones,
        cortesInternos: objeto(p.meta).cortesInternos,
        fabricacion: objeto(p.meta).fabricacion,
      }))
      .map(hash)
      .sort();
    const huella = hash({
      sustrato: n.substrates[index],
      posiciones,
      perfil: n.perfil?.id,
      maquina: n.maquina?.id,
      material: n.sustrato?.materialVarianteId,
      modoColor: n.modoColor,
      tecnologia: n.tecnologia,
      caras: n.carasProcesadas,
      tintas: n.tintasAdicionales,
      visual: n.visualConfig,
    });
    const layout = layouts.get(huella) ?? {
      huella,
      placasIndices: [],
      contenido,
    };
    layout.placasIndices.push(index);
    layouts.set(huella, layout);
  });
  return {
    cantidadProductos: cantidad,
    fuenteId: fuente,
    operacion,
    origenOperacion: null,
    placas: placas.length,
    piezas,
    layouts: [...layouts.values()],
  };
}

/** Pliegos repetidos y rollos ya cotizados: se usa el acomodo entero de cada
 * entrega. No se deducen piezas finales desde la capacidad de un pliego ni se
 * reparten posiciones del pedido original. La huella exige aceptar su cambio. */
function resumirLoteRectangular(
  n: NestingEjecutado,
  cantidad: number,
  fuente: string,
  operacion: string,
): PlanGeometricoF6 {
  exigir(
    n.demandaRectangular?.length &&
      n.placements.length &&
      n.substrates.length &&
      !n.loteNestingCompuesto &&
      !n.layoutRegistradoLoteId &&
      n.demandaRectangular.every(
        (d) =>
          entero(d.cantidad) &&
          [d.anchoMm, d.altoMm].every(Number.isFinite) &&
          d.anchoMm > 0 &&
          d.altoMm > 0,
      ),
    'falta un acomodo rectangular completo para la entrega.',
  );
  exigir(
    n.substrates.every(
      (s) =>
        Number.isFinite(s.widthMm) &&
        s.widthMm > 0 &&
        (s.kind === 'sheet'
          ? entero(s.count) && Number.isFinite(s.heightMm) && s.heightMm > 0
          : Number.isFinite(s.lengthMm) && s.lengthMm > 0),
    ),
    'hay sustratos inválidos en el acomodo de la entrega.',
  );
  for (const p of n.placements) {
    const indice = p.substrateIndex ?? (n.substrates.length === 1 ? 0 : -1);
    const s = n.substrates[indice];
    exigir(
      Number.isInteger(indice) &&
        s &&
        [p.xMm, p.yMm, p.widthMm, p.heightMm].every(valido) &&
        p.widthMm > 0 &&
        p.heightMm > 0 &&
        p.xMm + p.widthMm <= s.widthMm + 0.01 &&
        p.yMm + p.heightMm <=
          (s.kind === 'sheet' ? s.heightMm : s.lengthMm) + 0.01,
      'hay piezas fuera del sustrato en el acomodo de la entrega.',
    );
  }
  exigir(
    n.piezasAcomodadas === n.placements.length,
    'el acomodo de la entrega tiene posiciones incompletas.',
  );
  return {
    modo: 'LOTE_COMPLETO',
    cantidadProductos: cantidad,
    fuenteId: fuente,
    operacion,
    origenOperacion: null,
    placas: n.substrates.reduce(
      (s, x) => s + (x.kind === 'sheet' ? x.count : 0),
      0,
    ),
    piezas: [],
    layouts: [
      {
        huella: hash({
          cantidad,
          sustratos: n.substrates,
          posiciones: n.placements,
          demanda: n.demandaRectangular,
          maquina: n.maquina?.id,
          perfil: n.perfil?.id,
          material: n.sustrato?.materialVarianteId,
          color: n.modoColor,
          tecnologia: n.tecnologia,
          caras: n.carasProcesadas,
          visual: n.visualConfig,
        }),
        placasIndices: [0],
        contenido: {},
      },
    ],
  };
}

/** Primero conecta el grafo completo (incluidos opcionales omitidos), después
 * reduce a operaciones activas. Así un ancestro omitido no borra la espera BOM.
 */
function extraer(fuente: FuenteCotizacionF6, porEntrega = false) {
  const q = fuente.cotizacion;
  exigir(
    entero(q.cantidadPedida) &&
      q.cantidadPedida === q.cantidadEfectiva &&
      q.unidadComercialPricing === 'unidad',
    'se requieren unidades enteras, sin sobreproducción.',
  );
  exigir(
    q.receta?.revisionId && q.receta.huella,
    'falta la revisión publicada.',
  );
  const nodos: NodoGrafoProduccion[] = [],
    aristas: AristaGrafoProduccion[] = [],
    activos = new Map<string, NodoAdaptado>();
  const visitar = (
    a: Ambito,
    ambito: string,
    profundidad = 0,
  ): { raices: string[]; terminales: string[] } => {
    exigir(
      profundidad < 10 && !a.analisis?.aplicadoACostos,
      'la composición consolidada o su profundidad aún no está soportada.',
    );
    exigir(
      a.grafoProduccion?.nodos?.length && a.grafoProduccion.aristas,
      'falta el grafo publicado.',
    );
    const g = validarYOrdenarGrafo(
      a.grafoProduccion.nodos.map((n, i) => ({ ...n, indice: n.indice ?? i })),
      a.grafoProduccion.aristas,
    );
    const clave = (k: string) => `${ambito}/${k}`;
    g.nodos.forEach((n) =>
      nodos.push({ ...n, clave: clave(n.clave), indice: nodos.length }),
    );
    g.aristas.forEach((e) =>
      aristas.push({
        desdeClave: clave(e.desdeClave),
        haciaClave: clave(e.haciaClave),
      }),
    );
    for (const p of a.pasos.filter((p) => p.activado)) {
      const local = [`ruta:${p.rutaPasoId}`, `extra:${p.rutaPasoId}`].filter(
        (k) => g.nodos.some((n) => n.clave === k),
      );
      exigir(
        local.length === 1 &&
          !p.tercerizado &&
          !p.operacionesInternas?.length &&
          !p.operacionesIncorporacion?.length,
        'el paso no tiene identidad única o requiere otro tipo de ejecución.',
      );
      const codigo = clave(local[0]),
        t = p.tiempo;
      for (const m of p.materiales ?? []) {
        const nombre =
          m.materialDisplayName || m.materialNombre || m.slotCodigo;
        const contexto = `«${nombre}» del paso «${p.nombreVisible || p.familiaCodigo}»`;
        exigir(
          m.tipoLineaCosto === 'DESGASTE_MAQUINA'
            ? p.tiempo?.maquinaId && m.slotCodigo
            : m.materialVarianteId,
          m.tipoLineaCosto === 'DESGASTE_MAQUINA'
            ? `falta identificar la máquina o el componente de desgaste ${contexto}.`
            : `el material ${contexto} no tiene una variante identificada.`,
        );
        exigir(
          m.unidad &&
            [m.cantidad, m.precioUnitario, m.costoTotal].every(valido),
          `hay consumos o costos inválidos en ${contexto}.`,
        );
      }
      exigir(
        !activos.has(codigo) &&
          t &&
          [t.totalMin, t.setupMin, p.costoTotal].every(valido) &&
          t.setupMin <= t.totalMin,
        'falta duración/costo válido de una operación.',
      );
      activos.set(codigo, {
        paso: p,
        ambito,
        revision: a.revision,
        plan: null,
        operacion: {
          codigo,
          nombre: p.nombreVisible || p.familiaCodigo,
          familiaCodigo: p.familiaCodigo,
          maquinaId: t.maquinaId ?? undefined,
          requiereMaquina: !admitePasoSinMaquina(p.familiaCodigo),
          centroCostoId: t.centroCostoId ?? undefined,
          plantillaCodigo:
            resolverFamilia(p.familiaCodigo)?.plantillaCodigo ?? null,
          tecnologia: p.nestingResult?.tecnologia ?? null,
          piezasPorProducto: a.cantidad / q.cantidadPedida,
          predecesoras: [],
          mediciones: [
            {
              cantidadProductos: q.cantidadPedida,
              preparacionMin: t.setupMin,
              demandaHumana: demandaDesdeTiempo(t),
              ejecucionMin: t.totalMin - t.setupMin,
              costo: p.costoTotal,
              fuente: fuente.id,
            },
          ],
        },
      });
    }
    for (const hijo of a.componentes ?? []) {
      exigir(
        hijo.codigo &&
          hijo.recetaRevisionId &&
          hijo.recetaHuella &&
          hijo.pasos &&
          !hijo.operacionesIncorporacion?.length,
        'falta información productiva del componente.',
      );
      const rama = visitar(
        {
          pasos: hijo.pasos,
          grafoProduccion: hijo.grafoProduccion,
          componentes: hijo.componentes,
          revision: `${hijo.recetaRevisionId}:${hijo.recetaHuella}`,
          cantidad: hijo.cantidad,
          analisis: hijo.analisisNestingCompuesto,
        },
        `${ambito}/${hijo.codigo}`,
        profundidad + 1,
      );
      for (const previa of hijo.nodosPredecesoresClaves ?? []) {
        exigir(
          g.nodos.some((n) => n.clave === previa),
          'la habilitación del componente no existe.',
        );
        rama.raices.forEach((raiz) =>
          aristas.push({ desdeClave: clave(previa), haciaClave: raiz }),
        );
      }
      exigir(
        hijo.nodoIncorporacionClave &&
          g.nodos.some((n) => n.clave === hijo.nodoIncorporacionClave),
        'falta el nodo de incorporación del componente.',
      );
      rama.terminales.forEach((terminal) =>
        aristas.push({
          desdeClave: terminal,
          haciaClave: clave(hijo.nodoIncorporacionClave!),
        }),
      );
    }
    return { raices: g.raices.map(clave), terminales: g.terminales.map(clave) };
  };
  visitar(
    {
      pasos: q.pasos,
      componentes: q.componentesFabricados,
      grafoProduccion: q.grafoProduccion,
      cantidad: q.cantidadPedida,
      revision: `${q.receta.revisionId}:${q.receta.huella}`,
      analisis: q.analisisNestingCompuesto,
    },
    'producto',
  );
  const grafo = reducirGrafoAClaves(
    validarYOrdenarGrafo(nodos, aristas),
    new Set(activos.keys()),
  );
  const ordenados = grafo.nodos.map((n) => activos.get(n.clave)!);
  for (const n of ordenados) {
    n.operacion.predecesoras = grafo.aristas
      .filter((e) => e.haciaClave === n.operacion.codigo)
      .map((e) => e.desdeClave);
    const nesting = n.paso.nestingResult;
    if (!nesting) continue;
    if (
      porEntrega &&
      !nesting.demandaNesting?.length &&
      nesting.demandaRectangular?.length &&
      !nesting.placements.some((p) => objeto(p.meta).layoutHeredadoDe)
    ) {
      n.plan = resumirLoteRectangular(
        nesting,
        q.cantidadPedida,
        fuente.id,
        n.operacion.codigo,
      );
      continue;
    }
    const fuentes = new Set(
      nesting.placements.flatMap((p) =>
        typeof objeto(p.meta).layoutHeredadoDe === 'string'
          ? [objeto(p.meta).layoutHeredadoDe as string]
          : [],
      ),
    );
    exigir(fuentes.size <= 1, 'un paso hereda más de un layout de origen.');
    const heredado = fuentes.size
      ? ordenados.find(
          (o) => o.ambito === n.ambito && fuentes.has(o.paso.rutaPasoId),
        )
      : undefined;
    if (fuentes.size)
      exigir(
        heredado?.plan &&
          n.operacion.predecesoras.includes(heredado.operacion.codigo),
        'el corte no conserva una dependencia directa con su impresión.',
      );
    n.plan = resumirPlan(
      nesting,
      q.cantidadPedida,
      fuente.id,
      n.operacion.codigo,
      heredado?.plan?.piezas,
    );
    if (heredado?.plan) {
      const posiciones = (p: NestingEjecutado) =>
        p.placements
          .map((x) => [
            x.pieceId,
            x.substrateIndex,
            x.xMm,
            x.yMm,
            x.widthMm,
            x.heightMm,
            x.rotated,
          ])
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      exigir(
        hash(posiciones(nesting)) ===
          hash(posiciones(heredado.paso.nestingResult!)),
        'impresión y corte no mantienen el mismo registro físico.',
      );
      n.plan.origenOperacion = heredado.operacion.codigo;
      n.operacion.particionVinculadaA = heredado.operacion.codigo;
    }
    n.operacion.piezasPorProducto = n.plan.piezas.reduce(
      (s, p) => s + p.porProducto,
      0,
    );
  }
  exigir(
    ordenados.length &&
      ordenados.every((n) => entero(n.operacion.piezasPorProducto)),
    'hay conversiones de unidad sin resolver.',
  );
  exigir(
    Math.abs(
      ordenados.reduce((s, n) => s + n.paso.costoTotal, 0) - q.costos.total,
    ) < 0.01,
    'los costos de operaciones no reconcilian con el total; hay cargos o costos fuera del alcance del piloto.',
  );
  return ordenados;
}

export type SolicitudAdaptadorF6 = Omit<EntradaPiloto, 'operaciones'> & {
  tenantId: string;
  configuracionId: string;
  fuentes: FuenteCotizacionF6[];
  /** Decisión del servidor sobre preparación reutilizable; nunca inferir por tiempo fijo. */
  operacionesUnaVez?: string[];
};

/** Lee la geometría guardada sin volver a resolverla ni copiar sus recorridos. */
export function planesGuardadosF6(
  fuente: FuenteCotizacionF6,
  porEntrega = false,
): PlanGeometricoF6[] {
  return extraer(fuente, porEntrega).flatMap((n) => (n.plan ? [n.plan] : []));
}
export function adaptarCotizacionesF6(s: SolicitudAdaptadorF6) {
  exigir(
    s.fuentes.length > 0 && s.fuentes.length <= 102,
    'faltan cotizaciones o se excede el presupuesto.',
  );
  const cantidades = new Set<number>(),
    ids = new Set<string>();
  const extraidas = s.fuentes.map((f) => {
    exigir(
      f.tenantId === s.tenantId &&
        f.configuracionId === s.configuracionId &&
        f.id &&
        !ids.has(f.id) &&
        !cantidades.has(f.cotizacion.cantidadPedida),
      'las fuentes mezclan tenants, configuración o cantidades duplicadas.',
    );
    cantidades.add(f.cotizacion.cantidadPedida);
    ids.add(f.id);
    return { fuente: f, nodos: extraer(f, s.porEntrega) };
  });
  const referencia = extraidas.find(
    (f) => f.fuente.cotizacion.cantidadPedida === s.cantidad,
  );
  exigir(referencia, 'falta la cotización completa de referencia.');
  const firma = (f: typeof referencia) =>
    hash({
      producto: f.fuente.cotizacion.productoId,
      ruta: f.fuente.cotizacion.rutaAlternativaId,
      periodo: f.fuente.cotizacion.periodoTarifario,
      nodos: f.nodos.map((n) => ({
        codigo: n.operacion.codigo,
        revision: n.revision,
        recurso: [
          n.operacion.maquinaId,
          n.operacion.centroCostoId,
          n.operacion.familiaCodigo,
          n.operacion.tecnologia,
          n.paso.tiempo?.tarifaHora,
        ],
        predecesoras: n.operacion.predecesoras,
        piezas: n.plan?.piezas,
        factor: n.operacion.piezasPorProducto,
        registro: n.operacion.particionVinculadaA,
        perfil: n.paso.nestingResult?.perfil?.id,
        color: n.paso.nestingResult?.modoColor,
        materiales: n.paso.materiales?.map((m) => [
          m.tipoLineaCosto,
          identidadConsumo(m, n.paso),
          m.materialVarianteId,
          m.unidad,
          m.precioUnitario,
        ]),
      })),
    });
  const firmaBase = firma(referencia);
  exigir(
    extraidas.every((f) => firma(f) === firmaBase),
    'cambió la receta, geometría, material, tarifa, recurso o flujo entre cantidades.',
  );
  const condiciones = [...s.condicionesPendientes];
  const operaciones = referencia.nodos.map((n) => {
    const mediciones = extraidas.map(
      (f) =>
        f.nodos.find((x) => x.operacion.codigo === n.operacion.codigo)!
          .operacion.mediciones[0],
    );
    const tiempos = extraidas.map(
      (f) =>
        f.nodos.find((x) => x.operacion.codigo === n.operacion.codigo)!.paso
          .tiempo!,
    );
    const unaVez = s.operacionesUnaVez?.includes(n.operacion.codigo) ?? false;
    if (unaVez)
      exigir(
        !n.plan &&
          !n.operacion.predecesoras.length &&
          mediciones.every(
            (m) =>
              m.costo === mediciones[0].costo &&
              m.preparacionMin + m.ejecucionMin ===
                mediciones[0].preparacionMin + mediciones[0].ejecucionMin,
          ),
        'la preparación única debe ser raíz, sin geometría ni variaciones de cantidad.',
      );
    if (
      !unaVez &&
      tiempos.length > 1 &&
      tiempos.every(
        (t) => t.tiempoFijoMin > 0 && t.totalMin === tiempos[0].totalMin,
      )
    )
      condiciones.push(
        `${n.operacion.nombre}: ${tiempos[0].totalMin} minutos fijos para todas las cantidades evaluadas; validar su parametrización.`,
      );
    return { ...n.operacion, mediciones, unaVezPorPedido: unaVez };
  });
  exigir(
    (s.operacionesUnaVez ?? []).every((c) =>
      operaciones.some((o) => o.codigo === c),
    ),
    'la política de preparación menciona una operación inexistente.',
  );
  for (const operacion of operaciones) {
    const estacion = resolverEstacionDePaso(s.taller.estaciones, {
      ...operacion,
      centroCostoId: operacion.centroCostoId ?? null,
    });
    if (!estacion)
      condiciones.push(
        `${operacion.nombre}: ${motivoSinEstacion(s.taller.estaciones, { ...operacion, centroCostoId: operacion.centroCostoId ?? null })}`,
      );
    else if (!estacion.calendario)
      condiciones.push(
        `${operacion.nombre}: falta confirmar el calendario de su estación.`,
      );
  }
  const entrada: EntradaPiloto = {
    cantidad: s.cantidad,
    entregas: s.entregas,
    taller: s.taller,
    margenDiasHabiles: s.margenDiasHabiles,
    prioridadSinFechas: s.prioridadSinFechas,
    condicionesPendientes: condiciones,
    operaciones,
    porEntrega: s.porEntrega,
  };
  return {
    entrada,
    configuracionHuella: firmaBase,
    planes: extraidas.flatMap((f) =>
      f.nodos.flatMap((n) => (n.plan ? [n.plan] : [])),
    ),
    fuentes: s.fuentes.map((f) => ({
      id: f.id,
      cantidad: f.cotizacion.cantidadPedida,
      revision: f.cotizacion.receta,
      periodo: f.cotizacion.periodoTarifario,
    })),
    observaciones: condiciones,
  };
}

export function planificarCotizacionesF6(s: SolicitudAdaptadorF6) {
  const adaptado = adaptarCotizacionesF6(s);
  const resultado = proponerEntregasPiloto(adaptado.entrada);
  const pasosPorFuente = new Map<string, Map<string, PasoEjecutado>>();
  for (const f of s.fuentes) {
    const indice = new Map<string, PasoEjecutado>();
    const visitar = (
      pasos: PasoEjecutado[],
      hijos: ComponenteFabricadoCosteado[],
      ambito: string,
    ) => {
      pasos.forEach((p) => {
        indice.set(`${ambito}/ruta:${p.rutaPasoId}`, p);
        indice.set(`${ambito}/extra:${p.rutaPasoId}`, p);
      });
      hijos.forEach((h) =>
        visitar(h.pasos ?? [], h.componentes ?? [], `${ambito}/${h.codigo}`),
      );
    };
    visitar(
      f.cotizacion.pasos,
      f.cotizacion.componentesFabricados ?? [],
      'producto',
    );
    pasosPorFuente.set(f.id, indice);
  }
  return {
    ...adaptado,
    resultado,
    detalles: resultado.alternativas.map((a) => {
      const lotesGeometricos = a.operaciones.flatMap((o) => {
        const p = adaptado.planes.find(
          (p) =>
            p.operacion === o.operacion &&
            p.cantidadProductos === o.cantidadProductos,
        );
        return p
          ? [{ loteId: o.id, desde: o.desde, hasta: o.hasta, ...p }]
          : [];
      });
      const materiales = new Map<
        string,
        {
          id: string;
          nombre: string;
          unidad: string;
          cantidad: number;
          costo: number;
        }
      >();
      for (const o of a.operaciones) {
        const p = o.medicion
          ? pasosPorFuente.get(o.medicion.fuente)?.get(o.operacion)
          : undefined;
        if (!p) continue;
        for (const m of p.materiales ?? []) {
          const id = identidadConsumo(m, p);
          const key = `${id}:${m.unidad}`;
          const fila = materiales.get(key) ?? {
            id,
            nombre: m.materialDisplayName || m.materialNombre,
            unidad: m.unidad,
            cantidad: 0,
            costo: 0,
          };
          fila.cantidad += m.cantidad;
          fila.costo += m.costoTotal;
          materiales.set(key, fila);
        }
      }
      return {
        alternativaId: a.id,
        lotesGeometricos,
        placasNuevas: lotesGeometricos
          .filter((l) => !l.origenOperacion)
          .reduce((sum, l) => sum + l.placas, 0),
        materiales: [...materiales.values()],
      };
    }),
  };
}
