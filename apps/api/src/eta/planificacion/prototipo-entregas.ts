/** Piloto de F6: sólo simulación. No está expuesto por API ni escribe una OT.
 * El calendario y la capacidad se evalúan con el motor ETA existente.
 * Cada cantidad usa una medición explícita: nunca prorratea el tiempo total.
 */
import { claveFechaEnZona } from '../../common/zona';
import {
  simularFlujo,
  sumarDiasHabiles,
  type PasoProgramado,
} from '../motor/flujo-produccion';
import type { TableroItemData } from '../motor/tablero-tipos';

export type CompromisoPiloto = {
  id: string;
  cantidad: number;
  fechaSolicitada?: string;
};
export type MedicionPiloto = {
  cantidadProductos: number;
  preparacionMin: number;
  ejecucionMin: number;
  costo: number;
  fuente: string;
};
export type OperacionPiloto = {
  codigo: string;
  nombre: string;
  familiaCodigo: string;
  maquinaId?: string;
  centroCostoId?: string;
  plantillaCodigo?: string | null;
  tecnologia?: string | null;
  /** Política explícita del adaptador, p. ej. preparar el vector una vez. */
  unaVezPorPedido?: boolean;
  /** Conserva las mismas tandas que la operación que produjo las placas. */
  particionVinculadaA?: string;
  /** Piezas procesadas por producto terminado: p. ej. dos estantes. */
  piezasPorProducto: number;
  predecesoras: string[];
  mediciones: MedicionPiloto[];
};
export type ContextoPiloto = Omit<
  Parameters<typeof simularFlujo>[0],
  'ahora' | 'zona'
> & {
  ahora: Date;
  zona: string;
};
export type EntradaPiloto = {
  cantidad: number;
  entregas: CompromisoPiloto[];
  operaciones: OperacionPiloto[];
  taller: ContextoPiloto;
  margenDiasHabiles: number;
  /** Condiciones verificadas por el adaptador; no es un input de cliente. */
  condicionesPendientes: string[];
  prioridadSinFechas: 'PRIMERAS_ENTREGAS' | 'MENOR_COSTO';
};
type Rango = { desde: number; hasta: number };
export type OperacionLotePiloto = Rango & {
  id: string;
  operacion: string;
  cantidadProductos: number;
  cantidadPiezas: number;
  predecesoras: string[];
  medicion: MedicionPiloto | null;
};
export type EntregaProyectada = CompromisoPiloto & {
  finProduccion: string | null;
  fechaSugerida: string | null;
  cumple: boolean | null;
  cumpleConMargen: boolean | null;
  operacionesTerminales: string[];
  ultimaOperacion: {
    nombre: string;
    estacion: string;
    inicio: string;
    fin: string;
  } | null;
};
export type AlternativaPiloto = {
  id: string;
  nombre: string;
  estado:
    | 'VIABLE'
    | 'SIN_MARGEN'
    | 'FUERA_DE_FECHA'
    | 'CONDICIONADA'
    | 'SIN_ESTIMACION'
    | 'DESPLAZA_TRABAJOS';
  operaciones: OperacionLotePiloto[];
  entregas: EntregaProyectada[];
  costo: number | null;
  costoAdicional: number | null;
  preparacionMin: number;
  traza: PasoProgramado[];
  trabajosDesplazados: string[];
  condiciones: string[];
};

const enteroPositivo = (n: number) => Number.isSafeInteger(n) && n > 0;
const seCruzan = (a: Rango, b: Rango) => a.desde < b.hasta && b.desde < a.hasta;
function rangos(cantidades: number[]): Rango[] {
  let desde = 0;
  return cantidades.map((cantidad) => {
    const r = { desde, hasta: desde + cantidad };
    desde = r.hasta;
    return r;
  });
}
function validar(entrada: EntradaPiloto) {
  const { cantidad, entregas, operaciones, taller } = entrada;
  if (
    !enteroPositivo(cantidad) ||
    !entregas.length ||
    entregas.length > 50 ||
    entregas.some((e) => !e.id || !enteroPositivo(e.cantidad)) ||
    entregas.reduce((s, e) => s + e.cantidad, 0) !== cantidad ||
    new Set(entregas.map((e) => e.id)).size !== entregas.length
  )
    throw new Error(
      'Las entregas deben tener identidad propia y sumar la cantidad entera del ítem.',
    );
  let ultimaFecha = '';
  for (const e of entregas) {
    if (!e.fechaSolicitada) continue;
    const f = new Date(`${e.fechaSolicitada}T12:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(e.fechaSolicitada) ||
      !Number.isFinite(f.getTime()) ||
      f.toISOString().slice(0, 10) !== e.fechaSolicitada ||
      e.fechaSolicitada < ultimaFecha
    )
      throw new Error(
        'Las fechas de entrega deben ser válidas y estar ordenadas.',
      );
    ultimaFecha = e.fechaSolicitada;
  }
  if (
    !Number.isFinite(taller.ahora.getTime()) ||
    !Number.isInteger(entrada.margenDiasHabiles) ||
    entrada.margenDiasHabiles < 0 ||
    entrada.margenDiasHabiles > 15
  )
    throw new Error('La fecha de simulación o el margen no son válidos.');
  // El piloto usa operaciones internas y cantidades enteras de producto.
  const codigos = new Set(operaciones.map((o) => o.codigo));
  if (
    !operaciones.length ||
    operaciones.length > 20 ||
    codigos.size !== operaciones.length ||
    operaciones.some(
      (o) =>
        !o.codigo ||
        !enteroPositivo(o.piezasPorProducto) ||
        !Number.isSafeInteger(o.piezasPorProducto * cantidad) ||
        (o.particionVinculadaA != null &&
          !codigos.has(o.particionVinculadaA)) ||
        o.predecesoras.some((p) => !codigos.has(p)) ||
        new Set(o.predecesoras).size !== o.predecesoras.length ||
        new Set(o.mediciones.map((m) => m.cantidadProductos)).size !==
          o.mediciones.length ||
        o.mediciones.some(
          (m) =>
            !enteroPositivo(m.cantidadProductos) ||
            !m.fuente ||
            [m.preparacionMin, m.ejecucionMin, m.costo].some(
              (n) => !Number.isFinite(n) || n < 0,
            ),
        ),
    )
  )
    throw new Error('Las operaciones o sus mediciones no son válidas.');
  const visitados = new Set<string>();
  const visitando = new Set<string>();
  const visitar = (codigo: string) => {
    if (visitando.has(codigo)) throw new Error('El flujo contiene un ciclo.');
    if (visitados.has(codigo)) return;
    visitando.add(codigo);
    operaciones.find((o) => o.codigo === codigo)!.predecesoras.forEach(visitar);
    visitando.delete(codigo);
    visitados.add(codigo);
  };
  operaciones.forEach((o) => visitar(o.codigo));
}

/** Candidatos acotados, sin afirmar que enumeran todas las particiones. */
function generar(entrada: EntradaPiloto) {
  const { cantidad, entregas, operaciones } = entrada;
  const individual = entregas.map((e) => e.cantidad);
  const pares: number[] = [];
  individual.forEach((q, i) => {
    pares[Math.floor(i / 2)] = (pares[Math.floor(i / 2)] ?? 0) + q;
  });
  const primera =
    individual[0] === cantidad
      ? [cantidad]
      : [individual[0], cantidad - individual[0]];
  const terminales = new Set(
    operaciones
      .filter(
        (o) => !operaciones.some((p) => p.predecesoras.includes(o.codigo)),
      )
      .map((o) => o.codigo),
  );
  const recetas = [
    {
      id: 'completo',
      nombre: 'Fabricación completa',
      grupos: [cantidad],
      finales: [cantidad],
    },
    {
      id: 'pares',
      nombre: 'Agrupar de a dos entregas',
      grupos: pares,
      finales: pares,
    },
    {
      id: 'por-entrega',
      nombre: 'Fabricar por entrega',
      grupos: individual,
      finales: individual,
    },
    {
      id: 'pares-con-transferencia',
      nombre: 'Agrupar piezas y terminar por entrega',
      grupos: pares,
      finales: individual,
    },
    {
      id: 'conjunto-con-transferencia',
      nombre: 'Fabricar piezas juntas y terminar por entrega',
      grupos: [cantidad],
      finales: individual,
    },
    {
      id: 'primera-prioritaria',
      nombre: 'Adelantar la primera entrega',
      grupos: primera,
      finales: individual,
    },
  ];
  const vistos = new Set<string>();
  return recetas.flatMap((receta) => {
    const gruposDe = (o: OperacionPiloto, camino: string[] = []): number[] => {
      if (camino.includes(o.codigo))
        throw new Error('Las particiones vinculadas contienen un ciclo.');
      if (o.particionVinculadaA)
        return gruposDe(
          operaciones.find((p) => p.codigo === o.particionVinculadaA)!,
          [...camino, o.codigo],
        );
      return o.unaVezPorPedido
        ? [cantidad]
        : terminales.has(o.codigo)
          ? receta.finales
          : receta.grupos;
    };
    const firma = JSON.stringify(operaciones.map((o) => gruposDe(o)));
    if (vistos.has(firma)) return [];
    vistos.add(firma);
    const nodos: OperacionLotePiloto[] = operaciones.flatMap((o) =>
      rangos(gruposDe(o)).map((r) => ({
        ...r,
        id: `f6-piloto:${receta.id}:${o.codigo}:${r.desde}-${r.hasta}`,
        operacion: o.codigo,
        cantidadProductos: r.hasta - r.desde,
        cantidadPiezas: (r.hasta - r.desde) * o.piezasPorProducto,
        predecesoras: [],
        medicion:
          o.mediciones.find((m) => m.cantidadProductos === r.hasta - r.desde) ??
          null,
      })),
    );
    for (const nodo of nodos) {
      const o = operaciones.find((o) => o.codigo === nodo.operacion)!;
      nodo.predecesoras = nodos
        .filter(
          (p) => o.predecesoras.includes(p.operacion) && seCruzan(nodo, p),
        )
        .map((p) => p.id);
    }
    return [{ id: receta.id, nombre: receta.nombre, nodos, terminales }];
  });
}

export function proponerEntregasPiloto(entrada: EntradaPiloto) {
  validar(entrada);
  const { taller, entregas, operaciones } = entrada;
  const base = simularFlujo(taller);
  const basePorPaso = new Map(base.traza.map((p) => [p.pasoId, p]));
  const condicionesCola = [...base.porItem.values()].some(
    (r) => r.sinEstimar || r.parcial || r.asumeDesbloqueo,
  )
    ? ['La cola contiene tiempos, disponibilidad o recursos sin confirmar.']
    : [];
  const rangosEntrega = rangos(entregas.map((e) => e.cantidad));
  const idsExistentes = new Set(
    taller.items.flatMap((i) => [i.id, ...i.pasos.map((p) => p.id)]),
  );
  const alternativas: AlternativaPiloto[] = generar(entrada).map(
    (candidato) => {
      const { nodos, terminales } = candidato;
      if (nodos.some((n) => idsExistentes.has(n.id)))
        throw new Error('La simulación colisiona con identidades existentes.');
      const hipoteticos: TableroItemData[] = nodos.map((n) => {
        const o = operaciones.find((o) => o.codigo === n.operacion)!;
        const indice = operaciones.indexOf(o);
        return {
          id: n.id,
          ordenId: `f6-piloto:${candidato.id}`,
          ordenEstado: 'produccion',
          ordenNumero: `\uffff-${String(n.desde).padStart(12, '0')}-${String(indice).padStart(3, '0')}`,
          fechaEntrega: null,
          sinRuta: false,
          pasos: [
            {
              id: n.id,
              indice,
              nodoClave: n.id,
              nombre: o.nombre,
              predecesorPasoIds: n.predecesoras,
              esTerminal: true,
              familiaCodigo: o.familiaCodigo,
              plantillaCodigo: o.plantillaCodigo,
              tecnologia: o.tecnologia,
              maquinaId: o.maquinaId,
              centroCostoId: o.centroCostoId ?? null,
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
      const simulacion = simularFlujo({
        ...taller,
        items: [...taller.items, ...hipoteticos],
      });
      const condiciones = [
        ...entrada.condicionesPendientes,
        ...condicionesCola,
      ];
      const nuevoPorPaso = new Map(simulacion.traza.map((p) => [p.pasoId, p]));
      const desplazados = [...basePorPaso]
        .filter(([id, previo]) => {
          const actual = nuevoPorPaso.get(id);
          return (
            !actual || actual.inicio > previo.inicio || actual.fin > previo.fin
          );
        })
        .map(([id]) => id);
      // La mediana nunca sustituye la medición específica que falta al piloto.
      const sinDatos = nodos.some(
        (n) =>
          !n.medicion ||
          !simulacion.porItem.get(n.id)?.finEstimado ||
          simulacion.porItem.get(n.id)?.sinEstimar,
      );
      if (sinDatos)
        condiciones.push(
          'Falta una medición por cantidad o no se pudo programar todo el flujo.',
        );
      if (nodos.some((n) => simulacion.porItem.get(n.id)?.parcial))
        condiciones.push(
          'Hay operaciones sin recurso o calendario confirmado.',
        );
      const proyecciones = entregas.map((e, i): EntregaProyectada => {
        const finales = nodos.filter(
          (n) => terminales.has(n.operacion) && seCruzan(n, rangosEntrega[i]),
        );
        const fechas = finales.map(
          (n) => simulacion.porItem.get(n.id)?.finEstimado,
        );
        const fin =
          !sinDatos && fechas.length > 0 && fechas.every((f) => !!f)
            ? new Date(Math.max(...fechas.map((f) => f.getTime())))
            : null;
        const sugerida = fin
          ? claveFechaEnZona(
              sumarDiasHabiles(
                fin,
                entrada.margenDiasHabiles,
                taller.noLaborables,
                taller.zona,
              ),
              taller.zona,
            )
          : null;
        const ultimoPaso = fin
          ? finales
              .map((n) => nuevoPorPaso.get(n.id))
              .filter((p): p is PasoProgramado => !!p)
              .sort((a, b) => b.fin.getTime() - a.fin.getTime())[0]
          : undefined;
        const ultimaOperacion = ultimoPaso
          ? {
              nombre: operaciones.find(
                (o) =>
                  nodos.find((n) => n.id === ultimoPaso.pasoId)?.operacion ===
                  o.codigo,
              )!.nombre,
              estacion: ultimoPaso.estacionKey,
              inicio: ultimoPaso.inicio.toISOString(),
              fin: ultimoPaso.fin.toISOString(),
            }
          : null;
        return {
          ...e,
          finProduccion: fin?.toISOString() ?? null,
          fechaSugerida: sugerida,
          cumple:
            e.fechaSolicitada && fin
              ? claveFechaEnZona(fin, taller.zona) <= e.fechaSolicitada
              : null,
          cumpleConMargen:
            e.fechaSolicitada && sugerida
              ? sugerida <= e.fechaSolicitada
              : null,
          operacionesTerminales: finales.map((n) => n.id),
          ultimaOperacion,
        };
      });
      const estado: AlternativaPiloto['estado'] = sinDatos
        ? 'SIN_ESTIMACION'
        : desplazados.length
          ? 'DESPLAZA_TRABAJOS'
          : condiciones.length
            ? 'CONDICIONADA'
            : proyecciones.some((e) => e.cumple === false)
              ? 'FUERA_DE_FECHA'
              : proyecciones.some((e) => e.cumpleConMargen === false)
                ? 'SIN_MARGEN'
                : 'VIABLE';
      return {
        id: candidato.id,
        nombre: candidato.nombre,
        estado,
        operaciones: nodos,
        entregas: proyecciones,
        costo: nodos.every((n) => !!n.medicion)
          ? nodos.reduce((s, n) => s + n.medicion!.costo, 0)
          : null,
        costoAdicional: null,
        preparacionMin: nodos.reduce(
          (s, n) => s + (n.medicion?.preparacionMin ?? 0),
          0,
        ),
        traza: sinDatos
          ? []
          : simulacion.traza.filter((p) =>
              p.pasoId.startsWith(`f6-piloto:${candidato.id}:`),
            ),
        trabajosDesplazados: desplazados,
        condiciones,
      };
    },
  );
  const referencia = alternativas.find((a) => a.id === 'completo')?.costo;
  alternativas.forEach((a) => {
    a.costoAdicional =
      a.costo != null && referencia != null ? a.costo - referencia : null;
  });
  const evaluables = alternativas.filter(
    (a) => a.estado !== 'SIN_ESTIMACION' && a.estado !== 'DESPLAZA_TRABAJOS',
  );
  const distanciaDias = (a: string, b: string) =>
    Math.max(0, (Date.parse(a) - Date.parse(b)) / 86400000);
  const puntuacion = (a: AlternativaPiloto): number[] => {
    const atrasos = a.entregas.reduce(
      (s, e) =>
        s +
        (e.fechaSolicitada && e.finProduccion
          ? distanciaDias(
              claveFechaEnZona(new Date(e.finProduccion), taller.zona),
              e.fechaSolicitada,
            ) * e.cantidad
          : 0),
      0,
    );
    const base = [
      a.entregas.filter((e) => e.cumple === false).length,
      atrasos,
      a.entregas.filter((e) => e.cumpleConMargen === false).length,
    ];
    const fechas = a.entregas.map((e) => Date.parse(e.finProduccion!));
    const fechasAbiertas = a.entregas
      .filter((e) => !e.fechaSolicitada)
      .map((e) => Date.parse(e.finProduccion!));
    return entrada.prioridadSinFechas === 'PRIMERAS_ENTREGAS' &&
      fechasAbiertas.length > 0
      ? [...base, ...fechasAbiertas, a.costo!, a.operaciones.length, ...fechas]
      : [...base, a.costo!, a.operaciones.length, ...fechas];
  };
  const comparar = (a: AlternativaPiloto, b: AlternativaPiloto) => {
    const x = puntuacion(a),
      y = puntuacion(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return a.id.localeCompare(b.id);
  };
  // Una propuesta condicionada se muestra, pero no se presenta como confirmable.
  const ciertas = evaluables.filter((a) => a.estado !== 'CONDICIONADA');
  const recomendada =
    [...(ciertas.length ? ciertas : evaluables)].sort(comparar)[0] ?? null;
  const economica =
    [...evaluables].sort((a, b) => a.costo! - b.costo! || comparar(a, b))[0] ??
    null;
  return {
    prototipo: true as const,
    reservaCapacidad: false as const,
    recomendadaId: recomendada?.id ?? null,
    economicaId: economica?.id ?? null,
    encontradaConFechas: ciertas.some(
      (a) => a.estado === 'VIABLE' || a.estado === 'SIN_MARGEN',
    ),
    alternativas,
  };
}
