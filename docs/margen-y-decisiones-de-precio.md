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
- **Reversibilidad de una orden sin comprobante** (§6). Si se marca
  `SIN_COMPROBANTE`, se cobra, y después el cliente pide factura: hay que
  poder "re-fiscalizar" (recalcular con IVA, subir la deuda, habilitar la
  emisión) sin romper los cobros ya imputados. Sin resolver.
- **Permiso del flag fiscal** (§6). ¿Lo activa cualquiera que edita la OT o
  pide un permiso fiscal (`administracion.gestionar`)? Debería ser lo segundo.

## 6. Vender sin comprobante fiscal

### El planteo

En Arg y en buena parte de LATAM se vende seguido "sin IVA" —sin factura—.
El sistema hoy no permite "apagar" el IVA de una OT puntual, y la pregunta es
cómo modelarlo sin que el software quede diseñado para ocultar.

**La línea que se trazó:** el sistema NO modela la evasión. No hay campo
`enNegro` ni atajo secreto. Lo que registra es un hecho **neutro y verificable**
—*"esta orden no llevó comprobante fiscal"*—, lo muestra de frente, y la
decisión de declarar o no ese ingreso vive **fuera del sistema**, en el
operador. Un atajo oculto no borra la evidencia (el cobro, el recibo, el
cruce cobros-vs-comprobantes quedan igual): sólo suma la prueba del ardid, que
es lo único que la ley castiga de verdad. "No facturado" no es "evadido" — son
dos ejes independientes, y el segundo ocurre en el Libro IVA / la DDJJ, no acá.

### La cuenta — es un descuento financiado con el IVA

Vender sin IVA es, en las cuentas, un descuento pagado con el impuesto que no
se ingresa. Hay dos modos con efectos **opuestos** sobre el margen:

| Modo | Qué cobrás | Margen |
|---|---|---|
| **A — descontás el IVA** ("21% menos si es sin factura") | el **neto** | **igual** — caso sin pérdida de margen |
| **B — te guardás el IVA** (mismo precio con IVA, no lo ingresás) | el **bruto** | **sube** todo el IVA |

En el modo A el descuento sobre el precio final **no es 21%**: si el cliente
paga el neto en vez del bruto,

```
descuento = IVA / (1 + IVA) = 21% / 1,21 = 17,35% del total
```

El diseño asume **modo A** (el cliente paga menos, tu margen no se mueve). En
modo B el `total` seguiría con IVA y el desglose mentiría sobre qué es ese
excedente; por eso se descarta como default.

### Por qué un descuento común no sirve

Tres razones, todas verificadas contra el pipeline:

1. El descuento se aplica sobre el **neto**, no sobre el total.
2. Aunque se descuente, el IVA se **recalcula** sobre el neto ya descontado.
3. El sistema cree que se cedió margen, cuando en realidad ese IVA va al
   bolsillo. No hay forma de que lo distinga.

La herramienta correcta no es un descuento: es un **tratamiento fiscal
explícito** de la orden.

### El mecanismo — un flag en la OT

```
OrdenTrabajo.tratamientoFiscal  FISCAL | SIN_COMPROBANTE   @default("FISCAL")
```

- **Nivel orden, no ítem.** "Sin IVA" es una decisión de toda la operación; no
  hay media orden fiscal. El descuento sí vive en el ítem, esto no.
- **Los snapshots de ítem no se tocan** — siguen con el desglose fiscal completo
  (neto + IVA) como traza. El flag sólo cambia qué se presenta y qué `total` se
  denormaliza.
- **UI:** botón-toggle (ícono `FileX`) en la barra de resumen financiero al pie
  de la ficha, junto a Descuento; chip "Sin comprobante" en el encabezado.
  Editable en `borrador` / `pendiente`, con evento en el timeline. El texto
  visible habla del **estado en el sistema** ("sin comprobante fiscal en el
  sistema"), nunca del IVA ni de "no facturar": el sistema no narra la
  intención fiscal.
- **Candado de ciclo de vida:** no se puede activar si la orden ya tiene un
  `Comprobante` emitido (no se des-factura).

### Qué cambia al recalcular los denormalizados

| Campo de `OrdenTrabajo` | FISCAL | SIN_COMPROBANTE |
|---|---|---|
| `subtotal` (neto) | Σ ítems neto | igual |
| `impuestos` | Σ IVA | **0** |
| `total` | neto + IVA | **= neto** |

Como todo aguas abajo lee `total`, esto resuelve solo lo que se buscaba:

- **Deuda / cuenta corriente**: nace de `total` = neto → no cuelga un IVA
  adeudado.
- **Desglose en pantalla y PDF**: con `impuestos = 0` la línea de IVA no se
  dibuja; total = neto.
- **Panel de ventas**: ya cuenta `SUM(subtotal)` sin IVA (ventas = neto; lo
  fiscal vive en Administración) → la venta entra igual, sin distorsión.

### El candado de facturación — dos capas

Para que la orden **no se pueda facturar por error**:

1. **La cola.** `FacturacionOrdenesService.pendientesFacturacion` filtra
   `estado ∈ {finalizada, entregada}, total > 0`. Se le suma
   `tratamientoFiscal: 'FISCAL'` al `where` → la orden sin comprobante nunca
   aparece en la vista Facturación.
   (`apps/api/src/administracion/facturacion-ordenes.service.ts`)
2. **El endpoint.** `facturarOrden` / `facturarLote`: guard duro en el service
   —si la orden es `SIN_COMPROBANTE` → `BadRequestException`—. Aunque venga de
   un lote o de un POST directo, no emite. La precondición vive en el backend,
   no en esconder el botón.
   (`apps/api/src/administracion/administracion.controller.ts`)

Contracara honesta: esa misma condición la **excluye del Libro IVA** cuando se
construya (Egresos F4).

### Estado

**Implementado y verificado en navegador (2026-08-13).** Campo
`OrdenTrabajo.tratamientoFiscal` + migración; recálculo neto en `crear` y
`recalcularTotales`; endpoint `PATCH :id/tratamiento-fiscal`
(`comercial.gestionar`, sólo borrador/pendiente, bloquea si hay comprobante
emitido); guards en la cola y en `facturarOrden`/`facturarLote`. UI: toggle
`FileX` en la barra al pie + **atajo de teclado `X`** + chip en el encabezado.
Todas las superficies de precio muestran el neto cuando el flag está activo:
barra de total, tabla de ítems (oculta la columna Imp., Total/Unitario en neto),
Pagos/deuda, y los dos desgloses de **Costos** (ítem y orden: sin línea IVA,
"Precio de venta" = neto). El snapshot fiscal de cada ítem queda intacto por
debajo. Permiso resuelto (`comercial.gestionar`, misma llave que el descuento).
Queda abierta la reversibilidad post-cobro (§5).

## 7. Bitácora

| Fecha | Qué se analizó |
|---|---|
| 2026-08-12 | Estructura del precio (§2) y descuento por pago en efectivo (§3). |
| 2026-08-13 | Vender sin comprobante fiscal (§6): flag `SIN_COMPROBANTE`, cuenta del 17,35% (modo A), candado de facturación, y la línea de no modelar la evasión. |
| 2026-08-13 | §6 **implementado** end-to-end (backend + UI + atajo `X`), verificado en navegador; texto visible neutralizado ("sin comprobante fiscal en el sistema"); Pagos/deuda en neto. |
