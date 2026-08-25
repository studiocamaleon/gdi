# Estructura de máquinas y perfiles

> **Sub-tema** del análisis del motor por pasos (paralelo a Fase D).
> **Estado**: PARCIAL — bloque IMPRESORAS cerrado + GUILLOTINA + PLOTTER_DE_CORTE + LAMINADORA_BOPP_ROLLO + PLOTTER_CAD + CORTE_LASER + ROUTER_CNC + ANILLADORA. Pendientes: MESA_DE_CORTE (postergada) + estructural (SOLDADORA, CABINA_PINTURA).
> **Sesión**: 2026-04-23 / 2026-04-24. **Método**: análisis interactivo.
>
> ✅ **Actualizaciones aplicadas a Fase A, B, C** (sesión 2026-04-24):
> - Agregado **T-4 INPUT_MANUAL_COMERCIAL** al catálogo de tipos de tiempo (`02-anatomia-de-un-paso.md`).
> - Refinada la regla "modosTiempoHabilitados" (`02-anatomia-de-un-paso.md`).
> - Agregadas familias `modificacion_pre` y `modificacion_post` al catálogo (`01-tipos-de-paso.md`).
> - Agregado patrón "pasos PRE mutan JobContext" (`02-anatomia-de-un-paso.md` y `03-catalogo-y-trazabilidad.md`).
> - Agregada sub-tarea **i) Mutar JobContext** al bucle a-i (`04-modelo-conceptual-motor.md`).
>
> 🗑️ **Plantillas eliminadas en esta sesión** (modeladas como pasos de modificación física, NO como plantillas):
> - PERFORADORA → ahora es `modificacion_post` sub-tipo `perforacion`.
> - REDONDEADORA_PUNTAS → ahora es `modificacion_post` sub-tipo `redondeo_puntas`.
> - Razón: son herramientas auxiliares manuales, no máquinas industriales con perfiles propios. El enfoque "modificación física" es más flexible y reduce plantillas innecesarias.
>
> 🗑️ **Plantillas de encuadernación descartadas** (sesión 2026-04-24, post-ANILLADORA):
> - **ENGRAPADORA** → familia `encuadernado_engrapado` se modela M-0 (proceso manual, sin plantilla). Sin sub-tipos (caso único "engrapado").
> - **ENCOLADORA** → familia `engomado_emblocado` se modela M-0 (manual, sin plantilla). Materiales OPCIONALES en slots: cartón base, hoja blanca superior.
> - **COSEDORA** → familia `encuadernado_cosido` DESCARTADA del catálogo (Corporearte no encuaderna cosido).
> - **MONTAJE_TAPAS_DURAS** → familia `tapas_duras` DESCARTADA del catálogo (Corporearte no monta tapas duras).
> - Razón: son procesos predominantemente manuales en Corporearte; modelar plantilla agrega complejidad sin ganancia de costeo.
> - Única plantilla que SÍ amerita en encuadernación: **ANILLADORA** (productividad real medida en hojas/h, distinta entre máquinas, justifica plantilla + perfiles).

## Propósito

Definir cómo se modelan las máquinas físicas, sus parámetros técnicos, y sus perfiles operativos. Toca varias decisiones de Fase D (D.2 resolución máquina/perfil, D.4 origen de tiempos, D.5 fuente 2 de materiales, D.7 validaciones de capacidad).

---

## 1. Marco conceptual

```
┌─ Una MÁQUINA es una instancia física en el taller ─────────────────┐
│   Ej: "Ricoh PRO C5100 #3"                                          │
│   • Identidad propia (id, nombre, n° serie)                         │
│   • Pertenece a un TIPO (PLANTILLA)                                 │
│   • Vive en una PLANTA / centro físico                              │
│   • Tiene parámetros TÉCNICOS (universales + JSON específicos)      │
│   • Tiene N PERFILES OPERATIVOS                                     │
│   • Tiene CONSUMIBLES (vinculados a perfiles)                       │
│   • Tiene COMPONENTES DE DESGASTE (a nivel perfil)                  │
└─────────────────────────────────────────────────────────────────────┘

┌─ Una PLANTILLA es un TIPO de máquina ───────────────────────────────┐
│   Ej: IMPRESORA_LASER, IMPRESORA_GRAN_FORMATO_POR_AREA, GUILLOTINA  │
│   • Catálogo CERRADO en código (no configurable por tenant)         │
│   • Define qué campos pueden tener su máquina (schema)              │
│   • Define qué tipos de perfiles soporta                            │
│   • Las familias de paso declaran qué plantillas son compatibles    │
└─────────────────────────────────────────────────────────────────────┘

┌─ Un PERFIL OPERATIVO es un MODO de la máquina ──────────────────────┐
│   Ej: "Ricoh A4 Papel Grueso Simple Faz 40ppm"                      │
│   • Vinculado a una máquina específica                              │
│   • Tiene productividad + tiempos (setup, cleanup, feedReload)      │
│   • Tiene discriminantes (caras, formato, gramaje, etc.)            │
│   • Puede tener regla de auto-selección (JsonLogic) opcional        │
│   • Tiene consumibles asociados (tóner, tinta) por perfil           │
│   • Tiene componentes de desgaste asociados (fusor, cabezal)        │
└─────────────────────────────────────────────────────────────────────┘

┌─ Diagrama de relaciones ────────────────────────────────────────────┐
│                                                                      │
│       PLANTILLA (tipo, catálogo cerrado)                            │
│           │ 1                                                        │
│           ↓ N                                                        │
│       MÁQUINA (instancia)                                            │
│           │ 1                                                        │
│           ├── parámetros técnicos                                   │
│           │                                                          │
│           ├── N PERFIL OPERATIVO                                     │
│           │       │                                                  │
│           │       ├── productividad, setup, cleanup                 │
│           │       ├── discriminantes (columnas + regla opcional)    │
│           │       ├── N CONSUMIBLES (vinculados al perfil)          │
│           │       └── N COMPONENTES DESGASTE (vinculados al perfil) │
│                                                                      │
│       FAMILIA DE PASO ─── compatibleCon ──→ N PLANTILLAS             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Las 4 preguntas que un perfil debe responder al motor

```
Q1: "¿Cuánto tiempo me tarda procesar N unidades?"
    → productivityValue + unidad + setupMin/cleanupMin/feedReloadMin

Q2: "¿Cuánto consumo (tóner/tinta/etc) gasto?"
    → consumibles asociados con consumoBase
    → unidad de consumo: gr/m², ml/m², gr/pliego según tipo

Q3: "¿Este perfil aplica al JobContext?"
    → discriminantes (columnas: caras, formato, etc.) + regla opcional

Q4: "¿Este perfil PUEDE hacer el trabajo?"
    → rangos soportados (gramaje min/max, etc.)
```

---

## 3. Convenciones del modelo

### Campos universales vs específicos

- **Universales (columnas)** en `Maquina` y `MaquinaPerfilOperativo`: aplican a TODAS las plantillas. Identidad, productivityValue, setupMin, cleanupMin, etc.
- **Específicos (JSON)** en `paramsTecnicosJson` y `paramsPerfilJson`: schema declarado por la plantilla.

### Márgenes no imprimibles (no área imprimible fija)

```
✅ CORRECTO: márgenes no imprimibles (propiedad estable física)
❌ INCORRECTO: área imprimible fija (depende del pliego)
```

El motor calcula el área útil on-the-fly: `area_imprimible = pliego_elegido - margenes_no_imprimibles`. Aplica a impresoras, plotters, etc.

### Unidades de consumo

- **Tóner / Tinta**: por **m² impresos** (no por pliego). El consumo se calcula sobre el área del pliego_impresion.
- **Otros consumibles** (cinta, etiqueta): por pliego o por unidad según el caso.

### Unidades de desgaste — por plantilla

**El desgaste es OPCIONAL por plantilla**. No todas las máquinas necesitan modelar componentes de desgaste:

```
SÍ modelar desgaste cuando:
  • El componente se cambia con frecuencia.
  • El costo es significativo respecto al trabajo.
  • NO está incluido en amortización del centro de costo.

NO modelar desgaste cuando:
  • Componente dura mucho (años).
  • Costo bajo respecto al trabajo.
  • Ya cubierto por amortización del centro de costo.
```

Cada plantilla que SÍ modela desgaste declara su unidad fija:

| Plantilla | Desgaste | Unidad de vida útil |
|---|---|---|
| IMPRESORA_LASER | SÍ | `A4_EQ` (pliegos A4 equivalentes) |
| IMPRESORA_GRAN_FORMATO_POR_AREA | SÍ | `M2` (metros cuadrados impresos) |
| GUILLOTINA | SÍ | `CORTES` (bajadas de cuchilla) |
| PLOTTER_DE_CORTE | SÍ | `M2` (área cortada acumulada) |
| PLOTTER_CAD | SÍ | `ML_TINTA` (mililitros de tinta procesada) |
| CORTE_LASER | SÍ | `HORAS_USO` (horas de operación del tubo láser) |
| ROUTER_CNC | SÍ | `HORAS_USO` (horas de uso de la fresa) |
| LAMINADORA_BOPP_ROLLO | NO | N/A |
| ANILLADORA | NO | N/A (punzones en amortización CC) |
| MESA_DE_CORTE | a definir | a definir |
| Otras | a definir cuando se modele | |

### Patrón nuevo (PLOTTER_CAD): desgaste vinculado a CONSUMIBLE

Hasta PLOTTER_CAD, todas las unidades de desgaste estaban vinculadas a "trabajo procesado" (pliegos, m², cortes). PLOTTER_CAD introduce un patrón nuevo: el desgaste vinculado a un **consumible específico** (tinta).

```
Razón: los fabricantes de plotters CAD (HP, Canon, Epson) expresan
la vida útil del cabezal en ML/L de tinta procesada.

Implicación para el motor: lleva cuenta acumulada de ml por cabezal
y calcula el costo de desgaste proporcional al consumo de tinta.
```

Este patrón puede aplicar a otras plantillas en el futuro (impresoras de fotografía profesional, plotters de inyección, etc.).

Para `A4_EQ`, el motor mantiene tabla estática de conversión:
- A4 = 1
- A3 = 2
- SRA3 = 2.4
- A2 = 4
- Custom: `(ancho × alto) / (210 × 297)`

Para `M2`, lo lee del output del paso (m²_impresos).
Para `CORTES`, lo lee del output del paso (cortes ejecutados).

### Sustratos compatibles

NO se declaran en la máquina. La **materia prima** declara con qué tecnologías/plantillas es compatible. Más mantenible (un material nuevo no obliga a actualizar todas las máquinas).

### Discriminantes en perfil — Visión Híbrida (C)

```
Columnas para discriminantes COMUNES y consultables:
  • caras: SIMPLE_FAZ | DOBLE_FAZ | null (null = ambas)
  • colores: BN | CMYK | null
  • formatoSoportado: A4 | A3 | SRA3 | null
  • gramajeMinGr, gramajeMaxGr (rango)
  • numeroPasadas, modoCalidad, modoOperacion, etc.

Regla opcional para casos COMPLEJOS:
  • reglaAutoSeleccion: JsonLogic | null

Algoritmo de matching del motor:
  1. Filtra perfiles por columnas (rápido, indexable).
  2. Si pasa filtro y tiene reglaAutoSeleccion, evalúa la regla.
```

---

## 4. Catálogo de plantillas — Decisiones tomadas

### Bloque IMPRESORAS — CERRADO ✅

#### Eliminaciones (10 plantillas eliminadas)

- ❌ `IMPRESORA_INYECCION_TINTA` — no aplica al rubro objetivo.
- ❌ `IMPRESORA_LATEX` — unificada en `IMPRESORA_GRAN_FORMATO_POR_AREA` con `tecnologia=LATEX`.
- ❌ `IMPRESORA_SOLVENTE` — unificada con `tecnologia=SOLVENTE`.
- ❌ `IMPRESORA_UV_ROLLO` — unificada con `tecnologia=UV` + `geometria=ROLLO`.
- ❌ `IMPRESORA_SUBLIMACION_GRAN_FORMATO` — unificada con `tecnologia=SUBLIMACION`.
- ❌ `IMPRESORA_UV_MESA_EXTENSORA` — unificada con `tecnologia=UV` + `geometria=MESA_EXTENSORA`.
- ❌ `IMPRESORA_UV_FLATBED` — equivalente a `MESA_EXTENSORA` (cama plana). Unificada igual.
- ❌ `IMPRESORA_UV_CILINDRICA` — no aplica al rubro objetivo.
- ❌ `IMPRESORA_DTF` — unificada con `tecnologia=DTF_TEXTIL` (imprime sobre film DTF textil).
- ❌ `IMPRESORA_DTF_UV` — unificada con `tecnologia=DTF_UV` (imprime sobre film A+B).
- ❌ `IMPRESORA_3D` — no aplica al rubro objetivo.

#### Mantenidas / creadas (2 plantillas finales de impresoras)

- ✅ `IMPRESORA_LASER` — modelo completo (§5).
- ✅ `IMPRESORA_GRAN_FORMATO_POR_AREA` — modelo completo (§6). Unifica 7 plantillas anteriores.

**Reducción**: de 12 plantillas de impresoras a 2 (-83%).

### PENDIENTES (no modeladas todavía)

**No-impresoras** (categorías Corte, Terminaciones, Encuadernación, Estructural):
- ROUTER_CNC, CORTE_LASER, GUILLOTINA, PLOTTER_DE_CORTE, MESA_DE_CORTE, PLOTTER_CAD, PERFORADORA, LAMINADORA_BOPP_ROLLO, REDONDEADORA_PUNTAS
- + nuevas: ENGRAPADORA, ANILLADORA, COSEDORA, ENCOLADORA, MONTAJE_TAPAS, BARNIZADORA_UV, HOTSTAMPING, SOLDADORA, CABINA_PINTURA

---

## 5. Plantilla `IMPRESORA_LASER` — Modelo final

### Descripción

Impresora digital láser por tóner. Imprime sobre papel/cartulina por hoja. Alta velocidad, calidad media-alta.

**Ejemplos**: Ricoh PRO C5100, Konica Minolta C7090, Xerox Versant.

**Familias compatibles**: `impresion_por_hoja`.

**Productos típicos**: tarjetas de visita, folletos, talonarios, postales, papelería.

### MÁQUINA

```
Identidad universal (columnas — todas las plantillas):
  id, nombre, fabricante, modelo, numeroSerie
  plantaId, centroCostoPrincipalId, estado, fechaAlta
  plantilla = IMPRESORA_LASER, plantillaVersion

Físicos universales (columnas):
  anchoUtilMaxMm        (ej. 320)
  largoUtilMaxMm        (ej. 1200)
  espesorMaxMm          (ej. 0.4)
  gramajeMaxGr          (ej. 400)

paramsTecnicosJson (específico IMPRESORA_LASER):
  margenesNoImprimiblesMm: { sup, inf, izq, der }
  soporteDobleFaz: bool
  formatosPliegoSoportados: [A4, A3, SRA3]
  coloresSoportados: [BN, CMYK]
```

### PERFIL OPERATIVO

```
Universales (columnas):
  nombre, activo
  productivityValue                (ej. 40)
  productivityUnit = PPM           (pliegos por minuto)
  setupMin, cleanupMin, feedReloadMin

Discriminantes (columnas, visión híbrida):
  caras: SIMPLE_FAZ | DOBLE_FAZ | null
  colores: BN | CMYK | null
  formatoSoportado: A4 | A3 | SRA3 | null
  gramajeMinGr, gramajeMaxGr

Regla opcional:
  reglaAutoSeleccion: JsonLogic | null

Consumibles (asociados al perfil):
  Toner CMYK: 0.5 gr/m²
  Toner negro: 0.1 gr/m²

Componentes desgaste:
  Fusor: vida útil 150.000 pliegos A4 eq
  Transferencia: 200.000 pliegos A4 eq
  Cilindros tambor: 100.000 pliegos A4 eq
```

---

## 6. Plantilla `IMPRESORA_GRAN_FORMATO_POR_AREA` — Modelo final

### Descripción

Reemplaza 7 plantillas anteriores (LATEX, SOLVENTE, UV_ROLLO, SUBLIMACION, UV_MESA_EXTENSORA, UV_FLATBED, DTF, DTF_UV). Usa campos discriminantes `tecnologia` y `geometria` para distinguir variantes.

**Ejemplos**: HP Latex 365, Mimaki UJV, Roland VersaUV, Epson SureColor, impresoras DTF de film, etc.

**Familias compatibles**: `impresion_por_area`.

**Productos típicos**: vinilo adhesivo, lonas, banners, microperforado, calcomanías gran formato, vinilo automotriz, decoración interior, impresión sobre rígidos (acrílico, PVC), film DTF para transfer textil, film A+B para transfer rígido.

### Razón conceptual de la unificación

Todas estas impresoras hacen lo mismo a nivel del MOTOR:
- Imprimir sobre un sustrato continuo (rollo) o plano (mesa).
- Productividad medida en m²/h.
- Consumibles tinta por m².
- Margenes no imprimibles.
- Misma estructura de perfiles operativos.

Lo que cambia entre LATEX, UV, DTF_UV, DTF_TEXTIL es:
- El **tipo de tinta** (consumible distinto, vinculado al perfil).
- El **sustrato compatible** (vinilo / film A+B / film textil) → lo declara la **materia prima**, no la máquina.
- El **flujo posterior**: las DTF necesitan un paso siguiente de "Aplicación de transfer" para llevar el film impreso al sustrato final (rígido o textil). Pero ese es OTRO paso de la ruta, no la impresora.

### MÁQUINA

```
Identidad universal (igual que todas).

Físicos universales (columnas):
  anchoUtilMaxMm                   (ej. 1600 = 1.6m)
  espesorMaxMm                     (ej. 1 mm para rollo, mayor para mesa)
  largoUtilMaxMm                   (NULL para ROLLO; aplicable para MESA)

paramsTecnicosJson:
  tecnologia: LATEX | SOLVENTE | UV | SUBLIMACION | DTF_UV | DTF_TEXTIL
  geometria: ROLLO | MESA_EXTENSORA
  margenesNoImprimiblesMm: { sup, inf, izq, der }
  coloresSoportados: [
    "CMYK",
    "CMYK+blanco",
    "CMYK+blanco+barniz"
  ]
  
  // Si geometria = ROLLO:
  anchoMinRolloMm, anchoMaxRolloMm
  
  // Si geometria = MESA_EXTENSORA:
  anchoMesaMm, largoMesaMm
  alturaMaxCabezalMm
  // (no incluye pesoMaxSustratoKg — innecesario)
```

### PERFIL OPERATIVO

```
Universales (columnas):
  nombre, activo
  productivityValue
  productivityUnit = M2_H          (siempre m²/hora, también modo rígido)
  setupMin, cleanupMin, feedReloadMin

Discriminantes (columnas, visión híbrida):
  numeroPasadas                    (4, 6, 8 PASS)
  colores                          (CMYK | CMYK+blanco | CMYK+blanco+barniz)
  modoCalidad                      (DRAFT | NORMAL | ALTA)
  modoOperacion                    (ROLLO | RIGIDO — solo si plantilla
                                    geometria=MESA_EXTENSORA)

Regla opcional:
  reglaAutoSeleccion: JsonLogic | null

Consumibles (vinculados al perfil):
  Tinta CMYK: 8 ml/m² (varía según pasadas y cobertura)
  Tinta blanca: 5 ml/m² (si aplica)
  Barniz: 3 ml/m² (si aplica)

Componentes desgaste:
  Cabezal: vida útil 5.000 m² impresos
  Banda transportadora: 100.000 m²
```

### Cómo se usa con M-2 (alternativas de tecnología)

```
Producto "Vinilo gran formato":
  Paso "Imprimir" (familia: impresion_por_area)
  máquinasCandidatas:
    [
      { id: "ricoh-latex-1", esPreferida: true },
      { id: "hibrida-uv-1" }
    ]

Comercial cotiza:
  - UI muestra 2 opciones con etiquetas Latex / UV.
  - Elige "UV".
  - Motor:
    - Lee máquina hibrida-uv-1
    - Lee paramsTecnicos: tecnologia=UV, geometria=MESA_EXTENSORA
    - Resuelve perfil según JobContext (modoOperacion, calidad, etc.)
    - Calcula tiempo, materiales, costo
```

### Diagrama del flujo DTF (caso especial)

Las tecnologías DTF tienen un flujo adicional: después de imprimir el film, hay un paso de transferencia al producto final.

```
[Imprimir film] (familia: impresion_por_area, tecnologia=DTF_TEXTIL)
   ↓ produce film impreso
[Aplicar transfer] (familia: aplicacion_transfer, otra máquina:
                    plancha térmica)
   ↓ transfiere film a la prenda
PRODUCTO FINAL (remera, gorra, etc.)
```

El motor ve **2 pasos** en la ruta. La PLANTILLA `IMPRESORA_GRAN_FORMATO_POR_AREA` con `tecnologia=DTF_TEXTIL` ejecuta el primero. La familia `aplicacion_transfer` (con su propia máquina, ej. plancha térmica) ejecuta el segundo.

Esta separación mantiene el modelo limpio: la impresora hace impresión, la transferencia es un paso aparte.

---

## 7. Plantilla `GUILLOTINA` — Modelo final

### Descripción

Máquina industrial para cortar pilas de papel/cartón con cuchilla horizontal que baja con presión.

**Ejemplos**: Polar 78, Wohlenberg, Schneider Senator.

**Familias compatibles**: `corte_guillotina`.

**Productos típicos**: separar tarjetas/folletos/etiquetas/talonarios desde pliegos impresos.

### Cómo trabaja

1. Setup global (~2-5 min): poner pila, escuadrar, calibrar tope.
2. Cada corte individual (~5-15 segundos): mover tope, bajar cuchilla, sacar corte.
3. Si la pila no entra entera, se hacen múltiples tandas. Cada tanda repite todos los cortes.

### Las preguntas que el perfil/máquina responde al motor

```
Q1: ¿Cuántos pliegos puede apilar para cortar de una vez?
    → pliegosMaxPorTanda (en perfil, según material)
Q2: ¿Cuántos cortes hay que hacer?
    → NO de la máquina, viene heredado del paso anterior.
Q3: ¿Cuánto tarda cada corte?
    → tiempoPorCorteSeg (en máquina, constante).
Q4: ¿Cuánto tiempo de setup?
    → setupMin del perfil.
Q5: ¿Puede cortar el material?
    → Largo de cuchilla (anchoUtilMaxMm) + rango de gramaje del perfil.
```

### MÁQUINA

```
Identidad universal (igual que todas).

Físicos universales (columnas):
  anchoUtilMaxMm        (= largo de cuchilla, ej. 780)
  largoUtilMaxMm        (profundidad de mesa, ej. 1100)
  altoUtilMm            (altura física máxima de pila, ej. 165)

paramsTecnicosJson (específico GUILLOTINA):
  tiempoPorCorteSeg: 8     ← un solo valor por máquina, casi no varía
                              entre materiales
```

### PERFIL OPERATIVO

Hay un perfil por **tipo/rango de material**:
- "Papel obra hasta 100gr"
- "Papel grueso 100-250gr"
- "Cartón fino 250-400gr"
- "Cartón grueso 400+gr"

```
Universales (columnas):
  nombre, activo
  productivityValue = NULL    (guillotina usa fórmula no lineal)
  productivityUnit  = NULL
  setupMin = 3
  cleanupMin = 1
  feedReloadMin = 2           (entre tandas)

Discriminantes (columnas, visión híbrida):
  gramajeMinGr = 0
  gramajeMaxGr = 100

paramsPerfilJson (específico GUILLOTINA):
  pliegosMaxPorTanda = 500    ← fijo por perfil (asume grosor promedio
                                 del rango de gramaje, sin necesidad
                                 de declarar grosor en materia prima)

Regla auto-selección (JsonLogic):
  gramaje del papel cae en el rango → este perfil

Consumibles: ninguno

Componentes desgaste:
  Cuchilla: vida útil 50.000 CORTES
  Tabla de corte: vida útil 200.000 CORTES
```

### Fórmula de tiempo del motor

```
tandas = ceil(cantidadPliegos / pliegosMaxPorTanda)

tiempo_total_min = setupMin
                 + tandas × (cortes × tiempoPorCorteSeg / 60)
                 + (tandas - 1) × feedReloadMin
                 + cleanupMin

donde:
  cantidadPliegos: heredado del paso anterior (impresion_por_hoja).
  cortes: heredado del paso anterior (impresion_por_hoja o pre-prensa).
  pliegosMaxPorTanda: del perfil seleccionado.
  tiempoPorCorteSeg: de la máquina.
```

**Importante**: la guillotina NO usa el modelo `productividad × cantidad`. Usa fórmula específica con `tandas + cortes`. El motor por pasos debe soportar esta variante.

---

## 8. Plantilla `PLOTTER_DE_CORTE` — Modelo final

### Descripción

Máquina con cuchilla móvil que recorre un sustrato (vinilo en rollo o hojas) trazando formas y cortándolas siguiendo trayectorias vectoriales.

**Ejemplos**: Skycut, Roland CAMM-1, Graphtec FC, Mimaki CG.

**Familias compatibles**: `plotter_corte`.

**Productos típicos**: vinilo de corte para autos/vidrieras, stickers, calcomanías, formas decorativas, vinilo textil para transferir.

### Cómo trabaja

1. Setup (~5-10 min): carga rollo, calibra origen, calibra cuchilla.
2. Corte: la máquina lee el archivo vectorial y recorre las trayectorias.
3. Tipos de corte: COMPLETO (atraviesa vinilo + soporte) o KISS_CUT (solo vinilo).

### MÁQUINA

```
Identidad universal.

Físicos universales (columnas):
  anchoUtilMaxMm  = 600   (ancho máximo de rollo aceptado)
  largoUtilMaxMm  = NULL  (rollo continuo, sin tope)
  espesorMaxMm    = 1     (vinilo, films)

paramsTecnicosJson (específico PLOTTER_DE_CORTE):
  anchoMinRolloMm  = 200
  anchoMaxRolloMm  = 600
  modosOperacionSoportados: [ROLLO, HOJAS]
```

### PERFIL OPERATIVO

```
Hay perfiles base por TIPO DE CORTE + MODO:
  "Corte completo - rollo"
  "Corte completo - hojas"
  "Kiss cut - rollo"

Universales (columnas):
  nombre, activo
  productivityValue   = 36   (m²/h base, cortes simples)
  productivityUnit    = M2_H
  setupMin            = 8
  cleanupMin          = 2
  feedReloadMin       = 5    (solo si hay multi-rollo)

Discriminantes (columnas, visión híbrida):
  tipoCorte:     COMPLETO | KISS_CUT
  modoOperacion: ROLLO | HOJAS

paramsPerfilJson (específico PLOTTER_DE_CORTE):
  factorComplejidad: {
    SIMPLE: 1.0,
    INTERMEDIO: 1.5,
    COMPLEJO: 3.0
  }

Regla auto-selección:
  Por tipoCorte + modoOperacion del JobContext.
  El comercial elige complejidad al cotizar; el motor lo aplica
  como multiplicador del tiempo.

Consumibles: ninguno.

Componentes desgaste:
  Cuchilla: vida útil 200 m² procesados (unidad M2)
```

### Fórmula de tiempo del motor

```
factor = factorComplejidad[complejidadElegidaPorComercial]
tiempo_corte_min = (cantidad_m2 × factor / productivityValue) × 60

tiempo_total_min = setupMin
                 + tiempo_corte_min
                 + cleanupMin
                 + (rollos_extra × feedReloadMin)
                 
donde rollos_extra > 0 solo si hay multi-color o cambio de material.
```

**El factor de complejidad es elegido por el comercial al cotizar** (input del JobContext). El perfil declara los multiplicadores. Esto permite usar pocos perfiles base con flexibilidad de complejidad por trabajo.

---

## 9. Plantilla `LAMINADORA_BOPP_ROLLO` — Modelo final

### Descripción

Máquina que aplica film transparente (BOPP brillo, mate, UV, lustre) sobre pliegos impresos. Pasa los pliegos entre rodillos calientes que adhieren el film.

**Ejemplos**: GMP Excelam-II, Foliant Mercury, Yibei Yibei.

**Familia compatible**: `laminado`.

**Productos típicos**: tarjetas premium, tapas de libros, cajas, postales premium.

### Cómo trabaja

1. Setup (~8 min): cargar rollo, calibrar temperatura/alineación. (Calentamiento incluido en setup, no se modela aparte).
2. Proceso: pliegos pasan entre rodillos a velocidad nominal en mm/min.
3. Una cara requiere una pasada. En doble faz, el perfil operativo indica si
   la máquina aplica ambos films simultáneamente (1 pasada) o si hay que dar
   vuelta los pliegos (2 pasadas).

### MÁQUINA

```
Identidad universal.

Físicos universales (columnas):
  anchoUtilMaxMm  = 760     (ancho máximo de pliego que pasa)
  largoUtilMaxMm  = NULL    (continuo)
  espesorMaxMm    = 1       (espesor máximo del pliego)

paramsTecnicosJson (específico LAMINADORA_BOPP_ROLLO):
  margenesDesperdicioMm: {
    inicio: 50,       // arranque del rollo (descartado)
    fin: 50,          // cierre del trabajo (descartado)
    izquierdo: 10,    // sobra a un lado del pliego
    derecho: 10       // sobra al otro lado
  }
  margenEntrePliegosMm: 5    // separación entre pliegos consecutivos
```

### PERFIL OPERATIVO (único)

Solo 1 perfil "Estándar" (la velocidad/setup no varía mucho entre tipos de film).

```
Universales (columnas):
  nombre = "Estándar"
  activo = true
  productivityValue   = 8000   (mm/min)
  productivityUnit    = MM_MIN
  setupMin            = 8      (incluye calentamiento)
  cleanupMin          = 2
  feedReloadMin       = 5      (cambio de rollo de film)

detalleJson:
  pasadasDobleFaz = 1 | 2

El film doble faz siempre consume dos largos. `pasadasDobleFaz` modifica sólo
el recorrido productivo de la máquina y, por lo tanto, el tiempo y la ETA.

Discriminantes: ninguno (solo 1 perfil)

Componentes desgaste: NINGUNO
  Razón: rodillos duran mucho, ya cubierto por amortización del CC.
```

### El paso laminado declara el film como sustrato

```typescript
pasoRuta {
  familia: "laminado",
  materiales: [
    {
      slot: "sustrato_principal",
      modoSeleccion: "COMERCIAL_ELIGE",
      variantesOfrecidas: [
        "film-bopp-brillo-1m",
        "film-bopp-mate-1m",
        "film-uv-1m",
        "film-lustre-1m"
      ],
      variantePreferida: "film-bopp-brillo-1m"
    }
  ]
}
```

El comercial elige el film al cotizar. Motor calcula consumo según márgenes de desperdicio + pasadas necesarias.

### Fórmula del motor para laminadora

```
// 1. Resolver recorrido según el perfil operativo
caras = JobContext.caras == "DOS_CARAS" ? 2 : 1
pasadas_maquina = JobContext.caras == "DOS_CARAS"
  ? perfil.pasadasDobleFaz
  : 1

// 2. Calcular consumo de film (mini-nesting de laminado)
ancho_film_mm = ancho_pliego + margenIzq + margenDer
largo_film_total_mm = margenInicio 
                    + (N_pliegos × largo_pliego_mm) 
                    + ((N_pliegos - 1) × margenEntrePliegos) 
                    + margenFin
metros_lineales_film = (largo_film_total_mm × caras) / 1000

// 3. Calcular tiempo
recorrido_maquina_m = (largo_film_total_mm × pasadas_maquina) / 1000
tiempo_proceso_min = recorrido_maquina_m / productivityValue   // m/min
tiempo_total_min = setupMin 
                 + tiempo_proceso_min 
                 + cleanupMin 
                 + (rollos_extra × feedReloadMin)
```

---

## 10. Plantilla `PLOTTER_CAD` — Modelo final

### Descripción

Plotter de inyección de tinta para impresión técnica/CAD. Imprime sobre rollos de papel (papel obra, fotográfico, vegetal).

**Ejemplos**: HP DesignJet, Canon imagePROGRAF, Epson SureColor T-Series.

**Familia compatible**: `impresion_por_area` (igual que gran formato).

**Productos típicos**: planos arquitectónicos, mapas, pósters técnicos, foto/referencias.

### Cómo trabaja

1. Setup (~5 min): cargar rollo, calibrar, alinear cabezal.
2. Proceso: imprime sobre el rollo a velocidad nominal en m²/h.
3. Tipos de trabajo: CAD (rápido, baja densidad) o FOTO (lento, alta densidad de tinta).

### MÁQUINA

```
Identidad universal.

Físicos universales (columnas):
  anchoUtilMaxMm  = 1067   (42 pulgadas, ancho máx de rollo)
  largoUtilMaxMm  = NULL   (rollo continuo)
  (espesorMaxMm — no se modela, no es necesario)

paramsTecnicosJson (específico PLOTTER_CAD):
  anchoMinRolloMm  = 200
  anchoMaxRolloMm  = 1067
  margenesNoImprimiblesMm: { sup: 5, inf: 5, izq: 5, der: 5 }
  coloresSoportados: ["CMYK"]
```

### PERFIL OPERATIVO

Hay perfiles por **tipoTrabajo + calidad** (porque consumo de tinta y velocidad cambian abismalmente):

```
Perfiles típicos:
  "CAD - Borrador"      prod 30 m²/h, tinta 0.5 ml/m²
  "CAD - Normal"        prod 15 m²/h, tinta 1.0 ml/m²
  "CAD - Alta"          prod 8  m²/h, tinta 2.0 ml/m²
  "Foto - Normal"       prod 6  m²/h, tinta 4.0 ml/m²
  "Foto - Alta"         prod 4  m²/h, tinta 5.5 ml/m²

Universales (columnas):
  nombre, activo
  productivityValue
  productivityUnit  = M2_H
  setupMin, cleanupMin, feedReloadMin

Discriminantes (columnas, visión híbrida):
  tipoTrabajo:  CAD | FOTO
  calidad:      DRAFT | NORMAL | ALTA

Regla auto-selección: por tipoTrabajo + calidad del JobContext.

Consumibles (vinculados al perfil):
  Tinta CMYK: ml/m² declarado por perfil

Componentes desgaste:
  Cabezal: vida útil 70.000 ml de tinta procesada (unidad ML_TINTA)
```

### El paso impresion_por_area declara papel como sustrato

```typescript
pasoRuta {
  familia: "impresion_por_area",
  materiales: [
    {
      slot: "sustrato_principal",
      modoSeleccion: "COMERCIAL_ELIGE",
      variantesOfrecidas: [
        "papel-plotter-90gr-90cm",
        "papel-plotter-90gr-107cm",
        "papel-fotografico-200gr-90cm"
      ]
    }
  ]
}
```

### Fórmula del motor

```
m2_a_imprimir = (ancho_pieza × alto_pieza × cantidad) / 1.000.000
tiempo_proceso_min = (m2_a_imprimir / productivityValue) × 60
tiempo_total = setupMin + tiempo_proceso_min + cleanupMin
             + (rollos_extra × feedReloadMin)

consumo_tinta_ml = m2_a_imprimir × consumoBase  (del perfil)
costo_desgaste_cabezal = (consumo_tinta_ml / vidaUtil_ml) × precio_cabezal
```

---

## 11. Plantilla `CORTE_LASER` — Modelo final

### Descripción

Máquina con láser de CO2 o fibra que corta materiales por calor sin contacto físico. La misma máquina hace CORTE (atraviesa) o GRABADO (marca superficial) según la potencia/velocidad usada.

**Ejemplos**: Bodor, Han's, Trotec, Universal Laser Systems.

**Familias compatibles**: `corte_laser` Y `grabado_laser` (la misma plantilla soporta ambos modos).

**Productos típicos**: piezas de acrílico, cortes de MDF, grabado en madera/cuero, siluetas de papel, fieltros decorativos.

### Hallazgo clave: tiempo NO se puede estandarizar

El tiempo de un trabajo de láser varía enormemente con material, diseño, operación. En la práctica el comercial:
1. Prepara el archivo.
2. Lo carga en el RIP del láser (software de la máquina).
3. Elige el perfil que va a usar.
4. El RIP le dice "este trabajo tarda X minutos".
5. El comercial INGRESA ese tiempo en el sistema.

**Esto introduce un cuarto tipo de tiempo: T-4 INPUT_MANUAL_COMERCIAL**.

### MÁQUINA

```
Identidad universal.

Físicos universales (columnas):
  anchoUtilMaxMm  = 1300   (ancho de mesa)
  largoUtilMaxMm  = 2500   (largo de mesa)
  espesorMaxMm    = 25     (altura ajustable de mesa)

paramsTecnicosJson (específico CORTE_LASER):
  tipoLaser: CO2 | FIBRA
  potenciaWatts: 100
  operacionesSoportadas: [CORTE, GRABADO]
  (sin MARCADO — sacado)
```

### PERFIL OPERATIVO (único: "Estándar")

Como el tiempo es input manual, no hace falta perfilear por material/espesor. Un solo perfil con setup/cleanup típicos alcanza.

```
Universales (columnas):
  nombre = "Estándar"
  activo = true
  productivityValue   = NULL  (T-4 no usa productividad)
  productivityUnit    = NULL
  setupMin            = 8
  cleanupMin          = 2

Discriminantes: ninguno (perfil único)

paramsPerfilJson: {}

Componentes desgaste:
  Tubo láser: vida útil 10.000 HORAS_USO
  (lentes y espejos → en amortización CC)
```

### El paso CORTE_LASER en la ruta

```typescript
pasoRuta {
  familia: "corte_laser",                          // o "grabado_laser"
  tipoTiempo: T-4 INPUT_MANUAL_COMERCIAL,
  materiales: [
    {
      slot: "sustrato_principal",
      modoSeleccion: "COMERCIAL_ELIGE",
      variantesOfrecidas: [
        "acrilico-3mm",
        "mdf-6mm",
        "madera-balsa-2mm"
      ]
    }
  ]
}

// La materia prima declara compat:
materiaPrima "acrilico-3mm" {
  compatibleConPlantillas: [CORTE_LASER, MESA_DE_CORTE]
}
materiaPrima "pvc-3mm" {
  compatibleConPlantillas: [MESA_DE_CORTE]   // NO CORTE_LASER (cloro tóxico)
}
```

### Flujo de cotización

```
1. Comercial elige producto "Corte láser de acrílico"
2. Elige material (acrílico 3mm)
3. UI muestra campo "Tiempo estimado del trabajo (min)"
   ← input requerido por T-4
4. Comercial usa el RIP del láser → obtiene 45 min
5. Ingresa 45 en el sistema
6. Motor cotiza:
     tiempo_total = setupMin + 45 + cleanupMin = 55 min
     costo = (55/60) × tarifa
     desgaste tubo = (55/60) horas / 10.000 × precio_tubo
```

### Patrón nuevo confirmado: T-4 INPUT_MANUAL_COMERCIAL

Hasta ahora teníamos 3 tipos de tiempo (Fase B):
- T-1 fijo (declarado en el paso)
- T-2 productividad propia (cantidad / vel paso)
- T-3 productividad máquina+perfil (cantidad / vel perfil)

Ahora se agrega:
- **T-4 INPUT_MANUAL_COMERCIAL**: el comercial ingresa el tiempo al cotizar. Se aplica cuando el tiempo varía tanto que no se puede estandarizar (CORTE_LASER, CNC complejo, etc.).

**TODO**: actualizar `02-anatomia-de-un-paso.md` con T-4.

---

## 12. Plantilla `ROUTER_CNC` — Modelo final

### Descripción

Máquina de Control Numérico Computarizado que corta/fresa/perfora materiales rígidos con un husillo (spindle) que gira fresas/cuchillas rotativas. Movimiento controlado en X, Y, Z desde G-code.

**Ejemplos**: AXYZ, ShopBot, MultiCam, Biesse, máquinas chinas (DSP, Jinka).

**Familia compatible**: `cnc`.

**Productos típicos**: cajas y muebles modulares, letras corpóreas, señalética volumétrica, herrajes, piezas técnicas, packaging rígido.

### Cómo trabaja

1. Setup (~12 min): cargar material, calibrar Z, alinear X/Y, cargar fresa.
2. Proceso: ejecuta G-code (corte/fresado/perforado) capa por capa.
3. Cleanup (~8 min): aspirar viruta, retirar piezas.

### Hallazgo clave: tiempo MIXTO

A diferencia de CORTE_LASER (siempre T-4), ROUTER_CNC puede tener:
- **Casos repetitivos** (cajas estándar) → T-3 productividad m²/h alcanza.
- **Casos custom** (pieza única, archivo complejo) → T-4 input manual del software CAM.

**Por eso la familia `cnc` declara `modosTiempoSoportados: [T-3, T-4]`** — el modelador del producto habilita uno, otro, o ambos. Si ambos, el comercial elige al cotizar.

### MÁQUINA

```
Identidad universal.

Físicos universales (columnas):
  anchoUtilMaxMm  = 1500   (X)
  largoUtilMaxMm  = 3000   (Y)
  altoUtilMm      = 200    (Z, espesor max)
  espesorMaxMm    = 200    (igual a altoUtilMm para CNC)

paramsTecnicosJson (específico ROUTER_CNC):
  potenciaHusilloKw: 5.5
  velocidadMaxRPM:  24000
  operacionesSoportadas: [CORTE_PASANTE, FRESADO, PERFORADO]
  tieneAspiracionViruta: true
```

### PERFIL "Estándar" (único)

```
Universales (columnas):
  nombre = "Estándar"
  activo = true
  productivityValue   = 5     (m²/h, valor nominal para T-3)
  productivityUnit    = M2_H
  setupMin            = 12
  cleanupMin          = 8

Discriminantes: ninguno (perfil único)

paramsPerfilJson: {}

Componentes desgaste:
  Fresa: vida útil 100 HORAS_USO
  (husillo, aspiración → en amortización CC)
```

### Familia "cnc" — modos de tiempo

```
modosTiempoSoportados: [T-3, T-4]
modoTiempoDefault: T-3
```

### El paso CNC en la ruta

```typescript
// Producto "Cajas MDF estándar" (caso repetitivo):
pasoRuta {
  familia: "cnc",
  modosTiempoHabilitados: ["T-3"],           // solo productividad
  materiales: [...]
}

// Producto "Pieza CNC custom" (caso a medida):
pasoRuta {
  familia: "cnc",
  modosTiempoHabilitados: ["T-4"],           // solo input manual
  materiales: [...]
}

// Producto "CNC genérico" (flexibilidad):
pasoRuta {
  familia: "cnc",
  modosTiempoHabilitados: ["T-3", "T-4"],    // ambos: comercial elige
  materiales: [...]
}
```

### Patrón nuevo confirmado: "modosTiempoHabilitados" + decisión del comercial

```
La FAMILIA declara modosTiempoSoportados (lista cerrada de modos posibles).
El MODELADOR del producto define modosTiempoHabilitados (subset).
Si modosTiempoHabilitados.length === 1:
  → motor usa ese modo automáticamente, comercial NO elige.
Si modosTiempoHabilitados.length > 1:
  → COMERCIAL elige al cotizar (UI muestra opciones).
```

Este patrón resuelve casos donde un mismo paso puede comportarse distinto según el producto/contexto. Aplica a `cnc` (T-3+T-4), `diseno_grafico` (T-1+T-2 según Fase A), y potencialmente otros.

---

## 13. Plantilla `ANILLADORA` — Modelo final

### Descripción

Máquina que perfora hojas en serie y luego inserta un anillo (espiral plástico o wire-O metálico) para encuadernar.

**Ejemplos**: Renz Combi-S, GBC, Rilecart, MBO, Bindomatic.

**Familia compatible**: `encuadernado_anillado`.

**Productos típicos**: cuadernos, libretas, manuales, catálogos, calendarios, agendas, recetarios.

### Cómo trabaja

1. Setup (~5 min): elegir tipo de anillo, calibrar paso de orificios.
2. Perforación: meter pliegos por tandas (capacidad depende del grosor).
3. Inserción del anillo.
4. Cleanup (~2 min).

### Hallazgo importante: capacidad por diámetro de espiral

Cada **diámetro de espiral/wire-o tiene una capacidad máxima de hojas**. El motor usa esta info para elegir automáticamente la variante correcta según las hojas del libro.

```
Espiral plástica:
  6mm  → cap 25 hojas
  10mm → cap 60 hojas
  15mm → cap 100 hojas
  20mm → cap 150 hojas
  30mm → cap 250 hojas
  50mm → cap 450 hojas

Si el comercial pide libro de 80 hojas:
  → motor busca el espiral más chico con cap >= 80
  → elige Espiral 15mm (cap 100)
```

Esta info se modela en la **materia prima** (cada variante declara `capacidadMaxHojas`). El motor usa el nuevo criterio `MENOR_CAPACIDAD_QUE_CUMPLA` (ver §15).

### MÁQUINA

```
Identidad universal.

Físicos universales (columnas):
  anchoUtilMaxMm  = 360    (largo máximo del anillado)
  altoUtilMm      = 50     (max diámetro de anillo soportado)

paramsTecnicosJson (específico ANILLADORA):
  tiposAnilloSoportados: [ESPIRAL_PLASTICO, WIRE_O]
  pasosOrificiosSoportados: [3:1, 2:1]
```

### PERFIL OPERATIVO

Hay perfiles por TIPO DE ANILLO:

```
Universales (columnas):
  nombre = "Espiral plástico" (o "Wire-O")
  activo = true
  productivityValue   = 1200   (hojas/hora, equivalente a 30s/10h)
  productivityUnit    = HOJAS_H
  setupMin            = 5
  cleanupMin          = 2

Discriminantes (columnas):
  tipoAnillo: ESPIRAL_PLASTICO | WIRE_O

paramsPerfilJson (específico ANILLADORA):
  diametrosSoportadosMm: [6, 10, 15, 20, 30, 50]

Componentes desgaste: ninguno (punzones en amortización CC)
```

### El paso encuadernado_anillado en la ruta

```typescript
pasoRuta {
  familia: "encuadernado_anillado",
  modoTiempo: T-2,
  materiales: [
    {
      slot: "anillo",
      modoSeleccion: "MOTOR_ELIGE_AUTO",
      criterioSeleccion: "MENOR_CAPACIDAD_QUE_CUMPLA",
      criterioInput: "hojasPorLibro",          // del JobContext
      criterioCampoMaterial: "capacidadMaxHojas",  // de la materia prima
      candidatos: [
        "espiral-plastica-6mm",
        "espiral-plastica-10mm",
        "espiral-plastica-15mm",
        "espiral-plastica-20mm",
        "espiral-plastica-30mm",
        "espiral-plastica-50mm"
      ]
    }
  ]
}
```

### Cantidades del paso

```
Cantidad PRINCIPAL: libros (lo que se cobra al cliente)
Cantidad SECUNDARIA: hojas totales = libros × hojasPorLibro

Tiempo:
  hojasTotales = libros × hojasPorLibro
  tiempo_min = setupMin + (hojasTotales / productividad) × 60 + cleanupMin

Material:
  cantidadAnillos = libros (1 anillo por libro)
  varianteAnillo = elegida automáticamente por el motor (criterio capacidad)
  costoAnillos = cantidadAnillos × precio(varianteElegida)
```

---

## 14. Patrón nuevo: criterio MOTOR_ELIGE_AUTO `MENOR_CAPACIDAD_QUE_CUMPLA`

Hasta ANILLADORA teníamos en D.5 estos criterios MOTOR_ELIGE_AUTO:
- `MENOR_COSTO`
- `MAYOR_APROVECHAMIENTO`

Ahora se agrega:
- **`MENOR_CAPACIDAD_QUE_CUMPLA`**: elige la variante MÁS PEQUEÑA cuya capacidad sea suficiente para el JobContext.

### Configuración

```typescript
{
  modoSeleccion: "MOTOR_ELIGE_AUTO",
  criterioSeleccion: "MENOR_CAPACIDAD_QUE_CUMPLA",
  criterioInput: "<campo del JobContext>",       // ej: "hojasPorLibro"
  criterioCampoMaterial: "<campo de materia>",   // ej: "capacidadMaxHojas"
  candidatos: [...]
}
```

### Algoritmo del motor

```
1. Lee del JobContext el valor del criterioInput (requerimiento).
2. Para cada candidato, lee criterioCampoMaterial de su materia prima.
3. Filtra candidatos cuya capacidad >= requerimiento.
4. Si no hay ninguno → ERROR ("requerimiento excede capacidad máxima").
5. Ordena los válidos ascendente por capacidad.
6. Elige el primero (menor capacidad que cumple).
```

### Casos de aplicación

- Anillado: hojasPorLibro vs capacidadMaxHojas del anillo.
- Cualquier otro caso donde "el material más chico que aguante" sea la decisión.

---

## 15. Pendientes para próximas sesiones

### Modelado de plantillas restantes

#### Estructural (próximo bloque a abordar)
- **`SOLDADORA`** — herrería para cartelería estructural. T-2 (cm/min lineal). Consumibles: electrodos, gas.
- **`CABINA_PINTURA`** — pintura aerografíada/laqueado de piezas estructurales. T-3 (m²/h). Consumibles: pintura, laca, solvente.

#### Postergada (no urgente, evaluar luego)
- **`MESA_DE_CORTE`** — decidir si vale modelar como plantilla independiente o si CORTE_LASER + PLOTTER_DE_CORTE cubren los casos.

#### Plantillas a evaluar a futuro (NO prioritarias hoy)
- `IMPRESORA_UV_FLATBED`, `IMPRESORA_UV_CILINDRICA`, `IMPRESORA_DTF`, `IMPRESORA_DTF_UV`, `IMPRESORA_3D` (decidir alcance).
- `BARNIZADORA_UV`, `HOTSTAMPING` (terminaciones específicas — modelar cuando aparezca caso real).

### Plantillas DESCARTADAS explícitamente

- **PERFORADORA, REDONDEADORA_PUNTAS** → modeladas como `modificacion_post` (familias).
- **ENGRAPADORA, ENCOLADORA** → familias M-0 (proceso manual, sin plantilla).
- **COSEDORA, MONTAJE_TAPAS_DURAS** → familias completas descartadas (Corporearte no las usa).
- **MAQUINA_BORDADO** → categoría completa fuera de scope.

### Otros temas abiertos

- Cerrar la lista exhaustiva de **familias compatibles** por plantilla.
- Definir la **tabla de conversión A4-equivalente** completa (con casos exóticos).
- Cerrar **tipos de consumibles** (enum o catálogo dinámico).
- Definir **componentes de desgaste estándar** por plantilla.
- Cómo modelar **planchas / matrices custom** (troqueles, hotstamping) — ¿son materiales del paso o son sub-pasos previos?

### Implicaciones aún por resolver

- Migración de las 5 plantillas eliminadas a `IMPRESORA_GRAN_FORMATO_POR_AREA`: estrategia de migration de datos.
- Cuando se llegue a código, decidir si los `paramsTecnicosJson` tienen schema validado o son libres.
