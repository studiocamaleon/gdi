import type {
  EntradaPiloto,
  MedicionPiloto,
} from '../../../src/eta/planificacion/prototipo-entregas';

/** Datos sintéticos de aceptación, NO tarifas ni velocidades de Visual Ilusión.
 * Las mediciones son explícitas por cantidad y contienen economías distintas.
 * Costo en unidades monetarias de prueba. Disponibilidad asumida sólo aquí.
 */
const mediciones = (filas: number[][]): MedicionPiloto[] =>
  filas.map(([cantidadProductos, preparacionMin, ejecucionMin, costo]) => ({
    cantidadProductos,
    preparacionMin,
    ejecucionMin,
    costo,
    fuente: 'Fixture controlado F6; no medición de maquinaria real',
  }));

export function exhibidorControlado(): EntradaPiloto {
  return {
    cantidad: 200,
    entregas: [1, 2, 3, 4].map((i) => ({ id: `entrega-${i}`, cantidad: 50 })),
    prioridadSinFechas: 'PRIMERAS_ENTREGAS',
    margenDiasHabiles: 0,
    condicionesPendientes: [],
    operaciones: [
      {
        codigo: 'cuerpos',
        nombre: 'Corte de cuerpos',
        familiaCodigo: 'corte',
        maquinaId: 'mesa-1',
        piezasPorProducto: 1,
        predecesoras: [],
        mediciones: mediciones([
          [50, 30, 100, 130],
          [100, 30, 180, 210],
          [150, 30, 270, 300],
          [200, 30, 350, 380],
        ]),
      },
      {
        codigo: 'estantes',
        nombre: 'Corte de estantes',
        familiaCodigo: 'corte',
        maquinaId: 'mesa-1',
        piezasPorProducto: 2,
        predecesoras: [],
        mediciones: mediciones([
          [50, 20, 100, 120],
          [100, 20, 190, 210],
          [150, 20, 290, 310],
          [200, 20, 390, 410],
        ]),
      },
      {
        codigo: 'armado',
        nombre: 'Armado',
        familiaCodigo: 'armado',
        piezasPorProducto: 1,
        predecesoras: ['cuerpos', 'estantes'],
        mediciones: mediciones([
          [50, 10, 250, 130],
          [100, 10, 500, 255],
          [150, 10, 750, 380],
          [200, 10, 1000, 505],
        ]),
      },
    ],
    taller: {
      ahora: new Date('2026-09-09T08:00:00-03:00'),
      zona: 'America/Argentina/Rio_Gallegos',
      noLaborables: new Set(),
      medianas: new Map(),
      tiempoEntrePasosMin: 0,
      estaciones: ['corte', 'armado'].map((id) => ({
        id,
        activo: true,
        capacidadConcurrente: 1,
        tiempoPreparacionMin: 0,
        familias: [id],
        maquinas: id === 'corte' ? [{ id: 'mesa-1', centroCostoId: null }] : [],
        calendario: {
          dias: {
            lun: [{ desde: '08:00', hasta: '17:00' }],
            mar: [{ desde: '08:00', hasta: '17:00' }],
            mie: [{ desde: '08:00', hasta: '17:00' }],
            jue: [{ desde: '08:00', hasta: '17:00' }],
            vie: [{ desde: '08:00', hasta: '17:00' }],
            sab: null,
            dom: null,
          },
        },
      })),
      items: [
        {
          id: 'trabajo-previo',
          ordenId: 'ot-previa',
          ordenNumero: 'OT-2026-0001',
          ordenEstado: 'produccion',
          fechaEntrega: '2026-09-09',
          sinRuta: false,
          pasos: [
            {
              id: 'corte-previo',
              indice: 0,
              nombre: 'Corte ya comprometido',
              familiaCodigo: 'corte',
              maquinaId: 'mesa-1',
              centroCostoId: null,
              duracionEstimadaMin: 180,
              estado: 'pendiente',
              iniciadoEl: null,
              tipoEjecucion: 'interno',
              plazoProveedorDias: null,
            },
          ],
        },
      ],
    },
  };
}

export function conFechasAlcanzables(): EntradaPiloto {
  const entrada = exhibidorControlado();
  ['2026-09-10', '2026-09-14', '2026-09-15', '2026-09-16'].forEach(
    (fechaSolicitada, i) => {
      entrada.entregas[i].fechaSolicitada = fechaSolicitada;
    },
  );
  return entrada;
}
