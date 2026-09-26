# Conexión de WhatsApp por empresa

26/09/2026 · Rama `codex/meta-alta-sincronizacion` · Desarrollo local.

## Estado actual

El recorrido de autorización ya tiene pantalla, endpoints protegidos y trabajo persistente en el servidor. **Las conexiones reales siguen deshabilitadas.** No se modificaron Meta, staging, producción ni sus secretos.

Hay dos modos de ensayo, elegidos por el servidor y limitados a empresas específicas:

| Modo | Qué comprueba | Qué no hace |
| --- | --- | --- |
| Sandbox | Autorización, canje del código y acceso a la WABA de ensayo previamente configurada | No crea un canal, no conserva el token al finalizar, no suscribe ni importa chats |
| Coexistencia | Autorización de un número que conserva WhatsApp Business, suscripción y solicitudes iniciales de datos | No garantiza que Meta haya entregado todo el historial ni habilita por sí solo envíos |

El modo `sandbox` de Grafo **no crea una cuenta sandbox en Meta**. Hay que reclamarla primero en Meta Developers → WhatsApp → Inicio rápido → Testear integraciones, obtener su WABA y configurar ese ID en el servidor. El alta de prueba rechaza otra cuenta. En el popup hay que seleccionar los activos de sandbox; elegir activos reales puede modificarlos en Meta antes de que Grafo reciba el resultado.

Meta permite a administradores/desarrolladores de la app ensayar con sus propias cuentas. El sandbox de Embedded Signup dura 30 días y no intercambia mensajes; el número de prueba de Cloud API es otro mecanismo. No encontramos un sandbox documentado que entregue seis meses de historial ficticio. El acceso avanzado sigue siendo necesario para incorporar clientes externos. [Sandbox y revisión](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview), [implementación y pruebas](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation).

## Recorrido implementado

```text
Administrador de la empresa abre Inbox
               ↓
Consulta disponibilidad (sin iniciar ninguna autorización)
               ↓ clic explícito
Grafo prepara un intento privado de 15 minutos y carga el SDK
               ↓ segundo clic: Continuar con Meta
Meta presenta su autorización
               ↓ código canjeado inmediatamente en el servidor
Grafo comprueba aplicación, permisos y activos en Graph
               ├─ Sandbox: acredita el ensayo y retira el token
               └─ Coexistencia: vínculo verificado + trabajo persistente
                                      ↓ worker, sin depender del navegador
                              Preparar recepción de webhooks
                                      ↓
                              Suscribir la WABA
                                      ↓
                              Solicitar contactos
                                      ↓
                              Solicitar historial
                                      ↓
                              Recibir y procesar eventos por lotes
```

Se utiliza el recorrido documentado de Embedded Signup v4. No se fuerzan parámetros retirados de v2/v3. El segundo clic permite abrir la ventana de Meta directamente desde una interacción del usuario, después de cargar el SDK.

El código se envía al servidor al recibirlo, sin esperar el evento con los activos: Meta le da una vigencia de 30 segundos. Los eventos del popup pueden llegar antes o después; sólo se aceptan orígenes exactos de Facebook y datos con el formato esperado. Los IDs se vuelven a verificar en Graph; no se confía en el navegador. [Implementación oficial](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation).

## Protección y recuperación

- El intento pertenece a empresa, usuario, membresía y sesión. Su secreto aleatorio sólo vive en memoria del navegador y viaja en POST; en la base se guarda su hash. No se conservan códigos ni se imprimen credenciales en logs.
- El servidor vuelve a comprobar sesión, rol, permiso, IP y capacidad del plan después de las llamadas externas. Soporte impersonando, plataforma y MCP no pueden autorizar el alta.
- El token se cifra con AES-256-GCM. Sus vencimientos vienen de Meta y se comprueban antes de activar cada paso.
- PostgreSQL reclama cada operación antes de llamar a Meta. Dos peticiones o workers no repiten el mismo canje ni las solicitudes iniciales. No hay transacciones abiertas durante las llamadas de red.
- El SDK se carga sólo por una acción explícita sobre HTTPS. Cancelar o desmontar la pantalla invalida el flujo local y pide cancelar el intento pendiente. Si se cierra el navegador sin esa petición, el vencimiento del servidor sigue limitando el intento.
- El worker retira credenciales de intentos pendientes vencidos. Si el flujo ya fue verificado y se creó el trabajo de alta, cerrar la pestaña no lo pierde.
- Una caída durante un POST puede dejar una respuesta incierta. Pasados dos minutos, un paso que quedó en vuelo pasa a **Revisión**. No vuelve a solicitar datos automáticamente. Si Meta rechazó la operación, también queda detenido con un código interno.
- Antes de cada paso se comprueban empresa habilitada, configuración, capacidad, credencial, vigencia y generación del vínculo. Una desconexión durante la red no reactiva el canal al guardar la respuesta. Una llamada ya enviada no se puede retirar.
- Un vínculo activo con trabajo de alta impide comenzar otra autorización. Hay que resolver su estado antes de intentar una reconexión; no se usa el botón como mecanismo de reimportación.
- Se reserva un número y una WABA por empresa. Descartar localmente el vínculo retira su token y conserva la reserva para evitar atribuir eventos atrasados a otra empresa. Ese método interno no revoca el permiso en Meta y todavía no se expone como botón de desconexión general.

## Solicitud y recepción son pasos distintos

En coexistencia se omite registrar nuevamente el número. Se suscribe la WABA mediante `POST /{WABA_ID}/subscribed_apps`; luego se solicita `smb_app_state_sync` y `history` mediante `POST /{PHONE_NUMBER_ID}/smb_app_data`. Los `request_id` se guardan como constancia de aceptación; no como prueba de importación terminada.

La ventana inicial documentada es de 24 horas. Grafo usa como inicio conservador la preparación del intento, anterior al alta de Meta. No repite automáticamente una solicitud cuyo resultado sea incierto. [Alta para Tech Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider), [coexistencia](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users).

La pantalla muestra preparación, solicitudes aceptadas, progreso informado por Meta, historial no compartido o necesidad de revisión. **100% informado no significa importación reconciliada.** Ver [recepción por lotes](meta-inbox-recepcion.md). El estado del alta se consulta cada cinco segundos mientras hay un vínculo; esto es independiente del transporte en tiempo real del chat.

## Qué falta, en orden

1. Completado en local: [lectura general, lista de conversaciones, paginación y SSE por empresa](meta-inbox-lectura-general.md). Continúa apagado mediante `META_INBOX_LECTURA_ENABLED=false`; no se validó todavía con datos reales de coexistencia.
2. Reconciliar bloques de historial y eventos tardíos, resolver resultados inciertos y ofrecer desconexión/reconexión coordinada. No hay aún un botón que repita una importación.
3. Medir recepción y procesamiento con carga representativa, revisar el límite HTTP de 3 MB y la capacidad compartida del worker; añadir métricas y reglas de conservación de crudos.
4. Desplegar el lote revisado a staging con flags apagados, registrar dominios HTTPS y configurar Facebook Login for Business. Activar primero el sandbox para una empresa de ensayo; probar allí el SDK real y documentar su resultado.
5. Ensayar coexistencia con un número propio elegible y los permisos disponibles. Confirmar suscripciones de la app, recepción firmada, solicitudes, revocación desde WhatsApp Business y reconexión. Las pruebas simuladas no sustituyen ese recorrido.
6. Completar envíos, ventanas de atención, plantillas, descarga privada de archivos y tipos de mensaje pendientes antes de presentar la integración como terminada.

La aprobación de Meta no sustituye estas validaciones ni habilita sola los flags de Grafo.

## Configuración del servidor

Valores privados, fuera de Git:

- Existentes: `META_APP_ID`, `META_APP_SECRET`, `META_EMBEDDED_SIGNUP_CONFIG_ID`, `META_GRAPH_API_VERSION`, `INTEGRACIONES_ENCRYPTION_KEY`.
- `META_CONEXION_MODO`: vacío deshabilita el alta; `sandbox` permite sólo la autorización de ensayo; `coexistencia` permite solicitar datos reales.
- `META_CONEXION_TENANT_IDS`: UUID de empresas de ensayo, separados por comas. Vacío significa ninguna.
- `META_SANDBOX_WABA_ID`: WABA de la cuenta sandbox reclamada en Meta. Obligatorio en modo sandbox.
- `META_INBOX_RECEPCION_ENABLED=true`: además del modo y la lista, necesario para coexistencia. Preparar API y calc-worker juntos.
- `META_INBOX_LECTURA_ENABLED=true`: habilita en la API la lectura y el stream generales. No activa recepción ni solicitudes. Sigue en `false` durante este recorrido local.

No copiar credenciales de staging a local. Los valores reales siguen sin habilitarse. `GRAFO_LOCAL_DISABLE_CRON=true` con `NODE_ENV=development` mantiene apagados tanto el alta automática como el procesador de recepción en este recorrido local. Los tests invocan los servicios directamente con cuentas ficticias y Graph simulado.

## Migración y verificación

La migración aditiva `20260926140000_meta_alta_sincronizacion` agrega el modo de autorización y la tabla `MetaAlta`, con estados, vencimiento, referencias de solicitudes y vínculo compuesto por empresa. Aplicada únicamente en `gdi_saas` y `gdi_saas_test` locales: **288 migraciones**, sin seed ni reset. No se alteraron los contenedores ni la memoria de Docker.

**Resultado del bloque:** 270 pruebas de API y regresión, más 45 de frontend, aprobadas. TypeScript de API y web y ESLint de implementación aprobados. Permisos de lectura/escritura de `grafo_app` verificados sobre `MetaAlta`; cero altas reales creadas en local. Revisión visual de la bienvenida en Chrome y API local respondiendo.

Pruebas: contratos Graph, autorizaciones concurrentes, selección de sandbox, orden y exclusión entre workers, reinicio con respuesta incierta, expiración, desconexión durante la red, aislamiento, permisos HTTP, origen de eventos del SDK, código inmediato, cancelación, respuesta tardía y estados de la interfaz. No se conectó una cuenta real para ejecutarlas.

Comandos, Node 24, en serie y con hasta 3 GB para cada comprobación:

```sh
# Desde apps/api
NODE_OPTIONS=--max-old-space-size=3072 npx jest --runInBand --testPathPatterns='integraciones/meta/|webhooks-whatsapp/|inbox-tiempo-real/|prisma/__tests__/tenant-guard|prisma/__tests__/aislamiento-tenants|prisma/snapshots.extension.integration' --silent
NODE_OPTIONS=--max-old-space-size=3072 npx tsc -p tsconfig.build.json --noEmit --incremental false

# Desde la raíz
NODE_OPTIONS=--max-old-space-size=3072 npx vitest run src/lib/meta-signup-sdk.test.ts src/components/inbox/inbox-conexion.test.tsx src/components/inbox/inbox-view.test.tsx src/components/app-sidebar-inbox.test.tsx src/app/inbox/page.test.tsx src/lib/inbox-tiempo-real.test.ts --maxWorkers=1
NODE_OPTIONS=--max-old-space-size=3072 npx tsc --noEmit --incremental false
```

No usar el filtro `meta-`: también coincide con el nombre absoluto de este worktree y seleccionaría pruebas ajenas. Referencias de Meta consultadas el 26/09/2026. Tablas, bloqueos, estados y límites internos son decisiones de implementación de Grafo.
