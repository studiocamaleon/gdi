# Las preguntas del editor de pasos — censo, orden y repaso familia por familia

**Estado: DOCUMENTO VIVO** (arrancado 2026-08-07). Nada implementado todavía:
acá se acuerda *qué* se pregunta, *cómo* se llama y *en qué orden*, antes de
tocar [`src/lib/editor-paso/schema.ts`](../src/lib/editor-paso/schema.ts).

El editor declarativo ya resolvió el problema difícil: cada opción se declara
UNA vez, con su pregunta en idioma de taller, su visibilidad y su resumen, y un
test de paridad rompe si el censo y el esquema divergen
([editor-declarativo-diseno.md](editor-declarativo-diseno.md)). Lo que queda es
más blando y más importante: **el modelador entiende lo que se le pregunta, y
en el orden en que lo piensa.**

## 1. El diagnóstico

Las seis secciones de hoy —Quién lo hace · Activación · Tiempo y costo ·
Máquina y perfil · Materiales · Ajustes del trabajo— agrupan las preguntas por
**dónde vive el dato en el modelo**, no por **cómo piensa el trabajo quien lo
configura**.

Se nota apenas se abre un paso real. En "Impresión por hoja" de un folleto:

- la pregunta más cara del paso (cómo se acomodan las piezas en el pliego)
  queda **última**, detrás de dos preguntas de minutos;
- el nombre del paso vive bajo **Activación**, que no es donde uno lo busca;
- "Tiempo y costo" muestra **una sola** pregunta, y es de cantidad;
- aparece una pregunta sobre **talonarios** en un producto que no es talonario.

Ninguna es un bug: cada card está bien declarada. El problema es el **relato**.

## 2. El orden propuesto

El hilo es el de alguien parado frente a la máquina:

> qué paso es → cuándo se hace → en qué máquina → con qué material →
> cómo se acomoda ese material en esa máquina → cuánto tarda

El acomodado va **después** de máquina y material a propósito: la pregunta
literalmente dice "cómo se acomodan las piezas **en el material**". Preguntarlo
antes de saber cuál es el material es preguntar en el vacío.

Y el tiempo va **último** porque depende de todo lo anterior: el ritmo sale del
perfil de la máquina, la cantidad sale del acomodado.

| # | Sección propuesta | Preguntas | Hoy están en |
|---|---|---|---|
| 1 | **Qué paso es** | 3 | Quién lo hace + Activación |
| 2 | **Cuándo se ejecuta** | 3 | Activación |
| 3 | **En qué máquina** | 4 | Máquina y perfil |
| 4 | **Qué materiales gasta** | 11 | Materiales + Máquina y perfil |
| 5 | **Cómo se hace el trabajo** | 5 | Ajustes del trabajo + Tiempo y costo |
| 6 | **Cuánto tarda y cuánto cuesta** | 14 | Tiempo y costo + Activación + Ajustes |

**40 preguntas, las mismas 40.** Este documento no propone (todavía) agregar ni
sacar ninguna: sólo moverlas y, donde haga falta, renombrarlas.

## 3. El censo completo

Las 40 preguntas del esquema, con la sección propuesta, cuándo aparecen y qué
se propone cambiarle a cada una. `clave` es la del esquema y la del test de
paridad — no cambia aunque cambie la sección.

### 3.1 Qué paso es

| Clave | Pregunta (hoy) | Cuándo aparece | Propuesta |
|---|---|---|---|
| `activacion.nombre` | ¿Cómo se llama este paso acá? | siempre | **Mover acá** y ponerla primera: es identidad, no activación |
| `quien.tercerizado` | ¿Quién hace este paso? | siempre | — |
| `quien.proveedor` | ¿A quién se le compra y a qué precio? | si es tercerizado | — |

### 3.2 Cuándo se ejecuta

| Clave | Pregunta (hoy) | Cuándo aparece | Propuesta |
|---|---|---|---|
| `activacion.cuando` | ¿Cuándo se ejecuta? | siempre | — |
| `activacion.regla` | ¿Con qué regla se activa? | si la activación es CONDICIONAL | — |
| `activacion.coejecucion` | ¿Arrastra otros pasos al activarse? | si hay otros pasos en la ruta | **Ocultar en pasos que corren siempre** (H-7) |

### 3.3 En qué máquina

| Clave | Pregunta (hoy) | Cuándo aparece | Propuesta |
|---|---|---|---|
| `maquina.maquina` | ¿En qué máquina se hace? | familia M-1, y sin candidatas si es M-2 | — |
| `maquina.perfil` | ¿Con qué perfil? | si hay máquina elegida | Revisar: hoy se esconde con candidatas, pero el encabezado del paso muestra "Perfil: X" y no hay dónde tocarlo (H-8) |
| `maquina.candidatas` | ¿Entre qué máquinas elige el comercial? | familia M-2 | — |
| `maquina.modo_color` | ¿Se imprime a color o en negro? | familia de impresión con modos, sin candidatas | — |

### 3.4 Qué materiales gasta

La sección se repite **por slot**: la primera pregunta es del paso, las nueve
siguientes se hacen una vez por cada material configurado.

| Clave | Pregunta (hoy) | Cuándo aparece | Propuesta |
|---|---|---|---|
| `materiales.agregar` | ¿Qué materiales gasta acá? | si la familia declara slots o admite adicionales | — |
| `maquina.cobertura` | ¿Cuánto tóner gasta por defecto? | si el paso usa una láser | **Mover acá** desde Máquina: el tóner es consumo, no una propiedad del fierro (H-5) |
| `materiales.nombre` | ¿Cómo se llama? | sólo en slots adicionales | — |
| `materiales.quien` | ¿Quién decide cuál se usa? | por slot | — |
| `materiales.material` | ¿Cuál exactamente? | si el material es fijo | — |
| `materiales.candidatos` | ¿Entre cuáles se elige? | si NO es fijo | — |
| `materiales.criterio` | ¿Con qué criterio elige el sistema? | si elige el motor | — |
| `materiales.consumo` | ¿Cómo se calcula el consumo? | por slot | — |
| `materiales.costeo` | ¿Cómo se costea este material? | por slot, salvo que lo defina el acomodado | — |
| `materiales.base` | ¿Por cada cuántos se gasta uno? | insumos y adicionales sin magnitud derivada | — |
| `materiales.caras` | ¿La doble faz gasta doble? | si la familia multiplica por caras | **Renombrar** para emparejarla con su gemela de tiempo (H-3) |

### 3.5 Cómo se hace el trabajo

| Clave | Pregunta (hoy) | Cuándo aparece | Propuesta |
|---|---|---|---|
| `oficio.acomodado` | ¿Cómo se acomodan y cobran las piezas en el material? | si la familia acomoda y no deriva geometría | **Primera de la sección** (hoy es la última de todo el editor) (H-2) |
| `tiempo.piezas_montar` | ¿Qué monta: piezas del pedido o pliegos impresos? | si la familia declara fuentes de piezas | **Mover acá** desde Tiempo: es qué agarra el paso, no cuánto tarda |
| `oficio.params_familia` | ¿Con qué parámetros trabaja este paso? | si la familia declara params y editor genérico | — |
| `oficio.efectos` | ¿Este paso le exige algo al trabajo? | si la familia soporta efectos | — |
| `oficio.talonario` | ¿Cómo se agrupan los talonarios en el pliego? | si la familia declara el param | **Mostrar sólo si el producto ES de talonarios** (H-1) |

### 3.6 Cuánto tarda y cuánto cuesta

| Clave | Pregunta (hoy) | Cuándo aparece | Propuesta |
|---|---|---|---|
| `tiempo.comercial` | ¿El tiempo lo estima el comercial al cotizar? | siempre | — |
| `tiempo.modo` | ¿Cómo se mide el tiempo acá? | si no lo estima el comercial y la familia soporta más de un modo | — |
| `tiempo.centro` | ¿En qué centro productivo se realiza este paso? | si NO hay máquina (la máquina trae su centro) | — |
| `tiempo.dotacion` | ¿Cuántas personas trabajan? | siempre | — |
| `tiempo.ritmo_modo` | ¿Cómo medís el ritmo? | T-2 sin tiempo del comercial | — |
| `tiempo.productividad` | ¿A qué ritmo? | T-2, si el ritmo no es por tanda | — |
| `tiempo.batch` | ¿Cuánto tarda una tanda y de cuántas? | T-2, si el ritmo es por tanda | — |
| `tiempo.calcular_segun` | ¿El ritmo cuenta piezas, m² o metros? | T-2 sin tiempo del comercial | — |
| `tiempo.cantidad_operativa` | ¿Sobre cuántas piezas trabaja? | si la familia soporta más de un mecanismo | Revisar el resumen: "Calculado por nesting" es vocabulario del motor (H-4) |
| `tiempo.herencia` | ¿De qué paso hereda la cantidad? | si el mecanismo es heredar | — |
| `tiempo.tiempo_fijo` | ¿Cuántos minutos lleva? | T-1 sin máquina ni tiempo del comercial | — |
| `activacion.multiplicadores` | ¿Qué variables multiplican el trabajo acá? | si la familia declara multiplicadores | **Mover acá** desde Activación: multiplica el TIEMPO. **Renombrar** para emparejarla con su gemela de material (H-3) |
| `oficio.setup` | ¿Preparar la máquina lleva un tiempo distinto acá? | si hay máquina | **Mover acá** desde Ajustes: es tiempo |
| `oficio.cleanup` | ¿Y la limpieza al terminar? | si hay máquina | **Mover acá** desde Ajustes: es tiempo |

## 4. Hallazgos abiertos

Numerados para poder discutirlos de a uno. Ninguno está implementado.

| # | Hallazgo | Dónde | Estado |
|---|---|---|---|
| H-1 | Le pregunta por **talonarios a un folleto**: la card se muestra porque la FAMILIA declara `modoTalonarioIncompleto`, no porque el producto sea de talonarios. Y encima abre la sección. | `oficio.talonario` | Abierto |
| H-2 | El **acomodado queda último**, detrás de setup y limpieza. Para impresión por hoja es *la* decisión de oficio: cuántas poses entran, el aprovechamiento, cuánto papel se compra. | `oficio.acomodado` | Abierto |
| H-3 | Las **caras se preguntan dos veces** y no se ve que sean parientes: una multiplica el tiempo (`activacion.multiplicadores`), la otra el material (`materiales.caras`). Que sean dos está bien; que estén a diez preguntas de distancia y con nombres que no se parecen, no. | ambas | Abierto |
| H-4 | **"Calculado por nesting"** como respuesta visible: es el nombre del mecanismo interno, no lo que hace. | `tiempo.cantidad_operativa` | Abierto |
| H-5 | El **tóner vive en "Máquina y perfil"**: es consumo de un material, no una propiedad del fierro. | `maquina.cobertura` | Abierto |
| H-6 | El **nombre del paso vive en "Activación"**, cuando es identidad — y es lo primero que uno quiere ver. | `activacion.nombre` | Abierto |
| H-7 | **"¿Arrastra otros pasos al activarse?" en un paso que corre siempre**: si es obligatorio, arrastrar no cambia nada. Sólo tiene sentido en opcionales y condicionales. | `activacion.coejecucion` | Abierto |
| H-8 | El encabezado muestra **"Perfil: Papel intermedio"** pero no hay pregunta para tocarlo (se esconde cuando hay candidatas, porque elige el comercial). Se lee como un perfil fijo que no se puede cambiar. | `maquina.perfil` | Abierto |

## 5. El repaso, familia por familia

La idea es abrir un paso REAL de cada familia en dev y leer lo que muestra,
como se hizo con `impresion_por_hoja`. Los hallazgos entran en §4.

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

## 6. Lo que queda por definir

1. **¿Las secciones se renombran o sólo se reordenan?** El documento propone
   nombres nuevos ("Qué paso es", "Cómo se hace el trabajo"). Cambiarlos toca
   el test de paridad (`SeccionPaso`) y la navegación del editor enfocado.
2. **¿El orden es fijo o depende de la familia?** Un `trabajo_manual` sin
   máquina ni acomodado se lee distinto que una impresora. Hoy el orden es
   único para todas; podría declararse por ficha. Sin definir: **empezar por el
   orden único** y ver si alguna familia lo pide.
3. **¿Alguna pregunta sobra o falta?** Este repaso todavía no propuso ni sacar
   ni agregar ninguna. Es probable que aparezcan al recorrer las 30 familias
   restantes.
