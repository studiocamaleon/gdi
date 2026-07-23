import { TipoEnlacePublico } from '@prisma/client';
import {
  EnlacesPublicosService,
  generarTokenPublico,
} from '../enlaces-publicos.service';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * El token de un link público ES la autorización: quien lo tiene ve la entidad
 * sin sesión. Por eso lo que se prueba acá es dónde el resolver dice que NO —
 * un token que abre lo que no debe es una fuga de datos de un cliente.
 */

type FilaEnlace = {
  id: string;
  tipo: TipoEnlacePublico;
  entidadId: string;
  tenantId: string;
  expiraEl: Date | null;
  revocadoEl: Date | null;
  primeraVistaEl: Date | null;
};

/** Lo que le llega a prisma.enlacePublico.update: sólo interesa el `data`. */
type ArgsUpdate = { data: Record<string, unknown> };

function servicioCon(fila: FilaEnlace | null) {
  const update = jest
    .fn<Promise<unknown>, [ArgsUpdate]>()
    .mockResolvedValue({});
  const prisma = {
    enlacePublico: {
      findUnique: jest.fn().mockResolvedValue(fila),
      update,
    },
  } as unknown as PrismaService;
  return { servicio: new EnlacesPublicosService(prisma), update };
}

const BASE: FilaEnlace = {
  id: 'enlace-1',
  tipo: TipoEnlacePublico.SEGUIMIENTO_OT,
  entidadId: 'orden-1',
  tenantId: 'tenant-1',
  expiraEl: null,
  revocadoEl: null,
  primeraVistaEl: null,
};

describe('generarTokenPublico', () => {
  it('da 12 chars url-safe, sin padding ni caracteres que rompan una URL', () => {
    for (let i = 0; i < 200; i++) {
      expect(generarTokenPublico()).toMatch(/^[A-Za-z0-9_-]{12}$/);
    }
  });

  it('no repite', () => {
    const vistos = new Set(
      Array.from({ length: 1000 }, () => generarTokenPublico()),
    );
    expect(vistos.size).toBe(1000);
  });
});

describe('EnlacesPublicosService.resolver', () => {
  it('resuelve un enlace vigente a su entidad y su tenant', async () => {
    const { servicio } = servicioCon(BASE);
    await expect(
      servicio.resolver('tok', TipoEnlacePublico.SEGUIMIENTO_OT),
    ).resolves.toEqual({ entidadId: 'orden-1', tenantId: 'tenant-1' });
  });

  it('un token de presupuesto NO abre el seguimiento de una OT', async () => {
    const { servicio } = servicioCon({
      ...BASE,
      tipo: TipoEnlacePublico.PRESUPUESTO,
    });
    await expect(
      servicio.resolver('tok', TipoEnlacePublico.SEGUIMIENTO_OT),
    ).resolves.toBeNull();
  });

  it('un enlace revocado no abre nada', async () => {
    const { servicio } = servicioCon({ ...BASE, revocadoEl: new Date() });
    await expect(
      servicio.resolver('tok', TipoEnlacePublico.SEGUIMIENTO_OT),
    ).resolves.toBeNull();
  });

  it('un enlace vencido no abre nada', async () => {
    const { servicio } = servicioCon({
      ...BASE,
      expiraEl: new Date(Date.now() - 1000),
    });
    await expect(
      servicio.resolver('tok', TipoEnlacePublico.SEGUIMIENTO_OT),
    ).resolves.toBeNull();
  });

  it('con caducidad futura sigue abriendo', async () => {
    const { servicio } = servicioCon({
      ...BASE,
      expiraEl: new Date(Date.now() + 60_000),
    });
    await expect(
      servicio.resolver('tok', TipoEnlacePublico.SEGUIMIENTO_OT),
    ).resolves.not.toBeNull();
  });

  it('un token inexistente devuelve null (no rompe)', async () => {
    const { servicio } = servicioCon(null);
    await expect(
      servicio.resolver('no-existe', TipoEnlacePublico.SEGUIMIENTO_OT),
    ).resolves.toBeNull();
  });

  it('token vacío no llega ni a la base', async () => {
    const { servicio } = servicioCon(BASE);
    await expect(
      servicio.resolver('', TipoEnlacePublico.SEGUIMIENTO_OT),
    ).resolves.toBeNull();
  });

  it('sólo cuenta la visita cuando se le pide', async () => {
    const { servicio, update } = servicioCon(BASE);
    await servicio.resolver('tok', TipoEnlacePublico.SEGUIMIENTO_OT);
    expect(update).not.toHaveBeenCalled();

    await servicio.resolver('tok', TipoEnlacePublico.SEGUIMIENTO_OT, {
      contarVisita: true,
    });
    expect(update).toHaveBeenCalledTimes(1);
    const { data } = update.mock.calls[0][0];
    expect(data.visitas).toEqual({ increment: 1 });
    expect(data.primeraVistaEl).toBeInstanceOf(Date);
  });

  it('la primera vista no se pisa en aperturas siguientes', async () => {
    const primera = new Date('2026-01-01T10:00:00Z');
    const { servicio, update } = servicioCon({
      ...BASE,
      primeraVistaEl: primera,
    });
    await servicio.resolver('tok', TipoEnlacePublico.SEGUIMIENTO_OT, {
      contarVisita: true,
    });
    const { data } = update.mock.calls[0][0];
    expect(data.primeraVistaEl).toEqual(primera);
  });

  it('si falla registrar la visita, el cliente igual ve su pedido', async () => {
    const { servicio, update } = servicioCon(BASE);
    update.mockRejectedValueOnce(new Error('base caída'));
    await expect(
      servicio.resolver('tok', TipoEnlacePublico.SEGUIMIENTO_OT, {
        contarVisita: true,
      }),
    ).resolves.toEqual({ entidadId: 'orden-1', tenantId: 'tenant-1' });
  });
});
