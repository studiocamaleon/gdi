import { ProductosService } from '../productos-servicios/productos.service';
import { RutasProduccionService } from '../productos-servicios/rutas-produccion.service';
import { MetodosPagoService } from '../administracion/metodos-pago.service';
import { EgresosService } from '../egresos/egresos.service';
import type { CurrentAuth } from '../auth/auth.types';

jest.mock('../administracion/acceso-cuentas', () => ({
  exigirTesoreriaCompleta: jest.fn().mockResolvedValue(undefined),
}));
const auth = {
  tenantId: '11111111-1111-4111-8111-111111111111',
} as CurrentAuth;
const capacidades = { exigir: jest.fn(), exigirOperacionTx: jest.fn() };

describe('Códigos derivados de nombres sin retroceso de expresiones regulares', () => {
  const punctuation = '-_! '.repeat(250_000);
  const cases = [
    ['__Árbol  de--prueba!!', 'ARBOL-DE-PRUEBA', 'arbol_de_prueba'],
    [punctuation + 'Árbol' + punctuation, 'ARBOL', 'arbol'],
    [punctuation, '', ''],
  ];
  it.each(cases)(
    'preserva códigos y alternativas para la entrada %#',
    async (nombre, upper, lower) => {
      expect(ProductosService.prototype['codigoFromNombre'](nombre)).toBe(
        upper || 'PRODUCTO-COPIA',
      );
      expect(RutasProduccionService.prototype['codigoFromNombre'](nombre)).toBe(
        upper || 'RUTA-COPIA',
      );
      const table = {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _max: { orden: 0 } }),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'ficticio', ...data }),
          ),
      };
      const pago = new MetodosPagoService(
        { metodoPago: table } as never,
        capacidades as never,
      );
      const result = await pago.create(auth, {
        nombre,
        tipo: 'efectivo',
      } as never);
      expect(result.codigo).toBe(lower || 'metodo');
      const tx = { categoriaEgreso: table };
      const egreso = new EgresosService(
        { $transaction: (fn: (t: unknown) => unknown) => fn(tx) } as never,
        null as never,
        null as never,
        null as never,
        capacidades as never,
      );
      jest
        .spyOn(egreso as any, 'asegurarCategorias')
        .mockResolvedValue(undefined);
      const categoria = await egreso.crearCategoria(auth, {
        nombre,
        naturaleza: 'operativo',
      } as never);
      expect(categoria.codigo).toBe(lower || 'categoria');
    },
  );
});
