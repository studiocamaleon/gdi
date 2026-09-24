import { RecetasProductoService } from '../recetas-producto.service';
import { validarYOrdenarGrafo } from '../../ordenes-trabajo/grafo-produccion';

function fixture(snapshotJson: unknown = { pasos: [] }) {
  const servicio = Object.create(RecetasProductoService.prototype) as any;
  servicio.prisma = { rutaVersion: { findFirst: jest.fn().mockResolvedValue({ snapshotJson }) } };
  const base = ['imprimir', 'refilar'].map((id, i) => ({ id, orden: i + 1, familiaCodigo: 'trabajo_manual' }));
  const ruta = {
    rutaId: 'ruta', rutaVersion: 1, ruta: { pasos: base },
    configPasos: base.map((rutaPaso) => ({ rutaPasoId: rutaPaso.id, rutaPaso, ordenFlujo: null as number | null })),
    pasosExtras: [
      { id: 'colocar', ordenInterno: 2, ordenFlujo: null as number | null, insertarDespuesDeRutaPasoId: 'refilar' as string | null },
      { id: 'desplotear', ordenInterno: 1, ordenFlujo: null as number | null, insertarDespuesDeRutaPasoId: 'refilar' as string | null },
    ],
  };
  async function inicial() {
    const resultado = await servicio.plantillaInicialDesdeRuta('tenant', ruta);
    const claves = [...ruta.configPasos.map((p) => `ruta:${p.rutaPasoId}`), ...ruta.pasosExtras.map((p) => `extra:${p.id}`)];
    return validarYOrdenarGrafo(claves.map((clave, indice) => ({ clave, indice })), resultado.dependencias);
  }
  return { servicio, ruta, inicial };
}

it('la primera versión conserva los extras históricos como secuencia y no como raíces paralelas', async () => {
  const { inicial, servicio } = fixture();
  const grafo = await inicial();
  expect(grafo.topologia).toBe('LINEAL');
  expect(grafo.nodos.map((n) => n.clave)).toEqual(['ruta:imprimir', 'ruta:refilar', 'extra:desplotear', 'extra:colocar']);
  expect(grafo.raices).toEqual(['ruta:imprimir']);
  expect(grafo.terminales).toEqual(['extra:colocar']);
  expect(servicio.prisma.rutaVersion.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant', rutaId: 'ruta', version: 1 } }));
});

it('conserva extras al inicio y entre dos pasos, además del orden interno', async () => {
  const f = fixture();
  f.ruta.pasosExtras[0].insertarDespuesDeRutaPasoId = null;
  f.ruta.pasosExtras[1].insertarDespuesDeRutaPasoId = 'imprimir';
  expect((await f.inicial()).nodos.map((n) => n.clave)).toEqual(['extra:colocar', 'ruta:imprimir', 'extra:desplotear', 'ruta:refilar']);
});

it('prioriza el orden unificado que el usuario guardó para ese producto', async () => {
  const f = fixture();
  f.ruta.configPasos[0].ordenFlujo = 1;
  f.ruta.configPasos[1].ordenFlujo = 3;
  f.ruta.pasosExtras[0].ordenFlujo = 0;
  f.ruta.pasosExtras[1].ordenFlujo = 2;
  expect((await f.inicial()).nodos.map((n) => n.clave)).toEqual(['extra:colocar', 'ruta:imprimir', 'extra:desplotear', 'ruta:refilar']);
});

it('también incluye extras cuando la plantilla base ya tiene un workflow lineal explícito', async () => {
  const f = fixture({ workflow: {
    contractVersion: 1, topologia: 'LINEAL',
    nodos: ['imprimir', 'refilar'].map((id, orden) => ({ clave: `ruta:${id}`, tipo: 'PASO', orden, familiaCodigo: 'trabajo_manual', nombreVisible: null, icono: 'Layout' })),
    aristas: [{ desdeClave: 'ruta:imprimir', haciaClave: 'ruta:refilar' }],
  } });
  expect((await f.inicial()).nodos.map((n) => n.clave)).toEqual(['ruta:imprimir', 'ruta:refilar', 'extra:desplotear', 'extra:colocar']);
});

it('conserva una plantilla con paralelos explícitos, incluso sin aristas', async () => {
  const f = fixture({ workflow: {
    contractVersion: 1, topologia: 'DAG',
    nodos: ['imprimir', 'refilar'].map((id, orden) => ({ clave: `ruta:${id}`, tipo: 'PASO', orden, familiaCodigo: 'trabajo_manual', nombreVisible: null, icono: 'Layout' })),
    aristas: [],
  } });
  f.ruta.pasosExtras = [];
  const grafo = await f.inicial();
  expect(grafo.topologia).toBe('DAG');
  expect(grafo.aristas).toEqual([]);
  expect(grafo.raices).toEqual(['ruta:imprimir', 'ruta:refilar']);
});
