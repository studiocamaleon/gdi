import type { CurrentAuth } from '../../auth/auth.types';
import { puedeOperarComprobante } from '../permisos-comprobantes';

const factura = ['factura', false] as const;
const facturaOT = ['factura', true] as const;
const debito = ['nota_debito', true] as const;
const credito = ['nota_credito', true] as const;
describe('alcance del permiso fiscal dentro de los servicios', () => {
  it.each([
    {
      nombre: 'facturación',
      permisos: ['acceso.por_vista', 'administracion.facturacion.gestionar'],
      esperados: [false, true, false, false],
    },
    {
      nombre: 'comprobantes',
      permisos: ['acceso.por_vista', 'administracion.comprobantes.gestionar'],
      esperados: [true, true, true, false],
    },
    {
      nombre: 'anular',
      permisos: ['acceso.por_vista', 'administracion.anular'],
      esperados: [false, false, false, true],
    },
    {
      nombre: 'sólo lectura',
      permisos: [
        'acceso.por_vista',
        'administracion.facturacion.ver',
        'administracion.comprobantes.ver',
      ],
      esperados: [false, false, false, false],
    },
    {
      nombre: 'administración histórica',
      permisos: ['administracion.gestionar'],
      esperados: [true, true, true, false],
    },
    {
      nombre: 'global residual en rol por vista',
      permisos: ['acceso.por_vista', 'administracion.gestionar'],
      esperados: [false, false, false, false],
    },
    {
      nombre: 'sin permisos',
      permisos: [],
      esperados: [false, false, false, false],
    },
  ])(
    '$nombre respeta la clase y el vínculo del comprobante',
    ({ permisos, esperados }) => {
      const auth = {
        role: 'ADMINISTRADOR',
        permisos: new Set(permisos),
      } as CurrentAuth;
      expect(
        [factura, facturaOT, debito, credito].map(([tipo, orden]) =>
          puedeOperarComprobante(auth, tipo, orden),
        ),
      ).toEqual(esperados);
      expect(puedeOperarComprobante(auth, 'tipo-inexistente', true)).toBe(
        false,
      );
    },
  );
  it('el enum administrador sin permisos efectivos no autoriza la operación', () => {
    expect(
      puedeOperarComprobante(
        { role: 'ADMINISTRADOR' } as CurrentAuth,
        'factura',
        true,
      ),
    ).toBe(false);
  });
});
