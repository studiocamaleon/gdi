# Inbox: respuestas de texto

Bloque local del 26/09/2026, rama `codex/inbox-respuestas`, desde `03c1117fb`. Continúa los [adjuntos privados](meta-inbox-adjuntos.md). No desplegado en staging; no se activó Meta real.

## Para quien usa Grafo

- El editor permite escribir, conservar un borrador por conversación y enviar explícitamente. Enter agrega una línea; Ctrl/⌘ + Enter envía. Límite conservador de 4.096 unidades de texto; algunos emojis ocupan más de una.
- Muestra el tiempo disponible para responder. Si la ventana está cerrada, bloquea texto libre y explica que hace falta una plantilla aprobada o un nuevo mensaje del cliente. El selector de plantillas es el siguiente bloque.
- «Aceptado por Meta» significa que Meta aceptó la solicitud. «Enviado», «Entregado» y «Leído» dependen de sus confirmaciones posteriores.
- Si la conexión falla, «Comprobar envío» conserva el identificador del intento original. No genera otro envío automáticamente. Un resultado incierto se informa en el hilo y requiere revisión antes de repetir el mensaje.
- Los borradores viven sólo en memoria de esa pantalla, separados por cuenta, canal y conversación. Se pierden al recargar/cerrar la página o cerrar el acceso; los intentos ya registrados permanecen en el servidor.

## Regla de Meta

La ventana de atención dura 24 horas desde el último mensaje o llamada del cliente. Grafo utiliza **mensajes nuevos recibidos** como evidencia: todavía no procesa llamadas para este fin. El historial importado, los ecos del celular y los mensajes salientes no abren la ventana. El servidor valida el plazo; la interfaz utiliza el reloj informado por él. Un rechazo explícito `131047` del POST cierra la ventana local hasta otro mensaje entrante.

Texto se envía a `/{phone_number_id}/messages` con `type: text` y vista previa de enlaces apagada. La aceptación del POST no garantiza entrega. Fuentes oficiales consultadas el 26/09/2026: [mensajes de servicio](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages) y [mensajes de texto](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/text-messages).

## Cómo funciona

1. La pantalla crea una clave única y manda conversación, generación de conexión y texto. No elige ni envía el teléfono destinatario: la API lo obtiene de la conversación de esa empresa.
2. La API comprueba sesión, permisos, plan, flags, conexión, destinatario y ventana. Reserva un intento persistente en PostgreSQL antes del POST. Máximo de 20 intentos nuevos por usuario/empresa/minuto.
3. Sólo quien reservó ese intento realiza un POST a Meta. Las consultas posteriores con la misma clave devuelven su estado; otra conversación/texto/generación con esa clave se rechaza. No hay worker ni reenvío automático.
4. La respuesta registra aceptación, rechazo explícito o incertidumbre. Un proceso interrumpido queda visualmente incierto tras 45 segundos; otro proceso no reclama ese envío.
5. El WAMID de Meta identifica el mensaje canónico. Si ya llegó un eco, se reutiliza. La correlación `grafo-inbox:<id>` permite resolver un webhook adelantado o un POST incierto, comprobando canal, generación y destinatario. Los estados avanzan sin rebajar una entrega/lectura confirmada.
6. La revisión persistente y el bus del Inbox existente avisan a las pantallas. Se vuelve a comprobar el acceso antes de devolver el resultado, aunque la sesión haya cambiado durante el POST.

El texto del intento se retira al vincularlo al mensaje canónico, conservando una huella para comprobar repeticiones. Los intentos sin resolver/rechazados conservan el texto. La política general de conservación y las herramientas operativas para resolver incidencias siguen pendientes.

## Alcance y validación local

Migración aditiva `20260926210000_inbox_envios`: tabla `InboxEnvio`, claves únicas por empresa/intento y canal/WAMID, relaciones compuestas con conversación y mensaje para mantener el aislamiento. Aplicada únicamente en `gdi_saas` y `gdi_saas_test`: **291 migraciones**, sin seed/reset; permisos de `grafo_app` comprobados.

Se probaron envíos simultáneos, repetición después de reinicio, ventana vencida/historial, pérdida de acceso, rechazo de Meta, webhook adelantado, correlación incorrecta, eco previo y estado incierto. La UI comprueba borradores separados, cancelación al cambiar de conversación, doble clic, errores de red/autorización, límite y vencimiento según reloj del servidor. Las pruebas usan base dedicada y sustitutos de Meta: **no son una prueba de envío real**. Se verificó la demo en Chrome, escritorio y 390 px, claro/oscuro.

Prueba visual: `http://localhost:3000/dev/diseno/inbox/conversaciones`. Alma y Bruno permiten respuestas ficticias, identificadas como «Simulado · sin envío real»; Clara muestra una ventana cerrada. No conecta con Meta, no escribe en la base ni conserva sus mensajes al recargar.

`META_INBOX_ENVIOS_ENABLED=false` por defecto. Para operar requiere recepción habilitada, lectura general, modo coexistencia permitido para la empresa y configuración de conexión disponible. Los flags reales y cron local permanecen apagados. No se agregaron máquinas ni proveedores.

El acceso mantiene el alcance actual: administradores con `configuracion.gestionar`. No habilita Plataforma, MCP o impersonación. Los roles/permisos específicos para agentes se implementarán por separado.

## Antes de habilitar en staging

1. Revisar y desplegar el lote coherente siguiendo `deploy/staging/README.md`; aplicar migraciones sin reset/seed y registrar versión/resultados en `deploy/staging/VALIDACION.md`.
2. Verificar acceso real permitido por Meta, conexión vigente de la empresa de prueba, token/secretos del servidor, suscripción a mensajes y estados, plan y lista limitada de empresas. La aprobación de la app por sí sola no reemplaza estas verificaciones.
3. Habilitar respuestas sólo para ese entorno y empresas autorizadas. Usar un destinatario de prueba que haya autorizado el intercambio; primero debe llegar su mensaje para abrir la ventana.
4. Enviar texto ficticio y comprobar WAMID, entrega/lectura según las confirmaciones disponibles, actualización de otra sesión sin recargar y ausencia de duplicados. Confirmar también el callback de correlación y el comportamiento real de coexistencia.
5. Probar ventana cerrada, token vencido, pérdida de sesión, corte de conexión y reconexión. No usar un reenvío manual para «resolver» un resultado incierto sin revisar primero el mensaje.
6. Ante problemas, apagar `META_INBOX_ENVIOS_ENABLED`. Esto bloquea nuevos intentos; un POST ya enviado puede terminar y su resultado debe conservarse.

Pendientes: selector y envío de plantillas aprobadas, prueba real integral Meta/archivos/tiempo real, envío de adjuntos, permisos de agentes y operación de incidencias. No se promete entrega exactamente una vez ni recuperar un intento incierto si Meta no devuelve una confirmación.
