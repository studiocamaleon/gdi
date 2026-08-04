# Holdprint — los 118 procesos: relevamiento y comparación con nuestros pasos

**Fecha:** 2026-08-04 · **Fuente:** cuenta trial del usuario, leída del modelo de datos
de la app (no de la UI). Complementa
[holdprint-plantillas-maquinaria-relevamiento.md](holdprint-plantillas-maquinaria-relevamiento.md).

Su “Proceso” = nuestra **familia de paso**. Ellos traen **118 procesos** instalados
de fábrica; nosotros tenemos **28 familias**. La diferencia no es sólo cantidad:
buena parte de sus 118 son variantes que en nuestro modelo serían el mismo paso con
otra configuración. Lo que importa es **el modelo**, y ahí sí hay cosas para robar.

---

## 1. Anatomía de un proceso en Holdprint

Un proceso es una lista de **bloques de parámetros**. Los que aparecen:

| Bloque | Qué hace |
|---|---|
| `PRODUTIVITY` | Caso simple: productividad + `SETUP_TIME` + **`NUM_ALLOCATED_PERSON`** |
| `PRODUTIVITY_TABLE` | Tabla: variante → productividad (el caso más común) |
| `MATERIALS` | Tabla de insumos: `TYPE, CALCULATION, CONSUMPTION, PRODUCTIVITY, FEEDSTOCK` |
| `EQUIPMENTS` | Máquina(s): plantilla + equipos + perfiles habilitados |
| `RESTRICTIONS` | Reglas del acomodo (o `FILL_PERCENTAGE` en 3D) |
| `PRINT_SIMULATOR_PARAMETERS` | Precisión + lista de algoritmos de nesting |
| `MEDIA_LEFT_OVER_COPY` | **Sobra de material que el proceso agrega** (sup/inf/izq/der) |
| `LABOR_FOR_MATH_FUNCTION` | **Fórmula HPL** (escape hatch programable) |
| `PROCESSES_GROUPING` | Agrupar el proceso entre ítems del trabajo |
| Bloques de dominio | `TYPE_OF_EYELETS`, `ROPE_TYPE`, `LED_MODULE`, `WIRES`, `FRAME`… |

### Ejes de la tabla de productividad

No hay uno solo — cada proceso elige el suyo. Los vistos:

- `FAMILY_TO_CUT` / `FAMILY_TO_CREASING` (familia de material, **multi-valor**) + `MAX_THICKNESS` → m/h
- `TYPE` → m²/h (aplicaciones, envolvimiento)
- `MAX_WIDTH` + `MAX_HEIGHT` → unidades/h (**productividad por rango de medida**)
- `DESCRIPTION` + `CALCULATION` + `CONSUMPTION` + `FEEDSTOCK` → consumo e insumo juntos
- `TIME_A (min)` por tipo (Servicio de Arte: 10 filas; Modelado 3D: 8 filas)

### HPL: su lenguaje de fórmulas

Cuando la tabla no alcanza, el proceso apunta a un **script HPL** (DSL en portugués,
tipado). Ejemplo real (proceso “Corte especial”):

```
texto opcoes = checklist{"qual_sera_o_formato_do_cartao_de_visita?"}
flutuante tempo_gasto = 0,0

SE (opcoes igual "Bordas Arredondadas") {tempo_gasto = ((5/60) + (adimensional(perimetro)/250))}
SE (opcoes igual "Redondo")             {tempo_gasto = ((5/60) + (adimensional(perimetro)/400))}
SENÃO                                    {tempo_gasto = ((5/60) + (adimensional(perimetro)/350))}

tempo_gasto
```

Lo que expone el lenguaje:
- **Variables de contexto**: `perimetro`, `metragem_quadrada`, `quantidade`, medidas.
- **`checklist{"pregunta"}`**: lee la respuesta del wizard de cotización. Esta es la
  pieza clave — el tiempo depende de lo que contestó el comercial.
- `adimensional()` para quitar la unidad, `SE/SENÃO`, y devuelve la última expresión
  (en horas). El setup suele ir hardcodeado como `(5/60)`.

Otros ejemplos: grabado láser por complejidad (`Alta/Média/Baixa` → m²/1, /1.5, /2),
impresión por calidad × frente-y-dorso (m²/100 … m²/300), encuadernado por tamaño de
agenda con rama “Personalizado” que lee **otra** pregunta del wizard.

### Parámetros del simulador de impresión

Todos los procesos de impresión traen:

```
RESTRICTIONS: REUSE_BINS · SAME_SUPPLIER · ACCEPT_VERTICAL_CUTS · ACCEPT_HORIZONTAL_CUTS
              INFINITE_HEIGHT · CONSIDER_FULL_OPENING · CONSIDER_AMENDMENTS_NUMBER
              PRINTED_AMENDMENT · MINIMAL_CUT_IN_CASE_OF_AMENDMENTS = 700 mm
PRINT_SIMULATOR_PARAMETERS: CALCULATION_ACCURACY = HIGH | VERY_HIGH
              USED_ALGORITHMS = [GUILLOTINE_BAF_MAXAS, GUILLOTINE_BSSF_SAS,
                                 GUILLOTINE_BSSF_LAS, GUILLOTINE_BSSF…]  (rígida: SKYLINE_MWFL_WM)
```

“Amendment” = empalme/panel. `MINIMAL_CUT_IN_CASE_OF_AMENDMENTS` (700 mm) es su ancho
mínimo de panel; el nuestro es `MIN_PANEL_MAX_WIDTH_MM = 300`.

---

## 2. Cobertura funcional: qué procesos tienen y nosotros no

### Cubiertos por nuestras familias (mapeo directo)

Impresión láser/inyección → `impresion_por_hoja` · solvente/látex/UV rollo/sublimación
GF → `impresion_por_area` · UV 360 y UV en objetos → `impresion_por_pieza` ·
DTF y UV DTF → `aplicacion_transfer` (+`_textil`) · corte y grabado láser →
`corte_laser`/`grabado_laser` · fresadora y grabación router → `cnc` · mesa de corte →
`troquelado_digital` · recorte electrónico → `plotter_corte` · corte manual →
`corte_manual` · acabado de pliegue → `plegado` · laminación → `laminado` · ojales
(4 variantes) → `colocacion_ojales` · vaina/palo/perfil C/tubo → `modificacion_post` ·
aplicación en sustrato → `montaje_sobre_sustrato` · embalaje caja/bobina → `embalaje` ·
instalación y traslados → `instalacion_in_situ` · servicio de arte → `diseno_grafico` ·
pintura/barniz → `pintura_superficial` · pegamento → `engomado_emblocado` ·
calandra y prensa térmica → `aplicacion_transfer_textil` · estructuras →
`ensamble_estructural` · encuadernación → `encuadernado_anillado`.

### GAPs reales (procesos que no tenemos)

| Proceso | Comentario |
|---|---|
| **Impresión 3D** + Acabado 3D + **Servicio de Modelado 3D** | en análisis; el modelado 3D es un servicio de diseño aparte |
| **Serigrafía** + Fabricación de moldes serigrafados | 20 filas de material; incluye `SCREEN_EXPOSURE` (10 min) |
| **Bordado** | consumo de hilo + entretela (`INTERFACING`), productividad 300 |
| **Impresión DTG** | directo a prenda, por fórmula de calidad |
| **Iluminación** (retroiluminación, frontlight, tira LED, estuche de letras) | 4 procesos con módulos LED, cables, fuentes, separación entre módulos |
| **Envolvimiento** (wrapping vehicular) | 9 tipos con m²/h propio |
| **Termomodelado** (caja de letras, chapa metálica) | letra corpórea |
| **Pulido y espejado** | 3 compuestos con consumo en ml |
| Grabado en vidrio · Martillo de oro (hot stamping) · Lavado técnico · Limpieza de tapicería · Descontaminación de pintura · Conjunto de botones · Aplicación de máscara de transferencia | menores, muy de nicho |
| **Desplazamiento del equipo** | vehículo + **combustible** + velocidad media + km |

Casi todos los gaps caen en **cartelería/comunicación visual y textil**, que es el
core de Holdprint. Ninguno es un agujero en nuestro rubro actual (gráfica + centro de
copiado); son la frontera a la que nos expandiríamos.

---

## 3. Qué robar — ordenado por relación valor/esfuerzo

### 3.1 `NUM_ALLOCATED_PERSON` — cantidad de personas por paso ⭐

Casi todos sus procesos declaran cuántas personas ocupa (instalación 2, montaje de
fachada 2, pulido 2, limpieza 1…). **Nosotros no tenemos este concepto**: la mano de
obra entra por setup/cleanup con una sola tarifa, y el runtime de máquina no cobra
operario ([[project_mano_obra_setup_cleanup]]). Para instalación y montaje —donde el
costo ES la gente— nos falta multiplicar por N.

Esfuerzo chico: un campo por familia/paso + multiplicar la MO. Impacto grande en
cartelería, instalación y todo lo manual.

### 3.2 `MEDIA_LEFT_OVER_COPY` genérico — el paso declara su sobra de material ⭐

Cualquier proceso declara cuánto material extra necesita, por lado, con una
descripción legible (“Sobra para el acabado de lona”: 10–15 cm por lado; router y
láser: 0,1 cm; “Sobrante para recortar”: 10 cm).

Nosotros tenemos lo mismo pero **hardcodeado en dos lugares distintos**: la demasía de
modificaciones físicas (bolsillo/refuerzo) y los márgenes de máquina. Generalizarlo a
“cualquier paso puede declarar margen extra con motivo” unifica ambos y habilita casos
nuevos sin tocar el motor. Ya tenemos `extraMargins` en `nestingConfig` — falta
exponerlo por paso con etiqueta y que sume en cascada.

### 3.3 `FAMILY` multi-valor + productividad por rango de medida

Dos mejoras a nuestras tablas de perfil/productividad:
- Un perfil que cubre **varias familias de material** (hoy duplicamos filas).
- Productividad **por rango de medida** (`MAX_WIDTH`/`MAX_HEIGHT` → unidades/h), que
  usan en banderas, toldos y perfil C. Nuestras matrices son de tarifa, no de tiempo.

### 3.4 Costeo de logística: vehículo + combustible + km

“Desplazamiento del equipo”: tabla `VEHICLE | CONSUMO | AVERAGE_SPEED | FUEL` que
deriva litros de los km y los cotiza contra el insumo combustible. Nuestro
`instalacion_in_situ` no modela el viaje. Es un costo real que hoy se pierde.

### 3.5 El escape hatch: fórmulas vs. nuestro T-4

Su HPL resuelve “el tiempo depende de lo que contestó el comercial”. Nosotros tenemos
**T-4 (input manual)**, que resuelve el mismo problema pidiéndole el número a la
persona en vez de calcularlo.

No propongo construir un lenguaje: es un módulo enorme y una superficie de soporte
brutal. Pero sí hay un punto intermedio valioso: **productividad que dependa de una
respuesta del comercial** (ej. complejidad Alta/Media/Baja → tres velocidades), que es
el 80 % de lo que hacen sus scripts. Eso es una tabla más, no un intérprete — y encaja
con la `PRODUTIVITY_TABLE` de 3.3.

### 3.6 Detalles menores que suman

- **Tiempos auxiliares nombrados** (`SCREEN_EXPOSURE` 10 min en serigrafía): tiempo de
  proceso que no es setup ni run. Hoy lo meteríamos en setup y se pierde la razón.
- **`PROCESS_GROUPING`**: marcar que un paso se agrupa entre ítems del mismo trabajo
  (ellos lo usan en recorte electrónico y semicorte). Es el primo de nuestros
  simuladores de consolidación, pero declarado en el paso.
- **`MINIMUM_CONSUMPTION`** (pintura automotriz: 500 ml): consumo mínimo por trabajo,
  independiente del tamaño. No lo tenemos.
- **`CALCULATION_ACCURACY`** por proceso: cuánto esfuerzo de cómputo poner en el
  acomodo. Nosotros elegimos algoritmo pero no “precisión”.

---

## 4. Lo que tenemos y ellos no (para calibrar)

No todo es aprender. Contra su modelo de procesos, nosotros ya tenemos:

- **Pasos tercerizados por paso** con matriz/tarifa/fijo y OT de compra.
- **Adicionales = pasos opcionales** activables por el comercial, con reglas.
- **Activación condicional por reglas** (`modoActivacion` CONDICIONAL + condiciones).
- **Multi-máquina candidata** con selección implícita por modo de color.
- **Registro de tiempos por tramos** con pausas motivadas y métricas por operario.
- **Capacidad/ETA con simulación** (mesa de luz) — ellos calculan una entrega esperada
  simple.
- **Tiempo manual por paso** con unidad configurable y obligatoriedad.
- **Cobertura de tóner por nivel** y costo por click — su modelo de tóner es ml/m² fijo.

Su ventaja real no está en el motor de pasos sino en la **amplitud del catálogo**
(118 procesos listos) y en el **wizard reactivo** que los alimenta.

---

## 5. Propuesta de orden

1. `NUM_ALLOCATED_PERSON` (personas por paso) — chico, alto impacto.
2. `MEDIA_LEFT_OVER_COPY` generalizado (margen extra por paso, con motivo) — unifica
   dos mecanismos que ya existen.
3. `FAMILY` multi-valor en perfiles + productividad por rango de medida.
4. Productividad por respuesta del comercial (el 80 % de HPL sin intérprete).
5. Costeo de viaje (vehículo/combustible/km) en `instalacion_in_situ`.
6. Menores: consumo mínimo, tiempos auxiliares nombrados, `PROCESS_GROUPING`.

Los GAPs de catálogo (serigrafía, bordado, iluminación LED, wrapping, termomodelado)
son decisiones de **expansión de rubro**, no deudas del motor: cuando se decida
entrar, cada uno es una familia nueva con el modelo que ya tenemos.

---

## Apéndice — cómo se leyó

Los 118 procesos se hidrataron con `row.load()` desde la lista
(`/holdprint/processes`), las etiquetas de campo con `Field.loadFieldsFromArray`
(POST `/fields/find`), las unidades con `MeasurementUnit.loadAll()` y los scripts con
`HplScript.loadLastUserVersions([ids])` (POST `user/load-last-versions`). Todo
lectura; no se modificó nada en la cuenta.
