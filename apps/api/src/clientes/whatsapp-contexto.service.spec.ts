import 'reflect-metadata';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import type { CurrentAuth } from '../auth/auth.types';
import { PERMISO_KEY, SOLO_AUTENTICADO_KEY } from '../auth/permiso.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { WhatsappContextoDto } from './dto/whatsapp-contexto.dto';
import { WhatsappContextoController } from './whatsapp-contexto.controller';
import { WhatsappContextoService } from './whatsapp-contexto.service';

const tenantId = '11111111-1111-4111-8111-111111111111';
const clienteId = '22222222-2222-4222-8222-222222222222';
const otroId = '33333333-3333-4333-8333-333333333333';
const auth: CurrentAuth = {
  tenantId,
  userId: 'user',
  membershipId: 'member',
  sessionId: 'session',
  role: 'ADMINISTRADOR',
  email: 'prueba@example.invalid',
  permisos: new Set(['crm.ver', 'produccion.ver']),
};
const candidato = {
  id: clienteId,
  nombre: 'Cliente de prueba',
  razonSocial: null,
  activo: true,
  telefonoCodigo: '02966',
  telefonoNumero: '15 123456',
  paisCodigo: 'AR',
  contactoNombre: null as string | null,
};
function setup(candidatos = [candidato]) {
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue(candidatos),
    tenant: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id: tenantId, nombre: 'Empresa de prueba' }),
    },
    ordenTrabajo: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'orden',
          numero: 'OT-2026-0001',
          estado: 'produccion',
          fechaEntrega: new Date('2026-09-08T00:00:00Z'),
          createdAt: new Date('2026-09-04T13:00:00Z'),
          items: [
            {
              nombre: 'Cartel corpóreo en Polyfan',
              cantidad: '2',
              cantidadUnidad: 'u.',
            },
          ],
        },
      ]),
    },
  };
  return {
    prisma,
    servicio: new WhatsappContextoService(prisma as unknown as PrismaService),
  };
}

describe('Contexto de Grafo para WhatsApp', () => {
  it('vincula formatos argentinos y consulta sólo órdenes de ese cliente y tenant', async () => {
    const { servicio, prisma } = setup();
    const result = await servicio.contexto(auth, {
      telefono: '+54 9 2966 123456',
    });
    expect(result.estado).toBe('encontrado');
    expect(result.cliente?.id).toBe(clienteId);
    expect(result.ordenes[0].fechaEntrega).toBe('2026-09-08');
    expect(result.ordenes[0].items[0].cantidad).toBe(2);
    expect(prisma.ordenTrabajo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, clienteId },
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    const args = prisma.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = args[0].join('?');
    expect(sql).toContain('c."tenantId" = ?::uuid');
    expect(sql).toContain('t."tenantId" = ?::uuid AND c."tenantId" = ?::uuid');
    expect(args.slice(1)).toEqual([
      tenantId,
      '%123456',
      tenantId,
      tenantId,
      '%123456',
    ]);
    const [query] = prisma.ordenTrabajo.findMany.mock.calls[0] as [
      {
        select: Record<string, unknown>;
      },
    ];
    expect(query.select).not.toHaveProperty('total');
    expect(query.select).not.toHaveProperty('cobradoTotal');
    expect(query.select).not.toHaveProperty('publicToken');
  });

  it('no confunde números con el mismo sufijo', async () => {
    const { servicio, prisma } = setup([
      { ...candidato, telefonoCodigo: '011', telefonoNumero: '55123456' },
    ]);
    const result = await servicio.contexto(auth, {
      telefono: '+54 9 2966 123456',
    });
    expect(result.estado).toBe('sin_coincidencias');
    expect(result.cliente).toBeNull();
    expect(prisma.ordenTrabajo.findMany).not.toHaveBeenCalled();
  });

  it('encuentra un contacto secundario y deduplica su ficha', async () => {
    const { servicio } = setup([
      candidato,
      { ...candidato, contactoNombre: 'María' },
      { ...candidato, contactoNombre: 'María' },
    ]);
    const result = await servicio.contexto(auth, {
      telefono: '+5492966123456',
    });
    expect(result.coincidencias).toHaveLength(1);
    expect(result.cliente?.contactos).toEqual(['María']);
  });

  it('exige elegir entre clientes que comparten teléfono y rechaza IDs ajenos', async () => {
    const { servicio, prisma } = setup([
      candidato,
      { ...candidato, id: otroId, nombre: 'Otra ficha' },
    ]);
    const input = { telefono: '+5492966123456' };
    expect((await servicio.contexto(auth, input)).estado).toBe(
      'seleccionar_cliente',
    );
    expect(prisma.ordenTrabajo.findMany).not.toHaveBeenCalled();
    expect(
      (await servicio.contexto(auth, { ...input, clienteId: otroId })).cliente
        ?.id,
    ).toBe(otroId);
    await expect(
      servicio.contexto(auth, {
        ...input,
        clienteId: '44444444-4444-4444-8444-444444444444',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('no consulta clientes sin crm.ver ni órdenes sin el permiso correspondiente', async () => {
    const { servicio, prisma } = setup();
    const input = { telefono: '+5492966123456' };
    await expect(
      servicio.contexto(
        { ...auth, permisos: new Set(['produccion.ver']) },
        input,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    const result = await servicio.contexto(
      { ...auth, permisos: new Set(['crm.ver']) },
      input,
    );
    expect(result.cliente?.id).toBe(clienteId);
    expect(result.permisos.ordenes).toBe(false);
    expect(result.ordenes).toEqual([]);
    expect(prisma.ordenTrabajo.findMany).not.toHaveBeenCalled();
  });

  it('admite teléfonos internacionales e informa clientes inactivos', async () => {
    const { servicio } = setup([
      {
        ...candidato,
        telefonoCodigo: '+34',
        telefonoNumero: '612345678',
        paisCodigo: 'ES',
        activo: false,
      },
    ]);
    const result = await servicio.contexto(auth, {
      telefono: '+34 612 345 678',
    });
    expect(result.cliente?.activo).toBe(false);
    expect(result.telefono).toBe('+34612345678');
  });

  it.each(['123', '2966123456', '+54 12', '+5492966123456 OR 1=1'])(
    'rechaza teléfono inválido: %s',
    async (telefono) => {
      const { servicio, prisma } = setup();
      await expect(servicio.contexto(auth, { telefono })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    },
  );

  it('mantiene las rutas autenticadas y valida parámetros HTTP', async () => {
    expect(
      Reflect.getMetadata(
        PERMISO_KEY,
        // eslint-disable-next-line @typescript-eslint/unbound-method -- Se inspeccionan decoradores, no se invoca el método.
        WhatsappContextoController.prototype.contexto,
      ),
    ).toEqual(['crm.ver']);
    expect(
      Reflect.getMetadata(
        SOLO_AUTENTICADO_KEY,
        // eslint-disable-next-line @typescript-eslint/unbound-method -- Se inspeccionan decoradores, no se invoca el método.
        WhatsappContextoController.prototype.sesion,
      ),
    ).toBe(true);
    const invalid = Object.assign(new WhatsappContextoDto(), {
      telefono: '2966123456',
      clienteId: '../otro',
    });
    expect(
      (await validate(invalid)).map((error) => error.property).sort(),
    ).toEqual(['clienteId', 'telefono']);
  });
});
