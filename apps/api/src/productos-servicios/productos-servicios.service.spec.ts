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
});
