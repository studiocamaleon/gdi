# Grafo Inbox: capacidades de WhatsApp y trabajo pendiente

Revisión: **28/09/2026**. Referencia: documentación oficial disponible de Meta y código de esta rama. El objetivo es una experiencia familiar de WhatsApp Web, integrada con clientes, órdenes y documentos de Grafo. **Todavía no está implementada toda la API.** Aprobar la app habilita accesos; no desarrolla las funciones faltantes ni elimina las restricciones de coexistencia.

## Qué se corrigió en este lote local

- Se elimina «Renovar acceso». Grafo obtiene el permiso al necesitarlo. Si la firma del almacenamiento vence durante la apertura, se recupera automáticamente una vez.
- El PDF se lee en un visor dentro del Inbox y mantiene su descarga opcional. Puede permanecer abierto más allá de los 60 segundos del enlace original.
- Las imágenes aparecen al entrar en la vista y se amplían al tocarlas. Los stickers WebP usan el mismo circuito, que conserva su animación si el archivo es animado.
- Audio y video muestran controles sin tener que pedir acceso primero. Nunca comienzan a reproducirse solos. Si el navegador no admite el códec, se explica y se ofrece el original.
- Los documentos sin visor se descargan con un clic. Cada clic obtiene un enlace nuevo.
- La navegación usa una barra superior de 3 px y esqueletos de contenido. Se retira el isologo central de las transiciones y se deja de forzar el tema claro en esos indicadores.

**Todo lo anterior está preparado en local.** No implica un despliegue de staging ni acredita todos los formatos con mensajes reales de Meta.

## Archivos: qué admite Meta y cómo debe funcionar Grafo

Los límites son por archivo. La copia en Grafo también está sujeta al espacio del plan. Fuente: [medios y límites de Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media).

| Familia | Formatos documentados | Máximo | Recepción y visualización en Grafo |
| --- | --- | --- | --- |
| Imagen | JPEG, PNG | 5 MB | Copia privada, miniatura automática, ampliación y original descargable. |
| Audio | AAC, AMR, MP3, M4A, OGG | 16 MB | Reproductor cuando el navegador admite el códec; descarga en todos esos casos. |
| Video | MP4, 3GP | 16 MB | Reproductor con controles y pantalla completa del navegador; alternativa de descarga. |
| Sticker | WebP estático o animado | 100 KB estático / 500 KB animado | Vista en conversación y ampliación. El receptor conserva un techo de 500 KB; el futuro envío debe distinguir ambas variantes. |
| PDF | PDF | 100 MB | Visor privado con controles del navegador, sin guardado obligatorio en el equipo. |
| Documento | TXT, DOC, DOCX, XLS, XLSX, PPT, PPTX | 100 MB | Descarga directa; no se envían a visores de terceros. |

Detalles que afectan al producto:

- Las imágenes de Meta deben ser RGB/RGBA de 8 bits. Fuente: [imágenes](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/image-messages).
- OGG requiere Opus y un canal. Una nota de voz enviada por API requiere además `voice: true`; grabar cualquier audio del navegador no garantiza un archivo válido. Fuente: [audio y notas de voz](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/audio-messages).
- Video requiere H.264 y, si lleva audio, AAC. La extensión MP4 por sí sola no garantiza compatibilidad. Fuente: [video](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/video-messages).
- La reproducción de AMR y algunos contenedores/códecs no está garantizada en Chrome/Safari. **Falta una conversión a formato reproducible** si queremos cubrir también esos casos sin salir del chat. Debe ejecutarse en un worker con recursos acotados, conservando el original; no convertir cada vez que se abre una conversación.
- AI, PSD, ZIP, GIF, SVG y HEIC no forman parte de la lista de documentos oficialmente garantizados. No habilitarlos por extensión ni prometer que llegan por Cloud API. Un GIF animado y un sticker WebP son cosas distintas. Fuentes: [documentos](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/document-messages), [stickers](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/sticker-messages).
- La recepción general contempla estas familias; **el envío libre de archivos todavía falta**. Hoy Grafo envía texto y determinadas plantillas, incluidas plantillas con PDF/imagen provenientes de archivos y documentos de Grafo. Un reproductor visible no equivale a tener un botón para enviar ese formato.

## Funciones del Inbox: estado y límites

| Función | Situación en Grafo / próximo trabajo | Referencia oficial |
| --- | --- | --- |
| Conversaciones en tiempo real, texto entrante/saliente | Implementadas con aislamiento por empresa, persistencia y actualizaciones a las pestañas. Ensayo real existente para el canal de prueba; no equivale a coexistencia validada. | [Mensajes](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages) |
| Aceptado, enviado, entregado, leído, reproducido | Grafo conserva y muestra los estados recibidos. Aceptado no significa entregado. No inventar lectura si el usuario no comparte ese estado. La API también distingue reproducción de voz. | [Estados](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status) |
| Adjuntar desde el equipo, pegar imagen, arrastrar archivos | Pendiente de interfaz y envío general con validación, progreso, cancelación y control de duplicados. Reutilizar los archivos privados y la cola de envíos. | [Medios](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media) |
| Grabar y enviar notas de voz | Pendiente. Hace falta grabación, escucha previa, cancelación y codificación OGG/Opus mono para Meta. | [Audio](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/audio-messages) |
| Responder citando un mensaje | Pendiente de selector y referencia persistente al mensaje original. La API usa `context.message_id`. | [Respuestas citadas](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/contextual-replies) |
| Reacciones | Pendientes en recepción representada y envío. Deben asociarse al mensaje original. Meta sólo confirma `sent` para la reacción, no entrega/lectura. | [Reacciones](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/reaction-messages) |
| Contactos compartidos y ubicación puntual | La API los admite; falta representación específica y envío en Grafo. No mostrarlos como archivo perdido. | [Contactos](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/contacts-messages), [ubicación](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/location-messages) |
| Solicitar ubicación | Posible mediante un botón; pendiente. No es seguimiento de ubicación en vivo. | [Solicitud de ubicación](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/location-request-messages) |
| Marcar como leído y mostrar «escribiendo» al cliente | Pendiente de integrar con foco/visibilidad de la conversación y actividad real del operador. «Escribiendo» expira a los 25 s o al responder; no simularlo permanentemente. | [Lectura](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/mark-message-as-read), [escritura](https://developers.facebook.com/documentation/business-messaging/whatsapp/typing-indicators) |
| Plantillas | Selector y envíos básicos implementados, sujetos a aprobación, plan, permisos y ventana real. Pendientes creación/edición desde Grafo y componentes avanzados. | [Plantillas](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview) |
| Botones, listas, enlaces y carruseles | API disponible; Grafo interpreta respuestas simples, pero falta el envío/visualización completa. Listas: 10 opciones combinadas; botones de respuesta: hasta 3; carrusel: 2–10 tarjetas. | [Listas](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-list-messages), [botones](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-reply-buttons-messages), [CTA](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-cta-url-messages), [carruseles](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-media-carousel-messages) |
| Formularios dentro de WhatsApp (Flows) | Familia disponible; pendiente de diseño/integración. Puede servir para recibir especificaciones de un trabajo. Sus respuestas requieren tratamiento propio; no basta el lector de botones. | [Flows](https://developers.facebook.com/documentation/business-messaging/whatsapp/flows) |
| Catálogo, productos y pedidos de WhatsApp | Disponible como integración adicional con catálogo de Meta; no equivale a sincronizar automáticamente productos/OT de Grafo ni el catálogo del celular. Pendiente. | [Catálogos](https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/catalogs-overview), [pedidos recibidos](https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/receive-responses) |
| Búsqueda, asignación a agentes, notas internas, etiquetas, respuestas guardadas | Funciones propias de Grafo. Falta implementarlas con permisos por agente y auditoría. No se obtienen automáticamente al aprobar la app. | Diseño de producto de Grafo; sin equivalencia de sincronización con etiquetas del celular. |
| Editar/eliminar un mensaje ya enviado desde Grafo | No hay un mecanismo de edición/envío de revocación implementado. Los webhooks de edición/revocación de coexistencia informan cambios hechos en WhatsApp; no habilitan por sí solos botones de edición en Grafo. La referencia de `edit` advierte que está temporalmente no soportado. | [Edición](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/edit), [revocación](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/revoke) |
| Mensajes no soportados o no disponibles | Se conserva el evento, pero falta mejorar la explicación según el código. Para 131060, Meta indica consultar el celular. No presentarlo como una descarga que se puede renovar. | [No soportados](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/unsupported) |

## Lo que cambia por usar coexistencia

El camino elegido por Grafo conserva el número y la app WhatsApp Business. Esto tiene límites distintos de un número dedicado sólo a Cloud API. La [guía de coexistencia](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users) es la referencia para este modo.

- Historial: hasta 180 días, si el cliente lo comparte. Los archivos de ese historial se entregan sólo para los últimos 14 días. La importación llega por partes y puede llegar desordenada. Fuente específica: [history](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/history).
- Los nuevos mensajes enviados desde el celular se reflejan por `smb_message_echoes`; los contactos por `smb_app_state_sync`. Grafo tiene base para este circuito, pero falta la prueba de alta/importación con un número real de coexistencia. Fuentes: [ecos](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/smb_message_echoes), [contactos](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/smb_app_state_sync).
- Los grupos existentes, estados/canales y ubicación en vivo no se convierten en funciones del Inbox por conectar el número. Tampoco se sincronizan las herramientas comerciales y etiquetas del celular.
- La API de grupos existe, pero exige una cuenta OBA y **no admite números de coexistencia**. No confundir aprobación de la empresa o app con OBA. Fuente: [Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups).
- Calling API existe, pero su documentación exige un número de Cloud API que no esté en la app Business, además de otros requisitos. Por eso no se promete un teléfono de llamadas dentro del Inbox de coexistencia. Video y pantalla compartida figuran como funciones en desarrollo, no como disponibilidad general. Fuente: [Calling API](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling).
- Las páginas de direcciones estructuradas y pagos tienen restricciones por país. `address_message` se limita a empresas/clientes de India. No agregarlo como función general para Argentina. Fuente: [direcciones](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/address-messages). Los pagos nativos necesitan una revisión específica de país/proveedor antes de proponerse.
- La guía de incorporación anuncia el retiro de Embedded Signup v2 el **15/10/2026**. Antes de abrir el alta pública hay que comprobar que el `config_id` de Facebook Login for Business corresponda a v4. Nuestro SDK toma esa configuración; no alcanza con cambiar un número en frontend. Fuente: [v4](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4).

La documentación general de coexistencia todavía enumera edición de mensajes, mientras la referencia específica de `edit` advierte una suspensión temporal. Se conserva el receptor ya escrito, pero **no se considera validada esa capacidad** hasta comprobar que Meta entregue el evento real.

## Orden para completar el producto

1. **Cerrar este lote de visualización:** ensayar en staging PDF, imagen, audio, video, sticker y documento reales; verificar CORS privado, permisos, recuperación de firmas, teléfono móvil y revocación. No requiere reenviar un archivo ya guardado para abrirlo.
2. **Completar el intercambio de archivos:** adjuntar/arrastrar/pegar, cola de envío con progreso/cancelación, notas de voz y conversión de códecs. Comprobar cada MIME, tamaño y el caso de una subida finalizada cuya confirmación de envío se perdió. Evitar reenvíos duplicados.
3. **Completar la conversación diaria:** citas, reacciones, contactos, ubicación, lectura/escritura y mensajes no soportados. Comprobar ida/vuelta, eventos duplicados/desordenados y dos pestañas.
4. **Completar el trabajo en equipo:** acceso de agentes, asignaciones, búsqueda, notas internas, etiquetas y respuestas guardadas; aislamiento entre empresas y auditoría.
5. **Conectar procesos de Grafo:** ampliar plantillas y botones; después Flows/catálogos cuando exista un caso concreto. Envío de presupuestos, comprobantes y avisos de OT con consentimiento y ventana correctos.
6. **Validar coexistencia de punta a punta:** alta v4, importación consentida, archivos históricos disponibles, ecos del celular, cambios de contacto, desconexión y reconexión. La aprobación de Meta es necesaria para el alta pública, pero no sustituye este ensayo.

En cada bloque: implementar y probar local, agrupar cambios mediante PR, desplegar el lote en staging y registrar qué se comprobó realmente. No marcar como terminada una función por una captura de la demo.

## Alcance del relevamiento

Se revisaron las familias relevantes para el Inbox: medios, mensajes de servicio, estados/webhooks, plantillas, coexistencia, límites de grupos/llamadas y las posibilidades de Flows/catálogos; se contrastaron con el código existente. El [índice oficial](https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt) sirve de mapa para ampliar la revisión. **Este documento no afirma que cada endpoint de toda la plataforma, facturación, anuncios o pagos haya sido auditado o implementado.** La referencia de cada función debe releerse antes de construirla y probarse con la versión de API y el modo de número usados por Grafo.
