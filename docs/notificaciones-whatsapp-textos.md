# Textos canónicos de las plantillas de Grafo

**Fecha:** 2026-07-22
**Estado:** para revisar antes de someter a Meta.
**Relacionado:** `notificaciones-whatsapp-catalogo.md`

---

## 0. Las reglas que se siguieron, y cuáles no

**Sin eslóganes.** Es lo único que tumbó las plantillas actuales a MARKETING
(`catalogo` §1.1). Ninguno de estos textos agradece la elección, invita a
volver ni celebra la marca. El nombre de la empresa aparece para
**identificar** al remitente.

**Con emojis.** Mi instinto era sacarlos todos, y estaba mal: tu
`recibo_pago_v2` tiene 💳, ⬇️ y 😀 **y Meta lo categorizó UTILITY**. La
evidencia de tu propia cuenta dice que los emojis no mueven la categoría.
Así que se usan, moderados y funcionales — sacarlos habría sido superstición
disfrazada de prudencia.

**Cerrar con una línea que confirme que es transaccional.** "Si no lo
solicitaste, ignorá este mensaje", "no necesitás hacer nada por ahora". Es
barato y refuerza la lectura de utility.

**Restricciones de Meta que condicionan la redacción:**

- El cuerpo **no puede empezar ni terminar con una variable**. Por eso todos
  arrancan con "Hola" y cierran con texto fijo.
- Dos variables no pueden ir pegadas.
- Máximo 1024 caracteres de cuerpo.
- Al someter hay que mandar un valor de ejemplo por variable — están abajo.

**Idioma:** `es_AR`, igual que las actuales.

---

## 1. Por qué son 13 textos y no 12

El evento *orden lista* necesita **dos** plantillas: con saldo pendiente y
sin saldo. Meta no permite contenido condicional, y las alternativas son
peores: mostrar "Saldo pendiente: $0" es raro, y meter la frase entera
dentro de una variable mete formato dentro de los datos y se rompe callado.
Dos plantillas es explícito y las dos se aprueban igual de fácil.

---

## 2. Los textos

### 1 · `grafo_presupuesto_enviado_v1` — UTILITY · default ON

> **El limítrofe.** Puede leerse como venta. Es el candidato número uno para
> probar en tu cuenta: si Meta lo baja a MARKETING, lo sabemos antes de que
> lo tenga ningún tenant.

```
Hola {{1}}, acá está el presupuesto {{2}} que solicitaste a {{3}}. 📄

Importe total: ${{4}}
Válido hasta: {{5}}

Para verlo en detalle y aprobarlo: {{6}}

Si no lo solicitaste, ignorá este mensaje.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_presupuesto` | P-00142 |
| 3 | `nombre_empresa` | Corporearte |
| 4 | `total` | 185.400,00 |
| 5 | `fecha_vencimiento` | 05/08/2026 |
| 6 | `url_presupuesto` | https://app.grafo.ar/p/a1b2c3 |

---

### 2 · `grafo_presupuesto_por_vencer_v1` — MARKETING · default OFF

> Es un empujón comercial. Va como marketing porque **lo es**.

```
Hola {{1}}, el presupuesto {{2}} vence el {{3}}.

Si querés avanzar, podés aprobarlo acá: {{4}}

Si ya no te interesa, no hace falta que hagas nada.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_presupuesto` | P-00142 |
| 3 | `fecha_vencimiento` | 05/08/2026 |
| 4 | `url_presupuesto` | https://app.grafo.ar/p/a1b2c3 |

---

### 3 · `grafo_presupuesto_aprobado_v1` — UTILITY · default ON

```
Hola {{1}}, registramos tu aprobación del presupuesto {{2}} por ${{3}}. ✅

Copia del presupuesto aprobado: {{4}}

{{5}} va a preparar la orden de trabajo y te avisamos cuando entre en producción.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_presupuesto` | P-00142 |
| 3 | `total` | 185.400,00 |
| 4 | `url_presupuesto` | https://app.grafo.ar/p/a1b2c3 |
| 5 | `nombre_empresa` | Corporearte |

---

### 4 · `grafo_orden_recibida_v1` — UTILITY · default ON

```
Hola {{1}}, tu orden {{2}} quedó registrada en {{3}}. 🧾

📅 Entrega estimada: {{4}}

Podés seguir el avance acá: {{5}}

Si la fecha cambia, te avisamos por este medio.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_orden` | OT-01285 |
| 3 | `nombre_empresa` | Corporearte |
| 4 | `fecha_estimada` | 29/07/2026 |
| 5 | `url_seguimiento` | https://app.grafo.ar/s/x7y8z9 |

---

### 5 · `grafo_orden_en_produccion_v1` — UTILITY · default OFF

```
Hola {{1}}, tu orden {{2}} entró en producción. 🖨️

📅 Entrega estimada: {{3}}

Seguimiento: {{4}}

No necesitás hacer nada por ahora.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_orden` | OT-01285 |
| 3 | `fecha_estimada` | 29/07/2026 |
| 4 | `url_seguimiento` | https://app.grafo.ar/s/x7y8z9 |

---

### 6 · `grafo_orden_demorada_v1` — UTILITY · default ON

> **El que más valor tiene.** El motor de ETA ya calcula esto todos los
> días; sólo falta que salga. Nadie en el rubro avisa una demora antes de
> que el cliente la descubra.

```
Hola {{1}}, hay un cambio en la fecha de tu orden {{2}}.

📅 Entrega estimada: pasó del {{3}} al {{4}}.

Detalle actualizado: {{5}}

Si necesitás coordinar algo, respondé este mensaje.
```

> La respuesta cae en la bandeja de Wati del tenant, que ya usa. Grafo no la
> muestra —eso es el módulo de conversaciones que decidimos **no** hacer en
> F2— pero el mensaje no queda huérfano.

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_orden` | OT-01285 |
| 3 | `fecha_anterior` | 29/07/2026 |
| 4 | `fecha_nueva` | 04/08/2026 |
| 5 | `url_seguimiento` | https://app.grafo.ar/s/x7y8z9 |

---

### 7 · `grafo_orden_lista_v1` — UTILITY · default ON

> Sin saldo pendiente.

```
Hola {{1}}, tu orden {{2}} está lista. 📦

Ya podés retirarla por {{3}} o, si pediste envío, te avisamos cuando salga.

Detalle: {{4}}

No tenés saldo pendiente por este trabajo.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_orden` | OT-01285 |
| 3 | `nombre_empresa` | Corporearte |
| 4 | `url_seguimiento` | https://app.grafo.ar/s/x7y8z9 |

---

### 8 · `grafo_orden_lista_con_saldo_v1` — UTILITY · default ON

```
Hola {{1}}, tu orden {{2}} está lista. 📦

💰 Saldo pendiente: ${{3}}

Ya podés retirarla por {{4}} o, si pediste envío, te avisamos cuando salga.

Detalle: {{5}}

Si ya abonaste, puede que el pago todavía no esté registrado.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_orden` | OT-01285 |
| 3 | `saldo_pendiente` | 92.700,00 |
| 4 | `nombre_empresa` | Corporearte |
| 5 | `url_seguimiento` | https://app.grafo.ar/s/x7y8z9 |

---

### 9 · `grafo_orden_entregada_v1` — UTILITY · default OFF

```
Hola {{1}}, {{2}} confirma la entrega de tu orden {{3}} el {{4}}. ✅

Guardá este mensaje como constancia de la entrega.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `nombre_empresa` | Corporearte |
| 3 | `numero_orden` | OT-01285 |
| 4 | `fecha_entrega` | 29/07/2026 |

---

### 10 · `grafo_pago_recibido_v1` — UTILITY · default ON

> Reemplaza a `recibo_pago_v2`, que ya es UTILITY. El cambio: suma el saldo
> restante, que es la pregunta que el cliente se hace justo después de pagar.

```
Hola {{1}}, registramos tu pago de ${{2}} para la orden {{3}}. 💳

Saldo restante: ${{4}}

*Ver recibo:* {{5}}

Este mensaje es la constancia de que el pago quedó registrado.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `monto_pagado` | 92.700,00 |
| 3 | `numero_orden` | OT-01285 |
| 4 | `saldo_restante` | 0,00 |
| 5 | `url_recibo` | https://app.grafo.ar/r/k4m5n6 |

---

### 11 · `grafo_saldo_vencido_v1` — UTILITY · default OFF

> Recordar una deuda **existente** es utility para Meta. Lo que la volvería
> marketing es aprovechar el mensaje para ofrecer algo.

```
Hola {{1}}, figura un saldo vencido en tu cuenta con {{2}}.

💰 Importe: ${{3}}
📅 Venció el: {{4}}

Detalle de la cuenta: {{5}}

Si ya lo abonaste, avisanos y lo regularizamos.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `nombre_empresa` | Corporearte |
| 3 | `monto_vencido` | 92.700,00 |
| 4 | `fecha_vencimiento` | 15/07/2026 |
| 5 | `url_cuenta` | https://app.grafo.ar/c/p9q8r7 |

---

### 12 · `grafo_comprobante_emitido_v1` — UTILITY · default OFF

```
Hola {{1}}, emitimos tu {{2}} N° {{3}} por ${{4}}. 🧾

Descargala desde acá: {{5}}

El comprobante también queda disponible en tu seguimiento.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `tipo_comprobante` | Factura B |
| 3 | `numero_comprobante` | 0003-00001285 |
| 4 | `total` | 224.334,00 |
| 5 | `url_comprobante` | https://app.grafo.ar/f/t3u4v5 |

---

### 13 · `grafo_resena_v1` — MARKETING · default OFF

> Marketing de verdad, y está bien que lo sea. Forzarlo a utility es
> exactamente lo que baja la calidad de la cuenta.

```
Hola {{1}}, ¿cómo te fue con tu orden {{2}}? 🙂

En {{3}} nos ayuda mucho saber tu opinión. Si tenés un minuto, podés dejarnos una reseña acá: {{4}}

Si preferís no hacerlo, no hay problema.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_orden` | OT-01285 |
| 3 | `nombre_empresa` | Corporearte |
| 4 | `url_resena` | https://g.page/r/ejemplo/review |

---

## 3. Decisiones para revisar

**`{{nombre_cliente}}` es el nombre de pila o la razón social.** `Cliente`
guarda un solo nombre y para empresas es la razón social, así que "Hola
Distribuidora del Sur S.R.L." va a pasar. Se puede recortar al primer token,
pero eso rompe nombres compuestos. Lo dejo tal cual y lo marco.

**Los links son texto en el cuerpo, no botones.** Meta permite un botón URL
con sufijo variable, que se ve mejor y acorta el cuerpo. No lo uso en v1
porque suma superficie de aprobación y configuración en el alta. Es una
mejora clara para v2, cuando el camino canónico ya funcione.

**Sin footer.** Un footer tipo "Mensaje automático" refuerza la lectura
transaccional, pero no admite variables, así que sería idéntico para todos
los tenants. Queda como opción si algún texto vuelve rechazado.

**Los importes van formateados desde Grafo** (`185.400,00`), sin el `$` —
el símbolo está en el texto fijo. Si el importe viniera con `$`, saldría
`$$185.400,00`.

---

## 4. Cómo se prueba

Someter los 13 desde la cuenta de Corporearte y anotar qué categoría les
asigna Meta. Lo que se espera:

- **11 UTILITY**, incluido el #1 que es el dudoso.
- **2 MARKETING** (#2 y #13), a propósito.

Cualquier utility que vuelva como marketing significa que quedó una frase
promocional; se corrige el texto y se somete `_v2`. Cualquier rechazo
directo es otra cosa —formato, link, variable mal puesta— y hay que leer el
motivo que devuelve Meta.

Recién con eso confirmado se construye el modelo de datos de F2.
