import type { Request, Response } from 'express';
import type { AuthService } from '../auth.service';
import { AuthController } from '../auth.controller';
import { MFA_HEADERS, MFA_RECORDADO_HEADER } from '../mfa-dispositivo-cookie';

it('entrega la credencial recordada al BFF y la excluye del cuerpo público', async () => {
  const dispositivoRecordado = { alcance: 'tenant', token: 'a'.repeat(64) };
  const verificarMfa = jest
    .fn()
    .mockResolvedValue({ accessToken: 'sesion', dispositivoRecordado });
  const controller = new AuthController({
    verificarMfa,
  } as unknown as AuthService);
  const req = {
    ip: '127.0.0.1',
    get: jest.fn((nombre) =>
      nombre === MFA_HEADERS.tenant ? 'anterior' : undefined,
    ),
  } as unknown as Request;
  const setHeader = jest.fn();
  const res = { setHeader } as unknown as Response;
  const dto = {
    challengeToken: 'desafio',
    codigo: '123456',
    recordarDispositivo: true,
  };
  expect(await controller.verificarMfa(dto, req, res)).toEqual({
    accessToken: 'sesion',
  });
  expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  expect(setHeader).toHaveBeenCalledWith(
    MFA_RECORDADO_HEADER,
    JSON.stringify(dispositivoRecordado),
  );
  expect(verificarMfa).toHaveBeenCalledWith(dto, '127.0.0.1', {
    tenant: 'anterior',
    plataforma: undefined,
  });
});
