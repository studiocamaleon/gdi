# Pasos componibles — plan técnico (Etapas A, C, D, E)

> Ejecuta las decisiones cerradas en `docs/pasos-componibles-diseno.md` §8.
> Orden decidido: **A → C → D**, con B (nesting parametrizado) diferida.
> Punto de restauración: `v3.8-pre-abstraccion-pasos` (ver
> `backups/README-rollback.md`).
>
> Regla de trabajo: una rama por etapa, merge a main con la etapa verificada
> antes de arrancar la siguiente. Vistas nuevas nacen con `.module.css`
> (`npm run css:guard` antes de cerrar UI).

---

## Etapa A — Limpieza Tipo A

**Objetivo**: que el motor deje de nombrar familias concretas cuando lo que
está expresando son datos de la familia. Al cierre, todo `familiaCodigo ===`
que quede en el código es Tipo B (geometría/nesting) y está documentado como
tal.

### A.1 Censo (entregable, no exploración)

Tabla línea por línea de los **51** `familiaCodigo === '<código>'` reales
(sin tests) con veredicto A/B. Se agrega como apéndice a este documento.
Reparto conocido: `motor.service.ts` 21, `nesting-config.ts` 16,
`nesting-dispatcher.ts` 9, `config-pasos.service.ts` 5.

Los ya clasificados al escribir este plan:

| Ubicación | Qué es | Veredicto |
|---|---|---|
| `motor.service.ts:5414` `esTipoPerfilCompatibleConFamilia` | plotter→CORTE\|MIXTO, área→IMPRESION\|MIXTO | **A** — campo `tiposPerfilCompatibles` |
| `config-pasos.service.ts:14` `tipoPerfilCompatibleConFamilia` | **la misma lógica, duplicada** | **A** — mismo campo, una sola fuente |
| `config-pasos.service.ts:29` `normalizarFormulaSlotMaterial` | laminado+film → `por_metro_lineal` | **A** — el slot declara `formulaDefault` |
| `config-pasos.service.ts:110,466` | validaciones plotter vs plantilla de máquina | censar: probable **A** (compatibilidad declarable) |
| `nesting-config.ts` / `nesting-dispatcher.ts` (25 refs) | runners y config de nesting | **B** — quedan, son la frontera |
| `motor.service.ts` resto (~19) | guards de nesting, herencia guillotina, mutaciones de JobContext (ojales, modificacion_pre) | censar uno a uno |

### A.2 Cambios

1. Nuevos campos opcionales en `DefinicionFamilia` (types.ts) para cada
   dato que hoy es un `if`: `tiposPerfilCompatibles?: string[]`,
   `formulaDefault` en `SlotDeclarado`, y los que surjan del censo.
2. Poblar esos campos en `familias.ts` **solo** en las familias que hoy
   tienen el `if` (comportamiento idéntico, cero cambios para el resto).
3. Reemplazar cada `if` Tipo A por lectura de la declaración, borrando la
   duplicación motor/config-pasos.
4. Los Tipo B que queden se marcan con un comentario uniforme
   (`// FRONTERA-NESTING:`) para que el censo no se desactualice.

### A.3 Verificación y cierre

- La suite del motor (`motor.spec.ts`, 3.6k líneas) pasa **sin tocar un
  solo test**: si un test necesita cambio, el paso 2 rompió comportamiento.
- `npx tsc --noEmit` en apps/api.
- Cotización E2E de un producto con plotter + área + laminado (los tres
  afectados) comparando desglose antes/después: idéntico al centavo.
- **Done** = cero `familiaCodigo ===` fuera de los marcados
  `FRONTERA-NESTING`, censo apendizado, merge a main.

Riesgo: bajo. Es mover datos de lugar con red de tests densa.

---

## Etapa C — Tabla de familias tenant + resolver

> **Estado 2026-07-29: código COMPLETO** (commit a87c4301 en
> `feat/pasos-familias-tenant`): migración, resolver, CRUD, 16 tests en
> verde, suite idéntica a la base. Tres desvíos del diseño de abajo,
> deliberados: (1) la estación NO se duplica como columna — la API escribe
> `EstacionFamilia`, que ya es la fuente del ruteo; (2) validador puro en
> vez de zod — el repo no tiene zod y usa class-validator para el formato;
> (3) autorización por `@Permiso('costos.gestionar')` en vez de rol a mano —
> es el mismo permiso que editar rutas, por default sólo del administrador.
>
> **E2E de cierre EJECUTADO 2026-07-29** (con la sesión del usuario, flujo
> completo por UI): la "Serigrafía manual"
> (`754f8569-0c49-4ff4-9670-7babcaa7e610`, estación Produccion & Taller) se
> agregó como paso extra a un producto duplicado de prueba ("Imanes PRUEBA
> serigrafia E2E"), se cotizó (OT-2026-0002, cliente de prueba SIN teléfono,
> cero WhatsApps verificado en NotificacionWhatsapp), se emitió y se
> ejecutó la ruta entera en el tablero. Todo lo estructural anduvo a la
> primera: el selector de pasos la ofrece, el editor renderiza su contrato
> (slot "Tinta de serigrafía", productividad propia T-2), el motor la costeó
> exacto (100 u ÷ 60/h = 100 min a la tarifa del centro, $41.959, output
> canónico `piezas_estampadas: 100` en el snapshot), la regla de secuencia
> la mantuvo no-ejecutable hasta completar los 4 pasos previos, ruteó a
> Produccion & Taller, corrió con CRONÓMETRO (iniciar/pausar/completar) y la
> OT cerró finalizada con tiempoRealMin=100 declarado.
>
> **Bug encontrado y arreglado en el E2E**: `resolverNombreVisiblePaso`
> (motor) caía en `humanizarCodigo(familiaCodigo)` sin consultar el nombre
> de la familia — para una tenant eso mostraba el UUID en el desglose, el
> snapshot y el paso materializado. Fix: `resolverFamilia(...)?.nombre`
> antes del humanizador; suite del motor idéntica (mismos 18 preexistentes).
> Los labels ya guardados de la OT de prueba se corrigieron por SQL.

**Objetivo**: el motor aprende a leer familias desde la base sin que exista
UI de creación. Al cierre, una familia insertada a mano por API cotiza,
rutea a estación y registra tiempos exactamente como una del catálogo.

### C.1 Modelo (migración formal, no `db push`)

```prisma
/// Familia de pasos creada por el tenant (diseño §4). Las 42 del sistema
/// NO viven acá: siguen en familias.ts (decisión §8.1, híbrido). En los
/// familiaCodigo string del resto del schema viaja el UUID de esta tabla.
model FamiliaTenant {
  id          String  @id @default(uuid())
  tenantId    String
  tenant      Tenant  @relation(...)
  nombre      String
  descripcion String?

  /// La forma (§4.3): mismos vocabularios que DefinicionFamilia.
  categoria             String   // CategoriaFamiliaCodigo — agrupa en UI y da default de modoRegistro
  relacionMaquina       Json     // RelacionMaquina[]
  modosTiempo           Json     // ModoTiempo[]
  mecanismosCantidad    Json     // MecanismoCantidad[]
  modoActivacionDefault String
  slots                 Json     // SlotDeclarado[]
  multiplicadores       Json     // string[]
  modoRegistro          String?  // override; default por categoría como hoy
  tiposPerfilCompatibles Json?   // el campo que nace en Etapa A

  /// Ruteo (§8.4): la estación se elige en el wizard.
  estacionId  String?
  estacion    Estacion? @relation(...)

  /// Preset del catálogo del que nació, si nació de uno (analytics + UI).
  presetOrigen String?

  activo    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, nombre])
  @@index([tenantId, activo])
}
```

Notas:

- **Sin enum de DB** para los ejes: los vocabularios viven en types.ts y
  valida un schema zod compartido (`familia-tenant.schema.ts`) que es la
  única puerta de escritura. Así los vocabularios no se duplican.
- `usada` no se persiste: se calcula al borrar (§C.4) consultando
  referencias. Evita un flag que puede mentir.

### C.2 El resolver único

```
resolverFamilia(codigo: string, tenantId: string): DefinicionFamilia
```

- Si `codigo` parsea como UUID → `FamiliaTenant` (scoped al tenant, cache
  en memoria por request como hace el motor con materiales). La fila se
  proyecta a `DefinicionFamilia` — misma interfaz, el motor no distingue.
- Si no → `FAMILIAS[codigo]` como hoy. `getFamilia` pasa a delegar acá.
- **Resolver ignora `activo`**: una familia inhabilitada sigue resolviendo
  para OTs/rutas históricas. `activo` solo filtra selectores y wizard.
- Puntos de integración a tocar (todos pasan hoy por `getFamilia`/
  `FAMILIAS[...]`): motor, config-pasos, `modoRegistroDeFamilia` (acepta
  UUID → lee `modoRegistro` de la fila o default por categoría), ruteo de
  estaciones (una familia tenant rutea por su `estacionId`, no por
  `EstacionFamilia`), validación pre-pasada.

### C.3 Snapshot al usar (§8.2)

`OrdenTrabajoItemPaso` ya se materializa desde `trazabilidadJson.pasos`
del snapshot del cotizador — la mitad del mecanismo existe. Se agrega:

- Al materializar pasos de una OT: copiar `modoRegistro` resuelto y
  `estacionId` resueltos al paso materializado (hoy se derivan en caliente
  de la familia). Con eso, editar la familia no re-rutea OTs en vuelo.
- La cotización ya congela el desglose económico; re-cotizar re-resuelve.
  No hace falta congelar la definición entera: basta congelar lo que el
  tablero consulta en caliente.

### C.4 API (sin UI)

`/productos-servicios/familias` — guard ADMIN (§8.7), tenant-scoped:

- `GET /` — merge catálogo (42, `origen: 'sistema'`) + tenant activas
  (`origen: 'tenant'`). Es lo que consumirán selectores y wizard.
- `POST /` — valida contra zod; crea.
- `PATCH /:id` — edita (solo tenant; las de sistema son inmutables).
- `DELETE /:id` — **borrar solo si virgen** (§8.6): cuenta referencias en
  RutaPaso/ProductoPasoExtra/pasos materializados; si >0 → 409 con mensaje
  que ofrece inhabilitar. `PATCH {activo:false}` inhabilita.

### C.5 Verificación y cierre

- Tests de integración (DB `gdi_saas_test` vía jest-setup-db, como
  siempre): resolver UUID/código, familia inhabilitada sigue resolviendo,
  borrado virgen vs usada, unicidad de nombre por tenant.
- E2E manual: insertar por API una familia "Serigrafía manual" (forma
  `sin máquina · con material · T-2`), armarle una ruta a un producto de
  prueba, cotizar, emitir OT, verla rutear a su estación y registrar
  tiempo con cronómetro. **Ese flujo completo es el done.**
- El motor no sabe que existió la etapa: cero cambios en cálculos.

Riesgo: medio. Todo está detrás del resolver; el peligro es algún caller
que lea `FAMILIAS` directo sin pasar por `getFamilia` — el censo de la
Etapa A ya deja mapeados esos accesos.

---

## Etapa D — Wizard de paso

> **Estado 2026-07-29: v1 COMPLETA y verificada E2E** (rama
> `feat/pasos-wizard`). Lo construido: vista "Pasos de producción" en el
> sidebar de Costos (listado de familias tenant con forma/estación/estado +
> catálogo del sistema en solo-lectura), wizard de 9 pasos en sheet con
> preguntas físicas, preview de costeo (visible-opcional §8.8) que usa la
> MISMA tarifa publicada que el motor, y el grupo "Tus pasos" primero en el
> selector de pasos extra.
>
> **E2E del criterio de done, ejecutado con la sesión del usuario**: se creó
> "Bordado" partiendo del preset Trabajo manual — el preset precargó todo,
> las 9 preguntas fluyeron, estación Produccion & Taller elegida, y el
> preview devolvió **100 min · $41.959,45**, exactamente el número que el
> motor real produjo en la cotización de serigrafía del E2E de la Etapa C
> (misma forma, misma tarifa): validación cruzada contra la realidad.
>
> Dos bugs cazados EN el E2E, arreglados en el momento: (1) elegir una
> opción de un HumanSelect cerraba el wizard — la lista se renderiza en un
> portal fuera del sheet y contaba como click-afuera; `disablePointerDismissal`
> en el Sheet (Base UI); (2) la segunda fila de "Tus pasos" quedaba
> RECORTADA — el layout del dashboard restringe altura, `.wrap` es flex
> column y las secciones se encogían (flex-shrink default) bajo un
> `overflow: hidden`; `flex: none` en la sección. El preview además tuvo que
> ajustar el transporte de errores: el ApiError del front sólo lee
> `message`, así que el validador manda los errores como array (apiRequest
> los une).
>
> **Scope-cut de la v1, RESUELTO 2026-07-29** (rama feat/pasos-edicion): la
> edición reusa el MISMO wizard precargado (sin la pregunta de preset),
> guarda con PATCH y preserva los códigos de los slots existentes — los
> productos configurados contra esos slots no pierden el vínculo. El ciclo
> de vida quedó completo: crear / editar / inhabilitar / reactivar /
> eliminar. El preview
> corre para T-1/T-2 espejando la aritmética exacta del motor (F.2.10, mismo
> ceil y misma tarifa via loadTarifasHorarias) — correr el motor entero
> exigiría producto+ruta que aún no existen al crear la familia; el desvío
> queda anotado en el código.

**Objetivo**: la feature visible. Un ADMIN crea un tipo de paso sin saber
qué es un eje.

### D.1 Ubicación y forma

- Vista nueva bajo Productos y servicios (donde viven los pasos hoy), con
  su `pasos-familias.module.css` (regla CSS vigente).
- Listado: las del tenant + las del sistema (solo lectura), buscador,
  inhabilitar/reactivar.
- Alta = wizard en diálogo (patrón Maquinaria: alta en diálogo, ficha con
  tabs para editar).

### D.2 El flujo (preguntas físicas, diseño §5)

```
0. ¿Partís de un paso existente?      → preset (default) o desde cero
1. ¿Requiere una máquina?             → M-0 / M-1 / M-2 (radio con ejemplos)
2. ¿Cómo se mide el tiempo?           → según respuesta 1 se acotan T-1..T-4
3. ¿Consume materiales?               → slots: tipo + ¿obligatorio? + compat
4. ¿De dónde sale la cantidad?        → mecanismos (con default por forma)
5. ¿Cómo entra a la ruta?             → modoActivacion default
6. ¿Dónde se hace?                    → estación (default: general) (§8.4)
7. ¿Cómo se registra en el tablero?   → default por categoría, override visible
8. Nombre + descripción → PREVIEW → guardar
```

- Cada respuesta acota las siguientes usando las combinaciones que los
  vocabularios ya declaran; el wizard **no puede** emitir una forma que el
  zod de C.1 rechace (el mismo schema valida en front y back).
- Elegir preset precarga todo y salta directo al paso 8 con los pasos
  anteriores editables.
- "¿Acomoda piezas?" **no aparece** en esta versión (§8.3, B diferida).

### D.3 Preview de costeo (§8.8: visible, opcional)

- Endpoint `POST /familias/preview-costeo`: recibe la forma + una cantidad
  de prueba + (si M-1/M-2) una máquina y (si tiene slots) materiales, y
  corre el motor real sobre un JobContext sintético. Devuelve el desglose.
- En el paso 8, panel visible con CTA "Probar con un ejemplo" — no bloquea
  guardar. Mitigación residual (§8.8): las cotizaciones que incluyen un
  paso de familia tenant con menos de N usos muestran un tag discreto
  "paso nuevo" en el desglose interno (nunca en documentos del cliente).
  El diseño fino de ese tag se decide al construir D.
- Selectores del editor de rutas y de pasos extra pasan a consumir el
  `GET /familias` mergeado — con grupo visual "Tus pasos" arriba del
  catálogo.

### D.4 Verificación y cierre

- `npm run css:guard` limpio (vista nueva = módulo).
- E2E: crear desde preset y desde cero; el flujo completo de C.5 pero
  entrando por el wizard; editar familia usada y verificar que la OT en
  vuelo no cambia (snapshot C.3); inhabilitar y verificar que desaparece
  de selectores pero la OT histórica la sigue mostrando.
- **Done** = una persona sin contexto del motor crea "Bordado" partiendo
  del preset trabajo_manual en menos de dos minutos, y su cotización sale
  con el costo esperado.

---

## Etapa E.0 — Familias tenant en rutas y cotizador

> **Ojo con el nombre**: la "Etapa E" del diseño (§10) es el **wizard de
> ruta** (encadenar con validación por inputs/outputs). Eso NO se hizo.
> Lo de abajo es la capa previa de utilización — que las familias tenant
> entren al creador de rutas EXISTENTE y coticen — por eso E.0.

> **Estado 2026-07-29: COMPLETA y verificada E2E** (rama
> `feat/pasos-wizard-ruta`). No hizo falta tocar el backend de rutas: la
> validación ya pasaba por `validarFamiliasDePasos` → resolver, así que un
> `RutaPaso` con `familiaCodigo` UUID persiste y cotiza sin cambios. Lo que
> sí faltaba era la capa visible:
>
> - **Editor de rutas**: el selector de familias ahora arma el grupo
>   "Tus pasos" primero (mismo patrón que pasos extra), después el catálogo
>   del sistema por categoría.
> - **Nombres, no UUIDs**: el mismo bug apareció tres veces (patrón
>   `nombreVisible || humanize(familiaCodigo)`); para una familia tenant el
>   código es un UUID y "humanizarlo" muestra el UUID. Dos se arreglaron en
>   el front (checkbox de co-ejecución del editor de pasos, vía
>   `familiasMap`), y el tercero (chips de Opcionales del cotizador) se
>   resolvió **en el server**: `obtenerProducto` ahora devuelve
>   `familiaNombre` resuelto (via `resolverFamilia`) en `ruta.pasos[]` y en
>   `configPasos[].rutaPaso`, y el front lo usa como fallback antes de
>   humanizar. Cualquier consumidor futuro del detalle ya lo recibe suelto.
>
> **E2E con la sesión del usuario**: ruta "Textil estampado E2E" creada 100%
> con familias tenant (Bordado + Serigrafía manual), colgada como
> alternativa del producto de prueba, 2/2 pasos configurados (60/h y 80/h,
> Produccion & Taller), y cotizada con ambos opcionales activos: el subtotal
> cerró EXACTO contra la aritmética del motor — Bordado 100 min $41.959,45 +
> Serigrafía 75 min $31.469,59, ÷0,6 de margen, ×1,0758 de IIBB por dentro =
> $131.655. Apagar un opcional restó exactamente su parte. No se emitió OT
> (la materialización ya quedó probada en C); la preferida del producto de
> prueba volvió a "Estandar".

---

## Etapa B — Nesting parametrizado + outputs canónicos

> **Análisis 2026-07-29 (insumo, decisiones abiertas al final).** Motivo de
> activación: el wizard no tiene ninguna pregunta que termine eligiendo qué
> algoritmo de nesting usa el paso, y el eslabón que lo habilita son los
> outputs canónicos.

### B.0 Outputs canónicos — quién emite, quién consume (medido)

**Quién emite.** Todos los pasos. La familia *declara* los nombres
(`outputsCanonicos: string[]` en el contrato) y el motor *calcula* los
valores al terminar cada paso (`motor-universal/outputs-canonicos.ts`,
G-M2) y los publica flat al JobContext mutado, donde los pasos siguientes
los leen. Dos clases de emisor:

| Emisor | Outputs | De dónde salen |
|---|---|---|
| `pre_prensa` | `imposicion_calculada`, `pliegos_calculados`, `poses_por_pliego`, `cortes_calculados`, medidas del pliego, `pliego_impresion_mp_variante_id`, `talonario_pilas` | del **nesting** (grid-2d) |
| `impresion_por_hoja` | `pliegos_impresos`, `tiempo_real_impresion`, medidas | nesting + tiempo |
| `impresion_por_area` | `m2_calculados`, `aprovechamiento_pct`, `tiempo_real_impresion` | nesting rollo/mesa |
| cortes | `piezas_cortadas`, `metros_lineales_corte`, `tiempo_real_corte` | nesting + tiempo |
| `laminado` | `metros_lineales_film` | materiales |
| `modificacion_pre` | `metros_lineales_union`, `mutacion_aplicada` | primitiva propia |
| el resto (~30) | `piezas_X` | **trivial**: = cantidad efectiva del paso (fallback por prefijo; una key desconocida también devuelve cantidad efectiva) |

**Quién consume.**
1. `HEREDAR_DEL_OUTPUT_CANONICO` (la respuesta "del resultado del paso
   anterior" en la pregunta de cantidad): lee `jobContext[campo]`, donde
   `campo` sale de `mecanismoCantidadConfigJson.campoOutput` — que **hoy
   ninguna UI expone** — o de `defaultOutputParaHeredar(familiaCodigo)`,
   un mapa cableado consumidor→key (frontera Tipo A restante). Si el
   output no está, **cae en silencio a `jobContext.cantidad`**.
2. Validaciones `EXISTS_OUTPUT` del DSL.
3. Slots con `cantidadBase` (ej. `talonario_pilas` para el cartón por pila).
4. La trazabilidad del desglose por paso en el front.

### B.0.1 Consumo real — censo corregido (2ª pasada, 2026-07-29)

> La 1ª pasada subestimó el consumo (grep a un directorio inexistente y
> no miró el canal persistido). El consumo real corre por **cuatro
> canales** distintos:

1. **jobContext en runtime (herencia entre pasos)**: `pliegos_calculados`,
   `pliegos_impresos`, `piezas_cortadas` (mapa default), `talonario_pilas`
   (cantidadBase de slot), `pliego_impresion_mp_variante_id` (costeo del
   sustrato real), medidas del pliego (m² del plotter sobre hojas).
2. **Snapshot persistido** (`CotizacionItem.trazabilidadJson.pasos[].outputsCanonicos`)
   — el canal OPERATIVO post-cotización: el **simulador láser** arma la
   cola con `pliegos_impresos` + medidas del pliego leídos del snapshot
   (`produccion.service.ts:buildLaserJob`); el **nesting-viewer** de la
   propuesta muestra 6 keys (`pliegos_calculados`, `poses_por_pliego`,
   `cortes_calculados`, medidas/área del pliego).
3. **Config del producto que referencia outputs POR NOMBRE** — el modelo
   "capacidades" ya existe embrionario y cableado: `minimoComercialBase`
   puede ser `'pliegos_impresos'`; la fuente del montaje
   (`MONTAJE_SOURCE_OPTIONS`) ofrece `pliegos_impresos`; los slots cobran
   por `pliegos_impresos` o `talonario_pilas`
   (`CANTIDAD_BASE_SLOT_OPTIONS`). Tres UIs distintas ofreciendo outputs
   como opciones, cada una con su plomería ad-hoc.
4. **Canal paralelo camelCase**: el `aprovechamientoPct` que se VE en el
   preview del acomodo, el simulador y el viewer sale del RESULTADO del
   nesting (camelCase), no del output snake_case — el valor se usa, la
   key `aprovechamiento_pct` no. Dos representaciones del mismo dato.

**Muertos de verdad** (cero lectores en los 4 canales): `m2_calculados`,
`aprovechamiento_pct` (la key), `tiempo_real_impresion/corte`,
`metros_lineales_film/corte/union`, los flags (`mutacion_aplicada`,
`proof_aprobado`, `diseno_aprobado`) y ~29 de los 30 triviales.

### B.0.2 ¿La lista de unidades es acotada? (pregunta 1, medido)

Los 52 outputs colapsan en **8 magnitudes**: unidades procesadas, pliegos,
m², metros lineales, minutos, porcentaje, medida (mm), flag/objeto de
traza. Las unidades nuevas sólo pueden aparecer con PRIMITIVAS nuevas
(algoritmos, modos de tiempo, tipos de slot) — y primitivas sólo agrega
Grafo, nunca el tenant. **La lista es acotada por construcción**: la
gobierna quien agrega primitivas.

**El gap tenant (verificado en DB).** El wizard no declara outputs:
"Bordado" emite `[]`. ("Serigrafía manual" emite `piezas_estampadas` solo
porque nació por API en la Etapa C.) Consecuencias: nadie puede heredar DE
un paso tenant; y un paso tenant que elija heredar no tiene entrada en el
mapa default (UUID → null) → siempre cae a cantidad: el mecanismo aparenta
andar pero nunca hereda de verdad.

### B.1 Propuesta (primera pasada — SUPERADA en parte por B.2)

> P1 y P2 quedaron superadas por el Registro de Capacidades y la herencia
> explícita de B.2. P3, P4 y P5 siguen vigentes y B.2 las refina.

Principio: **el usuario nunca escribe nombres de outputs; se derivan de
las respuestas y se informan en humano.**

- **P1 — Emisión automática**: todo paso tenant publica su cantidad
  procesada bajo la key estable `piezas_procesadas`. Costo casi cero: el
  cálculo ya existe (fallback = cantidad efectiva); sólo hay que declarar
  la key al guardar la familia (y backfillear las 2 existentes).
- **P2 — Herencia genérica**: cuando el consumidor es una familia tenant
  sin `campoOutput` explícito, el default pasa a ser "la cantidad que
  produjo el paso anterior ejecutado" (el motor ya la tiene en
  `pasosEjecutados`), en lugar del mapa por familia que no lo conoce.
- **P3 — La pregunta de nesting es física, no de algoritmo**: "¿Este paso
  acomoda piezas? → ¿Sobre qué?" — *pliego suelto* (grid-2d-single /
  packingsolver-rectangle), *varios pliegos* (grid-2d-multi), *rollo*
  (shelf-rollo / maxrects-rollo). Elegir le da al paso
  `CALCULADO_POR_PASO` (la prohibición del validador se relaja SOLO si hay
  algoritmo elegido — el tenant elige NUESTRO algoritmo parametrizado,
  nunca escribe uno) y emite los outputs ricos **con los mismos nombres
  canónicos del sistema** (`pliegos_calculados`, `m2_calculados`,
  `aprovechamiento_pct`, …) para que herencias y validaciones existentes
  funcionen sin tocar nada.
- **P4 — Dispatcher por configuración**: `nesting-dispatcher.ts` rutea hoy
  por `familiaCodigo` cableado (el archivo entero es FRONTERA-NESTING). B
  lo parametriza: la familia declara `nestingConfig { geometria, algorithm,
  … }` y el dispatcher lee esa config vía resolver; los códigos del
  sistema quedan como presets del mismo mecanismo.
- **P5 — El `campoOutput` fino se elige en el producto, no en la familia**
  (al crear la familia no se sabe qué paso vendrá antes): en Configurar
  pasos, si el paso hereda, dropdown en humano con lo que publican los
  pasos previos de esa ruta.
- **UI**: en el paso final del wizard, bloque "Qué deja este paso para los
  siguientes" con chips en humano ("Cantidad de piezas procesadas",
  "Pliegos calculados y su medida", "m² consumidos del rollo").

**Decisiones abiertas**: (a) ¿P2 entra en B o es un mini-fix previo junto
con P1? (b) ¿la elección rollo/pliego expone la variante de algoritmo
(shelf vs maxrects) o el sistema decide como hoy (mejor candidato)?
(c) alcance de P5 — ¿entra en B o queda para el wizard de ruta (Etapa E
real)?

**Posiciones del usuario (2026-07-29, sesión de análisis):**

- **Herencia → EXPLÍCITA.** "Cada paso debería indicar de QUÉ paso hereda
  (…) nadie mejor modela el producto que el que lo modela." Le generaba
  dudas desde antes del proyecto que los pasos hereden "de antes" sin
  saber de qué. Hipótesis de diseño: al configurar el paso en el producto,
  si hereda, se elige el paso ORIGEN (dropdown de pasos previos con lo
  que emite cada uno); el sistema puede SUGERIR el anterior, pero lo
  guardado es explícito (rutaPasoId origen + capacidad en
  `mecanismoCantidadConfigJson`). Esto reemplaza el mapa
  `defaultOutputParaHeredar` y el "último que la emitió".
- **Granularidad**: pidió medir si las unidades son lista acotada antes
  de decidir → B.0.2 responde: 8 magnitudes, acotada por construcción.
- **Outputs muertos**: pidió verificar el uso real antes de asumir →
  B.0.1 corrige el censo (4 canales); la decisión de podar/estandarizar
  se toma sobre la lista de muertos REALES.

### B.2 El Registro de Capacidades (diseño CERRADO con el usuario, 2026-07-29)

Modelo de fondo (surgió del análisis de "¿por qué pliegos es una
magnitud?"): **la magnitud de conteo es UNA sola — lo que cambia es el
objeto contado** — y un mismo trabajo lleva varios conteos simultáneos
vinculados por ratios (500 tarjetas = 10 pliegos, poses de por medio).
Los 52 nombres actuales colapsan en **8 capacidades**; el resto queda
como alias/etiqueta.

**Conteos** (magnitud cantidad + objeto):

1. `unidades_procesadas` — la unidad final que compra el cliente. La
   emite TODO paso automáticamente (= cantidad efectiva, ya se calcula).
   Cada paso la re-etiqueta en display ("500 piezas cortadas", "20
   libros"). Absorbe los 30 triviales + los tenant.
2. `pliegos` — el soporte de impresión. Es un OBJETO, no un número
   suelto: { cantidad, anchoMm, altoMm, mpVarianteId } (con alias planos
   para la plomería legacy: simulador, mínimo comercial, montaje,
   slots). **UN emisor por ruta: el paso que corre el acomodo** (decisión
   del usuario — se elimina la dualidad pre_prensa/impresión emitiendo lo
   mismo; pre-prensa puede existir como paso pero no emite pliegos si no
   es él quien acomoda). Absorbe `pliegos_calculados`, `pliegos_impresos`
   y las 4 keys de identidad del pliego.
3. `grupos` — agrupaciones intermedias, UNA capacidad genérica etiquetada
   por el paso ("12 pilas", "5 cajas", "8 atados") (decisión usuario).
   Absorbe `talonario_pilas`.

**Continuas**:

4. `m2_consumidos` — área real consumida con desperdicio (nesting
   rollo/mesa, montaje). Absorbe `m2_calculados`.
5. `metros_lineales` — UNA capacidad etiquetada por el paso ("3,1 m de
   rollo", "8 m de costura", "3,1 m de film") (decisión usuario; la
   herencia explícita desambigua porque se señala el paso). Absorbe
   `metros_lineales_corte/film/union` y `ojales` sigue siendo conteo de
   unidades del paso.
6. `minutos_reales` — tiempo total del paso, lo emite todo paso con
   tiempo. Absorbe `tiempo_real_impresion/corte`. Lector futuro:
   métricas/ETA (backlog, fuera de B).

**Información/traza** (no se heredan como cantidad):

7. `imposicion` — objeto de traza del acomodo: poses por pliego (el
   ratio), posiciones, cortes de guillotina derivados. Absorbe
   `imposicion_calculada`, `poses_por_pliego`, `cortes_calculados`.
8. `aprovechamiento_pct` — unifica los DOS caños de hoy (key snake_case
   muerta + camelCase del resultado que sí se muestra) en uno.

**Podas** (decisión usuario): `aprobacion` NO existe — `proof_aprobado` y
`diseno_aprobado` se eliminan ("no se usa y no se va a usar"); proof y
diseño emiten lo de cualquier paso. `mutacion_aplicada` queda como traza
interna de la primitiva, fuera del registro.

**Nombre**: la capacidad del soporte se llama **"pliegos"** en toda la UI
(decisión usuario: jerga del oficio).

**Emisión derivada por forma** (el wizard nunca pregunta outputs):

```
Todo paso                        → unidades_procesadas + minutos_reales
+ acomoda piezas sobre PLIEGO    → pliegos + imposicion + aprovechamiento_pct
+ acomoda piezas sobre ROLLO     → m2_consumidos + metros_lineales + aprovechamiento_pct
+ agrupa (N por caja/pila/atado) → grupos
+ consume material lineal (film) → metros_lineales
```

**Herencia** (decisión usuario, B.0.1): EXPLÍCITA — al configurar el paso
en el producto se elige el paso ORIGEN y su capacidad, en humano
("Corte dejó: 500 piezas (venían en 10 pliegos)"); el sistema sugiere el
anterior pero guarda explícito. `defaultOutputParaHeredar` desaparece.

En el paso final del wizard: bloque "Este paso deja: 500 unidades ·
10 pliegos SRA3 · 45 minutos".

### B.3 Plan de implementación (2026-07-30)

Cinco sub-fases, cada una con valor propio y verificable sola. Rama
`feat/pasos-capacidades` desde dev; una rama hija por sub-fase si crece.

#### B.3.1 — El registro, como datos puros (sin cambio de comportamiento)

> **Estado 2026-07-30: HECHA** (rama `feat/pasos-capacidades`).
> `pasos/capacidades.ts` con las 8 capacidades, `ALIAS_LEGACY` completo
> (el test de cobertura verifica que TODA key declarada por las 42
> familias tenga lugar: alias, interna o podada), `KEYS_PODADAS`
> (proof/diseño aprobado), `capacidadesDeForma` y `capacidadesDeclaradas`.
> 8 tests unit sin DB, verdes; tsc limpio. `piezas_estampadas` (dato
> tenant de la Etapa C) se resuelve por el fallback hasta el backfill de
> B.3.2.

- Archivo nuevo `apps/api/src/productos-servicios/pasos/capacidades.ts`
  (patrón `familias.ts`: datos + helpers, cero lógica de negocio):
  - Las 8 entradas: `{ key, nombre, tipo: conteo|continua|traza,
    descripcion }`.
  - `ALIAS_LEGACY`: mapa de TODAS las keys viejas → `{ capacidad,
    etiqueta }` (`piezas_cortadas` → `unidades_procesadas` / "piezas
    cortadas"; las 4 keys de identidad del pliego → `pliegos`; etc.).
  - `capacidadesDeForma(familia)`: deriva la emisión — siempre
    `unidades_procesadas` + `minutos_reales`; con nestingConfig pliego →
    `pliegos` + `imposicion` + `aprovechamiento_pct`; rollo →
    `m2_consumidos` + `metros_lineales` + `aprovechamiento_pct`;
    CONVERSION con capacidad → `grupos`; slot film → `metros_lineales`.
- Tests unit: toda key del catálogo tiene alias; ningún alias huérfano;
  la derivación por forma cubre las 42 del sistema sin sorpresas.
- **Verificación**: tsc; suite idéntica (no toca motor ni UI).

#### B.3.2 — Emisión estandarizada + el wizard informa

> **Estado 2026-07-30: HECHA y verificada E2E** (rama
> `feat/pasos-capacidades`). El motor publica `capacidades` en cada paso
> ejecutado (aditivo, keys planas intactas); los outputs tenant se DERIVAN
> en el service (crear y PATCH re-derivan — un PATCH cualquiera normaliza
> filas legacy, verificado en vivo contra Bordado y Serigrafía); el
> validador cierra el vocabulario; el wizard muestra "Qué deja este paso a
> los siguientes". E2E con la sesión real: cotización de la ruta 100%
> tenant devuelve `capacidades` exactas (100 unidades · 100/75 min) con
> los MISMOS costos de la línea de base. **Bug cazado en el E2E**: las
> keys del propio registro caían al fallback de `resolverAliasLegacy`
> (minutos_reales → "unidades" + duplicado con la universal); fix: una key
> del registro se representa a sí misma. Motor suite = línea de base
> exacta (18 rotos preexistentes, 261 verdes). Nota: los pasos con
> snapshot viejo (`piezas_estampadas`) siguen resolviendo por fallback —
> por diseño.

- Motor (F.2.9): al publicar outputs, agrega a la trazabilidad del paso
  `capacidades: [{ capacidad, etiqueta, valor }]` VÍA alias — aditivo;
  las keys planas del jobContext no se tocan (compat con los 4 canales).
- Familias tenant: `outputsCanonicos` deja de ser texto libre — el
  service lo DERIVA de la forma al guardar (validador rechaza keys fuera
  del registro). Backfill de "Bordado" y "Serigrafía manual" en dev.
- Wizard, paso final: bloque "Este paso deja: …" desde
  `capacidadesDeForma`.
- **Verificación**: tsc + jest + css:guard; E2E corto: crear/editar paso
  → ver el bloque; cotizar el producto tenant → capacidades en la
  trazabilidad.

#### B.3.3 — Herencia explícita

> **Estado 2026-07-30: HECHA y verificada E2E** (rama
> `feat/pasos-capacidades`). `resolverHerenciaExplicita` (función pura en
> capacidades.ts, testeada con el caso diferencial: origen con CONVERSION
> deja 10 grupos y el trabajo pide 100 — señalarlo devuelve 10, el
> fallback jamás podría) + el motor publica las capacidades por rutaPasoId
> bajo la clave reservada `__capacidadesPorPaso`. UI: cuando el mecanismo
> es "Hereda del paso anterior", aparece "¿De qué paso hereda la
> cantidad?" con los pasos previos (mostrando "Deja: …" desde el
> `capacidades` que ahora devuelve GET /familias) + el selector de
> capacidad heredable; default "Automático (regla histórica)". El origen
> viaja DENTRO del JSON de config de cantidad (el textarea sigue siendo la
> fuente al guardar). E2E real: Serigrafía manual configurada para heredar
> de Bordado (persistido `origen{rutaPasoId,capacidad}` en DB), cotización
> exacta. Motor suite = línea de base. Trampa de entorno para recordar: un
> edit por script de Python NO despierta al nest watch — quedó un dist
> viejo sirviendo hasta re-guardar el archivo con una escritura normal.

- Contrato: `mecanismoCantidadConfigJson` gana
  `origen: { rutaPasoId, capacidad }`. En `resolverCantidad` (HEREDAR):
  con origen explícito → buscar en `pasosEjecutados` el paso señalado y
  leer esa capacidad (unidades → cantidadEfectiva; pliegos → cantidad;
  m²/metros → valor). Sin origen → **fallback al mapa legacy intacto**
  (las configs existentes no se migran y siguen andando).
- UI Configurar pasos: cuando mecanismo = HEREDAR, el textarea de JSON
  libre se reemplaza por un selector humano: dropdown de pasos PREVIOS
  de la ruta mostrando qué deja cada uno ("Impresión — pliegos ·
  unidades"), sugerencia = el paso anterior. El JSON queda como avanzado.
- Tests motor: origen explícito tenant→tenant, sistema→tenant,
  tenant→sistema; fallback legacy byte a byte (suite por nombre).
- **Verificación**: E2E usuario — un paso tenant hereda explícitamente
  del corte y la cotización da el número esperado.

#### B.3.4 — Nesting para pasos tenant (la feature)

> **Estado 2026-07-30: HECHA** (rama `feat/pasos-capacidades`); el E2E
> completo con cotización real queda para B.3.5. Lo construido:
> `nestingConfigJson` en FamiliaTenant (migración ADD COLUMN,
> 20260730041500, aplicada a dev y test), la superficie proyectada al
> resolver, el validador que relaja CALCULADO_POR_PASO SOLO con superficie
> declarada (y lo exige cuando la hay), y la **entrada tenant del
> dispatcher** ANTES del switch por familiaCodigo: rollo → shelf/maxrects,
> pliego(s) → grid-2d-multi (piezas uniformes caen solas a single, con
> poses e imposición completa). La medida del pliego/rollo sale del
> material del slot o de la máquina vía `resolveNestingConfig`, que ya era
> genérico. `outputs-canonicos` aprende las keys del registro con
> semántica idéntica a las legacy (`pliegos` = `pliegos_calculados`, etc.).
> Wizard: la 4ª opción de cantidad ("El paso la calcula acomodando
> piezas") despliega "¿Sobre qué acomoda?" con las 3 superficies en
> lenguaje físico (verificado en browser), y el bloque "Qué deja este
> paso" suma los chips del set elegido. Desvío del plan anotado: la
> pregunta vive DENTRO del paso de cantidad (es una respuesta a "¿de dónde
> sale la cantidad?"), no como paso nuevo tras máquina — evita renumerar
> el wizard y es más coherente. Tests: 3 nuevos de dispatcher tenant (sin
> DB, familias sintéticas registradas al resolver; pliego uniforme da
> exactamente 2 pliegos con ≥50 poses) + validador + derivación; suite
> motor = línea de base.

- `FamiliaTenant.nestingConfigJson` (migración ADD COLUMN only):
  `{ superficie: 'pliego' | 'pliegos_multiples' | 'rollo' }` (la
  variante de algoritmo la decide el sistema como hoy — mejor candidato;
  revisable).
- Wizard: pregunta nueva después de máquina: "¿Este paso acomoda piezas
  en una superficie? → ¿Sobre qué?" con ejemplos físicos. Elegir setea
  `CALCULADO_POR_PASO` + nestingConfig; el validador relaja la
  prohibición SOLO si nestingConfig está presente y válido (la frontera
  se mantiene: se ELIGE nuestro algoritmo, nunca se escribe uno).
- Dispatcher: entrada parametrizada ANTES del switch por familiaCodigo —
  si `resolverFamilia(...)?.nestingConfig` existe, arma la config del
  algoritmo reutilizando los builders existentes. **Los branches del
  sistema no se tocan** (quedan como presets de facto; unificarlos es
  otra etapa).
- Emisión: `capacidadesDeForma` ya incluye pliegos/m² → el paso tenant
  publica las MISMAS keys canónicas del sistema (compat total con
  herencia, simulador y visor).
- Tests: dispatcher con familia tenant (pliego y rollo); suite motor
  intacta por nombre.

#### B.3.5 — E2E de cierre

**Done** = un ADMIN crea con el wizard "Estampado en pliego" (acomoda
sobre pliego), lo mete en una ruta con un paso posterior que hereda
EXPLÍCITAMENTE sus unidades, y la cotización corre el nesting de verdad:
pliegos calculados = cuenta manual, desglose con pliegos y
aprovechamiento, visor de nesting funcionando, y el simulador/tablero
sin romperse. Cliente de prueba SIN teléfono (Wati vivo en dev).

#### Qué NO entra en B (guardrails)

- Migración física de los nombres triviales (quedan como alias, quizás
  para siempre).
- Retirar `defaultOutputParaHeredar` ni el look-ahead de pre_prensa para
  las familias del sistema: "un emisor por ruta" rige el modelo NUEVO;
  lo legacy sigue igual hasta una etapa de unificación.
- Unificar los branches del dispatcher del sistema al mecanismo nuevo.
- Lectores nuevos para `minutos_reales` / `aprovechamiento_pct`
  (métricas/ETA) — backlog.
- Preview de nesting dentro del wizard (el preview de costeo sigue
  T-1/T-2).
- El wizard de ruta (Etapa E real).

#### Riesgos

| Riesgo | Mitigación |
|---|---|
| Regresión del dispatcher (FRONTERA-NESTING) | los branches del sistema no se tocan; entrada tenant aditiva; suite motor comparada por nombre |
| Cotizaciones viejas en snapshot con keys viejas | los lectores resuelven vía alias; nada se migra |
| Configs con JSON libre malformado | parse defensivo + fallback legacy |
| Los 18 smoke tests rotos preexistentes ensucian la señal | comparar por nombre contra baseline, como en A/C/D |
| Base dev con Wati viva | cliente de prueba sin teléfono, siempre |

---

## Secuencia de ramas

**Decisión 2026-07-29: el proyecto se integra en la rama `dev` (creada desde
main), NO en main.** Cada etapa mergea a dev al cumplir su criterio; main
queda limpio hasta que el proyecto completo funcione validado de punta a
punta — recién ahí dev → main de una. Si el proyecto se abandona a mitad de
camino, main nunca se ensució y el restore point v3.8 cubre la base.

| Rama | Contenido | Merge a `dev` cuando |
|---|---|---|
| `feat/pasos-limpieza-tipo-a` | A completa + censo apendizado | ✅ mergeada (4ab3c7f1): suite idéntica + E2E usuario |
| `feat/pasos-familias-tenant` | C completa (modelo+resolver+API) | E2E "Serigrafía manual" completo |
| `feat/pasos-wizard` | D completa | E2E wizard + css:guard |

Las ramas de etapa nacen de `dev` (no de main) para ver el trabajo previo.
Ojo con las migraciones de la Etapa C: quedan aplicadas en la base dev
aunque main no las conozca — si hay que volver a trabajar sobre main antes
del merge final, la base y el schema van a divergir; el dump v3.8 es la
vuelta atrás limpia.

Después de D en dev y con uso real: retomar B (nesting) y E/F (wizard de
ruta/producto) con diseño propio sobre lo aprendido.

## Apéndice — Censo de los cableados (Etapa A, ejecutada 2026-07-29)

Base: 51 líneas con `familiaCodigo === '<literal>'` fuera de tests, medidas
sobre `5abc97f5` = **50 comparaciones de familia** + 1 `typeof === 'string'`.
Tras la etapa: **43 comparaciones**, todas Tipo B bajo marcador
`FRONTERA-NESTING` / `FRONTERA-PRIMITIVA`. Puerta para PRs futuros:

```bash
grep -rnE "familiaCodigo\s*===\s*'[a-z_]+'" apps/api/src --include='*.ts' | grep -v __tests__
# toda línea nueva de esa lista necesita justificación de frontera
```

### Movidas a la declaración (Tipo A — 7 comparaciones eliminadas)

| Estaba en | Era | Ahora lo declara |
|---|---|---|
| motor.service `esTipoPerfilCompatibleConFamilia` (2 ifs) | plotter→CORTE\|MIXTO, área→IMPRESION\|MIXTO | `tiposPerfilCompatibles` en la familia |
| config-pasos `tipoPerfilCompatibleConFamilia` (2 ifs) | **la misma lógica, duplicada** | mismo campo — helper único `perfilCompatibleConFamilia` en familias.ts |
| config-pasos `normalizarFormulaSlotMaterial` (1 if) | laminado+film fuerza `por_metro_lineal` | `formulaForzada` en el slot film |
| motor.service `ignoraCarasEnMaterial` (1 if) | hoja+sustrato no multiplica ×caras | `ignoraMultiplicadorCaras` en el slot sustrato |
| motor.service consumibles de máquina (1 if) | plotter_corte no factura tinta | `sinConsumiblesMaquina` en la familia |

Campos nuevos: `DefinicionFamilia.tiposPerfilCompatibles?`,
`DefinicionFamilia.sinConsumiblesMaquina?`, `SlotDeclarado.formulaForzada?`,
`SlotDeclarado.ignoraMultiplicadorCaras?` — con helpers de lectura en
familias.ts (`perfilCompatibleConFamilia`, `formulaEfectivaSlot`,
`slotIgnoraMultiplicadorCaras`, `familiaSinConsumiblesMaquina`). Una familia
que no declara el campo conserva el fallthrough del if original.

### Quedan como frontera (Tipo B — 43 comparaciones)

| Cluster | Refs | Marcador |
|---|---|---|
| `nesting-config.ts` — config por familia (márgenes, separación, panelizado, algoritmo) | 16 | archivo entero `FRONTERA-NESTING` |
| `nesting-dispatcher.ts` — ruteo a runners + casos hoja | 9 | archivo entero `FRONTERA-NESTING` |
| motor: guards d.0–d.1 (laminado, pouch, hoja, área, montaje, pre_prensa cortan sin layout) | 6 | `FRONTERA-NESTING` en el bloque |
| motor: `debeCalcularNestingLaminado` | 1 | `FRONTERA-NESTING` |
| motor: cantidades propias en CALCULADO_POR_PASO (modificacion_pre, ojales, área/plotter m²) | 4 | `FRONTERA-PRIMITIVA` |
| motor: layout de ojales (traza + params) | 1 | `FRONTERA-PRIMITIVA` |
| motor: guillotina — runMin por cortes + perfil por gramaje | 2 | `FRONTERA-PRIMITIVA` |
| motor: hoja — cadena color→caras→gramaje de selección de perfil | 1 | `FRONTERA-PRIMITIVA` |
| motor: montaje — tiempo desde el plan de montaje | 1 | `FRONTERA-PRIMITIVA` |
| config-pasos: plotter sobre impresora híbrida exige corte integrado (ruta + candidatas M-2) | 2 | `FRONTERA-PRIMITIVA` |

(La suma de comparaciones por línea difiere de la de clusters porque varias
líneas comparten un if.)

### Verificación de la etapa

- `tsc --noEmit -p tsconfig.build.json` limpio.
- Suite completa del API: **resultado idéntico a main, test por nombre**
  (extraído con `jest --json` y comparado con la base vía `git stash`):
  1.149 pasan en ambos, y los mismos 18 smoke tests de motor.spec fallan en
  ambos — **preexistentes**, dependen de fixtures de `gdi_saas_test`
  (probable secuela del incidente de base del 2026-07-28). Quedan fuera del
  alcance de la etapa, con task aparte para diagnosticarlos.
- Ojo al medir: en paralelo el conteo fluctúa (18–20) porque las suites
  comparten `gdi_saas_test`; con `--runInBand` da 18 estable. Comparar
  resultados de jest siempre en serie o por nombre de test, nunca por el
  número del resumen.
- **E2E manual (usuario, 2026-07-29)**: Tarjetas de visita doble faz con
  laminado re-cotizadas contra una cotización previa al cambio — desglose
  **idéntico**. Cubre `ignoraMultiplicadorCaras` (papel no ×2 con doble faz)
  y `formulaForzada` (film en metros lineales). **Sticker troquelado también
  verificado por el usuario**: factura tinta por su paso de impresión
  (CMYK/ByN — correcto) y el paso de plotter no agrega consumibles propios;
  cubre la selección de perfil (`tiposPerfilCompatibles`). Matiz honesto
  sobre `sinConsumiblesMaquina`: su rama sólo se ejercita cuando el paso de
  plotter corre sobre la impresora híbrida (corte integrado) — sobre un
  plotter dedicado el código corta antes por plantilla, igual que siempre.
  Ese sub-caso queda por equivalencia de código; sus smoke tests están entre
  los 18 caídos por fixtures.

## Qué puede salir mal (por etapa)

- **A**: un `if` clasificado A que en realidad tenía un efecto secundario
  no declarado. Red: los tests del motor + E2E al centavo.
- **C**: un caller que no pasa por el resolver y explota con UUID. Red: el
  censo de A mapea todos los accesos; grep de `FAMILIAS[` como gate de PR.
- **D**: familias mal compuestas que cotizan "razonable pero mal" — el
  riesgo #1 del diseño (§7.1), agravado por preview opcional (§8.8). Red:
  el zod no deja emitir formas inválidas; el tag "paso nuevo" mantiene el
  ojo humano encima; y el precedente Wati aplica: **dev tiene integraciones
  vivas, probar con tenant de prueba**, no con Grafoprint real.
