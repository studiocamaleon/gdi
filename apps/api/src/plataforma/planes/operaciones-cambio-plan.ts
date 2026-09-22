import { gateDocumentoEstaCumplido } from '../../desarrollo-documental/desarrollo-documental.service';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { OperacionCambioPlan } from './diagnostico-cambio-plan';
import { contarContinuidadImpresion } from '../../impresion/continuidad-impresion';

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
  const [
    operaciones,
    impresion,
    fiscales,
    asignaciones,
    puntos,
    arte,
    borradoresArte,
    preciosEspeciales,
  ] = await Promise.all([
    Promise.all([
      contar(
        'arte_solicitudes_pendientes',
        ['aprobacion_arte'],
        'Aprobaciones de arte pendientes',
        'Resolvé o cancelá las solicitudes de aprobación antes de retirar la función. Las solicitudes vencidas también se pueden cancelar desde su historial.',
        () =>
          tx.solicitudAprobacionDocumento.count({
            where: { tenantId, estado: 'PENDIENTE' },
          }),
      ),
      contar(
        'puntos_reservados',
        ['fidelizacion'],
        'Canjes de puntos reservados',
        'Completá o cancelá los presupuestos y borradores con canjes reservados antes de retirar Fidelización. Los puntos se liberan al cancelar el compromiso.',
        () =>
          tx.fidelizacionReserva.count({
            where: { tenantId, estado: 'RESERVADA' },
          }),
      ),
      contar(
        'puntos_presupuestos',
        ['fidelizacion'],
        'Presupuestos con puntos comprometidos',
        'Revisá los presupuestos abiertos con puntos prometidos o canjes, incluidos los borradores. Completá su conversión o cancelación antes de retirar Fidelización.',
        () =>
          tx.cotizacion.count({
            where: {
              tenantId,
              estado: {
                in: ['borrador', 'pendiente_aprobacion', 'enviado', 'aprobado'],
              },
              OR: [
                { fidelizacionPuntosEstimados: { gt: 0 } },
                { fidelizacionCanjePuntos: { gt: 0 } },
              ],
            },
          }),
      ),
      contar(
        'puntos_ordenes',
        ['fidelizacion'],
        'Órdenes con puntos por resolver',
        'Hay canjes en OT abiertas o puntos prometidos aún sin acreditar. Completá la entrega y el cobro, o cancelá el trabajo antes de retirar Fidelización. También se revisan los borradores.',
        () =>
          tx.ordenTrabajo.count({
            where: {
              tenantId,
              estado: { not: 'cancelada' },
              OR: [
                {
                  estado: { not: 'entregada' },
                  fidelizacionCanjePuntos: { gt: 0 },
                },
                {
                  fidelizacionPuntosEstimados: { gt: 0 },
                  movimientosFidelizacion: {
                    none: { tipo: 'GANANCIA', reversiones: { none: {} } },
                  },
                },
              ],
            },
          }),
      ),
      contar(
        'cupones_presupuestos',
        ['cupones'],
        'Cupones comprometidos en presupuestos',
        'Hay descuentos reservados o presupuestos parcialmente convertidos. Completá su conversión y la entrega de sus OT, o rechazá/cancelá el presupuesto para liberar los usos antes de retirar Cupones. Los descuentos guardados no se eliminan.',
        () =>
          tx.cuponRedencion.count({
            where: {
              tenantId,
              OR: [
                { estado: 'RESERVADA' },
                {
                  estado: 'CONSUMIDA',
                  cotizacion: { estado: { in: ['enviado', 'aprobado'] } },
                },
              ],
            },
          }),
      ),
      contar(
        'cupones_ordenes',
        ['cupones'],
        'Órdenes abiertas con cupones',
        'Hay OT, incluidos borradores, con descuentos por cupón. Completá su entrega o cancelación, o revisá los descuentos del borrador antes de retirar la función. El historial y los importes acordados se conservan después del cambio.',
        () =>
          tx.ordenTrabajo.count({
            where: {
              tenantId,
              estado: { notIn: ['entregada', 'cancelada'] },
              items: { some: { descuentoCuponId: { not: null } } },
            },
          }),
      ),
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
        ['reservas', 'existencias'],
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
                in: [
                  'cartera',
                  'depositado',
                  'endosado',
                  'emitido',
                  'rechazado',
                ],
              },
            },
          }),
      ),
      contar(
        'proyectos_abiertos',
        ['proyectos'],
        'Proyectos y campañas abiertos',
        'Revisá los proyectos abiertos y los hitos pendientes, también dentro de campañas completadas o canceladas.',
        () =>
          tx.proyectoCampana.count({
            where: {
              tenantId,
              OR: [
                { estado: { in: ['borrador', 'activo', 'pausado'] } },
                {
                  hitos: {
                    some: { estado: { in: ['pendiente', 'en_curso'] } },
                  },
                },
              ],
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
              estado: {
                in: [
                  'pendiente',
                  'wati_reservada',
                  'enviando',
                  'wati_incierta',
                ],
              },
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
              estado: {
                in: [
                  'pendiente',
                  'enviando',
                  'web_reservada',
                  'web_enviando',
                  'web_incierta',
                ],
              },
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
    ]),
    retiradas.has('impresion_directa') || retiradas.has('colas_impresion')
      ? contarContinuidadImpresion(tx, tenantId)
      : null,
    retiradas.has('fiscal_argentina')
      ? tx.comprobante.findMany({
          where: {
            tenantId,
            OR: [
              { estado: { in: ['en_proceso', 'por_verificar'] } },
              { estado: 'borrador', numero: { not: null } },
              { estado: 'emitido', cae: null, anuladoEl: null },
            ],
          },
          select: { id: true, estado: true, numero: true, updatedAt: true },
          orderBy: { id: 'asc' },
        })
      : [],
    retiradas.has('asignacion_automatica')
      ? tx.ordenTrabajoItemPaso.findMany({
          where: {
            tenantId,
            estado: { not: 'hecho' },
            orden: { tenantId, estado: { in: ['pendiente', 'produccion'] } },
            asignacionPersonalJson: { path: ['version'], equals: 1 },
          },
          select: {
            id: true,
            estado: true,
            asignacionPersonalJson: true,
            asignacionManualJson: true,
          },
          orderBy: { id: 'asc' },
        })
      : [],
    retiradas.has('fidelizacion')
      ? tx.fidelizacionCuenta.findMany({
          where: {
            tenantId,
            OR: [{ saldoPuntos: { not: 0 } }, { reservadosPuntos: { not: 0 } }],
          },
          select: { id: true, saldoPuntos: true, reservadosPuntos: true },
          orderBy: { id: 'asc' },
        })
      : [],
    retiradas.has('aprobacion_arte')
      ? tx.gateProduccionDocumento.findMany({
          where: {
            tenantId,
            activo: true,
            orden: {
              estado: { in: ['borrador', 'pendiente', 'produccion'] },
            },
            OR: [{ pasoId: null }, { paso: { estado: { not: 'hecho' } } }],
          },
          include: {
            archivoMaestro: {
              include: {
                revisionLiberada: {
                  include: {
                    solicitudes: {
                      where: { estado: 'APROBADA' },
                      select: { tipo: true },
                    },
                  },
                },
              },
            },
          },
        })
      : [],
    retiradas.has('aprobacion_arte')
      ? tx.archivoMaestro.findMany({
          where: {
            tenantId,
            OR: [
              { revisionLiberadaId: null },
              {
                revisiones: {
                  some: {
                    estado: { in: ['BORRADOR', 'OBSERVADA', 'EN_REVISION'] },
                  },
                },
              },
            ],
          },
          select: {
            id: true,
            updatedAt: true,
            revisiones: {
              select: { id: true, estado: true },
              orderBy: { id: 'asc' },
            },
          },
          orderBy: { id: 'asc' },
        })
      : [],
    retiradas.has('precios_especiales')
      ? tx.productoPrecioEspecialClienteV2.findMany({
          where: { tenantId, activo: true },
          select: { id: true, updatedAt: true },
          orderBy: { id: 'asc' },
        })
      : [],
  ]);
  return [
    ...operaciones,
    ...(retiradas.has('precios_especiales')
      ? [
          {
            codigo: 'precios_especiales_configurados',
            funciones: ['precios_especiales'],
            titulo: 'Precios especiales por cliente',
            detalle:
              'Las reglas se conservarán para consulta, pero las nuevas cotizaciones usarán el precio general del producto. Los presupuestos y las OT ya guardados conservarán sus importes; recotizarlos aplicará el contrato vigente.',
            cantidad: preciosEspeciales.length,
            permiteRetiradaConRevision: true,
            revision: createHash('sha256')
              .update(JSON.stringify(preciosEspeciales))
              .digest('hex'),
          },
        ]
      : []),
    ...(retiradas.has('aprobacion_arte')
      ? [
          {
            codigo: 'arte_versiones_en_preparacion',
            funciones: ['aprobacion_arte'],
            titulo: 'Versiones de arte en preparación',
            detalle:
              'Se conservarán las versiones y sus archivos para consulta. Sin esta función no se podrán preparar nuevas revisiones ni liberaciones. Revisá la continuidad de estos documentos antes de cambiar el plan.',
            cantidad: borradoresArte.length,
            permiteRetiradaConRevision: true,
            revision: createHash('sha256')
              .update(JSON.stringify(borradoresArte))
              .digest('hex'),
          },
        ]
      : []),
    ...(retiradas.has('aprobacion_arte')
      ? [
          {
            codigo: 'arte_produccion_bloqueada',
            funciones: ['aprobacion_arte'],
            titulo: 'Órdenes esperando arte liberado',
            detalle:
              'Hay controles documentales sin cumplir en trabajos abiertos. Liberá la revisión aprobada o resolvé el requisito antes de retirar la función. El cambio de plan nunca libera producción automáticamente.',
            cantidad: arte.filter((gate) => !gateDocumentoEstaCumplido(gate))
              .length,
          },
        ]
      : []),
    ...(retiradas.has('fidelizacion')
      ? [
          {
            codigo: 'puntos_saldos',
            funciones: ['fidelizacion'],
            titulo: 'Saldos de puntos conservados',
            detalle:
              'Los saldos y movimientos seguirán disponibles para consulta. Sin Fidelización no se podrán iniciar ganancias, canjes ni ajustes manuales. Si se vuelve a incluir, se recuperará la configuración guardada. Las correcciones de operaciones históricas mantienen su trazabilidad.',
            cantidad: puntos.length,
            revision: createHash('sha256')
              .update(JSON.stringify(puntos))
              .digest('hex'),
            permiteRetiradaConRevision: true,
          },
        ]
      : []),
    ...(retiradas.has('asignacion_automatica')
      ? [
          {
            codigo: 'personal_asignado',
            funciones: ['asignacion_automatica'],
            titulo: 'Trabajos con personal asignado',
            detalle:
              'Se conservarán las asignaciones actuales y los operarios podrán completar sus tareas. El reparto automático y la reasignación con simulación dejarán de actualizarse. Un supervisor conserva la ejecución manual desde el tablero; revisá especialmente los pasos con conflictos de personal.',
            cantidad: asignaciones.length,
            revision: createHash('sha256')
              .update(JSON.stringify(asignaciones))
              .digest('hex'),
            permiteRetiradaConRevision: true,
          },
        ]
      : []),
    ...(retiradas.has('fiscal_argentina')
      ? [
          {
            codigo: 'fiscal_pendiente',
            funciones: ['fiscal_argentina'],
            titulo: 'Comprobantes fiscales pendientes',
            detalle:
              'Hay envíos por verificar o comprobantes manuales sin CAE. Podrán consultarse o completarse desde el historial después del cambio. Los borradores no podrán iniciar nuevas emisiones sin la función ARCA. Revisá también los envíos anteriores sin registro de intento antes de volver a facturar.',
            cantidad: fiscales.length,
            revision: createHash('sha256')
              .update(JSON.stringify(fiscales))
              .digest('hex'),
            permiteRetiradaConRevision: true,
          },
        ]
      : []),
    ...(impresion
      ? [
          {
            codigo: 'impresion_sin_envio',
            funciones: ['impresion_directa', 'colas_impresion'],
            titulo: 'Trabajos de impresión sin enviar',
            detalle:
              'Estas solicitudes todavía no tienen un envío registrado. Al retirar impresión quedarán pendientes: acordá con los operarios su impresión manual desde los archivos de la OT. No se enviarán automáticamente ni se marcarán como impresas.',
            cantidad: impresion.sinEnvio,
            revision: impresion.revisionSinEnvio,
            permiteRetiradaConRevision: true,
          },
          {
            codigo: 'impresion_sin_verificar',
            funciones: ['impresion_directa', 'colas_impresion'],
            titulo: 'Salidas de impresión sin verificar',
            detalle:
              'Se cuenta el último envío de cada documento o página CAD, incluidos los que Windows informa como terminados. Acordá su revisión física. Podrán verificarse desde el Historial de impresión de cada OT después del cambio, sin reenviar archivos.',
            cantidad: impresion.sinVerificar,
            revision: impresion.revisionSinVerificar,
            permiteRetiradaConRevision: true,
          },
        ]
      : []),
  ];
}
