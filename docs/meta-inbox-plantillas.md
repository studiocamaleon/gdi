# Plantillas de WhatsApp en el Inbox

Implementado y comprobado en local el 26/09/2026, rama inicial `codex/inbox-plantillas`, ampliada en `codex/inbox-plantillas-archivos`. Todavía no activado en staging ni probado con un destinatario real.

## Para qué sirve

Una plantilla es un mensaje cuyo texto fijo ya aprobó Meta. La persona que atiende el Inbox elige una, completa sus datos (por ejemplo, nombre y número de pedido), ve el resultado y confirma el envío. Sirve también cuando pasaron las 24 horas para responder con texto libre. Enviar una plantilla no vuelve a abrir esa ventana.

La creación, edición y revisión de las plantillas se hace por ahora en el Administrador de WhatsApp de Meta. Grafo consulta las que pertenecen a la cuenta conectada de cada empresa. La aprobación de una plantilla es independiente de la revisión de nuestra aplicación.

## Alcance de este bloque

- Catálogo paginado y búsqueda entre las plantillas cargadas, con idioma, categoría y estado.
- Selección únicamente de plantillas `APPROVED`, de utilidad o marketing, compatibles con este bloque.
- Encabezado de texto, imagen JPG/PNG o PDF, cuerpo, pie y botones estáticos de URL, teléfono o respuesta rápida. Variables con nombre y posicionales en encabezado/cuerpo.
- Vista previa orientativa y valores validados tanto en la web como en la API. Por ahora se limita el resultado a 60 caracteres de encabezado y 1024 de cuerpo; es un límite conservador de Grafo.
- Confirmación explícita del operador de que el cliente autorizó ese tipo de contacto. Es una declaración, no una verificación automática ni un registro completo de cómo se obtuvo el consentimiento. La clave del intento vincula su contenido y esa confirmación mediante una huella, junto con operador y fecha.
- Se muestra que Meta puede cobrar el mensaje. No se inventa una tarifa ni se supone entrega por aceptación del POST.
- El mensaje queda registrado como plantilla; sus checks se actualizan con los webhooks reales y el circuito Redis/SSE existente.

Videos, ubicaciones, botones con enlaces variables, códigos de autenticación, carruseles, Flows y otros componentes especiales aparecen bloqueados con motivo. No se descartan silenciosamente componentes para enviar una versión incompleta. No hay envíos masivos ni automatizaciones nuevas.

## Archivos privados en una plantilla

1. Elegir una plantilla aprobada cuyo encabezado pida **imagen** o **documento**.
2. Elegir un archivo privado ya subido en la ficha del cliente. Se muestran los últimos 100 compatibles. El teléfono debe corresponder a una única ficha activa; si no hay coincidencia o hay varias, Grafo no adivina de quién es el archivo.
3. Revisar nombre, tamaño y contenido (miniatura de imagen o enlace para abrir el PDF). Completar las variables y confirmar que el cliente autorizó ese tipo de contacto.
4. Al enviar, Grafo valida nuevamente empresa, sesión, permisos, plan, conexión, archivo y versión. Lee bytes con límite, comprueba tamaño, MIME, firma de PDF o metadatos de imagen y hash cuando existe.
5. Sube los bytes a `/{PHONE_NUMBER_ID}/media` con multipart y token del canal. Usa el ID recibido en el componente `header` del mensaje. No entrega a Meta una URL pública de R2 ni una URL firmada de Grafo.
6. Tras la subida vuelve a comprobar el acceso antes del único POST de mensajes. El intento durable se reserva antes de subir. Consultar el mismo intento no repite ni la subida ni el mensaje; los fallos de preparación se distinguen de un envío incierto.
7. La proyección guarda el texto y la referencia de media antes de recibir los checks. El worker de adjuntos conserva una **copia independiente** en el Inbox, sometida a su cuota y permisos; nunca retira el original de la ficha. La copia ocupa espacio adicional. Si falta cuota, el mensaje puede estar entregado aunque Grafo todavía no pueda conservar su archivo.

Límites de este bloque: PDF hasta **20 MB** (límite de Grafo; Meta admite documentos de mayor tamaño), JPG/PNG hasta **5 MB**, imágenes RGB/RGBA de 8 bits. Una preparación de archivo por proceso evita picos de memoria. Si hay otra transferencia en curso, el intento queda rechazado sin mensaje para que el operador decida cuándo volver a intentarlo.

Por ahora no se ofrece subida desde la computadora dentro del modal, ni PDFs automáticos de presupuestos/comprobantes, ni archivos de órdenes. Agregar esos accesos necesita su selección comercial y sus permisos correspondientes. Tampoco se incluyen archivos públicos, eliminados, generados por el sistema o de otras conversaciones. Las lecturas de vista previa usan el acceso privado existente de archivos; la subida a Meta sólo comienza al pulsar Enviar.

Un archivo subido a Meta cuyo mensaje no llegue a enviarse puede quedar allí hasta su vencimiento de 30 días. No se borran automáticamente IDs en un resultado incierto: podría haber un envío en curso. No hay reintentos automáticos del POST de mensajes.

## Cómo funciona por dentro

1. La API vuelve a comprobar sesión, empresa, permisos, plan y generación de la conexión. Conserva el acceso actual del Inbox: administrador con permiso de configuración, sin impersonación.
2. Consulta `/{WABA-ID}/message_templates` usando la WABA del servidor. Usa `fields`, `limit=100` y el cursor `after`; nunca sigue la URL `paging.next` ni acepta una WABA o destinatario enviados por la web.
3. Entrega un contrato reducido sin tokens, ejemplos ni respuestas crudas. Cada plantilla incluye una huella de su definición y el cursor de su página.
4. Antes de un envío nuevo vuelve a consultar esa página de la WABA. Exige que coincidan el ID, la huella y el estado aprobado. Si el catálogo cambió de posición o contenido, pide actualizar y elegir nuevamente. La comprobación usa GET fuera de la transacción; Meta conserva la validación definitiva en el POST.
5. Reutiliza `InboxEnvio`: reserva un intento durable y limitado a 20 nuevos intentos por minuto por operador/empresa. Un único POST se ejecuta después de confirmar la transacción.
6. Una misma clave sólo sirve para el mismo tipo, mensaje, conversación y generación. Un intento existente puede consultarse aunque el catálogo deje de estar disponible. Nunca se reenvían automáticamente los intentos inciertos.
7. La confirmación del POST o un webhook adelantado proyectan un único mensaje canónico por WAMID. La consulta del resultado vuelve a comprobar permisos y conexión. Las plantillas no modifican la última entrada del cliente ni abren texto libre.

El circuito no intenta solucionar la edición de mensajes ya enviados; esa capacidad sigue pendiente de soporte oficial documentado para envíos de Cloud API.

## Comprobación local

Abrir `http://localhost:3000/dev/diseno/inbox/conversaciones`. Elegir Clara Paz → **Usar plantilla** → **trabajo listo**. Completar nombre, pedido y dirección, confirmar el contacto y enviar. El mensaje aparece como **Simulado · sin envío real**, mientras el texto libre continúa bloqueado. Los datos de esta ruta viven en memoria; no escriben en PostgreSQL ni llaman a Meta.

Para archivos: Alma o Bruno → **Usar plantilla** → **documento del trabajo** o **catalogo con imagen**. Elegir el archivo de ejemplo. Clara muestra la falta de ficha coincidente. Todo sigue siendo simulado.

Cobertura: catálogo y componentes, variables, cambios de estado/definición, separación de empresas y conexiones, permisos HTTP, valores inválidos, falta de consentimiento, concurrencia, timeout, confirmación por webhook, comprobación sin reenvío, vista previa, borradores separados y recuperación del intento al cerrar/reabrir.

Validación acumulada: 450 pruebas de API/Meta, almacenamiento y aislamiento; 56 pruebas de componentes del Inbox; tipos de la web y de la API con `tsconfig.build.json`, lint del código modificado y guardia CSS correctos. La comprobación global de tipos de tests de la API sigue reportando errores anteriores en otros módulos; no se los dio por aprobados. Revisión visual en Chrome: recorrido de PDF, miniatura de imagen y comprobación móvil; la base visual de plantillas ya había sido revisada en claro y oscuro. Sin desborde horizontal. API local con base disponible y permisos de `grafo_app` sobre la columna nueva comprobados.

## Preparación para el futuro lote de staging

- Migración aditiva `20260926230000_inbox_plantillas`: agrega `InboxEnvio.tipo`, con valor inicial `TEXTO` y comprobación de valores. Aplicada sólo en las bases locales de desarrollo y tests; 292 migraciones.
- Migración adicional `20260927010000_inbox_plantillas_archivos`: agrega `InboxEnvio.adjunto`, sólo metadatos de la copia subida a Meta. Aplicada en desarrollo y tests; **293 migraciones** en total.
- Regenerar Prisma y desplegar API, web y worker que procesa webhooks en versiones coherentes. Un worker anterior podría proyectar una plantilla con archivo como texto. No activar este bloque con versiones mezcladas.
- `META_INBOX_PLANTILLAS_ENABLED=false` por defecto; requiere además `META_INBOX_ENVIOS_ENABLED`, lectura, recepción, coexistencia autorizada y configuración vigente. No se modificaron secretos ni flags de los procesos locales.
- Para archivos también se requiere `META_INBOX_ADJUNTOS_ENABLED=true` y acceso vigente a CRM. La descarga/copia del Inbox usa el worker ya existente.
- La activación real requiere una cuenta conectada con acceso a sus plantillas y un destinatario de prueba autorizado. Comprobar catálogo real, parámetros, rechazo, aceptación, entrega/lectura y ventana cerrada antes de ofrecerlo a empresas.
- Registrar versión y resultados en `deploy/staging/VALIDACION.md` cuando se acuerde desplegar el conjunto. Este bloque no publicó ni fusionó ramas.

## Fuentes oficiales consultadas el 26/09/2026

- [Conceptos básicos de plantillas](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview/): estado aprobado, formatos named/positional y categorías. Actualización mostrada: 21/05/2026.
- [Administración de plantillas](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management): catálogo por WABA y paginación. Actualización mostrada: 02/07/2026.
- [Componentes](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components/): encabezado, cuerpo, pie, variables y botones. Actualización mostrada: 24/06/2026.
- [Referencia de Message Template API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/message-template-api): campos, paginación y endpoints. La referencia mostraba v25; los ejemplos de componentes ya utilizan v26, versión configurada del cliente actual.

- [Plantillas con contenido multimedia](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-media/): header image/document, envío por ID o link; Meta recomienda subir y usar IDs. Actualización mostrada: 21/05/2026.
- [Contenido multimedia](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media/): multipart `file`, `type`, `messaging_product`; límite de 5 MB de imágenes, RGB/RGBA de 8 bits y vencimiento de 30 días para media subida. Actualización mostrada: 16/06/2026.
