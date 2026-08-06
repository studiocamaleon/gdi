# Derivadores geométricos — cartelería modelable como cualquier producto

> **Estado**: ETAPAS 1-4 IMPLEMENTADAS (2026-08-05, sin commitear); Etapa 5
> (Frontlight solo con datos) pendiente. Origen: análisis con el usuario sobre si cartelería estaba
> "parchando" el motor (ver
> [carteleria-configurador-diseno.md](carteleria-configurador-diseno.md) §17).
> Decisión: el configurador 3D queda **a un costado, sin usar**, hasta que el
> modelado por pasos sea 100% genérico. Este doc define cómo.
> Ver §8 por lo que quedó implementado y las notas de la Etapa 1.

---

## 1. La decisión en una frase

Un cartel backlight (y cualquier cartel futuro) se tiene que poder **modelar
con pasos como todos los demás productos del sistema** — con elementos que
elige el comercial, o con todo fijo y el comercial poniendo solo cantidad —
sin que el motor tenga un solo `if (familiaCodigo === ...)` con nombre de
rubro. Para eso, las 4 cosas que hoy están hardcodeadas se convierten en
**primitivas declarables**, y la central es un concepto nuevo: el
**derivador geométrico**.

**La regla de oro que esto instala**: un producto nuevo puede costar, a lo
sumo, *un derivador puro con tests* — jamás un if en `motor.service.ts`.
Verificable: después de la Etapa 2, `grep -ri carteleria
apps/api/src/motor-universal/` devuelve cero fuera del catálogo de
derivadores.

## 2. El diagnóstico (auditoría 2026-08-05, ruta real de 9 pasos)

La ruta RUTA-CARTEL-BACKLIGHT de dev ya es **80% motor genérico puro**:

- Pasos 2, 3, 6, 8, 9 (`trabajo_manual`, `pintura_superficial`) usan
  `HEREDAR_DEL_OUTPUT_CANONICO` (G-M2, ~10 familias lo soportan) y
  `productivityQuantitySource` estándar. Cero código especial.
- Paso 4 es la `modificacion_pre` de siempre (demasía +100 mm por lado).
- Paso 5 es gran formato estándar (nesting shelf-rollo, MAYOR_APROVECHAMIENTO).
- Los slots de pintura/chapa (pasos 3/6/9) son `por_unidad_productiva` sobre
  la cantidad heredada — el material acompaña al driver sin código nuevo.

Lo **exclusivo** se concentra en la derivación geométrica y sus consecuencias:

| # | Pieza hardcodeada | Dónde | Qué hace |
|---|---|---|---|
| 1 | `calcularEstructuraBastidor` invocado con if de familia desde **4 lugares** | motor.service.ts:779 (guard), :5548 (cantidad), :5637 (slots), outputs-canonicos.ts:410 (outputs, recalcula) | W×H×D + separaciones → ml, despiece, puntos de soldadura, m² de cenefa/pintura/fondo, anclajes |
| 2 | Pre-pasada de watts + side-channel `__iluminacionLed` | motor.service.ts:2247 | única familia que escribe en el JobContext antes de resolver sus slots (el slot `fuente` necesita los watts) |
| 3 | Defaults de selección de la fuente por código | motor.service.ts:4969 | `criterioMotorAuto`/`criterioInputCampo`/`criterioMaterialCampo` están NULL en DB y los inventa el if `esFuenteLed` |
| 4 | `cantidadSlotPrimitivaCarteleria` | motor.service.ts:5620 | único bypass de fórmula de slots del motor; la mitad es **vestigio** de la ruta pre-§15 (chapa_cenefa/pintura/chapa_fondo ya viven en sus propios pasos) |
| 5 | `CAMPOS_SIEMPRE_EDITABLES_POR_FAMILIA` | motor.service.ts:138 | tabla con exactamente 2 entradas (las familias de cartelería); saltea `camposEditablesComercial` |
| 6 | Guards con nombre propio | motor.service.ts:778-812 | `estructura_bastidor_sin_profundidad`, `iluminacion_led_sin_modulo` (anti-$0-silencioso, patrón ojales) |
| 7 | Outputs que recalculan en vez de heredar cantidad | outputs-canonicos.ts:400 | `puntos_soldadura`/`cenefa_m2`/`pintura_m2`/`fondo_m2` re-ejecutan el helper (un paso publica 5 drivers y la cantidad es solo uno) |
| 8 | `carteleriaRol` en `paramsPasoJson` | solo frontend (agregar-producto-sheet.tsx) | metadata de UI viajando en config de motor; el motor la ignora |

Precedente del patrón: `colocacion_ojales` es la misma primitiva (geometría
Tipo B, "FRONTERA-PRIMITIVA" en el propio comentario del motor) con 3 call
sites propios — o sea, el problema ya existía en chiquito; cartelería lo hizo
evidente.

## 3. El concepto: derivador geométrico

El sistema ya tiene el patrón enchufable correcto: el **dispatcher de
nesting** (`nesting-dispatcher.ts`). Una familia no "sabe" nestear — declara
CALCULADO_POR_PASO y el dispatcher rutea al algoritmo (shelf-rollo,
plate-segments, guillotina, caballete…). Nesting nuevo = registrar un
algoritmo, cero ifs en el motor. La derivación geométrica se resuelve igual.

### 3.1 Contrato

```ts
// apps/api/src/motor-universal/derivadores/tipos.ts
export interface ResultadoDerivador {
  /** Magnitudes derivadas, por nombre camelCase (mlTotal, puntosSoldadura, watts…). */
  magnitudes: Record<string, number>;
  /** Despieces para compra real (packing 1D de barras, etc.). Opcional. */
  despieces?: Record<string, number[]>;
  /** Traza para ficha técnica / OT (refuerzos, grilla, desarrollo…). Opcional. */
  traza?: Record<string, unknown>;
}

export type Derivador = (
  jobContext: JobContext,
  paramsEfectivos: Record<string, unknown>,
  /** Atributos de la variante del slot principal (coberturaM2, desarrolloSeccionM…). */
  materialPrincipal?: Record<string, unknown> | null,
) => ResultadoDerivador | null; // null = faltan datos → guard genérico
```

Reglas del contrato:
- **Función pura con specs** — la geometría es código Tipo B (shoelace,
  packing, desarrollo de chapa no se expresan en un DSL sin inventar un
  lenguaje que después hay que mantener). La frontera: *la primitiva es
  código puro testeado; todo lo que la rodea es dato*.
- Devuelve null cuando no puede derivar (p. ej. cajón doble sin
  profundidad) — el motor emite un error genérico con mensaje declarado por
  la familia (§5.4). Nada de $0 silencioso.
- Se ejecuta **una vez por paso** y el resultado se cachea en la ejecución.
  Muere el side-channel `__iluminacionLed` y las invocaciones repetidas.

### 3.2 Catálogo inicial (`derivadores/index.ts`)

| Código | Hoy vive en | Magnitudes |
|---|---|---|
| `bastidor_rectangular` | estructura-bastidor.ts (7 specs) | mlTotal, puntosSoldadura, cenefaM2, pinturaM2, fondoM2, anclajes + despiece de barras |
| `sembrado_led` | iluminacion-led.ts (9 specs) | modulos, watts, cableMl |
| `layout_ojales` | colocacion-ojales.ts | ojales + posiciones (traza) |

Los helpers actuales NO se reescriben: se registran. `layout_ojales` se
migra al mismo contrato para unificar el precedente (sus 3 call sites
propios también desaparecen).

### 3.3 Declaración en la familia (todo dato)

```ts
// familias.ts — estructura_bastidor, después
derivadorCodigo: 'bastidor_rectangular',
magnitudPrincipal: 'mlTotal',            // la cantidad del paso (CALCULADO_POR_PASO)
outputsDesdeDerivador: {                 // qué publica para HEREDAR_DEL_OUTPUT_CANONICO
  ml_estructura: 'mlTotal',
  puntos_soldadura: 'puntosSoldadura',
  cenefa_m2: 'cenefaM2',
  pintura_m2: 'pinturaM2',
  fondo_m2: 'fondoM2',
},
mensajeSinDatos:
  'Es un bastidor DOBLE (cajón) pero no tiene profundidad: sin ella no se ' +
  'pueden derivar los metros de perfil. Cargala al cotizar, fijala en el ' +
  'paso, o cambiá a "simple".',
```

`iluminacion_led` declara además que su derivador necesita el material del
slot `modulos_led` (campo `derivadorMaterialSlot: 'modulos_led'`) — eso
reemplaza la pre-pasada especial: el motor resuelve ese slot primero porque
la familia **lo declara**, no porque haya un if.

## 4. Los otros tres ejes que se vuelven declarables

### 4.1 Slots alimentados por magnitudes derivadas

`resolverCantidadSlotPorBase` (motor.service.ts:5684) ya rutea por
`cantidadBase` (`cantidad_pedida`, `pliegos_impresos`, `talonario_pilas`…).
Se agrega un valor:

```
cantidadBase: 'derivada', magnitudDerivada: 'cableMl'   (× cantidadFactor como siempre)
```

Con eso muere `cantidadSlotPrimitivaCarteleria` entero: perfil consume
`mlTotal` (o barras, §4.3), anclajes `anclajes`, cable `cableMl`, fuente
cantidad fija 1 (`cantidadBase: 'fija'`, otro valor trivial del mismo eje).

### 4.2 Selección por capacidad como datos del slot

El algoritmo `MENOR_CAPACIDAD_QUE_CUMPLA` (seleccion-capacidad.ts) ya es
genérico. Lo hardcodeado son los defaults del if `esFuenteLed`. Pasan a ser
**datos escritos en el slot** (por el modelador o la provisión):

```
criterioMotorAuto: 'MENOR_CAPACIDAD_QUE_CUMPLA'
criterioInputCampo: 'watts_led'        // output canónico publicado por el paso
criterioMaterialCampo: 'capacidad'
```

`criterioInputCampo` puede referenciar cualquier output canónico o magnitud
derivada del propio paso (ya viajan como flat keys del JobContext). El
default de fábrica lo escribe la **definición del slot en la familia**
(campo `criterioDefault` en `slotsRequeridos`), no un if del motor — así
cualquier familia futura puede traer selección por capacidad preconfigurada.

### 4.3 Compra real generalizada

El packing 1D de barras (`calcularBarrasNecesarias`, first-fit-decreasing
sobre el despiece) ya es genérico; lo atado a cartelería es la activación
(solo el slot `perfil_estructural`). Se generaliza: **cualquier slot cuyo
material declare `largoBarra` (m) en su variante y cuyo paso publique un
despiece** cobra barras enteras. Queda como 4º mecanismo documentado de
compra real: hojas (nesting), latas (CONVERSION), rollos (consumed-length),
barras (packing 1D).

Pendientes anotados (no bloquean): `minimoCompra` genérico en la variante;
diagnóstico fino cuando un tramo no entra en ninguna barra (hoy cae a ml);
chapa trasera con HOJAS reales vía `montaje_sobre_sustrato` + plate-segments
(el paso 6 de la ruta pasa de m² teóricos a hojas cuando se haga).

### 4.4 Editabilidad declarada por campo

`paramsPasoSchema` gana un flag por campo:

```ts
{ campo: 'densidad', ..., expuestoAlComercial: true }
```

`paramsEfectivos` (params-runtime.ts) ya mergea por lista de campos; la
lista pasa a salir del schema de la familia en vez de la tabla
`CAMPOS_SIEMPRE_EDITABLES_POR_FAMILIA` (que muere). El sheet genérico ya
sabe renderizar params de familia — con el flag los muestra como opciones
del comercial (steppers/enums desde el schema), sin herramienta especial.

**Esto habilita el espectro completo de modelado** — y no requiere nada
nuevo, es el modelador decidiendo:
- *Cartel cerrado*: params fijos, slots HARDCODED, medidas fijas → el
  comercial solo pone cantidad.
- *Cartel abierto*: medidas libres, lona/módulo COMERCIAL_ELIGE,
  pintura/cenefa/chapa como OPCIONALES de ruta, densidad expuesta.
- Cualquier punto intermedio. Igual que un banner o una revista hoy.

## 5. Plan por etapas

| Etapa | Qué | Muere |
|---|---|---|
| **1** | Contrato + catálogo de derivadores; declaración en familia; call site único con cache; outputs desde `outputsDesdeDerivador`; guard genérico `derivador_sin_datos` | las 4 invocaciones repetidas, `__iluminacionLed`, la pre-pasada :2247, los 2 guards con nombre, el switch F1 de outputs-canonicos.ts, los 3 call sites de ojales |
| **2** | `cantidadBase: 'derivada'`/`'fija'` en slots; criterios de capacidad como datos (+ `criterioDefault` en familia); packing de barras por atributo | `cantidadSlotPrimitivaCarteleria`, el if `esFuenteLed` |
| **3** | `expuestoAlComercial` en `paramsPasoSchema`; sheet los renderiza genérico | `CAMPOS_SIEMPRE_EDITABLES_POR_FAMILIA`, `carteleriaRol` (los toggles ya son OPCIONALES de ruta; lo que era rol pasa a ser el paso mismo) |
| **4** | Compra real: generalizar activación de barras; chapa trasera con hojas reales | m² teóricos de la chapa |
| **5** | Prueba de fuego: modelar Frontlight completo SOLO con datos (editor de producto normal, sin tocar código) | — |

### 5.1 Verificación (red de seguridad)

- **Golden master**: la cotización del CARTEL-BACKLIGHT de dev con todo
  activo da **$858.758** hoy. Tiene que dar idéntico después de cada etapa
  (mismo desglose por paso, mismos outputs). Se agrega como spec de
  integración antes de tocar nada.
- Los helpers ya tienen 16 specs (7 bastidor + 9 LED) que no se tocan.
- Casos E2E ya verificados que deben seguir dando igual: refuerzos c/50 →
  25,44 ml · densidad 1,5 → 70 módulos · cenefa off → chapa $0 · módulo 3W →
  16 módulos/48 W y fuente baja a 100 W · barras: despiece 20,28 ml → 4
  barras de 6 m.
- `grep -ri carteleria apps/api/src/motor-universal/` = solo el catálogo de
  derivadores (nombres de archivo de helpers), cero en motor.service.ts.

### 5.2 Costo marginal después del refactor (la promesa)

| Producto nuevo | Derivador nuevo | Todo lo demás |
|---|---|---|
| Frontlight, marquesina, valla | ninguno | datos (ruta + params) |
| Light box, tótem | ninguno | datos |
| Corpórea | `contorno_svg` (shoelace + largo de path, ~100 líneas + specs) | datos: corte láser (perimetro real) + plotter + led modo recorrido |
| Caja de acrílico | `caja_5_caras` (desarrollo de caras + ml de pegado) | datos |

## 6. Qué queda a un costado (decisión 2026-08-05)

- **El configurador 3D no se usa por ahora.** Los componentes
  (`src/components/carteleria/`) quedan en el repo sin cablear; el early
  return del sheet se desactiva y el backlight se cotiza con el flujo
  genérico (medidas + opcionales + params expuestos), como cualquier
  producto. El 3D vuelve más adelante como capa de visualización opcional
  sobre un modelado que ya cotiza perfecto sin ella. Cuando vuelva,
  `geometria.ts` (espejo client-side) necesita un test de contrato contra
  los derivadores (mismos fixtures en ambos lados).
- **Capa/provisión/vista de Configuración**: la conversación previa (recetas
  del sistema SYS-CARTEL-*, config por oficio estilo Centro de Copiado)
  sigue vigente pero pasa a ser **decisión de producto, no necesidad
  arquitectónica** — con las primitivas declarables, un backlight puede ser
  receta provisionada Y un tenant avanzado puede modelarse el suyo en el
  editor normal. Se decide después de la Etapa 5.

## 7. Fuera de alcance de este doc

- Nesting irregular de planchas (SVGnest/jagua-rs) — cuando llegue, entra
  por el dispatcher de nesting, no por acá.
- Familia `instalacion` con tabla f(altura, complejidad) — V1 sigue con
  cargos manuales.
- Doble faz con segunda lona (hoy duplica solo tinta) — deuda anotada en
  carteleria-configurador-diseno.md §13.
- Letras 3D impresas (módulo aparte, como siempre).

## 8. Etapa 1 — qué quedó implementado (2026-08-05)

- **Contrato + catálogo**: `motor-universal/derivadores/tipos.ts` (contrato,
  cache `KEY_DERIVACIONES_POR_PASO`) e `index.ts` (registro:
  `bastidor_rectangular`, `sembrado_led`, `layout_ojales` — los helpers
  matemáticos siguen en sus módulos con sus specs, acá solo se adaptan).
  10 specs nuevos del contrato en `__tests__/derivadores.spec.ts`.
- **Declaración**: `DefinicionFamilia.derivador` (codigo, magnitudPrincipal,
  outputs, materialSlot, mensaje/sugerencia/codigoSinDatos) declarado en
  `estructura_bastidor`, `iluminacion_led` y `colocacion_ojales`. Los
  códigos de error viejos se conservan como `codigoSinDatos` (diagnóstico
  fino gratis, golden master intacto).
- **Motor, un solo call site** (`ejecutarPaso`): corre el derivador una vez
  por paso (resolviendo antes el material de `materialSlot`, buscado POR
  código de slot) y cachea en el JobContext. El cache se crea ANTES del
  bucle de pasos para sobrevivir al shallow-copy del duplicado por caras.
- **Muertos**: la pre-pasada de watts y el side-channel `__iluminacionLed`;
  los 3 guards con nombre propio (→ guard genérico con mensaje declarado);
  los ifs por familia en `resolverCantidad` (→ `magnitudPrincipal`); el
  switch F1 + ojales de `outputs-canonicos.ts` (→ mapeo `outputs` declarado:
  la magnitud principal publica cantidadEfectiva, las secundarias leen la
  derivación); el recálculo del helper en los 4 call sites.
- **Transitorio (muere en Etapa 2)**: `cantidadSlotPrimitivaCarteleria`
  (ahora lee el cache, sigue mapeando slot→magnitud por código) y el default
  `esFuenteLed` del selector por capacidad (ahora lee wattsRequeridos del
  cache del paso, no un flat key).
- **Verificación**: golden master `scripts/carteleria-golden-master.js`
  (7 casos: todo activo, sin opcionales, refuerzos c/50, densidad 1,5,
  módulo 3W, chico, guard sin profundidad — huella con outputs y tiempos
  por paso) **idéntico** pre/post; jest 1386 verdes y los mismos 12 fallos
  PRE-EXISTENTES de la rama (11 motor.spec + 1 capacidades.spec, verificado
  con stash); `tsc --noEmit` limpio.
- **Notas**: el total del caso "todo activo" es $1.313.379 con las
  selecciones explícitas del script (lona 1,52 m, perfil 40×40, módulo
  2835) — el $858.758 del §5.1 era con otra config; la huella canónica es
  el baseline JSON, no un número suelto. Micro-edge documentado: `watts_led`
  con módulo de 0 W ahora publica null (antes 0) — sin consumidores.
- **Falsa alarma investigada y cerrada** (mismo día): "GET /productos se
  cuelga" era un event loop bloqueado por cotizaciones corridas sobre
  procesos VIEJOS del nest --watch (estados intermedios de la edición), no
  el endpoint ni el motor actual — barrido completo 152/152 < 1,5 s. El
  throttler del API (100 req/min) además envenenaba los barridos con 429;
  `motor-golden-master.js` ahora los espera y la baseline genérica quedó
  válida (152 casos, 107 exitosos).

## 8b. Etapa 2 — qué quedó implementado (2026-08-05)

- **`SlotDeclarado` gana tres campos declarativos** (types.ts):
  `magnitudDerivada` (la cantidad del slot es esa magnitud del derivador;
  con despiece bajo el código del slot + `largoBarra` en la variante →
  unidades enteras con packing 1D), `cantidadFija` (fuente = 1) y
  `criterioCapacidadDefault` (selección por capacidad de fábrica;
  `inputMagnitud` lee la derivación del mismo paso, `inputCampo` lee flat
  key; el slot de DB pisa cualquiera).
- **Declarados**: perfil_estructural→mlTotal (+ barras), anclaje→anclajes,
  cableado→cableMl, fuente→cantidadFija 1 + MENOR_CAPACIDAD sobre
  wattsRequeridos/capacidad.
- **Muertos**: `cantidadSlotPrimitivaCarteleria` (→ `cantidadSlotDerivada`
  100% declarativa) y el if `esFuenteLed`. `grep -i carteleria` en
  motor.service.ts = solo el comentario de CAMPOS_SIEMPRE_EDITABLES (muere
  en Etapa 3).
- **Comportamiento retirado a propósito**: los slots `chapa_cenefa`/
  `pintura`/`chapa_fondo` colgados del paso `estructura_bastidor` (forma
  PRE-refactor §15 de la ruta) ya no derivan cantidad — esos materiales
  viven en sus propios pasos desde F4a y ningún producto usaba la forma
  vieja (verificado en dev).
- **Verificación**: cartelería golden master 7/7 idéntico; genérico 152
  casos vs baseline nueva; jest mismos 12 pre-existentes; tsc limpio.

## 8c. Etapa 3 — qué quedó implementado (2026-08-05)

- **API**: `ParamsPasoDeclarado.expuestoAlComercial` (types.ts) marcado en
  sepRefuerzoVcm/Hcm/solapaCenefaCm (bastidor) y densidad (LED);
  `camposExpuestosAlComercial()` en familias.ts; `paramsEfectivosDelPaso`
  lo deriva del schema. **Murió `CAMPOS_SIEMPRE_EDITABLES_POR_FAMILIA`** —
  `grep -i carteleria motor.service.ts` = 0.
- **Front, una sola autoridad**: `buildConfigPasoRuntime` ya NO filtra
  campos client-side (manda lo que el comercial tocó de pasos activos; el
  motor ignora lo que no corresponda vía `paramsEfectivos`). Murieron el
  merge espejo `mergeCarteleria` del sheet y su lista hardcodeada.
  `getParamsComercialDeRuta` une abiertos-del-modelador ∪
  expuestos-de-familia, así los controles aparecen sin tocar el producto.
- **Early-return 3D DESACTIVADO** (`CONFIGURADOR_3D_CARTELERIA_ACTIVO =
  false` en el sheet): el backlight cotiza por el flujo genérico — medidas,
  **input Profundidad del cajón restaurado** (patrón `paginas`; F3c lo
  había absorbido el 3D), opcionales (pintura/chapa/cenefas), materiales
  por slot y los params expuestos con etiqueta "Paso · Campo".
  `src/components/carteleria/` queda en el repo sin cablear.
- **Verificación**: golden cartelería 7/7 y genérico 152/152 idénticos;
  jest mismos 12 pre-existentes; vitest 412 verdes (1 test actualizado al
  contrato nuevo de buildConfigPasoRuntime); css:guard limpio; **E2E en
  navegador**: el sheet genérico reproduce el golden AL CENTAVO —
  sin opcionales $928.446, todo activo $1.313.379, densidad 1,5
  $1.309.483 — y el guard de profundidad aparece como diagnóstico de
  precio en vivo.

## 8d. Etapa 4 — chapa trasera con HOJAS reales (2026-08-05)

- **Código (una sola pieza, genérica)**: fuente builtin `piezas_visibles`
  en `buildJobContextPiezas` del dispatcher — el montaje trabaja sobre la
  MEDIDA TERMINADA (la chapa se corta al marco; la demasía de tensado que
  agrandó la lona no aplica). Declarada en el enum `fuentePiezasMontaje`
  de la familia. Todo lo demás fue DATOS (la promesa de la regla de oro).
- **Biblioteca**: 3 variantes HOJA de la misma MP chapa (GALV07/ALU10/
  PINT07 · 1,22×2,44 m · `anchoMm/altoMm` + `presentacion:'hoja'` +
  precio POR HOJA). Los candidatos de ambos slots de chapa pasaron de
  `todasLasVariantes` a junction explícito: paso 6 ofrece las HOJA, el
  paso 9 (cenefas) sigue con las de m².
- **Ruta dev**: paso 6 `trabajo_manual`→`montaje_sobre_sustrato`,
  CALCULADO_POR_PASO, `fuentePiezasMontaje:'piezas_visibles'`,
  `nestingConfig.costing.segmentSteps:[100]` (hoja entera se paga), slot
  `chapa`→`sustrato_montaje` con `estrategiaCosto:'plate-segments'`,
  tiempo 2 piezas montadas/h (magnitud default de la familia).
- **HALLAZGO importante para la provisión**: el motor cotiza desde el
  SNAPSHOT de `RutaVersion.snapshotJson`, no desde las filas de edición de
  `RutaPaso` — un cambio de estructura por SQL/provisión debe actualizar
  AMBOS (el paso 6 quedó cotizando como trabajo_manual hasta tocar el
  snapshot).
- **E2E verificado**: backlight 2,4×1,2 → 1 hoja (pieza VISIBLE rotada,
  96,75% aprovechamiento), $61.600/hoja vs $65.543 de m² teóricos ×1,1 —
  la física real era MÁS barata acá; 3 carteles → 3 hojas; cartel chico
  1×0,6 → hoja entera al 20% (el sobrante se paga); cartel más grande que
  la lona corta con diagnóstico. Sheet genérico: card del opcional ofrece
  las 3 variantes hoja y cotiza $1.134.741 (= API al centavo).
- **Golden cartelería RE-BASELINEADO** (cambio de comportamiento
  INTENCIONAL): todo_activo $1.313.379→$1.300.082, refuerzos_c50
  $1.497.361→$1.484.063, densidad_150 $1.309.483→$1.296.186, modulo_3w
  $1.187.239→$1.173.942; sin_opcionales/chico_simple/sin_profundidad
  intactos. Genérico 152/152 idéntico (nada más se movió).
- **Deuda cosmética**: los chips de variante del sheet etiquetan por
  atributos (tipo·espesor) e ignoran `nombreVariante` — las presentaciones
  hoja/m² de una misma MP se ven iguales.
- Pendiente §4.3 que sigue vivo: `minimoCompra` genérico; cenefa por hojas
  cuando se pase a nesting; diagnóstico fino de barras.


## 8e. Etapa F — nesting despachado por declaración (2026-08-06)

El dispatcher de nesting ruteaba los casos 2-6 por `familiaCodigo` (plotter,
laminado, pouch, montaje, impresión por hoja). Ahora rutea SOLO por la
declaración de la familia — mismo patrón que los derivadores.

- `nestingConfig` de `DefinicionFamilia` ganó `estrategia?: EstrategiaNesting`
  (`corte_rollo` | `laminado_rollo` | `pouch` | `montaje` | `pliego_digital`).
  Sin estrategia, la superficie decide (rollo → shelf, pliego → grid 2D multi,
  `segun_material` resuelve en runtime) — la vía de las familias de tenant,
  intacta.
- Las 5 familias declaran su estrategia en `familias.ts` (comentarios
  `[Etapa F]` con el caso que reemplazan). Las condiciones de runtime (modo
  HOJAS del plotter, caballete configurado) viven DENTRO de cada estrategia
  en el registro `ESTRATEGIAS_NESTING`, no en el dispatch.
- `despacharNesting` quedó: sin declaración → null (fallback del caller);
  estrategia nombrada → registro; sino superficie. Cero `if` por familia.
- Verificación: golden cartelería 7/7 y genérico 152/152 idénticos al
  baseline pre-cambio; jest 1392 pass con los mismos 12 fallos preexistentes;
  tsc limpio. El catálogo serializado al frontend no cambia (las familias de
  sistema no exponen `nestingConfig` al editor).
- **Fuera de alcance (hardcodes que siguen)**: defaults internos de
  `nesting-config.ts` por `impresion_por_hoja`; guards dentro de algoritmos
  (tope de hojas); mapeos de tarifa/centro en `motor.service.ts` (2269-2343)
  y ramas puntuales (3229, 3528). Migrables con el mismo patrón cuando se
  toquen. La visibilidad de la card Acomodado en el editor (`nestingAplica`,
  lista propia en `catalogo-tiempo.ts`) tampoco se tocó: pasarla a leer la
  declaración le agregaría la card a pouch (cambio de UI, decidirlo aparte).

## 8f. Etapa F2 — los hardcodes internos de nesting, a declaración (2026-08-06)

Continuación de §8e: murieron los `familiaCodigo` que quedaban alrededor del
nesting, en las tres capas.

- **`guardSinLayout` declarado**: nuevo campo de `nestingConfig`
  (`laminado_rollo` | `pouch` | `pliego_digital` | `sustrato` | `montaje`).
  La tabla de guards de motor.service (cortar con diagnóstico cuando el
  acomodado declarado no dio layout) se re-keyed por esta declaración.
  Sin declarar → fallback silencioso (familias de tenant, igual que antes).
  `impresion_por_area` declara `sustrato`; `plotter_corte` no declara guard
  (nunca lo tuvo).
- **`estrategiaNestingDeFamilia()` / `guardSinLayoutDeFamilia()`**: helpers
  estilo Etapa A en familias.ts. Con ellos: el pliego de impresión
  configurable de nesting-config.ts pasó de 5 checks de `impresion_por_hoja`
  a `estrategia === 'pliego_digital'`; ídem `tienePliegoImpresionAutomatico`,
  `debeAutocalcularNestingSiNoHayOutput`, `debeCalcularNestingLaminado`
  (ahora `laminado_rollo`) y el centrado láser del dispatcher. El check de
  familia en `runGrid2DSingle` se borró (redundante: printSheetMode
  'automatic' sólo existe con pliego_digital).
- **Frontend declarativo**: el catálogo serializa `nestingConfig` (sistema y
  tenant) y `nestingAplica(familia, cfg)` decide la card Acomodado por
  `Boolean(familia.nestingConfig)` — murió la lista de códigos. CAMBIOS DE
  UI INTENCIONALES: `plastificado_pouch` y las familias de tenant con
  superficie declarada ahora MUESTRAN la card de Acomodado (antes ocultas
  por omisión de la lista). Excepción documentada que se mantiene:
  `pre_prensa` nunca muestra la card.
- Verificación: goldens 7/7 y 152/152 idénticos, jest 1392 pass (mismos 12
  preexistentes), vitest 415 (2 fixtures actualizados: la familia mock ahora
  declara su nestingConfig como el catálogo real), tsc ambos, E2E: card
  Acomodado visible en Chapa trasera (montaje) vía declaración serializada.
- Hardcodes que siguen (otras capas, mismo patrón cuando se toquen):
  `defaultOutputParaHeredar` (eje herencia), `FAMILIAS_IMPRESION` (modo
  color), `modoColorAplica` del editor, guards de talonario.

## 8g. Etapa F3 — es-impresión y herencia default, a declaración (2026-08-06)

Los dos ruteos por nombre que quedaban de la lista de §8f (el de talonario
resultó falso pendiente: ya se activa por el param `modoTalonarioIncompleto`
del paso, no por familia).

- **`esImpresion`**: la familia declara ser paso de impresión con modos de
  color. Muere `FAMILIAS_IMPRESION` (motor.service: `esPasoImpresion` lee la
  declaración; de ahí cuelga todo el modo SIN_IMPRESION). Se serializa al
  catálogo y el editor la usa: `modoColorAplica(familia, cfg)` + el flag
  esImpresion de `buildModoColorOptions` (3 listas inline muertas en la
  vista). Declaran: impresion_por_area, impresion_por_hoja.
- **`outputHeredadoDefault`**: qué output canónico hereda el paso por default
  con HEREDAR_DEL_OUTPUT_CANONICO sin campoOutput. Muere el switch G-M2
  `defaultOutputParaHeredar` (queda como one-liner que lee la declaración).
  Declaran las 9 del switch: impresion_por_hoja→pliegos_calculados;
  corte_guillotina/corte_manual/laminado/plegado/troquelado_digital/
  engomado_emblocado/encuadernado_anillado→pliegos_impresos;
  modificacion_post→piezas_cortadas.
- Verificación: goldens 7/7 y 152/152 idénticos, jest 1392 (mismos 12
  preexistentes), vitest 415 (1 fixture: la familia mock declara
  esImpresion), tsc ambos, E2E: Impresión de lona intacta (candidatas M-2 +
  acomodo en rollo).
- Con esto NO quedan ruteos por familiaCodigo en el circuito de nesting/
  impresión/herencia default. Los `familiaCodigo` restantes en el repo son
  de otros ejes (p.ej. adaptadores de centro de copiado) y se migran con
  este mismo patrón cuando se toquen.
