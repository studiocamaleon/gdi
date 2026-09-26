import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MetaInboxService } from './meta-inbox.service';
import { configuracionMetaRecepcion } from './meta-recepcion';
import type { CurrentAuth } from '../../auth/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import type { WhatsappContextoService } from '../../clientes/whatsapp-contexto.service';
jest.mock('./meta-recepcion', () => ({
  configuracionMetaRecepcion: jest.fn(),
}));
const config = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  wabaId: '123',
  phoneNumberId: '456',
  destinatario: '+16505550123',
  accessToken: 'no-se-devuelve',
  listo: true,
};
const auth = {
  tenantId: config.tenantId,
  userId: 'operador',
  permisos: new Set(['crm.ver']),
  role: 'ADMINISTRADOR',
} as CurrentAuth;
const scope = {
  tenantId: config.tenantId,
  wabaId: config.wabaId,
  phoneNumberId: config.phoneNumberId,
  remitente: config.destinatario,
};
function setup() {
  const prisma = {
    mensajeWhatsappRecibido: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const capacidades = {
    exigirIncluida: jest.fn().mockResolvedValue(undefined),
  };
  const clientes = {
    contexto: jest.fn().mockResolvedValue({
      estado: 'sin_coincidencias',
      cliente: null,
      coincidencias: [],
      ordenes: [],
    }),
  };
  return {
    prisma,
    capacidades,
    clientes,
    servicio: new MetaInboxService(
      prisma as unknown as PrismaService,
      capacidades as unknown as CapacidadesEmpresaService,
      clientes as unknown as WhatsappContextoService,
    ),
  };
}
beforeEach(() =>
  jest.mocked(configuracionMetaRecepcion).mockReturnValue(config),
);
it('oculta el acceso hasta comprobar recepción; no devuelve texto, teléfono ni secretos al menú', async () => {
  const { servicio, prisma, clientes } = setup();
  expect(await servicio.disponibilidad(auth)).toEqual({
    empresaId: auth.tenantId,
    usuarioId: auth.userId,
    disponible: false,
  });
  prisma.mensajeWhatsappRecibido.findFirst.mockResolvedValue({
    id: 'comprobante',
  });
  expect(await servicio.disponibilidad(auth)).toEqual({
    empresaId: auth.tenantId,
    usuarioId: auth.userId,
    disponible: true,
  });
  expect(prisma.mensajeWhatsappRecibido.findFirst).toHaveBeenLastCalledWith({
    where: scope,
    select: { id: true },
  });
  expect(prisma.mensajeWhatsappRecibido.findMany).not.toHaveBeenCalled();
  expect(clientes.contexto).not.toHaveBeenCalled();
});
it('la disponibilidad desaparece al apagar el piloto o cambiar de empresa', async () => {
  const { servicio, prisma } = setup();
  expect(
    (await servicio.disponibilidad({ ...auth, tenantId: 'otra' })).disponible,
  ).toBe(false);
  jest.mocked(configuracionMetaRecepcion).mockReturnValue(null);
  expect((await servicio.disponibilidad(auth)).disponible).toBe(false);
  expect(prisma.mensajeWhatsappRecibido.findFirst).not.toHaveBeenCalled();
});
it('el menú también exige la capacidad del plan antes de consultar recepción', async () => {
  const { servicio, capacidades, prisma } = setup();
  capacidades.exigirIncluida.mockRejectedValue(new ForbiddenException());
  await expect(servicio.disponibilidad(auth)).rejects.toBeInstanceOf(
    ForbiddenException,
  );
  expect(prisma.mensajeWhatsappRecibido.findFirst).not.toHaveBeenCalled();
});
it('no consulta datos con el piloto apagado ni para otra empresa', async () => {
  const { servicio, prisma, clientes } = setup();
  expect(
    await servicio.consultar({ ...auth, tenantId: 'otra' }, {}),
  ).toBeNull();
  jest.mocked(configuracionMetaRecepcion).mockReturnValue(null);
  expect(await servicio.consultar(auth, {})).toBeNull();
  expect(prisma.mensajeWhatsappRecibido.findMany).not.toHaveBeenCalled();
  expect(clientes.contexto).not.toHaveBeenCalled();
});
it('exige capacidad antes de leer mensajes o contexto', async () => {
  const { servicio, capacidades, prisma, clientes } = setup();
  capacidades.exigirIncluida.mockRejectedValue(new ForbiddenException());
  await expect(servicio.consultar(auth, {})).rejects.toBeInstanceOf(
    ForbiddenException,
  );
  expect(prisma.mensajeWhatsappRecibido.findMany).not.toHaveBeenCalled();
  expect(clientes.contexto).not.toHaveBeenCalled();
});
it('consulta el teléfono configurado dentro del canal autorizado y no expone credenciales', async () => {
  const { servicio, prisma, clientes, capacidades } = setup();
  const result = await servicio.consultar(auth, {});
  expect(capacidades.exigirIncluida).toHaveBeenCalledWith(
    auth.tenantId,
    'whatsapp_automatico',
  );
  expect(prisma.mensajeWhatsappRecibido.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: scope,
      take: 51,
      orderBy: [{ enviadoEl: 'desc' }, { id: 'desc' }],
    }),
  );
  expect(clientes.contexto).toHaveBeenCalledWith(auth, {
    telefono: config.destinatario,
    clienteId: undefined,
  });
  expect(result).toMatchObject({
    empresaId: auth.tenantId,
    usuarioId: auth.userId,
    contacto: { telefono: config.destinatario },
    anterior: null,
  });
  expect(JSON.stringify(result)).not.toContain('no-se-devuelve');
  const select =
    prisma.mensajeWhatsappRecibido.findMany.mock.calls[0][0].select;
  expect(Object.keys(select).sort()).toEqual([
    'enviadoEl',
    'id',
    'nombreContacto',
    'texto',
    'tipo',
  ]);
});
it('pagina 50 mensajes en orden cronológico y usa el más antiguo incluido como cursor', async () => {
  const { servicio, prisma } = setup();
  prisma.mensajeWhatsappRecibido.findMany.mockResolvedValue(
    Array.from({ length: 51 }, (_, i) => ({
      id: `m${51 - i}`,
      enviadoEl: new Date(2026, 0, 51 - i),
      texto: `Texto ${51 - i}`,
    })),
  );
  const result = await servicio.consultar(auth, {});
  expect(result?.mensajes).toHaveLength(50);
  expect(result?.mensajes[0].id).toBe('m2');
  expect(result?.mensajes.at(-1)?.id).toBe('m51');
  expect(result?.anterior).toBe('m2');
});
it('cursor acotado al tenant, cuenta, canal y remitente; desempate estable por ID', async () => {
  const { servicio, prisma } = setup();
  const cursor = {
    id: '22222222-2222-4222-8222-222222222222',
    enviadoEl: new Date('2026-09-01T12:00:00Z'),
  };
  prisma.mensajeWhatsappRecibido.findFirst.mockResolvedValue(cursor);
  await servicio.consultar(auth, { antesDe: cursor.id });
  expect(prisma.mensajeWhatsappRecibido.findFirst).toHaveBeenCalledWith({
    where: { ...scope, id: cursor.id },
    select: { id: true, enviadoEl: true },
  });
  expect(prisma.mensajeWhatsappRecibido.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        ...scope,
        OR: [
          { enviadoEl: { lt: cursor.enviadoEl } },
          { enviadoEl: cursor.enviadoEl, id: { lt: cursor.id } },
        ],
      },
    }),
  );
});
it('rechaza cursor ajeno antes de consultar el historial y el CRM', async () => {
  const { servicio, prisma, clientes } = setup();
  prisma.mensajeWhatsappRecibido.findFirst.mockResolvedValue(null);
  await expect(
    servicio.consultar(auth, { antesDe: 'ajeno' }),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(prisma.mensajeWhatsappRecibido.findMany).not.toHaveBeenCalled();
  expect(clientes.contexto).not.toHaveBeenCalled();
});
it('sin crm.ver permite leer el piloto pero no busca fichas ni acepta una selección', async () => {
  const { servicio, clientes } = setup();
  const sinCrm = { ...auth, permisos: new Set<string>() };
  expect((await servicio.consultar(sinCrm, {}))?.contexto).toBeNull();
  expect(clientes.contexto).not.toHaveBeenCalled();
  await expect(
    servicio.consultar(sinCrm, { clienteId: 'ajeno' }),
  ).rejects.toBeInstanceOf(ForbiddenException);
});
it('la selección de ficha vuelve a validarse contra ese teléfono, sin cache', async () => {
  const { servicio, clientes } = setup();
  clientes.contexto.mockRejectedValue(new NotFoundException());
  await expect(
    servicio.consultar(auth, { clienteId: 'ajeno' }),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(clientes.contexto).toHaveBeenCalledWith(auth, {
    telefono: config.destinatario,
    clienteId: 'ajeno',
  });
});
