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

Preparación para el próximo despliegue agrupado: aplicar `20260928180000_inbox_equipo` y comprobar permisos del usuario de base sobre `InboxEventoInterno`, además de las tablas existentes. En local y tests son **297 migraciones**, sin seed ni reset. Los flags de Meta y cron reales siguen apagados.

Quedan para bloques posteriores: firma del operador visible al cliente y configurable por empresa, reportes de rendimiento y llamadas de WhatsApp. Los registros de autoría y transferencias de este bloque sirven de base para los reportes.

## Verificación local del 28 de septiembre de 2026

- 233 pruebas de API: envíos, permisos, recepción, adjuntos, actualización en vivo y trabajo en equipo. Incluyen respuestas simultáneas, transferencias en conflicto y notas privadas sin envío a Meta.
- 73 pruebas de interfaz: filtros, autores, borradores, `/nota`, navegación y permisos. El comando se intercepta antes del envío, también cuando la ventana de WhatsApp está cerrada.
- Tipos de API e interfaz, lint de los archivos modificados, esquema Prisma y control de estilos verificados.
- En Chrome: asignación desde la lista sin modal, registro interno del cambio y entrada al editor con `/nota` + Enter. Demo ficticia, sin mensajes reales.

Esta validación no sustituye la prueba compartida en staging cuando se despliegue el conjunto.
