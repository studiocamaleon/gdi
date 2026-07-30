# Wizard de Ruta — análisis y diseño (Etapa E de pasos componibles)

> Documento de trabajo. Nace del cierre de la Etapa B (Registro de
> Capacidades) y de la decisión del usuario 2026-07-30: el editor de
> configuración de ruta es confuso porque le pregunta al producto cosas
> que son del paso, y la sección "Avanzado" mezcla decisiones del oficio
> con técnica de algoritmo. Plan macro acordado: E.0 censo de Avanzado →
> E.1 defaults declarados en el paso → E.2 tercerizado como bifurcación
> del wizard de paso → E.3 wizard de ruta.
>
> Regla de ramas vigente: TODO se integra a `dev`; `main` (estable,
> 5abc97f5) recién se toca cuando el conjunto completo esté validado.

## 1. Censo de la sección "Avanzado" (E.0, medido 2026-07-30)

Fuente: `config-pasos-editor-view.tsx` (bloque `advancedOpen`), lectores
en `motor.service.ts` (overrides de tiempo) y `nesting-config.ts` (todo
lo demás, con precedencia: runtime de la cotización → nestingConfig del
paso → params legacy → máquina → default por familia).

Dos hallazgos de contexto antes de la tabla:

- **Ya no hay textareas de JSON visibles.** "Params del paso" y "Config
  de cantidad" viven como ESTADO (jsonTexts, la fuente al guardar) pero
  se editan solo vía controles ricos. El copy "Overrides y notas
  internas" miente dos veces: no hay campo de notas, y no todo es
  override.
- **Los pasos tenant que acomodan (B.3.4) ya ven la card de nesting**:
  `nestingAplica()` devuelve true para cualquier `CALCULADO_POR_PASO`,
  así que un "Estampado en pliego" muestra "Algoritmo" — que para tenant
  NO debería ofrecerse (la superficie ya lo decide; el sistema elige).
  Fix pendiente para E.

### La tabla

Audiencias: **[O] oficio** (decisión física frecuente, va al wizard en
humano) · **[P] operativa por producto** (accesible, secundaria) ·
**[X] técnica** (escape hatch de experto).

| # | Campo | Aparece cuando | Quién lo lee | Aud. | Estandarización propuesta |
|---|---|---|---|---|---|
| 1 | Setup override (min) | paso con máquina | motor: pisa `perfil.setupMin` | P | "¿Preparar la máquina lleva un tiempo distinto en este producto?" — y el DEFAULT debería poder declararlo la familia/perfil (E.1) |
| 2 | Cleanup override (min) | paso con máquina | motor: pisa `perfil.cleanupMin` | P | ídem 1 |
| 3 | Tiempo fijo override (min) | T-1 sin máquina | motor: pisa tiempo fijo | P | ídem — candidato fuerte a default de familia (E.1): "¿cuánto tarda normalmente?" ya se pregunta en el wizard de paso y hoy se tira |
| 4 | Algoritmo de nesting | familias sistema con nesting + cualquier CALCULADO_POR_PASO | dispatcher | X | **desaparece como pregunta**: la elección física (superficie B.3.4 / geometría máquina-material) ya lo determina; "auto" es el único valor sano. Queda solo como escape |
| 5 | Demasía por lado (mm) | ídem 4 | nesting (bleed→márgenes y separación) | **O** | "¿Cuánto aire necesita cada pieza?" — pregunta física. Candidato a DEFAULT de familia (E.1: un troquelado siempre pide su demasía típica) + override por producto + ajuste runtime en cotización (ya existe el canal) |
| 6 | Pliego de impresión: tamaño (preset/custom/auto) | solo `impresion_por_hoja` | nesting (sheet dims) | **O** | "¿En qué pliego se imprime? El del sustrato comprado / uno fijo (A3, SRA3…) / que el sistema COMPARE tamaños y elija" — tres opciones en humano; hoy es un combo + 2 inputs + modo |
| 7 | Ancho/Alto del pliego (mm) | ídem 6, modo custom | nesting | O | inputs del caso "uno fijo"; sin cambios conceptuales |
| 8 | Origen del costo (derivado / MP por candidato) | ídem 6, modo automático | score de candidatos | X→O | reformular en humano: "¿Los tamaños candidatos se compran ya cortados (cada uno con su precio) o salen todos del mismo sustrato?" — es una pregunta de compras, no de algoritmo |
| 9 | Candidatos de pliego (lista + MP propia) | ídem 8 | nesting compara | **O** | la lista es legítima del oficio; la UI actual (preset+4 campos+picker MP por fila) necesita el tratamiento wizard |
| 10 | Panelizado: modo (auto/manual) | solo `impresion_por_area` + rollo | nesting (paneles) | **O** | **"¿Esta pieza puede salir en paneles?"** — No / Sí, decide el sistema / Sí, así — decisión del oficio de gran formato (el usuario lo marcó explícitamente: no todos los productos se pueden panelar) |
| 11 | Panelizado: dirección (auto/V/H) | ídem 10 | nesting | O | "¿Los paneles van a lo largo o a lo ancho?" |
| 12 | Panelizado: solape (mm) | ídem 10 | nesting | **O** | "¿Cuánto se solapan para soldar?" — candidato a DEFAULT de familia (E.1: la soldadora de lona tiene SU solape) |
| 13 | Panelizado: ancho máx. por panel (mm) | ídem 10 | nesting | O | "¿Ancho máximo de cada panel?" (default = ancho útil del rollo/máquina) — **UNA pregunta junto con 15** |
| 14 | Panelizado: distribución (equilibrada/libre) | ídem 10 | nesting | P | "¿Paneles parejos o como convenga?" |
| 15 | Panelizado: interpretación del ancho (total/útil) | ídem 10 | nesting (califica a `maxPanelWidthMm` en el MISMO input del algoritmo) | **O** | NO se separa del 13 (corrección del usuario 2026-07-30): es la semántica del número recién tipeado — "¿ese ancho incluye el solape?" Sí = total / No = útil. Una sola pregunta compuesta, o mejor: el wizard fija una interpretación y PREVISUALIZA el resultado ("paneles de 1500 mm, 1470 útiles tras el solape") |
| 16 | Layout manual de paneles (JSON) | ídem 10, modo manual | nesting | X | escape hatch (el editor visual del acomodo es el camino largo correcto) |
| 17 | Márgenes extra del pliego (sup/izq/der/inf) | familias con nesting | nesting (SUMAN al margen técnico de la máquina) | **O** | "¿Aire extra en los bordes, además del de la máquina?" — la máquina ya aporta el técnico; esto es del trabajo |
| 18 | Costeo del sustrato: estrategia (simple / m² exacto / largo consumido / placa por tramos) | familias con nesting | costing del nesting | **O**(!) | parece técnica pero es POLÍTICA DE PRECIO: "¿La placa/rollo se cobra entera, por lo consumido, o por tramos de ocupación?" — decisión comercial del negocio, merece humano |
| 19 | Escalones de ocupación (%) | ídem 18, estrategia por tramos | costing | O | "¿En qué cortes de ocupación cambia el precio?" (25/50/75/100) |

### Lecturas transversales del censo

1. **Tres niveles de decisión, no dos.** Varios campos ya son ajustables
   en TRES lugares: default (máquina/familia) → config del producto →
   runtime de la cotización (`configPasoRuntime`: márgenes, panelizado,
   pliego, demasía y params abiertos al comercial). La estandarización
   debe declarar POR CAMPO qué niveles aplican — es el mismo patrón
   activación-default+fijar de la Etapa D, generalizado.
2. **Casi nada de Avanzado es del paso "en general": es de las familias
   de NESTING.** Overrides de tiempo aparte, los 16 campos restantes
   solo existen para impresión por hoja/área, plotter, laminado, montaje
   y (desde B.3.4) pasos tenant que acomodan. El wizard de ruta NO
   necesita cargar con esto para el 80 % de los pasos.
3. **Candidatos a default de familia detectados (alimentan E.1)**:
   demasía típica (5), solape de panelizado (12), tiempo fijo (3), y los
   que ya habíamos anotado: centro de costo y ritmo. Todos con el mismo
   contrato: la familia sugiere, el producto puede pisar, la cotización
   ajusta si el modelador lo dejó abierto.
4. **Un solo campo desaparece como pregunta**: Algoritmo (4) — la física
   ya lo decide. (Interpretación del ancho NO va al escape hatch: se
   funde con la pregunta del ancho máximo de panel — corrección del
   usuario. El único escape hatch genuino que queda además del algoritmo
   es el layout manual de paneles en JSON, cuyo camino largo correcto es
   un editor visual.)
5. **Una reclasificación sorpresa**: el costeo del sustrato (18-19)
   estaba vestido de técnica pero es política de precio (cobrar la placa
   entera vs. por tramos es una decisión comercial que Holdprint expone
   como feature). En humano, es de las preguntas más valiosas del censo.

## 2. E.1 — Defaults declarados en el paso (diseño CERRADO)

> Censo E.0 CERRADO 2026-07-30 (con la corrección del usuario:
> interpretación del ancho se funde con el ancho de panel).
>
> **Decisiones del usuario 2026-07-30 (las tres, con lo recomendado):**
> (a) overlay `FamiliaPasoDefaults` para TODAS las familias;
> (b) fallback VIVO del motor (cambiar el default corrige los productos
> que confían en él); (c) las familias del sistema ganan "Configurar
> defaults" ya en E.1.

### 2.1 La idea

Hoy el que configura la ruta de un producto re-contesta, producto por
producto, cosas que son del PASO: quién lo cobra, a qué ritmo se hace,
cuánta demasía pide, cuánto solapa el panel. E.1 invierte la carga: **la
familia declara sus defaults al crearse (el wizard ya hace las preguntas
— hoy tira las respuestas), el producto puede pisarlos, y la cotización
ajusta lo que quedó abierto.** Es el patrón activación-default de la
Etapa D, generalizado.

Evidencia de que el patrón ya existe a medias: `nesting-config.ts` tiene
`defaultSeparationForFamily()` y `defaultMarginForFamily()` — defaults
POR FAMILIA cableados en código (Tipo A puro). E.1 los vuelve datos.

### 2.2 Los cinco defaults de la v1

| Default | Aplica a | Hoy se pide en | Lector (fallback nuevo) |
|---|---|---|---|
| Centro de costo | pasos sin máquina (con máquina lo trae la máquina) | cada config de producto | motor: `paso.centroCostoId ?? default de familia` |
| Ritmo (unid/hora) | T-2 | cada config (productivityValue) | motor: `params.productivityValue ?? default` |
| Tiempo fijo (min) | T-1 | cada config | motor: `tiempoFijoOverrideMin ?? default` |
| Demasía por lado (mm) | familias que nestean + tenant que acomodan | Avanzado por producto | nesting-config: se inserta el tier "default de familia" en la cadena (runtime → producto → **familia** → máquina → cableado) |
| Solape de panel (mm) | gran formato sobre rollo | Avanzado por producto | ídem, en panelizado |

### 2.3 Dónde viven (decisión a: overlay para TODAS las familias)

Tabla nueva `FamiliaPasoDefaults` — el MISMO patrón que `EstacionFamilia`
(tenantId + familiaCodigo string, que puede ser código del sistema o
UUID tenant):

```
FamiliaPasoDefaults
  tenantId            uuid
  familiaCodigo       string   // 'corte_manual' o UUID de FamiliaTenant
  centroCostoId       uuid?
  productividadHora   decimal?
  tiempoFijoMin       decimal?
  demasiaMm           decimal?
  solapePanelMm       decimal?
  @@unique([tenantId, familiaCodigo])
```

Por qué overlay y no columnas en FamiliaTenant: la mitad del dolor de
configurar rutas está en pasos del SISTEMA (corte, plegado, guillotina),
y el sistema no puede declarar el centro de costo de un tenant. Una sola
tabla cubre ambos mundos, igual que el ruteo a estaciones.

### 2.4 Semántica (decisión b: fallback VIVO del motor)

El default aplica como **fallback en el motor al cotizar**, no como
prefill congelado: un producto que no pisó el valor sigue al default de
la familia — cambiar el default corrige TODOS los productos que confían
en él (misma semántica que tarifas y estaciones). El editor de config
muestra el estado: "Usando el ritmo del paso (60/h) — escribí para
pisarlo".

### 2.5 De dónde salen (UI)

- **Wizard de paso (tenant)**: las preguntas YA existen — "¿a qué
  ritmo?" y "¿cuántos minutos?" del preview pasan a GUARDARSE como
  default; la pregunta de estación se amplía a "¿Dónde se hace y quién
  lo cobra?" (estación + centro); la rama que acomoda pregunta demasía
  típica (opcional).
- **Catálogo del sistema (decisión c)**: en la vista Pasos de
  producción, cada familia del sistema gana "Configurar defaults" — un
  sheet chico con los 5 campos aplicables. Ahí es donde el tenant
  declara que SU guillotina la cobra el centro X y SU gran formato
  solapa 30 mm.
- **Config del producto**: mismos campos de siempre, ahora con el
  default visible como placeholder y estado "usando default del paso".

### 2.6 Sub-fases

- **E.1.1** — Tabla + resolución en motor/nesting-config + tests (el
  tier nuevo en las cadenas de precedencia; suite intacta por nombre).

  > **Estado 2026-07-30: HECHA** (rama `feat/wizard-ruta`). Tabla
  > `FamiliaPasoDefaults` (migración 20260730054500, dev+test) con FK a
  > CentroCosto (SetNull). `familia-defaults.ts`: funciones PURAS de
  > precedencia (`tiempoFijoEfectivoMin`, `productividadPropiaEfectiva`,
  > `centroCostoEfectivo`/`aplicarCentroDefault`) — testeadas sin DB. El
  > motor carga los defaults por familia en `cargarPasos` Y en pasos
  > extras (`cargarDefaultsFamilias`), aplica el centro en la carga (aguas
  > abajo hay un solo origen de centro) y tiempo/productividad en los dos
  > sitios de cálculo. `nesting-config`: tier de familia insertado en
  > demasía (runtime → producto → familia → derivado legacy) y solape
  > (→ 20). 5 tests nuevos de precedencia; suite completa = línea de base
  > (433 verdes / mismos 18 rotos preexistentes). Sanity live: default de
  > Bordado (45/h) insertado en dev y la cotización conocida NO cambió —
  > la config del producto (60/h) le gana, como debe.
- **E.1.2** — Captura: wizard de paso guarda defaults; sheet "Configurar
  defaults" para familias del sistema.

  > **Estado 2026-07-30: HECHA y verificada E2E** (rama
  > `feat/wizard-ruta`). Backend: `defaults` viaja en el DTO del wizard
  > tenant (upsert en la MISMA transacción; null = borrar fila) + endpoint
  > `PUT /familias/:codigo/defaults` para CUALQUIER familia +
  > `defaults` en GET /familias y en el listado tenant (precarga). Front:
  > el preview del paso final se re-encuadró como **"Valores típicos del
  > paso (y una prueba de costo)"** — el ritmo, el tiempo fijo y el centro
  > YA NO se tiran: se guardan como defaults (bindeados al draft); la
  > pregunta de estación pasó a "¿Dónde se hace y quién lo cobra?"; la
  > rama que acomoda pregunta la demasía típica; y el catálogo del sistema
  > ganó la columna Defaults con el sheet (campos condicionales a la
  > forma: centro sólo M-0, ritmo sólo T-2, demasía sólo si nestea vía
  > capacidades B.3, solape sólo gran formato; formas sin defaults
  > muestran el porqué). E2E real: defaults de Corte manual (120/h +
  > Produccion & Taller) guardados por la ficha y verificados en DB;
  > edición de Bordado precarga 45/h + centro desde sus defaults. 2 tests
  > de integración nuevos (crear-con-defaults / PATCH null / familia
  > sistema / familia inexistente 400). Trampa repetida y confirmada: los
  > edits por script NO despiertan al nest watch — re-guardar con
  > escritura normal (dos veces nos pasó: B.3.3 y acá).
- **E.1.3** — Editor de config: placeholders/estado "usando default" +
  E2E (configurar un producto nuevo con un paso que trae defaults debe
  requerir CERO campos de tiempo/costo).

  > **Estado 2026-07-30: HECHA — E.1 COMPLETA, done cumplido al centavo.**
  > Editor de config: el select de centro muestra "Usando el del paso:
  > Produccion & Taller" y la productividad "Usando el ritmo del paso:
  > 45/h" como placeholders cuando la config está vacía; y las
  > validaciones dejan de advertir lo que el default cubre ("Centro sin
  > definir" / "Tiempo sin definir" ya no aparecen si la familia lo
  > declara — Bordado se configura SIN el "!" mientras Serigrafía, sin
  > defaults, lo mantiene). E2E real (alternativa "Defaults E2E" del
  > producto de prueba): Bordado guardado con CERO campos de tiempo/costo
  > (centroCostoId null, sin productivityValue en DB) y la cotización
  > resolvió todo por el fallback vivo — **134 min = ⌈100/45×60⌉ ·
  > Produccion & Taller · $25.175,67/h · $56.225,66**: el ritmo y el
  > centro salieron del DEFAULT declarado en el wizard, no de la config.
  > Suite completa = línea de base (435 verdes / 18 preexistentes).
  > Alcance anotado: demasía/solape no muestran aún el "usando default"
  > en la card de nesting (el motor SÍ los aplica; display para E.3).

### 2.7 Abierto (no bloquea)

- ¿"Fijar" para defaults (que el producto NO pueda pisar)? La filosofía
  "nadie modela mejor que el que modela" sugiere que no; se revisa si
  aparece el caso.
- Márgenes extra tier de familia: se decide al tocar nesting-config
  (mismo mecanismo, costo marginal).

## 3. Próximos pasos del plan

- **E.1 — Defaults declarados en el paso**: centro de costo + ritmo +
  los candidatos del censo (demasía, solape, tiempo fijo). Contrato
  único: familia sugiere → producto pisa → runtime ajusta.
- **E.2 — Tercerizado como bifurcación inicial** del wizard de paso
  ("¿Quién lo hace: tu taller o un proveedor?"), con la decisión de
  diseño familia-vs-config a cerrar antes.

  > **Estado 2026-07-30: HECHA y verificada E2E.** Decisión del usuario:
  > la tercerización declarada vive en los DEFAULTS de E.1
  > (`FamiliaPasoDefaults` ganó tercerizado + proveedorId + fuente +
  > plazo, migración 20260730071000) — cubre sistema Y tenant, y el
  > switch del producto pasa de parche a mecanismo de pisar (internalizar
  > o cambiar proveedor). La GRILLA de precios sigue por producto.
  >
  > Wizard: pregunta nueva **"¿Quién hace este paso?"** tras el arranque;
  > la rama proveedor reduce el flujo de 10 pasos a 5 (proveedor
  > habitual + "¿cómo cotiza?" en humano —grilla / por cantidad o medida /
  > precio fijo— + plazo → activación → nombre) y guarda la familia con
  > forma canónica M-0/T-4 sin slots ni estación. La ficha "Configurar
  > defaults" del catálogo ganó la sección de tercerización (cualquier
  > paso del sistema puede declararse tercerizado). El editor de config
  > PRECARGA el panel completo en configs nuevas — verificado E2E: config
  > de "Troquelado tercerizado E2E" nació con el switch prendido,
  > Terminaciones Patagonicas, matriz y 5 días; sólo falta la grilla.
  > Chip "Tercerizado" en Tus pasos; el paso final del wizard esconde
  > los valores típicos de tiempo/costo (no aplican) y "qué deja" omite
  > los minutos internos. 1 test de integración nuevo (defaults
  > tercerizado + proveedor ajeno → 400); suite = línea de base.
- **E.3 — Wizard de ruta**: con el inventario de §1 ya clasificado, las
  preguntas que le quedan son: qué pasos, en qué orden, máquina/material
  concreto, herencia (ya humana, B.3.3), y las preguntas [O] del censo
  SOLO para los pasos de nesting.

## 4. E.3 — El Wizard de Ruta (diseño)

### 4.1 El principio rector: un motor de preguntas pendientes

El wizard NO es una pantalla nueva con los mismos campos en otro orden.
Es un **motor de pendientes**: por cada paso de la ruta, computa qué
falta para que ese paso cotice bien — es decir, lo que la familia + sus
defaults + lo ya configurado NO resuelven — y pregunta SOLO eso, de a
una pregunta, en idioma de taller. El corolario que justifica todo el
camino A→B→E.1→E.2: **un paso bien declarado = cero preguntas**
(Bordado con sus defaults pasa directo: "✓ Listo — 45/h · Produccion &
Taller").

Esto invierte la relación con las validaciones existentes: hoy
`validarBasico`/`validarMateriales` PROTESTAN después; el motor de
pendientes es la misma información usada ANTES, como guion de preguntas.

### 4.2 Anatomía: dos fases

**FASE A — "¿Cómo se hace este producto?"** Armar la secuencia: buscar
pasos (Tus pasos primero + catálogo, el selector humano de E.0), ordenar,
o partir de una ruta existente. El wizard muestra por paso lo que YA
trae ("Tercerizado — Terminaciones Patagonicas", "45/h · Produccion &
Taller") para que elegir el paso correcto sea la mitad del trabajo.

**FASE B — recorrido paso a paso.** Cada paso muestra su estado (✓ Listo
/ "Faltan 2: máquina, papel") y sus question-cards pendientes de a una.
El inventario COMPLETO de preguntas posibles (derivado del censo §1 +
validaciones):

| Condición del paso | Pregunta (en humano) |
|---|---|
| M-1 sin máquina elegida | "¿En qué máquina se hace?" (+ perfil) |
| M-2 sin candidatas | "¿Entre qué máquinas elige el comercial?" |
| Slot requerido sin material | "¿Qué [papel/tinta/…] usa?" (fijo / candidatos / lo elige el comercial / decide el sistema) |
| HEREDAR sin origen | "¿De qué paso hereda la cantidad?" (B.3.3, ya existe) |
| Tercerizado sin grilla | "Cargá los precios de [proveedor]" (matriz/tarifa/fijo) |
| T-2 sin ritmo NI default | "¿A qué ritmo se hace en este producto?" |
| Sin centro NI default (manual) | "¿Quién lo cobra?" |
| CONDICIONAL sin regla | "¿Cuándo se activa?" (builder de reglas) |
| Nestea (oficio, §1): | |
| — impresión por hoja | "¿En qué pliego se imprime?" (del sustrato / fijo / que el sistema compare) |
| — gran formato rollo | "¿Puede salir en paneles?" (no / sí automático / sí así: solape+dirección+ancho con su interpretación) |
| — con placa/rollo | "¿Cómo se cobra el material?" (entero / lo consumido / por tramos) |

Todo lo demás NO se pregunta: activación (default de familia, pisable con
un toggle en la card del paso), demasía/solape/ritmo/centro/tiempo fijo
(defaults E.1), proveedor/fuente/plazo (E.2), algoritmo (la física
decide, B.3.4), estación y registro (familia).

### 4.3 Convivencia

El editor actual NO se borra: el modo guiado es la puerta de entrada y
el editor completo queda como "modo detallado" (mismo patrón que el JSON
detrás del selector de herencia). Los overrides finos (setup/cleanup,
márgenes extra, dotación, multiplicadores) viven en detallado.

### 4.4 Sub-fases

- **E.3.1 — El motor de pendientes** (sin UI nueva): función pura
  `pendientesDePaso(familia, defaults, cfg, contexto)` → lista tipada de
  preguntas con su porqué; tests exhaustivos por forma. En el editor
  actual, banner humano por paso ("Faltan 2: máquina y papel") en lugar
  del chip críptico — primera entrega visible y sirve de validación del
  motor con uso real.

  > **Estado 2026-07-30: HECHA y verificada en vivo** (rama
  > `feat/wizard-ruta`). `src/lib/pendientes-paso.ts`: 11 tipos de
  > pendiente con etiqueta/motivo en idioma de taller y flag
  > `bloqueante` (cotiza mal sin esto) vs sugerido (hay fallback, ej.
  > herencia sin origen); rama tercerizada pregunta SOLO proveedor y
  > precios; defaults-aware (la invariante madre — paso bien declarado =
  > lista vacía — es el primer test). 11 tests vitest verdes (el front
  > tenía vitest: 362 verdes en total). Editor: banner humano bajo el
  > título — Bordado: "Centro del paso: Produccion & Taller (default) ·
  > ✓ Listo para cotizar" (verde); Serigrafía sin defaults: "Para
  > cotizar bien — Faltan: el ritmo de trabajo y quién lo cobra"
  > (ámbar) — verificado en vivo con la alternativa Defaults E2E.
- **E.3.2 — Question-cards guiadas** en Configurar pasos: el modo guiado
  recorre los pendientes de a uno; "modo detallado" a un click.
- **E.3.3 — Las preguntas de oficio en humano**: pliego de impresión,
  panelizado y costeo del sustrato salen de Avanzado hacia cards guiadas
  (los 3 grandes del censo; márgenes extra quedan en detallado).
- **E.3.4 — FASE A**: armar la secuencia desde el producto (alta de
  producto y tab Rutas), con la decisión de reuso de rutas de abajo.
- **E.3.5 — E2E de done.**

**Done** = armar y configurar un producto NUEVO de punta a punta en modo
guiado, sin abrir el modo detallado ni Avanzado; un paso con defaults
completos pasa con CERO preguntas; y la cotización sale correcta al
primer intento.

### 4.5 Decisiones (CERRADAS con el usuario, 2026-07-30)

1. **Convivencia**: el modo guiado es la puerta de entrada; el editor
   completo queda como "modo detallado" (overrides finos ahí). Sin
   big-bang.
2. **Entrada**: el flujo guiado arranca EN EL PRODUCTO — al crear un
   producto sin ruta y en el tab Rutas ("Armar ruta guiado"); el wizard
   arma la alternativa entera de corrido (secuencia + config por paso).
3. **Reuso de rutas**: el sistema decide con aviso — si la secuencia
   coincide con una ruta existente la reusa; si no, crea una nueva con
   nombre autogenerado editable. La ruta pasa a ser un detalle técnico
   visible, no un trámite.
