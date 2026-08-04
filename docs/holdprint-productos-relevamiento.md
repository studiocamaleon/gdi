# Holdprint — catálogo de Productos y servicios: relevamiento

**Fecha:** 2026-08-04 · **Fuente:** cuenta trial del usuario, leída del modelo de datos.
Tercera parte de la serie: [plantillas de maquinaria](holdprint-plantillas-maquinaria-relevamiento.md)
· [procesos](holdprint-procesos-relevamiento.md) · **productos**.

---

## 1. Los números, que cuentan la historia

| Dato | Valor |
|---|---|
| Productos instalados de fábrica | **423** |
| Modelos de costeo distintos (CEM de producto) | **208** |
| CEM usados por **un solo** producto | **182** (87 %) |

**423 productos suenan a muchísimo, pero no son 423 ideas.** Casi cada producto trae
su propia receta: 182 de los 208 modelos de costeo se usan una única vez. Y la
distribución por tipo muestra de dónde sale el número:

| Grupo | Productos | Qué son |
|---|---|---|
| **Tótems** | **127** (30 %) | forma × material × con/sin impresión directa |
| Merchandising “personalizado” | 65 | taza, termo, llavero, mochila, paraguas… |
| Placas / planchas / láminas rígidas | 63 | material × con/sin impresión directa |
| Letra corpórea y cajas de luz | 46 | Buzón / Carta de caja / Letra de caja × material × iluminación |
| Pegatinas, adhesivos y vinilos | 29 | acabado × tipo de corte |
| Textil | 21 | prenda × DTG / sublimación total o parcial |
| Toldos | 10 | fijo / retráctil / cortina × lona, tela, policarbonato |
| Genéricos y listas manuales | 15 | sus escape hatches (ver §3) |
| Servicios | 5 | arte, entrega, instalación, mudanza, envoltura |

Los 127 tótems son el caso extremo y explican el modelo entero: **pre-generan el
producto cartesiano**. “Tótem cuadrado en ACM”, “Tótem cuadrado en ACM (Impresión
Directa)”, “Tótem curvo en ACM”, “Tótem curvo en ACM (impresión directa)”, y así por
7 formas (plano, cuadrado, curvo, redondo, triangular, L, T invertida, especial) ×
~10 materiales (ACM, acrílico, MDF, PS, PVC rígido, papel, acero inoxidable, acero
galvanizado…) × impresión sí/no.

Eso es exactamente lo que intuiste: **te dan mucho hecho, pero el producto viene
pensado por ellos.** Si tu tótem es de un material que no está en la grilla, o querés
combinar dos acabados que ellos no combinaron, creás un producto nuevo desde cero.

---

## 2. Cómo se arma un producto

Un producto es:
- **`checklists`** — las preguntas del wizard de cotización. Cada una guarda
  `processPublicId`: **la pregunta pertenece a un proceso**. Este es el enganche con
  el HPL de los procesos, que leen `checklist{"pregunta"}` para calcular el tiempo.
- **`relatedProcesses`** — la ruta (el tótem cuadrado en ACM tiene 2).
- **`sellingMeasurementUnit`** + `customMeasurementUnits` — unidad de venta.
- `curatedOutsourcedProcesses` — procesos tercerizados curados.
- `budgetAIGeneralInstructions` / `budgetAIWorkMeasuresInstructions` /
  `budgetAIChecklistInstructions` + `promptChecklists` + `useInBudgetAI` — **cada
  producto trae instrucciones en lenguaje natural para que la IA lo cotice**.

Ese último punto es nuevo respecto del análisis de julio: el producto está preparado
para que su “Orç.ai” (cotizar por WhatsApp/IA) sepa qué preguntar y cómo interpretar
las medidas.

---

## 3. Sus escape hatches (lo más interesante del catálogo)

Cuando el producto no entra en ninguna receta, tienen 15 comodines:

- `Producto Genérico | por unidad`
- `Producto Genérico | por metro cuadrado` (y su variante *con impresión*)
- `Producto Genérico | Multimedida` (y *Multimedidas con impresión*)
- `Producto con lista de costes manual`
- `Producto con Lista de Costos Manual con Fórmula`
- `Producto gratuito`
- `Producto con impresión {solvente | UV | UV 360 | UV DTF | DTF | látex | sublimación GF | sublimación pequeños formatos}` — “imprimí sobre lo que sea con esta máquina”.

Nosotros ya tenemos el equivalente conceptual (productos con medida libre, ítems
libres, cargos directos), pero **la familia “imprimí con esta máquina sobre lo que
traiga el cliente”** es un atajo comercial que no tenemos explícito y que resuelve el
caso real de la imprenta que cotiza rápido sin modelar el producto.

---

## 4. Listado de referencia por rubro

*(nombres tal cual los trae Holdprint en español; útil como checklist de cobertura)*

**Cartelería / señalética.** Tótem (7 formas × 10 materiales × impresión) · Letra de
caja plana y en relieve, con iluminación directa/indirecta/sin, en acero cepillado,
galvanizado, inoxidable, ACM, acrílico, latón, MDF, PVC expandido, XPS · Buzón
(plano, relieve, termoformado) · Frontón (con y sin huella dactilar) · Fachada (ACM,
chapa, lona; plana o con avance) · Panel retroiluminado · Panel de neón LED · Luz
frontal / luz de fondo · Estructura metálica para valla y fachada · Estructura de
madera exterior · Fundación/zapato · Caballete · Toldos (fijo, retráctil, cortina;
lona, tela, policarbonato).

**Gran formato / lona y vinilo.** Banner de lona · Lona lisa, perforada, doble cara,
opaca (blackout), texturizada · Estandarte de papel · Estandarte de viento (impresión
directa y sublimación) · Bandera y banda de tela · Pegatinas: impresa, translúcida,
transparente, reflectante, perforada, removible, arenada, esmerilada, de piso, con
corte electrónico, con aplicación externa · Vinilo adhesivo de color fundido · Vinilo
electrostático · Envoltura de coche, moto, autobús y camión (wrapping) · Rotulación
de camiones.

**Rígidos.** Placa/plancha/lámina con y sin impresión directa en ACM, acrílico, ABS,
EPS, XPS, PETG, PS, PSAI, HDPE, PP compacto y alveolar, policarbonato compacto y
alveolar, PVC expandido y rígido, MDF, MDP, HDF, OSB, aglomerado, contrachapado,
madera maciza, vidrio, papel, aluminio, chapa (cepillada, galvanizada, inoxidable,
sin tratar).

**Papelería / editorial.** Tarjeta de visita · Folleto/volante · Póster · Periódico ·
Revista · Catálogo · Agenda (y agenda verde) · Calendario · Bloc de papel · Carpeta ·
Portafolio · Sobre · Membrete · Invitación · Papel oficial · Hoja impresa láser y por
inyección.

**Textil.** Camiseta manga corta y larga (DTG, sublimación total y parcial) ·
Sudadera · Pantalón · Short/bermuda · Pieza confeccionada personalizada · Bolsa de
tela · Ecobag · Mochila · Bolsa escolar · Neceser.

**Merchandising / promocionales.** Taza · Termo · Botella (y térmica) · Vaso (con
pajita, desechable, ginebra, trago largo) · Copa (vino, espumoso) · Cubo de hielo ·
Cubo de palomitas · Llavero (acrílico, MDF, grabado) · Imán · Abridor · Navaja ·
Espejo de bolsillo · Marco de fotos (MDF, vidrio, cubo) · Azulejo con foto · Trofeo ·
Medalla · Bolígrafo y lápiz (incl. ecológicos) · Portaminas · Marcador · Porta
bolígrafos · Regla · Alfombrilla de ratón · Almohadilla de escritorio · Tarjetero
(bolsillo y escritorio) · Cartera · Billetera · Paraguas y sombrilla · Pen drive ·
Power bank · Cargador inalámbrico · Auriculares · Altavoz · Calculadora · Botón ·
Letrero “no molestar”.

**Servicios.** Creación artística · Instalación · Entrega · Mudanza · Envoltura.

---

## 4.bis Foco: los productos de imprenta (impresión sobre papel)

Relevado el 2026-08-04 cruzando cada producto con sus procesos
(`relatedProcesses` → catálogo de procesos). El resultado desarma la idea de
que Holdprint "cubre papelería".

**De sus 423 productos, exactamente UNO usa la impresora láser** (`Impresión:
Láser`, proceso 184): *Hoja impresa con láser*. Otro usa la de inyección
(*Hoja con impresión de inyección de tinta*). El resto de la papelería se
imprime en **rollo solvente de gran formato**, con fórmulas HPL por m².

| Producto | Ruta declarada |
|---|---|
| Hoja impresa con láser | Impresión: Láser |
| Hoja con impresión de inyección de tinta | Impresión: Inyección de tinta |
| **Tarjeta de visita personalizada** | Impresión: disolvente para la impresión de productos |
| Póster | Impresión: disolvente → Recarga manual |
| Sobre personalizado | Impresión: disolvente → Recarga manual → Montaje: Carpeta/Bolsa/Sobre |
| Revista personalizada | Impresión: disolvente varias páginas → Edición: Revista/Bloque/Catálogo |
| Catálogo personalizado | ídem |
| Bloc de papel personalizado | Impresión: disolvente varias páginas → Edición → Recarga manual |
| Periódico | Impresión: rodillo disolvente → Edición: Periódico |
| Agenda personalizada | Impresión: disolvente diario/cuaderno → Rearchivo manual → Montaje y encuadernación |
| Folleto personalizado | Servicio de Arte → Representación manual *(sin proceso de impresión)* |
| Membrete personalizado | ídem *(sin impresión)* |
| Carpeta personalizada | Servicio de Arte → Representación manual → Acabado de pliegue |
| Calendario personalizado | Aplicación de la laminación *(sin impresión)* |
| Invitación personalizada | Recarga manual *(sin impresión)* |
| Tarjetero de escritorio | Utilización de planchas sin impresión |
| Agenda verde · Tarjetero de bolsillo | *(sin procesos)* |

Tres lecturas:

1. **No hay imposición de pliego en ningún lado.** Una tarjeta de visita la
   cotizan por m² impresos en solvente, no por poses en un pliego. No existe el
   concepto de pose, ni de corte derivado de la grilla.
2. **Cinco productos no declaran impresión** (folleto, membrete, calendario,
   invitación, carpeta): se cotizan como arte + acabado, y el impreso se agrega
   a mano o se terceriza.
3. Su editorial multipágina (revista, catálogo, periódico, agenda) se resuelve
   con un proceso `Edición: …` que es **una fórmula HPL de productividad**, no
   una imposición de cuadernillo con signaturas.

### Cómo modelan ELLOS el editorial (revisado 2026-08-04, leyendo el HPL)

Los tres procesos que parecían "encuadernación" no modelan encuadernación:

```
Edición: Revista / Bloque / Catálogo   →  tiempo = (5/60) + (m² × páginas) / 60
Edición: Periódico                     →  tiempo = (5/60) + (m² × páginas) / 20000
Montaje y encuadernación de agenda     →  A5: cantidad/15 · A4: cantidad/13
```

Es **tiempo por unidad**, nada más. No hay pliegos, ni imposición, ni orden de
páginas, ni broches, ni distinción entre abrochado/cosido/anillado. Lo que
Holdprint "sabe" de una revista es cuánto tarda en producirse, no cómo se arma.

### ¿Podríamos crear esos productos hoy en nuestro sistema?

**13 de 18: sí, hoy, y mejor modelados que los de ellos.**
Hoja impresa · Tarjeta de visita (es nuestro caso canónico: imposición en
pliego + guillotina con los cortes derivados de la grilla) · Póster · Folleto
(impresión + `plegado`) · Membrete · Invitación · Carpeta (`troquelado_digital`
+ `plegado` + `engomado_emblocado`) · Calendario (+ `laminado` +
`encuadernado_anillado`) · Bloc de papel (`engomado_emblocado` es exactamente
eso, y el agrupamiento de talonarios ya existe) · Sobre · Tarjeteros · Agenda
anillada.

**Los 4 que faltaban (revista, catálogo, periódico, cuaderno) quedaron
cubiertos el 2026-08-04** con la imposición de cuadernillo a caballete
(`docs/imposicion-cuadernillos-diseno.md`): pliegos reales, plan
página→posición y familia `abrochado_caballete`.

**Conclusión: de los 18 productos de imprenta de Holdprint, hoy podemos
modelar los 18** — y en casi todos con más fidelidad, porque nosotros contamos
pliegos, poses, cortes y broches donde ellos sólo tienen una fórmula de tiempo.

Queda una limitación REAL nuestra, que no aparece en esta comparación porque
Holdprint tampoco la tiene: **alzado / encolado con tapa** (catálogo grueso,
libro con lomo cuadrado). Va como fase posterior sobre la misma base.

## 5. Qué sacamos de esto

### 5.1 La lección de modelo: no imitar la combinatoria

Nuestro modelo (producto + ruta + medida configurable + adicionales opcionales +
máquinas candidatas) **genera esa combinatoria al cotizar** en vez de precocinarla.
Un solo producto “Tótem” con material y forma como opciones cubre los 127 suyos.

Su ventaja no es el modelo — es que **el tenant abre la cuenta y ya tiene 423
productos para vender**. La nuestra es que el tenant puede armar el que quiera. Son
estrategias distintas, y la suya tiene el costo que ya notaste: si tu producto no está
en la grilla, lo hacés de cero.

### 5.2 Lo que sí conviene copiar

1. **Catálogo semilla instalable.** Aunque no precocinemos la combinatoria, arrancar
   con un set de productos listos baja muchísimo la fricción de onboarding. Encaja
   con lo que ya está anotado como “marketplace de packs instalables con 1 click”
   ([[analisis-competitivo-holdprint]]). El listado del §4 es el inventario a cubrir.
2. **Productos comodín por máquina** — “Producto con impresión UV / DTF / solvente…”:
   cotizar rápido sobre el material que traiga el cliente, sin modelar el producto.
   Barato de implementar (es un producto con ruta de un paso y medida libre) y
   resuelve un caso real de mostrador.
3. **Preguntas del wizard ligadas al proceso** (`checklist.processPublicId`): la
   pregunta no vive en el producto sino en el paso que la necesita, y el producto sólo
   declara cuáles aplican. Es más limpio que atar preguntas al producto, y es lo que
   hace su wizard reactivo. Nuestro equivalente son los params abiertos por paso; la
   idea de “el paso declara qué necesita preguntar” es portable.
4. **Instrucciones de cotización por IA a nivel producto** (`budgetAI*Instructions`):
   si algún día cotizamos por WhatsApp/IA, el lugar natural de esas instrucciones es
   el producto. Anotado, no urgente.

### 5.3 Cobertura: qué productos del listado no podríamos cotizar hoy

Todo lo de papelería, rígidos, gran formato, vinilos, textil por transfer,
merchandising y servicios está cubierto por nuestras familias. Quedan afuera los
mismos rubros que ya identificamos en los procesos: **letra corpórea y cajas de luz**
(termoformado, iluminación LED), **tótems** (estructura + armado), **toldos**,
**wrapping vehicular**, **serigrafía**, **bordado** y **DTG**. Son expansión de rubro
hacia cartelería/comunicación visual, no deudas del motor.

---

## Apéndice — cómo se leyó

`defrayalProductsCtrl.loadProducts(500)` para traer los 423 (la lista pagina de a 50),
`ProductFamily.loadUsableFamilies()` para el árbol de familias y `product.loadLastVersion()`
para inspeccionar un producto. Todo lectura; no se modificó nada en la cuenta.

---

## 6. Foco: gran formato y cartelería (relevado 2026-08-04)

Es el rubro donde Holdprint es fuerte. Para evaluarlo sin contar 423 veces lo
mismo, se agruparon los productos por **cadena de procesos**: 423 productos
colapsan en **79 recetas distintas**. Cada receta es un problema de modelado
diferente; las variantes (tótem cuadrado vs curvo, en ACM vs en acrílico) son
la misma receta con otro material.

### El veredicto, en productos

| | Recetas | Productos | % |
|---|---|---|---|
| ✅ **Modelable hoy** (fidelidad igual o mejor) | 44 | **246** | 58 % |
| ⚠️ **Modelable con menos detalle** | 18 | **129** | 31 % |
| ❌ **Necesita familia nueva** | 17 | **48** | 11 % |

### ✅ Lo que sale hoy (246 productos)

Todo el gran formato "puro" y el rígido:

- `Impresión: Rígida` (48 productos) → `impresion_por_area` + mesa extensora.
- `Utilización de planchas sin impresión` (47) → producto con slot de material
  y corte, sin impresión.
- `(sin procesos)` (70) → blanks de merchandising: el motor ya los costea por
  pieza (falta poblar la biblioteca de blanks, no el modelo).
- `Impresión: disolvente → Representación manual` (25) → lonas, banderas,
  adhesivos. **Acá estamos mejor**: nosotros hacemos nesting real sobre el
  ancho del rollo con desperdicio; ellos cotizan m² con una fórmula.
- Vinilo de corte, kiss-cut y depilado → `plotter_corte`.
- Laminado, aplicación sobre sustrato, aplicación externa → familias propias.
- Ojales, vaina, palo/virola/cuerda, perfil C → `colocacion_ojales` y
  `modificacion_post` (la primitiva de bolsillo/dobladillo ya existe).
- Sublimación textil + calandra/plancha, DTF, UV DTF, UV 360, látex → cubierto.
- Cuña blanca → es un modo de color `CMYK+blanco`.

### ⚠️ Lo que sale, pero perdiendo detalle (129 productos)

**Son casi todos tótems (95) y letra corpórea sin iluminar (23).** Tenemos
`ensamble_estructural`, pero es una familia genérica: sin slots requeridos, sin
params y con tiempo fijo o productividad propia. Holdprint, en cambio, calcula
la estructura **a partir de la geometría del cartel**:

```
Construcción de la estructura: Estructura estructural - Metal
  FRAME                  { tipo, cálculo de tiempo, productividad, perfil metálico (m) }
  VERTICAL_REINFORCEMENT { … + separación máxima (m) }
  HORIZONTAL_REINFORCEMENT { … + separación máxima (m) }
```

O sea: dadas las medidas del cartel y la separación máxima entre refuerzos,
derivan **cuántos metros de perfil** hacen falta. Nosotros hoy lo cargaríamos a
mano como cantidad de un slot adicional. Se cotiza, pero el número lo pone la
persona, no el sistema.

**Lo que faltaría** para cerrar la brecha es una primitiva de "estructura
derivada de la medida": metros de perfil = f(ancho, alto, separación máxima).
Es la misma forma que ya tiene `colocacion_ojales` (ojales = perímetro ÷ paso),
así que hay precedente.

### ❌ Lo que necesita familia nueva (48 productos)

| Gap | Productos | Qué implica |
|---|---|---|
| **Iluminación LED** (estuche de letra, retroiluminación, tira LED, neón) | 23 | Módulos/tira, fuente, cable, separación entre módulos y entre líneas |
| **Toldos** (fabricación de marcos) | 10 | Brazo articulado, motor, reductor, manivela, riel, polea |
| **Wrapping vehicular** | 8 | Lavado técnico, descontaminación, envolvimiento por tipo (9 variantes m²/h) |
| **Serigrafía** | 4 | Fabricación de matriz + exposición de pantalla + tinta por color |
| **Termoformado** (caja de letras) | 2 | Molde + productividad por m² |
| Botones, mudanza con vehículo | 2 | Menores (el de mudanza ya está anotado: vehículo/combustible/km) |

Ninguno bloquea el rubro donde hoy operamos: **son la puerta de entrada a
cartelería luminosa y automotor**, que es negocio nuevo, no deuda técnica.

### Conclusión

De los 423 productos de Holdprint, **375 (89 %) los podríamos vender hoy** —
246 con el mismo detalle o más, y 129 cargando la estructura a mano. El 11 %
restante son cinco rubros nuevos bien delimitados, y el más grande (iluminación
LED, 23 productos) es también el más definido: la biblioteca de materias primas
**ya tiene** las subfamilias `MODULO_LED_CARTELERIA`, `FUENTE_ALIMENTACION_LED`,
`CABLEADO_CONECTICA`, `CONTROLADOR_LED` y `NEON_FLEX_LED` — quedaron sin paso
que las consuma cuando se podó `instalacion_electrica`. O sea: media
implementación ya está hecha.
