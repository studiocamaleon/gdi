# El CONSUMO de materiales de un paso — análisis, taxonomía y plan

> **Estado**: ANÁLISIS CERRADO con el usuario (2026-08-11) + plan técnico
> listo para ejecutar en otra sesión. Nada implementado todavía. Método:
> cascada verificada línea por línea en `motor.service.ts`
> (ejecución de slots L4000-4110, `cantidadSlotDerivada` L5760+,
> `resolverCantidadSlotPorBase` L5823+) + config real de 6 productos del
> tenant demo. Doc hermano (mismo lente, mismo formato):
> [tiempo-pasos-analisis-y-plan.md](tiempo-pasos-analisis-y-plan.md).

## 1. El marco

```
costo del paso = costo de tiempo + COSTO DE MATERIALES + cargos opcionales
costo de materiales = Σ por slot: cantidad CONSUMIDA → unidades COBRADAS × precio
```

Cada slot responde dos preguntas independientes: **cuánto se consume** y
**cómo se cobra lo consumido** (exacto / unidades enteras / segmentos).
Además hay TRES números por slot que hoy conviven semi-implícitos: lo
consumido (5,97 ml), lo comprado (1 bobina / 3 barras), lo cobrado (según
estrategia).

## 2. Inventario verificado: la cascada real por slot

En orden — gana el primero que responde:

| # | Vía | Qué hace | Ejemplo real |
|---|---|---|---|
| 1 | **Cantidad fija** × unidades | N por cartel, declarado por familia/modelador | fuente LED: 1 por cartel |
| 2 | **Magnitud derivada** (geometría) | consume lo publicado por el derivador — salvo `cantidadBase` del modelador (Regla 2, la pisa) | ml de caño, módulos, anclajes |
| 3 | **Base × factor** (regla del modelador) | `cantidadBase` (cantidad_pedida / cantidad_efectiva_paso / pliegos_impresos / talonario_pilas / perimetro_piezas_m) × `cantidadFactor` | anclajes "4 × cantidad pedida" (Backlight, real) |
| 4a | Fórmula `por_unidad_productiva` | delega en el MECANISMO del paso: nesting → pliegos/ml; herencia → lo del anterior; directo → lo pedido; + ajuste de compra (pliegos→hojas ÷2) | papel de tarjetas |
| 4b | Fórmula `por_m2` | cascada interna de 4: área de personalización → área del pliego de impresión → m² consumidos del nesting (CON desperdicio) → m² crudos de piezas | chapa trasera (hoja) |
| 4c | Fórmula `por_metro_lineal` | cascada interna de 3: ml consumidos del rollo → ml del pliego → ml de piezas | film de laminado |
| 4d | Fórmula `por_pieza` | `jobContext.cantidad` | — |
| 4e | Fórmula `fijo` | 1 | slot fuente (fallback) |

### Las capas DESPUÉS de la cantidad

- **Conversión de compra**: pliego de impresión ↔ hoja comprada (÷2 doble
  faz, `ajustarCantidadSustratoComprado`); ml de perfil → barras enteras
  (redondeo del derivador). UI: modal de nesting compra→pliego (hecho).
- **Estrategia de cobro** (`estrategiaCosto` + `nestingConfig.costing`):
  `simple` (unidades enteras, con gates para no romper doble faz) ·
  `m2-exact` / `consumed-length` (exacto) · `plate-segments` (segmentos
  escalonados de placa: 15/30/45/60/75/90/100%).
- **Multiplicador de caras** (`aplicaMultiCaras`): film y PVC ×2 si doble faz.
- **Consumibles por PERFIL** (canal paralelo completo, fuera de slots):
  tinta por m² × cobertura (por nivel), clicks por pasada. El modelador no
  los ve en "Los materiales".
- **Desperdicio**: verificado — NO existe "% de merma" genérico por slot.
  Emerge del acomodo (se cobra lo consumido del rollo/placa, recortes
  incluidos) o de params de geometría (`margenPinturaPct`,
  `desperdicioCenefaPct`, `margenFuentePct`). No es perilla: es consecuencia.

## 3. Las anomalías — espejo exacto de las de tiempo

1. **`formula` mezcla tres cosas bajo una etiqueta** (como T-2): reglas del
   modelador (`por_pieza`, `fijo`), delegaciones al acomodo (`por_m2`,
   `por_metro_lineal`) y delegación al plan del paso
   (`por_unidad_productiva`).
2. **Duplicación expresiva** (como T-1 vs horasEstimadas): `por_pieza` ≡
   base *cantidad_pedida* × 1; `fijo` ≡ cantidad fija 1.
3. **Cascadas encubiertas**: `por_m2` esconde 4 fuentes y
   `por_metro_lineal` 3 — el modelador elige "por m²" sin saber CUÁLES m²
   se van a cobrar (¿del nesting con desperdicio o crudos de las piezas?).
4. **La tinta vive en otro país**: los consumibles del perfil son
   materiales de verdad pero invisibles en "Los materiales" (confirmado en
   los 6 productos: ningún paso de impresión muestra su consumible
   principal).
5. **Tres números semi-implícitos** por slot (consumido / comprado /
   cobrado); la UI recién empieza a mostrar la diferencia.

## 4. La taxonomía nueva (validada con el usuario)

```
Por cada slot:
① ¿Quién define cuánto se CONSUME?
   ├─ La geometría    → panel que explica + "…o tu propia regla"  (HECHO — Regla 2 / ConsumoFormulaGuiado)
   ├─ El acomodo      → panel: "m²/ml/pliegos consumidos, desperdicio incluido"
   ├─ El plan del paso → hereda lo producido (pliegos, cantidad efectiva del mecanismo)
   └─ Yo (el taller)  → base × factor        (absorbe por_pieza, fijo y cantidadFija)

② ¿Cómo se COMPRA/COBRA lo consumido?
   ├─ Exacto (fraccionable: tinta, pintura, tarifa por m², ml de rollo)
   ├─ Unidades enteras (hoja, barra, bobina) + conversión pliego↔hoja
   └─ Segmentos de placa (escalones 15/30/…/100%)
```

Convergencia con tiempo: la pregunta ① es LA MISMA (geometría/acomodo/plan
≈ "lo dice la máquina/el plan"; regla mía ≈ "lo declaro yo") y la regla de
diseño también — **perilla sólo donde decide el modelador; panel que
explica donde decide la geometría, el acomodo o el plan**. Diferencias
genuinas: materiales tiene la pregunta ② (cobro) que tiempo no tiene;
tiempo tiene la capa comercial que materiales casi no necesita (el
comercial elige QUÉ material, nunca cuánto).

## 5. Validación contra productos reales (2026-08-11)

Los 18 slots activos de los 6 productos, leídos con el árbol — **todos
entran**:

| Producto · paso · slot | ① Consumo | ② Cobro |
|---|---|---|
| Tarjetas/Folletos/Imanes · Impresión · papel | El PLAN (mecanismo: poses→pliegos) | Hojas enteras (÷2 doble faz) |
| Tarjetas · Laminado · film | El ACOMODO (ml sobre pliegos) ×2 caras | Exacto (ml) |
| Imanes · Laminado · film | El ACOMODO (`por_metro_lineal`) | Exacto (ml) |
| Imanes · Montaje · plancha imán | El ACOMODO (pliegos sobre plancha, márgenes 5mm) | Unidades enteras |
| Backlight · Estructura · perfil | La GEOMETRÍA (17 ml del derivador) | Barras enteras |
| Backlight · Estructura · anclajes | YO: "4 × cantidad pedida" (Regla 2 pisando geometría — prueba en vivo) | Unidades |
| Backlight · Pintura · pintura | El PLAN (hereda pintura_m2 +10%) | Exacto |
| Backlight · Impresión · lona | El ACOMODO (rollo, demasía mutada) | Exacto (ml) |
| Backlight · Chapa trasera · chapa | El ACOMODO (montaje con PAÑOS) | Segmentos (100% = hoja entera) |
| Backlight · LED · módulos/fuente/cable | La GEOMETRÍA (grilla por paso / 1 por cartel por watts / perímetro×1,4) | Unidades / unidades / exacto |
| Backlight · Cenefas · chapa | El PLAN (hereda cenefa_m2 → tarifa m²) | Exacto (m²) |
| PVC · Impresión · PVC | El ACOMODO (placa) ×2 caras | SEGMENTOS 15/30/…/100% |
| DTF · Impresión · film DTF | El ACOMODO (rollo, variante fija) | Exacto |
| (todos los de impresión) · tinta | consumible del PERFIL — INVISIBLE ⚠ | exacto (m²×cobertura) |

### Hallazgos de los casos reales

1. La pregunta ② aparece en su forma más rica en PVC (`plate-segments`
   escalonado) y más simple en tarjetas (hojas enteras) — es una pregunta
   REAL que hoy vive enterrada en `nestingConfig.costing` + `estrategiaCosto`.
2. `modoSeleccion` (COMERCIAL_ELIGE / MOTOR_ELIGE_AUTO / HARDCODED) es una
   TERCERA pregunta ya bien resuelta en la UI actual ("quién elige el
   material") — no confundirla con ① (quién define la cantidad). El árbol
   las mantiene separadas.
3. Cero slots reales usan `por_pieza` puro — la vía duplicada ya casi no
   tiene usuarios; deprecarla en escritura es barato.
4. La tinta invisible se confirma en el 100% de los pasos de impresión.

## 6. Plan de implementación técnica (para otra sesión)

**Principio rector: re-skin del guiado; la cascada del motor NO se toca.**
Mapping de lectura/escritura sobre campos existentes → goldens idénticos.

### F0 — Decisiones previas (con el usuario)
1. Naming de ①: "La geometría / El acomodo / El plan del paso / Yo" u otro
   fraseo.
2. ¿Deprecamos la ESCRITURA de `por_pieza` y `fijo` (lectura por compat)
   normalizando a base × factor / cantidad fija? (censo: casi sin usuarios).
3. Tinta visible: ¿tarjeta read-only "Consumibles del perfil" dentro de
   "Los materiales" (tinta por m²×cobertura, clicks)? Sólo informativa,
   editada en Maquinaria.
4. ¿La pregunta ② se muestra SIEMPRE o sólo cuando el material la habilita
   (presentación hoja/placa/bobina)?

### F1 — Re-skin del eje "Los materiales" por slot
- Archivos: `src/lib/editor-paso/schema.ts` +
  `src/lib/editor-paso/catalogo-materiales.ts` +
  `config-pasos-editor-view.tsx` (ConsumoFormulaGuiado ya implementa ① para
  slots con derivador — generalizarlo).
- LECTURA de ① desde datos existentes: familia con derivador y sin
  cantidadBase → "geometría"; `cantidadBase` presente → "yo"; fórmula
  por_m2/por_metro_lineal (o por_unidad_productiva con nesting propio) →
  "acomodo"; por_unidad_productiva con mecanismo HEREDA/DIRECTO → "plan";
  por_pieza/fijo → "yo" (mostrado como base × factor equivalente).
- ESCRITURA: "yo" escribe `cantidadBase`+`cantidadFactor` (y deja de
  escribir por_pieza/fijo si F0.2 aprueba); las otras ramas no escriben
  perillas — sólo la elección de vía.
- El toggle "…o definí tu propia regla / volver al default" (Regla 2) se
  vuelve el patrón de TODAS las vías no-yo, no sólo geometría.

### F2 — Paneles informativos (patrón consumo-formula, ya existente)
- "Acomodo": panel con lo que el nesting va a consumir (reusar la lógica
  del modal compra→pliego de Materiales del paso) + aviso de que el
  desperdicio va incluido.
- "Plan del paso": panel "hereda los N pliegos/m² que produce <paso>".
- "Geometría": ya hecho (panel de ConsumoFormulaGuiado).

### F3 — La pregunta ② (cobro) como sección propia
- Hoy: `estrategiaCosto` + `nestingConfig.costing.strategy/segmentSteps`
  dispersos. Re-skin: "¿Cómo se cobra?" con Exacto / Unidades enteras /
  Segmentos (con sus escalones), leyendo-escribiendo los campos actuales.
- Mostrar los TRES números cuando difieren (consumido / comprado /
  cobrado) en el resumen del slot — extiende el modal de nesting existente.

### F4 — (Opcional, decisión aparte) Consumibles visibles
- Tarjeta read-only por perfil en "Los materiales" (F0.3). Cero cambio de
  motor: los datos ya están en el perfil.

### Verificación (obligatoria en cada fase)
- Golden cartelería 7/7 + genérico 152/152 idénticos al centavo.
- `npx vitest run src/lib` (schema/catálogo de materiales).
- Round-trip E2E: guardar un slot por cada vía de ① y ② y releer sin
  pérdida; slots legacy (por_pieza, fijo) se muestran correctos sin
  re-guardar.

### Fuera de alcance
- Tocar la cascada de `motor.service.ts` (orden, precedencias, fórmulas).
- Merma genérica por slot (hoy no existe; si algún día hace falta, es una
  decisión de producto aparte).
- minimoCompra genérico y cenefa-por-hojas (pendientes ya anotados en
  carteleria-pasos-revision.md).

## 7. Preguntas abiertas
1. F0.1–F0.4 (arriba).
2. ¿El slot muestra advertencia cuando la vía elegida y el mecanismo del
   paso se contradicen (p.ej. "acomodo" en un paso sin nesting)? Hoy cae en
   fallbacks silenciosos (las cascadas internas de por_m2/por_metro_lineal).
3. El slot `anclaje` del Backlight quedó con "4 × cantidad pedida" (prueba
   en vivo de la Regla 2) — revertir a geometría si era sólo un test.
