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
    baseCalculo: 'NETO',
    traslado: 'POR_FUERA',
  };
  const iibb3: ImpuestoSnapshot = {
    catalogoId: 'imp-iibb-3',
    codigo: 'iibb',
    nombre: 'IIBB 3%',
    porcentaje: 3,
    orden: 1,
    baseCalculo: 'NETO',
    traslado: 'POR_DENTRO',
  };
  const cheque12: ImpuestoSnapshot = {
    catalogoId: 'imp-cheque-12',
    codigo: 'cheque',
    nombre: 'Imp. débito/crédito 1,2%',
    porcentaje: 1.2,
    orden: 2,
    baseCalculo: 'BRUTO_COBRADO',
    traslado: 'POR_DENTRO',
  };
  /** Snapshot viejo, sin baseCalculo/traslado → default POR_DENTRO/NETO. */
  const impuestoLegacy21: ImpuestoSnapshot = {
    catalogoId: 'imp-legacy-21',
    codigo: 'legacy_21',
    nombre: 'Impuesto legacy 21%',
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

  describe('comisiones e impuestos (modelo por base, normativa AR)', () => {
    it('IVA 21% POR_FUERA: se agrega al neto y no toca el margen', () => {
      const r = service.aplicar(baseInput({ impuestos: [iva21] }));
      // neto = 100/(1−0,50) = 200; IVA = 42; bruto = 242
      expect(r.precioNetoUnitario).toBe(200);
      expect(r.precioBrutoUnitario).toBe(242);
      expect(r.desglose.totalImpuestos).toBe(42);
      expect(r.desglose.precioBase).toBe(200);
      expect(r.desglose.margenEfectivoPct).toBe(50);
      expect(r.precioNetoTotal).toBe(2000);
      expect(r.precioBrutoTotal).toBe(2420);
    });

    it('margen objetivo 50% + comisión vendedor 5% preserva margen (sobre el neto)', () => {
      const r = service.aplicar(baseInput({ comisiones: [comisVend5] }));
      // neto = 100/(1−0,55) = 222,22
      expect(r.desglose.totalComisiones).toBe(11.11);
      expect(r.desglose.precioBase).toBe(211.11);
      expect(r.precioNetoUnitario).toBe(222.22);
      expect(r.precioBrutoUnitario).toBe(222.22);
      expect(r.desglose.margenEfectivoPct).toBe(50);
    });

    it('margen 50% + IVA 21% + comisión 5%: comisión por dentro del neto, IVA por fuera', () => {
      const r = service.aplicar(
        baseInput({ impuestos: [iva21], comisiones: [comisVend5] }),
      );
      // neto = 100/(1−0,50−0,05) = 222,22; IVA = 46,67; bruto = 268,89
      expect(r.precioNetoUnitario).toBe(222.22);
      expect(r.precioBrutoUnitario).toBe(268.89);
      expect(r.desglose.totalComisiones).toBe(11.11);
      expect(r.desglose.totalImpuestos).toBe(46.67);
      expect(r.desglose.precioBase).toBe(211.11);
      expect(r.desglose.margenEfectivoPct).toBe(50);
    });

    it('IIBB 3% POR_DENTRO sobre neto: gross-up como costo, no infla el bruto vía IVA', () => {
      const r = service.aplicar(baseInput({ impuestos: [iva21, iibb3] }));
      // neto = 100/(1−0,50−0,03) = 212,77; IVA = 44,68; bruto = 257,45
      expect(r.precioNetoUnitario).toBe(212.77);
      expect(r.precioBrutoUnitario).toBe(257.45);
      // impuestos = IVA 44,68 + IIBB 6,38 (3% del neto)
      expect(r.desglose.totalImpuestos).toBe(51.06);
      expect(r.desglose.precioBase).toBe(206.39);
      expect(r.desglose.margenEfectivoPct).toBe(50);
    });

    it('imp. al cheque 1,2% sobre BRUTO_COBRADO: se convierte a equivalente-neto ×(1+IVA)', () => {
      const r = service.aplicar(
        baseInput({
          precioConfig: {
            metodoCalculo: 'por_margen',
            detalle: { marginPct: 30 },
          },
          impuestos: [iva21, cheque12],
        }),
      );
      // carga interna = 1,2% × 1,21 = 1,452% → neto = 100/(1−0,30−0,01452) = 145,88
      expect(r.precioNetoUnitario).toBe(145.88);
      // IVA = 30,63; bruto = 176,51; cheque = 1,2% × 176,51 = 2,12
      expect(r.precioBrutoUnitario).toBe(176.51);
      expect(r.desglose.totalImpuestos).toBe(32.75);
      expect(r.desglose.precioBase).toBe(143.76);
      expect(r.desglose.margenEfectivoPct).toBe(30);
    });

    it('snapshot legacy sin baseCalculo/traslado se comporta POR_DENTRO/NETO', () => {
      const r = service.aplicar(baseInput({ impuestos: [impuestoLegacy21] }));
      // neto = 100/(1−0,50−0,21) = 344,83; sin impuestos por fuera → bruto = neto
      expect(r.precioNetoUnitario).toBe(344.83);
      expect(r.precioBrutoUnitario).toBe(344.83);
      expect(r.desglose.totalImpuestos).toBe(72.41);
      expect(r.desglose.precioBase).toBe(272.42);
      expect(r.desglose.margenEfectivoPct).toBe(50);
    });

    it('comisión de pasarela 4% sobre BRUTO_COBRADO: equivalente-neto ×(1+IVA)', () => {
      const pasarela4: ComisionSnapshot = {
        catalogoId: 'com-mp-4',
        codigo: 'mp_4',
        nombre: 'Mercado Pago 4%',
        porcentaje: 4,
        orden: 0,
        baseCalculo: 'BRUTO_COBRADO',
      };
      const r = service.aplicar(
        baseInput({
          precioConfig: {
            metodoCalculo: 'por_margen',
            detalle: { marginPct: 30 },
          },
          impuestos: [iva21],
          comisiones: [pasarela4],
        }),
      );
      // carga interna = 4% × 1,21 = 4,84% → neto = 100/(1−0,30−0,0484) = 153,47
      expect(r.precioNetoUnitario).toBe(153.47);
      // IVA = 32,23; bruto = 185,70; comisión = 4% × 185,70 = 7,43
      expect(r.precioBrutoUnitario).toBe(185.7);
      expect(r.desglose.totalComisiones).toBe(7.43);
      expect(r.desglose.precioBase).toBe(146.04);
      expect(r.desglose.margenEfectivoPct).toBe(30);
    });

    it('comisión vendedor (NETO) + pasarela (BRUTO_COBRADO) conviven', () => {
      const pasarela4: ComisionSnapshot = {
        catalogoId: 'com-mp-4',
        codigo: 'mp_4',
        nombre: 'Mercado Pago 4%',
        porcentaje: 4,
        orden: 1,
        baseCalculo: 'BRUTO_COBRADO',
      };
      const r = service.aplicar(
        baseInput({
          precioConfig: {
            metodoCalculo: 'por_margen',
            detalle: { marginPct: 30 },
          },
          impuestos: [iva21],
          comisiones: [comisVend5, pasarela4],
        }),
      );
      // carga interna = 5% + 4%×1,21 = 9,84% → neto = 100/(1−0,30−0,0984) = 166,22
      expect(r.precioNetoUnitario).toBe(166.22);
      // comisiones = neto×5% + bruto×4% = 8,31 + 8,05 = 16,36
      expect(r.desglose.totalComisiones).toBe(16.36);
      expect(r.desglose.margenEfectivoPct).toBe(30);
    });

    it('rechaza POR_FUERA con base BRUTO_COBRADO (no tiene sentido)', () => {
      const invalido: ImpuestoSnapshot = {
        ...iva21,
        baseCalculo: 'BRUTO_COBRADO',
      };
      expect(() =>
        service.aplicar(baseInput({ impuestos: [invalido] })),
      ).toThrow(BadRequestException);
    });
  });

  describe('precio fijo e IVA por fuera (precioIncluyeIva)', () => {
    it('default: el precio configurado incluye IVA → neto = precio / 1,21', () => {
      const r = service.aplicar(
        baseInput({
          precioConfig: {
            metodoCalculo: 'precio_fijo',
            detalle: { price: 121 },
          },
          impuestos: [iva21],
        }),
      );
      expect(r.precioNetoUnitario).toBe(100);
      expect(r.precioBrutoUnitario).toBe(121);
      expect(r.desglose.totalImpuestos).toBe(21);
    });

    it('precioIncluyeIva=false: el precio configurado es el neto', () => {
      const r = service.aplicar(
        baseInput({
          precioConfig: {
            metodoCalculo: 'precio_fijo',
            detalle: { price: 100, precioIncluyeIva: false },
          },
          impuestos: [iva21],
        }),
      );
      expect(r.precioNetoUnitario).toBe(100);
      expect(r.precioBrutoUnitario).toBe(121);
    });

    it('precio_fijo_para_margen_minimo compara netos (price con IVA vs piso)', () => {
      const r = service.aplicar(
        baseInput({
          costoUnitario: 100,
          precioConfig: {
            metodoCalculo: 'precio_fijo_para_margen_minimo',
            detalle: { price: 121, minimumMarginPct: 30 },
          },
          impuestos: [iva21],
        }),
      );
      // neto del price = 100; piso = 100/(1−0,30) = 142,86 → gana el piso
      expect(r.precioNetoUnitario).toBe(142.86);
      expect(r.precioBrutoUnitario).toBe(172.86);
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

  describe('costos trasladados sin margen', () => {
    const comision10: ComisionSnapshot = {
      catalogoId: 'com-10',
      codigo: 'com_10',
      nombre: 'Comisión 10%',
      porcentaje: 10,
      orden: 0,
      baseCalculo: 'NETO',
    };

    it('recupera costo, comisión e IVA sin aplicar utilidad al cargo', () => {
      const r = service.aplicar(
        baseInput({
          costoUnitario: 190,
          costoSinMargenUnitario: 90,
          cantidad: 1,
          precioConfig: {
            metodoCalculo: 'por_margen',
            detalle: { marginPct: 40 },
          },
          impuestos: [iva21],
          comisiones: [comision10],
        }),
      );

      // $100 con margen: 100/(1-.40-.10) = 200.
      // $90 trasladados: 90/(1-.10) = 100. IVA: 21% por fuera.
      expect(r.desglose.trasladoSinMargenUnitario).toBe(100);
      expect(r.precioNetoUnitario).toBe(300);
      expect(r.precioBrutoUnitario).toBe(363);
      expect(r.desglose.totalComisiones).toBe(30);
      expect(r.desglose.precioBase).toBe(270);
      expect(r.desglose.margenEfectivoPct).toBe(26.67);
    });

    it('el descuento comercial no reduce el componente trasladado', () => {
      const r = service.aplicar(
        baseInput({
          costoUnitario: 190,
          costoSinMargenUnitario: 90,
          cantidad: 1,
          precioConfig: {
            metodoCalculo: 'por_margen',
            detalle: { marginPct: 40 },
          },
          comisiones: [comision10],
          descuento: { tipo: 'PORCENTAJE', valor: 10 },
        }),
      );

      // Sólo descuenta 10% de los $200 marginables. Los $100 trasladados quedan.
      expect(r.descuento.montoUnitario).toBe(20);
      expect(r.descuento.netoListaUnitario).toBe(300);
      expect(r.precioNetoUnitario).toBe(280);
      expect(r.desglose.trasladoSinMargenUnitario).toBe(100);
    });

    it('rechaza un costo sin margen mayor al costo total', () => {
      expect(() =>
        service.aplicar(
          baseInput({ costoUnitario: 100, costoSinMargenUnitario: 101 }),
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

  // ════════════════════════════════════════════════════════════════════
  // Descuento comercial (sobre el neto de lista, antes del IVA)
  // ════════════════════════════════════════════════════════════════════

  describe('descuento', () => {
    it('sin descuento: aplicado=false y montos en 0, precio intacto', () => {
      const r = service.aplicar(baseInput());
      expect(r.descuento.aplicado).toBe(false);
      expect(r.descuento.montoUnitario).toBe(0);
      expect(r.descuento.montoTotal).toBe(0);
      expect(r.descuento.netoListaUnitario).toBe(200);
      expect(r.precioNetoUnitario).toBe(200);
    });

    it('PORCENTAJE: 10% baja el neto de lista y recomputa el margen', () => {
      // costo 100, margen 50% → neto lista 200; −10% → neto 180.
      const r = service.aplicar(
        baseInput({ descuento: { tipo: 'PORCENTAJE', valor: 10 } }),
      );
      expect(r.precioNetoUnitario).toBe(180);
      expect(r.descuento.montoUnitario).toBe(20);
      expect(r.descuento.montoTotal).toBe(200);
      expect(r.descuento.netoListaUnitario).toBe(200);
      // margen efectivo = (180 − 100) / 180 × 100
      expect(r.desglose.margenEfectivoPct).toBe(44.44);
    });

    it('PORCENTAJE: el IVA se calcula sobre el neto YA descontado', () => {
      const r = service.aplicar(
        baseInput({
          impuestos: [iva21],
          descuento: { tipo: 'PORCENTAJE', valor: 10 },
        }),
      );
      expect(r.precioNetoUnitario).toBe(180);
      // IVA 21% sobre 180 = 37.8 → bruto 217.8 (no sobre 200)
      expect(r.precioBrutoUnitario).toBe(217.8);
    });

    it('PORCENTAJE: la comisión escala con el neto descontado', () => {
      // Con comisión 5% el neto de lista viene grosseado-up: 100/(1−.50−.05)
      // = 222.22. El −10% lo baja a 200, y la comisión recomputa: 200×5% = 10.
      const r = service.aplicar(
        baseInput({
          comisiones: [comisVend5],
          descuento: { tipo: 'PORCENTAJE', valor: 10 },
        }),
      );
      expect(r.precioNetoUnitario).toBe(200);
      expect(r.desglose.totalComisiones).toBe(10);
      expect(r.desglose.precioBase).toBe(190);
    });

    it('MONTO: es sobre el neto TOTAL de la línea, prorrateado por unidad', () => {
      // cantidad 10, neto lista 2000; −$500 → neto total 1500, unitario 150.
      const r = service.aplicar(
        baseInput({ descuento: { tipo: 'MONTO', valor: 500 } }),
      );
      expect(r.precioNetoUnitario).toBe(150);
      expect(r.precioNetoTotal).toBe(1500);
      expect(r.descuento.montoTotal).toBe(500);
    });

    it('deja el margen NEGATIVO si el descuento se pasa (costo fijo)', () => {
      // costo 100, neto lista 200; −60% → neto 80 < costo → margen negativo.
      const r = service.aplicar(
        baseInput({ descuento: { tipo: 'PORCENTAJE', valor: 60 } }),
      );
      expect(r.precioNetoUnitario).toBe(80);
      expect(r.desglose.margenEfectivoPct).toBeLessThan(0);
    });

    it('nunca deja el neto por debajo de 0 (clamp)', () => {
      const pct = service.aplicar(
        baseInput({ descuento: { tipo: 'PORCENTAJE', valor: 150 } }),
      );
      expect(pct.precioNetoUnitario).toBe(0);
      const monto = service.aplicar(
        baseInput({ descuento: { tipo: 'MONTO', valor: 999999 } }),
      );
      expect(monto.precioNetoUnitario).toBe(0);
    });
  });
});
