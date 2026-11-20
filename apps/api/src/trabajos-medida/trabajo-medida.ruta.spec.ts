import { randomUUID } from 'node:crypto';
import type { CurrentAuth } from '../auth/auth.types';
import type { TrabajoMedidaDto } from './trabajo-medida.dto';
import { TrabajosMedidaService } from './trabajos-medida.service';
import { PERMISO_TRABAJO_MEDIDA } from './trabajo-medida.permiso';

const tenantId = randomUUID();
const estacionId = randomUUID();
const rutaId = randomUUID();
const base = {
  clave: randomUUID(),
  nombre: 'Diseño',
  familiaCodigo: 'diseno_grafico',
};
const manual = {
  clave: randomUUID(),
  nombre: 'Armado',
  familiaCodigo: 'trabajo_manual',
  estacionId,
};
const entrada: TrabajoMedidaDto = {
  nombre: 'Cartel de prueba',
  descripcion: '',
  cantidad: 1,
  unidad: 'unidad',
  precio: 100,
  basePrecio: 'TOTAL',
  tipoPrecio: 'NETO',
  categoriaFiscal: 'exento',
  costos: { materiales: 0, otros: [] },
  rutaOrigenId: rutaId,
  produccion: true,
  operaciones: [base, manual],
};
const auth = {
  tenantId,
  userId: randomUUID(),
  permisos: new Set([PERMISO_TRABAJO_MEDIDA]),
} as CurrentAuth;
function servicio(asignarRuta = true) {
  const listaVacia = { findMany: async () => [] };
  const db = {
    datosEmpresa: { findUnique: async () => null },
    centroCosto: listaVacia,
    centroCostoTarifaPeriodo: listaVacia,
    maquina: listaVacia,
    productoImpuestoCatalogo: listaVacia,
    productoComisionCatalogo: listaVacia,
    configuracionFiscal: { findUnique: async () => null },
    ruta: {
      findFirst: async () => ({
        nombre: 'Ruta de prueba',
        pasos: [{ id: base.clave, familiaCodigo: base.familiaCodigo }],
      }),
    },
    estacion: {
      findMany: async () => [
        {
          id: estacionId,
          activo: true,
          maquinas: [],
          reglas: asignarRuta
            ? [{ tipo: 'paso', valor: base.familiaCodigo }]
            : [],
        },
      ],
    },
  };
  return new TrabajosMedidaService(
    db as never,
    { crear: async () => ({ id: 'cambio-de-prueba' }) } as never,
    { exigir: async () => {} } as never,
  );
}
it('conserva la estación manual en la trazabilidad y usa las reglas para el paso de la ruta', async () => {
  const { result } = await servicio().calcular(auth, entrada);
  expect(result.cotizacion.pasos.map((p) => p.estacionManualId)).toEqual([
    undefined,
    estacionId,
  ]);
  expect(result.cotizacion.trabajoMedida.operaciones).toEqual([base, manual]);
});
it('rechaza una ruta cuyo paso no se puede enviar a una estación', async () => {
  await expect(servicio(false).calcular(auth, entrada)).rejects.toThrow(
    'estación activa',
  );
});
it('impide guardar sin producción, sin pasos o con un paso manual que omite la estación', async () => {
  for (const cambios of [
    { produccion: false },
    { operaciones: [] },
    { operaciones: [{ ...manual, estacionId: null }] },
  ]) {
    await expect(
      servicio().guardar(auth, { ...entrada, ...cambios }),
    ).rejects.toThrow(/ruta de producción|estación/);
  }
});
