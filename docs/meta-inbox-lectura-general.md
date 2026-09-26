# Conversaciones generales del Inbox

26/09/2026 · `codex/inbox-conversaciones-generales` · Sólo desarrollo local.

Base del bloque: `562b0d112`. API y autorización: `b5b6c3c48`. Pantalla y vista de prueba: `3b73946de`.

## Qué incorpora este bloque

La pantalla ya puede consultar varias conversaciones de la empresa, buscar por nombre o teléfono, cambiar de chat y cargar mensajes anteriores. El contexto sigue identificándose por el teléfono completo del contacto: si coincide con una ficha de Grafo, se muestran sus datos y órdenes según los permisos del operador.

Los mensajes entrantes y salientes tienen lados distintos. Se presentan estados de entrega, ediciones, eliminaciones, mensajes del historial y mensajes enviados desde WhatsApp Business. Los adjuntos muestran su tipo y texto descriptivo; todavía no se descargan ni se abren. El editor de respuestas permanece deshabilitado.

La lectura usa las tablas generales de [recepción](meta-inbox-recepcion.md). El [transporte en vivo](inbox-tiempo-real.md) comparte la revisión duradera y los avisos de Redis que ya estaban implementados; ahora resuelve el vínculo propio de cada empresa. No se agregó otro servicio cloud.

## Cómo probarlo sin Meta

- App local: `http://localhost:3000`.
- Muestra de esta pantalla: `http://localhost:3000/dev/diseno/inbox/conversaciones`. Tres contactos ficticios permiten probar cambio de chat, búsqueda, historial, contexto encontrado y teléfono sin ficha. Está identificada como demo y sólo existe en desarrollo.
- La muestra no escribe en ninguna base, no conecta Meta y no simula un canal de eventos real. Las pruebas del servidor sí recorren webhook, procesador, PostgreSQL, bus y SSE con datos sintéticos en `gdi_saas_test`.
- `/inbox` continúa usando la sesión y datos reales de la empresa local. Sin un canal habilitado muestra la bienvenida de conexión. La muestra de diseño anterior sigue separada.

## Activación y permisos

`META_INBOX_LECTURA_ENABLED=false` es el valor por defecto y el utilizado en la API local durante este trabajo. Con `true`, lectura, disponibilidad y SSE resuelven `MetaVinculo` de la empresa autenticada: verificado, con recepción preparada y credencial no vencida. No hay fallback silencioso al piloto si falta el vínculo general.

Este flag sólo cambia la lectura. No inicia altas, descarga historiales, envía mensajes ni habilita el worker. Alta y recepción conservan sus propias barreras. Los modos reales siguen apagados; no se configuró Meta ni se desplegó staging.

Se exige sesión vigente, usuario y empresa activos, membresía administradora, permiso `configuracion.gestionar`, IP permitida y capacidad de WhatsApp del plan. Se excluyen plataforma, impersonación y MCP. El contexto del cliente usa la intersección entre los permisos autenticados y los actuales de la membresía. No se habilitaron todavía roles de agentes del Inbox.

La respuesta sólo contiene campos previstos para la pantalla. No incluye tokens, datos crudos, URLs remotas ni IDs de medios. No se admite elegir otra empresa, cuenta de WhatsApp o teléfono desde el navegador. Una reconexión cambia la identidad de la lectura y evita mezclar resultados anteriores.

## Páginas y actualización

- Conversaciones: 50 por página, ordenadas por fecha del último mensaje e ID. La búsqueda se ejecuta en el servidor, también sobre contactos que todavía no se cargaron. El cursor está asociado al vínculo, su autorización y la búsqueda.
- Mensajes: 50 por página, ordenados por fecha original e ID. Cada cursor se valida dentro de la conversación y empresa solicitadas.
- En un aviso en vivo se refresca todo el tramo visible desde su mensaje más antiguo, con un máximo de 500. Así una edición o eliminación anterior a la última página no deja un texto desactualizado en pantalla.
- Si el tramo supera 500, se presenta la ventana más reciente con un aviso y un cursor para volver a cargar anteriores. La UI conserva la posición de lectura cuando no necesita acotar esa ventana.
- Al actualizar se reconcilia la primera página de conversaciones. Las páginas adicionales se pueden volver a cargar; no se pretende conservar una lista antigua mientras cambian sus posiciones.
- Cambiar de chat retira inmediatamente mensajes y contexto previos. Las respuestas tardías y las identidades que no coinciden se descartan.
- SSE vuelve a comprobar autorización antes de emitir y cada 15 segundos. Revocar el vínculo, cambiar su generación, retirar permisos o exigir cambio de contraseña cierra el acceso, incluso sin mensajes nuevos.

El indicador de actualización en vivo describe la conexión de la pantalla con Grafo. No asegura que Meta haya entregado todo un historial.

## Validación y pendientes

No se agregó ninguna migración: local y tests permanecen en 288. No se ejecutaron seeds ni se modificaron datos de la empresa local para simular WhatsApp.

Pruebas de este bloque: varias conversaciones, búsqueda y cursores, aislamiento entre empresas y chats, contexto por teléfono, permisos, credenciales vencidas, cambio de generación, complementos huérfanos, refresco de ediciones/eliminaciones, límite de 500, estados de entrega, cambios rápidos de selección y circuito completo de recepción hasta SSE. Se incluye regresión del piloto anterior.

Resultado: **297 pruebas de API y 57 de web aprobadas**; TypeScript de API y web, ESLint de la implementación modificada y comprobación de diff sin errores. Revisión en Chrome de los tres contactos, cambio de contexto, búsqueda y presentación de mensajes. API y web respondieron 200 al terminar; ambos workers siguen activos. No se compiló un contenedor de producción ni se realizó una prueba de carga.

Siguientes bloques: reconciliar importaciones y eventos tardíos; desconexión/reconexión coordinada; adjuntos privados; envíos, plantillas y ventana de atención; roles del equipo; carga, conservación y métricas. Después corresponde validar el lote en staging y ensayar el alta real con los mecanismos de Meta disponibles. La aprobación de la app no convierte las pruebas sintéticas en validación de coexistencia real.

Ampliación del 26/09: [estado de importación y reconexión](meta-importacion-reconexion.md) incorpora el panel Conexión, el resumen de lo recibido y el ciclo de pausa/restauración. No habilita todavía archivos ni envíos.
