# Prueba de esfuerzo del catálogo de familias — Nicho 1: imprenta digital

**Estado: RELEVADO** (2026-08-07). Sin código: es un test de modelado sobre
papel contra el catálogo vigente ([ficha-familia-pasos.md §6](ficha-familia-pasos.md)).

## 1. Método

Decisión (Lucas, 2026-08-07): **exigir el catálogo nicho por nicho**, no con
una lista teórica de "pasos posibles" — una lista inventada produce casos que
nadie pide y esconde los que sí. Se arranca por **imprenta digital láser**,
que es donde el sistema nació y donde la sospecha era "ya está cubierto".

Para cada producto real del nicho se escribe **la ruta física** (lo que pasa
en el taller, paso por paso) y se mapea contra las 32 familias. Semáforo:

| | Significa | Costo de arreglo |
|---|---|---|
| ✅ | Sale entero, con la fidelidad que corresponde | — |
| ⚠️ | Sale, pero perdiendo algo real (la máquina, el ritmo, un costo) | Campo o declaración |
| 🔧 | Necesita catálogo nuevo (derivador / estrategia / primitiva) | Dato + función pura |
| ❌ | Necesita familia nueva | Ficha nueva |

**Muestra**: catálogo de [imprentaonline.net](https://www.imprentaonline.net)
(imprenta online con 19 años, España) — productos y **acabados reales**
publicados, no supuestos. Cruce con el relevamiento previo de Holdprint
(423 productos → 79 recetas, `holdprint-productos-relevamiento.md`).

## 2. El test, producto por producto

### ✅ Salen enteros (9)

| Producto | Ruta modelada |
|---|---|
| **Tarjetas de visita** | pre-prensa → `impresion_por_hoja` (imposición) → `corte_guillotina` → `embalaje` |
| **Tarjetas plastificadas + cantos redondeados** | + `laminado` + `modificacion_post` (redondeo declarado en su ficha) |
| **Flyers / volantes** | idéntico a tarjetas, sin acabados |
| **Papel carta / membrete** | impresión + refile |
| **Sobres impresos** | `impresion_por_pieza` (imprime sobre el sobre ya confeccionado) |
| **Talonarios autocopiativos numerados** | imposición con agrupado de talonario + `engomado_emblocado` + `modificacion_post` (numeración) |
| **Revista a caballete de 1 pliego** | imposición a caballete + `abrochado_caballete` + refile |
| **Entradas numeradas microperforadas** | + `modificacion_post` (numeración y perforación, ambas en su ficha) |
| **Pegatinas kiss-cut en hoja** | impresión + `plotter_corte` |
| **Cuadernos / calendarios con espiral o wire-o** | + `encuadernado_anillado` (biblioteca de espirales instalada) |

Es el corazón del nicho y está sólido — la sospecha inicial se confirma.

### ⚠️ Salen perdiendo algo (4)

| Producto | Qué se pierde |
|---|---|
| **Dípticos / trípticos** | `plegado` existe pero es **sólo manual (M-0)**: una plegadora industrial (Duplo, MBO, Horizon) no se puede declarar. Además está oculta del selector y su param `tipoPliegue` no lo lee nadie. |
| **Revista de 3+ pliegos** | Falta el **alzado** (juntar cuadernillos en orden). Con 1 pliego no aparece; con 3 sí, y es un paso con tiempo real. |
| **Refile trilateral de libros** | `corte_guillotina` cubre el corte, pero su primitiva de tiempo cuenta **cortes por tanda de pliegos**; una trilateral cuenta **libros/hora**. El paso sale, el tiempo sale mal. |
| **Carpetas de presentación** | `troquelado_digital` cubre la forma, pero el troquel real es **con matriz**: costo de matriz (amortizable) + ritmo en golpes/hora. Y el pegado de solapa cae en `trabajo_manual`. |

### ❌ No salen (5)

| Producto | Qué falta |
|---|---|
| **Catálogo encolado / libro tapa blanda** | **Encuadernación fresada** (fresadora + cola PUR). `engomado_emblocado` es lo más cercano pero su ficha dice "manual, sin máquina" (M-0) y su unidad son blocks, no libros. |
| **Libro tapa dura** | El contracolado del forro sale (`montaje_sobre_sustrato` ✅) y el armado cae en `ensamble_estructural`, pero falta el **cosido con hilo** de los cuadernillos. |
| **Tarjetas con barniz UV selectivo / 3D** | **Barnizado sectorizado**. `pintura_superficial` es de cartelería (pintar estructura); el barniz digital consume por área cubierta sobre pliego y corre en su propia máquina. |
| **Tarjetas con stamping digital (foil)** | **Aplicación de lámina metalizada**: consume rollo de foil por metro y corre con calor/presión. Se parece a `aplicacion_transfer` pero el consumo y el ritmo son otros. |
| **Relieve / embossing (bajo relieve)** | Matriz + prensa. Nicho premium, el menos frecuente de los cinco. |

## 3. Hallazgos, por impacto

### H1 — El eje máquina falta en las terminaciones (estructural)

**17 de las 32 familias son sólo manuales** (`M-0`), y entre ellas están
operaciones que cualquier imprenta digital mecaniza apenas crece:

| Familia | Hoy | La máquina que existe en el mundo real |
|---|---|---|
| `plegado` | M-0 | Plegadora de bolsas / cuchillas |
| `abrochado_caballete` | M-0 | Encuadernadora a caballete (alza, pliega, abrocha, refila) |
| `engomado_emblocado` | M-0 | Encoladora / fresadora de lomo |
| `plastificado_pouch` | M-0 | Plastificadora de rodillos |
| `colocacion_ojales` | M-0 | Ojaladora neumática |

Sólo dos familias del catálogo tienen el patrón correcto **M-0/M-1**
(`pintura_superficial`, `montaje_sobre_sustrato`): "lo hago a mano o con
máquina, según el taller".

**Por qué importa más de lo que parece.** Sin M-1 el paso no puede: elegir
máquina y perfil, usar T-3 (productividad del perfil), heredar setup/cleanup
del perfil, contar desgaste, imputar al centro de costo de esa máquina, ni
entrar al Tablero y a Capacidad de estaciones con ese recurso. El tenant que
compra una plegadora tiene que **fingir que pliega a mano**.

Y hay una segunda mitad del mismo hueco: **no hay plantillas de maquinaria**
para esas máquinas (las 12 plantillas son impresoras, guillotina, plotters,
láser, CNC, mesa, anilladora, plancha, 3D). Falta PLEGADORA, ENCUADERNADORA
(fresadora/caballete), TROQUELADORA con matriz, BARNIZADORA.

### H2 — La brecha real del nicho es **encuadernación industrial + acabados premium**

Los 5 productos que no salen se agrupan limpio en dos rubros:

- **Encuadernación industrial**: fresado/PUR, alzado, cosido. Es el salto de
  "imprenta que hace folletos" a "imprenta que hace libros".
- **Acabados premium**: barniz sectorizado, foil, relieve. Es el salto a
  "imprenta que vende tarjetas caras".

Ninguno es un problema del motor: son fichas + (en dos casos) una plantilla
de máquina. Ver §4.

### H3 — Sobre las unidades de productividad (la hipótesis inicial)

La sospecha era "faltan unidades para pasos manuales". El test dice que
**el eje de unidades no es el cuello de botella**: `unidades_h` con la unidad
NOMBRADA por la familia ya dice "libros/h", "cuadernillos/h" o "golpes/h" sin
inventar nada (es lo que hicimos con "ml de perfil/h" y "cortes/h").

Lo que sí falta, y es más chico de lo que parecía:

- **Fuentes de cantidad** para los oficios nuevos: "libros del pedido"
  (alzado, fresado, cosido) y "golpes" (troquel con matriz) — son magnitudes
  derivables, no unidades nuevas.
- En el enum de máquina (`UnidadProduccionMaquina`) hay HORA/HOJA/COPIA/PPM/
  A4_EQUIV/M2/M2_H/METRO_LINEAL/PIEZAS_H: para encuadernación haría falta
  algo tipo CICLOS_H (libros o golpes por hora).

**Conclusión**: la hipótesis apuntaba al lugar correcto (los pasos manuales
son el flanco débil) pero la causa no eran las unidades: es que **esos pasos
no pueden tener máquina**.

## 4. Propuesta de trabajo (para decidir, no ejecutada)

Ordenada por relación valor/esfuerzo:

1. **Abrir M-1 en las terminaciones mecanizables** (`plegado`,
   `abrochado_caballete`, `engomado_emblocado`, `plastificado_pouch`,
   `colocacion_ojales`): pasan a `['M-0','M-1']` + T-3, como ya lo hacen
   `pintura_superficial` y `montaje_sobre_sustrato`. Es edición de ficha, sin
   tocar motor, y desbloquea máquina/perfil/desgaste/tablero para todas.
   Requiere plantillas de maquinaria nuevas para que haya qué elegir.
2. **Despertar `plegado`**: sacarla del ocultamiento, conectar o podar
   `tipoPliegue` (hoy el motor no lo lee — deuda ya anotada).
3. **Familias nuevas de encuadernación**: `alzado` y `encuadernacion_fresada`
   (o extender `engomado_emblocado` con M-1 y unidad libros). `cosido_hilo`
   queda para cuando aparezca el primer tenant editorial.
4. **Familias nuevas de acabado**: `barnizado_sectorizado` y
   `aplicacion_foil`. Ambas son "aplico un recubrimiento sobre pliegos" —
   conviene diseñarlas juntas y evaluar si una sola familia con param cubre
   las dos.
5. **Troquel con matriz**: no es familia nueva sino un modo de
   `troquelado_digital` (matriz amortizable + golpes/h) — decidir si va como
   param o como familia hermana.
6. **Refile trilateral**: primitiva de tiempo nueva (`trilateral_por_libro`)
   declarada por guillotina, o una familia `refile_trilateral`. El eje
   primitivas ya soporta la variante sin tocar el motor.

## 5. Próximos nichos a exigir

Con el mismo método, en orden sugerido por peso en la base de tenants:

1. **Gran formato / cartelería** — ya relevado parcialmente vía Holdprint
   (89 % cubierto); quedaron toldos, wrapping vehicular, letra corpórea,
   tótems. Revisar contra lo que ganamos con derivadores.
2. **Textil / merchandising** — serigrafía, bordado, DTG y tampografía son
   los cuatro huecos conocidos; el bordado (puntadas) es el que más tensiona
   el eje de cantidad.
3. **Centro de copiado / reprografía** — ya tiene módulo propio; el test
   sería de UX más que de familias.
