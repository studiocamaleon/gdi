# Event Storming · Tarjetas de Visita (PRS-0001)

> **Producto**: Tarjetas de Visita · **ID**: `44e4133f-d097-472b-9d20-7bb6084a57b6` · **Motor (legacy tag)**: `impresion_digital_laser` · **Modo medidas**: `ESTANDAR` · **Familia**: Imprenta digital
>
> **Ruta seed**: `0e0f3a51-5508-4fa5-a700-d29d4e18dd63` "Impresión Digital Laser (Estandar)" — 6 pasos
>
> **Fecha del ejercicio**: 2026-04-23

---

## §0 Inventario técnico (extraído de DB)

### Pasos del routing

| Orden | Código | Nombre | Tipo (legacy) | Familia V2 | Unidad V2 | Activación V2 | Setup | Cleanup | Tiempo fijo |
|---|---|---|---|---|---|---|---|---|---|
| 1 | OP-001 | Diseño Grafico | PREPRENSA | `diseno_grafico` | unidad | `null` ¹ | — | — | 30 min |
| 2 | OP-002 | Impresion Laser: Color | IMPRESION | `impresion_por_hoja` | pliegos | OBLIGATORIO | 5 min | 2 min | — |
| 3 | OP-003 | Laminado BOPP | TERMINACION | `laminado` | m2 | `null` ¹ | — | — | — |
| 4 | OP-004 | Pre-prensa | PREPRENSA | `pre_prensa` | unidad | OBLIGATORIO | 0 | 0 | 10 min |
| 5 | OP-005 | Guillotinado | TERMINACION | `corte` | pliego | OBLIGATORIO | 3 min | 0 | 0 |
| 6 | OP-006 | Embalaje | EMPAQUE | `operacion_manual` | unidad | OBLIGATORIO | 1 min | 0 | 0 |

¹ **Verificado**: `activacionV2 = NULL` es **backward compat correcto**. El SuperMotor (línea 187 de `super-motor.ts`) lee el campo legacy `esOpcional` (boolean v1) como fallback cuando `activacionV2` está null. Confirmado en DB: Diseño y Laminado tienen `esOpcional = true`. NO es bug.

### Alternativas por paso

| Paso | Alternativas seedeadas | Default | Máquina | Perfil |
|---|---|---|---|---|
| OP-001 | 0 | — | — | — |
| OP-002 | **1** | "Ricoh · Papel Grueso Simple" | Ricoh PRO C5100 | A4 - Papel Grueso - Simple faz (40 PPM) |
| OP-003 | 0 | — | — | — |
| OP-004 | 0 | — | — | — |
| OP-005 | 0 | — | — | — |
| OP-006 | 0 | — | — | — |

**Hallazgo crítico**: la única alternativa modelada es la impresión, y solo apunta a 1 perfil específico. La Ricoh tiene 4 perfiles operativos disponibles en DB (Papel Grueso/obra × Simple/Doble faz, productividades 20/30/40/60 PPM) que NO están como alternativas seleccionables al cotizar. Tampoco hay alternativa "Hibrida UV" para tarjetas en formato grande. **El usuario hoy no puede preguntar "cuánto cuesta si voy a doble faz" sin editar el producto.**

### Materiales declarativos

| Paso | Material | Fórmula | Cant | Unidad | Sustrato? | Multi-cara? |
|---|---|---|---|---|---|---|
| OP-002 | Papel Opalina 250gr | `por_unidad_productiva` | 1 | pliego | ✅ | — |
| OP-002 | Clics CMYK | `por_unidad_productiva` | 1 | clic | — | ✅ |
| OP-006 | Bolsa celofán | `por_pieza` | 1 | bolsa | — | — |

Otros pasos (Diseño, Laminado, Pre-prensa, Guillotinado) **no tienen material declarado** — usan fallback de `material-plantillas.ts` o no consumen.

### Máquinas disponibles para esta ruta (no atadas todas)

- **Ricoh PRO C5100** (IMPRESORA_LASER) — 4 perfiles. Centro: Impresion Laser.
- **Hibrida UV** (IMPRESORA_UV_MESA_EXTENSORA) — 3 perfiles (4/6/8 PASS, M2_H). Centro: Impresion Laser. **No usada en seed de tarjetas, pero podría serlo en gran cantidad / formato grande.**
- **Laminadora BOPP** — 2 perfiles. Centro: Post-prensa. **No atada al OP-003 (Laminado BOPP) en seed**.
- **Guillotina** — 4 perfiles por gramaje. Centro: Post-prensa. **No atada al OP-005 (Guillotinado) en seed**.

---

## §1 Flujo real en Corporearte (lenguaje natural) [INPUT NEGOCIO]

> Esta sección se completa en sesión con el usuario. Sirve para narrar el "journey" real del producto desde que entra el pedido hasta que sale la tarjeta empaquetada. Incluye decisiones humanas, máquinas concretas y comparación con la ruta seed.

**Contexto típico de un pedido**:
- ¿Cliente típico? ¿Tirada típica (50, 100, 500, 1000)?
- ¿El cliente trae arte listo, o pide diseño? ¿Frecuencia?
- ¿Qué papel pide habitualmente (Opalina, ilustración, reciclado)?
- ¿Una cara o tira+retira?

**Escena 1 — Recepción del pedido**:
- [INPUT NEGOCIO] ¿Quién toma el pedido? ¿Pasa por presupuesto antes? ¿Hay una cotización formal o se pasa directo a producción?

**Escena 2 — Preparación del archivo / pre-prensa**:
- [INPUT NEGOCIO] ¿Quién hace el armado? ¿Qué tarda en serio? El seed dice 10 min — ¿es fiel?
- [INPUT NEGOCIO] ¿Hay imposición manual o automática? ¿Cuántas tarjetas entran por pliego A4 / A3?

**Escena 3 — Impresión**:
- [INPUT NEGOCIO] ¿Siempre la Ricoh? ¿Cuándo se va a otra máquina (Hibrida UV)?
- [INPUT NEGOCIO] ¿Qué decide el operador entre 4 perfiles del Ricoh (Papel Grueso/obra × Simple/Doble faz)?
- [INPUT NEGOCIO] ¿Multi-cara cuánto suma realmente al tiempo? El motor lo calcula como 2 corridas (gap conocido §3 del handoff: "tira+retira").

**Escena 4 — Laminado opcional**:
- [INPUT NEGOCIO] ¿Qué porcentaje de tarjetas se laminan? ¿BOPP brillo / mate? ¿Costo orientativo?

**Escena 5 — Guillotinado**:
- [INPUT NEGOCIO] ¿Tarjeta cortada de un pliego ya impreso? ¿El gramaje del papel afecta la velocidad real?
- [INPUT NEGOCIO] El seed dice productividad 2 (¿pliegos/min? ¿hora?). Verificar.

**Escena 6 — Embalaje**:
- [INPUT NEGOCIO] ¿Bolsa celofán por tirada o por unidad-cliente (caja con N tarjetas)? El material declarativo dice "1 bolsa por pieza". ¿Pieza = tarjeta o = cliente final?

---

## §2 Mapeo a familias V2

| Paso del flujo real | Familia V2 actual | ¿Encaja? | Comentario |
|---|---|---|---|
| Diseño gráfico | `diseno_grafico` | ✅ | Familia "servicios", `modoNesting=none`. Correcto. |
| Pre-prensa / armado de pliego | `pre_prensa` | ✅ | Familia "servicios", `modoNesting=none`. Correcto. ¿Debería ir antes de impresión? Hoy va después en el seed (orden 4) — **revisar orden lógico vs seed**. |
| Impresión laser | `impresion_por_hoja` | ✅ | Familia "produccion", `modoNesting=produce`. Correcto. |
| Laminado BOPP | `laminado` | ✅ | Familia "terminaciones", `modoNesting=consume` (hereda layout del nesting). Correcto. |
| Guillotinado | `corte` | ✅ | Familia "corte_y_formado", `modoNesting=consume`. Correcto. |
| Embalaje | `operacion_manual` | ✅ | Familia "operaciones_manuales", `modoNesting=none`. Correcto. |

**Veredicto §2**: el mapeo a familias está OK. El gap no está en el catálogo de 23 familias, sino en **(a) atado de máquinas a alternativas** (la Ricoh 4 perfiles deberían ser 4 alternativas seleccionables) y **(b) orden de pasos** (pre-prensa después de impresión es contraintuitivo).

---

## §3 Decisiones de runtime

| Decisión | ¿Hoy es regla automática? | ¿O juicio humano? | Cómo se modela hoy | Cómo debería modelarse |
|---|---|---|---|---|
| ¿Activar Diseño Gráfico? | Juicio (¿el cliente tiene arte?) | Humano | Paso opcional con `esOpcional=true` (v1) + UI checkbox al cotizar | OK funcional. Migrar a `activacionV2=OPCIONAL` cuando se complete data migration P8. |
| ¿Activar Laminado BOPP? | Juicio (preferencia cliente) | Humano | Idem | Idem |
| ¿Qué perfil de Ricoh usar? | Regla (papel + faz) | Pero hoy NO está como regla | Hardcodeado en el único alternativa seedeada | **Debería**: 4 alternativas con `ReglaDeSeleccion` que matcheé `papelGramaje + caras → perfil` (gap §P7 del handoff: UI de reglas falta). |
| ¿Qué máquina (Ricoh vs Hibrida UV)? | Regla por tirada/formato | Hoy NO está modelado | Solo Ricoh seedeada | **Debería**: 2 alternativas máquina + regla `cantidad > X OR formatoMm > Y → Hibrida UV`. |
| ¿Cuántas tarjetas por pliego? | Cálculo automático (nesting hoja) | Automático | `nesting-hoja.ts` ejecuta imposición | OK |
| ¿Bolsa por pieza o por bulto? | Convención fija | Convención | Material declarativo dice 1 por pieza | **Verificar con negocio** (§1 escena 6). |

---

## §4 Variantes radicales del flujo [INPUT NEGOCIO]

> Esta es la sección clave para el análisis de **routings alternativos completos** (gap dolor del usuario).

**Pregunta marco**: ¿hay variantes de "tarjeta de visita" donde la ruta cambia tanto que conviene modelarla como un routing distinto, en vez de alternativas dentro del mismo routing?

Candidatos a evaluar:

1. **Tarjeta digital láser (chica tirada) vs Tarjeta offset digital (gran tirada)**
   - ¿Corporearte tiene offset? Si sí, ¿la ruta es radicalmente distinta (planchas, calibración, lavado de máquina)?
   - [INPUT NEGOCIO] ¿Aparece este caso? ¿Con qué frecuencia?
   - **Si aparece**: routing alternativo completo (los pasos cambian sustancialmente). Si no aparece, no es un caso real.

2. **Tarjeta estándar (papel) vs Tarjeta especial (PVC, plástico, transparente)**
   - El seed asume papel. Si hay PVC, las máquinas cambian (Ricoh no, va Hibrida UV o tercerizado).
   - [INPUT NEGOCIO] ¿Es un producto separado en el catálogo o se cotiza como "tarjeta" eligiendo material?

3. **Tarjeta con relieve / hot stamping / troquelado**
   - Familias V2 disponibles: `acabado_decorativo` (consume), `troquelado` (consume). Hoy NO en la ruta seed.
   - [INPUT NEGOCIO] ¿Es un add-on (paso opcional) o un producto distinto (otra ruta)?

4. **Tarjeta numerada (vouchers, fidelización)**
   - Numeración requiere paso adicional (familia: ¿`acabado_decorativo`? falta familia "numeracion").
   - [INPUT NEGOCIO] ¿Aparece este caso? ¿Es parte de "tarjetas" o es producto separado?

5. **Tarjeta express / urgente**
   - Misma ruta pero con setup minimizado, prioridad. ¿Cambia el costo o es comercial?

**Output esperado de §4**: una tabla con cuántos casos requieren routing alternativo completo (B) vs cuántos resuelven con paso opcional + alternativa de máquina (A). Esto alimenta directamente el doc `routings-alternativos-analisis.md` (Paso 4 del plan).

---

## §5 Gaps detectados (sin input adicional)

1. **Solo 1 alternativa de máquina seedeada por paso** (OP-002). Subutilización del modelo de alternativas. La Ricoh tiene 4 perfiles, ninguno es seleccionable al cotizar.
3. **Máquinas no atadas a pasos**: Laminadora BOPP existe pero el OP-003 no la apunta. Idem Guillotina vs OP-005. El motor probablemente cae en fallback genérico.
4. **Orden lógico**: Pre-prensa (orden 4) está después de Impresión (orden 2). Probablemente bug de seed (debería ir antes).
5. **Materiales solo en 2 pasos** (OP-002, OP-006). El resto cae en `material-plantillas.ts` (gap §P8 del handoff: data migration masiva).
6. **No hay regla de selección de perfil** entre los 4 disponibles del Ricoh. El usuario debe elegir manualmente el alternativa o aceptar la default.

---

## §6 Próximos pasos

1. Completar §1 y §4 con el usuario (sesión de 30-45 min).
2. Ejecutar `POST /productos-servicios/variantes/:varianteId/cotizar-v2` con tirada típica (100, 500, 1000) y comparar contra el smoke test del handoff (~$8.500 con 4 pasos activos).
3. Las preguntas que surjan de §4 alimentan el doc `specifications-by-example.md`.
4. Los gaps de §5 alimentan `sintesis-y-prioridad.md`.
