import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export async function resolverIvaCopiado(
  prisma: PrismaService,
  tenantId: string,
  productoId: string,
) {
  const [producto, fiscal, tasas] = await Promise.all([
    prisma.producto.findFirst({
      where: { tenantId, id: productoId },
      select: { categoriaFiscal: true },
    }),
    prisma.configuracionFiscal.findUnique({
      where: { tenantId },
      select: { condicionFiscal: true },
    }),
    prisma.productoImpuestoCatalogo.findMany({
      where: {
        tenantId,
        activo: true,
        alcance: 'PRODUCTO',
        traslado: 'POR_FUERA',
      },
    }),
  ]);
  if (!producto)
    throw new BadRequestException(
      'El producto de referencia ya no está disponible.',
    );
  const categoria = producto.categoriaFiscal ?? 'general';
  if (
    ['monotributo', 'exento'].includes(fiscal?.condicionFiscal ?? '') ||
    categoria === 'exento'
  )
    return '0';
  const compatibles = tasas.filter(
    (t) => (t.categoriaFiscal ?? 'general') === categoria,
  );
  if (compatibles.length !== 1)
    throw new BadRequestException(
      'Falta una alícuota fiscal inequívoca para comparar el precio sin IVA.',
    );
  return String(compatibles[0].porcentaje);
}
