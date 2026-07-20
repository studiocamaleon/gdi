# Modificaciones físicas en lona — bolsillos, refuerzos y ojales

**Fecha**: 2026-07-20
**Estado**: diseño cerrado, sin implementar
**Familias involucradas**: `modificacion_pre`, `colocacion_ojales` (nueva), `modificacion_post` (fuera de alcance)

---

## 1. Contexto: de dónde vienen estas familias

`modificacion_pre` y `modificacion_post` se crearon en la Fase E del análisis del motor
([01-tipos-de-paso.md §3.7](motor-por-pasos-analisis/01-tipos-de-paso.md)) como una sub-categoría
nueva de operaciones manuales llamada "Modificaciones físicas". El objetivo declarado era
reemplazar plantillas de máquina viejas (`PERFORADORA`, `REDONDEADORA_PUNTAS`) que no eran
máquinas del catálogo sino operaciones con herramientas auxiliares.

La razón de fondo de que sean **dos** familias y no una es una distinción del motor:

| | `modificacion_pre` | `modificacion_post` |
|---|---|---|
| Momento | antes de los pasos de producción | después |
| Efecto | **MUTA el JobContext** (medidas físicas) | sólo escribe outputs nuevos |
| Output canónico declarado | `mutacion_aplicada` | `piezas_modificadas` |

El caso fundacional documentado es la lona con bolsillos
([02-anatomia-de-un-paso.md §5](motor-por-pasos-analisis/02-anatomia-de-un-paso.md)): el cliente
pide 2000×3000mm de área visible, pero para hacer los bolsillos hay que imprimir 2000×**3200**.
Si el paso PRE no muta `altoMm`, todos los pasos posteriores (impresión, nesting, material)
cotizan de menos.

De ahí salió la distinción **MUTABLE vs INMUTABLE** del JobContext
([03-catalogo-y-trazabilidad.md §1](motor-por-pasos-analisis/03-catalogo-y-trazabilidad.md)) y la
**sub-tarea (i) del bucle del motor**
([04-modelo-conceptual-motor.md §2](motor-por-pasos-analisis/04-modelo-conceptual-motor.md)):
*"(Solo pasos PRE) MUTAR valores MUTABLES del JobContext"*.

### Estado real hoy: cáscaras declaradas

Auditoría de código (2026-07-20):

- **La sub-tarea (i) nunca se implementó.** No hay ninguna línea en `motor.service.ts` que mute
  medidas por un paso PRE. El `jobContext` es mutable (`motor.service.ts:436`) y los outputs
  canónicos se mergean (`:535`), pero eso es el mecanismo genérico G-M2, no la mutación de medidas.
- **Ninguno de los dos outputs existe.** `mutacion_aplicada` y `piezas_modificadas` sólo aparecen
  declarados en `familias.ts:1508` y `:1545`. `outputs-canonicos.ts` no tiene rama para ninguno →
  caen al `return null` defensivo del final.
- **Los `subTipo` no hacen nada.** Los 4 sub-tipos de PRE y los 5 de POST están declarados como
  enum en `paramsPasoSchema` y se renderizan como dropdown en el editor, pero el motor los ignora.
  Elegir `bolsillo_lona` o `dobladillo` produce exactamente el mismo cálculo.
- **`modificacion_post` funciona a medias, y alcanza.** Está en el mapeo de
  `HEREDAR_DEL_OUTPUT_CANONICO` → `piezas_cortadas` (`motor.service.ts:339`) y soporta el
  multiplicador `cantidadModificacionesPorPieza`. Hoy se comporta como un `trabajo_manual` genérico
  con un dropdown decorativo, y para redondeo/perforación eso es suficiente por ahora.
- **`modificacion_pre` es la que está realmente vacía.** Su única razón de existir —mutar medidas—
  es lo único que falta.
- Los materiales ya existen: subfamilia `ojal_ojalillo_remache` con template en
  `materia-prima-templates.ts:870`.

---

## 2. Alcance de este diseño

**Dentro**: los 3 casos típicos de la industria de la lona.

1. **Bolsillos** — típicamente lados horizontales, a veces también verticales.
2. **Refuerzos** — bolsillo pegado para reforzar el perímetro, normalmente los 4 lados.
3. **Ojales** — cantidad derivada del perímetro según separación configurada + tipo de ojal.
   Frecuentemente requieren refuerzo previo (dos modificaciones encadenadas).

**Fuera** (postergado, no descartado): `modificacion_post` de redondeo de puntas, perforación,
numeración, aplicación de pegamento/velcro. Hoy funcionan como trabajo manual genérico y no
bloquean nada.

### Decisiones de negocio confirmadas

| Pregunta | Respuesta | Consecuencia de diseño |
|---|---|---|
| ¿El refuerzo es tira separada o la misma lona doblada? | **Misma lona doblada** | Es una mutación de medida, no un consumo de material por metro lineal aparte. Simplifica mucho. |
| ¿La demasía se imprime o va en blanco? | **Se imprime igual** | No hay que modelar cobertura de tinta diferencial. El área mutada vale para material, tiempo de máquina y tinta por igual. |
| ¿El cliente pide medida visible o final? | **Visible** ("una lona de 150×100 para colgar") | La demasía **se suma**. La dirección de la mutación es `+=`. |

---

## 3. El framework: una sola primitiva

Bolsillo y refuerzo no son dos operaciones distintas. Son la misma primitiva con parámetros
distintos:

> **`modificacion_pre` = demasía perimetral selectiva + unión (soldar/pegar) medida en metros lineales**

| | Bolsillo | Refuerzo |
|---|---|---|
| Lados típicos | horizontales (sup+inf); a veces verticales | los 4 |
| Demasía típica | 100–150mm (tiene que entrar el caño) | 30–50mm |
| Unión | soldar/pegar a lo largo del lado | ídem |
| Material extra | ninguno (misma lona doblada) | ninguno |

Los parámetros reales del paso son **`lados[]` + `demasiaMm`**. El `subTipo` deja de ser un enum
decorativo y pasa a ser un **preset**: precarga valores por defecto y nombra el paso en la OT
("Bolsillo superior e inferior 10cm"), pero no cambia la lógica.

### Regla de oro: qué mide cada cosa

Esta es la convención central del diseño y hay que respetarla en todo el motor:

```
┌──────────────────────────────────────────────────────────────────────┐
│  La demasía muta la medida de MATERIAL.                              │
│  Las operaciones (soldadura, ojales) se miden sobre la medida        │
│  VISIBLE.                                                            │
└──────────────────────────────────────────────────────────────────────┘
```

Justificación física: la costura corre a lo largo del borde terminado, y el ojal se coloca cerca
del borde terminado. Ninguno de los dos "crece" con la demasía. El material sí.

Corolario: **la medida visible tiene que sobrevivir todo el pipeline**, no sólo hasta el primer
paso PRE. Es un valor inmutable del JobContext, al mismo nivel que `cantidad` y la variante.

### Encadenamiento

Como el motor procesa pasos en orden y el `jobContext` ya es mutable, encadenar dos PRE funciona
solo: el segundo lee lo que mutó el primero. La arquitectura ya estaba bien pensada; falta la
sub-tarea (i).

```
Cliente pide 1500 × 1000 (visible)   ← se congela acá
  ↓ PRE refuerzo, lados=[sup,inf,izq,der], demasia=40mm
anchoMm: 1500 → 1580     altoMm: 1000 → 1080
  ↓ POST ojales, cada 50cm, 4 lados   ← lee el perímetro VISIBLE (1500×1000)
10 ojales
  ↓ impresión / nesting / material leen 1580 × 1080
```

---

## 4. Los tres casos, resueltos numéricamente

### Caso A — Banner con bolsillos para caño

Cliente: lona 1500×1000mm visible, bolsillo superior e inferior de 100mm.

```
Medida visible (congelada):  1500 × 1000       = 1.50 m²
PRE bolsillo, lados=[superior, inferior], demasiaMm=100
  altoMm: 1000 → 1200
  anchoMm: 1500 (sin tocar)
Medida de material:          1500 × 1200       = 1.80 m²   ← lo que va a nesting

Metros lineales de unión = 2 lados × 1500mm (ancho VISIBLE) = 3.00 ml
Tiempo = 3.00 ml ÷ productividad (ml/h) del paso
```

El delta de material es 20% — exactamente el sub-cobro silencioso que el paso PRE existe para
evitar.

### Caso B — Lona con refuerzo perimetral y ojales

Cliente: lona 1500×1000mm visible, refuerzo 40mm en los 4 lados, ojales cada 50cm.

```
Medida visible (congelada):  1500 × 1000
PRE refuerzo, lados=[los 4], demasiaMm=40
  anchoMm: 1500 → 1580
  altoMm:  1000 → 1080
Medida de material:          1580 × 1080       = 1.71 m²

Metros lineales de unión = perímetro VISIBLE = 2 × (1500 + 1000) = 5.00 ml

POST ojales, separacionMaxMm=500, lados=[los 4], sobre perímetro VISIBLE:
  Horizontales (1500): ceil(1500/500) = 3 tramos → 2 intermedios c/u → 4
  Verticales   (1000): ceil(1000/500) = 2 tramos → 1 intermedio  c/u → 2
  Esquinas (compartidas entre lados adyacentes)                     → 4
                                                              TOTAL = 10 ojales
```

### Caso C — Ojales sólo en los verticales

Mismo paño, ojales sólo en los lados verticales. Sin lados adyacentes seleccionados, no hay esquina
compartida: cada lado cuenta sus dos extremos.

```
Verticales (1000): ceil(1000/500) + 1 = 3 ojales por lado × 2 lados = 6 ojales
```

### La fórmula general de ojales

No alcanza con "perímetro ÷ separación". Hay que resolver el problema de los postes de cerca y la
compartición de esquinas. Algoritmo:

1. Para cada lado seleccionado de largo `L`, con separación máxima `S`:
   - `tramos = ceil(L / S)` (así la separación real ≤ S y queda repartida pareja)
   - posiciones = `tramos + 1` puntos equidistantes, **incluyendo ambos extremos**
2. Unir las posiciones de todos los lados seleccionados en coordenadas del perímetro.
3. **Deduplicar las esquinas** compartidas por dos lados adyacentes ambos seleccionados.

Esto es general y correcto para cualquier subconjunto de lados, y evita tener dos fórmulas
(perímetro cerrado vs. lados sueltos). El "cada X cm" se interpreta como **máximo**, no como valor
exacto: se reparte parejo sin superar esa distancia, que es la práctica de taller.

---

## 5. Contratos y modelo de datos

### 5.1 JobContext — campos nuevos

```ts
interface JobContext {
  // ... existente ...

  /**
   * INMUTABLE. Medida que pidió el cliente, congelada antes del primer paso
   * PRE. Las operaciones (soldadura, ojales) se miden sobre esto, no sobre
   * las medidas mutadas. Sobrevive hasta la OT y el seguimiento público.
   */
  medidaVisibleMm?: { anchoMm: number; altoMm: number };
  piezasVisibles?: Array<{ cantidad: number; anchoMm: number; altoMm: number }>;

  /**
   * Traza acumulada de mutaciones aplicadas por pasos PRE. Se APPENDEA, no se
   * sobrescribe (ver §6.2 — riesgo del merge de outputs canónicos).
   */
  mutacionesAplicadas?: MutacionAplicada[];
}

interface MutacionAplicada {
  rutaPasoId: string;
  nombrePaso: string;
  subTipo: string;
  lados: LadoPieza[];
  demasiaMm: number;
  /** Demasía total por eje (demasiaMm × lados de ese eje). */
  deltaAnchoMm: number;
  deltaAltoMm: number;
  /** Metros lineales de unión, medidos sobre la VISIBLE. */
  metrosLinealesUnion: number;
  /** Antes/después POR PIEZA — un solo item en el caso típico de lona. */
  piezas: Array<{
    antes: { anchoMm: number; altoMm: number };
    despues: { anchoMm: number; altoMm: number };
  }>;
}

type LadoPieza = 'superior' | 'inferior' | 'izquierdo' | 'derecho';
```

### 5.2 `modificacion_pre` — params reales

```ts
paramsPasoSchema: [
  { campo: 'subTipo',     tipo: 'enum', valoresPermitidos: ['bolsillo', 'refuerzo'],
    etiqueta: 'Tipo de modificación', requerido: true },
  { campo: 'lados',       tipo: 'multi-enum',
    valoresPermitidos: ['superior', 'inferior', 'izquierdo', 'derecho'],
    etiqueta: 'Lados afectados', requerido: true },
  { campo: 'demasiaMm',   tipo: 'number', etiqueta: 'Demasía por lado (mm)', requerido: true },
]
```

Cambios respecto de lo declarado hoy:

- Sub-tipos `dobladillo` y `ojales_con_margen` **se retiran**. `dobladillo` es un `refuerzo` con
  otra demasía. `ojales_con_margen` mezclaba dos operaciones que ahora son dos pasos.
- `mecanismosCantidadSoportados`: **`CALCULADO_POR_PASO`** (+ `DIRECT_FROM_JOBCONTEXT` como
  fallback). `DIRECT_FROM_JOBCONTEXT` no servía: pese a lo que dice su comentario, en el motor está
  cableado duro a `jobContext.cantidad` y no lee un campo arbitrario. `CALCULADO_POR_PASO` describe
  exactamente lo que pasa —el paso calcula sus propios metros lineales de unión— y el dispatcher de
  nesting devuelve `null` para esta familia, así que la rama nueva queda alcanzable.
- `modosTiempoSoportados`: `T-1` (fijo) o `T-2` con productividad en **ml/h**.
- `tipo: 'multi-enum'` es un valor nuevo de `TipoParamsPaso`. `paramsPasoSchema` hoy es
  **documentación**: lo consume sólo la ficha de capacidades de familias, no hay un editor
  genérico que lo renderice como formulario (por eso la etapa D es UI a medida, no un tipo nuevo).

**Outputs canónicos**:

| Output | Tipo | Para qué |
|---|---|---|
| `metros_lineales_union` | number | Driver de tiempo (T-2) y de consumibles si los hubiera |
| `mutacion_aplicada` | boolean | Sólo para validaciones `EXISTS_OUTPUT`. La traza rica vive en `jobContext.mutacionesAplicadas` |

**Un PRE activo pero mal configurado corta la cotización** (`modificacion_pre_mal_configurada`,
severidad ERROR). Sin lados o sin demasía, la medida de material no se agranda y el trabajo se
cobra de menos **en silencio** — justo lo que esta familia existe para evitar. Es un error de
modelado: aparece la primera vez que el modelador prueba el producto.

### 5.3 `colocacion_ojales` — familia nueva

**Por qué familia propia y no un `subTipo` de `modificacion_post`.** Necesita un mecanismo de
cantidad que hoy no existe (derivado del perímetro) y params propios que el editor tiene que poder
renderizar. Esconderlo detrás de un dropdown repite exactamente el error que este diseño corrige:
un enum decorativo que el motor ignora.

```ts
const colocacion_ojales: DefinicionFamilia = {
  codigo: 'colocacion_ojales',
  nombre: 'Colocación de ojales',
  categoria: 'operaciones_manuales',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-1', 'T-2'],          // T-2 con productividad en ojales/h
  mecanismosCantidadSoportados: ['CALCULADO_POR_PASO', 'DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OPCIONAL'],
  slotsRequeridos: ['ojal'],                       // subfamilia ojal_ojalillo_remache
  outputsCanonicos: ['ojales_colocados'],
  paramsPasoSchema: [
    { campo: 'separacionMaxMm', tipo: 'number', etiqueta: 'Separación máxima entre ojales (mm)',
      requerido: true },
    { campo: 'lados', tipo: 'multi-enum',
      valoresPermitidos: ['superior', 'inferior', 'izquierdo', 'derecho'],
      etiqueta: 'Lados con ojales', requerido: true },
    { campo: 'esquinasSiempre', tipo: 'boolean', etiqueta: 'Ojal en cada esquina',
      requerido: false },   // default true
  ],
};
```

`CALCULADO_POR_PASO` ya existe como mecanismo (`pasos/types.ts`, hoy lo usa el nesting). Se le
agregó una segunda estrategia: cálculo por perímetro.

**Semántica de `esquinasSiempre: false`**: los lados llevan sólo los ojales INTERMEDIOS
(`tramos − 1` por lado) y no hay esquinas que descontar, porque ningún lado aporta sus extremos.
Sobre 1500×1000 cada 500mm en los 4 lados da 6 ojales en vez de 10.

**Un paso de ojales mal configurado también corta la cotización**
(`colocacion_ojales_mal_configurada`): sin separación ni lados la cantidad sale 0 y el paso no
cobra nada, el mismo silencio que evita la guarda de `modificacion_pre`.

Sumar la familia obligó a tocar dos guardas del catálogo: el union `FamiliaCodigo` y los tests que
fijan el total de familias (41 → 42).

---

## 6. Impacto en el motor

### 6.1 Sub-tarea (i): la mutación

Se inserta en el loop de `cotizar` (`motor.service.ts:~505`), después de ejecutar el paso y antes
de mergear outputs. Sólo para familia `modificacion_pre`.

Tiene que mutar **dos caminos**, porque el JobContext tiene dos representaciones de la medida:

- `jobContext.medidaCustomMm` — el camino de medida única
- `jobContext.piezas[]` — el camino multi-pieza que alimenta el nesting

Hoy `piezas[]` se sintetiza desde `medidaCustomMm` al inicio (`motor.service.ts:458`), así que en
la práctica **siempre existe `piezas[]`**. La mutación tiene que aplicarse **por pieza** (cada paño
lleva sus propios bolsillos) y reflejarse en ambos.

```
Para cada pieza:
  si lados incluye 'superior'  → altoMm  += demasiaMm
  si lados incluye 'inferior'  → altoMm  += demasiaMm
  si lados incluye 'izquierdo' → anchoMm += demasiaMm
  si lados incluye 'derecho'   → anchoMm += demasiaMm
```

### 6.2 Riesgo: el merge de outputs pisa la traza

El merge de outputs canónicos hace `jobContext[key] = value` (`motor.service.ts:537`). Si la traza
de la mutación viajara como output canónico, **un segundo paso PRE pisaría la del primero** y
perderíamos el historial (justo el caso "refuerzo + bolsillo" o "refuerzo + ojales").

Por eso `mutacionesAplicadas` es un array que se **appendea** aparte del mecanismo de outputs, y el
output canónico `mutacion_aplicada` queda como booleano sólo para validaciones.

### 6.3 Riesgo: las métricas derivadas quedan desactualizadas

**Este es el hallazgo más importante de la auditoría.**

`piezaAreaTotalM2` y `piezaPerimetroTotalM` se calculan **una sola vez, en el frontend**
(`agregar-producto-sheet.tsx:2253`) a partir de las piezas que cargó el comercial — es decir, la
medida visible, antes de cualquier mutación. El backend tiene el helper
`calcularPerimetroPiezasM` (`job-context-metrics.ts`) pero **nada lo vuelve a llamar durante el
loop**.

Consecuencia: si un paso PRE muta `piezas[]` y no recalculamos, cualquier paso posterior que lea
esas métricas (refilado, corte manual, cargos por m²) trabaja con números viejos.

Regla a implementar, después de cada mutación:

| Métrica | Se recalcula sobre | Por qué |
|---|---|---|
| `piezaAreaTotalM2` | medida **mutada** | Es material consumido |
| `piezaPerimetroTotalM` | medida **mutada** | Es corte del paño real |
| Perímetro para ojales / soldadura | medida **visible** | Regla de oro §3 — se lee de `piezasVisibles`, no de esta métrica |

La tercera fila es la razón por la que ojales **no puede** simplemente leer `piezaPerimetroTotalM`.
Necesita su propio cálculo sobre `piezasVisibles`.

### 6.4 Orden de pasos en la ruta

El modelador tiene que poner los PRE antes de impresión. Hoy el orden es responsabilidad suya
(lista ordenada, no DAG con dependencias declaradas). Propuesta mínima: **validación en el editor**
que avise si un `modificacion_pre` quedó después de un paso de impresión o corte, porque en ese
caso la mutación no llega a nadie y el costo sale mal en silencio.

Caso borde conocido: bolsillo en los 4 lados + refuerzo en los 4 lados duplicaría demasía. Es
responsabilidad del modelador; la traza de §5.1 lo deja visible en el desglose.

**Implementado en la etapa D**: el editor marca con warning el `modificacion_pre` que quedó después
de una familia de producción que lee medidas (impresión, cortes, laminado, CNC), y con ERROR los
params faltantes que el backend rechazaría al cotizar — se ven al configurar, no al cotizar.

El renderer de params es **genérico, guiado por `paramsPasoSchema`**, pero **opt-in por familia**
(`FAMILIAS_CON_PARAMS_EDITABLES` en `src/lib/params-familia.ts`). Volverlo automático para las 42
familias expondría params que el motor NO lee —`tipoPliegue` no lo lee nadie— y duplicaría
controles en las tres familias que ya tienen UI a medida (`pre_prensa`,
`montaje_sobre_sustrato`, `diseno_grafico`). Se suma una familia a la lista recién cuando se
verificó que el motor consume sus params.

---

## 7. Journey

### Modelador (arma el producto "Lona con ojales")

1. Crea la ruta: `modificacion_pre` → `impresion_por_area` → `corte_manual` → `colocacion_ojales`
   → `embalaje`.
2. En el paso PRE elige preset **Refuerzo**, lados **los 4**, demasía **40mm**, productividad
   **12 ml/h**. Lo deja OPCIONAL.
3. En `colocacion_ojales` configura separación máxima **500mm**, lados **los 4**, esquinas
   siempre, slot de material apuntando a la variante de ojal, productividad **60 ojales/h**.
4. El editor le avisa si el PRE quedó después de la impresión.

### Comercial (cotiza)

1. Carga la lona: **1500 × 1000**, cantidad 1. Es la medida que le dictó el cliente.
2. Activa los opcionales "Refuerzo perimetral" y "Ojales".
3. Ve en el desglose, explícito:
   - `Medida pedida: 1500 × 1000 mm (1.50 m²)`
   - `Medida de material: 1580 × 1080 mm (1.71 m²) — +40mm por refuerzo en 4 lados`
   - `Refuerzo perimetral: 5.00 ml de soldadura`
   - `Ojales: 10 unidades (cada 500mm, 4 lados)`
4. La cotización al cliente muestra **1500 × 1000**. La demasía es costo interno, no una medida
   que el cliente reconozca.

### Producción (OT y tablero)

1. La OT muestra **las dos medidas**: la spec `Medida de corte` se genera en `buildOrdenItemSpecs`
   junto a `Medidas` y se persiste al emitir, así que el detalle de la OT la muestra rotulada.
2. El paso de refuerzo aparece con sus metros lineales; el de ojales con la cantidad y el tipo.
3. El seguimiento público al cliente muestra sólo la medida visible.

**Dos decisiones de la etapa F que no estaban en el diseño original:**

- **El resumen de la tarjeta del tablero une valores SIN etiqueta** (los primeros 3, con `·`).
  Meter ahí la medida de corte dejaba dos medidas sueltas sin rótulo y el operario no sabría cuál
  cortar — peor que no mostrarla. Se excluye del resumen y se muestra aparte, rotulada
  (`Cortar 158 × 108 cm`), en el panel del item, que es donde el operario abre antes de trabajar.
- **El filtro del seguimiento público es de BACKEND**, en `trackingPublico`
  (`tracking-publico-specs.ts`), no del front. Ese endpoint es `@Public()` y sin sesión: es el
  límite real, y su propio contrato dice que devuelve "sólo la proyección cliente-facing".
  Verificado end-to-end inyectando la spec en la DB y confirmando que no sale por la API.

---

## 8. Etapas de implementación

| Etapa | Contenido | Riesgo |
|---|---|---|
| **A. Contrato** ✅ | `medidaVisibleMm` / `piezasVisibles` congeladas al inicio del loop; `mutacionesAplicadas[]`; recálculo de `piezaAreaTotalM2` y `piezaPerimetroTotalM` tras cada mutación (§6.3) | Bajo. Aditivo, sin cambio de comportamiento si no hay pasos PRE. |
| **B. Sub-tarea (i)** ✅ | Mutación real en `modificacion_pre`: `lados[]` + `demasiaMm`, por pieza y en ambos caminos; output `metros_lineales_union`; tiempo T-2 en ml/h; retiro de sub-tipos muertos | Medio. Toca el loop del motor. Cubrir con tests antes. |
| **C. Ojales** ✅ | Familia `colocacion_ojales`; estrategia de cantidad por perímetro en `CALCULADO_POR_PASO` con dedupe de esquinas; slot de material; output `ojales_colocados` | Medio. La fórmula necesita tests propios (§4). |
| **D. Editor** ✅ | Render de `multi-enum` para `lados`; presets de subTipo; validación de orden (§6.4) | Bajo. |
| **E. Cotizador** ✅ | Desglose con medida pedida vs. material y el detalle de cada modificación | Bajo. |
| **F. OT / producción** ✅ | Doble medida en la OT y el tablero; medida visible en el seguimiento público | Bajo. |
| **G. Tests** | Casos A, B y C de §4 end-to-end; encadenamiento de dos PRE; recálculo de métricas; multi-pieza | — |

Etapas A–C son el núcleo; D–F son la superficie. A es prerequisito de todo.

---

## 8.b Verificación en la app (2026-07-20)

Verificado end-to-end contra la app corriendo, con una ruta de prueba sobre **Lona Frontlight**
(`modificacion_pre` → `impresion_por_area` → `colocacion_ojales`) y una lona de **150 × 100 cm**:

| Qué | Resultado |
|---|---|
| Editor: params de ambas familias | Renderizan (enum, multi-enum, number, boolean con su default) |
| Editor: preset de `subTipo` | Elegir "Bolsillo" tildó Superior+Inferior y cargó 100 mm |
| Editor: validaciones nuevas | "Sin lados afectados" / "Sin demasía por lado" aparecen y se limpian al completar |
| Editor: filtro del slot `ojal` | Sin ojales en inventario decía "sin materias primas compatibles"; al cargar uno lo ofreció |
| Motor: mutación | `Cantidad cotizada 1,8 m²` (pedida 1,5 m² + bolsillo sup/inf de 100 mm) |
| Motor: ojales | Material $350 = **10 ojales** × $35 — el número del caso B |
| Cotizador: chip | "📐 agranda la medida" en la fila del paso |
| Cotizador: bloque | "Pedida 150 × 100 cm → material **150 × 120 cm** (+20% de material)" y "3 ml de unión" |
| OT: doble medida | Specs muestran `MEDIDAS 150 x 100 cm` y `MEDIDA DE CORTE 150 × 120 cm` |
| Tracking público | La spec de corte NO sale por la API (verificado inyectándola en la DB) |

No hizo falta corregir nada del código: los tres números del diseño (1,8 m² · +20% · 3 ml · 10
ojales) salieron correctos a la primera.

## 8.c Overlay en el dibujo de nesting (2026-07-20)

El `NestingViewer` superpone sobre cada pieza la **franja de demasía** y la **ubicación de los
ojales**, para que el taller vea qué parte se dobla y dónde va cada ojal. Como
`PropuestaFicha` es también el detalle de la OT en producción, un solo componente cubre cotizador
y taller.

- **Las posiciones salen del MOTOR** (`ojalesLayout` en `PasoEjecutado`), no se recalculan en el
  front: si el reparto cambia, el dibujo cambia con él. Por eso
  `calcularPosicionesOjales` pasó a ser la primitiva y la cantidad se deriva
  (`calcularOjalesPorPieza` = `posiciones.length`). De paso el dedupe de esquinas dejó de ser una
  resta aparte: se unen las posiciones de cada lado y se deduplican por coordenada.
- **La demasía se acumula por LADO** (`demasiaPorLado`), no por eje: un bolsillo sólo arriba no se
  dibuja igual que uno repartido arriba y abajo, y `deltaAnchoMm`/`deltaAltoMm` no distinguen.
- **Rotación**: el nesting puede girar la pieza 90° para que entre en el rollo, así que la franja
  se traduce a los lados dibujados (`demasiaDibujada`) y los puntos se rotan con ella. En los
  casos reales —bolsillo (arriba+abajo) y refuerzo (los 4)— la demasía es simétrica por eje, así
  que el sentido de giro no cambia el dibujo.
- **Colisión de nombres**: la leyenda del visor YA tenía un chip "Demasía" que significa el
  **sangrado de impresión** (`pieceBleedMm`). Para no llamar dos cosas distintas igual, la de
  modificaciones se rotula **"Bolsillo / refuerzo"**.
- La geometría vive en `src/lib/nesting-overlay.ts` con tests propios; el componente sólo dibuja.
- **El ojal se centra en la banda del refuerzo.** Al doblarse hacia atrás, un refuerzo de 20 mm
  deja sobre la pieza terminada una banda reforzada de 20 mm medida hacia adentro desde el borde;
  el ojal va al medio de esa banda, o sea a 10 mm. La regla **escala sola** con cualquier tamaño
  de refuerzo y no hay nada que configurar. `distanciaBordeMm` (default 10) quedó sólo como
  fallback para los lados SIN refuerzo.
  - Es la posición REAL, no un ajuste del dibujo, así que la calcula el motor.
  - **El inset es por LADO**: el paso de ojales lee la demasía acumulada de los pasos PRE
    (`demasiaAcumuladaPorLado`). Con bolsillo de 100 mm arriba y refuerzo de 40 mm al costado, el
    ojal de esquina queda a 50 mm en vertical y 20 mm en horizontal — cada eje centrado en la
    banda de su propio lado.
  - El sentido del corrimiento se deduce de qué bordes toca el punto, no del lado que lo generó:
    una esquina se corre en diagonal y un ojal a mitad de lado en un solo eje.
  - Se deduplica **antes** de correr, así la esquina compartida sigue contando una sola vez, y la
    separación se sigue midiendo **sobre el borde**: sólo se mueve el punto de perforado.

**Pendiente — piezas paneleadas.** Cuando una lona no entra en el ancho del rollo, el nesting la
parte en paneles y cada placement es una tajada; la franja y los ojales pertenecen al perímetro de
la pieza ARMADA, no al de cada panel. `overlayAplicable()` devuelve false con `panelCount > 1` y
el overlay no se dibuja: preferimos no mostrar nada antes que mostrar franjas y ojales sobre las
líneas de unión interiores. Falta mapear paneles a pieza lógica.

## 9. Decisiones tomadas

1. Bolsillo y refuerzo son **la misma primitiva** con parámetros distintos, no dos lógicas.
2. La demasía muta la medida de **material**; soldadura y ojales se miden sobre la medida
   **visible** (§3).
3. La medida visible es **inmutable** y sobrevive hasta la OT y el seguimiento público.
4. Ojales es **familia propia**, no un `subTipo` de `modificacion_post`.
5. La separación de ojales es un **máximo**, se reparte pareja, y las esquinas **siempre** llevan
   ojal (configurable, default true).
6. Se retiran los sub-tipos `dobladillo` (es un refuerzo) y `ojales_con_margen` (eran dos pasos).
7. `modificacion_post` de redondeo/perforación/numeración queda **como está** — funciona como
   trabajo manual genérico y no bloquea nada.

## 10. Abierto para más adelante

- **Refuerzo como tira separada pegada.** Confirmado que hoy es siempre doblez de la misma lona.
  Si aparece el caso de tira aparte, no es una mutación: es consumo de material por metro lineal y
  necesita otra rama.
- **Demasía sin imprimir.** Confirmado que hoy se imprime igual. Si algún día se deja en blanco,
  habría que separar área de material de área de tinta.
- **Ojales en posiciones custom** (no equiespaciados) — no apareció como necesidad real.
- **`modificacion_post`**: redondeo de puntas, perforación, numeración, velcro.
- **Colisión conceptual con `visualConfig.margins`.** El margen de nesting y la demasía de
  modificación son cosas distintas (uno es desperdicio de acomodado, el otro es producto que el
  cliente recibe) pero ambos agrandan el área. Vale revisar que no se sumen dos veces cuando el
  mismo producto use los dos.
