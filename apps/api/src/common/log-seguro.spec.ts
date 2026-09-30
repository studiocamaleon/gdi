import { errorParaLog, respuestaParaLog, solicitudParaLog } from './log-seguro';
describe('Registro de campos permitidos', () => {
  it('no copia cuerpos ni cabeceras, aunque el nombre del secreto sea nuevo', () => {
    const req = solicitudParaLog({
      id: 'uuid-ficticio',
      method: 'POST',
      url: '/api/auth/invitations/privado?firma=privada',
      headers: { 'x-nueva-clave': 'privada' },
      body: { otroSecreto: 'privada' },
      remoteAddress: '127.0.0.1',
    });
    const res = respuestaParaLog({
      statusCode: 302,
      headers: {
        location: 'https://example.invalid/?token=privada',
        'set-cookie': 'privada',
      },
      body: { token: 'privada' },
    });
    expect(req).toEqual({
      id: 'uuid-ficticio',
      method: 'POST',
      url: '/api/auth/invitations/[privado]',
      remoteAddress: '127.0.0.1',
    });
    expect(res).toEqual({ statusCode: 302 });
  });
  it('conserva la ubicación del fallo sin el mensaje multilineal, datos SQL ni causas', () => {
    const error = new Error('password=secreto-ficticio\nSQL y fila privada');
    error.stack =
      'Error: secreto-ficticio\nSQL y fila privada\n    at guardar (/app/auth/service.ts:41:9)';
    Object.assign(error, {
      code: 'P2002',
      meta: { token: 'secreto-ficticio' },
      cause: new Error('secreto-ficticio'),
    });
    expect(errorParaLog(error)).toEqual({
      tipo: 'Error',
      codigo: 'P2002',
      ubicaciones: ['at guardar (/app/auth/service.ts:41:9)'],
    });
  });
  it('no serializa objetos arbitrarios como errores', () => {
    expect(errorParaLog({ token: 'secreto-ficticio' })).toEqual({
      tipo: 'ErrorDesconocido',
    });
  });
});
