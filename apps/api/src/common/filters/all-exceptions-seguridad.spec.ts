import {
  type ArgumentsHost,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
describe('Errores sin datos sensibles en logs', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([false, true])(
    'no registra mensajes internos ni contenido reflejado (HTTP %s)',
    (http) => {
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const host = {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
          getRequest: () => ({
            method: 'POST',
            url: '/api/auth/invitations/token-privado/accept?password=clave-privada',
            path: '/api/auth/invitations/token-privado/accept',
          }),
        }),
      } as unknown as ArgumentsHost;
      new AllExceptionsFilter().catch(
        http
          ? new BadRequestException('Dato inválido clave-privada')
          : new Error('Falló SQL con password=clave-privada'),
        host,
      );
      expect(
        JSON.stringify([...error.mock.calls, ...warn.mock.calls]),
      ).not.toMatch(/clave-privada|token-privado/);
      expect(status).toHaveBeenCalledWith(http ? 400 : 500);
      if (!http)
        expect(json).toHaveBeenCalledWith({
          statusCode: 500,
          message: 'Error interno del servidor.',
        });
    },
  );
});
