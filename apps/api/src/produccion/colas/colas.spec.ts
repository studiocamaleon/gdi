import { disponibilidadCola } from './colas.service';
import { ColasProduccionController } from './colas.controller';
import { PERMISO_KEY } from '../../auth/permiso.decorator';

function paso() {
  return {
    id: 'print',
    itemId: 'item',
    indice: 1,
    nodoClave: 'print',
    estado: 'pendiente',
    motivoBloqueo: null,
    gatesOperativos: [],
    dependenciasEntrantes: [
      {
        predecesorPasoId: 'design',
        predecesor: {
          id: 'design',
          estado: 'hecho',
          nombre: 'Diseño',
          indice: 0,
          nodoClave: 'design',
        },
      },
    ],
    item: {
      pasos: [
        {
          id: 'design',
          estado: 'hecho',
          nombre: 'Diseño',
          indice: 0,
          nodoClave: 'design',
        },
        {
          id: 'print',
          estado: 'pendiente',
          indice: 1,
          nombre: 'Imprimir',
          nodoClave: 'print',
        },
      ],
    },
  } as unknown as Parameters<typeof disponibilidadCola>[0];
}
it('requiere permiso de producción para ambas lecturas', () => {
  expect(Reflect.getMetadata(PERMISO_KEY, ColasProduccionController)).toEqual([
    'produccion.ver',
  ]);
});
it('permite la frontera DAG y respeta dependencias de otros componentes', () => {
  const p = paso();
  expect(disponibilidadCola(p, [], true).estadoCola).toBe('listos');
  p.dependenciasEntrantes[0].predecesor.estado = 'pendiente';
  expect(disponibilidadCola(p, [], true)).toMatchObject({
    estadoCola: 'en_espera',
    motivos: ['Espera: Diseño.'],
  });
});
it('respeta la secuencia histórica sin nodoClave', () => {
  const p = paso();
  p.nodoClave = null;
  p.item.pasos.forEach((n) => (n.nodoClave = null));
  p.item.pasos[0].estado = 'pendiente';
  expect(disponibilidadCola(p, [], true).estadoCola).toBe('en_espera');
});
it('un material sin liberar, una aprobación pendiente y una máquina inactiva impiden anunciar listo', () => {
  const p = paso();
  p.gatesOperativos.push({
    tipo: 'MATERIAL',
    estado: 'PENDIENTE',
    detalle: null,
  });
  expect(disponibilidadCola(p, ['Arte final'], false)).toMatchObject({
    estadoCola: 'en_espera',
    motivos: [
      'La máquina necesita una estación activa y estar habilitada.',
      'Falta material disponible/asignado.',
      'Falta aprobación: Arte final.',
    ],
  });
});
it.each([
  ['en_curso', 'en_curso'],
  ['pausado', 'pausados'],
  ['bloqueado', 'bloqueados'],
])('muestra %s aunque la frontera esté libre', (estado, esperado) => {
  const p = paso();
  p.estado = estado;
  expect(disponibilidadCola(p, [], true).estadoCola).toBe(esperado);
});

it('conserva el bloqueo explícito aun cuando también falten dependencias y material', () => {
  const p = paso();
  p.estado = 'bloqueado';
  p.motivoBloqueo = 'Rodillo averiado';
  p.dependenciasEntrantes[0].predecesor.estado = 'pendiente';
  p.gatesOperativos.push({
    tipo: 'MATERIAL',
    estado: 'PENDIENTE',
    detalle: null,
  });
  expect(disponibilidadCola(p, [], true)).toMatchObject({
    estadoCola: 'bloqueados',
    motivos: expect.arrayContaining(['Rodillo averiado', 'Espera: Diseño.']),
  });
  p.estado = 'pendiente';
  p.motivoBloqueo = null;
  expect(disponibilidadCola(p, [], true).estadoCola).toBe('en_espera');
  p.dependenciasEntrantes[0].predecesor.estado = 'hecho';
  p.gatesOperativos = [];
  expect(disponibilidadCola(p, [], true).estadoCola).toBe('listos');
});
