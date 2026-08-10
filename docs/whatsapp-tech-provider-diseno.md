# WhatsApp propio por tenant — Meta directo como Tech Provider — Diseño

**Fecha:** 2026-08-09 · **Estado:** DISEÑO — proceso Meta iniciado (App + Portfolio creados)
**Base:** `docs/whatsapp-dualhook-investigacion.md` (investigación 2026-08-04, decisión: Meta directo)
**Objetivo F1:** cada tenant conecta SU número de WhatsApp Business vía Embedded Signup y las 13 plantillas del catálogo salen por su número (hoy salen por el de Wati). Con statuses reales (sent/delivered/read) y la ingesta cruda lista para el inbox de F2.

---

## 1. Decisiones (cerradas acá, recomendadas por la investigación)

| # | Decisión | Elección | Por qué |
|---|---|---|---|
| D1 | Proveedor | **Meta directo, nosotros Tech Provider** | US$0 de plataforma, firma de webhooks verificable de verdad, sin intermediario que pueda desaparecer (Dualhook retiró Platform) |
| D2 | Modo de conexión | **Coexistence por default**, Cloud API puro como opción avanzada | El tenant conserva su app de WhatsApp Business y sus chats; es lo que una imprenta chica necesita. Costo: heartbeat de 13 días (ver §8) |
| D3 | Convivencia con Wati | **Interface `ProveedorWhatsapp`** con ambas implementaciones; corte por tenant | Migración gradual sin big-bang; Wati sigue para quien ya lo usa hasta deprecarlo |
| D4 | Alcance F1 | Paridad de notificaciones + statuses + **persistir crudo history/echoes/contactos** | El history sync del onboarding es one-time y SIN replay: si no lo capturamos al conectar, se pierde para siempre. El inbox de F2 lo va a necesitar |
| D5 | Ruteo de webhooks | **Endpoint único a nivel app**, ruteo por `phone_number_id` | Es el modelo natural de Tech Provider; sin URL por tenant (la firma con NUESTRO app secret hace innecesario el path secreto) |
| D6 | Tokens por tenant | Business token **no expirante** del code exchange, cifrado AES-256-GCM en `IntegracionTenant` | Mismo patrón que las credenciales Wati (`secretos.service.ts`); `pista` + nunca vuelve por API |

## 2. Arquitectura

```
Tenant (Integraciones → WhatsApp propio)
  └─ Embedded Signup v4 (popup de Meta, co-branded con nuestra App)
       └─ postMessage {waba_id, phone_number_id, business_id} + code (TTL 30s)
            └─ POST /api/integraciones/whatsapp/conectar  (backend canjea)
                 ├─ GET oauth/access_token (code → business token no expirante)
                 ├─ POST /<WABA_ID>/subscribed_apps        (suscribe webhooks)
                 ├─ POST /<PHONE_NUMBER_ID>/register (PIN)  (si Cloud API puro)
                 └─ guarda IntegracionTenant {wabaId, phoneNumberId, businessId, token cifrado}

Meta → POST /api/webhooks/whatsapp   (endpoint único, público)
  ├─ GET: hub.challenge (verify token de la app)
  ├─ POST: X-Hub-Signature-256 verificada con NUESTRO app secret
  ├─ 200 en <250ms → cola de ingesta async (payload crudo persistido)
  └─ ruteo: value.metadata.phone_number_id → IntegracionTenant → tenant

Salidas: CloudApiClient (implementa ProveedorWhatsapp)
  └─ POST graph.facebook.com/v25.0/<PHONE_NUMBER_ID>/messages
      (bearer = token del tenant + appsecret_proof)
```

## 3. Modelo de datos

### 3.1 Credenciales — reusa `IntegracionTenant`

Nuevo valor de enum `ProveedorIntegracion`: **`META_WHATSAPP`**. En `credencialesCifradas`:
`{ wabaId, phoneNumberId, businessId, token }` (token cifrado con el patrón existente). Campos de estado en `configJson`: `modo` (`coexistence`|`cloud_api`), `displayPhoneNumber`, `qualityRating`, `ultimoHeartbeat` (§8).

### 3.2 Cola de notificaciones — se conserva, dos columnas nuevas

`NotificacionWhatsapp` ya es agnóstica del proveedor (claveUnica, estados, programadaPara, ventana horaria, params posicionales). Se agrega:
- `wamid String?` — id de Meta del mensaje enviado (para matchear statuses).
- `estadoEntrega String?` — `sent|delivered|read|failed` (hoy "enviada" solo significa "el proveedor aceptó").

### 3.3 Cache de plantillas por tenant — tabla nueva

```prisma
model PlantillaWhatsappTenant {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @db.Uuid
  codigo       String   // clave del catálogo interno (13 plantillas)
  nombreMeta   String   // nombre en el WABA
  estado       String   // PENDING | APPROVED | REJECTED | PAUSED | DISABLED
  categoria    String   // UTILITY | MARKETING | AUTHENTICATION
  idMeta       String?
  detalleJson  Json?    // cuerpo sometido + motivo de rechazo
  actualizadoEl DateTime @updatedAt
  @@unique([tenantId, codigo])
}
```
Mata el problema actual de Wati (`listarPlantillas()` = 1 llamada de red POR despacho); el estado se actualiza por webhook `message_template_status_update`.

### 3.4 Ingesta cruda (D4) — tabla nueva

```prisma
model WebhookWhatsappCrudo {
  id         String   @id @default(uuid()) @db.Uuid
  tenantId   String?  @db.Uuid   // null si no se pudo rutear
  tipo       String   // messages | statuses | history | smb_app_state_sync | smb_message_echoes | template_update | account_update | ...
  wamid      String?  // idempotencia cuando aplica
  payload    Json     // el value crudo de Meta
  procesado  Boolean  @default(false)
  recibidoEl DateTime @default(now())
  @@index([tenantId, tipo])
  @@index([wamid])
}
```
F1 solo persiste y procesa `statuses` + `template_update` + `account_update`; history/echoes/contactos quedan guardados crudos para el inbox (F2 los materializa). Retención: definir purga (90 días para lo ya procesado, history/echoes sin purga).

## 4. Onboarding — Embedded Signup v4

1. **Config en Meta App** (una vez): Facebook Login for Business → configuración de Embedded Signup, con `whatsapp_business_messaging` + `whatsapp_business_management`. Genera un `config_id`.
2. **UI**: Integraciones → card "WhatsApp propio" → botón "Conectar mi número" → SDK JS de Facebook (`FB.login` con `config_id`, `response_type: 'code'`, `override_default_response_type: true`) + listener de `postMessage` para `{waba_id, phone_number_id}` (evento `WA_EMBEDDED_SIGNUP`).
3. **Backend** `POST /api/integraciones/whatsapp/conectar` `{code, wabaId, phoneNumberId}`:
   - Canje: `GET /oauth/access_token?client_id&client_secret&code` → business token (configurado no expirante).
   - Validar que el token ve ese WABA (`GET /<WABA_ID>?fields=id,name` con el token).
   - `POST /<WABA_ID>/subscribed_apps` — suscribe NUESTRA app a los webhooks del WABA.
   - Coexistence: el número ya está registrado (viene de la app). Cloud API puro: `POST /<PHONE_NUMber_ID>/register` con PIN de 6 dígitos.
   - Guardar credenciales + disparar el cron de plantillas (§6).
4. **Desconexión**: `DELETE /<WABA_ID>/subscribed_apps` + revocar/borrar credenciales (patrón Wati existente).

## 5. Webhook receiver — el primer webhook entrante del sistema

`apps/api/src/webhooks-whatsapp/` (módulo nuevo):
- `GET /api/webhooks/whatsapp` — verificación: responder `hub.challenge` crudo si `hub.verify_token` coincide (`WHATSAPP_WEBHOOK_VERIFY_TOKEN` env).
- `POST /api/webhooks/whatsapp` — **@Public + firma obligatoria**: HMAC-SHA256 del raw body contra `META_APP_SECRET`, comparación timingSafeEqual con `X-Hub-Signature-256`. Sin firma válida → 401 sin log de contenido. Necesita **raw body** (configurar body parser del route).
- Respuesta 200 inmediata; el procesamiento va a cola (persistir `WebhookWhatsappCrudo` → worker procesa).
- Idempotencia por `wamid` (Meta reintenta hasta 7 días).
- Ruteo: `value.metadata.phone_number_id` → `IntegracionTenant` (query sin contexto de tenant → el módulo se agrega al patrón de exentos con filtro manual, igual que webhooks de Paddle).
- Dimensionar: statuses ≈ 3× la tasa de envío + entrantes; payloads hasta 3 MB.

**Procesadores F1**: `statuses` → update `NotificacionWhatsapp.estadoEntrega` por `wamid`; `message_template_status_update` → `PlantillaWhatsappTenant.estado`; `account_update` (con `disconnection_info`) → marcar integración con problema + aviso.

## 6. Envío — `CloudApiClient` y la interface de corte

```ts
interface ProveedorWhatsapp {
  enviarPlantilla(args: {
    telefonoE164: string;
    plantilla: string;            // nombre en el proveedor
    parametros: string[];         // POSICIONALES (la cola ya los guarda así)
    headerMediaUrl?: string;
    botonUrlParam?: string;
  }): Promise<{ idProveedor: string }>; // wamid en Meta
}
```
- `WatiClient` se adapta a la interface (los params posicionales→nombre ya existen: `mapearParametros` queda DENTRO del adapter Wati y muere con él).
- `CloudApiClient`: `POST /v25.0/<PHONE_NUMBER_ID>/messages` con `type: template`, componentes posicionales, bearer del tenant + `appsecret_proof`. Media: upload → media ID (persistir a R2 lo entrante).
- `DespachoService` elige proveedor por tenant según `IntegracionTenant` activa (META_WHATSAPP gana sobre WATI si ambas). Los schedulers que gatean por enum `WATI` en queries crudas pasan a gatear por "tiene integración de WhatsApp activa".
- Errores → estados de cola: 131047 ventana cerrada (no reintenta: reprogramar con plantilla), 131056 pair rate (backoff 4^X), 132xxx plantilla (marcar fallida + log), 190/200 auth (marcar integración rota + aviso re-onboarding).

### Plantillas por tenant al conectar
Cron progresivo (patrón `wati.scheduler.ts`): somete las 13 plantillas del catálogo vía `POST /<WABA_ID>/message_templates` respetando el cupo ~10/h de Meta; estados llegan por webhook. El despacho solo usa plantillas `APPROVED` (cache §3.3); mientras una plantilla no esté aprobada, esa notificación queda `programada` (la cola ya sabe esperar).

## 7. Proceso Meta — checklist administrativo

| Etapa | Qué | Necesita de nosotros |
|---|---|---|
| ✅ App + Portfolio | hecho | — |
| **Business Verification** (Paso 3 wizard) | Documentos de la empresa | **Arrancar YA** — es el camino crítico (días/semanas) |
| Paso 1 "Pruébala" | Mensaje desde número de prueba | Solo curl con token temporal del dashboard; valida la app |
| Paso 2 "Producción" | Número + **webhook configurado** | El receiver de §5 desplegado (dev: túnel) con verify token |
| **App Review** | `whatsapp_business_messaging` + `whatsapp_business_management` Advanced Access; 2 screencasts; política de privacidad | Embedded Signup + envío FUNCIONANDO para grabar; página de privacidad pública |
| Access Verification | Tech Provider final | Tras lo anterior |

Credenciales de la app a guardar (env del API, nunca en repo): `META_APP_ID`, `META_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `META_ES_CONFIG_ID` (Embedded Signup). Límite: 200 onboardings/7 días (sobra). Bump de Graph API ~cada 4 meses (pin `v25.0` en un solo lugar).

## 8. Coexistence — operación del heartbeat

Alguien del tenant debe abrir la WhatsApp Business App cada ≤13 días o Meta degrada/corta la entrega (`PRIMARY_INACTIVITY` ~14d). Nosotros:
- Estado por tenant en Integraciones (`OK / POR_VENCER / VENCIDO`) calculado desde el último webhook/echo recibido (no hay señal directa: heurística por actividad).
- Aviso a los 10 días sin actividad: notificación al dueño (email + WhatsApp por el propio canal mientras viva).
- `account_update` con `disconnection_info` → integración marcada rota + CTA de reconexión.

## 9. Fases de implementación

- **F1a — Receiver + verificación** (desbloquea Paso 2 del wizard): módulo webhooks-whatsapp con GET verify + POST firmado + persistencia cruda. Prueba con el número de test de Meta.
- **F1b — Envío mínimo**: `CloudApiClient` + interface `ProveedorWhatsapp` + adapter Wati. Mensaje de prueba end-to-end por el número de test.
- **F1c — Embedded Signup**: config en Meta App + UI en Integraciones + endpoint conectar/desconectar. (Ya usable en dev con nuestro propio número de prueba.)
- **F1d — Plantillas + statuses + corte por tenant**: cron de creación de plantillas, procesador de statuses (`estadoEntrega` real), selección de proveedor por tenant, UI de estado (calidad, heartbeat).
- **App Review** con screencasts de F1c/F1d → producción.
- **F2 — Inbox** (proyecto aparte): materializar history/echoes/contactos ya persistidos, conversaciones, ventana de 24h, interactivos.

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| App Review rechaza/demora | 360dialog como plan B (investigación §7); screencasts prolijos y política de privacidad clara |
| Heartbeat 13 días olvidado | §8: heurística + avisos; default coexistence igual (es el trade-off correcto) |
| Cupo 10 plantillas/h al conectar | Cron progresivo ya diseñado; el despacho espera APPROVED |
| Webhooks perdidos (sin replay de history/echoes) | Persistencia cruda ANTES de procesar; 200 rápido; monitoreo de la cola |
| Dev con integraciones vivas (memoria: Wati REAL en dev) | El corte por tenant es explícito; el tenant demo se migra a META_WHATSAPP solo cuando se pruebe |
