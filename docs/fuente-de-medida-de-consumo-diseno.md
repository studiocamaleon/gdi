# Fuente de medida de consumo — de dónde mide cada paso

> **Estado: DOCUMENTO VIVO** (arrancado 2026-08-13). Todo paso que consume
> material necesita una **medida** (una geometría) para saber cuánto consume.
> Hoy *de dónde sale esa medida* es implícito, cableado, o directamente no
> existe, y **distinto en cada familia** — es la mayor fuente de confusión del
> editor de pasos. Este cuaderno define un concepto único: cada paso declara,
> de forma **explícita y uniforme**, su **fuente de medida**.
>
> Hermanos: [efectos-entre-pasos-diseno.md](efectos-entre-pasos-diseno.md)
> (este doc es su **cara consumidora**: allá un paso EMITE geometría, acá otro
> la ABSORBE) · [estructura-bastidor-outputs-diseno.md](estructura-bastidor-outputs-diseno.md)
> (los outputs que se vuelven opciones) ·
> [derivadores-geometricos-diseno.md](derivadores-geometricos-diseno.md).

## 1. El problema — el editor nació para impresión

En impresión es obvio e implícito: *"el material que consume el paso = las
medidas que carga el comercial en el sheet de venta."* Fácil de entender al
modelar.

Pero cada paso que se agregó DESPUÉS resolvió su *"¿de dónde mido?"* **a mano y
de forma distinta**:

| Paso | Qué medida usa | De dónde sale HOY | Mecanismo |
|---|---|---|---|
| Impresión por área | piezas (rectángulos) a nestear | la medida del comercial — **implícito** | `jobContext.piezas` (`getPiezasParaNesting`) |
| Chapa trasera (montaje) | rectángulo a panelizar | selector **"Piezas a montar"** = `piezas_visibles` | `fuentePiezasMontaje` (`nesting-dispatcher.ts:516`) |
| Pintura | m² a pintar | **herencia cableada** de `pintura_m2` | `HEREDAR_DEL_OUTPUT_CANONICO` (`outputs-canonicos.ts:184`) |
| Iluminación LED | área a llenar | la medida visible / interior | `geometriaCartel` (`iluminacion-led.ts`) |
| Cenefa | tiras a cortar | **nada** — cobra un `cenefa_m2` abstracto | — |
| Soldadura | conteo de uniones | herencia de `puntos_soldadura` | `HEREDAR` |

**Cinco mecanismos distintos para lo mismo**: implícito, selector, herencia
cableada, mezcla, o nada. No hay un lugar único ni explícito donde el modelador
diga *"este paso mide sobre X"*.

## 2. La distinción que ordena todo: son DOS medidas

En cada paso que consume material conviven dos cosas que hoy se mezclan:

1. **La HOJA / sustrato CRUDO** — lo que se compra. Sale de la **variante del
   material** elegida en el slot (`anchoMm`/`altoMm`/`largoMm` de la variante —
   `nesting-config.ts:323`). En impresión por hoja esto ya es explícito
   ("**Tamaño de pliego de impresión**"), y es justo el modelo de claridad que
   queremos para todo.
2. **La PIEZA / ÁREA a PRODUCIR** — lo que se corta / pinta / llena. Esto es lo
   implícito y scattered.

Este cuaderno hace explícita **la segunda** (la confusa), con el mismo espíritu
que "Tamaño de pliego" tiene para la primera.

## 3. El concepto: **fuente de medida** por paso

Que **todo paso que consume material** tenga **un único control, uniforme y
explícito** —el mismo para impresión, chapa, pintura, LED, cenefa—:

> **"¿De dónde salen las medidas que usa este paso para su consumo?"**

Con opciones claras y **dinámicas según la ruta**:

- **Las del trabajo** — lo que carga el comercial (`medidaVisibleMm`/`piezas`).
  El default intuitivo; lo que hoy hace impresión sin decirlo.
- **Un output de un paso anterior** — el `interior`, `fondo`, `cenefaTiras`,
  `lonaBruta`, el área a pintar… que un paso previo (el bastidor) **expone**.
  Las opciones son **los outputs que publican los pasos que están antes en la
  ruta** (§6).
- **Una medida fija del paso** — rara, para casos sin geometría del trabajo.

Así el modelador ve, en un solo lugar y en criollo: *"la chapa se corta a la
medida VISIBLE"*, *"los LEDs llenan el INTERIOR del bastidor"*, *"la cenefa sale
de las TIRAS que deriva el bastidor"*.

## 4. La forma de la medida (área, rectángulo, tiras, perímetro)

Distintos pasos necesitan geometrías de distinta **forma**:

| Forma | La necesita | Ej. de fuente |
|---|---|---|
| **Área** (m²) | pintura, LED por área | rectángulo visible, interior |
| **Piezas / rectángulos** (a nestear/panelizar) | impresión, chapa, cenefa | medida del trabajo, `fondo`, `cenefaTiras` |
| **Perímetro / recorrido** (ml) | tensado, LED por recorrido, soldadura | perímetro visible, `perimetro_visible` |
| **Conteo** (unidades) | ojales, módulos, uniones | outputs derivados |

La **fuente entrega una geometría**; el paso **deriva de ahí la forma que
necesita** (de un rectángulo salen m² o perímetro; de una lista de tiras salen
piezas a panelizar). La familia declara qué forma consume; la UI ofrece las
fuentes **compatibles**.

## 5. Esto cierra con "efectos entre pasos"

Es la **cara consumidora** de ese modelo:

- Un paso **EMITE** geometría hacia adelante (efecto POST / `publicaCanon` /
  outputs canónicos) — lo que venimos construyendo.
- Otro paso la **ABSORBE** eligiendo su **fuente de medida** — lo que este
  cuaderno unifica.

Las **opciones** del selector de fuente de un paso **son** los outputs que
emiten los pasos anteriores. Emitir ↔ absorber, las dos mitades del mismo
mecanismo.

## 6. La UI — un control uniforme, con opciones según la ruta

Para cada paso que consume material (idealmente por **slot**, con un default a
nivel paso):

- Un control **"¿Sobre qué mide este paso?"** siempre visible (no enterrado en
  Avanzado, no exclusivo de una familia).
- Las opciones se **arman desde la ruta**: la medida del trabajo + cada output
  geométrico que publican los pasos **anteriores** (nombre humano: "Interior del
  bastidor", "Tiras de cenefa", "Medida visible del cartel"…).
- Compatibilidad por forma (§4): a un paso de área no se le ofrece un conteo.

Reemplaza a: el `fuentePiezasMontaje` (sólo montaje), la herencia cableada
(pintura/soldadura), el implícito de impresión, y el vacío de la cenefa.

## 7. Mapeo de lo que existe → al modelo (nada se tira)

- `fuentePiezasMontaje` (`piezas_visibles`/`piezas_jobcontext`) = una fuente de
  medida de **piezas**, hoy sólo para montaje → se generaliza a todas.
- `HEREDAR_DEL_OUTPUT_CANONICO` (pintura, soldadura) = una fuente de medida de
  **magnitud** → se unifica bajo el mismo selector.
- El `jobContext.piezas` que lee impresión = la fuente **"las del trabajo"**,
  hecha default explícito.
- `publicaCanon` (`interiorMm`, `lonaBrutaMm`) = outputs que se vuelven
  **opciones** de fuente.

## 8. Decisiones abiertas

- **¿Por paso o por slot?** Un paso puede consumir varios materiales con medidas
  distintas (la cenefa: chapa por tiras; la impresión: lona por pieza). Propuesta:
  fuente **a nivel slot**, con un default a nivel paso para el caso común.
- **¿La fuente alimenta también el TIEMPO?** Muchas veces sí (la cenefa: las
  tiras dan el consumo Y las uniones/cortes). Hay que decidir si "fuente de
  medida" es una sola o si consumo y tiempo pueden tener fuentes distintas
  (hoy `productivityQuantitySource` es aparte — ver `perimetro_visible`).
- **Nombres humanos de los outputs**: el selector necesita etiquetas legibles
  por output ("Interior del bastidor", no `interiorMm`).
- **Compatibilidad por forma**: cómo se declara qué forma consume cada familia y
  qué fuentes son compatibles.
- **Migración**: unificar el control sin romper las rutas que hoy usan
  `fuentePiezas`/herencia — reconocerlas como instancias y migrarlas al leerlas.

## 9. Primera aplicación — la cenefa

El refactor de cenefa deja de ser "un caso especial" y se vuelve la primera
instancia del modelo: el bastidor **publica** `cenefaTiras` (output), y el paso
Cenefa **elige** esa fuente de medida → paneliza las tiras sobre su chapa (§4,
forma "piezas"). Sin un mecanismo ad-hoc: es "elegí 'Tiras de cenefa' como
fuente".

## 10. Bitácora

| Fecha | Qué se analizó |
|---|---|
| 2026-08-13 | Concepto inicial: "fuente de medida de consumo" como control único y explícito por paso; la distinción hoja-cruda vs pieza-a-producir; las formas de medida; el mapeo de los 5 mecanismos actuales; la conexión emit↔absorbe con efectos entre pasos; la cenefa como primera aplicación. Sin código. |
