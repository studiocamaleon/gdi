# Recibos de pago — diseño

Cada cobro que se registra emite un recibo: número propio, PDF, link público
para el cliente y aviso por WhatsApp. Diseño de referencia:
`PDF Recibo de pago.html` en claude.ai/design.

## Qué es un recibo acá

**El recibo es un documento del `Cobro`, no una entidad nueva.** Es 1:1 con él:
un cobro registrado tiene exactamente un recibo, y anular el cobro anula el
recibo. Por eso el número vive en `Cobro.numeroRecibo` y no en una tabla
`Recibo` que sólo repetiría la FK.

No es un comprobante fiscal y el documento lo dice explícitamente: certifica
que la imprenta recibió el dinero, y la factura se emite por separado (puede
ser antes, después o nunca). Eso lo separa limpio del módulo de comprobantes,
que sí es AFIP.

## Cuándo se emite: al REGISTRAR, no al acreditar

Un cobro con cheque o con plazo se registra hoy y acredita en 30 días. El
recibo se emite **al registrarlo**, porque el hecho que certifica es la
recepción: "recibí conforme" el cheque, la transferencia o el efectivo. Que el
banco después acredite es un asunto interno de la imprenta, no del cliente.

El catálogo de Wati decía "cuando el cobro se acredita" en el texto descriptivo
de la plantilla; se corrigió, porque describía algo que nunca se cableó.

## Numeración

`REC-AAAA-NNNN` por tenant y año, con `ReciboContador` — mismo patrón atómico
que `OrdenTrabajoContador` y `CotizacionContador`, asignado dentro de la misma
transacción que el cobro.

## Datos nuevos en `Cobro`

| Campo | Por qué |
|---|---|
| `numeroRecibo` | REC-AAAA-NNNN, único |
| `referencia` | El "N° de operación" del diseño: el identificador que da el medio de pago (transferencia, cupón, ticket). No existía y es lo que el cliente reconoce |
| `registradoPorNombre` | Quién lo tomó, **congelado**. El nombre ya se calculaba para el evento de la orden pero se tiraba; en un documento que se comparte no puede cambiar porque alguien editó su legajo |

## Las tres salidas

**PDF** con jsPDF, no Puppeteer — misma razón que los otros tres del sistema
(texto vectorial, determinístico, sin arrastrar 300 MB de Chromium). Se
materializa en R2 vía `ArchivoScope.COBRO`, que ya existía sin usarse, y se
regenera solo si falta.

**Link público** `/c/<token>` sobre `EnlacePublico` tipo `COBRO`, la
infraestructura de [enlaces-publicos-diseno.md](enlaces-publicos-diseno.md).
La página replica el diseño (que ya trae sus reglas responsive, así que está
pensado para verse en el teléfono) y ofrece el PDF para descargar.

Nota: `COBRO` estaba reservado como "link de pago". Pasa a ser el recibo —
misma entidad, y un checkout es otra cosa que hoy no existe.

**WhatsApp**: se cablea el evento `pago_recibido`, que estaba en el catálogo
con plantilla aprobada y sin nadie que lo disparara. Sus 5 parámetros
—`nombre_cliente`, `monto_pagado`, `numero_orden`, `saldo_restante`,
`url_recibo`— salen todos del cobro y su orden.

## Cobro sin orden

Un cobro puede no tener orden (pago a cuenta). En ese caso el recibo omite el
bloque "Aplicado a" y su barra de progreso —no hay trabajo contra el cual
medir— y muestra "Pago a cuenta". El aviso de WhatsApp **no se manda**: la
plantilla tiene `numero_orden` y `saldo_restante` como parámetros
obligatorios, y no hay con qué llenarlos honestamente.

## El saldo que muestra el recibo

Es el de la **orden**, no el de la cuenta corriente del cliente:

- Total del trabajo → `orden.total`
- Pagos anteriores → `orden.cobradoTotal` **antes** de este cobro
- Este pago → `cobro.montoBruto`
- Saldo pendiente → total − anteriores − este pago

Se calcula con los denormalizados que `FacturacionOrdenesService` ya mantiene
en la misma transacción, así que el recibo no puede contradecir a la ficha de
la orden.

## Monto en letras

El diseño lo pide ("Ciento veinticuatro mil cincuenta y nueve pesos con
00/100") y es lo que convierte al papel en un recibo de verdad: en letras no se
puede alterar un dígito. Se implementa en `numero-en-letras.ts` con tests,
incluyendo las trampas del castellano — apócope de "un" (veintiún mil, no
veintiuno mil), "cien" vs "ciento", el singular del millón y el femenino de
las mil.

## Lo que queda afuera

- **Anular un cobro** todavía no tiene método en el service (existe la columna
  `anuladoEl` y nadie la escribe). Cuando exista, tiene que revocar el enlace
  (`EnlacePublico.revocadoEl`) y marcar el PDF.
- **Recibo por varias órdenes**: un cobro apunta a una sola orden hoy.
- **Firma del cliente**: el PDF trae las dos líneas de firma para imprimir; no
  hay firma digital.
