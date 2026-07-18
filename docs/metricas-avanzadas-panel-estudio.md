# Métricas avanzadas del Panel — estudio de profundización

> 2026-07-18. Sucede a reportes-inteligentes-estudio.md y
> reportes-panel-analisis-diseno.md (ya IMPLEMENTADOS en los 5 tabs del
> Panel). Este estudio responde: (a) las preguntas concretas del usuario
> que hoy el Panel no contesta (mix evolutivo por categoría, attach rate
> de opcionales, estacionalidad, evolución del ticket), (b) el catálogo
> de KPIs estándar de los Print MIS/ERP de la industria (PrintVis, Avanti
> Slingshot, EFI Pace, Ordant, Printavo, más benchmarks PIA/FESPA/
> WhatTheyThink), cruzado con la viabilidad REAL contra nuestro schema.
> SIN implementación: análisis primero.

## 1. Diagnóstico honesto del Panel actual

Los 5 tabs muestran **fotos agregadas del período** (con delta vs. el
período anterior). Lo que falta no son datos: es la **dimensión tiempo
cruzada con las demás dimensiones**. Hoy hay UNA serie temporal (ventas
totales); no hay serie por categoría, ni por producto, ni de ticket, ni
de margen. Esa es la brecha #1 y es barata: los datos están snapshoteados
por item con fecha.

La brecha #2 es **profundidad de drill**: el tab Producto rankea
categorías y productos del período, pero no deja "entrar" a una
categoría y ver su mix interno evolucionando.

La brecha #3 es de **captura** (no de reporting): win rate, merma,
retrabajos — métricas core de la industria cuyos datos hoy no se
registran (§5).

## 2. Las preguntas del usuario, una por una (viabilidad verificada)

### 2.1 Mix de productos de una categoría, evolutivo — 🟢 HOY

`OrdenTrabajoItem` tiene `categoriaComercial`/`subcategoriaComercial`
denormalizadas + `fechaEmision` de la OT + `subtotal`. Un
`GROUP BY periodo, producto WHERE categoria = X` con la granularidad de
`periodo.ts` lo resuelve. Vale para TODAS las órdenes (incluidas las
manuales sin cotización, porque es venta, no costo).

- Card: stacked area/barras del mix por categoría en el tiempo, con
  drill: click en categoría → mix de sus productos/subcategorías en el
  tiempo.
- Bonus con el mismo query: mix por % además de $, para ver sustitución
  (un producto que crece comiéndose a otro de la misma categoría).

### 2.2 ¿El producto X se vende más con o sin opcionales? ¿Cuáles? ¿Qué %? — 🟢 el %, 🟡 la plata

Verificado en schema: `OrdenTrabajoItem.adicionalesJson` guarda las
**etiquetas** de los adicionales incluidos en cada item vendido
(`string[]`). Con eso:

- **Attach rate por producto** = items del producto con adicional A /
  items totales del producto. 🟢 directo.
- **Con vs. sin**: % de ventas del producto con `adicionalesJson` no
  vacío, y ticket promedio de unos vs. otros (¿el que lleva laminado
  paga más en total?). 🟢.
- Ranking de adicionales por categoría ("en cartelería, el 64% lleva
  ojales; sólo el 12% lleva laminado"). 🟢.

**Limitación conocida**: el PRECIO/COSTO de cada adicional individual no
está en columna — vive dentro de `trazabilidadJson.pasos` a nivel paso,
no siempre atribuible 1:1 a "el opcional X". Dos caminos:

- v1 (sin tocar captura): attach rate + delta de ticket con/sin. Ya
  responde la pregunta comercial.
- v2 (mejora de captura, chica): al confirmar la venta, persistir junto
  a cada etiqueta de `adicionalesJson` su precio/costo del snapshot
  (`[{etiqueta, precio, costo}]`). Desde ese día, "los ojales te
  dejaron $N este mes" es exacto. Nota: la industria casi no ofrece
  attach rate — es diferenciador nuestro gracias al modelo
  "adicionales = pasos opcionales".

### 2.3 ¿Qué categorías se venden más en qué meses? (estacionalidad) — 🟢 mecánica / 🟡 historia

Mecánicamente trivial (mismo query de 2.1 con granularidad mes). El
límite es estadístico: un **índice estacional** serio (ventas del mes /
promedio mensual) necesita 12–24 meses; el sistema es joven.

- v1: heatmap categoría × mes "desde que hay datos", etiquetado como
  tal (patrón `meta.desdeHayDatos` que ya existe en el backend).
- v2 (automático con el tiempo): al segundo año, el índice estacional
  real y el insight "se viene tu temporada alta de X (histórico: +40%
  en agosto) — mirá capacidad y stock".

### 2.4 Evolución del ticket promedio — 🟢 HOY

`SUM(subtotal)/COUNT(DISTINCT orden)` por período. El KPI ya existe como
foto; falta la serie. Agregar también la **distribución** (mediana y
P25–P75), porque en imprenta el promedio miente: dos órdenes de $2M
tapan cincuenta de $30k. Serie de ticket por categoría = mismo query con
una dimensión más.

## 3. Catálogo industria × viabilidad nuestra

Cruce del catálogo estándar de Print MIS (investigación 2026-07-18, ver
fuentes al pie) contra el schema. **[CORE]** = piso competitivo de la
industria; **[DIF]** = diferenciador que casi ningún MIS da y nosotros
podemos. Se omite lo que el Panel YA muestra (OTD, utilización,
eficiencia real/cotizado, aging, DSO, costo de cobrar, PE, margen por
categoría/producto, pareto de pausas).

### Eje Comercial

| Métrica | Prioridad | Viabilidad | Fuente/nota |
|---|---|---|---|
| Series evolutivas por dimensión (mix, ticket, margen) | [CORE] | 🟢 | §2.1/2.4 |
| Estacionalidad + índice estacional | [CORE] | 🟢/🟡 | §2.3 |
| Attach rate de adicionales | [DIF] | 🟢 | §2.2 |
| Comparativa YoY (mismo mes año anterior) | [CORE] | 🟢 mecánica, espera historia | extender `periodoAnterior` con modo "mismo período año anterior" |
| Precio realizado vs. lista (descuento efectivo) | [DIF] | 🟢 | `precioConfigSnapshotJson` + `precioEspecialClienteSnapshotJson` vs. `precioTotal` — el motor sabe el precio "de lista" del momento; nadie más tiene ese dato snapshoteado |
| Win rate / funnel / pipeline / tiempo cotización→orden | [CORE] | 🔴 | sigue bloqueado por ciclo de estados de cotización (§5.1) — ratificado por la industria: es de las métricas más valoradas |

### Eje Clientes (el eje más flaco del Panel hoy)

| Métrica | Prioridad | Viabilidad | Fuente/nota |
|---|---|---|---|
| Retención/churn (activo = compró en N meses) | [CORE] | 🟢 | historia de órdenes; definir N (propuesta: 6 meses, configurable) |
| Nuevos vs. recurrentes ($ y #, serie) | [CORE] | 🟢 | primera orden por cliente (ya se calcula para "nuevos") |
| Frecuencia de recompra (mediana días entre órdenes) | [CORE] | 🟢 | fechas de órdenes |
| Margen por cliente (serie) | [CORE] | 🟢 | snapshot costo por item (excluyendo `itemsSinCosto`, declarado) |
| RFM (campeones/leales/en riesgo/dormidos) | [DIF] | 🟢 | generaliza "clientes dormidos" ya implementado; ningún Print MIS clásico lo trae |
| Salud del cliente (caída vs. su promedio móvil) | [DIF] | 🟢 | series por cliente + regla en alertas.service |
| CLV simplificado | nice | 🟡 | mecánica 🟢 pero necesita años de historia para no inventar |

### Eje Rentabilidad/Producción (completar lo ya fuerte)

| Métrica | Prioridad | Viabilidad | Fuente/nota |
|---|---|---|---|
| Distribución de márgenes (histograma, trabajos "bajo el agua") | [CORE] | 🟢 | margen por item ya calculado; falta la vista distribución |
| Contribución por hora de máquina, por línea de negocio | [DIF] | 🟢 | (precio − variables) / tiempoRealMin por centro — compara qué línea paga mejor la hora de capacidad; sólo pasos `tiempoFuente IN (medido, medido_lote)` |
| Cola vs. activo (touch time / lead time) | [DIF] | 🟢 | timestamps de tramos y pasos; suele dar <10% activo — muy revelador |
| Cuello de botella histórico (qué estación limitó cada semana) | [CORE] | 🟡 | la cola por estación existe como foto; el histórico requiere snapshot periódico (§5.3) |
| WIP envejecido (órdenes estancadas > N días por etapa) | [CORE] | 🟢 | estados + eventos |
| Merma/desperdicio (benchmark: 2% ventas aceptable, 0,5% líderes) | [CORE] | 🔴 | sin captura (§5.2) |
| Retrabajos con causa (benchmark: <2%; 5% come 3–4 pts de margen) | [CORE] | 🔴 | sin captura (§5.2) |
| Productividad por operario | sensible | 🟢 | tramos por usuario; presentar con cuidado (clima laboral) |

### Benchmarks de contexto (para insights, no para cards)

Margen neto industria 2–14% (nichos hasta 20%) · OTIF 98% = excepcional,
95% razonable · utilización efectiva real de talleres 45–60% · DSO sano
30–45 días (referencia, no calza directo a Argentina). Útiles como
texto de insight ("tu OTD del 88% está sobre la media de la industria"),
no como umbrales duros.

## 4. Propuesta de evolución de tabs

No agregar tabs porque sí: **profundizar 2, crear 1**.

- **Comercial** (nutrir): serie de ticket promedio (+mediana) ·
  comparativa YoY cuando haya historia · estacionalidad heatmap
  categoría × mes · nuevos vs. recurrentes en serie.
- **Ventas & Producto** (nutrir — acá viven las preguntas del usuario):
  mix evolutivo por categoría con drill a productos (§2.1) ·
  **adicionales: attach rate por producto/categoría + con/sin +
  delta de ticket** (§2.2) · precio realizado vs. lista · distribución
  de márgenes.
- **Clientes** (tab NUEVO): pareto/concentración (hoy enterrado en
  Resumen) · retención y recompra · RFM · margen por cliente · salud/
  caídas. Es el eje donde el Panel está más flaco y todo es 🟢.
- **Producción** (nutrir, menor): cola vs. activo · WIP envejecido ·
  contribución por hora de máquina.

Fases sugeridas:
1. **F1 — "la dimensión tiempo"** (todo 🟢, sin tocar captura): series
   por dimensión en Comercial y Producto + attach rate v1 + tab
   Clientes. Un helper genérico `seriePorDimension(rango, dimension,
   metrica)` en el backend evita escribir N queries artesanales.
2. **F2 — capturas chicas**: precio por adicional en la venta (§2.2 v2)
   + snapshot mensual de agregados (§5.3).
3. **F3 — prerequisitos de producto** (decisiones aparte, no reportes):
   ciclo de estados de cotización → destraba TODO el eje funnel/win
   rate; registro de merma/retrabajo → destraba el eje calidad.

## 5. Los tres desbloqueos de captura (decisiones de producto)

1. **Estados de cotización** (enviada/aprobada/rechazada/vencida). Ya
   señalado en los estudios previos; la investigación de industria lo
   ratifica como de las métricas MÁS valoradas (win rate por vendedor/
   familia/monto, tiempo de respuesta — hay casos citados de +35% de
   conversión por responder más rápido). Sin registrar lo PERDIDO no hay
   funnel. Es la deuda comercial #1 del producto.
2. **Merma y retrabajo**: un input mínimo en producción (al completar un
   paso: "¿hubo que repetir? causa" + cantidad desperdiciada) habilita
   el eje calidad completo, con benchmarks duros de la industria para
   compararse. Sin eso, esas cards no se ofrecen (regla de honestidad).
3. **Snapshot mensual de agregados**: hoy TODO es on-the-fly y dos cosas
   son irreconstruibles hacia atrás (aging de deuda — denormalizado a
   hoy — y cola/cuello de botella por estación). Una tabla
   `MetricaSnapshotMensual` (tenant, mes, JSON de agregados por eje) al
   cierre de mes: (a) congela lo irreconstruible, (b) congela los costos
   fijos usados en el PE del mes (hoy un PE pasado se recalcula con
   gastos vigentes → sensible a ediciones retroactivas), (c) abarata las
   series largas cuando crezca el volumen. Los meses ya cerrados se leen
   del snapshot; el mes en curso, en vivo.

## 6. Reglas de confiabilidad (heredadas y nuevas)

- Toda serie declara `desdeHayDatos`; sin historia → sin tendencia
  inventada (patrón meta ya implementado).
- Margen y costos SIEMPRE excluyendo y declarando `itemsSinCosto` (OTs
  manuales sin cotización inflan el margen si se ignoran).
- Métricas de tiempo real sólo sobre `tiempoFuente IN (medido,
  medido_lote)` con el filtro de atípicos existente.
- Estacionalidad e YoY: mostrar sólo cuando el denominador de historia
  existe; hasta entonces, versión "año en curso" etiquetada.
- Queries crudas nuevas: filtro `tenantId` manual obligatorio (el
  tenant-guard de Prisma no cubre `$queryRaw`).
- Máximo 3–4 KPIs nuevos por tab (regla Ordant): las cards nuevas
  reemplazan o anidan, no apilan.

## 7. Estado

Estudio sin implementación. Orden natural si se aprueba: F1 completa
(rama `feat/panel-series-dimension`), luego F2; F3 son decisiones de
producto que merecen su propio análisis (el ciclo de cotización en
particular toca el flujo comercial entero).

Fuentes industria: WhatTheyThink (KPIs de Print MIS), Ordant, Rochester
Software Associates, FESPA, Aptean, Printing.org/PIA (Make Time for
KPIs), PrintVis, Avanti Slingshot, EFI Pace/Fiery IQ, Printavo,
Profectus/PIA Ratios, PrintAction. Detalle y URLs en el informe de
investigación de la sesión 2026-07-18.
