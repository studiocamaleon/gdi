# Altas, búsquedas comerciales y detalle de facturación

Este lote depende del PR #39 (`codex/borradores-cargos-orden`), que contiene el autorregistro y los permisos vigentes. No incorpora ni sustituye los PR #40 (versiones), #41 (filtros de facturación) o #42 (salida del presupuesto). Al preparar una publicación conjunta hay que integrar y comprobar el conjunto. No requiere migraciones ni cambios de datos de los tenants.

## Clientes

El formulario público crea una solicitud pendiente y un aviso interno en la misma transacción. Lo reciben los usuarios activos con membresía activa que pueden `crm.aprobar_altas`, incluido el administrador. El aviso lleva a CRM → Clientes → Solicitudes y conserva el registro compartido de lectura existente. Un reintento del mismo documento pendiente no duplica avisos; el campo trampa no genera solicitudes ni notificaciones. El alta sigue requiriendo aprobación.

La búsqueda normaliza acentos y mayúsculas tanto en PostgreSQL, antes de paginar, como en el selector de la OT. El mismo criterio se aplica al buscar clientes en órdenes, presupuestos, campañas, operación diaria, simulación, facturación, comprobantes, deudores, valores e Inbox y al historial de mensajes. Los selectores compartidos de facturas, campañas y precios especiales usan la misma normalización. Se conserva la escritura original de los nombres. Se mantienen los filtros de empresa y de clientes activos. No necesita extensiones nuevas en PostgreSQL.

## Productos

El selector comercial ordena por cantidad de órdenes emitidas que incluyen cada producto, dentro de la misma empresa. Cada OT cuenta una sola vez por producto, aunque tenga varias líneas o miles de unidades. Se excluyen borradores, canceladas y componentes internos. La identidad procede del snapshot de cotización enlazado al ítem; las líneas manuales sin producto vinculado no se atribuyen por coincidencia de nombre.

La frecuencia se aplica al catálogo completo del selector, antes de buscar. Empates y productos sin uso quedan por nombre y luego identificador. No se consulta el historial comercial de otras empresas.

## Facturación

Una OT completa propone **Productos y cargos**. Las facturas agrupadas proponen **Resumen por OT**, con selector para elegir el detalle completo antes de confirmar. El detalle agrupado identifica la OT en cada renglón. Los cargos de la orden se incluyen una sola vez, por su monto completo; los componentes internos no se facturan por separado.

Se usan los importes y descuentos guardados, no los precios actuales del catálogo. Se conservan alícuotas compatibles con el snapshot y los importes originales. Un resumen con varias alícuotas usa un renglón por alícuota para no cambiar el IVA. El redondeo fiscal global se concilia con el importe pactado sin redondear anticipadamente cada precio unitario. Si los productos y cargos no cierran con el total, se solicita revisar la orden antes de emitir.

Los importes parciales salen identificados como facturación parcial, sin afirmar que se facturaron nuevamente todas las cantidades. Las órdenes históricas sin líneas conservan el concepto general. El detalle queda congelado en el comprobante y se utiliza tanto en su vista como en su PDF.

## Validación

Pruebas con empresas ficticias en la base local de test: autorregistro por HTTP, destinatarios y deduplicación, aislamiento y paginación sin tildes, frecuencia por producto, facturas individuales/agrupadas, cargos, descuentos, componentes, cantidades decimales, permisos fiscales y registro de lecturas. Pruebas de interfaz sobre los selectores reales y los datos enviados al confirmar. No se contacta ARCA ni se emiten comprobantes fiscales reales.
