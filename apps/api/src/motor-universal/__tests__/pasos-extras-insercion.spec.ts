import { MotorUniversalService } from '../motor.service';
import type { PasoCargado } from '../tipos';

/**
 * Fase 1 (G-F3) — ordenamiento de pasos extras en la secuencia.
 * `insertarPasosExtras` es una función pura (no toca deps), así que
 * instanciamos el service con deps nulas y accedemos al método privado.
 */
describe('MotorUniversalService.insertarPasosExtras', () => {
  const service = new MotorUniversalService(
    null as never,
    null as never,
    null as never,
  );
  const insertar = (
    pasos: PasoCargado[],
    extras: Array<{
      paso: PasoCargado;
      insertarDespuesDeRutaPasoId: string | null;
      ordenInterno: number;
    }>,
  ): PasoCargado[] =>
    (
      service as unknown as {
        insertarPasosExtras: (
          p: PasoCargado[],
          e: typeof extras,
        ) => PasoCargado[];
      }
    ).insertarPasosExtras(pasos, extras);

  const paso = (id: string, orden: number): PasoCargado =>
    ({ rutaPasoId: id, rutaPasoOrden: orden } as unknown as PasoCargado);
  const extra = (
    id: string,
    insertarDespuesDeRutaPasoId: string | null,
    ordenInterno = 0,
  ) => ({
    paso: paso(id, 0),
    insertarDespuesDeRutaPasoId,
    ordenInterno,
  });

  const base = [paso('A', 1), paso('B', 2)];

  it('inserta al inicio cuando insertarDespuesDe es null', () => {
    const res = insertar(base, [extra('X', null)]);
    expect(res.map((p) => p.rutaPasoId)).toEqual(['X', 'A', 'B']);
    expect(res.map((p) => p.rutaPasoOrden)).toEqual([1, 2, 3]);
  });

  it('inserta después del RutaPaso indicado', () => {
    const res = insertar(base, [extra('X', 'A')]);
    expect(res.map((p) => p.rutaPasoId)).toEqual(['A', 'X', 'B']);
  });

  it('inserta al final cuando apunta al último paso', () => {
    const res = insertar(base, [extra('X', 'B')]);
    expect(res.map((p) => p.rutaPasoId)).toEqual(['A', 'B', 'X']);
  });

  it('respeta ordenInterno entre varios extras en la misma posición', () => {
    const res = insertar(base, [
      extra('X2', 'A', 2),
      extra('X1', 'A', 1),
    ]);
    expect(res.map((p) => p.rutaPasoId)).toEqual(['A', 'X1', 'X2', 'B']);
  });

  it('renumera rutaPasoOrden 1..N sobre la secuencia final', () => {
    const res = insertar(base, [extra('X', 'A'), extra('Y', 'B')]);
    expect(res.map((p) => p.rutaPasoOrden)).toEqual([1, 2, 3, 4]);
    expect(res.map((p) => p.rutaPasoId)).toEqual(['A', 'X', 'B', 'Y']);
  });

  it('agrega al final (defensa) un extra que apunta a un RutaPaso ausente', () => {
    const res = insertar(base, [extra('X', 'NO_EXISTE')]);
    expect(res.map((p) => p.rutaPasoId)).toEqual(['A', 'B', 'X']);
  });
});
