# Corte/formado: sustrato propio o heredado — análisis y diseño

> **Estado: DOCUMENTO VIVO** (arrancado 2026-08-14). Nace de una observación de
> Lucas sobre `plotter_corte`: un paso de corte trabaja sobre un sustrato que
> puede ser **propio** (vinilo de corte, MDF, acrílico virgen) o **heredado** de
> otro paso (acrílico impreso en UV y luego cortado; vinilo ya impreso que se
> troquela), y el editor no muestra en ningún lado sobre qué medida trabaja.
>
> Hermanos: [fuente-de-medida-de-consumo-diseno.md](fuente-de-medida-de-consumo-diseno.md)
> · [efectos-entre-pasos-diseno.md](efectos-entre-pasos-diseno.md)
> · [maquinas-mecanizadas-corte-laser-cnc-diseno.md](maquinas-mecanizadas-corte-laser-cnc-diseno.md)
> · [nesting-abstraccion-diseno.md](nesting-abstraccion-diseno.md).
>
> **Nada implementado.** Acá se acuerda el modelo antes de tocar código.

## 1. El problema — impresión ≠ corte respecto del sustrato

- **Impresión** (por hoja / área / pieza) **siempre** trabaja SOBRE un sustrato
  que ella define: nunca sobre algo ya procesado por otro paso. Por eso las 3
  familias de impresión declaran un slot `SUSTRATO` **obligatorio** — y de ese
  material salen ancho/alto/subfamilia para nestear.
- **Corte/formado** (plotter de corte, láser CO₂, CNC, troquelado, guillotina)
  también trabaja SOBRE un sustrato, pero **no imprime**: troquela / corta /
  graba. Y ese sustrato puede ser:
  - **Propio**: el paso lo compra y consume — *vinilo de corte* de color (letras
    en plotter), *MDF/acrílico virgen* (CNC/láser), foam.
  - **Heredado**: un paso anterior ya lo compró y trabajó — *acrílico impreso en
    UV* que entra al láser, *vinilo impreso* que se troquela, *pliego impreso*
    que se corta en guillotina. Acá el corte **no re-compra** el material.
- Además: puede trabajar sobre **rollo** o sobre **hoja/placa**, y **cada paso
  puede tener su propio nesting** sobre las dimensiones de SU máquina (la mesa
  del láser ≠ el ancho del plotter ≠ la boca de la impresora).

## 2. Estado actual — qué soporta el sistema HOY

### 2.1 La arquitectura de nesting por paso YA existe

- El nesting corre **por paso**, cada uno con **su máquina y su material**
  (`runNestingForPaso` dentro del bucle, `motor.service.ts:2459`; máquina del
  paso en `:2333/2380`, material en `:2399-2407`). **No** hay un nesting único
  por ruta.
- El sustrato del nesting se resuelve por cascada **material → máquina → default
  de familia** (`nesting-config.ts`): rollo desde `materialAttrs.anchoMm` o, si
  no hay material, desde `paso.maquina.anchoUtil` (`:291-311`); hoja desde el
  pliego configurado o `materialAttrs.anchoMm/altoMm` o la mesa
  `maqParams.anchoMesaMm/largoMesaMm` (`:369-376`).
- `superficie: 'segun_material'` decide rollo vs placa en runtime según la
  máquina y la subfamilia del material (`resolverSuperficieDinamica`,
  `nesting-dispatcher.ts:354-365`) — un mismo paso puede caer a rollo o a hoja.

### 2.2 El patrón "propio + heredado" YA está resuelto — pero sólo en montaje/laminado

`montaje_sobre_sustrato` (`familias.ts:1649-1728`) es la prueba de que el modelo
tiene el patrón completo:
- Slot `SUSTRATO` **propio** (el material que consume).
- `fuentesPiezasNesting` — la **geometría** a nestear puede ser propia
  (`piezas_jobcontext`) o **heredada** (`pliegos_impresos`/`pliegos_calculados`
  de un paso anterior, con `anchoDesde`/`altoDesde`).
- `nestingConfig.estrategia: 'montaje'` → `runMontajeSobreSustrato`.

`laminado` usa lo mismo (`fuentePiezasDefault: 'pliegos_impresos'`). **Este par
—slot SUSTRATO propio + fuente de geometría heredada— es el mecanismo canónico
para "trabajo sobre sustrato propio o heredado", y está en el contrato de tipos.
Ninguna familia de corte lo usa.**

### 2.3 Las familias de corte NO están cableadas

| Familia | nesting | Slot sustrato | Cantidad | Sustrato/medida HOY |
|---|---|---|---|---|
| `plotter_corte` | rollo (`corte_rollo`) | **no** | CALCULADO_POR_PASO | Geometría de `jobContext.piezas`; **ancho = boca de la máquina** (`anchoUtil`), no del sustrato. No costea material |
| `corte_laser` | **no** | **no** | DIRECT | No nestea; cuenta piezas; tiempo por perímetro÷velocidad |
| `grabado_laser` | **no** | **sí** (`sustrato`) | DIRECT | Costea su sustrato propio; no nestea; tiempo por perímetro |
| `cnc` | **no** | **no** | DIRECT | Igual que corte_laser |
| `troquelado_digital` | **no** | **no** | DIRECT | Declara `outputHeredadoDefault: pliegos_impresos` pero el mecanismo es DIRECT → **nunca lo usa** (incoherencia) |
| `corte_guillotina` | **no** | **no** | HEREDAR | Heredado limpio de impresión (`pliegos_calculados`/`cortes_calculados`) |
| `corte_manual` | **no** | **no** | HEREDAR o DIRECT | Hereda `pliegos_impresos` o cuenta directo; T-2 |

**Huecos:**
1. **5 de 7 familias no pueden portar sustrato propio** (`slotsRequeridos: []` y
   `permiteSlotsAdicionales: false`): plotter_corte, corte_laser, cnc,
   troquelado_digital, corte_manual. No hay dónde poner "vinilo de corte", "MDF",
   "acrílico virgen". Sólo `grabado_laser` puede.
2. **`plotter_corte` nestea con el ancho de la MÁQUINA, no del sustrato** — no
   hay forma de decir "corto sobre el vinilo X de 610 mm"; el ancho lo pone
   `anchoUtil`. Correcto sólo si coinciden.
3. **Ningún paso de corte hereda geometría vía `fuentesPiezasNesting`.** El
   patrón existe (montaje/laminado) pero no está declarado en corte. El caso
   "acrílico impreso → cortado en láser" hoy se resuelve **implícito**: el
   sustrato se paga en el paso de impresión y el corte sólo cuenta piezas + mide
   perímetro; **no re-nestea sobre la placa impresa ni valida que las piezas
   entren**.
4. **La única herencia real de sustrato está cableada a la cadena de impresión
   por pliego** (guillotina/manual con `pliegos_impresos`). No hay equivalente
   para gran formato/área ni placa rígida.
5. **Láser/CNC no nestean en absoluto** y su envolvente física
   (`Maquina.anchoUtil/largoUtil`) **no está expuesta** en las claves que el
   nesting lee (`maqParams.anchoMesaMm/largoMesaMm`); su geometría mapea a
   `plano`, no a `MESA_EXTENSORA` (no dispara la rama de placa).

### 2.4 Herencia entre pasos: TRES mecanismos separados

Hoy "un paso emite algo que otro absorbe" está implementado tres veces:
- **`HEREDAR_DEL_OUTPUT_CANONICO`** — hereda la **cantidad** (magnitud): el corte
  toma como cantidad los `pliegos_impresos`/`piezas_X` del paso anterior
  (`motor.service.ts:5849-5879`; herencia explícita B.3.3 por `{rutaPasoId,
  capacidad}` o `campoOutput`).
- **`slot.fuenteMedida = 'output:<clave>'`** — hereda la **geometría** a
  consumir: un slot SUSTRATO mide su consumo desde la geometría publicada por un
  paso anterior (interior, fondo, tiras de cenefa, lona bruta)
  (`nesting-dispatcher.ts:658-669`). Es la cara consumidora de "fuente de
  medida" (doc hermano).
- **`pliego_impresion_mp_variante_id`** — hereda **qué variante de MP** costear:
  pre_prensa publica la variante ganadora y la impresión costea el sustrato con
  ESA (`motor.service.ts:4447-4469`, origen `por_candidato`). Limitado a
  `sustrato_principal` y al flujo pre_prensa→impresión.
- (más `modificaciones-pre`: un paso posterior agranda las piezas — demasía).

Los docs `fuente-de-medida` y `efectos-entre-pasos` ya quieren **unificar** estos
mecanismos bajo una sola declaración; ese trabajo está pendiente.

## 3. El hallazgo conceptual que ordena la decisión

**No existe —ni hace falta— un "sustrato-objeto" que fluya de paso a paso.** Un
slot de material SIEMPRE resuelve contra una variante de inventario. El corte no
"recibe el pliego impreso" como objeto; lo que hereda de un paso anterior es
**geometría** (qué piezas/medida), **cantidad** (cuántos) y, cuando hace falta,
**qué variante** costear. El "sustrato heredado" se modela **compartiendo esas
tres cosas**, no pasando un objeto.

Consecuencia de diseño: **no hay que inventar un modelo nuevo de "flujo de
sustrato".** Alcanza con **extender a las familias de corte el patrón que ya
funciona** (slot SUSTRATO propio + fuente de geometría heredada + nestingConfig).

## 4. El modelo objetivo — dos ejes independientes por paso de corte

Un paso de corte tiene DOS decisiones ortogonales que hoy están mezcladas o
ausentes:

1. **¿Sobre qué MATERIAL corta?** (el sustrato)
   - **Propio**: un slot `SUSTRATO` opcional (vinilo de corte, MDF, acrílico) —
     el paso lo costea. Nesting sobre la variante + la máquina.
   - **Heredado**: no declara material propio; toma el sustrato del paso
     anterior (no re-compra). El costo del material ya lo pagó ese paso.
2. **¿Sobre qué GEOMETRÍA/MEDIDA trabaja?** (la fuente de medida — doc hermano)
   - Las piezas del trabajo, o un output geométrico de un paso anterior.
   - Esto define QUÉ nestea y calcula el recorrido de corte.

Y el **nesting es del paso**: usa las dimensiones de SU máquina (mesa del láser /
ancho del plotter) sobre el material (propio o el que le llega). Ya soportado por
la arquitectura (§2.1).

El **costo/tiempo** de corte suma dos ejes que deben convivir:
- **Tiempo** = recorrido (perímetro) ÷ velocidad del perfil (ya existe, láser/CNC).
- **Consumo de sustrato** = el nesting (cuántas placas/rollo, desperdicio) — hoy
  no se calcula en corte porque cobra por recorrido, no por placa. Con sustrato
  propio, este eje pasa a importar.

## 5. Cambios propuestos (por tamaño)

### Fase A — dar el patrón canónico a las familias de corte (config, sin motor)
1. **Slot `SUSTRATO` opcional** en `plotter_corte`, `corte_laser`, `cnc`,
   `troquelado_digital` (grabado_laser ya lo tiene). Compatibilidad de material
   por familia (vinilo de corte / MDF-acrílico / etc.). Opcional: si no se
   declara, el paso trabaja sobre heredado.
2. **`fuentesPiezasNesting`** en esas familias, con `piezas_jobcontext` +
   `pliegos_impresos`/outputs de gran formato heredables — para el caso
   "trabaja sobre lo que imprimió el paso anterior".
3. **`nestingConfig`** donde falte (láser/CNC/troquelado): `segun_material` o
   `pliego`, estrategia tipo `montaje`/`corte_rollo`.
4. **Fix incoherencia** `troquelado_digital`: soportar `HEREDAR` (para que su
   `outputHeredadoDefault: pliegos_impresos` sirva) o quitar el default.

### Fase B — plumbing de máquina (motor, acotado)
5. **Exponer la envolvente láser/CNC** en las claves del nesting: mapear
   `Maquina.largoUtil` → `largoMesaMm` (o extender la cascada de `sheetHeightMm`)
   y geometría `MESA_EXTENSORA` para disparar la rama de placa.
6. **Convivencia costo/tiempo**: mantener tiempo por recorrido y sumar, cuando
   hay sustrato propio, el consumo por nesting.

### Fase C — transparencia en el editor (el disparador original)
7. **Mostrar "sobre qué medida/material trabaja"** para pasos sin slot y de un
   solo mecanismo (hoy oculto: la pregunta `tiempo.cantidad_operativa` se
   esconde con un solo mecanismo + T-3). Aunque no haya nada que configurar, el
   modelador tiene que **ver** que el troquelado trabaja sobre las piezas del
   ítem / el output del paso X.

### Fase D — (aspiracional) unificar la herencia
8. Converger los 3 mecanismos (`HEREDAR` cantidad / `fuenteMedida` geometría /
   variante heredada) bajo la declaración única que proponen los docs
   `fuente-de-medida` y `efectos-entre-pasos`. Grande; no bloquea A-C.

## 6. Decisiones (Lucas, 2026-08-14)

1. **Slot de sustrato opcional** (propio vs heredado elegible) — a confirmar en
   el detalle de plotter_corte (§7).
2. **"Vinilo de corte" como subfamilia de MP** — pendiente de definir.
3. **El heredado NO re-cobra material** ✅ — el corte sobre lo impreso cobra sólo
   su tiempo de máquina; el sustrato lo pagó el paso de impresión.
4. **Láser/CNC: los DOS ejes** ✅ — nesting real de placa (cuántas placas de
   MDF/acrílico, desperdicio) + tiempo por recorrido. (Segunda ronda; se arranca
   por plotter_corte.)
5. **Se arranca por `plotter_corte`** ✅ — primera instancia; de ahí se
   generaliza.

## 7. Plan concreto — plotter_corte (primera instancia)

Dos casos de uso del mismo paso, elegibles por el modelador/comercial:

- **Sustrato PROPIO** (vinilo de corte de color, para letras): el paso declara y
  consume su material. Nestea las piezas/letras sobre el **rollo del vinilo**
  (ancho de la variante) → **cobra el vinilo** + su tiempo de máquina.
- **Sustrato HEREDADO** (troquela el vinilo ya impreso por impresión por área):
  **no** declara material propio; **no re-cobra** el sustrato. La geometría a
  cortar la **hereda** del paso de impresión (las mismas piezas, ya nesteadas).
  Cobra sólo el tiempo de corte (recorrido).

Cambios (config primero, motor acotado):
1. **Slot `SUSTRATO` OPCIONAL** en plotter_corte (`requerido: false`), compat con
   la subfamilia de "vinilo de corte" (decisión §6.2). Opcional = si no se
   declara/elige, el paso trabaja sobre heredado.
2. **`fuentesPiezasNesting`** con `piezas_jobcontext` (propio) + los outputs
   heredables de impresión por área (para el caso "troquela lo impreso") — el
   patrón de `montaje_sobre_sustrato`.
3. **Ancho de nesting**: cuando hay sustrato propio, del **material** (vinilo),
   no de la máquina (hoy usa `anchoUtil`). Cuando es heredado, de la fuente.
4. **Costeo**: propio → cobra el vinilo (nesting rollo, "largo consumido");
   heredado → sin línea de material (sólo tiempo).
5. **Editor (transparencia)**: mostrar la fuente/material sobre el que trabaja
   (hoy oculto — §5 Fase C).

**Ojo golden master**: plotter_corte se usa en `VINILO-IMPRESO-BLANCO` (heredado).
El cambio debe dejar ese caso **bit-idéntico** (sigue sin cobrar material, mismo
tiempo) y sólo AGREGAR la capacidad de sustrato propio. Verificar con el arnés
que ya montamos.

## 8. Bitácora

## 7. Bitácora

| Fecha | Qué se analizó |
|---|---|
| 2026-08-14 | Estado actual completo de las 7 familias de corte/formado; los 3 mecanismos de herencia; la resolución de sustrato/dimensiones del nesting por paso; el patrón canónico `montaje` (slot propio + fuente heredada); el hallazgo de que no fluye un "sustrato-objeto"; el modelo objetivo de dos ejes (material propio/heredado × geometría) y las fases A-D. Sin código. |
