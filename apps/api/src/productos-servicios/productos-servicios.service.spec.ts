import { ProductosServiciosService } from './productos-servicios.service';

describe('ProductosServiciosService V1 adicionales', () => {
  let service: ProductosServiciosService;
  let resolveImposicionMachineMargins: (
    allOperations: Array<{
      maquina: { parametrosTecnicosJson: unknown } | null;
    }>,
    operacionesCotizadas: Array<{
      maquina: { parametrosTecnicosJson: unknown } | null;
    }>,
  ) => { leftMm: number; rightMm: number; topMm: number; bottomMm: number };
  let calculateTerminatingOperationTiming: (input: {
    operacion: {
      maquina: { plantilla: string; parametrosTecnicosJson: unknown } | null;
      perfilOperativo: { detalleJson: unknown } | null;
    };
    cantidad: number;
    pliegos: number;
    setupMinBase: number;
    cleanupMinBase: number;
    tiempoFijoMinBase: number;
    cantidadObjetivoSalida: number;
    varianteAnchoMm: number;
    varianteAltoMm: number;
    overridesProductividad?: Record<string, unknown>;
  }) => { runMin: number; trace: Record<string, unknown> } | null;
  let buildOperacionesCotizadasOrdenadas: (
    operacionesBase: Array<{ orden: number; nombre: string; detalleJson?: unknown }>,
    routeEffects: Array<{
      effect: { id: string; nombre: string };
      insertion: { modo: 'append' | 'before_step' | 'after_step'; pasoPlantillaId: string | null };
      pasos: Array<{ orden: number; nombre: string; detalleJson?: unknown }>;
    }>,
    checklistOperaciones: Array<{ orden: number; nombre: string; detalleJson?: unknown }>,
    warnings: string[],
  ) => Array<{ orden: number; nombre: string; detalleJson?: unknown }>;
  let getProductoPrecioConfig: (
    detalleJson: unknown,
  ) => {
    metodoCalculo: string;
    measurementUnit: string | null;
    impuestos: {
      esquemaId: string | null;
      esquemaNombre: string;
      items: Array<{ nombre: string; porcentaje: number }>;
      porcentajeTotal: number;
    };
    comisiones: {
      items: Array<{ id: string; nombre: string; tipo: string; porcentaje: number; activo: boolean }>;
      porcentajeTotal: number;
    };
    detalle: Record<string, unknown>;
  } | null;
  let getProductoPrecioEspecialClientes: (
    detalleJson: unknown,
  ) => Array<{
    id: string;
    clienteId: string;
    clienteNombre: string;
    descripcion: string;
    activo: boolean;
    createdAt: string;
    updatedAt: string;
    metodoCalculo: string;
    measurementUnit: string | null;
    impuestos: {
      esquemaId: string | null;
      esquemaNombre: string;
      items: Array<{ nombre: string; porcentaje: number }>;
      porcentajeTotal: number;
    };
    comisiones: {
      items: Array<{ id: string; nombre: string; tipo: string; porcentaje: number; activo: boolean }>;
      porcentajeTotal: number;
    };
    detalle: Record<string, unknown>;
  }>;
  let resolveProductoPrecioEspecialClientes: (
    auth: { tenantId: string },
    items: Record<string, unknown>[],
  ) => Promise<
    Array<{
      id: string;
      clienteId: string;
      clienteNombre: string;
      descripcion: string;
      activo: boolean;
      createdAt: string;
      updatedAt: string;
      metodoCalculo: string;
      measurementUnit: string | null;
      impuestos: {
        esquemaId: string | null;
        esquemaNombre: string;
        items: Array<{ nombre: string; porcentaje: number }>;
        porcentajeTotal: number;
      };
      comisiones: {
        items: Array<{ id: string; nombre: string; tipo: string; porcentaje: number; activo: boolean }>;
        porcentajeTotal: number;
      };
      detalle: Record<string, unknown>;
    }>
  >;
  let mergeProductoDetalle: (
    detalleJson: unknown,
    patch: Record<string, unknown>,
  ) => Record<string, unknown>;
  let toProductoResponseBase: (item: Record<string, unknown>) => Record<string, unknown>;

  beforeEach(() => {
    service = new ProductosServiciosService({} as never);
    resolveImposicionMachineMargins = Reflect.get(
      service as unknown as Record<string, unknown>,
      'resolveImposicionMachineMargins',
    ) as typeof resolveImposicionMachineMargins;
    calculateTerminatingOperationTiming = Reflect.get(
      service as unknown as Record<string, unknown>,
      'calculateTerminatingOperationTiming',
    ) as typeof calculateTerminatingOperationTiming;
    buildOperacionesCotizadasOrdenadas = Reflect.get(
      service as unknown as Record<string, unknown>,
      'buildOperacionesCotizadasOrdenadas',
    ) as typeof buildOperacionesCotizadasOrdenadas;
    getProductoPrecioConfig = Reflect.get(
      service as unknown as Record<string, unknown>,
      'getProductoPrecioConfig',
    ) as typeof getProductoPrecioConfig;
    getProductoPrecioEspecialClientes = Reflect.get(
      service as unknown as Record<string, unknown>,
      'getProductoPrecioEspecialClientes',
    ) as typeof getProductoPrecioEspecialClientes;
    resolveProductoPrecioEspecialClientes = Reflect.get(
      service as unknown as Record<string, unknown>,
      'resolveProductoPrecioEspecialClientes',
    ) as typeof resolveProductoPrecioEspecialClientes;
    mergeProductoDetalle = Reflect.get(
      service as unknown as Record<string, unknown>,
      'mergeProductoDetalle',
    ) as typeof mergeProductoDetalle;
    toProductoResponseBase = Reflect.get(
      service as unknown as Record<string, unknown>,
      'toProductoResponseBase',
    ) as typeof toProductoResponseBase;
  });

  it('usa la ruta completa para márgenes de imposición aunque haya filtros por addon', () => {
    const allOperations = [
      {
        maquina: {
          parametrosTecnicosJson: {
            margenIzquierdo: 120,
            margenDerecho: 130,
            margenSuperior: 140,
            margenInferior: 150,
          },
        },
      },
    ];
    const operacionesCotizadas = [
      {
        maquina: {
          parametrosTecnicosJson: {
            margenIzquierdo: 10,
            margenDerecho: 10,
            margenSuperior: 10,
            margenInferior: 10,
          },
        },
      },
    ];

    expect(
      resolveImposicionMachineMargins.call(service, allOperations, operacionesCotizadas),
    ).toEqual({
      leftMm: 120,
      rightMm: 130,
      topMm: 140,
      bottomMm: 150,
    });
  });

  it('usa operaciones cotizadas solo como fallback cuando no hay ruta completa', () => {
    const operacionesCotizadas = [
      {
        maquina: {
          parametrosTecnicosJson: {
            margenIzquierdo: 110,
            margenDerecho: 120,
            margenSuperior: 130,
            margenInferior: 140,
          },
        },
      },
    ];

    expect(
      resolveImposicionMachineMargins.call(service, [], operacionesCotizadas),
    ).toEqual({
      leftMm: 110,
      rightMm: 120,
      topMm: 130,
      bottomMm: 140,
    });
  });

  it('calcula timing de guillotina con tandas por alto de boca', () => {
    const result = calculateTerminatingOperationTiming.call(service, {
      operacion: {
        maquina: {
          plantilla: 'GUILLOTINA',
          parametrosTecnicosJson: {
            altoBocaMm: 24,
          },
        },
        perfilOperativo: {
          detalleJson: null,
          sheetThicknessMm: 0.12,
          productivityValue: 30,
          feedReloadMin: 1,
        },
      },
      cantidad: 1000,
      pliegos: 1000,
      setupMinBase: 2,
      cleanupMinBase: 1,
      tiempoFijoMinBase: 0,
      cantidadObjetivoSalida: 1000,
      imposicion: {
        cols: 2,
        rows: 2,
      },
      varianteAnchoMm: 90,
      varianteAltoMm: 50,
    });

    expect(result).not.toBeNull();
    expect(result?.runMin).toBeGreaterThan(0);
    expect(result?.trace?.tandas).toBe(5);
  });

  it('calcula laminadora BOPP con mermas y área consumida', () => {
    const result = calculateTerminatingOperationTiming.call(service, {
      operacion: {
        maquina: {
          plantilla: 'LAMINADORA_BOPP_ROLLO',
          parametrosTecnicosJson: {
            anchoRolloMm: 330,
            velocidadMMin: 20,
            mermaArranqueMm: 500,
            mermaCierreMm: 300,
          },
        },
        perfilOperativo: {
          detalleJson: {
            gapEntreHojasMm: 6,
            margenLatIzqMm: 4,
            margenLatDerMm: 4,
            colaCorteMm: 2,
          },
        },
      },
      cantidad: 1000,
      pliegos: 1000,
      setupMinBase: 3,
      cleanupMinBase: 1,
      tiempoFijoMinBase: 0,
      cantidadObjetivoSalida: 1000,
      varianteAnchoMm: 210,
      varianteAltoMm: 297,
    });

    expect(result).not.toBeNull();
    expect(result?.runMin).toBeGreaterThan(0);
    expect(Number(result?.trace?.areaConsumidaM2 ?? 0)).toBeGreaterThan(0);
  });

  it('calcula redondeadora por golpes totales', () => {
    const result = calculateTerminatingOperationTiming.call(service, {
      operacion: {
        maquina: {
          plantilla: 'REDONDEADORA_PUNTAS',
          parametrosTecnicosJson: {
            golpesMinNominal: 40,
            maxEspesorPilaMm: 8,
          },
        },
        perfilOperativo: {
          detalleJson: {
            esquinasPorPieza: 4,
          },
        },
      },
      cantidad: 500,
      pliegos: 500,
      setupMinBase: 1,
      cleanupMinBase: 1,
      tiempoFijoMinBase: 0,
      cantidadObjetivoSalida: 500,
      varianteAnchoMm: 90,
      varianteAltoMm: 50,
    });

    expect(result).not.toBeNull();
    expect(Number(result?.trace?.golpesTotales ?? 0)).toBe(2000);
  });

  it('calcula perforadora con pasadas por pliego', () => {
    const result = calculateTerminatingOperationTiming.call(service, {
      operacion: {
        maquina: {
          plantilla: 'PERFORADORA',
          parametrosTecnicosJson: {
            pliegosMinNominal: 100,
            lineasPorPasadaMax: 1,
          },
        },
        perfilOperativo: {
          detalleJson: {
            lineasPerforado: 2,
            tipoPerforado: 'micro',
          },
        },
      },
      cantidad: 1000,
      pliegos: 1000,
      setupMinBase: 1,
      cleanupMinBase: 1,
      tiempoFijoMinBase: 0,
      cantidadObjetivoSalida: 1000,
      varianteAnchoMm: 210,
      varianteAltoMm: 297,
    });

    expect(result).not.toBeNull();
    expect(Number(result?.trace?.pasadasPorPliego ?? 0)).toBe(2);
    expect(result?.runMin).toBeGreaterThan(0);
  });

  it('usa overrides cuando no hay perfil operativo en regla de pasos', () => {
    const result = calculateTerminatingOperationTiming.call(service, {
      operacion: {
        maquina: {
          plantilla: 'PERFORADORA',
          parametrosTecnicosJson: {
            pliegosMinNominal: 100,
            lineasPorPasadaMax: 1,
          },
        },
        perfilOperativo: null,
      },
      cantidad: 1000,
      pliegos: 1000,
      setupMinBase: 1,
      cleanupMinBase: 1,
      tiempoFijoMinBase: 0,
      cantidadObjetivoSalida: 1000,
      varianteAnchoMm: 210,
      varianteAltoMm: 297,
      overridesProductividad: {
        lineasPerforado: 2,
      },
    });

    expect(result).not.toBeNull();
    expect((result as { sourceProductividad?: string } | null)?.sourceProductividad).toBe('override');
    expect(Number(result?.trace?.pasadasPorPliego ?? 0)).toBe(2);
  });

  it('mantiene el orden original de la ruta base al cotizar', () => {
    const warnings: string[] = [];
    const result = buildOperacionesCotizadasOrdenadas.call(
      service,
      [
        {
          orden: 1,
          nombre: 'Impresion Laser',
          detalleJson: { pasoPlantillaId: 'laser-step', matchingBase: true },
        },
        {
          orden: 2,
          nombre: 'Corte con guillotina',
          detalleJson: { pasoPlantillaId: 'guillo-step' },
        },
      ],
      [],
      [],
      warnings,
    );

    expect(warnings).toEqual([]);
    expect(result.map((item) => item.nombre)).toEqual([
      'Impresion Laser',
      'Corte con guillotina',
    ]);
    expect(result.map((item) => item.orden)).toEqual([1, 2]);
  });

  it('inserta route effects antes o después del paso de referencia', () => {
    const warnings: string[] = [];
    const result = buildOperacionesCotizadasOrdenadas.call(
      service,
      [
        { orden: 1, nombre: 'Impresion Laser', detalleJson: { pasoPlantillaId: 'laser-step' } },
        { orden: 2, nombre: 'Corte con guillotina', detalleJson: { pasoPlantillaId: 'guillo-step' } },
      ],
      [
        {
          effect: { id: 'effect-before', nombre: 'Laminado' },
          insertion: { modo: 'before_step', pasoPlantillaId: 'guillo-step' },
          pasos: [{ orden: 1, nombre: 'Laminado BOPP' }],
        },
        {
          effect: { id: 'effect-after', nombre: 'Puntillado' },
          insertion: { modo: 'after_step', pasoPlantillaId: 'guillo-step' },
          pasos: [{ orden: 1, nombre: 'Puntillado' }],
        },
      ],
      [],
      warnings,
    );

    expect(warnings).toEqual([]);
    expect(result.map((item) => item.nombre)).toEqual([
      'Impresion Laser',
      'Laminado BOPP',
      'Corte con guillotina',
      'Puntillado',
    ]);
  });

  it('lee la configuración de precio desde detalleJson', () => {
    expect(
      getProductoPrecioConfig.call(service, {
        precio: {
          metodoCalculo: 'por_margen',
          measurementUnit: 'unidad',
          detalle: { marginPct: 30, minimumMarginPct: 20 },
        },
      }),
    ).toEqual({
      metodoCalculo: 'por_margen',
      measurementUnit: 'unidad',
      impuestos: {
        esquemaId: null,
        esquemaNombre: '',
        items: [],
        porcentajeTotal: 0,
      },
      comisiones: {
        items: [],
        porcentajeTotal: 0,
      },
      detalle: { marginPct: 30, minimumMarginPct: 20 },
    });
  });

  it('completa defaults al leer configuración v1 con solo método', () => {
    expect(
      getProductoPrecioConfig.call(service, {
        precio: { metodoCalculo: 'fijado_por_cantidad' },
      }),
    ).toEqual({
      metodoCalculo: 'fijado_por_cantidad',
      measurementUnit: null,
      impuestos: {
        esquemaId: null,
        esquemaNombre: '',
        items: [],
        porcentajeTotal: 0,
      },
      comisiones: {
        items: [],
        porcentajeTotal: 0,
      },
      detalle: {
        tiers: [{ quantity: 1, price: 0 }],
      },
    });
  });

  it('completa defaults al leer fijo con margen variable', () => {
    expect(
      getProductoPrecioConfig.call(service, {
        precio: { metodoCalculo: 'fijo_con_margen_variable' },
      }),
    ).toEqual({
      metodoCalculo: 'fijo_con_margen_variable',
      measurementUnit: null,
      impuestos: {
        esquemaId: null,
        esquemaNombre: '',
        items: [],
        porcentajeTotal: 0,
      },
      comisiones: {
        items: [],
        porcentajeTotal: 0,
      },
      detalle: {
        tiers: [{ quantity: 1, marginPct: 0 }],
      },
    });
  });

  it('ignora métodos de precio inválidos', () => {
    expect(
      getProductoPrecioConfig.call(service, {
        precio: { metodoCalculo: 'inventado' },
      }),
    ).toBeNull();
  });

  it('mergea precio sin perder otras claves de detalleJson', () => {
    expect(
      mergeProductoDetalle.call(
        service,
        { dimensionesBaseConsumidas: ['caras'], otraClave: true },
        { precio: { metodoCalculo: 'precio_fijo' } },
      ),
    ).toEqual({
      dimensionesBaseConsumidas: ['caras'],
      otraClave: true,
      precio: { metodoCalculo: 'precio_fijo' },
    });
  });

  it('expone precio en la respuesta base del producto', () => {
    const result = toProductoResponseBase.call(service, {
      id: 'prod-1',
      tipo: 'PRODUCTO',
      codigo: 'PROD-001',
      nombre: 'Tarjetas',
      descripcion: null,
      motorCodigo: 'impresion_digital_laser',
      motorVersion: 1,
      usarRutaComunVariantes: true,
      procesoDefinicionDefaultId: null,
      detalleJson: { precio: { metodoCalculo: 'margen_variable' } },
      estado: 'ACTIVO',
      activo: true,
      familiaProductoId: 'fam-1',
      familiaProducto: { nombre: 'Gráfica' },
      subfamiliaProductoId: null,
      subfamiliaProducto: null,
      procesoDefinicionDefault: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(result.precio).toEqual({
      metodoCalculo: 'margen_variable',
      measurementUnit: null,
      impuestos: {
        esquemaId: null,
        esquemaNombre: '',
        items: [],
        porcentajeTotal: 0,
      },
      comisiones: {
        items: [],
        porcentajeTotal: 0,
      },
      detalle: {
        tiers: [{ quantityUntil: 1, marginPct: 0 }],
      },
    });
    expect(result.unidadComercial).toBe('unidad');
  });

  it('normaliza impuestos configurados dentro de precio', () => {
    expect(
      getProductoPrecioConfig.call(service, {
        precio: {
          metodoCalculo: 'precio_fijo',
          impuestos: {
            esquemaId: 'imp-1',
            esquemaNombre: 'Prestación de servicios',
            items: [{ nombre: 'IVA', porcentaje: 21 }],
            porcentajeTotal: 999,
          },
          detalle: { price: 100, minimumPrice: 80 },
        },
      }),
    ).toEqual({
      metodoCalculo: 'precio_fijo',
      measurementUnit: null,
      impuestos: {
        esquemaId: 'imp-1',
        esquemaNombre: 'Prestación de servicios',
        items: [{ nombre: 'IVA', porcentaje: 21 }],
        porcentajeTotal: 21,
      },
      comisiones: {
        items: [],
        porcentajeTotal: 0,
      },
      detalle: { price: 100, minimumPrice: 80 },
    });
  });

  it('normaliza comisiones configuradas dentro de precio', () => {
    expect(
      getProductoPrecioConfig.call(service, {
        precio: {
          metodoCalculo: 'precio_fijo',
          comisiones: {
            items: [
              { id: 'com-1', nombre: 'Mercado Pago', tipo: 'financiera', porcentaje: 8.5, activo: true },
              { id: 'com-2', nombre: 'Vendedor', tipo: 'vendedor', porcentaje: 5, activo: false },
            ],
            porcentajeTotal: 999,
          },
          detalle: { price: 100, minimumPrice: 80 },
        },
      }),
    ).toEqual({
      metodoCalculo: 'precio_fijo',
      measurementUnit: null,
      impuestos: {
        esquemaId: null,
        esquemaNombre: '',
        items: [],
        porcentajeTotal: 0,
      },
      comisiones: {
        items: [
          { id: 'com-1', nombre: 'Mercado Pago', tipo: 'financiera', porcentaje: 8.5, activo: true },
          { id: 'com-2', nombre: 'Vendedor', tipo: 'vendedor', porcentaje: 5, activo: false },
        ],
        porcentajeTotal: 8.5,
      },
      detalle: { price: 100, minimumPrice: 80 },
    });
  });

  it('lee precios especiales de clientes desde detalleJson', () => {
    expect(
      getProductoPrecioEspecialClientes.call(service, {
        precioEspecialClientes: [
          {
            id: 'regla-1',
            clienteId: 'cliente-1',
            clienteNombre: 'Holdprint',
            descripcion: 'Precio preferencial',
            activo: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
            metodoCalculo: 'precio_fijo',
            measurementUnit: 'unidad',
            detalle: { price: 120, minimumPrice: 100 },
          },
        ],
      }),
    ).toEqual([
      {
        id: 'regla-1',
        clienteId: 'cliente-1',
        clienteNombre: 'Holdprint',
        descripcion: 'Precio preferencial',
        activo: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        metodoCalculo: 'precio_fijo',
        measurementUnit: 'unidad',
        impuestos: {
          esquemaId: null,
          esquemaNombre: '',
          items: [],
          porcentajeTotal: 0,
        },
        comisiones: {
          items: [],
          porcentajeTotal: 0,
        },
        detalle: { price: 120, minimumPrice: 100 },
      },
    ]);
  });

  it('expone precios especiales de clientes en la respuesta base del producto', () => {
    const result = toProductoResponseBase.call(service, {
      id: 'prod-1',
      tipo: 'PRODUCTO',
      codigo: 'PROD-001',
      nombre: 'Tarjetas',
      descripcion: null,
      motorCodigo: 'impresion_digital_laser',
      motorVersion: 1,
      usarRutaComunVariantes: true,
      procesoDefinicionDefaultId: null,
      detalleJson: {
        precioEspecialClientes: [
          {
            id: 'regla-1',
            clienteId: 'cliente-1',
            clienteNombre: 'Holdprint',
            descripcion: 'Precio preferencial',
            activo: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
            metodoCalculo: 'por_margen',
            detalle: { marginPct: 30, minimumMarginPct: 20 },
          },
        ],
      },
      estado: 'ACTIVO',
      activo: true,
      familiaProductoId: 'fam-1',
      familiaProducto: { nombre: 'Gráfica' },
      subfamiliaProductoId: null,
      subfamiliaProducto: null,
      procesoDefinicionDefault: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(result.precioEspecialClientes).toEqual([
      {
        id: 'regla-1',
        clienteId: 'cliente-1',
        clienteNombre: 'Holdprint',
        descripcion: 'Precio preferencial',
        activo: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        metodoCalculo: 'por_margen',
        measurementUnit: null,
        impuestos: {
          esquemaId: null,
          esquemaNombre: '',
          items: [],
          porcentajeTotal: 0,
        },
        comisiones: {
          items: [],
          porcentajeTotal: 0,
        },
        detalle: { marginPct: 30, minimumMarginPct: 20 },
      },
    ]);
  });

  it('rechaza precios especiales activos duplicados para el mismo cliente', async () => {
    (service as unknown as { prisma: { cliente: { findMany: jest.Mock } } }).prisma = {
      cliente: {
        findMany: jest.fn().mockResolvedValue([{ id: 'cliente-1', nombre: 'Holdprint' }]),
      },
    } as never;

    await expect(
      resolveProductoPrecioEspecialClientes.call(
        service,
        { tenantId: 'tenant-1' },
        [
          {
            id: 'regla-1',
            clienteId: 'cliente-1',
            metodoCalculo: 'precio_fijo',
            detalle: { price: 100, minimumPrice: 90 },
            activo: true,
          },
          {
            id: 'regla-2',
            clienteId: 'cliente-1',
            metodoCalculo: 'precio_fijo',
            detalle: { price: 110, minimumPrice: 95 },
            activo: true,
          },
        ],
      ),
    ).rejects.toThrow('No puede haber más de un precio especial activo para el mismo cliente.');
  });

  it('rechaza precios especiales con cliente inexistente', async () => {
    (service as unknown as { prisma: { cliente: { findMany: jest.Mock } } }).prisma = {
      cliente: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as never;

    await expect(
      resolveProductoPrecioEspecialClientes.call(
        service,
        { tenantId: 'tenant-1' },
        [
          {
            id: 'regla-1',
            clienteId: 'cliente-inexistente',
            metodoCalculo: 'precio_fijo',
            detalle: { price: 100, minimumPrice: 90 },
            activo: true,
          },
        ],
      ),
    ).rejects.toThrow('La regla especial #1 referencia un cliente inexistente.');
  });

  it('normaliza fijo con margen variable ordenando cantidades', () => {
    const normalizeProductoPrecioDetalle = (
      service as unknown as {
        normalizeProductoPrecioDetalle: (
          metodoCalculo: string,
          value: Record<string, unknown> | null,
          allowEmpty: boolean,
        ) => unknown;
      }
    ).normalizeProductoPrecioDetalle;

    expect(
      normalizeProductoPrecioDetalle.call(
        service,
        'fijo_con_margen_variable',
        {
          tiers: [
            { quantity: 100, marginPct: 20 },
            { quantity: 50, marginPct: 25 },
          ],
        },
        false,
      ),
    ).toEqual({
      tiers: [
        { quantity: 50, marginPct: 25 },
        { quantity: 100, marginPct: 20 },
      ],
    });
  });

  it('rechaza fijo con margen variable sin filas', () => {
    const normalizeProductoPrecioDetalle = (
      service as unknown as {
        normalizeProductoPrecioDetalle: (
          metodoCalculo: string,
          value: Record<string, unknown> | null,
          allowEmpty: boolean,
        ) => unknown;
      }
    ).normalizeProductoPrecioDetalle;

    expect(() =>
      normalizeProductoPrecioDetalle.call(
        service,
        'fijo_con_margen_variable',
        { tiers: [] },
        false,
      ),
    ).toThrow('Debes definir al menos una cantidad para fijo con margen variable.');
  });

  it('rechaza fijo con margen variable con cantidades duplicadas', () => {
    const normalizeProductoPrecioDetalle = (
      service as unknown as {
        normalizeProductoPrecioDetalle: (
          metodoCalculo: string,
          value: Record<string, unknown> | null,
          allowEmpty: boolean,
        ) => unknown;
      }
    ).normalizeProductoPrecioDetalle;

    expect(() =>
      normalizeProductoPrecioDetalle.call(
        service,
        'fijo_con_margen_variable',
        {
          tiers: [
            { quantity: 50, marginPct: 20 },
            { quantity: 50, marginPct: 22 },
          ],
        },
        false,
      ),
    ).toThrow('La configuración de precio contiene cantidades duplicadas.');
  });
});
