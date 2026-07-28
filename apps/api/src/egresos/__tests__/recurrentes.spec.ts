import { PrismaClient, RolSistema } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import {
  RecurrentesService,
  periodosPendientes,
  vencimientoDe,
} from '../recurrentes.service';
import { EgresosService } from '../egresos.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';

/**
 * Gastos recurrentes (F3). Lo delicado acá es la IDEMPOTENCIA: un alquiler
 * emitido dos veces es un pasivo duplicado, de los errores más caros que
 * puede cometer este módulo.
 */
describe('RecurrentesService', () => {
  const prisma = new PrismaClient();
  const service = new RecurrentesService(prisma as unknown as PrismaService);
  const egresos = new EgresosService(
    prisma as unknown as PrismaService,
    null as never,
    null as never,
    null as never,
  );
  let tenantId: string;
  let auth: CurrentAuth;
  let catAlquiler: string;
  let catPorCodigo: Map<string, string>;
  let gastoFijoId: string;

  const periodoActual = () => new Date().toISOString().slice(0, 7);

  beforeAll(async () => {
    const slug = `test-recur-${randomUUID().slice(0, 8)}`;
    const tenant = await prisma.tenant.create({
      data: { nombre: 'Test recurrentes', slug },
    });
    tenantId = tenant.id;
    auth = {
      userId: randomUUID(),
      sessionId: randomUUID(),
      tenantId,
      membershipId: randomUUID(),
      role: RolSistema.ADMINISTRADOR,
      email: 'admin@test.local',
    } as CurrentAuth;

    await egresos.asegurarCategorias(tenantId);
    const cats = await prisma.categoriaEgreso.findMany({ where: { tenantId } });
    catPorCodigo = new Map(cats.map((c) => [c.codigo, c.id]));
    catAlquiler = catPorCodigo.get('alquiler')!;

    const fijo = await prisma.gastoFijoEstructura.create({
      data: {
        tenantId,
        nombre: 'Alquiler del galpón',
        categoriaEgresoId: catAlquiler,
        importeMensual: 900_000,
        vigenteDesde: '2020-01',
      },
    });
    gastoFijoId = fijo.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  // ── Reglas puras ─────────────────────────────────────────────────────

  describe('vencimientoDe', () => {
    it('respeta el día pedido', () => {
      expect(vencimientoDe('2026-08', 10).toISOString().slice(0, 10)).toBe(
        '2026-08-10',
      );
    });

    it('hace CLAMP a fin de mes corto', () => {
      // El 31 en febrero cae el 28: no se saltea el mes ni se desborda a marzo.
      expect(vencimientoDe('2026-02', 31).toISOString().slice(0, 10)).toBe(
        '2026-02-28',
      );
    });

    it('acierta el bisiesto', () => {
      expect(vencimientoDe('2028-02', 31).toISOString().slice(0, 10)).toBe(
        '2028-02-29',
      );
    });
  });

  describe('periodosPendientes', () => {
    const base = {
      frecuencia: 'mensual',
      vigenteDesde: '2026-01',
      vigenteHasta: null,
      ultimoPeriodoGenerado: null,
    };

    it('emite todos los meses desde el inicio', () => {
      expect(periodosPendientes(base, '2026-04')).toEqual([
        '2026-01',
        '2026-02',
        '2026-03',
        '2026-04',
      ]);
    });

    it('recupera los períodos atrasados si el cron no corrió', () => {
      // Un alquiler que no aparece porque el servidor estuvo caído no es un
      // alquiler que no haya que pagar.
      expect(
        periodosPendientes({ ...base, ultimoPeriodoGenerado: '2026-02' }, '2026-05'),
      ).toEqual(['2026-03', '2026-04', '2026-05']);
    });

    it('no emite nada si ya está al día', () => {
      expect(
        periodosPendientes({ ...base, ultimoPeriodoGenerado: '2026-04' }, '2026-04'),
      ).toEqual([]);
    });

    it('respeta la frecuencia', () => {
      expect(
        periodosPendientes({ ...base, frecuencia: 'trimestral' }, '2026-08'),
      ).toEqual(['2026-01', '2026-04', '2026-07']);
    });

    it('para de emitir en vigenteHasta', () => {
      expect(
        periodosPendientes({ ...base, vigenteHasta: '2026-02' }, '2026-06'),
      ).toEqual(['2026-01', '2026-02']);
    });

    it('no emite antes de empezar', () => {
      expect(
        periodosPendientes({ ...base, vigenteDesde: '2027-01' }, '2026-06'),
      ).toEqual([]);
    });
  });

  // ── Generación ───────────────────────────────────────────────────────

  describe('generación', () => {
    it('emite un egreso pendiente por período, con el monto de la plantilla', async () => {
      const desde = '2026-05';
      await service.crear(auth, {
        descripcion: 'Alquiler',
        categoriaEgresoId: catAlquiler,
        monto: 900_000,
        diaVencimiento: 10,
        vigenteDesde: desde,
        gastoFijoEstructuraId: gastoFijoId,
      });

      const { emitidos } = await service.generarAhora(auth);
      expect(emitidos).toBeGreaterThan(0);

      const generados = await prisma.egreso.findMany({
        where: { tenantId, origen: 'recurrente' },
        orderBy: { periodoRecurrente: 'asc' },
      });
      expect(generados.length).toBe(emitidos);
      expect(generados[0].estado).toBe('pendiente');
      expect(Number(generados[0].total)).toBe(900_000);
      expect(generados[0].periodoRecurrente).toBe(desde);
      // La competencia es el PRIMERO del período, no el día del vencimiento:
      // el alquiler de mayo es gasto de mayo aunque venza el 10.
      expect(generados[0].fechaCompetencia.toISOString().slice(0, 10)).toBe(
        '2026-05-01',
      );
      expect(generados[0].fechaVencimiento?.toISOString().slice(0, 10)).toBe(
        '2026-05-10',
      );
      expect(generados[0].registradoPorNombre).toContain('Sistema');
    });

    it('correr dos veces NO duplica nada', async () => {
      const antes = await prisma.egreso.count({
        where: { tenantId, origen: 'recurrente' },
      });
      const { emitidos } = await service.generarAhora(auth);
      const despues = await prisma.egreso.count({
        where: { tenantId, origen: 'recurrente' },
      });
      expect(emitidos).toBe(0);
      expect(despues).toBe(antes);
    });

    it('el único de base bloquea el duplicado aunque se fuerce', async () => {
      // La segunda barrera: si `ultimoPeriodoGenerado` fallara (dos procesos a
      // la vez), la base tiene que rechazar el segundo igual.
      const uno = await prisma.egreso.findFirstOrThrow({
        where: { tenantId, origen: 'recurrente' },
      });
      await expect(
        prisma.egreso.create({
          data: {
            tenantId,
            numero: 'EGR-DUP-0001',
            descripcion: 'Duplicado a mano',
            categoriaEgresoId: catAlquiler,
            beneficiarioNombre: 'X',
            fechaCompetencia: uno.fechaCompetencia,
            moneda: 'ARS',
            neto: 1,
            total: 1,
            origen: 'recurrente',
            gastoRecurrenteId: uno.gastoRecurrenteId,
            periodoRecurrente: uno.periodoRecurrente,
          },
        }),
      ).rejects.toThrow();
    });

    it('una plantilla desactivada deja de emitir', async () => {
      const r = await service.crear(auth, {
        descripcion: 'Internet',
        categoriaEgresoId: catAlquiler,
        monto: 50_000,
        vigenteDesde: periodoActual(),
      });
      await service.editar(auth, r.id, { activo: false });
      const antes = await prisma.egreso.count({
        where: { tenantId, gastoRecurrenteId: r.id },
      });
      await service.generarAhora(auth);
      const despues = await prisma.egreso.count({
        where: { tenantId, gastoRecurrenteId: r.id },
      });
      expect(despues).toBe(antes);
    });

    it('una plantilla que ya emitió se desactiva, no se borra', async () => {
      const conEgresos = await prisma.gastoRecurrente.findFirstOrThrow({
        where: { tenantId, descripcion: 'Alquiler' },
      });
      const res = await service.borrar(auth, conEgresos.id);
      expect(res.desactivada).toBe(true);
      // La plantilla sigue existiendo: sus egresos son plata real y quedarían
      // sin explicación de dónde salieron.
      const sigue = await prisma.gastoRecurrente.findUnique({
        where: { id: conEgresos.id },
      });
      expect(sigue?.activo).toBe(false);
    });
  });

  describe('vincular al presupuestado', () => {
    it('alcanza a los egresos YA emitidos', async () => {
      // Quien descubre el reporte después de meses de uso tiene que verlo con
      // su historia, no vacío.
      const otroFijo = await prisma.gastoFijoEstructura.create({
        data: {
          tenantId,
          nombre: 'Internet del taller',
          categoriaEgresoId: catPorCodigo.get('servicios')!,
          importeMensual: 60_000,
          vigenteDesde: '2020-01',
        },
      });
      const r = await service.crear(auth, {
        descripcion: 'Internet mensual',
        categoriaEgresoId: catAlquiler,
        monto: 60_000,
        vigenteDesde: '2026-06',
      });
      await service.generarAhora(auth);
      const sinVinculo = await prisma.egreso.count({
        where: { tenantId, gastoRecurrenteId: r.id, gastoFijoEstructuraId: null },
      });
      expect(sinVinculo).toBeGreaterThan(0);

      await service.editar(auth, r.id, { gastoFijoEstructuraId: otroFijo.id });

      const vinculados = await prisma.egreso.count({
        where: {
          tenantId,
          gastoRecurrenteId: r.id,
          gastoFijoEstructuraId: otroFijo.id,
        },
      });
      expect(vinculados).toBe(sinVinculo);
    });
  });

  // ── Presupuestado vs. real (journey E4) ──────────────────────────────

  describe('presupuestado vs. real', () => {
    it('compara el gasto fijo contra lo que realmente se pagó', async () => {
      // El recurrente emitió $900.000, que es el presupuestado. Se corrige a
      // $1.050.000: es exactamente el caso de la luz que sube.
      const generado = await prisma.egreso.findFirstOrThrow({
        where: { tenantId, gastoFijoEstructuraId: gastoFijoId },
        orderBy: { periodoRecurrente: 'asc' },
      });
      await prisma.egreso.update({
        where: { id: generado.id },
        data: { neto: 1_050_000, total: 1_050_000 },
      });

      const per = generado.periodoRecurrente!;
      const r = await service.presupuestadoVsReal(auth, per);
      const linea = r.lineas.find((l) => l.gastoFijoId === gastoFijoId);
      expect(linea?.presupuestado).toBe(900_000);
      expect(linea?.real).toBe(1_050_000);
      expect(linea?.desvio).toBe(150_000);
      expect(linea?.desvioPct).toBeCloseTo(16.67, 1);
    });

    it('un gasto fijo sin egresos no cuenta como ahorro', async () => {
      const otro = await prisma.gastoFijoEstructura.create({
        data: {
          tenantId,
          nombre: 'Seguro sin registrar',
          categoriaEgresoId: catPorCodigo.get('seguros')!,
          importeMensual: 200_000,
          vigenteDesde: '2020-01',
        },
      });
      const r = await service.presupuestadoVsReal(auth, '2026-05');
      const linea = r.lineas.find((l) => l.gastoFijoId === otro.id);
      // Aparece marcado, pero NO entra en los totales: compararlo contra cero
      // mostraría un ahorro de $200.000 que no existe.
      expect(linea?.sinRegistrar).toBe(true);
      expect(r.sinRegistrar).toBeGreaterThan(0);
      // El total NO incluye los $200.000 del seguro sin registrar.
      expect(r.presupuestado).toBe(900_000);
    });

    it('un egreso anulado no cuenta como real', async () => {
      const r1 = await service.presupuestadoVsReal(auth, '2026-05');
      // Del período 2026-05 en concreto: la plantilla emitió varios meses y
      // anular otro no probaría nada.
      const generado = await prisma.egreso.findFirstOrThrow({
        where: {
          tenantId,
          gastoFijoEstructuraId: gastoFijoId,
          periodoRecurrente: '2026-05',
        },
      });
      await prisma.egreso.update({
        where: { id: generado.id },
        data: { estado: 'anulado', anuladoEl: new Date() },
      });
      const r2 = await service.presupuestadoVsReal(auth, '2026-05');
      expect(r1.real).toBeGreaterThan(0);
      expect(r2.real).toBe(0);
    });
  });
});
