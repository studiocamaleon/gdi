import { randomUUID } from 'node:crypto';
import { calcularTrabajoMedida } from './trabajo-medida.calculo';
import type { TrabajoMedidaDto } from './trabajo-medida.dto';
import {
  autorizarSnapshotsMedida,
  exigirTrabajoMedida,
  PERMISO_TRABAJO_MEDIDA,
} from './trabajo-medida.permiso';
import { expandir, ROLES_PREDEFINIDOS } from '../auth/permisos';
import type { CurrentAuth } from '../auth/auth.types';
import { podarPlata } from '../auth/margenes';
import type { ImpuestoSnapshot } from '../productos-servicios/precio/aplicar-precio.types';

const centro = randomUUID();
const iva: ImpuestoSnapshot = {
  catalogoId: randomUUID(),
  codigo: 'IVA',
  nombre: 'IVA de prueba',
  porcentaje: 21,
  traslado: 'POR_FUERA',
  baseCalculo: 'NETO',
  orden: 0,
};
const dto = (c: Partial<TrabajoMedidaDto> = {}): TrabajoMedidaDto => ({
  nombre: 'Exhibidor especial',
  descripcion: 'Trabajo ficticio',
  cantidad: 2,
  unidad: 'unidad',
  precio: 242000,
  tipoPrecio: 'FINAL',
  basePrecio: 'TOTAL',
  categoriaFiscal: 'general',
  costos: { materiales: 80000, otros: [{ nombre: 'Traslado', costo: 10000 }] },
  produccion: true,
  operaciones: [
    {
      clave: randomUUID(),
      nombre: 'Armado',
      familiaCodigo: 'trabajo_manual',
      centroCostoId: centro,
      horas: 3,
    },
  ],
  ...c,
});
const tarifas = new Map([[centro, 20000]]);
describe('Trabajos a medida: precio pactado, costo y contribución', () => {
  it('un costo total aproximado ya incluye las horas, que sólo separan el componente interno', () => {
    expect(
      calcularTrabajoMedida(
        dto({
          costos: {
            modo: 'TOTAL',
            totalEstimado: 150000,
            materiales: 0,
            otros: [],
          },
        }),
        tarifas,
        [iva],
        [],
        2,
      ),
    ).toMatchObject({
      costo: 150000,
      horas: 60000,
      otros: 90000,
      margen: 50000,
      contribucion: 110000,
    });
    expect(
      calcularTrabajoMedida(
        dto({
          operaciones: [],
          produccion: false,
          costos: {
            modo: 'TOTAL',
            totalEstimado: 150000,
            materiales: 0,
            otros: [],
          },
        }),
        tarifas,
        [iva],
        [],
        2,
      ),
    ).toMatchObject({
      costo: 150000,
      horas: 0,
      variables: 150000,
      margen: 50000,
      contribucion: 50000,
    });
  });
  it('exige un costo total explícito y que incluya las horas declaradas', () => {
    expect(() =>
      calcularTrabajoMedida(
        dto({ costos: { modo: 'TOTAL', materiales: 0, otros: [] } }),
        tarifas,
        [iva],
        [],
        2,
      ),
    ).toThrow('costo total');
    expect(() =>
      calcularTrabajoMedida(
        dto({
          costos: { modo: 'TOTAL', totalEstimado: 1, materiales: 0, otros: [] },
        }),
        tarifas,
        [iva],
        [],
        2,
      ),
    ).toThrow('horas');
  });
  it('separa IVA y costea horas del trabajo completo una sola vez', () => {
    expect(calcularTrabajoMedida(dto(), tarifas, [iva], [], 2)).toMatchObject({
      total: 242000,
      neto: 200000,
      iva: 42000,
      materiales: 80000,
      otros: 10000,
      horas: 60000,
      costo: 150000,
      margen: 50000,
      contribucion: 110000,
    });
  });
  it('neto y precio por unidad llegan al mismo total sin multiplicar los costos', () => {
    expect(
      calcularTrabajoMedida(
        dto({ precio: 100000, tipoPrecio: 'NETO', basePrecio: 'UNITARIO' }),
        tarifas,
        [iva],
        [],
        2,
      ),
    ).toMatchObject({ total: 242000, costo: 150000 });
  });
  it('los impuestos internos y las comisiones reducen el margen, sin aumentar el precio', () => {
    const interno = {
      ...iva,
      codigo: 'INTERNO',
      porcentaje: 3,
      traslado: 'POR_DENTRO' as const,
    };
    const comision = {
      ...iva,
      codigo: 'COMISION',
      porcentaje: 2,
      baseCalculo: 'BRUTO_COBRADO' as const,
    };
    expect(
      calcularTrabajoMedida(dto(), tarifas, [iva, interno], [comision], 2),
    ).toMatchObject({
      total: 242000,
      internos: 6000,
      comision: 4840,
      margen: 39160,
      contribucion: 99160,
    });
  });
  it('conserva centavos del final pactado con cantidades no divisibles', () => {
    expect(
      calcularTrabajoMedida(
        dto({ precio: 100, cantidad: 3 }),
        tarifas,
        [iva],
        [],
        2,
      ),
    ).toMatchObject({ total: 100, neto: 82.64, iva: 17.36 });
  });
  it('redondea la moneda CLP sin asumir IVA argentino', () => {
    expect(
      calcularTrabajoMedida(
        dto({ precio: 119001 }),
        tarifas,
        [{ ...iva, porcentaje: 19 }],
        [],
        0,
      ),
    ).toMatchObject({ total: 119001, neto: 100001, iva: 19000 });
  });
  it('un exento no agrega impuesto', () =>
    expect(calcularTrabajoMedida(dto(), tarifas, [], [], 2)).toMatchObject({
      total: 242000,
      neto: 242000,
      iva: 0,
    }));
  it('un descuento afecta el neto y los impuestos una vez', () =>
    expect(
      calcularTrabajoMedida(
        dto({ descuento: { tipo: 'PORCENTAJE', valor: 10 } }),
        tarifas,
        [iva],
        [],
        2,
      ),
    ).toMatchObject({ neto: 180000, total: 217800, descuento: 20000 }));
  it('permite asignar un centro sin tarifa mientras sus horas sigan sin estimar', () => {
    const input = dto();
    input.operaciones[0].horas = null;
    expect(calcularTrabajoMedida(input, new Map(), [iva], [], 2).horas).toBe(0);
  });
  it('no considera gratis un centro sin tarifa', () =>
    expect(() => calcularTrabajoMedida(dto(), new Map(), [iva], [], 2)).toThrow(
      'tarifa vigente',
    ));
  it('no acepta horas sin centro', () =>
    expect(() =>
      calcularTrabajoMedida(
        dto({
          operaciones: [
            {
              clave: randomUUID(),
              nombre: 'Armado',
              familiaCodigo: 'trabajo_manual',
              horas: 3,
            },
          ],
        }),
        tarifas,
        [iva],
        [],
        2,
      ),
    ).toThrow('centro de costo'));
  it('acepta estimaciones sin producción, conservando el costo', () =>
    expect(
      calcularTrabajoMedida(dto({ produccion: false }), tarifas, [iva], [], 2)
        .costo,
    ).toBe(150000));
});
describe('Permiso de trabajos a medida', () => {
  it.each(ROLES_PREDEFINIDOS)(
    'por defecto en $codigo: sólo Administrador',
    (rol) => {
      expect(expandir(rol.permisos).has(PERMISO_TRABAJO_MEDIDA)).toBe(
        rol.codigo === 'administrador',
      );
    },
  );
  it('gestión comercial general no concede el permiso', () => {
    const auth = {
      permisos: expandir(['comercial.gestionar']),
      role: 'ADMINISTRADOR',
    } as CurrentAuth;
    expect(() => exigirTrabajoMedida(auth)).toThrow('permiso');
  });
  it('el permiso explícito funciona en un rol personalizado', () =>
    expect(() =>
      exigirTrabajoMedida({
        permisos: expandir([PERMISO_TRABAJO_MEDIDA]),
      } as CurrentAuth),
    ).not.toThrow());
  it('impide copiar un snapshot autorizado por otra persona; deja conservar una línea existente', () => {
    const auth = { permisos: expandir(['comercial.gestionar']) } as CurrentAuth;
    const snapshot = {
      id: randomUUID(),
      snapshotJson: { origen: 'TRABAJO_MEDIDA' },
    };
    expect(() => autorizarSnapshotsMedida(auth, [snapshot])).toThrow('permiso');
    expect(() =>
      autorizarSnapshotsMedida(auth, [snapshot], new Set([snapshot.id])),
    ).not.toThrow();
  });
  it('los usuarios sin acceso a márgenes no reciben costos ni tarifas en snapshots', () => {
    expect(
      podarPlata({
        trabajoMedida: { nombre: 'Ejemplo', costos: { materiales: 80000 } },
        pasos: [{ tiempo: { tarifaHora: 20000, costo: 60000, totalMin: 180 } }],
      }),
    ).toEqual({
      trabajoMedida: { nombre: 'Ejemplo' },
      pasos: [{ tiempo: { totalMin: 180 } }],
    });
  });
});
