import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

/** Registros sintéticos de impresión para diagnósticos. No firma ni envía PDF. */
export async function ordenImpresionFixture(
  tx: Prisma.TransactionClient,
  tenantId: string,
  estado: Prisma.OrdenTrabajoCreateInput['estado'] = 'pendiente',
) {
  const orden = await tx.ordenTrabajo.create({
    data: {
      tenantId,
      numero: `OT-PRINT-${randomUUID()}`,
      estado,
      items: {
        create: {
          tenantId,
          codigo: 'DOC',
          nombre: 'Documento de prueba',
          familia: 'impresion',
          cantidad: 1,
          cantidadUnidad: 'u',
          subtotal: 1,
          impuestos: 0,
          total: 1,
        },
      },
    },
    include: { items: true },
  });
  const itemId = orden.items[0].id;
  let secuencia = 0;
  return {
    ordenId: orden.id,
    itemId,
    solicitar: (pagina = 0) =>
      tx.ordenTrabajoEvento.create({
        data: {
          tenantId,
          ordenId: orden.id,
          tipo: 'cola_impresion',
          descripcion: 'Solicitud de prueba',
          usuarioNombre: 'Ensayo',
          datosJson: {
            itemId,
            pagina,
            trabajoId: `${itemId}:${pagina}`,
            estado: 'PENDIENTE',
            intentoId: null,
          },
        },
      }),
    enviar: (
      opciones: {
        pagina?: number;
        estado?: string;
        verificado?: boolean;
        legacy?: boolean;
      } = {},
    ) => {
      const pagina = opciones.pagina ?? 0;
      return tx.ordenTrabajoEvento.create({
        data: {
          tenantId,
          ordenId: orden.id,
          tipo: 'impresion_documento',
          descripcion: 'Envío de prueba',
          usuarioNombre: 'Ensayo',
          fecha: new Date(Date.UTC(2026, 8, 22, 0, 0, ++secuencia)),
          datosJson: {
            itemId,
            ...(opciones.legacy
              ? {}
              : { pagina, trabajoId: `${itemId}:${pagina}` }),
            nombre: 'Documento de prueba',
            estado: opciones.estado ?? 'ENVIADO',
            ...(opciones.verificado
              ? {
                  confirmacion: {
                    fecha: '2026-09-22T01:00:00Z',
                    usuario: 'Ensayo',
                  },
                }
              : {}),
          },
        },
      });
    },
  };
}
