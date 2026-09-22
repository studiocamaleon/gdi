import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ESTADOS } from '../estados';

/** Recuperación real del scheduler: preparar admite reintento; un POST
 * autorizado queda incierto. No se envían mensajes en estas pruebas. */
import { NotificacionesScheduler } from '../notificaciones.scheduler';
import type { PrismaService } from '../../../prisma/prisma.service';

const prisma = new PrismaClient();

/** Mismo corte que NotificacionesScheduler.RESERVA_VENCIDA_MIN. */
const CORTE_MIN = 10;

describe('barrido de reservas vencidas', () => {
  let tenantId: string;

  beforeAll(async () => {
    const t = await prisma.tenant.create({
      data: {
        nombre: 'Test barrido reservas',
        slug: `test-barrido-${randomUUID()}`,
      },
      select: { id: true },
    });
    tenantId = t.id;
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  async function reservadaHace(
    minutos: number,
    estado: string = ESTADOS.enviando,
  ): Promise<string> {
    const fila = await prisma.notificacionWhatsapp.create({
      data: {
        tenantId,
        evento: 'pago_recibido',
        estado,
        reservadaEl: new Date(Date.now() - minutos * 60 * 1000),
        claveUnica: `test-barrido:${randomUUID()}`,
        telefono: '5490000000000',
        plantilla: 'grafo_pago_recibido_v2',
        parametros: ['a', 'b', 'c', 'd', 'e'],
      },
      select: { id: true },
    });
    return fila.id;
  }

  async function barrer(): Promise<void> {
    const scheduler = new NotificacionesScheduler(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      {} as never,
    );
    await scheduler.soltarReservasVencidas();
  }

  async function estadoDe(id: string): Promise<string | undefined> {
    const f = await prisma.notificacionWhatsapp.findUnique({
      where: { id },
      select: { estado: true },
    });
    return f?.estado;
  }

  it('recupera sólo una preparación anterior al POST', async () => {
    const id = await reservadaHace(30, ESTADOS.reservada);
    await barrer();
    expect(await estadoDe(id)).toBe(ESTADOS.pendiente);
  });

  it('no toca la que se acaba de reservar: puede estar en vuelo', async () => {
    const enVuelo = await reservadaHace(1);
    await barrer();
    expect(await estadoDe(enVuelo)).toBe(ESTADOS.enviando);
  });

  it('un envío sin confirmación queda incierto, sin reenvío automático', async () => {
    const colgada = await reservadaHace(30);
    await barrer();
    expect(await estadoDe(colgada)).toBe(ESTADOS.incierta);
  });

  it('el borde: justo antes del corte no se suelta, justo después sí', async () => {
    const antes = await reservadaHace(CORTE_MIN - 1);
    const despues = await reservadaHace(CORTE_MIN + 1);
    await barrer();
    expect(await estadoDe(antes)).toBe(ESTADOS.enviando);
    expect(await estadoDe(despues)).toBe(ESTADOS.incierta);
  });

  it('un envío histórico sin fecha también requiere revisión', async () => {
    const sinFecha = await prisma.notificacionWhatsapp.create({
      data: {
        tenantId,
        evento: 'pago_recibido',
        estado: ESTADOS.enviando,
        reservadaEl: null,
        claveUnica: `test-barrido:${randomUUID()}`,
        telefono: '5490000000000',
        plantilla: 'grafo_pago_recibido_v2',
        parametros: ['a', 'b', 'c', 'd', 'e'],
      },
      select: { id: true },
    });
    await barrer();
    expect(await estadoDe(sinFecha.id)).toBe(ESTADOS.incierta);
  });
});
