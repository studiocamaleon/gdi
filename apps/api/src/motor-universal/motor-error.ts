import type { ErrorMotor } from './tipos';

/** Error esperado de dominio/configuración, seguro para exponer al cotizador. */
export class MotorCotizacionError extends Error {
  constructor(
    readonly codigo: string,
    message: string,
    readonly sugerencia?: string,
    readonly contexto?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'MotorCotizacionError';
  }

  toErrorMotor(): ErrorMotor {
    return {
      codigo: this.codigo,
      severidad: 'ERROR',
      mensaje: this.message,
      sugerencia: this.sugerencia,
      contexto: this.contexto,
    };
  }
}
