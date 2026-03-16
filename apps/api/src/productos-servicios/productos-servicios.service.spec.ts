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

  beforeEach(() => {
    service = new ProductosServiciosService({} as never);
    resolveImposicionMachineMargins = Reflect.get(
      service as unknown as Record<string, unknown>,
      'resolveImposicionMachineMargins',
    ) as typeof resolveImposicionMachineMargins;
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
});
