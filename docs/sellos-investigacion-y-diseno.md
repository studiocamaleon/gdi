# Sellos (automáticos y manuales) — Investigación y diseño

**Fecha:** 2026-07-10
**Estado:** IMPLEMENTADO 2026-07-10 — inventario (familia `SELLOS` + goma laserable,
manual y biblioteca Colop/Trodat/Nykon). Pendiente: producto comercial/ruta y la
investigación de accesorios/almohadillas.
**Objetivo:** poder cargar sellos y sus insumos (goma laserable) en inventario —
manual y desde biblioteca (Colop, Trodat, Nykon)— y configurar la ruta de
producción del sello.

---

## 1. Estado actual — qué existe y qué falta

### Lo que YA existe (buena noticia: la producción está cubierta)

La ruta típica del sello —(1) armar el archivo del polímero → (2) grabar el
polímero con láser (o crearlo a mano) → (3) montar el polímero en el cuerpo—
**ya tiene familias de paso para cada etapa**. No hay que crear familias de paso
nuevas.

| Etapa del sello | Familia de paso existente | Máquina / tiempo |
|---|---|---|
| Armar archivo del polímero | `pre_prensa` (T-1) o `diseno_grafico` | M-0 manual |
| Grabado láser del polímero | **`grabado_laser`** (ya existe) | M-1 `CORTE_LASER`, **T-4 tiempo manual del comercial** |
| Creación manual del cliché (alternativa) | `trabajo_manual` | M-0 manual |
| Montaje del polímero en el cuerpo | `montaje_sobre_sustrato` / `ensamble_estructural` / `trabajo_manual` | M-0/M-1 |

Detalles clave que encajan perfecto:

- **`grabado_laser`** (`apps/api/src/productos-servicios/pasos/familias.ts:520`)
  ya existe, usa la plantilla de máquina `CORTE_LASER` y su slot `sustrato`
  acepta `MP.sustratoGrabable`.
- La máquina **CORTE_LASER** está modelada con **T-4 (input manual del
  comercial)**: su perfil no tiene productividad automática porque el tiempo de
  grabado depende del diseño. Esto es exactamente la feature de **tiempo manual
  por paso** que acabamos de terminar (`docs/tiempo-manual-por-paso-diseno.md`):
  el comercial ingresaría los minutos de láser al cotizar, obligatorio.
- El **centro de costo `TER-001` "Grabado/Corte Laser"** ya existe ($8.930,71/h,
  cortadora láser 130×90) y aún no lo usa ningún paso — es el centro natural del
  grabado del sello (ver `docs/centros-de-costo-snapshot-2026-07.md`).

**Conclusión de tu intuición: correcta.** Las familias de paso cubren la ruta.
Falta la capa de **materiales** (cargar el sello y la goma laserable) y la capa
de **producto comercial** (una subcategoría "sellos").

### Lo que FALTA (el gap)

1. **No hay familia/subfamilia de materia prima para sellos ni goma laserable.**
   Verificado en la base viva: el inventario solo tiene sustratos, tintas,
   transfers, imanes y componentes editoriales. Ni "sello", ni "cuerpo de sello", ni
   "goma laserable", ni "polímero laserable" existen.
2. **No hay categoría/subcategoría comercial "sellos"** para dar de alta el
   producto que se vende y cotiza.

---

## 2. Cómo se modela hoy una materia prima (el framework a respetar)

Antes de proponer, el modelo que hay que seguir:

- Toda materia prima (MP) tiene campos base (código, nombre, **familia**,
  **subfamilia**, **tipoTecnico**, unidades) + un **`templateId`** que apunta a
  una **plantilla** definida en TS (`src/lib/materia-prima-templates.ts`, hoy 32
  plantillas). La plantilla describe:
  - `camposTecnicos`: los atributos de la MP (`key`, `label`, `type`
    text/number/boolean, `unit` canónica, `options` para selects).
  - `dimensionesVariante`: el subconjunto de campos que diferencian una variante
    de otra (forma la matriz de variantes).
  - `atributosIniciales`: valores por defecto al crear a mano.
- La **variante** (`MateriaPrimaVariante`) es la unidad real de inventario,
  precio y consumo en producción. Sus valores viven en `atributosVarianteJson`.
- **Reglas de plantilla** (se validan al compilar): las `key` NO llevan sufijo
  de unidad (es `ancho` + `unit:"mm"`, nunca `anchoMm`), y `ancho` va antes que
  `alto`.
- **Familias y subfamilias son enums de Prisma** (15 familias / 44 subfamilias),
  sincronizados en 5 lugares (tipos front, enum Prisma, DTO API, labels UI, y
  `MP` de compatibilidad de slots). **Agregar una familia/subfamilia nueva
  requiere migración** — es el mismo tipo de cambio que ya hiciste antes.
- **Biblioteca**: presets pre-cargados en BD (`MaterialPreset`, seed
  `material-presets.js`, ~60 presets). El usuario "instala" un preset y el
  sistema le crea la MP + variantes copiando familia/subfamilia/templateId. Acá
  vivirían **Colop / Trodat / Nykon** como presets instalables.

---

## 3. El dominio del sello — qué entidades hay que cargar

Un sello no es una sola cosa. Al fabricarlo intervienen **2 insumos de
inventario** (+1 opcional) y **1 producto comercial**:

### A. Cuerpo del sello (materia prima) — "el sello" que mencionás

Es el modelo de sello (Colop Printer 30, Trodat Printy 4911, mango de madera,
etc.). **Acá viven el tamaño de polímero y las líneas de texto** que pediste:
son propiedades intrínsecas del modelo. Dos tipos:

- **Automático** (autoentintable): carcasa plástica con almohadilla integrada.
- **Manual** (tradicional): mango de madera/plástico, se usa con almohadilla
  aparte.

**Características mínimas necesarias:**

| Campo | Tipo | Obligatorio | Nota |
|---|---|---|---|
| `marca` | select (Colop / Trodat / Nykon / Otro) | sí | |
| `modelo` | text ("Printer 30", "Printy 4911", "R-40") | sí | marca+modelo = identidad de variante |
| `tipo` | select (automatico / manual) | sí | |
| `anchoPolimero` | number (mm) | sí | **tamaño de polímero que hace** — ventana del cliché |
| `altoPolimero` | number (mm) | sí | (ancho antes que alto, regla canónica) |
| `lineasTexto` | number | sí | **cantidad de líneas de texto máx.** |
| `forma` | select (rectangular / redondo / ovalado) | opcional | redondo usa diámetro; default rectangular |
| `colorCarcasa` | text | opcional | cosmético (automáticos) |
| `almohadillaIncluida` | boolean | opcional | los automáticos la traen |

Unidad de stock: `unidad`.

### B. Goma laserable / polímero (materia prima, insumo) — se consume por área

La plancha de goma/fotopolímero que se graba con láser y se corta al tamaño del
polímero. Se consume **por área** (el tamaño de polímero del sello determina
cuánto se gasta).

**Características mínimas necesarias:**

| Campo | Tipo | Obligatorio | Nota |
|---|---|---|---|
| `marca` | text | opcional | |
| `color` | select (Rojo / Verde / Gris / Otro) | sí | color de la goma |
| `espesor` | number (mm) | sí | típico 2,3 mm |
| `ancho` | number (mm) | sí | formato de la plancha (para consumo por área) |
| `alto` | number (mm) | sí | |

Unidad de stock: `plancha` / `hoja`; consumo por cm²/m². Es análoga a
`sustrato_rigido_v1` (ancho×alto×espesor) más un `color`.

### C. Almohadilla / cartucho de tinta (materia prima consumible, opcional)

Repuesto de tinta para automáticos, o tampón para manuales. Mínimo: `marca`,
`modeloCompatible`, `colorTinta` (select), consumible. Se puede dejar para una
fase 2.

### D. Producto comercial "Sello"

Lo que se vende y cotiza. `unidadComercial: 'unidad'`,
`modoMedidas: 'FIJA'` (o `COMERCIAL_ELIGE` si el comercial elige el tamaño de una
lista). Su ruta consume el cuerpo del sello (A) y la goma (B). Atributos comerciales que
el comercial completa al cotizar: `tipo_sello`, `marca`, `modelo`,
`texto_cliente`, `lineas_necesarias`, `color_tinta`.

---

## 4. Diseño propuesto para la taxonomía

Dado que familias/subfamilias son enums (cualquier cambio necesita migración),
hay dos caminos:

### Implementado — nueva familia `SELLOS` (dominio propio y limpio)

```
Familia SELLOS
├── subfamilia SELLOS_AUTOMATICOS   → template sello_automatico_v1
├── subfamilia SELLOS_MANUALES      → template sello_manual_v1
├── subfamilia GOMA_LASERABLE       → template goma_laserable_v1
└── subfamilia ALMOHADILLA_TINTA    → templates almohadilla_sello_v1 y
    tinta_sello_v1 (implementada 2026-07-10 con el relevamiento de accesorios
    del proveedor — ver docs/sellos-catalogo-proveedor-2026-07.md)
```

Ventajas: la biblioteca agrupa todo lo de sellos junto (Colop/Trodat/Nykon como
presets), y el modelo queda auto-contenido. Se agregó `SELLOS`/`GOMA_LASERABLE` a
`MP.sustratoGrabable` (`familias.ts`) para que el slot del paso `grabado_laser`
acepte la goma laserable.

### Opción pragmática — reutilizar familias existentes

- **Goma laserable** → subfamilia nueva `GOMA_LASERABLE` bajo `SUSTRATO`. Ventaja:
  `SUSTRATO` ya es compatible con `grabado_laser` (vía `MP.sustratoGrabable`),
  así que la goma queda grabable sin tocar la compatibilidad.
- **Cuerpo del sello** → subfamilia nueva bajo `HERRAJE_ACCESORIO`.

Ventaja: menos invasivo semánticamente (aunque igual requiere migración). Desventaja:
el dominio "sello" queda repartido en dos familias y la biblioteca no lo agrupa
tan natural.

**Mi recomendación:** la Opción 1 (familia `SELLOS`) por claridad de dominio y
porque la biblioteca de Colop/Trodat/Nykon queda ordenada; el costo extra sobre
la Opción 2 es marginal (mismo tipo de migración).

### Plantillas creadas (`src/lib/materia-prima-templates.ts`)

**`sello_automatico_v1`** — `dimensionesVariante`: `[marca, modelo, anchoPolimero,
altoPolimero, lineasTexto, forma, colorCarcasa]`. Unidad stock `unidad`.

**`sello_manual_v1`** — igual que el automático pero con `material` (madera/plástico)
en lugar de `colorCarcasa`.

**`goma_laserable_v1`** — `dimensionesVariante`: `[color, espesor, ancho, alto,
marca]`. Unidad stock `hoja`. (Muy parecida a `sustrato_rigido_v1`.)

---

## 5. Producto comercial y ruta

1. **Categoría/subcategoría**: agregar subcategoría `sellos` (nueva categoría
   `sellos_marcadores`, o colgada de una existente) en el seed
   `apps/api/prisma/seed-modulos/catalogo-comercial.js`. Las categorías se
   seedean por `upsert` sobre `codigo` — **no son enums**, así que esto es fácil
   y sin migración.
2. **Schema de atributos** de la subcategoría (`atributosSchemaJson`):
   `tipo_sello`, `marca`, `modelo`, `tamano_polimero`, `lineas_texto`,
   `color_tinta`, `texto_cliente`.
3. **Ruta de producción** (una `ProductoRutaAlternativa` "Vía láser"):
   - Paso 1 `pre_prensa` (o `diseno_grafico`) — armar el archivo. M-0, tiempo
     fijo o estimado por el comercial.
   - Paso 2 `grabado_laser` — slot `sustrato` = variante de goma laserable,
     máquina CORTE_LASER, centro TER-001, **tiempo T-4 manual del comercial
     (obligatorio)**. Consumo de goma por el tamaño de polímero.
   - Paso 3 `montaje_sobre_sustrato` (o `trabajo_manual`) — slot = cuerpo del
     sello. Montaje del cliché en el cuerpo.
   - Ruta alternativa "Manual": paso 2 reemplazado por `trabajo_manual`.

---

## 6. La lógica futura que habilitan el tamaño de polímero + líneas de texto

Guardar `anchoPolimero × altoPolimero` y `lineasTexto` en el cuerpo del sello desbloquea,
más adelante:

- **Validación**: que el texto que pide el cliente (N líneas) no supere las
  `lineasTexto` del modelo elegido → aviso al comercial "el Printer 30 hace
  máximo 5 líneas".
- **Consumo automático de goma**: el tamaño de polímero del cuerpo del sello determina
  cuánta goma laserable se gasta (área) → costo automático del insumo, incluso
  con nesting de varias planchas por hoja de goma.
- **Recomendación de modelo**: dado el tamaño de sello que quiere el cliente,
  sugerir el modelo que lo cubre.
- **Catálogo cruzado**: qué goma (por espesor/color) es compatible con qué
  máquina láser.

---

## 7. Esfuerzo y qué habría que tocar

Ninguna familia de paso nueva (ya están). El trabajo es materiales + catálogo:

1. **Enums de materia prima** (`schema.prisma` + DTO API + tipos front + labels)
   — agregar familia `SELLOS` y subfamilias. **Requiere migración Prisma.**
2. **Plantillas** `sello_automatico_v1`, `sello_manual_v1` y `goma_laserable_v1` en
   `materia-prima-templates.ts` (respetando keys canónicas y ancho-antes-de-alto).
3. **Compatibilidad de slot**: sumar `SELLOS`/`GOMA_LASERABLE` a
   `MP.sustratoGrabable` en `familias.ts` (una línea) para que `grabado_laser`
   acepte la goma.
4. **Biblioteca**: presets Colop / Trodat / Nykon en `material-presets.js` con un
   helper `selloPresetMeta(...)`, más las variantes por modelo (con su tamaño de
   polímero y líneas de texto). Revisar `esPresetConsumible` si la almohadilla va
   como consumible.
5. **Catálogo comercial**: subcategoría `sellos` + su `atributosSchemaJson` en
   `catalogo-comercial.js` (sin migración).
6. **Producto de ejemplo + ruta** en el seed de rutas (patrón de `rutas-productos.js`).

Frontend: la carga manual (elegir plantilla → completar ficha) y la biblioteca
(instalar preset) ya son genéricas y **renderizan solo con las plantillas
nuevas** — no requieren código de UI específico de sellos.

---

## 8. Decisiones abiertas para vos

1. **¿Familia `SELLOS` propia (opción 1) o reutilizar SUSTRATO+HERRAJE (opción 2)?**
   Recomiendo la propia.
2. **¿La almohadilla/tinta entra ahora o en fase 2?** Recomiendo fase 2.
3. **¿El tamaño de polímero se maneja como atributos numéricos
   (`anchoPolimero`/`altoPolimero`) o como medidas predefinidas del producto?**
   Recomiendo atributos del cuerpo del sello (para la lógica futura) + el comercial
   elige el modelo, no la medida suelta.
4. **¿Sellos redondos** (fecha, número) entran en el alcance inicial o solo
   rectangulares? Afecta si `forma` es obligatorio.
