import type { CalendarioEstacion } from '../../produccion/calendario';
import type { Estacion } from '../motor/estaciones-tipos';
import {
  avanzarAVentana,
  simularFlujo,
  sumarDiasHabiles,
  sumarMinutosLaborales,
} from '../motor/flujo-produccion';
import type { TableroItemData, TableroPasoData } from '../motor/tablero-tipos';

/**
 * Paridad con src/lib/flujo-produccion.test.ts (el motor es un espejo). Cubre
 * la aritmética de calendario (incl. jornada cortada) y los caminos centrales
 * del scheduler.
 */

/** L–V 08:00–17:00 (9 h), fin de semana cerrado. */
const CALENDARIO: CalendarioEstacion = {
  dias: {
    lun: [{ desde: '08:00', hasta: '17:00' }],
    mar: [{ desde: '08:00', hasta: '17:00' }],
    mie: [{ desde: '08:00', hasta: '17:00' }],
    jue: [{ desde: '08:00', hasta: '17:00' }],
    vie: [{ desde: '08:00', hasta: '17:00' }],
    sab: null,
    dom: null,
  },
};

/** Lunes 20 de julio de 2026, 08:00. */
const AHORA = new Date(2026, 6, 20, 8, 0);
const jul = (dia: number, hora = 0, minuto = 0) =>
  new Date(2026, 6, dia, hora, minuto);

function estacion(over: Partial<Estacion> & Pick<Estacion, 'id'>): Estacion {
  return {
    activo: true,
    capacidadConcurrente: 1,
    tiempoPreparacionMin: null,
    calendario: CALENDARIO,
    familias: [],
    maquinas: [],
    ...over,
  };
}

function paso(
  indice: number,
  familiaCodigo: string,
  over: Partial<TableroPasoData> = {},
): TableroPasoData {
  return {
    id: `paso-${indice}-${familiaCodigo}`,
    indice,
    nombre: familiaCodigo,
    familiaCodigo,
    centroCostoId: null,
    duracionEstimadaMin: null,
    estado: 'pendiente',
    iniciadoEl: null,
    tipoEjecucion: 'interno',
    plazoProveedorDias: null,
    ...over,
  };
}

const interno = (i: number, fam: string, min: number) =>
  paso(i, fam, { duracionEstimadaMin: min });
const tercerizado = (
  i: number,
  fam: string,
  dias: number | null,
  min: number | null = null,
) =>
  paso(i, fam, {
    tipoEjecucion: 'tercerizado',
    plazoProveedorDias: dias,
    duracionEstimadaMin: min,
  });

function item(
  id: string,
  pasos: TableroPasoData[],
  over: Partial<TableroItemData> = {},
): TableroItemData {
  const ids = new Map(pasos.map((paso) => [paso.id, `${id}-${paso.id}`]));
  return {
    id,
    ordenId: `orden-${id}`,
    ordenNumero: `OT-${id}`,
    ordenEstado: 'produccion',
    fechaEntrega: null,
    sinRuta: false,
    // En la base los ids de paso son UUID globales. El prefijo evita que los
    // fixtures de dos items inventen accidentalmente el mismo nodo.
    pasos: pasos.map((paso) => ({
      ...paso,
      id: ids.get(paso.id)!,
      predecesorPasoIds: (paso.predecesorPasoIds ?? []).map(
        (pasoId) => ids.get(pasoId) ?? pasoId,
      ),
      sucesorPasoIds: (paso.sucesorPasoIds ?? []).map(
        (pasoId) => ids.get(pasoId) ?? pasoId,
      ),
    })),
    ...over,
  };
}

const TALLER = [estacion({ id: 'e1', familias: ['impresion'] })];
const maquina = (cc: string) => ({ centroCostoId: cc });
const enMaquina = (i: number, fam: string, min: number, cc: string) =>
  paso(i, fam, { duracionEstimadaMin: min, centroCostoId: cc });

function correr(
  items: TableroItemData[],
  o: {
    estaciones?: Estacion[];
    medianas?: Map<string, number>;
    noLaborables?: Set<string>;
    tiempoEntrePasosMin?: number;
  } = {},
) {
  return simularFlujo({
    items,
    estaciones: o.estaciones ?? TALLER,
    medianas: o.medianas ?? new Map(),
    ahora: AHORA,
    noLaborables: o.noLaborables ?? new Set(),
    tiempoEntrePasosMin: o.tiempoEntrePasosMin ?? 0,
  });
}

describe('avanzarAVentana', () => {
  it('respeta un instante dentro de la franja', () => {
    expect(avanzarAVentana(CALENDARIO, jul(20, 10, 30))).toEqual(
      jul(20, 10, 30),
    );
  });
  it('empuja al inicio si es antes de abrir', () => {
    expect(avanzarAVentana(CALENDARIO, jul(20, 6, 0))).toEqual(jul(20, 8, 0));
  });
  it('salta el fin de semana', () => {
    expect(avanzarAVentana(CALENDARIO, jul(25, 15, 0))).toEqual(jul(27, 8, 0));
  });
  it('salta feriados del taller', () => {
    expect(
      avanzarAVentana(CALENDARIO, jul(20, 9, 0), new Set(['2026-07-20'])),
    ).toEqual(jul(21, 8, 0));
  });
});

describe('sumarMinutosLaborales', () => {
  it('suma dentro de la jornada', () => {
    expect(sumarMinutosLaborales(CALENDARIO, jul(20, 8, 0), 60)).toEqual(
      jul(20, 9, 0),
    );
  });
  it('parte el trabajo entre días', () => {
    expect(sumarMinutosLaborales(CALENDARIO, jul(20, 16, 0), 120)).toEqual(
      jul(21, 9, 0),
    );
  });
  it('cruza el fin de semana', () => {
    expect(sumarMinutosLaborales(CALENDARIO, jul(24, 16, 0), 120)).toEqual(
      jul(27, 9, 0),
    );
  });
});

describe('jornada cortada', () => {
  const CORTADO: CalendarioEstacion = {
    dias: {
      lun: [
        { desde: '09:00', hasta: '12:00' },
        { desde: '15:00', hasta: '19:00' },
      ],
      mar: [
        { desde: '09:00', hasta: '12:00' },
        { desde: '15:00', hasta: '19:00' },
      ],
      mie: [
        { desde: '09:00', hasta: '12:00' },
        { desde: '15:00', hasta: '19:00' },
      ],
      jue: [
        { desde: '09:00', hasta: '12:00' },
        { desde: '15:00', hasta: '19:00' },
      ],
      vie: [
        { desde: '09:00', hasta: '12:00' },
        { desde: '15:00', hasta: '19:00' },
      ],
      sab: null,
      dom: null,
    },
  };
  it('el corte del mediodía empuja a la tarde', () => {
    expect(avanzarAVentana(CORTADO, jul(20, 13, 0))).toEqual(jul(20, 15, 0));
  });
  it('encadena mañana y tarde sin contar el corte', () => {
    expect(sumarMinutosLaborales(CORTADO, jul(20, 11, 0), 120)).toEqual(
      jul(20, 16, 0),
    );
  });
});

describe('sumarDiasHabiles', () => {
  it('no cuenta fin de semana', () => {
    expect(sumarDiasHabiles(jul(24, 10), 1)).toEqual(jul(27, 10));
  });
});

describe('simularFlujo', () => {
  it('programa un paso simple contra el calendario', () => {
    const r = correr([item('a', [interno(0, 'impresion', 120)])]);
    expect(r.porItem.get('a')?.finEstimado).toEqual(jul(20, 10, 0));
  });

  it('usa la mediana de la familia si el paso no trae duración', () => {
    const r = correr([item('a', [paso(0, 'impresion')])], {
      medianas: new Map([['impresion', 90]]),
    });
    expect(r.porItem.get('a')?.finEstimado).toEqual(jul(20, 9, 30));
  });

  it('marca sinEstimar sin duración ni mediana', () => {
    const r = correr([item('a', [paso(0, 'impresion')])]);
    expect(r.porItem.get('a')?.sinEstimar).toBe(true);
    expect(r.porItem.get('a')?.finEstimado).toBeNull();
  });

  it('encola dos trabajos en un puesto (capacidad finita)', () => {
    const r = correr([
      item('a', [interno(0, 'impresion', 120)]),
      item('b', [interno(0, 'impresion', 120)]),
    ]);
    // a: 8→10; b espera el puesto: 10→12.
    expect(r.porItem.get('a')?.finEstimado).toEqual(jul(20, 10, 0));
    expect(r.porItem.get('b')?.finEstimado).toEqual(jul(20, 12, 0));
  });

  it('programa ramas DAG en paralelo y espera la convergencia', () => {
    const diseno = interno(0, 'diseno', 60);
    const uv = interno(1, 'uv', 120);
    const laser = interno(2, 'laser', 180);
    const armado = interno(3, 'armado', 60);
    diseno.nodoClave = 'diseno';
    uv.nodoClave = 'uv';
    laser.nodoClave = 'laser';
    armado.nodoClave = 'armado';
    uv.predecesorPasoIds = [diseno.id];
    laser.predecesorPasoIds = [diseno.id];
    armado.predecesorPasoIds = [uv.id, laser.id];
    armado.esTerminal = true;
    const r = correr([item('dag', [diseno, uv, laser, armado])], {
      estaciones: [
        estacion({ id: 'diseno', familias: ['diseno'] }),
        estacion({ id: 'uv', familias: ['uv'] }),
        estacion({ id: 'laser', familias: ['laser'] }),
        estacion({ id: 'armado', familias: ['armado'] }),
      ],
    });
    const porFamilia = new Map(
      r.traza.map((fila) => [
        r.traza.find((otra) => otra.pasoId === fila.pasoId)?.estacionKey,
        fila,
      ]),
    );
    expect(porFamilia.get('uv')?.inicio).toEqual(jul(20, 9, 0));
    expect(porFamilia.get('laser')?.inicio).toEqual(jul(20, 9, 0));
    expect(porFamilia.get('armado')?.inicio).toEqual(jul(20, 12, 0));
    expect(r.porItem.get('dag')?.finEstimado).toEqual(jul(20, 13, 0));
  });

  it('un tercerizado corre por lead time, no ocupa puesto', () => {
    const r = correr([item('a', [tercerizado(0, 'laminado', 2, 999)])], {
      estaciones: [estacion({ id: 'e1', familias: ['laminado'] })],
    });
    // 2 días hábiles desde el lunes → miércoles, misma hora.
    expect(r.porItem.get('a')?.finEstimado).toEqual(jul(22, 8, 0));
  });

  it('marca parcial cuando el paso no tiene estación', () => {
    const r = correr([item('a', [interno(0, 'familia-huerfana', 60)])]);
    expect(r.porItem.get('a')?.parcial).toBe(true);
    // El bucket sin-estación usa calendarioDefault (9–18), no el CALENDARIO
    // del taller: arranca 9:00 y suma 60 → 10:00.
    expect(r.porItem.get('a')?.finEstimado).toEqual(jul(20, 10, 0));
  });

  it('dos pasos en la misma máquina no corren en paralelo', () => {
    const est = estacion({
      id: 'e1',
      familias: ['impresion', 'corte'],
      maquinas: [maquina('cc-1')],
    });
    const r = correr(
      [
        item('a', [enMaquina(0, 'impresion', 120, 'cc-1')]),
        item('b', [enMaquina(0, 'corte', 120, 'cc-1')]),
      ],
      { estaciones: [est] },
    );
    // Comparten la máquina cc-1 (capacidad 1): se encolan aunque sobren puestos.
    const finA = r.porItem.get('a')?.finEstimado?.getTime() ?? 0;
    const finB = r.porItem.get('b')?.finEstimado?.getTime() ?? 0;
    expect(Math.max(finA, finB)).toEqual(jul(20, 12, 0).getTime());
  });

  it('aplica la separación entre pasos como aire después del trabajo', () => {
    const r = correr(
      [item('a', [interno(0, 'impresion', 60), interno(1, 'impresion', 60)])],
      { tiempoEntrePasosMin: 30 },
    );
    // p0: 8→9, +30 sep, p1: 9:30→10:30.
    expect(r.porItem.get('a')?.finEstimado).toEqual(jul(20, 10, 30));
  });
});
