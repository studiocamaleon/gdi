# Inbox: bienvenida y adjuntos privados

Implementación local del 26/09/2026, rama `codex/inbox-adjuntos-bienvenida`. Continúa el bloque de [importación y reconexión](meta-importacion-reconexion.md). No se desplegó en staging ni se activaron llamadas reales a Meta.

## Actualización de staging — 27/09/2026

El lote ya está habilitado en el **canal oficial de prueba**, limitado a la empresa y destinatario autorizados. Staging tiene 295 migraciones. Se corrigió y recuperó un PNG real recibido con tipo `document`: Meta → worker → R2 privado → vista previa de Chrome, con cuota contabilizada una sola vez y aviso en vivo.

Las tarjetas ahora muestran una fila compacta de 300 px, nombre en hasta dos líneas y botón lateral. La imagen sólo se despliega después de pedir acceso. Los formatos pasivos conocidos enviados como documentos conservan el límite de su MIME real: por ejemplo, un PNG sigue limitado a 5 MB.

La validación vigente está en [VALIDACION.md](../deploy/staging/VALIDACION.md). Las pruebas iniciales y el protocolo de abajo son históricos; el ensayo real no acredita todavía todos los formatos, carga, historial o coexistencia. La reanudación puntual del PNG fue una operación del operador con registro privado, no una interfaz de reintento disponible para usuarios.

## Qué cambia para quien usa Grafo

- La bienvenida presenta el producto con la tipografía, naranja y superficies de Grafo. El ejemplo de conversación está identificado como ilustrativo. Funciona en escritorio, celular y tema oscuro; mantiene el botón de conexión sujeto a la configuración real.
- Un mensaje con archivo informa si Grafo está preparando la copia, si está disponible o si necesita revisión. Los marcadores del historial sin archivo conservan su explicación; no se presentan como descargas listas.
- «Abrir archivo» solicita acceso temporal. Imágenes y stickers se muestran en el chat; audio y video tienen controles del navegador, cuando éste admite el formato. Los documentos se descargan. No hay reproducción automática.
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
- Archivos privados bajo `INBOX`, aislados de las rutas genéricas de archivos. Documentos forzados como descarga. No hay carga manual de archivos con ese scope.
- Revalidación de permisos antes y después de firmar; los mensajes revocados y las conexiones que dejan de ser válidas no generan enlaces nuevos. Un enlace ya emitido puede seguir vigente durante sus 60 segundos.
- El acceso mantiene el alcance actual del Inbox: administración/configuración de la empresa. Plataforma, MCP e impersonación no habilitan la apertura. Los permisos de agentes son un bloque posterior.

## Estado local y validación

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
