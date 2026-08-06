# La ficha de la familia de pasos — anatomía y hoja de ruta

**Estado: VIVO** — este doc se actualiza cada vez que la ficha gana un campo.
Última revisión: 2026-08-06 (Tandas A-C + primitivas P1-P4: el censo del
motor quedó en CERO ramas por familiaCodigo).

## 1. El principio

Un producto nuevo = **datos, jamás un `if` en el motor**. Todo lo que un paso
*es* y *hace* vive en la **ficha de su familia** (`DefinicionFamilia`,
[apps/api/src/productos-servicios/pasos/types.ts](../apps/api/src/productos-servicios/pasos/types.ts),
instancias en `familias.ts`). El motor, el editor guiado, el sheet comercial y
el tablero **leen la ficha**; ninguno decide comportamiento comparando
`familiaCodigo` contra nombres.

Empezamos llamando "ejes" a un puñado (T-1/T-2/T-3, M-0/M-1/M-2, mecanismos de
cantidad). Con cartelería aprendimos que la ficha declara mucho más: geometría,
acomodado, guards, herencia, impresión. Este doc es la foto completa.

## 2. Anatomía de la ficha, eje por eje

Cada eje responde una pregunta en lenguaje de imprenta. `?` = opcional.

### Identidad
| Campo | Pregunta que responde |
|---|---|
| `codigo`, `nombre`, `categoria`, `descripcion?` | ¿Quién sos? |
| `visibleEnSelector?` | ¿Aparecés al crear pasos nuevos? |
| `productosTipicos?` | ¿Dónde solés aparecer? (informativo, UI) |

### Quién lo hace — eje M
| Campo | Pregunta |
|---|---|
| `relacionMaquinaSoportada` | ¿Manual (M-0), una máquina (M-1), candidatas (M-2)? |
| `plantillasCompatibles` | ¿Qué tipos de máquina te sirven? |
| `tiposPerfilCompatibles?` | ¿Qué perfiles operativos aceptás? (CORTE, IMPRESION…) |
| `sinConsumiblesMaquina?` | ¿Usás la máquina sin facturar su tinta/tóner? (plotter sobre impresora con corte) |

### Tiempo — eje T
| Campo | Pregunta |
|---|---|
| `modosTiempoSoportados` | ¿T-1 manual comercial, T-2 productividad, T-3 algoritmo? |
| `magnitudTiempoDefault?` | ¿Qué cuenta tu ritmo si nadie eligió? (montaje cuenta piezas, no placas) |
| `modoRegistro?` | ¿En el tablero se cronometra o sólo se completa? |
| `ritmoDefault?` | ¿Cómo arranca tu ritmo? — unidad (m²/h), productividad vs tanda, y qué cuenta (piezas a montar) [Tanda C] |

### Cantidad y herencia
| Campo | Pregunta |
|---|---|
| `mecanismosCantidadSoportados` | ¿Directa del pedido, heredada, calculada, conversión? |
| `mecanismoCantidadDefault?` | ¿Con cuál arrancás si nadie eligió? (corte manual arranca heredando) [Tanda C] |
| `outputHeredadoDefault?` | Si heredás sin precisión, ¿qué heredás? (guillotina → `pliegos_impresos`) [F3] |

### Activación y multiplicadores
| Campo | Pregunta |
|---|---|
| `modosActivacionSoportados` + `modoActivacionDefault` | ¿Siempre, opcional, condicional? |
| `multiplicadoresSoportados` | ¿Qué multiplica tu trabajo? (`caras`, `tipoCopia`…) |

### Materiales — slots (sub-ficha `SlotDeclarado`)
`slotsRequeridos[]` + `permiteSlotsAdicionales`. Cada slot declara:

| Campo | Pregunta |
|---|---|
| `codigo`, `nombre`, `tipo`, `requerido` | ¿Qué material va acá y es obligatorio? |
| `compatibilidadMaterial?` | ¿Qué materias primas encajan? |
| `formulaForzada?` | ¿Tu consumo tiene fórmula fija? (film de laminado = por metro lineal) |
| `ignoraMultiplicadorCaras?` | ¿Doble faz NO duplica este material? (el nesting ya lo contempló) |
| `magnitudDerivada?` | ¿Tu cantidad la calcula el derivador del paso? (+ barras enteras si la variante declara `largoBarra`) |
| `cantidadFija?` | ¿Siempre va N por trabajo? (fuente LED: 1) |
| `criterioCapacidadDefault?` | ¿Se elige la variante por capacidad? (menor fuente que cubra los watts) |

### Geometría — `derivador?` (docs/derivadores-geometricos-diseno.md)
"Mi geometría se CALCULA de las medidas, nadie la carga a mano."

| Campo | Pregunta |
|---|---|
| `codigo` | ¿Qué calculadora del catálogo corre? (`bastidor_rectangular`, `sembrado_led`, `layout_ojales`) |
| `magnitudPrincipal` + `unidadPrincipal?` | ¿Cuál magnitud es tu cantidad y cómo se llama en humano? ("ml de perfil") |
| `magnitudesTiempo?` | ¿Qué otras magnitudes pueden ser driver del tiempo? (cortes/h) |
| `outputs?` | ¿Qué publicás para que otros hereden? (puntos de soldadura) |
| `materialSlot?` | ¿Qué material alimenta el cálculo? (los atributos del módulo LED) |
| `mensajeSinDatos` (+ sugerencia/código) | ¿Qué diagnóstico das si no hay datos? (nunca $0 silencioso) |

### Primitivas — `primitivas?` (docs/primitivas-de-familia-diseno.md)
"Mi oficio tiene algoritmos propios" — catálogo en `motor-universal/primitivas/`.

| Campo | Pregunta |
|---|---|
| `tiempoRun?` | ¿Tu run T-3 se calcula con algoritmo propio? (guillotina: por cortes) [P1] |
| `cantidadPropia?` | ¿Tu cantidad CALCULADO sale de un cálculo propio? (ml de costura) [P1] |
| `factorVelocidad?` | ¿La velocidad del perfil se ajusta al trabajo? (factor A4 del PPM) [P2] |
| `desgaste?` | ¿Consumís clicks de los componentes de la máquina? [P2] |
| `compraSustrato?` | ¿Tu consumo se convierte a unidades de compra? (pliegos→hojas) [P2] |
| `seleccionPerfil?` | ¿Elegís perfil con cadena propia? (caras→gramaje / escalón) [P3] |
| `avisos?` | ¿Qué diagnósticos propios emitís? (doble faz sin perfil) [P4] |

### Acomodado — `nestingConfig?` y satélites
"Yo acomodo piezas dentro de un material."

| Campo | Pregunta |
|---|---|
| `nestingConfig.superficie` | ¿Rollo, pliego(s), o lo decide el material? |
| `nestingConfig.estrategia?` | ¿Algoritmo con nombre propio? (`corte_rollo`, `laminado_rollo`, `pouch`, `montaje`, `pliego_digital`) [F] |
| `nestingConfig.guardSinLayout?` | Si no salió layout, ¿cortás con diagnóstico o seguís en silencio? [F2] |
| `nestingConfig.fallbackSinLayout?` | Sin layout ni guard, ¿cotizás con m² crudos o cantidad directa? [Tanda A] |
| `fuentesPiezasNesting?` + `fuentePiezasDefault?` | ¿Acomodás las piezas del pedido o lo que salió de un paso previo? |
| `origenMargenesNesting?` | ¿De dónde sale el margen inutilizable? (máquina / material / borde sellado del pouch) |
| `campoSeparacionMaquina?`, `margenesNestingDefault?`, `separacionNestingDefaultMm?` | Defaults físicos cuando nadie configuró |
| `semanticaSeparacion?` | ¿La separación es demasía por pieza o aire literal? |

### Impresión
| Campo | Pregunta |
|---|---|
| `esImpresion?` | ¿Sos impresión con modos de color? Habilita todo el eje modo color (motor + pregunta del editor) [F3] |

### Conexión con la ruta
| Campo | Pregunta |
|---|---|
| `inputsRequeridos` | ¿Qué datos del trabajo necesitás? |
| `outputsCanonicos` | ¿Qué publicás al JobContext? |
| `mutaMedidasEnPrePasada?` | ¿Agrandás medidas ANTES del bucle? (demasía — con las restricciones de la pre-pasada) |

### Validaciones y parámetros del trabajo
| Campo | Pregunta |
|---|---|
| `validaciones[]` | 5 tipos declarativos: REQUIRES_INPUT, COMPARE, IN_RANGE, ONE_OF, EXISTS_OUTPUT |
| `paramsPasoSchema[]` | ¿Qué perillas tiene tu trabajo? (`expuestoAlComercial` = la ve el comercial al cotizar) [E3] |
| `editorParamsGenerico?` | ¿Tus perillas se editan con el editor genérico? (opt-in: motor las consume y no hay UI a medida) [Tanda B] |

### Defaults por tenant
`FamiliaPasoDefaults` (fila por tenant): centro de costo, estación, etc. No
vive en la ficha del sistema — es la personalización del tenant sobre ella.

## 3. Quién lee la ficha

- **El motor** (`motor.service.ts` + dispatchers): comportamiento y costeo.
- **El editor guiado** (`src/lib/editor-paso/`): las preguntas y sus textos —
  regla del relevamiento: *"el editor no inventa palabras, las lee de lo que
  la familia declara"*.
- **El sheet comercial**: params expuestos, modo color, medidas.
- **El wizard de familias tenant**: crea fichas nuevas con los mismos campos.

## 4. Hoja de ruta de saneamiento — lo que AÚN rutea por nombre

Decisión 2026-08-06 (Lucas): **sanear todo**, no dejar hardcodes. Censo real
(grep de `familiaCodigo ===` y listas de códigos), clasificado por qué tipo de
solución le corresponde. La receta es siempre la misma: **(1) golden masters
antes, (2) campo en la ficha, (3) el código lee la ficha, (4) goldens
idénticos**.

### 4.a Re-keys por declaración que YA existe — HECHA (Tanda A, 2026-08-06)

Todo migrado: motor (pliego resoluble, plotter sobre hojas, fallback m²
crudos ahora `fallbackSinLayout` declarado), config-pasos (plotter híbrida),
outputs-canonicos (pouch), simuladores (`colaConsolidacionDeFamilia` derivada
de esImpresion + superficie), y el editor de nesting/perfiles (ver 4.b).
Goldens 152/152 idénticos. Lista original:

El comportamiento correcto ya está declarado (estrategia, superficie,
esImpresion); estos lugares todavía preguntan por el nombre:
- Motor: `hojaTienePliegoResoluble` (~3636 → estrategia `pliego_digital`),
  `esPlotterCorteSobreHojas` (~5220 → `corte_rollo`), fallback m² crudos
  (~5499 → familias con nesting declarado).
- `config-pasos.service` (98, 456): validación específica de plotter →
  estrategia `corte_rollo`.
- `outputs-canonicos.ts` (364): alias `piezas_laminadas` del pouch →
  estrategia `pouch`.
- Simuladores (`produccion.service` 709/879): la "frontera" consolidable
  (gran formato = área, láser = hoja) → `esImpresion` + superficie declarada.
- Editor: UI de nesting por familia (view 1069-1103), sustantivo pliego/placa
  (schema 1876 → de la superficie declarada), fuente de piezas del montaje
  (schema 336/1125 → `fuentesPiezasNesting` serializado).

### 4.b El editor tiene COPIAS de la ficha — HECHA (Tanda B, 2026-08-06)

Serializados al catálogo: `tiposPerfilCompatibles`, `separacionNestingDefaultMm`,
`fuentesPiezasNesting` (códigos), `fuentePiezasDefault`, `outputHeredadoDefault`,
`editorParamsGenerico` (campo nuevo). Muertas las copias: lista de params
editables, perfil/máquina compatible, panelizado/sanitize/separación, pliego
automático, fórmula del film, labels de herencia (ahora genéricos: cualquier
familia con `outputHeredadoDefault` etiqueta su opción Heredar), sustantivo
pliego/placa, pregunta "¿qué monta?" (fuentes declaradas + default implícito).
Los dos pendientes se resolvieron en la Tanda D (2026-08-06): las
validaciones adelantadas son GENÉRICAS (param `requerido` sin default y sin
valor → error, leído de paramsPasoSchema — bastidor/led no cambian porque
sus requeridos tienen default); y el agrupado de talonario
quedó declarado donde el motor lo CONSUME: `impresion_por_hoja` (el paso que
hace la imposición) — corrección 2026-08-07 sobre un primer intento que lo
declaraba en pre_prensa, donde el motor lo ignora; en el producto Talonarios
la pregunta ahora muestra el valor real (`pose_completa`) y un producto sin
pre-prensa puede configurarlo igual. De paso `nestingAplica` quedó puro: `Boolean(nestingConfig)`
— murieron la excepción pre_prensa y el atajo CALCULADO (redundantes).
Lista original:

Duplicados frontend de campos que la ficha del API ya declara — la copia se
desactualiza sola. Matarlos = serializar el campo en el catálogo y leerlo:
- `FAMILIAS_CON_PARAMS_EDITABLES` (`params-familia.ts`) → derivable de
  `paramsPasoSchema` no vacío (ya viaja).
- Fórmula del film de laminado (view 3450) → `formulaForzada` del slot (ya
  viaja en slotsRequeridos).
- Compatibilidad de perfil del plotter (view 389-412) →
  `tiposPerfilCompatibles` (serializar).
- Validaciones adelantadas de `modificacion_pre` / `colocacion_ojales`
  (view 1941-1949) → espejan validaciones que el motor ya corta; expresarlas
  como `validaciones[]` de la ficha y que el editor las lea.
- Pliego automático de impresión por hoja (view 2092) → estrategia
  `pliego_digital` serializada.

### 4.c Campos NUEVOS chicos — HECHA (Tanda C, 2026-08-06)

`mecanismoCantidadDefault` (impresion_por_hoja/corte_manual → hereda,
montaje → calcula) y `ritmoDefault {unidad, modoCalculo, fuenteCantidad}`
(instalación m²/h, embalaje/montaje por tanda, montaje cuenta piezas a
montar). Las tres funciones del editor y la normalización cantidad_montaje
leen la ficha. Propuesta original:

Defaults del editor guiado hoy cableados en `catalogo-tiempo.ts`:
- **`mecanismoCantidadDefault?`** — hoy: impresion_por_hoja/corte_manual →
  hereda, montaje → calcula (251-254). El eje "soportados" existe; falta el
  default declarado.
- **`ritmoDefault?`** `{ unidad?, modoCalculo?, fuenteCantidad? }` — hoy:
  instalacion_in_situ → m²/h, embalaje/montaje → tiempo por tanda,
  montaje → cuenta piezas a montar (223-296). Emparenta con
  `magnitudTiempoDefault` del API (unificar al diseñar).
- (Evaluar) `ocultarAcomodadoEnEditor?` para pre_prensa, o dejarla como
  excepción documentada en `nestingAplica`.

### 4.d Primitivas de familia (Tipo B — el plato fuerte)

**Diseño cerrado en [primitivas-de-familia-diseno.md](primitivas-de-familia-diseno.md)**
(2026-08-06): eje `primitivas` con 7 ganchos tipados (tiempoRun,
cantidadPropia, factorVelocidad, desgaste, compraSustrato, seleccionPerfil,
avisos), catálogo en `motor-universal/primitivas/`, plan P1-P5. Corrección
del censo: el sitio ~6459 es el warning de doble faz, no publicación de
outputs. Contexto original:

El código ya las marca `FRONTERA-PRIMITIVA`. Acá el `if` no elige un camino:
*es* el algoritmo propio de esa familia. Saneamiento = patrón derivadores:
**registro de primitivas** + la ficha declara cuál usa. Propuesta de forma (a
diseñar): `primitivas?: { tiempoRun?, seleccionPerfil?, desgaste?,
factorVelocidad?, compraMaterial?, publicaOutputs?, cantidadPropia? }`.
- Guillotina: run T-3 desde cortes calculados (~2872); perfil por escalón de
  gramaje (~6388).
- Impresión por hoja: cadena de perfil color→caras→gramaje (~6332); clicks A4
  de desgaste (~4357); factor A4 equivalente PPM (~5941); pliegos→hojas de
  compra (~4129); publicación de outputs (~6459).
- `modificacion_pre`: metros lineales de costura sobre medida visible (~5479).

### 4.e Centro de copiado — HECHA (Tanda D, 2026-08-06)

Los lookups del service buscan por CAPACIDAD declarada: "el paso que
imprime" = `esImpresionDeFamilia`; "el paso que anilla" = el que publica
`libros_anillados` (`familiaPublicaOutput`, helper genérico). Las
referencias de `provisionar-plantilla` se QUEDAN por nombre: son autoría de
datos (el provisionador crea y gestiona exactamente ese paso). 47/47 specs
de centro de copiado verdes.

### 4.f Lo que NO se migra (y por qué)

- **Autoría de datos**: rutas provisionadas que nombran la familia que crean;
  el default "pre_prensa como primer paso" del form de rutas (UI choice).
- **Cosmético**: labels del tablero, fallback `trabajo_manual` en
  tracking/OT, humanización de códigos.
- **Falsos positivos del censo**: `'laminado'`/`'corte_laser'` como TIPOS DE
  PERFIL operativo (enum de maquinaria homónimo), `'corte_manual'` como
  tipoCorte del adaptador digital.
- **Código 3D estacionado** (`agregar-producto-sheet` 894-947,
  `carteleria-editor-sheet`): vive detrás de
  `CONFIGURADOR_3D_CARTELERIA_ACTIVO=false`; se sanea cuando el 3D vuelva.
- **Presentación sobre payload de cotización** (`propuesta-ficha`
  getMontajeSustratoMaterial): identifica el paso de montaje por nombre
  porque el payload de la cotización no lleva la ficha; migra si el motor
  serializa la declaración por paso. (El check de panelizado sí se pudo
  derivar del dato y murió en la Tanda D.)

### Historial de saneamientos hechos
- **Etapa A** (previa): márgenes/separación/fuentes de piezas/perfil
  compatible/consumibles → ficha.
- **Derivadores E1-E4** (2026-08-05): geometría → ficha (`derivador`).
- **F** (2026-08-06): dispatch de nesting → `nestingConfig.estrategia`.
- **F2**: guards sin-layout, pliego de impresión, laminado, card Acomodado
  del editor → ficha (`guardSinLayout`, helpers, serialización).
- **F3**: `esImpresion` (muere FAMILIAS_IMPRESION + 4 listas del editor) y
  `outputHeredadoDefault` (muere el switch G-M2).
- **Tandas A+B+C** (2026-08-06): re-keys API + copias del editor muertas +
  `fallbackSinLayout`/`editorParamsGenerico`/`mecanismoCantidadDefault`/
  `ritmoDefault`. Con esto 4.a-4.c CERRADAS.
- **Primitivas P1-P4** (2026-08-06): eje `primitivas` completo (7 ganchos, 8
  primitivas en catálogo); 4.d CERRADA — el motor quedó sin ramas por
  familiaCodigo (criterio §7 del doc de primitivas).
- **Tanda D** (2026-08-06): validación genérica de params requeridos,
  talonario declarado en pre_prensa, `nestingAplica` puro, centro de copiado
  por capacidad (`esImpresionDeFamilia`/`familiaPublicaOutput`), panelizado
  sin nombre en propuesta. 4.a-4.e CERRADAS; 4.f queda como lista de "no se
  migra" documentada.

## 5. Reglas al agregar un campo nuevo

1. **Nombre en castellano**, pregunta de imprenta, comentario con `[Etapa X:
   qué hardcode reemplaza]`.
2. Helper `xDeFamilia(codigo)` en `familias.ts` si lo consumen varios lugares.
3. Si el **editor** lo necesita: serializarlo en `familias-pasos.service.ts`
   (los DOS bloques: sistema y tenant) + tipo en `FamiliaListItem`.
4. Si aplica a familias **tenant**: mapearlo en `proyectarFamiliaTenant`.
5. Golden masters idénticos salvo cambio de comportamiento documentado y
   re-baselineado a propósito.
6. Actualizar ESTE doc.

## 6. El universo de familias hoy (censo 2026-08-06)

Las **32 familias** del catálogo del sistema, agrupadas por categoría, con los
ejes de su ficha. Generado leyendo el catálogo compilado (`familias.js`) — al
agregar o cambiar una familia, regenerar la tabla con el mismo método.

† = no visible en el selector (disponible sólo para productos existentes).
"+" en Slots = permite slots adicionales del modelador.

### 6.a Ejes básicos

| Familia | M | T | Cantidad | Activación def. | Slots (req/tot) | Multiplicadores |
|---|---|---|---|---|---|---|
| **Pre-prensa** | | | | | | |
| `pre_prensa` | M-0 | T-1 | directa, calcula | obligatorio | 0/0 | — |
| **Producción / impresión** | | | | | | |
| `aplicacion_transfer` | M-0 | T-2 | directa, hereda | obligatorio | 1/2 | — |
| `aplicacion_transfer_textil` | M-1 | T-3 | directa, hereda | obligatorio | 1/2 | — |
| `grabado_laser` | M-1 | T-3, T-4 | directa | obligatorio | 1/1 | — |
| `impresion_3d` | M-1, M-2 | T-3, T-4 | directa | obligatorio | 1/1 + | — |
| `impresion_por_area` | M-1, M-2 | T-3 | calcula | obligatorio | 2/2 | caras |
| `impresion_por_hoja` | M-1, M-2 | T-3 | hereda, calcula | obligatorio | 2/2 | caras, tipoCopia |
| `impresion_por_pieza` | M-1, M-2 | T-3 | directa, hereda | obligatorio | 2/2 | caras |
| **Corte y formado** | | | | | | |
| `cnc` | M-1 | T-3, T-4 | directa | opcional | 0/0 | — |
| `corte_guillotina` | M-1 | T-3 | hereda | obligatorio | 0/0 | — |
| `corte_laser` | M-1 | T-3, T-4 | directa | opcional | 0/0 | — |
| `corte_manual` | M-0 | T-2 | directa, hereda | opcional | 0/0 | — |
| `plegado` † | M-0 | T-2 | hereda | opcional | 0/0 | — |
| `plotter_corte` | M-1 | T-3 | calcula | opcional | 0/0 | — |
| `troquelado_digital` | M-1 | T-3 | directa | opcional | 0/0 | — |
| **Terminaciones** | | | | | | |
| `laminado` | M-1 | T-3 | hereda, directa | opcional | 1/1 | caras |
| `pintura_superficial` | M-0, M-1 | T-2, T-3 | directa, hereda | opcional | 1/1 | — |
| `plastificado_pouch` | M-0 | T-2 | calcula | opcional | 1/1 | — |
| **Encuadernación y armado** | | | | | | |
| `abrochado_caballete` | M-0 | T-2 | directa | obligatorio | 0/0 + | — |
| `encuadernado_anillado` | M-1 | T-2 | directa | opcional | 1/3 | hojasPorLibro |
| `engomado_emblocado` | M-0 | T-2 | directa | obligatorio | 1/4 | — |
| **Estructural / montaje** | | | | | | |
| `ensamble_estructural` | M-0 | T-1, T-2 | directa | obligatorio | 0/0 + | — |
| `estructura_bastidor` | M-0 | T-2, T-3 | calcula | obligatorio | 1/2 + | — |
| `iluminacion_led` | M-0 | T-2 | calcula | obligatorio | 2/3 + | — |
| `montaje_sobre_sustrato` | M-0, M-1 | T-2, T-3 | calcula | opcional | 1/2 + | — |
| **Operaciones manuales** | | | | | | |
| `colocacion_ojales` | M-0 | T-1, T-2 | calcula, directa | opcional | 1/1 + | — |
| `embalaje` | M-0 | T-2 | conversión, directa | obligatorio | 1/2 | — |
| `modificacion_post` | M-0 | T-1, T-2 | directa, hereda | opcional | 0/0 + | cantidadModificacionesPorPieza |
| `modificacion_pre` | M-0 | T-1, T-2 | calcula, directa | opcional | 0/0 + | — |
| `trabajo_manual` | M-0 | T-2 | directa, hereda, conversión | opcional | 0/1 + | — |
| **Logística e instalación** | | | | | | |
| `instalacion_in_situ` | M-0 | T-2 | directa | opcional | 0/0 | — |
| **Servicios profesionales** | | | | | | |
| `diseno_grafico` | M-0 | T-1, T-2 | directa | opcional | 0/0 | — |

### 6.b Ejes avanzados

Columnas: Derivador (calculadora geométrica), Acomodado (nesting declarado),
Impresión (`esImpresion`), Hereda default (`outputHeredadoDefault`),
Pre-pasada (`mutaMedidasEnPrePasada`), y cantidades de outputs canónicos,
params declarados y validaciones.

| Familia | Derivador | Acomodado (superficie · estrategia · guard) | Primitivas | Impresión | Hereda default | Pre-pasada | Outputs | Params | Valid. |
|---|---|---|---|---|---|---|---|---|---|
| **Pre-prensa** | | | | | | | | | |
| `pre_prensa` | — | — | — | — | — | — | — | — | 1 |
| **Producción / impresión** | | | | | | | | | |
| `aplicacion_transfer` | — | — | — | — | — | — | 1 | — | — |
| `aplicacion_transfer_textil` | — | — | — | — | — | — | 1 | — | — |
| `grabado_laser` | — | — | — | — | — | — | 1 | — | — |
| `impresion_3d` | — | — | — | — | — | — | 2 | 2 | 1 |
| `impresion_por_area` | — | segun_material · sustrato | — | ✓ | — | — | 3 | — | 1 |
| `impresion_por_hoja` | — | pliego · pliego_digital · pliego_digital | factorVelocidad, desgaste, compra, perfil, avisos | ✓ | `pliegos_calculados` | — | 15 | 1 | 2 |
| `impresion_por_pieza` | — | — | — | — | — | — | 1 | — | 1 |
| **Corte y formado** | | | | | | | | | |
| `cnc` | — | — | — | — | — | — | 1 | — | — |
| `corte_guillotina` | — | — | tiempoRun, perfil | — | `pliegos_impresos` | — | 1 | — | 2 |
| `corte_laser` | — | — | — | — | — | — | 2 | — | — |
| `corte_manual` | — | — | — | — | `pliegos_impresos` | — | 1 | — | — |
| `plegado` † | — | — | — | — | `pliegos_impresos` | — | 1 | 1 | — |
| `plotter_corte` | — | rollo · corte_rollo | — | — | — | — | 2 | 1 | — |
| `troquelado_digital` | — | — | — | — | `pliegos_impresos` | — | 1 | — | — |
| **Terminaciones** | | | | | | | | | |
| `laminado` | — | rollo · laminado_rollo · laminado_rollo | — | — | `pliegos_impresos` | — | 2 | — | — |
| `pintura_superficial` | — | — | — | — | — | — | 1 | 1 | — |
| `plastificado_pouch` | — | pliego · pouch · pouch | — | — | — | — | 1 | 1 | — |
| **Encuadernación y armado** | | | | | | | | | |
| `abrochado_caballete` | — | — | — | — | — | — | 1 | 1 | 1 |
| `encuadernado_anillado` | — | — | — | — | `pliegos_impresos` | — | 1 | — | 1 |
| `engomado_emblocado` | — | — | — | — | `pliegos_impresos` | — | 1 | — | — |
| **Estructural / montaje** | | | | | | | | | |
| `ensamble_estructural` | — | — | — | — | — | — | 1 | — | — |
| `estructura_bastidor` | `bastidor_rectangular` | — | — | — | — | — | 5 | 5 | — |
| `iluminacion_led` | `sembrado_led` | — | — | — | — | — | 2 | 2 | — |
| `montaje_sobre_sustrato` | — | segun_material · montaje · montaje | — | — | — | — | 3 | 1 | — |
| **Operaciones manuales** | | | | | | | | | |
| `colocacion_ojales` | `layout_ojales` | — | — | — | — | — | 1 | 4 | — |
| `embalaje` | — | — | — | — | — | — | 1 | 1 | — |
| `modificacion_post` | — | — | — | — | `piezas_cortadas` | — | 1 | 1 | — |
| `modificacion_pre` | — | — | cantidadPropia | — | — | ✓ | 2 | 3 | — |
| `trabajo_manual` | — | — | — | — | — | — | 1 | 1 | — |
| **Logística e instalación** | | | | | | | | | |
| `instalacion_in_situ` | — | — | — | — | — | — | 1 | — | — |
| **Servicios profesionales** | | | | | | | | | |
| `diseno_grafico` | — | — | — | — | — | — | 1 | 1 | — |

### 6.c Lecturas rápidas del censo

- **3 familias derivan geometría** (bastidor, LED, ojales) y **6 acomodan
  piezas** (las de nesting) — no se solapan: derivar y acomodar son ejes
  distintos y hoy ningún paso hace ambos.
- **2 son de impresión** con modos de color (por hoja / por área).
- **9 declaran qué heredan por default** — la cadena del pliego (impresión →
  corte → terminación) más `modificacion_post`.
- Las familias de **detalle mínimo** (varias de operaciones manuales y
  terminaciones) tienen pocos ejes avanzados: se completan cuando aparece el
  primer producto que las exige — esa es la regla del catálogo, no un olvido.
