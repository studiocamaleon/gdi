import { ForbiddenException } from '@nestjs/common';
import {
  FrecuenciaGastoFijo,
  NaturalezaEgreso,
  PrismaClient,
  RolSistema,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { CurrentAuth } from '../../auth/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import {
  RecurrentesService,
  vencimientoDe,
} from '../../egresos/recurrentes.service';
import { GastosFijosService } from '../gastos-fijos.service';
import type { UpsertGastoFijoDto } from '../dto/upsert-gasto-fijo.dto';

describe('Gastos fijos: generación opcional de obligaciones', () => {
  const prisma = new PrismaClient();
  const db = prisma as unknown as PrismaService;
  const capacidades = new CapacidadesEmpresaService(db);
  const fijos = new GastosFijosService(db, capacidades);
  const recurrentes = new RecurrentesService(db);
  const mes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .slice(0, 7);
  let auth: CurrentAuth;
  let dto: UpsertGastoFijoDto;

  beforeEach(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        nombre: 'Programación de prueba',
        slug: `test-fijo-${randomUUID()}`,
      },
    });
    auth = {
      tenantId: tenant.id,
      userId: randomUUID(),
      sessionId: randomUUID(),
      membershipId: randomUUID(),
      role: RolSistema.ADMINISTRADOR,
      email: 'fijos@test.local',
      permisos: new Set([
        'administracion.configurar',
        'administracion.gestionar',
      ]),
    } as CurrentAuth;
    const categoria = await prisma.categoriaEgreso.create({
      data: {
        tenantId: tenant.id,
        nombre: 'Alquiler',
        codigo: 'alquiler',
        naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
      },
    });
    dto = {
      nombre: 'Alquiler',
      categoriaEgresoId: categoria.id,
      valor: 1234.56,
      frecuencia: FrecuenciaGastoFijo.MENSUAL,
      vigenteDesde: mes,
    };
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.tenant.delete({ where: { id: auth.tenantId } });
  });
  afterAll(() => prisma.$disconnect());

  const programado = () => ({
    ...dto,
    programacion: { activa: true, desde: mes, diaVencimiento: 31 },
  });

  it('crear y editar presupuesto sin opt-in no crea obligaciones ni plantillas', async () => {
    const g = await fijos.crear(auth, dto);
    expect(g.programacion).toBeNull();
    await fijos.actualizar(auth, g.id, { ...dto, valor: 2000 });
    expect(await recurrentes.generarDeTenant(auth.tenantId)).toBe(0);
    expect(
      await prisma.gastoRecurrente.count({
        where: { tenantId: auth.tenantId },
      }),
    ).toBe(0);
  });

  it('el opt-in emite una obligación por período sin pagarla ni duplicarla ante ejecuciones concurrentes', async () => {
    const g = await fijos.crear(auth, programado());
    expect(g.programacion?.activa).toBe(true);
    expect(
      await prisma.egreso.count({ where: { tenantId: auth.tenantId } }),
    ).toBe(0);
    await Promise.all([
      recurrentes.generarDeTenant(auth.tenantId),
      recurrentes.generarDeTenant(auth.tenantId),
    ]);
    const emitidos = await prisma.egreso.findMany({
      where: { tenantId: auth.tenantId },
    });
    expect(emitidos).toHaveLength(1);
    expect(emitidos[0]).toMatchObject({
      estado: 'pendiente',
      gastoFijoEstructuraId: g.id,
      periodoRecurrente: mes,
    });
    expect(Number(emitidos[0].total)).toBe(1234.56);
    expect(Number(emitidos[0].pagadoTotal)).toBe(0);
    expect(emitidos[0].fechaVencimiento).toEqual(vencimientoDe(mes, 31));
    expect(
      await prisma.pago.count({ where: { tenantId: auth.tenantId } }),
    ).toBe(0);
    expect(
      await prisma.movimientoFondos.count({
        where: { tenantId: auth.tenantId },
      }),
    ).toBe(0);
  });

  it('editar el importe sincroniza la próxima emisión y conserva la ya emitida', async () => {
    const g = await fijos.crear(auth, programado());
    await recurrentes.generarDeTenant(auth.tenantId);
    await fijos.actualizar(auth, g.id, {
      ...programado(),
      valor: 9876.54,
      nombre: 'Alquiler actualizado',
    });
    const plantilla = await prisma.gastoRecurrente.findFirstOrThrow({
      where: { gastoFijoEstructuraId: g.id },
    });
    expect(Number(plantilla.monto)).toBe(9876.54);
    expect(plantilla.descripcion).toBe('Alquiler actualizado');
    const emitido = await prisma.egreso.findFirstOrThrow({
      where: { gastoFijoEstructuraId: g.id },
    });
    expect(Number(emitido.total)).toBe(1234.56);
    expect(emitido.descripcion).toBe(`Alquiler ${mes}`);
    await expect(
      fijos.actualizar(auth, g.id, {
        ...programado(),
        frecuencia: FrecuenciaGastoFijo.ANUAL,
      }),
    ).rejects.toThrow('ya emitió');
  });

  it('desactivar y reactivar el presupuesto no reactiva la generación ni elimina su historial', async () => {
    const g = await fijos.crear(auth, programado());
    await recurrentes.generarDeTenant(auth.tenantId);
    expect((await fijos.alternarActivo(auth, g.id)).programacion?.activa).toBe(
      false,
    );
    const activado = await fijos.alternarActivo(auth, g.id);
    expect(activado.activo).toBe(true);
    expect(activado.programacion?.activa).toBe(false);
    expect(activado.programacion?.egresosEmitidos).toBe(1);
    await expect(fijos.eliminar(auth, g.id)).rejects.toThrow(
      'conservar el historial',
    );
  });

  it('apagar solo la generación conserva el gasto activo para el presupuesto', async () => {
    const g = await fijos.crear(auth, programado());
    const actualizado = await fijos.actualizar(auth, g.id, {
      ...dto,
      programacion: { activa: false, desde: mes, diaVencimiento: 31 },
    });
    expect(actualizado.activo).toBe(true);
    expect(actualizado.programacion?.activa).toBe(false);
    expect(await recurrentes.generarDeTenant(auth.tenantId)).toBe(0);
  });

  it('sin permiso para pagos rechaza el opt-in y revierte el alta entera', async () => {
    const sinGestion = {
      ...auth,
      permisos: new Set(['administracion.configurar']),
    };
    await expect(fijos.crear(sinGestion, programado())).rejects.toThrow(
      ForbiddenException,
    );
    expect(
      await prisma.gastoFijoEstructura.count({
        where: { tenantId: auth.tenantId },
      }),
    ).toBe(0);
    await expect(fijos.crear(sinGestion, dto)).resolves.toMatchObject({
      programacion: null,
    });
  });

  it('verifica el plan dentro de la transacción antes de crear compromisos', async () => {
    jest
      .spyOn(capacidades, 'exigirOperacionTx')
      .mockRejectedValue(new ForbiddenException('Plan sin generación'));
    await expect(fijos.crear(auth, programado())).rejects.toThrow(
      'Plan sin generación',
    );
    expect(
      await prisma.gastoFijoEstructura.count({
        where: { tenantId: auth.tenantId },
      }),
    ).toBe(0);
  });

  it('rechaza importe cero, inicio fuera de vigencia y una segunda plantilla para el mismo gasto', async () => {
    await expect(
      fijos.crear(auth, { ...programado(), valor: 0 }),
    ).rejects.toThrow('mayor que cero');
    await expect(
      fijos.crear(auth, { ...programado(), vigenteDesde: '2099-01' }),
    ).rejects.toThrow('dentro de la vigencia');
    const g = await fijos.crear(auth, programado());
    await expect(
      recurrentes.crear(auth, {
        descripcion: 'Duplicado',
        categoriaEgresoId: dto.categoriaEgresoId,
        monto: 100,
        diaVencimiento: 10,
        vigenteDesde: mes,
        gastoFijoEstructuraId: g.id,
      }),
    ).rejects.toThrow('ya tiene una programación');
  });
});
