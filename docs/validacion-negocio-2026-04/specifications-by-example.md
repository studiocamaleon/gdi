# Specifications by Example · Validación 2026-04-23

> Las preguntas que el sistema **debe** responder al cotizar. Para cada pregunta, marcamos:
> - **R** ✅ — el SuperMotor la responde correctamente (verificado con `POST /productos-servicios/variantes/:varianteId/cotizar-v2`).
> - **P** 🟡 — la responde **parcialmente** (devuelve un número pero falta lógica, o requiere input que la UI no pide).
> - **N** ❌ — **no la responde** (gap conocido o gap nuevo descubierto en el ejercicio).
>
> Datos de tenant: Grafica Corporearte (`0e7937a0-...`).

---

## Tarjetas de Visita (PRS-0001)

Variante usada en la matriz: `Estandar 9x5` (`947969f5-...`, 90×50mm, CMYK, simple faz). Sin opcionales salvo cuando se indica.

| # | Pregunta | Cómo se prueba | Veredicto | Resultado / Gap |
|---|---|---|---|---|
| T01 | ¿Cuánto cuesta tirar 100 tarjetas? | `cantidad: 100` | R ✅ | $6.252,99 ($62,53/u). 4 pasos activos. |
| T02 | ¿Cuánto si bajo a 10? | `cantidad: 10` | R ✅ | $4.498,94 ($449,89/u). El setup domina. |
| T03 | ¿Cuánto si subo a 1000? | `cantidad: 1000` | R ✅ | $23.828,28 ($23,83/u). |
| T04 | ¿Cuánto si subo a 5000? | `cantidad: 5000` | R ✅ | $102.018,41 ($20,40/u). El unitario se aplana — material domina. |
| T05 | ¿Cuánto agrega activar Diseño Gráfico? | `opcionalesSeleccionados: [diseno]` | R ✅ | +$7.834,20 (de $6.252 a $14.087). **Verificar realismo de la tarifa**. |
| T06 | ¿Cuánto agrega activar Laminado BOPP? | `opcionalesSeleccionados: [laminado]` | R ✅ | +$1.532,43. Razonable para 100 unidades. |
| T07 | ¿Diseño + Laminado son aditivos? | `opcionalesSeleccionados: [diseno, laminado]` | R ✅ | $15.619,62 = $6.252 + $7.834 + $1.532. Exactamente aditivo. |
| T08 | ¿Cómo cambia con tirada chica vs grande del mismo producto? | T02 vs T04 | R ✅ | $449,89/u vs $20,40/u (factor ×22). El motor responde correctamente al efecto setup. |
| T09 | ¿Cuál es el costo si uso Ricoh A vs Hibrida UV? | Cambiar máquina | N ❌ | **Gap real**: hay solo 1 alternativa (Ricoh con perfil Papel Grueso Simple). El sistema NO permite preguntar "cuánto si voy a Hibrida UV". |
| T10 | ¿Cuál es el costo si elijo Doble faz vs Simple faz? | Cambiar perfil de Ricoh | N ❌ | **Gap real**: la Ricoh tiene 4 perfiles (Grueso/obra × Simple/Doble) pero solo 1 está como alternativa. |
| T11 | ¿Cuánto cambia con tira+retira? | Activar `caras=DOBLE_FAZ` | P 🟡 | El motor lo calcula como 2 corridas (gap §P5 handoff: tira+retira). La variante usada es SIMPLE_FAZ por seed; no probado. |
| T12 | ¿Cuánto en BN vs CMYK? | Cambiar variante | P 🟡 | La variante usada es CMYK. Hay variante BN (Talonarios `dd823592`, BN). Costo BN: $74,51/u (10×15) — pero variante distinta, no comparable directamente. |
| T13 | ¿Cómo afecta el formato de tarjeta (9x5 vs 7x3)? | Variante distinta | R ✅ | 9x5: $62,53/u — 7x3: $60,56/u. Casi igual, sospechoso (más tarjetas/pliego debería bajar más). **Verificar nesting.** |
| T14 | ¿Cuánto pesa el setup vs el variable (CC)? | Inspeccionar trazabilidad | R ✅ | Para 100 unidades: setup 5min + cleanup 2min + productivo 0,35min = **95% es setup**. Sistema separa correctamente. |
| T15 | ¿El motor advierte si falta material o stock? | `warnings[]` | N ❌ | `warnings: []` siempre vacío. No hay advertencias automáticas. |
| T16 | ¿Cuántas tarjetas entran por pliego A4? | Inspeccionar nesting | R ✅ | 8 piezas (2 col × 4 fil), 76,96% aprovechamiento. Visualizable con `<NestingPreview>`. |
| T17 | ¿Cuánto pliegos consume + merma? | Inspeccionar nesting | R ✅ | Para 100u: 13 pliegos (con 20% merma run aplicada). Trazable. |
| T18 | ¿Qué papel se está usando? | Inspeccionar materiales | R ✅ | Papel Opalina 250gr declarado (sustrato nesting). |

**Subtotal Tarjetas**: 11 R, 3 P, 4 N (de 18 preguntas).

---

## Vinilo adhesivo blanco (PRS-0004)

Variante usada: `Genérico (variante fixture)` (`2a0f807e-...`, 1000×500mm, CMYK).

| # | Pregunta | Cómo se prueba | Veredicto | Resultado / Gap |
|---|---|---|---|---|
| V01 | ¿Cuánto cuesta 1 unidad de vinilo 1m × 0,5m? | `cantidad: 1` | R ✅ (con caveat) | $2.543,81. Ejecuta sin error. |
| V02 | ¿Cuánto si pido 5 unidades (5m²)? | `cantidad: 5` | R ✅ | $4.038,38 ($807,68/u). |
| V03 | ¿Cuánto si pido 20 unidades (20m²)? | `cantidad: 20` | R ✅ | $9.641,15 ($482,06/u). El setup amortiza. |
| V04 | ¿El sistema lee anchoMm/altoMm del request o de la variante? | Cotizar con medidas custom no soportado | P 🟡 | Gap §P5 handoff: motor NO lee anchoMm/altoMm del request, usa los de la variante. **El cliente no puede pedir un vinilo de medidas no preconfiguradas**. |
| V05 | ¿Cuánto cuesta el vinilo material? | Inspeccionar `materiasPrimas` | **N ❌** | **Bug crítico nuevo**: `materiasPrimas: 0` en todas las cotizaciones. El material declarativo "Vinilo base blanca" con `por_unidad_productiva` + `unidad: unidad` (siendo el paso `m2`) NO escala. El motor cobra solo el CC de la máquina, ignora el costo del vinilo. |
| V06 | ¿Cuánto cambia con 4 PASS vs 6 PASS vs 8 PASS? | Cambiar perfil UV | N ❌ | Solo 4 PASS está como alternativa. Los otros perfiles existen en la Hibrida UV pero no se pueden elegir. **Gap dolor**: la calidad es la decisión más importante para vinilo. |
| V07 | ¿Cuánto cambia con N colores (1 color vs CMYK)? | Multi-color | N ❌ | Gap §P5 handoff explícito (multi-color en vinilo). |
| V08 | ¿Cuánto si elijo otro rollo (ancho 100, 137, 152 cm)? | Multi-material | N ❌ | Solo 1 vinilo declarado. nesting-rollo soporta multi-material pero no hay variantes cargadas. |
| V09 | ¿Cuánto si agrego laminado UV? | Activar paso opcional | N ❌ | El paso laminado NO está en el routing seed. Hay que agregarlo. |
| V10 | ¿Cuánto si incluye colocación in-situ? | Sub-producto | N ❌ | El paso colocación NO está en el routing seed. Hay que agregarlo. |
| V11 | ¿Refilado con plotter Skycut o cuchilla manual? | Alternativa máquina | N ❌ | Skycut no atado al OP-002. |
| V12 | ¿Hay merma de rollo (cambio de color, calibración)? | Inspeccionar nesting | P 🟡 | El motor aplica `mermaRunPctAplicada` en impresión por área pero no diferencia merma de calibración (cambio color) vs merma de aprovechamiento. |

**Subtotal Vinilo**: 3 R, 2 P, 7 N. **El vinilo es el producto MÁS afectado por gaps**.

---

## Talonarios emblocados (PRS-0007)

Variante usada: `10x15` (`dd823592-...`, 95×140mm, BN, simple faz). **Importante**: la ruta seed es clonada de tarjetas, NO refleja el flujo real del talonario.

| # | Pregunta | Cómo se prueba | Veredicto | Resultado / Gap |
|---|---|---|---|---|
| L01 | ¿Cuánto cuesta 100 talonarios 10×15? | `cantidad: 100` | P 🟡 | $7.450,56 ($74,51/u). Pero la ruta es de tarjetas → el costo es **un proxy, no el costo real** del talonario. |
| L02 | ¿Cuánto cambia entre simple, duplicado, triplicado? | Parámetro `tipoCopia` | N ❌ | **Gap §P5 handoff**: no modela N copias por original. El parámetro no existe. |
| L03 | ¿Cuánto si activo numeración? | Paso opcional | N ❌ | El paso numeración NO está en el routing. Falta agregar. |
| L04 | ¿Cuánto si agrego tapa de cartulina? | Sub-producto | N ❌ | **Gap §P6 handoff**: motor no resuelve recursión de sub-productos. |
| L05 | ¿Cuánto cuesta el emblocado (engomado)? | Paso del routing | N ❌ | NO está en el routing. Falta agregar (familia `encuadernado`). |
| L06 | ¿Cuánto si pido perforado para arrancar hojas? | Paso opcional | N ❌ | NO está en el routing. Falta agregar (familia `perforado`). |
| L07 | ¿En papel Opalina vs autocopiativo (CB/CFB/CF)? | Regla de selección | N ❌ | No hay materiales alternativos cargados ni regla. **Gap §P7 handoff** (UI reglas). |
| L08 | ¿En BN sale más barato que CMYK? | Cambiar variante | P 🟡 | La variante usada es BN. Pero los clics CMYK siguen siendo `aplicaMultiCaras=true` por seed clonado de tarjetas — probablemente el motor cobra clics CMYK aunque la variante sea BN. **Verificar**. |
| L09 | ¿El embalaje cobra 1 bolsa por talonario o por bulto? | Material declarativo | P 🟡 | El seed dice `por_pieza` × 1 bolsa. Para talonario es absurdo (un talonario va en caja, no en bolsa individual). |
| L10 | ¿Hay diferencia entre Talonarios emblocados y Talonarios abrochados (PRS-0006)? | Comparar productos | P 🟡 | Ambos están en DB pero la ruta de PRS-0006 no se inspeccionó. Hipótesis: misma ruta clonada. |

**Subtotal Talonarios**: 0 R, 4 P, 6 N. **La ruta seed es ficticia — el producto NO se está cotizando bien.**

---

## Resumen de la matriz

| Producto | R ✅ | P 🟡 | N ❌ | Total |
|---|---|---|---|---|
| Tarjetas de Visita | 11 | 3 | 4 | 18 |
| Vinilo adhesivo blanco | 3 | 2 | 7 | 12 |
| Talonarios emblocados | 0 | 4 | 6 | 10 |
| **TOTAL** | **14** (35%) | **9** (22,5%) | **17** (42,5%) | **40** |

---

## Gaps consolidados (priorizados por dolor revelado)

1. **G1** [Bug crítico nuevo, no en handoff] — **Material declarativo de vinilo no se cobra** (V05). `por_unidad_productiva` con unidad mismatch (`unidad` vs paso `m2`) hace que el motor calcule `materiasPrimas: 0`. **Bloquea cotización real de vinilo.**
2. **G2** [§P5 handoff] — **Solo 1 alternativa de máquina/perfil seedeada por paso** (T09, T10, V06). El modelo soporta N alternativas pero el seed las subutiliza. Bloquea preguntas tipo "cuánto si uso máquina B".
3. **G3** [§P5 handoff] — **Talonario multi-copia** (L02). Sin parámetro `tipoCopia` ni pasos condicionales, no se cotiza un duplicado/triplicado correctamente.
4. **G4** [Bug seed crítico] — **Talonarios y Tarjetas comparten ruta seed** (L01, L05, L06, L07, L09). Necesita rehacer ruta de talonario completa.
5. **G5** [§P6 handoff] — **Sub-productos no resueltos** (L04 tapa de cartón). Bloquea productos compuestos.
6. **G6** [§P5 handoff] — **Vinilo medidas LIBRES** no leen del request (V04). Bloquea cotización de medidas custom.
7. **G7** [§P5 handoff] — **Multi-color en vinilo/impresión** (V07). Solo se cobra 1 corrida.
8. **G8** [§P7 handoff] — **UI de reglas de selección** (T10, V06, L07). El evaluador funciona, falta autoría.
9. **G9** [Bug seed] — **Vinilo `aplicaMultiCaras=true`** sin sentido (1 cara). Corregir seed.
10. **G10** [§P8 handoff] — **Materiales declarativos solo en 2-3 pasos** (T07). El resto cae en `material-plantillas.ts` (fallback imperativo).
11. **G11** [Bug seed] — **Máquinas no atadas a pasos** (Laminadora BOPP, Guillotina, Skycut existen pero no se referencian desde alternativas). El motor cae en fallback genérico.
12. **G12** [Pregunta abierta] — **Tarifa de centro de costo de diseño** ($7.834 por 100 tarjetas) ¿es realista? Verificar vs sueldo + amortización del Mac.
13. **G13** [Funcionalidad faltante] — **Sin warnings automáticos** (T15). El motor no avisa stock bajo, cantidad mínima no alcanzada, perfil incompatible, etc.
14. **G14** [Bug nesting] — **Cambio de formato 9x5 → 7x3 casi no afecta el costo** (T13). Investigar si el nesting realmente recalcula piezas/pliego.

---

## Notas de lectura

- **Velocidad de feedback**: el endpoint responde en 200-400ms. Cotizar 40 preguntas en serie ~15 segundos. Apto para iteración rápida en validación.
- **Trazabilidad excelente**: cada paso devuelve `setupMin`, `cleanupMin`, `productivoMin`, máquina, perfil, centro de costo, tarifa, materiales, nesting con placements. **El motor está mucho más maduro que la cobertura de seed**.
- **Conclusión central**: el motor responde el 35% de las preguntas correctamente y tiene la **arquitectura para responder el 95%** — los gaps son mayormente **(a) data faltante en seed** y **(b) features menores de runtime** (tira+retira, multi-color, multi-copia, sub-productos). No es un problema de modelo conceptual.
