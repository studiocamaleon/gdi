import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { canalPruebaPermitido } from './meta-prueba.config';
export const lecturaGeneralHabilitada = () =>
  process.env.META_INBOX_LECTURA_ENABLED === 'true';
/** Canal obtenido exclusivamente de la empresa autenticada. La generación evita
 * conservar una lectura o stream durante una reconexión del mismo número. */
export async function canalGeneralInbox(
  db: Pick<PrismaService, 'metaVinculo'>,
  tenantId: string,
) {
  if (!tenantId || !lecturaGeneralHabilitada()) return null;
  const canal = await db.metaVinculo.findFirst({
    where: {
      tenantId,
      estado: 'VERIFICADO',
      recepcionDesdeEl: { not: null },
      tokenCifrado: { not: Prisma.AnyNull },
      AND: [
        { OR: [{ tokenVenceEl: null }, { tokenVenceEl: { gt: new Date() } }] },
        {
          OR: [
            { accesoDatosVenceEl: null },
            { accesoDatosVenceEl: { gt: new Date() } },
          ],
        },
      ],
    },
    select: {
      id: true,
      tenantId: true,
      wabaId: true,
      phoneNumberId: true,
      autorizacionId: true,
      numero: true,
      recepcionDesdeEl: true,
      tipo: true,
      pruebaDestinatarioWaId: true,
      tokenVenceEl: true,
    },
  });
  return canal && (canal.tipo === 'COEXISTENCIA' || canalPruebaPermitido(canal))
    ? canal
    : null;
}
export const identidadCanalInbox = (canal: {
  id: string;
  autorizacionId: string;
}) => `${canal.id}:${canal.autorizacionId}`;
