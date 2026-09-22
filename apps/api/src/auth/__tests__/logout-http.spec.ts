import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

it('cerrar sesión responde 204 sin cuerpo después de revocar la sesión', async () => {
  const logout = jest.fn().mockResolvedValue(undefined);
  const modulo = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [{ provide: AuthService, useValue: { logout } }],
  }).compile();
  const app: INestApplication = modulo.createNestApplication();
  const auth = { sessionId: 'sesion-plataforma' };
  app.use((req: { auth?: typeof auth }, _res: unknown, next: () => void) => {
    req.auth = auth;
    next();
  });
  try {
    await app.init();
    const response = await request(app.getHttpServer() as Server)
      .post('/auth/logout')
      .expect(204);
    expect(response.text).toBe('');
    expect(logout).toHaveBeenCalledWith(auth);
  } finally {
    await app.close();
  }
});
