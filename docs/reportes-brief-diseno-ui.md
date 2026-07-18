# Inteligencia de negocio — brief de diseño UI/UX

> ⚠️ SUPERADO 2026-07-17. Este brief planteaba 7 pantallas planas. El
> usuario diseñó en su lugar un "Panel general" con TABS POR ROL que se
> adoptó como estructura base. La verdad vigente vive en
> docs/reportes-panel-analisis-diseno.md (mapa de realidad + métricas
> nuevas) y docs/reportes-plan-backend.md (plan alineado al panel). Se
> conserva este archivo sólo como referencia de los componentes globales
> (§2) y contratos base, que siguen aplicando dentro del panel.

## 1. La sección en el sidebar

- Nueva sección top-level: **"Inteligencia"** (propuesta corta; alternativa
  "Inteligencia de negocio"). Ícono sugerido: gráfico/pulso.
- Subitems (uno por pantalla): **Panorama** (el tablero de gerencia),
  **Rentabilidad**, **Ventas**, **Cobranza**, **Producción**, **Costos**,
  **Alertas**.
- Diseñar: el grupo del sidebar con sus subitems (mismo patrón visual que
  Producción/Administración).

## 2. Elementos GLOBALES (diseñar una vez, usar en todas)

Estos componentes se repiten en todas las pantallas — conviene diseñarlos
primero:

1. **Selector de período**: presets (Este mes · Mes pasado · Trimestre ·
   Año · Personalizado con date-range). Vive arriba a la derecha de cada
   pantalla. Todo lo que se ve responde a este selector.
2. **Chip de comparación**: cada número importante muestra su delta vs. el
   período anterior equivalente: `↑ 12%` verde / `↓ 9 pts` rojo / `—` sin
   historia. Definir también el estado "**sin comparativa**" (primer
   período con datos: mostrar el número solo, sin inventar tendencia).
3. **Card de insight**: la unidad de "inteligencia". Contiene: severidad
   (info / atención / crítico), título corto, UNA frase de explicación en
   lenguaje de dueño, y link "ver reporte". Ej.: 🔶 *"3 clientes
   concentran el 62% de tu facturación"* → Ventas.
4. **Tabla de ranking con drill**: patrón tabla (dimensión, monto, %,
   delta) con fila clickeable que abre el detalle (páneles laterales tipo
   sheet, como el resto de la app). Con "mostrar más" (ventana progresiva,
   ya existe el patrón).
5. **Nota de fuente/límite**: pie discreto por reporte: *"Fuente: órdenes
   emitidas. Excluye borradores."* / *"Se descartaron 2 tiempos atípicos."*
6. **Export**: botón CSV por reporte (discreto, junto al período).
7. **Estados**: vacío (sin datos del período), sin historia (sin
   comparativa), y "no disponible aún" (reportes 🔴 del estudio — el
   módulo los muestra apagados con la razón, no los esconde: ej. rotación
   de materiales "disponible cuando el stock registre movimientos").
8. **Gráficos**: definir el lenguaje visual de 4 tipos: línea (series
   temporales), barras horizontales (rankings), barras apiladas
   (composición), y donut chico (mix). Tipografía mono para números,
   formato es-AR ($ 1.234.567 · 12,5%).

## 3. Pantalla: PANORAMA (tablero de gerencia) — la más importante

Una pantalla que el dueño mira a diario. Diseñar:

- **Fila de KPIs** (6): Ventas del período · Margen % · Cobrado vs.
  facturado · Deuda vencida · Entregas a tiempo (OTD) · Carga del taller.
  Cada uno con su chip de comparación y clickeable a su pantalla.
- **Alertas activas** (las cards de insight, máx. 5, ordenadas por
  severidad) — es LA sección diferencial, dale jerarquía.
- **Mini-tendencia**: un gráfico de línea chico de ventas+margen de los
  últimos 6 períodos.
- Ejemplo de datos reales para el mock: Ventas $ 2.340.000 (↑ 12%) ·
  Margen 38,2% (↓ 3 pts) · Cobrado $ 1.980.000 de $ 2.510.000 · Vencido
  $ 410.000 · OTD 84% · Taller 62% ocupado.

## 4. Pantalla: RENTABILIDAD

- KPIs: Ventas · Costo · Margen $ · Margen %.
- **Switcher de dimensión**: Por categoría / Por cliente / Por producto /
  Por vendedor / Por canal — misma tabla de ranking, distinta dimensión
  (así se diseña UNA vez).
- Tabla: nombre, facturado, margen $, margen %, delta, y señal ⚠ cuando
  margen % < umbral. En "Por cliente": badge "precio especial" cuando
  aplica.
- **Drill (sheet)**: al click, detalle de la fila: top items del período,
  composición del costo (material/máquina/MO — barras apiladas), y sus
  insights (ej. "margen 12 pts bajo el promedio de su categoría").
- Vista secundaria: **margen teórico vs. operativo** (cuando tiempos
  reales difieren) — puede ser un tab: familia, tiempo cotizado, tiempo
  real, sobrecosto $ estimado.

## 5. Pantalla: VENTAS

- KPIs: Facturación · Órdenes · Ticket promedio · Items/orden.
- Serie temporal (línea, granularidad según período: día/semana/mes).
- **Mix** (donut o barras apiladas): por categoría comercial; toggle
  por tecnología y por canal.
- **Concentración**: top-5 clientes con % acumulado (barra apilada
  horizontal 100%).
- **Clientes dormidos**: tabla — cliente, última compra, facturación
  histórica, días sin comprar. Con acción sugerida (link al cliente).
- **Pipeline**: borradores abiertos (cantidad, $, antigüedad).

## 6. Pantalla: COBRANZA

- KPIs: Facturado · Cobrado · Brecha · DSO (días promedio de cobro).
- **Aging de deuda**: barras por franja (al día / 0-30 / 31-60 / 61-90 /
  +90) + tabla por cliente con drill a sus comprobantes.
- **Costo de cobrar**: tabla por método de pago — cobrado bruto,
  comisiones, neto, % — con insight (ej. "MercadoPago: $ 41.000 este
  mes, 5,2%").
- **Cheques en cartera**: tabla por estado con vencimientos próximos
  resaltados.
- **Fondos**: saldo por cuenta (cards chicas) + flujo neto del período.

## 7. Pantalla: PRODUCCIÓN (mirada de gerencia, no de operador)

- KPIs: OTD % · Atraso promedio · Lead time promedio · Horas bloqueadas.
- **OTD**: serie temporal + tabla de órdenes atrasadas del período (con
  días de atraso y en qué estación se atrasaron).
- **Precisión de estimación**: tabla por familia — tiempo estimado
  mediano, real mediano, razón (×), señal cuando >1,5×, y "n muestras"
  (con pocos datos se muestra apagado). Nota de límite: "excluye N
  tiempos atípicos".
- **Utilización de capacidad**: barras por centro — horas reales vs.
  capacidad práctica del período, con % y señal < umbral.
- **Bloqueos**: motivos más frecuentes (ranking) + horas perdidas.

## 8. Pantalla: COSTOS + Pantalla: ALERTAS

**Costos**:
- Composición del costo del período (barras apiladas por categoría:
  material/máquina/MO/consumibles/cargos).
- **Salud de tarifas**: tabla de centros — período de tarifa vigente,
  meses sin actualizar, % de la facturación que pasa por él, señal ⚠.
- Inventario valorizado (cards por familia de material) con la nota
  "según carga inicial" mientras no fluyan movimientos.

**Alertas** (el centro de insights):
- Lista completa de alertas activas (las mismas cards del Panorama, con
  historial simple: activa desde…).
- **Configuración de umbrales**: panel simple — cada regla con su número
  editable (margen mínimo %, días de cliente dormido, % concentración,
  razón de tiempos, meses de tarifa vieja). Patrón visual del stepper del
  margen-ETA.

## 9. CONTRATOS de datos por pantalla (a esto se atan los diseños)

El backend expone estos campos — diseñar mostrando exactamente esto (los
nombres finales pueden ajustar, la FORMA no):

- **Panorama**: `{ kpis: { ventas, ventasDelta, margenPct, margenDelta,
  cobrado, facturado, deudaVencida, otdPct, otdDelta, cargaTallerPct },
  alertas: [{ severidad, titulo, detalle, reporte }], tendencia:
  [{ periodo, ventas, margenPct }] }`
- **Rentabilidad**: `{ kpis, filas: [{ id, nombre, facturado, margen,
  margenPct, delta, alerta?, precioEspecial? }], detalle(fila): { items,
  composicionCosto: { material, maquina, manoObra, otros } } }`
- **Ventas**: `{ kpis, serie: [{ fecha, monto }], mix: [{ nombre, monto,
  pct }], concentracion: [{ cliente, pct, acumulado }], dormidos:
  [{ cliente, ultimaCompra, diasSinComprar, historico }], pipeline:
  { cantidad, monto, antiguedadPromedio } }`
- **Cobranza**: `{ kpis: { facturado, cobrado, brecha, dso }, aging:
  [{ franja, monto }], porCliente: [{ cliente, alDia, v30, v60, v90,
  vMas }], costoCobrar: [{ metodo, bruto, comision, neto, pct }],
  cheques: [{ estado, cantidad, monto, proximoVencimiento }], fondos:
  [{ cuenta, saldo }] }`
- **Producción**: `{ kpis: { otdPct, atrasoPromedioDias, leadTimeDias,
  horasBloqueadas }, otdSerie, atrasadas: [{ orden, cliente, diasAtraso,
  estacion }], precision: [{ familia, estimadoMin, realMin, razon,
  muestras, atipicosExcluidos }], utilizacion: [{ centro, horasReales,
  capacidadPractica, pct }], bloqueos: [{ motivo, veces, horas }] }`
- **Costos**: `{ composicion, tarifas: [{ centro, periodoVigente,
  mesesSinActualizar, pctFacturacion }], inventario: [{ familia,
  valorizado }] }`
- **Alertas**: `{ activas: [...], umbrales: { margenMinPct,
  diasClienteDormido, concentracionMaxPct, razonTiemposMax,
  mesesTarifaVieja, deudaVencidaMaxPct } }`

## 10. Checklist de entrega

- [ ] Grupo de sidebar + 7 subitems
- [ ] Componentes globales (§2): período, chip delta, card insight, tabla
      ranking + drill, nota de fuente, estados vacío/sin-historia/no-disponible
- [ ] Panorama · Rentabilidad (+drill) · Ventas · Cobranza · Producción ·
      Costos · Alertas (+config umbrales)
- [ ] Versión responsive razonable (el dueño mira el Panorama del teléfono)
