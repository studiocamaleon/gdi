# Embudo comercial — nuevo tab del Panel general · diseño

Estado: **diseño** (sin implementar). Autor del análisis: sesión 2026-07-18.
Encuadre: nace de tener Presupuestos andando (F1+F2 en main, merge `e211ba63`) y
querer cerrar el ciclo cotización → producción en una sola lectura del Panel.

---

## 1. Objetivo y encuadre

**Pregunta que responde:** de todo lo que cotizamos, ¿cuánto avanza y dónde se
cae? Es *salud del pipeline*, no *performance de ventas cerradas*.

**Por qué un tab nuevo y no dentro de "Comercial".** El tab `comercial` de hoy
([panel-general.tsx](../src/components/panel/panel-general.tsx) `TabComercial`,
L629) es sobre ventas ya realizadas: facturación, ticket, mix, ranking,
estacionalidad, dormidos. El embudo es otra pregunta —conversión y fuga— y
merece su propio tab. Va entre `comercial` y `clientes` en el array `TABS`.

**Alcance del funnel:** 4 etapas, **cierra en Entregadas**. Se sacó
"Facturadas" a propósito: facturación es el eje fiscal, ya cubierto en Finanzas
y Administración. Beneficio lateral: el backend sólo toca `Cotizacion` +
`OrdenTrabajo` (encadenadas por `cotizacionId` / `convertidaOrdenId`), no cruza
`Comprobante` ni el puente `ComprobanteOrden`.

**Qué NO es:** no es el listado de presupuestos (eso ya existe en su módulo), no
es forecast, no toca el eje de cobranza.

---

## 2. Estados y semántica de cohorte (el corazón del diseño)

### 2.1 El problema de la "foto de estados"

El ejemplo original mezclaba estados actuales. Ahí hay una trampa: una OT ya
entregada **ya no está** en `produccion`. Si contás el estado actual, el embudo
no decrece de forma monótona y las conversiones mienten.

### 2.2 La solución: cohorte + "alcanzó al menos"

- **Cohorte:** los presupuestos **formales emitidos en el rango** — `Cotizacion`
  con `numero != null` y `fechaEnvio` dentro del período. Se excluyen los
  `borrador` (nunca enviados) y los contenedores de venta directa
  (`numero == null`).
- Cada etapa mide **hasta dónde llegó** cada presupuesto de esa cohorte, no
  dónde está hoy. Como los estados sólo avanzan, "alcanzó entrega" ⊆ "alcanzó
  producción" ⊆ "aprobado" ⊆ "emitido": el funnel es monótono por construcción.

### 2.3 Rank de estado (para "alcanzó al menos")

`OrdenTrabajo.estado` es lineal. Definimos un rank:

| estado OT | rank |
|---|---|
| `borrador` | 0 |
| `pendiente` | 1 |
| `produccion` | 2 |
| `finalizada` | 3 |
| `entregada` | 4 |

Una OT hoy en `entregada` (rank 4) pasó por producción → "alcanzó producción" =
`rank >= 2`. No hace falta leer el timeline para el caso normal; el rank del
estado actual basta porque el flujo no retrocede. (`OrdenTrabajoEvento`
tipo `'estado'` queda como fuente de precisión si más adelante se quiere el
timestamp exacto de cada cruce.)

### 2.4 Definición de cada etapa

| Etapa | Filtro | Ancla de fecha (para el rango) |
|---|---|---|
| **Cotizaciones emitidas** | `Cotizacion`: `numero != null`, `fechaEnvio ∈ rango` | `fechaEnvio` |
| **Aprobadas** | de la cohorte, `estado ∈ {aprobado, convertido}` | `fechaResuelto` |
| **En producción** | cohorte con `convertidaOrdenId != null` y su OT con `rank >= 2` | — (se hereda de la cohorte) |
| **Entregadas** | esa OT con `estado == 'entregada'` (rank 4) | `fechaFinalizada` |

> **Decisión abierta (§9-A):** "Entregadas" = `estado == 'entregada'` estricto,
> o `estado ∈ {finalizada, entregada}` (rank >= 3). `finalizada` = producción
> terminada / lista; `entregada` = en manos del cliente. Recomendación: usar
> **entregada estricta** como etapa terminal, pero si el tenant no marca
> `entregada` con disciplina el funnel subcuenta. Mitigación: mostrar
> `finalizada` como sub-línea, o hacer el umbral configurable. A validar con el
> uso real.

### 2.5 Dos ejes por etapa

- **Cantidad:** cuántos presupuestos de la cohorte alcanzaron la etapa.
- **Monto ($):** suma del `total` del presupuesto (o de la OT en las etapas
  post-conversión). Toggle en la UI. Una conversión del 52% en cantidad puede
  ser 70% en plata si los presupuestos grandes cierran más — el conteo lo
  esconde, el monto lo revela.

### 2.6 Dos porcentajes distintos (como el ejemplo)

- **Share** (barra): etapa / cohorte total. Da el "queda X% del arranque".
- **Conversión** (paso a paso): etapa / etapa anterior. Da el "de los que
  llegaron acá, cuántos pasaron". Es el número accionable por cuello de botella.

---

## 3. Framework de métricas del tab

Tres bloques, mismo patrón visual que los otros tabs (reusa `Card`, `HBar`,
`Kpi`, `fmtAR`, `pct`):

### 3.1 KPIs de cabecera (`d-kpi-row`)
- **Tasa de aprobación** = Aprobadas / Emitidas (con delta vs período anterior).
- **Tasa emitida → entregada** = Entregadas / Emitidas (conversión total del
  ciclo).
- **Valor en pipeline abierto** = monto de presupuestos `enviado` sin resolver
  **a hoy** (no de la cohorte del rango — es el "qué hay vivo ahora"). Lleva
  límite en `meta` porque mezcla temporalidad.
- **Ciclo promedio** = días emitida → entregada de los que completaron.

### 3.2 Embudo (la pieza central)
Las 4 barras con cantidad/monto, share y conversión paso a paso. Toggle
Cantidad / En $.

### 3.3 Dónde se pierde (fuga)
Los no aprobados de la cohorte, desglosados por `Cotizacion.motivoPerdida`
(`precio` | `plazo` | `sin_respuesta` | `competencia` | `otro`) + los `vencido`
(sin respuesta que caducaron). El embudo dice *cuánto* se cae; esto dice *por
qué*. Barra horizontal por motivo.

### 3.4 Velocidad del ciclo
Días promedio entre etapas, de los presupuestos que efectivamente cruzaron:
- Emitida → aprobada: `fechaResuelto − fechaEnvio`
- Aprobada → producción: `OT.fechaEmision − Cotizacion.fechaResuelto`
- Producción → entrega: `OT.fechaFinalizada − OT.fechaEmision`

Un cuello de 7 días en "producción → entrega" pesa tanto como una conversión
baja. Sólo promedios sobre los que completaron el tramo (los abiertos no
cuentan, va como límite en `meta`).

---

## 4. Casos borde

| Caso | Tratamiento |
|---|---|
| **OT manual sin presupuesto** (`cotizacionId == null`) | Fuera de la cohorte. El embudo mide el ciclo que *arranca* en cotización. Se declara como límite en `meta` ("N OTs directas sin presupuesto quedan fuera"). |
| **Venta directa** (`Cotizacion.numero == null`, contenedor de snapshots) | Excluida de la cohorte (no es presupuesto formal). |
| **Presupuesto aprobado pero OT aún no creada** | Cuenta en "Aprobadas", no en "En producción". Correcto: aprobado ≠ en producción. |
| **Rechazo/vencimiento tardío** (se aprobó y después se cayó) | El rank sólo avanza; una vez que alcanzó una etapa, cuenta ahí. La fuga se mide sobre los que **nunca** llegaron a aprobado. |
| **Un presupuesto → varias OTs** | Hoy la conversión es 1:1 (`convertidaOrdenId` singular). Si a futuro se parte, se toma el estado máximo alcanzado entre sus OTs. Nota para el implementador. |
| **Presupuesto emitido al final del rango** que todavía no resolvió | Cuenta en "Emitidas", cae en las siguientes por no haber avanzado *aún*. Es correcto pero deprime la conversión de cohortes recientes → se aclara en `meta` (cohortes jóvenes tienen menos tiempo de madurar). |
| **Período sin datos** | `sinComparativa = true`, deltas en null (patrón existente). |

---

## 5. Journey de lectura (cómo lo usa el dueño)

1. Entra al tab, ve la cabecera: "aprobamos 52%, entregamos 35% de lo cotizado".
2. Mira el embudo: el salto más chico (menor conversión paso a paso) es el
   cuello. Ej: 52% emitida→aprobada es el punto flaco.
3. Va a "Dónde se pierde": el motivo dominante es `sin_respuesta` (34) → problema
   de seguimiento, no de precio. Accionable.
4. Cruza con Velocidad: si "emitida → aprobada" tarda 4,2 días promedio, hay
   margen para apurar el follow-up antes de que se enfríe.
5. Toggle a "En $": confirma si la fuga es de plata grande o de laburitos.

---

## 6. Contrato de datos

### 6.1 Endpoint
`GET /reportes/panel/embudo` — mismo patrón que los demás tabs: resuelve rango,
llama al service, devuelve `{ meta, ...datos }`.

`meta.fuente = 'Presupuestos emitidos (cohorte)'`. Límites típicos:
- "N OTs directas sin presupuesto quedan fuera del embudo."
- "Cohortes recientes tienen menos tiempo de madurar: su conversión sube con el tiempo."
- "Velocidad: promedio sólo sobre los que completaron cada tramo."
- "Pipeline abierto: valor a hoy, no de la cohorte del rango."

### 6.2 Tipo en [panel-api.ts](../src/lib/panel-api.ts)

```ts
export type EmbudoEtapaPanel = {
  clave: "emitidas" | "aprobadas" | "produccion" | "entregadas";
  label: string;
  cantidad: number;
  monto: number;
  sharePct: number;        // etapa / cohorte
  conversionPct: number | null; // etapa / etapa anterior (null en la 1ª)
};
export type EmbudoFugaPanel = { motivo: string; cantidad: number; monto: number };
export type EmbudoVelocidadPanel = { tramo: string; diasPromedio: number | null };
export type EmbudoPanel = {
  sinComparativa: boolean;
  kpis: {
    tasaAprobacion: number; tasaAprobacionDeltaPct: number | null;
    tasaEntrega: number;
    pipelineAbiertoMonto: number; pipelineAbiertoCantidad: number;
    cicloPromedioDias: number | null;
  };
  funnel: EmbudoEtapaPanel[];
  fugas: EmbudoFugaPanel[];
  velocidad: EmbudoVelocidadPanel[];
};

export function getPanelEmbudo(rango?: RangoPanel) {
  return apiRequest<TabPanel<EmbudoPanel>>(`/reportes/panel/embudo${qs(rango)}`);
}
```

---

## 7. Plan backend

Archivo nuevo `apps/api/src/reportes/embudo.service.ts`, registrado en
`reportes.module.ts`, inyectado en `reportes.controller.ts` con un `@Get('embudo')`
que sigue el molde de `comercial` (L77-88).

**Estrategia de query (2 lecturas, sin N+1):**

1. **Cohorte de cotizaciones.** Una query a `Cotizacion` filtrando
   `tenantId`, `numero != null`, `fechaEnvio ∈ [rango]`, trayendo
   `id, estado, total, fechaEnvio, fechaResuelto, motivoPerdida,
   convertidaOrdenId`. De acá salen: total emitidas, aprobadas
   (`estado ∈ {aprobado, convertido}`), y las fugas (no aprobadas por motivo).

2. **OTs de la cohorte.** Con los `convertidaOrdenId` no nulos, una query a
   `OrdenTrabajo` (`id ∈ [...]`) trayendo `estado, total, fechaEmision,
   fechaFinalizada`. De acá: "en producción" (`rank >= 2`), "entregadas"
   (`estado == 'entregada'`, ver §9-A), y los tramos de velocidad.

3. **Pipeline abierto** (KPI, independiente de la cohorte): count+sum de
   `Cotizacion` con `estado == 'enviado'` a hoy.

Todo con `tenantId` en el where (patrón tenant-guard del repo). Rank y agregados
se computan en memoria sobre los dos arrays — volumen chico (presupuestos de un
período). Redondeo con el helper `r2` como en `ventas.service.ts`.

**Tests:** `apps/api/src/reportes/__tests__/embudo.service.spec.ts` con DB
aislada (`gdi_saas_test`, patrón `jest-setup-db.ts`). Casos: cohorte vacía,
monotonía del funnel, OT manual excluida, venta directa excluida, fuga por
motivo, velocidad con tramos incompletos.

---

## 8. Plan UI

En [panel-general.tsx](../src/components/panel/panel-general.tsx):
1. Ampliar el union `TabKey` con `"embudo"`.
2. `TabEmbudo({ d }: { d: EmbudoPanel })`: `d-kpi-row` de KPIs + una `Card`
   grande con el embudo (barras con `HBar`/estilo propio y toggle
   cantidad/monto en estado local) + dos `Card span={6}`: "Dónde se pierde"
   (`RankList`/`HBar` por motivo) y "Velocidad del ciclo".
3. Entrada en `TABS` (icono lucide, ej. `Filter` o `TrendingDown`), en
   `FETCHERS` (`embudo: (r) => getPanelEmbudo(r)`) y la línea condicional del
   render.

Sin CSS nuevo: reusa `Card`, `Kpi`, `HBar`, `LegendDot`, `fmtAR`, `fmtK`, `pct`.
El toggle Cantidad/$ es estado local del componente (como otros toggles del panel).

---

## 9. Decisiones abiertas

- **A. Etapa terminal "Entregadas":** `entregada` estricta vs `{finalizada,
  entregada}`. Depende de si el tenant marca `entregada` con disciplina.
  Recomendación: entregada estricta + `finalizada` como sub-línea. Confirmar
  con datos reales antes de codear.
- **B. Monto de etapas post-conversión:** ¿`total` del presupuesto congelado o
  `total` de la OT (que puede diferir si hubo ajustes)? Recomendación: OT para
  producción/entrega (refleja lo que realmente entró a producir), presupuesto
  para emitidas/aprobadas. Documentar el cruce en `meta`.
- **C. KPI "pipeline abierto":** ¿a hoy (recomendado) o al cierre del rango? A
  hoy es más útil para acción; se aclara en `meta`.

---

## 10. Fases

- **F1 — Embudo + fugas (core).** Cohorte, 4 etapas cant/$, share+conversión,
  "dónde se pierde", KPIs de cabecera. Es el 80% del valor.
- **F2 — Velocidad + pipeline abierto.** Tramos de días y el KPI de pipeline
  vivo. Suma contexto de tiempo.
- **F3 (futuro) — Drill y tendencia.** Click en una etapa → lista de esos
  presupuestos; serie de conversión mes a mes; segmentación por vendedor/canal.
