# Revisión del catálogo de pasos del sistema

> Insumo para la decisión "¿qué pasos deja crear el tenant y cuáles son sólo del
> sistema?". Fuente: `apps/api/src/productos-servicios/pasos/familias.ts` (catálogo
> cerrado en código, 42 familias) + `categorias.ts` + `familia-tenant-validacion.ts`.
> Fecha: 2026-08-03.

## Cómo leer la "Forma"

Una familia (= tipo de paso) queda definida por varios ejes. El wizard de alta de
pasos del tenant expone **los mismos vocabularios** (`FamiliaTenantInput`). Los que
importan para esta decisión:

- **Máquina** (`relacionMaquina`):
  - **M-0** = sin máquina industrial (manual o herramienta auxiliar).
  - **M-1** = máquina única (el modelador asigna una máquina específica).
  - **M-2** = alternativas de tecnología (candidatas; el comercial elige).
  - Un array `['M-0','M-1']` = la familia admite ambos mundos (híbrida).
- **Tiempo** (`modosTiempo`): T-1 fijo · T-2 productividad propia · T-3 perfil de la
  máquina · T-4 input manual del comercial.
- **Cantidad** (`mecanismosCantidad`): DIRECT (lee el JobContext) · HEREDAR (output
  de un paso anterior) · CONVERSION (fórmula) · **CALCULADO** = geometría/nesting,
  **frontera del sistema** (el tenant no la escribe, sólo la elige por superficie).
- **Motor propio** = la familia trae lógica cableada que el wizard genérico **no**
  puede reproducir: nesting con semántica fina, pre-pasada de medidas, params ricos
  autorales, etc. Es el verdadero eje "sólo sistema".

## Tabla completa (42 familias)

| # | Nombre del paso | Categoría | Máquina | Tiempo | Cantidad | Motor propio / notas |
|---|-----------------|-----------|---------|--------|----------|----------------------|
| 1 | Pre-prensa / revisión y armado | Pre-prensa | **M-0** | T-1 | DIRECT | — |
| 2 | Proof / pruebas de color | Pre-prensa | **M-1** | T-1 | DIRECT | usa máquina |
| 3 | Impresión por hoja | Producción / impresión | **M-1·M-2** | T-3 | DIRECT | consumibles de máquina, caras |
| 4 | Impresión por área | Producción / impresión | **M-1·M-2** | T-3 | **CALCULADO** | **nesting** `segun_material` |
| 5 | Impresión por pieza | Producción / impresión | **M-1·M-2** | T-3 | DIRECT | — |
| 6 | Aplicación de transfer (DTF, DTG) | Producción / impresión | M-0·M-1 | T-2·T-3 | DIRECT | híbrida |
| 7 | Grabado láser | Producción / impresión | **M-1** | T-3·T-4 | DIRECT | — |
| 8 | Corte con guillotina | Corte y formado | **M-1** | T-3 | HEREDAR | — |
| 9 | Plotter de corte | Corte y formado | **M-1** | T-3 | **CALCULADO** | **nesting** |
| 10 | Corte láser | Corte y formado | **M-1** | T-3·T-4 | DIRECT | — |
| 11 | Troquelado digital | Corte y formado | **M-1** | T-3 | DIRECT | — |
| 12 | CNC | Corte y formado | **M-1** | T-3 | DIRECT | — |
| 13 | Plegado manual | Corte y formado | M-0·M-1 | T-2·T-3 | HEREDAR | híbrida · **oculto del selector** |
| 14 | Perforado / puntillado (industrial) | Corte y formado | **M-1** | T-3 | DIRECT | param propio (perforacionesPorPieza) |
| 15 | Corte manual (trincheta / sierra) | Corte y formado | **M-0** | T-2 | DIRECT | — |
| 16 | Laminado | Terminaciones | **M-1** | T-3 | HEREDAR | **nesting** (lamina el pliego) |
| 17 | Plastificado pouch | Terminaciones | **M-0** | T-2 | **CALCULADO** | **nesting** (separación literal) |
| 18 | Barniz | Terminaciones | **M-1** | T-3 | HEREDAR | — |
| 19 | Acabado decorativo (hotstamping, dorado, gofrado) | Terminaciones | **M-1** | T-3 | DIRECT | matriz custom |
| 20 | Pintura superficial | Terminaciones | M-0·M-1 | T-2·T-3 | DIRECT | híbrida |
| 21 | Lijado / canteado de bordes | Terminaciones | **M-0** | T-2 | DIRECT | — |
| 22 | Engrapado (caballete / lateral) | Encuadernación / armado | **M-0** | T-2 | DIRECT | — |
| 23 | Encuadernación con anillo (espiral / wire-o) | Encuadernación / armado | **M-1** | T-2 | DIRECT | selector por capacidad, tapas |
| 24 | Engomado / emblocado | Encuadernación / armado | **M-0** | T-2 | DIRECT | — |
| 25 | Armado de cajas / packaging | Encuadernación / armado | **M-0** | T-2 | DIRECT | — |
| 26 | Soldadura (herrería) | Estructural / montaje | M-0·M-1 | T-2 | DIRECT | híbrida · slots libres |
| 27 | Ensamble estructural | Estructural / montaje | **M-0** | T-1·T-2 | DIRECT | slots libres |
| 28 | Montado sobre material | Estructural / montaje | M-0·M-1 | T-2·T-3 | **CALCULADO** | **nesting** · híbrida |
| 29 | Instalación eléctrica luminosos | Estructural / montaje | **M-0** | T-2 | DIRECT | slots libres |
| 30 | Embalaje | Operaciones manuales | **M-0** | T-2 | CONVERSION·DIRECT | — |
| 31 | Conteo manual | Operaciones manuales | **M-0** | T-2 | DIRECT | **oculto del selector** |
| 32 | Atado / banding | Operaciones manuales | **M-0** | T-2 | DIRECT | **oculto del selector** |
| 33 | Etiquetado manual | Operaciones manuales | **M-0** | T-2 | DIRECT | **oculto del selector** |
| 34 | Control de calidad | Operaciones manuales | **M-0** | T-1·T-2 | DIRECT | **oculto del selector** |
| 35 | Trabajo manual | Operaciones manuales | **M-0** | T-2 | DIRECT | genérico · slots libres |
| 36 | Modificación pre-producción | Operaciones manuales | **M-0** | T-1·T-2 | DIRECT | **pre-pasada de medidas** · slots libres |
| 37 | Modificación post-producción | Operaciones manuales | **M-0** | T-1·T-2 | DIRECT | slots libres |
| 38 | Colocación de ojales | Operaciones manuales | **M-0** | T-1·T-2 | DIRECT | **motor propio** (mide lo visible) |
| 39 | Envío / despacho | Logística / instalación | **M-0** | T-1·T-2 | DIRECT | — |
| 40 | Instalación en sitio | Logística / instalación | **M-0** | T-2 | DIRECT | — |
| 41 | Toma de medidas en sitio | Logística / instalación | **M-0** | T-1 | DIRECT | — |
| 42 | Diseño gráfico | Servicios profesionales | **M-0** | T-1·T-2 | DIRECT | — |

## Corte por relación con máquina

- **Pura máquina (M-1 y/o M-2, sin M-0) — 15:** proof, impresión por hoja, por
  área, por pieza, grabado láser, corte con guillotina, plotter de corte, corte
  láser, troquelado digital, CNC, perforado, laminado, barniz, acabado decorativo,
  encuadernación con anillo.
- **Híbridas (M-0 + M-1) — 5:** aplicación de transfer, plegado, pintura
  superficial, soldadura, montado sobre material.
- **Puro manual (M-0) — 22:** el resto.

## El segundo eje que importa: "motor propio"

La hipótesis "manual → tenant / máquina → sistema" es un buen 80%, pero el corte
limpio **no es máquina sí/no**, sino **si la forma es expresable con el wizard
genérico o trae lógica de motor cableada**. Hay familias M-0 (manuales) que igual
son sólo-sistema porque su costeo depende de código propio:

- **Nesting / geometría** (`CALCULADO_POR_PASO` con semántica fina): impresión por
  área, plotter, laminado, **plastificado pouch (M-0)**, **montado sobre material
  (M-0·M-1)**. El tenant puede *elegir* una superficie de nesting, pero no la
  semántica (separación literal vs demasía, origen de márgenes en material vs
  máquina) — eso es autoría del sistema.
- **Pre-pasada de medidas**: **modificación pre-producción (M-0)** muta medidas
  antes del bucle. Es una capacidad del motor, no del wizard.
- **Motor propio**: **colocación de ojales (M-0)** mide sólo lo visible.
- **Params ricos autorales** (`paramsPasoSchema`): perforado, encuadernación con
  anillo, acabado decorativo, impresión por hoja/faz — formularios por familia que
  la validación tenant explícitamente **no** deja declarar (multiplicadores como
  `hojasPorLibro`, `perforacionesPorPieza`, `cantidadModificacionesPorPieza` están
  vetados para familias de tenant).

Es decir: el sistema **ya** te frena para varias de estas — hoy un tenant no puede
reproducir un pouch con márgenes de material ni un ojalado que mida lo visible.

## Qué permite HOY el wizard del tenant

`validarDefinicionFamiliaTenant` es la única puerta de escritura y **hoy sí deja
crear pasos con máquina** (M-1/M-2), siempre que declaren al menos una plantilla
compatible. O sea: la restricción "el tenant sólo crea manuales" **todavía no
existe** — es exactamente el cambio que estás evaluando. Lo que el validador ya
prohíbe al tenant:

- `CALCULADO_POR_PASO` salvo eligiendo una superficie de nesting acotada.
- Multiplicadores que no sean `caras` / `tipoCopia`.
- Outputs a mano (se derivan de la forma).
- Params ricos por familia (no tiene `paramsPasoSchema`).

## Recomendación para decidir

Tres opciones, de más simple a más fina:

1. **Corte por máquina (tu hipótesis):** tenant sólo crea **M-0**; las 15 de pura
   máquina + las 5 híbridas quedan sólo-sistema. Simple de explicar y de codear
   (bloquear el paso "¿usa máquina?" en el wizard). Costo: las híbridas pierden su
   lado manual para el tenant, y un tenant con una máquina rara (una laminadora que
   el catálogo no tiene) no puede modelarla.

2. **Corte por "motor propio" (recomendado):** tenant crea cualquier forma
   **expresable con el wizard genérico** (manual o con máquina de plantilla
   conocida); quedan sólo-sistema las que traen nesting fino, pre-pasada, motor
   propio o params ricos (≈ impresión ×3, plotter, laminado, pouch, montaje,
   modificación pre, ojales, perforado, acabado decorativo, anillado). Es el corte
   que el código **ya** empuja; formaliza lo que la validación insinúa.

3. **Statu quo + limpieza de selector:** dejar el wizard como está y sólo revisar
   qué familias del catálogo tienen sentido comercial (hoy 5 ya están ocultas:
   plegado, conteo, atado, etiquetado, control de calidad). Mínimo esfuerzo, no
   cambia el modelo.

**Sugerencia:** opción 2. El eje "manual vs máquina" es intuitivo pero deja mal
paradas a pouch y modificación-pre (manuales pero sólo-sistema) y a transfer/pintura
(híbridas legítimas para el tenant). El eje "¿lo puede expresar el wizard?" corta
donde de verdad está el límite técnico y es el que el motor ya defiende.

## Ejecución 2026-08-03 — poda del catálogo

Se **eliminaron del código** (no ocultaron) las familias manuales limpias que además
tenían **uso cero en la base dev** y **cero cableado**. Quedaron 33 familias (de 42).

**Borradas (10) → quedan 32:** `lijado_canteado`, `armado_cajas`,
`instalacion_electrica`, `conteo_manual`, `atado_banding`, `etiquetado_manual`,
`control_calidad`, `envio`, `toma_medidas`, y **`proof`** (M-1, pero uso 0 en base y
sin cableado; sólo lo declaraba la estación "Pre-prensa & Diseño" — se borró esa fila
de `EstacionFamilia`). Se sacaron de `familias.ts` (def + mapa `FAMILIAS`), de la
unión `FamiliaCodigo` en `types.ts`, y de los mapas de UI `tablero-produccion.ts`
(íconos) y `tracking.ts` (etiquetas públicas). `pre_prensa` se conserva. `tsc` de
producción verde.

También se renombró la etiqueta de `modificacion_pre` a "Refuerzo / bolsillo de lona
(demasía)" (sólo `nombre`; código y motor intactos). Ese paso hoy tiene uso 0 en
productos/rutas/OTs (sólo lo declaraba una estación).

**NO borradas — manuales limpias pero EN USO o cableadas (8):** requieren migración
de datos antes de tocarlas, porque el resolver devuelve `undefined` para códigos que
no están en el catálogo y rompería rutas/OTs históricas:

| Familia | Por qué no se borró |
|---------|---------------------|
| `pre_prensa` | RutaPaso ×9, OT ×4, EstacionFamilia ×1, + muchos tests |
| `diseno_grafico` | RutaPaso ×7, EstacionFamilia ×1, + tests |
| `trabajo_manual` | RutaPaso ×9, EstacionFamilia ×1, **+ fallback del motor** `paso.familiaCodigo ?? 'trabajo_manual'` en `ordenes-trabajo.service.ts` |
| `ensamble_estructural` | RutaPaso ×2 |
| `corte_manual` | RutaPaso ×1, OT ×1, + `case` en `defaultOutputParaHeredar` + `digital-adapter` |
| `encuadernado_engrapado` | EstacionFamilia ×1, + `case` en `defaultOutputParaHeredar` |
| `engomado_emblocado` | EstacionFamilia ×1, + `case` en `defaultOutputParaHeredar` |
| `instalacion_in_situ` | EstacionFamilia ×1 |

Para borrar cualquiera de estas 8 hay que primero **reasignar** sus `RutaPaso` /
`OrdenTrabajoItemPaso` / `EstacionFamilia` a una familia sobreviviente (decisión de
producto: a cuál), y para `trabajo_manual` además cambiar el fallback del motor.
