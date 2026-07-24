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

**F4 · Lado plataforma.** La tab Facturación de la consola pasa a reflejar el
estado real de Paddle; B2 se vuelve consciente del proveedor (no emitir factura a
tenants cobrados por Paddle); MRR en USD. La **Factura E a Paddle** por el payout
arranca manual (es una por mes) y se documenta.

**F5 · MercadoPago.** Segundo proveedor detrás de la misma capa, para el riel
argentino: `preapproval_plan`/`preapproval`, webhooks, y ahí sí la Factura A/B
que B2 ya sabe emitir.

## Fuera de alcance

Automatizar la Factura E (una por mes, manual es razonable). Precios por país con
`unit_price_overrides` (cuando haya volumen que lo justifique). Facturación por
uso/medida.
