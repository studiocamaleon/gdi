import { MotorUniversalService } from '../motor.service';

function createServiceForPrivateMethods() {
  return Object.create(MotorUniversalService.prototype) as MotorUniversalService & {
    resolverCantidad: (...args: unknown[]) => number;
  };
}

describe('MotorUniversalService — cantidad para plotter sobre hojas', () => {
  it('usa m2 del pliego impreso, no m2 de la pieza final', () => {
    const service = createServiceForPrivateMethods();
    const paso = {
      familiaCodigo: 'plotter_corte',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      perfil: {
        detalleJson: { modoOperacion: 'HOJAS' },
      },
    };

    const cantidad = service.resolverCantidad(
      paso,
      {
        cantidad: 100,
        piezas: [{ cantidad: 100, anchoMm: 30, altoMm: 30 }],
        pliegos_impresos: 64,
        pliego_impresion_ancho_mm: 210,
        pliego_impresion_alto_mm: 297,
      },
      null,
      null,
    );

    expect(cantidad).toBeCloseTo((64 * 210 * 297) / 1_000_000, 6);
    expect(cantidad).toBeGreaterThan((100 * 30 * 30) / 1_000_000);
  });

  it('mantiene el fallback por m2 de piezas si no hay pliego publicado', () => {
    const service = createServiceForPrivateMethods();
    const paso = {
      familiaCodigo: 'plotter_corte',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      perfil: {
        detalleJson: { modoOperacion: 'HOJAS' },
      },
    };

    const cantidad = service.resolverCantidad(
      paso,
      {
        cantidad: 100,
        piezas: [{ cantidad: 100, anchoMm: 30, altoMm: 30 }],
      },
      null,
      null,
    );

    expect(cantidad).toBeCloseTo((100 * 30 * 30) / 1_000_000, 6);
  });
});
