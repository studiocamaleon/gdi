import { proponerEntregasPiloto } from './prototipo-entregas';
import {
  conFechasAlcanzables,
  exhibidorControlado,
} from '../../../test/fixtures/f6-planificacion/exhibidor-controlado';

describe('Piloto F6: propuestas por entrega con el ETA real', () => {
  it('adelanta las primeras entregas y conserva una comparación económica', () => {
    const r = proponerEntregasPiloto(exhibidorControlado());
    const elegida = r.alternativas.find((a) => a.id === r.recomendadaId)!;
    const economica = r.alternativas.find((a) => a.id === r.economicaId)!;
    expect(elegida.estado).toBe('VIABLE');
    expect(elegida.entregas[0].fechaSugerida).toBe('2026-09-10');
    expect(economica.id).toBe('completo');
    expect(
      elegida.entregas[0].finProduccion! < economica.entregas[0].finProduccion!,
    ).toBe(true);
    expect(elegida.costoAdicional).toBeGreaterThan(0);
    expect(r.reservaCapacidad).toBe(false);
  });

  it('elige una agrupación de corte distinta del armado para cumplir las fechas con menos costo', () => {
    const r = proponerEntregasPiloto(conFechasAlcanzables());
    const elegida = r.alternativas.find((a) => a.id === r.recomendadaId)!;
    expect(elegida.id).toBe('pares-con-transferencia');
    expect(elegida.entregas.every((e) => e.cumple)).toBe(true);
    expect(elegida.costo).toBe(1360);
    expect(elegida.costoAdicional).toBe(65);
    const cuerpos = elegida.operaciones.filter(
      (o) => o.operacion === 'cuerpos',
    );
    const estantes = elegida.operaciones.filter(
      (o) => o.operacion === 'estantes',
    );
    const armados = elegida.operaciones.filter((o) => o.operacion === 'armado');
    expect(cuerpos.map((o) => o.cantidadPiezas)).toEqual([100, 100]);
    expect(estantes.map((o) => o.cantidadPiezas)).toEqual([200, 200]);
    expect(armados.map((o) => o.cantidadProductos)).toEqual([50, 50, 50, 50]);
    expect(armados[0].predecesoras).toEqual([cuerpos[0].id, estantes[0].id]);
    expect(armados[1].predecesoras).toEqual(armados[0].predecesoras);
    expect(armados[2].predecesoras).toEqual([cuerpos[1].id, estantes[1].id]);
  });

  it('no declara imposible una fecha: muestra que no encontró cumplimiento y conserva las alternativas', () => {
    const e = conFechasAlcanzables();
    e.entregas[0].fechaSolicitada = '2026-09-09';
    const r = proponerEntregasPiloto(e);
    expect(r.encontradaConFechas).toBe(false);
    expect(r.recomendadaId).not.toBeNull();
    expect(r.alternativas.every((a) => a.entregas[0].cumple === false)).toBe(
      true,
    );
    expect(r.alternativas.find((a) => a.id === r.recomendadaId)?.estado).toBe(
      'FUERA_DE_FECHA',
    );
  });

  it('conserva balances, precedencias y capacidad para todas las alternativas', () => {
    const r = proponerEntregasPiloto(exhibidorControlado());
    for (const a of r.alternativas) {
      for (const [codigo, esperado] of [
        ['cuerpos', 200],
        ['estantes', 400],
        ['armado', 200],
      ] as const) {
        expect(
          a.operaciones
            .filter((o) => o.operacion === codigo)
            .reduce((s, o) => s + o.cantidadPiezas, 0),
        ).toBe(esperado);
      }
      const porPaso = new Map(a.traza.map((p) => [p.pasoId, p]));
      for (const p of a.traza)
        for (const previo of p.predecesorPasoIds)
          expect(p.inicio.getTime()).toBeGreaterThanOrEqual(
            porPaso.get(previo)!.fin.getTime(),
          );
      for (const estacion of ['corte', 'armado']) {
        const pasos = a.traza
          .filter((p) => p.estacionKey === estacion)
          .sort((x, y) => x.inicio.getTime() - y.inicio.getTime());
        pasos
          .slice(1)
          .forEach((p, i) =>
            expect(p.inicio.getTime()).toBeGreaterThanOrEqual(
              pasos[i].fin.getTime(),
            ),
          );
      }
      expect(a.trabajosDesplazados).toEqual([]);
      expect(a.entregas.reduce((s, e) => s + e.cantidad, 0)).toBe(200);
    }
  });

  it('no inventa tiempos ni fechas a partir de medianas si falta la medición de esa cantidad', () => {
    const e = exhibidorControlado();
    e.operaciones[0].mediciones = [];
    e.taller.medianas = new Map([['corte', 10]]);
    const r = proponerEntregasPiloto(e);
    expect(r.recomendadaId).toBeNull();
    expect(r.alternativas.every((a) => a.estado === 'SIN_ESTIMACION')).toBe(
      true,
    );
    expect(
      r.alternativas.every((a) =>
        a.entregas.every((d) => d.finProduccion === null),
      ),
    ).toBe(true);
  });

  it('condiciona el resultado cuando falta confirmar material o un trabajo está bloqueado', () => {
    const e = exhibidorControlado();
    e.condicionesPendientes = ['Material pendiente de confirmación.'];
    e.taller.items[0].pasos[0].estado = 'bloqueado';
    const r = proponerEntregasPiloto(e);
    expect(r.encontradaConFechas).toBe(false);
    expect(r.alternativas.every((a) => a.estado === 'CONDICIONADA')).toBe(true);
    expect(r.alternativas[0].condiciones).toHaveLength(2);
  });

  it('detecta cuando insertar trabajo desplaza una operación ya comprometida', () => {
    const e = exhibidorControlado();
    const corte = e.taller.items[0].pasos[0];
    e.taller.items[0].pasos = [
      {
        ...corte,
        id: 'previo-diseno',
        familiaCodigo: 'diseno',
        maquinaId: undefined,
        duracionEstimadaMin: 60,
      },
      { ...corte, indice: 1 },
    ];
    e.taller.estaciones.push({
      ...e.taller.estaciones[1],
      id: 'diseno',
      familias: ['diseno'],
    });
    const r = proponerEntregasPiloto(e);
    expect(r.recomendadaId).toBeNull();
    expect(r.alternativas.every((a) => a.estado === 'DESPLAZA_TRABAJOS')).toBe(
      true,
    );
    expect(r.alternativas[0].trabajosDesplazados).toContain('corte-previo');
    const porEntrega = proponerEntregasPiloto({ ...e, porEntrega: true });
    expect(porEntrega.alternativas).toHaveLength(1);
    expect(porEntrega.alternativas[0].id).toBe('por-entrega');
    expect(porEntrega.alternativas[0].esperaCola).toBe(true);
    expect(porEntrega.alternativas[0].trabajosDesplazados).toEqual([]);
    expect(porEntrega.alternativas[0].entregas).toHaveLength(4);
  });

  it('respeta feriados, zona del taller y margen de promesa', () => {
    const e = conFechasAlcanzables();
    e.taller.noLaborables = new Set(['2026-09-10']);
    e.margenDiasHabiles = 1;
    const r = proponerEntregasPiloto(e);
    expect(
      r.alternativas.every((a) =>
        a.entregas.every((d) => d.fechaSugerida !== '2026-09-10'),
      ),
    ).toBe(true);
    expect(r.alternativas.every((a) => a.entregas[0].cumple === false)).toBe(
      true,
    );
    for (const a of r.alternativas)
      for (const p of a.traza)
        expect(p.inicio.toISOString().slice(0, 10)).not.toBe('2026-09-10');
  });

  it('distingue cumplir la fecha de conservar el margen configurado', () => {
    const e = conFechasAlcanzables();
    e.margenDiasHabiles = 1;
    const r = proponerEntregasPiloto(e);
    expect(r.alternativas.some((a) => a.estado === 'SIN_MARGEN')).toBe(true);
  });

  it('permite comparar la política económica sin reemplazar la prioridad de primeras entregas', () => {
    const e = exhibidorControlado();
    e.prioridadSinFechas = 'MENOR_COSTO';
    expect(proponerEntregasPiloto(e).recomendadaId).toBe('completo');
    expect(
      proponerEntregasPiloto(exhibidorControlado()).recomendadaId,
    ).not.toBe('completo');
  });

  it('una sola entrega no crea seis alternativas equivalentes', () => {
    const e = exhibidorControlado();
    e.entregas = [{ id: 'unica', cantidad: 200 }];
    expect(proponerEntregasPiloto(e).alternativas).toHaveLength(1);
  });

  it('prioriza las fechas abiertas incluso si otra entrega ya tiene fecha solicitada', () => {
    const e = exhibidorControlado();
    e.entregas[3].fechaSolicitada = '2026-09-16';
    expect(proponerEntregasPiloto(e).recomendadaId).toBe('por-entrega');
  });

  it('el calendario de fallback se presenta como condición y no como capacidad confirmada', () => {
    const e = exhibidorControlado();
    e.taller.estaciones[1].calendario = null;
    const r = proponerEntregasPiloto(e);
    expect(r.alternativas.every((a) => a.estado === 'CONDICIONADA')).toBe(true);
    expect(r.encontradaConFechas).toBe(false);
  });

  it('no modifica cola, calendarios, mediciones ni cantidades recibidas', () => {
    const e = exhibidorControlado();
    const copia = exhibidorControlado();
    const uno = proponerEntregasPiloto(e);
    expect(e).toEqual(copia);
    expect(proponerEntregasPiloto(e)).toEqual(uno);
  });

  it.each(['cantidad', 'fecha', 'ciclo', 'medicion', 'id'] as const)(
    'rechaza un contrato inválido: %s',
    (tipo) => {
      const e = exhibidorControlado();
      if (tipo === 'cantidad') e.entregas[0].cantidad = 49;
      if (tipo === 'fecha') e.entregas[0].fechaSolicitada = '2026-02-30';
      if (tipo === 'ciclo') e.operaciones[0].predecesoras = ['armado'];
      if (tipo === 'medicion') e.operaciones[0].mediciones[0].costo = -1;
      if (tipo === 'id') e.entregas[1].id = e.entregas[0].id;
      expect(() => proponerEntregasPiloto(e)).toThrow();
    },
  );
});
