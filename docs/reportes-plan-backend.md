# Inteligencia de negocio — plan de implementación backend

> 2026-07-17. Plan técnico para construir el backend de reportes EN
> PARALELO al diseño de UI (docs/reportes-brief-diseno-ui.md — los
> contratos de su §9 son el handshake: acá se implementan tal cual).
> Estudio base: docs/reportes-inteligentes-estudio.md.

## 1. Principios

- **Agregar en SQL, no en JS**: cada reporte es una (o pocas) queries
  agregadas con GROUP BY sobre índices existentes; el front recibe filas
  listas para pintar. Nada de traer todo y procesar en memoria.
- **Todo tenant-scoped** (patrón tenant-guard existente) y de SOLO
  LECTURA: el módulo no muta nada, salvo la config de umbrales.
- **Período como ciudadano de primera**: todos los endpoints toman
  `?desde&hasta` y calculan solos el período anterior equivalente para
  los deltas. Un helper único resuelve presets y granularidad
  (día/semana/mes según el rango).
- **Honestidad integrada**: cada respuesta incluye `meta: { fuente,
  limites[], sinComparativa? }` — la nota al pie del brief no se inventa
  en el front, viene del backend que sabe qué excluyó.

## 2. Estructura del módulo

```
apps/api/src/reportes/
  reportes.module.ts
  reportes.controller.ts        // GET /reportes/panorama, /rentabilidad, …
  periodo.ts                    // parse de rango + período anterior + granularidad
  reportes-rentabilidad.service.ts   // eje A
  reportes-ventas.service.ts         // eje B
  reportes-cobranza.service.ts       // eje C
  reportes-produccion.service.ts     // eje D
  reportes-costos.service.ts         // eje E
  insights.service.ts           // reglas sobre los agregados + umbrales
  dto/rango-reporte.dto.ts      // desde/hasta validados
```

Front: `src/lib/reportes-api.ts` (tipos = contratos del brief §9) +
`src/app/(dashboard)/inteligencia/{panorama,rentabilidad,ventas,
cobranza,produccion,costos,alertas}/page.tsx` + sección "Inteligencia"
en nav-items. Las pages llegan cuando estén los diseños; los clients y
tipos se escriben antes para que las vistas se enchufen.

## 3. Fuentes por endpoint (queries clave)

### GET /reportes/rentabilidad (eje A)
- Base: `OrdenTrabajo` (estado ≠ borrador, fechaEmision en rango) JOIN
  `OrdenTrabajoItem` JOIN `CotizacionItem` (costoTotal, precioTotal).
- Dimensiones por `?dimension=`: categoría/subcategoría (campos del
  item), cliente, producto (snapshot productoId + nombre del item),
  vendedor, canal (de la orden).
- Margen = Σ(precioTotal − costoTotal); flags: precioEspecial cuando
  `precioEspecialClienteSnapshotJson` no es null.
- Drill: `?dimension=X&id=Y` → items del período + composición del costo
  desde `trazabilidadJson.pasos[].{materiales,tiempo}` (se agrega en JS
  acá porque es UN registro por item, acotado al drill).
- Margen operativo (A6): tiempos reales de `OrdenTrabajoItemPaso`
  (`completadoEl − iniciadoEl`, con el filtro de atípicos de §5) ×
  tarifa del período del centro (`CentroCostoTarifaPeriodo`) vs. el
  costo de tiempo snapshoteado.

### GET /reportes/ventas (eje B)
- Serie: GROUP BY date_trunc(granularidad, fechaEmision).
- Mix/concentración: GROUP BY categoría / cliente con window para %
  acumulado.
- Dormidos: clientes con ≥2 órdenes históricas y MAX(fechaEmision) <
  hoy − umbral.
- Pipeline: órdenes en borrador con createdAt y total.

### GET /reportes/cobranza (eje C)
- Aging: `Comprobante` (estado emitido, saldo > 0) por franjas de
  `hoy − fecha`.
- DSO: promedio ponderado fecha comprobante → fechas de
  `CobroImputacion`.
- Costo de cobrar: `Cobro` por método: Σ montoBruto, Σ comisionMonto +
  comisionIvaMonto, Σ netoAcreditado.
- Cheques: `Valor` por estado con MIN(vencimiento) próximo.
- Fondos: `CuentaFondos` + Σ `MovimientoFondos` del rango.

### GET /reportes/produccion (eje D)
- OTD: órdenes finalizadas en rango (evento tipo 'estado' →
  finalizada, o updatedAt del estado) vs. fechaEntrega; atrasadas con
  la estación del último paso que cerró tarde.
- Precisión: pasos hechos con ambos timestamps, mediana estimado vs.
  real por familia (reusa la técnica de `duraciones-familias` +
  percentile_cont), razón y muestras.
- Utilización: Σ minutos reales por centro en el rango vs.
  `CentroCostoCapacidadPeriodo.capacidadPractica` del período.
- Bloqueos: eventos de bloqueo (tipo + datosJson) — motivo, conteo y,
  cuando el desbloqueo quedó registrado, horas bloqueadas.

### GET /reportes/costos (eje E)
- Composición: agregado de `trazabilidadJson` por item del rango
  (material/máquina/MO/consumible/cargos) — pre-agregado en SQL con
  jsonb cuando se pueda, en JS acotado si no.
- Salud de tarifas: último `CentroCostoTarifaPeriodo` por centro vs. hoy
  + % de facturación cuyos pasos usan ese centro.
- Inventario valorizado: Σ stock × costoPromedio por familia, con flag
  "según carga inicial" mientras `MovimientoStockMateriaPrima` esté
  vacío.

### GET /reportes/panorama
- Compone llamando a los services anteriores (versión "solo KPIs" de
  cada uno — cada service expone `kpis(rango)` barato además del reporte
  completo) + `insights.activos()` + la serie corta de tendencia.

### GET /reportes/insights · GET/PUT /reportes/umbrales
- `insights.service`: reglas puras que reciben los agregados y devuelven
  `{ severidad, titulo, detalle, reporte }`. Catálogo inicial: las 8 del
  estudio §5. Umbrales en tabla nueva `ConfiguracionInsights` (tenant
  unique, JSON de umbrales con defaults — mismo patrón que
  ConfiguracionProduccion).

## 4. Contratos

Los del brief §9, literales. Se escriben primero como tipos en
`src/lib/reportes-api.ts` y DTOs del API — es el punto de encuentro con
los diseños: si un diseño necesita un campo más, se agrega al contrato
ANTES de diseñar distinto.

## 5. Guardas de calidad (transversales)

- **Atípicos**: duraciones reales > 8 h corridas o > 5× el estimado se
  excluyen y se cuentan en `meta.limites` ("se descartaron N tiempos
  atípicos").
- **Muestras mínimas**: medianas/razones con < 3 muestras van con
  `muestras` y el front las apaga (regla ya usada en
  duraciones-familias).
- **Sin comparativa**: si el período anterior no tiene datos, deltas en
  null + `meta.sinComparativa` (el front muestra "—", nunca 0%).
- **No disponible**: costos E4 (rotación) responde
  `{ disponible: false, razon }` — el módulo dice por qué, no desaparece.

## 6. Secuencia de construcción (mientras se diseña la UI)

1. **Cimientos** (rama `feat/reportes-backend`): módulo + periodo.ts +
   DTO + contratos en lib front + tests del helper de período.
2. **Eje A Rentabilidad** (el corazón): endpoint completo con
   dimensiones + drill + verificación a mano contra las órdenes dev
   (margen de OT-0007 calculable a ojo).
3. **Eje C Cobranza**: aging + costo de cobrar + DSO (los 4 cobros y el
   comprobante dev alcanzan para verificar la mecánica).
4. **Eje B Ventas** (reusa el helper de serie) + **Panorama v1** (KPIs
   A+B+C reales, D placeholder).
5. **Eje D Producción** (reusa percentile de duraciones + capacidad) y
   **Eje E Costos**.
6. **Insights + umbrales** (las 8 reglas + config) y Panorama completo.
7. Cuando lleguen los diseños: pages + adaptación visual, sin tocar
   contratos.

Cada etapa: typecheck, smoke SQL contra dev con cuentas a mano, commit.

## 7. Qué NO entra en esta fase

Vistas por rol (vendedor/taller/admin — fase 3 del estudio), resumen
programado por mail/notificación, export a PDF (CSV sí), y todo lo 🔴
del estudio (conversión de presupuestos, rotación de materiales) hasta
que el dato fluya.
