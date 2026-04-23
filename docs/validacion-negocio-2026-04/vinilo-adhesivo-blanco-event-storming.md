# Event Storming · Vinilo adhesivo blanco (PRS-0004)

> **Producto**: Vinilo adhesivo blanco · **ID**: `668f59e6-c62e-47ed-9624-80469defdc15` · **Motor (legacy tag)**: `gran_formato` · **Modo medidas**: `LIBRE` ⚠ · **Familia**: Impresion en Gran Formato
>
> **Ruta seed**: 2 pasos (gran formato seed minimalista)
>
> **Fecha del ejercicio**: 2026-04-23

---

## §0 Inventario técnico (extraído de DB)

### Pasos del routing

| Orden | Código | Nombre | Tipo (legacy) | Familia V2 | Unidad V2 | Activación V2 | Setup | Cleanup | Tiempo fijo |
|---|---|---|---|---|---|---|---|---|---|
| 1 | OP-001 | Impresion Gran Formato: UV | IMPRESION | `impresion_por_area` | m2 | OBLIGATORIO | 10 min | — | — |
| 2 | OP-002 | Refilado de vinillos/lonas | TERMINACION | `corte` | pliego | `null` ¹ | 5 min | — | — |

¹ Pero con `esOpcional = false` en DB. ⚠ **Refilado de vinilo está marcado como OBLIGATORIO implícito**. ¿Es siempre obligatorio en realidad? Probablemente sí (todo vinilo se refila). Validar con negocio.

### Alternativas por paso

| Paso | Alternativas | Default | Máquina | Perfil |
|---|---|---|---|---|
| OP-001 | **1** | "4 Pasadas" | Hibrida UV | 4 PASS (27 m²/h) |
| OP-002 | 0 | — | — | — |

**Hallazgo**: solo 4 PASS está seedeada como alternativa. La Hibrida UV tiene también **6 PASS (18 m²/h) y 8 PASS (13 m²/h)** disponibles — no se pueden elegir al cotizar. La decisión de calidad (4/6/8 pasadas según tipo trabajo) es exactamente el caso del experto: "perfiles de impresión con consumos distintos" → **debería estar como 3 alternativas con regla de selección por tipo de trabajo / calidad pedida**.

### Materiales declarativos

| Paso | Material | Fórmula | Cant | Unidad | Sustrato? | Multi-cara? |
|---|---|---|---|---|---|---|
| OP-001 | Vinilo base blanca | `por_unidad_productiva` | 1 | unidad | ✅ | ✅ |

**Hallazgo crítico**: el material está como `por_unidad_productiva` con `unidad = unidad`, pero la unidad productiva del paso es `m2`. Eso es ambiguo. Probablemente debería ser `1 m2 de vinilo por m2 impreso` (con merma adicional). **Verificar.**

Además, `aplicaMultiCaras = true` para vinilo no tiene sentido (vinilo es 1 cara). Otra señal de seed copiado sin pensar.

### Máquinas disponibles

- **Hibrida UV** — 3 perfiles (4/6/8 PASS). **Atado a OP-001 perfil 4 PASS.**
- **Skycut** (PLOTTER_DE_CORTE) — 2 perfiles (Corte simple / Medio corte, 36.99 M2_H). **No atado a OP-002 — usar como alternativa de Refilado (gap).**
- **Guillotina** — corte de papel, no aplica a vinilo.

---

## §1 Flujo real en Corporearte (lenguaje natural) [INPUT NEGOCIO]

**Contexto típico**:
- ¿Cliente típico? ¿Qué metros cuadrados se piden por pedido (1, 5, 20, 50)?
- ¿Cliente trae diseño? ¿Hay ajuste de medida / armado?
- ¿Qué porcentaje es vinilo blanco vs transparente vs translúcido vs polimérico?

**Escena 1 — Recepción del pedido (modo medidas LIBRE)**:
- El producto está en `modoMedidas=LIBRE`. El cliente trae las medidas (anchoMm × altoMm). 
- [INPUT NEGOCIO] ¿La cotización pide ancho/alto al cliente y calcula directo? ¿O hay un paso de ajuste por aprovechamiento del rollo?
- Gap conocido §P5 handoff: "Vinyl medidas libres — Super motor no lee `anchoMm/altoMm` de parámetros del trabajo cuando producto es `modoMedidas=LIBRE`". **Esto es bloqueante para cotizar este producto correctamente.**

**Escena 2 — Pre-prensa / preparación del archivo**:
- [INPUT NEGOCIO] ¿Existe? El seed no tiene paso de pre-prensa. ¿Es porque el cliente trae el archivo listo?

**Escena 3 — Impresión Gran Formato UV**:
- [INPUT NEGOCIO] La elección entre 4/6/8 PASS depende de qué (calidad, opacidad, tipo trabajo)? ¿Es decisión del operador o del comercial al cotizar?
- [INPUT NEGOCIO] ¿Multi-color cambia el tiempo? ¿La merma es fija (5%) o variable según trabajo? Gap conocido §P5: "Multi-color en vinilo de corte — V2 específico iteraba por color, super motor no".

**Escena 4 — Laminado opcional (NO está en seed)**:
- [INPUT NEGOCIO] ¿Hay laminado para vinilo? ¿BOPP / UV laminado / sin laminar?
- Si sí, **falta paso en el routing**. Familia: `laminado` ya existe.

**Escena 5 — Refilado (corte)**:
- [INPUT NEGOCIO] El paso es corte de tarea grande a piezas finales. ¿Es plotter (Skycut) o cuchilla manual? El seed no tiene máquina atada.
- [INPUT NEGOCIO] ¿Hay corte simple (rectangular) vs medio corte (kiss cut, para sticker)? Skycut tiene los 2 perfiles disponibles.

**Escena 6 — Aplicación / instalación (NO está en seed)**:
- [INPUT NEGOCIO] ¿Vinilo se vende solo el material o incluye colocación? Si incluye, falta familia `colocacion_in_situ` en la ruta.

---

## §2 Mapeo a familias V2

| Paso del flujo real | Familia V2 actual | ¿Encaja? | Comentario |
|---|---|---|---|
| Pre-prensa (¿existe?) | `pre_prensa` | A definir | Si el cliente trae arte listo, no aplica. |
| Impresión UV | `impresion_por_area` | ✅ | Correcto. `modoNesting=produce`. |
| Laminado (no en seed) | `laminado` | ✅ | Disponible si negocio lo confirma. |
| Refilado | `corte` | ⚠ | Familia OK pero `unidadProductivaV2 = pliego` es raro para vinilo (que es rollo). Probablemente debería ser `m2` o `metro_lineal`. |
| Aplicación in situ (no en seed) | `colocacion_in_situ` | ✅ | Disponible si negocio lo confirma. |

**Veredicto §2**: el catálogo de familias cubre los pasos. El gap está en **(a) faltan pasos en el routing seed (laminado, colocación)** y **(b) unidad productiva del refilado debería ser m2/metro_lineal, no pliego**.

---

## §3 Decisiones de runtime

| Decisión | ¿Hoy es regla? | Cómo se modela hoy | Cómo debería modelarse |
|---|---|---|---|
| ¿Qué perfil UV (4/6/8 PASS)? | NO | Solo 4 PASS seedeada | 3 alternativas + regla `tipoTrabajo / calidadPedida → PASS`. **Es exactamente el caso del experto: "perfiles de impresión con consumos distintos"**. |
| ¿Qué rollo de vinilo (ancho 100, 137, 152 cm)? | NO | Solo 1 material declarado | Multi-material declarativo + nesting-rollo elige rollo más eficiente. Gap: ¿hay otros rollos cargados como `MateriaPrimaVariante`? |
| ¿Activar Refilado? | Juicio | `activacionV2 = NULL` | OK con OPCIONAL. Mismo bug de seed. |
| ¿Activar Laminado? | NO MODELADO | — | Agregar paso opcional. |
| ¿Plotter Skycut o cuchilla manual? | NO | — | 2 alternativas + regla por cantidad / forma. |

---

## §4 Variantes radicales del flujo [INPUT NEGOCIO]

**Candidatos a evaluar**:

1. **Vinilo impreso (este producto) vs Vinilo de corte (PRS-0005)**
   - Ya están como productos separados. ¿Por qué? ¿La ruta es realmente distinta o se podría modelar como 1 solo producto con 2 routings?
   - Vinilo de corte NO se imprime, solo se plotea con vinilo de color sólido. Vinilo impreso sí se imprime + se refila.
   - **Hipótesis fuerte**: son 2 productos distintos porque la ruta cambia sustancialmente (la impresión completa se va o no). **Caso paradigmático de routing alternativo completo.** Pero en el modelo actual están como 2 productos separados — funciona. ¿Conviene unificar como "Vinilo" con 2 routings?
   - [INPUT NEGOCIO] ¿El comercial los trata como dos productos distintos al hablar con el cliente? Si sí, dejarlos separados. Si no, unificar.

2. **Vinilo blanco vs vinilo transparente / translúcido / electrocut**
   - Cambia el material pero no la ruta. Caso de **alternativas de material**, no de routing.
   - [INPUT NEGOCIO] ¿Cuántas variantes de vinilo manejan? ¿Son productos separados en el catálogo?

3. **Vinilo con laminado vs sin laminado**
   - Caso de **paso opcional**, no routing alternativo.

4. **Vinilo con instalación vs solo material**
   - El cambio es agregar 1 paso final (`colocacion_in_situ`). Caso de **paso opcional o sub-producto**.
   - [INPUT NEGOCIO] ¿Se cobra por separado el viaje? ¿Por m² instalado? ¿Por hora?

5. **Vinilo cortado a forma libre (figura) vs rectangular**
   - Cambia el algoritmo de corte (Skycut con plotter vs cuchilla simple) y el aprovechamiento del rollo.
   - **Caso candidato a routing alternativo si el flujo cambia sustancialmente** (forma libre podría requerir paso adicional de plotter + descarte manual; rectangular es solo refilado).

---

## §5 Gaps detectados (sin input adicional)

1. **Bug bloqueante de medidas LIBRES** (gap §P5 handoff). Para cotizar este producto, el motor no lee anchoMm/altoMm del trabajo. Debe arreglarse antes de validar cotizaciones reales.
2. **Ruta seed minimalista (2 pasos)**. Falta probablemente: pre-prensa (si aplica), laminado opcional, embalaje, colocación opcional.
3. **`aplicaMultiCaras = true` en vinilo**: no aplica a vinilo (1 cara). Bug de seed.
4. **Material declarado con unidad ambigua** (`por_unidad_productiva` + unidad `unidad` para un paso `m2`). Verificar conversión.
5. **Solo 1 alternativa de pasada UV** (4 PASS). Subutilización fuerte. La calidad (4/6/8 PASS) es la decisión más importante del operador y no está modelada como elegible.
6. **Skycut no atado a refilado**. El plotter de corte existe pero el OP-002 no lo apunta.
7. **`unidadProductivaV2 = pliego`** para refilado de vinilo. Raro: vinilo va por m² o metro lineal.
8. **Multi-color** (gap §P5): si el trabajo tiene N colores, el motor no separa el costo por color. ¿Aplica a impresión UV o solo a vinilo de corte? Confirmar.

---

## §6 Próximos pasos

1. Completar §1 y §4 con el usuario.
2. **Antes** de ejecutar el endpoint de cotización: chequear si el motor maneja productos `LIBRE` o si el bug §P5 lo bloquea.
3. Si bloquea, anotar como **dependencia técnica** para el plan de síntesis (no se puede validar este producto hasta cerrar §P5 vinilo medidas libres).
