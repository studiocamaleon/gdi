# Panel general (Inteligencia de negocio) — plan de implementación backend

> 2026-07-17. Plan técnico del backend del **Panel general**, alineado al
> diseño del usuario (proyecto Grafoprint: panel.jsx/panel-tabs.jsx) y al
> análisis de realidad de datos (docs/reportes-panel-analisis-diseno.md,
> que manda sobre el brief plano anterior). Regla de oro acordada: **lo
> que no tiene dato hoy, no se incluye; lo que hay que reformular, se
> reformula.** Flujo de caja proyectado: DIFERIDO (falta el lado de
> egresos/compras).
>
> El módulo se llama "Panel general". La visibilidad POR ROL (quién ve qué
> tab) se define más adelante — por ahora todas las tabs disponibles; el
> backend ya deja el gancho (cada tab es un endpoint independiente, fácil
> de gatear después).

## 1. Principios

- **Agregar en SQL, no en JS**: cada card es una (o pocas) queries
  agregadas con GROUP BY sobre índices existentes. El drill (un registro)
  puede agregar el `trazabilidadJson` en JS, acotado.
- **Tenant-scoped, SOLO LECTURA** (salvo config de umbrales de alertas).
- **Período de primera clase**: todo toma `?desde&hasta`; un helper único
  resuelve presets, granularidad (día/semana/mes) y el **período anterior
  equivalente** para los deltas.
- **Honestidad en la respuesta**: cada payload trae `meta: { fuente,
  limites[], sinComparativa?, desdeHayDatos? }`. Las notas al pie y los
  estados "desde el mes N" salen del backend, no se inventan en el front.
- **Degradar con gracia**: sin historia → deltas null + `sinComparativa`;
  con < N muestras → el reporte va marcado y el front lo apaga.

## 2. Estructura del módulo

```
apps/api/src/reportes/
  reportes.module.ts
  reportes.controller.ts        // un endpoint por TAB del panel
  periodo.ts                    // rango + período anterior + granularidad
  rentabilidad.service.ts       // margen bruto, contribución, PUNTO DE EQUILIBRIO, costo por centro
  ventas.service.ts             // facturación, ticket, clientes, vendedores, mix
  producto.service.ts           // ventas por categoría/producto/PAPEL/MEDIDA/tecnología
  cobranza.service.ts           // aging, DSO, costo de cobrar, cheques, deudores, fondos
  produccion.service.ts         // OTD, lead time, eficiencia de tiempo, utilización, bloqueos
  alertas.service.ts            // reglas sobre los agregados + umbrales
  dto/rango-reporte.dto.ts
```

Front: `src/lib/panel-api.ts` (tipos = contratos §6) + la página
`src/app/(dashboard)/panel/page.tsx` con las tabs + sección "Panel
general" en el sidebar. Clients y tipos primero; las cards se enchufan
cuando lleguen los diseños adaptados.

## 3. Tabs del Panel y sus endpoints

Cada tab = un endpoint que compone cards desde los services. Los services
exponen `kpis(rango)` barato (para el Resumen) además del detalle.

### GET /reportes/panel/resumen — Tab "Resumen ejecutivo"
KPIs: Facturación · Margen bruto · **Margen de contribución %** · **Punto
de equilibrio** (avance) · OTD · Carga del taller. + barras
facturación/costo/margen (con `desdeHayDatos`) · top clientes · top
productos por margen · alertas activas.
- Compone rentabilidad.kpis + ventas.kpis + produccion.kpis +
  alertas.activos.
- **RETIRADO del diseño**: embudo comercial, salud de flota/OEE (§4).

### GET /reportes/panel/comercial — Tab "Comercial"
KPIs: Ventas · Ticket promedio · Items/orden · Nuevos clientes ·
Clientes dormidos. + serie temporal de ventas · ranking vendedores ·
ranking clientes · mix por categoría/tecnología · órdenes recientes.
- Fuente: `ventas.service`.
- **RETIRADO**: win rate, pipeline kanban por etapa, "por vencer",
  productos más cotizados/conversión — las cotizaciones no tienen ciclo
  de estados (todas "borrador"). Requiere primero el ciclo comercial
  (prerequisito de producto, no reporte).

### GET /reportes/panel/produccion — Tab "Producción"
KPIs: OTD · Lead time · **Eficiencia de tiempo** (real/cotizado) · Horas
bloqueadas. + OTD serie + órdenes atrasadas · precisión estimado-vs-real
por familia · **utilización por centro vs. capacidad práctica** ·
throughput diario · trabajos por estación (reusa motor del tablero) ·
bloqueos por motivo.
- Fuente: `produccion.service` (reusa percentile de duraciones-familias +
  capacidadPractica del período).
- **REFORMULADO**: OEE → "Eficiencia de tiempo" (única pata con dato: no
  hay downtime ni calidad). Heatmap máquina×hora → utilización por centro.
- **RETIRADO**: setup medido, causas de reproceso (sin módulo de calidad).

### GET /reportes/panel/finanzas — Tab "Finanzas"
KPIs: Facturación · **Margen de contribución %** · **Punto de equilibrio**
· Aging total · DSO. + facturación/costo (con historia) · **aging de
deuda** · **gasto por centro de costo** (donut) · **costo de cobrar**
(comisiones por método de pago) · deudores principales · cheques en
cartera · saldo por cuenta.
- Fuente: `rentabilidad.service` (PE, gasto por centro) + `cobranza.service`.
- **RETIRADO**: presupuesto vs. real (no hay presupuesto cargado), flujo
  de caja proyectado (DIFERIDO — sin egresos/compras).

### GET /reportes/panel/producto — Tab "Ventas & Producto" (nuevo)
Reemplaza el tab Inventario operativo. Ventas por **categoría/
subcategoría** · por **producto** (volumen y margen) · por **PAPEL/
material** (nombre + cantidad + costo, del trazabilidad) · por **MEDIDA/
tamaño** (jobContext piezas + medidaPredefinida; m² por rango en gran
formato) · por **tecnología** · consumo TEÓRICO de materiales/tintas
(del snapshot, marcado "teórico" — no es stock real).
- Fuente: `producto.service`.

### (Sin tab Inventario operativo por ahora)
Stock crítico / cobertura / movimientos / consumo real dependen del flujo
de stock (0 movimientos hoy). Se retoma cuando el inventario registre
compras y consumo por paso.

### GET /reportes/panel/alertas + GET/PUT /reportes/umbrales
Alertas activas (cards de insight) + config de umbrales
(`ConfiguracionInsights`, tenant unique, JSON con defaults — patrón
ConfiguracionProduccion). Catálogo inicial: §5.

## 4. Métricas nuevas — definición y fuente (verificado)

### Margen de contribución (rentabilidad.service) — 🟢
- Ventas = Σ `CotizacionItem.precioTotal` de items de OTs emitidas
  (estado ≠ borrador) con `fechaEmision` en rango.
- **Costos variables** = Σ por item de las líneas del `trazabilidadJson`
  con `tipoLineaCosto ∈ {MATERIAL, CONSUMIBLE_MAQUINA}` (papel + tintas).
- **Margen de contribución** = Ventas − Costos variables; **MC %** =
  MC / Ventas.

### Punto de equilibrio (rentabilidad.service) — 🟢 métrica estrella
- **Costos fijos del período** = Σ `CentroCostoComponenteCostoPeriodo
  .importeMensual` de los períodos que cubre el rango (SUELDOS, CARGAS,
  ALQUILER, ENERGÍA, AMORTIZACIÓN, MANTENIMIENTO, …). Verificado: cargado
  en dev.
- **Punto de equilibrio ($)** = Costos fijos / (MC / Ventas).
- **Avance** = Ventas del período / PE (gauge); + días transcurridos vs.
  proyección lineal para "vas al 78% del PE al día 20".
- Insight: *"Cubrís tu estructura desde $X/mes; este mes facturaste $Y
  (Z% del PE)."*

### Margen de contribución / costo por centro (rentabilidad.service) — 🟢 costo, 🟡 MC
- **Costo estructural por centro** = Σ componentes del centro en el
  período (donut "gasto por centro" del diseño — REAL, directo).
- **MC generada por centro** (🟡, v2): repartir el precio del item entre
  sus pasos proporcional al costo de cada paso (regla declarada). No se
  finge exacto en v1: v1 muestra costo absorbido + horas trabajadas
  (utilización) por centro.

### Eficiencia de tiempo (produccion.service) — 🟢 (reemplaza OEE)
- Por familia/centro: mediana de tiempo REAL (`completadoEl −
  iniciadoEl`, con filtro de atípicos) vs. tiempo COTIZADO
  (`duracionEstimadaMin`); razón. Reusa la técnica de duraciones-familias.

### Utilización por centro (produccion.service) — 🟢
- Σ minutos reales de pasos por centro en rango vs.
  `CentroCostoCapacidadPeriodo.capacidadPractica` del período → %.

### Inteligencia de producto (producto.service) — 🟢
- Categoría/producto/tecnología: campos del item + jobContext.
- **Papel/material**: agrega `trazabilidadJson.materiales[]` por
  `materiaPrimaNombre` — cantidad, costo, en qué productos.
- **Medida**: `jobContext.medidaPredefinidaNombre` y
  `jobContext.piezas[].{anchoMm,altoMm}` → top medidas, m² por rango.

## 5. Alertas (catálogo inicial, sobre datos reales)

margen de categoría cae >N pts · cliente top sin comprar >N días · deuda
vencida >N% de facturación mensual · familia con real/cotizado >1,5×
sostenido · centro <N% de utilización · tarifas sin actualizar >N meses ·
**por debajo del punto de equilibrio al día N del mes** · concentración
top-3 >N%. Umbrales configurables con default sensato.

## 6. Contratos (a fijar por tab al construir)

Los payloads salen de las cards de cada tab del diseño. Se escriben como
tipos en `panel-api.ts` y DTOs ANTES de adaptar cada diseño. Formas nuevas
clave:

- **resumen.kpis**: `{ facturacion, facturacionDelta, margenBrutoPct,
  contribucionPct, puntoEquilibrio: { monto, avancePct, proyeccionDia },
  otdPct, cargaTallerPct }`
- **finanzas.puntoEquilibrio**: `{ costosFijos, costosVariables,
  contribucion, contribucionPct, puntoEquilibrio, avancePct,
  gastoPorCentro: [{ centro, monto, pct }] }`
- **producto**: `{ porCategoria[], porProducto[], porPapel: [{ material,
  cantidad, unidad, costo, pctOrdenes }], porMedida: [{ medida, ordenes,
  m2 }], porTecnologia[], consumoTeorico: [{ material, cantidad, unidad }] }`
- Resto (ventas, cobranza, producción): como el análisis §6 + el brief §9
  previo, menos lo retirado.

## 7. Secuencia de construcción

1. **Cimientos** (rama `feat/panel-general`): módulo + periodo.ts + DTO +
   `panel-api.ts` con tipos + tests del helper de período.
2. **rentabilidad.service**: margen bruto + **contribución + PUNTO DE
   EQUILIBRIO** + gasto por centro. Verificación a mano contra OTs dev.
3. **cobranza.service**: aging + costo de cobrar + DSO (4 cobros + 1
   comprobante dev alcanzan para la mecánica).
4. **ventas.service** + **Resumen v1** (KPIs reales; Producción
   placeholder).
5. **producto.service** (papel/medida/tecnología — la inteligencia que
   pidió el usuario).
6. **produccion.service** (eficiencia de tiempo + utilización + OTD +
   bloqueos).
7. **alertas.service** + umbrales, y Resumen completo con alertas reales.
8. Diseños adaptados → páginas y cards sobre los contratos, sin tocarlos.

Cada etapa: typecheck, smoke SQL contra dev con cuentas a mano, commit.

## 8. Fuera de fase (registrado)

- **Flujo de caja proyectado** (diferido: falta módulo de compras/pagos
  para el lado de egresos; los ingresos ya están).
- Funnel/win-rate/pipeline (requiere ciclo de estados de cotización).
- OEE real, setup medido, reproceso/calidad (sin telemetría ni módulo de
  calidad).
- Inventario operativo (stock crítico/cobertura/movimientos: sin flujo de
  stock).
- Visibilidad por rol de las tabs (el gancho queda; la política, después).
- Presupuesto vs. real (sin presupuesto cargado).
