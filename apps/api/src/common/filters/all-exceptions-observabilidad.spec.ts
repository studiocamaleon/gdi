import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  type ArgumentsHost,
  Logger,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { reportarFallo } from '../observabilidad';
jest.mock('../observabilidad', () => ({ reportarFallo: jest.fn() }));

describe('clasificación de incidentes del API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());
  const host = () =>
    ({
      switchToHttp: () => ({
        getResponse: () => ({
          status: jest.fn().mockReturnValue({ json: jest.fn() }),
        }),
        getRequest: () => ({
          method: 'POST',
          path: '/api/archivos/privado',
          url: '/api/archivos/privado?token=privado',
          auth: { tenantId: '11111111-1111-4111-8111-111111111111' },
        }),
      }),
    }) as unknown as ArgumentsHost;
  it.each([
    new BadRequestException('formulario'),
    new ForbiddenException('acceso'),
  ])('no convierte un rechazo esperado en incidente', (error) => {
    new AllExceptionsFilter().catch(error, host());
    expect(reportarFallo).not.toHaveBeenCalled();
  });
  it.each([
    new Error('fallo ficticio'),
    new ServiceUnavailableException('servicio'),
  ])('registra fallos internos con área y tenant', (error) => {
    new AllExceptionsFilter().catch(error, host());
    expect(reportarFallo).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        area: 'archivos',
        tenant_id: '11111111-1111-4111-8111-111111111111',
      }),
    );
    expect(
      JSON.stringify(jest.mocked(reportarFallo).mock.calls[0][1]),
    ).not.toContain('privado');
  });
});
