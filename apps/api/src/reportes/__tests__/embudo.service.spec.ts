import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { EmbudoService } from '../embudo.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { parseRango } from '../periodo';

/**
 * Embudo comercial — cohorte de presupuestos emitidos y "alcanzó al menos".
 * Corre contra gdi_saas_test (ver test/jest-setup-db.ts).
 * Cubre: cohorte por fechaEnvio, monotonía del funnel, exclusión de venta
 * directa (numero null) y de OTs manuales, fuga por motivo, y velocidad.
 * Ver docs/embudo-comercial-panel-diseno.md
 */
describe('EmbudoService — cohorte de pipeline', () => {
  const prisma = new PrismaClient();
  const svc = new EmbudoService(prisma as unknown as PrismaService);
  let tenantId: string;
  let seq = 0;

  // Junio 2026 como período; mayo como anterior (bordes en la zona default).
  const rango = parseRango('2026-06-01', '2026-06-30');
  const anterior = parseRango('2026-05-01', '2026-05-31');
  const enJunio = (dia: number) => new Date(2026, 5, dia, 12, 0, 0);

  const crearOt = async (
    estado: string,
    total: number,
    fechaEmision: Date | null,
    fechaFinalizada: Date | null = null,
  ) => {
    seq += 1;
    const ot = await prisma.ordenTrabajo.create({
      data: {
        tenantId,
        numero: `OT-TEST-${String(seq).padStart(4, '0')}`,
        estado,
        subtotal: total,
        total,
        fechaEmision,
        fechaFinalizada,
      },
    });
    return ot.id;
  };

  const crearCot = async (data: {
    numero: string | null;
    estado: string;
    total: number;
    fechaEnvio: Date | null;
    fechaResuelto?: Date | null;
    motivoPerdida?: string | null;
    convertidaOrdenId?: string | null;
  }) => {
    return prisma.cotizacion.create({
      data: {
        tenantId,
        numero: data.numero,
        estado: data.estado,
        subtotal: data.total,
        total: data.total,
        fechaEnvio: data.fechaEnvio,
        fechaResuelto: data.fechaResuelto ?? null,
        motivoPerdida: data.motivoPerdida ?? null,
        convertidaOrdenId: data.convertidaOrdenId ?? null,
      },
    });
  };

  beforeAll(async () => {
    const slug = `test-embudo-${randomUUID().slice(0, 8)}`;
    const tenant = await prisma.tenant.create({
      data: { nombre: 'Test embudo', slug },
    });
    tenantId = tenant.id;

    // C1: emitida → aprobada → producción → ENTREGADA (rank 4).
    const ot1 = await crearOt('entregada', 1200, enJunio(3), enJunio(9));
    const c1 = await crearCot({ numero: 'PRES-2026-0001', estado: 'convertido', total: 1000, fechaEnvio: enJunio(1), fechaResuelto: enJunio(2), convertidaOrdenId: ot1 });
    await prisma.ordenTrabajo.update({ where: { id: ot1 }, data: { cotizacionId: c1.id } });

    // C2: emitida → aprobada, sin OT todavía (no entra a producción).
    await crearCot({ numero: 'PRES-2026-0002', estado: 'aprobado', total: 2000, fechaEnvio: enJunio(2), fechaResuelto: enJunio(5) });

    // C3: emitida → aprobada → PRODUCCIÓN (rank 2), no entregada.
    const ot3 = await crearOt('produccion', 1500, enJunio(6));
    const c3 = await crearCot({ numero: 'PRES-2026-0003', estado: 'convertido', total: 1400, fechaEnvio: enJunio(4), fechaResuelto: enJunio(5), convertidaOrdenId: ot3 });
    await prisma.ordenTrabajo.update({ where: { id: ot3 }, data: { cotizacionId: c3.id } });

    // C4: rechazada por precio (fuga).
    await crearCot({ numero: 'PRES-2026-0004', estado: 'rechazado', total: 500, fechaEnvio: enJunio(5), motivoPerdida: 'precio' });

    // C5: vencida (fuga).
    await crearCot({ numero: 'PRES-2026-0005', estado: 'vencido', total: 300, fechaEnvio: enJunio(6) });

    // C6: enviada, aún sin resolver (en gestión).
    await crearCot({ numero: 'PRES-2026-0006', estado: 'enviado', total: 800, fechaEnvio: enJunio(7) });

    // Ruido — NO deben contar en la cohorte:
    // venta directa (numero null)
    await crearCot({ numero: null, estado: 'convertido', total: 9999, fechaEnvio: enJunio(3) });
    // fuera de rango y del período anterior (abril)
    await crearCot({ numero: 'PRES-2026-0007', estado: 'aprobado', total: 7777, fechaEnvio: new Date(2026, 3, 15) });
    // borrador nunca enviado (fechaEnvio null)
    await crearCot({ numero: 'PRES-2026-0008', estado: 'borrador', total: 6666, fechaEnvio: null });
    // OT manual sin presupuesto, emitida en junio
    await crearOt('produccion', 4444, enJunio(8));
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('arma el funnel monótono con la semántica "alcanzó al menos"', async () => {
    const r = await svc.embudo(tenantId, rango, anterior);
    const byClave = Object.fromEntries(r.funnel.map((e) => [e.clave, e]));

    // Cohorte = 6 presupuestos formales enviados en junio (excluye ruido).
    expect(byClave.emitidas.cantidad).toBe(6);
    // Aprobadas = aprobado + convertido (C1, C2, C3).
    expect(byClave.aprobadas.cantidad).toBe(3);
    // En producción = OT con rank >= 2 (C1 entregada, C3 producción).
    expect(byClave.produccion.cantidad).toBe(2);
    // Entregadas = OT estado 'entregada' (solo C1).
    expect(byClave.entregadas.cantidad).toBe(1);

    // Monotonía estricta del funnel.
    const cantidades = r.funnel.map((e) => e.cantidad);
    for (let i = 1; i < cantidades.length; i++) {
      expect(cantidades[i]).toBeLessThanOrEqual(cantidades[i - 1]);
    }
  });

  it('calcula share y conversión paso a paso', async () => {
    const r = await svc.embudo(tenantId, rango, anterior);
    const emit = r.funnel[0];
    const aprob = r.funnel[1];
    expect(emit.conversionPct).toBeNull();
    expect(emit.sharePct).toBe(100);
    // 3/6 = 50%
    expect(aprob.conversionPct).toBe(50);
    expect(aprob.sharePct).toBe(50);
  });

  it('usa el monto de la OT en etapas post-conversión', async () => {
    const r = await svc.embudo(tenantId, rango, anterior);
    const byClave = Object.fromEntries(r.funnel.map((e) => [e.clave, e]));
    // Emitidas: suma de netos (subtotal, sin IVA) = 1000+2000+1400+500+300+800.
    expect(byClave.emitidas.monto).toBe(6000);
    // Producción: neto de OT (1200 de C1 + 1500 de C3), no del presupuesto.
    expect(byClave.produccion.monto).toBe(2700);
    // Entregadas: OT de C1 = 1200.
    expect(byClave.entregadas.monto).toBe(1200);
  });

  it('desglosa la fuga por motivo y reconcilia con no-aprobados', async () => {
    const r = await svc.embudo(tenantId, rango, anterior);
    const totalFuga = r.fugas.reduce((a, f) => a + f.cantidad, 0);
    // No aprobados = 6 − 3 = 3 (rechazado, vencido, en gestión).
    expect(totalFuga).toBe(3);
    const motivos = r.fugas.map((f) => f.motivo);
    expect(motivos).toContain('Precio');
    expect(motivos).toContain('Vencidas');
    expect(motivos).toContain('En gestión (sin resolver)');
  });

  it('reporta velocidad, KPIs y OTs manuales fuera', async () => {
    const r = await svc.embudo(tenantId, rango, anterior);
    // Emitida→aprobada: C1 (1d), C2 (3d), C3 (1d) → (1+3+1)/3, r2 → 1.67.
    const tramo = r.velocidad.find((v) => v.tramo === 'Emitida → aprobada');
    expect(tramo?.diasPromedio).toBe(1.67);
    // Producción→entrega: solo C1 (emisión 3 → finalizada 9 = 6d).
    const entrega = r.velocidad.find((v) => v.tramo === 'Producción → entrega');
    expect(entrega?.diasPromedio).toBe(6);
    // Tasa de aprobación = 3/6 = 50%.
    expect(r.kpis.tasaAprobacion).toBe(50);
    // Sin datos en mayo → sin comparativa.
    expect(r.sinComparativa).toBe(true);
    expect(r.kpis.tasaAprobacionDeltaPct).toBeNull();
    // 1 OT manual (sin presupuesto) emitida en junio.
    expect(r.otManualesFuera).toBe(1);
  });
});
