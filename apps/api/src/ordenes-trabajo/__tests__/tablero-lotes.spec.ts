import { contextoLoteTablero, esperasTablero } from '../tablero-contexto-lote';

const loteEntrega = {
  id: 'lote-b',
  secuencia: 1,
  cantidad: 50,
  productoItemId: 'comercial',
  producto: { nombre: 'Exhibidor', cantidadUnidad: 'u' },
};

it('distingue el producto del lote y sus componentes con una misma identidad visible', () => {
  expect(
    contextoLoteTablero({ parentItemId: 'comercial', loteEntrega }),
  ).toMatchObject({
    nombre: 'Lote B',
    cantidad: 50,
    esProductoDelLote: true,
  });
  expect(
    contextoLoteTablero({ parentItemId: 'trabajo-lote-b', loteEntrega }),
  ).toMatchObject({
    nombre: 'Lote B',
    cantidad: 50,
    esProductoDelLote: false,
  });
  expect(contextoLoteTablero({ parentItemId: 'comercial' })).toBeNull();
});

it('nombra únicamente las dependencias pendientes y conserva el lote real del predecesor', () => {
  const item = {
    id: 'componente',
    nombre: 'Corrugado',
    parentItemId: 'trabajo-lote-b',
    loteEntrega,
  };
  const esperas = esperasTablero([
    {
      predecesorPasoId: 'impresion',
      predecesor: { nombre: 'Impresión', estado: 'hecho', item },
    },
    {
      predecesorPasoId: 'corte',
      predecesor: { nombre: 'Corte láser', estado: 'pendiente', item },
    },
    {
      predecesorPasoId: 'diseno',
      predecesor: {
        nombre: 'Preparar vector',
        estado: 'pendiente',
        item: {
          ...item,
          id: 'trabajo-a',
          nombre: 'Exhibidor · Lote A',
          parentItemId: 'comercial',
          loteEntrega: { ...loteEntrega, id: 'lote-a', secuencia: 0 },
        },
      },
    },
  ]);
  expect(esperas).toEqual([
    {
      pasoId: 'corte',
      pasoNombre: 'Corte láser',
      itemId: 'componente',
      itemNombre: 'Corrugado',
      loteNombre: 'Lote B',
    },
    {
      pasoId: 'diseno',
      pasoNombre: 'Preparar vector',
      itemId: 'trabajo-a',
      itemNombre: 'Exhibidor',
      loteNombre: 'Lote A',
    },
  ]);
});
