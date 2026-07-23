# Notificaciones por WhatsApp — catálogo de eventos y control por tenant

**Fecha:** 2026-07-22
**Estado:** análisis, sin implementar. Insumo de F2.
**Relacionado:** `integraciones-wati-diseno.md`

---

## 1. Validar el catálogo contra una cuenta real

La idea de usar la cuenta de Corporearte como canario es correcta, pero
conviene ser preciso sobre **qué** valida, porque la parte que transfiere a
los demás tenants y la que no son distintas.

**Lo que transfiere.** La categorización de Meta la decide un clasificador
que mira **el texto**. El mismo texto tiende fuertemente a caer en la misma
categoría en cualquier WABA. Si `grafo_orden_lista_v1` entra como UTILITY
acá, entra como UTILITY en los demás. Eso es el 90 % del riesgo y es
exactamente lo que queremos descubrir antes de soltarlo.

**Lo que NO transfiere.** La aprobación no es una función pura del texto: el
historial y la calidad de la cuenta pesan en la revisión, y Meta
**recategoriza plantillas ya aprobadas** cuando cambia sus criterios. O sea
que el canario nos dice "este texto está bien escrito", no "esto se aprueba
siempre y para siempre". La reconciliación por cron (D3) sigue siendo
necesaria justamente por esto.

**Un cuidado.** Someter textos experimentales desde la cuenta productiva del
tenant no es gratis: los rechazos quedan en el historial de la cuenta. Vale
la pena mandar sólo textos ya revisados, y no usar la cuenta como banco de
pruebas de wording.

### 1.1 Por qué las plantillas actuales quedaron en MARKETING

Vale la pena mirarlo porque es la lección que ordena todo el catálogo. En
`nueva_orden_v4` el contenido es transaccional —número de orden, fecha,
importes— pero **cierra con un eslogan**:

> "¡Gracias por confiar en {{nombre_empresa}} para hacer realidad tus ideas!"

Para Meta alcanza con una frase promocional para que **toda** la plantilla
sea MARKETING; no existe la categoría mixta. Lo mismo con "¡Buenas
noticias!" seguido de invitaciones ("¡Te esperamos!").

O sea que no fue el tema del mensaje: fue el floreo de marca. Y eso implica
que **es reversible**: los textos canónicos de Grafo se escriben *para*
UTILITY desde el arranque.

Las reglas prácticas que salen de ahí:

- Sólo hechos sobre una transacción que el cliente ya inició.
- La empresa habla en **primera persona**: el mensaje sale de su número, así
  que es "recibimos tu orden", no "{{empresa}} recibió tu orden". Como
  consecuencia `nombre_empresa` no hace falta en ningún texto — WhatsApp ya
  muestra el remitente en el encabezado del chat.
- Nada de eslóganes, emojis de celebración al comienzo, ni llamadas a la
  acción que no sean el link de la propia transacción.
- Si el mensaje existe para que el cliente **vuelva a comprar** o para pedir
  algo que no es parte de la transacción (una reseña), es MARKETING y hay
  que aceptarlo. No todo se puede forzar a UTILITY, y forzarlo es lo que
  hace que Meta baje la calidad de la cuenta.

Además de la política, hay plata: UTILITY es más barata por conversación, y
los mensajes de utilidad dentro de una ventana de atención abierta salen
gratis con el esquema de precios por mensaje. **Conviene confirmar las
tarifas vigentes para Argentina antes de prometerle el ahorro a nadie**,
pero la dirección no está en duda.

---

## 2. El catálogo de plantillas muestra tres cosas, no dos

Tu pregunta era si el catálogo muestra las del tenant + las que somete
Grafo. Sí, pero hay un caso que se nos escapa si lo pensamos como dos
listas, y lo tenés encima ahora mismo: **Corporearte ya tiene seis
plantillas aprobadas que hacen el trabajo que Grafo va a querer hacer.**

Si Grafo somete `grafo_nueva_orden_v1` sin más, quedan dos plantillas para
el mismo evento, y ninguna de las dos es obviamente la que manda.

Entonces son tres grupos:

| Grupo | Qué es | Acciones |
|---|---|---|
| **Gestionadas por Grafo** | Del catálogo canónico, ya sometidas a este tenant | Ver estado y calidad, re-someter si quedó rechazada, ver la versión |
| **Del catálogo, sin someter** | Eventos que el tenant todavía no activó | Someter |
| **Propias del tenant** | Las que escribió a mano en Wati | Sólo lectura. Y —ver abajo— poder adoptarlas |

**La adopción.** Para un tenant que ya tiene plantillas buenas y aprobadas,
obligarlo a esperar 24-48 h por una versión de Grafo casi idéntica es
fricción pura. Como ya sabemos leer los parámetros por nombre y posición
(`mapearParametros`), se puede ofrecer "usar esta plantilla para el evento
*orden lista*" con un mapeo explícito posición → campo de Grafo.

No es F2 —F2 es que el camino canónico funcione— pero el modelo de datos
tiene que dejar la puerta abierta: la plantilla que un tenant usa para un
evento es **una referencia**, no un nombre hardcodeado.

---

## 3. Catálogo de eventos

Sacado de los estados que existen hoy en el sistema, no de una lista
genérica de notificaciones.

Estados reales: `Presupuesto` (borrador → enviado → pendiente_aprobacion →
aprobado | rechazado | vencido → convertido), `OrdenTrabajo` (borrador →
pendiente → produccion → finalizada → entregada), `Cobro.estadoAcreditacion`
(pendiente → acreditado | vencido), `Comprobante` (borrador → emitido →
anulado).

| # | Evento | Disparador | Categoría | Default | Por qué |
|---|---|---|---|---|---|
| 1 | Presupuesto enviado | `Presupuesto` → `enviado` | UTILITY (a confirmar) | ON | El cliente lo pidió. Es el caso limítrofe del catálogo: puede leerse como venta. **Candidato #1 para el canario.** |
| 2 | Presupuesto por vencer | cron, N días antes de `vencido` | MARKETING | OFF | Es un empujón comercial. Llamarlo utility es lo que baja la calidad de la cuenta. |
| 3 | Presupuesto aprobado | el cliente aprueba en el link público | UTILITY | ON | Acuse de una acción que hizo el cliente. |
| 4 | Orden recibida | `OrdenTrabajo` → `pendiente` | UTILITY | ON | Con fecha estimada y link de seguimiento. |
| 5 | Orden en producción | → `produccion` | UTILITY | OFF | Poco valor por sí solo y suma ruido. Que lo prenda quien lo quiera. |
| 6 | **Entrega demorada** | el ETA se corre más de N días | UTILITY | ON | El de más valor y el que nadie manda. Ya tenemos el motor de ETA y las fotos diarias: la información está, falta el aviso. |
| 7 | Orden lista | → `finalizada` | UTILITY | ON | Con saldo pendiente si lo hay. |
| 8 | Orden entregada | → `entregada` | UTILITY | OFF | Acuse de recibo; útil como constancia. |
| 9 | Pago recibido | `Cobro` → `acreditado` | UTILITY | ON | Ya lo tenés funcionando. |
| 10 | Saldo vencido | cron sobre cuenta corriente | UTILITY | OFF | Recordatorio de pago de una deuda existente: es utility. Sensible — default apagado. |
| 11 | Comprobante emitido | factura con CAE | UTILITY | OFF | Con link al PDF. |
| 12 | Pedido de reseña | N días después de `entregada` | MARKETING | OFF | Es marketing y está bien que lo sea. |

Doce eventos. Nueve utility, dos marketing honestos y uno a confirmar.

---

## 4. El control es de cuatro capas, no de una

Preguntaste por el toggle por tenant. Hace falta, pero solo no alcanza:
cada capa tapa un agujero distinto.

### 4.1 Toggle por evento y por tenant

Lo que pediste. `NotificacionConfig(tenantId, evento, activo, plantillaId)`.
Los defaults de la tabla de arriba.

### 4.2 Consentimiento, pero proporcionado

La primera versión de esto pedía opt-in explícito para todo, con
`aceptaWhatsapp` en `false` por defecto. Está mal, y el costo es concreto: el
módulo no manda **nada** hasta juntar consentimientos uno por uno, y un
sistema mudo se termina apagando.

Los hechos, sin adornos: **Wati no exige opt-in** — manda a cualquier número
y no hay ningún control técnico. La política de Meta sí lo pide, y el castigo
es indirecto pero real: la gente bloquea, baja la calidad del número, Meta
pausa plantillas y en el peor caso restringe el número.

Y lo que la gente bloquea es **el marketing**, no el aviso de su propia
orden. Un cliente que dejó su teléfono para trabajar con la imprenta y recibe
"tu orden está lista" no es a quien protege el opt-in.

Por eso el campo tiene **tres estados** y no dos:

| `aceptaWhatsapp` | Qué recibe |
|---|---|
| `null` — nunca se preguntó | Los 11 transaccionales. **No** los 2 promocionales. |
| `true` — aceptó | Todo. |
| `false` — pidió no recibir | **Nada**, ni siquiera lo transaccional. |

El tercero es el único que no admite matices: si alguien pidió que no le
escriban, no se le escribe.

La consecuencia práctica es que un tenant tiene el módulo andando el día que
conecta Wati, sin pedirle nada a nadie, y el opt-in queda donde de verdad
hace falta.

### 4.3 Idempotencia — el problema concreto que tenemos

`ordenes-trabajo.service.ts:1901`: **reabrir un paso de una OT finalizada la
devuelve a `produccion`.** Con la mesa de trabajo y los pasos materializados
eso no es un caso raro, es operación normal.

Sin protección, la secuencia finalizada → reabrir → finalizada le manda al
cliente "tu orden está lista" **dos veces**. Un operario que corrige tres
pasos genera tres avisos. Eso no es un bug menor: es la clase de cosa por la
que un tenant apaga la integración entera y no vuelve.

La regla: una notificación por `(orden, evento)`, con un ledger que registre
que ya salió. Reentrar a un estado no vuelve a disparar. Si hay que
re-notificar, es una acción explícita de un humano.

El evento 6 (demora) necesita además su propia regla, porque el ETA se
mueve todo el tiempo: notificar sólo si el corrimiento supera un umbral y no
más de una vez cada N días.

### 4.4 Horario y freno de mano

- **Ventana horaria.** Un WhatsApp automático a las 23:40 se lee como spam.
  Se envía dentro del horario laboral del tenant, que ya está modelado en
  el módulo de capacidad. Lo que caiga fuera espera; la cola de D5 hace eso
  gratis.
- **Kill switch.** Un botón para cortar todos los envíos sin desconectar la
  integración ni perder la configuración. Cuando algo se dispara mal, el
  tenant necesita frenarlo en un click, no razonar qué toggle apagar.

---

## 5. Orden sugerido

1. Escribir los 12 textos canónicos con las reglas de §1.1.
2. Someterlos desde la cuenta de Corporearte y ver qué categoría les
   asigna Meta. Ahí se confirma el evento 1 y se corrige lo que caiga mal.
3. Recién con los textos validados, construir el modelo de datos, la
   sumisión automática y el catálogo de tres grupos.

El paso 2 es barato y cambia el paso 3. Hacerlo al revés significa escribir
el modelo de datos alrededor de suposiciones sobre lo que Meta acepta.

---

## 6. Lo que queda abierto

- **Tarifas vigentes** de utility vs. marketing en Argentina, y si aplica lo
  de utility gratis dentro de la ventana de atención.
- **Cómo se recolecta el opt-in.** Es un problema de producto, no técnico:
  el tenant tiene clientes cargados hace años que nunca dijeron que sí.
- **Qué pasa con las respuestas.** Si el cliente contesta el WhatsApp, hoy
  no hay nadie del lado de Grafo. Es la puerta a un módulo de conversaciones
  y conviene decidir explícitamente que **no** lo hacemos en F2.
