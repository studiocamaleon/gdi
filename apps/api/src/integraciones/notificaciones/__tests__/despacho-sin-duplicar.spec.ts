import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { runWithTenant } from '../../../common/tenant-context';
import { DespachoService } from '../despacho.service';
import { ESTADOS } from '../estados';
import type { IntegracionesService } from '../../integraciones.service';
import type { WatiClient } from '../../wati/wati.client';
import type { PrismaService } from '../../../prisma/prisma.service';

/**
 * La garantía que le importa al cliente: **un hecho, un mensaje**.
 *
 * El de reserva-despacho.spec prueba que el `UPDATE ... WHERE estado` excluye
 * (semántica de Postgres). Éste prueba lo otro, que es lo que se rompió de
 * verdad: que el DespachoService USE esa exclusión. Si alguien saca la reserva
 * y vuelve al viejo "leer y después mandar", acá se cuenta cuántas veces se
 * llamó a Wati y el test cae.
 *
 * Wati va mockeado —no se le manda nada a nadie desde un test— pero Prisma es
 * real: el candado lo da la base, y contra un mock se probaría el mock.
 *
 * Incidente que lo motiva: 2026-07-23, un recibo de pago le llegó dos veces al
 * cliente porque el intento inmediato del encolado se solapó con el tick del
 * cron. Ver docs/notificaciones-whatsapp-catalogo.md
 */

const prisma = new PrismaClient();

/** Miércoles 10:00 ART: dentro de la ventana de cortesía por defecto. */
const DENTRO_DE_VENTANA = new Date('2026-07-22T13:00:00.000Z');

describe('DespachoService — un hecho, un mensaje', () => {
  let tenantId: string;
  let servicio: DespachoService;
  let enviarPlantilla: jest.Mock;

  /** Como en producción: el cron y el encolado corren con tenant en contexto. */
  const despachar = (id: string, ahora: Date) =>
    runWithTenant(tenantId, () => servicio.despachar(id, ahora));

  // Tenant PROPIO y descartable. Tomar el primero que hubiera en la base
  // hacía que la suite dependiera de otra: `aislamiento-tenants` crea y borra
  // tenants en paralelo, y el que yo estaba usando desaparecía en el medio
  // (FK violation al encolar).
  beforeAll(async () => {
    const t = await prisma.tenant.create({
      data: {
        nombre: 'Test despacho sin duplicar',
        slug: `test-despacho-${randomUUID()}`,
        // La config manda: pausado, el despacho ni lo intenta.
        configuracionNotificaciones: { create: { pausado: false } },
      },
      select: { id: true },
    });
    tenantId = t.id;
  });

  afterAll(async () => {
    // El cascade se lleva notificaciones y config.
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    enviarPlantilla = jest.fn().mockImplementation(async () => {
      // Wati tarda: es exactamente la ventana en la que entraba el duplicado.
      await new Promise((r) => setTimeout(r, 60));
      return { ok: true };
    });
    const integraciones = {
      credencialesWati: jest.fn().mockResolvedValue({ token: 'x', url: 'y' }),
    } as unknown as IntegracionesService;
    const wati = {
      listarPlantillas: jest
        .fn()
        .mockResolvedValue([
          { nombre: 'grafo_pago_recibido_v2', estado: 'APPROVED' },
        ]),
      enviarPlantilla,
    } as unknown as WatiClient;
    servicio = new DespachoService(
      prisma as unknown as PrismaService,
      integraciones,
      wati,
    );
  });

  async function encolar(): Promise<string> {
    const fila = await prisma.notificacionWhatsapp.create({
      data: {
        tenantId,
        evento: 'pago_recibido',
        estado: ESTADOS.pendiente,
        claveUnica: `test-despacho:${randomUUID()}`,
        telefono: '5490000000000',
        plantilla: 'grafo_pago_recibido_v2',
        // Los 5 de la plantilla: si no coinciden, se descarta.
        parametros: ['Cliente', '1.000,00', 'OT-1', '0,00', 'https://x/c/abc'],
      },
      select: { id: true },
    });
    return fila.id;
  }

  it('dos despachos simultáneos mandan UN solo WhatsApp', async () => {
    const id = await encolar();

    // El caso real: el intento inmediato del encolado y el tick del cron
    // cayendo sobre la misma fila.
    const [a, b] = await Promise.all([
      despachar(id, DENTRO_DE_VENTANA),
      despachar(id, DENTRO_DE_VENTANA),
    ]);

    expect(enviarPlantilla).toHaveBeenCalledTimes(1);
    expect([a.estado, b.estado].sort()).toEqual(['enviada', 'nada']);

    const fila = await prisma.notificacionWhatsapp.findUnique({
      where: { id },
      select: { estado: true, intentos: true, reservadaEl: true },
    });
    expect(fila?.estado).toBe(ESTADOS.enviada);
    expect(fila?.intentos).toBe(1);
    // La reserva se limpia al terminar: si quedara puesta, el barrido la
    // soltaría más tarde y el cliente recibiría el mensaje otra vez.
    expect(fila?.reservadaEl).toBeNull();
  });

  it('cinco despachos simultáneos siguen mandando uno solo', async () => {
    const id = await encolar();

    const res = await Promise.all(
      Array.from({ length: 5 }, () => despachar(id, DENTRO_DE_VENTANA)),
    );

    expect(enviarPlantilla).toHaveBeenCalledTimes(1);
    expect(res.filter((r) => r.estado === 'enviada')).toHaveLength(1);
  });

  it('una vez enviada, volver a despacharla no manda nada', async () => {
    const id = await encolar();
    await despachar(id, DENTRO_DE_VENTANA);
    expect(enviarPlantilla).toHaveBeenCalledTimes(1);

    const otra = await despachar(id, DENTRO_DE_VENTANA);

    expect(otra.estado).toBe('nada');
    expect(enviarPlantilla).toHaveBeenCalledTimes(1);
  });

  it('si Wati falla, la fila vuelve a la cola sin reserva colgada', async () => {
    enviarPlantilla.mockResolvedValue({ ok: false, motivo: 'Wati caída' });
    const id = await encolar();

    const res = await despachar(id, DENTRO_DE_VENTANA);

    expect(res.estado).toBe('pendiente');
    const fila = await prisma.notificacionWhatsapp.findUnique({
      where: { id },
      select: { estado: true, intentos: true, reservadaEl: true },
    });
    expect(fila?.estado).toBe(ESTADOS.pendiente);
    expect(fila?.intentos).toBe(1);
    expect(fila?.reservadaEl).toBeNull();
  });

  it('fuera de la ventana se corre y NO consume un intento', async () => {
    const id = await encolar();
    // Miércoles 03:00 ART: fuera de 09:00-20:00.
    const madrugada = new Date('2026-07-22T06:00:00.000Z');

    const res = await despachar(id, madrugada);

    expect(res.estado).toBe('reprogramada');
    expect(enviarPlantilla).not.toHaveBeenCalled();
    const fila = await prisma.notificacionWhatsapp.findUnique({
      where: { id },
      select: { estado: true, intentos: true, reservadaEl: true },
    });
    // Vuelve a `pendiente`: reservada, el cron de mañana no la miraría nunca.
    expect(fila?.estado).toBe(ESTADOS.pendiente);
    expect(fila?.intentos).toBe(0);
    expect(fila?.reservadaEl).toBeNull();
  });
});
