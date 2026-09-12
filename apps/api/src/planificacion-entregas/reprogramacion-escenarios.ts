import type { AtencionPlanificada } from '../eta/motor/agenda-atencion';
import { createHash } from 'node:crypto';
import {
  claveFechaEnZona,
  diaSemanaDeClave,
  sumarDiasAClave,
} from '../common/zona';
import { simularFlujo, sumarDiasHabiles } from '../eta/motor/flujo-produccion';
import type { TableroItemData } from '../eta/motor/tablero-tipos';
import type {
  AlternativaPiloto,
  ContextoPiloto,
  OperacionPiloto,
} from '../eta/planificacion/prototipo-entregas';

export type ImpactoEntrega = {
  ordenId: string;
  ordenNumero: string;
  itemIds: string[];
  raizId: string;
  loteId: string | null;
  nombre: string;
  fechaActual: string | null;
  fechaPropuesta: string | null;
  finAnterior: string;
  finPropuesto: string;
  margenAnterior: number | null;
  margenRestante: number | null;
  demoraHabiles: number;
  cambiaEntrega: boolean;
};
export type ReprogramacionPropuesta = {
  nivel: 'CON_MARGEN' | 'MARGEN_REDUCIDO' | 'CAMBIA_ENTREGAS';
  ordenesMovidas: string[];
  cambios: {
    pasoId: string;
    ordenId: string;
    ordenNumero: string;
    item: string;
    operacion: string;
    recurso: string;
    inicioAnterior: string;
    finAnterior: string;
    inicio: string;
    fin: string;
  }[];
  entregasAfectadas: ImpactoEntrega[];
  /** Agenda completa pendiente. IDs hipotéticos se resuelven al materializar. */
  agenda: {
    pasoId: string;
    inicio: string;
    fin: string;
    atencionPlanificada?: AtencionPlanificada;
  }[];
};
export type AlternativaReprogramada = AlternativaPiloto & {
  reprogramacion?: ReprogramacionPropuesta;
};

export function diasHabilesEntre(
  desde: string,
  hasta: string,
  noLaborables: Set<string> = new Set(),
): number {
  if (desde > hasta) return -diasHabilesEntre(hasta, desde, noLaborables);
  let n = 0;
  for (let f = desde, i = 0; f < hasta && i < 3660; i++) {
    f = sumarDiasAClave(f, 1);
    const d = diaSemanaDeClave(f);
    if (d !== 'sab' && d !== 'dom' && !noLaborables.has(f)) n++;
  }
  return n;
}

export function gruposCompromiso(items: TableroItemData[]) {
  const porId = new Map(items.map((i) => [i.id, i]));
  const grupos = new Map<string, TableroItemData[]>();
  for (const item of items) {
    let raiz = item;
    const vistos = new Set([item.id]);
    while (
      raiz.parentItemId &&
      porId.has(raiz.parentItemId) &&
      !vistos.has(raiz.parentItemId)
    ) {
      const padre = porId.get(raiz.parentItemId)!;
      if (item.loteEntregaId && padre.loteEntregaId !== item.loteEntregaId)
        break;
      raiz = padre;
      vistos.add(raiz.id);
    }
    const clave = item.loteEntregaId ?? raiz.id;
    grupos.set(clave, [...(grupos.get(clave) ?? []), item]);
  }
  return [...grupos.values()];
}

export function ordenarReprogramaciones(opciones: AlternativaReprogramada[]) {
  const nivel = { CON_MARGEN: 0, MARGEN_REDUCIDO: 1, CAMBIA_ENTREGAS: 2 };
  return [...opciones].sort((a, b) => {
    const x = a.reprogramacion!,
      y = b.reprogramacion!;
    return (
      nivel[x.nivel] - nivel[y.nivel] ||
      x.ordenesMovidas.length - y.ordenesMovidas.length ||
      x.entregasAfectadas.reduce((s, e) => s + e.demoraHabiles, 0) -
        y.entregasAfectadas.reduce((s, e) => s + e.demoraHabiles, 0) ||
      x.cambios.length - y.cambios.length ||
      a.id.localeCompare(b.id)
    );
  });
}

/** Búsqueda acotada de cambios de cola. Reutiliza mediciones/archivos congelados. */
export async function buscarReprogramaciones(entrada: {
  taller: ContextoPiloto;
  margen: number;
  alternativa: AlternativaPiloto;
  operaciones: OperacionPiloto[];
  excluidas: string[];
  signal?: AbortSignal;
}) {
  const { taller, margen, alternativa, operaciones } = entrada;
  const base = simularFlujo(taller);
  const porPaso = new Map(base.traza.map((p) => [p.pasoId, p]));
  const porNodo = new Map(
    taller.items.flatMap((i) =>
      i.pasos.map((p) => [p.id, { item: i, paso: p }] as const),
    ),
  );
  const todasPendientes = taller.items.flatMap((i) =>
    i.pasos.filter((p) => p.estado !== 'hecho'),
  );
  const motivos: string[] = [];
  if (todasPendientes.length > 2500)
    motivos.push(
      'La cola supera el tamaño admitido para esta búsqueda. Acotá los trabajos pendientes antes de reprogramar.',
    );
  if (
    todasPendientes.some((p) => !porPaso.has(p.id)) ||
    base.traza.some((p) => p.parcial) ||
    [...base.porItem.values()].some(
      (i) => i.sinEstimar || i.parcial || i.asumeDesbloqueo,
    )
  )
    motivos.push(
      'Primero confirmá tiempos, recursos, calendarios y bloqueos de la cola. Con datos incompletos no podemos aplicar cambios a otras órdenes.',
    );
  const candidatos = [
    ...new Set(
      taller.items
        .filter(
          (i) =>
            i.ordenEstado === 'pendiente' &&
            i.pasos.every(
              (p) =>
                p.estado === 'pendiente' && p.tipoEjecucion !== 'tercerizado',
            ),
        )
        .map((i) => i.ordenId),
    ),
  ].filter(
    (id) =>
      !taller.items.some(
        (i) =>
          i.ordenId === id &&
          i.pasos.some(
            (p) =>
              p.estado !== 'pendiente' || p.tipoEjecucion === 'tercerizado',
          ),
      ),
  );
  const trabajos = candidatos.map((id) => ({
    id,
    numero: taller.items.find((i) => i.ordenId === id)!.ordenNumero,
  }));
  if (motivos.length)
    return {
      alternativas: [] as AlternativaReprogramada[],
      trabajos,
      evaluadas: 0,
      motivo: motivos.join(' '),
    };
  const movibles = candidatos
    .filter((id) => !entrada.excluidas.includes(id))
    .slice(0, 24);
  const grupos = gruposCompromiso(taller.items);
  const hipoteticos: TableroItemData[] = alternativa.operaciones.map((n) => {
    const o = operaciones.find((o) => o.codigo === n.operacion)!;
    return {
      id: n.id,
      ordenId: 'f6-nuevo',
      ordenNumero: `0000-${String(n.desde).padStart(12, '0')}`,
      ordenEstado: 'pendiente',
      prioridadPlanificacion: -1,
      fechaEntrega: null,
      sinRuta: false,
      pasos: [
        {
          id: n.id,
          indice: operaciones.indexOf(o),
          nodoClave: n.id,
          esTerminal: true,
          nombre: o.nombre,
          predecesorPasoIds: n.predecesoras,
          familiaCodigo: o.familiaCodigo,
          maquinaId: o.maquinaId,
          centroCostoId: o.centroCostoId ?? null,
          plantillaCodigo: o.plantillaCodigo,
          tecnologia: o.tecnologia,
          demandaHumana: n.medicion?.demandaHumana,
          duracionEstimadaMin: n.medicion
            ? n.medicion.preparacionMin + n.medicion.ejecucionMin
            : null,
          estado: 'pendiente',
          iniciadoEl: null,
          tipoEjecucion: 'interno',
          plazoProveedorDias: null,
        },
      ],
    };
  });
  const conjuntos: string[][] = [...movibles.map((id) => [id])];
  for (let i = 0; i < Math.min(movibles.length, 8); i++)
    for (let j = i + 1; j < Math.min(movibles.length, 8); j++)
      conjuntos.push([movibles[i], movibles[j]]);
  if (movibles.length > 2) conjuntos.push(movibles);
  const resultados = new Map<string, AlternativaReprogramada>();
  let evaluadas = 0;
  const plazo = Date.now() + 10_000;
  for (const conjunto of conjuntos) {
    entrada.signal?.throwIfAborted();
    if (Date.now() > plazo) break;
    const moviles = new Set(conjunto);
    const items = taller.items.map((i) => ({
      ...i,
      pasos: i.pasos.map((p) => {
        const t = porPaso.get(p.id);
        return !t || p.estado !== 'pendiente'
          ? p
          : {
              ...p,
              atencionPlanificada: moviles.has(i.ordenId)
                ? undefined
                : t.atencionPlanificada,
              planificadoDesde: moviles.has(i.ordenId)
                ? null
                : t.inicio.toISOString(),
              planificadoHasta: moviles.has(i.ordenId)
                ? null
                : t.fin.toISOString(),
            };
      }),
    }));
    const sim = simularFlujo({ ...taller, items: [...items, ...hipoteticos] });
    evaluadas++;
    // Permite cancelación y otras solicitudes entre simulaciones, nunca bloquea una tx.
    await new Promise<void>((resolve) => setImmediate(resolve));
    const nueva = new Map(sim.traza.map((p) => [p.pasoId, p]));
    if (
      sim.traza.some((p) => p.parcial) ||
      [...sim.porItem.values()].some((i) => i.sinEstimar || !i.finEstimado)
    )
      continue;
    const cambios: ReprogramacionPropuesta['cambios'] = [];
    let invalida = false;
    for (const previo of base.traza) {
      const t = nueva.get(previo.pasoId),
        n = porNodo.get(previo.pasoId)!;
      if (!t) {
        invalida = true;
        break;
      }
      if (+t.inicio === +previo.inicio && +t.fin === +previo.fin) continue;
      if (!moviles.has(n.item.ordenId) || n.paso.estado !== 'pendiente') {
        invalida = true;
        break;
      }
      cambios.push({
        pasoId: t.pasoId,
        ordenId: n.item.ordenId,
        ordenNumero: n.item.ordenNumero,
        item: n.item.nombre ?? n.item.id,
        operacion: n.paso.nombre,
        recurso:
          taller.estaciones.find((e) => e.id === t.estacionKey)?.nombre ??
          t.estacionKey,
        inicioAnterior: previo.inicio.toISOString(),
        finAnterior: previo.fin.toISOString(),
        inicio: t.inicio.toISOString(),
        fin: t.fin.toISOString(),
      });
    }
    if (invalida || !cambios.length) continue;
    const entregas = alternativa.entregas.map((e) => {
      const finales = e.operacionesTerminales.map((id) => nueva.get(id)?.fin);
      const fin =
        finales.every(Boolean) && finales.length
          ? new Date(Math.max(...finales.map((f) => +f!)))
          : null;
      const fechaSugerida = fin
        ? claveFechaEnZona(
            sumarDiasHabiles(fin, margen, taller.noLaborables, taller.zona),
            taller.zona,
          )
        : null;
      return {
        ...e,
        finProduccion: fin?.toISOString() ?? null,
        fechaSugerida,
        cumple:
          fin && e.fechaSolicitada
            ? claveFechaEnZona(fin, taller.zona) <= e.fechaSolicitada
            : null,
        cumpleConMargen:
          fechaSugerida && e.fechaSolicitada
            ? fechaSugerida <= e.fechaSolicitada
            : null,
      };
    });
    if (entregas.some((e) => !e.finProduccion || e.cumple === false)) continue;
    const afectados = new Set(
      cambios.map((c) => porNodo.get(c.pasoId)!.item.id),
    );
    const entregasAfectadas: ImpactoEntrega[] = [];
    for (const grupo of grupos.filter((g) =>
      g.some((i) => afectados.has(i.id)),
    )) {
      const raiz =
        grupo.find((i) => !grupo.some((p) => p.id === i.parentItemId)) ??
        grupo[0];
      const anterior = grupo
        .map((i) => base.porItem.get(i.id)?.finEstimado)
        .filter((d): d is Date => !!d);
      const posterior = grupo
        .map((i) => sim.porItem.get(i.id)?.finEstimado)
        .filter((d): d is Date => !!d);
      if (!anterior.length || !posterior.length) {
        invalida = true;
        break;
      }
      const finAnterior = new Date(Math.max(...anterior.map(Number))),
        fin = new Date(Math.max(...posterior.map(Number)));
      const dia = claveFechaEnZona(fin, taller.zona),
        fechaActual = raiz.fechaEntrega;
      const cambiaEntrega = !!fechaActual && dia > fechaActual;
      const fechaPropuesta = cambiaEntrega
        ? claveFechaEnZona(
            sumarDiasHabiles(fin, margen, taller.noLaborables, taller.zona),
            taller.zona,
          )
        : fechaActual;
      entregasAfectadas.push({
        ordenId: raiz.ordenId,
        ordenNumero: raiz.ordenNumero,
        raizId: raiz.id,
        loteId: raiz.loteEntregaId ?? null,
        itemIds: grupo.map((i) => i.id),
        nombre: raiz.nombre ?? raiz.id,
        fechaActual,
        fechaPropuesta,
        finAnterior: finAnterior.toISOString(),
        finPropuesto: fin.toISOString(),
        margenAnterior: fechaActual
          ? diasHabilesEntre(
              claveFechaEnZona(finAnterior, taller.zona),
              fechaActual,
              taller.noLaborables,
            )
          : null,
        margenRestante: fechaPropuesta
          ? diasHabilesEntre(dia, fechaPropuesta, taller.noLaborables)
          : null,
        demoraHabiles:
          fechaActual && fechaPropuesta
            ? Math.max(
                0,
                diasHabilesEntre(
                  fechaActual,
                  fechaPropuesta,
                  taller.noLaborables,
                ),
              )
            : 0,
        cambiaEntrega,
      });
    }
    if (invalida) continue;
    const nivel = entregasAfectadas.some((e) => e.cambiaEntrega)
      ? 'CAMBIA_ENTREGAS'
      : entregasAfectadas.some(
            (e) => e.margenRestante !== null && e.margenRestante < margen,
          ) || entregas.some((e) => e.cumpleConMargen === false)
        ? 'MARGEN_REDUCIDO'
        : 'CON_MARGEN';
    const agenda = sim.traza
      .filter(
        (p) =>
          !p.enCurso &&
          (porNodo.get(p.pasoId)?.paso.estado ?? 'pendiente') === 'pendiente',
      )
      .map((p) => ({
        pasoId: p.pasoId,
        inicio: p.inicio.toISOString(),
        fin: p.fin.toISOString(),
        atencionPlanificada: p.atencionPlanificada,
      }));
    const id =
      'reprogramar-' +
      createHash('sha256')
        .update(JSON.stringify({ agenda, entregasAfectadas }))
        .digest('hex')
        .slice(0, 24);
    const reprogramacion: ReprogramacionPropuesta = {
      nivel,
      ordenesMovidas: [...new Set(cambios.map((c) => c.ordenId))],
      cambios,
      entregasAfectadas,
      agenda,
    };
    resultados.set(id, {
      ...alternativa,
      id,
      nombre:
        nivel === 'CAMBIA_ENTREGAS'
          ? 'Reprogramar y cambiar entregas'
          : nivel === 'MARGEN_REDUCIDO'
            ? 'Reprogramar usando margen'
            : 'Reprogramar conservando margen',
      estado: entregas.some((e) => e.cumpleConMargen === false)
        ? 'SIN_MARGEN'
        : alternativa.condiciones.length
          ? 'CONDICIONADA'
          : 'VIABLE',
      esperaCola: false,
      entregas,
      traza: sim.traza.filter((p) => p.pasoId.startsWith('f6-piloto:')),
      trabajosDesplazados: cambios.map((c) => c.pasoId),
      reprogramacion,
    });
  }
  const ordenadas = ordenarReprogramaciones([...resultados.values()]);
  // Pocas opciones; conserva una alternativa de cada clase de impacto si existe.
  const elegidas = ordenadas.filter(
    (a, i) =>
      i < 2 ||
      !ordenadas
        .slice(0, i)
        .some((b) => b.reprogramacion!.nivel === a.reprogramacion!.nivel),
  );
  return {
    alternativas: elegidas.slice(0, 4),
    trabajos,
    evaluadas,
    motivo: ordenadas.length
      ? null
      : 'No encontramos una reprogramación que cumpla esas fechas con los trabajos habilitados. Revisá las exclusiones, las fechas o la capacidad del taller.',
  };
}
