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

## 6. Hallazgos abiertos

Numerados para discutirlos de a uno. Ninguno implementado.

| # | Hallazgo | Dónde | Estado |
|---|---|---|---|
| H-1 | Le pregunta por **talonarios a un folleto**: la card se muestra porque la FAMILIA declara `modoTalonarioIncompleto`, no porque el producto sea de talonarios. | `oficio.talonario` | Abierto |
| H-2 | El **acomodado queda último**, detrás de setup y limpieza. Para impresión por hoja es *la* decisión de oficio: cuántas poses entran, el aprovechamiento, cuánto papel se compra. | `oficio.acomodado` | Abierto |
| H-3 | Las **caras se preguntan dos veces** y no se ve que sean parientes: una multiplica el tiempo, la otra el material. Que sean dos está bien; que estén lejos y con nombres distintos, no. | `activacion.multiplicadores` + `materiales.caras` | Abierto |
| H-4 | **"Calculado por nesting"** como respuesta visible: es el nombre del mecanismo interno, no lo que hace. | `tiempo.cantidad_operativa` | Abierto |
| H-5 | El **tóner vive en "Máquina y perfil"**: es consumo, no una propiedad del fierro. | `maquina.cobertura` | Abierto |
| H-6 | El **nombre del paso vive en "Activación"**, cuando es identidad — y es lo primero que uno quiere ver. | `activacion.nombre` | Abierto |
| H-7 | **"¿Arrastra otros pasos?" en un paso que corre siempre**: si es obligatorio, arrastrar no cambia nada. | `activacion.coejecucion` | Abierto |
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
