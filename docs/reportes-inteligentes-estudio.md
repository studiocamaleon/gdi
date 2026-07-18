# Reportes inteligentes — estudio de fundación (Gerencia)

> Estudio 2026-07-17. SIN implementación: define qué reportes y métricas
> puede producir el sistema HOY con los datos que ya captura, empezando
> por gerencia. Es el módulo que le da la "I" a "Gráfica Digital
> Inteligente" — se diseña sobre datos verificados en el schema y la DB,
> no sobre deseos.

## 1. Qué hace "inteligente" a un reporte acá

Tres niveles, en orden de valor:

1. **Métrica**: el número ("margen del mes: 38%").
2. **Reporte**: el número con dimensión y comparación ("margen por
   categoría, este mes vs. anterior").
3. **Insight**: la lectura hecha por el sistema, en lenguaje de dueño de
   imprenta, con la acción sugerida ("El margen de Gran formato cayó 9
   puntos: el costo de vinilo subió 18% y las tarifas del centro UV no se
   tocan desde marzo — revisá tarifas o precios").

El diferencial del sistema es el nivel 3: el usuario no-técnico no
interpreta tablas — el sistema interpreta por él. Cada reporte de este
estudio define sus insights asociados.

## 2. La materia prima: datos REALES disponibles (verificado)

| Dominio | Qué hay persistido | Madurez |
|---|---|---|
| Venta | `OrdenTrabajo`: estado, fechaEmision, fechaEntrega, canalVenta, cliente, vendedor, subtotal/impuestos/total; `Cotizacion(Item)` snapshot con **costoTotal y precioTotal por item**, precio especial usado, impuestos y comisiones snapshoteados | 🟢 sólida |
| Producción | `OrdenTrabajoItemPaso`: familia, centro, duración ESTIMADA y REAL (iniciadoEl/completadoEl), estados, bloqueos con motivo, mesaUsuarioId; eventos con timestamps de todo el ciclo | 🟢 sólida (calidad del tiempo real depende de disciplina de marcado) |
| Capacidad | Estaciones + calendarios + puestos + feriados; `CentroCostoCapacidadPeriodo`: **capacidad teórica y práctica en horas por período** | 🟢 recién construida |
| Costos | Centros con tarifas POR PERÍODO (historial), componentes de costo, trazabilidad por paso: material + máquina + MO + consumibles + cargos, `aprovechamientoPct` del nesting | 🟢 sólida |
| Administración | `Comprobante` (neto/IVA/total, **saldo pendiente**, CAE), `Cobro` (bruto, **comisión del método de pago**, neto acreditado, cuenta), imputaciones, `Valor` (cheques con estado/vencimiento), `MovimientoFondos`/`CuentaFondos` | 🟢 sólida |
| Inventario | Stock por variante×ubicación con costoPromedio; `MovimientoStockMateriaPrima` (estructura lista) | 🟡 estructura sí, **flujo no** (0 movimientos: compras/consumos aún no se registran) |
| Clientes | Cartera, canal, precios especiales por cliente | 🟢 |
| Comisiones | `EmpleadoComision` + comisión snapshoteada por item vendido | 🟢 |

Dos ausencias honestas que acotan reportes (ver §6): consumo REAL de
material por orden (el nesting da el teórico), y presupuestos: si no se
emiten por el sistema, no hay tasa de conversión.

## 3. Catálogo de reportes de GERENCIA

Formato: **Reporte** — qué responde · dimensiones · insight asociado ·
semáforo de viabilidad HOY.

### Eje A — Rentabilidad (el corazón del módulo)

- **A1. Margen real del período** — ¿gané plata y cuánta? Ventas,
  costo, margen $ y %, comparado con período anterior. 🟢 (snapshot
  costo/precio por item; es una agregación directa).
  - Insight: "El margen % cayó N puntos vs. el mes pasado; el driver fue
    [categoría/cliente/costo]".
- **A2. Margen por categoría/subcategoría comercial** — ¿qué línea de
  negocio deja plata? Ranking por margen $ y por margen %. 🟢
  - Insight: categoría con margen % < umbral configurable → "revisar
    precios o costos"; categoría que factura mucho y margina poco.
- **A3. Margen por cliente** — ¿quién parece buen cliente y no lo es?
  Facturación vs. margen aportado, con precios especiales señalados. 🟢
  - Insight: "El cliente X es tu 3° en facturación pero 12° en margen: su
    precio especial de vinilos está 18% bajo la lista".
- **A4. Margen por producto** — top/bottom productos por margen. 🟢
  - Insight: productos vendidos bajo umbral de margen → candidatos a
    re-pricing (el costo del snapshot ya trae el desglose para explicar).
- **A5. Margen por vendedor y canal** — ¿quién vende bien (no solo
  mucho)? Incluye comisiones devengadas (snapshot por item). 🟢
- **A6. Margen teórico vs. margen "real operativo"** — ¿la eficiencia se
  come el margen? Recalcula el costo de MO/máquina con los TIEMPOS
  REALES de los pasos vs. los estimados que se cotizaron. 🟡 (la
  mecánica existe: tiempo real × tarifa del período; requiere disciplina
  de marcado de pasos para ser justo).
  - Insight: "Los trabajos de encuadernado insumen 1,8× el tiempo
    cotizado: estás regalando $N por mes en esa familia".

### Eje B — Ventas y comercial

- **B1. Ventas del período** — facturación emitida, cantidad de órdenes,
  ticket promedio, items por orden; serie mensual/semanal. 🟢
- **B2. Mix de ventas** — por categoría, tecnología, canal. 🟢
- **B3. Concentración de cartera** — top-N clientes y % del total
  (riesgo de dependencia). 🟢
  - Insight: "3 clientes concentran el 62% de tu facturación".
- **B4. Recencia/frecuencia de clientes** — clientes nuevos vs.
  recurrentes; clientes que DEJARON de comprar (sin órdenes hace N días
  teniendo historial). 🟢
  - Insight: "8 clientes con compras recurrentes no ordenan hace 60+
    días — $N de facturación histórica en riesgo".
- **B5. Pipeline** — borradores abiertos y su valor; envejecimiento de
  borradores. 🟢 (estado borrador + createdAt).
- **B6. Conversión presupuesto→orden** — 🔴 hoy: requiere que los
  presupuestos se emitan por el sistema (la ficha ya soporta el tipo;
  falta que el uso real lo adopte).

### Eje C — Cobranza y finanzas

- **C1. Facturado vs. cobrado del período** + brecha. 🟢
- **C2. Aging de deuda** — saldos de comprobantes por antigüedad
  (0-30/31-60/61-90/+90), por cliente. 🟢 (`Comprobante.saldo`
  denormalizado + fecha).
  - Insight: "La deuda vencida (+60d) equivale a 1,4 meses de
    facturación; el 70% es de 2 clientes".
- **C3. DSO** (días promedio de cobro) — fecha comprobante → imputaciones
  de cobros. 🟢
- **C4. Costo de cobrar** — comisiones de métodos de pago (dato por
  cobro: bruto vs. neto acreditado) por método y período. 🟢 — reporte
  que casi ningún sistema chico da y acá es gratis.
  - Insight: "MercadoPago te costó $N este mes (5,2% de lo cobrado por
    esa vía); mover el 20% a transferencia son $M al año".
- **C5. Cheques en cartera** — valores por estado y vencimiento. 🟢
- **C6. Posición de fondos** — saldo por cuenta + flujo del período. 🟢

### Eje D — Producción y eficiencia (gerencia, no operación)

- **D1. Cumplimiento de entregas (OTD)** — % de órdenes finalizadas en
  fecha; atraso promedio; serie temporal. 🟢 (fechaEntrega vs. evento
  de finalización).
  - Insight: "Este mes entregaste a tiempo el 71% (vs. 88% anterior); el
    atraso se concentra en órdenes que pasan por [estación]".
- **D2. Precisión de estimación por familia/centro** — tiempo real vs.
  estimado (razón mediana). Alimenta directamente la calidad de las ETAs
  y la demora sugerida del cotizador. 🟢 (ya hay 18 pasos con tiempos
  reales en dev; el reporte gana con volumen).
  - Insight: "La familia laminado corre sistemáticamente al doble del
    estimado → recalibrar el tiempo del paso (afecta cotización Y
    promesas)".
- **D3. Utilización de capacidad por centro** — minutos reales
  trabajados vs. `capacidadPractica` del período del centro. 🟢 —
  cruza dos datos que YA existen y nadie mira juntos.
  - Insight: "El centro UV usó el 34% de su capacidad práctica: la
    tarifa horaria asume un reparto que no está ocurriendo — tu costo
    real por hora es mayor al configurado".
- **D4. Bloqueos** — frecuencia, motivos (texto libre agrupable), tiempo
  perdido en bloqueado, por estación. 🟢
- **D5. Lead time** — emisión → finalización, por categoría; y tiempo
  en cada etapa (eventos + pasos). 🟢
- **D6. Aprovechamiento de material (teórico)** — `aprovechamientoPct`
  promedio del nesting por material/tecnología; ahorro logrado por
  consolidar en los simuladores (consumo cotizado vs. re-nesteado). 🟡
  (el teórico es 🟢; el REAL exige consumo de stock por paso — §6).
- **D7. Carga y proyección** — foto gerencial de lo ya construido: cola
  en horas por estación, carga en camino, ETAs vs. entregas
  comprometidas ("¿llego con todo lo prometido?"). 🟢 (reusa el motor
  de simulación tal cual).

### Eje E — Costos y precios

- **E1. Composición del costo** — material / máquina / MO / consumibles /
  cargos, por categoría y período (la trazabilidad lo trae por paso). 🟢
- **E2. Salud de tarifas** — centros cuyo período de tarifas quedó viejo
  (sin actualizar hace N meses) y qué % de lo cotizado pasa por ellos. 🟢
  - Insight: "El 80% de tu facturación se cotiza con tarifas de hace 4
    meses — con la inflación acumulada estás subvaluando el costo".
- **E3. Inventario valorizado** — stock × costoPromedio por familia de
  material; inmovilizado. 🟢 estructura / 🟡 confiabilidad (sin flujo de
  movimientos, el stock cargado envejece).
- **E4. Rotación y consumo de materiales** — 🔴 hoy (0 movimientos de
  stock; el consumo por paso no descuenta — pendiente conocido del
  módulo inventario).

## 4. El tablero de gerencia (la síntesis)

Una sola pantalla con 6-8 números que el dueño mira a diario, cada uno
clickeable hacia su reporte: ventas del mes vs. anterior · margen % ·
cobrado vs. facturado · deuda vencida · OTD · carga del taller (horas de
cola vs. capacidad) · alertas activas (los insights de §3 que hoy
disparan). **Todo 🟢 con datos actuales.**

## 5. Insights: el catálogo inicial de reglas

Los de §3 más las transversales: margen de categoría cae >N pts ·
cliente top sin comprar >N días · deuda vencida >N% de facturación
mensual · familia con real/estimado >1,5× sostenido · centro <N% de
utilización sostenida · tarifas sin actualizar >N meses · borradores
>N días sin emitir · concentración top-3 >N%. Umbrales con default
sensato y configurables (patrón margen-ETA). Cada insight: severidad,
explicación en una frase, y link al reporte que lo fundamenta.

## 6. Prerequisitos de calidad de dato (honestidad del módulo)

1. **Tiempos reales** dependen de que el taller marque pasos (la mediana
   resiste outliers, pero D2/A6 deben excluir pasos "olvidados" — regla:
   descartar duraciones > P95 o > N× estimado, y DECIRLO en el reporte).
2. **Historia corta**: las comparaciones mes-a-mes necesitan meses. El
   módulo debe degradar con gracia ("primer período: sin comparativa")
   en vez de mostrar tendencias inventadas.
3. **Consumo real de material** y **movimientos de stock**: hasta que
   fluyan, E3 se etiqueta "según carga inicial" y E4 no se ofrece.
4. **Presupuestos**: B6 se habilita solo cuando se usen.
5. Todo reporte declara su fuente y su límite — la inteligencia también
   es saber decir "esto todavía no lo sé".

## 7. Arquitectura propuesta (para cuando se implemente — NO ahora)

- Módulo `/reportes` con endpoints de agregación server-side por rango
  (SQL agregado, no procesar en el front), comparativa automática contra
  el período anterior equivalente, export CSV.
- Los insights corren sobre los mismos agregados (sin infra nueva);
  fase posterior: resumen semanal/mensual programado.
- **Fase 1**: tablero de gerencia (§4) + ejes A y C (plata primero).
  **Fase 2**: D y E (eficiencia). **Fase 3**: insights configurables +
  vistas por rol.

## 8. Después de gerencia: los otros roles (esbozo)

- **Vendedor**: mis ventas/comisiones, mis clientes dormidos, mis
  borradores, margen de lo que vendo (aprender a vender margen).
- **Jefe de taller**: ya tiene el 80% (tablero/estaciones/simuladores);
  sumar D2/D4 operativos por estación.
- **Administración**: C completo en detalle + conciliación.
