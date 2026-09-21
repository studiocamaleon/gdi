import type { Prisma } from '@prisma/client';
import type { OperacionCambioPlan } from './diagnostico-cambio-plan';

/** Sólo cuenta módulos que alguna propuesta retiraría. Todo filtrado por empresa. */
export async function operacionesCambioPlan(
  tx: Prisma.TransactionClient,
  tenantId: string,
  retiradas: Set<string>,
): Promise<OperacionCambioPlan[]> {
  const contar = async (
    codigo: string,
    funciones: string[],
    titulo: string,
    detalle: string,
    consulta: () => PromiseLike<number>,
  ): Promise<OperacionCambioPlan> => ({
    codigo,
    funciones,
    titulo,
    detalle,
    cantidad: funciones.some((f) => retiradas.has(f)) ? await consulta() : 0,
  });
  return Promise.all([
    contar(
      'reservas_vigentes',
      ['reservas', 'existencias'],
      'Reservas de materiales vigentes',
      'Revisá los materiales comprometidos con las OT y cómo se completará su consumo o liberación antes de retirar la función.',
      () =>
        tx.reservaMaterialOt.count({
          where: { tenantId, cantidad: { gt: 0 } },
        }),
    ),
    contar(
      'necesidades_abiertas',
      ['reservas', 'prevision_materiales'],
      'Necesidades de materiales pendientes',
      'Son necesidades con cantidad aún sin consumir en órdenes no entregadas ni canceladas. Acordá cómo seguirán abasteciéndose y actualizando sus fechas.',
      () =>
        tx.necesidadMaterialOt.count({
          where: {
            tenantId,
            estado: { not: 'CANCELADA' },
            cantidad: { gt: tx.necesidadMaterialOt.fields.consumida },
            orden: { estado: { notIn: ['entregada', 'cancelada'] } },
          },
        }),
    ),
    contar(
      'compras_abiertas',
      ['compras', 'recepciones'],
      'Compras abiertas',
      'Revisá borradores, pedidos emitidos y recepciones parciales en Compras y abastecimiento. Definí cómo completar o cancelar cada compromiso.',
      () =>
        tx.ordenCompra.count({
          where: {
            tenantId,
            estado: { in: ['BORRADOR', 'EMITIDA', 'PARCIAL'] },
          },
        }),
    ),
    contar(
      'egresos_pendientes',
      ['cuentas_pagar'],
      'Egresos con saldo pendiente',
      'Revisá los pagos pendientes y parciales en Cuentas por pagar antes de retirar su gestión.',
      () =>
        tx.egreso.count({
          where: { tenantId, estado: { in: ['pendiente', 'parcial'] } },
        }),
    ),
    contar(
      'recurrentes_activos',
      ['gastos_recurrentes'],
      'Gastos recurrentes activos',
      'Revisá las plantillas activas y cómo se registrarán los próximos períodos si se retira la generación recurrente.',
      () => tx.gastoRecurrente.count({ where: { tenantId, activo: true } }),
    ),
    contar(
      'valores_pendientes',
      ['valores', 'tesoreria'],
      'Valores sin cierre',
      'Revisá valores en cartera, depositados, endosados, emitidos o rechazados en Tesorería. Acordá su seguimiento hasta cerrar cada movimiento.',
      () =>
        tx.valor.count({
          where: {
            tenantId,
            estado: {
              in: ['cartera', 'depositado', 'endosado', 'emitido', 'rechazado'],
            },
          },
        }),
    ),
    contar(
      'proyectos_abiertos',
      ['proyectos'],
      'Proyectos y campañas abiertos',
      'Revisá los proyectos en borrador, activos o pausados y la continuidad de sus hitos y trabajos vinculados.',
      () =>
        tx.proyectoCampana.count({
          where: {
            tenantId,
            estado: { in: ['borrador', 'activo', 'pausado'] },
          },
        }),
    ),
    contar(
      'whatsapp_pendiente',
      ['whatsapp_automatico'],
      'Avisos de WhatsApp pendientes',
      'Hay avisos pendientes o en envío. Revisá cuáles deben terminar de salir antes de retirar los avisos automáticos.',
      () =>
        tx.notificacionWhatsapp.count({
          where: {
            tenantId,
            canal: 'WATI',
            estado: { in: ['pendiente', 'enviando'] },
          },
        }),
    ),
    contar(
      'whatsapp_web_pendiente',
      ['whatsapp_web'],
      'Avisos de WhatsApp Web pendientes',
      'Revisá los avisos pendientes o en envío por WhatsApp Web antes de retirar la conexión.',
      () =>
        tx.notificacionWhatsapp.count({
          where: {
            tenantId,
            canal: 'WHATSAPP_WEB',
            estado: { in: ['pendiente', 'enviando'] },
          },
        }),
    ),
    contar(
      'planes_entrega_elegidos',
      ['planificacion_avanzada'],
      'Planes de entrega elegidos',
      'Revisá las alternativas de entrega elegidas y sus compromisos en Planificación. El conteo incluye presupuestos abiertos y órdenes aún no entregadas.',
      () =>
        tx.planEntregaItem.count({
          where: {
            tenantId,
            alternativaElegidaId: { not: null },
            OR: [
              {
                ordenItem: {
                  orden: { estado: { notIn: ['entregada', 'cancelada'] } },
                },
              },
              {
                ordenItemId: null,
                cotizacionItem: {
                  cotizacion: {
                    estado: {
                      in: [
                        'borrador',
                        'enviado',
                        'aprobado',
                        'pendiente_aprobacion',
                      ],
                    },
                  },
                },
              },
            ],
          },
        }),
    ),
  ]);
}
