import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AutomaticosWebService } from './automaticos.service';
import { tenantGuardExtension } from '../../prisma/tenant-guard.extension';
import type { PrismaService } from '../../prisma/prisma.service';
import { runWithTenant } from '../../common/tenant-context';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { DespachoService } from '../notificaciones/despacho.service';
import { textoWhatsappWeb } from '../notificaciones/whatsapp-web-texto';

const raw = new PrismaClient();
const db = raw.$extends(tenantGuardExtension) as unknown as PrismaService;
const service = new AutomaticosWebService(db);
const numero = '5492966123456';
let tenantId: string, clienteId: string;
const dispositivoId = randomUUID();
const ctx = () => ({ tenantId, dispositivoId, numero });
const dentro = <T>(fn: () => Promise<T>) => runWithTenant(tenantId, fn);
async function nueva() {
  return raw.notificacionWhatsapp.create({
    data: {
      tenantId,
      clienteId,
      evento: 'orden_recibida',
      canal: 'WHATSAPP_WEB',
      claveUnica: randomUUID(),
      telefono: numero,
      plantilla: 'grafo_orden_recibida_v2',
      parametros: [
        'Cliente',
        'OT-1',
        '10/09/2026',
        'https://example.com/seguimiento',
      ],
      textoWeb: 'Prueba aislada. No se envía.',
    },
  });
}
beforeAll(async () => {
  const tenant = await raw.tenant.create({
    data: { nombre: 'Test avisos Web', slug: `test-web-${randomUUID()}` },
  });
  tenantId = tenant.id;
  const cliente = await raw.cliente.create({
    data: {
      tenantId,
      nombre: 'Prueba',
      telefonoCodigo: '+54',
      telefonoNumero: '2966123456',
      paisCodigo: 'AR',
    },
  });
  clienteId = cliente.id;
});
beforeEach(async () => {
  await raw.notificacionWhatsapp.deleteMany({ where: { tenantId } });
  await raw.cliente.update({
    where: { id: clienteId },
    data: { aceptaWhatsapp: true },
  });
  await raw.configuracionNotificaciones.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });
  await raw.configuracionNotificaciones.update({
    where: { tenantId },
    data: {
      pausado: false,
      horaDesde: '00:00',
      horaHasta: '00:00',
      diasAtencion: '1,2,3,4,5,6,7',
      canalOrdenes: 'WHATSAPP_WEB',
      whatsappWebDispositivoId: dispositivoId,
      whatsappWebNumero: numero,
    },
  });
});
afterAll(async () => {
  await raw.tenant.deleteMany({ where: { id: tenantId } });
  await raw.$disconnect();
});

test('una reserva y un inicio entre múltiples emisores; confirmar dos veces no duplica', async () =>
  dentro(async () => {
    await nueva();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => service.reservar(tenantId, ctx())),
    );
    const claims = results.flatMap((r) => (r.trabajo ? [r.trabajo] : []));
    expect(claims).toHaveLength(1);
    const c = claims[0];
    const starts = await Promise.allSettled([
      service.iniciar(tenantId, c.id, { ...ctx(), token: c.token }),
      service.iniciar(tenantId, c.id, { ...ctx(), token: c.token }),
    ]);
    expect(starts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const result = {
      ...ctx(),
      token: c.token,
      estado: 'enviada' as const,
      mensajeId: 'test-message',
    };
    await service.resultado(tenantId, c.id, result);
    await service.resultado(tenantId, c.id, result);
    expect((await service.reservar(tenantId, ctx())).trabajo).toBeNull();
  }));

test('el despachador WATI no toma la cola Web', async () =>
  dentro(async () => {
    const n = await nueva();
    const wati = { enviarPlantilla: jest.fn() };
    const dispatch = new DespachoService(db, {} as never, wati as never);
    expect(await dispatch.despachar(n.id)).toEqual({ estado: 'nada' });
    expect(wati.enviarPlantilla).not.toHaveBeenCalled();
  }));

test('una interrupción después de iniciar queda incierta y nunca se reserva otra vez', async () =>
  dentro(async () => {
    const n = await nueva();
    await raw.notificacionWhatsapp.update({
      where: { id: n.id },
      data: {
        estado: 'web_enviando',
        reservadaEl: new Date(Date.now() - 700000),
        reservaToken: randomUUID(),
      },
    });
    expect((await service.reservar(tenantId, ctx())).trabajo).toBeNull();
    expect(
      (await raw.notificacionWhatsapp.findUnique({ where: { id: n.id } }))
        ?.estado,
    ).toBe('web_incierta');
  }));

test('una reserva vencida antes de iniciar se recupera con otro token', async () =>
  dentro(async () => {
    const n = await nueva();
    const old = randomUUID();
    await raw.notificacionWhatsapp.update({
      where: { id: n.id },
      data: {
        estado: 'web_reservada',
        reservadaEl: new Date(Date.now() - 130000),
        reservaToken: old,
      },
    });
    const next = (await service.reservar(tenantId, ctx())).trabajo!;
    expect(next.id).toBe(n.id);
    expect(next.token).not.toBe(old);
    await expect(
      service.iniciar(tenantId, n.id, { ...ctx(), token: old }),
    ).rejects.toThrow();
  }));

test('no toma mensajes de otra empresa, equipo o cuenta', async () =>
  dentro(async () => {
    await nueva();
    await expect(
      service.reservar(tenantId, { ...ctx(), tenantId: randomUUID() }),
    ).rejects.toThrow();
    expect(
      (
        await service.reservar(tenantId, {
          ...ctx(),
          dispositivoId: randomUUID(),
        })
      ).trabajo,
    ).toBeNull();
    expect(
      (await service.reservar(tenantId, { ...ctx(), numero: '5491112345678' }))
        .trabajo,
    ).toBeNull();
  }));

test('pausar después de reservar impide iniciar y no devuelve la cola a WATI', async () =>
  dentro(async () => {
    await nueva();
    const c = (await service.reservar(tenantId, ctx())).trabajo!;
    await service.configurar(tenantId, { ...ctx(), modo: 'PAUSADO' });
    await expect(
      service.iniciar(tenantId, c.id, { ...ctx(), token: c.token }),
    ).rejects.toThrow();
    expect((await service.estado(tenantId)).modo).toBe('WHATSAPP_WEB');
  }));

test('revalida el rechazo del cliente antes del envío', async () =>
  dentro(async () => {
    await nueva();
    const c = (await service.reservar(tenantId, ctx())).trabajo!;
    await raw.cliente.update({
      where: { id: clienteId },
      data: { aceptaWhatsapp: false },
    });
    expect(
      (await service.iniciar(tenantId, c.id, { ...ctx(), token: c.token }))
        .trabajo,
    ).toBeNull();
  }));

test('el canal se congela al encolar; los avisos antiguos conservan WATI', async () =>
  dentro(async () => {
    const dispatch = {
      despachar: jest.fn().mockResolvedValue({ estado: 'nada' }),
    };
    const queue = new NotificacionesService(db, dispatch as never);
    await service.configurar(tenantId, { ...ctx(), modo: 'WATI' });
    const event = {
      evento: 'orden_recibida' as const,
      clienteId,
      entidadId: randomUUID(),
      parametros: ['Cliente', 'OT-2', '11/09/2026', 'https://example.com/ot'],
    };
    const a = await queue.encolar(event);
    expect(a.encolada).toBe(true);
    await service.configurar(tenantId, { ...ctx(), modo: 'WHATSAPP_WEB' });
    const b = await queue.encolar({ ...event, entidadId: randomUUID() });
    expect(b.encolada).toBe(true);
    const rows = await raw.notificacionWhatsapp.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((r) => r.canal)).toEqual(['WATI', 'WHATSAPP_WEB']);
    expect(rows[1].textoWeb).toContain(
      'Hola Cliente, recibimos tu orden OT-2.',
    );
  }));

test('la variante QR se convierte a texto y enlace sin prometer una imagen ausente', () => {
  const text = textoWhatsappWeb('orden_lista_qr', [
    'Cliente',
    'OT-1',
    'https://example.com/ot',
  ]);
  expect(text).toContain('lista');
  expect(text).toContain('https://example.com/ot');
  expect(text).not.toContain('QR de arriba');
  expect(() => textoWhatsappWeb('orden_recibida', ['incompleto'])).toThrow();
  expect(() => textoWhatsappWeb('resena', [])).toThrow();
});

test('la prueba sólo se dirige al número emisor y usa la misma cola automática', async () =>
  dentro(async () => {
    await expect(
      service.prueba(tenantId, { ...ctx(), numero: '5499999999999' }),
    ).rejects.toThrow();
    await service.prueba(tenantId, ctx());
    const c = (await service.reservar(tenantId, ctx())).trabajo!;
    const job = (
      await service.iniciar(tenantId, c.id, { ...ctx(), token: c.token })
    ).trabajo!;
    expect(job.telefono).toBe(numero);
    expect(job.texto).toContain('Prueba de Grafo');
  }));
