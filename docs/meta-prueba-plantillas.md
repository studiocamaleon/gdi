# Ensayo real de plantillas y PDF

## Resultado de texto — 27/09/2026

Se avanzó con `grafoprint_pedido_listo_v1`, `es_AR`, aprobada, sin esperar la revisión del PDF. El cliente real de Grafo consultó la plantilla, validó sus dos variables y realizó **un único POST**, con `Prueba Grafo` y `DEMO-0002`, al destinatario del piloto previamente autorizado.

- Meta aceptó la solicitud. El webhook de staging guardó `sent` a las 18:29:42 UTC y `delivered` a las 18:29:43 UTC, sin códigos de error.
- Los eventos corresponden al mismo WAMID, cuenta, número de prueba, empresa y correlación privada del intento. No hubo reenvío ni eventos simulados.
- El número de destino se configuró con prefijo argentino `54`; Meta devolvió su identificador de WhatsApp con `549`. Se comprobó esa correspondencia exacta en el registro privado. Para el futuro canal de prueba debe usarse el `wa_id` confirmado por Meta, sin introducir reglas generales que fusionen números por sufijos.
- Lucas confirmó que abrió el mensaje y respondió `PRUEBA GRAFO DEMO-0002`. El webhook real de esa respuesta quedó guardado en staging a las **18:34:46 UTC**, asociado a la empresa, cuenta y número correctos. No traía `context.id`: es un nuevo mensaje del chat, no una respuesta citada al mensaje saliente. Al cierre de la consulta no había evento `read`; no se infiere lectura a partir de la respuesta.
- El normalizador actual del Inbox interpretó esos tres eventos reales, en un proceso de sólo lectura: `SENT`, `DELIVERED` y mensaje de texto `ENTRANTE`/`NUEVO`, todos sin avisos. No se ejecutó el procesador ni se escribieron proyecciones nuevas en Neon o en la base local; todavía falta la prueba del Inbox completo.
- La plantilla `grafoprint_documento_pedido_v1` todavía figuraba `PENDING` al consultar el catálogo para este envío. No se envió PDF.

Herramientas privadas: `probar-plantilla-texto.cjs` consulta por defecto y exige `--enviar` para hacer el único intento. La existencia de `meta-prueba-texto-envio.json` impide repetirlo. `consultar-prueba-texto.cjs` comprueba eventos y respuesta mediante una transacción **de sólo lectura** en `grafoprint_staging`, sin copiar datos a la base local ni mostrar teléfonos o claves. Reutiliza el cliente y los validadores del código `cf725933d`.

## Apoyo de WhatsApp Business Tools MCP

Revisada la [documentación oficial](https://developers.facebook.com/documentation/mcp/whatsapp-business-tools-mcp) el 27/09/2026. El servidor de Meta permite consultar y administrar cuentas, números, plantillas y webhooks, además de enviar mensajes de prueba. Su endpoint es `https://mcp.facebook.com/whatsapp_business_tools`, usa OAuth y está en beta con disponibilidad gradual.

Es útil para administración y diagnóstico. Un envío por ese MCP no ejecuta `MetaEnviosService`, la autorización de la empresa, la reserva del intento ni la actualización del Inbox: no sustituye el ensayo desde Grafo. En esta sesión no se encontró una herramienta conectada de ese servidor ni un plugin coincidente en el directorio. No se instaló ni autorizó el MCP; su conexión deberá verificarse antes de utilizarlo. El acceso OAuth del asistente tampoco reemplaza las credenciales que necesita el servidor de Grafoprint.

## Preparación del recorrido completo en staging

La prueba de texto elimina la espera por una plantilla como bloqueo del resto del trabajo. El siguiente bloque es probar la interfaz real del Inbox con el número oficial de prueba; todavía requiere implementación y validación:

1. **Canal de prueba explícito.** El piloto actual usa configuración del servidor; la lectura general usa `MetaVinculo`, mientras `enviosInboxHabilitados` exige modo `coexistencia`. Hace falta representar el canal de prueba como tal, con empresa, cuenta, número, destinatario autorizado y vencimiento comprobados. No cargar un vínculo ficticio ni activar `coexistencia` para saltar el alta.
2. **Límites del ensayo.** Mantener permisos, plan, separación de empresas, ventana de 24 horas, revalidación de conexión y control de duplicados. El modo de prueba debe cerrarse fuera de staging, rechazar destinatarios ajenos y señalar claramente su condición en la pantalla. No debe solicitar contactos ni historial de coexistencia.
3. **Comprobación local.** Pruebas con credenciales y datos ficticios que recorran recepción → cola → conversación → envío → estados → avisos en vivo. Cubrir además token vencido, desconexión, otra empresa y otro destinatario. Las claves reales continúan fuera de la aplicación local.
4. **Lote coherente.** Hay diez migraciones aditivas entre el piloto desplegado (283) y el desarrollo actual (293), desde `20260925223000_meta_recepcion_piloto` hasta `20260927010000_inbox_plantillas_archivos`. Revisar cualquier migración adicional del modo de prueba antes de publicar. Compilar y comprobar API/web en remoto; el workflow actual no se dispara automáticamente para esta rama y necesita ejecución explícita o ampliar su configuración.
5. **Despliegue y activación.** Aplicar migraciones sin seed/reset, revisar permisos y publicar API, web y workers con una versión coherente. Reutilizar PostgreSQL, Redis, R2 y el worker existente; este diseño no exige contratar otra máquina. Definir la configuración del canal de prueba en el servidor y abrir sólo la empresa de ensayo.
6. **Prueba desde Grafo.** Abrir dos sesiones del Inbox; recibir un mensaje, contestar, enviar una plantilla y observar entrega/lectura disponibles sin recargar. Comprobar reconexión y ausencia de duplicados. Luego probar archivos e incorporarlos al mismo registro de validación. Coexistencia e importación de historial conservan su ensayo separado con un número elegible.

## Preparación del PDF — 26/09/2026

La conexión con Meta está comprobada y el envío de PDF está preparado. **Todavía no se envió el PDF:** la plantilla `grafoprint_documento_pedido_v1`, idioma `es_AR`, figura `PENDING`. Esta revisión de la plantilla es distinta de la revisión de la aplicación como proveedor de tecnología.

Se trabajó en `codex/meta-prueba-plantillas`, sobre el código `cf725933d`. No se desplegó el Inbox nuevo. Staging conserva el piloto `7efabd87213e`; únicamente se renovó su token temporal. Los cambios de plantillas y documentos siguen en local.

## Lo que ya se verificó

- El token anterior estaba vencido. Lucas generó el nuevo en Meta; se guardó fuera de Git y se actualizó sólo el secreto del piloto en la API de Fly. La API, su base y la web respondieron correctamente después del reinicio.
- El número oficial de prueba pertenece a la cuenta configurada, Grafoprint figura entre las aplicaciones suscriptas y Meta puede verificar el webhook de staging con el challenge correcto.
- `MetaCloudClient.listarPlantillas` consultó el catálogo real y `normalizarPlantilla` interpretó sus seis plantillas anteriores. Reconoció las de texto e imagen y bloqueó correctamente el carrusel no soportado.
- No había una plantilla con PDF. Se creó `grafoprint_documento_pedido_v1`, categoría solicitada y devuelta `UTILITY`, con encabezado `DOCUMENT`, dos variables de cuerpo y pie Grafoprint.
- Para la revisión se subió un PDF ficticio de 1176 bytes: cliente Estudio Demo, pedido DEMO-0001 y aviso «DOCUMENTO DE PRUEBA - SIN VALIDEZ COMERCIAL». No contiene datos de clientes ni es un comprobante emitido.
- La consulta posterior mediante el código real de Grafo reconoce el PDF y sus dos variables. `validarValoresPlantilla` bloquea el envío mientras el estado sea `PENDING`.

Texto presentado a Meta:

> Hola {{1}}, te compartimos el documento de tu pedido N.º {{2}}. Abrí el PDF adjunto para revisarlo y respondé a este mensaje si necesitás alguna aclaración.

La muestra para aprobar un encabezado y el archivo enviado a un destinatario son dos operaciones diferentes. La primera usa **Resumable Upload** y devuelve un `header_handle`; para el mensaje se sube el PDF a `/{PHONE_NUMBER_ID}/media` y se usa su ID. No intercambiar esos identificadores.

## Próximos pasos del ensayo de PDF

1. Volver a consultar la plantilla. Continuar sólo si Meta informa `APPROVED` y la definición sigue siendo compatible. Si fue rechazada, leer el motivo antes de cambiarla; no recrearla repetidamente. Si el token venció, renovarlo primero.
2. Ejecutar un único envío al destinatario del piloto previamente autorizado, con el PDF ficticio y los valores `Cliente de prueba` y `DEMO-0001`. No usar documentos comerciales reales para este ensayo.
3. Conservar el resultado del POST. «Aceptado» significa que Meta recibió la solicitud; todavía no demuestra entrega.
4. Buscar los webhooks reales del mismo WAMID, cuenta, número y empresa en staging. Registrar entrega y lectura únicamente si llegan esos estados. Nunca sustituirlos por eventos simulados.
5. Confirmar con Lucas que el PDF recibido abre y muestra los datos ficticios. Si el envío es incierto, investigar el registro privado y los webhooks antes de cualquier nueva acción; no reenviar automáticamente.
6. Preparar por separado el lote del Inbox para staging: API, web, worker y migraciones coherentes. Allí comprobar el recorrido desde la selección del documento hasta los checks y la copia privada del adjunto.

## Herramienta privada para continuar

En el directorio privado de staging quedó `probar-plantilla-pdf.cjs`. Sin argumentos consulta el catálogo y comprueba compatibilidad, sin enviar. `--enviar` solicita el único intento y exige aprobación; no hay programación automática. Reutiliza el cliente y los validadores de Grafo en un proceso de operador separado, sin iniciar la aplicación local ni cargar sus variables de entorno.

El intento se guarda antes de subir el PDF en `meta-prueba-pdf-envio.json`. Un registro existente bloquea otra ejecución de envío, incluso si hubo un fallo de preparación. El registro permite distinguir preparación, POST en curso, aceptación, rechazo o incertidumbre. No borrarlo para forzar un reintento. El script conserva rutas absolutas de esta Mac: revisarlas si se mueve el worktree.

Credenciales, destinatario, IDs privados, PDF, muestra y evidencias completas permanecen fuera de Git, en `~/.config/grafoprint/staging`, con archivos `0600`. No copiar esas claves a la configuración ni a la base local.

## Qué no demuestra este ensayo

Incluso si el PDF llega, esta prueba cubre el cliente de Cloud API, la plantilla, la subida y los estados recibidos por el webhook existente. **No valida todavía el recorrido completo del Inbox**, sus permisos en staging, el selector de presupuestos/comprobantes, Redis/SSE, la copia del adjunto ni la conexión de empresas por coexistencia. Tampoco demuestra importación de seis meses de conversaciones ni aprobación de nuestra aplicación.

El número oficial de prueba no se registra artificialmente como una conexión de coexistencia para evitar los controles del producto. Antes del ensayo completo del Inbox hay que disponer de un canal compatible o implementar y revisar un modo de prueba explícito.

## Fuentes oficiales consultadas

- [Inicio de WhatsApp Cloud API](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started): número y credenciales temporales para pruebas; página actualizada el 16/06/2026.
- [Componentes de plantillas](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components/): muestra de encabezado documental y ejemplos de variables; actualizada el 24/06/2026.
- [Resumable Upload de Graph API](https://developers.facebook.com/docs/graph-api/guides/upload): sesión de subida y handle utilizado en la muestra. Consultado el 26/09/2026; solicitudes de este ensayo con Graph v26.0.
