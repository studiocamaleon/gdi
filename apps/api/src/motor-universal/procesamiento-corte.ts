import type { FaseRun } from '../eta/motor/demanda-humana';
import { createHash } from 'node:crypto';
import {
  erroresConfiguracionCorte,
  erroresPerfilCorte,
  registroCorte,
  NOMBRES_OPERACION_CORTE,
  type ConfiguracionProcesamientoCorte,
  type DetallePerfilCorte,
  type OperacionCorte,
  type OperacionCorteCosteada,
  type ProcesamientoCorteCosteado,
} from '../maquinaria/procesamiento-corte';
import type { JobContext, PasoCargado } from './tipos';
import type { PiezaVectorial } from './geometria-vectorial/tipos';
import type { NestingDispatchResult } from './nesting-dispatcher';
import { longitudOperacion } from './geometria-vectorial/operaciones-vectoriales';
import { runMinPorProductividad } from './productividad-tiempo';

type Perfil = NonNullable<PasoCargado['perfilesDisponibles']>[number];
export type MaterialCorte = {
  id?: string;
  materiaPrimaId?: string | null;
  canonicalMaterialKey?: string | null;
  atributosVarianteJson?: Record<string, unknown> | null;
};
type Medicion = OperacionCorteCosteada['fuentes'][number] & {
  operacion: OperacionCorte;
  entradas: number;
};
export type PreparacionCorte = {
  configuracion: ConfiguracionProcesamientoCorte;
  materialId: string;
  materialVarianteId?: string;
  espesorMm: number;
  perfiles: Partial<Record<OperacionCorte, Perfil>>;
  firmaConfiguracion: string;
};
export function usaProcesamientoCorte(paso: PasoCargado): boolean {
  return (
    registroCorte(paso.paramsPasoJson).cotizarOperacionesVectoriales === true
  );
}
function medirPieza(
  pieza: Pick<
    PiezaVectorial,
    | 'id'
    | 'contornos'
    | 'operaciones'
    | 'fabricacion'
    | 'cortesInternos'
    | 'segmentacion'
  >,
  cantidad: number,
): Medicion[] {
  if (pieza.segmentacion)
    throw new Error(
      'Las operaciones de piezas segmentadas requieren una interpretación por segmento antes de cotizar.',
    );
  const resultado: Medicion[] = [];
  const agregar = (
    operacion: OperacionCorte,
    entidadId: string,
    capa: string,
    longitudMm: number,
    fuente?: { geometriaId: string; archivoHash: string },
  ) => {
    if (!Number.isFinite(longitudMm) || longitudMm <= 0)
      throw new Error(
        `No se puede medir ${NOMBRES_OPERACION_CORTE[operacion]} en ${pieza.id}.`,
      );
    resultado.push({
      operacion,
      piezaId: pieza.id,
      entidadId,
      capa,
      metros: (longitudMm * cantidad) / 1000,
      entradas: cantidad,
      ...fuente,
    });
  };
  if (pieza.fabricacion) {
    const f = pieza.fabricacion,
      ids = new Set<string>();
    for (const e of f.entidades) {
      if (!e.conservar) continue;
      if (ids.has(e.entidadId))
        throw new Error('La interpretación contiene entidades duplicadas.');
      ids.add(e.entidadId);
      const operacion = Object.hasOwn(e, 'operacion')
        ? e.operacion
        : e.rol === 'CORTE_EXTERIOR' || e.rol === 'CORTE_INTERIOR'
          ? 'CORTE_COMPLETO'
          : e.rol === 'CORTE_PARCIAL'
            ? 'CORTE_PARCIAL'
            : e.rol === 'HENDIDO'
              ? 'HENDIDO'
              : null;
      if (operacion)
        agregar(
          operacion,
          e.entidadId,
          e.capa,
          e.longitudMm ??
            longitudOperacion({ puntos: e.puntos, cerrada: e.cerrada }),
          { geometriaId: f.geometriaId, archivoHash: f.archivoHash },
        );
    }
    if (!resultado.some((r) => r.operacion === 'CORTE_COMPLETO'))
      throw new Error(
        'La interpretación no contiene un contorno de corte completo.',
      );
  } else {
    [...pieza.contornos, ...(pieza.cortesInternos ?? [])].forEach((c, i) =>
      agregar(
        'CORTE_COMPLETO',
        `contorno-${i}`,
        'CORTE',
        longitudOperacion({ puntos: c.puntos, cerrada: true }),
      ),
    );
    for (const op of pieza.operaciones ?? [])
      agregar(
        op.tipo === 'CORTE_INTERIOR' ? 'CORTE_COMPLETO' : op.tipo,
        op.entidadId,
        op.capa,
        longitudOperacion(op),
      );
  }
  return resultado;
}
function medirContexto(ctx: JobContext): Medicion[] {
  if (!ctx.geometriaVectorial?.piezas.length)
    throw new Error(
      'Cargá e interpretá las piezas vectoriales para cotizar sus operaciones.',
    );
  return ctx.geometriaVectorial.piezas.flatMap((p) =>
    medirPieza(p, ctx.cantidad * (p.cantidadPorUnidad ?? 1)),
  );
}
export function prepararProcesamientoCorte(
  paso: PasoCargado,
  ctx: JobContext,
  material: MaterialCorte | null,
): PreparacionCorte {
  const raw = paso.maquina?.parametrosTecnicosJson?.procesamientoCorte;
  const problemas = erroresConfiguracionCorte(raw, paso.maquina?.plantilla);
  if (problemas.length) throw new Error(problemas.join(' '));
  const configuracion = structuredClone(raw) as ConfiguracionProcesamientoCorte;
  const attrs = material?.atributosVarianteJson ?? {};
  const espesorMm = Number(
    attrs.espesorMm ?? attrs.espesor_mm ?? attrs.espesor,
  );
  if (
    !(espesorMm > 0) ||
    !Number.isFinite(espesorMm) ||
    !material?.materiaPrimaId
  )
    throw new Error(
      'Las operaciones necesitan el material y espesor de la placa; configurá el sustrato del nodo de corte.',
    );
  if (
    paso.maquina?.espesorMaximo != null &&
    espesorMm > paso.maquina.espesorMaximo
  )
    throw new Error(
      'El espesor del material supera la capacidad de la máquina.',
    );
  const operacionIds = new Set(medirContexto(ctx).map((m) => m.operacion));
  const perfiles: PreparacionCorte['perfiles'] = {};
  const explicitos = registroCorte(
    registroCorte(paso.paramsPasoJson).perfilesOperacionCorte,
  );
  const disponibles = paso.perfilesDisponibles ?? [];
  for (const operacion of operacionIds) {
    const candidatos = disponibles.filter((p) => {
      const d = registroCorte(p.detalleJson);
      return (
        p.activo &&
        d.procesamientoCorteVersion === 1 &&
        d.operacionCorte === operacion &&
        Array.isArray(d.material) &&
        (d.material.includes(material.materiaPrimaId) ||
          Boolean(
            material.canonicalMaterialKey &&
            d.material.includes(material.canonicalMaterialKey),
          )) &&
        espesorMm >= Number(d.espesorMinMm) &&
        espesorMm <= Number(d.espesorMaxMm)
      );
    });
    const elegibles = explicitos[operacion]
      ? candidatos.filter((p) => p.id === explicitos[operacion])
      : candidatos;
    if (elegibles.length !== 1)
      throw new Error(
        elegibles.length
          ? `${NOMBRES_OPERACION_CORTE[operacion]} tiene varios perfiles compatibles. Elegí uno en las operaciones del producto.`
          : `${NOMBRES_OPERACION_CORTE[operacion]} no tiene un perfil válido para este material y espesor en ${paso.maquina?.nombre}.`,
      );
    const perfil = elegibles[0];
    const errores = erroresPerfilCorte(perfil, configuracion);
    if (errores.length)
      throw new Error(`${perfil.nombre}: ${errores.join(' ')}`);
    perfiles[operacion] = structuredClone(perfil);
  }
  const firmaConfiguracion = createHash('sha256')
    .update(
      JSON.stringify({
        configuracion,
        materialId: material.materiaPrimaId,
        materialVarianteId: material.id,
        espesorMm,
        perfiles: disponibles
          .filter(
            (p) =>
              p.activo &&
              registroCorte(p.detalleJson).procesamientoCorteVersion === 1,
          )
          .map((p) => ({
            id: p.id,
            detalle: p.detalleJson,
            velocidad: p.productivityValue,
            unidad: p.productivityUnit,
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        explicitos: Object.entries(explicitos)
          .filter(([, v]) => v != null)
          .sort(([a], [b]) => a.localeCompare(b)),
      }),
    )
    .digest('hex');
  return {
    configuracion,
    espesorMm,
    materialId: material.materiaPrimaId,
    materialVarianteId: material.id,
    perfiles,
    firmaConfiguracion,
  };
}
export type PlanOperacionesCorte = Pick<
  NestingDispatchResult,
  'placements' | 'substrates' | 'commonLine'
>;
export function calcularProcesamientoCorte(
  paso: Pick<PasoCargado, 'maquina'>,
  ctx: JobContext,
  preparacion: PreparacionCorte,
  nesting: PlanOperacionesCorte | null,
): ProcesamientoCorteCosteado {
  const { configuracion, perfiles } = preparacion;
  if (
    !nesting?.placements.length ||
    nesting.substrates.some((s) => s.kind !== 'sheet')
  )
    throw new Error(
      'Las operaciones de corte necesitan un plan de placas con las piezas ubicadas.',
    );
  const placas = nesting.substrates.reduce(
    (n, s) => n + (s.kind === 'sheet' ? s.count : 0),
    0,
  );
  const porPlaca = new Map<number, Medicion[]>();
  for (const p of nesting.placements) {
    const meta = registroCorte(p.meta);
    if (!Array.isArray(meta.contornos))
      throw new Error(
        'El plan no conserva los recorridos de todas las piezas. Volvé a calcularlo con la fuente vectorial.',
      );
    const mediciones = medirPieza(
      {
        id: p.pieceId,
        contornos: meta.contornos as PiezaVectorial['contornos'],
        operaciones: meta.operaciones as PiezaVectorial['operaciones'],
        fabricacion: meta.fabricacion as PiezaVectorial['fabricacion'],
        cortesInternos: meta.cortesInternos as PiezaVectorial['cortesInternos'],
        segmentacion: meta.segmentacion as PiezaVectorial['segmentacion'],
      },
      1,
    );
    const index = p.substrateIndex ?? 0;
    porPlaca.set(index, [...(porPlaca.get(index) ?? []), ...mediciones]);
  }
  if (porPlaca.size !== placas)
    throw new Error(
      'El número de placas no coincide con los recorridos del plan.',
    );
  const originales = medirContexto(ctx),
    medidas = [...porPlaca.values()].flat();
  for (const op of new Set(
    [...originales, ...medidas].map((m) => m.operacion),
  )) {
    const antes = originales
      .filter((m) => m.operacion === op)
      .reduce((s, m) => s + m.metros, 0);
    const despues = medidas
      .filter((m) => m.operacion === op)
      .reduce((s, m) => s + m.metros, 0);
    if (Math.abs(antes - despues) > Math.max(1e-6, antes * 1e-8))
      throw new Error(
        `El plan cambió la cantidad de recorridos de ${NOMBRES_OPERACION_CORTE[op]}.`,
      );
  }
  const operaciones: OperacionCorteCosteada[] = [];
  const orden: OperacionCorte[] = [
    'HENDIDO',
    'CORTE_PARCIAL',
    'CORTE_COMPLETO',
  ];
  for (const operacion of orden) {
    const fuente = medidas.filter((m) => m.operacion === operacion);
    if (!fuente.length) continue;
    const perfil = perfiles[operacion];
    if (!perfil)
      throw new Error(
        `Falta el perfil de ${NOMBRES_OPERACION_CORTE[operacion]}.`,
      );
    const parametros = registroCorte(perfil.detalleJson) as DetallePerfilCorte;
    const herramienta = configuracion.herramientas.find(
      (h) => h.id === parametros.herramientaId,
    )!;
    const metros = fuente.reduce((s, m) => s + m.metros, 0);
    const entradas = fuente.reduce((s, m) => s + m.entradas, 0);
    const ahorroRecorridoM =
      operacion === 'CORTE_COMPLETO' && nesting.commonLine?.aplicado
        ? nesting.commonLine.ahorroRecorridoMm / 1000
        : 0;
    if (
      !Number.isFinite(ahorroRecorridoM) ||
      ahorroRecorridoM < 0 ||
      ahorroRecorridoM > metros
    )
      throw new Error('El ahorro de recorridos del plan es inválido.');
    const metrosNetos = metros - ahorroRecorridoM;
    const metrosProcesados = metrosNetos * parametros.pasadas;
    const recorridoMin =
      runMinPorProductividad(
        parametros.modoVelocidad === 'POR_PASADA'
          ? metrosProcesados
          : metrosNetos,
        perfil.productivityValue!,
        perfil.productivityUnit,
      ) +
      (entradas * (parametros.entradaSeg ?? 0) * parametros.pasadas) / 60;
    const desgaste = herramienta.desgaste;
    const desgasteCosto =
      desgaste.modo === 'INCLUIDO_CENTRO'
        ? 0
        : (desgaste.costoReposicion! / desgaste.vidaUtil!) *
          (desgaste.modo === 'POR_METRO'
            ? metrosProcesados
            : recorridoMin / 60);
    operaciones.push({
      operacion,
      perfilId: perfil.id,
      perfilNombre: perfil.nombre,
      herramienta: structuredClone(herramienta),
      parametros: structuredClone(parametros),
      velocidad: perfil.productivityValue!,
      unidadVelocidad: perfil.productivityUnit!,
      metros,
      ahorroRecorridoM,
      metrosProcesados,
      entradas,
      recorridoMin,
      ajusteMin: 0,
      desgasteCosto,
      fuentes: fuente.map(
        ({ piezaId, geometriaId, archivoHash, entidadId, capa, metros }) => ({
          piezaId,
          geometriaId,
          archivoHash,
          entidadId,
          capa,
          metros,
        }),
      ),
    });
  }
  // Una misma posición admite una herramienta por vez. Conservamos el montaje
  // entre placas y contamos sólo reemplazos físicos; los cambios de perfil son ajustes.
  const montadas = new Map(
    configuracion.herramientas
      .filter((h) => h.activo && h.montada)
      .map((h) => [h.posicion, h.id]),
  );
  const fasesRun: FaseRun[] = [];
  let secuenciaCompleta = true;
  function fase(minutos: number, operario: boolean) {
    if (minutos <= 0 || !secuenciaCompleta) return;
    const anterior = fasesRun.at(-1);
    if (anterior?.operario === operario) anterior.minutos += minutos;
    else if (fasesRun.length < 19900) fasesRun.push({ minutos, operario });
    else secuenciaCompleta = false;
  }
  let cambiosHerramienta = 0,
    activaciones = 0,
    herramientaAnterior: string | undefined;
  for (const [, mediciones] of [...porPlaca].sort(([a], [b]) => a - b)) {
    // El parámetro existente agrupa carga y descarga: se reserva como manejo
    // de placa en el límite del ciclo, junto al registro. No se inventa un
    // reparto entre carga y descarga que el perfil no distingue.
    fase(
      configuracion.cargaDescargaPlacaMin + configuracion.registroPlacaMin,
      true,
    );
    for (const op of operaciones) {
      if (!mediciones.some((m) => m.operacion === op.operacion)) continue;
      const h = op.herramienta;
      if (montadas.get(h.posicion) !== h.id) {
        cambiosHerramienta++;
        fase(configuracion.cambioMin, true);
        montadas.set(h.posicion, h.id);
      }
      if (herramientaAnterior !== h.id) {
        activaciones++;
        fase(configuracion.activacionSeg / 60, true);
        herramientaAnterior = h.id;
      }
      op.ajusteMin += op.parametros.ajusteMin ?? 0;
      fase(op.parametros.ajusteMin ?? 0, true);
      const fuentesPlaca = mediciones.filter(
        (m) => m.operacion === op.operacion,
      );
      const metrosPlaca = fuentesPlaca.reduce((n, m) => n + m.metros, 0);
      const entradasPlaca = fuentesPlaca.reduce((n, m) => n + m.entradas, 0);
      // La reducción global de common-line se reparte por recorrido. Conserva
      // exactamente el costo y el tiempo de recorrido ya calculados.
      const metrosNetos =
        metrosPlaca *
        (op.metros > 0 ? (op.metros - op.ahorroRecorridoM) / op.metros : 1);
      fase(
        runMinPorProductividad(
          op.parametros.modoVelocidad === 'POR_PASADA'
            ? metrosNetos * op.parametros.pasadas
            : metrosNetos,
          op.velocidad,
          op.unidadVelocidad,
        ) +
          (entradasPlaca *
            (op.parametros.entradaSeg ?? 0) *
            op.parametros.pasadas) /
            60,
        false,
      );
    }
  }
  const ajustesMin = operaciones.reduce((s, o) => s + o.ajusteMin, 0);
  const recorridoMin = operaciones.reduce((s, o) => s + o.recorridoMin, 0);
  const manejoMin =
    placas *
    (configuracion.cargaDescargaPlacaMin + configuracion.registroPlacaMin);
  const cambiosMin =
    cambiosHerramienta * configuracion.cambioMin +
    (activaciones * configuracion.activacionSeg) / 60;
  return {
    version: 1,
    maquinaId: paso.maquina!.id,
    configuracion: structuredClone(configuracion),
    firmaConfiguracion: preparacion.firmaConfiguracion,
    materialId: preparacion.materialId,
    materialVarianteId: preparacion.materialVarianteId,
    espesorMm: preparacion.espesorMm,
    operaciones,
    placas,
    manejoMin,
    ...(secuenciaCompleta ? { fasesRun } : {}),
    cambiosMin,
    cambiosHerramienta,
    activaciones,
    ajustesMin,
    recorridoMin,
    runMin: recorridoMin + manejoMin + cambiosMin + ajustesMin,
    desgasteCosto: operaciones.reduce((s, o) => s + o.desgasteCosto, 0),
  };
}

/** Recalcula una nueva distribución física con parámetros ya cotizados.
 * No consulta maquinaria ni perfiles vivos: la cotización sigue siendo reproducible. */
export function recalcularOperacionesCongeladas(
  snapshots: ProcesamientoCorteCosteado[],
  plan: PlanOperacionesCorte,
): ProcesamientoCorteCosteado {
  const base = snapshots[0];
  if (
    !base ||
    snapshots.some(
      (s) =>
        s.firmaConfiguracion !== base.firmaConfiguracion ||
        s.maquinaId !== base.maquinaId ||
        s.redondeo !== base.redondeo,
    )
  )
    throw new Error(
      'Las operaciones del lote no comparten la misma configuración cotizada.',
    );
  const perfiles: PreparacionCorte['perfiles'] = {};
  for (const s of snapshots)
    for (const o of s.operaciones) {
      const anterior = perfiles[o.operacion];
      if (
        anterior &&
        (anterior.id !== o.perfilId ||
          JSON.stringify(anterior.detalleJson) !== JSON.stringify(o.parametros))
      )
        throw new Error(
          'El lote mezcla recetas distintas para una misma operación.',
        );
      perfiles[o.operacion] = {
        id: o.perfilId,
        nombre: o.perfilNombre,
        activo: true,
        detalleJson: structuredClone(o.parametros),
        productivityValue: o.velocidad,
        productivityUnit: o.unidadVelocidad,
        setupMin: 0,
        cleanupMin: 0,
      };
    }
  const piezas = plan.placements.map((p) => ({
    ...registroCorte(p.meta),
    id: p.pieceId,
    cantidadPorUnidad: 1,
  })) as PiezaVectorial[];
  const recalculado = calcularProcesamientoCorte(
    { maquina: { id: base.maquinaId } as PasoCargado['maquina'] },
    { cantidad: 1, geometriaVectorial: { piezas } } as JobContext,
    { ...base, perfiles },
    plan,
  );
  // La suma debe conservar cada operación aun si cambiaron los IDs del nesting.
  for (const op of recalculado.operaciones) {
    const antes = snapshots.reduce(
      (s, v) =>
        s +
        (v.operaciones.find((o) => o.operacion === op.operacion)?.metros ?? 0),
      0,
    );
    if (Math.abs(antes - op.metros) > Math.max(1e-6, antes * 1e-8))
      throw new Error('El lote no conserva la demanda de recorridos cotizada.');
  }
  if (
    snapshots.some((s) =>
      s.operaciones.some(
        (o) =>
          !recalculado.operaciones.some((r) => r.operacion === o.operacion),
      ),
    )
  )
    throw new Error('El lote perdió una operación cotizada.');
  return { ...recalculado, redondeo: base.redondeo };
}
