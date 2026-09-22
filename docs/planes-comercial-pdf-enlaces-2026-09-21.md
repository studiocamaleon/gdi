# Planes: circuito comercial, PDF y enlaces públicos

## Qué cambia

Las funciones C01–C06 ahora tienen controles operativos propios. Se consulta el evaluador de capacidades vigente de la empresa; los borradores del editor no otorgan derechos ni modifican las suscripciones existentes.

| Función retirada | Nuevas operaciones | Continuidad |
| --- | --- | --- |
| Cotizador | Impide cálculo, recotización, persistencia y entrada a la cola. El worker vuelve a pasar por el motor protegido. | Consulta de cotizaciones y órdenes guardadas. |
| Presupuestos | Impide emisión, configuración y primera salida de un borrador, incluida aprobación interna que lo envía. | Consulta y registro de la respuesta del cliente sobre presupuestos emitidos. Convertirlos exige la capacidad de crear órdenes. |
| Aprobación pública | Impide emitir o revivir enlaces; emitir un presupuesto sin esta función no genera token. | Los tokens vigentes mantienen consulta y decisión pública con las mismas reglas de vencimiento y revocación. Se puede registrar la decisión por otro canal. |
| PDF | Impide render nuevo, reintentos y registro en la cola. La generación automática de presupuesto, cobro o factura es opcional. | Archivos existentes descargables. Se mantiene el documento HTML del recibo y del comprobante. |
| Órdenes | Impide alta, emisión de borradores y agregar, editar o quitar productos, incluyendo endpoints alternativos. | Lectura, actualización operativa de datos permitidos por estado, producción, cobro, cancelación y entrega de órdenes emitidas. Repetir la clave idempotente de un alta ya completada devuelve la misma OT. |
| Seguimiento | Impide crear enlaces nuevos, también el alta diferida al abrir una OT antigua. | Los enlaces ya compartidos siguen sujetos a caducidad y revocación. No se reactiva seguimiento de órdenes canceladas. |

## Presupuesto sin complementos

Se puede emitir un presupuesto con C02 habilitado y C03/C04 excluidos. Se guarda su número, importes, fechas y estado sin crear un enlace ni generar un PDF. La ficha permite registrar aprobación o rechazo por otro canal; no indica que debe compartirse un enlace inexistente. Los avisos que requieren un token no se generan cuando no lo hay.

Los permisos del usuario, restricciones de suscripción, pertenencia a empresa y transiciones de estado siguen siendo controles adicionales. Tener un plan no concede permisos administrativos.

## PDF y trabajos pendientes

- `DocumentosPdfService` verifica capacidad antes de registrar y reintentar.
- El worker consulta el plan al tomar el trabajo, antes de renderizar o subir el archivo. Si ya no está disponible, lo deja en `FALLIDO` con `CAPACIDAD_NO_DISPONIBLE`, sin confundirlo con falta de almacenamiento. Puede reintentarse al habilitar la función.
- No se garantiza cancelar un render que ya comenzó antes del cambio; los cambios de contrato todavía no están publicados ni tienen un protocolo de aplicación concurrente.
- La vista consulta si puede ofrecer una descarga: función incluida o archivo guardado. Una consulta de disponibilidad no genera PDF.
- Las rutas de generación de recibos, comprobantes y estado de cuenta también están controladas. Cobrar o emitir un comprobante no exige generar su PDF.
- El piloto con caché comprueba capacidad antes de reutilizar su resultado en memoria. Esa caché no sustituye el archivo histórico de la empresa.

## QR interno y seguimiento

El escaneo interno de entrega identifica la OT por su número. No depende del token de seguimiento público. Se conserva para poder entregar trabajos existentes y usar etiquetas ya impresas tras un cambio de plan.

La generación de nuevas etiquetas descargables tiene su propia capacidad I06. Ese control se completó en el [bloque de etiquetas y operación](planes-stock-equipos-cuentas-etiquetas-2026-09-21.md); falta cerrar la presentación comercial y asignación de contratos reales. Por eso C06 continúa marcado como control parcial.

## Verificación

- Pruebas del evaluador real con capacidades excluidas: cálculo y cola, emisión independiente de enlace/PDF, alta idempotente, endpoints alternativos de productos, continuidad de enlaces, descargas guardadas, reintentos y worker.
- Recorrido con PostgreSQL de prueba: cotizar y emitir sin seguimiento/PDF; retirar cotización, presupuestos y órdenes del contrato simulado; completar producción, cobrar y entregar por escaneo.
- Regresiones del circuito de presupuestos, aprobación, resolución pública, PDF durable, enlaces públicos y emisión de órdenes.
- Interfaz: botones según capacidad, respuesta comercial sin enlace, acceso al PDF histórico, acciones de emisión y conversión.

Resultado: 324 pruebas de API en 23 suites y 42 pruebas de interfaz en cuatro suites, todas aprobadas. La base utilizada fue `gdi_saas_test`; no se cambiaron datos comerciales de desarrollo.

## Pendiente

1. Cerrar etiquetas descargables, existencias/equipos y cuentas por cobrar; contrastar los controles restantes del catálogo.
2. Publicar versiones inmutables y asignarlas a empresas con diagnóstico, auditoría y una política de cambios concurrentes.
3. Repetir las combinaciones con contratos realmente asignados, incluidas degradaciones y operaciones abiertas. Las pruebas de este bloque usan contratos simulados sobre servicios reales.
4. Resolver precios, adicionales y vinculación comercial/Paddle cuando se definan esas condiciones.

No se publicaron planes, migraron suscripciones ni modificaron precios en este incremento.
