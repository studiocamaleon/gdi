import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../../auth/auth.types';
import { PanelActividadService } from '../panel-actividad.service';
import { PanelAdminService } from '../panel-admin.service';

const auth = (permisos = ['panel.ver', 'comercial.ver', 'produccion.ver']) => ({
  tenantId: '11111111-1111-4111-8111-111111111111', role: 'ADMINISTRADOR', permisos: new Set(permisos),
}) as CurrentAuth;

describe('Actividad del administrador', () => {
  it('rechaza otros roles y administradores sin permiso antes de consultar', async () => {
    const prisma = { $queryRaw: jest.fn() };
    const service = new PanelActividadService(prisma as never);
    await expect(service.listar({ ...auth(), role: 'OPERADOR' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listar(auth([]))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('no amplía el alcance personal de permisos personalizados', async () => {
    const prisma = { $queryRaw: jest.fn() };
    const service = new PanelActividadService(prisma as never);
    await expect(service.listar(auth(['panel.ver', 'comercial.ver', 'comercial.gestionar']))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listar(auth(['panel.ver', 'produccion.ver', 'produccion.ejecutar']))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('limita las fuentes a los permisos y aplica tenant explícito en el SQL', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const service = new PanelActividadService(prisma as never);
    await service.listar(auth(['panel.ver', 'produccion.ver']));
    const sql = prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.text).not.toContain('ClienteEvento');
    expect(sql.text).not.toContain("LIKE 'documento.%'");
    expect(sql.values).toContain(auth().tenantId);
    expect(sql.values).not.toContain('modificacion');
    expect(sql.values).toContain('paso');
    await service.listar(auth(['panel.ver']));
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('pagina por fecha e identidad, sin perder sucesos que tienen la misma fecha', async () => {
    const fecha = new Date('2026-09-13T23:10:00.000Z');
    const fila = (n: number) => ({ id: `sistema:${String(n).padStart(20, '0')}`, fecha, tipo: 'campana.creada', titulo: 'Campaña', detalle: '', actor: 'Lucas', href: null });
    const prisma = { $queryRaw: jest.fn().mockResolvedValueOnce([fila(3), fila(2), fila(1)]).mockResolvedValueOnce([fila(1)]) };
    const service = new PanelActividadService(prisma as never);
    const primera = await service.listar(auth(), undefined, 2);
    expect(primera.items).toHaveLength(2);
    expect(primera.siguienteCursor).toBeTruthy();
    const siguiente = await service.listar(auth(), primera.siguienteCursor!, 2);
    expect(siguiente.siguienteCursor).toBeNull();
    const sql = prisma.$queryRaw.mock.calls[1][0] as Prisma.Sql;
    expect(sql.text).toContain('(fecha, id COLLATE "C") <');
    expect(sql.values).toContain(fila(2).id);
    expect(primera.items.map((x) => x.id)).not.toContain(siguiente.items[0].id);
  });

  it.each(['malformado', Buffer.from('{"fecha":"invalida","id":"orden:1"}').toString('base64url')])('rechaza cursor inválido %s', async (cursor) => {
    const prisma = { $queryRaw: jest.fn() };
    await expect(new PanelActividadService(prisma as never).listar(auth(), cursor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('Resumen del administrador', () => {
  it('cuenta pasos del día local, excluye participantes y resume requisitos por orden', async () => {
    const prisma = {
      ordenTrabajoItemPaso: { count: jest.fn().mockResolvedValue(8) },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'ot-1', numero: 'OT-1', requisitos: 2, total: 1 }]),
    };
    const actividad = { listar: jest.fn().mockResolvedValue({ items: [], siguienteCursor: null }) };
    const resultado = await new PanelAdminService(prisma as never, actividad as never).obtener(auth(), '2026-09-13', 'America/Argentina/Buenos_Aires');
    expect(resultado.pasosCompletadosHoy).toBe(8);
    expect(resultado.documentacionPendiente.total).toBe(1);
    expect(resultado.documentacionPendiente.ordenes[0].requisitos).toBe(2);
    expect(prisma.ordenTrabajoItemPaso.count).toHaveBeenCalledWith({ where: {
      tenantId: auth().tenantId, estado: 'hecho',
      OR: [{ nestingLoteRol: null }, { nestingLoteRol: { not: 'PARTICIPANTE' } }],
      completadoEl: { gte: new Date('2026-09-13T03:00:00Z'), lt: new Date('2026-09-14T03:00:00Z') },
    } });
    const sql = prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.text).toContain('NOT EXISTS');
    expect(sql.text).toContain('m."revisionLiberadaId"');
    expect(sql.text).toContain("s.estado = 'APROBADA'");
    expect(sql.text).toContain('s.tipo = g."tipoAprobacion"');
  });
});
