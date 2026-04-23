# Event Storming · Talonarios emblocados (PRS-0007)

> **Producto**: Talonarios emblocados · **ID**: `ef0f03ee-775a-4c9d-bdc6-c4452771094e` · **Motor (legacy tag)**: `talonario` · **Modo medidas**: `ESTANDAR` · **Familia**: Imprenta digital
>
> **Ruta seed**: ⚠ **clonada literalmente de Tarjetas de Visita** (mismas 6 operaciones, mismos tiempos, mismas máquinas). El seed NO refleja el flujo real de un talonario.
>
> **Fecha del ejercicio**: 2026-04-23

---

## §0 Inventario técnico (extraído de DB)

### Pasos del routing — IDÉNTICOS a Tarjetas de Visita

| Orden | Código | Nombre | Tipo (legacy) | Familia V2 | Unidad V2 | Activación V2 | Setup | Cleanup | Tiempo fijo |
|---|---|---|---|---|---|---|---|---|---|
| 1 | OP-001 | Diseño Grafico | PREPRENSA | `diseno_grafico` | unidad | `null` (esOpcional=t) ¹ | — | — | 30 min |
| 2 | OP-002 | Impresion Laser: Color | IMPRESION | `impresion_por_hoja` | pliegos | OBLIGATORIO | 5 min | 2 min | — |
| 3 | OP-003 | Laminado BOPP | TERMINACION | `laminado` | m2 | `null` (esOpcional=t) ¹ | — | — | — |
| 4 | OP-004 | Pre-prensa | PREPRENSA | `pre_prensa` | unidad | OBLIGATORIO | 0 | 0 | 10 min |
| 5 | OP-005 | Guillotinado | TERMINACION | `corte` | pliego | OBLIGATORIO | 3 min | 0 | 0 |
| 6 | OP-006 | Embalaje | EMPAQUE | `operacion_manual` | unidad | OBLIGATORIO | 1 min | 0 | 0 |

¹ `activacionV2 = NULL` con `esOpcional = true` funciona como OPCIONAL vía fallback v1 del SuperMotor (línea 187). Verificado.

### Alternativas y materiales

- Misma única alternativa de impresión (Ricoh PRO C5100 - A4 - Papel Grueso - Simple faz).
- Mismos 3 materiales declarados (Papel Opalina 250gr, Clics CMYK, Bolsa celofán).

### El problema central

**Un talonario NO se produce como una tarjeta.** Lo que falta en el seed:

1. **Multi-copia** (carbónico). Un talonario emblocado típicamente es **simple, duplicado o triplicado** (1, 2 o 3 hojas por juego). Esto multiplica el papel y los clics. El gap está reconocido en handoff §P5 ("Talonario copias — No modela N copias por original").
2. **Numeración**. La mayoría de los talonarios llevan numeración correlativa. Es un paso adicional con costo (mano de obra, máquina de numerar). Familia disponible: `acabado_decorativo` o nueva familia "numeracion".
3. **Engomado / Encolado de blocks**. El "emblocado" (de ahí el nombre del producto) es la operación de pegar las hojas por un lado para formar el block. NO está como paso. Familia disponible: `encuadernado` (modoNesting=none).
4. **Tapa y contratapa** (cartón rígido). Sub-producto componente. Hoy no soportado (gap §P6 handoff: sub-productos pendiente).
5. **Perforado** (para arrancar hojas del block). Familia disponible: `perforado` (modoNesting=none).
6. **Embolsado** real (un talonario no va en bolsa de celofán por unidad como una tarjeta — va en cajas o bolsas por N talonarios).

---

## §1 Flujo real en Corporearte (lenguaje natural) [INPUT NEGOCIO]

**Contexto típico**:
- ¿Cuántos juegos por pedido (50, 100, 200, 500)?
- ¿Talonario simple, duplicado o triplicado más común?
- ¿Numerado siempre o a veces?
- ¿Tapa de cartulina, cartón, sin tapa?

**Escena 1 — Recepción del pedido**:
- [INPUT NEGOCIO] Cliente típico (comerciales: facturero, recibos, remitos; gastronómicos: comanda; vouchers).
- [INPUT NEGOCIO] ¿Pedido de marca propia o reposición?

**Escena 2 — Pre-prensa**:
- [INPUT NEGOCIO] Imposición especial: en un talonario duplicado, las 2 hojas (original + copia) van impresas distinto (la original puede ir en color, la copia carbónica en blanco con texto azul preimpreso). ¿Cómo se maneja la imposición?

**Escena 3 — Impresión**:
- [INPUT NEGOCIO] ¿Se imprime cada cara/hoja por separado (multi-pasada)? ¿O se hace en duplicado real con papel autocopiativo?
- **Caso autocopiativo**: papel especial (CB, CFB, CF) — no es Opalina. La elección de papel depende del tipo de talonario.
- **Caso copia carbónica**: hoja blanca + hoja verde/amarilla impresa en color claro. Cambia material y a veces máquina (Ricoh maneja papeles raros?).

**Escena 4 — Numeración**:
- [INPUT NEGOCIO] ¿Hay máquina dedicada de numerar? ¿Manual con sello o automatizada? Tiempo por juego, costo del operario.

**Escena 5 — Compaginado**:
- [INPUT NEGOCIO] Después de imprimir, las hojas (original + copia 1 + copia 2) tienen que ir en el orden correcto. ¿Es manual o hay máquina?

**Escena 6 — Engomado / Emblocado**:
- [INPUT NEGOCIO] ¿Cómo es el proceso? ¿Se aplica goma a un lado, se prensa, se seca? ¿Cuánto tarda? ¿Hay máquina o manual? ¿Cuántos blocks salen por hora?
- Familia V2 sugerida: `encuadernado` con `modoNesting=none`. **Falta agregar.**

**Escena 7 — Tapa (opcional)**:
- [INPUT NEGOCIO] ¿La tapa es cartulina impresa? ¿Se imprime en la misma Ricoh con otro papel? ¿Es sub-producto (tapa) que se compone al producto final (talonario)?
- **Caso paradigmático para sub-productos** (gap §P6 handoff).

**Escena 8 — Perforado**:
- [INPUT NEGOCIO] ¿Es estándar (todos los talonarios llevan perforado para arrancar)? ¿O es opcional?

**Escena 9 — Embalaje**:
- [INPUT NEGOCIO] ¿Cómo van? ¿Caja de N talonarios? ¿Atados? El seed dice "1 bolsa por pieza" — incorrecto para talonario.

---

## §2 Mapeo a familias V2

Lista completa de pasos PROPUESTOS (mucho más larga que el seed actual):

| Paso real | Familia V2 sugerida | Modo nesting | Comentario |
|---|---|---|---|
| Diseño gráfico | `diseno_grafico` | none | Opcional, igual que tarjetas. |
| Pre-prensa (imposición duplicado/triplicado) | `pre_prensa` | none | Pero con lógica de N hojas. ¿Necesita parámetro `tipoCopia`? |
| Impresión hoja original | `impresion_por_hoja` | produce | OBLIGATORIO |
| Impresión hoja copia 1 (duplicado/triplicado) | `impresion_por_hoja` | produce | CONDICIONAL (`tipoCopia >= DUPLICADO`) |
| Impresión hoja copia 2 (triplicado) | `impresion_por_hoja` | produce | CONDICIONAL (`tipoCopia == TRIPLICADO`) |
| Numeración | ⚠ falta familia "numeracion" | none | O usar `acabado_decorativo`. **Debate**: ¿se agrega familia 24 o se reusa una existente? |
| Compaginado | `operacion_manual` | none | Operación humana. |
| Emblocado (engomado) | `encuadernado` | none | OK |
| Perforado | `perforado` | none | OK opcional |
| Tapa (sub-producto) | sub-producto componente | — | Gap §P6: motor no resuelve recursión. |
| Embalaje | `operacion_manual` | none | OK |

**Veredicto §2**: el catálogo de 23 familias cubre **casi todo** lo que necesita talonario. Faltaría una familia `numeracion` específica (o aceptar reusar `acabado_decorativo`). El verdadero gap es **el seed de la ruta**: hay que rehacerla completa para reflejar el flujo real.

---

## §3 Decisiones de runtime

| Decisión | ¿Hoy es regla? | Cómo se modela hoy | Cómo debería modelarse |
|---|---|---|---|
| ¿Tipo de copia (simple/duplicado/triplicado)? | Input al cotizar | NO MODELADO | Parámetro del trabajo + `condicionActivacionV2` en pasos de impresión copia 1/2. **Requiere cerrar P4-debt #1 (CONDICIONAL real)**. |
| ¿Activar numeración? | Juicio | NO MODELADO | Paso opcional. |
| ¿Activar tapa? | Juicio | NO MODELADO | Sub-producto opcional (P6). |
| ¿Qué papel (Opalina vs autocopiativo CB/CFB/CF)? | Regla `tipoCopia → papel` | NO MODELADO | `ReglaDeSeleccion` dominio MATERIAL. **Requiere P7 (UI reglas)**. |
| ¿Qué máquina (Ricoh vs Hibrida UV vs offset)? | Regla por tirada | NO MODELADO | Idem tarjetas. |

---

## §4 Variantes radicales del flujo [INPUT NEGOCIO]

**Candidatos a evaluar**:

1. **Talonario emblocado (este producto) vs Talonario abrochado (PRS-0006)**
   - Ambos están como productos separados. ¿Qué cambia entre los dos?
   - Hipótesis: emblocado = engomado por un lado / abrochado = grapa metálica. Cambian 1 paso (engomado → grapado) y posiblemente máquinas.
   - **Caso candidato a routing alternativo dentro de "Talonario"** (cambian solo 1-2 pasos, no la ruta completa). O bien, mantener como 2 productos separados (status quo, válido también).
   - [INPUT NEGOCIO] Decisión editorial.

2. **Talonario simple vs duplicado vs triplicado**
   - Cambia el papel + se agregan N pasos de impresión. NO cambia el flujo, solo activa pasos condicionales.
   - **Caso clarísimo de pasos condicionales** (`activacionV2 = CONDICIONAL` + `condicionActivacionV2 = JsonLogic{tipoCopia >= 2}`). NO requiere routing alternativo.
   - **Bloqueante**: P4-debt #1 (CONDICIONAL no evalúa hoy).

3. **Talonario numerado vs sin numerar**
   - Caso de **paso opcional**. NO requiere routing alternativo.

4. **Talonario con tapa vs sin tapa**
   - Caso de **sub-producto opcional**. Requiere P6 (sub-productos).

5. **Talonario A4 vs A5 vs medio oficio vs medidas custom**
   - Solo cambia el formato. NO cambia el flujo. Caso de **variantes** del producto, no de routing.

6. **Talonario en papel autocopiativo vs talonario con carbónico real entremedio**
   - Cambia material + posiblemente paso adicional (intercalar carbónico). Caso de **alternativa de material + paso condicional**.

7. **Talonario "express" / "industrial"**
   - ¿Hay diferenciación? Tiradas grandes podrían ir a offset (ruta sustancialmente distinta) → **routing alternativo**.

**Pregunta clave para routings alternativos**: con todos los casos arriba modelados como pasos opcionales/condicionales + alternativas de material/máquina, **¿alcanza** el modelo actual (1 producto = 1 ruta) o sigue habiendo casos donde el flujo divergie tanto que conviene 2 routings? La respuesta será evidente al completar §1 y §4 con el negocio.

---

## §5 Gaps detectados (sin input adicional)

1. **Ruta seed clonada de Tarjetas**: incorrecta. Faltan al menos 4 pasos (numeración, compaginado, emblocado, perforado opcional) y sobran algunos (laminado BOPP no aplica típicamente a talonario).
2. **No modela multi-copia**: gap §P5 explícito en handoff. Necesita parámetro `tipoCopia` + pasos condicionales.
3. **No modela tapa como sub-producto**: gap §P6 explícito.
4. **No hay regla de selección de papel** según tipo de talonario.
5. **Misma alternativa de máquina** que tarjetas (Ricoh con perfil Papel Grueso Simple) — papel autocopiativo necesita perfil distinto o máquina distinta.
6. **¿Falta familia "numeracion"?** Debate: agregar familia 24 vs reusar `acabado_decorativo`. Decisión editorial.
7. **Embalaje incorrecto**: 1 bolsa por pieza no aplica.

---

## §6 Próximos pasos

1. Completar §1 con el negocio (sesión imprescindible — el seed actual NO refleja la realidad).
2. Decidir sobre §4 si Talonario abrochado y Talonario emblocado son 1 producto con 2 routings o 2 productos separados.
3. **Talonario es el producto que más gaps revela**: requiere CONDICIONAL real (P4-debt), sub-productos (P6), reglas UI (P7), data migration (P8). Es el caso de prueba más completo del modelo.
4. Las preguntas de §4 alimentan `routings-alternativos-analisis.md` con casos de divergencia 1-2 pasos (caso A → no hace falta routing alternativo) y posibles casos de divergencia mayor (talonario express offset).
