import { BadRequestException } from '@nestjs/common';
import { AplicarPrecioService } from '../aplicar-precio.service';
import {
  AplicarPrecioInput,
  ImpuestoSnapshot,
  ComisionSnapshot,
  PrecioConfig,
} from '../aplicar-precio.types';

describe('AplicarPrecioService', () => {
  let service: AplicarPrecioService;

  beforeEach(() => {
    service = new AplicarPrecioService();
  });

  // Helpers
  const iva21: ImpuestoSnapshot = {
    catalogoId: 'imp-iva-21',
    codigo: 'iva_21',
    nombre: 'IVA 21%',
    porcentaje: 21,
    orden: 0,
  };
  const comisVend5: ComisionSnapshot = {
    catalogoId: 'com-vend-5',
    codigo: 'vend_5',
    nombre: 'Vendedor 5%',
    porcentaje: 5,
    orden: 0,
  };
  const sinImpuestos: ImpuestoSnapshot[] = [];
  const sinComisiones: ComisionSnapshot[] = [];

  const baseInput = (
    overrides: Partial<AplicarPrecioInput> = {},
  ): AplicarPrecioInput => ({
    costoUnitario: 100,
    cantidad: 10,
    precioConfig: { metodoCalculo: 'por_margen', detalle: { marginPct: 50 } },
    impuestos: sinImpuestos,
    comisiones: sinComisiones,
    ...overrides,
  });

  // ════════════════════════════════════════════════════════════════════
  // Métodos de cálculo del precio base (sin impuestos ni comisiones)
  // ════════════════════════════════════════════════════════════════════

  describe('por_margen', () => {
    it('aplica margen objetivo 50% sobre precio final: costo 100 → precio 200', () => {
      const r = service.aplicar(baseInput());
      expect(r.desglose.precioBase).toBe(200);
      expect(r.precioNetoUnitario).toBe(200);
      expect(r.precioBrutoUnitario).toBe(200);
      expect(r.precioNetoTotal).toBe(2000);
      expect(r.desglose.margenEfectivoPct).toBe(50);
    });

    it('margen 0% devuelve el costo', () => {
      const r = service.aplicar(
        baseInput({
          precioConfig: {
            metodoCalculo: 'por_margen',
            detalle: { marginPct: 0 },
          },
        }),
      );
      expect(r.desglose.precioBase).toBe(100);
    });

    it('margen objetivo 50% sobre precio final: 200', () => {
      const r = service.aplicar(
        baseInput({
          precioConfig: {
            metodoCalculo: 'por_margen',
            detalle: { marginPct: 50 },
          },
        }),
      );
      expect(r.desglose.precioBase).toBe(200);
    });

    it('rechaza si falta marginPct', () => {
      expect(() =>
        service.aplicar(
          baseInput({
            precioConfig: { metodoCalculo: 'por_margen', detalle: {} },
          }),
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('precio_fijo', () => {
    it('devuelve el price independiente del costo', () => {
      const r = service.aplicar(
        baseInput({
          costoUnitario: 50,
          precioConfig: {
            metodoCalculo: 'precio_fijo',
            detalle: { price: 200 },
          },
        }),
      );
      expect(r.desglose.precioBase).toBe(200);
    });
  });

  describe('precio_fijo_para_margen_minimo', () => {
    const cfg: PrecioConfig = {
      metodoCalculo: 'precio_fijo_para_margen_minimo',
      detalle: { price: 200, minimumMarginPct: 30 },
    };

    it('si price supera el precio necesario para margen mínimo, usa price', () => {
      const r = service.aplicar(
        baseInput({ costoUnitario: 100, precioConfig: cfg }),
      );
      // piso = 130, price = 200 → 200
      expect(r.desglose.precioBase).toBe(200);
    });

    it('si price < piso, usa el precio necesario para el margen mínimo', () => {
      const r = service.aplicar(
        baseInput({ costoUnitario: 250, precioConfig: cfg }),
      );
      expect(r.desglose.precioBase).toBe(357.14);
    });
  });

  describe('margen_variable (tramos por rango)', () => {
    const cfg: PrecioConfig = {
      metodoCalculo: 'margen_variable',
      detalle: {
        tiers: [
          { quantityUntil: 50, marginPct: 50 },
          { quantityUntil: 200, marginPct: 40 },
          { quantityUntil: 99999, marginPct: 30 },
        ],
      },
    };

    it('cantidad 30 → tramo 50, margen objetivo 50%', () => {
      const r = service.aplicar(baseInput({ cantidad: 30, precioConfig: cfg }));
      expect(r.desglose.precioBase).toBe(200);
    });

    it('cantidad 100 → tramo 200, margen objetivo 40%', () => {
      const r = service.aplicar(
        baseInput({ cantidad: 100, precioConfig: cfg }),
      );
      expect(r.desglose.precioBase).toBe(166.67);
    });

    it('cantidad 500 → último tramo, margen objetivo 30%', () => {
      const r = service.aplicar(
        baseInput({ cantidad: 500, precioConfig: cfg }),
      );
      expect(r.desglose.precioBase).toBe(142.86);
    });

    it('cantidad por encima del último tramo cae al último', () => {
      const r = service.aplicar(
        baseInput({ cantidad: 100000, precioConfig: cfg }),
      );
      expect(r.desglose.precioBase).toBe(142.86);
    });

    it('rechaza si tiers vacío', () => {
      expect(() =>
        service.aplicar(
          baseInput({
            precioConfig: {
              metodoCalculo: 'margen_variable',
              detalle: { tiers: [] },
            },
          }),
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('variable_por_cantidad (tramos por rango con precio fijo)', () => {
    const cfg: PrecioConfig = {
      metodoCalculo: 'variable_por_cantidad',
      detalle: {
        tiers: [
          { quantityUntil: 50, price: 60 },
          { quantityUntil: 200, price: 50 },
          { quantityUntil: 99999, price: 40 },
        ],
      },
    };

    it('cantidad 100 → $50/unidad', () => {
      const r = service.aplicar(
        baseInput({ cantidad: 100, precioConfig: cfg }),
      );
      expect(r.desglose.precioBase).toBe(50);
      expect(r.precioNetoTotal).toBe(5000);
    });
  });

  describe('fijado_por_cantidad (cantidades exactas)', () => {
    const cfg: PrecioConfig = {
      metodoCalculo: 'fijado_por_cantidad',
      detalle: {
        tiers: [
          { quantity: 100, price: 50 },
          { quantity: 500, price: 40 },
        ],
      },
    };

    it('cantidad 100 → $50/unidad', () => {
      const r = service.aplicar(
        baseInput({ cantidad: 100, precioConfig: cfg }),
      );
      expect(r.desglose.precioBase).toBe(50);
      expect(r.precioNetoTotal).toBe(5000);
    });

    it('cantidad no listada → BadRequest', () => {
      expect(() =>
        service.aplicar(baseInput({ cantidad: 250, precioConfig: cfg })),
      ).toThrow(BadRequestException);
    });
  });

  describe('fijo_con_margen_variable (cantidades exactas con margen)', () => {
    const cfg: PrecioConfig = {
      metodoCalculo: 'fijo_con_margen_variable',
      detalle: {
        tiers: [
          { quantity: 100, marginPct: 50 },
          { quantity: 500, marginPct: 30 },
        ],
      },
    };

    it('costo 100 + cantidad 100 → margen objetivo 50% → $200/unidad', () => {
      const r = service.aplicar(
        baseInput({ cantidad: 100, precioConfig: cfg }),
      );
      expect(r.desglose.precioBase).toBe(200);
    });

    it('cantidad 500 → margen objetivo 30% → $142,86/unidad', () => {
      const r = service.aplicar(
        baseInput({ cantidad: 500, precioConfig: cfg }),
      );
      expect(r.desglose.precioBase).toBe(142.86);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Aplicación de comisiones e impuestos sobre el precio base
  // ════════════════════════════════════════════════════════════════════

  describe('comisiones e impuestos', () => {
    it('margen objetivo 50% + IVA 21% preserva el margen sobre precio final', () => {
      const r = service.aplicar(baseInput({ impuestos: [iva21] }));
      expect(r.desglose.precioBase).toBe(272.42);
      expect(r.precioNetoUnitario).toBe(272.42);
      expect(r.precioBrutoUnitario).toBe(344.83);
      expect(r.desglose.totalImpuestos).toBe(72.41);
      expect(r.desglose.margenEfectivoPct).toBe(50);
    });

    it('margen objetivo 50% + comisión vendedor 5% preserva margen', () => {
      const r = service.aplicar(baseInput({ comisiones: [comisVend5] }));
      expect(r.desglose.totalComisiones).toBe(11.11);
      expect(r.desglose.precioBase).toBe(211.11);
      expect(r.precioNetoUnitario).toBe(222.22);
      expect(r.precioBrutoUnitario).toBe(222.22);
      expect(r.desglose.margenEfectivoPct).toBe(50);
    });

    it('margen objetivo 50% + IVA 21% + comisión 5% preserva margen', () => {
      const r = service.aplicar(
        baseInput({ impuestos: [iva21], comisiones: [comisVend5] }),
      );
      expect(r.desglose.totalComisiones).toBe(20.83);
      expect(r.desglose.totalImpuestos).toBe(87.5);
      expect(r.desglose.precioBase).toBe(308.34);
      expect(r.precioNetoUnitario).toBe(329.17);
      expect(r.precioBrutoUnitario).toBe(416.67);
      expect(r.desglose.margenEfectivoPct).toBe(50);
    });

    it('múltiples impuestos suman su porcentaje', () => {
      const ingresosBrutos = {
        ...iva21,
        codigo: 'iibb',
        nombre: 'IIBB 3%',
        porcentaje: 3,
      };
      const r = service.aplicar(
        baseInput({ impuestos: [iva21, ingresosBrutos] }),
      );
      expect(r.desglose.totalImpuestos).toBe(92.31);
      expect(r.precioBrutoUnitario).toBe(384.62);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Margen mínimo
  // ════════════════════════════════════════════════════════════════════

  describe('margen mínimo (minimumMarginPct)', () => {
    it('por_margen con marginPct=10 y minimumMarginPct=50: precio sube al piso', () => {
      const r = service.aplicar(
        baseInput({
          precioConfig: {
            metodoCalculo: 'por_margen',
            detalle: { marginPct: 10, minimumMarginPct: 50 },
          },
        }),
      );
      expect(r.desglose.precioBase).toBe(111.11);
    });

    it('por_margen rechaza marginPct=100 porque no es calculable', () => {
      expect(() =>
        service.aplicar(
          baseInput({
            precioConfig: {
              metodoCalculo: 'por_margen',
              detalle: { marginPct: 100, minimumMarginPct: 50 },
            },
          }),
        ),
      ).toThrow(BadRequestException);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Snapshots
  // ════════════════════════════════════════════════════════════════════

  describe('snapshots', () => {
    it('devuelve precioConfig + impuestos + comisiones intactos', () => {
      const cfg: PrecioConfig = {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 40 },
      };
      const r = service.aplicar(
        baseInput({
          precioConfig: cfg,
          impuestos: [iva21],
          comisiones: [comisVend5],
        }),
      );
      expect(r.snapshots.precioConfig).toEqual(cfg);
      expect(r.snapshots.impuestos).toEqual([iva21]);
      expect(r.snapshots.comisiones).toEqual([comisVend5]);
      expect(r.snapshots.precioEspecialCliente).toBeNull();
    });

    it('si hay precioEspecialCliente, lo incluye en snapshots', () => {
      const overrideConfig: PrecioConfig = {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 30 },
      };
      const r = service.aplicar(
        baseInput({
          precioConfig: overrideConfig,
          precioEspecialCliente: {
            precioEspecialId: 'pec-1',
            clienteId: 'cli-1',
            config: overrideConfig,
          },
        }),
      );
      expect(r.snapshots.precioEspecialCliente?.precioEspecialId).toBe('pec-1');
      expect(r.snapshots.precioEspecialCliente?.config).toEqual(overrideConfig);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Validaciones
  // ════════════════════════════════════════════════════════════════════

  describe('validaciones', () => {
    it('rechaza costo negativo', () => {
      expect(() => service.aplicar(baseInput({ costoUnitario: -1 }))).toThrow(
        BadRequestException,
      );
    });

    it('rechaza cantidad cero', () => {
      expect(() => service.aplicar(baseInput({ cantidad: 0 }))).toThrow(
        BadRequestException,
      );
    });

    it('rechaza método inválido', () => {
      expect(() =>
        service.aplicar(
          baseInput({
            precioConfig: {
              metodoCalculo: 'cualquier_cosa' as never,
              detalle: {},
            },
          }),
        ),
      ).toThrow(BadRequestException);
    });

    it('rechaza impuesto con porcentaje fuera de rango', () => {
      const malo: ImpuestoSnapshot = { ...iva21, porcentaje: 150 };
      expect(() => service.aplicar(baseInput({ impuestos: [malo] }))).toThrow(
        BadRequestException,
      );
    });
  });
});
