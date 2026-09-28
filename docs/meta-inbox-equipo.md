# Equipo y responsables en Grafo Inbox

## Qué puede hacer el equipo

- **Responsable:** una sola persona a cargo del seguimiento. No tiene exclusividad para responder.
- **Sin asignar:** estado inicial. La primera respuesta de un integrante aceptada por Meta asigna la conversación a esa persona. Un envío rechazado o todavía incierto no la asigna.
- **Autor:** cada respuesta conserva quién la envió, aunque otra persona sea responsable. Incluye texto, plantillas y archivos. El nombre aparece sólo dentro de Grafo.
- **Transferencia:** el botón del responsable en la cabecera despliega la lista; al elegir un integrante habilitado se transfiere directamente, o se deja sin asignar. Se registra quién hizo el cambio, de quién pasó y a quién. Si dos personas transfieren a la vez, la segunda debe revisar el cambio antes de confirmar.
- **Nota interna:** se activa escribiendo `/nota` y Enter (o un espacio), sin selectores permanentes. El editor identifica claramente el modo privado y permite volver a WhatsApp con la X, conservando el borrador de la nota. También está disponible fuera de la ventana de 24 horas. No usa el servicio de envío de WhatsApp, no cambia el responsable y no cuenta como el último mensaje del cliente.

## Qué significa cada filtro

| Filtro | Conversaciones incluidas |
| --- | --- |
| Todas | Todas las del canal al que tenés acceso. |
| Mías | Sos su responsable actual. |
| Sin asignar | No tienen responsable. |
| Participé | Enviaste un mensaje desde Grafo o escribiste una nota interna, aunque otra persona esté a cargo. |

La búsqueda se combina con el filtro. Las conversaciones siguen ordenadas por el último mensaje de WhatsApp, no por notas ni transferencias. Si el chat abierto deja de cumplir un filtro, desaparece de la lista pero puede seguir abierto para terminar de trabajar.

## Acceso de los operadores

En los permisos del rol aparece **Atender Grafo Inbox** (`inbox.atender`). Permite leer, responder, escribir notas y cambiar responsables dentro de su empresa. No habilita la configuración de Meta, los datos fiscales ni otras secciones de Grafo. El contexto de clientes, órdenes y documentos sigue respetando sus permisos propios.

Los administradores que ya podían usar el Inbox conservan su acceso. No se agregan permisos automáticamente a vendedores u otros roles existentes: cada empresa elige a quién habilitar. Sólo se puede asignar a usuarios activos de esa empresa con permiso de atención. Si luego se les quita el acceso, el responsable se conserva con una indicación para transferirlo; no se pierde su historial.

## Cómo se conserva el historial

Los mensajes guardan la identidad del autor y su nombre en el momento del envío. Las transferencias y notas guardan sus propios autores y fechas. Dar de baja a un integrante no borra estas referencias. Los mensajes importados del celular o enviados por fuera de Grafo no inventan un operador: se indica su origen o que no se pudo identificar al autor.

La migración recupera autores de envíos anteriores cuando Grafo ya tenía el usuario que los realizó. No asigna responsables retroactivamente.

Los cambios avisan al mismo sistema de actualización en vivo del Inbox. Cada navegador vuelve a consultar su vista, con su filtro y permisos vigentes. Si se revoca el acceso, se cierra la conexión de eventos.

## Alcance de este bloque

Desarrollado y validado en local. Demo interactiva: `http://localhost:3000/dev/diseno/inbox/conversaciones`. Alex es el operador de la demo; Bruno comienza a cargo de Marina. La demo conserva cambios en memoria mientras está abierta, sin WhatsApp ni base real.

Preparación para el próximo despliegue agrupado: aplicar `20260928180000_inbox_equipo` y comprobar permisos del usuario de base sobre `InboxEventoInterno`, además de las tablas existentes. En local y tests son **298 migraciones**, sin seed ni reset. Los flags de Meta y cron reales siguen apagados.

Quedan para bloques posteriores: firma del operador visible al cliente y configurable por empresa, reportes de rendimiento y llamadas de WhatsApp. Los registros de autoría y transferencias de este bloque sirven de base para los reportes.

## Verificación local del 28 de septiembre de 2026

- 233 pruebas de API: envíos, permisos, recepción, adjuntos, actualización en vivo y trabajo en equipo. Incluyen respuestas simultáneas, transferencias en conflicto y notas privadas sin envío a Meta.
- 73 pruebas de interfaz: filtros, autores, borradores, `/nota`, navegación y permisos. El comando se intercepta antes del envío, también cuando la ventana de WhatsApp está cerrada.
- Tipos de API e interfaz, lint de los archivos modificados, esquema Prisma y control de estilos verificados.
- En Chrome: asignación desde la lista sin modal, registro interno del cambio y entrada al editor con `/nota` + Enter. Demo ficticia, sin mensajes reales.

Esta validación no sustituye la prueba compartida en staging cuando se despliegue el conjunto.


## Lectura compartida, estados y filtros — 28/09/2026

**La conversación es compartida por todo el equipo.** Cuando un integrante ve los mensajes nuevos, se marca leída para todos. El navegador lo confirma sólo con la pestaña visible, enfocada y al final del chat; no por una consulta de fondo ni mientras está leyendo mensajes antiguos. Una lectura atrasada no tapa un mensaje que llegó después. Esto es un estado interno de Grafo: no envía confirmaciones de lectura a WhatsApp.

- **Activa:** hay una atención en curso.
- **Resuelta:** un integrante dio por terminada esa atención. Se puede reabrir manualmente. Un mensaje entrante nuevo, posterior al cierre, también la reabre y conserva el responsable. Importaciones de historial, mensajes atrasados y webhooks repetidos no la reabren.
- **Sin leer:** el equipo todavía no vio todas las entradas recibidas.
- **Sin responder:** el último mensaje de WhatsApp es del cliente, independientemente de las notas o transferencias. Leer no equivale a responder. Una conversación resuelta puede cumplir este filtro si se cerró sin una respuesta posterior.

Los estados no se mezclan con la asignación o la presencia. Por ahora se usan Activa y Resuelta; un eventual En espera necesitaría definir motivo, fecha de seguimiento y reglas de reapertura, para no transformarse en otro lugar donde olvidar consultas.

Los filtros se combinan entre categorías (AND): responsable + lectura + respuesta + estado + participación + búsqueda. Estado permite una sola opción: Todos, Activas o Resueltas. Responsable también permite una sola opción. La API rechaza múltiples estados en una consulta. Sin leer, Sin responder y Participé son independientes y combinables: leer no implica responder, y participar no implica ser responsable. Ejemplo: **Mías + Activas + Sin responder**. Participé ahora es independiente y se puede combinar también con Mías. El panel comienza colapsado y sin filtros. Al expandirlo, tres filas de segmentos del mismo estilo permiten preparar la combinación; sólo Aplicar filtros actualiza la lista y colapsa el panel. Cerrarlo sin aplicar conserva la consulta anterior. El resumen muestra la cantidad de criterios activos. Una × con etiqueta Limpiar filtros permite volver a toda la bandeja sin abrir el panel; Restablecer dentro del panel sólo prepara un borrador vacío para aplicar. La consulta filtra en la base antes de paginar; sus cursores quedan ligados a la combinación.

La migración aditiva `20260928200000_inbox_estados_lectura` agrega estado, revisión de entradas y lectura compartida a la conversación. El historial existente se considera pendiente hasta que lo vea alguien del equipo. Los cambios de estado tienen autor, fecha e historial privado; la reapertura por mensaje identifica al cliente sin inventar un operador. Las acciones avisan por el sistema de actualización en vivo existente.

## Presencia del equipo

El selector muestra iconos verdes para conectados y rojos para desconectados, además de una etiqueta textual. **Por ahora es una simulación exclusiva de la demo**; la API real no informa presencia y se muestra neutral como “Presencia aún no disponible”, sin inventar conexión o desconexión. No se confunde conectado con tener permiso: un integrante desconectado puede seguir a cargo y recibir una transferencia.

La implementación real pendiente deberá usar una señal periódica autenticada de Grafo y Redis, por empresa, usuario y pestaña/sesión, con vencimiento corto. Se considerará conectado si queda al menos una sesión autorizada con señal vigente. Cerrar una pestaña no desconectará otras, y perder Internet o cerrar inesperadamente vencerá la señal. Una sesión revocada o sin permisos deberá dejar de contar inmediatamente. Redis caído se mostrará como estado desconocido. No se deducirá presencia del último inicio de sesión, de la asignación ni de los checks de Meta.

Validación de este bloque: integración con dos operadores para lectura compartida, lecturas atrasadas, respuestas, filtros combinados, idempotencia, cierre en conflicto y reapertura; navegador para combinaciones y menú de equipo. Sólo desarrollo local y tests, con Meta y cron reales apagados; pendiente ensayo compartido en staging al desplegar el lote.
