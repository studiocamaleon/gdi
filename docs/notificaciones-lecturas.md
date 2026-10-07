# Lecturas de notificaciones internas

Implementación local del 07/10/2026 en `codex/notificaciones-lecturas`. Depende de la base actual de la aplicación en el PR #27 (`97e96732e`), todavía sin integrar. Este cambio no incluye los PR #28 y #29 ni realiza despliegues.

## Comportamiento

Cada aviso permite **Marcar leído** sin navegar. Abrir el contenido mantiene el comportamiento anterior: registra la lectura y abre su enlace. Abrir la campana por sí solo no registra lecturas. **Marcar todas** firma únicamente los avisos pendientes del destinatario actual.

**Visto por…** muestra los lectores a los demás destinatarios del mismo aviso. El detalle incluye nombre congelado, fecha completa y hora en la zona de la empresa. El pendiente sigue siendo individual: la lectura de un compañero no borra el aviso pendiente de otro.

La primera lectura no se sobrescribe al repetir la operación. Se conserva ante cambios de nombre, desactivación o borrado del lector y de su notificación personal. Las acciones realizadas por soporte o mediante un asistente quedan identificadas como tales. La eliminación del evento o de toda la empresa elimina también su registro de lecturas.

Los avisos ya leídos antes de esta versión conservan su fecha, pero no reciben una firma retroactiva: la aplicación anterior no guardaba quién actuó realmente.

## Persistencia y actualización

La migración aditiva `20261007190000_notificaciones_lecturas` crea `EventoSistemaLectura`. Debe aplicarse antes de desplegar la API y regenerar su cliente Prisma. No requiere seed, reset ni modificación de los avisos existentes. La web admite temporalmente respuestas anteriores sin el nuevo campo.

El leído, su firma y el evento de actualización se guardan en una transacción. La actualización condicional de pendientes impide duplicar firmas en solicitudes simultáneas. El canal existente comunica una invalidación sin nombres ni identificadores de lectores; las bandejas consultan después sólo sus avisos autorizados. No se crea una nueva notificación por cada lectura.

El contador y el historial se refrescan desde el servidor tras marcar, reconectar o recibir cambios. Una respuesta atrasada no reemplaza un estado más reciente. Los errores dejan disponible el reintento y no inventan una confirmación visual.

## Verificación local

- Migración aplicada únicamente a PostgreSQL local `gdi_saas_test`, sin reset ni seed.
- 38 pruebas API aprobadas: eventos, registros persistentes, presupuesto aprobado/rechazado y seguridad del canal SSE con revocación de permisos.
- 7 pruebas web aprobadas: botón individual, reapertura, actualización del equipo/reconexión, marcado masivo con nuevos avisos simultáneos, errores/reintentos, respuestas atrasadas y lecturas históricas.
- Integración PostgreSQL real: concurrencia, exclusión de otro destinatario/empresa y archivados, conservación tras borrar el lector, identificación de soporte/asistente y rollback ante fallo de la firma.
- Tipos de toda la API y de los cinco archivos TypeScript del frontend modificados, sin errores.
- Revisión visual en Chrome con el componente real y datos ficticios: lectura individual y detalle de lectores. La muestra temporal se retiró al terminar.

Pendiente antes de publicar: aplicar la migración y comprobar el recorrido con dos sesiones en staging; ejecutar la compilación completa de producción en remoto, conforme al límite de memoria de desarrollo.
