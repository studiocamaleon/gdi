# Centro de copiado como módulo configurable, activable y facturable

Diseño para sacar al Centro de copiado del estado "atado con alambre" y volverlo
un **módulo de primera clase**: configurable por el tenant, ocultable del
catálogo, activable/desactivable por plan y facturable aparte — reusando el motor
de costeo de cada tenant.

Base del feature: [tpv-centro-copiado-diseno.md](tpv-centro-copiado-diseno.md).
Mecánica de planes: [control-plane-diseno.md](control-plane-diseno.md).

## 1. El problema (la fragilidad de hoy)

El TPV se apoya en un **producto plantilla** `SYS-IMPRESION-DOC` con su ruta
`CC-IMPRESION-DOC` (un paso `impresion_por_hoja`). Hoy:

1. **Se identifica por un `codigo` mágico.** El service busca el producto por
   `CC_PRODUCTO_CODIGO` y lo **auto-provisiona** si falta
   (`provisionar-plantilla.ts`), resolviendo máquinas y papeles **por rol**
   (primera láser color / primera B/N, todos los `SUSTRATO_HOJA`). El acople es
   un string hardcodeado, no una configuración.
2. **Vive en el catálogo normal.** Aparece en el sheet de productos, es
   editable y borrable. Si lo borran se auto-recrea; si lo **editan**, se rompe
   el costeo del centro de copiado sin que nadie entienda por qué. No hay ninguna
   marca de "esto es del sistema, no lo toques".
3. **No es un módulo.** No se puede activar/desactivar ni facturar por tenant; es
   código siempre presente para todos.

Ninguna de las tres es un bug — fue la forma pragmática de shippear. Pero para
**productizarlo** (venderlo como módulo) hay que arreglar las tres.

## 2. Objetivo

- El tenant **configura** el centro de copiado desde un panel limpio; nunca toca
  el producto/ruta crudos.
- La plantilla del motor es un **artefacto derivado** de esa configuración
  (invisible, de sistema, auto-sanable), no un producto de catálogo.
- El módulo se **activa/desactiva por plan** (feature flag) y se factura aparte.
- Todo **sigue reusando el motor del tenant**: sus máquinas, sus papeles, sus
  tarifas. La config sólo decide *qué* de eso se ofrece, no reimplementa costeo.

## 3. Diseño: tres pilares

### Pilar A — La plantilla pasa a ser entidad DE SISTEMA

Agregar una marca de "gestionado por el sistema" a `Producto` (y `Ruta`):

```prisma
model Producto {
  ...
  /// Si != null, este producto lo gestiona un módulo del sistema (ej.
  /// "centro_copiado"): no se lista en el catálogo, no se edita ni se borra
  /// desde la UI, y lo materializa/regenera el módulo desde su config.
  sistemaCodigo String?
}
```

Consecuencias:

- **Se filtra del catálogo.** `productos.service.ts:listarProductos` agrega
  `where: { sistemaCodigo: null }` (o el flag que se elija). Idem
  `rutas-produccion.service.ts:listarRutas`.
- **Se bloquea editar/borrar** desde la UI: el controller de productos rechaza
  mutaciones sobre un producto con `sistemaCodigo != null` (o el front ni ofrece
  las acciones). El motor lo sigue usando internamente igual que hoy.
- **Auto-sanable.** Si por una migración o borrado directo faltara, el módulo lo
  regenera desde su config (el provisionador ya es idempotente y race-safe).

> El feature flag como identificador reemplaza al `codigo` mágico como "esto es
> el centro de copiado". El `codigo` sigue existiendo (clave única del producto),
> pero la *semántica de sistema* la da `sistemaCodigo`.

### Pilar B — Una configuración por tenant como fuente de verdad

Nueva entidad **`CentroCopiadoConfig`** (una por tenant) + una página en
**Configuración › Centro de copiado**. Es la **fuente de verdad**; la plantilla
del motor se **deriva** de ella.

```prisma
model CentroCopiadoConfig {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @unique @db.Uuid
  activo    Boolean  @default(true)   // el tenant puede pausarlo aunque el plan lo permita

  /// Máquinas del centro (en vez de auto-resolver por rol). Referencias a las
  /// máquinas del tenant, con su papel: color / blanco y negro.
  maquinaColorId String? @db.Uuid
  maquinaBnId    String? @db.Uuid

  /// Qué se ofrece en el modal. JSON a propósito: cambia seguido y no necesita
  /// FKs duras. Ver "Modelo de config" abajo.
  papelesJson       Json   // [{ materiaPrimaId, gramajes:[..] }]
  tamanosJson       Json   // ["A4","A3","Oficio","SRA3",...] (del catálogo de formatos)
  terminacionesJson Json   // [{ codigo, nombre, pasoOpcionalId? }]

  /// Config de precio del producto plantilla (margen, etc.).
  precioConfigJson  Json?

  /// (Futuro) mapeo a la impresora de PrintNode por máquina.
  impresionJson     Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

**Flujo de derivación (config → plantilla):**

1. El tenant edita la config en el panel.
2. Al guardar (o lazily, en el primer uso), `provisionarPlantillaCentroCopiado`
   pasa a **materializar la plantilla DESDE la config** en vez de auto-resolver
   por rol:
   - Máquinas candidatas = `maquinaColorId` / `maquinaBnId`.
   - Slot de papel = candidatos = `papelesJson` (subset elegido, no "todos los
     SUSTRATO_HOJA").
   - `precioConfigJson` del producto = el de la config.
   - Terminaciones que ofrece el modal = `terminacionesJson`.
   - Si la config cambió, se **regenera** la plantilla (borra+recrea la ruta
     alternativa/config-pasos, o hace upsert idempotente).
3. El endpoint `opciones` del modal deja de derivar papeles/tamaños de la materia
   prima y pasa a devolver **exactamente lo configurado**.

Así el usuario configura un panel entendible y **nunca ve ni edita el producto
crudo**; la magia del motor queda del lado del sistema.

**Default / primer uso:** si no hay `CentroCopiadoConfig`, se crea una con los
valores que hoy auto-resuelve el provisionador (primera láser color/BN, todos los
papeles, tamaños A4/A3/Oficio/SRA3/SRA3+/SRA3++, terminación Anillado). Así los
tenants que ya lo usan no se rompen: la config default = comportamiento actual.

### Pilar C — Gating por feature de plan (módulo vendible)

Ya existe el mecanismo: `Plan.featuresJson` + `SuscripcionesService.feature(
tenantId, clave)` (los services preguntan; hoy `afip` y `whatsapp` son flags
booleanos así). Se agrega:

- `featuresJson.centroCopiado: boolean` en los planes que lo incluyan.
- `FeaturePlan` (el tipo de claves) gana `"centroCopiado"`.
- **Gating de todo el módulo** por `feature(tenantId, "centroCopiado")`:
  - **Backend:** un guard en `CentroCopiadoController` (o un check al entrar a
    cada endpoint) que 403 si el tenant no tiene el feature.
  - **Frontend:** la entrada del modal (botón "Centro de copiado" + atajo `C` en
    la ficha) y la página de Configuración › Centro de copiado sólo se muestran
    si el feature está activo. El sidebar/las capabilities del usuario ya se
    resuelven por tenant.
- **Precio en Paddle:** como los demás add-ons — el precio vive en Paddle, el
  feature en nuestra base (ver control-plane-diseno.md).

Doble interruptor: **el plan habilita** el módulo (`feature`), y el tenant lo
**activa** (`CentroCopiadoConfig.activo`). El plan manda: sin feature, ni se ve.

## 4. Cómo esto mata cada fragilidad

| Fragilidad de hoy | Con el diseño |
|---|---|
| Producto identificado por `codigo` mágico | `sistemaCodigo` (marca de sistema) + config explícita |
| Se lista/edita/borra en el catálogo | Filtrado y bloqueado por `sistemaCodigo` |
| El cliente "crea" el producto/ruta | El cliente **configura**; la plantilla se **deriva** |
| "¿y si crea una ruta X?" | Irrelevante: el módulo usa su plantilla derivada, no rutas de usuario |
| No es un módulo activable/facturable | `featuresJson.centroCopiado` + Paddle |
| Máquinas/papeles auto-resueltos por rol | Elegidos explícitamente en la config |

## 5. Puntos de enganche concretos

- **Provisionador:** `apps/api/src/centro-copiado/provisionar-plantilla.ts` —
  hoy resuelve por rol; pasa a leer `CentroCopiadoConfig` y materializar desde
  ahí. Agregar `sistemaCodigo: "centro_copiado"` al `Producto`/`Ruta` que crea.
- **Service:** `apps/api/src/centro-copiado/centro-copiado.service.ts` — `contexto()`
  y `opciones()` leen la config (máquinas/papeles/tamaños/terminaciones
  configurados) en vez de derivar de la materia prima. `TERMINACIONES_DISPONIBLES`
  deja de ser constante y sale de `terminacionesJson`.
- **Catálogo:** `apps/api/src/productos-servicios/productos.service.ts:33`
  (`listarProductos`) y `rutas-produccion.service.ts:22` (`listarRutas`) filtran
  `sistemaCodigo: null`. El controller de productos rechaza mutar productos de
  sistema.
- **Plan/feature:** `apps/api/src/suscripciones/suscripciones.service.ts:148`
  (`feature()`) + el tipo `FeaturePlan`. Guard nuevo en `CentroCopiadoController`.
- **Config (nuevo módulo):** `apps/api/src/centro-copiado/` gana endpoints
  `GET/PUT /centro-copiado/config`; el front una página
  `src/app/(dashboard)/configuracion/centro-copiado/`.
- **Front gating:** el botón/atajo del modal en `propuesta-ficha.tsx` y la entrada
  del sidebar, condicionados al feature del tenant.

## 6. Qué NO cambia (se reutiliza tal cual)

- El **motor universal** y toda la matemática (adaptador páginas→hojas, pliego por
  cotización, `omitirSetupCleanup`, tomos, etc.).
- El **modal** y el flujo de staging/persistencia (`construir-items`,
  `guardar-tomo`, la subida a R2).
- La **cotización → OT → producción**. El módulo sólo cambia *de dónde salen* la
  plantilla y las opciones, no *cómo se cotiza*.

## 7. Migración

1. Migración Prisma: `Producto.sistemaCodigo` (+ `Ruta` si aplica) nullable;
   tabla `CentroCopiadoConfig`.
2. Backfill: a cada tenant que ya tenga `SYS-IMPRESION-DOC`, setearle
   `sistemaCodigo = "centro_copiado"` y crear su `CentroCopiadoConfig` default a
   partir de lo que hoy tiene provisionado (máquinas/papeles actuales). Así el
   comportamiento no cambia el día del deploy.
3. `featuresJson.centroCopiado`: los planes que hoy deberían tenerlo se marcan en
   el control plane. **Cuidado legacy:** tenants sin suscripción se tratan como
   legacy (ver suscripciones.service.ts) — decidir si legacy lo tiene por default
   (recomendado: sí, para no apagarlo a quien ya lo usa).

## 8. Fases sugeridas

1. **Fase 1 — Robustez (sin UI nueva):** `sistemaCodigo` + esconder del catálogo
   + bloquear edición/borrado + gating por `feature`. Con esto el feature deja de
   ser frágil y ya es "de sistema" y facturable, aunque la config siga siendo la
   auto-resolución de hoy. **El mayor ROI con el menor riesgo.**
2. **Fase 2 — Configuración:** `CentroCopiadoConfig` + página de Configuración +
   provisionador que materializa desde la config. Acá el tenant elige máquinas,
   papeles, tamaños y terminaciones.
3. **Fase 3 — Terminaciones y producción reales:** terminaciones como pasos
   opcionales con costo (anilladora/anillos), y el mapeo a PrintNode por máquina
   (ver la charla de impresión directa).

## 9. Decisiones abiertas

- **`sistemaCodigo` string vs `esSistema` boolean.** Un string permite más de un
  módulo de sistema en el futuro (no sólo centro de copiado); un boolean es más
  simple. Recomiendo el **string** (`"centro_copiado"`).
- **Config: fuente de verdad total, o parcial.** ¿La config reemplaza del todo la
  auto-resolución, o auto-resuelve defaults y el tenant sólo ajusta? Recomiendo
  **config = fuente de verdad, con un default auto-resuelto** al crearla.
- **Regeneración de la plantilla:** ¿al guardar la config (eager) o lazily en el
  próximo uso? Lazily es más simple y ya es el patrón; eager da feedback inmediato
  en el panel. Se puede empezar lazy.
- **Legacy sin plan:** ¿tiene el feature por default? (recomendado: sí).
- **Nombre del feature/módulo de cara al cliente** (para el sidebar y Paddle).
