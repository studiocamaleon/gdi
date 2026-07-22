# Textos canónicos de las plantillas de Grafo

**Fecha:** 2026-07-22
**Estado:** para revisar antes de someter a Meta.
**Relacionado:** `notificaciones-whatsapp-catalogo.md`

---

## 0. Las reglas que se siguieron

**La empresa habla en primera persona.** El mensaje sale del número del
tenant: para el cliente, es su imprenta escribiéndole. Entonces es "recibimos
tu orden", nunca "{{empresa}} recibió tu orden" — eso último suena a que
habla un tercero, y delata que atrás hay un sistema.

**Por eso `nombre_empresa` no existe en ninguna plantilla.** Quien habla no
necesita nombrarse, y WhatsApp ya muestra el nombre del remitente en el
encabezado del chat. Sacarlo eliminó **8 parámetros** del catálogo: 61 → 53.

**Sin eslóganes.** Es lo único que tumbó las plantillas actuales a MARKETING
(`catalogo` §1.1). Ninguno de estos textos agradece la elección, invita a
volver ni celebra la marca.

**Con emojis.** Mi instinto era sacarlos todos, y estaba mal: tu
`recibo_pago_v2` tiene 💳, ⬇️ y 😀 **y Meta lo categorizó UTILITY**. La
evidencia de tu propia cuenta dice que los emojis no mueven la categoría.
Así que se usan, moderados y funcionales — sacarlos habría sido superstición
disfrazada de prudencia.

**Cerrar con una línea que confirme que es transaccional.** "Si no lo
pediste, ignorá este mensaje", "no necesitás hacer nada por ahora". Es barato
y refuerza la lectura de utility.

**Restricciones de Meta que condicionan la redacción:**

- El cuerpo **no puede empezar ni terminar con una variable**. Por eso todos
  arrancan con "Hola" y cierran con texto fijo.
- Dos variables no pueden ir pegadas.
- Máximo 1024 caracteres de cuerpo y 60 de footer.
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
Hola {{1}}, acá va el presupuesto {{2}} que nos pediste. 📄

Importe total: ${{3}}
Válido hasta: {{4}}

Para verlo en detalle y aprobarlo: {{5}}

Si no lo pediste, ignorá este mensaje.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_presupuesto` | P-00142 |
| 3 | `total` | 185.400,00 |
| 4 | `fecha_vencimiento` | 05/08/2026 |
| 5 | `url_presupuesto` | https://app.grafo.ar/p/a1b2c3 |

---

### 2 · `grafo_presupuesto_por_vencer_v1` — MARKETING · default OFF

> Es un empujón comercial. Va como marketing porque **lo es**.

```
Hola {{1}}, te recordamos que el presupuesto {{2}} vence el {{3}}.

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
Hola {{1}}, recibimos tu aprobación del presupuesto {{2}} por ${{3}}. ✅

Copia del presupuesto aprobado: {{4}}

Ya preparamos la orden de trabajo y te avisamos cuando entre en producción.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_presupuesto` | P-00142 |
| 3 | `total` | 185.400,00 |
| 4 | `url_presupuesto` | https://app.grafo.ar/p/a1b2c3 |

---

### 4 · `grafo_orden_recibida_v2` — UTILITY · default ON

```
Hola {{1}}, recibimos tu orden {{2}}. 🧾

📅 Entrega estimada: {{3}}

Podés seguir el avance acá: {{4}}

Si la fecha cambia, te avisamos por este medio.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_orden` | OT-01285 |
| 3 | `fecha_estimada` | 29/07/2026 |
| 4 | `url_seguimiento` | https://app.grafo.ar/s/x7y8z9 |

---

### 5 · `grafo_orden_en_produccion_v2` — UTILITY · default OFF

```
Hola {{1}}, ya empezamos a producir tu orden {{2}}. 🖨️

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
Hola {{1}}, te avisamos de un cambio en la fecha de tu orden {{2}}.

📅 Entrega estimada: pasó del {{3}} al {{4}}.

Detalle actualizado: {{5}}

Si necesitás coordinar algo, respondenos por acá.
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
Hola {{1}}, tu orden {{2}} ya está lista. 📦

Podés pasar a retirarla por nuestro local o, si pediste envío, te avisamos cuando salga.

Detalle: {{3}}

No tenés saldo pendiente por este trabajo.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_orden` | OT-01285 |
| 3 | `url_seguimiento` | https://app.grafo.ar/s/x7y8z9 |

---

### 8 · `grafo_orden_lista_con_saldo_v1` — UTILITY · default ON

```
Hola {{1}}, tu orden {{2}} ya está lista. 📦

💰 Saldo pendiente: ${{3}}

Podés pasar a retirarla por nuestro local o, si pediste envío, te avisamos cuando salga.

Detalle: {{4}}

Si ya lo abonaste, puede que todavía no lo hayamos registrado.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_orden` | OT-01285 |
| 3 | `saldo_pendiente` | 92.700,00 |
| 4 | `url_seguimiento` | https://app.grafo.ar/s/x7y8z9 |

---

### 9 · `grafo_orden_entregada_v1` — UTILITY · default OFF

```
Hola {{1}}, confirmamos la entrega de tu orden {{2}} el {{3}}. ✅

Guardá este mensaje como constancia.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_orden` | OT-01285 |
| 3 | `fecha_entrega` | 29/07/2026 |

---

### 10 · `grafo_pago_recibido_v1` — UTILITY · default ON

> Reemplaza a `recibo_pago_v2`, que ya es UTILITY. El cambio: suma el saldo
> restante, que es la pregunta que el cliente se hace justo después de pagar.

```
Hola {{1}}, registramos tu pago de ${{2}} para la orden {{3}}. 💳

Saldo restante: ${{4}}

*Ver recibo:* {{5}}

Este mensaje es la constancia de que registramos el pago.
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
Hola {{1}}, nos figura un saldo vencido en tu cuenta.

💰 Importe: ${{2}}
📅 Venció el: {{3}}

Detalle de la cuenta: {{4}}

Si ya lo abonaste, avisanos y lo regularizamos.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `monto_vencido` | 92.700,00 |
| 3 | `fecha_vencimiento` | 15/07/2026 |
| 4 | `url_cuenta` | https://app.grafo.ar/c/p9q8r7 |

---

### 12 · `grafo_comprobante_emitido_v1` — UTILITY · default OFF

```
Hola {{1}}, emitimos tu {{2}} N° {{3}} por ${{4}}. 🧾

Podés descargarla acá: {{5}}

También te queda disponible en el seguimiento de tu orden.
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

Nos ayuda mucho saber tu opinión. Si tenés un minuto, podés dejarnos una reseña acá: {{3}}

Si preferís no hacerlo, no hay problema.
```

| # | Parámetro | Ejemplo |
|---|---|---|
| 1 | `nombre_cliente` | Marcela |
| 2 | `numero_orden` | OT-01285 |
| 3 | `url_resena` | https://g.page/r/ejemplo/review |

---

## 3. Decisiones para revisar

**"Nuestro local" en las dos de orden lista.** Es lo único que asume algo
del tenant: que tiene local donde retirar. La frase cubre las dos ramas
("o, si pediste envío, te avisamos cuando salga"), así que no queda mal para
uno que sólo despacha, pero si aparece un tenant 100 % delivery habrá que
desdoblarla.

**`{{nombre_cliente}}` es el nombre de pila o la razón social.** `Cliente`
guarda un solo nombre y para empresas es la razón social, así que "Hola
Distribuidora del Sur S.R.L." va a pasar. Se puede recortar al primer token,
pero eso rompe nombres compuestos. Lo dejo tal cual y lo marco.

**Los links son texto en el cuerpo, no botones.** Meta permite un botón URL
con sufijo variable, que se ve mejor y acorta el cuerpo. No lo uso en v1
porque suma superficie de aprobación y configuración en el alta. Es una
mejora clara para v2, cuando el camino canónico ya funcione.

**Footer fijo: `Tecnología desarrollada por Grafoprint`** (38 de los 60
caracteres que permite Meta). Va en las 13.

Que no admita variables —lo que antes anoté como limitación— acá es
justamente lo que se busca: idéntico en todos los tenants.

Y no es una apuesta. Tu `recibo_pago_v2` **es UTILITY** y ya lleva
`"Tecnologia desarrollada por Corporearte."`, así que sabemos que un footer
de atribución no mueve la categoría. Se escribe con tilde: los cuerpos ya
llevan emojis, el encoding no es problema.

Dos cosas que conviene tener presentes, ninguna bloqueante:

- El tenant paga cada conversación y el mensaje sale de **su** número, así
  que está pagando por mostrar la marca de Grafo a sus propios clientes.
  Alguno lo va a plantear. Es una decisión comercial, no técnica.
- Si alguna vez se vende "sacá la marca" como plan superior, el footer no se
  puede cambiar por tenant: hace falta un **segundo juego de 13 plantillas**
  sin footer, sometido aparte. Caro de retrofitear, gratis de prever — y el
  diseño ya lo contempla, porque la plantilla que un tenant usa para un
  evento quedó definida como una **referencia** y no como un nombre fijo
  (`catalogo` §2).

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
