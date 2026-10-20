import { Prisma } from '@prisma/client';
import { diaEnZona, entregasParaPantalla } from './entregas-pantalla';

const item = (
  id: string,
  extras: Partial<
    Parameters<typeof entregasParaPantalla>[0][number]['items'][number]
  > = {},
) => ({
  id,
  parentItemId: null,
  contieneLotesEntrega: false,
  loteEntregaId: null,
  nombre: id,
  cantidad: new Prisma.Decimal(10),
  cantidadUnidad: 'un',
  fechaEntrega: null,
  entregadoEl: null,
  listoEnMostrador: false,
  pasos: [],
  ...extras,
});
const orden = (items: ReturnType<typeof item>[], extras = {}) => ({
  id: 'ot',
  numero: 'OT-1',
  estado: 'produccion',
  fechaEntrega: new Date('2026-10-19T00:00:00Z'),
  cliente: { nombre: 'Cliente ficticio' },
  items,
  ...extras,
});

it('respeta medianoche de la empresa sin desplazar las fechas civiles', () => {
  expect(
    diaEnZona(
      new Date('2026-10-19T02:00:00Z'),
      'America/Argentina/Buenos_Aires',
    ),
  ).toBe('2026-10-18');
  expect(
    entregasParaPantalla([orden([item('a')])], '2026-10-18').filas,
  ).toHaveLength(0);
  expect(
    entregasParaPantalla([orden([item('a')])], '2026-10-19').filas[0].atrasada,
  ).toBe(false);
});
it('separa lotes y componentes, descarta lo entregado y futuro sin duplicar cantidades', () => {
  const r = entregasParaPantalla(
    [
      orden([
        item('agrupador', {
          contieneLotesEntrega: true,
          cantidad: new Prisma.Decimal(100),
        }),
        item('lote1', {
          parentItemId: 'agrupador',
          loteEntregaId: 'l1',
          fechaEntrega: new Date('2026-10-18'),
          cantidad: new Prisma.Decimal(25),
        }),
        item('componente', {
          parentItemId: 'lote1',
          pasos: [{ indice: 0, nombre: 'Corte', estado: 'en_curso' }],
        }),
        item('lote2', {
          parentItemId: 'agrupador',
          loteEntregaId: 'l2',
          entregadoEl: new Date(),
        }),
        item('lote3', {
          parentItemId: 'agrupador',
          loteEntregaId: 'l3',
          fechaEntrega: new Date('2026-10-20'),
        }),
        item('simple', { listoEnMostrador: true }),
      ]),
    ],
    '2026-10-19',
  );
  expect(r.filas.map((f) => f.id)).toEqual(['lote1', 'simple']);
  expect(r.filas[0]).toMatchObject({
    cantidad: 25,
    etapa: 'Corte',
    pasosTotal: 1,
  });
  expect(r.resumen).toEqual({ atrasadas: 1, hoy: 0, listas: 1 });
});
it('mantiene finalizadas hasta la entrega y no inventa avance sin pasos', () => {
  const r = entregasParaPantalla(
    [
      orden([item('sin-pasos')]),
      orden([item('terminada')], { estado: 'finalizada' }),
    ],
    '2026-10-19',
  );
  expect(r.filas.find((f) => f.id === 'sin-pasos')?.estado).toBe('pendiente');
  expect(r.filas.find((f) => f.id === 'terminada')?.estado).toBe('lista');
  expect(
    entregasParaPantalla(
      [orden([item('sin-fecha')], { fechaEntrega: null })],
      '2026-10-19',
    ).filas,
  ).toEqual([]);
});
it('destaca el bloqueo y cuenta los pasos completados', () => {
  const r = entregasParaPantalla(
    [
      orden([
        item('a', {
          pasos: [
            { indice: 0, nombre: 'Impresión', estado: 'hecho' },
            { indice: 1, nombre: 'Terminación', estado: 'bloqueado' },
          ],
        }),
      ]),
    ],
    '2026-10-19',
  );
  expect(r.filas[0]).toMatchObject({
    estado: 'bloqueada',
    etapa: 'Bloqueada · Terminación',
    pasosHechos: 1,
    pasosTotal: 2,
  });
});

it.each(['2026-10-18', '2026-10-19'])(
  'separa las listas del trabajo pendiente aunque su fecha sea %s',
  (fecha) => {
    const r = entregasParaPantalla(
      [
        orden([item('finalizada')], {
          estado: 'finalizada',
          fechaEntrega: new Date(fecha),
        }),
        orden([
          item('mostrador', {
            listoEnMostrador: true,
            fechaEntrega: new Date(fecha),
          }),
          item('pasos-terminados', {
            fechaEntrega: new Date(fecha),
            pasos: [{ indice: 0, nombre: 'Corte', estado: 'hecho' }],
          }),
        ]),
      ],
      '2026-10-19',
    );
    expect(r.filas).toHaveLength(3);
    expect(r.filas.every((f) => f.estado === 'lista' && !f.atrasada)).toBe(true);
    expect(r.resumen).toEqual({ atrasadas: 0, hoy: 0, listas: 3 });
  },
);

it('prioriza trabajo sin terminar por fecha del ítem, sin adelantar las listas antiguas', () => {
  const r = entregasParaPantalla(
    [
      orden([
        item('lista-antigua', {
          fechaEntrega: new Date('2026-10-01'),
          listoEnMostrador: true,
        }),
        item('para-hoy'),
        item('atrasada', {
          fechaEntrega: new Date('2026-10-18'),
          pasos: [{ indice: 0, nombre: 'Impresión', estado: 'hecho' }],
        }),
        item('componente-pendiente', {
          parentItemId: 'atrasada',
          pasos: [{ indice: 0, nombre: 'Terminación', estado: 'pendiente' }],
        }),
        item('lista-con-componentes', {
          fechaEntrega: new Date('2026-10-17'),
          pasos: [{ indice: 0, nombre: 'Impresión', estado: 'hecho' }],
        }),
        item('componente-terminado', {
          parentItemId: 'lista-con-componentes',
          pasos: [{ indice: 0, nombre: 'Terminación', estado: 'hecho' }],
        }),
      ]),
    ],
    '2026-10-19',
  );
  expect(r.filas.map((f) => f.id)).toEqual([
    'atrasada',
    'para-hoy',
    'lista-antigua',
    'lista-con-componentes',
  ]);
  expect(r.filas[0]).toMatchObject({
    atrasada: true,
    estado: 'pendiente',
    pasosHechos: 1,
    pasosTotal: 2,
  });
  expect(r.resumen).toEqual({ atrasadas: 1, hoy: 1, listas: 2 });
});
