# Métricas históricas del ETA — diseño

> Análisis 2026-07-22. Sucesor natural de docs/simulacion-flujo-diseno.md (el
> motor que produce el ETA) y de docs/capacidad-estaciones-diseno.md (la cola
> en horas). Precedentes de persistencia derivada: `AhorroConsolidacion`
> (métrica de valor snapshoteada al ocurrir) y el snapshot mensual F2 del
> Panel (diseñado, pendiente). Precedente de cron: `AcreditacionesScheduler`.

## 1. Estado actual (relevado)

- **El ETA es efímero.** `simularFlujo` (src/lib/flujo-produccion.ts) corre
  EN EL FRONTEND cada vez que se abre el tablero/mesa de luz: devuelve
  `porItem` (finEstimado, sinEstimar, parcial, asumeDesbloqueo),
  `llegadasPorEstacion` y la `traza` completa (`PasoProgramado`: inicio, fin,
  duración, **esperaMin**, **candidatos**, preparación, parcial, tercerizado).
  Nada de esto se guarda: cada corrida pisa a la anterior y no queda rastro.
- **La realidad SÍ se persiste**: `OrdenTrabajoItemPaso.iniciadoEl` /
  `completadoEl` / `tiempoRealMin` (registro de tiempos por tramos),
  `duracionEstimadaMin` (snapshot del motor al emitir), estados de la OT.
  También `fechaEntrega` prometida.
- **La demora sugerida del cotizador** (`estimarDemoraNuevos`) tampoco deja
  rastro: se muestra en la ficha y muere ahí.
- **Conclusión**: tenemos el "real" histórico pero no el "prometido/previsto"
  histórico. Sin capturar la predicción en el momento en que se hace, ninguna
  métrica de precisión es reconstruible a posteriori (la simulación de hoy no
  puede reproducir el estado del taller de hace 3 semanas).

## 2. Concepto

El ETA produce tres verdades distintas, con ciclos de vida distintos:

1. **La promesa** — el ETA en el instante de un hito de negocio (emitir la
   OT, cotizar). Se congela UNA vez por hito y después se compara con el fin
   real. Vive en la orden.
2. **La foto del plan** — el estado de colas/esperas/utilización que el
   scheduler proyecta HOY para los próximos días. Se snapshotea a intervalo
   fijo (diario) y forma series temporales. Vive por estación y por item.
3. **El cierre** — al terminar un item, la descomposición de su ciclo real
   (trabajo vs espera vs traslado vs proveedor) contra lo previsto. Se
   calcula una vez, cuando ya no va a cambiar. Vive en el item terminado.

Regla de diseño: **cada métrica se captura en el momento más barato en que
existe**, no se reconstruye. La promesa en el evento; la foto en el cron; el
cierre en la transición a "finalizada".

## 3. Decisiones

- **D1 — El motor se porta al API.** `simularFlujo` es puro y determinista
  (sin deps de React); se copia espejo a
  `apps/api/src/produccion/flujo-produccion.ts` igual que ya se espeja
  `calendario.ts`. El API pasa a ser el ÚNICO escritor de snapshots (cron +
  hitos); el front conserva su copia para la interactividad de la mesa de
  luz. Riesgo de divergencia aceptado y acotado: los specs de la aritmética
  se duplican también, y el doc marca que todo cambio al motor toca los dos.
- **D2 — Granularidad item, no orden.** `porItem` ya es por item; la promesa
  y el cierre se guardan por `OrdenTrabajoItem`. La vista por orden agrega
  (máximo de los items).
- **D3 — Hitos de promesa: emisión y recotización explícita.** No se congela
  en cada recálculo (eso es la foto diaria, D4). `etaAlEmitir` no se pisa
  nunca; si el taller repromete formalmente (cambio de fecha de entrega), se
  agrega una fila nueva de hito, no se edita la anterior.
- **D4 — Foto diaria, no por corrida.** Un snapshot por día por tenant
  (cron 03:00, después del barrido de acreditaciones) alcanza para series;
  snapshotear cada corrida del front sería ruido y acoplaría la telemetría a
  que alguien abra el tablero.
- **D5 — La traza NO se persiste completa.** Se persisten AGREGADOS por
  estación (espera p50/p90, contención, utilización, cola) y un registro
  compacto por item (finEstimado del día). La traza cruda pesa y su valor
  histórico es bajo: lo que importa ya está resumido.
- **D6 — Sin estimar / parcial se snapshotean como flags**, no se excluyen:
  la cobertura del ETA es una métrica en sí misma (grupo E).
- **D7 — Retención simple**: snapshots diarios se conservan 18 meses (igual
  criterio que el snapshot mensual del Panel); promesas y cierres son
  permanentes (viven con la orden).
- **D8 — Zona horaria del taller** para "el día" del snapshot (misma
  convención que DiaNoLaborable: fecha local sin hora).

## 4. Modelo de datos (Prisma, esquema propuesto)

### 4.1 Promesa por hito — `EtaPromesa`

```prisma
model EtaPromesa {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @db.Uuid
  ordenId        String   @db.Uuid
  itemId         String   @db.Uuid
  /// 'emision' | 'repromesa' | 'cotizacion' (fase 3).
  hito           String
  /// Cuándo se congeló.
  congeladaEl    DateTime @default(now())
  /// null = el motor no pudo estimar (se guarda igual: cobertura).
  finEstimado    DateTime?
  sinEstimar     Boolean  @default(false)
  parcial        Boolean  @default(false)
  /// Fecha de entrega prometida al cliente EN ese momento (colchón).
  fechaEntrega   DateTime?
  /// ── Se completan al cerrar el item (una sola vez) ──
  finReal        DateTime?
  /// finReal − finEstimado, en minutos CALENDARIO (signo: + = tarde).
  errorMin       Int?
  /// Idem en minutos LABORALES del calendario de la última estación.
  errorLaboralMin Int?

  @@index([tenantId, congeladaEl])
  @@index([tenantId, itemId])
}
```

### 4.2 Foto diaria por estación — `EtaSnapshotEstacion`

```prisma
model EtaSnapshotEstacion {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @db.Uuid
  /// Fecha local del taller (DATE).
  fecha           DateTime @db.Date
  /// Id real, o SIN_ESTACION_KEY / PROVEEDOR_KEY (buckets sintéticos).
  estacionKey     String
  estacionNombre  String
  /// Cola encolada al momento del snapshot (min de trabajo).
  colaMin         Int
  /// Proyección de vaciado (décimas de jornada; null = sin calendario).
  horizonteDias   Decimal? @db.Decimal(6, 1)
  /// Espera de los pasos programados hoy→+5d en esta estación.
  esperaP50Min    Int
  esperaP90Min    Int
  /// Máximo de candidatos compitiendo por un puesto en el plan.
  contencionMax   Int
  /// Min programados próximos 5 días / min de calendario × puestos.
  utilizacion5dPct Decimal @db.Decimal(5, 1)
  pasosEnPlan     Int

  @@unique([tenantId, fecha, estacionKey])
  @@index([tenantId, estacionKey, fecha])
}
```

### 4.3 Foto diaria por item — `EtaSnapshotItem`

```prisma
model EtaSnapshotItem {
  id           String    @id @default(uuid()) @db.Uuid
  tenantId     String    @db.Uuid
  itemId       String    @db.Uuid
  fecha        DateTime  @db.Date
  finEstimado  DateTime?
  sinEstimar   Boolean
  parcial      Boolean
  /// finEstimado − fechaEntrega (min; + = proyecta tarde). null sin entrega.
  margenMin    Int?

  @@unique([tenantId, fecha, itemId])
  @@index([tenantId, itemId, fecha])
}
```

Drift = serie de `finEstimado` por item ordenada por fecha; no necesita
campos propios.

### 4.4 Cierre del item — campos en `OrdenTrabajoItem`

Al pasar la orden/item a estado final se calculan una vez, de los pasos
reales (`iniciadoEl`/`completadoEl`/`tiempoRealMin`) más la última espera
conocida:

```prisma
/// ── Descomposición del ciclo al cierre (null hasta finalizar) ──
cicloTotalMin      Int?
trabajoRealMin     Int?
esperaMin          Int?
trasladoMin        Int?
proveedorMin       Int?
/// trabajoRealMin / cicloTotalMin (0–100).
flowEfficiencyPct  Decimal? @db.Decimal(5, 1)
```

## 5. Captura

1. **Hito emisión** (`ordenes-trabajo.service` al emitir): corre
   `simularFlujo` (versión API) con el estado actual del taller INCLUYENDO
   la orden nueva y persiste una `EtaPromesa('emision')` por item. Fallo del
   motor ⇒ fila con `sinEstimar` (la emisión nunca se bloquea por esto).
2. **Cron diario** (`EtaSnapshotScheduler`, 03:00, guard `corriendo` como
   acreditaciones): por tenant, corre el motor una vez y escribe los
   snapshots 4.2 y 4.3 con upsert por clave única (idempotente: re-corridas
   del mismo día pisan, no duplican).
3. **Cierre** (transición a finalizada, donde hoy nace la deuda comercial):
   completa `finReal`/`errorMin` de las promesas abiertas del item y los
   campos 4.4. Si faltan timestamps de pasos (OT vieja), quedan null.
4. **Fase 3 — cotizador**: `estimarDemoraNuevos` persiste
   `EtaPromesa('cotizacion')` al aceptar la propuesta, cerrando el loop
   "lo que prometió la ficha vs lo que pasó".

## 6. Métricas derivadas y reportes

| Reporte | Fuente | Contenido |
|---|---|---|
| **Precisión de promesas** | 4.1 | MAE/mediana/p90 de `errorMin`, % dentro de ±4 h / ±1 día; series mensuales; corte por familia/estación/tamaño |
| **Sesgo del modelo** | 4.1 + pasos | error promedio con signo por familia y estación → candidatos a corregir duración |
| **Alerta temprana** | 4.3 + real | matriz predicho-tarde × real-tarde; lead time de la alerta (primer día con `margenMin > 0` vs fin real) |
| **Drift de promesas** | 4.3 | № de corrimientos > umbral por item; "nerviosismo" del plan por semana |
| **Colas por estación** | 4.2 | series de `colaMin`, `horizonteDias`, `esperaP90`, `utilizacion5d`; ranking de cuello de botella por mes |
| **Flow efficiency** | 4.4 | trabajo/ciclo por familia y su evolución; lead time típico (mediana de ciclo) por familia |
| **Salud del ETA** | 4.1/4.3 flags | cobertura (% sin estimar, % parcial) por mes |

Todos son consultas directas sobre las tablas nuevas: sin agregaciones al
vuelo sobre datos vivos ni reconstrucciones.

## 7. Fases

- **F1 — Promesa + cierre** (sin cron, sin porteo… con recorte): congelar en
  la emisión requiere el motor en el API ⇒ el porteo (D1) entra acá sí o sí.
  Entrega: tabla 4.1, campos 4.4, captura en emisión y cierre, y el reporte
  de precisión básico. Es lo urgente: cada OT emitida sin esto es historia
  perdida.
- **F2 — Cron + fotos diarias**: scheduler, tablas 4.2/4.3, series de colas
  y drift.
- **F3 — Cotizador + panel "Salud del ETA"**: promesa en cotización,
  cobertura, sesgos por familia con sugeridor de correcciones de duración.

## 8. Casos borde

- **Item sin ETA al emitir** (paso sin duración ni mediana): fila con
  `sinEstimar = true`; el reporte de cobertura la cuenta, el de precisión la
  excluye.
- **OT anulada**: promesas quedan sin `finReal`; se excluyen de precisión
  (filtro `finReal != null`), no se borran.
- **Item ya tarde al emitir** (ETA > entrega desde el día cero): es señal
  comercial, no error del modelo; el reporte de alerta temprana lo marca
  como "tarde desde emisión".
- **Cambios de calendario/feriados post-promesa**: el error se mide igual;
  el sesgo por estación lo absorbe. No se "corrige" la promesa histórica.
- **Multi-tenant**: el cron itera tenants con calendario/estaciones activas;
  tenant sin estaciones no escribe snapshot (no filas basura).
- **Re-corrida del cron el mismo día**: upsert por única ⇒ idempotente.

## 9. Qué NO hacemos ahora

- Persistir la traza completa del scheduler (D5) — se reevalúa si algún
  reporte la pide de verdad.
- Snapshot intradiario o por evento de tablero — ruido sin pregunta que lo
  justifique.
- Predicción probabilística (intervalos de confianza del ETA) — primero un
  año de errores medidos; después se ve si hace falta.
- Corrección automática de duraciones por sesgo — F3 sólo SUGIERE; aplicar
  sigue siendo decisión humana.
