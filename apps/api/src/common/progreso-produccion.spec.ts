import {
  calcularProgreso,
  progresoDeCampana,
  progresoDeOrden,
  type PasoProgreso,
} from './progreso-produccion';
const paso = (
  duracionEstimadaMin: number | null,
  estado = 'pendiente',
): PasoProgreso => ({ duracionEstimadaMin, estado });
describe('progreso explicable', () => {
  it('pondera trabajo cotizado, sin avance automático de lo que está en curso', () => {
    const p = calcularProgreso([paso(15, 'hecho'), paso(225, 'en_curso')]);
    expect(p).toMatchObject({
      porcentaje: 6,
      minutosTotal: 240,
      minutosCompletados: 15,
    });
    expect(p.explicacion).toContain('15 de 240 minutos');
  });
  it('reabrir reduce avance sin cambiar tiempos', () => {
    const pasos = [paso(15, 'hecho'), paso(225, 'hecho')];
    expect(calcularProgreso(pasos).porcentaje).toBe(100);
    pasos[1].estado = 'pendiente';
    expect(calcularProgreso(pasos).porcentaje).toBe(6);
    expect(pasos[1].duracionEstimadaMin).toBe(225);
  });
  it('no redondea a 100 mientras falte una operación pequeña', () => {
    expect(calcularProgreso([paso(1000, 'hecho'), paso(0.01)]).porcentaje).toBe(
      99,
    );
  });
  it('no duplica participaciones de operaciones compartidas', () => {
    expect(
      calcularProgreso([
        paso(60, 'hecho'),
        paso(60),
        { ...paso(0, 'hecho'), nestingLoteRol: 'PARTICIPANTE' },
      ]),
    ).toMatchObject({
      porcentaje: 50,
      minutosTotal: 120,
      operacionesTotal: 2,
      operacionesSinTiempo: 0,
    });
  });
  it.each([null, 0, -1, NaN, Infinity])(
    'explica la ponderación de tiempos inválidos (%s)',
    (n) => {
      const p = calcularProgreso([paso(30, 'hecho'), paso(n)]);
      expect(p).toMatchObject({
        porcentaje: 50,
        minutosTotal: 60,
        operacionesSinTiempo: 1,
      });
      expect(p.explicacion).toContain('mediana');
    },
  );
  it('sin tiempos cuenta operaciones y no presenta minutos ficticios', () => {
    expect(calcularProgreso([paso(null, 'hecho'), paso(null)])).toMatchObject({
      porcentaje: 50,
      base: 'operaciones',
      minutosTotal: null,
    });
  });
  it('un estado manual no inventa operaciones completadas', () => {
    expect(
      progresoDeOrden({ estado: 'finalizada', pasos: [] }).porcentaje,
    ).toBeNull();
    expect(
      progresoDeOrden({ estado: 'finalizada', pasos: [paso(10)] }).porcentaje,
    ).toBe(0);
  });
  it.each(['borrador', 'cancelada'])(
    'excluye %s aun con pasos completos',
    (estado) => {
      expect(
        progresoDeOrden({ estado, pasos: [paso(10, 'hecho')] }),
      ).toMatchObject({ porcentaje: null, base: 'excluida' });
    },
  );
  it('acepta Decimal sin depender de Prisma en la web', () => {
    expect(
      calcularProgreso([
        { estado: 'hecho', duracionEstimadaMin: { toString: () => '15.5' } },
        paso(15.5),
      ]).porcentaje,
    ).toBe(50);
  });
});
describe('campañas ponderadas', () => {
  it('una hora no pesa igual que cien horas y excluye canceladas/borradores', () => {
    expect(
      progresoDeCampana([
        { estado: 'finalizada', pasos: [paso(60, 'hecho')] },
        { estado: 'pendiente', pasos: [paso(6000)] },
        { estado: 'cancelada', pasos: [paso(90000, 'hecho')] },
        { estado: 'borrador', pasos: [paso(90000, 'hecho')] },
      ]),
    ).toMatchObject({
      porcentaje: 1,
      minutosTotal: 6060,
      minutosCompletados: 60,
      operacionesTotal: 2,
    });
  });
  it('agrega pesos sin promediar porcentajes redondeados', () => {
    expect(
      progresoDeCampana([
        { estado: 'produccion', pasos: [paso(1, 'hecho'), paso(2)] },
        { estado: 'produccion', pasos: [paso(17, 'hecho'), paso(1)] },
      ]),
    ).toMatchObject({
      porcentaje: 86,
      minutosTotal: 21,
      minutosCompletados: 18,
    });
  });
  it('informa rutas faltantes e impide confirmar el 100%', () => {
    const p = progresoDeCampana([
      { estado: 'finalizada', pasos: [paso(60, 'hecho')] },
      { estado: 'pendiente', pasos: [] },
    ]);
    expect(p.porcentaje).toBeNull();
    expect(p.explicacion).toContain('1 OT sin operaciones');
  });
  it('no mezcla minutos con operaciones cuando faltan tiempos de una OT', () => {
    const p = progresoDeCampana([
      { estado: 'produccion', pasos: [paso(60, 'hecho')] },
      { estado: 'pendiente', pasos: [paso(null), paso(null)] },
    ]);
    expect(p).toMatchObject({
      porcentaje: 33,
      base: 'operaciones',
      minutosTotal: null,
    });
    expect(p.explicacion).toContain('todas las operaciones pesan igual');
  });
  it('una campaña vacía no tiene un cero ficticio', () => {
    expect(progresoDeCampana([]).porcentaje).toBeNull();
    expect(
      progresoDeCampana([{ estado: 'borrador', pasos: [paso(10)] }]).porcentaje,
    ).toBeNull();
  });
});
