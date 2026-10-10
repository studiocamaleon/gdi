import { ConflictException } from '@nestjs/common';
import { CentroCopiadoService } from '../centro-copiado.service';

/** Empresa ficticia vacía: no requiere una base ni modifica catálogos. */
function preparar({ categoria = true, maquina = true, papel = true } = {}) {
  const prisma = {
    producto: { findUnique: jest.fn().mockResolvedValue(null) },
    productoSubcategoriaComercial: {
      findUnique: jest
        .fn()
        .mockResolvedValue(categoria ? { id: 'categoria' } : null),
    },
    maquina: {
      findMany: jest.fn().mockResolvedValue(
        maquina
          ? [
              {
                id: 'laser-demo',
                nombre: 'Láser demo',
                componentesDesgaste: [],
                perfilesOperativos: [],
              },
            ]
          : [],
      ),
    },
    materiaPrima: {
      findMany: jest
        .fn()
        .mockResolvedValue(papel ? [{ id: 'papel', variantes: [] }] : []),
    },
    centroCopiadoConfig: { upsert: jest.fn() },
    $transaction: jest
      .fn()
      .mockRejectedValue(new Error('No debe escribir sin requisitos')),
  };
  const auditoria = { registrar: jest.fn() };
  const capacidades = { exigir: jest.fn().mockResolvedValue(undefined) };
  const service = new CentroCopiadoService(
    prisma as never,
    {} as never,
    auditoria as never,
    undefined,
    undefined,
    capacidades as never,
  );
  return { service, prisma, auditoria };
}

describe('inicialización del Centro de Copiado sin requisitos', () => {
  it.each([
    [{ categoria: false }, 'Papelería comercial'],
    [{ maquina: false }, 'impresora láser'],
    [{ papel: false }, 'papel en hojas'],
    [{ papel: true }, 'variante activa'],
  ])(
    'explica qué falta y no persiste una activación incompleta (%j)',
    async (opciones, mensaje) => {
      const { service, prisma, auditoria } = preparar(opciones);
      await expect(service.inicializar('empresa-demo')).rejects.toThrow(
        mensaje,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.centroCopiadoConfig.upsert).not.toHaveBeenCalled();
      expect(auditoria.registrar).not.toHaveBeenCalled();
    },
  );

  it('guardar y reparar respetan los mismos requisitos', async () => {
    const { service, prisma, auditoria } = preparar({ maquina: false });
    await expect(
      service.actualizarConfig('empresa-demo', { activo: true }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(service.reparar('empresa-demo')).rejects.toThrow(
      'impresora láser',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('comprueba los requisitos de la empresa solicitada y sólo máquinas utilizables', async () => {
    const { service, prisma } = preparar({ maquina: false });
    await expect(service.inicializar('empresa-demo')).rejects.toThrow();
    expect(prisma.maquina.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'empresa-demo',
          plantilla: 'IMPRESORA_LASER',
          activo: true,
          estado: 'ACTIVA',
          estadoConfiguracion: 'LISTA',
        },
      }),
    );
  });
});
