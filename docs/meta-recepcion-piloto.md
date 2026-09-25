# Segundo bloque de WhatsApp: recepción visible

25/09/2026. Rama `codex/meta-recepcion-piloto`, basada en `codex/meta-cloud-base` (PR #4). Trabajo local; no activa cuentas de clientes ni modifica staging.

## Para qué sirve

El primer bloque demostró que Grafo puede enviar una plantilla y recibir la confirmación de entrega. Este bloque permite leer en Configuración → Integraciones los últimos 50 mensajes nuevos recibidos del contacto autorizado para el piloto.

La vista muestra nombre, fecha y texto. Imágenes, audios y otros tipos aparecen identificados, sin descargar archivos. Es una prueba de recepción: no permite responder, asignar conversaciones, marcar mensajes como leídos ni conectar nuevos números.

## Cómo funciona

1. Meta llama al webhook existente. Se exige su firma sobre el cuerpo original.
2. Grafo conserva el evento crudo y comprueba empresa, cuenta de WhatsApp, número receptor y contacto remitente.
3. Si corresponde exactamente al piloto habilitado, guarda una representación del mensaje en `MensajeWhatsappRecibido`. La clave cuenta + número + `wamid` evita repetirlo aunque un reenvío tenga otra metadata.
4. El guardado crudo y la representación se confirman juntos. Si falla la base, se devuelve error para que Meta reintente. Los mensajes válidos no se pierden por confirmar prematuramente.
5. Sólo el administrador con permiso de gestionar configuración puede consultar la vista; se excluye la impersonación y se exige que el plan incluya WhatsApp. La consulta vuelve a filtrar empresa, cuenta, número y contacto y no devuelve payloads crudos, IDs de Meta ni secretos.

El orden visible usa la fecha del mensaje, no la llegada del webhook. React presenta el texto como texto, sin interpretar HTML. Una consulta fallida retira la conversación visible hasta recuperar el acceso.

La recepción exige `META_WHATSAPP_RECEPCION_PILOT_ENABLED=true`, además de la configuración existente del piloto. Está apagada por defecto. No crea nuevos secretos. El vencimiento del token impide futuros envíos a Meta, pero no se utiliza ese token para autenticar webhooks: se conserva la validación por firma.

## Límites deliberados

- Únicamente contacto, cuenta y empresa del piloto; no habilita una bandeja comercial general.
- Los eventos desconocidos, ambiguos, de otro contacto, de historial o de mensajes enviados desde la app del celular permanecen crudos y sin marcar como procesados por este bloque.
- Activar el interruptor no reprocesa mensajes anteriores. No hay importación del historial ni recuperación automática de los eventos sin empresa.
- No se editan mensajes ya representados a partir de redeliveries. El soporte de ediciones/revocaciones requiere un procesador explícito.
- No hay descargas hacia R2, llamadas nuevas a Meta, respuestas automáticas ni trabajos en Redis.
- La conservación y eliminación de datos, el procesamiento asíncrono con métricas y el backfill seguro siguen siendo requisitos antes de habilitar recepción de clientes. No introducir una purga masiva incidentalmente.

## Validación del código

- 60 pruebas API aprobadas: 41 de recepción, permisos e impersonación, firma, desafíos y persistencia del webhook; 19 de regresión del envío y acceso privado de staging.
- 4 pruebas de interfaz: texto no interpretado como HTML, adjuntos, vacío, actualización y pérdida/recuperación de acceso.
- TypeScript del frontend aprobado.
- Base PostgreSQL local nueva y desechable con las 284 migraciones, sin seed y sin modificar la base de desarrollo. El ensayo de recepción comprueba concurrencia, duplicados con metadata distinta, aislamiento, orden, límite, asociación ambigua, interruptor apagado y rollback de toda la transacción si falla la proyección.
- Script reproducible: `apps/api/scripts/deploy/verify-meta-recepcion.cjs`. Sólo admite una base terminada en `_test` cuyo nombre coincida con `DEPLOY_DATABASE_NAME`; elimina exclusivamente sus filas sintéticas.
- Revisión visual local de la tarjeta real con datos ficticios: nombres, fechas, Unicode, texto multilínea, lista desplazable, adjuntos identificados y botón Actualizar. El servidor temporal no usa credenciales ni llama a Meta; no reemplaza la prueba integrada.
- CI de contenedores incorpora ese ensayo junto al del envío. Compilación remota pendiente de completar en GitHub.

No confundir los eventos sintéticos de estos ensayos con un mensaje real de WhatsApp. La prueba real de recepción integrada sigue pendiente de despliegue del lote.

## Próximo despliegue agrupado

1. Revisar el PR y exigir CI completo de API/web con tipos y ambos ensayos Meta.
2. Aplicar únicamente `20260925223000_meta_recepcion_piloto` en Neon con el migrador. Verificar permisos del rol de ejecución para la nueva tabla. No seed, reset ni cambios de planes.
3. Desplegar API, web y workers desde el mismo commit, según `deploy/staging/README.md`.
4. Activar el interruptor de recepción sólo en la API. Conservar la protección de staging y la suscripción `messages` existente.
5. El contacto autorizado envía un texto inocuo al número oficial de prueba de Meta. Actualizar la vista de Grafo y verificar que aparezca una vez. Todavía no enviar respuestas desde Grafo.
6. Registrar commit, imágenes, migración y evidencia real. Apagar el interruptor oculta la vista y suspende esta representación; conserva los datos y el receptor crudo existente.

## Orden para la conexión de cada empresa

La consulta oficial del 25/09 confirmó que debemos preparar **Embedded Signup v4**. La implementación exige HTTPS y configuración de Facebook Login for Business; el código de autorización se canjea inmediatamente en el servidor. No asumir un token permanente: inspeccionar y guardar su vencimiento real. [Implementación oficial](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation).

Para conservar WhatsApp Business en el celular se usa el flujo de coexistencia. Meta indica omitir el registro del número y preparar los eventos de contactos, historial y mensajes enviados desde la app. La sincronización inicial tiene una ventana de 24 horas y no admite repetir libremente la solicitud; por eso no ofreceremos aún el botón a clientes. [Coexistencia](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users).

El siguiente grupo debe completar, en este orden:

1. Asociaciones únicas de cuenta/número con empresa y sesiones de autorización vinculadas al usuario, con expiración y protección contra reutilización. Validar los activos con Meta antes de confiar en los IDs del navegador.
2. Canje y almacenamiento cifrado del token por empresa, recuperación de pasos incompletos y desconexión explícita. No tocar WATI ni activar notificaciones automáticamente.
3. Procesadores de `account_update`, `history`, `smb_app_state_sync` y `smb_message_echoes`, con deduplicación, recuperación, límites, monitoreo y conservación acordada. El historial no debe abrir la ventana de atención como si fuera un mensaje nuevo.
4. Interfaz de autorización v4 y configuración de dominios/redirects en Meta. Distinguir autorización recibida, suscripción y sincronización completadas; no mostrar «Conectado» antes de tiempo.
5. Ensayo con una cuenta propia apta para coexistencia. El número oficial de prueba usado hasta ahora no valida conservar una app de celular. La revisión/aprobación y habilitación de Meta siguen siendo requisitos separados.
6. Luego, respuestas del inbox respetando la ventana de atención, archivos y notificaciones por plantillas aprobadas de cada empresa.

Fuentes complementarias: [alta como Tech Provider](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider), [mensajes entrantes y estados](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages). Los detalles de agosto en `whatsapp-tech-provider-diseno.md` son un diseño histórico y no sustituyen estas comprobaciones.
