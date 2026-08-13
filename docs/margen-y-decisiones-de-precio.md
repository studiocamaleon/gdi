# Margen y decisiones de precio — cuaderno de análisis

> **Estado: DOCUMENTO VIVO** (arrancado 2026-08-12). Acá se baja el análisis de
> las preguntas comerciales que el sistema hoy no contesta solo: cuánto se
> puede descontar, qué margen queda, qué pasa si cambia la forma de cobro.
>
> **No hay cambios de código planificados.** Primero se entiende el negocio y
> se escriben las cuentas; recién después se decide si algo de esto merece
> vivir en la pantalla.
>
> Hermanos: [descuentos-diseno.md](descuentos-diseno.md) (cómo se aplica un
> descuento) · [comisiones-modelo-diseno.md](comisiones-modelo-diseno.md) (de
> dónde salen las comisiones) ·
> [impuestos-modelo-latam-diseno.md](impuestos-modelo-latam-diseno.md).

## 1. Por qué existe este cuaderno

El precio de un trabajo pasa por cinco capas —costo, margen, comisiones,
impuestos por dentro, IVA— y cada una tiene su base de cálculo. El resultado es
correcto, pero **deja de ser mental**: frente a un cliente que pide un
descuento, nadie puede decir de memoria hasta dónde puede ceder.

> "Si un trabajo sale $100.000 y tiene 50% de margen, ¿de cuánto puede ser el
> descuento si sé que paga en efectivo y no voy a tener la comisión de
> pasarela, para que me siga quedando el mismo margen?" (Lucas, 2026-08-12)

La pregunta no es del sistema: es del negocio. Pero la respuesta sale de cómo
el sistema arma el precio, así que se escribe acá.

## 2. La estructura del precio, en una cuenta

Verificado contra `calculador-precio.ts` + `AplicarPrecioService` y contra una
cotización real (Vinilo impreso blanco 150×100, 2026-08).

Todo se expresa **como fracción del NETO** (el precio sin IVA), que es donde
vive el margen. Las tasas con base `BRUTO_COBRADO` se convierten multiplicando
por (1 + IVA).

```
neto × (1 − margen − internos − comisiones) = costo
```

Con las tasas del tenant hoy:

| Concepto | Tasa | Base | Como fracción del NETO |
|---|---:|---|---:|
| IVA | 21% | neto, **por fuera** | — (no toca el margen) |
| Ingresos brutos | 3,5% | neto, por dentro | 3,500% |
| Imp. al créd/déb | 0,6% | bruto cobrado, por dentro | 0,726% |
| **Impuestos internos** | | | **4,226%** |
| Pasarela de pago (estimada) | 6% | bruto cobrado | **7,260%** |
| Comisión vendedor | 5% | neto | 5,000% (si el producto la aplica) |

Con margen 43% y sólo pasarela:

```
neto × (1 − 0,43 − 0,04226 − 0,0726) = neto × 0,45514 = costo
```

**La trampa número uno**: la pasarela se cobra sobre el **bruto**, o sea sobre
el precio con IVA. En plata tuya —que es el neto— eso no es 6%: es **7,26%**.

## 3. Consulta 1 — descuento por pago en efectivo

### La respuesta

> **Hasta 7,5% del precio final.** Con eso te queda exactamente la misma plata.

Trabajo de **$100.000** finales → descontás **$7.580** → cobrás **$92.420**, y
tu contribución en pesos no se mueve.

Como el IVA es proporcional, el mismo porcentaje vale sobre el neto o sobre el
total: no hay que convertir nada.

### De dónde sale

Al cobrar en efectivo desaparece la pasarela (7,26% del neto). Pero al bajar el
precio **también bajan** IIBB e ICD, que son porcentajes del precio: eso
devuelve un poco y permite ceder algo más.

```
descuento = pasarela / (1 − impuestos internos)
          = 7,260% / (1 − 4,226%)
          = 7,58% del neto
```

Verificación con costo = $100: contribución antes $73.152 · después $73.152.

### La trampa número dos: "mantener el mismo margen %"

Si en vez de la plata se quiere sostener el **porcentaje**, el número se
dispara — y **deja menos pesos**:

| Qué se mantiene | Descuento | Resultado |
|---|---:|---|
| La misma **ganancia en $** | **7,58%** | igual que hoy |
| El mismo **43%** de margen | 13,76% | menos plata |
| El mismo **50%** de margen | 15,86% | bastante menos |

Pasa porque el porcentaje se mide sobre un precio que bajó: para sostenerlo hay
que bajar más, y ahí sí se regala margen real.

> **Para un descuento comercial la referencia correcta es la plata, no el
> porcentaje.** El % de margen sirve para fijar precios, no para negociarlos.

### Matices

- **El impuesto al créd/déb (0,6%)** grava movimientos bancarios. Si el
  efectivo no entra al banco tampoco se paga, y el descuento sube a **~8,3%**.
  Si igual se deposita, queda en 7,5%.
- **La comisión del vendedor (5% sobre neto)** no cambia con la forma de pago:
  no entra en esta cuenta.
- **Redondeo práctico**: ofrecer **7%** deja un pequeño colchón y es un número
  redondo. De 7,5% para arriba se está poniendo plata propia.

### La fórmula general

Para cualquier costo que desaparezca según la forma de cobro:

```
descuento sobre el precio = (lo que se ahorra, como fracción del neto)
                            ─────────────────────────────────────────
                            (1 − impuestos internos que quedan)
```

## 4. Vocabulario — tres cosas que se llaman "margen"

Se mezclan todo el tiempo y significan cosas distintas:

| Nombre | Qué es | Dónde se ve |
|---|---|---|
| **Margen del Tab Precio** | el % objetivo con el que se fija el precio | config del producto |
| **Margen bruto** | precio neto − costo de producción | ficha del ítem |
| **Margen de contribución** | precio neto − costos **variables** (materiales, proveedor, cargos, impuestos internos, comisiones). **No resta el centro de costo** | ficha y tab Costos |

La contribución es lo que queda para cubrir la estructura fija y dejar
ganancia. Es la que hay que mirar al negociar, porque el centro de costo se
paga igual se venda o no.

## 5. Preguntas abiertas

Se van sumando a medida que aparecen.

- **¿El sistema debería calcular el descuento máximo?** Hoy el descuento se
  carga a mano. Podría mostrarse en la ficha "descuento sin perder margen: $X"
  según el medio de pago elegido. Sin decidir.
- **¿Y al revés?** Si el cliente pide un descuento de $X, ¿cuánto margen queda?
  Hoy hay que recalcularlo mentalmente.
- **La reconciliación real.** La pasarela se cotiza estimada y se corrige con
  los cobros reales (comisiones Fase B). Falta entender qué pasa cuando el
  descuento se dio *asumiendo* efectivo y el cliente termina pagando con
  tarjeta.

## 6. Bitácora

| Fecha | Qué se analizó |
|---|---|
| 2026-08-12 | Estructura del precio (§2) y descuento por pago en efectivo (§3). |
