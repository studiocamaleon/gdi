# Panel general — análisis del diseño vs. datos reales + métricas de alto valor

> 2026-07-17. Cruza el "Panel general" que diseñó el usuario (proyecto
> Grafoprint en claude.ai/design: panel.jsx + panel-tabs.jsx) contra los
> datos que el sistema captura HOY (verificado en schema y DB), y define
> las métricas nuevas pedidas: margen de contribución por centro, punto de
> equilibrio, flujo de caja proyectado, e inteligencia profunda de venta.
> Sucede a docs/reportes-inteligentes-estudio.md.

## 1. Veredicto sobre la ESTRUCTURA (adoptar)

La estructura del panel es la correcta y se adopta tal cual:

- **Tabs por rol** (Resumen ejecutivo · Comercial · Producción · Finanzas
  · Inventario) — es exactamente el "pensar por rol" del estudio, mejor
  ejecutado que las 7 pantallas planas del brief anterior. El brief de
  diseño (reportes-brief-diseno-ui.md) se REEMPLAZA por esta estructura.
- **Selector de período** arriba a la derecha, con export. ✅
- **Fila de KPIs** con sparkline + delta + subtítulo comparativo. ✅ (el
  sparkline necesita historia — ver §5).
- **Grid de cards** con spans (4/6/8/12) y vocabulario visual rico
  (barras, área, ranking, tabla, donut, anillo, stacked, funnel,
  heatmap). ✅ — se conserva el sistema, se cambia QUÉ alimenta cada card.

El trabajo no es rediseñar: es **reemplazar los datos mock por los reales
donde existen, reformular donde el dato es distinto al supuesto, y retirar
lo que no capturamos** — diciéndolo, no escondiéndolo.

## 2. Mapa de realidad, card por card (el diseño actual)

🟢 real y directo · 🟡 real pero parcial/aproximado o necesita historia ·
🔴 el dato no existe hoy

### Tab Resumen ejecutivo
| Card del diseño | Realidad | Nota |
|---|---|---|
| KPI Facturación MTD + delta | 🟢 | OTs emitidas; delta necesita mes anterior |
| KPI Margen bruto | 🟢 | Σ(precio−costo) del snapshot |
| KPI Backlog producción (días) | 🟢 | reusa el motor de carga/cola |
| KPI OTIF | 🟡→🟢 | tenemos **OTD** (a tiempo); "in-full" no se mide → renombrar a OTD |
| KPI Cotizaciones abiertas ($ pipeline) | 🔴 | las cotizaciones no tienen estados de pipeline (todas "borrador") |
| Facturación/costo/margen 12m (barras) | 🟡 | real, pero necesita ~12 meses de historia |
| **Embudo comercial** (funnel) | 🔴 | no hay estados cotización→aprobada→… |
| Clientes principales (ranking) | 🟢 | por facturación real |
| Productos con mayor margen (tabla) | 🟢 | del snapshot por item |
| Alertas operativas | 🟡 | las de plata/tiempo 🟢; stock 🔴 |
| **Salud de flota / OEE** | 🔴 | ver §4 (OEE no es computable) |

### Tab Comercial
| Card | Realidad | Nota |
|---|---|---|
| Cotizaciones emitidas / Win rate / Pipeline kanban por etapa | 🔴 | requiere ciclo de cotización con estados — no existe |
| Ticket promedio, nuevos clientes | 🟢 | de OTs reales |
| Ranking vendedores (facturación) | 🟢 | vendedor por OT |
| Productos más cotizados / conversión | 🔴 | sin funnel |
| Órdenes recientes (tabla) | 🟢 | reemplaza "cotizaciones recientes" |

### Tab Producción
| Card | Realidad | Nota |
|---|---|---|
| **OEE general + por máquina** (Disp×Rend×Cal) | 🔴 | sin downtime ni calidad; ver §4 |
| OTIF/OTD | 🟢 | fecha entrega vs. finalización |
| **Heatmap máquina × hora** | 🟡 | aproximable de timestamps de pasos; caro, baja fidelidad |
| Utilización por centro vs. capacidad | 🟢 | minutos reales vs. capacidadPractica — la métrica correcta que el heatmap intentaba |
| Throughput diario | 🟢 | pasos/órdenes finalizadas por día |
| Trabajos por estación (cola/cap) | 🟢 | ya existe en el tablero |
| Tiempo de cambio (setup) medido | 🔴 | sólo hay setup ESTIMADO de config, no medido |
| **Causas de reproceso** | 🔴 | no hay módulo de calidad/rechazo |
| Precisión estimado vs. real | 🟢 | (no está en el diseño; AGREGAR — es la joya) |

### Tab Finanzas
| Card | Realidad | Nota |
|---|---|---|
| Facturación vs costo 12m | 🟡 | necesita historia |
| Margen bruto, DSO | 🟢 | |
| **Cuentas por cobrar / aging** | 🟢 | Comprobante.saldo por antigüedad |
| **Flujo proyectado 30d** | 🟡 | ver §3 (ingresos sí, egresos no) |
| Presupuesto vs real por categoría | 🔴 | no hay presupuesto cargado |
| **Gasto por centro de costo** (donut) | 🟢 | componentes de costo por período — REAL |
| Deudores principales (tabla+aging) | 🟢 | |

### Tab Inventario
| Card | Realidad | Nota |
|---|---|---|
| Stock crítico / punto de pedido / cobertura | 🔴 | sin puntos de pedido ni movimientos de stock |
| **Consumo de tintas CMYK** | 🟡 | TEÓRICO del snapshot (trazabilidad lista consumibles por item), no de stock real |
| Movimientos recientes | 🔴 | 0 movimientos registrados |
| **Top materiales por consumo** | 🟡 | teórico del snapshot — SÍ se puede (ver §3.D) |
| Valor de inventario | 🟡 | stock×costo cargado inicial, envejece sin flujo |

**Resumen**: el eje Finanzas y buena parte de Resumen/Comercial-real y
Producción son 🟢/🟡 hoy. Lo mock-aspiracional se concentra en: funnel
comercial, OEE, y todo el tab Inventario operativo (porque el flujo de
stock aún no corre).

## 3. Las MÉTRICAS NUEVAS pedidas (el corazón del valor)

### A. Margen de contribución — 🟢 a nivel taller, 🟡 por centro

**Definición limpia para imprenta**:
- **Costos variables** (escalan con cada trabajo): materiales +
  consumibles/tintas — del `trazabilidadJson` por item. 🟢
- **Costos estructurales/fijos** (se pagan igual haya o no trabajo):
  `CentroCostoComponenteCostoPeriodo` — SUELDOS, CARGAS, ALQUILER,
  ENERGÍA, AMORTIZACIÓN, MANTENIMIENTO por período. **Verificado: cargados
  ($25,5M sueldos + $12,4M cargas + amortización/energía/mant. en dev)**.
- **Margen de contribución** = Ventas − Costos variables. 🟢 ambos lados
  reales.
- **Margen de contribución %** = MC / Ventas.

**Por centro de costo** (🟡 — requiere una regla de atribución, decisión
tuya): lo LIMPIO y real es mostrar por centro su **costo estructural
absorbido** (Σ componentes del período) y las **horas reales que
trabajó** (de los pasos) → deja ver qué centro se paga solo y cuál no.
La versión "MC generada por centro" necesita repartir el precio del item
entre sus pasos (regla: proporcional al costo de cada paso) — es un v2 con
la regla declarada, no un número que se pueda fingir exacto.

### B. Punto de equilibrio — 🟢 (métrica estrella, rara en software chico)

Con A resuelto, sale directo:
- **Punto de equilibrio ($)** = Costos fijos del período / (MC / Ventas).
- Lectura: *"Necesitás facturar $X al mes para cubrir tu estructura;
  este mes vas $Y (78% del PE al día 20)"*.
- Se puede mostrar como gauge (avance hacia el PE) + la fecha estimada en
  que se cruza. **Todo el dato existe** (fijos cargados, variables del
  snapshot). Es EL número que un dueño de imprenta nunca tuvo y cambia
  cómo decide.

### C. Flujo de caja proyectado — 🟡 (fuerte en ingresos, débil en egresos)

- **Ingresos proyectados** (🟢): `Comprobante.saldo` pendiente + fechas
  esperadas (plan de pagos si existe), y `Valor` (cheques) con
  `vencimiento` → línea de cobranzas futura, semana a semana.
- **Egresos proyectados** (🔴 hoy): no hay cuentas por pagar / órdenes de
  compra fluyendo. Sólo los fijos conocidos (componentes de costo) como
  egreso recurrente estimado.
- **Honesto v1**: "Proyección de cobranzas" (ingresos ciertos por
  vencimiento) + egreso fijo estimado (la estructura mensual) → un
  proxy de caja. Se etiqueta claro: "egresos = estructura fija; no incluye
  compras variables". El flujo completo llega cuando exista el módulo de
  compras/pagos a proveedores.

### D. Inteligencia profunda de venta — 🟢 casi todo

- **Por categoría / subcategoría comercial**: 🟢 ventas, margen, mix.
- **Por producto**: 🟢 top/bottom por volumen y por margen.
- **Por USO DE PAPEL / material**: 🟢 — la trazabilidad lista el material
  y su cantidad por item. "Consumiste 84 resmas de opalina 300g este mes,
  el 62% en tarjetería; su costo subió 18%". Conecta con los simuladores.
- **Por MEDIDA / tamaño**: 🟢 — `jobContext` guarda `medidaPredefinida`
  y las piezas con ancho×alto. "Las medidas 90×50 (tarjeta) y 100×150
  (gran formato) son el 40% de tus órdenes"; m² vendidos por rango de
  tamaño. Muy potente para gran formato.
- **Por tecnología** (láser/UV/eco/DTF): 🟢 del jobContext.
- **Consumo de tintas** (CMYK+spot): 🟡 teórico del snapshot — sirve para
  tendencia y para anticipar compra, no como stock real.

## 4. Lo que hay que RETIRAR o REFORMULAR (y por qué)

Ser honesto acá ES la inteligencia del sistema:

- **OEE** (Disponibilidad × Rendimiento × Calidad): no computable. No
  registramos downtime de máquina (disponibilidad) ni rechazos/calidad.
  **Reformular a "Eficiencia de tiempo"**: tiempo real vs. cotizado por
  familia/centro — que SÍ tenemos y mide lo mismo que "Rendimiento", la
  única de las tres patas con dato. Honra el espíritu del card sin fingir.
- **Funnel / win rate / pipeline por etapas / "por vencer"**: las
  cotizaciones no tienen ciclo de estados (todas "borrador"; se convierten
  en OT sin dejar rastro de rechazo). Sin eso no hay embudo. **Requiere
  primero** que el flujo comercial capture estados de cotización — es un
  prerequisito de producto, no un reporte. Hasta entonces, el tab
  Comercial se apoya en lo real: ventas, vendedores, ticket, clientes.
- **Heatmap máquina × hora**: aproximable pero caro y de baja fidelidad
  (los timestamps de pasos no son ocupación de máquina real). **Sustituir
  por "Utilización por centro vs. capacidad práctica"** — mismo mensaje,
  dato limpio.
- **Setup medido, causas de reproceso, stock crítico/cobertura/
  movimientos**: dependen de datos que no fluyen (calidad, compras,
  consumo de stock). El módulo los muestra como "disponible cuando…" en
  vez de inventarlos. El tab Inventario, hoy, es mayormente eso.

## 5. Prerequisitos que este análisis destapa

1. **Historia**: los 12 meses y los sparklines necesitan meses de datos.
   El sistema es joven → degradar con gracia ("desde que hay datos"), no
   inventar tendencia.
2. **Estados de cotización** (para todo el eje comercial-funnel): decidir
   si se implementa el ciclo cotización→enviada→aprobada/rechazada. Es la
   llave del tab Comercial "de verdad".
3. **Flujo de stock** (compras + consumo por paso): llave del tab
   Inventario. Ya identificado como pendiente del módulo inventario.
4. **Clasificación fijo/variable explícita**: hoy se infiere (componentes
   = fijo; material/consumible = variable). Para el PE fino conviene poder
   marcar un componente como semivariable. v2.

## 6. Propuesta de tabs revisada (todo real o reformulado)

- **Resumen ejecutivo**: Facturación · Margen bruto · **Margen de
  contribución** · **Punto de equilibrio** (gauge) · OTD · Carga taller.
  Barras facturación/costo/margen (con la nota "desde mes N"). Top
  clientes 🟢. Top productos por margen 🟢. Alertas (las reales).
- **Comercial**: Ventas · Ticket · Nuevos clientes · Clientes dormidos.
  Ranking vendedores 🟢. Mix por categoría/tecnología 🟢. Órdenes
  recientes 🟢. (Sin funnel hasta tener estados de cotización.)
- **Producción**: OTD · Lead time · **Eficiencia de tiempo** (real vs
  cotizado) · Horas bloqueadas. Utilización por centro vs. capacidad 🟢.
  Throughput 🟢. Trabajos por estación 🟢. Bloqueos por motivo 🟢.
- **Finanzas**: Facturación · MC% · Aging · DSO · **Punto de equilibrio**
  · **Proyección de cobranzas**. Aging 🟢. **Gasto por centro de costo**
  (donut) 🟢. **Costo de cobrar** (comisiones método de pago) 🟢.
  Deudores 🟢. Cheques 🟢.
- **Ventas & Producto** (tab nuevo, reemplaza Inventario operativo):
  ventas por categoría/producto/**papel**/**medida**/tecnología 🟢 — la
  inteligencia comercial profunda que pediste, que es más valiosa que el
  inventario que aún no fluye. Consumo teórico de materiales/tintas 🟡.
- **Inventario**: se mantiene como esqueleto, mostrando "disponible cuando
  el stock registre movimientos", hasta que fluya.

## 7. Estado

Análisis, sin implementación. Cuando se apruebe esta lectura: el plan
backend (reportes-plan-backend.md) se ajusta a estas tabs y métricas
(agregar services de contribución/PE y de inteligencia de producto;
quitar funnel/OEE de fase 1), y los diseños se adaptan card por card
sobre los contratos.
