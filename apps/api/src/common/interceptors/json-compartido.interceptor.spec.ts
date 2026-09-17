import { Controller, Get, INestApplication, Sse } from '@nestjs/common';
import { of } from 'rxjs';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import {
  JsonCompartidoInterceptor,
  MIME_JSON_COMPARTIDO,
} from './json-compartido.interceptor';
import { MargenesInterceptor } from '../../auth/margenes.interceptor';
import { OcultaMargenes } from '../../auth/margenes.decorator';
import { esJsonCompartido, restaurarJson } from '../json-compartido';

const forma = Array.from({ length: 200 }, (_, i) => ({ x: i / 3, y: i * 2 }));
const resultado = {
  piezas: Array.from({ length: 80 }, (_, i) => ({
    id: i,
    contorno: forma,
    costoTotal: 100,
  })),
  costoTotal: 8000,
  precioTotal: 12000,
};
@Controller('snapshot-prueba')
class PruebaController {
  @Sse('stream') stream() {
    return of(
      { type: 'ready', data: { ultimoId: '0', noLeidas: 0 } },
      { type: 'cambio', id: '1', data: { topicos: ['tablero-produccion'] } },
    );
  }
  @Get() @OcultaMargenes() leer() {
    return resultado;
  }
}
let app: INestApplication;
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [PruebaController],
  }).compile();
  app = module.createNestApplication();
  app.use((req: any, _res: any, next: () => void) => {
    req.auth = {
      permisos: new Set(
        req.headers['x-test-finanzas'] ? ['finanzas.ver_margenes'] : [],
      ),
    };
    next();
  });
  app.useGlobalInterceptors(
    new JsonCompartidoInterceptor(),
    new MargenesInterceptor(new Reflector()),
  );
  await app.init();
});
afterAll(() => app.close());

it('entrega eventos SSE sin modificar cabeceras ya enviadas ni compactar eventos', async () => {
  const respuesta = await request(app.getHttpServer())
    .get('/snapshot-prueba/stream')
    .set('Accept', 'text/event-stream')
    .expect(200);
  expect(respuesta.headers['content-type']).toContain('text/event-stream');
  expect(respuesta.text).toContain('event: ready');
  expect(respuesta.text).toContain('event: cambio');
  expect(respuesta.text).toContain('tablero-produccion');
  expect(respuesta.text).not.toContain('event: error');
});

it('negocia el formato y conserva compatibilidad con clientes anteriores', async () => {
  const antiguo = await request(app.getHttpServer())
    .get('/snapshot-prueba')
    .set('x-test-finanzas', '1')
    .expect(200);
  expect(antiguo.body).toEqual(resultado);
  expect(antiguo.headers.vary).toContain('Accept');
  const nuevo = await request(app.getHttpServer())
    .get('/snapshot-prueba')
    .set('x-test-finanzas', '1')
    .set('Accept', `${MIME_JSON_COMPARTIDO}, application/json`)
    .expect(200);
  expect(nuevo.headers['content-type']).toContain(MIME_JSON_COMPARTIDO);
  expect(nuevo.headers.vary).toContain('Accept');
  expect(esJsonCompartido(nuevo.body)).toBe(true);
  expect(restaurarJson(nuevo.body)).toEqual(resultado);
});

it('elimina los costos antes de formar el diccionario del transporte', async () => {
  const nuevo = await request(app.getHttpServer())
    .get('/snapshot-prueba')
    .set('Accept', MIME_JSON_COMPARTIDO)
    .expect(200);
  expect(JSON.stringify(nuevo.body)).not.toContain('costoTotal');
  const restaurado = restaurarJson<typeof resultado>(nuevo.body);
  expect(restaurado).not.toHaveProperty('costoTotal');
  expect(restaurado.piezas[0]).not.toHaveProperty('costoTotal');
  expect(restaurado.precioTotal).toBe(12000);
  expect(restaurado.piezas[0].contorno).toEqual(forma);
});
