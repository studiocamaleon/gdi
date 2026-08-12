# Cobrar un paso como "fijo + variable" — análisis y plan

> **Estado**: **F1+F2+F3 IMPLEMENTADAS** (2026-08-12, rama
> `feat/tiempo-extra-y-niveles-paso`). Falta F4 (mínimo de horas facturables) y
> F5 (cargos monetarios de verdad).
>
> **Cómo quedó**: `paramsPasoJson.tiemposExtra[]` (bloques con centro y dotación
> propios) + `paramsPasoJson.niveles` (variantes que elige el comercial). El
> motor los aplica en `tiempo-extra.ts` y `niveles-paso.ts`; el editor los
> pregunta en la card TIEMPO; el sheet ofrece el nivel en la card del opcional;
> el desglose los muestra bajo "Cargos" con la cuenta a la vista.
> **Verificado E2E** con "Colocacion de vinilos" (12 m²): trabajo 180 min +
> extra 270 min = 450 min a la ETA, costo del trabajo $75.527 y tiempo extra
> $213.993 separados, nivel congelado en el nombre del paso ("Colocacion de
> vinilos · Zona 2"). Golden masters 7/7 y 152/152 idénticos; jest y vitest sin
> regresiones (96 fallos pre-existentes, verificados con stash).
>
> Decisiones tomadas por defecto al implementar: el tiempo extra vive DENTRO de
> la card TIEMPO (no card propia) y un nivel viene marcado por defecto.
>
> **Lo anterior de esta nota**: ANÁLISIS CERRADO en su diseño (2026-08-12).
> Verificado línea por línea contra `motor.service.ts`, `schema.prisma`,
> `familias.ts` y el editor declarativo — sin supuestos.
>
> **Recorrido del análisis**: arrancó como "falta el editor de cargos por paso"
> (§3-§5) → giró a "el fijo **es tiempo**, no un cargo" (§6) → cerró en
> **el bloque de tiempo fijo dentro del paso, con centro de costo propio**
> (§7), que es el diseño a implementar.
>
> Hermanos: [tiempo-pasos-analisis-y-plan.md](tiempo-pasos-analisis-y-plan.md) ·
> [editor-pasos-preguntas-orden.md](editor-pasos-preguntas-orden.md) ·
> [hora-hombre-setup-cleanup-diseno.md](hora-hombre-setup-cleanup-diseno.md).

## 1. El disparador

> "En Colocación de vinilos se cobra por m², pero también un monto fijo cuando
> la instalación es fuera del taller. Hoy no se puede: el costo depende del
> tiempo del paso y nada más."
>
> "Ese fijo **es el tiempo de ida y vuelta de la gente que va a colocar**. En
> Tensado de lonas igual: el fijo es el tiempo de preparación."
>
> "Los pasos son de producción: **está bien que no se genere un paso Traslado
> aparte**, porque el traslado no es fabricación, forma parte del paso
> Colocación a domicilio."

## 2. El modelo de costo del paso, hoy

```
costo del paso = COSTO DE TIEMPO + COSTO DE MATERIALES + CARGOS DIRECTOS

costo de tiempo = (setup + run + cleanup + tiempoFijo) × tarifa del centro
                  × dotación (SÓLO si el paso no tiene máquina)
```

`motor.service.ts:3113` compone `totalCrudoMin`; `:3186` lo multiplica por **una
sola tarifa** y por la dotación. Todo termina en `costoUnitario` → `calcularPrecio`
(`:894`), o sea bajo el markup.

**Tres de los cuatro términos ya son "fijo"** (no escalan con la cantidad).
La cuenta que pide el disparador ya está escrita: lo que falta es poder
*decirla* y poder cobrarla a **otra tarifa**.

## 3. Los cuatro lugares donde hoy vive un "cargo" (inventario verificado)

| # | Nivel | Tabla / lugar | Motor | Editor | Estado en dev |
|---|---|---|---|---|---|
| 1 | Catálogo del tenant | `CargoDirectoCatalogo` (`schema.prisma:2599`) | — | `cargos-directos-manager.tsx` ✓ | 6 cargos |
| 2 | Producto / cotización | `ProductoCargoDirectoCotizacion` | `aplicarCargosCotizacion` L6713 ✓ | ✓ | 1 asociación |
| 3 | Producto / **PASO** | `ProductoCargoDirectoPaso` | `aplicarCargosPaso` L2702 ✓ | ✗ **no existe** | **0 filas en toda la base** |
| 4 | Orden (manual) | snapshot en la OT | — | sheet "Agregar cargo a la OT" ✓ | funciona |

El nivel 3 está cableado de punta a punta **menos la UI**: tabla, motor,
endpoint `POST /productos/config-pasos/:id/cargos` (`controller:462`) y hasta el
cliente `asociarCargoPaso()` (`productos-servicios-api.ts:572`), que **no lo
llama ningún componente**. La columna "Cargos" del desglose está vacía por eso.

## 4. Los agujeros del camino "cargo monetario"

**A** · No hay editor (§3).
**B** · El monto vive en el catálogo del tenant: `configOverrideJson` por
asociación existe y ningún editor lo escribe → un solo monto para todo el tenant.
**C** · `POR_UNIDAD_INPUT` da **$0 en silencio**: el monto es `precioPorUnidad ×
jobContext[inputCantidad]` con claves (`distanciaKm`, `viajes`…) que el sheet no
pide.
**D** · "Fuera del taller" no existe como dato: hardcode a `codigo === "viatico"`
(`agregar-producto-sheet.tsx:1607`).
**E** · Cargo = costo bajo markup, y con `precio_fijo`
(`calculador-precio.ts:92`) el cargo sube el costo y **no toca el precio**.

## 5. Los patrones reales de cobro de un paso

| # | Patrón | Ejemplo | Vía "cargo" | Vía "tiempo" (§7) |
|---|---|---|---|---|
| P1 | Variable puro | colocación $/m² | — | ✓ hoy |
| P2 | Fijo puro | salida a domicilio | modelo ✓ / editor ✗ | ✓ bloque de tiempo fijo |
| P3 | **Fijo + variable** | salida + $/m² | requiere A y B | ✓ **el motor ya lo suma** |
| P4 | Fijo escalonado | según zona | `zonas` ✓ / selector ✗ | horas por zona (F4) |
| P5 | Por unidad de un dato | $80/km | ✗ (agujero C) | horas que carga el comercial |
| P6 | % sobre el paso | +30% urgencia | modelo ✓ / editor ✗ | no aplica (es precio) |
| P7 | Mínimo del paso | "no baja de $40.000" | ✗ | **mínimo de horas facturables** (§7.6) |

## 6. El reencuadre: el fijo no es un cargo, es TIEMPO

Lo que se cobra no es un monto arbitrario: es **gente ocupada**. Instalación
fuera del taller = dos personas, ida y vuelta. Tensado = la preparación antes de
tensar.

Modelarlo como tiempo gana cuatro cosas que un monto en pesos **no puede dar**:

1. **Costo real.** La tarifa del centro trae sueldos, cargas y estructura
   absorbida. El fijo deja de ser un número a ojo.
2. **Costo y markup separados por construcción**: el tiempo entra como costo, el
   markup se aplica arriba con la misma regla que todo. El agujero E desaparece.
3. **Ocupa capacidad**: un traslado de 3 h bloquea a la cuadrilla en el tablero,
   en la cola y en la ETA. Un cargo de $15.000 es invisible para producción.
4. **Se puede medir**: el operario lo ficha y aparece el desvío real vs cotizado.

La regla para decidir, en una línea: **si ocupa gente nuestra, es tiempo; si
sale plata por la puerta, es cargo** (peaje, combustible, alquiler de
hidroelevador, flete tercerizado).

## 7. El diseño: bloques de tiempo fijo del paso

> **La decisión (Lucas, 2026-08-12)**: no un paso aparte. Los pasos son de
> **fabricación**; el traslado no lo es — pertenece al paso "Colocación a
> domicilio". Va como un **bloque de tiempo extra del paso**, que puede
> facturarse a **otro centro de costo**, suma al tiempo del paso (para la ETA) y
> se **muestra** en la columna "Cargos" del desglose, separado del tiempo de
> trabajo.

### 7.1 La forma

En el paso, uno o más bloques:

```jsonc
tiemposFijos: [
  {
    "etiqueta": "Traslado ida y vuelta",
    "minutos": 90,
    "centroCostoId": "<INS-001>",   // null = el del paso
    "dotacion": 2                    // null = la del paso
  }
]
```

Vive en `paramsPasoJson` —donde ya vive `tiempoManual`—, así no hay migración
para modelarlo. El **ejecutado** queda en la trazabilidad de la cotización, como
todo lo demás.

### 7.2 Qué cambia en el motor (poco, y acotado)

| | Hoy | Con bloques |
|---|---|---|
| `totalMin` del paso | setup + run + cleanup + fijo | **+ Σ bloques.minutos** |
| `tiempo.costo` | todo × una tarifa | **sólo el trabajo** × la tarifa del paso |
| costo de cada bloque | — | `minutos/60 × tarifa(centro del bloque) × dotación del bloque` |
| `duracionEstimadaMin` del paso materializado | `tiempo.totalMin` | **igual** → **la ETA queda bien alimentada sin tocar nada** |
| desglose | Tiempo · Materiales · Cargos | los bloques aparecen en **Cargos**, con su cuenta a la vista |

**Lo que ya funciona a favor**: `tiempoFijoOverrideMin` es **aditivo en todos los
modos** (`:3113`) y `totalMin` es exactamente lo que
`ordenes-trabajo.service.ts:2131` copia a `duracionEstimadaMin`. O sea: la mitad
"el tiempo alimenta la ETA" ya está resuelta por construcción.

### 7.3 La decisión fina: dónde SUMA vs dónde se VE

Que se **vea** en la columna Cargos es presentación. Dónde **suma** es otra cosa,
y tiene consecuencia: `costos-orden.ts:386` calcula
`centroCostoTotal = Σ tiempoTotal` — "lo que se llevaron los centros". Si el
costo del bloque se muda al bucket de cargos, **las horas de instalación
desaparecen del consumo de INS-001**, que es justo el dato que hacía real al
costo.

**Propuesta: tres buckets, no dos.**

```
costos: {
  tiempoTotal,       // el trabajo del paso
  tiempoFijoTotal,   // ← nuevo: los bloques, con su centro
  materialesTotal,
  cargosDirectosTotal,  // sólo desembolsos
  tercerizadoTotal,
  total
}
```

La columna del desglose muestra `tiempoFijoTotal + cargosDirectosTotal` bajo el
rótulo **Cargos**, con las filas distinguidas; las métricas por centro leen
`tiempoTotal + tiempoFijoTotal`. Se cumple lo pedido sin perder el consumo del
centro.

### 7.4 Detalles a resolver al implementar

1. **`tarifasMap`** (`:571`) se arma con los centros de los pasos y de las
   máquinas: hay que **agregar los centros de los bloques**, o `tarifasMap.get`
   devuelve `undefined` y el bloque cuesta 0.
2. **Sin tarifa publicada del período** → error de cotización, igual que el paso
   (`centro_costo_sin_tarifa_publicada`, `:3149`). Nunca $0 silencioso.
3. **Redondeo**: hoy `Math.ceil(totalCrudoMin)` (`:3115`). Los bloques son
   minutos declarados por el modelador: van **exactos**, el `ceil` sigue
   aplicando sólo al trabajo.
4. **Dotación del bloque**: propia u heredada del paso. Es lo que permite "van 2
   a instalar, tensa 1".
5. **Ojo con la capacidad del centro**: se carga en **horas-hombre** (2
   instaladores × 160 h = 320 h/mes). Si se carga como 160 h "de cuadrilla" y
   además se pone dotación 2, se cuenta doble.
6. **Registro de tiempos**: el operario ficha el paso entero. Distinguir el
   bloque como tramo propio es otra conversación, no bloquea.
7. **Migración**: el `tiempoFijoOverrideMin` que hoy existe pasa a ser un bloque
   sin centro propio. Es equivalente exacto — no mueve ningún precio.

### 7.5 Lo que queda como cargo monetario

El eje "Cargos" del análisis original no muere, se achica: peaje, combustible,
estacionamiento, alquiler de hidroelevador o andamio, flete tercerizado, matriz
que se compra. **Desembolsos, no horas.**

### 7.6 El mínimo, dicho como corresponde

"La instalación no baja de $40.000" es, en el oficio, **"mínimo media jornada de
cuadrilla"**:

```
totalCrudoMin = max(setup + run + cleanup + fijo + bloques, tiempoMinimoMin)
```

Una línea en `:3113`, un campo en el paso, y el desglose muestra el ajuste
("mínimo de 4 h aplicado: +1,2 h"). Mejor que un piso en pesos: escala solo
cuando sube la tarifa.

## 8. Los NIVELES del paso (la generalización)

> **La decisión (Lucas, 2026-08-12)**: modelar tres pasos "Colocación zona
> centro / periferia / taller" se vuelve inmantenible, y el mismo problema
> aparece en Diseño gráfico (Básico / Intermedio / Profesional). La solución no
> es para colocación: es **un paso con niveles**, que el comercial elige.

### 8.1 Es el cuarto eje excluyente, y el primero declarado

El sistema ya tiene tres ejes donde el comercial elige una opción y eso cambia
el costeo del paso. Cada uno con su tabla, su estado en el sheet y su rama en el
motor:

| Eje | El comercial elige | Y cambia |
|---|---|---|
| Modo de color | Sin impresión / CMYK / CMYK+W | el perfil → productividad y tarifa |
| Máquinas candidatas | UV / Eco-solvente | máquina, perfil, centro, costo |
| Material del slot | entre candidatos | el costo del material |
| **Nivel** ← falta | Zona 1/2/3 · Básico/Pro | **el tiempo** |

Los niveles son el genérico: en vez de hardcodear un eje más, **lo declara el
modelador**.

### 8.2 Qué resuelve

- **Mantenimiento**: 1 paso en vez de 3, declarado una vez y heredado (§8.5).
- **Exclusividad gratis**: es un radio, no checkboxes — desaparece el riesgo de
  tildar dos zonas.
- **El sheet no se llena de zonas** en Opcionales.

### 8.3 La forma

```
PASO · Colocación a domicilio        (opcional)
  Centro INS-001 · ritmo 4 m²/h
  NIVELES  "¿Dónde se coloca?"
    · En taller    extra   30 min · 1 persona
    · Zona 1       extra  120 min · 2 personas
    · Zona 2       extra  270 min · 2 personas

PASO · Diseño gráfico                (opcional)
  Centro PRE-001
  NIVELES  "¿Qué nivel de diseño?"
    · Básico        30 min
    · Intermedio    60 min
    · Profesional  180 min
```

**Nivel y bloque de tiempo fijo no compiten, se complementan**: el bloque es
*qué es* ese tiempo (con su centro y su dotación); el nivel es *qué valor toma*.
En colocación el nivel setea los minutos del bloque extra; en diseño setea el
reloj del trabajo.

**Qué puede pisar un nivel (v1, acotado a propósito)**: el tiempo del trabajo
(fijo o ritmo), los minutos de los bloques extra, y la dotación. **No**:
materiales, máquina ni centro del paso. Se puede ampliar después; al revés no.

**Nombre**: `variante` ya está tomado (variantes de material,
`materialVarianteId`). Se usa **nivel**.

### 8.4 Dónde encaja sin inventar UI

El paso sigue siendo OPCIONAL, y al activarlo el sheet ya abre la card
*"Configurar opcionales activados"* —donde hoy van los materiales, el tiempo
manual y los params del opcional—. **El selector de nivel va ahí**. Cero
pantalla nueva. La elección viaja en el jobContext como
`nivelSeleccionado_<configPasoId>`, mismo patrón que `seleccionModoColor`.

### 8.5 Dónde se DECLARAN — cualquier paso puede tener niveles

Los niveles no son una propiedad del tipo de paso: son un dato del paso. Lo que
cambia es la altura donde se declaran, y son **las mismas tres alturas que ya
usan tiempo fijo, productividad y centro de costo**:

| Altura | Dónde | Para qué | Hoy |
|---|---|---|---|
| 1 · Plantilla del sistema | `familias.ts` | **no va**: la plantilla no sabe cómo se llaman tus zonas ni tus niveles de diseño | — |
| 2 · **Paso del tenant** | `PasoTenant` | **el lugar natural**: "Colocación a domicilio" declara sus 3 zonas una vez y todos los productos heredan | tabla existe, con `centroCostoId`/`productividadHora`/`tiempoFijoMin`, **0 filas** |
| 2b · Defaults por familia | `FamiliaPasoDefaults` | lo mismo para un paso del catálogo del sistema sin instanciar (`diseno_grafico`) | existe y **el motor ya lo lee** |
| 3 · Paso del producto | `ProductoConfigPaso.paramsPasoJson` / `ProductoPasoExtra` | override puntual: "en este producto la Zona 2 tarda más" | existe |

La precedencia es la de siempre
([familia-defaults.ts](../apps/api/src/motor-universal/familia-defaults.ts)):
**config del producto → default del paso/familia → nada**. Y
`resolverFamilia()` (`familias.ts:2123`) ya unifica catálogo del sistema +
registro del tenant, así que el motor lee los niveles de un solo lugar, sin
ramas nuevas.

**Regla de herencia propuesta**: el producto puede **elegir qué niveles ofrece**
(un subconjunto) y **pisar los minutos**, pero **no inventar niveles nuevos** —
si hace falta otro, se agrega en la biblioteca. Así "Zona 2" significa lo mismo
en todos los productos, que es justamente el valor de declararlo arriba.

**Ojo**: `PasoTenant` está vacío en dev. Se puede arrancar declarando los
niveles en la altura 3 (el paso del producto) y subirlos a la biblioteca cuando
se migren los pasos del tenant.

### 8.6 Dos cosas baratas que hay que hacer bien

1. **Congelar el nivel en el snapshot** y llevarlo al nombre de la tarea: la OT,
   el PDF y el tablero tienen que decir "Colocación a domicilio · Zona 2" —
   para el operario no es lo mismo ir a zona 2 que quedarse en el taller.
2. **Mostrar el porqué en el desglose**: "Zona 2 · traslado 4,5 h × 2 pers ×
   $9.800". Es la traza que ningún cargo monetario da.

## 9. Ejemplo completo — "Colocación a domicilio"

Trabajo real: **12 m² de vinilo, colocados en el local del cliente en Vicente
López. Van 2 personas. Viaje ida y vuelta con carga: 1,5 h. Colocan a 4 m²/h.**

### 9.0 Primero el centro de costo

En dev no existe un centro de instalación (están IMP-001/003/005-008, PRE-001,
TER-001, VP-002). Poner la cuadrilla en **Producción & Taller** ($25.175,67/h en
2026-08) sería mentira: esa tarifa tiene máquinas y amortización adentro.

Se crea **INS-001 · Instalación y montaje en obra**, con los sueldos y cargas de
los instaladores y su capacidad en horas-hombre. Supongamos **$9.800/h**.

### 9.1 El paso, una sola ficha

```
PASO · Colocación a domicilio            (trabajo_manual · M-0 · OPCIONAL)

  Centro de costo      Instalación y montaje en obra (INS-001)
  Personas             2
  ¿Cómo se mide?       Ritmo — 4 m² por hora

  TIEMPO EXTRA (no depende de la cantidad)
    • Preparar el trabajo     30 min   — mismo centro
    • Traslado ida y vuelta   90 min   — INS-001 · 2 personas
```

Y la cuenta:

```
trabajo   12 m² ÷ 4 m²/h  = 180 min = 3,0 h × 2 pers × $9.800 = $58.800
extra     30 + 90         = 120 min = 2,0 h × 2 pers × $9.800 = $39.200
                                                                ────────
paso                            300 min (5 h) → ETA            $98.000
```

- **La ETA ve 5 h de cuadrilla**, no 3 — que es lo que realmente se ocupa.
- El desglose muestra **Tiempo $58.800** y **Cargos $39.200**, con las filas
  "Preparar el trabajo · 0,5 h × 2 × $9.800" y "Traslado ida y vuelta · 1,5 h ×
  2 × $9.800": la cuenta a la vista.
- El markup del Tab Precio se aplica sobre los $98.000 como sobre cualquier
  costo. Con 45% → ≈ $178.000.
- Cuando suban los sueldos, **sube solo**: se recalcula la tarifa del centro.

### 9.2 Qué ve cada uno

- **Comercial**: en Opcionales, ☑ Colocación a domicilio. Un solo tilde — el
  traslado va adentro, no hay que acordarse de nada.
- **Producción**: una tarea de 5 h en la estación de instalación. No aparece un
  paso "Traslado" fantasma en el tablero, que es exactamente lo que no se quiere.
- **Después**: el fichaje del paso se compara contra las 5 h estimadas.

## 10. Plan

| Fase | Qué | Toca | Riesgo |
|---|---|---|---|
| **F1** | **Bloques de tiempo fijo del paso**: modelo en `paramsPasoJson`, cálculo por bloque con su centro y su dotación, `totalMin` incluyéndolos, bucket `tiempoFijoTotal`, filas en el desglose bajo "Cargos" | motor (`calcularTiempo`, `tarifasMap`, tipos), `costos-orden.ts`, ficha | medio — golden master |
| **F2** | **La pregunta en el editor**: "Tiempo extra (no depende de la cantidad)" en la ficha del paso, con centro y personas por bloque; y destrabar preparación/cierre en pasos sin máquina (hoy `visible: Boolean(maquinaM1Id)`, `schema.ts:2352`) | `editor-paso/schema.ts`, editor | bajo |
| **F3** | **Mínimo de horas facturables** del paso + traza | motor `:3113`, editor | medio |
| **F4** | **Cargos monetarios** (§7.5): editor en la ficha, monto por paso, dato que pide al comercial, decisión costo/pass-through | editor + sheet + motor | alto |

F1 y F2 juntas resuelven el disparador entero. F3 y F4 son negocio, no plomería.

## 11. Qué no romper

- **Golden master $858.758**: hoy ningún paso tiene setup, tiempo fijo ni cargos
  (0 filas en `ProductoCargoDirectoPaso` en toda la base), así que F1 sólo puede
  moverlo por el refactor del cálculo de tiempo. **Correrlo antes y después.**
- **El doble conteo**: `tiempoFijoOverrideMin` es aditivo en todos los modos
  (`:3113`) y el editor hoy lo **borra** al pasar de fijo a ritmo
  (`schema.ts:1151`) justamente para evitarlo. Al migrarlo a bloque hay que
  respetar esa historia o algún paso cambia de precio solo.
- **`sumCargosPaso`** (`costos-orden.ts:56`) sigue siendo la fuente única del
  desglose de cargos: el bucket nuevo pasa por ahí, no por una cuenta paralela.
- **`duracionEstimadaMin`** (`ordenes-trabajo.service.ts:2131`) es el puente a la
  ETA: si `totalMin` deja de incluir los bloques, la ETA miente.
