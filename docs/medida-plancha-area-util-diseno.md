# Medida "Plancha completa" — el área útil del pliego como medida derivada

**Estado**: diseño en revisión — sin implementar
**Fecha**: 2026-08-15
**Disparador**: producto "Papel adhesivo / sticker troquelado". Para vender
"1 plancha" hubo que inventar a mano la medida 27×40 (el área útil del SRA3
325×500 menos márgenes), porque poner 325×500 como medida de la pieza hace
fallar el nesting ("no entra en la hoja" por los márgenes no imprimibles).

---

## 1. El problema

Hay productos que se venden **por plancha** (hoja completa): planchas de
stickers, imanes por plancha, etiquetas en hoja. El cliente pide de dos formas:

1. **"Quiero 3 planchas"** — cada empresa tiene su plancha estándar.
2. **"Quiero 300 stickers de 3×3"** — piezas sueltas, el sistema calcula
   cuántos pliegos hacen falta.

El caso 2 ya funciona (a-medida + cantidad → nesting en área útil → pliegos).
El caso 1 funciona **a medias**: el modelador debe crear una medida fija cuyo
valor es un **derivado congelado a mano**:

```
"plancha" = pliego (variante del papel) − márgenes no imprimibles (máquina)
          = 325×500 − márgenes Ricoh = 27×40 (aprox, redondeado a ojo)
```

Problemas de congelarlo:
- **Desincronización**: si cambia la máquina (otros márgenes) o el papel
  (otro formato), la medida miente y nadie avisa.
- **Repetición**: hay que calcularla y cargarla por producto × formato de
  papel. Un producto con SRA3 y A3+ necesita dos medidas inventadas.
- **Precisión**: se redondea a ojo (27×40 vs el útil real), regalando o
  inventando área.

El sistema conoce los dos operandos de la resta y obliga al usuario a
hacerla a mano.

## 2. Estado actual (dónde vive cada cosa)

| Pieza | Dónde | Nota |
|---|---|---|
| Medidas del producto | `Producto.medidasPredefinidasJson` → `MedidaPredefinidaProducto { id, nombre, anchoMm, altoMm, esDefault }` | lista fija + "A medida" según `manejoMedidas` (Fija / Libre / Comercial elige / Mixta) |
| Formato del pliego | variante del material del slot de impresión (`anchoMm × altoMm`) | el comercial puede elegir variante (candidatas) |
| Márgenes de la máquina | `parametrosTecnicosJson.margenesNoImprimiblesMm` | el sheet ya los lee (helper existente) |
| Área útil para nesting | `resolveNestingConfig` (motor) | pliego − márgenes; el nesting acomoda ahí |
| Réplica frontend del cálculo de pliegos | `src/lib/nesting-compra-pliego.ts` | precedente de "replicar la cuenta del motor para la UI, con test de paridad" |
| Poses por pliego | `outputsCanonicos.imposicion_calculada.piezasPorPliego` | ya viaja en la respuesta de cotización |

## 3. Diseño propuesto

### 3.1 Un tipo de medida derivada

`medidasPredefinidasJson` admite una entrada especial:

```jsonc
{ "id": "...", "tipo": "pliego_util", "nombre": "Plancha completa", "esDefault": false }
// (las medidas actuales quedan implícitamente tipo "fija"; sin migración:
//  ausencia de `tipo` = fija)
```

Sin `anchoMm/altoMm` propios: se **resuelven en runtime** en el sheet:

```
pieza = pliego de la variante activa del slot de impresión
      − márgenes no imprimibles de la máquina activa
```

- Cantidad = número de planchas (1 pieza por pliego, por construcción — el
  nesting no puede fallar: la pieza mide exactamente el área útil).
- Si el comercial cambia la variante del papel (SRA3 → A3+) o la máquina
  (candidatas), la plancha **se recalcula sola** — cero duplicación.
- La "plancha estándar propia" de una empresa (ej. vender plancha A4 aunque
  imprima en SRA3) sigue siendo una medida fija normal; conviven.

### 3.2 UX

**Editor del producto** (ficha → Comercial y medidas → Medidas disponibles):
- Botón "Agregar medida" ofrece además "Plancha completa (área útil del
  pliego)". Muestra en la lista el valor resuelto de referencia si el paso de
  impresión ya tiene máquina+material ("Plancha · hoy 30,5×47,0 cm"), o
  "se resuelve al cotizar" si no.
- Sólo se ofrece si la ruta tiene un paso de impresión por hoja con slot de
  sustrato (sin pliego no hay plancha).

**Sheet (comercial)**:
- La card de medida muestra "Plancha completa" + la medida resuelta
  ("30,5 × 47,0 cm") — el cliente sabe qué recibe. Cantidad en planchas.
- Si máquina/material del paso de impresión aún no resuelven (sin candidata,
  slot sin variante), la card se deshabilita con nota — no se adivina.
- El PDF/propuesta muestra "Plancha completa (30,5×47 cm)".

**Resolución** (frontend): nuevo helper `resolverMedidaPlancha(config paso
impresión, variante activa, máquina activa)` — mismo patrón que
`nesting-compra-pliego.ts`: replica la resta del motor (pliego − márgenes,
misma tolerancia) con **test de paridad** contra `resolveNestingConfig`.

### 3.3 Qué NO cambia

- **El motor: nada.** Recibe una pieza que entra exacta 1×pliego. La cadena
  pliegos→troquelado (fix 78ca2ae1) ya trata los pliegos enteros.
- El modelo de cobro: el producto sigue cobrando por unidad/m² como esté; la
  plancha es una medida, no una unidad de pricing nueva.
- Las medidas fijas y "A medida" existentes.

### 3.4 Bonus (fase aparte): "entran N por plancha"

La pregunta clásica del mostrador ("¿cuántos de 4×5 entran?") ya está
calculada: `piezasPorPliego` viaja en la cotización. Mostrar en el sheet,
junto a la cantidad cuando la medida es a-medida/fija chica:
"Entran 60 por plancha · 1 plancha para este pedido". Cero cálculo nuevo,
puro display.

## 4. Casos de borde

1. **Separación entre piezas**: con pieza = área útil exacta y separación 0
   (la impresión por hoja usa sep 0 en estos productos) entra 1 justa. Si el
   paso declara separación > 0 no afecta: una sola pieza no tiene vecinos.
2. **Doble faz / imposición especial**: fuera de alcance — la plancha es la
   cara útil; caballete u otras imposiciones no ofrecen "plancha".
3. **Varias piezas en el pedido**: "Plancha" es la medida de la pieza
   principal; mezclar plancha + piezas a medida en el mismo ítem no se
   permite (una medida por ítem, como hoy).
4. **Redondeo**: se usa el valor exacto del motor (con decimales de mm), no
   redondeos a cm — la paridad con el nesting es lo que garantiza "entra".
5. **Máquinas candidatas (M-2)**: la plancha sigue a la candidata activa; al
   cambiar de máquina en el sheet se recalcula (mismo patrón reactivo que
   perfiles/modo color).

## 5. Fases

- **F1**: tipo `pliego_util` en `MedidaPredefinidaProducto` + editor de
  medidas + resolución en el sheet + PDF. Test de paridad del helper.
- **F2**: bonus "entran N por plancha" (display de `piezasPorPliego`).
- **F3 (evaluar)**: variante para ROLLO ("por metro lineal de rollo útil",
  ej. DTF por metro ya se vende así — hoy resuelto con unidad comercial
  metro_lineal; probablemente NO haga falta, anotado para no perderlo).

## 6. Preguntas abiertas

1. ¿La plancha muestra la medida útil resuelta ("30,5×47") o el formato
   comercial del papel ("SRA3")? Propuesta: ambas — "Plancha SRA3 ·
   útil 30,5×47 cm".
2. ¿`esDefault` puede ser la plancha? Propuesta: sí (productos que se venden
   principalmente por plancha).
3. Nombre editable por el modelador ("Plancha", "Hoja completa", "Plancha
   grande") — propuesta: sí, el `nombre` ya existe en el modelo.
