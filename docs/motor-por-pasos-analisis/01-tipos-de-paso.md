# Inventario de tipos de paso (familias)

> **Fase A** del análisis del motor por pasos.
> **Sesiones**: 1 + 2 (2026-04-23). **Estado**: Fase A COMPLETA — 29 familias modeladas.
> **Método**: análisis interactivo. NO escribir código.

## Propósito

Armar el **catálogo de familias de paso**: la "biblioteca" de tipos de paso que un modelador puede elegir al armar la ruta de cualquier producto.

Cuando un modelador arma una ruta de producción (entidad reusable, ver `07-ruta-de-produccion.md`), **elige familias del catálogo** para componer la lista ordenada de pasos. Después, los productos referencian esa ruta y configuran cada paso (materiales, máquinas, modos).

---

## 1. Categorías de alto nivel (9)

| # | Categoría | Qué agrupa |
|---|---|---|
| 1 | **Pre-prensa** | Preparación previa a imprimir: armado de imposición, proof. |
| 2 | **Producción / impresión** | Lo que aplica tinta o pigmento. |
| 3 | **Corte y formado** | Recortar o moldear: guillotina, plotter, troquelado digital, CNC, plegado, perforado. |
| 4 | **Terminaciones** | Acabados después de imprimir: laminado, barniz, dorado, hotstamping. |
| 5 | **Encuadernación / armado** | Unir piezas en producto final. |
| 6 | **Estructural / montaje físico** | Cartelería, herrería, instalación eléctrica de luminosos. |
| 7 | **Operaciones manuales** | Sin máquina: control, embalaje, conteo, atado, etiquetado. |
| 8 | **Logística / instalación in situ** | Entrega + colocación. |
| 9 | **Servicios profesionales** | Servicios humanos sin producción física: diseño, copywriting, traducciones, asesoría. |

---

## 2. El molde de propiedades de una familia

```
┌─ Identidad ───────────────────────────────────────────────────────┐
│   • Código              (ej: impresion_por_hoja)                   │
│   • Nombre              (ej: "Impresión por hoja")                 │
│   • Categoría           (1 de las 9 de §1)                         │
└────────────────────────────────────────────────────────────────────┘

┌─ Comportamiento ──────────────────────────────────────────────────┐
│   • Relación máquina    (M-0 / M-1 / M-2)                          │
│   • Tipos de tiempo     (LISTA de tipos soportados — modelador     │
│                          elige cuál usar al armar el producto)     │
│   • Unidad productiva   (qué unidad usa para calcular tiempo)      │
│   • Unidad comercial    (qué unidad se cobra al cliente, si       │
│                          difiere de la productiva)                 │
│   • Activación típica   (obligatorio / opcional / condicional)     │
└────────────────────────────────────────────────────────────────────┘

┌─ Interacción con JobContext ──────────────────────────────────────┐
│   • Inputs leídos       (qué necesita del context para calcular)   │
│   • Outputs escritos    (qué salidas canónicas deja)               │
└────────────────────────────────────────────────────────────────────┘

┌─ Materiales típicos ──────────────────────────────────────────────┐
│   • Sustrato principal                                             │
│   • Consumibles máquina                                            │
│   • Insumos del paso                                               │
└────────────────────────────────────────────────────────────────────┘

┌─ Productos donde aplica ──────────────────────────────────────────┐
│   • Lista de productos típicos del rubro                           │
└────────────────────────────────────────────────────────────────────┘
```

### 3 matices clave del molde

#### Matiz A: "Relación máquina" = SOLO máquinas de producción

Las computadoras y herramientas auxiliares NO cuentan como máquina del modelo. Solo las máquinas declaradas como plantillas de maquinaria entran en M-1 / M-2.

#### Matiz B: Una familia puede soportar MÚLTIPLES tipos de tiempo

El "Tipo de tiempo" es una **lista de tipos soportados**. El modelador elige al armar cada producto.

Ejemplo: Diseño gráfico → soporta T-1 (fijo) y T-2 (productividad por hora).

#### Matiz C: Unidad comercial ≠ Unidad productiva

Comercialmente se cobra al cliente en una unidad. Productivamente el motor calcula tiempo en otra. El motor convierte cuando hace falta.

Ejemplo: Plotter de corte de vinilo → comercial: metros lineales / productiva: m²/hora.

---

## 3. Catálogo completo de familias (31)

### 3.1 Pre-prensa (2)

| Familia | Máquina | Tiempo | Unidad | Activación | Outputs |
|---|---|---|---|---|---|
| `pre_prensa` — Pre-prensa / armado de imposición | M-0 | T-1 | trabajos | OBLIGATORIO | imposicion_calculada, cortes |
| `proof` — Proof / pruebas de color | M-1 | T-1 | trabajos | OPCIONAL | proof_aprobado |

### 3.2 Producción / impresión (5)

| Familia | Máquina | Tiempo | Unidad | Activación | Materiales |
|---|---|---|---|---|---|
| `impresion_por_hoja` — Impresión por hoja | M-1/M-2 | T-3 | pliegos | OBLIGATORIO | papel + clics CMYK + tóner |
| `impresion_por_area` — Impresión por área | M-1/M-2 | T-3 | m² | OBLIGATORIO | vinilo/lona/mesh + tinta UV/Látex |
| `impresion_por_pieza` — Impresión por pieza | M-1/M-2 | T-3 | piezas | OBLIGATORIO | sustrato rígido (MDF, PVC, taza, remera) + tinta UV |
| `aplicacion_transfer` — Aplicación de transfer (DTF, DTG) | M-1 | T-3 | piezas | OBLIGATORIO | textil + film transfer + tinta |
| `grabado_laser` — Grabado láser | M-1 | T-3 | piezas o m² | OBLIGATORIO | acrílico, madera, metal, cuero (sin consumible típico) |

### 3.3 Corte y formado (7)

| Familia | Máquina | Tiempo | Unidad | Activación | Notas |
|---|---|---|---|---|---|
| `corte_guillotina` — Corte con guillotina | M-1 | T-3 (compuesto: tandas × cortes) | pliegos + cortes | OBLIGATORIO si hay separación | Guillotina maneja capacidad por tanda según grosor |
| `plotter_corte` — Plotter de corte | M-1 | T-3 (m²/h) | m² productiva / ml comercial | OBLIGATORIO en vinilos | Skycut, Roland, etc. — vinilo en rollo |
| `corte_laser` — Corte láser | M-1 | T-3 | m² o piezas | OBLIGATORIO si producto requiere | Distinto a Grabado: corte atraviesa, grabado marca |
| `troquelado_digital` — Troquelado digital | M-1 | T-3 | piezas | OBLIGATORIO si producto requiere | Mesa de corte digital tipo Esko/Zund (sustrato en hoja) |
| `cnc` — CNC | M-1 | T-3 | piezas o m² | OBLIGATORIO | Para piezas planas (3D fuera de scope hoy) |
| `plegado` — Plegado | M-1 o M-0 | T-3 o T-2 | pliegos plegados | OBLIGATORIO si producto pliega | Manual o con plegadora |
| `perforado` — Perforado / puntillado | M-1 o M-0 | T-3 (perforaciones/min) | piezas + perforaciones | OBLIGATORIO si requiere | Unidad compuesta como guillotina |

### 3.4 Terminaciones (4)

| Familia | Máquina | Tiempo | Unidad | Activación | Materiales |
|---|---|---|---|---|---|
| `laminado` — Laminado | M-1 | T-3 (m/min lineal) | metros lineales | OPCIONAL | Film BOPP / mate / brillo / UV |
| `barniz` — Barniz | M-1 | T-3 | pliegos o m² | OPCIONAL | Barniz UV / agua |
| `acabado_decorativo` — Hotstamping, dorado, gofrado | M-1 | T-3 (golpes/min) | piezas | OPCIONAL | Film metálico (oro, plata, holograma); a veces matriz custom |
| `pintura_superficial` — Pintura superficial | M-1 (cabina) o M-0 (manual) | T-3 o T-2 | piezas o m² | OPCIONAL | Pintura / laca |

### 3.5 Encuadernación / armado (4)

| Familia | Máquina | Tiempo | Unidad | Activación | Materiales |
|---|---|---|---|---|---|
| `encuadernado_engrapado` — Engrapado (caballete / lateral) | M-0 | T-2 (libros/h) | libros | OPCIONAL | Grapas (consumible). Sin sub-tipos: caso único "engrapado". |
| `encuadernado_anillado` — Espiral / wire-o | M-1 (ANILLADORA) | T-2 (productividad hojas/h) | libros (principal) + hojas totales (secundaria) | OPCIONAL | Anillo (motor elige variante por capacidad) |
| `engomado_emblocado` — Engomado / emblocado | M-0 | T-2 (blocks/h) | blocks | OBLIGATORIO en talonarios | Cola/goma. **Materiales OPCIONALES en slots**: cartón base, hoja blanca superior — modelador habilita si aplica. |
| `armado_cajas` — Armado de cajas / packaging | M-0 | T-2 (cajas/h) | cajas | OBLIGATORIO si producto va en caja | Cinta + plantilla de caja |

> **Descartadas (Corporearte no las usa)**:
> - `encuadernado_cosido` — no se hace encuadernación cosida.
> - `tapas_duras` — no se hace montaje de tapas duras.

### 3.6 Estructural / montaje físico (3)

| Familia | Máquina | Tiempo | Unidad | Activación | Materiales |
|---|---|---|---|---|---|
| `soldadura` — Soldadura (herrería) | M-0 (herramientas) o M-1 si soldadora industrial | T-2 (cm/min) | metros lineales | OBLIGATORIO en cartelería | Electrodos, gas |
| `ensamble_estructural` — Ensamble estructural | M-0 | T-1 o T-2 | piezas o m² | OBLIGATORIO en cartelería | Tornillos, perfiles, herrajes |
| `instalacion_electrica` — Instalación eléctrica luminosos | M-0 | T-2 (h/luminoso) | luminosos | OPCIONAL | Cables, transformadores, LEDs |

### 3.7 Operaciones manuales (5 + 2 sub-categoría "Modificaciones físicas")

#### Operaciones manuales clásicas

| Familia | Máquina | Tiempo | Unidad | Activación | Materiales |
|---|---|---|---|---|---|
| `embalaje` — Embalaje | M-0 | T-2 (cajas/h) | cajas o piezas | OBLIGATORIO | Bolsas, cajas, cinta |
| `conteo_manual` — Conteo manual | M-0 | T-2 | piezas | OPCIONAL | N/A |
| `atado_banding` — Atado / banding | M-0 | T-2 | atados | OPCIONAL | Cinta, hilo |
| `etiquetado_manual` — Etiquetado manual | M-0 | T-2 | etiquetas | OPCIONAL | Etiquetas adhesivas |
| `control_calidad` — Control de calidad | M-0 | T-1 o T-2 | piezas | OPCIONAL | N/A |

#### Modificaciones físicas (sub-categoría nueva, 2 familias)

Operaciones que alteran físicamente el producto, ejecutadas manualmente o con herramientas auxiliares (no máquinas industriales del catálogo).

Reemplazan plantillas anteriores como PERFORADORA, REDONDEADORA_PUNTAS, etc. — ver `06-maquinas-y-perfiles.md` para la justificación.

| Familia | Máquina | Tiempo | Unidad | Activación | Notas |
|---|---|---|---|---|---|
| `modificacion_pre` — Modificación pre-producción | M-0 | T-1 o T-2 | depende sub-tipo | OPCIONAL | **MUTA el JobContext** (modifica medidas/valores antes de pasos de producción). Ej: bolsillos en lona, refuerzos en bordes, dobladillo. |
| `modificacion_post` — Modificación post-producción | M-0 | T-1 o T-2 | depende sub-tipo (pueden ser multi-cantidad: piezas + perforaciones) | OPCIONAL | Se ejecuta DESPUÉS de los pasos de producción. NO altera valores previos. Ej: perforaciones, redondeo de puntas, numeración. |

**Sub-tipos configurables**: cada paso del producto declara el sub-tipo concreto + parámetros (lados, anchos, cantidades, etc.).

Sub-tipos típicos de `modificacion_pre`:
- `bolsillo_lona` (lados, anchoBolsilloMm)
- `refuerzo_bordes` (lados)
- `dobladillo` (anchoMm)
- `ojales_con_margen` (cantidad, anchoMargenMm)

Sub-tipos típicos de `modificacion_post`:
- `perforacion` (cantidadPorPieza, posicion)
- `redondeo_puntas` (radioMm, esquinas)
- `numeracion` (digitos, formato)
- `aplicacion_pegamento`
- `aplicacion_velcro`

### 3.8 Logística / instalación in situ (3)

| Familia | Máquina | Tiempo | Unidad | Activación | Cargos típicos |
|---|---|---|---|---|---|
| `envio` — Envío / despacho | M-0 | T-1 o T-2 (km) | envíos o km | OPCIONAL | Combustible (cargo flat o por km) |
| `instalacion_in_situ` — Instalación en sitio | M-0 | T-2 (m²/h o h/punto) | m² o puntos | OPCIONAL | Herramientas (no consumibles típicos) |
| `toma_medidas` — Toma de medidas en sitio | M-0 | T-1 (por visita) | visitas | OPCIONAL | Viático posible (cargo flat) |

### 3.9 Servicios profesionales (1 hoy + futuros)

| Familia | Máquina | Tiempo | Unidad | Activación | Notas |
|---|---|---|---|---|---|
| `diseno_grafico` — Diseño gráfico | M-0 | T-1 o T-2 | trabajos o horas | OPCIONAL | Diseño estándar (fijo) o custom (por hora). Modelador elige modo. |

> **Futuras**: `copywriting`, `traducciones`, `asesoria`, `retoque_fotografico`. Patrón similar a `diseno_grafico` (M-0, T-1 o T-2).

---

## 4. Total

**29 familias activas** distribuidas en 9 categorías.

**Descartadas explícitamente** (Corporearte no las usa):
- Bordado (categoría completa)
- `encuadernado_cosido`
- `tapas_duras`

---

## 5. Próximos pasos

1. **Revisar el catálogo de salidas canónicas** (siguiente sesión inmediata): cerrar la lista exhaustiva de outputs que los pasos pueden escribir al JobContext.
2. **Fase C — Modelo conceptual del motor**: pseudocódigo del flujo del motor por pasos.

---

## 6. Convenciones del método interactivo

(Igual que en `02-anatomia-de-un-paso.md`).
