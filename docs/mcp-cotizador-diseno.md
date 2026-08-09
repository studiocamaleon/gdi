# MCP de cotización — diseño

**Fecha:** 2026-08-09 · **Estado:** DISEÑO — sin implementar
**Objetivo:** que cada tenant conecte su IA (Claude, ChatGPT, o la API de Anthropic vía MCP connector) a Grafo y pueda **cotizar productos de su catálogo conversando**: "cotizame 500 volantes A5 doble faz en ilustración 150g" → precio real del motor.

Es el primer doc del repo que expone el sistema a un consumidor externo de IA. No existe hoy ninguna API pública, API key ni superficie MCP (verificado: cero hits reales en `docs/` y en el código).

---

## 1. Alcance

**F1 (núcleo, este doc):** cotizar en modo solo-lectura+dry-run. La IA descubre el catálogo, averigua qué preguntas hace cada producto, arma el `jobContext` y llama al motor (`POST /motor-universal/cotizar`, que **no persiste**). Devuelve precio + desglose apto para conversación.

**F2:** persistir — `cotizar-y-guardar` + emitir presupuesto (con humano en el loop) + alta de cliente por documento.

**F3:** OAuth 2.1 completo para el conector custom de claude.ai + instrucciones por producto para la IA (patrón HoldPrint).

**Fuera de alcance:** consultas de negocio (deudores, OTs, reportes), acciones de producción, WhatsApp directo desde la IA. Son extensiones naturales pero cada una merece su análisis.

---

## 2. Estado actual (síntesis del relevamiento 2026-08-09)

### 2.1 Cómo se cotiza hoy

- **Motor:** `apps/api/src/motor-universal/motor.service.ts` (~15.000 líneas), `cotizar()` en L455. Endpoints en `motor.controller.ts`: `POST /api/motor-universal/cotizar` (dry-run, L33), `cotizar-y-guardar` (L62), `recotizar` (L86). Guard: `@Permiso('comercial.ver')` + `@OcultaMargenes()`.
- **Request** (`cotizar.dto.ts:145`): `{ productoId, rutaAlternativaId?, jobContext, clienteId?, descuento?, periodo? }`. ⚠️ `jobContext` es `@IsObject()` a secas — **la clase `JobContextDto` es documentación, no validación** (test que lo confirma: `__tests__/cotizar-dto.spec.ts`). Todo pasa, incluidas claves dinámicas.
- **Response** (`tipos.ts:205` `CotizarOutput`): `{ exitoso, errores[], cotizacion? }`. Errores con `codigo`, `mensaje`, `sugerencia` — excelente material para que la IA se auto-corrija. Fail-fast: primer ERROR corta.
- **Flujo presupuesto = 2 pasos:** N llamadas a `cotizar-y-guardar` (una por ítem, la 1ª crea la `Cotizacion` en borrador) → `POST /presupuestos/emitir { cotizacionId, clienteId, items[] }`. **`emitir` no recalcula nada**: suma los montos que le mandan (decisión documentada en `descuentos-diseno.md` §2.2) y **numera + envía en el mismo acto** — no existe "presupuesto en borrador" por API.

### 2.2 Qué necesita el motor por producto (entradas mínimas)

| Producto | jobContext mínimo |
|---|---|
| `modoMedidas: FIJA` con medida default | `{ cantidad }` — el motor sintetiza la medida (motor.service.ts:509-528) |
| `LIBRE`/`MIXTA` | + `piezas[{cantidad,anchoMm,altoMm}]` (+ `medidaCustomMm` si es una sola) |
| Slots `COMERCIAL_ELIGE` | + `slotMateriales["<configPasoId>_<slotCodigo>"] = varianteId` (candidatos válidos o `material_comercial_invalido`) |
| Pasos opcionales | + `opcionalesActivados[configPasoId] = true` (el arrastre de dependencias lo hace el motor) |
| Tiempo manual obligatorio | + `tiempoManualMin_<configPasoId>` (minutos) |
| Impresión con color elegible | + `modoColor_<configPasoId>` / `modoColorPorPaso` |
| Multiplicadores activos | + `caras`, `tipoCopia`, `hojasPorLibro`, `numerosXTalonario`, etc. — **si faltan, cotiza mal en silencio** |
| Talonario / cuadernillo / bastidor / lineal | + `numerosXTalonario` / `paginas` / `profundidadMm` / `metrosLineales`+`modoCotizacionLineal` |

Precondición del tenant: tarifa horaria **PUBLICADA** ≤ período por cada centro de costo (carry-forward en `load-tarifas.ts:46-93`; sin ninguna → `centro_costo_sin_tarifa_publicada`).

### 2.3 El agujero funcional: no existe "form schema" por producto

La lógica "qué se le pregunta al comercial para cotizar este producto" **solo vive en el frontend**: `agregar-producto-sheet.tsx` (7.250 líneas) + `params-comercial.ts` + `config-paso-activacion.ts` + `producto-medidas.ts`. El API expone las piezas crudas (`GET /productos-servicios/productos/:id` + `GET /productos-servicios/familias`) pero el cruce producto×familia×ruta lo hace el cliente. Reglas clave:

- Gate estructural: `esConfigPasoEjecutable` (`activo !== false && modoActivacion !== 'NO_EJECUTAR'`).
- Params abiertos: `paramsEfectivos()` en `params-runtime.ts:48-80` — `(camposEditablesComercial ∪ expuestoAlComercial) − camposFijadosComercial`; lo no abierto **se ignora en silencio** server-side (whitelist de seguridad).
- Slots: por candidato, `todasLasVariantes ? variantes activas del material : lista fija`.
- Claves de salida del jobContext: implícitas en `buildJobContext` (sheet L2426-2784).

### 2.4 Auth: qué hay y qué falta

Hay (reutilizable): JWT Bearer + `AuthSession` en DB con revocación y doble validación (`auth.guard.ts`); el guard ya soporta "sabores" de sesión por flags del payload (`imp`, `plat`) — sumar `mcp` es el mismo patrón; permisos por request desde el rol (`permisos.ts`, deny-by-default en `PermisosGuard`); tenant por AsyncLocalStorage + extensión Prisma (`tenant-guard.extension.ts`); cifrado AES-256-GCM (`secretos.service.ts`) y precedente de token hasheado (`Invitation.tokenHash`); poda de márgenes (`@OcultaMargenes` + `finanzas.ver_margenes`); auditoría (`EventoAcceso`).

Falta: modelo de credencial de larga duración; rama de autenticación para token opaco; intersección permisos rol ∩ scopes de credencial; rate limiting por credencial (hoy `ThrottlerGuard` 100/min **por IP** — todo el tráfico saliente de Anthropic/OpenAI compartiría cubeta); cache de sesión multi-réplica; superficie MCP y UI de gestión.

Trampas documentadas: sin contexto ALS la extensión Prisma **no filtra nada** (tenant-guard L63); `request.auth` sin `permisos` ⇒ `MargenesInterceptor` no poda y `PermisosGuard` deniega todo; `@SinTenant` no es opción (saltea PermisosGuard); no copiar `EnlacePublico` (token en claro) — copiar `Invitation.tokenHash`.

### 2.5 Antecedente competitivo

HoldPrint tiene "Orç.ai" (cotización por IA/WhatsApp): cada producto trae `budgetAIGeneralInstructions` / `budgetAIWorkMeasuresInstructions` / `budgetAIChecklistInstructions` — **instrucciones en lenguaje natural por producto** que le dicen a la IA qué preguntar y cómo interpretar medidas (`holdprint-productos-relevamiento.md:50-62`). Nuestro equivalente estructural es el formulario derivado (§4); el equivalente textual es F3.

---

## 3. Arquitectura

### 3.1 Principio rector: el MCP es un cliente más del API

El servidor MCP **no llama services directamente**. Cada tool hace HTTP loopback contra el propio API Nest con un JWT emitido para la credencial. Así hereda sin tocar nada: ThrottlerGuard → AuthGuard → PermisosGuard → TenantContextInterceptor (ALS) → tenant-guard de Prisma → MargenesInterceptor. Evita de raíz el riesgo #1 (camino que corre fuera del pipeline y ve todos los tenants) y los dos comportamientos divergentes del `auth.permisos` vacío.

```
IA del tenant (claude.ai / ChatGPT / API MCP connector)
   │  Streamable HTTP  (Authorization: Bearer <token de credencial>)
   ▼
apps/api  módulo mcp/  (transporte + sesión MCP + validación previa)
   │  HTTP loopback  (Authorization: Bearer <JWT corto emitido por la credencial>)
   ▼
API Nest existente (pipeline completo de guards/interceptors)
```

### 3.2 Transporte y ubicación

- **Streamable HTTP** (`@modelcontextprotocol/sdk`, `StreamableHTTPServerTransport`) montado en el propio Nest bajo `/api/mcp`. Es el transporte que aceptan el conector custom de claude.ai y el MCP connector del API de Anthropic (`mcp_servers: [{type:'url', url, authorization_token}]` + `mcp_toolset`).
- Un solo deploy: sin servicio nuevo, sin CORS nuevo (el MCP no pasa por el proxy de Next; habla directo con Nest, como ya está preparado el API para consumidores non-browser).

### 3.3 Credencial: `CredencialMcp`

```prisma
model CredencialMcp {
  id            String    @id @default(uuid())
  tenantId      String
  membershipId  String    // hereda rol + ipsPermitidas del usuario emisor
  nombre        String    // "Claude de Lucas", "Bot mostrador"
  tokenHash     String    @unique   // SHA-256 del token opaco `grafo_mcp_...`
  pista         String    // últimos 4 chars, patrón IntegracionTenant
  scopes        String[]  // subset de permisos; efectivos = rol ∩ scopes
  expiraEl      DateTime?
  revocadoEl    DateTime?
  ultimoUsoEl   DateTime?
  creadaPorId   String
  creadoEl      DateTime  @default(now())
  @@index([tenantId])
}
```

- **Token opaco** `grafo_mcp_<32 bytes base64url>`, mostrado una sola vez, guardado hasheado (patrón `Invitation.tokenHash`, no `EnlacePublico`).
- **Autenticación:** rama nueva en `AuthGuard` (o guard previo) para el prefijo `grafo_mcp_`: resuelve credencial → valida `revocadoEl`/`expiraEl`/membership activa/tenant activo → construye el mismo `CurrentAuth` con `permisos = expandir(rol) ∩ scopes` y flag `mcp: credencialId`. **Siempre poblar `permisos`** (si queda `undefined`: márgenes sin podar + permisos denegando — los dos bugs a la vez).
- Alternativa considerada y descartada: `AuthSession` de larga duración — choca con `SESION_VIDA_MAXIMA_MS` (7 días) y la renovación por inactividad; excepcionarlo ensucia `sesion-vida.ts`.
- **Scopes F1:** `comercial.ver` + `costos.ver` + `registros.ver`. **Nunca** `finanzas.ver_margenes`: la respuesta del motor pasa por `@OcultaMargenes` y la IA no ve costos ni márgenes, solo precios. F2 agrega `comercial.gestionar` + `registros.gestionar` opcionales por credencial.
- Se consulta siempre por `tokenHash` único global (como `EnlacePublico.token`) sin contexto de tenant ⇒ agregar `CredencialMcp` a `MODELOS_EXENTOS` del tenant-guard, y el `tenantId` sale de la propia fila.
- Revocación: además de `revocadoEl`, invalidar `SessionCacheService` (y anotar que sigue siendo per-réplica; TTL 30 s acota la ventana).
- Auditoría: `EventoAcceso` tipo nuevo `credencial_mcp_creada|revocada` (string libre, sin migración) + `ultimoUsoEl` best-effort.
- UI: Configuración → Integraciones → "Conectar tu IA" (crear/listar/revocar, copiar token una vez, instrucciones de conexión por cliente).

### 3.4 Auth del lado del conector

- **F1:** el tenant pega el token como bearer. Funciona hoy con: MCP connector del API de Anthropic (`authorization_token`), Claude Code / Claude Desktop (`mcp.json` con header), y cualquier framework de agentes.
- **F3:** OAuth 2.1 mínimo (authorization code + PKCE + dynamic client registration) para que el conector custom de claude.ai se conecte con "Iniciar sesión en Grafo". El authorization server emite tokens que mapean a una `CredencialMcp` creada al consentir. No bloquea F1.

### 3.5 Rate limiting

Named throttler `mcp` con tracker por `credencialId` (hoy no existe `getTracker` custom; el default por IP haría que todos los tenants detrás del egress de Anthropic compartan 100/min). Propuesta: 30 req/min por credencial para tools de lectura, 10/min para `cotizar` (cada llamada es un cálculo pesado con transacciones). El precedente del 429 envenenando corridas está documentado (`derivadores-geometricos-diseno.md:303`) — los mensajes de error del MCP deben indicar "esperá y reintentá".

---

## 4. La pieza nueva del API: `GET /productos-servicios/productos/:id/formulario-cotizacion`

El cruce producto×familia×ruta que hoy hace el sheet pasa al server, como recurso derivado. Query: `?rutaAlternativaId=` (default: `esPreferida`). Respuesta = lista plana y ordenada de **preguntas**, cada una con su **clave de jobContext explícita** (hoy implícita en `buildJobContext`):

```jsonc
{
  "producto": { "id", "codigo", "nombre", "descripcion", "categoria", "subcategoria",
                "unidadComercial", "activo", "tercerizado", "validacion": {"exitoso", "errores"} },
  "rutas": [{ "id", "nombre", "esPreferida", "tieneReglaAuto" }],   // >1 sin regla ⇒ preguntar
  "cantidad": { "jobContextKey": "cantidad", "unidad": "unidad|m2|metro_lineal",
                "minimo": { "politica", "cantidad", "base" } },
  "medidas": {
    "modo": "FIJA|LIBRE|COMERCIAL_ELIGE|MIXTA",
    "instruccion": "no_preguntar|elegir_predefinida|pedir_ancho_alto|predefinida_o_custom",
    "unidadEntrada": "mm",                                          // la UI usa cm; acá SIEMPRE mm
    "predefinidas": [{ "id", "nombre", "anchoMm", "altoMm", "esDefault" }],
    "default": { "anchoMm", "altoMm" }
  },
  "preguntas": [   // por configPaso ejecutable, en orden de ruta
    { "configPasoId", "paso": "nombreVisible ?? familiaNombre",     // nunca el UUID de PasoTenant
      "tipo": "param",          "campo", "etiqueta", "tipoDato", "valoresPermitidos", "sugerido",
                                "requerido", "descripcion",
                                "jobContextKey": "configPasoRuntime.<configPasoId>.<campo>" },
    { "tipo": "material",       "slotCodigo", "slotNombre", "requerido": true,
                                "jobContextKey": "slotMateriales.<configPasoId>_<slotCodigo>",
                                "opciones": [{ "varianteId", "etiqueta",      // legible: material · espesor · color
                                               "esDefault", "sinPrecio" }] },
    { "tipo": "modo_color",     "opciones": ["CMYK", "BN"], "default": "CMYK",
                                "jobContextKey": "modoColor_<configPasoId>" },
    { "tipo": "cobertura",      "opciones": ["borrador","normal","alta"], "default": "normal",
                                "jobContextKey": "cobertura_<configPasoId>" },
    { "tipo": "tiempo_manual",  "unidad": "minutos", "jobContextKey": "tiempoManualMin_<configPasoId>" },
    { "tipo": "tercerizado_eje","eje", "valores": [], "jobContextKey": "tercerizado_<configPasoId>.<eje>" }
  ],
  "multiplicadores": [ { "campo": "caras", "valores": [1,2], "default": 1, "obligatorio": true } ],
  "adicionales": [ { "id", "tipo": "paso|cargo_paso|cargo_cotizacion", "nombre", "descripcion",
                     "jobContextKey": "opcionalesActivados.<id>", "requiereIds": [] } ],
  "personalizaciones": [ { "codigo", "nombre", "obligatoria", "modoMedida",
                           "jobContextKey": "personalizacion_<codigo>_areaM2" } ],
  "validaciones": [ { "tipo": "IN_RANGE|ONE_OF|COMPARE|REQUIRES_INPUT", "campo", "detalle" } ]
}
```

Reglas de derivación (todas ya existen, se portan del cliente al server):
- ejecutables: `esConfigPasoEjecutable` · params abiertos: `paramsEfectivos()` (ya es server-side en `params-runtime.ts`) · slots: `modoSeleccion === 'COMERCIAL_ELIGE'` + candidatos/variantes del detalle · modo color: intersección perfil × candidata × `modoColorConfig.allowedModes` · multiplicadores: unión de `multiplicadoresActivos` de pasos activos · adicionales: los tres orígenes (paso OPCIONAL, cargo de paso, cargo de cotización) + `requiereRutaPasoIds`.

**Este endpoint le sirve también al frontend** (a futuro, achicar el sheet) y es testeable contra el sheet actual como golden master de derivación. Permiso: `comercial.ver` (es la vista comercial del producto, sin costos).

---

## 5. Tools MCP (F1)

Pocas y bien descritas — la descripción de cada tool es el prompt que gobierna cuándo la IA la usa.

| Tool | Wrappea | Notas |
|---|---|---|
| `buscar_productos(consulta, pagina?)` | `GET /productos-servicios/productos?search=` | Devuelve `id, codigo, nombre, descripcion, categoria, unidadComercial`. Si hay 0 hits, sugerir reformular (search solo matchea nombre/código). |
| `formulario_cotizacion(productoId, rutaAlternativaId?)` | endpoint nuevo (§4) | La IA la llama SIEMPRE antes de cotizar un producto nuevo en la conversación. |
| `cotizar(productoId, cantidad, respuestas, clienteId?, descuento?)` | `POST /motor-universal/cotizar` | `respuestas` = mapa `jobContextKey → valor`; el MCP lo traduce a `jobContext` (§5.1). Dry-run, idempotente, sin persistencia. |
| `buscar_cliente(consulta | documento)` | `GET /clientes?q=` + `GET /clientes/por-documento/:doc` | Para precio especial por cliente. Solo lectura en F1. |

### 5.1 La capa de traducción y validación (el trabajo real del MCP)

El motor no valida `jobContext` (§2.1) y descarta en silencio lo no whitelisteado. El MCP es el único punto de validación previa:

1. **Traducir** `respuestas` (claves declaradas por el formulario) → `jobContext` real (`slotMateriales.X` → `slotMateriales: {X: v}`, `configPasoRuntime.<id>.<campo>` → anidado, etc.). La IA nunca arma el `jobContext` a mano.
2. **Rechazar con mensaje claro** (antes de pegarle al motor):
   - medidas `anchoMm <= 0 || altoMm <= 0` — **replica obligatoria del guard del sheet** (L2319-2333): una pieza 0×0 dispara división por cero en nesting de rígidos y tumba el API por OOM;
   - `cantidad` no entera o ≤ 0; tipos que no matchean el `tipoDato` del formulario; valores fuera de `valoresPermitidos`; `varianteId` fuera de los candidatos del slot; claves que el formulario no declaró (en vez del descarte silencioso del motor).
3. **Completar**: `piezaAreaTotalM2`/`piezaPerimetroTotalM` como las calcula el sheet; `medidaCustomMm` si hay una sola pieza; `periodo` omitido (default server + carry-forward).
4. **Formatear la respuesta para conversación**: precio neto/bruto, unitario y total, moneda, mínimo comercial aplicado, plazo tercerizado si existe, y `errores[].sugerencia` del motor cuando `exitoso: false` (son accionables: "falta elegir material del slot X").
5. **Nunca exponer**: `costos.*`, `desglosePrecio.margenEfectivoPct`, tarifas — doble cinturón: la credencial no tiene `finanzas.ver_margenes` (poda server-side) y el formateador del MCP igual no serializa esos campos.

### 5.2 Tools F2 (escritura, con humano en el loop)

- `guardar_cotizacion(items[])` → N × `cotizar-y-guardar` (secuencial; evaluar endpoint batch si duele).
- `emitir_presupuesto(cotizacionId, clienteId, ...)` → `POST /presupuestos/emitir`. ⚠️ hoy emitir **numera y envía al cliente en el mismo acto**; para el flujo IA hace falta el modo "emitir sin enviar" (flag `soloEmitir` o endpoint nuevo) para que un humano revise antes — hueco ya identificado en el módulo.
- `crear_cliente_por_documento(nombre, documento, ...)` → `POST /clientes/alta-por-documento` (idempotente, sin email). Pendiente del módulo clientes: búsqueda por CUIT no existe.
- Regla: toda escritura la confirma el usuario en su chat ("¿emito el presupuesto por $X?") — instrucción en la descripción de la tool + naturaleza del cliente MCP (claude.ai pide confirmación para tools de escritura).

---

## 6. Journey de referencia

> **Dueño:** cotizame 500 volantes A5 doble faz en ilustración 150
> **IA:** `buscar_productos("volantes")` → 1 hit → `formulario_cotizacion(id)` → ve: medidas COMERCIAL_ELIGE (A5 predefinida), multiplicador `caras`, slot papel COMERCIAL_ELIGE con 4 variantes → matchea "ilustración 150" con la etiqueta de una variante → `cotizar(id, 500, {medida: A5, caras: 2, slot: variante})`
> **IA:** "500 volantes A5 doble faz en ilustración 150g: **$48.500** ($97 c/u). ¿Querés que lo guarde como presupuesto?" *(F2)*

Casos de error que la IA resuelve sola gracias a `errores[].sugerencia`: material no elegido, mínimo comercial (`BLOQUEAR` → propone la cantidad mínima), tarifa no publicada (→ "avisale al administrador que publique las tarifas del período").

---

## 7. Seguridad — resumen normativo

1. **Un token = un tenant + una membership.** El `tenantId` jamás viaja en el request; sale de la credencial, como hoy sale de la sesión.
2. **Pipeline completo siempre** (loopback HTTP). Prohibido llamar services del motor directo desde el módulo MCP.
3. **Permisos efectivos = rol ∩ scopes**, siempre poblados. Deny-by-default se hereda de `PermisosGuard`.
4. **Sin `finanzas.ver_margenes` nunca** en credenciales MCP (F1 hard-coded; revisar si algún tenant lo pide).
5. **Prompt injection:** los datos que devuelven las tools (nombres de productos, clientes, observaciones) son datos, no instrucciones. Las tools no aceptan parámetros que permitan redirigir salida a terceros. Ninguna tool manda mensajes (WhatsApp queda del lado del sistema, post-emitir, F2).
6. **Escrituras** (F2): confirmación explícita del usuario en su chat; `emitir` desacoplado de `enviar`.
7. **Validación previa al motor** obligatoria (§5.1) — el motor no se defiende solo (OOM 0×0, descarte silencioso).
8. **Throttling por credencial** con named throttler propio.
9. **Revocación** desde la UI con efecto ≤ 30 s (TTL cache); documentar la ventana.

---

## 8. Fases

**F1 — Cotizar (el "wow"):**
1. Migración `CredencialMcp` + rama en `AuthGuard` + intersección scopes + exención tenant-guard.
2. Endpoint `formulario-cotizacion` (derivación server-side; golden master contra el sheet en 5-6 productos reales del tenant demo: volante, banner con ojales, talonario, taza DTF, sello, anillado).
3. Módulo `mcp/` (Streamable HTTP + 4 tools + capa de traducción/validación).
4. Named throttler `mcp` + tracker por credencial.
5. UI mínima de credenciales en Configuración → Integraciones.
6. Prueba de punta a punta con Claude Desktop/Code y con el MCP connector del API.

**F2 — Presupuestar:** `soloEmitir` en presupuestos, tools de escritura con confirmación, alta de cliente por documento, quizá batch de `cotizar-y-guardar`.

**F3 — Distribución y afinado:** OAuth 2.1 + DCR para el conector custom de claude.ai; campo `instruccionesIA` por producto (patrón HoldPrint: "preguntá el diámetro en cm, es una taza"); métricas de uso por credencial en el Panel.

---

## 9. Riesgos y decisiones abiertas

| Riesgo / decisión | Postura |
|---|---|
| Derivación del formulario diverge del sheet | Golden master F1; a mediano plazo el sheet consume el mismo endpoint |
| `fijado_por_cantidad` devuelve precio 0 si la cantidad no matchea un tier (calculador-precio.ts:136) | El MCP detecta precio 0 + mensaje y ofrece las cantidades válidas del tier |
| Ítems fuera de catálogo no existen (`productoId` obligatorio) | F1 responde "ese producto no está en tu catálogo"; el diseño aprobado en `presupuestos-modulo-estudio.md` §4 sigue pendiente |
| Cache de sesión per-réplica | Aceptado en F1 (una réplica); Redis cuando escale, ya anotado en `session-cache.service.ts` |
| ¿Scopes granulares por tool además de permisos? | No en F1 — los permisos del rol alcanzan; revisar en F2 con escrituras |
| ¿Exponer `cotizar-y-guardar` en F1? | No. Solo dry-run. Persistir es F2 con confirmación |
| SDK MCP en Nest (versiones, sesiones streamable) | Spike técnico al inicio de F1.3 |
