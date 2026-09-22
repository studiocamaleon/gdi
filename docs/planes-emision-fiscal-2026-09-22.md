# Planes: emisión fiscal y recuperación de resultados

Fecha: 22/09/2026. Continúa [integración y configuración ARCA](planes-integracion-arca-2026-09-22.md).

## Qué cambia

Crear borradores y emitir facturas, notas o comprobantes de OT/lotes exige `fiscal_argentina` del contrato vigente. Las nuevas notas también requieren la función: no se concede una emisión nueva por referenciar una factura histórica. Las notas de crédito requieren el permiso personal de anulación; el plan no sustituye los permisos.

La admisión y la asignación de número se confirman en transacciones separadas bajo el lock de empresa. Entre ellas se consulta el último número de ARCA, sin mantener una transacción abierta esperando la red. Antes de asignar el número se vuelven a comprobar contrato, país, acceso, contratación pendiente, configuración fiscal, punto de venta, conexión y compromisos de la OT. El proveedor manual debe estar elegido explícitamente; una integración no disponible no cae silenciosamente en manual. La emisión automática exige un punto de venta de Web Services.

La tabla `ComprobanteEmision` conserva solicitud, emisor, proveedor, ambiente, CUIT operativo, serie, número, actor, fechas y respuesta. Una restricción única impide dos intentos activos de la misma serie, también entre empresas que compartan CUIT de homologación. Un segundo clic sobre el mismo comprobante consulta su estado local y no ejecuta otro envío.

## Resultado incierto

1. Se guarda la admisión antes de llamar al proveedor.
2. Antes del POST se persisten el número y la solicitud definitiva.
3. Un timeout, una respuesta incompleta o un error al aplicar la contabilidad deja el comprobante **Por verificar**. Se conserva la respuesta disponible y la serie sigue reservada.
4. **Consultar resultado** usa `FECompConsultar` con el ambiente, CUIT, punto de venta, tipo y número originales. Se contrastan receptor, fecha, número, importe, moneda y cotización contra la solicitud guardada. Cambiar el entorno no redirige la consulta.
5. Confirmar el CAE y aplicar sus efectos a la OT/contabilidad ocurre en una misma transacción. Las consultas repetidas no duplican esos efectos.
6. Que una consulta no encuentre el comprobante no prueba que nunca se envió: no libera automáticamente la serie ni vuelve a solicitar el CAE.

Un rechazo fiscal explícito se registra y libera la serie; el número no autorizado permanece en el intento, sin ocupar el número del próximo comprobante. Una preparación que nunca alcanzó el estado de envío puede cerrarse por consulta tras dos minutos. Su cierre comprueba el estado actual para no interferir con un envío que acaba de avanzar.

La coordinación cubre instancias de Grafo. No coordina otro software que emita fuera de Grafo con el mismo punto de venta: en producción se necesita un punto de venta destinado a esta integración.

## Continuidad y presentación

- Retirar F08 impide crear o emitir nuevos documentos, pero conserva el historial y la consulta de un intento ya admitido, con acceso operativo y permiso personal.
- Un resultado de una emisión admitida se guarda aunque la suscripción cambie o se dé de baja mientras responde ARCA. No constituye una nueva emisión.
- Un comprobante manual emitido sin CAE puede completarse al retirar F08. Un CAE registrado no puede reemplazarse por otro.
- Los datos fiscales del emisor y el punto de venta se guardan antes del envío. El documento usa esa identidad guardada, incluso si después se cambia la configuración. Los documentos anteriores sin ese snapshot mantienen su compatibilidad y PDF ya congelado.
- Las notas conservan letra, receptor y moneda de su factura original. La admisión valida el emisor y evita acreditar dos veces una factura, incluyendo notas todavía por verificar.
- Las facturas en proceso reservan el monto de sus OT para impedir que otra serie facture el mismo saldo al mismo tiempo.
- El detalle muestra **Enviando** o **Por verificar** y permite consultar. La lista incluye ambos filtros. Los accesos de nueva emisión y notas respetan F08; retirar ARCA no retira las acciones propias de cobros.
- El diagnóstico de cambio de plan incluye comprobantes fiscales pendientes, con huella de las filas para invalidar una revisión desactualizada. Permite retirar la función tras aceptar la continuidad indicada.

## Datos anteriores y límites

Los borradores anteriores que ya tienen número, pero no registro persistido del intento, se muestran como pendientes de revisión. No se reenvían, bloquean nuevos envíos de su serie y se computan como importes pendientes de sus OT/notas. No se inventa su emisor ni su ambiente original. Resolver esos casos requiere contrastar evidencia fiscal anterior; este incremento no incluye una herramienta de resolución manual de esos registros ni de envíos inciertos sin evidencia concluyente.

La restricción histórica de número por empresa/punto/tipo/letra permanece. Reutilizar un número al cambiar ambiente o identidad fiscal puede generar un conflicto local antes del POST: no se sobrescriben documentos anteriores ni se certifica aquí una migración entre emisores/ambientes.

No se realizaron emisiones externas en esta validación. El transporte fiscal fue simulado y las pruebas usaron `gdi_saas_test`. Falta la prueba específica de homologación de este circuito nuevo y su revisión visual en navegador; esto no es una certificación de producción. El almacenamiento compartido de tickets de acceso del proveedor antes de escalar a múltiples procesos sigue siendo un pendiente del proveedor.

## Evidencia

- 21 escenarios de integración con versiones publicadas y datos reales de PostgreSQL: tres planes, retirada de función, checkout pendiente, configuración modificada durante preparación, timeout, recuperación, baja durante envío, respuesta vacía, entorno distinto, recuperación tras fallo contable, rechazo, permisos, CAE manual, topes de OT/notas, diagnóstico y borrador numerado anterior.
- Tres escenarios con conexiones PostgreSQL independientes: competencia por la misma serie, competencia por el saldo de una OT desde dos puntos de venta y avance simultáneo de series independientes sin transacción retenida durante la red.
- 19 pruebas de interpretación de respuestas del proveedor, incluyendo diferencias en datos consultados y código de A con retención.
- La corrida conjunta de regresión aprobó 110 pruebas en ocho suites (antes de añadir el caso del borrador anterior). Después del ajuste, las dos suites focales volvieron a pasar: 24 pruebas. La unión es de 111 casos de API.
- 27 pruebas web en cuatro archivos, incluyendo seis nuevas sobre consulta, permisos, creación y continuidad sin F08. Prueban comportamiento del DOM, no el acabado visual.
- TypeScript de aplicación API y web, lint focal, control de CSS y `git diff --check`.
- Migración `20260922040000_emisiones_fiscales` aplicada en pruebas y desarrollo local; API local reiniciada.

Referencias técnicas primarias: [manual WSFEv1 de ARCA](https://www.afip.gov.ar/fe/documentos/manual_desarrollador_COMPG_v1.pdf) y [FECompConsultar](https://servicios1.afip.gov.ar/wsfev1/service.asmx?op=FECompConsultar). No se alteraron precios, ofertas publicadas ni suscripciones comerciales.
