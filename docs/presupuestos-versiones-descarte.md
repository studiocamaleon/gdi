# Borradores descartados y versiones de presupuesto

El mismo presupuesto comercial conserva su número y permite preparar otra propuesta, por ejemplo de 500 a 300 tarjetas. Cada versión tiene sus propios productos, configuración de cotización, importes, cargos, PDF, enlace público y registro de envíos. No se sobrescribe lo que recibió el cliente.

## Reglas

- Sólo se versiona la versión vigente sin aprobación del cliente, sin OT vinculada y sin aprobación interna pendiente. Un aprobado o convertido se conserva sin modificaciones.
- `Editar · nueva versión` reabre la configuración. El guardado recotiza con la configuración vigente y conserva el cliente. Se puede guardar como borrador o volver a emitir y elegir el canal de envío.
- Guardar una nueva versión deja la anterior en el historial y deshabilita sus decisiones y reenvíos. Su enlace sigue mostrando sus propios importes, con un aviso de versión anterior. No redirige automáticamente a otra propuesta.
- La nueva emisión aplica nuevamente los controles de descuentos y aprobación comercial. La edición no permite modificar snapshots de documentos formales mediante el endpoint de recotización.
- Si el cliente aprueba o alguien modifica el presupuesto durante la edición, guardar falla con un conflicto. Dos editores no pueden generar simultáneamente dos versiones vigentes.
- Los cupones y los canjes se revalidan. Se consideran las reservas de la propuesta anterior, que se liberan al reemplazarla. Nunca se transfieren compromisos de otra empresa, cliente u OT.
- Los avisos pendientes de la versión reemplazada se descartan. Un envío ya autorizado y en curso no se declara cancelado: puede haber salido antes del cambio.
- El listado, las campañas, el embudo y los indicadores comerciales muestran la versión vigente para evitar contar varias veces el mismo presupuesto. El detalle conserva el historial completo.

## Descartar

`Descartar borrador` pide confirmación y deja autor y fecha. El registro se conserva para auditoría; no se elimina físicamente. No permite cancelar por accidente una OT que fue emitida mientras estaba abierta la confirmación.

El borrador de OT pasa a cancelada sin consumir un número comercial. El presupuesto pasa a descartado y se retira del listado activo; se puede consultar en el filtro Descartados. Descartar una versión nueva no reactiva automáticamente un enlace anterior.

Las acciones requieren gestionar Órdenes o Presupuestos, respectivamente. El permiso de lectura por sí solo no las habilita.

## Persistencia y comprobación

La migración `20261008150000_presupuestos_versiones` inicia los documentos existentes como versión 1 vigente. Permite repetir el número sólo con otro ordinal e impide dos versiones vigentes de un mismo número y empresa mediante un índice único parcial.

Probado en la base local exclusiva de tests, con empresas y personas ficticias, sin seeds ni reset. Los transportes externos están simulados. Las pruebas cubren edición 500 → 300, historial, aprobación durante edición, concurrencia, descarte, permisos, aislamiento, snapshots inmutables y avisos obsoletos. La interfaz también se comprueba con interacción en DOM y sin costos visibles para un comercial restringido.

Este lote depende del PR #39 de borradores y cargos. No aplica migraciones a desarrollo habitual, staging ni producción. La compilación completa se verifica en CI remoto; el ensayo en staging corresponde al siguiente despliegue del lote.
