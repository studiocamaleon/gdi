# Canal de prueba de Meta dentro de Grafo Inbox

## Qué permite

Probar el Inbox con el número oficial de prueba de Meta antes de conectar números de clientes: recibir mensajes, responder dentro de las 24 horas, enviar plantillas aprobadas y ver sus estados. Usa los mismos permisos, almacenamiento, cola de recepción y avisos en vivo del Inbox.

El canal queda identificado como **PRUEBA**, con una única empresa y un único destinatario autorizado. La pantalla muestra esa condición y el vencimiento del acceso. No solicita contactos ni historial del celular. La conexión mediante Embedded Signup y la importación en coexistencia requieren su propio ensayo con un número elegible.

## Estado al 27/09/2026

- Implementado en `codex/inbox-canal-pruebas`, desde `393096f32`.
- Migración aditiva `20260927200000_inbox_canal_prueba` aplicada en desarrollo y tests: **294 migraciones**, sin seed/reset. Los vínculos existentes conservan el tipo `COEXISTENCIA`.
- Activación comprobada con un cliente de Graph simulado; credencial cifrada, sin inventar una autorización de Embedded Signup ni una solicitud de historial.
- Ensayo local integrado con PostgreSQL y Redis: firma → webhook persistido → trabajo → conversación → respuesta → estados → dos suscripciones SSE, con instancias separadas del bus. Graph es simulado y se prohíbe toda llamada HTTP externa durante ese test.
- Comprobados duplicados, aislamiento entre empresas, destinatario ajeno, firma falsa, permisos, plan, token vencido, desconexión, trabajo pendiente al vencer el acceso y renovación fallida. La escritura se revalida antes del POST, después de preparar archivos si corresponde.
- Interfaz revisada en Chrome con datos ficticios. Muestra local: `/dev/diseno/inbox/prueba`; no existe en producción.
- **Activado en staging sobre `ca59f3a242d3`**, con API, web y ambos workers del mismo lote. El primer envío desde el Inbox fue rechazado por Meta con `131030`: el número de la lista de prueba difiere del identificador recibido en los webhooks. El intento quedó registrado y apareció en una segunda pestaña sin recargar; no se entregó. La corrección separa el destino explícito de prueba de la identidad de la conversación y aún requiere repetir el envío real. Ver [validación](../deploy/staging/VALIDACION.md).

La corrección agrega `20260927210000_inbox_destino_prueba`: **295 migraciones** en local/tests. El nuevo campo se inicializa conservando el destino anterior. Cambiar la configuración de destino cierra el canal hasta una nueva activación acreditada; no redirige envíos en curso, no cambia el contacto ni reintenta mensajes rechazados.

## Cómo se mantiene limitado

La configuración del servidor determina empresa, cuenta, número y destinatario. El navegador no puede cambiarlos. Si falta un dato, el entorno no es staging, vence el token o cambia la configuración, se cierran lectura, envío, recepción y acceso al stream del canal de prueba. Un mensaje entrante no equivale a un evento de lectura.

La activación consulta Graph para verificar aplicación, permisos, vencimiento, pertenencia del número a la cuenta y suscripción de la aplicación al webhook. Sólo hace consultas. El comando de activación no registra números, no suscribe aplicaciones, no solicita historial y no envía mensajes. No reemplaza un vínculo de coexistencia existente.

Renovar conserva los mensajes, crea una nueva generación del acceso y exige una entrada nueva para abrir la ventana de respuesta. Los envíos inciertos o todavía en curso deben aclararse antes de renovar: no se reenvían automáticamente.

## Preparación de staging, en orden

1. Compilar y verificar el lote completo en remoto. Hay **12 migraciones** desde el piloto original de 283 hasta este lote de 295. Staging ya recibió las primeras 11; aplicar sólo las pendientes. Revisarlas junto con [el procedimiento de staging](../deploy/staging/README.md); no copiar sólo el frontend.
2. Aplicar migraciones con el rol migrador, sin seed/reset, y verificar los permisos del rol de ejecución. Publicar una versión coherente de API, web y workers, conservando los tamaños y recursos autorizados. Mantener inicialmente apagados los interruptores de Meta.
3. Preparar en **API y worker principal** las variables de la tabla. La clave de cifrado debe ser la misma para ambos; los tokens de cada canal se leen cifrados de PostgreSQL. Next, el worker PDF y Gotenberg no necesitan las credenciales de Meta.
4. Confirmar en Meta que sigue habilitado el destinatario de prueba. Configurar por separado el `wa_id` exacto recibido en el ensayo y el destino E.164 exacto registrado en la lista de Meta. La relación debe estar acreditada por el operador; no transformar números por heurísticas. Comprobar que el token temporal siga vigente y que la app continúe suscripta.
5. Ejecutar el operador de activación con secretos privados en el entorno del proceso y `DATABASE_URL` del rol de ejecución. El script sólo admite la base remota `grafoprint_staging`, identificada también con `DEPLOY_DATABASE_NAME`.
6. Apagar el piloto anterior y habilitar los interruptores del Inbox para este ensayo. Abrir la empresa demo, confirmar el aviso de prueba y el vencimiento, y ejecutar el recorrido real descrito debajo.

| Variable | Uso |
| --- | --- |
| `GRAFO_DEPLOY_ENV=staging` | Identifica explícitamente el entorno autorizado. |
| `META_INBOX_PRUEBA_ENABLED=true` | Habilita este canal, además de los interruptores del Inbox. |
| `META_INBOX_PRUEBA_TENANT_ID` | UUID de la única empresa de ensayo. |
| `META_INBOX_PRUEBA_WABA_ID` | Cuenta oficial de prueba comprobada en Meta. |
| `META_INBOX_PRUEBA_PHONE_NUMBER_ID` | Identificador del número de prueba de esa cuenta. |
| `META_INBOX_PRUEBA_DESTINATARIO_WA_ID` | Identidad canónica recibida por webhook, sólo dígitos. Se usa para conversación, recepción y estados. |
| `META_INBOX_PRUEBA_DESTINO_E164` | Número exacto autorizado en la lista de Meta, con `+`. Sólo el canal de prueba lo usa para el POST de envío. |
| `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_API_VERSION` | Aplicación propia y versión de Graph, actualmente `v26.0`. |
| `INTEGRACIONES_ENCRYPTION_KEY` | Cifra el token en la base; no reemplazar una clave existente. |
| `META_INBOX_PRUEBA_ACCESS_TOKEN` | Sólo para el proceso operador de activación/renovación; nunca para el frontend ni como argumento de consola. |

Los interruptores operativos son `META_INBOX_RECEPCION_ENABLED`, `META_INBOX_LECTURA_ENABLED`, `META_INBOX_ENVIOS_ENABLED` y `META_INBOX_PLANTILLAS_ENABLED`. La copia de archivos necesita además `META_INBOX_ADJUNTOS_ENABLED`. Mantener `META_CONEXION_MODO` vacío y `META_WHATSAPP_PILOT_ENABLED=false`: el ensayo no habilita coexistencia ni el envío del piloto anterior. La API conserva su excepción de webhook firmado y verify token de staging.

Desde `apps/api` de la imagen compilada, con el entorno privado ya cargado:

```sh
node scripts/deploy/activar-meta-prueba.cjs --activar
```

La salida sólo comunica tipo, vencimiento y resultado. Si falla, no cambia el vínculo anterior. No colocar claves, números privados ni identificadores reales en este documento, el PR o los logs.

## Ensayo real que falta

1. Abrir dos sesiones del Inbox en la empresa de ensayo. La conversación inicial estará vacía; no se inventan mensajes ni una ventana de 24 horas.
2. Enviar una plantilla aprobada al destinatario ya autorizado, desde Grafo y con un identificador de prueba nuevo. Comprobar un solo intento y registrar su correlación de manera privada.
3. Abrirla y responder desde WhatsApp. Verificar que la entrada aparezca en ambas sesiones sin recargar y que se habilite la respuesta libre.
4. Responder desde Grafo. Comprobar aceptación, entrega y lectura sólo si Meta envía cada evento. Si no llega `read`, dejarlo pendiente, sin inferirlo.
5. Comprobar recuperación al reconectar y ausencia de mensajes duplicados. Probar un archivo ficticio recibido y después la plantilla con PDF cuando esté aprobada. Registrar versión, evidencias y limitaciones en `deploy/staging/VALIDACION.md`.

## Apagado o vuelta a una versión anterior

Apagar `META_INBOX_PRUEBA_ENABLED` en API y worker cierra este canal en el código nuevo. **Antes de restaurar imágenes anteriores que no conocen `tipo=PRUEBA`**, apagar también lectura, recepción, envíos, plantillas, adjuntos, el piloto y el modo de conexión en ambos procesos. No borrar tablas ni deshacer migraciones; conservar los mensajes y el registro de intentos. Una imagen anterior no garantiza los límites del canal nuevo.

## Fuente

[Meta: Get Started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started), consultada el 27/09/2026 (la página indica actualización del 16/06/2026): número y credenciales temporales de prueba, destinatarios autorizados, ventana de atención y webhooks. La disponibilidad de coexistencia se valida por separado.
