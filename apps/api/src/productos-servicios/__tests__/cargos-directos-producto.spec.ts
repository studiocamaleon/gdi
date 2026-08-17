import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { CargosDirectosProductoService } from '../cargos-directos-producto.service';
import type { FamiliasPasosService } from '../familias-pasos.service';
import { ModoActivacionCargoDto } from '../dto/cargo-directo.dto';

const cargo = {
  id: '22222222-2222-4222-8222-222222222222',
  activo: true,
  nombre: 'Peaje',
  modoCalculo: 'MONTO_FIJO_PLANO',
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  configJson: { monto: 2500 },
};

function serviceCon(prisma: Record<string, unknown>) {
  return new CargosDirectosProductoService(
    prisma as unknown as PrismaService,
    {} as FamiliasPasosService,
  );
}

describe('CargosDirectosProductoService', () => {
  it('asocia un costo activo y válido a un paso', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'asociacion' });
    const service = serviceCon({
      productoConfigPaso: {
        findFirst: jest.fn().mockResolvedValue({ id: 'config-paso' }),
      },
      cargoDirectoCatalogo: { findFirst: jest.fn().mockResolvedValue(cargo) },
      productoCargoDirectoPaso: { create },
    });

    await service.asociarCargoPaso('tenant', 'config-paso', {
      cargoDirectoCatalogoId: cargo.id,
      modoActivacion: ModoActivacionCargoDto.OBLIGATORIO,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productoConfigPasoId: 'config-paso',
        cargoDirectoCatalogoId: cargo.id,
        modoActivacion: 'OBLIGATORIO',
      }),
    });
  });

  it('rechaza un modo que el costo no soporta', async () => {
    const service = serviceCon({
      productoConfigPaso: {
        findFirst: jest.fn().mockResolvedValue({ id: 'config-paso' }),
      },
      cargoDirectoCatalogo: { findFirst: jest.fn().mockResolvedValue(cargo) },
      productoCargoDirectoPaso: { create: jest.fn() },
    });

    await expect(
      service.asociarCargoPaso('tenant', 'config-paso', {
        cargoDirectoCatalogoId: cargo.id,
        modoActivacion: ModoActivacionCargoDto.CONDICIONAL,
        condicionActivacionJson: { '>': [{ var: 'cantidad' }, 10] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('permite volver al valor heredado quitando el override', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'asociacion' });
    const service = serviceCon({
      productoCargoDirectoPaso: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'asociacion',
          modoActivacion: 'OPCIONAL',
          condicionActivacionJson: null,
          configOverrideJson: { monto: 9000 },
          cargoDirectoCatalogo: cargo,
        }),
        update,
      },
    });

    await service.actualizarCargoPaso('tenant', 'asociacion', {
      configOverrideJson: null,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'asociacion' },
      data: expect.objectContaining({ configOverrideJson: expect.anything() }),
    });
  });
});
