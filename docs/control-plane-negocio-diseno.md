# Control plane — Inteligencia de negocio del ecosistema (tab "Negocio")

Estado: diseño 2026-07-24. Módulo del control plane (backoffice de Grupo Idea
sobre todos los tenants). Ver también `control-plane-diseno.md`,
`reportes-inteligentes-estudio.md` (el análogo a nivel tenant).

## El problema (y el encuadre)

El usuario pidió "estadísticas de ventas de los tenants, facturación, por
categoría… todo eso sirve para saber qué mejoras podemos hacerle a la
plataforma".

**El encuadre importa**: esto NO es reconciliación financiera de cada tenant
(eso lo tiene cada uno en su Panel). Es **inteligencia de producto para el
equipo de Grafo**: ¿qué mueve el ecosistema de imprentas que corre sobre la
plataforma? ¿Qué se vende? ¿Qué features se adoptan? La pregunta que responde
cada número es *"¿dónde invertimos el próximo mes de desarrollo?"*.

Consecuencia de diseño: priorizamos **GMV del ecosistema, mix por categoría y
señales de adopción**, no el aging de cobranza ni el detalle fiscal.

## Lo que ya existe (no reinventar)

- **Patrón cross-tenant probado**: `@SinTenant` en el controller → el handler
  corre fuera del `AsyncLocalStorage` → `tenant-guard.extension.ts` no inyecta
  `tenantId` → un `groupBy(['tenantId'])` o un `$queryRaw` ven TODOS los
  tenants. Testeado en `aislamiento-tenants.spec.ts` ("sin contexto el guard NO
  filtra — deliberado"). Es la base de los crons y de la consola actual.
- **Medida canónica de venta** (idéntica en todo el módulo `reportes/` del
  tenant): `SUM(OrdenTrabajoItem.subtotal)` de OT con `estado <> 'borrador'`,
  fechada por `OrdenTrabajo.fechaEmision`. NO es la Cotización ni el Comprobante.
- **Tres capas separadas**: vendido (OT items, neto) / facturado (Comprobante
  emitido, no anulado, fiscal) / cobrado (Cobro montoBruto, no anulado).
- **Categoría denormalizada** en `OrdenTrabajoItem.categoriaComercial` /
  `subcategoriaComercial` (string snapshoteado al crear la orden → se agrega sin
  joins, vale también para OT manuales). `ProductoCategoriaComercial` es tabla
  GLOBAL (sin tenantId) → eje común entre tenants.
- **Charts del kit** (`src/components/plataforma/kit.tsx`): `AreaChart` (serie
  temporal), `Bars` (mensual), `Donut` (distribución), `Kpi` con `delta`+`spark`.

## Decisiones de arquitectura

1. **Tab nueva "Negocio", no extender Observabilidad.** Observabilidad = salud
   de la plataforma (tenants en riesgo, cola WhatsApp, storage). Negocio = el
   negocio agregado que hacen los tenants. Son preguntas distintas. La tab de
   "Facturación" existente es el billing de SUSCRIPCIONES (lo que los tenants le
   pagan a Grafo) — no confundir con la facturación que los tenants le hacen a
   SUS clientes, que es lo que mide esta tab.

2. **Endpoint dedicado `GET /plataforma/negocio?periodo=`, service propio.** NO
   colgarlo del payload de `consola()`: las agregaciones de ventas joinean
   `OrdenTrabajoItem` (alto volumen) y no deben frenar la carga de la consola.
   Lazy: se pide sólo al abrir la tab. Mismo patrón que el `reportes.controller`
   del tenant (un endpoint por tab). Service `NegocioPlataformaService` propio,
   nunca reusar los services del tenant (principio del control plane).

3. **Selector de período** (30d / 90d / 12m), como el Panel del tenant. El
   endpoint recibe `?periodo=` y calcula los cortes; los deltas se comparan
   contra el período anterior de igual largo.

4. **Por-tenant nombrado está OK.** El staff de Grafo ya ve datos por-tenant en
   Observabilidad/Tenants; es el dueño de la plataforma (procesador de los
   datos). El ranking de imprentas por ventas es nombrado y útil. (Nota de
   privacidad: esto es consumo interno del equipo de Grafo; nunca se expone a un
   tenant el dato de otro. Corporearte es un tenant más y aparece como uno más.)

5. **`$queryRaw` para los cortes por dimensión** (categoría), igual que los
   services de `reportes/`; `groupBy` de Prisma para los rollups simples por
   tenant. El raw no pasa por el guard igual, y el `@SinTenant` cubre el resto.

## Framework: las tres capas × dimensiones

```
                 ┌─ total ecosistema (GMV, Σ neto)
   VENDIDO ──────┼─ serie temporal (12 semanas / meses)
  (OT items)     ├─ × categoría comercial   ← "por categoría" del pedido
                 ├─ × tenant (ranking imprentas)
                 └─ × tecnología / medida    (F2, viven en JSON)

   FACTURADO ────── Σ Comprobante emitido no anulado  (adopción facturación e.)
   (fiscal)

   COBRADO ──────── Σ Cobro no anulado                (caja del ecosistema)

   ADOPCIÓN ─────── # tenants con ventas / presupuestos / facturación / ...
```

## Catálogo de métricas y semáforo de viabilidad

🟢 dato hoy, barato · 🟡 dato hoy pero caro/parcial (JSON, necesita historia) · 🔴 falta captura

| Métrica | Fuente | Viab. | Fase |
|---|---|---|---|
| **GMV ecosistema** (Σ neto vendido) + delta | `OrdenTrabajoItem.subtotal` | 🟢 | F1 |
| Serie temporal de ventas (12 sem) | fechas `fechaEmision` 84d | 🟢 | F1 |
| Órdenes + ticket promedio del ecosistema | OT no-borrador | 🟢 | F1 |
| **Mix por categoría comercial** | `oti.categoriaComercial` | 🟢 | F1 |
| **Ranking de tenants por ventas** (% del total, concentración) | groupBy tenantId | 🟢 | F1 |
| Facturado fiscal (Σ Comprobante emitido) | `Comprobante` | 🟢 | F1 |
| Cobrado (Σ Cobro) | `Cobro` | 🟢 | F1 |
| Adopción: # tenants con ventas / presupuestos / facturación | distinct counts | 🟢 | F1 |
| Mix por tecnología (láser/UV/DTF/eco) | `jobContextJson->>'tecnologia'` | 🟡 | F2 |
| Estándar vs a medida | `jobContextJson->>'medidaModo'` | 🟡 | F2 |
| Attach rate de adicionales | `oti.adicionalesJson` | 🟡 | F2 |
| Embudo comercial agregado (conversión/fugas benchmark) | `Cotizacion` cohorte | 🟡 | F2 |
| Distribución de tamaño de tenant (histograma GMV) | ranking | 🟢 | F2 |
| Insights en lenguaje de producto ("el 70% del GMV es cartelería → invertir en gran formato") | reglas sobre lo anterior | 🟡 | F3 |
| Benchmark por tenant (percentil de conversión/ticket vs ecosistema) | cruces | 🟡 | F3 |

## F1 — payload

`GET /plataforma/negocio?periodo=30d|90d|12m` → `NegocioPlataforma`:

```ts
type NegocioPlataforma = {
  periodo: { desde: string; hasta: string; etiqueta: string; clave: '30d'|'90d'|'12m' };
  kpis: {
    ventas: number;        ventasPrev: number;    // GMV neto del ecosistema
    ordenes: number;       ordenesPrev: number;
    ticketPromedio: number;
    facturado: number;     facturadoPrev: number;  // fiscal (Comprobante emitido)
    cobrado: number;       cobradoPrev: number;
    presupuestos: number;                          // cotizaciones formales emitidas
  };
  serie: Array<{ periodo: string; ventas: number; facturado: number }>; // buckets sem/mes
  porCategoria: Array<{ categoria: string; ventas: number; ordenes: number; pct: number }>;
  porTenant: Array<{ tenantId: string; nombre: string; slug: string;
                     ventas: number; ordenes: number; ticket: number; pct: number }>;
  adopcion: { totalTenants: number; conVentas: number;
              conPresupuestos: number; conFacturacion: number };
};
```

Semántica honesta (meta expuesta en la UI, como en el Panel): "Ventas = neto
sin IVA (Σ subtotal de órdenes emitidas). Facturado = comprobantes fiscales
emitidos. No incluye borradores." Consistente con
`feedback_panel_ventas_neto_sin_iva`.

## Journey del usuario (equipo de Grafo)

1. Entra a la consola → tab **Negocio**. Ve el GMV del ecosistema del período y
   su tendencia: *"¿está creciendo el negocio que corre sobre nosotros?"*.
2. Mira el **mix por categoría**: *"el 60% del GMV es cartelería/gran formato →
   ahí conviene invertir tooling (simuladores, nesting)"*.
3. Mira el **ranking de tenants**: *"3 imprentas hacen el 70% del GMV →
   cuidarlas; hay una cola larga de tenants con poco uso → problema de
   activación"*.
4. Mira **adopción**: *"solo el 40% factura electrónicamente → oportunidad de
   onboarding de AFIP"*.
5. Cambia el período (90d/12m) para ver estacionalidad y sostener decisiones.

Cada pantalla apunta a una decisión de PRODUCTO, no a un cobro.

## Performance

- `OrdenTrabajoItem.categoriaComercial` no tiene índice dedicado; el corte por
  categoría es un scan filtrado por fecha. Con pocos tenants (hoy 1 en dev) es
  trivial; a escala, evaluar índice `(fechaEmision)` en OT y materializar un
  rollup diario (fuera de alcance de F1). Anotado, no prematuro.
- Un solo `Promise.all` de ~6 queries por request. Deltas: traer fechas del
  doble de ventana y bucketizar en memoria (patrón `enVentana` de la consola),
  no N queries por ventana.

## F2 — implementado 2026-07-24

Se sumaron al mismo endpoint (`GET /plataforma/negocio`) y al mismo payload:
- **`porTecnologia`**: mix por tecnología (láser/UV/DTF/eco…) desde
  `CotizacionItem.jobContextJson->>'tecnologia'` (LEFT JOIN; ítems sin cotización
  → "Sin especificar"). Top 6 + "Otras". Front: donut como el de categoría, con
  mapa de etiquetas (`dtf_textil` → "DTF textil", etc.).
- **`medidas`**: estándar vs a medida desde `jobContextJson->>'medidaModo'`
  (`predefinida`/`personalizada`), sobre ítems cotizados. Front: barra apilada +
  `pctEstandar`.
- **`adicionales`**: attach rate (`itemsCon/itemsTotales`) + top de etiquetas
  vía `jsonb_array_elements_text(oti.adicionalesJson)`. Front: chips.
- **`embudo`**: benchmark de conversión del ecosistema sobre la cohorte de
  presupuestos formales (`Cotizacion.numero != null`, por `fechaEnvio`):
  emitidas → aprobadas → producción → entregadas (producción/entrega salen de la
  OT convertida), tasas y fugas por `motivoPerdida`. Front: funnel de barras +
  KPIs laterales.

Verificado E2E (DTF 48% / UV 18% / Offset 17%; 64% estándar; attach 39%; embudo
4→4→1→0, 100% aprobación) + 2 casos nuevos en `negocio.spec.ts` (adicionales y
embudo con fixtures). El histograma de tamaño de tenant se dejó afuera (se deriva
del ranking; bajo valor con pocos tenants).

## Fuera de alcance (queda F3)

Histograma de distribución de tamaño de tenant (client-side desde el ranking
cuando haya más tenants). **F3**: insights en lenguaje de producto ("el 48% del
GMV es textil → priorizar DTF"), benchmarking por tenant (percentil de
conversión/ticket vs. ecosistema), y materialización de rollups diarios si el
volumen lo pide (OrdenTrabajoItem.categoriaComercial no tiene índice dedicado).
