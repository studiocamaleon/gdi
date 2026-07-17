import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

/**
 * La numeración de comprobantes es lo más delicado de la etapa C2: ARCA
 * exige correlatividad sin huecos NI repetidos por (punto de venta, tipo,
 * letra). Dos emisiones simultáneas compartiendo número es un problema
 * fiscal, no un bug cosmético.
 *
 * Este test ataca el contador directamente y en paralelo real contra
 * Postgres, que es la única forma de probar que el upsert+increment
 * serializa. Corre contra gdi_saas_test (ver test/jest-setup-db.ts).
 */
describe('ComprobanteContador — numeración atómica', () => {
  const prisma = new PrismaClient();
  let tenantId: string;
  let puntoVentaId: string;
  let configId: string;

  const tomarNumero = async (tipo: string, letra: string) => {
    const c = await prisma.comprobanteContador.upsert({
      where: {
        tenantId_puntoVentaId_tipo_letra: {
          tenantId,
          puntoVentaId,
          tipo,
          letra,
        },
      },
      create: { tenantId, puntoVentaId, tipo, letra, ultimo: 1 },
      update: { ultimo: { increment: 1 } },
    });
    return c.ultimo;
  };

  beforeAll(async () => {
    const slug = `test-numeracion-${randomUUID().slice(0, 8)}`;
    const tenant = await prisma.tenant.create({
      data: { nombre: 'Test numeración', slug },
    });
    tenantId = tenant.id;
    const config = await prisma.configuracionFiscal.create({
      data: {
        tenantId,
        razonSocial: 'Test SA',
        cuit: '30712345671',
        condicionFiscal: 'RI',
      },
    });
    configId = config.id;
    const pv = await prisma.puntoVenta.create({
      data: {
        tenantId,
        configuracionFiscalId: configId,
        numero: 1,
        nombre: 'Casa central',
      },
    });
    puntoVentaId = pv.id;
  });

  afterAll(async () => {
    // Cascade limpia contadores, PV y config.
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('arranca en 1', async () => {
    expect(await tomarNumero('factura', 'A')).toBe(1);
  });

  it('incrementa de a uno', async () => {
    expect(await tomarNumero('factura', 'A')).toBe(2);
    expect(await tomarNumero('factura', 'A')).toBe(3);
  });

  it('lleva contadores separados por letra', async () => {
    expect(await tomarNumero('factura', 'B')).toBe(1);
    expect(await tomarNumero('factura', 'B')).toBe(2);
    // La A no se movió por culpa de la B.
    expect(await tomarNumero('factura', 'A')).toBe(4);
  });

  it('lleva contadores separados por tipo', async () => {
    expect(await tomarNumero('nota_credito', 'A')).toBe(1);
    expect(await tomarNumero('factura', 'A')).toBe(5);
  });

  it('20 emisiones concurrentes no comparten ni saltean número', async () => {
    const N = 20;
    const numeros = await Promise.all(
      Array.from({ length: N }, () => tomarNumero('factura', 'C')),
    );
    const unicos = new Set(numeros);
    expect(unicos.size).toBe(N); // sin repetidos
    expect(Math.min(...numeros)).toBe(1);
    expect(Math.max(...numeros)).toBe(N); // sin huecos
    expect([...unicos].sort((a, b) => a - b)).toEqual(
      Array.from({ length: N }, (_, i) => i + 1),
    );
  });

  it('dos puntos de venta numeran independientemente', async () => {
    const pv2 = await prisma.puntoVenta.create({
      data: {
        tenantId,
        configuracionFiscalId: configId,
        numero: 2,
        nombre: 'Sucursal',
      },
    });
    const tomarEnPv2 = async () => {
      const c = await prisma.comprobanteContador.upsert({
        where: {
          tenantId_puntoVentaId_tipo_letra: {
            tenantId,
            puntoVentaId: pv2.id,
            tipo: 'factura',
            letra: 'A',
          },
        },
        create: {
          tenantId,
          puntoVentaId: pv2.id,
          tipo: 'factura',
          letra: 'A',
          ultimo: 1,
        },
        update: { ultimo: { increment: 1 } },
      });
      return c.ultimo;
    };
    // El PV 1 ya va por 5 en factura A; el PV 2 arranca de cero.
    expect(await tomarEnPv2()).toBe(1);
    expect(await tomarNumero('factura', 'A')).toBe(6);
  });
});
