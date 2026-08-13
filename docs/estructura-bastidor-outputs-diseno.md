# Estructura de bastidor — outputs geométricos para los pasos siguientes

> **Estado: DOCUMENTO VIVO** (arrancado 2026-08-13). Análisis de diseño para
> que la familia `estructura_bastidor` deje de emitir **magnitudes** (m², ml) y
> empiece a emitir **geometría** (medidas, piezas, tiras) que los pasos
> siguientes de fabricación puedan consumir directo. **No hay cambios de código
> en esta etapa**: primero se cierra el modelo, después se implementa por olas.
>
> Hermanos: [carteleria-configurador-diseno.md](carteleria-configurador-diseno.md)
> (§4.1, §15) · [derivadores-geometricos-diseno.md](derivadores-geometricos-diseno.md)
> (el contrato de derivadores) · [carteleria-pasos-revision.md](carteleria-pasos-revision.md)
> (herencia de outputs por paso) ·
> [modificaciones-fisicas-lona-diseno.md](modificaciones-fisicas-lona-diseno.md)
> (la demasía de tensado y la "regla de oro").

## 1. Por qué existe este cuaderno

Hoy el bastidor publica **magnitudes**: `ml_estructura`, `cenefa_m2`,
`pintura_m2`, `fondo_m2`, `puntos_soldadura` (inventario actual declarado en
`apps/api/src/productos-servicios/pasos/familias.ts:1361`, mapeados a magnitudes
en `familias.ts:1383`). Sirven para
**cotizar**, pero **no para fabricar**: un m² no dice cuántas chapas hay que
comprar ni cómo cortarlas.

El despiece de hierros ya cruzó esa línea una vez: pasó de `mlTotal` —una
magnitud que mentía con `ceil`— a **`despieceMm`**, el largo real de cada barra,
para empaquetar barras enteras con packing 1D
(`apps/api/src/motor-universal/estructura-bastidor.ts:129`, `calcularBarrasNecesarias`).

> "m² de cenefa no dice nada, porque se cortan… hay que aprovechar el largo de
> la chapa y pensar si hay que cortar alguna y unir, ya que tienen un largo
> máximo y el cartel puede ser más grande." (Lucas, 2026-08-13)

Este cuaderno extiende ese mismo salto **magnitud → geometría** a la chapa
(fondo, cenefa), la lona y el espacio interno de LEDs. La tesis: **si el
bastidor entrega geometría real, los pasos siguientes se configuran casi
solos** (heredan y aplican su materia prima, sin cargar cantidades a mano).

## 2. Principio rector: bastidor emite GEOMETRÍA, los pasos son dueños del PROCESO

Es tentador que el bastidor "sepa todo" (densidad de LED, dobladillo de lona,
stock de chapa). Eso lo vuelve un dios acoplado a decisiones que no son
estructurales. La línea que se traza:

- **Bastidor emite hechos geométricos puros** —consecuencias directas del marco:
  medidas interiores, largo de cada lado, profundidad, desarrollo del pliegue,
  rectángulo de fondo, tiras de cenefa. Estables y agnósticas del proceso.
- **Cada paso siguiente combina esa geometría con SU regla**: densidad de LED,
  demasía de dobladillo, nesting sobre la chapa que eligió, largo máximo de su
  materia prima, kerf de su sierra.

Ejemplos de la frontera:
- Bastidor da el **interior útil** (96×… si el caño es de 2 cm); el paso de LED
  decide **cuántos módulos** entran ahí con su densidad.
- Bastidor da las **tiras de cenefa** (largo × desarrollo); el paso de cenefa
  decide **cuántas chapas** salen y **dónde une** según el largo de SU chapa.

## 3. Inventario de outputs propuestos

Estado hoy y hacia dónde va cada uno. "Geometría" = lo nuevo que el bastidor
debería exponer.

| Necesidad del paso siguiente | Hoy | Geometría propuesta | Quién consume | Ola |
|---|---|---|---|---|
| **Metros / despiece de hierros** | `mlTotal` + `despieceMm` ✅ | ya está | slot `perfil_estructural` (packing 1D) | — |
| **Espacio interno para LEDs** | LED usa medida **exterior** (sobreconteo) | `interiorAnchoMm`, `interiorAltoMm` (= W−2L, H−2L) | derivador `sembrado_led` | 1→2 |
| **Chapa de fondo** | `fondo_m2 = W·H·1,1` (muerto, nadie hereda) | rectángulo `fondoAnchoMm × fondoAltoMm` | paso de fondo → **panelizado existente** | 1→2 |
| **Cenefa (cortar y unir)** | `cenefa_m2` (abstracto) | **tiras** `{ largoMm, anchoMm }` × lado | paso de cenefa → **panelizado existente** | 1→2 |
| **Lona + demasía** | la exige el paso "tensado" | **lona bruta** = visible + demasía de agarre (§7.1) | paso de lona → panelizado en rollo | 1→2 |
| **Uniones de estructura** | `puntos_soldadura` ✅ | ya está | paso de soldadura | — |
| **Uniones/costuras de chapa** | no existe | seams cuando una pieza supera el largo de chapa | paso de cenefa/fondo | 3 |

Todo lo geométrico **ya se calcula o es trivial de derivar** dentro de
`calcularEstructuraBastidor` / `ResultadoEstructuraBastidor`
(`apps/api/src/motor-universal/estructura-bastidor.ts:93`): `wInterior`/`hInterior`
existen (`:238`), el desarrollo de cenefa existe (`cenefaDesarrolloCm`, `:278`),
el rectángulo de fondo es `W×H`.

## 4. El hueco arquitectónico: flujo de datos ENTRE derivadores

La herencia de hoy (`HEREDAR_DEL_OUTPUT_CANONICO`,
`apps/api/src/motor-universal/outputs-canonicos.ts:184`) alimenta la **cantidad
de un paso** con un **escalar**. Alcanza para "soldadura = `puntos_soldadura`".

Pero lo que necesita LED/cenefa es que **un derivador aguas abajo lea la
geometría de otro**: el interior del bastidor entra como *input* al derivador
`sembrado_led`; las tiras entran al packing del paso de cenefa. Hoy el LED se
re-deriva solo del `jobContext` (`apps/api/src/motor-universal/iluminacion-led.ts:121`,
lee la medida **visible/exterior**). **Ese flujo entre derivadores no existe
como patrón.** Es el trabajo de diseño central de la Ola #2.

Dos formas de cerrarlo (a decidir en Ola #2):
- **(a) Canon en el JobContext**: el bastidor escribe dimensiones canónicas
  (`interiorMm`, `lonaBrutaMm`) en el JobContext, igual que hoy conviven
  `piezas` y `piezasVisibles`; los derivadores siguientes las leen con
  prioridad. Simple, pero agranda el "contrato implícito" del JobContext.
- **(b) Input heredado de output**: la familia declara un input cuyo origen es
  un output canónico del bastidor, y el motor lo inyecta al derivador. Más
  explícito y declarativo; requiere extender el mecanismo de herencia para que
  alimente *inputs de derivador*, no sólo cantidades de paso.

## 5. Las tres olas

1. **Geometría aditiva (sin mover precios).** El bastidor **calcula y expone**
   la geometría nueva (interior útil, rectángulo de fondo, tiras de cenefa) en
   su `traza` y como outputs, **pero nadie la consume todavía** → los precios no
   se mueven y los golden masters quedan intactos. Incluye el relabel de
   "Cantidad del paso" vía `unidadPrincipal`. **Es la ola que desbloquea el
   resto.** Detalle en §6.
2. **Conectar el flujo entre derivadores.** LED consume el interior; el fondo y
   la cenefa consumen su geometría. **Acá se mueven precios** (el LED sobre 96
   cuenta distinto que sobre 100) → re-baseline cuidado de los golden masters.
3. **Panelizar chapa/cenefa con la primitiva existente.** El fondo y las tiras de
   cenefa se conectan a `partirPiezasEnPanosDeHoja` (que ya cuenta hojas con
   solape) — **no es un algoritmo nuevo** (§7.2, §7.4). Único opcional: un driver
   de tiempo para las uniones (§7.3). Casi disuelta.

## 6. Ola #1 en detalle — geometría aditiva

Objetivo: que el bastidor **publique la geometría** que hoy no publica, de forma
**aditiva y sin consumidores**, para que sea el sustrato de las Olas 2 y 3. Nada
de esto cambia una cotización todavía.

### 6.1 Qué se expone (todo ya derivable)

Sobre `ResultadoEstructuraBastidor`
(`apps/api/src/motor-universal/estructura-bastidor.ts:93`) y la `traza` del
derivador (`apps/api/src/motor-universal/derivadores/index.ts:79`):

- **Interior útil**: `interiorAnchoMm = round((W − 2L)·1000)`,
  `interiorAltoMm = round((H − 2L)·1000)`. `L` = lado del caño (`perfilLadoM`).
  Ya existe como `wInterior`/`hInterior` (`:238`). Es el espacio donde se montan
  los LEDs (el frente de un backlight: interior del marco frontal).
- **Rectángulo de fondo**: `fondoAnchoMm = round(W·1000)`,
  `fondoAltoMm = round(H·1000)`. La chapa trasera cubre la cara → `W×H`. El
  `fondo_m2 = W·H·1,1` actual queda como magnitud de compat; el rectángulo es lo
  nuevo para nestear.
- **Tiras de cenefa** (`despiece de cenefa`): para un cajón (`D > 0`), la cenefa
  envuelve el perímetro. Ancho de cada tira = **desarrollo** =
  `D + 2·solapaCenefaCm` (ya calculado como `cenefaDesarrolloCm`, `:278`). Largos
  = los lados: 2 tiras de `W` (arriba/abajo) y 2 de `H` (izq/der).
  → lista `[{ largoMm: W·1000, anchoMm: desarrollo·1000 } ×2, { largoMm: H·1000, … } ×2]`.
  Una tira por lado, largo = lado exacto (§7.4, cerrada).

Todo **por cartel**; en el derivador se multiplica/replica por `unidades` igual
que el despiece de hierros (`derivadores/index.ts:60`).

### 6.2 ¿Canónico (heredable) o traza (ficha/visor)?

En la Ola #1 va como **traza rica** (para ficha técnica y, si aplica, el visor),
porque **todavía no hay consumidor**. Recién en la Ola #2, cuando LED/cenefa lo
lean, se decide si además se promueve a **output canónico** (para herencia) o se
resuelve por el canon del JobContext (§4a). Mantenerlo en `traza` primero es lo
que garantiza "aditivo, sin mover precios".

### 6.3 Por qué NO mueve precios

- Los outputs actuales (`mlTotal`, `cenefa_m2`, `fondo_m2`, `puntosSoldadura`)
  **no cambian**: se siguen calculando igual.
- La geometría nueva es **información adicional en la traza**: ningún slot ni
  paso la consume aún.
- Los golden masters (huella por paso) deben dar **idéntico**. Es la prueba de
  que la Ola #1 es segura.

### 6.4 El relabel de "Cantidad del paso"

La familia **ya declara** `unidadPrincipal: 'ml de perfil'`
(`apps/api/src/productos-servicios/pasos/familias.ts:1375`). El dato para
mostrar *"Metros de perfil"* en vez del genérico *"Cantidad del paso"* **ya
existe** — es un fix de **etiquetado en la UI del editor de pasos**, no de
modelo. Se ancla acá pero **se revisa transversal a todos los productos**: cada
familia con `magnitudPrincipal` `CALCULADO_POR_PASO` tiene su `unidadPrincipal`;
la UI debería usarlo siempre que exista. Ortogonal al rediseño de outputs;
bajo riesgo, alta claridad.

## 7. Decisiones — cerradas (2026-08-13)

### 7.1 Lona bruta: la posee el bastidor (con demasía de agarre)

La demasía que hoy exige el paso de tensado pasa a ser **output del bastidor**.
La fábrica no corta a la medida visible: deja demasía **para agarrar y tensar**.
Fórmula según montaje (param `montajeLona`):

- **Perimetral al ras (backlight con tornillos)**: a la medida visible se le
  suman **~10 cm por lado** para que el operario pince y tense; después se corta
  al ras del hierro lateral (queda visible + 2 cm, pero eso es **merma**, no
  material). → **material = `(W + 2·agarre) × (H + 2·agarre)`**, `agarre` param
  (`demasiaAgarreCm`, default 10). Independiente de la profundidad.
- **Envuelve al contramarco (tela canvas engrampada)**: la tela llega hasta el
  contramarco (envuelve la profundidad `D`) + la misma demasía de agarre. →
  **material = `(W + 2·(D + agarre)) × (H + 2·(D + agarre))`**.

El dobladillo/ojales (terminación) NO entra acá: sigue en su paso. **Doble faz**:
el bastidor emite **2 lonas** (frente + contra), cada una con su bruta — salda
la deuda anotada (hoy duplica sólo la tinta).

> La "regla de oro" se respeta: la **estructura** (hierros) sigue midiendo la
> medida VISIBLE; la **lona bruta** es un output aparte que el paso de lona
> consume como su pieza. Es el mismo dualismo `piezas` / `piezasVisibles` de hoy,
> pero con la demasía sourced del bastidor y no del paso de tensado.

### 7.2 Chapa (fondo) y cenefa: se PANELIZAN con la primitiva existente

Decisión clave (Lucas, 2026-08-13): cuando una chapa no cubre la medida, se
**paneliza** igual que hoy una lona/vinilo — paños con **solape**, usando la
menor chapa posible. **No se inventa nesting 2D**: se reusa
`partirPiezasEnPanosDeHoja`
(`apps/api/src/motor-universal/nesting-dispatcher.ts:445`), que ya parte la pieza
que no entra en la hoja útil en paños con `overlapMm` y cuenta las hojas.

- **Fondo**: el bastidor emite el **rectángulo** `W×H`; el paso de fondo lo
  paneliza sobre su chapa (nesting existente cuenta las hojas).
- **Cenefa**: el bastidor emite las **tiras** (una por lado, `largo × desarrollo`);
  el paso de cenefa las paneliza. Si una tira supera el largo de la chapa, se
  **montan** dos o más piezas con un **pequeño solape** (lo mismo que la
  panelización de paños). "Cortar y unir" = el paño con solape que la primitiva
  ya genera.

Esto **colapsa la Ola #3 vieja** ("nesting 2D nuevo"): el grueso ya existe.

### 7.3 Costuras de chapa: son los paños con solape (no un driver nuevo)

Las "costuras/uniones de chapa" son exactamente los **cortes de panelizado** que
`partirPiezasEnPanosDeHoja` ya produce. No hace falta un output nuevo del
bastidor. Si más adelante se quiere un **driver de tiempo** para las uniones, es
el **conteo de paños con corte** del paso de chapa/cenefa (proceso del paso, no
geometría del bastidor).

### 7.4 Corte de la cenefa: una tira por lado, largo = lado exacto

Confirmado (Lucas, 2026-08-13): la cenefa se corta **por lado del cartel**. Un
cartel 100×50 → 2 tiras de **100** y 2 de **50**. Modelo: **4 tiras**, largo = el
lado (`2·W + 2·H`), ancho = desarrollo (`D + 2·solapaPliegue`). **Sin descuento
por esquina** (las tiras se pisan en la esquina; material completo por lado).

La panelización aparece **sólo a lo largo**: si una tira (p.ej. 2,5 m) supera el
largo de la chapa (p.ej. 2 m), se corta en piezas que sumen el largo (2 m +
0,5 m) con **solape** — exactamente `partirPiezasEnPanosDeHoja` sobre el largo de
la tira. Nada de tratamiento de esquina especial.

### 7.5 Flujo entre derivadores: canon en el JobContext

Cierra con la opción (a) de §4: el bastidor **escribe dimensiones canónicas** en
el JobContext (`interiorMm`, `lonaBrutaMm`, y las piezas panelizables de chapa),
y los derivadores/pasos siguientes las leen con prioridad. Es el **mismo patrón**
que hoy conviven `piezas` / `piezasVisibles` — ya bendecido por la regla de oro —
y no requiere infra nueva de herencia. **Caveat**: exige que el paso de
estructura corra **antes** que LED/lona/chapa; en la ruta siempre precede, pero
la dependencia de orden queda explícita (a garantizar en la implementación).

## 8. Bitácora

| Fecha | Qué se analizó |
|---|---|
| 2026-08-13 | Análisis inicial: tesis magnitud→geometría, principio geometría/proceso, inventario de outputs, el hueco de flujo entre derivadores, las 3 olas y el detalle de la Ola #1. Sin código. |
| 2026-08-13 | §7 CERRADA: lona bruta = visible + demasía de agarre (10cm; canvas envuelve al contramarco; doble faz = 2 lonas); chapa/cenefa se panelizan con `partirPiezasEnPanosDeHoja` existente (colapsa el "nesting 2D nuevo"); costuras = paños con solape; cenefa = 4 tiras (esquina a confirmar); flujo entre derivadores = canon en JobContext. |
| 2026-08-13 | §7.4 cerrada definitivo: 1 tira por lado, largo = lado exacto (100×50 → 100,100,50,50), sin descuento de esquina; panelización sólo a lo largo cuando la tira supera el largo de la chapa. Ola 3 casi disuelta. |
| 2026-08-13 | **Ola #1 IMPLEMENTADA** (aditiva): el cálculo puro emite interior útil, rectángulo de fondo, tiras de cenefa y lona bruta (params `montajeLona`/`demasiaAgarreCm`); van en la traza del derivador; params en el schema de la familia. + relabel del selector de cantidad usando `unidadPrincipal` (transversal). 7 specs nuevos; **golden master de cartelería IDÉNTICO** ("no movió un peso"); typecheck limpio. Falta eyeballear el relabel en un producto con bastidor. |
