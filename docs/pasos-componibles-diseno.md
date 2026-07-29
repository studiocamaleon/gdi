# Pasos componibles — análisis y diseño

> **Estado**: análisis en revisión. Este documento es el material de trabajo:
> acá se discute, se decide y se registran las conclusiones. Cuando cierre,
> alimenta el plan técnico de implementación.
>
> **Punto de restauración**: tag `v3.8-pre-abstraccion-pasos` + dump
> `backups/gdi_saas_pre_abstraccion_pasos_20260729_142253.sql`. Procedimiento
> completo en `backups/README-rollback.md`. Nada de lo que sigue se
> implementa sin esa red puesta (ya está puesta).
>
> Rama de trabajo: `feat/pasos-produccion-analisis`.

---

## 1. La idea en una frase

Hoy Grafo vende **un catálogo de 42 procesos productivos**. La propuesta es
pasar a vender **el lenguaje con el que se describen procesos productivos**:
que el tenant pueda crear sus propios tipos de paso componiendo sobre las
primitivas del motor, sin que nosotros tengamos que codificar cada uno.

No es una feature más — cambia qué es el producto. Por eso este documento
existe antes que cualquier línea de código.

## 2. El problema que ataca

Dos, en realidad:

**El problema real**: agregar una familia hoy es cambio de código y deploy.
Si una imprenta necesita "serigrafía textil" o "bordado", espera a que
nosotros la escribamos. Con N tenants eso no escala: cada rubro nuevo trae
tres o cuatro procesos que no tenemos.

**El problema de percepción**, que es tan importante como el real: un
catálogo cerrado *se siente* como un techo aunque casi nunca lo sea.
"Lo que necesito no está ahí, entonces el sistema me limita." La familia
`trabajo_manual` ya se usa hoy como comodín —se le pone el nombre del paso
que sea y listo—, o sea que el sistema ya soporta el caso; pero el usuario
no lo vive como flexibilidad, lo vive como workaround.

## 3. Estado actual, medido (2026-07-29)

Todo lo de esta sección se midió sobre el código en `5abc97f5`. No es de
memoria.

### 3.1 Dónde viven las familias

- Catálogo: `apps/api/src/productos-servicios/pasos/familias.ts` — 59 KB,
  ~1.850 líneas, **cero imports: es data pura** exportada como
  `FAMILIAS: Record<FamiliaCodigo, DefinicionFamilia>`.
- Tipos y vocabularios: `apps/api/src/productos-servicios/pasos/types.ts`.
- **No están en la base.** El schema referencia por string y lo dice
  explícito: `familiaCodigo String` — *"no FK por ser hardcoded en código"*
  (schema.prisma:1938).

Quién referencia `familiaCodigo` por string:

| Quién | Para qué |
|---|---|
| `RutaPaso` / config de pasos | qué familia ejecuta cada paso de la ruta |
| Pasos materializados de la OT | el código plano queda guardado en la orden |
| `EstacionFamilia` | ruteo: una familia vive en una estación (las máquinas de la estación filtran) |
| `modoRegistroDeFamilia()` | cronómetro vs. solo-completar en el tablero |

### 3.2 Qué declara una familia (los "ejes")

Una familia es un **contrato de lo que puede hacer un paso de ese tipo**,
expresado sobre vocabularios cerrados y chicos:

| Eje | Valores | Qué decide |
|---|---|---|
| `RelacionMaquina` | M-0, M-1, M-2 | sin máquina / máquina única / alternativas de tecnología |
| `ModoTiempo` | T-1..T-4 | fijo del modelador / productividad propia / perfil de máquina / input del comercial |
| `MecanismoCantidad` | DIRECT_FROM_JOBCONTEXT, HEREDAR_DEL_OUTPUT_CANONICO, CALCULADO_POR_PASO, CONVERSION | de dónde sale la cantidad |
| `ModoActivacion` | OBLIGATORIO, OPCIONAL, CONDICIONAL, NO_EJECUTAR | cómo entra a la ruta |
| `slotsRequeridos` | tipos SUSTRATO, CONSUMIBLE_MAQUINA, INSUMO_PASO, TAPA, OTRO + compatibilidad de material | qué materiales consume |
| `multiplicadoresSoportados` | caras, tipoCopia, hojasPorLibro, … | factores de cantidad |
| `plantillasCompatibles` | tipos de máquina | qué fierros pueden ejecutarlo |
| `inputsRequeridos` / `outputsCanonicos` | strings | contrato de datos entre pasos |
| `validaciones` | DSL: RequiresInput, Compare, InRange, OneOf, ExistsOutput | reglas declarativas |
| `modoRegistro` | cronometro / solo_completar | cómo se registra en el tablero |

Dos observaciones que sostienen todo el análisis:

1. **La familia ya es casi una fila de tabla.** Todo lo que declara es
   enumerable y serializable; las validaciones ya son un DSL declarativo.
   La abstracción no hay que inventarla: ya está escrita, solo que guardada
   en un `.ts` en vez de en una tabla.
2. **La familia carga con dos roles que no van juntos**: la **forma** (cómo
   se costea: los ejes) y el **nombre** (qué es: "diseño gráfico"). Toda la
   propuesta consiste en separarlos.

### 3.3 Evidencia de redundancia: 36 huellas sobre 42 familias

Se volcaron los ejes de las 42 familias y se agruparon por huella
(máquina ~ tiempo ~ cantidad ~ activación ~ slots ~ multiplicadores).
Resultado: **36 configuraciones distintas**. Cuatro grupos son literalmente
la misma configuración con distinto nombre:

| Huella | Familias que la comparten |
|---|---|
| M-0 · T-1\|T-2 · DIRECT · OPCIONAL · sin material | **envio, control_calidad, diseno_grafico** |
| M-0 · T-2 · DIRECT · OPCIONAL · INSUMO_PASO! | encuadernado_engrapado, atado_banding, etiquetado_manual |
| M-1 · T-3 · DIRECT · OBLIG\|OPC · sin material | cnc, troquelado_digital |
| M-0 · T-2 · DIRECT · OPCIONAL · sin material | instalacion_in_situ, lijado_canteado |

Y mirando lo que la huella no cubre (outputs, validaciones, plantillas):

```
envio            outputs=[envios_realizados]   valid=0  plantillas=[]
control_calidad  outputs=[piezas_verificadas]  valid=0  plantillas=[]
diseno_grafico   outputs=[diseno_aprobado]     valid=0  plantillas=[]
```

**Lo único que las diferencia es el string del output.** Son tres nombres
para una sola cosa: "servicio vendido por tiempo humano".

El caso más elocuente: `cnc` vs `troquelado_digital` son idénticas salvo
`plantillasCompatibles: [ROUTER_CNC]` vs `[MESA_DE_CORTE]`. Esa "familia"
está codificando **cuál máquina** — que ya es un concepto propio del
sistema. Es una máquina disfrazada de familia.

### 3.4 Los 51 cableados: dónde el motor pregunta por familias concretas

`grep familiaCodigo === '<código>'` sobre el API (sin tests): **51
comparaciones**, concentradas en 4 archivos:

| Archivo | Refs |
|---|---|
| `motor-universal/motor.service.ts` | 21 |
| `motor-universal/nesting-config.ts` | 16 |
| `motor-universal/nesting-dispatcher.ts` | 9 |
| `productos-servicios/config-pasos.service.ts` | 5 |

Por familia (corregido 2026-07-29 — el conteo original arrastraba tests):
`impresion_por_hoja` 13, `plotter_corte` 8, `plastificado_pouch` 7,
`laminado` 7, `impresion_por_area` 6, `montaje_sobre_sustrato` 3,
`corte_guillotina` 2, `colocacion_ojales` 2, `pre_prensa` 1,
`modificacion_pre` 1. **`diseno_grafico` y `embalaje` tienen CERO refs
reales** — aparecían en la primera medición solo por specs del motor. El
front no compara contra códigos de familia en ningún lado.

Al leerlas, son **dos cosas muy distintas** — y la distinción es el corazón
del plan:

**Tipo A — datos que se filtraron al código.** Ejemplo
(motor.service.ts:5414):

```ts
if (familiaCodigo === 'plotter_corte')      return tipoPerfil === 'CORTE' || tipoPerfil === 'MIXTO';
if (familiaCodigo === 'impresion_por_area') return tipoPerfil === 'IMPRESION' || tipoPerfil === 'MIXTO';
```

Eso es un campo `tiposPerfilCompatibles` escrito como `if` (y duplicado:
la misma lógica vive en `config-pasos.service.ts:18-21`). Mover esto a la
declaración de la familia es barato y no lo discute nadie.

**Tipo B — primitivas de cálculo de verdad.** Los ~25 refs de nesting:
acomodar piezas en un rollo, imponer en un pliego, calcular una pouch. Son
algoritmos distintos, no parámetros distintos. Esto NO se le entrega al
tenant: se le entrega la *elección*, no la *autoría* (§5).

### 3.5 El nesting ya es un menú con nombre

`NestingAlgorithmPolicy` (nesting-config.ts:4):

```
'auto' | 'shelf-rollo' | 'maxrects-rollo' | 'grid-2d-single'
      | 'grid-2d-multi' | 'packingsolver-rectangle'
```

Geometrías: `ROLLO` | `PLIEGO` | `MESA_EXTENSORA`. Ya existe validación de
qué algoritmo aplica a qué geometría (nesting-config.ts:271).

Lo único cableado es el **ruteo**: el dispatcher elige por familia con
runners dedicados (`runImpresionPorArea`, `runLaminadoRollo`,
`runPlastificadoPouch`, `runMontajeSobreSustrato`), y cada runner arma su
propio JobContext y su lógica pre/post. **El algoritmo no está pegado a la
familia; la familia está pegada al runner.** Es una indirección de más, no
una barrera — pero unificar los runners en uno parametrizado es trabajo
real, no un renombre. Ahí va a estar el grueso del esfuerzo del motor.

## 4. La abstracción propuesta

### 4.1 Separar forma de nombre

- La **forma** (combinación de ejes) es del sistema. Es finita: las 30
  familias componibles de hoy colapsan en **12 formas gruesas** (§4.3).
- El **nombre** baja al paso, y lo pone el tenant. "Diseño gráfico",
  "asesoramiento", "gestoría de permisos municipales" son el mismo paso con
  distinto nombre — hoy ya lo son, pero de contrabando vía `trabajo_manual`.

El catálogo de 42 no desaparece: **se convierte en presets** sobre las
formas. Se sigue entregando el conocimiento de dominio destilado (nombres
buenos, defaults sensatos, validaciones), pero deja de ser un techo. Si lo
que el tenant necesita está, no arranca de una pantalla en blanco; si no
está, lo compone.

### 4.2 La frontera sistema / componible es objetiva

Una familia queda **del sistema** si cumple al menos una:

1. **Calcula geometría** — tiene `CALCULADO_POR_PASO` de verdad (nesting:
   cómo entran las piezas en el material). El tenant no escribe algoritmos.
2. **El motor tiene ramas Tipo B para ella** que todavía no se movieron a
   la declaración.

Aplicado hoy (corregido 2026-07-29 tras limpiar el conteo de tests):

```
DEL SISTEMA (10):  impresion_por_area, impresion_por_hoja, pre_prensa,
                   plotter_corte, laminado, plastificado_pouch,
                   corte_guillotina, montaje_sobre_sustrato,
                   modificacion_pre, colocacion_ojales

COMPONIBLES (32):  el resto
```

Con dos precisiones honestas:

- `impresion_por_pieza` cae del lado **componible**: no tiene geometría, es
  máquina + material + T-3. La frontera no es "impresión", es *"¿hay que
  calcular cómo entran las piezas en el material?"*. Área y pliego sí; por
  pieza no.
- La primera versión de este análisis listaba 12 (incluía `embalaje` y
  `diseno_grafico` como cableadas). Era un artefacto del conteo: sus refs
  estaban todos en specs. Justamente las dos más genéricas del catálogo no
  tienen ni una rama en el motor — la frontera quedó más limpia de lo que
  parecía.

### 4.3 Las 12 formas

Los 32 componibles, agrupados por forma gruesa (¿máquina? ¿material? ¿modo
de tiempo?):

| # | Forma | Familias de hoy que la usan |
|---|---|---|
| 8 | sin máquina · con material · T-2 | armado_cajas, atado_banding, embalaje, encuadernado_engrapado, engomado_emblocado, etiquetado_manual, instalacion_electrica, trabajo_manual |
| 5 | sin máquina · sin material · T-1\|T-2 | control_calidad, diseno_grafico, ensamble_estructural, envio, modificacion_post |
| 4 | sin máquina · sin material · T-2 | conteo_manual, corte_manual, instalacion_in_situ, lijado_canteado |
| 3 | con máquina · con material · T-3 | acabado_decorativo, barniz, impresion_por_pieza |
| 3 | con máquina · sin material · T-3 | cnc, perforado, troquelado_digital |
| 2 | con máquina · con material · T-2\|T-3 | aplicacion_transfer, pintura_superficial |
| 2 | con máquina · con material · T-2 | encuadernado_anillado, soldadura |
| 1 c/u | cinco formas más | corte_laser, grabado_laser, plegado, proof, toma_medidas |

### 4.4 El nesting se expone como elección, no como autoría

La extensión natural del mismo movimiento: *"¿este paso acomoda piezas?"*
es un eje más. Si la respuesta es sí, la pregunta siguiente **no** es qué
algoritmo — es sobre el mundo físico:

> ¿Cómo viene el material? → **rollo** / **pliego** / **pieza suelta**

De ahí sale la geometría, y `auto` elige el algoritmo. El menú explícito
(`maxrects-rollo` vs `packingsolver-rectangle`) queda para nosotros y para
soporte. Nadie que administre una imprenta puede tomar esa decisión, y si
la toma mal el resultado es un costo equivocado en silencio — el peor modo
de falla de este producto.

Con esto, hasta `impresion_por_area` deja de ser un tipo especial: es
"paso con máquina, tiempo por perfil, sustrato + tinta, geometría ROLLO con
nesting". La diferencia con `laminado` deja de ser ontológica y pasa a ser
una fila distinta.

## 5. El wizard

El journey mental, mapeado contra lo que ya existe:

| Pregunta | Eje que completa |
|---|---|
| ¿Este paso requiere una máquina? | `RelacionMaquina` (M-0/M-1/M-2) |
| ¿Cómo se mide el tiempo? | `ModoTiempo` (T-1..T-4) |
| ¿Consume material? ¿cuál? | `slotsRequeridos` + compatibilidad |
| ¿De dónde sale la cantidad? | `MecanismoCantidad` |
| ¿Acomoda piezas en el material? | geometría + nesting (elección, §4.4) |
| ¿Obligatorio u opcional en la ruta? | `ModoActivacion` |
| Nombre del paso | el nombre, separado de la forma |

**El wizard es una UI sobre lo que ya está declarado.** No hay modelo nuevo
que inventar: hay que persistir el que existe y ponerle preguntas encima.

Reglas de diseño del wizard (decididas en la discusión):

1. Las preguntas son sobre el mundo físico, nunca sobre el motor.
2. Cada respuesta cierra opciones de las siguientes (los ejes ya declaran
   sus combinaciones soportadas).
3. Los presets (el catálogo de hoy) son el punto de partida sugerido;
   componer desde cero es el camino largo, no el default.
4. El resultado siempre es una forma que el motor ya reconoce. El wizard
   **no puede** producir una configuración que el motor no sepa costear.

## 6. La escalera: qué desbloquea esto

Cada nivel se apoya en que el de abajo dejó de ser un enum:

1. **Wizard de paso** — el tenant crea tipos de paso. (Este documento.)
2. **Wizard de ruta** — encadenar pasos con nombres del negocio. Los
   `inputsRequeridos`/`outputsCanonicos` ya validan que el encadenamiento
   sea coherente.
3. **Wizard de producto** — armar el producto en el momento, sin
   pre-cargarlo. Conecta directo con la idea pospuesta del constructor
   interactivo de productos: la conclusión de entonces fue "el motor ya
   soporta la matemática, falta la capa de modelado". Este es ese modelado,
   llegando por otra puerta.
4. **Cotización ad-hoc** — cotizar algo que nunca existió en el tenant,
   armando producto+ruta al vuelo. El sueño del "producto random" cotizable.

La capa técnica queda intacta para el motor; arriba se habla en idioma de
imprenta.

## 7. Riesgos y decisiones abiertas

En orden de gravedad, no de urgencia:

### 7.1 El radio de daño se invierte

Hoy, si una familia costea mal, es bug nuestro y se arregla para todos.
Con familias del tenant, es *su* configuración — y el teléfono suena igual.
El peor modo de falla no es que se caiga: es que **cotice mal en
silencio**. Mitigaciones a diseñar: preview de costeo en el wizard con un
caso de ejemplo antes de guardar, validaciones duras del lado del motor
(el wizard no puede emitir formas inválidas), y quizás marcar cotizaciones
que usan pasos custom durante sus primeras N ejecuciones.

### 7.2 Identidad y versionado

Hoy `familiaCodigo` es un string sin FK y el catálogo es inmutable por
deploy. Si la familia pasa a ser dato editable del tenant:

- ¿Qué le pasa a una OT en vuelo si editan la familia bajo sus pies?
  Los pasos materializados ya guardan el código plano — probablemente la
  respuesta sea *snapshot al materializar* (la OT congela la definición),
  pero hay que decidirlo explícitamente.
- Namespacing: los códigos del sistema y los del tenant no pueden chocar
  (¿prefijo? ¿UUID + código display?).
- ¿Se puede borrar una familia usada por rutas vivas? (Precedente en el
  sistema: clientes no se borran, se inhabilitan.)

### 7.3 Ruteo a estaciones

`EstacionFamilia` mapea familia → estación. Una familia creada por el
tenant necesita estación asignada o el tablero no sabe dónde mandarla.
Probable: el wizard pregunta la estación al final, o hereda la de la forma
base. A decidir.

### 7.4 Modo de registro en el tablero

`modoRegistroDeFamilia()` decide cronómetro vs. solo-completar por
override o por categoría. Si la familia es del tenant, ese dato tiene que
viajar en la declaración (un eje más del wizard, con default sensato).

### 7.5 La UI de un lenguaje de programación

El wizard es, en el fondo, un editor de programas chiquitos. El riesgo es
la pantalla en blanco: una imprenta chica frente a "creá tu paso" está
peor que con un buen catálogo. Mitigación ya decidida: **el catálogo es el
default y el tenant extiende** — misma capacidad técnica, producto muy
distinto. El wizard de crear-desde-cero no debería ser la puerta de
entrada sino el último recurso visible.

### 7.6 Migración de lo existente

Las rutas y productos de hoy referencian los 42 códigos. Sea cual sea el
modelo de persistencia, esos códigos tienen que seguir resolviendo — el
catálogo sistema se siembra como datos y los strings actuales no cambian.
Restricción dura para el plan técnico.

## 8. Decisiones tomadas (2026-07-29)

Revisión del documento hecha; estas ocho quedan **cerradas** y el plan
técnico se escribe sobre ellas.

| # | Decisión | Elegido |
|---|---|---|
| 1 | Persistencia | **Híbrido**: las 42 del sistema siguen en `familias.ts` (versionadas con el deploy, cero migración); las del tenant van a una tabla nueva. Un único resolver: primero tabla, después catálogo. La Etapa C original ("migrar las 42 a la base") queda **descartada**. |
| 2 | Edición con usos (§7.2) | **Snapshot al usar**: la OT congela la definición completa del paso al materializarse. Editar la familia solo afecta cotizaciones/OTs futuras. |
| 3 | Secuencia | **A → C → D; B diferida.** Los componibles no calculan geometría, así que la unificación de runners de nesting se hace recién cuando el wizard quiera ofrecer "¿acomoda piezas?". |
| 4 | Estación (§7.3) | **Pregunta del wizard** (default: estación general). Editable después desde Estaciones, como hoy. |
| 5 | Identidad (§7.2) | **UUID + nombre visible.** En los `familiaCodigo` string existentes viaja el UUID; el resolver distingue por forma (UUID → tabla, si no → catálogo). Sin prefijos mágicos, imposible chocar con los 42 códigos. |
| 6 | Borrado (§7.2) | **Borrar solo si virgen** (jamás referenciada); con un solo uso histórico, inhabilitar. Mismo espíritu que clientes. |
| 7 | Permisos | **Solo ADMIN.** Crear un tipo de paso define cómo se costea: es configuración estructural, nivel tarifas/centros de costo. |
| 8 | Preview de costeo (§7.1) | **Opcional pero visible** (decisión del usuario, contra la recomendación de hacerlo obligatorio). El riesgo residual de §7.1 queda abierto: una familia mal compuesta puede guardarse sin haber visto un costeo de ejemplo. Mitigación pendiente de diseñar en Etapa D — p. ej. marcar visualmente las cotizaciones que usan pasos custom aún no verificados. |

## 9. Qué NO cambia

Para acotar el miedo del proyecto:

- **El motor de costeo no se reescribe.** Se le quitan los `if` Tipo A
  (que son datos) y se parametrizan los runners de nesting (Tipo B). Las
  primitivas de cálculo son nuestras y siguen siéndolo.
- **Los algoritmos de nesting no se tocan** — se exponen por elección.
- **Las 42 familias siguen existiendo** como presets sembrados. Ningún
  tenant pierde nada; las rutas existentes no se migran.
- **Los vocabularios de ejes no crecen** por esta iniciativa. Todo lo que
  el wizard produce ya es expresable hoy.

## 10. Plan por etapas (actualizado con las decisiones de §8)

Orden decidido: **A → C → D**, con B diferida. Cada etapa es valiosa por sí
sola y deja el sistema mejor aunque la siguiente nunca se haga. Criterio de
avance: la anterior en main y verificada. El detalle ejecutable vive en
`docs/pasos-componibles-plan-tecnico.md`.

- **Etapa A — Limpieza Tipo A.** Censo línea por línea de los 51 cableados
  con clasificación A/B, y mover los A a la declaración de familia
  (`tiposPerfilCompatibles`, etc.). El motor deja de nombrar familias que
  no lo necesitan. Riesgo bajo; la frontera §4.2 se vuelve real en código.
- **Etapa C — Tabla de familias tenant + resolver.** La tabla nueva (UUID,
  forma como datos, estación, snapshot-ready), el resolver único
  (tabla → catálogo) y el CRUD ADMIN. Sin UI de creación todavía: el motor
  aprende a leer familias de la base sin que exista el wizard.
- **Etapa D — Wizard de paso.** La feature visible. Presets del catálogo
  como punto de partida, preguntas físicas, preview de costeo (visible,
  opcional — §8.8), estación y modo de registro incluidos.
- **Etapa B (diferida) — Runner de nesting parametrizado.** Unificar los 4
  runners dedicados en uno que reciba geometría + algoritmo. Se hace
  cuando el wizard quiera ofrecer "¿acomoda piezas?" — no antes.
- **Etapa E — Wizard de ruta.** Encadenar con validación por
  inputs/outputs canónicos.
- **Etapa F — Wizard de producto / cotización ad-hoc.** La escalera
  completa (§6). Se diseña recién cuando D y E hayan visto uso real.

## 11. Conclusiones

1. La intuición original es correcta y la evidencia la refuerza: **la
   abstracción ya existe en el código** (ejes, DSL de validaciones,
   contratos de datos). El trabajo no es inventarla sino persistirla y
   ponerle preguntas encima.
2. La redundancia del catálogo es medible: 36 huellas para 42 nombres, y
   grupos enteros que solo se distinguen por el string del output.
3. La frontera sistema/componible no es de gusto: la traza el nesting
   (geometría) y se puede calcular. 30 de 42 familias son hoy solo un
   nombre sobre una combinación de ejes.
4. El bloqueo real y acotado son los 51 cableados — y la mayoría son datos
   disfrazados de código (Tipo A), no lógica.
5. El mayor riesgo no es técnico: es el costeo silenciosamente mal de una
   familia mal compuesta. El diseño del wizard y sus validaciones importan
   más que el modelo de datos.
6. El movimiento es el mismo que ya hizo el sistema dos veces (modelo
   universal de costeo, adicionales como pasos opcionales): correr la
   frontera entre "lo que es código" y "lo que es dato". Hay precedente de
   que sale bien.
