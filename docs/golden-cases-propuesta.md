# Golden cases — propuesta para revisión

**Propósito:** fijar ~40 ejemplos estándar de cotización que después se usarán como red de seguridad durante la migración al modelo universal. Cada caso aprobado será un test automatizado que compara el resultado del cálculo antes y después del refactor — si algún número cambia, se enciende una alerta.

**Cómo revisar:** por cada caso decime una de tres cosas:
- **Sí** — es un pedido real y típico; lo dejamos.
- **No** — nunca lo pediríamos en esta operación; lo sacamos.
- **Cambiar a X** — mantenemos el caso pero ajustamos algún parámetro.

También podés agregar casos que me olvidé o que son específicos de tu operación.

**Limitante práctica:** de los ~40 casos propuestos, sólo podremos testear los que tengan un producto ya configurado hoy en el sistema. Hoy hay 9 productos:
- 4 en `impresion_digital_laser`
- 2 en `talonario`
- 1 en `rigidos_impresos`
- 1 en `vinilo_de_corte`
- 1 en `gran_formato` (stub, no testea)

Los casos marcados **(sin producto actual)** requieren configurar el producto antes de poder testearse, o los excluimos de la red de seguridad inicial (se agregan más adelante cuando existan).

---

## Motor: impresión digital / láser (12 casos)

Los cubren los 4 productos configurados. Varío cantidades, medidas y adicionales.

| # | Caso | Cantidad | Detalle |
|---|---|---:|---|
| D1 | Tarjetas personales estándar | 100 | 90×50mm · cartulina 300gr · simple faz CMYK |
| D2 | Tarjetas personales con laminado | 500 | 90×50mm · cartulina 300gr · doble faz CMYK + laminado brillo |
| D3 | Flyers promocionales A5 | 1.000 | 148×210mm · ilustración 150gr · simple faz CMYK |
| D4 | Volantes masivos A6 | 2.000 | 105×148mm · obra 90gr · doble faz CMYK |
| D5 | Folletos tríptico A4 | 200 | 297×210mm · ilustración 150gr · doble faz CMYK + doble pliegue |
| D6 | Menús de restaurante | 300 | 148×210mm · ilustración 300gr · doble faz + laminado mate ambas caras |
| D7 | Invitaciones 15×15 | 100 | 150×150mm · cartulina 300gr · simple faz CMYK + sobre |
| D8 | Calendarios de pared | 500 | 297×420mm · offset 300gr · simple faz + argollado + colgador |
| D9 | Certificados en opalina | 80 | 210×297mm · opalina 200gr · simple faz + **foil dorado** |
| D10 | Volantes económicos B/N | 1.500 | 105×148mm · bond 80gr · blanco y negro una cara |
| D11 | Postales con esquinas redondas | 150 | 100×150mm · ilustración 300gr · doble faz + **troquelado redondeado** |
| D12 | Carpetas corporativas | 50 | 215×310mm abierta · cartulina 250gr · simple faz + **troquelado + troquel inserto tarjeta** |

Casos con **adicionales** (laminado, foil, troquelado, argollado) en negrita. D9, D11 y D12 estresan el motor en zonas menos usadas.

---

## Motor: talonario (10 casos)

Cubiertos por los 2 productos configurados. Varío tipo de copia, modo pliego y acabados.

| # | Caso | Cantidad | Detalle |
|---|---|---:|---|
| T1 | Recibos profesional | 20 talonarios | 50 hojas · 14×20cm · copia simple · numeración + abrochado |
| T2 | Notas de entrega | 50 talonarios | 100 hojas · 14×20cm · duplicado · numeración + emblocado |
| T3 | Remitos comerciales | 10 talonarios | 25 hojas · 21×15cm · triplicado · puntillado vertical + numeración |
| T4 | Vales de mostrador | 30 talonarios | 50 hojas · 9×13cm · copia simple · sin numeración |
| T5 | Formularios contadores | 100 talonarios | 100 hojas · 14×20cm · cuadruplicado · numeración + emblocado |
| T6 | Cuaderno de inspección | 15 talonarios | 50 hojas A4 doble faz · copia simple · numeración + tapa cartulina |
| T7 | Facturas A | 40 talonarios | 50 hojas · 14×20cm · duplicado · puntillado horizontal mitad + numeración + abrochado con grapas |
| T8 | Entradas numeradas | 25 talonarios | 50 hojas · 18×25cm · copia simple · 2 números por página + abrochado |
| T9 | Libro contable grande | 5 talonarios | 200 hojas A4 · duplicado · **modo aprovechar pliego** + emblocado |
| T10 | Recibos con autocopiativo | 60 talonarios | 50 hojas · 10×15cm · duplicado · **papel autocopiativo** + puntillado + emblocado |

T9 estresa el modo incompleto de aprovechar pliego (feature específica de talonario). T10 estresa el papel autocopiativo con duplicado.

---

## Motor: rígidos impresos (10 casos, uno solo producto hoy)

**Importante:** hay un solo producto configurado en este motor. Todos los casos varían inputs sobre ese producto. Si algún caso no encaja en las posibilidades que acepta el producto actual, necesitaríamos agregar configuración (o excluir).

| # | Caso | Cantidad | Detalle |
|---|---|---:|---|
| R1 | Cartel PVC básico | 1 pieza | PVC 5mm · 60×40cm · impresión UV directa una cara |
| R2 | Cartelería PVC | 5 piezas | PVC 10mm · 80×120cm · impresión UV + corte rectangular |
| R3 | Dibond exterior | 1 pieza | Dibond 3mm · 100×50cm · impresión UV + corte perimetral |
| R4 | Placa reconocimiento acrílico **(sin producto actual)** | 10 piezas | Acrílico 5mm · 30×40cm · grabado láser + impresión UV localizada |
| R5 | Back-light retail **(sin producto actual)** | 3 piezas | Acrílico 120×80cm · impresión UV + laminado anti-rayadura |
| R6 | Cartel MDF CNC **(sin producto actual)** | 1 pieza | MDF 18mm · 200×100cm · corte CNC + pintura esmalte |
| R7 | Porta-menú mesa | 20 piezas | Acrílico 3mm · 20×10cm · impresión UV 2 caras |
| R8 | Señalización Sintra completa **(sin producto actual)** | 2 piezas | Sintra 10mm · 150×50cm · impresión UV + ojales metálicos + soporte |
| R9 | Cartel con laminado | 1 pieza | PVC 3mm · 80×60cm · impresión UV + vinilo adhesivo encima |
| R10 | Placas individuales signage | 5 piezas | Acrílico 5mm · 40×40cm · impresión 1 cara + troquelado circular |

Varios casos están marcados sin producto porque requieren materiales/acabados que puede no haber en la config actual (acrílico para grabado láser, MDF con CNC, Sintra con ojales, etc.). Lo validás vos.

---

## Motor: vinilo de corte (8 casos)

Un solo producto configurado. Varío cantidades, medidas y colores.

| # | Caso | Cantidad | Detalle |
|---|---|---:|---|
| V1 | Logos aplicables | 10 piezas | 20×20cm · vinilo adhesivo color único (negro) |
| V2 | Cartel vidriera | 2 piezas | 150×60cm · vinilo adhesivo dos colores (blanco + rojo) |
| V3 | Stickers promocionales pequeños | 50 piezas | 8×5cm · vinilo adhesivo un color |
| V4 | Rotulación perimetral auto | 1 pieza | 300×50cm · vinilo adhesivo un color (blanco) |
| V5 | Logos multi-color con encajado | 20 piezas | 15×10cm · vinilo adhesivo 3 colores |
| V6 | Rotulación vidriera local | 1 pieza | 500×100cm · vinilo adhesivo un color |
| V7 | Decoración ventana transparente | 10 piezas | 30×30cm · vinilo transparente con corte de contorno |
| V8 | Sticker masivo pequeño | 100 piezas | 5×5cm · vinilo adhesivo un color |

---

## Motor: gran formato (NO se arma golden suite hoy)

Hay 1 producto pero el motor es **stub** — no calcula. Por eso este motor entra recién en Etapa B (piloto) donde se implementa desde cero sobre el modelo nuevo. No se arma red de seguridad para él en Etapa A, porque no hay comportamiento actual que preservar.

---

## Resumen para decidir

- **38 casos propuestos** distribuidos en los 4 motores con comportamiento actual.
- **~7 casos requieren productos no configurados** (todos en rígidos impresos). Decisión: excluir de la red inicial o configurar primero.
- **31 casos testables directamente** sobre los 9 productos existentes.

**Lo que necesito de vos (con tiempo, no hay apuro):**

1. Recorrer la lista y marcar: **sí / no / cambiar a X / agregar Y**.
2. Sobre los casos marcados como "sin producto actual": ¿los configuramos o los dejamos para después?
3. Si hay casos de tu día a día que no aparecen, agregar.

Con tu revisión, esta lista se convierte en la base para A.1. Cada caso aprobado termina siendo un archivo de input + un snapshot de salida en la red de seguridad.
