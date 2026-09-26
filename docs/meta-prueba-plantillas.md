# Ensayo real de plantillas y PDF

## Estado del 26/09/2026

La conexión con Meta está comprobada y el envío de PDF está preparado. **Todavía no se envió el mensaje:** la plantilla `grafoprint_documento_pedido_v1`, idioma `es_AR`, figura `PENDING`. Esta revisión de la plantilla es distinta de la revisión de la aplicación como proveedor de tecnología.

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

## Próximos pasos, en orden

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
