# Cobro de suscripciones — Paddle (y MercadoPago después)

Estado: diseño 2026-07-24. Cómo la plataforma le cobra a los tenants.
Ver también `control-plane-diseno.md` (B1 planes / B2 billing).

## La decisión

**Paddle primero, MercadoPago después**, los dos detrás de una capa de
suscripción propia.

El motivo es concreto: **los primeros clientes que pagan están en Chile y
Honduras**. Ahí el valor de Paddle es real — es Merchant of Record y resuelve el
compliance fiscal en jurisdicciones donde Grupo Idea no tiene entidad. Construir
para los clientes que existen, no para los hipotéticos.

MercadoPago queda diseñado pero no implementado, para el riel argentino.

### Qué se investigó (2026-07-24)

Verificado contra doc oficial de Paddle:

- **MoR**: Paddle es el vendedor legal. Emite el comprobante al cliente final con
  su identificación fiscal; el seller **no** factura al cliente final.
- **Precios**: viven en el catálogo de Paddle (Products → Prices), editables por
  API. Hay `unit_price_overrides` por país (hasta 250) para precios locales.
- **Patrón oficial de entitlements**: *"store the `product_id` associated with
  each subscription and map a `product_id` to a set of features in code"* — o
  sea **precio en Paddle, features y límites en nuestra base**. Encaja tal cual
  con `Plan.featuresJson` + `SuscripcionesService.feature()`, que ya existen.
- **Webhooks**: `subscription.created` + `subscription.updated` cubren el ciclo
  de vida (renovación, upgrade, cambios de estado). Firma
  `Paddle-Signature: ts=…;h1=…`, HMAC-SHA256 sobre **`ts:rawBody`**, con el body
  **sin parsear**. SDK oficial `@paddle/paddle-node-sdk`.
- **Customer portal**: app hosteada de Paddle (medio de pago, facturas,
  cancelar). Se generan *portal sessions* por API pasando `subscription_ids`.
- **Dunning**: al fallar el cobro pasa a `past_due` y entra en Retain; ventana
  configurable (default 30 días) y acción final configurable.
- **Payouts**: mensual, mínimo USD 100, wire (fee USD 15) o Payoneer. Fee de
  Paddle 5% + USD 0,50. Argentina **no** está en la lista de países excluidos
  para vender.

### Trampas de la configuración de Paddle (costaron tiempo)

- **`traffic_source` de la destination.** Una notification destination puede
  recibir tráfico de *simulación*, de *plataforma* (eventos reales) o ambos. Si
  queda en simulación, se comporta de forma desconcertante: responde perfecto a
  los simulados y **ignora en silencio todo lo real** — el log de notificaciones
  queda vacío aunque el pago haya salido bien. Si un pago real no dispara nada
  pero el simulador sí, mirar esto primero.
- **Default payment link.** Sin él configurado (Checkout → Checkout settings),
  el overlay abre y muestra "Something went wrong" sin más detalle. Para sandbox
  vale `localhost`; la aprobación de dominio recién hace falta en producción.
- **El dominio de ngrok es `.ngrok-free.dev`**, no `.app`. Con el equivocado da
  `ERR_NGROK_3200 endpoint offline`, que parece un túnel caído y no lo es.
- Escribir el MISMO `custom_data` por API no emite `subscription.updated`:
  Paddle sólo notifica si algo cambió de verdad.

### Riesgo conocido del riel argentino (parked)

Una imprenta argentina es Responsable Inscripto: queda **fuera** de la percepción
de servicios digitales (RG 4240, que aplica sólo a no-inscriptos) y cae en
**importación de servicios** — debe autoliquidar el 21% de IVA y no recibe
Factura A. No es un bloqueo para arrancar (los primeros clientes son del
exterior), pero es la razón de ser del riel MercadoPago.

**Pendiente del contador** (no lo resuelve el equipo técnico): caracterización de
la venta doméstica vía MoR extranjero, régimen cambiario vigente para personas
jurídicas que exportan servicios, y estado de la percepción del 30%.

## Arquitectura: una capa, dos proveedores

```
   Tenant elige plan
         │
         ├── proveedor 'paddle'        ──> Paddle.js checkout ──> Paddle
         └── proveedor 'mercadopago'   ──> (futuro) preapproval ─> MP
                    │
                    ▼  webhooks normalizados
            Suscripcion (nuestra)  ── estado, plan, referencia externa
                    │
                    ▼
        SuscripcionesService.feature()   ← el gate NO se entera del proveedor
```

La clave: **el gate por plan no cambia**. `SuscripcionesService` sigue siendo el
único lector de `featuresJson`, y no sabe quién cobró.

### Quién es fuente de verdad de qué

| Dato | Fuente de verdad | Dónde vive |
|---|---|---|
| Monto del plan | **Paddle** | catálogo Paddle; espejo cacheado en `Plan.precioMensual` |
| Features y límites | **Nosotros** | `Plan.featuresJson` |
| Estado de la suscripción | **Paddle** | espejo en `Suscripcion`, vía webhooks |
| Comprobante al cliente | **Paddle** | no lo emitimos |
| Quién puede usar qué | **Nosotros** | `SuscripcionesService.feature()` |

`Plan.precioMensual` pasa a **USD** y a ser espejo (se sincroniza, no se edita a
mano). El MRR de la consola queda en USD.

### Cambios de schema

`Plan`: `paddlePriceId` (unique), `paddleProductId`, `moneda` (default USD).
`Suscripcion`: `proveedor` ('paddle' | 'mercadopago' | 'manual'),
`referenciaExterna` (subscription id, unique), `clienteExternoId` (customer id),
`estadoProveedor` (el status crudo, para no perder información al normalizar),
`proximoCobro`.
Nuevo `EventoCobro`: `{ proveedor, eventoId @unique, tipo, payloadJson, procesadoEl }`
— **idempotencia**: Paddle reintenta webhooks. Sin `tenantId` (el webhook llega
sin contexto), así que va a `SIN_TENANT_ID_JUSTIFICADOS` del spec de aislamiento.

### Normalización de estados

| Paddle | Nuestro `estado` | Efecto |
|---|---|---|
| `active`, `trialing` | `activa` | acceso normal |
| `past_due` | `activa` | **acceso con banner** — hay 30 días de dunning, no se corta al primer fallo |
| `paused`, `canceled` | `suspendida` / `baja` | se corta |

### Seguridad

- El webhook es público pero **siempre** verifica la firma antes de tocar nada.
  Body crudo, HMAC-SHA256 de `ts:rawBody`, tolerancia de tiempo contra replay.
- Idempotencia por `eventoId`: un reintento no duplica efectos.
- Las credenciales (`PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`) van por `.env`,
  nunca al repo.

## Fases

**F1 · Fundación + webhooks.** Schema + SDK + endpoint de webhook con firma e
idempotencia + normalizador de estados. *Entregable: Paddle sandbox emite un
evento y la suscripción del tenant se actualiza sola.*

**F2 · Checkout.** Paddle.js overlay: el tenant elige plan y se suscribe. Mapeo
Plan ↔ `price_id` administrable desde la consola.

**F3 · Vista de suscripción del tenant.** Plan vigente, uso vs. límites, estado y
próximo cobro. Las acciones transaccionales (medio de pago, facturas, cancelar)
delegan en el customer portal de Paddle vía portal session. Banner de `past_due`.

**F4 · RETIRADO (2026-07-24).** Se eliminó el billing de suscripciones del
control plane en vez de adaptarlo. Con Paddle como Merchant of Record el
comprobante al tenant lo emite Paddle, así que "pendientes de facturar" ya no
significa nada — y peor: el filtro no miraba el proveedor, con lo que un tenant
que ya pagó por Paddle habría aparecido para facturarle otra vez. La **Factura E
a Paddle** por el payout se hace a mano fuera del sistema, por decisión del
negocio (una por mes, y su tratamiento fiscal —bruto o neto— todavía depende del
contador).

Se borró: `PlataformaBillingService`, sus rutas, la tab de la consola y la tabla
`FacturaSuscripcion` (que nunca tuvo datos). Sobrevive `Tenant.esPlataforma`
(lo usan impersonación y auth) y `ComprobantesService.crearBorradorPorMonto`,
que queda sin uso pero es genérico y lo va a necesitar F5.

**F5 · MercadoPago.** Segundo proveedor detrás de la misma capa, para el riel
argentino: `preapproval_plan`/`preapproval`, webhooks, y ahí sí Grupo Idea le
factura al tenant (Factura A con crédito fiscal) — para eso se conservó
`crearBorradorPorMonto`.

## Contratar vs. cambiar de plan — y por qué no se espera el webhook

Dos caminos DISTINTOS, y confundirlos cobraba de más:

**Contratar (sin suscripción previa).** Hace falta el checkout: hay que cargar
una tarjeta. Pero al cerrarse, NO se espera el webhook — el front toma el
`transaction_id` del evento `checkout.completed` y llama a
`POST /suscripcion/sincronizar`, que lee la transacción en Paddle, resuelve la
suscripción y la aplica. Un segundo, no cuarenta.

**Cambiar de plan (ya hay suscripción).** NO abre checkout: `POST
/suscripcion/cambiar-plan` modifica la suscripción existente vía
`subscriptions.update` con `prorated_immediately`, usando la tarjeta en archivo.
Antes esto abría un checkout nuevo, lo que **le creaba al cliente una SEGUNDA
suscripción en Paddle y le cobraban las dos**. Se previsualiza el ajuste
(`previewUpdate`) antes de confirmar, así el usuario ve cuánto se le cobra ahora.

**Qué se le muestra antes de confirmar** (verificado contra la API, no supuesto):
`previewUpdate` devuelve dos cosas distintas y hay que separarlas —
`grand_total` es lo que se le **debita ahora** (upgrade) y `credit_to_balance`
lo que le queda **a favor** (downgrade). El crédito NO vuelve a la tarjeta:
queda como saldo del cliente y Paddle lo aplica solo a los cobros siguientes
(*"credit balances are automatically used to pay for future transactions"*, su
doc). Ejemplo real: de Diamante 290 a Estudio 100 → cobra 0, acredita US$189,92.

El webhook NO desaparece: queda para lo que pasa **sin el usuario delante** —
renovaciones, cobros fallidos, dunning, cancelaciones desde el portal. Es
idempotente, así que si llega después de la sincronización activa no duplica
nada.

La regla general: **para lo que el usuario acaba de pedir, se va a buscar el
resultado; para lo que pasa solo, se espera el aviso.** Una pantalla de espera
que depende de una llamada externa que puede fallar en silencio no genera
confianza — y de hecho falló en dev cuando se cayó el túnel.

## Facturas y medio de pago en la vista del tenant

- **Descarga del PDF**: `GET /suscripcion/facturas/:id/pdf` devuelve la URL que
  firma Paddle. Se pide en el momento porque **es temporal**: guardarla dejaría
  al cliente con un botón roto. Antes de pedirla se verifica que la transacción
  sea del tenant — sin ese chequeo, un id ajeno devolvería la factura de otro.
- **Estados**: se traducen (`billed` → "Procesando", `completed` → "Pagada"…).
  `billed`/`ready`/`draft` son PROVISORIOS: Paddle crea la transacción al
  instante y cobra unos segundos después, así que la vista se refresca sola
  hasta 3 veces mientras alguna siga provisoria. Antes decía "Billed" en inglés
  y se quedaba así hasta recargar a mano.
- **Tarjeta registrada** (VISA •••• 4242, vence 12/30): sale del pago de la
  última transacción cobrada, NO de `/customers/:id/payment-methods` — ese
  endpoint pide el permiso `payment_method.read`, que deliberadamente no tiene
  la API key. El dato es el mismo sin ampliar permisos. Es informativo:
  cambiarla se hace en el portal de Paddle.

## Cancelación

La cancela el cliente desde el portal de Paddle (ahí están la tarjeta y los
comprobantes). Paddle la programa para el **fin del período**: el cliente usa lo
que pagó hasta el último día.

**La trampa**: al cancelar, Paddle deja la suscripción en `status: active` y
pone un `scheduled_change: {action:'cancel', effective_at}`. Si sólo se mira
`status` —como se hacía— la pantalla dice "Activa" y el cliente **no ve que su
suscripción se termina**: hizo algo y nada lo refleja. Por eso `extraer()` lee
también `scheduled_change` y se guarda en `Suscripcion.cambioProgramado(El)`.

La vista lo dice fuerte ("Tu suscripción termina el 24 de agosto"), la píldora
del header pasa a "Se cancela", el resumen cambia "Próximo cobro" por "Termina
el", y se oculta el botón de cancelar. Y hay un **"Reactivar suscripción"** que
hace `scheduled_change: null` — recuperar a alguien que se arrepintió es lo más
barato que hay en un SaaS.

### Downgrade: por qué queda crédito y no se difiere

Decisión del negocio (2026-07-24): el downgrade es **inmediato con crédito a
favor**, proporcional a los días que quedan.

Se evaluó diferirlo al fin del período (lo estándar en la industria) y se
descartó por costo: **Paddle no lo soporta nativamente**, verificado contra la
API — `effective_from: next_billing_period` cambia el plan igual y sólo difiere
la plata; `scheduled_change` sólo admite cancel/pause/resume; y `do_not_bill`
cambia el plan sin dar crédito, que es lo peor. Implementarlo requeriría
programarlo por nuestra cuenta (campos de cambio pendiente + cron que aplique
poco antes del cobro).

El crédito NO vuelve a la tarjeta: queda como saldo del cliente y Paddle lo
aplica solo a los cobros siguientes.

## Prueba gratuita y ciclo anual (2026-07-24)

**Prueba con vencimiento.** `Plan.trialDias` (cuántos días otorga el plan) y
`Suscripcion.trialHasta` (cuándo termina, se fija al ASIGNAR el plan; cambiarle
el plan a alguien que ya está adentro no le regala una prueba nueva).

Los días restantes **se calculan, nunca se guardan** (`suscripciones/trial.ts`).
Un contador persistido se desactualiza solo y termina mostrándole "14 días" a
todo el mundo — que es literalmente el bug que tenía el sidebar. Si se calcula,
no puede mentir.

Al vencer, un cron diario pasa la suscripción a `suspendida`: cierra los gates
por plan (AFIP, WhatsApp) pero el tenant **sigue entrando y viendo todos sus
datos**, y con un pago vuelve a `activa` al instante por el webhook. Una prueba
que nunca termina no es una prueba; bloquearle el sistema a una imprenta sería
desproporcionado. El barrido sólo toca `proveedor: 'manual'`: si ya pagó, el
estado lo manda Paddle.

**Ciclo anual.** `Plan.paddlePriceIdAnual` + `Plan.precioAnual`: son DOS precios
distintos del mismo plan en Paddle, no un descuento aplicado sobre el mensual.
El checkout usa el priceId del ciclo elegido.

El **ahorro lo calcula el backend** (`compararAnual`), no el front: la misma
cuenta en dos lugares termina divergiendo. Devuelve `doceMeses` (la referencia),
`ahorro`, `ahorroPct` y `equivalenteMensual`. La tarjeta muestra el prorrateado
mensual y debajo "US$500 al año · ahorrás US$100 frente a US$600 pagando mes a
mes" — el monto solo no dice nada, la comparación sí.

## La card del sidebar: plan y días restantes (2026-07-24)

La card mostraba **"Plan diamante · 14/30 días" a todos los tenants**: valores
fijos escritos en el front, porque el backend nunca mandó el dato. Se habían
quitado para no mentir; ahora se traen de verdad.

El contexto de sesión (`/tenants/current`) pasa a llevar `tenantActual.suscripcion`
con plan, estado, días restantes y largo del período. Se lee en `auth.service`
—y no en `SuscripcionesService`— porque la sesión se arma **antes** de que haya
tenant en el AsyncLocalStorage, así que el `tenantId` va explícito.

**Por qué hizo falta una columna nueva.** Sólo se conocía el FIN del período
(`proximoCobro`). Para decir "faltan X de N días" hace falta también el
principio, y asumir N=30 sería falso en los planes anuales —el mismo tipo de
número inventado que se estaba corrigiendo. Paddle manda
`current_billing_period.starts_at` en cada evento de suscripción: se guarda en
`Suscripcion.periodoDesde` y de ahí sale el largo real del ciclo.

Reglas de la vista (`ciclo.ts`, con la misma disciplina que `trial.ts`: los días
se **calculan**, nunca se guardan):

- **En prueba** tiene prioridad sobre el cobro — lo que importa mientras dura es
  cuánto queda de prueba. El total sale de `Plan.trialDias`.
- **Sin `periodoDesde`** (filas anteriores a la columna) se muestran los días
  restantes **sin fracción**, y la barra queda llena. Se completa solo con el
  próximo evento de la pasarela.
- **Sin suscripción** (tenants legacy sin plan) la card no inventa nada: cae al
  texto neutro "Ver plan y facturación".
- Los restantes acotan el total, para que la barra nunca se pase de largo tras
  un reintento de cobro que corre `proximoCobro`.

## Fuera de alcance

Automatizar la Factura E (una por mes, manual es razonable). Precios por país con
`unit_price_overrides` (cuando haya volumen que lo justifique). Facturación por
uso/medida.
