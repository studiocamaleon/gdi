import { exigirCuentaOperable } from '../acceso-cuentas';
import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import type { CurrentAuth } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { CobrosService } from '../cobros.service';
import { RecibosService } from '../recibos.service';
import { FacturacionOrdenesService } from '../facturacion-ordenes.service';

describe('Cobros de OT: saldo e idempotencia (base aislada)', () => {
  const prisma = new PrismaService();
  const tenantId = randomUUID();
  const auth: CurrentAuth = {
    tenantId,
    userId: randomUUID(),
    sessionId: randomUUID(),
    membershipId: randomUUID(),
    role: RolSistema.ADMINISTRADOR,
    email: 'cajero@example.invalid',
  };
  const capacidades = {
    puedeOperar: jest.fn().mockResolvedValue(true),
    incluida: jest.fn().mockResolvedValue(true),
    exigir: jest.fn(),
    exigirOperacionTx: jest.fn(),
  };
  const recibos = {
    numerar: jest.fn(() => `REC-TEST-${randomUUID()}`),
    emitirEnlace: jest.fn(),
    materializarPdfEnSegundoPlano: jest.fn(),
  };
  const avisos = { avisar: jest.fn() };
  const servicio = new CobrosService(
    prisma,
    new FacturacionOrdenesService(prisma),
    recibos as never,
    avisos as never,
    { reconciliarOrden: jest.fn() } as never,
    capacidades as never,
  );
  let cuentaId: string;
  let metodoId: string;
  let clienteId: string;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    )
      throw new Error('Se requiere una base local exclusiva de pruebas.');
    await prisma.tenant.create({
      data: {
        id: tenantId,
        nombre: 'Empresa ficticia cobros',
        slug: `cobros-${tenantId}`,
      },
    });
    await prisma.user.create({
      data: { id: auth.userId, email: `${auth.userId}@example.invalid` },
    });
    await prisma.membership.create({
      data: {
        id: auth.membershipId,
        tenantId,
        userId: auth.userId,
        rol: 'ADMINISTRADOR',
      },
    });
    clienteId = (
      await prisma.cliente.create({
        data: {
          tenantId,
          nombre: 'Cliente ficticio',
          telefonoCodigo: '11',
          telefonoNumero: '55555555',
          paisCodigo: 'AR',
        },
      })
    ).id;
    cuentaId = (
      await prisma.cuentaFondos.create({
        data: {
          tenantId,
          nombre: 'Caja ficticia',
          tipo: 'caja',
          moneda: 'ARS',
        },
      })
    ).id;
    metodoId = (
      await prisma.metodoPago.create({
        data: {
          tenantId,
          nombre: 'Efectivo ficticio',
          codigo: 'EFECTIVO-TEST',
          tipo: 'efectivo',
          plazoAcreditacionDias: 0,
          cuentaDestinoId: cuentaId,
        },
      })
    ).id;
  });
  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.user.deleteMany({ where: { id: auth.userId } });
    await prisma.$disconnect();
  });
  beforeEach(() => {
    capacidades.incluida.mockResolvedValue(true);
    recibos.materializarPdfEnSegundoPlano.mockClear();
    avisos.avisar.mockClear();
  });
  const orden = (total = 100) =>
    prisma.ordenTrabajo.create({
      data: {
        tenantId,
        clienteId,
        numero: `OT-TEST-${randomUUID()}`,
        estado: 'pendiente',
        total,
        subtotal: total,
        impuestos: 0,
      },
    });
  const payload = (
    ordenId: string | undefined,
    montoBruto: number,
    idempotencyKey = randomUUID(),
  ) => ({
    ordenId,
    clienteId,
    montoBruto,
    idempotencyKey,
    fecha: '2026-10-13',
    metodoPagoId: metodoId,
    cuentaDestinoId: cuentaId,
    comisionPctAplicada: 0,
  });
  const conteos = async (ordenId: string) => ({
    cobros: await prisma.cobro.count({ where: { ordenId } }),
    movimientos: await prisma.movimientoFondos.count({ where: { ordenId } }),
    aplicaciones: await prisma.cobroOrden.count({ where: { ordenId } }),
    eventos: await prisma.ordenTrabajoEvento.count({ where: { ordenId } }),
  });

  it('numera recibos por empresa sin colisiones y conserva la idempotencia', async () => {
    const otraEmpresa = randomUUID();
    const recibosConNumeracion = {
      ...recibos,
      numerar: RecibosService.prototype.numerar,
    };
    const numeracionReal = new CobrosService(
      prisma,
      new FacturacionOrdenesService(prisma),
      recibosConNumeracion as never,
      avisos as never,
      { reconciliarOrden: jest.fn() } as never,
      capacidades as never,
    );
    await prisma.tenant.create({
      data: {
        id: otraEmpresa,
        nombre: 'Otra empresa ficticia',
        slug: `recibos-${otraEmpresa}`,
      },
    });
    try {
      const miembro = await prisma.membership.create({
        data: {
          tenantId: otraEmpresa,
          userId: auth.userId,
          rol: 'ADMINISTRADOR',
        },
      });
      const cuenta = await prisma.cuentaFondos.create({
        data: {
          tenantId: otraEmpresa,
          nombre: 'Banco ficticio',
          tipo: 'banco',
        },
      });
      const metodo = await prisma.metodoPago.create({
        data: {
          tenantId: otraEmpresa,
          codigo: 'TRANSFERENCIA',
          nombre: 'Transferencia',
          tipo: 'transferencia',
          cuentaDestinoId: cuenta.id,
        },
      });
      const otraOrden = await prisma.ordenTrabajo.create({
        data: {
          tenantId: otraEmpresa,
          numero: 'OT-FICTICIA',
          estado: 'produccion',
          total: 100,
        },
      });
      const primeraOrden = await orden();
      const primero = await numeracionReal.create(auth, {
        ...payload(primeraOrden.id, 10),
        fecha: '2095-01-10',
      });
      const otraAuth = {
        ...auth,
        tenantId: otraEmpresa,
        membershipId: miembro.id,
      };
      const otroPayload = {
        ordenId: otraOrden.id,
        montoBruto: 10,
        fecha: '2095-01-10',
        metodoPagoId: metodo.id,
        cuentaDestinoId: cuenta.id,
        comisionPctAplicada: 0,
        idempotencyKey: randomUUID(),
      };
      const segundo = await numeracionReal.create(otraAuth, otroPayload);
      expect(primero.numeroRecibo).toBe('REC-2095-0001');
      expect(segundo.numeroRecibo).toBe(primero.numeroRecibo);
      expect(segundo.id).not.toBe(primero.id);
      expect((await numeracionReal.create(otraAuth, otroPayload)).id).toBe(
        segundo.id,
      );
      expect(
        await prisma.cobro.count({ where: { tenantId: otraEmpresa } }),
      ).toBe(1);
      expect(
        Number(
          (
            await prisma.cuentaFondos.findFirstOrThrow({
              where: { id: cuenta.id, tenantId: otraEmpresa },
            })
          ).saldo,
        ),
      ).toBe(10);
      await expect(
        prisma.cobro.create({
          data: {
            tenantId: otraEmpresa,
            metodoPagoId: metodo.id,
            cuentaDestinoId: cuenta.id,
            fecha: new Date(),
            montoBruto: 10,
            netoAcreditado: 10,
            disponibleReal: 10,
            numeroRecibo: segundo.numeroRecibo,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
      const siguiente = await numeracionReal.create(otraAuth, {
        ...otroPayload,
        idempotencyKey: randomUUID(),
      });
      expect(siguiente.numeroRecibo).toBe('REC-2095-0002');
      // Una colisión diferente no se disfraza de reintento ni de un 404.
      jest
        .spyOn(recibosConNumeracion, 'numerar')
        .mockResolvedValueOnce(segundo.numeroRecibo!);
      await expect(
        numeracionReal.create(otraAuth, {
          ...otroPayload,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
      expect(
        await prisma.cobro.count({ where: { tenantId: otraEmpresa } }),
      ).toBe(2);
    } finally {
      await prisma.tenant.delete({ where: { id: otraEmpresa } });
    }
  });

  it('rechaza cobrar una OT saldada aunque Cobros esté habilitado', async () => {
    const o = await orden();
    await servicio.create(auth, payload(o.id, 100));
    const antes = await conteos(o.id);
    await expect(servicio.create(auth, payload(o.id, 100))).rejects.toThrow(
      'saldada',
    );
    expect(await conteos(o.id)).toEqual(antes);
  });
  it('rechaza cualquier excedente, incluso un centavo, sin crear registros', async () => {
    const o = await orden(100.25);
    await expect(servicio.create(auth, payload(o.id, 100.26))).rejects.toThrow(
      'saldo pendiente',
    );
    expect(await conteos(o.id)).toEqual({
      cobros: 0,
      movimientos: 0,
      aplicaciones: 0,
      eventos: 0,
    });
  });
  it('admite dos parciales iguales y el saldo exacto con centavos', async () => {
    const o = await orden(100.25);
    await servicio.create(auth, payload(o.id, 25));
    await servicio.create(auth, payload(o.id, 25));
    await servicio.create(auth, payload(o.id, 50.25));
    expect(
      Number(
        (await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: o.id } }))
          .cobradoTotal,
      ),
    ).toBe(100.25);
    expect((await conteos(o.id)).cobros).toBe(3);
  });
  it('dos solicitudes simultáneas con claves distintas sólo cobran el saldo una vez', async () => {
    const o = await orden();
    const respuestas = await Promise.allSettled([
      servicio.create(auth, payload(o.id, 100)),
      servicio.create(auth, payload(o.id, 100)),
    ]);
    expect(respuestas.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      respuestas.find((r) => r.status === 'rejected')?.reason,
    ).toBeInstanceOf(BadRequestException);
    expect(await conteos(o.id)).toEqual({
      cobros: 1,
      movimientos: 1,
      aplicaciones: 1,
      eventos: 1,
    });
  });
  it('un reintento simultáneo y posterior con la misma clave devuelve el mismo cobro', async () => {
    const o = await orden();
    const dto = payload(o.id, 100);
    const [a, b] = await Promise.all([
      servicio.create(auth, dto),
      servicio.create(auth, dto),
    ]);
    expect(b.id).toBe(a.id);
    expect((await servicio.create(auth, dto)).id).toBe(a.id);
    expect(await conteos(o.id)).toEqual({
      cobros: 1,
      movimientos: 1,
      aplicaciones: 1,
      eventos: 1,
    });
    expect(avisos.avisar).toHaveBeenCalledTimes(1);
  });
  it('protege también una OT abierta en un navegador anterior sin clave', async () => {
    const o = await orden();
    const dto = { ...payload(o.id, 100), idempotencyKey: undefined };
    await servicio.create(auth, dto);
    await expect(servicio.create(auth, dto)).rejects.toThrow('saldada');
  });
  it('cuenta cobros históricos aunque el total denormalizado esté desactualizado', async () => {
    const o = await orden();
    await servicio.create(auth, payload(o.id, 100));
    await prisma.ordenTrabajo.update({
      where: { id: o.id },
      data: { cobradoTotal: 0 },
    });
    await expect(servicio.create(auth, payload(o.id, 1))).rejects.toThrow(
      'saldada',
    );
  });
  it('conserva la posibilidad de cobrar anticipos generales sin OT', async () => {
    const c = await servicio.create(auth, payload(undefined, 200));
    expect(c.montoBruto).toBe(200);
    expect(c.ordenId).toBeNull();
  });
  it('dos parciales simultáneos que exceden juntos el saldo no pasan ambos', async () => {
    const o = await orden();
    const r = await Promise.allSettled([
      servicio.create(auth, payload(o.id, 60)),
      servicio.create(auth, payload(o.id, 60)),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(
      Number(
        (await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: o.id } }))
          .cobradoTotal,
      ),
    ).toBe(60);
  });
  it('las comisiones y retenciones no crean un nuevo saldo a cobrar', async () => {
    const o = await orden();
    await servicio.create(auth, {
      ...payload(o.id, 100),
      comisionPctAplicada: 5,
      retenciones: [
        {
          agente: 'cliente',
          regimen: 'IVA',
          base: 100,
          alicuota: 10,
          monto: 10,
        },
      ],
    });
    await expect(servicio.create(auth, payload(o.id, 15))).rejects.toThrow(
      'saldada',
    );
  });
  it('el saldo incluye aplicaciones desde cuenta corriente', async () => {
    const o = await orden();
    const c = await servicio.create(auth, payload(undefined, 60));
    await prisma.cobroOrden.create({
      data: { tenantId, cobroId: c.id, ordenId: o.id, monto: 60 },
    });
    await expect(servicio.create(auth, payload(o.id, 41))).rejects.toThrow(
      'saldo pendiente',
    );
    await servicio.create(auth, payload(o.id, 40));
    expect(
      Number(
        (await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: o.id } }))
          .cobradoTotal,
      ),
    ).toBe(100);
  });
  it('un pago anulado libera saldo y permite registrar el cobro correcto', async () => {
    const o = await orden();
    const c = await servicio.create(auth, payload(o.id, 100));
    await servicio.anular(auth, c.id, {
      motivo: 'Pago ficticio cargado por error',
    });
    await expect(
      servicio.create(auth, payload(o.id, 100)),
    ).resolves.toMatchObject({ montoBruto: 100 });
  });
  it('conserva el cobro del saldo de OTs emitidas antes de retirar la función', async () => {
    const o = await orden();
    capacidades.incluida.mockResolvedValue(false);
    await servicio.create(auth, payload(o.id, 60));
    await expect(servicio.create(auth, payload(o.id, 41))).rejects.toThrow(
      'saldo pendiente',
    );
    await servicio.create(auth, payload(o.id, 40));
  });
  it.each(['transferencia', 'tarjeta_debito', 'tarjeta_credito'])(
    'vendedor restringido registra %s en Banco sin operar esa cuenta',
    async (tipo) => {
      const banco = await prisma.cuentaFondos.create({
        data: {
          tenantId,
          nombre: `Banco ensayo ${tipo}`,
          tipo: 'banco',
          moneda: 'ARS',
        },
      });
      const medio = await prisma.metodoPago.create({
        data: {
          tenantId,
          codigo: randomUUID(),
          nombre: tipo,
          tipo,
          cuentaDestinoId: banco.id,
          plazoAcreditacionDias: tipo === 'transferencia' ? 0 : 2,
        },
      });
      const vendedor = {
        ...auth,
        role: RolSistema.OPERADOR,
        permisos: new Set(['acceso.por_vista', 'administracion.cobrar']),
      };
      await prisma.membership.update({
        where: { id: auth.membershipId },
        data: { cuentasRestringidas: true, cuentasOperablesIds: [cuentaId] },
      });
      try {
        const o = await orden(300);
        const entrada = {
          ...payload(o.id, 100),
          metodoPagoId: medio.id,
          cuentaDestinoId: banco.id,
        };
        const cobro = await servicio.create(vendedor, entrada);
        expect((await servicio.create(vendedor, entrada)).id).toBe(cobro.id);
        expect(
          Number(
            (
              await prisma.ordenTrabajo.findUniqueOrThrow({
                where: { id: o.id },
              })
            ).cobradoTotal,
          ),
        ).toBe(100);
        expect(
          (await prisma.cobro.findUniqueOrThrow({ where: { id: cobro.id } }))
            .cuentaDestinoId,
        ).toBe(banco.id);
        expect(
          (await servicio.findAll(vendedor, { ordenId: o.id }))[0]
            .puedeAbrirRecibo,
        ).toBe(true);
        expect(
          await prisma.movimientoFondos.count({
            where: { cobroId: cobro.id, cuentaId },
          }),
        ).toBe(0);
        await expect(
          exigirCuentaOperable(prisma, vendedor, banco.id),
        ).rejects.toThrow('acceso');
        await expect(
          servicio.create(vendedor, {
            ...entrada,
            idempotencyKey: randomUUID(),
            cuentaDestinoId: cuentaId,
          }),
        ).rejects.toThrow('nunca a una caja');
        await expect(
          servicio.create(
            { ...vendedor, permisos: new Set() },
            { ...entrada, idempotencyKey: randomUUID() },
          ),
        ).rejects.toThrow('acceso');
        await prisma.cuentaFondos.update({
          where: { id: banco.id },
          data: { activo: false },
        });
        await expect(
          servicio.create(vendedor, {
            ...entrada,
            idempotencyKey: randomUUID(),
          }),
        ).rejects.toThrow('activa');
        await expect(
          servicio.create(vendedor, {
            ...entrada,
            idempotencyKey: randomUUID(),
            cuentaDestinoId: randomUUID(),
          }),
        ).rejects.toThrow('activa');
        expect(await prisma.cobro.count({ where: { ordenId: o.id } })).toBe(1);
      } finally {
        await prisma.membership.update({
          where: { id: auth.membershipId },
          data: { cuentasRestringidas: false, cuentasOperablesIds: [] },
        });
      }
    },
  );
});
