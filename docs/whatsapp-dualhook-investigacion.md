# Integración WhatsApp propia vía Dualhook — Investigación

**Fecha:** 2026-08-04 · **Estado:** investigación completa, diseño pendiente
**Objetivo:** cada tenant conecta su propio número de WhatsApp Business; con eso
(a) replicamos las notificaciones que hoy manda Wati y (b) más adelante
construimos una interfaz de chats propia (estilo Wati) dentro del sistema.

Fuentes: documentación completa de dualhook.com (~45 páginas leídas por agentes
el 2026-08-04) + mapeo exhaustivo de la integración Wati actual en este repo.

---

## 1. Qué es Dualhook y por qué encaja

Dualhook es un **Tech Partner de Meta** que resuelve la parte fea de la Cloud
API de WhatsApp sin meterse en el medio de los mensajes:

- **Es dueño de la Meta App**: nosotros no creamos app en Meta, no manejamos
  OAuth, tokens ni `appsecret_proof`. El token BISU (never-expiring) queda
  cifrado en Dualhook y no se nos devuelve por el flujo normal.
- **Embedded Signup co-branded**: el tenant conecta su WABA/número desde una
  URL de onboarding con nuestro logo.
- **Webhook Override**: Meta manda los webhooks de mensajes **directo a nuestro
  servidor** (Dualhook no proxya ni almacena contenido). Los webhooks de
  gestión (plantillas, calidad, cuenta) sí pasan por Dualhook y los reenvía
  normalizados con headers `X-Dualhook-*`.
- **Runtime API**: envíos salientes por `https://api.dualhook.com/v25.0` con el
  **mismo shape que Graph** (mismo path/método/JSON), autenticado con una key
  `dh_live_...` **ligada a exactamente una conexión** (phone_number_id + WABA
  fijos, no falsificables desde el request). Es una allowlist, no un proxy
  Graph general (webhook management, Flows, registration, PINs bloqueados).

### ⚠️ Riesgo #1: la página del producto "Platform" devuelve 410

`dualhook.com/platform` (el tier multi-tenant que necesitamos) devuelve **HTTP
410 Gone real** (verificado por 3 vías), sin snapshot en Wayback y sin mención
en el changelog. Google todavía tiene snippets frescos y detallados.

**Rastreo exhaustivo del 2026-08-04 — el retiro fue deliberado y reciente:**
- El **sitemap.xml no lista** `/platform` ni la guía SaaS (con lastmods del
  sitio hasta el 2026-07-31): delisting intencional, no error de servidor
  (410 = "removido a propósito", le pide a Google que lo desindexe).
- La página viva `/compare/dualhook-vs-bsp` **fue editada para quitar** las
  menciones al tier Platform (el snippet de Google aún muestra la copia vieja).
- El **changelog termina en mayo 2026** y nunca anunció Platform → la página
  se publicó después (jun/jul 2026) y se retiró antes de que Wayback la
  capturara. Traía además un lineup de precios más nuevo (Agency $89/20,
  Platform $115/25 + $4.50) que también se revirtió al viejo (Agency $45/10,
  Enterprise $99/25 + $3.50): parece un lanzamiento dado de baja.
- Sin cobertura de terceros: SaaSworthy tiene precios pre-Platform
  (act. 30/03/2026); nada en Product Hunt/LinkedIn/X/Reddit.
- Apareció `/tech-partner` (2026-07-13) pero es marketing del status de Meta
  Tech Partner, sin programa de partners ni API multi-tenant.

Escenarios posibles: lo despublicaron para terminarlo, lo movieron detrás de
contacto comercial, o lo discontinuaron. **Indistinguible desde afuera: la
única vía es preguntarles a contact@dualhook.com / chat del dashboard.**

## 2. Dualhook Platform (tier multi-tenant) — lo que se sabe

> Todo lo de esta sección viene de snippets indexados de la página retirada;
> los campos exactos hay que confirmarlos con Dualhook.

Flujo de onboarding por tenant:

1. `POST /api/v1/onboarding/sessions` (Bearer `dh_live_*` de partner) con:
   `tenantId`, `tenantName`, redirects `success/failure/cancel`,
   **`webhookOverrideUrl` + `webhookVerifyToken` por tenant**, y `metadata`
   propia (vuelve round-tripped en los eventos).
2. Respuesta: URL one-time `dualhook.com/onboard/<token>`, expira en **1 hora**.
3. El tenant pasa por la página co-branded → popup de Embedded Signup de Meta →
   elige/crea WABA y número → otorga permisos (`whatsapp_business_management` +
   `whatsapp_business_messaging`).
4. Dualhook hace el OAuth exchange, suscribe el Webhook Override a nivel WABA,
   mapea conexión↔tenant y redirige a nuestra URL.

Eventos de lifecycle (Dualhook → nosotros, HMAC-SHA256 del raw body en
`X-Dualhook-Signature`; retries 1m→5m→15m→1h→6h→24h):
`onboarding.completed` (con `tenantId`, `wabaId`, `phoneNumberId`, `metadata`),
`onboarding.failed`, `connection.mode_resolved` (coexistence vs Cloud API
puro), `connection.disconnected`, eventos de heartbeat.

Otros endpoints: `connections` (list/update/disconnect con fan-out a WABAs
hermanas), `POST /api/v1/connections/<id>/reveal-secrets` (devuelve el token
Cloud API de Meta on-demand, audit-logged, `Cache-Control: no-store`) y un
health-refresh. Restricción: dos números bajo la misma WABA **comparten
webhook URL y verify token** (si no coincide → `waba_webhook_conflict`).

**Pricing** (de la página retirada): Platform **$115/mes con 25 conexiones
incluidas + $4.50 por conexión adicional**. El sitio vivo hoy muestra otro
lineup (Enterprise $99/25 + $3.50 extra) — contradicción a resolver con ellos.
Dualhook no cobra por mensaje; la mensajería la factura Meta aparte.

**Billing enforcement**: impago → bloquea runtime saliente e intenta quitar el
override (salvo WABA compartida con conexión viva); downgrade → 5 días de
gracia; pausa no borra config; cancelación revoca keys y borra credenciales.

## 3. Coexistence — la clave del inbox futuro

Un número **ya activo en la WhatsApp Business App** puede usarse a la vez con
la Cloud API (camino de una sola dirección: app → coexistence). El tenant
conserva su app y sus chats; nosotros ganamos el canal API.

Qué recibimos al conectar (todo directo a nuestro endpoint, **sin replay si lo
perdemos**):

- **`history`**: hasta **180 días** de historial en 3 fases (chunks con
  `phase`/`chunk_order`/`progress`, threads por contacto). Grupos excluidos;
  media llega como `media_placeholder` (detalle hasta ~14 días después). El
  negocio puede rechazar compartirlo (error 2593109).
- **`smb_app_state_sync`**: agenda de contactos (sync inicial + cada
  alta/edición/borrado; `action: add/remove`).
- **`smb_message_echoes`**: cada mensaje enviado **desde el teléfono** (con
  `to`, tipo, contenido; también `edit` y `revoke` con `original_message_id`).
  Necesario para espejar en el inbox lo que el tenant chatea por la app.

Costo operativo — **heartbeat de 13 días**: alguien del tenant debe abrir la
Business App al menos cada 13 días o la entrega de webhooks se degrada/corta.
Dualhook no puede detectarlo (ack manual en su UI); estados
`OK/DUE_SOON/OVERDUE/UNKNOWN`, emails dedupe 1/24h. Además Meta desconecta por
`PRIMARY_INACTIVITY` (~14 días) o `COMPANION_INACTIVITY` (~30 días).

Limitaciones en coexistence: sin verificación estándar/OBA, sin Calling API,
sin migración de WABA, grupos fuera del history sync, WhatsApp para
Windows/WearOS incompatibles (y pueden no generar echoes).

Alternativa Cloud API puro: sin heartbeat y con verificación/OBA disponibles,
pero el número **sale de la app** (el tenant pierde su herramienta hasta que
nuestro inbox esté maduro), sin historial ni contactos ni echoes. Para nuestra
etapa, coexistence es el default correcto.

## 4. Webhooks — arquitectura receptora

- Envelope estándar Meta: `entry[].id` = WABA, `value.metadata.phone_number_id`
  → ruteo a tenant. Prioridad de override: número > WABA > app default.
- Verificación inicial: GET challenge con `hub.verify_token`, responder el
  `hub.challenge` crudo con 200.
- **Firma**: el POST viene firmado (`X-Hub-Signature-256`) con el app secret
  **de Dualhook**, que no comparten → no verificable por nosotros. Defensa
  recomendada: **path de webhook con secreto de alta entropía por tenant** +
  validación estricta de WABA/phone_number_id contra la conexión + 401 si no
  matchea.
- Operación: responder 200 en ~250 ms y procesar async; payloads hasta 3 MB;
  retries de Meta hasta 7 días → idempotencia por `wamid`; dimensionar para
  3× la tasa de envío (statuses) + entrantes. **Sin replay** de
  history/echoes/state_sync perdidos.
- `messages` trae `messages[]` (entrantes), `statuses[]`
  (sent/delivered/read + `pricing`/`conversation.origin`) y `errors[]`.
- Gestión (vía Dualhook): `message_template_status_update`,
  `template_category_update`, `phone_number_quality_update`, `account_update`
  (con `disconnection_info`), `business_capability_update`, etc.

## 5. Mensajería y plantillas (Cloud API vía Runtime API)

- **Envío de plantilla**: `POST /<PHONE_NUMBER_ID>/messages` con `type:
  "template"` y componentes **posicionales** (`{{1}}`) — header media, body
  params, botón URL dinámico. Respuesta `wamid` + `message_status: accepted`
  (no es entrega).
- **Ventana de 24 h**: cada mensaje entrante la abre/resetea; dentro, free-form
  y **utility gratis** (`free_customer_service`); fuera, sólo plantillas
  (error 131047 → reenganchar con plantilla).
- **Plantillas por API y por WABA** (= por tenant): `POST
  /<WABA_ID>/message_templates` crea y somete en un paso; categorías
  MARKETING/UTILITY/AUTHENTICATION; estados PENDING→APPROVED/REJECTED (+
  PAUSED/DISABLED...); aprobación y recategorización llegan por webhook.
  Cupo Meta ~10 plantillas/hora ya conocido del flujo Wati.
- **Media**: upload multipart → media ID; documentos (PDF) hasta 100 MB con
  `filename` obligatorio; descarga de entrantes por
  `GET /<MEDIA_ID>/content` con el mismo bearer (persistir a R2 apenas llega).
- **Interactivos** (inbox futuro): botones (3), listas (10×10), cta_url,
  carousel, location_request, reactions — sólo dentro de la ventana.
- **Límites**: 80 msg/s por número; pair rate 1 msg/6 s por destinatario
  (burst 45); tiers de destinatarios únicos/24 h (250→2K→10K→100K→∞, sólo
  conversaciones iniciadas por el negocio); salud consultable en
  `GET /<PHONE_NUMBER_ID>?fields=health_status,...`
  (`can_send_message`, `quality_rating` GREEN/YELLOW/RED, tier).

Errores operativos clave: 131047 (ventana cerrada), 131026 (no es WhatsApp),
132000/132001/132012 (plantilla/params), 131056 (pair rate → backoff 4^X s),
130429 (throughput), 131048 (spam), 190/200 (auth → re-onboarding).

## 6. Lo que ya tenemos (mapa de la integración Wati)

Referencia completa: reporte del agente en esta investigación +
`docs/integraciones-wati-diseno.md`. Síntesis:

**Se conserva casi todo** (es agnóstico del proveedor):
cola `NotificacionWhatsapp` (idempotencia por `claveUnica`, estados,
`programadaPara`), **reserva atómica** del despachador (fix 3b33ee4b), ventana
horaria por zona del tenant, consentimiento (`aceptaWhatsapp` tri-estado,
MARKETING sólo con opt-in explícito), catálogo de 13 plantillas con textos
(D1: textos de Grafo), `aE164()`, links públicos `/t/ /p/ /f/ /c/`, crons con
`CronLock`, UI de Configuración → Integraciones (4 tabs).

**Se reemplaza (3 cosas):**
1. `WatiClient` → cliente Cloud API (Runtime API de Dualhook, mismo shape
   Graph). Interface `ProveedorWhatsapp` como punto de corte —
   `DespachoService` hoy inyecta `WatiClient` directo.
2. Credenciales por tenant: `{endpoint, tenantId, token}` de Wati →
   `{connectionId, phoneNumberId, wabaId, dh_live_key}` — misma tabla
   `IntegracionTenant` (nuevo valor de enum `ProveedorIntegracion`), mismo
   cifrado AES-256-GCM.
3. Parámetros por **nombre** (rareza de Wati) → **posicionales** (la cola ya
   guarda array posicional: quedamos más cerca de Cloud API que de Wati).
   Desaparecen `mapearParametros`, `bodyOriginal` y `broadcastName`.

**Se gana / hay que agregar:**
- Columna `wamid` en `NotificacionWhatsapp` + webhook de statuses →
  `sent/delivered/read/failed` reales (hoy "enviada" = "Wati aceptó").
- Cache del estado de plantillas en DB (hoy `listarPlantillas()` en **cada**
  despacho = 1 llamada de red por mensaje).
- Recrear las 13 plantillas por API en el WABA de cada tenant al conectar
  (cupo 10/h → cron progresivo, ya existe el patrón en `wati.scheduler.ts`).
- Primer endpoint de webhooks entrantes del sistema (hoy sólo hay webhooks de
  pasarelas de cobro).

**Acoplamientos a limpiar:** enum `WATI` en queries crudas de los schedulers
(gatea el drenado de cola por tenant), ~45 menciones "Wati" en
`integraciones-view.tsx`, flag `cableado` (sólo UI, no gatea runtime).

## 7. Alternativas de proveedor (investigación 2026-08-04, post-retiro de Platform)

Dos datos de contexto que reordenan el análisis:
- **Coexistence ya es global** (desde abr–may 2026, Argentina incluida) y es una
  capacidad estándar del Embedded Signup de Meta, no un diferencial de vendor.
- **Embedded Signup v2 muere el 15/10/2026** — todo lo nuevo nace en v4.

### Opción recomendada: Meta directo, nosotros como Tech Provider

Es la figura que Meta diseñó para SaaS multi-tenant (y lo que Dualhook
revendía). **No es un programa selectivo**: Business Verification de la
empresa + App Review de nuestra app (permisos `whatsapp_business_messaging` +
`whatsapp_business_management` con Advanced Access, 2 screencasts, política de
privacidad) + Access Verification. **Sin fees de Meta**; 3–6 semanas de
calendario administrativo (paralelizable con el desarrollo); límite 200
onboardings/7 días (sobra).

- **Multi-tenant**: una sola Meta App sirve N tenants; cada Embedded Signup
  devuelve `{waba_id, phone_number_id, business_id}` por postMessage + un
  `code` (TTL 30 s) que el backend canjea por un **business token por tenant**
  (configurable no-expirante); luego `POST /<WABA_ID>/subscribed_apps` y
  `POST /<PHONE_NUMBER_ID>/register` con PIN.
- **Billing**: cada tenant carga SU tarjeta en WhatsApp Manager y Meta le
  factura directo (Tech Provider no intermedia plata ni necesita línea de
  crédito). En AR: utility ≈ US$0.03–0.04/msg, gratis dentro de la ventana.
- **Coexistence directo**: disponible para Tech Providers (no gateado a BSPs),
  con `history`/`smb_app_state_sync`/`smb_message_echoes` como campos normales
  de webhook. Límite COEX: 20 msg/s, sin grupos, history sync en 24 h.
- **Webhooks**: endpoint único a nivel app para todos los tenants (ruteo por
  `phone_number_id`) + override por WABA/número disponible si hiciera falta.
  **Firma `X-Hub-Signature-256` verificable de verdad** (el app secret es
  nuestro) + `appsecret_proof` en las salientes. mTLS soportado.
- **Esfuerzo**: ~1–2 semanas de ingeniería para onboarding + envío (la
  mensajería ya la conocemos); el inbox es proyecto aparte pero nada de lo que
  necesita está gateado. Mantenimiento: bump de Graph API ~cada 4 meses,
  salud por tenant (cron a `GET /<PHONE_NUMBER_ID>` + webhooks
  `account_update`), soporte de primera línea propio.

### Comparativa (30 tenants)

| Opción | Multi-tenant | COEX | ¿Compite? | Costo plataforma | Riesgo |
|---|---|---|---|---|---|
| **Meta directo (Tech Provider)** | Embedded Signup v4 propio | Sí, AR ok | No | **US$0** | App Review + soporte propio |
| **360dialog Partner** | Integrated Onboarding + Partner API | Sí, documentada | No (API-first) | **≈ €1.000/mes** (Growth €500 + 20×€25) | Precio 10× Dualhook |
| **Dualhook tiers clásicos** | Incierto (Platform retirado) | Sí | No | ≈ US$116/mes | Continuidad; ¿números de terceros? |
| **Gupshup ISV** | Partner API | Sin confirmar | No | ~US$0.001/msg | COEX no verificada; LATAM flojo |
| Twilio | Excelente | **NO** | No | markup/msg | Descartado por COEX |
| Wati | No tiene tier API | Sí (en SU inbox) | **Sí** | — | Competidor directo |
| Whapi/Evolution/Baileys | Sí | "de facto" | — | US$5–12/canal | **No oficial: ban del número del tenant** |

**Decisión sugerida**: ir directo como Tech Provider. Arrancar Business
Verification + App Review YA (corre en paralelo); diseñar contra Cloud API
v25/Embedded Signup v4. Todo lo investigado de Dualhook aplica casi 1:1
(su runtime era Graph-shaped y sus webhooks eran los de Meta). 360dialog queda
de plan B si Meta traba el review. Evitar no-oficiales: el número es EL activo
comercial de la imprenta.

## 8. Preguntas abiertas (para Dualhook y para el diseño)

**Para Dualhook (bloqueantes):**
0. Con el producto clásico (p. ej. Enterprise $99/25+$3.50): ¿el paso de
   Embedded Signup se puede **delegar al cliente final por link** (sin darle
   acceso a nuestro dashboard)? Los docs públicos no lo dicen (verificado
   2026-08-04: embedded-signup, FAQ y support-FAQ no mencionan invitación,
   delegación ni multi-usuario); la "onboarding help" vive en el chat de
   soporte. Es la diferencia práctica entre necesitar Platform o no.
1. ¿El tier Platform está activo? ¿Pricing real ($115+$4.50 vs $99+$3.50)?
2. Campos exactos de request/response de `POST /api/v1/onboarding/sessions` y
   paths de `connections`/health-refresh.
3. Formato exacto de `X-Dualhook-Signature` y provisión del signing secret.
4. ¿Exponen forma de validar `X-Hub-Signature-256` de los webhooks de Meta, o
   la defensa es path secreto + validación de IDs?
5. Expiración real de media IDs/URLs en su ruta de contenido ("estable").
6. Tiempos de aprobación de plantillas y límites de creación por WABA.

**Para el diseño (decisiones nuestras):**
1. ¿Coexistence como default u obligatorio? (Recomendado: default, con Cloud
   API puro como opción avanzada.)
2. Alcance de la Fase 1: ¿sólo paridad de notificaciones + statuses, o ya
   persistir history/echoes/contactos aunque el inbox no exista? (Ojo: el
   history sync del onboarding es one-time y **sin replay** — si no lo
   capturamos al conectar, se pierde. Argumento fuerte para persistir crudo
   desde el día 1.)
3. Convivencia Wati/Dualhook durante la migración (¿interface
   `ProveedorWhatsapp` con ambos, o corte directo por tenant?).
4. Diseño del endpoint de webhooks: URL por tenant con path secreto, cola de
   ingestión, dónde persiste el crudo.
5. Heartbeat de 13 días: qué UI/alertas propias por tenant (además de los
   emails de Dualhook) — banner, WhatsApp al dueño, estado en Integraciones.
6. Repercusión del costo por conexión (~$4.50/mes/tenant) en los planes Paddle.
7. Modelo de datos del inbox (conversaciones/mensajes/contactos) — se diseña
   en la fase 2, pero la ingestión de la fase 1 debe serle compatible.
