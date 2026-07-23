import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ESTADOS } from '../estados';

/**
 * El barrido de reservas vencidas — la contracara del candado.
 *
 * Reservar la fila antes de mandar (`despacho-sin-duplicar.spec`) evita el
 * mensaje doble, pero abre un riesgo nuevo: si el proceso se muere hablando
 * con Wati, la fila queda en `enviando` para siempre y el aviso no sale nunca.
 * El cron la suelta pasados diez minutos.
 *
 * Lo que fija esta suite es el CORTE, que es la decisión delicada: soltar
 * demasiado pronto significa reintentar algo que quizás ya se mandó —el
 * duplicado que veníamos de arreglar— y soltar demasiado tarde deja al cliente
 * sin su aviso. Diez minutos separa "el proceso murió" de "todavía está
 * mandando", porque una llamada a Wati tarda segundos.
 */

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

  async function reservadaHace(minutos: number): Promise<string> {
    const fila = await prisma.notificacionWhatsapp.create({
      data: {
        tenantId,
        evento: 'pago_recibido',
        estado: ESTADOS.enviando,
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

  /** El UPDATE del scheduler, con el mismo criterio. */
  async function barrer(): Promise<void> {
    const corte = new Date(Date.now() - CORTE_MIN * 60 * 1000);
    await prisma.notificacionWhatsapp.updateMany({
      where: {
        tenantId,
        estado: ESTADOS.enviando,
        OR: [{ reservadaEl: null }, { reservadaEl: { lt: corte } }],
      },
      data: { estado: ESTADOS.pendiente, reservadaEl: null },
    });
  }

  async function estadoDe(id: string): Promise<string | undefined> {
    const f = await prisma.notificacionWhatsapp.findUnique({
      where: { id },
      select: { estado: true },
    });
    return f?.estado;
  }

  it('no toca la que se acaba de reservar: puede estar en vuelo', async () => {
    const enVuelo = await reservadaHace(1);
    await barrer();
    expect(await estadoDe(enVuelo)).toBe(ESTADOS.enviando);
  });

  it('suelta la que quedó colgada de un proceso muerto', async () => {
    const colgada = await reservadaHace(30);
    await barrer();
    expect(await estadoDe(colgada)).toBe(ESTADOS.pendiente);
  });

  it('el borde: justo antes del corte no se suelta, justo después sí', async () => {
    const antes = await reservadaHace(CORTE_MIN - 1);
    const despues = await reservadaHace(CORTE_MIN + 1);
    await barrer();
    expect(await estadoDe(antes)).toBe(ESTADOS.enviando);
    expect(await estadoDe(despues)).toBe(ESTADOS.pendiente);
  });

  it('una reserva sin fecha se suelta (fila de antes de esta migración)', async () => {
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
    expect(await estadoDe(sinFecha.id)).toBe(ESTADOS.pendiente);
  });
});
