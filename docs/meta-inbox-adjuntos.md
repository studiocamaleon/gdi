# Inbox: bienvenida y adjuntos privados

Implementación local del 26/09/2026, rama `codex/inbox-adjuntos-bienvenida`. Continúa el bloque de [importación y reconexión](meta-importacion-reconexion.md). No se desplegó en staging ni se activaron llamadas reales a Meta.

## Actualización de staging — 27/09/2026

El lote ya está habilitado en el **canal oficial de prueba**, limitado a la empresa y destinatario autorizados. Staging tiene 295 migraciones. Se corrigió y recuperó un PNG real recibido con tipo `document`: Meta → worker → R2 privado → vista previa de Chrome, con cuota contabilizada una sola vez y aviso en vivo.

Las tarjetas ahora muestran una fila compacta de 300 px, nombre en hasta dos líneas y botón lateral. La imagen sólo se despliega después de pedir acceso. Los formatos pasivos conocidos enviados como documentos conservan el límite de su MIME real: por ejemplo, un PNG sigue limitado a 5 MB.

La validación vigente está en [VALIDACION.md](../deploy/staging/VALIDACION.md). Las pruebas iniciales y el protocolo de abajo son históricos; el ensayo real no acredita todavía todos los formatos, carga, historial o coexistencia. La reanudación puntual del PNG fue una operación del operador con registro privado, no una interfaz de reintento disponible para usuarios.

## Qué cambia para quien usa Grafo

- La bienvenida presenta el producto con la tipografía, naranja y superficies de Grafo. El ejemplo de conversación está identificado como ilustrativo. Funciona en escritorio, celular y tema oscuro; mantiene el botón de conexión sujeto a la configuración real.
- Un mensaje con archivo informa si Grafo está preparando la copia, si está disponible o si necesita revisión. Los marcadores del historial sin archivo conservan su explicación; no se presentan como descargas listas.
- «Abrir archivo» solicita acceso temporal. Imágenes y stickers se muestran en el chat; audio y video tienen controles del navegador, cuando éste admite el formato. Los PDF ofrecen «Ver PDF» en un modal; los demás documentos se descargan. No hay reproducción automática.
- Las copias cuentan dentro del almacenamiento de la empresa. El resto de las empresas no puede abrirlas.

## Cómo funciona

1. El webhook sigue guardando y procesando el mensaje. Si trae un identificador de medio y la función está habilitada, deja una tarea persistente en PostgreSQL.
2. Un bucle independiente dentro del worker existente consulta el medio en Meta, comprueba formato/tamaño/huella y reserva espacio de la empresa. Una descarga lenta no bloquea la recepción de los demás mensajes.
3. Guarda una copia privada con el controlador de archivos existente —R2 en el entorno previsto— y confirma su tamaño y disponibilidad en una transacción. La revisión del Inbox avisa a las pantallas por el circuito de tiempo real existente.
4. Cuando el usuario pide abrirla, la API vuelve a comprobar sesión, permisos, empresa, conexión y mensaje. Genera un enlace firmado de **60 segundos**. El navegador nunca recibe el token de Meta ni su URL de descarga.

Meta documenta que los identificadores recibidos en webhooks caducan a los siete días y que la URL de descarga dura cinco minutos. Por eso la copia se intenta al recibir el archivo; no se espera al clic del usuario. Fuente oficial consultada el 26/09/2026: [Media de WhatsApp](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media).

## Límites y protección implementados

- Una transferencia por proceso; bloqueo con vencimiento y hasta cuatro intentos para fallos transitorios. Recuperación tras reinicio. No añade máquinas ni otro proveedor.
- Reserva de cuota antes de descargar y verificación al confirmar. Repetir el mismo evento no duplica archivo ni consumo. Un cambio de medio o una revocación retira la copia anterior; el purgador existente se ocupa del objeto físico.
- Sólo destinos HTTPS de medios de Meta autorizados, sin redirecciones. Tamaño acotado, MIME admitido, firma básica y SHA-256. No es un antivirus ni un validador completo de códecs o documentos.
- Imágenes hasta 5 MB, audio/video hasta 16 MB, documentos hasta 100 MB y WebP de stickers hasta 500 KB; se usan límites decimales conservadores. La reproducción depende del navegador. El original conserva la opción de descarga.
- Archivos privados bajo `INBOX`, aislados de las rutas genéricas de archivos. La descarga de documentos se conserva; sólo el PDF recibe además un enlace `inline` para el visor. La carga saliente usa endpoints exclusivos del Inbox y reserva privada temporal; no habilita las rutas genéricas de archivos.
- Revalidación de permisos antes y después de firmar; los mensajes revocados y las conexiones que dejan de ser válidas no generan enlaces nuevos. Un enlace ya emitido puede seguir vigente durante sus 60 segundos.
- El acceso mantiene el alcance actual del Inbox: administración/configuración de la empresa. Plataforma, MCP e impersonación no habilitan la apertura. Los permisos de agentes son un bloque posterior.

## Estado local y validación

## Apertura automática — 28/09/2026, preparada en local

Esta actualización reemplaza la renovación manual descrita en el visor del 27/09. La API conserva las firmas privadas de 60 segundos; la interfaz ya no muestra «Renovar acceso».

Para PDF, imágenes, stickers, audio y video, el navegador solicita autorización y obtiene los bytes directamente del almacenamiento privado. Crea una URL `blob:` efímera para el visor/reproductor, que permanece usable mientras esté abierto. Comprueba el MIME y el tamaño contra los metadatos autorizados, limita la descarga y reintenta una sola vez si la firma devuelve 401/403. No envía los bytes por Next, a Meta ni a un visor de terceros. R2 debe permitir GET desde el origen exacto de la app (CORS ya previsto en staging); no abrir el bucket al público.

Las miniaturas y reproductores sólo cargan cerca de la vista. Al salir liberan la copia; un audio/video que se reproduce o una imagen ampliada permanece disponible. Se conserva la altura del bloque para evitar saltos de scroll. Cambiar de conversación o cerrar el PDF cancela la descarga y libera su URL. Los archivos ya leídos son copias locales transitorias: una revocación no puede retirar bytes que el navegador ya recibió; el evento de revocación debe desmontar la vista, como sucede con las versiones de mensajes actuales.

Los documentos sin visor obtienen una firma nueva en cada clic de descarga. Audio/video incompatibles con el navegador conservan descarga y explicación. La transcodificación de AMR/otros códecs recibidos sigue pendiente; el envío libre se incorpora en el lote siguiente descrito aquí; ver [matriz de capacidades](meta-inbox-capacidades.md).

Validación automatizada: 63 pruebas frontend, TypeScript acotado, ESLint y guard de CSS. Incluye autorización vencida, descarga incompleta/excesiva, MIME inesperado, cancelación, liberación de memoria, 10 MIME de medios y PDF abierto después del vencimiento. Los tests de formatos prueban selección de controles; no certifican los códecs reales. La muestra local de Bruno contiene PDF/imagen; Diana contiene tono M4A sintético, video del sitio, sticker sintético y TXT. Sin llamadas a Meta ni cambios de datos. En Chrome se verificaron PDF de dos páginas con zoom y descarga disponible, imagen automática, reproducción real de M4A y MP4, sticker WebP y descarga de TXT con un clic. El modal PDF se comprobó a 390 px sin desbordes; es una prueba de tamaño de ventana, no una certificación en Safari/iPhone.


### Visor PDF — 27/09/2026, preparado en local

La tarjeta compacta abre un modal con estética Grafo. Usa el visor PDF integrado del navegador, con páginas, zoom y descarga opcional. El PDF llega directamente desde el almacenamiento privado: no se envía a Google, a un visor externo ni a Meta para visualizarlo. No agrega dependencias, tablas ni servicios.

`abrir` mantiene `url` para descargar y devuelve `vistaPreviaUrl` sólo si el MIME del archivo guardado es `application/pdf`. Ambas firmas duran 60 segundos y salen juntas después de revalidar el acceso. Cerrar elimina el iframe y cancela peticiones pendientes; cada reapertura solicita permiso de nuevo. «Renovar acceso» recupera firmas nuevas; la descarga se deshabilita cinco segundos antes del vencimiento, sin interrumpir la lectura ya cargada.

Si el navegador no admite PDF o tiene desactivado su visor, Grafo lo explica y conserva la descarga. También admite una API de versión anterior sin `vistaPreviaUrl`. El visor de otro origen informa sus propios errores; Grafo no puede inspeccionar el documento cargado y ofrece renovar el acceso si no aparece. La experiencia móvil depende del visor del navegador; no se promete el mismo conjunto de controles que Chrome de escritorio.

Verificación: 35 pruebas web (7 del visor, 10 de adjuntos, 18 del Inbox), 17 de integración de adjuntos en la base dedicada de tests, TypeScript acotado al frontend modificado, ESLint y guard de CSS. Comprobado en Chrome con PDF ficticio de dos páginas, zoom y renovación; revisión del modal a 390 px. **Pendiente incluir este cambio de API y web en el próximo lote de staging y probar allí el PDF real del ensayo.** No requiere renovar el token de Meta para leer una copia ya guardada mientras el acceso al canal siga siendo válido.

### Base de adjuntos

Migración aditiva `20260926190000_inbox_adjuntos`: tabla de trabajos y relaciones entre empresa, mensaje y archivo; enum `INBOX`; comprobaciones de archivo privado y propio en la base. Aplicada únicamente a `gdi_saas` y `gdi_saas_test`: **290 migraciones**, sin seed/reset. Permisos de `grafo_app` comprobados.

Se comprobaron cliente de medios, cuota, eventos repetidos, concurrencia, reinicio, revocación durante descarga/apertura, aislamiento entre empresas, rutas HTTP, apagado del worker y estados de la interfaz. Las pruebas de integración usan la base dedicada de tests y sustitutos de Meta y almacenamiento: **no prueban todavía una transferencia real Meta → R2**. TypeScript, ESLint y guard de CSS revisados. La bienvenida se comprobó en Chrome, en claro/oscuro y a 390 px.

Recorridos locales:

- Bienvenida real: `http://localhost:3000/inbox`.
- Muestra ficticia: `http://localhost:3000/dev/diseno/inbox/conversaciones`. Elegir a Bruno y abrir su PDF. El archivo de ejemplo sólo existe en modo desarrollo; no requiere Meta ni utiliza R2.

El nuevo interruptor `META_INBOX_ADJUNTOS_ENABLED` queda apagado por defecto. Cron y Meta reales permanecen apagados en los procesos locales.

## Cuando se pruebe el lote en staging

1. Seguir `deploy/staging/README.md`, revisar el lote y aplicar sus migraciones sin seed/reset. Registrar versión y resultado en `deploy/staging/VALIDACION.md`.
2. Confirmar la conexión de coexistencia de una empresa de prueba, credenciales del servidor, suscripciones y acceso real disponible en Meta. Mantener restringida la lista de empresas de prueba. La aprobación de la app por sí sola no sustituye esta comprobación.
3. Con recepción y lectura general habilitadas para esa empresa, activar `META_INBOX_ADJUNTOS_ENABLED=true` en API y worker. Comprobar cuota, bucket privado y tarea de purga del entorno antes de importar archivos.
4. Intercambiar archivos ficticios con un destinatario de prueba autorizado: imagen, documento y audio/video admitidos. Verificar recepción, copia, apertura desde otra sesión autorizada, enlace vencido, actualización sin recargar y consumo de almacenamiento. No usar archivos de clientes en esta prueba.
5. Comprobar historial, marcadores sin medio, duplicados, revocación y aislamiento con otra empresa. Verificar los encabezados de descarga, acceso de audio/video y dominio de medios devuelto por Meta; si cambia, revisar explícitamente la lista permitida antes de ampliar destinos.
6. Registrar lo verificado y los límites. Ante problemas, apagar el interruptor: se bloquean nuevas aperturas y descargas, sin borrar los datos. Los enlaces emitidos expiran; trabajos ya en curso vuelven a comprobar el interruptor antes de confirmar.

Pendientes para habilitar el Inbox completo: prueba real con Meta/R2, herramientas operativas para reintentar archivos en revisión o sin cuota, política de conservación y limpieza de copias al desconectar, carga/observabilidad, plantillas y permisos de agentes. Las [respuestas de texto y la ventana de atención](meta-inbox-respuestas.md) ya tienen implementación local. No se promete recuperar todos los archivos ni seis meses completos de mensajes.

## Envíos y controles compactos — 28/09/2026, local

El editor usa una fila: adjuntar, plantilla, texto con emojis y micrófono/enviar. Las imágenes pegadas o archivos arrastrados abren revisión; elegir no transmite bytes. Los audios recibidos/enviados tienen burbuja sin cabecera de archivo, reproducción/pausa, avance, duración y velocidades 1×/1,5×/2×. Los stickers se presentan sin tarjeta. Todos conservan acceso privado y liberación de la copia del navegador.

Grabar pide micrófono sólo por clic del operador. La papelera cancela y detiene el dispositivo sin subir datos. Enviar detiene la grabación y comienza el envío sin modal de vista previa. Cambiar de conversación detiene y descarta una grabación aún activa. A los 5 minutos se detiene y queda pendiente de enviar o descartar; nunca se envía por alcanzar el límite. Una confirmación incierta conserva la misma clave; «Comprobar envío» consulta ese intento y evita duplicados. Las pruebas de micrófono emplean un dispositivo simulado; no se capturó audio personal.

La migración aditiva `20260928120000_inbox_cargas` agrega reservas de carga por empresa, conversación, usuario y autorización, con vínculo único al intento. El servidor controla permisos, plan, cuota, ventana de 24 horas y destino de prueba antes de preparar y otra vez antes de enviar. Se firma PUT privado de 10 minutos; las reservas vencen a los 30 minutos. Cancelaciones y cargas utilizadas pasan a la purga existente, conservando margen para PUT tardíos. El cron debe estar activo en staging; sigue desactivado en local.

Antes de subir a Meta se verifica tamaño real, firma, MIME, color/profundidad de imágenes y códecs de audio/video. Se aceptan los MIME equivalentes de macOS para M4A y se normalizan. Las notas grabadas WebM/OGG/M4A se convierten con FFmpeg a OGG/Opus mono (`voice:true`). Se limita a una preparación por proceso; subprocesos sin shell, protocolos de red bloqueados, tiempo/hilos acotados y temporales privados eliminados al terminar. El runtime API necesita FFmpeg/FFprobe: agregados al Dockerfile, pendiente compilar/desplegar remotamente. Este control no sustituye un antivirus.

El envío conserva el identificador de Meta antes de publicar el mensaje y reutiliza el trabajador de recepción para guardar la copia final privada. No reintenta automáticamente POST inciertos. Los mensajes de ubicación, contactos, citas y reacciones recibidas también se representan; las referencias se resuelven sólo dentro de su conversación. Sus acciones salientes todavía están pendientes.

Ensayo local: selección y envío simulado de M4A desde Chrome; reproducción compacta de audios entrantes/salientes, sticker y vista de 390 px sin desbordes. Validación: **91 pruebas frontend y 194 API**, TypeScript acotado a los cambios, ESLint y guard de CSS. Pruebas automatizadas de tipos/formato real con FFmpeg, aislamiento, duplicados, cambios de permisos/conexión, carga cancelada y micrófono simulado. No equivale a ensayo real con Meta/R2: falta probar en staging cada familia, CORS de PUT y cuotas, más Safari/iPhone. No se modificaron flags, credenciales ni recursos remotos.

## Bandeja, contexto y menús — 28/09/2026, local

- Audio y video ofrecen la descarga en el menú de la esquina. El video se muestra directamente en la burbuja, sin cabecera ni tarjeta de documento; los controles de audio permanecen compactos.
- «+» abre Fotos, Videos, Audios, Documentos y Stickers. El selector del sistema filtra extensiones/MIME según la categoría; si el usuario fuerza otro formato, se rechaza antes de previsualizar/subir. Se conserva la validación de tamaño y la inspección real del servidor, porque un filtro del navegador no valida los bytes.
- Botones exteriores y campo de una línea miden 40 px y comparten centro vertical. El campo sigue creciendo para mensajes de varias líneas.
- La lista usa dos líneas, con hora, «Ayer», día o fecha en la esquina y confirmaciones compactas para mensajes salientes. El día se calcula con la zona horaria de la empresa, incluso en cambios de hora.
- El panel de contexto usa ficha grafito, acentos de marca, teléfono/contacto y órdenes reales. Conserva las restricciones de acceso y la selección ante varias coincidencias.
- Se retiraron la barra superior repetida, selector de tema propio, pies informativos y «Actualizar». El tema se hereda de la app. Se mantiene SSE, reconexión, recuperación al volver a la pestaña y sondeo alternativo; un fallo inicial sin stream reintenta cada 5 s mientras hay Internet y la vista está visible. Un rechazo de sesión no se reintenta. Sólo se muestra estado de conexión cuando hay un problema.

Carga de archivos: sigue siendo bajo demanda, cerca de la vista, desde la copia privada de Grafo. Cambiar de conversación libera los blobs; al volver se vuelven a autorizar/cargar los medios visibles, no todo el historial ni otra copia desde Meta. Los PDF se cargan al abrirlos. No se agregó caché persistente de archivos privados.

Validación: **98 pruebas frontend** (incluye tiempos relativos, recuperación inicial y actualización en vivo), TypeScript del Inbox, ESLint y guard de CSS. Chrome: menú de descarga con nombre del original, rechazo de TXT desde Fotos, aceptación desde Documentos sin enviar, alineación medida de controles, audio/video y contexto a 390 px sin desborde. Las pruebas del posicionamiento de menús se realizaron en el navegador; JSDOM no representa esa geometría. Sin cambios de API, migraciones, flags ni despliegues; pendiente agrupar con el lote de staging.

### Revisión previa amplia

La revisión de adjuntos ahora ocupa la pantalla, con cierre arriba, medio centrado, miniatura/papelera y comentario/envío en el borde inferior. Usa los colores de Grafo y se adapta a móvil. Los PDF locales pueden verse antes de enviar en el visor del navegador; otros documentos muestran nombre, formato y tamaño. Sólo usa la copia local seleccionada: no sube bytes hasta confirmar. No cambia la grabación directa de notas de voz ni las protecciones contra envíos duplicados.

Comprobado en Chrome con imagen del catálogo y PDF ficticio, además de imagen a 390 px. Se volvieron a ejecutar las 19 pruebas de editor/envío (incluyen descartar, cancelar grabación y resultado incierto), tipos del Inbox, lint y guard de CSS. Permanece local, junto al lote anterior.
