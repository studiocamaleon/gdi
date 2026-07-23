# Integraciones · Wati (WhatsApp Business API) — análisis y plan

**Fecha:** 2026-07-22
**Estado:** F0 y F1 implementadas. F2 en diseño, con la API ya verificada
contra una cuenta real (ver §8).

---

## 1. El hallazgo que cambia el diseño

El diseño de la vista dice **dos veces** que los templates se crean a mano en el
dashboard de Wati:

> "Creálos primero en el dashboard de Wati y luego volvé acá para mapearlos."
> "¿Necesitás un template nuevo? Creálo en el dashboard de Wati (Broadcast →
> Templates) y esperá la aprobación de Meta (24-48hs)."

**Eso no hace falta.** Wati expone creación de templates por API:

| Qué | Endpoint | Versión |
|---|---|---|
| Crear template (lo somete a Meta) | `POST /api/v1/whatsApp/templates` | v1 |
| Listar templates + estado | `GET /api/v1/getMessageTemplates` · `GET /api/ext/v3/messageTemplates` | v1 / v3 |
| Enviar template | `POST /api/ext/v3/messageTemplates/send` | v3 |
| Cambios de estado | webhooks (`templateMessageSent_v2`, template status update) | — |

Así que **el objetivo de auto-someter los templates es viable**, y es lo que
convierte esto de "una integración más" en algo que el tenant no tiene que
configurar: conecta Wati y el sistema hace el resto.

Ojo con la mezcla de versiones: crear es **v1**, enviar es **v3**. No es
prolijo pero es lo que hay; el cliente HTTP tiene que soportar las dos.

**Autenticación** (coincide con lo que muestra el diseño, que estaba bien):

```
Authorization: Bearer <token>
Base URL:      https://live-mt-server.wati.io/{tenantId}/
```

El `tenantId` va en el **path**, no en un header. El token se genera una vez
en el dashboard de Wati y se muestra una sola vez.

---

## 2. Lo que hay que corregir del diseño

| En el diseño | La realidad |
|---|---|
| "Creá los templates en el dashboard" (×2) | Se crean por API desde acá. Es el corazón de la feature. |
| Parámetros posicionales `{{1}}`, `{{2}}` | Resultó estar BIEN: Meta los ve posicionales. Wati además guarda una versión nombrada para autoría. Ver §8.1. |
| "Cupo del plan · 1.842/5.000 mensajes" | Meta no cobra por mensaje sino por **conversación de 24 h**, y el precio varía por categoría (Utility ≠ Marketing). El KPI honesto es conversaciones y costo estimado, no "mensajes del cupo". |
| Botón "Rotar token" | Wati no rota tokens por API. El botón sólo puede llevar al dashboard. |
| Eventos `message.delivered`, `message.read`… | Los nombres reales son otros (`templateMessageSent_v2`, etc.). Hay que mapear los de verdad. |
| "2.4k instalaciones" en las cards | Es un marketplace ficticio. O se saca, o se asume decorativo. |
| Tab "Templates de Wati" como espejo pasivo | Pasa a ser el **panel de control**: estado de cada template de Grafo en la cuenta del tenant, con acción de re-someter. |

Y sobre AFIP, que mencionaste: el diseño muestra credenciales de WSFE, pero
como el modelo es **delegación** (el certificado es de Grafo y representa a N
CUITs), esa vista tiene que ser otra cosa — "¿está bien delegado el servicio
para tu CUIT?" con un chequeo en vivo. Queda para después, pero la vista actual
no sirve tal cual.

---

## 3. Lo que falta de nuestro lado

Tres huecos verificados en el código, y ninguno es opcional:

**3.1 No hay cifrado de secretos en reposo.** Cero usos de `createCipheriv` en
todo el API. El token de Wati permite **mandarle WhatsApps a los clientes del
tenant desde su número oficial**: si se filtra la base, se filtra eso. Esta es
la decisión que dije que no se retrofitea barato, y es la razón por la que
quisimos hacer seguridad antes de integraciones.

**3.2 No hay normalizador de teléfono.** `Cliente` guarda `telefonoCodigo` +
`telefonoNumero` + `paisCodigo` por separado y no hay ninguna función que los
componga. WhatsApp necesita **E.164** (`5493415551840`, sin `+` ni espacios ni
guiones). Con datos cargados a mano durante años, una parte de la base va a
tener teléfonos que no normalizan.

**3.3 No hay bus de eventos ni colas.** Las transiciones de estado están
inline en los services. No hay Redis ni BullMQ. Mandar un WhatsApp dentro del
request de "marcar orden lista" ataría una operación de producción a la
latencia de un tercero.

---

## 4. Framework de decisiones

### D1 — El catálogo de templates es de Grafo, no del tenant

Grafo define **un template canónico por evento del sistema**, con su texto y
sus variables. Al conectar Wati, el sistema los somete todos a la cuenta del
tenant.

Alternativa descartada para F1: que cada tenant escriba sus propios textos.
Suena flexible pero significa que cada cambio de wording dispara un ciclo de
aprobación de Meta de 24-48 h, que el soporte de Grafo no puede diagnosticar
un texto que no conoce, y que el mapeo evento→variables deja de ser
verificable. La personalización se puede agregar después sobre esta base; al
revés no.

Lo que **sí** es del tenant desde F1: qué eventos están encendidos (el toggle
que el diseño ya tiene) y el idioma.

### D2 — Los templates se versionan por código

Un template aprobado por Meta es prácticamente inmutable. Si Grafo cambia el
texto, no puede pisar el anterior: somete uno nuevo. Por eso el código lleva
versión — `grafo_orden_lista_v2` — que es exactamente lo que el mock del
diseño ya insinuaba con `cotizacion_aprobada_v2`.

Consecuencia: un tenant conectado hace seis meses puede estar en v1 mientras
uno nuevo arranca en v2. El sistema tiene que saber **qué versión tiene
aprobada cada tenant** y usar esa, no la última.

### D3 — El estado del template vive por tenant

`PENDIENTE` → `APROBADO` | `RECHAZADO` | `PAUSADO` | `DESHABILITADO`.

Se actualiza por dos caminos, y hacen falta los dos: **webhook** (rápido) y
**reconciliación por cron** (los webhooks se pierden, y un template puede
pasar a `PAUSADO` por baja calidad sin que nadie avise a tiempo).

### D4 — Si el template no está aprobado, no se manda y no se rompe nada

El evento de negocio **nunca** falla por la notificación. Si el template está
pendiente o rechazado: no se envía, queda registrado con el motivo, y se ve en
la UI. Mismo criterio que ya usamos para el PDF del comprobante.

### D5 — Los envíos no van en el request path, pero tampoco inventamos infra

El checklist de performance pide BullMQ + Redis. No los hay, y montarlos para
esto es desproporcionado.

Propuesta: tabla `NotificacionWhatsapp` con estado
(`PENDIENTE`/`ENVIADA`/`FALLIDA`/`DESCARTADA`), el evento la encola dentro de
su propia transacción, y un worker —el cron que ya existe— la drena con
reintentos y backoff. Es una cola pobre, pero es **consistente con el resto del
sistema**, sobrevive a un reinicio y es observable desde la UI. Cuando aparezca
Redis, se migra sin tocar los puntos de enganche.

Beneficio lateral: el "Log de mensajes" del diseño sale de esa misma tabla.

### D6 — Token cifrado en reposo, con clave fuera de la base

AES-256-GCM, clave en `INTEGRACIONES_ENCRYPTION_KEY` (env), nunca en la base.
Se guarda `{iv, tag, ciphertext}`. La API **nunca** devuelve el token: la UI
muestra los últimos 4 caracteres y punto.

Eso rompe una cosa del diseño: el botón del ojito que revela el token completo.
Es correcto que se rompa — un token que se puede volver a leer desde la UI es
un token que se filtra por una captura de pantalla.

### D7 — Consentimiento del cliente final

WhatsApp exige opt-in, y en Argentina la ley 25.326 también pesa. Hace falta un
flag en `Cliente` (`aceptaWhatsapp`) y una forma de registrarlo. Sin eso, la
integración es un riesgo legal para el tenant, no una feature.

### D8 — Costo visible

Meta cobra por conversación de 24 h y el precio depende de la categoría. El
evento "paso de producción completado" —que el diseño trae apagado por
defecto, con buen criterio— puede disparar decenas de mensajes por orden. El
KPI de costo tiene que estar a la vista, o el tenant se entera por la factura.

---

## 5. Modelo de datos propuesto

```prisma
model IntegracionTenant {          // una fila por (tenant, proveedor)
  proveedor          String        // 'wati' | 'afip' | 'mercadopago'
  estado             String        // 'desconectada'|'conectada'|'error'
  credencialesCifradas Json?       // {iv, tag, ciphertext}
  // metadata no sensible, mostrable: número, displayName, tenantId de Wati
  metadataJson       Json?
  ultimoChequeoEl    DateTime?
  ultimoErrorTexto   String?
}

model PlantillaWhatsapp {          // catálogo de Grafo, no del tenant
  codigo   String                  // 'grafo_orden_lista_v2'
  evento   String                  // 'orden_lista'
  categoria String                 // UTILITY | MARKETING
  idioma   String                  // 'es_AR'
  cuerpo   String                  // con {{variables}}
  variablesJson Json               // nombre → de dónde sale el dato
}

model PlantillaWhatsappTenant {    // estado de esa plantilla en ese tenant
  plantillaId String
  estado      String               // PENDIENTE|APROBADO|RECHAZADO|PAUSADO
  motivoRechazo String?
  sometidaEl  DateTime?
  resueltaEl  DateTime?
}

model SuscripcionEventoWhatsapp {  // el toggle por evento del diseño
  evento   String
  activo   Boolean
}

model NotificacionWhatsapp {       // cola + log + auditoría
  evento       String
  clienteId    String?
  ordenId      String?
  telefonoE164 String
  plantillaCodigo String
  parametrosJson  Json
  estado       String              // PENDIENTE|ENVIADA|ENTREGADA|LEIDA|FALLIDA|DESCARTADA
  motivoDescarte String?           // 'template no aprobado' | 'sin opt-in' | 'teléfono inválido'
  watiMessageId String?
  intentos     Int
  proximoIntentoEl DateTime?
}
```

Todas con `tenantId` — el test de cobertura de aislamiento lo va a exigir.

---

## 6. Journey

1. **Conectar.** El tenant pega endpoint, tenant id y token. El sistema hace
   una llamada de prueba, guarda cifrado y marca `conectada`.
2. **Someter templates.** Automáticamente, el sistema crea en la cuenta del
   tenant los ~8 templates del catálogo. La UI muestra los 8 en `PENDIENTE`.
3. **Meta aprueba** (30 min a 24 h). Llega el webhook, o el cron reconcilia.
   Los templates pasan a `APROBADO` y los eventos correspondientes se pueden
   encender.
4. **Ocurre un evento** — una OT pasa a "lista". El sistema encola una
   notificación con los parámetros resueltos.
5. **El worker la manda** por la API de Wati y guarda el `messageId`.
6. **Wati avisa** entregado/leído/falló por webhook. El log de la UI lo
   refleja.

---

## 7. Fases

**F0 — Cimientos (sin UI).** Cifrado de credenciales, normalizador E.164 con
su suite de tests, y el modelo `IntegracionTenant`. **Es prerrequisito de
cualquier integración**, no sólo de Wati: MercadoPago y AFIP van a guardar
secretos igual.

**F1 — Conexión Wati.** Cliente HTTP (v1 + v3), guardar credenciales, probar
conexión, y el índice + tab de credenciales de la vista.

**F2 — Templates.** Catálogo canónico, submit automático, estado por tenant,
reconciliación por cron, webhook de cambio de estado. Es el corazón.

**F3 — Envíos.** Cola, worker con reintentos, enganche en los eventos del
sistema, opt-in del cliente, y el log de la UI.

**F4 — Observabilidad.** KPIs reales (conversaciones y costo, no "cupo"),
tasa de entrega, y el detalle de errores.

---

## 8. Verificado contra una cuenta real (2026-07-22)

Los tres puntos que la documentación pública no resolvía quedaron
contestados con la cuenta de Corporearte, y **dos de las tres respuestas
contradicen lo que decía la doc**.

### 8.1 Las variables son las dos cosas a la vez

Wati guarda **dos cuerpos** para cada plantilla:

| Campo | Contenido | Para qué |
|---|---|---|
| `body` | `¡Hola {{1}}! Tu orden #{{2}}…` | posicional, es lo que ve Meta |
| `bodyOriginal` | `¡Hola {{nombre_cliente}}! Tu orden #{{numero_orden}}…` | nombrado, como se escribió en Wati |
| `customParams` | `[{paramName, paramValue}]` | los nombres, con un valor de ejemplo |

O sea que se autorea con nombres y Wati los traduce a números para Meta.

### 8.2 El orden de `customParams` NO es el orden de los parámetros

**Este es el hallazgo que evita un bug serio.** En `nueva_orden_v4`,
`customParams` llega como
`[nombre_cliente, fecha_entrega, subtotal, total_iva, url_tracking, nombre_empresa, numero_orden]`
pero el cuerpo dice `¡Hola {{1}}! Tu orden #{{2}}` — y ese `{{2}}` es
`numero_orden`, el **séptimo** de la lista. Además `customParams` arrastra
basura de autoría: parámetros llamados `"1"` que no aparecen en ningún cuerpo.

Mandar los parámetros en el orden de `customParams` no falla de forma
visible: Meta acepta el envío y al cliente le llega **su número de orden
donde va el nombre**.

La única fuente confiable es **alinear los dos cuerpos**: la k-ésima variable
de `bodyOriginal` es la k-ésima de `body`. Implementado en `mapearParametros`
y verificado posición por posición contra los siete parámetros de
`nueva_orden_v4`.

### 8.3 Los campos no son los que sugiere la doc

- `language` es un **objeto** `{key, value, text}`, no un string. Leerlo como
  string devuelve null en silencio.
- La plantilla trae `id` propio de Wati (`69ac44f2e674…`), así que sí se puede
  consultar el estado después de crearla.
- Hay un campo `quality` — la señal de calidad de Meta, que es por lo que un
  template puede pasar a pausado sin que nadie lo toque.

### 8.4 Crear y someter plantillas: funciona, y casi nada era como parecía

Este apartado es el más caro de todos: salió de reversar contra la cuenta
real una API cuya documentación no alcanza. Vale la pena dejarlo escrito
completo para no repetirlo.

**Son dos pasos:**

1. `POST /api/v1/whatsApp/templates` — crea el borrador.
2. `POST /api/v1/templates/submit/{id}` — lo manda a revisión de Meta.

El id del submit va en el **path**. Sin él la ruta ni siquiera existe
—contesta 405—, que es lo que despistó cuando se la buscó a ciegas.

**El payload que sirve:**

| Campo | Valor |
|---|---|
| `type` | `"template"` — **no** `"hsm"` |
| `subCategory` | `"STANDARD"` |
| `language` | string plano: `"es_AR"` |
| `body` | el cuerpo **nombrado** (`{{nombre_cliente}}`) |
| `customParams` | `[{paramName, paramValue}]` — los ejemplos que Meta exige |
| `hsm` | no se manda; los borradores legítimos lo tienen en `null` |
| `bodyOriginal` | no se manda; lo deriva Wati |

Al someter, Wati convierte solo: `body` pasa a posicional (`{{1}}`) y
`bodyOriginal` queda con el nombrado.

**Las trampas, en orden de aparición:**

- `languageCode` no existe: el campo es `language` y va como **string
  plano**. Con el nombre equivocado el idioma quedaba `null` **en silencio**.
- El alta contesta **500 "An error occurred" y aun así crea la plantilla**.
  Confiar en el status reporta un fallo sobre algo que sí se creó, y el
  reintento choca con "template with current name already exists". Por eso el
  estado real se lee de la lista **después** de intentar.
- El motivo de un rechazo viene en `message`, no en `info`.
- **`type: "hsm"` fue el que costó más caro.** Con ese valor la plantilla se
  crea, se ve bien en el editor y **no se puede enviar a revisión ni siquiera
  desde el dashboard de Wati**: hay que borrarle el cuerpo y escribir texto
  plano sin variables para que deje. El valor malo salió de una captura del
  `update` del dashboard… que estaba devolviendo el valor que habíamos
  escrito nosotros.

**Lo que destrabó todo no fue probar otra combinación.** Fueron cinco
intentos de adivinar nombres de campo, cada uno arreglando una cosa y
rompiendo otra. Se resolvió creando un borrador **a mano** en el dashboard y
comparándolo campo por campo contra uno nuestro: las únicas diferencias
reales eran `type` y `subCategory`. Cuando una API no está documentada,
conviene ir al diff antes que a la sexta hipótesis.

Verificado con `grafo_comprobante_emitido_v1`: alta + envío en un paso,
`status: PENDING`, sin tocar el dashboard.

### 8.5 El alta corre sola (cron `wati-plantillas`)

El tenant conecta Wati con sus credenciales y no hace nada más: cada 15
minutos el cron busca las plantillas del catálogo que le faltan a cada tenant
conectado, las crea y las manda a revisión.

**No lleva la cuenta del cupo a propósito.** Sería estado nuestro que se
desincroniza del de Meta. En vez de eso intenta y **para en el primer
"esperá N minutos"**: una corrida mete 10, rebota, y alguna de las siguientes
ya pasó la hora y mete el resto. Wati es la fuente de verdad del cupo.

Mira a **todos** los tenants conectados y no sólo al que recién conectó,
porque eso cubre gratis tres casos más: una conexión que se cortó a la mitad,
un tenant viejo cuando sumemos plantillas nuevas al catálogo, y una plantilla
que Meta rechazó y volvió a DRAFT. Los DRAFT entran en la selección junto a
las que no existen — son las baratas de completar.

Corre bajo el lease de `CronLock` (ver `src/common/cron-lock.ts`): con dos
instancias del API, sin eso se quemaría el doble del cupo.

**Verificado contra la cuenta real:** con 4 plantillas faltantes, una corrida
del cron las creó, las sometió y quedaron aprobadas. Estado final del
catálogo en Corporearte: **13 de 13 APPROVED, 0 recategorizadas** — las 11
UTILITY entraron como UTILITY y las 2 MARKETING como MARKETING.

Eso contesta la pregunta que abrió todo esto: **los textos están bien
escritos**, y validarlos contra una cuenta antes de soltarlos al resto de los
tenants funciona.

### 8.7 Lo que sigue sin verificar

El payload real de los **webhooks** de cambio de estado. Requiere recibir uno
— se resuelve al conectar la reconciliación de F2.

## Fuentes

- [Wati API — Introducción](https://docs.wati.io/reference/introduction)
- [Wati API — Autenticación](https://docs.wati.io/reference/authentication)
- [Wati API — Crear template](https://docs.wati.io/reference/post_api-v1-whatsapp-templates)
- [Wati API — Enviar template (v3)](https://docs.wati.io/reference/post_api-ext-v3-messagetemplates-send)
- [Wati API — Get message templates](https://docs.wati.io/reference/get_api-v1-getmessagetemplates)
- [Wati — Webhooks y payloads](https://docs.wati.io/reference/webhooks)
- [Wati — Seguimiento de estado de templates por webhook](https://support.wati.io/en/articles/11463225-tracking-template-message-status-using-webhooks)
- [Wati — Crear y enviar templates a aprobación](https://support.wati.io/en/articles/11463495-how-to-create-and-submit-template-messages)
