# Editor de ruta guiado — relevamiento de textos (Backlight + 5 productos)

> **Estado**: CERRADO (2026-08-06) — los 20 hallazgos (H1-H18 + H19/H20)
> arreglados y verificados en UI; quedan solo las decisiones de fondo del
> pie de este bloque. Capturado de la UI
> real (`Configurar pasos` de cada producto), paso por paso, más los
> catálogos de opciones que se abren en cada "Cambiar"
> (`src/lib/editor-paso/` + `labels-humanos.ts`). El objetivo: evaluar si
> las preguntas del editor son lo bastante NEUTRAS para cualquier producto,
> sin perder coherencia con el resto del catálogo.
> **Arreglados el mismo día**:
> **Tanda 1** — H6 (herencia por output reconocida — "Hereda «puntos
> soldadura» del paso que lo publica"), H8 (label "Medida visible
> terminada"), H11 (criterio de fábrica visible — "El más chico que cumpla
> · del paso").
> **Tanda 2** — H13 (un aviso NO bloqueante ya no dice "Falta": el paso
> muestra "✓ Listo para cotizar · Sugerencia: fijá de qué paso hereda";
> `nivelPendientes` en pendientes-paso.ts) y H17 (resúmenes con contenido:
> la regla condicional se lee en humano — "Tipo de copia es Duplicado o
> Tipo de copia es Triplicado" — y el material fijo muestra su nombre —
> "Papel ilustración brillante"; el fix hidrata `materialVariante` de los
> slots HARDCODED y completa los lookups del esquema con los materiales ya
> cargados).
> **Tanda 3** — H1/H2 (la familia declara `derivador.unidadPrincipal` y el
> ritmo dice "6 ml de perfil/h", "6 puntos soldadura/h" — la herencia usa
> `campoOutput`; "¿El ritmo cuenta…?" aclara "(módulos)"), H5 (la pregunta
> de costeo por placas se OCULTA en slots INSUMO_PASO — caño, pintura,
> cable, film — donde el motor la ignora; el consumo de slots derivados
> dice "Derivado de la geometría · barras enteras si la variante declara
> largo de barra") y H7 (alias `piezas_h` normalizado — muere "Valor no
> disponible"; el sufijo de tanda dice "piezas a montar"/unidad nombrada en
> vez de "unid./pliegos").
> **Tanda 3b** (corrección del usuario: el resumen decía "ml de perfil"
> pero el control ABIERTO seguía en "unid./h"): el input del ritmo, el
> selector "Unidad" ("Lo que cuenta el paso (ml de perfil)") y el select de
> magnitud ("Cantidad efectiva del paso (ml de perfil)") dicen lo mismo que
> el resumen — `unidadCantidadDe()` exportada del esquema y usada por el
> control. Regla que queda: si un resumen nombra algo, su control abierto
> lo nombra igual.
> **Tanda 4** — H15 (pregunta nueva "¿Con qué parámetros trabaja este
> paso?" en AJUSTES DEL TRABAJO: renderiza `ParamsFamiliaFields` en el
> guiado y el resumen NOMBRA los valores — "Tipo de bastidor: Doble (cajón)
> · Separación refuerzos V: 100 · +1 más"; whitelist
> `FAMILIAS_CON_PARAMS_EDITABLES` += estructura_bastidor e iluminacion_led,
> cuyos params el motor consume; `brochesPorLibro` y `tipoPliegue` NO
> entran — el motor no los lee, y exponer params muertos es el
> anti-patrón), H14 (el acomodado nombra "Imposición a caballete (hojas de
> tapa/interior)" en vez de "Acomodo estándar"; el control abierto ya la
> editaba) y H16 (resuelto como TEXTO: la pregunta refería al modo de
> apilado del talonario incompleto — retitulada "¿Cómo se agrupan los
> talonarios en el pliego?" y la opción off pasó de "No es talonario" a
> "Sin agrupado por talonario"; la config del producto era correcta).
> El §6 amplía el relevo a Tarjetas, Revista, Talonarios, Taza y Sello —
> hallazgos H13-H18.
> **Pendiente conectado**: brochesPorLibro/tipoPliegue son params
> declarados que el motor ignora — conectarlos o podarlos del schema.
> **Post-tanda (feedback "el corte se mide por cortes")**: magnitudes de
> tiempo DERIVADAS — la familia declara `derivador.magnitudesTiempo` y el
> menú "¿El ritmo cuenta…?" ofrece "Cortes de hierro (derivados de la
> geometría)" y "Puntos de soldadura (…)"; el motor resuelve
> `productivityQuantitySource: "derivada:<magnitud>"` desde la derivación
> cacheada (E2E: 18 cortes @ 20/h = 54 min exactos). Ver §9 por el repaso
> final con controles abiertos (H19/H20/H12 arreglados).

---

## 9. Repaso final con controles abiertos (2026-08-05, post-tandas)

Método: la ruta Backlight con cada control expandido (los acordeones se
abrieron de a uno) + auditoría del esquema declarativo (que es la fuente
exacta de lo que el guiado renderiza) + spot-checks en Tarjetas/Cenefas.

**Hallazgos nuevos, arreglados en el momento:**

| # | Qué mentía | Ahora |
|---|---|---|
| H19 | "¿Entre cuáles se elige? 1 material · **0 variantes**" cuando el candidato tiene `todasLasVariantes` (el junction va vacío) — el perfil ofrecía 4 variantes y decía cero | "1 material · **todas sus variantes activas**" (y "todas + N explícitas" en el mixto) |
| H20 | "¿Por cada cuántos se gasta uno?" visible en slots DERIVADOS (perfil, anclajes, cable) donde el motor ignora base × factor | Oculta — la geometría manda |
| H12 | Cenefas: "**1 por cantidad pedida**" con `cantidadBase` NULL en DB — era el default de la UI de alta, no lo que el motor hace (usa la fórmula) | "**Según fórmula del consumo**" — el resumen refleja el motor, no el formulario |

**Estado del recorrido completo (9 pasos, todo abierto):** las preguntas de
identidad/activación/tiempo/materiales/oficio dicen lo mismo abiertas y
cerradas, con unidades nombradas de punta a punta.

**Cierre final (2026-08-06)** — la última tanda liquidó lo que quedaba:
- **H9**: "¿La doble faz gasta doble?" solo aparece si la familia soporta el
  multiplicador `caras` (o si ya está activa — config existente no se
  esconde). Fuera de herrería/LED/manuales.
- **H10**: la card de Acomodado no aparece en familias con DERIVADOR (no
  acomodan: derivan) ni en mutadoras de medidas (`mutaMedidasEnPrePasada`,
  ahora servido por el catálogo) — la Demasía dejó de ofrecer nesting.
- Tóner: "**Cobertura alta de tóner**" (autodescriptivo) en vez de "Alta".
- "(heredado)" eliminado — el chip "· del paso" ya dice el origen.
- Rollo: "**Acomodo en rollo (por ancho útil del material)**" en vez de
  "Acomodo estándar".
- Escalones reales: "Por tramos de la última placa · **la última también se
  cobra entera**" cuando la config es [100] (la descripción genérica de
  ¼/½/¾ ya no contradice la realidad).

**Decisiones de fondo que siguen abiertas** (no son textos):
- `brochesPorLibro` / `tipoPliegue`: params declarados que el motor no lee
  — conectarlos o podarlos.
- Etapa 5 de derivadores (Frontlight solo con datos) y los pendientes de
  compra real listados en derivadores-geometricos-diseno.md.

---

## 1. Cómo leer este doc

Cada paso muestra **exactamente** lo que ve el modelador (pregunta →
respuesta actual). Los hallazgos están numerados H1…H12 y clasificados:

- 🔴 **Texto roto o falso** — muestra algo incorrecto hoy.
- 🟡 **Genérico que confunde** — correcto pero opaco/engañoso en este
  contexto.
- 🟢 **Genérico que funciona** — neutro de verdad, no tocar.

## 2. Las preguntas transversales (aparecen en todos los pasos)

| Pregunta | Respuesta típica | Veredicto |
|---|---|---|
| ¿Quién hace este paso? | "Lo produce la empresa" | 🟢 neutra |
| ¿Cómo se llama este paso acá? | "Corte de hierros" | 🟢 |
| ¿Cuándo se ejecuta? | "Siempre" / "Cuando el comercial lo activa" | 🟢 |
| ¿Arrastra otros pasos al activarse? | "No arrastra otros pasos" | 🟢 |
| ¿El tiempo lo estima el comercial al cotizar? | "No — se calcula solo" | 🟢 |
| ¿En qué centro productivo se realiza este paso? | "Produccion & Taller" | 🟢 |
| ¿Cuántas personas trabajan? | "1 persona" | 🟢 |
| ¿Cómo medís el ritmo? | "Productividad por hora" / "Tiempo por lote" | 🟢 |
| **¿A qué ritmo?** | **"6 unid./h"** | 🔴 **H1** |
| **¿El ritmo cuenta piezas, m² o metros?** | **"Cantidad efectiva del paso"** | 🟡 **H2** |
| **¿Sobre cuántas piezas trabaja?** | "Hereda del paso anterior" / "Calculado por nesting" | 🟡 **H3, H4** |
| ¿Qué materiales gasta acá? | "2 materiales configurados" | 🟢 |
| ¿Quién decide cuál se usa? | "El comercial elige al cotizar" | 🟢 |
| **¿Cómo se costea este material?** | **"Placas enteras"** | 🔴 **H5** |
| ¿La doble faz gasta doble? | "No — el consumo no cambia" | 🟡 **H9** |
| ¿Cómo se acomodan y cobran las piezas en el material? | "Acomodo estándar" | 🟡 **H10** |

## 3. Relevo paso por paso (lo que difiere del cuadro anterior)

### Paso 1 — Corte de hierros (`estructura_bastidor`, obligatorio) ✓
- "¿A qué ritmo? **6 unid./h**" → las "unidades" acá son **metros de
  perfil** (la cantidad del paso son los ml derivados). **H1**
- "¿El ritmo cuenta piezas, m² o metros? Cantidad efectiva del paso" → no
  dice que la cantidad efectiva son ml de caño. **H2**
- Materiales *Perfil / caño estructural* y *Anclajes*: "¿Cómo se costea
  este material? **Placas enteras**" → es un caño; y además el perfil YA se
  cobra por **barras enteras** (largoBarra + packing) sin que el editor lo
  mencione. **H5**
- No aparece "¿Sobre cuántas piezas trabaja?" (la familia solo soporta un
  mecanismo → no hay decisión). 🟢 buen comportamiento.

### Paso 2 — Soldadura (`trabajo_manual`, obligatorio)
- Banner: **"Para cotizar bien — Falta: de qué paso hereda"** → FALSO: la
  herencia está configurada por output (`campoOutput: puntos_soldadura`) y
  el motor cotiza perfecto (160 min = 16 puntos a 6/h). **H6**
- "¿De qué paso hereda la cantidad?" con hint *"…los pliegos impresos, las
  piezas cortadas…"* → el ejemplo es de imprenta; acá hereda **puntos de
  soldadura del corte**. **H6b**
- "¿A qué ritmo? 6 unid./h" → son **puntos de soldadura**/h. **H1**

### Paso 3 — Pintura de estructura (`pintura_superficial`, opcional)
- Mismo falso "Falta: de qué paso hereda" (hereda `pintura_m2`). **H6**
- "10 unid./h" → son **m² de superficie**/h. **H1**
- Material *Pintura / laca*: "Placas enteras". **H5**

### Paso 4 — Demasía de tensado (`modificacion_pre`, obligatorio) ✓
- "¿A qué ritmo? 60 ml/h" + "¿El ritmo cuenta…? Metros lineales
  cotizados" → 🟢 acá la unidad y la magnitud SÍ están bien elegidas por el
  modelador. Referencia de cómo debería verse el resto.
- "¿Sobre cuántas piezas trabaja? Calculado por nesting" → esta familia no
  nestea nada: muta medidas. **H3**

### Paso 5 — Impresión de lona (`impresion_por_area`, obligatorio) ✓
- El paso más "en casa" del editor: máquinas candidatas, setup/cleanup del
  perfil, acomodo. 🟢 casi todo funciona.
- "¿Qué variables multiplican el trabajo acá? Sin multiplicadores" 🟢.

### Paso 6 — Chapa trasera (`montaje_sobre_sustrato`, opcional)
- "¿Cómo medís el ritmo? **Tiempo por lote**" con "¿Cuánto tarda una tanda
  y de cuántas? … **unid./pliegos cada … min · Unidad: Valor no
  disponible**" → texto roto en paso manual. **H7**
- "¿Qué monta: piezas del pedido o pliegos impresos? **piezas_visibles**"
  → muestra el valor CRUDO del enum; falta la opción con label en el
  catálogo del editor (deuda de la Etapa 4 de derivadores). **H8** 🔴
- "¿Cómo se costea este material? **Por tramos de la última placa**" → acá
  "placa" por fin es una chapa real 🟢… pero el escalón configurado es
  [100] ("hoja entera") y la descripción dice "¼, ½, ¾ o entera". 🟡
- "¿Entre cuáles se elige? 1 material · **3 variantes**" 🟢 (las hojas).

### Paso 7 — Iluminación LED (`iluminacion_led`, obligatorio) — nav marca "!"
- *Fuente de alimentación*: "¿Con qué criterio elige el sistema?" quedó
  **abierto/pendiente** ("1 pendiente" en el header) → FALSO: el criterio
  por capacidad viene DECLARADO por la familia (E2, `criterioCapacidadDefault`)
  y el motor elige la fuente sola. El editor no conoce el default. **H11**
- Opciones del criterio: "Más barato / Mejor aprovechamiento / **El más
  chico que cumpla**" → 🟢 la tercera es exactamente la fuente LED, buen
  texto.
- *Fuente*: "¿Cómo se calcula el consumo? **Cantidad fija (1 unidad)**" →
  🟢 (declarado en E2, se lee bien).
- "40 unid./h" → son **módulos colocados**/h. **H1**
- *Módulo LED / Cable*: "Placas enteras". **H5**

### Paso 8 — Tensado de lona (`trabajo_manual`, obligatorio) ✓
- "30 **m perímetro**/h" + "¿El ritmo cuenta…? **Perímetro total de
  piezas**" → 🟢 otra referencia buena (magnitud bien elegida).
- "¿Sobre cuántas piezas trabaja? Cantidad pedida directa" 🟢.

### Paso 9 — Cenefas (`trabajo_manual`, opcional)
- Mismo falso "Falta: de qué paso hereda" (hereda `cenefa_m2`). **H6**
- "4 unid./h" → son **m² de cenefa**/h. **H1**
- *Chapa*: "¿Por cada cuántos se gasta uno? **1 por cantidad pedida**" →
  a revisar juntos: la cantidad del slot debería seguir los m² heredados
  (fórmula), no 1×pedido. Puede ser config vieja del paso. **H12**

## 4. Catálogos de opciones que se abren en "Cambiar" (literales)

**Mecanismo de cantidad** ("¿Sobre cuántas piezas trabaja?"):
- "Cantidad pedida directa" — *Usa la cantidad que pidió el comercial…*
- "Hereda del paso anterior" — *Toma el resultado calculado por un paso previo (ej: pliegos calculados por pre-prensa).*
- "**Calculado por nesting**" — *El paso ejecuta un algoritmo de nesting (acomodo de piezas)…* ← **H3**: bastidor/LED/ojales no nestean: DERIVAN geometría.
- "Conversión por unidad de empaque" — *…piezas / piezasPorCaja…*

**Costeo del sustrato** (sustantivo hoy fijo en "placa" para todo lo que no
es pliego): "Placas enteras" / "Sólo los m² de las piezas" / "El largo
usado de la última placa" / "Por tramos de la última placa". ← **H5**: el
código ya parametriza placa/pliego (`costingStrategyOptions(unidad)`);
falta el sustantivo neutro ("unidades") o declarado por slot.

**Ritmo** : "Productividad por hora" / "Tiempo por lote". Unidades:
"Unidades o pliegos/h" / "m²/h" / "ml/h". ← **H1**: no existe forma de que
la familia diga QUÉ unidad es la natural (puntos, módulos, barras).

**Magnitud del ritmo** ("¿El ritmo cuenta piezas, m² o metros?"):
"Cantidad efectiva del paso" / "Piezas/pliegos a montar" / "Área calculada
desde piezas" / "m² instalados manuales" / "Metros lineales cotizados" /
"Perímetro total de piezas". ← **H2**: "cantidad efectiva" es un misterio
para el usuario cuando la efectiva es derivada.

**Piezas a montar** (montaje): "Piezas del producto" / "Pliegos impresos".
← **H8**: falta "Medida visible terminada" (el editor muestra el valor crudo).

## 5. Hallazgos consolidados, para decidir juntos

| # | Tipo | Qué pasa | Idea de arreglo (a discutir) | ¿Toca otros productos? |
|---|---|---|---|---|
| H1 | 🔴 | "unid./h" cuando el paso cuenta ml/puntos/módulos/m² | la familia declara la **unidad natural** de su cantidad (derivador → `magnitudPrincipal` ya la conoce); el editor la usa en "¿A qué ritmo?" | No — agrega precisión donde hoy dice "unid." |
| H2 | 🟡 | "Cantidad efectiva del paso" opaco | mostrar entre paréntesis qué ES la efectiva: "(los metros de perfil derivados)" | No — texto informativo |
| H3 | 🟡 | "Calculado por nesting" para familias que DERIVAN | label alternativo cuando la familia tiene derivador: "Derivado de la geometría (medidas → cantidad)" | No — mismo mecanismo, mejor nombre |
| H4 | 🟢 | pregunta oculta cuando no hay decisión | — ya funciona bien | — |
| H5 | 🔴 | "Placas enteras" para caños/pintura/cables; y el perfil se cobra por BARRAS sin mencionarlo | sustantivo del costeo por tipo de slot (placa/pliego/**unidad**) + para slots con `magnitudDerivada`+despiece, mostrar "Barras enteras (packing del despiece)" | Sí, mejora también embalaje/anillado (hoy dicen "placas") |
| H6 | 🔴 | "Falta: de qué paso hereda" FALSO con herencia por output configurada; hint habla de pliegos | el editor debe reconocer `campoOutput` como origen válido y mostrar "Hereda **puntos de soldadura** del paso Corte de hierros" | Sí — cualquier ruta con herencia por output |
| H7 | 🔴 | "unid./pliegos cada… · Unidad: Valor no disponible" en batch manual | bug de UI del modo lote en pasos M-0 | Sí — genérico |
| H8 | 🔴 | `piezas_visibles` crudo | agregar la opción con label/descr al catálogo del editor (deuda E4, fix trivial) | No |
| H9 | 🟡 | "¿La doble faz gasta doble?" en herrería | ocultarla cuando el paso no soporta caras (como ya se ocultan otras) | No |
| H10 | 🟡 | "¿Cómo se acomodan y cobran las piezas…? Acomodo estándar" en pasos sin nesting/material | ocultarla cuando la familia no nestea | No |
| H11 | 🔴 | "1 pendiente" en fuente LED aunque el criterio viene de fábrica | el editor lee `criterioCapacidadDefault` de la familia y muestra "El más chico que cumpla · de fábrica" | Sí — cualquier slot futuro con default declarado |
| H12 | ❓ | Cenefas: chapa "1 por cantidad pedida" | revisar la config del slot (posible resto viejo) | Solo este producto |

## 6. Relevo en otros productos (2026-08-05, mismo método)

Rutas recorridas: **Tarjetas de visita** (diseño + pre-prensa + impresión
por hoja + laminado + guillotina), **Revista de prueba** (tapa/interior con
imposición caballete + plegado + abrochado + guillotina), **Talonarios en
papel obra** (original/duplicado/triplicado condicionales + abrochado +
guillotina), **Taza cerámica personalizada** (DTF UV + aplicación manual) y
**Sello Trodat 3911** (polímero + grabado + montaje).

### Confirmaciones (los hallazgos NO son solo de cartelería)

- **H5 es de todo el catálogo**: el film de laminado de Tarjetas (¡un
  ROLLO!) también muestra "¿Cómo se costea este material? Placas enteras".
  El sustantivo "placa" está pegado a la pregunta, no al material.
- **"Calculado por nesting" es correcto en imprenta** (Tarjetas, Revista,
  Talonarios): el H3 aplica SOLO a familias con derivador. Bien.
- Los pasos de imprenta pura se leen bien en general: máquinas candidatas,
  perfiles, setup/cleanup "de la máquina", modos de color. El editor nació
  para esto y se nota.

### Hallazgos nuevos

| # | Tipo | Dónde | Qué pasa |
|---|---|---|---|
| H13 | 🔴 | Laminado y Guillotina (Tarjetas), Plegado (Revista), Guillotina (Talonarios) | Banner **"Para cotizar bien — Falta: de qué paso hereda"** para la herencia AUTOMÁTICA (regla histórica, cotiza perfecto). Es un aviso anti-ambigüedad NO bloqueante, pero el copy dice "Falta" — mismo tono que un error real. Distinguir: "Falta X" (bloqueante) vs "Sugerencia: fijá el origen" (advisory) |
| H14 | 🔴 | Revista, pasos tapa/interior | Tienen **imposición de caballete configurada** (`imposicion: {esquema: caballete, hojas: tapa/interior}`) y el guiado resume "¿Cómo se acomodan…? **Acomodo estándar**" — la imposición es INVISIBLE en el guiado |
| H15 | 🔴 | Revista (brochesPorLibro, tipoPliegue), Backlight (sepRefuerzos, solapa, tipoBastidor), ojales (lados, separación) | **Los params específicos de familia no aparecen en el editor guiado** — solo en el detallado (`ParamsFamiliaFields`). El modelador guiado nunca ve "¿cada cuántos cm van los refuerzos?" ni "¿cuántos broches por libro?" |
| H16 | ❓ | Talonarios, paso Pre-prensa | "¿Es un talonario? ¿Cómo se apila? **No es talonario**" — en el producto TALONARIOS. ¿Config pendiente del producto o la pregunta está en el paso equivocado? Revisar juntos |
| H17 | 🟡 | Talonarios (duplicado/triplicado), varios | Resúmenes que dicen "**Regla definida**" / "**Material definido**" sin mostrar QUÉ regla (tipoCopia ≥ 2) ni QUÉ material (el nombre está a un click, pero el resumen podría decirlo) |
| H18 | 🟡 | Taza, Sello (tiempo por lote) | "¿Cuánto tarda una tanda y de cuántas? **1 unid./pliegos cada 3 min**" — el sustantivo comodín "unid./pliegos" queda pegado a cualquier paso manual. Y "¿Es un talonario?" aparece en la pre-prensa de un SELLO |

### Lo que la tanda 1 ya arregló (verificado en UI)

- Soldadura/Pintura/Cenefas: "✓ Listo para cotizar" + "Hereda «puntos
  soldadura» del paso que lo publica" (antes: "Falta" falso).
- Iluminación LED: "Configurado ✓" + criterio "El más chico que cumpla ·
  del paso" (antes: "1 pendiente").
- Chapa trasera: "Medida visible terminada" (antes: `piezas_visibles`).

## 7. El patrón de fondo (mi lectura, a validar con vos)

Los textos genéricos del editor están bien **cuando el paso es de
imprenta** (pliegos, piezas, nesting) porque nacieron ahí. Donde chirrían
es exactamente donde el motor ya se volvió declarativo y el editor no lee
esas declaraciones: la familia HOY ya sabe qué unidad cuenta
(`magnitudPrincipal` del derivador), qué output hereda (`campoOutput`),
qué criterio de selección trae de fábrica (`criterioCapacidadDefault`) y
qué presentación de compra usa (despiece/hoja) — pero el editor sigue
adivinando con sustantivos de imprenta.

La dirección que propongo discutir: **el editor no inventa palabras — las
lee de lo que la familia ya declara** (misma filosofía del refactor de
derivadores). Así la pregunta sigue siendo UNA para todo el catálogo, y lo
que cambia por producto es el sustantivo que la llena. Ningún texto
específico de cartelería hardcodeado en el editor.
