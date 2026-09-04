import { MotorUniversalService } from '../motor.service';

type MotorConCantidadPrivada = MotorUniversalService & {
  resolverCantidadProductividadPropia: (
    paso: Record<string, unknown>,
    jobContext: Record<string, unknown>,
  ) => number;
};

function crearMotor(): MotorConCantidadPrivada {
  return Object.create(
    MotorUniversalService.prototype,
  ) as MotorConCantidadPrivada;
}

describe('componentes repetibles — magnitud de tiempo del padre', () => {
  it('aplicación textil cuenta todas las estampas vinculadas', () => {
    const motor = crearMotor();

    const cantidad = motor.resolverCantidadProductividadPropia(
      {
        familiaCodigo: 'aplicacion_transfer_textil',
        paramsPasoJson: {},
      },
      {
        cantidad: 10,
        cantidadPiezasComponentes: 30,
        piezas: [
          { cantidad: 10, anchoMm: 200, altoMm: 200 },
          { cantidad: 10, anchoMm: 200, altoMm: 200 },
          { cantidad: 10, anchoMm: 80, altoMm: 120 },
        ],
      },
    );

    expect(cantidad).toBe(30);
  });

  it('mantiene la cantidad del trabajo cuando no hay componentes vinculados', () => {
    const motor = crearMotor();

    const cantidad = motor.resolverCantidadProductividadPropia(
      {
        familiaCodigo: 'aplicacion_transfer_textil',
        paramsPasoJson: {},
      },
      { cantidad: 10 },
    );

    expect(cantidad).toBe(10);
  });
});
