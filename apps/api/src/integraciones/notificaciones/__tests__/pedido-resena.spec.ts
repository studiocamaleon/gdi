import { NotificacionesResenasService } from '../notificaciones-resenas.service';
import { POR_EVENTO } from '../../wati/catalogo';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { NotificacionesService } from '../notificaciones.service';
import type { DatosEmpresaService } from '../../../tenants/datos-empresa.service';

/**
 * Cuándo sale —y sobre todo cuándo NO— el pedido de reseña.
 *
 * Es el único aviso que no lo dispara un hecho sino el paso del tiempo, y eso
 * lo hace el más fácil de convertir en spam: un barrido mal acotado le escribe
 * a todo el historial de la imprenta el día que alguien enciende la función.
 * Lo que se defiende acá es justamente el acotado.
 */

const HOY = new Date('2026-07-26T13:00:00.000Z');

type Orden = {
  id: string;
  numero: string | null;
  clienteId: string | null;
  cliente: { razonSocial: string } | null;
};

function armar(
  ordenes: Orden[],
  opciones: {
    urlResenas?: string | null;
    dias?: number;
    yaPedidas?: string[];
  } = {},
) {
  const encolar = jest.fn().mockResolvedValue({ encolada: true, id: 'n1' });
  const findMany = jest.fn().mockResolvedValue(ordenes);

  const prisma = {
    ordenTrabajo: { findMany },
    notificacionWhatsapp: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          (opciones.yaPedidas ?? []).map((ordenId) => ({ ordenId })),
        ),
    },
    configuracionNotificaciones: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ resenaDiasDespues: opciones.dias ?? 3 }),
    },
  } as unknown as PrismaService;

  const empresa = {
    paraDocumentos: jest.fn().mockResolvedValue({
      urlResenas:
        opciones.urlResenas === undefined
          ? 'https://g.page/r/ejemplo/review'
          : opciones.urlResenas,
    }),
  } as unknown as DatosEmpresaService;

  const service = new NotificacionesResenasService(
    prisma,
    { encolar } as unknown as NotificacionesService,
    empresa,
  );
  return { service, encolar, findMany };
}

/** El `where` que el barrido le pasa a Prisma, tipado para poder mirarlo. */
type WhereBarrido = {
  estado: string;
  clienteId: { not: null };
  fechaEntregada: { gte: Date; lte: Date };
  id?: { notIn: string[] };
};

const whereDe = (findMany: jest.Mock): WhereBarrido => {
  const args = findMany.mock.calls[0] as [{ where: WhereBarrido }];
  return args[0].where;
};

const dia = (d: Date) => d.toISOString().slice(0, 10);

const orden = (over: Partial<Orden> = {}): Orden => ({
  id: 'ot-1',
  numero: 'OT-2026-0031',
  clienteId: 'cli-1',
  cliente: { razonSocial: 'Imprenta Imagen SRL' },
  ...over,
});

describe('Pedido de reseña', () => {
  it('encola con nombre, número de orden y link', async () => {
    const { service, encolar } = armar([orden()]);
    expect(await service.barrer('t1', HOY)).toBe(1);
    expect(encolar).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: 'resena',
        entidadId: 'ot-1',
        parametros: [
          'Imprenta Imagen SRL',
          'OT-2026-0031',
          'https://g.page/r/ejemplo/review',
        ],
      }),
    );
  });

  /**
   * El mensaje entero existe para llevar a esa página. Sin link sería un
   * "¿cómo te fue?" sin destino, que es spam.
   */
  it('sin link de reseñas no manda nada', async () => {
    const { service, encolar, findMany } = armar([orden()], {
      urlResenas: null,
    });
    expect(await service.barrer('t1', HOY)).toBe(0);
    expect(encolar).not.toHaveBeenCalled();
    // Ni siquiera busca órdenes: se corta antes.
    expect(findMany).not.toHaveBeenCalled();
  });

  it('busca sólo entregadas, con cliente y dentro de la ventana', async () => {
    const { service, findMany } = armar([], { dias: 3 });
    await service.barrer('t1', HOY);

    const where = whereDe(findMany);
    expect(where.estado).toBe('entregada');
    expect(where.clienteId).toEqual({ not: null });

    // Con plazo de 3 días: nada entregado después del 23 (todavía no cumple)
    // ni antes del 13 (ya es viejo, la ventana son 10 días).
    expect(dia(where.fechaEntregada.lte)).toBe('2026-07-23');
    expect(dia(where.fechaEntregada.gte)).toBe('2026-07-13');
  });

  it('el plazo lo pone el tenant', async () => {
    const { service, findMany } = armar([], { dias: 7 });
    await service.barrer('t1', HOY);
    expect(dia(whereDe(findMany).fechaEntregada.lte)).toBe('2026-07-19');
  });

  /**
   * El barrido pasa todos los días sobre la misma ventana: sin esto, cada
   * corrida intentaría un INSERT por orden que la clave única rechazaría.
   */
  it('descarta las órdenes que ya tienen el pedido encolado', async () => {
    const { service, findMany } = armar([], { yaPedidas: ['ot-9', 'ot-8'] });
    await service.barrer('t1', HOY);
    expect(whereDe(findMany).id).toEqual({ notIn: ['ot-9', 'ot-8'] });
  });

  it('sin nada pedido todavía, no arma un filtro vacío', async () => {
    const { service, findMany } = armar([]);
    await service.barrer('t1', HOY);
    expect(whereDe(findMany).id).toBeUndefined();
  });

  /** Un barrido que explota no puede voltear el cron de todos los tenants. */
  it('un error no se propaga', async () => {
    const { service, findMany } = armar([]);
    findMany.mockRejectedValueOnce(new Error('base caída'));
    await expect(service.barrer('t1', HOY)).resolves.toBe(0);
  });

  it('cuenta sólo lo que realmente se encoló', async () => {
    const { service, encolar } = armar([orden(), orden({ id: 'ot-2' })]);
    encolar.mockResolvedValueOnce({ encolada: true, id: 'n1' });
    encolar.mockResolvedValueOnce({
      encolada: false,
      motivo: 'Es un mensaje promocional y el cliente no lo aceptó.',
    });
    expect(await service.barrer('t1', HOY)).toBe(1);
  });

  /**
   * El freno de verdad no está en este servicio sino en el catálogo y en
   * `NotificacionesService`: la plantilla es MARKETING —así que exige opt-in
   * explícito— y viene apagada. Si alguien cambiara eso, esto avisa.
   */
  it('la plantilla sigue siendo de marketing y apagada por defecto', () => {
    const plantilla = POR_EVENTO.get('resena');
    expect(plantilla?.categoria).toBe('MARKETING');
    expect(plantilla?.activoPorDefecto).toBe(false);
    expect(plantilla?.parametros).toHaveLength(3);
  });
});
