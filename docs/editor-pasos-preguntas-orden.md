# El editor de pasos — de 40 preguntas a 7 ejes

**Estado: DOCUMENTO VIVO** (arrancado 2026-08-07). Nada implementado todavía:
acá se acuerda *qué* se configura de un paso, *cómo* se agrupa y *cómo se ve*,
antes de tocar [`src/lib/editor-paso/schema.ts`](../src/lib/editor-paso/schema.ts).

## 1. El diagnóstico

El editor declarativo ya resolvió el problema difícil: cada opción se declara
UNA vez, con su pregunta en idioma de taller, su visibilidad y su resumen, y un
test de paridad rompe si el censo y el esquema divergen
([editor-declarativo-diseno.md](editor-declarativo-diseno.md)). Lo que quedó
mal es más blando y más importante: **cuántos gestos cuesta configurar un
paso.**

Abrir "Impresión por hoja" de un folleto muestra **19 preguntas**, cada una en
su acordeón, cada una escondida hasta abrir la anterior. Y las seis secciones
—Quién lo hace · Activación · Tiempo y costo · Máquina y perfil · Materiales ·
Ajustes del trabajo— agrupan por **dónde vive el dato en el modelo**, no por
cómo piensa el trabajo quien lo configura.

Antes de esto existía la vista detallada: todo junto, sin acordeones. Tampoco
servía, por el motivo opuesto — mostraba los mismos campos con vocabulario del
modelo y sin filtrar lo que no aplicaba.

> **La conclusión (Lucas, 2026-08-07)**: falta el punto medio. Ni 40 preguntas
> de a una, ni un formulario técnico con todo.

## 2. El reencuadre: las preguntas son hojas, los ejes son decisiones

Las 19 preguntas de impresión por hoja no son 19 decisiones. Son 6. Miralo en
el eje del tiempo, tal como se ve hoy:

> ¿el tiempo lo estima el comercial? → ¿cómo se mide el tiempo acá? → ¿cómo
> medís el ritmo? → ¿a qué ritmo? → ¿el ritmo cuenta piezas, m² o metros? →
> ¿cuántas personas trabajan? → ¿preparar la máquina lleva un tiempo distinto?
> → ¿y la limpieza?

Ocho acordeones para contestar **una** cosa: *cómo se calcula el tiempo de este
paso*. La interfaz cobra ocho gestos por una decisión.

**Y los ejes ya existen, y ya son datos.** La ficha de cada familia declara
`relacionMaquinaSoportada`, `modosTiempoSoportados`,
`mecanismosCantidadSoportados`, `slotsRequeridos`, `nestingConfig`,
`efectosSoportados` ([ficha-familia-pasos.md](ficha-familia-pasos.md)). Hoy el
editor los consulta de a uno, escondidos en 40 condiciones `visible:` que hay
que mantener a mano cada vez que nace una familia.

Si la card **es** el eje, la ficha deja de dibujar sólo el motor y pasa a
dibujar también el editor: una familia nueva no necesita que alguien le agregue
preguntas. Es la regla de siempre — **datos, no `if`**.

## 3. Cómo se ve el punto medio

Una card por eje. Cerrada, una línea con el estado resuelto; abierta, un
formulario chico con **todos** los controles del eje juntos:

```
┌──────────────────────────────────────────────────────────┐
│ ✓ MÁQUINA        Ricoh C8003 · Papel intermedio · color  │  ← cerrada
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ MÁQUINA                                          [Listo]  │  ← abierta
│ ¿En qué máquina se hace y cómo se configura?              │
│                                                           │
│ Máquina      [ Ricoh C8003            ▾]                  │
│ Perfil       [ Papel intermedio       ▾]                  │
│ Color        ( Color ) ( Negro )                          │
│ Tóner        ( Bajo ) ( Medio ) (•Alto)                   │
└──────────────────────────────────────────────────────────┘
```

Es la **densidad de la vista detallada** con el **idioma y el filtrado del
guiado**: se muestran juntos los controles del eje, pero sólo los que aplican a
esta familia y a lo que ya se eligió.

Para `impresion_por_hoja`: **19 preguntas → 6 cards**.

| Eje | Qué decide | Preguntas que absorbe |
|---|---|---|
| Identidad | cómo se llama, quién lo hace | 2 |
| Activación | cuándo corre | 2 |
| Máquina | en qué fierro, con qué perfil | 2 |
| Material · *Sustrato principal* | qué papel y cuánto gasta | 4 |
| El trabajo | cómo se acomoda en el pliego | 2 |
| Tiempo | cuánto tarda | 7 |

### La tensión honesta

**El eje del tiempo no es un formulario plano: es un árbol.** Si lo estima el
comercial, no hay nada más que preguntar. Si se calcula por ritmo, aparece la
magnitud. Si es por tanda, aparece otra cosa. La card tiene que saber
renderizar eso progresivamente, adentro suyo. Es la parte que puede salir fea
si se hace de apuro, y es más trabajo que reagrupar.

Lo mismo, más chico, en Materiales: el eje se repite **por slot** y cada slot
tiene su propio arbolito (fijo → cuál; candidatos → criterio).

## 4. Los siete ejes

| Eje | Qué lo declara en la ficha | Preguntas |
|---|---|---|
| 0 · **Identidad** | — (es del paso, no de la familia) | 3 |
| 1 · **Activación** | `modosActivacionSoportados` | 3 |
| 2 · **Máquina** | `relacionMaquinaSoportada` (M-0/M-1/M-2) | 5 |
| 3 · **Materiales** | `slotsRequeridos`, `permiteSlotsAdicionales` | 10 |
| 4 · **El trabajo** | `nestingConfig`, `derivador`, `paramsPasoSchema`, `efectosSoportados`, `fuentesPiezasNesting` | 5 |
| 5 · **Cantidad** | `mecanismosCantidadSoportados` | 2 |
| 6 · **Tiempo** | `modosTiempoSoportados`, `ritmoDefault` | 12 |

El orden sigue el hilo de alguien parado frente a la máquina:

> qué paso es → cuándo se hace → en qué máquina → con qué material →
> **cómo se acomoda ese material en esa máquina** → cuánto tarda

Dos decisiones de orden que sostienen el resto:

- **El trabajo va después de máquina y material.** La pregunta del acomodado
  dice literalmente "cómo se acomodan las piezas **en el material**":
  preguntarlo antes de saber cuál es el material es preguntar en el vacío.
  (Hoy es la última card del editor — hallazgo H-2.)
- **El tiempo va último** porque depende de todo lo anterior: el ritmo sale del
  perfil de la máquina, la cantidad sale del acomodado.

## 5. El censo completo, por eje

Las 40 preguntas del esquema. `clave` es la del esquema y la del test de
paridad — no cambia aunque cambie de eje. Verificado contra `schema.ts`: ni una
de más, ni una de menos.

### Eje 0 — Identidad

| Clave | Pregunta (hoy) | Cuándo aparece | Nota |
|---|---|---|---|
| `activacion.nombre` | ¿Cómo se llama este paso acá? | siempre | Hoy vive en Activación; es identidad (H-6) |
| `quien.tercerizado` | ¿Quién hace este paso? | siempre | |
| `quien.proveedor` | ¿A quién se le compra y a qué precio? | si es tercerizado | |

### Eje 1 — Activación

| Clave | Pregunta (hoy) | Cuándo aparece | Nota |
|---|---|---|---|
| `activacion.cuando` | ¿Cuándo se ejecuta? | siempre | |
| `activacion.regla` | ¿Con qué regla se activa? | si la activación es CONDICIONAL | |
| `activacion.coejecucion` | ¿Arrastra otros pasos al activarse? | si hay otros pasos en la ruta | Ocultar en pasos que corren siempre (H-7) |

### Eje 2 — Máquina

| Clave | Pregunta (hoy) | Cuándo aparece | Nota |
|---|---|---|---|
| `maquina.maquina` | ¿En qué máquina se hace? | familia M-1, y sin candidatas si es M-2 | |
| `maquina.perfil` | ¿Con qué perfil? | si hay máquina elegida | Se esconde con candidatas, pero el encabezado muestra el perfil igual (H-8) |
| `maquina.candidatas` | ¿Entre qué máquinas elige el comercial? | familia M-2 | |
| `maquina.modo_color` | ¿Se imprime a color o en negro? | familia de impresión con modos, sin candidatas | |
| `maquina.cobertura` | ¿Cuánto tóner gasta por defecto? | si el paso usa una láser | ¿Va acá o en Materiales? El tóner es consumo (H-5) |

### Eje 3 — Materiales

La primera es del paso; las nueve siguientes se repiten **por slot**.

| Clave | Pregunta (hoy) | Cuándo aparece | Nota |
|---|---|---|---|
| `materiales.agregar` | ¿Qué materiales gasta acá? | si la familia declara slots o admite adicionales | |
| `materiales.nombre` | ¿Cómo se llama? | sólo en slots adicionales | |
| `materiales.quien` | ¿Quién decide cuál se usa? | por slot | |
| `materiales.material` | ¿Cuál exactamente? | si el material es fijo | |
| `materiales.candidatos` | ¿Entre cuáles se elige? | si NO es fijo | |
| `materiales.criterio` | ¿Con qué criterio elige el sistema? | si elige el motor | |
| `materiales.consumo` | ¿Cómo se calcula el consumo? | por slot | |
| `materiales.costeo` | ¿Cómo se costea este material? | por slot, salvo que lo defina el acomodado | |
| `materiales.base` | ¿Por cada cuántos se gasta uno? | insumos y adicionales sin magnitud derivada | |
| `materiales.caras` | ¿La doble faz gasta doble? | si la familia multiplica por caras | Emparejar el nombre con su gemela de tiempo (H-3) |

### Eje 4 — El trabajo

| Clave | Pregunta (hoy) | Cuándo aparece | Nota |
|---|---|---|---|
| `oficio.acomodado` | ¿Cómo se acomodan y cobran las piezas en el material? | si la familia acomoda y no deriva geometría | Primera del eje; hoy es la última de todo (H-2) |
| `tiempo.piezas_montar` | ¿Qué monta: piezas del pedido o pliegos impresos? | si la familia declara fuentes de piezas | Hoy vive en Tiempo; es qué agarra el paso |
| `oficio.params_familia` | ¿Con qué parámetros trabaja este paso? | si la familia declara params y editor genérico | |
| `oficio.efectos` | ¿Este paso le exige algo al trabajo? | si la familia soporta efectos | |
| `oficio.talonario` | ¿Cómo se agrupan los talonarios en el pliego? | si la familia declara el param | Aparece en productos que no son talonarios (H-1) |

### Eje 5 — Cantidad

| Clave | Pregunta (hoy) | Cuándo aparece | Nota |
|---|---|---|---|
| `tiempo.cantidad_operativa` | ¿Sobre cuántas piezas trabaja? | si la familia soporta más de un mecanismo | "Calculado por nesting" es vocabulario del motor (H-4) |
| `tiempo.herencia` | ¿De qué paso hereda la cantidad? | si el mecanismo es heredar | |

### Eje 6 — Tiempo

| Clave | Pregunta (hoy) | Cuándo aparece | Nota |
|---|---|---|---|
| `tiempo.comercial` | ¿El tiempo lo estima el comercial al cotizar? | siempre | Raíz del árbol: si es que sí, el resto del eje desaparece. Lleva la pregunta que ve el comercial y si es obligatoria |
| `tiempo.comercial_ayudas` | ¿Qué ayudas le damos al comercial para estimar? | si lo estima el comercial | Valor sugerido y rango aceptado. Último del eje: es opcional |
| `tiempo.modo` | ¿Cómo se mide el tiempo acá? | si no lo estima el comercial y la familia soporta más de un modo | |
| `tiempo.tiempo_fijo` | ¿Cuántos minutos lleva? | T-1 sin máquina ni tiempo del comercial | |
| `tiempo.ritmo_modo` | ¿Cómo medís el ritmo? | T-2 sin tiempo del comercial | |
| `tiempo.productividad` | ¿A qué ritmo? | T-2, si el ritmo no es por tanda | |
| `tiempo.batch` | ¿Cuánto tarda una tanda y de cuántas? | T-2, si el ritmo es por tanda | |
| `tiempo.calcular_segun` | ¿El ritmo cuenta piezas, m² o metros? | T-2 sin tiempo del comercial | |
| `tiempo.centro` | ¿En qué centro productivo se realiza este paso? | si NO hay máquina | |
| `tiempo.dotacion` | ¿Cuántas personas trabajan? | siempre | |
| `activacion.multiplicadores` | ¿Qué variables multiplican el trabajo acá? | si la familia declara multiplicadores | Hoy en Activación; multiplica el TIEMPO. Emparejar con `materiales.caras` (H-3) |
| `oficio.setup` | ¿Preparar la máquina lleva un tiempo distinto acá? | si hay máquina | Hoy en Ajustes; es tiempo |
| `oficio.cleanup` | ¿Y la limpieza al terminar? | si hay máquina | Hoy en Ajustes; es tiempo |

## 5.bis El prototipo (2026-08-07)

Antes de reagrupar las 40, se construyó **una** card de eje —la del tiempo— y
se probó en dos pasos reales. Está en `EjeGuiado`
([config-pasos-editor-view.tsx](../src/components/productos-servicios/config-pasos-editor-view.tsx)),
sin tocar el esquema: usa las mismas opciones declaradas y las renderiza juntas.

**Qué se probó y qué dio:**

| Paso | Antes | Ahora |
|---|---|---|
| Impresión por hoja (Ricoh, el ritmo lo pone el perfil) | 3 acordeones | 1 card |
| Tensado de lona (T-2 con ritmo propio) | 7 acordeones | 1 card |

El caso difícil —el árbol— **funciona**: al elegir "Productividad por hora"
aparece el ritmo con su unidad; si fuera por tanda aparecería el control de
tanda. Todo dentro de la misma card, sin abrir nada.

**Los dos problemas que dejó a la vista, ya resueltos:**

- **P-1 · La línea cerrada no decía lo que importa.** Tomaba los primeros tres
  resúmenes y quedaba *"No — se calcula solo · Produccion & Taller · 1 persona
  · +4"*: abría con lo menos informativo y escondía el ritmo. **Resuelto**: el
  eje declara `resumenPrincipal` —las claves que lo definen, en orden— y ahora
  se lee *"30 m de borde/h · Cantidad pedida directa · 1 persona · +4"*.
- **P-2 · El orden interno era el de declaración, no el del árbol.** *Resuelto
  por otro lado, mejor*: en vez de ordenar por dependencia, el eje se parte en
  **sub-bloques con nombre** (§5.ter). "Sobre cuántas piezas trabaja" ya no se
  cuela entre el ritmo y su magnitud porque vive en otro bloque.

## 5.ter Los sub-bloques del eje (2026-08-07)

Sobre una idea de Lucas: dentro del eje, las preguntas dejan de ser preguntas y
pasan a ser **campos con etiqueta corta**, agrupados en bloques que explican
para qué sirven. "¿En qué centro productivo se realiza este paso?" se vuelve el
campo `Centro productivo` del bloque "Dónde se hace".

El eje del tiempo quedó así:

| Bloque | Ayuda | Campos |
|---|---|---|
| *(sin título)* | — | La bifurcación raíz, en dos tarjetas: **se calcula solo** / **lo estima el comercial** |
| **Dónde se hace** | El centro define la tarifa por hora. Sumar personas no acorta el trabajo. | Centro productivo · Personas en simultáneo |
| **Ritmo de trabajo** | Cómo se mide la velocidad. Es lo único que cambia los minutos. | Cómo se mide · Tipo de ritmo · Ritmo · Tanda · El ritmo cuenta · Minutos por trabajo |
| **Sobre qué cantidad se aplica** | Qué número multiplica al ritmo cuando entra una orden. | Base de cantidad · Hereda de · Qué monta |

Tres cosas que se declaran en el esquema y no en el render: `grupo` (a qué
bloque pertenece), `etiqueta` (el nombre corto del campo) y `anchoCompleto`
(los controles anchos no se parten en media columna).

### La ayuda tiene que decir lo que hace el motor

El mockup que disparó esto traía dos frases razonables y equivocadas: *"las
personas en simultáneo dividen el tiempo total"* y *"por hora y por persona"*
al lado del ritmo. Las dos son falsas. En
[`calcularTiempoYCosto`](../apps/api/src/motor-universal/motor.service.ts) la
dotación **no entra en `runMin`**: multiplica el **costo**, y sólo en pasos
**sin máquina** (con máquina la capacidad son horas-máquina, y la máquina es
una sola la atiendan uno o cuatro).

Un texto de ayuda que explica el modelo al revés es peor que no tener ayuda: el
modelador configura creyendo otra cosa. De paso se corrigió la ayuda de
`tiempo.productividad`, que decía "cuánto produce **una persona** por hora".

**Descartado (Lucas)**: el pie "cómo queda el cálculo" con el ejemplo en vivo.
Calcularlo en el frontend sería duplicar el motor —el pecado que este refactor
viene borrando— y hacerlo bien pedía un endpoint de simulación por paso.

### El diseño de referencia

Lucas armó la card en Claude Design (`pasos/Cuánto tarda.html` del proyecto
`019e1ce2-2c55-78f3-931e-3bafe60d533f`) y de ahí salieron los detalles que la
primera pasada no tenía:

- **Contador con − y +** para las personas, en vez de un input suelto. Lo
  declara el control: `stepper: true` en el `numero`.
- **Segmented** para el tipo de ritmo, en vez de botones sueltos. Cualquier
  control `pills` dentro de un eje se renderiza así.
- **Grilla por bloque**: el select ancho al lado del contador chico
  (`minmax(0,1fr) 168px`), no dos columnas iguales. Lo declara el grupo
  (`columnas`).
- **Cajas de control de 34 px** con el mismo alto y el mismo borde para todos
  los campos del eje.
- **Chip de equivalencia**: "Equivale a 30 m de borde/h · el sistema lo guarda
  como ml/h". El modelador escribe en su idioma y ve cómo queda guardado, sin
  que la unidad interna sea un control.
- **La rama cuelga de una línea**: los bloques que dependen de la bifurcación
  llevan `border-left`, así se ve que son consecuencia de la decisión de
  arriba.
- **Escape al pie y en chico**: "o un tiempo fijo estimado" dejó de competir en
  tamaño con el ritmo, que es lo principal.

Del diseño se tomó todo salvo el pie del cálculo, y se corrigieron las dos
frases de ayuda que explicaban el modelo al revés (arriba).

Después vinieron dos cirugías sobre los controles, que son las que hacían que
el bloque del ritmo no se pareciera al diseño:

- **El ritmo es una oración.** "¿A qué ritmo?" pedía tres cosas en tres
  lugares: el número, la *Unidad* (ml/h, m²/h, unid./h) y, en otra card, *el
  ritmo cuenta*. Para el modelador es una sola idea —"30 metros de borde por
  hora"— y separarlas obligaba a acertar la combinación. Ahora las magnitudes
  se ofrecen ya combinadas y elegir una escribe los dos params. La card "El
  ritmo cuenta" sólo sobrevive en tanda, donde no hay oración.
- **El tiempo fijo es un modo, no una nota al pie.** Vivía como un escape
  ("o un tiempo fijo estimado") cuando el motor le da PRIORIDAD sobre el
  ritmo: era lo más determinante del bloque, en el renglón más chico. Ahora es
  la tercera opción del segmented. Se sigue guardando en `horasEstimadas`;
  `timeCalculationMode: "tiempo_fijo"` sólo declara la intención y es inerte
  para el motor. Un paso con horas cargadas se muestra como tiempo fijo aunque
  tenga guardado otro modo —es lo que el motor va a hacer— y salir del modo
  borra las horas, porque si quedaran el ritmo recién elegido no se usaría.

### La rama del comercial

Segundo diseño de Lucas, para cuando el paso lo estima quien cotiza. Se tomó
entero: la pregunta que ve el comercial, la unidad, el valor sugerido, el rango
aceptado y el interruptor de obligatorio, en dos bloques con nombre ("Qué se le
pide al comercial", "Ayudas y validación") colgando de la misma línea.

**Lo único que no se implementó, y por qué**: el diseño ofrecía *"Carga el
tiempo en minutos **por cada** [pieza del ítem]"*. El motor no hace eso: en
`resolverTiempoManualMin` lo que carga el comercial ES el `runMin` del paso, sin
multiplicar por la cantidad. Un selector que no hace nada es peor que no tener
selector, así que no se puso. Si el "por cada pieza" se quiere de verdad, es una
funcionalidad del motor con su propio diseño, no un control.

Tres ajustes de Lucas sobre la primera versión de esta rama:

- **La pregunta y su unidad, en la misma fila.** El input de texto se comía un
  renglón entero sin necesitarlo.
- **"Ayudas y validación" al final del eje**, después de "dónde se hace": es lo
  único opcional y no debería competir con lo que sí hay que definir. Para eso
  se separó en su propia opción (`tiempo.comercial_ayudas`, grupo `ayudas`
  declarado último) — el censo pasó de 40 a **41 preguntas**.
- **"Obligatorio para presupuestar" se mudó junto a la pregunta.** Estaba
  dentro de "Ayudas y validación" y se leía como una ayuda más, cuando es de
  otra naturaleza: sugerido y rango son pistas para contestar bien; obligatorio
  decide **si se puede seguir sin contestar** (el motor corta con
  `tiempo_manual_requerido`). Es una propiedad de la pregunta, como el
  asterisco de un campo requerido.

### El encabezado del bloque va al costado (Lucas)

Título y ayuda del bloque ocupaban un renglón entero arriba de sus campos,
teniendo ancho de sobra al lado. Ahora cada bloque es una grilla de dos
columnas —encabezado angosto (140–200 px) + campos— y la card entra en la mitad
del alto. Sirve para los cuatro bloques del eje, incluidos los del comercial.

Efecto de segundo orden: la ayuda vive en una columna angosta, así que se
acortó a **una** frase, y a la que aporta. "Cómo se mide la velocidad del paso.
Es lo único que cambia los minutos por ítem." se quedó con la segunda mitad: la
primera ya la dice el título del bloque.

## 6. Hallazgos abiertos

Numerados para discutirlos de a uno. Ninguno implementado.

| # | Hallazgo | Dónde | Estado |
|---|---|---|---|
| H-1 | Le pregunta por **talonarios a un folleto**: la card se muestra porque la FAMILIA declara `modoTalonarioIncompleto`, no porque el producto sea de talonarios. | `oficio.talonario` | Abierto |
| H-2 | El **acomodado queda último**, detrás de setup y limpieza. Para impresión por hoja es *la* decisión de oficio: cuántas poses entran, el aprovechamiento, cuánto papel se compra. | `oficio.acomodado` | **CERRADO** — primero del eje "El trabajo" (`orden: 0`) |
| H-3 | Las **caras se preguntan dos veces** y no se ve que sean parientes: una multiplica el tiempo, la otra el material. Que sean dos está bien; que estén lejos y con nombres distintos, no. | `activacion.multiplicadores` + `materiales.caras` | Abierto |
| H-4 | **"Calculado por nesting"** como respuesta visible: era el nombre del mecanismo interno, no lo que hace. | `tiempo.cantidad_operativa` | **CERRADO** — dice "La calcula el propio paso" |
| H-5 | El **tóner vive en "Máquina y perfil"**: es consumo, no una propiedad del fierro. | `maquina.cobertura` | Abierto |
| H-6 | El **nombre del paso vivía en "Activación"**, cuando es identidad. | `activacion.nombre` | **CERRADO** — abre el eje "Qué paso es" |
| H-7 | **"¿Arrastra otros pasos?" en un paso que corre siempre.** Se cerró escondiendo la pregunta en pasos obligatorios — **y estaba MAL**: `resolverArrastreOpcionales` trata al obligatorio como activo, así que arrastra, y eso vuelve obligatorio de hecho al arrastrado. Esconderla borraba una capacidad real. | `activacion.coejecucion` | **CERRADO al revés** — se muestra siempre, avisando la consecuencia |
| H-8 | El encabezado muestra **"Perfil: Papel intermedio"** pero no hay pregunta para tocarlo (se esconde cuando hay candidatas). Se lee como un perfil clavado. | `maquina.perfil` | Abierto |

## 7. Los dos caminos

**A — Reagrupar.** Las 40 opciones siguen declaradas igual; cambian de sección
a eje y la card del eje las renderiza todas juntas en vez de una por acordeón.
Bajo riesgo, el test de paridad sigue sirviendo, y la ganancia de gestos
(19 → 6) es inmediata.

**B — Generar desde la ficha.** El editor le pregunta a la ficha qué ejes tiene
y arma una card por eje. Las 40 opciones pasan a ser el *contenido* de un eje
en vez de items de primer nivel. Es lo estructuralmente correcto y el que hace
que una familia nueva traiga su editor puesta.

**Recomendación: A es el primer paso de B.** Que cada opción declare a qué
**eje** pertenece en vez de a qué sección ya es la mitad de B, y se puede hacer
sin inventar una abstracción nueva ni tocar el motor. Cuando los ejes existan
como agrupador de verdad, hacer que la ficha los ordene y los filtre es un
cambio chico.

## 7.bis Los tres ejes de la cabecera (2026-08-07)

Con el eje del tiempo cerrado, se convirtieron los tres de arriba —los que se
leen primero y hacían que el editor pareciera dos aplicaciones distintas: cuatro
acordeones viejos, la card del tiempo, más acordeones—.

Con eso se dio el **paso A del §7**: cada opción declara ahora a qué **eje**
pertenece (`eje` en `OpcionPaso`) en vez de agruparse por su sección, y el
render filtra por eje (`opcionesDeEje`). La sección sobrevive porque el
detallado congelado y el test de paridad todavía la usan.

| Eje | Bloques | Se lee |
|---|---|---|
| **Qué paso es** | nombre + quién lo hace; el proveedor si es tercerizado | "Impresión por hoja · Lo produce la empresa" |
| **Cuándo se ejecuta** | cuándo; la condición; a quién arrastra | "Siempre" |
| **En qué máquina** | máquina/candidatas + perfil; cómo se configura (color, tóner) | "1 candidata: Ricoh C8003 · Cobertura alta de tóner" |

**El tiempo se mudó al final.** Estaba donde vivía la vieja sección "Tiempo y
costo", entre activación y máquina, contra el orden que este mismo documento
acordó: el ritmo sale del perfil de la máquina y la cantidad sale del acomodado,
así que preguntarlo antes es preguntar sin los datos.

De paso cerraron tres hallazgos (§6): H-4, H-6 y H-7 — este último **primero
mal y después bien**, ver abajo.

### La card de activación, tal cual el diseño

Segundo archivo de Lucas (`pasos/Cuándo se ejecuta.html`). Se tomó completo
salvo el pie "Cómo queda", que repite lo que ya dice la línea de la card
cerrada:

- **Segmented de cuatro**, con "No se usa acá" separado por una línea y en
  gris: apaga el paso, no es un modo más, y no debería elegirse de pasada.
- **Debajo, qué implica el modo elegido** ("Corre en todas las OT que pasen por
  esta ruta. No hace falta que nadie lo active."). Elegir entre cuatro
  etiquetas cortas sin saber qué hace cada una es adivinar.
- **El arrastre como chips** con casilla, contador ("2 de 7") y un "Ninguno"
  para limpiar, todo en la línea del título.
- **Bloques apilados y separados por línea horizontal**, no con el encabezado
  al costado: acá el contenido usa todo el ancho (chips, filas de regla) y una
  columna de título lo apretaría. Lo declara el grupo (`encabezado: "arriba"`).

**Y el diseño corrigió un error mío.** Había cerrado H-7 escondiendo "¿arrastra
otros pasos?" en los pasos obligatorios, razonando que "si corre siempre,
arrastrar no cambia nada". Es falso: en `resolverArrastreOpcionales` un paso
OBLIGATORIO cuenta como activo, así que arrastra — y al hacerlo vuelve
obligatorio de hecho a un paso opcional. El diseño lo mantiene visible y avisa
la consecuencia, que es lo correcto. Queda como test.

**El RuleBuilder, con la forma del diseño.** Las filas de la condición —campo ·
operador · valor con su unidad · quitar—, el conector Y/O en la línea entre
filas, el "Agregar condición" punteado y la caja de valor vacía teñida de
ámbar. La lógica (parseo desde/hacia jsonLogic, campos, operadores) no se tocó:
se reescribió sólo el render de `rule-builder.tsx`. Los campos numéricos
ganaron una `unidad` opcional (u, m², mm) para el sufijo del valor.

Del diseño quedó afuera una sola cosa, y es de motor, no de estilo: el operador
**"está entre"** (rango con dos valores). El modelo de reglas hoy tiene =, ≠,
>, ≥, <, ≤ y el motor evalúa jsonLogic con esos; agregar un `between` es tocar
el evaluador, no el editor. Si hace falta, es su propio trabajo.

## 7.ter Materiales — una card por material (2026-08-07)

**Decisión: una card de eje por material** (recomendación tomada). Cada slot
—"Sustrato principal", "Tinta"— es una decisión con nombre propio, así que se
lee como las demás cards: cerrada, la línea de estado ("Papel ilustración
brillante · Material fijo · Por unidad producida"); abierta, dos sub-bloques:

- **Cuál material** — quién lo decide (fijo / comercial / motor), cuál o entre
  cuáles, y con qué criterio si elige el motor.
- **Consumo y costo** — cómo se calcula el consumo, cómo se cobra, cada cuántos
  y si la doble faz gasta doble.

Para esto se generalizó `EjeGuiado`: dejó de computar sus opciones desde un
`eje` y ahora las recibe explícitas (`opciones` + `grupos`), más una acción a
la izquierda del "Cambiar" (el "Quitar" del material). El mismo componente sirve
para los cinco ejes y para cada material. La sección "Materiales" quedó con su
título y la pregunta de nivel paso ("¿qué materiales gasta acá?", que agrega un
material); cada material configurado es su card debajo.

Sin cambios de motor: golden masters 148/148 y 7/7.

## 7.quater El patrón de encabezado fijo + Materiales rediseñado (2026-08-07)

**Decisión de Lucas, con la que coincido**: en el editor enfocado (una pantalla
por paso, se recorre de arriba a abajo) el "Cambiar" de cada sección es un click
de más. Las secciones pasan a estar **siempre abiertas**, con el **check del
encabezado** cargando la señal de "resuelto/falta" que antes daba la línea
colapsada. Sólo los **materiales** siguen en acordeón, porque un paso puede
tener varios y abrirlos todos comería la pantalla.

Precisión de Lucas sobre el fondo: **las secciones llevan card (fondo); sin
fondo van sólo los encabezados de grupo.** Así:

- Cada eje (Qué paso es, Cuándo se ejecuta, En qué máquina, Cuánto tarda) es una
  card siempre abierta, sin "Cambiar" (`fijo` en `EjeGuiado`).
- **Materiales** es un **encabezado de grupo sin fondo** —"Materiales que
  consume · N componentes" + descripción + "Agregar componente"
  (`EncabezadoGrupo`)— y **cada material una card** que sí colapsa.

Y el interior de la card de material se rehízo sobre el diseño
`pasos/Materiales que consume.html`: cuatro sub-secciones apiladas — **Quién
elige el material** (tres tarjetas con radio: fijo / comercial / sistema, no
tres pills), **El material** (el buscador + lista), **Con qué criterio elige**
(sólo cuando elige el sistema) y **Cuánto se descuenta**. El buscador de
materiales reusa los componentes que ya traían los datos reales.

Nada de esto es maquillaje suelto: `EjeGuiado` ganó un modo `fijo`, las pills
un `presentacion: "tarjetas"`, y los grupos de material se declaran igual que
los de cualquier eje. Golden masters 148/148 y 7/7.

## 7.quinquies "El trabajo" es un eje, y la última sección vieja muere (2026-08-07)

"Ajustes del trabajo" era lo último con el estilo viejo (encabezado en
mayúsculas, `SeccionGuiada`). Ahora es el eje **"El trabajo"**, con el mismo
patrón que el resto: encabezado sin fondo + card. Adentro, dos sub-bloques:

- *(sin título)* — el **acomodado** primero (es la decisión más cara: cuántas
  poses entran, el aprovechamiento, cuánto papel se compra — cierra H-2 con un
  `orden: 0` declarado), después params de familia, efectos y el talonario.
- **Preparación y limpieza** — los minutos fijos de setup y cleanup, si difieren
  del perfil de la máquina.

Con esto `SeccionGuiada` y `opcionesDeSeccion` quedan sin uso y se borran: TODO
el editor guiado se arma por EJES.

**En qué máquina** también se limpió de paso: la etiqueta "Máquinas candidatas"
duplicaba el encabezado que ya pone el componente ("Máquinas candidatas para
este paso"); se sacó, como con los materiales.

Queda **H-1** (el talonario aparece en un folleto porque la familia
`impresion_por_hoja` declara el param para todos sus productos) — es su propio
arreglo, distinto de estos reordenamientos.

## 8. El repaso, familia por familia

Abrir un paso REAL de cada familia en dev y leer lo que muestra, como se hizo
con `impresion_por_hoja`. Los hallazgos entran en §6.

| Familia | Repasada | Producto usado |
|---|---|---|
| `impresion_por_hoja` | ✅ 2026-08-07 | Folletos / flyers (Ricoh C8003) |
| `pre_prensa` | — | |
| `impresion_por_area` | — | |
| `impresion_por_pieza` | — | |
| `impresion_3d` | — | |
| `aplicacion_transfer` | — | |
| `aplicacion_transfer_textil` | — | |
| `grabado_laser` | — | |
| `corte_guillotina` | — | |
| `plotter_corte` | — | |
| `corte_laser` | — | |
| `troquelado_digital` | — | |
| `cnc` | — | |
| `plegado` | — | |
| `corte_manual` | — | |
| `laminado` | — | |
| `plastificado_pouch` | — | |
| `pintura_superficial` | — | |
| `abrochado_caballete` | — | |
| `encuadernado_anillado` | — | |
| `engomado_emblocado` | — | |
| `montaje_sobre_sustrato` | — | |
| `ensamble_estructural` | — | |
| `estructura_bastidor` | — | |
| `iluminacion_led` | — | |
| `embalaje` | — | |
| `trabajo_manual` | — | |
| `modificacion_post` | — | |
| `colocacion_ojales` | — | |
| `instalacion_in_situ` | — | |
| `diseno_grafico` | — | |

## 9. Lo que queda por definir

1. **¿A o B?** Ver §7. La recomendación es A primero, con los ejes ya
   declarados para que B sea un paso corto después.
2. **¿El tóner es máquina o material?** (H-5). Argumento para máquina: es un
   consumible de ESA máquina y sale de su ficha. Para material: es plata que se
   gasta. **Sin definir.**
3. **¿La cantidad es un eje propio o vive dentro de Tiempo?** Son dos preguntas
   solas (`cantidad_operativa`, `herencia`) y en la práctica se contestan
   pensando en el tiempo. Una card de dos líneas puede ser más ruido que ayuda.
   **Sin definir.**
4. **¿El orden de los ejes es fijo o lo declara la ficha?** Un `trabajo_manual`
   sin máquina ni acomodado se lee muy distinto que una impresora. **Sin
   definir**: empezar por orden fijo y ver si alguna familia lo pide.
5. **¿Sobra o falta alguna pregunta?** Este repaso todavía no propuso ni sacar
   ni agregar ninguna. Es probable que aparezcan al recorrer las 30 familias
   que faltan.

## 10. "El trabajo" se disuelve: una sección por concepto (2026-08-14)

Disparado por una lectura de Lucas de la sección "El trabajo": *"no quiero una
sección donde metamos cosas juntas que no entren en otras. Que cada cosa tenga
su lugar, estructurado."*

### 10.1 El diagnóstico: "El trabajo" no es un eje, es un residuo

Un eje legítimo es **una decisión con un árbol adentro**: "Máquina" (en qué
fierro y con qué perfil) o "Tiempo" (cómo se calcula) son una sola cosa aunque
tengan muchos controles. "El trabajo" no pasa ese test — junta **tres
decisiones sin hilo común**:

| Tarjeta (hoy en el eje `trabajo`) | Qué decide | Con qué se relaciona de verdad |
|---|---|---|
| `oficio.acomodado` | cómo se acomodan y cobran las piezas **en el material** | Materiales / el sustrato |
| `oficio.params_familia` | las perillas del oficio (refuerzos del bastidor, densidad del LED) | la familia misma |
| `oficio.efectos` | qué le **exige** el paso al trabajo (demasía para envolver) | geometría / pasos vecinos |

Es el descendiente directo de la vieja sección **"oficio" / "Avanzado"** del
censo E.0: el cajón donde caía "lo que no entraba en otra sección". Que era un
cajón lo prueba que **partes ya se mudaron a su lugar** — setup/cleanup pasaron
al eje **Tiempo**, `piezas_montar` también. Lo que queda en "El trabajo" es el
**residuo** de esa mudanza a medio hacer. Los hallazgos H-1 (talonario en un
folleto) y H-5 (tóner en Máquina siendo consumo) son el mismo problema de
domicilio equivocado, en otras piezas.

### 10.2 El rastrillo de las 31 familias

Clasificación estática de qué familia dispara cada tarjeta de "El trabajo"
(predicados reales del render — `nestingAplica`, `familiaConParamsEditables`,
`soportaDemasiaMedida`; ver `src/lib/editor-paso/schema.ts` opciones
`oficio.*`). **Distinto del §8**, que es abrir el paso real en dev y leerlo;
esto es análisis del catálogo `apps/api/src/productos-servicios/pasos/familias.ts`.

**Sólo 10 de 31 familias muestran "El trabajo" con contenido; 21 caen en el
estado vacío.** Y no hay solapamientos: cada familia dispara por una sola
tarjeta.

| Tarjeta | Predicado (de la ficha) | Familias |
|---|---|---|
| **Acomodado** | `nestingConfig` && no `derivador` | `impresion_por_hoja`, `impresion_por_area`, `plotter_corte`, `laminado`, `plastificado_pouch`, `montaje_sobre_sustrato` (6) |
| **Params del oficio** | `editorParamsGenerico` && `paramsPasoSchema`>0 | `estructura_bastidor`, `iluminacion_led`, `colocacion_ojales` (3) |
| **Efectos** | `efectosSoportados` incluye `demasiaMedida` | `trabajo_manual` (1) |

Hallazgo lateral (para 10.4): **11 familias más tienen `paramsPasoSchema` real
pero NO muestran la tarjeta de params** porque les falta `editorParamsGenerico`
(por diseño: tienen UI a medida o el motor aún no consume esos params). La
tarjeta de params está gateada por un flag que casi nadie tiene, no por la
existencia del schema.

### 10.3 El principio: "camino B", que la ficha declare la sección

Lo que pide Lucas —*"sección necesaria se muestra, la que no toca el paso no se
muestra, pero estructurada"*— **ya es la física de `EjeGuiado`**: recibe las
opciones filtradas por `visible(ctx)` y si quedan cero devuelve `null` (la card
desaparece). Por eso "El proveedor" sólo aparece en pasos tercerizados. *5
pasos con efectos muestran la misma sección Efectos; los pasos con nesting
muestran Acomodo* — eso no hay que construirlo, es cómo funciona el componente.

Lo que falta es el **camino B del §7**: que la ficha declare qué secciones tiene
y el editor arme una card por sección declarada. El "paso A" ya está (cada
opción declara su `eje`). El bloqueo estructural real: **hoy la lista y el orden
de las 8 secciones están hard-codeadas como JSX secuencial** en
`config-pasos-editor-view.tsx` (~13554-14024) — no existe un array
`SECCIONES = [{ eje, titulo, subtitulo, filtro, resumenPrincipal, cuándo }]`
sobre el que el render itere. **Ese array es la pieza que convierte "cajón" en
"sistema"**, y es el corazón del refactor.

### 10.4 La taxonomía objetivo

"El trabajo" se disuelve; cada concepto pasa a sección de un solo tema, mostrada
sólo si la familia la declara:

| Sección | La declara la ficha con | Familias | De dónde sale |
|---|---|---|---|
| **Nesting** *(titulada "Acomodo" hasta 2026-08-14)* | `nestingConfig` && no `derivador` | 6 | tarjeta acomodado (menos el costeo, ver 10.5) |
| **Parámetros del oficio** | `editorParamsGenerico` + schema | 3 (+revisar las 11) | tarjeta params |
| **Efectos** | `efectosSoportados` | 1 (creciendo) | tarjeta efectos |
| *(costeo del sustrato)* | `slot.estrategiaCosto` en **Materiales** | — | se va de "El trabajo" |
| *(talonario, H-1)* | arreglo aparte | — | se va de "El trabajo" |

Con esto **"El trabajo" desaparece** como sección. La tensión con el norte del
doc ("menos cards, 19→6") es aparente: la regla es *una card por decisión*;
partir un residuo en sus decisiones reales la cumple. El enemigo no es el número
de secciones sino la incoherencia de meter tres cosas en una. Un paso simple
(`corte_manual`) sigue mostrando 0 de estas, porque cada una se auto-oculta.

### 10.5 El costeo del sustrato: reunificar en Materiales

Hallazgo técnico (verificado en el motor): **el costeo del sustrato hoy es
por-PASO, no por-material.** Existe un mecanismo por-slot (`slot.estrategiaCosto`,
declarado en el schema, persistido, leído por el motor) **pero para el sustrato
nesteado está apagado en UI** (`schema.ts` oculta `materiales.costeo` cuando el
slot es `sustrato_principal` y hay nesting) **y subordinado en el motor**:
`resolverEstrategiaCosteoNesting` (`apps/api/src/motor-universal/motor.service.ts`
~4725) lee `paramsPasoJson.nestingConfig.costing.strategy` — único por paso — y
si existe y no es `simple` **pisa el `estrategiaCosto` de todos los slots**.
Consecuencia: con más de un sustrato, hoy **no se puede costear cada uno
distinto**.

**Decisión (Lucas, 2026-08-14): sólo reunificar en UI.** El control de costeo
sale del Acomodado y vuelve a la tarjeta de cada material en Materiales, donde ya
existe `slot.estrategiaCosto`. Alcance acotado:

- invertir la prioridad en `resolverEstrategiaCosteoNesting` para que mande
  `slot.estrategiaCosto` (o dejar de leer `nestingConfig.costing.strategy`);
- dejar de ocultar `materiales.costeo` para el sustrato nesteado
  (`schema.ts` `nestingDefineCosteo` / la condición del slot sustrato);
- sacar el bloque "Costeo del sustrato" del `AcomodadoDetalladoEditor` y que
  `updateNestingCosting` / `nestingConfig.costing` dejen de ser fuente de verdad
  (posible migración de datos guardados en `paramsPasoJson.nestingConfig.costing`);
- ajustar los resúmenes/preview que hoy leen `nestingConfig.costing`.

**Fuera de alcance por ahora:** costeo real multi-sustrato (cada sustrato con su
propio nesting y `segmentSteps`). El nesting corre **una sola vez por paso**;
costear dos sustratos distinto de verdad es un cambio de motor con su propio
diseño. Se deja anotado, no se compromete.

### 10.5.bis Acomodo consistente: el rollo también muestra su costeo (2026-08-14)

Feedback de Lucas: el costeo del sustrato se ocultaba en rollo, y eso deja al
usuario preguntándose "¿cómo se cobra en rollo?". Ahora el bloque "Costeo del
sustrato" se muestra **siempre**: en SHEET (placa/pliego) es el selector de
estrategia; en ROLLO —donde hoy hay una sola forma, *largo consumido × ancho
útil incluido el sobrante*— se muestra **resuelta e informativa** ("Estrategia:
Largo consumido"), no como dropdown falso ni como valor guardado que el motor
ignoraría (sería el dato muerto que este mismo trabajo eliminó).

**La forma de rollo vive en el CATÁLOGO, no hardcodeada en el front**
(`ROLLO_COSTEO_OPTIONS` en catalogo-materiales.ts) — feedback de Lucas: "si hay
un catálogo de estrategias, la de rollo debería ser una". Va aparte de las 4 de
placa/pliego porque el rollo NO tiene la decisión "qué hago con la última unidad
parcial" (es continuo); `costingStrategyOptions` siempre devuelve las 4 y el
`consumed-length` del catálogo es sheet-only (tira error si no es sheet). El
costeo del rollo YA está implementado de verdad, pero en la ruta de la FÓRMULA
(`por_metro_lineal` × el largo consumido que da el nesting, motor.service.ts
~4278), no en `applyCostingStrategy` (que modela la decisión de sheet). Es el
punto de extensión: cuando el rollo tenga MÁS de una forma (cobrar hasta la
última pieza vs el segmento entero vs redondear a X metros), se agregan a
`ROLLO_COSTEO_OPTIONS` + su rama en el motor, y el display pasa a selector.
Cambio UI-only, costos idénticos.

### 10.6 Decisiones tomadas (Lucas, 2026-08-14)

1. **Acomodo = sección propia** (no sub-bloque del material sustrato). Card de
   primer nivel después de Materiales.
2. **Costeo del sustrato = sólo reunificar en UI** (10.5). Multi-sustrato real
   queda documentado, sin comprometer alcance.
3. **Efectos = crearla ya**, con 1 familia. La estructura existe primero; se
   muestra cuando la familia declara `efectosSoportados`.

### 10.7 Lo que sigue

Reordenado tras leer el render (2026-08-14, Lucas): el array `SECCIONES` global
se **descartó por ahora** — es un rewrite de las ~480 líneas del render, alto
riesgo y sin pago visible, y dos secciones (Materiales por-slot, estado vacío)
lo resisten. La disolución de "El trabajo" NO lo necesita: se hace con el patrón
de split que ya existe (filtrar `opcionesDeEje` por `clave`, como Identidad→2 y
Tiempo→2).

1. **Disolver "El trabajo" → 3 secciones (Acomodo · Parámetros del oficio ·
   Efectos), en su lugar actual.** **HECHO (2026-08-14, sin commitear)** en
   `config-pasos-editor-view.tsx`: el bloque único se reemplazó por tres
   `<EjeGuiado>`, cada uno filtrando el eje `trabajo` por `clave`
   (`oficio.acomodado` / `oficio.params_familia` / `oficio.efectos`) y
   auto-ocultándose con 0 opciones. `clave`/`seccion` intactas → el test de
   paridad no se toca. El **estado vacío** se quitó (su "agregar material" era
   redundante con "Agregar componente" de Materiales). Typecheck limpio;
   verificación visual pendiente (otra sesión tenía el dev server tomado).
2. Reubicar **Acomodo justo tras Materiales** (decisión 1, H-2). **HECHO
   (2026-08-14, sin commitear)**: las tres secciones del trabajo (Acomodo ·
   Parámetros del oficio · Efectos) se movieron a ANTES de Tiempo. Orden final:
   Materiales → Acomodo → Parámetros del oficio → Efectos → Tiempo. Cumple las
   dos reglas del §4 a la vez ("El trabajo tras material" y "Tiempo último",
   porque la cantidad que el tiempo multiplica sale del acomodado). Se movió el
   trío completo, no sólo Acomodo, para no dejar Tiempo en el medio. Typecheck
   limpio; visual pendiente (dev server tomado por otra sesión).
3. Costeo del sustrato: **el nesting es el dueño** (10.5). **HECHO
   (2026-08-14, sin commitear), verificado bit-idéntico.** La investigación
   (docs/nesting-abstraccion-diseno.md §3.3) mostró que el costeo es función del
   `NestingResult` y hay UNA corrida por paso → el dueño es el nesting, no el
   material; el viejo `slot.estrategiaCosto` era un espejo redundante. Cambios:
   - **Motor** `resolverEstrategiaCosteoNesting`: `nestingConfig.costing` es la
     fuente única; se retiró el fallback al slot. Verificado con un arnés que
     cotiza los 4 productos del seed en 5 escenarios → **0 diferencias** (seed
     sincronizado). Suite del motor estable (12 fallos pre-existentes de
     selección de algoritmo, 0 nuevos).
   - **Editor guiado**: se eliminó la pregunta `materiales.costeo` (+ helper,
     tests, CENSO). **Detallado**: se eliminó el control "Costeo" por slot. El
     costeo vive sólo en Acomodo.
   - **Backfill (requisito de deploy) — HECHO y verificado.** Migración
     `20260814120000_backfill_costeo_sustrato_nesting`: copia el costeo del
     sustrato no-`simple` del slot → `nestingConfig.costing.strategy` donde el
     nesting no lo define (JSONB, crea los padres si faltan, idempotente). Corre
     ANTES del código nuevo en el deploy, así que preserva las cotizaciones de
     pasos prod des-sincronizados. Verificado con un test que fabrica el caso
     des-sincronizado (nesting sin costing, sin nestingConfig, y con otra
     strategy) y confirma que copia/crea/no-pisa correctamente; aplicada a
     `gdi_saas_test` sin error (no-op sobre el seed sincronizado).
   - **DROP de la columna `estrategiaCosto` — HECHO.** Migración
     `20260814130000_drop_estrategia_costo_slot` (corre DESPUÉS del backfill).
     Se sacaron los ~16 reads/writes de la columna del slot (services, DTO,
     `SlotCargado`/`PasoCargado` en tipos, seed de plantillas, front types y
     editor), **distinguiéndolos de la etiqueta de salida homónima** de las
     líneas de costo (`m.estrategiaCosto`, `'costo_por_click'`,
     `'consumo_maquina_por_m2'`), que se queda. Typecheck api + front limpios;
     `prisma generate` corrido; migración aplicada a `gdi_saas_test`; suite del
     motor en el baseline (12 pre-existentes de algoritmo, 0 nuevos). Con esto
     el costeo del sustrato tiene UNA sola representación en datos:
     `nestingConfig.costing`.
4. Revisar las 11 familias con `paramsPasoSchema` sin `editorParamsGenerico`:
   cuáles deberían encender "Parámetros del oficio" (10.2).
5. Retomar H-1 (talonario) y H-5 (tóner) con el mismo criterio de domicilio.
6. (Diferido) El array `SECCIONES` global, sólo si reordenar secciones se
   vuelve frecuente.
