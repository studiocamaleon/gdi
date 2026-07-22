# Almacenamiento de archivos (Cloudflare R2) — análisis y diseño

**Fecha:** 2026-07-22
**Estado:** **F1 implementada y verificada** (ver §5). F2–F4 pendientes.

---

## 1. Estado actual (verificado en el código, no supuesto)

### 1.1 No existe capa de storage

- Cero dependencias de object storage: no hay `@aws-sdk/client-s3`, ni `multer`,
  ni `@nestjs/platform-express` con `FileInterceptor`, ni ninguna firma de
  presigned URL en el repo.
- El schema de Prisma tiene **2934 líneas y ~120 modelos**, y ninguno representa
  un archivo. No hay columna `url`, `key`, `bucket` ni `mimeType` en ningún lado.
- No hay ningún endpoint que reciba `multipart/form-data`.

Conclusión: esto es **greenfield**, no completar algo a medias.

### 1.2 Los "tabs de Archivos" son un placeholder

Existe **uno solo**, en la ficha de propuesta/OT:

- [`propuesta-ficha.tsx:730`](../src/components/comercial/propuesta-ficha.tsx#L730) —
  `{ key: "archivos", label: "Archivos", count: 2, icon: <FolderIcon /> }`.
  El `count: 2` está **hardcodeado**: no cuenta nada, es maqueta.
- [`propuesta-ficha.tsx:6325`](../src/components/comercial/propuesta-ficha.tsx#L6325) —
  renderiza `<EmptyTab title="Archivos del cliente" …>`.

No hay tab de archivos en la ficha de cliente, ni en la de proveedor, ni en la
de empleado, ni en producto. La percepción de "hay varios tabs de archivos" no
se corresponde con el código: hay uno, y es cartón pintado.

### 1.3 Los PDF se generan en cada request y no se guardan

Tres generadores, todos on-demand, todos `StreamableFile` sin persistir:

| PDF | Endpoint | Motor |
|---|---|---|
| Comprobante (factura con CAE) | [`administracion.controller.ts:68`](../apps/api/src/administracion/administracion.controller.ts#L68) | jsPDF |
| Estado de cuenta | [`administracion.controller.ts:109`](../apps/api/src/administracion/administracion.controller.ts#L109) | jsPDF |
| Presupuesto | [`presupuestos.controller.ts:118`](../apps/api/src/presupuestos/presupuestos.controller.ts#L118) | **Puppeteer** |

Esto tiene una consecuencia directa sobre el otro tema del roadmap: **cada vez
que el cliente abre el link público del presupuesto, se lanza Chrome headless**.
Si el PDF se materializa una vez al emitir y se sirve desde R2, el costo de
Puppeteer cae a ~1 render por presupuesto en vez de N por visita — sin tocar el
renderer ni perder el diseño.

### 1.4 No hay logo de tenant en ninguna parte

El "logo" de la marca es un cuadrado con las **iniciales del nombre**:

- [`presupuesto-pdf-html.ts:214`](../apps/api/src/presupuestos/presupuesto-pdf-html.ts#L214) — `<div class="logo">${esc(iniciales(d.negocio))}</div>`
- [`tracking-view.tsx:305`](../src/components/tracking/tracking-view.tsx#L305) — `imprenta-logo`

El seguimiento público es co-branded con el cliente final: hoy los dos lados de
ese co-branding son iniciales. Es el caso de uso más chico y más visible.

### 1.5 Aislamiento multi-tenant: qué nos da gratis y qué no

[`tenant-guard.extension.ts`](../apps/api/src/prisma/tenant-guard.extension.ts)
inyecta `tenantId` en toda query de Prisma desde un `AsyncLocalStorage`
([`tenant-context.ts`](../apps/api/src/common/tenant-context.ts)), incluido el
post-filtro de `findUnique`. Cualquier modelo `Archivo` que agreguemos **hereda
el aislamiento a nivel base de datos sin escribir una línea**.

Lo que **no** cubre: el objeto en R2. El guard protege la fila, no el byte. Si
una URL de objeto se filtra, el guard no interviene. Ese es el riesgo nuevo que
introduce este módulo y el que define varias decisiones de abajo.

### 1.6 Dos superficies públicas ya existen

- `GET ordenes-trabajo/track/:token` — [`ordenes-trabajo.controller.ts:36`](../apps/api/src/ordenes-trabajo/ordenes-trabajo.controller.ts#L36)
- `GET presupuestos/track/:token` — [`presupuestos.controller.ts:41`](../apps/api/src/presupuestos/presupuestos.controller.ts#L41)

En ambas **el token ES la credencial** y no hay sesión. Cualquier archivo que se
muestre ahí tiene que resolverse por ese token, nunca por una URL de bucket.

### 1.7 El camino de subida actual está cerrado — restricción dura

Dos límites que hacen **imposible** subir archivos por el camino HTTP existente:

1. [`main.ts:24`](../apps/api/src/main.ts#L24) — `app.use(json({ limit: process.env.BODY_LIMIT ?? '1mb' }))`.
   El límite de body es **1 MB por defecto**, puesto a propósito como anti-DoS.
2. [`route.ts:47`](../src/app/api/backend/[...path]/route.ts#L47) — el proxy BFF
   hace `body: await request.arrayBuffer()`. Bufferea **el archivo entero en RAM
   del proceso Next**, y después `fetch` lo vuelve a copiar hacia el Nest.

Un PDF de imprenta de 300 MB por ese camino significa 600 MB de heap en Next
por subida concurrente. Subir "por el API" no es una preferencia de diseño que
podamos elegir: **la arquitectura actual lo prohíbe**. Esto fuerza D1.

---

## 2. Framework de decisiones

### D1 — Camino de subida: presigned PUT directo del navegador a R2

**Decisión: el byte nunca pasa por nuestro backend.**

```
Browser                    API (Nest)                 R2
   │  POST /archivos/iniciar   │                       │
   │──────────────────────────>│  crea fila estado=pendiente
   │                           │  firma PUT (15 min)   │
   │<── { archivoId, url } ────│                       │
   │                                                   │
   │  PUT <url presignada>  (bytes)                    │
   │──────────────────────────────────────────────────>│
   │                                                   │
   │  POST /archivos/:id/confirmar                     │
   │──────────────────────────>│  HEAD al objeto: valida
   │                           │  tamaño+tipo reales,  │
   │                           │  estado=listo, cuota  │
```

Alternativa descartada: proxy por el API. Requeriría subir `BODY_LIMIT` (perder
la defensa anti-DoS que hoy protege *todos* los endpoints), reescribir el BFF
para hacer streaming, y aun así pagaríamos CPU y RAM por cada byte. R2 no cobra
egress, así que el ahorro de banda del proxy es cero.

**Consecuencias a asumir:**

- Hay que configurar **CORS en el bucket R2** (`PUT` desde el origen del front).
- El objeto puede existir en el bucket sin fila confirmada (el usuario cierra la
  pestaña a mitad de subida). Mitigación: la fila nace en `pendiente` **antes**
  de firmar; un barrido diario borra `pendiente` con más de 24 h (objeto +
  fila), más una regla de lifecycle en R2 como red secundaria. Mismo patrón que
  [`acreditaciones.scheduler.ts:20`](../apps/api/src/administracion/acreditaciones.scheduler.ts#L20).
- El `confirmar` **debe** hacer `HEAD` sobre el objeto y creer en el tamaño y el
  `Content-Type` que reporta R2, no en los que declaró el cliente. Firmar con
  `ContentLength` exacto ata la firma al tamaño declarado, pero el HEAD es el
  que cierra el agujero.
- Archivos > 100 MB: multipart. Se posterga a F4 (ver §5); el cap inicial de
  100 MB cubre el 99 % del arte de imprenta real.

### D2 — Layout de claves

```
t/{tenantId}/{scope}/{entidadId}/{archivoId}{ext}
```

Ejemplo: `t/9f3c…/orden-item/4b21…/7de0….pdf`

- **`tenantId` como primer segmento** (después de un `t/` fijo). Habilita
  métricas de uso por tenant, reglas de lifecycle por prefijo, y — lo
  importante — deja la puerta abierta a migrar a bucket-por-tenant o a tokens
  R2 con scope de prefijo sin rehacer las claves.
- **El nombre original NUNCA va en la clave.** Path traversal, unicode,
  colisiones, y filtrado de información en logs. Se guarda en
  `Archivo.nombreOriginal` y se devuelve al descargar vía
  `Content-Disposition`. La extensión sí se conserva en la clave, normalizada
  contra un allowlist.
- La clave es **derivable pero no adivinable** (`archivoId` es un uuid v4), así
  que aun con el bucket mal configurado no se enumera.

### D3 — Modelo de datos: una tabla con FKs tipadas, no polimorfismo suelto

Un solo modelo `Archivo` (una sola API de subir/listar/borrar), pero con **FKs
nullables reales** por cada entidad adjuntable en vez de un `entidadId: String`
polimórfico:

```prisma
enum ArchivoScope {
  TENANT_BRANDING   // logo, isotipo
  CLIENTE           // manual de marca, OC del cliente
  ORDEN             // adjuntos a nivel OT
  ORDEN_ITEM        // el arte de producción (caso principal)
  COTIZACION        // arte cargado al cotizar, viaja a la OT
  COMPROBANTE       // PDF emitido persistido
  COBRO             // comprobante de transferencia
  PRODUCTO          // ficha técnica, muestra
  PROVEEDOR         // remito de tercerizado
}

enum ArchivoEstado { PENDIENTE  LISTO  ELIMINADO }

model Archivo {
  id             String       @id @default(uuid()) @db.Uuid
  tenantId       String       @db.Uuid
  scope          ArchivoScope
  key            String       @unique
  nombreOriginal String
  mimeType       String
  bytes          BigInt       @default(0)
  /// sha256 en hex — dedupe y verificación de integridad.
  hash           String?
  estado         ArchivoEstado @default(PENDIENTE)
  /// Visible en el link público de tracking / presupuesto.
  publico        Boolean      @default(false)
  subidoPorId    String?      @db.Uuid
  eliminadoEl    DateTime?

  clienteId      String?      @db.Uuid
  ordenId        String?      @db.Uuid
  ordenItemId    String?      @db.Uuid
  cotizacionId   String?      @db.Uuid
  comprobanteId  String?      @db.Uuid
  cobroId        String?      @db.Uuid
  productoId     String?      @db.Uuid
  proveedorId    String?      @db.Uuid
  // … relaciones con onDelete: Cascade

  @@index([tenantId, scope, estado])
  @@index([tenantId, ordenItemId])
}
```

**Por qué FKs y no `entidadId` genérico:** con FK real, borrar una OT borra sus
archivos en cascada dentro de la misma transacción. Con polimorfismo suelto
quedan huérfanos que sólo un barrido descubre, y el barrido no sabe distinguir
un huérfano de una fila recién creada. El schema ya usa este criterio en todos
lados (`ComprobanteOrden`, `CobroImputacion`). Un CHECK garantiza que haya
exactamente una FK seteada según el `scope` (o ninguna, para `TENANT_BRANDING`).

**Contadores denormalizados:** `Tenant.bytesArchivos` mantenido en la misma
transacción que el confirmar/borrar — exactamente el patrón ya usado en
`Comprobante.saldoPendiente` y `OrdenTrabajo.facturadoTotal` (schema:2201-2210).

### D4 — Servido: redirect 302 a presigned GET de vida corta

**El bucket es privado. Siempre. Sin excepciones, ni siquiera el logo.**

```
GET /api/archivos/:id/contenido
  → auth guard + tenant guard (fila propia o 404)
  → firma GET por 60 s, con ResponseContentDisposition
  → 302 al presigned
```

La banda no toca el API (importa: hoy el API es un solo proceso Nest). El TTL de
60 s hace que una URL copiada de la barra de direcciones muera antes de servir
para algo.

**Superficie pública** (tracking de OT, presupuesto público): mismo mecanismo,
pero la autorización es el token de la OT/presupuesto y sólo se listan archivos
con `publico = true`. Ese flag es explícito y opt-in por archivo: el arte
interno y la orden de compra del cliente no se filtran al link que la imprenta
manda por WhatsApp.

**Ojo con el proxy BFF**: [`route.ts:57-67`](../src/app/api/backend/[...path]/route.ts#L57)
sólo reenvía `content-type` y `content-disposition`, y `fetch` sigue redirects
por defecto — es decir, el 302 se resolvería **dentro del proxy** y volveríamos
a bufferear el archivo en Next. Para descargas hay que ir **directo al API**
(`NEXT_PUBLIC_API_URL`) o enseñarle al proxy a propagar el `Location` con
`redirect: 'manual'`. Es un detalle chico pero es exactamente el tipo de cosa
que, si se descubre en implementación, obliga a rehacer el front.

### D5 — Validación de contenido y XSS

- Allowlist de MIME **y** de extensión, cruzados (`application/pdf` ↔ `.pdf`).
  Para imprenta: pdf, ai, eps, svg, psd, tiff, png, jpg, webp, cdr, zip.
- **`Content-Disposition: attachment` forzado** para todo lo que no esté en la
  lista segura-para-inline (pdf, png, jpg, webp). Un `.svg` servido inline desde
  nuestro dominio es XSS con script embebido; un `.html` disfrazado también. El
  presign lo resuelve limpio: `ResponseContentDisposition` va firmado, el
  cliente no lo puede alterar.
- Sin antivirus en F1. Si más adelante hace falta, el gancho natural es el
  `confirmar` (encolar scan, mantener `PENDIENTE` hasta el veredicto).

### D6 — Cuotas y borrado

- `Tenant.cuotaBytesArchivos` (nullable = sin límite). Se chequea al **iniciar**
  la subida, no al confirmar: rechazar después de que el usuario esperó 4
  minutos de upload es hostil.
- Borrado **lógico** (`estado = ELIMINADO`, `eliminadoEl`), papelera de 30 días,
  purga del objeto por cron. El borrado físico inmediato pierde auditoría y no
  tiene forma de recuperarse de un click equivocado sobre el arte aprobado.

### D7 — Configuración

Env nuevas (el proyecto lee `process.env` directo, no usa `ConfigService`):

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=grafo-archivos
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
ARCHIVOS_MAX_BYTES=104857600      # 100 MB
```

Dependencias: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. R2 es
S3-compatible; no hace falta SDK propio de Cloudflare.

**Dev sin credenciales**: un driver `local` (disco, bajo `apps/api/.storage/`)
detrás de la misma interfaz `StorageDriver`, para que el módulo se pueda
desarrollar y testear sin cuenta de Cloudflare. Los tests de Jest ya corren
contra DB aislada; el storage sigue el mismo criterio.

---

## 3. Casos de uso, ordenados por valor real

| # | Caso | Scope | Por qué importa |
|---|---|---|---|
| 1 | **Arte de producción del cliente** en el item de la OT | `ORDEN_ITEM` | Es *el* caso. Hoy el arte vive en WhatsApp o en un pendrive. El operario en la mesa de trabajo necesita el archivo al lado del paso. |
| 2 | **Logo del tenant** | `TENANT_BRANDING` | Reemplaza las iniciales en PDF de presupuesto, factura y tracking público. Chico, muy visible, cierra el ciclo end-to-end. |
| 3 | **PDF de presupuesto persistido** al emitir | `COTIZACION` | Mata el render de Puppeteer por visita y congela el documento que el cliente aprobó. |
| 4 | **Archivos del cliente** en la ficha | `CLIENTE` | Manual de marca, OC, logos reutilizables entre trabajos. |
| 5 | **PDF de comprobante** con CAE | `COMPROBANTE` | El documento fiscal congelado, no re-renderizado. |
| 6 | **Comprobante de transferencia** del cliente | `COBRO` | Hoy la conciliación se hace de memoria. |
| 7 | **Foto de producción / QA** | `ORDEN_ITEM` | Desde el celular en la mesa. Prueba de entrega. |
| 8 | **EPS del sello** generado | `ORDEN_ITEM` | Hoy se genera client-side y se descarga; se pierde. |
| 9 | **Remito de tercerizado** | `PROVEEDOR` | Cierra la trazabilidad del paso tercerizado. |

---

## 4. Journey del caso principal (arte en la OT)

1. **Comercial cotiza.** Arrastra el PDF del cliente al presupuesto. Sube
   directo a R2 mientras sigue cargando el resto (barra de progreso, no
   bloquea).

   *Corrección sobre el diseño original (F2):* acá el adjunto va **a nivel
   documento**, no por item. Los items de la ficha son borradores locales hasta
   que se guarda: sus ids no existen todavía en la base, y no se puede colgar
   una FK de una fila inexistente. Obligar a "guardá primero para poder
   adjuntar" es peor UX que adjuntar al presupuesto entero. **Por item se
   adjunta en la OT**, donde los `OrdenTrabajoItem` sí existen — que además es
   donde producción lo necesita.

2. **Se convierte en OT.** Los archivos del presupuesto se *re-vinculan* a la
   orden — no se copian bytes, se agrega la FK. El `Archivo` gana `ordenId` y
   **conserva `cotizacionId`**: queda la traza de que ese arte vino del
   presupuesto. Es la excepción que contempla el CHECK de §D3.
3. **Producción abre el tablero.** El paso muestra un clip con la cantidad de
   archivos. Un click abre el visor; el PDF se ve inline (presigned de 60 s).
4. **El operario descarga** el archivo listo para el RIP. Queda registrado
   quién lo bajó y cuándo (evento en `OrdenTrabajoEvento`, que ya existe).
5. **El cliente entra al link de tracking.** Ve sólo los archivos marcados
   `publico` — típicamente la prueba de color o la foto del trabajo terminado,
   nunca el arte de producción ni el remito interno.

---

## 5. Fases propuestas

**F1 — Infraestructura + logo del tenant. ✅ HECHA.**

Backend:
- `StorageDriver` con dos implementaciones: `R2Driver` (S3 API) y `LocalDriver`
  (disco + HMAC, para dev sin credenciales). Selección por env en
  `storage.module.ts`; en producción el arranque **falla** si faltan las
  credenciales, en vez de guardar en disco efímero.
- Modelo `Archivo` + enums + migración `20260722050000_archivos_r2`, con el
  CHECK de coherencia `scope` ↔ FK escrito a mano.
- `ArchivosService` / `ArchivosController`: iniciar, confirmar, listar,
  contenido (302), PATCH, DELETE. `ArchivosScheduler` a las 4 AM
  (pendientes + papelera).
- Endpoints del logo en `tenants` y `logoDataUri()` cacheado para los PDF.

Frontend:
- `ArchivoUploader` (drag & drop, progreso real por XHR, cancelación) y
  `LogoTenantCard`, montada en Administración → Datos fiscales.
- Proxy BFF arreglado para propagar el 302 (ver §6).

Logo cableado en los tres lugares: PDF de presupuesto (Puppeteer, data URI),
PDF de factura (jsPDF, sólo PNG/JPEG) y tracking público (302 firmado por
token). En los tres, sin logo se dibujan las iniciales como antes.

**Verificado**: roundtrip completo (iniciar → PUT directo → confirmar →
descarga byte-idéntica); firma manipulada/ausente → 403; descarga sin sesión →
401; archivo de otro tenant → 404 en GET, PATCH y DELETE; `.exe` y MIME
incoherente rechazados; SVG con `<script>` servido como `attachment`; contador
de bytes sube y baja; borrado lógico oculta de la lista pero deja el objeto.
Los dos PDF y el tracking, inspeccionados a ojo con el logo puesto.

**F2 — Archivos en OT e item. ✅ HECHA.**

- `GET /archivos/de-orden/:id` devuelve documento + cada item de una sola vez
  (el tab los muestra juntos; pedirlos por item sería N+1 y haría parpadear la
  vista).
- Tab **Archivos** real en la ficha, con el contador de verdad en la pestaña
  (antes: `count: 2` hardcodeado). Un bloque para la orden y uno por producto:
  el arte es *del item* — es lo que el operario abre en la mesa — mientras que
  la orden de compra es del documento. Mezclarlos obligaría a adivinar cuál de
  siete PDFs es el suyo.
- Switch **Interno / Cliente** por archivo. El default es interno: el arte de
  producción y los remitos no se filtran al link que se manda por WhatsApp.
- Re-vinculación al convertir presupuesto → OT (migración
  `20260722060000_archivos_revinculacion_orden` para que el CHECK admita
  `cotizacionId` junto a `ORDEN`).
- Tab **Archivos** en el detalle del tablero, de sólo lectura: desde la mesa se
  consume el arte, no se administra. El contador viene del `_count` filtrado de
  la query del tablero, no de traer las filas para contarlas.
- Sección de archivos en el seguimiento público, sólo con los marcados
  `publico`.

**Verificado**: el tracking muestra únicamente el archivo público y el arte
privado no aparece; con el token de la orden, bajar el arte **privado** da 404,
y bajar un archivo **público de otra orden** también da 404 (probado desde el
propio navegador, no sólo por curl); token inventado da 404; el contador del
tablero da 1 para el item con arte; la transición de scope de la re-vinculación
pasa el CHECK — que importa porque el método traga los errores y, sin la
segunda migración, habría fallado en silencio.

*No verificado en navegador*: el tab de la ficha y el del tablero, que están
detrás del login.

**F3 — PDFs persistidos.** Presupuesto al emitir, comprobante al obtener CAE.
Es acá donde el tema Puppeteer se vuelve barato de resolver.

**F4 — Operación.** Cuotas por tenant, papelera + purga, multipart para > 100 MB,
métricas de uso, dedupe por hash.

---

## 6. Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| URL presignada filtrada da acceso al objeto | TTL de 60 s en GET, 15 min en PUT; clave no adivinable |
| Objeto huérfano por subida abandonada | Fila `PENDIENTE` previa + barrido diario + lifecycle en R2 |
| SVG/HTML servido inline → XSS en nuestro dominio | `Content-Disposition: attachment` firmado para todo lo no-seguro |
| El proxy BFF vuelve a bufferear en la descarga | Descargas van directo al API, no por `/api/backend/*` |
| Un tenant ve el archivo de otro | Fila protegida por tenant-guard; el objeto sólo se alcanza vía un presign que el API firma tras validar la fila |
| Costo descontrolado de almacenamiento | Cuota por tenant chequeada al iniciar; R2 no cobra egress, sólo storage |

## 7. Hallazgos de la implementación

Dos cosas que el diseño no anticipó y que sólo aparecieron al correr esto de
verdad. Las dos se detectaron **en el navegador**, no en los tests de API:

**El proxy BFF resolvía el redirect internamente.** `fetch` sigue los 3xx por
defecto, así que la descarga se resolvía dentro del proceso de Next y el
archivo entero volvía a bufferearse en memoria — exactamente lo que el 302
existe para evitar. Arreglado con `redirect: 'manual'` + propagación del
`Location` en [route.ts](../src/app/api/backend/[...path]/route.ts). Esto valía
la pena resolverlo bien y no con un endpoint que devuelva `{url}` en JSON:
gracias al 302 propagado, `/api/backend/archivos/:id/contenido` sirve tal cual
como `src` de un `<img>`, que es lo que hace posible el preview de imágenes y
el logo sin ninguna rama especial.

**helmet bloqueaba el logo con CORP.** `helmet()` le pone
`Cross-Origin-Resource-Policy: same-origin` a *toda* respuesta del API. El
front corre en otro origen, así que el `<img>` del logo moría con
`ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`. En producción no pasa (el objeto lo
sirve R2, que no manda CORP), o sea: **es un bug que sólo existe en dev**. Se
arregló en el controller del driver local, para que dev y prod se comporten
igual — que es la única razón por la que el driver local vale la pena.

Un tercero, no de código: Turbopack sirvió el `globals.css` viejo después de
una edición in-place (el bloque agregado al final sí estaba, la regla insertada
en el medio no). Ya está documentado en la memoria del proyecto; conviene
verificar la regla en el bundle antes de dar por buena una diferencia visual.
