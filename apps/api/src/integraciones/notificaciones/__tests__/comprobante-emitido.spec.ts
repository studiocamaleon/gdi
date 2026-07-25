import { NotificacionesComprobantesService } from '../notificaciones-comprobantes.service';
import { POR_EVENTO } from '../../wati/catalogo';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { NotificacionesService } from '../notificaciones.service';

/**
 * Cuándo sale —y cuándo NO— el aviso del comprobante fiscal.
 *
 * El caso que importa es el provider manual: el comprobante queda `emitido`
 * antes de tener CAE, y el CAE se carga a mano después. Mandarle al cliente una
 * factura sin autorizar es mandarle un papel que no vale, y encima el PDF se
 * rehace cuando el CAE llega. Por eso el aviso mira el CAE, no el estado.
 */

type FilaComprobante = Partial<{
  id: string;
  tenantId: string;
  tipo: string;
  letra: string;
  numero: number | null;
  total: number;
  estado: string;
  cae: string | null;
  clienteId: string | null;
  ordenId: string | null;
  cliente: { razonSocial: string } | null;
  puntoVenta: { numero: number };
}>;

function armar(comprobante: FilaComprobante | null, conEnlace = true) {
  const encolar = jest.fn().mockResolvedValue({ encolada: true, id: 'n1' });
  const prisma = {
    comprobante: { findFirst: jest.fn().mockResolvedValue(comprobante) },
    enlacePublico: {
      findUnique: jest
        .fn()
        .mockResolvedValue(conEnlace ? { token: 'aB3xK9mQ2wZ7' } : null),
    },
  } as unknown as PrismaService;
  const service = new NotificacionesComprobantesService(prisma, {
    encolar,
  } as unknown as NotificacionesService);
  return { service, encolar };
}

const EMITIDA: FilaComprobante = {
  id: 'c1',
  tenantId: 't1',
  tipo: 'factura',
  letra: 'B',
  numero: 1285,
  total: 224334,
  estado: 'emitido',
  cae: '75123456789012',
  clienteId: 'cli1',
  ordenId: 'o1',
  cliente: { razonSocial: 'Marcela Gómez' },
  puntoVenta: { numero: 3 },
};

describe('aviso de comprobante emitido', () => {
  it('encola con los cinco parámetros de la plantilla', async () => {
    const { service, encolar } = armar(EMITIDA);
    await service.avisar('c1');

    expect(encolar).toHaveBeenCalledTimes(1);
    const ctx = encolar.mock.calls[0][0] as {
      evento: string;
      parametros: string[];
    };
    expect(ctx.evento).toBe('comprobante_emitido');
    expect(ctx.parametros).toHaveLength(
      POR_EVENTO.get('comprobante_emitido')!.parametros.length,
    );
    // Punto de venta y número como figuran impresos.
    expect(ctx.parametros[1]).toBe('Factura B');
    expect(ctx.parametros[2]).toBe('0003-00001285');
    expect(ctx.parametros[4]).toContain('/f/aB3xK9mQ2wZ7');
  });

  it('no manda nada mientras no hay CAE, aunque esté emitido', async () => {
    const { service, encolar } = armar({ ...EMITIDA, cae: null });
    await service.avisar('c1');
    expect(encolar).not.toHaveBeenCalled();
  });

  it('no manda un borrador', async () => {
    const { service, encolar } = armar({ ...EMITIDA, estado: 'borrador' });
    await service.avisar('c1');
    expect(encolar).not.toHaveBeenCalled();
  });

  it('sin link público no hay nada que abrir: no manda', async () => {
    const { service, encolar } = armar(EMITIDA, false);
    await service.avisar('c1');
    expect(encolar).not.toHaveBeenCalled();
  });

  it('sin cliente no hay a quién avisarle', async () => {
    const { service, encolar } = armar({ ...EMITIDA, clienteId: null });
    await service.avisar('c1');
    expect(encolar).not.toHaveBeenCalled();
  });

  /** D4: un fallo del aviso nunca puede volver sobre la emisión fiscal. */
  it('se traga el error si la base falla', async () => {
    const prisma = {
      comprobante: {
        findFirst: jest.fn().mockRejectedValue(new Error('sin conexión')),
      },
    } as unknown as PrismaService;
    const service = new NotificacionesComprobantesService(prisma, {
      encolar: jest.fn(),
    } as unknown as NotificacionesService);

    await expect(service.avisar('c1')).resolves.toBeUndefined();
  });

  it('nombra el tipo de una nota de crédito, no lo deja crudo', async () => {
    const { service, encolar } = armar({
      ...EMITIDA,
      tipo: 'nota_credito',
      letra: 'A',
    });
    await service.avisar('c1');
    const ctx = encolar.mock.calls[0][0] as { parametros: string[] };
    expect(ctx.parametros[1]).toBe('Nota de Crédito A');
  });
});
