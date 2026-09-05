# Grafo junto a WhatsApp Web

Versión 0.3.1 de una extensión Chrome Manifest V3. Detecta automáticamente el teléfono del chat activo y muestra el cliente de Grafo y sus diez órdenes más recientes, con estado, fecha de entrega y acceso a la orden. Incluye teléfonos de contactos secundarios y selección de ficha cuando varias comparten número.

## Instalar para probar

1. Levantá Grafo y su API. Iniciá sesión en Grafo **en el mismo perfil de Chrome** donde usás WhatsApp Web.
2. Abrí `chrome://extensions`, activá **Modo de desarrollador** y elegí **Cargar descomprimida**.
3. Seleccioná la carpeta `apps/whatsapp-extension` de este repositorio. No hace falta compilar ni instalar dependencias para usarla.
4. Recargá WhatsApp Web. En el menú de extensiones de Chrome, fijá **Grafo · WhatsApp** y pulsá su icono para abrir el panel.
5. En el panel, conectá la URL principal de Grafo. En desarrollo: `http://localhost:3000`. En producción: la dirección HTTPS de la app con estos endpoints desplegados. Aceptá el permiso de Chrome para esa dirección.
6. Elegí un chat individual. El panel detecta automáticamente el teléfono aunque WhatsApp muestre un nombre guardado. Al cambiar de chat se actualizan el contacto y las órdenes, sin pulsar botones ni abrir la información del contacto.

El panel usa la posición que Chrome tenga configurada para sus paneles laterales. Si aparece a la izquierda, cambiá la posición a la derecha en la configuración de apariencia de Chrome.

Al actualizar el código, pulsá **Recargar** en la tarjeta de la extensión y recargá WhatsApp Web. El usuario debe cargar la extensión manualmente: la automatización disponible no tiene acceso a la página de extensiones de Chrome.

## Avisos automáticos por WhatsApp Web

En Configurar conexión → Avisos automáticos de órdenes, **Activar en este equipo** asigna este perfil de Chrome como emisor de los avisos nuevos de orden recibida, lista para retirar (con o sin saldo) y cambio de entrega. Después no requiere hacer clic ni mantener abierto el sidebar. El usuario necesita una sesión de administrador de Grafo, el permiso `configuracion.gestionar`, Chrome abierto, WhatsApp autenticado y el equipo despierto.

Se revisa la cola cada minuto y se procesan hasta tres avisos por recorrido. Conserva los horarios de cortesía, días de atención, pausa global y rechazo del cliente. Los textos se resuelven con los datos de la orden y se guardan en la cola; las variantes con QR usan la versión de texto con enlace, sin prometer una imagen adjunta.

Cada aviso conserva su canal desde que se encola. Los anteriores continúan por WATI; los nuevos seleccionados salen por la extensión. Los otros eventos del catálogo conservan WATI. **Pausar envíos** deja los avisos Web en cola; **Volver a WATI para avisos nuevos** cambia sólo los próximos avisos. Ningún corte cambia automáticamente de proveedor.

La API reserva cada trabajo de forma atómica y sólo permite iniciarlo una vez. Si Chrome se cierra antes de iniciar, la reserva vence y se recupera; si el corte ocurre durante el envío, queda `web_incierta` y no se reenvía automáticamente. Una confirmación HTTP perdida se reintenta sin mandar de nuevo el mensaje. La confirmación de WhatsApp indica aceptación por el servidor, no lectura por el destinatario.

El emisor queda vinculado a empresa, dispositivo y número de WhatsApp. Cambiar de empresa o cuenta detiene el envío. Una pausa corta los próximos inicios; un envío ya iniciado puede terminar. El estado y los últimos intentos se ven en la misma sección.

El adaptador de envío utiliza **WA-JS 4.6.0**, empaquetado localmente en `vendor/`, con licencia Apache-2.0 y avisos de terceros incluidos. No descarga código remoto. Es una integración no oficial: cambios de WhatsApp pueden romperla y el uso automatizado puede estar sujeto a restricciones de la plataforma. No sustituye la disponibilidad de un servicio en un servidor.

Para regenerar el bundle reproducible: `npm ci` y `npm run vendor`. El lockfile fija la versión e integridad. Referencias: [WA-JS sendTextMessage](https://wppconnect.io/wa-js/functions/chat.sendTextMessage.html), [licencia](vendor/WA-JS-LICENSE), [condiciones de WhatsApp](https://www.whatsapp.com/legal/terms-of-service).

La migración `20260905010000_whatsapp_web_automaticos` agrega configuración y campos de cola sin activar ni migrar avisos existentes. Las rutas bajo `/api/backend/chrome-whatsapp/automaticos` requieren administrador: `GET estado`, `PUT configuracion`, `POST prueba` (sólo al número emisor), `POST reservar`, `POST :id/iniciar` y `POST :id/resultado`.

## Alcance y límites

- El panel de contactos sólo consulta. Los avisos automáticos se activan por separado para un administrador y envían únicamente notificaciones de órdenes generadas por Grafo.
- Lee la identidad del chat activo y la equivalencia local entre LID y teléfono. Si WhatsApp todavía no expone esa equivalencia, reintenta automáticamente y ofrece el ingreso manual como alternativa después de ocho segundos. Nunca interpreta los dígitos de un LID como un teléfono.
- Los grupos no se vinculan con clientes. No se usa el nombre como criterio de búsqueda ni se elige automáticamente entre varias fichas con el mismo teléfono.
- El teléfono manual dura sólo mientras permanece seleccionado ese chat. Cambiar de conversación, pestaña o conexión limpia el resultado; las respuestas atrasadas se descartan.
- Se muestran hasta tres ítems principales por orden como descripción. El enlace abre todos los detalles en Grafo. Las órdenes sin fecha muestran «Sin fecha acordada».
- Usa la normalización de teléfonos existente en Grafo (`aE164`), incluida su convención móvil para números argentinos. Un sufijo de seis cifras reduce candidatos SQL, pero la coincidencia se verifica por el número normalizado **completo**.
- Las órdenes incluyen borradores y canceladas con su estado explícito; se ordenan por fecha de creación descendente.

## Sesión, permisos y datos

El adaptador `src/whatsapp-active-chat.js` se ejecuta bajo demanda con `chrome.scripting.executeScript` en el contexto `MAIN` de WhatsApp y sólo devuelve identificador, nombre, teléfono y tipo del chat activo. No abre paneles, hace clics, solicita números a otros usuarios ni dispara consultas de red. Chrome devuelve el resultado por su canal de extensión, sin depender de eventos `window.postMessage` de la página. La solicitud se restringe al documento original y al marco principal de WhatsApp. `src/content.js` recibe cada respuesta con un identificador de solicitud y verifica que siga correspondiendo al chat actual antes de avisar al panel. Dos muestras estables evitan tomar el estado transitorio de un cambio de chat; los chats con el mismo nombre se distinguen por su identificador.

El adaptador de lectura consulta los módulos internos `WAWebChatCollection` y `WAWebApiContact`, con los contratos documentados por [WA-JS para el chat activo](https://github.com/wppconnect-team/wa-js/blob/main/src/chat/functions/getActiveChat.ts), [las colecciones](https://github.com/wppconnect-team/wa-js/blob/main/src/whatsapp/stores.ts) y [la caché LID/teléfono](https://github.com/wppconnect-team/wa-js/blob/main/src/whatsapp/misc/LidPnCache.ts). Es una integración local, sin dependencia de WA-JS ni código remoto; estos módulos no son una API oficial estable de WhatsApp y pueden requerir adaptar el código si WhatsApp cambia. El encabezado visible se verifica mediante `src/whatsapp-dom.js`.

La extensión pide acceso fijo únicamente a WhatsApp Web. El acceso al servidor de Grafo es opcional y se solicita al conectar una dirección. Chrome concede permisos de host sin distinguir puertos; la extensión consulta sólo el origen exacto configurado. Desconectar o cambiar de host retira el permiso anterior.

Las consultas del panel usan `GET`; la configuración y la cola de avisos usan `PUT` y `POST`. Todas pasan por el BFF de Grafo, con cookies y sin caché. El BFF lee la cookie httpOnly existente y reenvía la autenticación al API. La extensión no accede al JWT ni guarda contraseñas o contenido de mensajes. En `chrome.storage.local` guarda la URL de Grafo, la vinculación del emisor y el estado del proceso; si se pierde una confirmación HTTP, conserva temporalmente el identificador, el token de reserva y el resultado de ese intento para confirmarlo sin reenviar. Los datos de clientes quedan en la memoria del panel, aislados de la página de WhatsApp.

La API usa el tenant y los permisos efectivos de la sesión. Requiere `crm.ver` para buscar fichas. Para ver órdenes requiere alguno de `produccion.ver`, `comercial.ver`, `administracion.ver` o `administracion.gestionar`, igual que el listado de órdenes. No entrega importes, saldos, márgenes ni tokens públicos de seguimiento.

Se revalida la sesión mientras el panel está visible cada 30 segundos, además de cada consulta. Al cerrar sesión o perder permisos, desaparecen los resultados en la siguiente revalidación. Si hay bloqueo de cookies de terceros, Chrome puede impedir usar la sesión desde la extensión: verificá la sesión, el perfil y la configuración del sitio; esta versión no cambia las políticas de cookies ni incorpora otro método de autenticación.

Endpoints de consulta de contactos:

- `GET /api/backend/chrome-whatsapp/sesion`
- `GET /api/backend/chrome-whatsapp/contexto?telefono=%2B5492966123456`
- `GET /api/backend/chrome-whatsapp/contexto?telefono=...&clienteId=<uuid>` para elegir entre coincidencias.

## Desarrollo y verificación

```sh
npm --prefix apps/whatsapp-extension ci
npm --prefix apps/whatsapp-extension test
npm --prefix apps/api test -- --runInBand whatsapp-contexto.service.spec.ts integraciones/__tests__/telefono.spec.ts
```

Los tests de la extensión usan DOM y módulos de prueba. Verifican detección automática sin clics, equivalencias LID, chats homónimos, recuperación tras carga demorada, rechazo de respuestas viejas, permisos, enlaces y renderizado como texto. Los del backend cubren normalización, contactos secundarios, coincidencias ambiguas, aislamiento del tenant en las consultas y permisos. No modifican datos reales.

`tests/preview.html` permite revisar las tarjetas con datos ficticios desde un servidor estático. No conecta con WhatsApp ni Grafo y no forma parte del flujo normal de la extensión. La prueba completa de cookies y panel nativo requiere cargarla manualmente en Chrome.

Referencias oficiales: [Scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting), [Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel), [content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [solicitudes entre orígenes](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests), [cookies de extensiones](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies).
