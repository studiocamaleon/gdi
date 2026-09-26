# Grafo Inbox: historial de WhatsApp en coexistencia

Relevamiento: 25/09/2026. **Actualización 26/09: base de recepción implementada y probada en local; la importación real sigue deshabilitada.** Revisión del código en `codex/inbox-lectura`. No se solicitaron historiales, cambiaron suscripciones de Meta ni desplegaron servicios.

## Qué ofreceremos al cliente

**Criterio de entrega acordado el 26/09:** preparar infraestructura y UI para que, cuando Meta habilite el acceso necesario, una empresa pueda conectar su número y trabajar con las conversaciones que Meta permita sincronizar. El trabajo no termina al tener una maqueta ni un botón visible. Deben funcionar el alta real, el aislamiento por empresa, el historial, los mensajes nuevos, las respuestas, los adjuntos disponibles, los estados y la recuperación ante fallos. La comprobación real del flujo permitido por Meta sigue siendo una condición de salida, aunque las pruebas locales ya pasen.

Al conectar su WhatsApp Business con Grafo, el negocio podrá autorizar que se incorpore su historial disponible. Podrá seguir usando el celular y ver en Grafo los mensajes que envíe desde allí. La conexión y la importación tendrán estados separados: una cuenta puede estar conectada aunque el negocio no comparta su historial.

Límites verificados en la [guía oficial de coexistencia](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users):

| Aspecto | Alcance de Meta e implicación para Grafo |
| --- | --- |
| Antigüedad | Hasta 180 días de conversaciones individuales anteriores al alta. No prometer recuperar conversaciones borradas o información que Meta no entregue. |
| Grupos | No se importan. |
| Autorización | El negocio decide en WhatsApp si comparte sus conversaciones. Rechazarlo no debe impedir usar la conexión. |
| Momento | Meta establece una ventana de 24 horas después del alta para sincronizar contactos e historial. Grafo debe iniciar el proceso inmediatamente, mostrar su avance y pedir mantener abierta la app del celular. |
| Repetición | Las solicitudes iniciales de contactos e historial se pueden efectuar una vez por alta. La guía indica desconectar y volver a realizar el alta para repetirlas; no ofrecer un botón que prometa recuperar seis meses en cualquier momento. |
| Adjuntos | Los mensajes históricos pueden llegar como marcadores sin archivo. Meta entrega identificadores de archivos recientes por eventos separados, con un alcance de unas dos semanas, no de seis meses. |
| Respuestas | Un mensaje previo al alta no abre la ventana de atención de Cloud API. Importarlo hoy tampoco la abre. Un mensaje nuevo del cliente después del alta sí puede abrirla. Los envíos desde el celular no la extienden. |

La tabla describe el alcance documentado, no garantiza que toda cuenta sea elegible o que se obtengan todos sus archivos. Los dispositivos complementarios no compatibles también pueden causar mensajes que no se reflejan en la API.

## Secuencia que debemos construir

```text
Cliente conecta su número y autoriza compartir historial
                         ↓
Grafo valida la cuenta y deja el receptor preparado
                         ↓
Solicita contactos y después historial a Meta
                         ↓
Meta envía el historial en varios bloques
                         ↓
API guarda cada bloque → worker lo incorpora al inbox
                         ↓
Grafo muestra avance, resultado y adjuntos disponibles
```

1. **Preparar antes de mostrar el botón.** Implementar los procesadores y sus pruebas, la asociación comprobada empresa/cuenta/número, los permisos y el almacenamiento cifrado de credenciales. Seguir Embedded Signup v4 según `meta-recepcion-piloto.md`. Preparar las suscripciones `history`, `smb_app_state_sync`, `smb_message_echoes` y `account_update`, además de `messages`.
2. **Completar el alta.** Validar los activos en el servidor, canjear el código, suscribir la aplicación a la cuenta del negocio y confirmar que el canal está preparado. En coexistencia se omite registrar nuevamente el número. Crear el seguimiento de importación antes de solicitar datos: los eventos pueden llegar muy rápido.
3. **Solicitar los datos desde el servidor.** Primero contactos y luego historial. No esperar a que el usuario entre al inbox, ni depender de que mantenga abierta la pestaña de Grafo. Guardar el identificador de cada solicitud para soporte.
4. **Recibir y guardar antes de procesar.** Comprobar la firma de Meta y conservar cada evento de forma duradera antes de confirmar su recepción. Un worker lo transforma en conversaciones, mensajes y contactos, con recuperación frente a interrupciones.
5. **Incorporar sin duplicar.** Combinar mensajes históricos, mensajes nuevos y envíos del celular en la misma conversación. Mantener fechas originales, dirección del mensaje y estados. Completar los adjuntos cuando llegue su información.
6. **Informar el resultado real.** Mostrar importación en curso, historial incorporado, historial no compartido o sincronización que necesita atención. Separar el avance de mensajes del de adjuntos. La recepción de mensajes nuevos debe poder continuar durante la importación.

### Solicitudes y eventos

La [referencia oficial SMB App Data](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account-to-number-current-status/smb_app_data) documenta un `POST` a:

```text
/<VERSION_GRAPH>/<PHONE_NUMBER_ID>/smb_app_data
```

Cuerpo para contactos:

```json
{"messaging_product":"whatsapp","sync_type":"smb_app_state_sync"}
```

Cuerpo para historial:

```json
{"messaging_product":"whatsapp","sync_type":"history"}
```

El token se utiliza únicamente en el servidor. La respuesta con `request_id` significa solicitud aceptada, no importación terminada ni consentimiento confirmado. Si el negocio rechazó compartir, la guía documenta un evento de historial con código `2593109`.

No es una consulta paginada para descargar conversaciones cuando Grafo quiera: el contenido llega a nuestro webhook. Tampoco se debe interpretar la ausencia de eventos como éxito o rechazo automático.

| Evento | Tratamiento previsto |
| --- | --- |
| `history` con `history[].threads[].messages[]` | Mensajes anteriores, agrupados en bloques. |
| `history` con `messages[]` | Información complementaria de adjuntos; completar el mensaje existente. |
| `smb_app_state_sync` | Contactos de WhatsApp y sus cambios posteriores. |
| `smb_message_echoes` | Mensajes que el negocio envía desde WhatsApp Business o dispositivos compatibles. |
| `messages` | Mensajes nuevos y estados de entrega de Cloud API. |
| `account_update` | Desconexión, baja y reconexión; suspender operaciones cuando corresponda. |

## Decisiones de implementación para Grafo

Estas son propuestas para nuestro sistema, no requisitos textuales de Meta.

- **Seguimiento por empresa, canal e intento de alta.** Registrar comienzo, plazo, solicitudes, avance informado por Meta, bloques recibidos/procesados, errores y actividad reciente. Evitar dos importaciones simultáneas del mismo canal. Una respuesta de red incierta no autoriza repetir a ciegas un `POST` de uso único.
- **Base duradera más worker.** La implementación local del 26/09 usa PostgreSQL tanto para conservar los eventos como para coordinar la cola. Redis distribuye avisos de actualización del Inbox. El trabajo puede continuar aunque Redis se interrumpa. Reprocesar eventos guardados por Grafo es distinto de volver a solicitar el historial a Meta.
- **Modelo de mensajes completo.** Crear una representación que distinga entrantes/salientes, origen histórico/celular/API, fecha original, entrega, contenido y adjuntos. La tabla actual `MensajeWhatsappRecibido` sólo representa entradas del piloto y no alcanza para esto.
- **Identidad y duplicados.** Usar cuenta + número del canal + identificador `wamid`, dentro de una asociación de empresa verificada. La huella de un bloque no reemplaza la deduplicación individual. Guardar las actualizaciones legítimas: un adjunto, edición, revocación o estado posterior no es otro mensaje ni se debe descartar como duplicado.
- **Orden y finalización.** Meta entrega fases 0, 1 y 2 y bloques que pueden llegar desordenados. Ordenar la conversación por fecha original; no por llegada. Registrar `phase`, `chunk_order` y `progress`. La guía vincula `progress=100` con el fin de la sincronización; además debemos comprobar el procesamiento local y reconciliar bloques tardíos. No finalizar sólo por recibir fase 2 ni exigir eventos para fases sin mensajes.
- **Historial sin efectos nuevos.** Importar conversaciones no debe disparar avisos, notificaciones, automatizaciones, contadores masivos de no leídos ni respuestas automáticas. La autorización para responder se calcula con mensajes nuevos válidos, no con la fecha de importación.
- **Contactos y clientes separados.** El directorio de WhatsApp puede ayudar a reconocer nombres y teléfonos. No crea automáticamente clientes fiscales ni borra fichas de Grafo al eliminar un contacto del celular. Vincular por teléfono dentro de la misma empresa; una coincidencia ambigua requiere elegir.
- **Adjuntos privados.** Recuperar los archivos disponibles, comprobar tipo/tamaño, guardarlos en R2 con separación y acceso por empresa y aplicar cuotas y conservación acordadas. Si no están disponibles, mostrarlo sin un enlace roto. Resolver eventos de archivo anteriores o posteriores al marcador del mensaje.
- **Desconexiones y eventos tardíos.** Detener nuevas solicitudes y descargas cuando se retire el acceso. No reasignar datos de una conexión anterior a otra empresa. Los eventos sin asociación comprobable quedan pendientes de revisión, fuera del inbox. No suponer que todos los callbacks contienen el `request_id` de inicio.

### Límites que requieren comprobación adicional

- La guía describe archivos de los 14 días cercanos al alta; su tabla de parámetros también habla de las dos semanas anteriores a la solicitud. No basar una promesa comercial en esa diferencia de corte. Solicitar inmediatamente y validar el comportamiento con una cuenta real.
- La referencia del endpoint incluye `MEDIA_REUPLOAD` en su enumeración, pero la página consultada no explica cómo usarlo ni qué permite recuperar. No asumir que amplía los seis meses de archivos ni implementarlo con parámetros inventados.
- La descripción textual de `phase=2` es ambigua respecto del cierre, mientras la tabla lo identifica como el tramo de 90 a 180 días. Usar el progreso global y el procesamiento comprobado; validar la finalización, los casos vacíos y los eventos tardíos antes del lanzamiento.
- No confundir la restricción de repetir una sincronización con la política de reintentos de entrega HTTP de Meta. El diseño no debe depender de una supuesta recuperación ilimitada. Las frases históricas del repositorio sobre pérdida «para siempre» no sustituyen esta distinción.

## Qué tenemos y qué falta

| Componente actual | Resultado de la revisión |
| --- | --- |
| `MetaConexionService`, `MetaAutorizacion` y `MetaVinculo` | Base del 26/09: autorización, cifrado y reserva de activos comprobados. Sin controlador HTTP ni activación; ver [detalle y validación](meta-conexion-empresas.md). |
| `WebhooksWhatsappService` | Verifica firma y conserva cambios con datos de cuenta/número. Puede encolar los eventos para el procesador general; requiere bandera explícita y vínculo preparado. Ambos siguen deshabilitados en local. |
| `MetaCloudClient` | Sólo implementa el envío de una plantilla. Faltan las solicitudes `smb_app_data` y su seguimiento. |
| `MensajeWhatsappRecibido` e inbox | La interfaz aún lee el piloto. El modelo general y su procesador ya existen; falta conectar lectura y permisos de tiempo real. Ver [recepción local](meta-inbox-recepcion.md). |
| Límite de entrada | El webhook tiene un límite local de 3 MB. Meta advierte que un evento puede contener miles de mensajes: medir tamaño, memoria, tiempo y límites del proxy antes del alta real; no eliminar límites indiscriminadamente. |
| Operación | Recepción y recuperación por lotes implementadas en local. Faltan reconciliación final, métricas, alertas, descarga de adjuntos y conservación de datos. |

El número de prueba de Cloud API utilizado en el piloto **no valida** una importación de WhatsApp Business del celular. La aprobación de la app tampoco implementa este proceso automáticamente.

## Orden de trabajo y aceptación

1. Modelo general de conexión, conversación, mensaje y seguimiento de importación; migraciones aditivas y permisos por empresa.
2. Procesadores locales de historial/contactos/ecos y recepción duradera, con datos ficticios. Reprocesamiento seguro, eventos grandes, métricas y controles de acceso.
3. Orquestación del alta y solicitudes a Meta; estados y progreso visibles en Configuración e Inbox. Por decisión del 26/09, el acceso al inbox permanece visible para el rol autorizado aun sin conexión; dentro se ofrece conectar o se muestran las conversaciones según el estado comprobado del canal.
4. Pruebas agrupadas en staging con una cuenta propia elegible, cuando Meta habilite el flujo. Revisar los permisos reales y el consentimiento antes de esa prueba.
5. Completar envío, plantillas, archivos y reglas de atención; validar el circuito completo antes de ofrecer conexión a clientes.

Casos mínimos: bloques repetidos/desordenados; miles de mensajes; fases vacías; historial rechazado; importación sin respuesta de red concluyente; caída del worker/Redis; archivos antes y después de su marcador; historial y mensajes nuevos simultáneos; estados, ediciones y revocaciones; desconexión/reconexión; aislamiento entre empresas y coincidencias ambiguas de contactos. Ningún mensaje importado debe abrir una ventana de respuesta ni activar notificaciones comerciales.

**Resultado esperado:** una empresa conecta su número, decide compartir, ve el avance y encuentra sus conversaciones disponibles en Grafo, conservando el celular. Si Meta no entrega parte del historial o de los archivos, Grafo lo informa y mantiene operativo el canal que sí esté conectado.

## Fuentes consultadas

- [Coexistencia: alta, historial, contactos, ecos y ejemplos de webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users). Se contrastó la versión en inglés para evitar depender de la traducción automática.
- [SMB App Data, referencia Graph v26.0](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account-to-number-current-status/smb_app_data).
- [Implementación de Embedded Signup](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation) y [alta como Tech Provider](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider), revisadas en el relevamiento de conexión.
