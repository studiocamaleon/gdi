# Holdprint — plantillas de maquinaria: relevamiento completo

**Fecha:** 2026-08-04 · **Fuente:** cuenta trial del usuario (app.holdprint.net), leída
desde el navegador con autorización. Los valores salen del modelo de datos de la
app (AngularJS: `equipmentsCtrl.costEngineeringModelList` + `load()` por equipo),
no de la UI, así que son los defaults exactos que Holdprint siembra en cada tenant.

Complementa `project_analisis_competitivo_holdprint` (memoria, 2026-07-21) con el
detalle campo por campo. Objetivo inmediato: decidir la plantilla `IMPRESORA_3D`
para nuestro sistema.

---

## 1. Cómo modela Holdprint una plantilla de máquina

Su unidad es el **“modelo de ingeniería de costos” (CEM)**: una plantilla con
bloques de parámetros. Un equipo es una *instancia* de un CEM con valores.

```
CEM (plantilla)  →  Equipo (instancia con valores)  →  Proceso (qué equipo/perfiles usa)
```

**Los tres bloques que se repiten en todo el catálogo:**

| Bloque | Qué es | Quién lo tiene |
|---|---|---|
| `*_PROPERTIES` | Envolvente física de trabajo | todas |
| `STANDARD_LEFTOVERS_AND_MARGINS` | Márgenes no utilizables (sup/inf/izq/der) | **todas las impresoras menos la 3D** |
| `*_PROFILES` / `*_PROFILE` | La tabla de perfiles: una fila por combinación | todas |

**Envolvente según geometría** (el campo cambia, el concepto no):
`MOUTH` (boca, rollo) · `MAX_WIDTH`+`MAX_HEIGHT` (hoja) · `WIDTH`+`LENGTH` (flatbed) ·
`MAX_LENGTH`+`MAXIMUM_DIAMETER` (cilíndrica) · `MAX_WIDTH_X`+`MAX_LENGTH_Y`+`MAX_THICKNESS_Z`
(mecanizadas) · `MAX_WIDTH`+`MAX_HEIGHT`+`MAXIMUM_DEPTH` (3D).

Catálogo: **18 plantillas** (`LASER_CUTTING`, `CNC_ROUTER`, `CUTTING_PLOTTER`,
`CUTTING_TABLE`, `UV_360_PRINTER_CYLINDRICAL`, `UV_PRINTER_WITH_EXTENSION_TABLE_BELT`,
`CAD_PLOTTER_PRINTER`, `UV_ROLL_TO_ROLL_PRINTER`, `SOLVENT_PRINTER`, `LATEX_PRINTER`,
`UV_FLATBED_PRINTER`, `LASER_PRINTER`, `INKJET_PRINTER`, `SUBLIMATION_PRINTER_LARGE_FORMATS`,
`SUBLIMATION_PRINTER_SMALL_FORMATS`, `DTF_PRINTER`, `DTF_UV_PRINTER`, `3D_PRINTER`).

---

## 2. IMPRESORA 3D — la plantilla que buscábamos

### Estructura

```
PRINTER_PROPERTIES:  MAX_WIDTH (cm) · MAX_HEIGHT (cm) · MAXIMUM_DEPTH (cm)
PRINTING_PROFILES:   NAME | WIDTH (cm) | HEIGHT (cm) | DEPTH (cm)
                          | FILAMENT_USED (m) | TIME_SPENT (hr)
```

**Es la única impresora SIN bloque de márgenes** — coherente: en 3D no hay
sustrato del que descontar borde.

### Defaults sembrados

Envolvente: **42 × 42 × 42 cm**.

| Perfil | Caja (An×Al×Prof cm) | Filamento | Tiempo |
|---|---|---|---|
| Impresión de hasta 1.000 cm³ | 10 × 10 × 10 | 91 m | 12 h |
| Impresión de hasta 8.000 cm³ | 20 × 20 × 20 | 91 m | 12 h |
| Impresión de hasta 27.000 cm³ | 30 × 30 × 30 | 91 m | 12 h |
| Impresión hasta 64.000 cm³ | 40 × 40 × 40 | 91 m | 12 h |

⚠️ **Los cuatro perfiles traen el MISMO filamento y el MISMO tiempo.** Sólo cambia
la caja. O sea: los defaults de Holdprint para 3D **no están calibrados**, son un
esqueleto para que lo llene el tenant. El nombre habla de volumen (cm³) pero el
dato guardado es un *bounding box*; el volumen es la interpretación del nombre.

### El proceso que la usa

Proceso **“Impresión 3D”** (`publicId` 199):

```
EQUIPMENTS:    template 3D_PRINTER + equipo “Impresora 3D” + lista de los 4 perfiles
RESTRICTIONS:  FILL_PERCENTAGE = 15 %
```

Dos cosas importantes:

1. **El relleno (infill) vive en el PROCESO, no en la máquina** — 15 % por defecto.
   Es el parámetro que más mueve el consumo real y lo modelan como restricción del
   proceso.
2. **El perfil se elige a mano al cotizar**: el equipo publica la lista de perfiles
   (`processEquipamentQualitySelecteds`) y el presupuesto guarda el elegido en
   `budgetEquipamentQualitySelecteds`. **No hay auto-resolución por geometría de la
   pieza** — nadie compara el volumen del modelo contra las cajas.

Existe además el proceso **“Acabado para impresión 3D”**: manual, sin máquina, con
consumo de material por AREA + `SETUP_TIME` 10 min + 1 persona asignada.

---

## 3. Defaults de las demás plantillas

### 3.1 Mecanizadas (patrón: envolvente + perfiles por operación × material × espesor)

Columnas idénticas en las cuatro: `NAME | TYPE | FAMILY | THICKNESS (mm) |
PRODUTIVITY | SETUP (min)`. `TYPE` ∈ CUTTING / ENGRAVING / HALF_CUT / CREASING.
`FAMILY` es **multi-valor** (un perfil puede cubrir varios materiales).
**Setup = 10 min en todas las filas de todas las máquinas.**

**CNC router** — X 2,8 m · Y 5 m · Z 150 mm · productividad en **m/h**:

| Perfil | Tipo | Material | Espesor | m/h |
|---|---|---|---|---|
| MDF 3/5/9/15/18 mm | CUTTING | MDF | 3→18 mm | 100 / 50 / 30 / 20 / 10 |
| ACM 3 mm | CUTTING | ACM | 3 | 25 |
| Acrílico 2/3/5/10/20 | CUTTING | ACRILIC | 2→20 | 35 / 30 / 25 / 20 / 17 |
| PS 2 mm | CUTTING | PS | 2 | 40 |
| PVC Exp 2/5/10/15/20/30 | CUTTING | PVC+EXPANDED | 2→30 | 35 / 20 / 19 / 15 / 13 / 10 |
| Grabación | ENGRAVING | SHEETS | 100 | 1000 |
| Semi-cortado | HALF_CUT | SHEETS | 2 | 200 |

**Corte láser** — X 2,5 m · Y 5 m · Z 30 mm · **m/h**:
corte 2/5/7/10/30 mm → 450 / 120 / 90 / 30 / 20 · grabación sencilla (MDF, compacto,
multilaminado, madera dura, madera, acrílico) 1500 · semicorte 600.

**Mesa de corte** — X 4,3 m · Y 4 m · Z 50 mm · **m/h**:
corte 10/20/30/40/50 mm → 100 / 90 / 80 / 70 / 60 · **Pliegue (CREASING) 120** ·
semicorte 60.

**Plotter de recorte** — boca 1,6 m · **m²/h**: corte simple 8 · corte complejo 4
(ambos espesor 0,08 mm, familia ADESIVES).

### 3.2 Impresoras de rollo/área (patrón: boca + márgenes + perfiles en m²/h)

Columnas: `NAME | PRODUTIVITY (m²/h) | RIP (min) | MEDIA_HIT (min) | INK (ml/m² por color)`.

| Equipo | Boca | Márgenes S/I/Iz/D | Perfiles (m²/h) | Tinta ml/m² |
|---|---|---|---|---|
| Solvente | 3,2 m | 15/15/1/1 cm | Alto 40 · Promedio 80 · Bajo 150 | CMYK 3 · RIP 3 · carga 2 |
| Látex | 1,63 m | 1/1/1/1 cm | Alta 14 · Media 17 · Baja 20 | CMYK+Lc+Lm+opt 6/5/4 · RIP 5 · carga 5 |
| UV rollo a rollo | 3,2 m | 15/15/1/1 cm | Calidad 30 · Producción 80 | CMYK 2,5 · RIP 5 · carga 5 |
| UV + plataforma | 2,5 m | 15/15/1/1 cm | Calidad 15 · Producción 50 | CMYK+Lc+Lm+W 10 / 5 · RIP 3 · carga 2 |
| UV cama plana | 1,2 × 2,5 m | **0/0/0/0** | Calidad 15 · Producción 25 · Regalos 0,4 | 7 canales 2 · RIP 3 · carga 2 |
| Sublimación GF | 1,6 m | 15/15/1/1 cm | Calidad 15 · Producción 30 | CMYK 3 / 2,5 · RIP 3 · carga 2 |
| CAD / plotter | 1,2 m | 15/15/0,5/0,5 cm | Lineal 51 · Colorido 10 · Lineal B/N 51 | 1 (B/N: negro 5,71) · RIP 3 · carga 2 |
| DTF | 60 cm | 4 mm en los 4 lados | 4/6/8/10 pasadas → 8 / 7 / 6 / 4 | CMYK+W 2,5 / 3,5 / 5 / 7 |
| DTF UV | 60 cm | 4 mm en los 4 lados | 4/6/8/10 pasadas → 7 / 5 / 3 / 2 | CMYK+W+barniz 5 / 7 / 8 / 10 |

**UV 360 cilíndrica** — largo 280 mm · Ø 160 mm · márgenes sup/inf 15 mm ·
productividad en **unidades/h** + `MEDIA_CHANGE` (cambio de pieza) 40 s:
Solo CMYK 120 · CMYK+Blanco 90 · CMYK+Blanco+Barniz 70 (tinta 10, blanco 15, barniz 12).

### 3.3 Impresoras de hoja (perfil = tamaño × modo × calidad)

Columnas: `NAME | WIDTH | HEIGHT | PRINTING_MODE | PRODUTIVITY (unidad/min) |
RIP | MEDIA_HIT | TONER/INK`. Envolvente 29,7 × 42 cm, márgenes 1 cm en los 4 lados.

**Láser** — 18 perfiles (A4/A5/A3 × B&N/Color × Rápido/Normal/Alta):
A4 33/27/22 ppm · A5 66/54/44 · A3 16/13/11. **La velocidad NO cambia entre B/N y
color**; lo que cambia es el tóner: 1 / 2 / 3 ml por color según calidad.

**Inyección de tinta** — 15 perfiles: A4 15/10/5 (normal/alta/foto) · A5 30/20/10 ·
A3 8/5/3. Tinta 4 → 12 ml según calidad.

**Sublimación formatos chicos** — productividad en **unidades/h**:
A4 200/250 · A5 400/500 · A3 100/125 (alta/baja calidad); tinta CMYK 6 / 4 / 8.

---

## 4. Qué sacamos de esto para nuestro sistema

### 4.1 Confirmaciones (vamos bien)

- **Nuestro patrón de perfiles láser/CNC es el mismo que el de ellos**
  (operación × material × espesor → velocidad + setup). Lo que armamos en
  `docs/maquinas-mecanizadas-corte-laser-cnc-diseno.md` no le debe nada.
- **Sacar los “parámetros técnicos” decorativos fue correcto**: Holdprint NO guarda
  potencia de husillo, tipo de láser ni RPM en ninguna plantilla. Sólo envolvente +
  perfiles. Exactamente donde terminamos esta semana.
- **Márgenes no utilizables en las mecanizadas**: ellos no los tienen en láser/CNC
  (sólo en impresoras), pero el concepto es el mismo que acabamos de agregar. Sus
  defaults sirven de referencia: 1 cm laterales, 15 cm de avance en rollo grande.
- La **plancha térmica** nuestra (perfil por ciclo → piezas/h) es el equivalente de
  su cilíndrica (unidades/h + cambio de pieza). Mismo concepto, distinto nombre.

### 4.2 Ideas concretas para robar

1. **`FAMILY` multi-valor en el perfil.** Un perfil suyo cubre varios materiales
   (“Grabación sencilla” = MDF + compacto + multilaminado + madera + acrílico).
   Nuestro perfil operativo tiene UN material por fila → obliga a duplicar filas.
   Cambio chico y de alto impacto en la carga de datos.
2. **`CREASING` (pliegue/hendido) como tipo de operación** en mesa de corte. Nosotros
   lo tenemos como paso manual (“Hendido/Perforado”); podría ser un `tipoOperacion`
   más de las mecanizadas.
3. **Separar RIP de carga de material.** Ellos parten el setup en `RIP` (procesar el
   archivo) + `MEDIA_HIT` (cargar el material), con default universal 3 + 2 min.
   Nuestro `setupMin` los mezcla. El desglose explica mejor el número al tenant.
4. **Sus defaults como semilla de nuestras plantillas.** Todo el §3 es una tabla de
   valores plausibles que hoy nuestros tenants tienen que inventar. Sirve como
   “valores sugeridos” al crear una máquina.

### 4.3 La plantilla 3D: qué copiar y qué NO

**Copiar:** el esqueleto (envolvente X/Y/Z + tabla de perfiles), y sobre todo el
**`FILL_PERCENTAGE` a nivel paso** — es el parámetro que gobierna el consumo real.

**No copiar:** el eje de resolución. Su bucket por bounding box con filamento y
tiempo *fijos* es débil por tres motivos:
- Una pieza de 10×10×10 cm hueca y una maciza consumen muy distinto: el bounding
  box no dice nada del volumen real.
- No hay auto-resolución: el comercial elige el bucket a mano igual.
- Sus propios defaults lo delatan (91 m / 12 h en los cuatro).

**Propuesta para nosotros** (a validar con el usuario):

- Plantilla `IMPRESORA_3D`: envolvente X/Y/Z + discriminante de tecnología
  (FDM/filamento vs resina — cambia el consumible y la merma).
- Perfil por **material × calidad (altura de capa)** con productividad real en
  **gramos/hora** (o cm³/h), que es como se comporta la máquina, en vez de un tiempo
  fijo por caja.
- La magnitud del paso es el **volumen o el peso de la pieza**, con el **relleno %**
  como multiplicador — igual que su `FILL_PERCENTAGE` pero conectado al cálculo.
- **Override por slicer con T-4** (tiempo manual, ya en producción): el taller serio
  cotiza con las horas y los gramos que le da el slicer. Los perfiles quedan para la
  cotización rápida sin slicer.
- Consumible: la biblioteca ya tiene `ADITIVA_3D` → `FILAMENTO_3D` / `RESINA_3D`.
  Decidir gramos (empata con el rollo de 1 kg que se compra) vs metros (lo que usa
  Holdprint).

---

## Apéndice — cómo se leyó

La app es AngularJS. El catálogo de plantillas vive en
`equipmentsCtrl.costEngineeringModelList`; cada equipo se hidrata con `row.load()`
(GET `/api/equipments/?id=…`). Las etiquetas de columna son ids de `fieldType` que se
resuelven con el servicio `Field.loadFieldsFromArray(ids)` (POST `/fields/find`), y las
unidades con `MeasurementUnit.loadAll()`. Todo lectura; no se modificó nada en la
cuenta.
