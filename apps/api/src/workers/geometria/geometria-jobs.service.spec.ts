import type { NestingIrregularOpenNestData } from '../colas';
import {
  clasificarTrabajoGeometria,
  idTrabajo,
} from './geometria-jobs.service';

function entrada(cantidad: number, tipos = 1): NestingIrregularOpenNestData {
  return {
    schemaVersion: 1,
    tenantId: 'tenant-prueba',
    correlationId: 'correlacion-prueba',
    solicitadoEl: '2026-09-04T00:00:00.000Z',
    motor: 'collision',
    placa: { anchoMm: 1_600, altoMm: 2_440, margenMm: 5, maxPlacas: 100 },
    separacionMm: 5,
    timeoutMs: 30_000,
    semilla: 7,
    piezas: Array.from({ length: tipos }, (_, index) => ({
      id: `pieza-${index}`,
      cantidad,
      rotaciones: 4,
      contorno: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 80 },
        { x: 0, y: 80 },
      ],
    })),
  };
}

describe('planificador de trabajos de geometría', () => {
  it('separa los trabajos interactivos de los intensivos', () => {
    expect(clasificarTrabajoGeometria(entrada(5)).clase).toBe('RAPIDA');
    expect(clasificarTrabajoGeometria(entrada(70)).clase).toBe('ESTANDAR');
    expect(clasificarTrabajoGeometria(entrada(220)).clase).toBe('INTENSIVA');
  });

  it('genera el mismo id para la misma pantalla e input cotizable', () => {
    const data = entrada(5);
    expect(idTrabajo('tenant-prueba', 'sheet-prueba', data)).toBe(
      idTrabajo('tenant-prueba', 'sheet-prueba', {
        ...data,
        correlationId: 'otra-correlacion',
        solicitadoEl: new Date().toISOString(),
      }),
    );
  });
});
