# Wizard de Ruta — análisis y diseño (Etapa E de pasos componibles)

> Documento de trabajo. Nace del cierre de la Etapa B (Registro de
> Capacidades) y de la decisión del usuario 2026-07-30: el editor de
> configuración de ruta es confuso porque le pregunta al producto cosas
> que son del paso, y la sección "Avanzado" mezcla decisiones del oficio
> con técnica de algoritmo. Plan macro acordado: E.0 censo de Avanzado →
> E.1 defaults declarados en el paso → E.2 tercerizado como bifurcación
> del wizard de paso → E.3 wizard de ruta.
>
> Regla de ramas vigente: TODO se integra a `dev`; `main` (estable,
> 5abc97f5) recién se toca cuando el conjunto completo esté validado.

## 1. Censo de la sección "Avanzado" (E.0, medido 2026-07-30)

Fuente: `config-pasos-editor-view.tsx` (bloque `advancedOpen`), lectores
en `motor.service.ts` (overrides de tiempo) y `nesting-config.ts` (todo
lo demás, con precedencia: runtime de la cotización → nestingConfig del
paso → params legacy → máquina → default por familia).

Dos hallazgos de contexto antes de la tabla:

- **Ya no hay textareas de JSON visibles.** "Params del paso" y "Config
  de cantidad" viven como ESTADO (jsonTexts, la fuente al guardar) pero
  se editan solo vía controles ricos. El copy "Overrides y notas
  internas" miente dos veces: no hay campo de notas, y no todo es
  override.
- **Los pasos tenant que acomodan (B.3.4) ya ven la card de nesting**:
  `nestingAplica()` devuelve true para cualquier `CALCULADO_POR_PASO`,
  así que un "Estampado en pliego" muestra "Algoritmo" — que para tenant
  NO debería ofrecerse (la superficie ya lo decide; el sistema elige).
  Fix pendiente para E.

### La tabla

Audiencias: **[O] oficio** (decisión física frecuente, va al wizard en
humano) · **[P] operativa por producto** (accesible, secundaria) ·
**[X] técnica** (escape hatch de experto).

| # | Campo | Aparece cuando | Quién lo lee | Aud. | Estandarización propuesta |
|---|---|---|---|---|---|
| 1 | Setup override (min) | paso con máquina | motor: pisa `perfil.setupMin` | P | "¿Preparar la máquina lleva un tiempo distinto en este producto?" — y el DEFAULT debería poder declararlo la familia/perfil (E.1) |
| 2 | Cleanup override (min) | paso con máquina | motor: pisa `perfil.cleanupMin` | P | ídem 1 |
| 3 | Tiempo fijo override (min) | T-1 sin máquina | motor: pisa tiempo fijo | P | ídem — candidato fuerte a default de familia (E.1): "¿cuánto tarda normalmente?" ya se pregunta en el wizard de paso y hoy se tira |
| 4 | Algoritmo de nesting | familias sistema con nesting + cualquier CALCULADO_POR_PASO | dispatcher | X | **desaparece como pregunta**: la elección física (superficie B.3.4 / geometría máquina-material) ya lo determina; "auto" es el único valor sano. Queda solo como escape |
| 5 | Demasía por lado (mm) | ídem 4 | nesting (bleed→márgenes y separación) | **O** | "¿Cuánto aire necesita cada pieza?" — pregunta física. Candidato a DEFAULT de familia (E.1: un troquelado siempre pide su demasía típica) + override por producto + ajuste runtime en cotización (ya existe el canal) |
| 6 | Pliego de impresión: tamaño (preset/custom/auto) | solo `impresion_por_hoja` | nesting (sheet dims) | **O** | "¿En qué pliego se imprime? El del sustrato comprado / uno fijo (A3, SRA3…) / que el sistema COMPARE tamaños y elija" — tres opciones en humano; hoy es un combo + 2 inputs + modo |
| 7 | Ancho/Alto del pliego (mm) | ídem 6, modo custom | nesting | O | inputs del caso "uno fijo"; sin cambios conceptuales |
| 8 | Origen del costo (derivado / MP por candidato) | ídem 6, modo automático | score de candidatos | X→O | reformular en humano: "¿Los tamaños candidatos se compran ya cortados (cada uno con su precio) o salen todos del mismo sustrato?" — es una pregunta de compras, no de algoritmo |
| 9 | Candidatos de pliego (lista + MP propia) | ídem 8 | nesting compara | **O** | la lista es legítima del oficio; la UI actual (preset+4 campos+picker MP por fila) necesita el tratamiento wizard |
| 10 | Panelizado: modo (auto/manual) | solo `impresion_por_area` + rollo | nesting (paneles) | **O** | **"¿Esta pieza puede salir en paneles?"** — No / Sí, decide el sistema / Sí, así — decisión del oficio de gran formato (el usuario lo marcó explícitamente: no todos los productos se pueden panelar) |
| 11 | Panelizado: dirección (auto/V/H) | ídem 10 | nesting | O | "¿Los paneles van a lo largo o a lo ancho?" |
| 12 | Panelizado: solape (mm) | ídem 10 | nesting | **O** | "¿Cuánto se solapan para soldar?" — candidato a DEFAULT de familia (E.1: la soldadora de lona tiene SU solape) |
| 13 | Panelizado: ancho máx. por panel (mm) | ídem 10 | nesting | O | "¿Ancho máximo de cada panel?" (default = ancho útil del rollo/máquina) |
| 14 | Panelizado: distribución (equilibrada/libre) | ídem 10 | nesting | P | "¿Paneles parejos o como convenga?" |
| 15 | Panelizado: interpretación del ancho (total/útil) | ídem 10 | nesting | X | tecnicismo de compatibilidad; escape hatch |
| 16 | Layout manual de paneles (JSON) | ídem 10, modo manual | nesting | X | escape hatch (el editor visual del acomodo es el camino largo correcto) |
| 17 | Márgenes extra del pliego (sup/izq/der/inf) | familias con nesting | nesting (SUMAN al margen técnico de la máquina) | **O** | "¿Aire extra en los bordes, además del de la máquina?" — la máquina ya aporta el técnico; esto es del trabajo |
| 18 | Costeo del sustrato: estrategia (simple / m² exacto / largo consumido / placa por tramos) | familias con nesting | costing del nesting | **O**(!) | parece técnica pero es POLÍTICA DE PRECIO: "¿La placa/rollo se cobra entera, por lo consumido, o por tramos de ocupación?" — decisión comercial del negocio, merece humano |
| 19 | Escalones de ocupación (%) | ídem 18, estrategia por tramos | costing | O | "¿En qué cortes de ocupación cambia el precio?" (25/50/75/100) |

### Lecturas transversales del censo

1. **Tres niveles de decisión, no dos.** Varios campos ya son ajustables
   en TRES lugares: default (máquina/familia) → config del producto →
   runtime de la cotización (`configPasoRuntime`: márgenes, panelizado,
   pliego, demasía y params abiertos al comercial). La estandarización
   debe declarar POR CAMPO qué niveles aplican — es el mismo patrón
   activación-default+fijar de la Etapa D, generalizado.
2. **Casi nada de Avanzado es del paso "en general": es de las familias
   de NESTING.** Overrides de tiempo aparte, los 16 campos restantes
   solo existen para impresión por hoja/área, plotter, laminado, montaje
   y (desde B.3.4) pasos tenant que acomodan. El wizard de ruta NO
   necesita cargar con esto para el 80 % de los pasos.
3. **Candidatos a default de familia detectados (alimentan E.1)**:
   demasía típica (5), solape de panelizado (12), tiempo fijo (3), y los
   que ya habíamos anotado: centro de costo y ritmo. Todos con el mismo
   contrato: la familia sugiere, el producto puede pisar, la cotización
   ajusta si el modelador lo dejó abierto.
4. **Dos campos deben DESAPARECER como preguntas**: Algoritmo (4) — la
   física ya lo decide — e Interpretación del ancho (15). Escape hatch.
5. **Una reclasificación sorpresa**: el costeo del sustrato (18-19)
   estaba vestido de técnica pero es política de precio (cobrar la placa
   entera vs. por tramos es una decisión comercial que Holdprint expone
   como feature). En humano, es de las preguntas más valiosas del censo.

## 2. Próximos pasos del plan

- **E.1 — Defaults declarados en el paso**: centro de costo + ritmo +
  los candidatos del censo (demasía, solape, tiempo fijo). Contrato
  único: familia sugiere → producto pisa → runtime ajusta.
- **E.2 — Tercerizado como bifurcación inicial** del wizard de paso
  ("¿Quién lo hace: tu taller o un proveedor?"), con la decisión de
  diseño familia-vs-config a cerrar antes.
- **E.3 — Wizard de ruta**: con el inventario de §1 ya clasificado, las
  preguntas que le quedan son: qué pasos, en qué orden, máquina/material
  concreto, herencia (ya humana, B.3.3), y las preguntas [O] del censo
  SOLO para los pasos de nesting.
