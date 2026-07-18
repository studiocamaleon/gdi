# Registro de tiempos de producción — diseño

Fecha: 2026-07-18. Estado: TODAS las etapas (A esquema+backend, B tablero+
detalle, C widget+inactividad, D simuladores, E config) IMPLEMENTADAS en
`feat/registro-tiempos-produccion` y verificadas E2E.
Ajuste sobre D11 hecho en la etapa D: el campo de tanda NO se prellena con
el estimado (queda como placeholder) — un valor precargado que el operario
confirma sin mirar fabricaría "mediciones" `medido_lote` que nadie midió y
contaminaría las fuentes que la mediana D14 considera confiables.
La métrica "% pasos sin tiempo" (E) queda para el módulo de reportes (§9).
Ajustes sobre el diseño hechos en B: la atribución NO se muestra en el
tracking público (contradecía el principio "sin fuga de datos internos" de
ese módulo; queda en tablero y detalle interno), y la proyección expone
`motivoPausa` + `tramoAbierto` desde el último tramo del paso.

Objetivo: unificar el avance de pasos de producción en un flujo consistente que capture
tiempos reales confiables y atribución de operador, sin generar fricción que lleve a
datos falsificados (probado en MVP real: si se fuerza el ritual, el operario "inicia y
completa en 1 seg").

Principio rector: **no forzar el registro perfecto; capturar lo que haya y marcar su
calidad**. Un dato aproximado y honesto vale más que un dato "perfecto" inventado.

## 1. Estado actual (relevado)

- Paso materializado: `OrdenTrabajoItemPaso` (`apps/api/prisma/schema.prisma:2112`).
  Campos: `estado` string (`pendiente | en_curso | hecho | bloqueado`), `iniciadoEl`,
  `completadoEl`, `duracionEstimadaMin` (del motor vía snapshot `trazabilidadJson`),
  `motivoBloqueo`, `mesaUsuarioId` (claim de mesa), `indice` (secuencia).
- **No persiste quién inició ni quién completó**: la atribución vive solo en
  `OrdenTrabajoEvento` (`tipo:'paso'`, `usuarioId`). El claim de mesa es reserva de
  visibilidad, no ejecución.
- Acciones: `accionPaso()` (`ordenes-trabajo.service.ts:1454`) con
  `iniciar | completar | bloquear | desbloquear | reabrir`. No existe `pausar`.
- Completar-directo existe: si no hubo `iniciar`, backfillea `iniciadoEl = completadoEl`
  → duración medida 0. La mediana histórica (`produccion.service.ts:findDuracionesFamilias`,
  `:393`) exige `completadoEl > iniciadoEl`, así que hoy los descarta (no contamina,
  pero tampoco aporta).
- Regla de secuencia: `pasoEjecutable()` — solo el paso de la frontera (todos los
  anteriores `hecho`) admite iniciar/completar/bloquear. `reabrir` exige posteriores
  `pendiente`.
- Lote: `POST /ordenes-trabajo/tablero/pasos/completar-lote` reusa `accionPaso` en
  secuencia; lo usan los simuladores gran formato y láser.
- Familias: catálogo cerrado hardcodeado en TS
  (`apps/api/src/productos-servicios/pasos/familias.ts`), con `categoria`
  (`CategoriaFamiliaCodigo`, `pasos/types.ts:73`). No hay tabla de familias.
- Jornada/feriados: `Estacion.calendarioJson` (por estación), `DiaNoLaborable` (tenant),
  `ConfiguracionProduccion` (tenant, hoy solo `margenEtaDias`).
- **No hay scheduler en el backend** (sin `@nestjs/schedule`, sin crons): todo se
  calcula on-demand. Precedente de reconciliación perezosa: `backfillPasosTablero`
  (`ordenes-trabajo.service.ts:1329`).
- Costeo: la MO se cobra solo en setup/cleanup; el runtime es de la máquina
  (memoria `project_mano_obra_setup_cleanup`). El tiempo estimado del paso es
  `totalMin = ceil(setup + run + cleanup + fijo)` (`motor.service.ts:2417`).

## 2. Concepto

Dos problemas reales del flujo Iniciar→Completar (validados en MVP):

1. **Olvido de finalizar** (fin de turno, fin de semana) → tiempos inflados.
2. **Inicio-y-completo en 1 seg** para destrabar la secuencia → tiempos falsos.

Y un tercero que invalida el cronómetro por trabajo en pasos de máquina: el impresor
UV corre 14 trabajos de distintos clientes consolidados en tandas; el tiempo
transcurrido por trabajo individual mide cola y solapamiento, no producción.

Respuesta de diseño, en cuatro piezas:

- **Modos de registro por paso**: `cronometro` (pasos donde domina la mano de obra) y
  `solo_completar` (pasos donde domina el runtime de máquina). El modo sigue la misma
  línea divisoria que el costeo de MO.
- **Tramos de trabajo** (tabla nueva): el tiempo medido es la suma de sesiones
  usuario+inicio+fin+motivo de cierre, no un único par de timestamps. Habilita pausas
  con motivo, multi-operario, y cierre automático por jornada.
- **Tiempo con fuente**: el paso persiste `tiempoRealMin` + `tiempoFuente`
  (`medido | medido_lote | declarado | estimado | invalido`). Los reportes operativos
  usan el número siempre; los de calibración filtran por fuente. Nunca se disfraza un
  estimado de medido (evita el loop cerrado que "confirma" estimaciones erróneas).
- **Atribución directa**: quién inició y quién completó quedan en el paso, siempre,
  en ambos modos.

## 3. Decisiones

- **D1 — Modo de registro por familia, snapshot en el paso.** `DefinicionFamilia`
  (catálogo TS) gana `modoRegistro: 'cronometro' | 'solo_completar'`. Default por
  categoría: `produccion_impresion` → `solo_completar`; el resto → `cronometro`
  (ajustable familia por familia en el catálogo). Al materializar, el modo se copia a
  la columna `OrdenTrabajoItemPaso.modoRegistro` (comportamiento estable aunque el
  catálogo cambie). Override por tenant/centro de costo: fuera de alcance (§13).
- **D2 — Tramos como fuente de verdad del tiempo medido.** Tabla
  `OrdenTrabajoPasoTramo`. Máximo un tramo abierto por paso. `iniciar`/`continuar`
  abren tramo; `pausar`/`completar`/`bloquear` y los cierres automáticos lo cierran
  con `motivoFin`.
- **D3 — Tiempo con fuente en el paso.** `tiempoRealMin Decimal?` +
  `tiempoFuente String?`. Valores: `medido` (suma de tramos válida), `medido_lote`
  (prorrateo de tanda, D11), `declarado` (micro-prompt, D8), `estimado`
  (modo solo_completar, D10), `invalido` (instantáneo sin declarar). Se calcula al
  completar; `null` mientras no está `hecho`.
- **D4 — Estado nuevo `pausado`.** Distinto de `bloqueado`: pausado = "en progreso
  pero nadie lo está trabajando" (no frena nada, decisión del operario o del sistema);
  bloqueado = impedimento externo que requiere resolución (mantiene su semántica y
  su `motivoBloqueo`).
- **D5 — Atribución directa en el paso.** `iniciadoPorId/iniciadoPorNombre` (primer
  tramo) y `completadoPorId/completadoPorNombre` (quien ejecuta `completar`), en ambos
  modos. `OrdenTrabajoEvento` sigue registrando todo como hasta ahora (log fino).
- **D6 — Iniciar auto-reclama la mesa.** `iniciar`/`continuar` setean
  `mesaUsuarioId = actor` (pisa un claim ajeno; el evento deja rastro). "En curso"
  siempre tiene dueño visible.
- **D7 — Pausa con motivo de catálogo.** `pausar` requiere `motivo` de
  `MOTIVOS_PAUSA` (constantes TS): `falta_material`, `falta_informacion`,
  `cambio_prioridad`, `mantenimiento_maquina`, `fin_turno`, `otro` (+ texto libre en
  `motivoDetalle`, máx 300). Motivos de sistema (no elegibles): `fin_jornada`,
  `auto_pausa`, `bloqueo`, `migracion`.
- **D8 — Anti "1 seg": marcar y ofrecer declarar, no bloquear.** Si al completar en
  modo cronómetro la suma de tramos < max(1 min, 10% de `duracionEstimadaMin`), se
  asienta `tiempoFuente: 'invalido'` y la UI ofrece un micro-prompt opcional de un
  toque: "¿Cuánto te llevó aprox?" con chips (estimado, mitad, doble, otro). Si
  responde → `tiempoRealMin = declarado`, fuente `declarado`. Si no, queda inválido y
  "pasos sin tiempo" se vuelve métrica visible (presión social > candado técnico).
- **D9 — Auto-cierre por jornada, perezoso (sin cron).** El backend no tiene
  scheduler; en lugar de agregarlo, la reconciliación corre al leer
  (tablero/mesa/mis-tramos) y antes de cualquier acción sobre un paso: todo tramo
  abierto cuya jornada ya venció se cierra retroactivamente en la **hora de corte de
  ese día** (no la hora de la reconciliación — el resultado es determinístico), con
  `motivoFin: 'fin_jornada'`, y el paso pasa a `pausado`. Hora de corte:
  `ConfiguracionProduccion.corteJornada` (string "HH:mm", default `"20:00"`).
  Refinamiento por calendario de estación: fuera de alcance (§13). Un cron real puede
  sumarse después sin cambiar la semántica.
- **D10 — Modo solo_completar.** Sin Iniciar/Pausar en la UI. `completar` asienta
  `iniciadoEl = completadoEl = ahora`, `tiempoRealMin = duracionEstimadaMin`,
  `tiempoFuente: 'estimado'`, y la atribución de quien completa. No crea tramos.
  Si `duracionEstimadaMin` es null → `tiempoRealMin = null`, fuente `invalido`.
- **D11 — Medición por tanda en los simuladores.** `completar-lote` acepta
  `duracionTandaMin?` opcional. La UI del simulador (gran formato y láser) muestra un
  único campo: "¿Cuánto duró la tanda? (estimado: X min)". Si se carga, se prorratea
  entre los pasos del lote por peso de `duracionEstimadaMin` (los sin estimado
  reparten el remanente en partes iguales), fuente `medido_lote`. Si no, cada paso
  sigue D10. Un número por tanda calibra las velocidades de máquina sin fricción por
  trabajo.
- **D12 — Reabrir conserva historia.** `reabrir` → `pendiente`, `completadoEl = null`,
  `tiempoRealMin/tiempoFuente = null`, atribución de completado en null, pero los
  tramos históricos **se conservan**. Al re-completar, el tiempo se recalcula sobre
  todos los tramos (viejos + nuevos). `iniciadoEl` conserva la primera marca real.
- **D13 — Prompt de inactividad ("¿seguís con esto?").** Capa complementaria (el
  robusto es D9): si un tramo abierto supera `3 × duracionEstimadaMin` (mínimo
  30 min; sin estimado → 60 min), el widget (§7) pregunta. Sin respuesta en 5 min →
  cierra el tramo con `auto_pausa` y el paso queda `pausado`. Umbral fijo en esta
  fase; configurable después si hace falta.
- **D14 — La mediana histórica lee solo tiempo medido.** `findDuracionesFamilias`
  migra a `tiempoRealMin` con `tiempoFuente IN ('medido','medido_lote')`. Excluye
  `estimado` (evita el círculo estimado→"real"→estimado) y `declarado` (mantiene la
  mediana limpia de percepciones).

## 4. Modelo (migración)

```prisma
model OrdenTrabajoPasoTramo {
  id            String    @id @default(uuid())
  tenantId      String
  tenant        Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  pasoId        String
  paso          OrdenTrabajoItemPaso @relation(fields: [pasoId], references: [id], onDelete: Cascade)
  usuarioId     String?
  usuario       User?     @relation("TramosPaso", fields: [usuarioId], references: [id], onDelete: SetNull)
  usuarioNombre String                     // snapshot del actor
  inicioEl      DateTime
  finEl         DateTime?                  // null = tramo abierto
  // 'completado' | 'pausa:<motivo D7>' | 'fin_jornada' | 'auto_pausa' | 'bloqueo' | 'migracion'
  motivoFin     String?
  motivoDetalle String?   @db.VarChar(300) // texto libre cuando motivo = 'pausa:otro'
  origen        String    @default("usuario") // 'usuario' | 'sistema'
  createdAt     DateTime  @default(now())

  @@index([tenantId, pasoId])
  @@index([tenantId, finEl])               // localizar tramos abiertos (reconciliación D9)
}
```

`OrdenTrabajoItemPaso` suma (estado admite además `'pausado'`):

```prisma
  modoRegistro       String   @default("cronometro") // 'cronometro' | 'solo_completar' (D1)
  tiempoRealMin      Decimal? @db.Decimal(10, 2)     // D3, se asienta al completar
  tiempoFuente       String?  // 'medido' | 'medido_lote' | 'declarado' | 'estimado' | 'invalido'
  iniciadoPorId      String?  // D5 (FK User, SetNull) — primer tramo / primer avance
  iniciadoPorNombre  String?
  completadoPorId    String?  // D5 (FK User, SetNull)
  completadoPorNombre String?
```

`ConfiguracionProduccion` suma: `corteJornada String @default("20:00")` (D9).

Backfill (mismo script de migración o seed dedicado):

- Pasos existentes → `modoRegistro` según catálogo por `familiaCodigo`.
- Pasos `hecho` con `completadoEl > iniciadoEl` → un tramo sintético
  (`origen:'sistema'`, `motivoFin:'migracion'`, usuario del último evento `paso` si
  se puede resolver, si no "Sistema") + `tiempoRealMin = diff`, fuente `medido`.
- Pasos `hecho` con duración 0 → sin tramo, `tiempoFuente:'invalido'`
  (o `'estimado'` con `tiempoRealMin = duracionEstimadaMin` si su modo quedó
  `solo_completar`).

## 5. Máquina de estados y acciones

```
pendiente ──iniciar──▶ en_curso ◀──continuar── pausado
                          │  └──pausar(motivo)──▶ pausado
pendiente | en_curso | pausado ──completar──▶ hecho ──reabrir──▶ pendiente
pendiente | en_curso | pausado ──bloquear(motivo)──▶ bloqueado
bloqueado ──desbloquear──▶ pausado (si tuvo tramos) | pendiente (si no)
```

- `TRANSICIONES_PASO` gana `pausar: desde ['en_curso']` y
  `continuar: desde ['pausado']`; `completar` y `bloquear` suman `'pausado'` a sus
  orígenes. La regla de secuencia (`pasoEjecutable`) aplica igual a las acciones
  nuevas.
- Efecto sobre tramos: `iniciar`/`continuar` abren; `pausar` cierra con
  `pausa:<motivo>`; `completar` cierra con `completado`; `bloquear` cierra con
  `bloqueo`. En modo `solo_completar` las acciones `iniciar/pausar/continuar`
  devuelven 400 (la UI no las ofrece; la API las rechaza).
- `completar` calcula y asienta `tiempoRealMin`/`tiempoFuente` según modo
  (D3/D8/D10) y la atribución (D5). Acepta `tiempoDeclaradoMin?` en el body (D8).
- Los efectos colaterales existentes no cambian: progreso, auto-promoción
  `pendiente→produccion`, auto-finalización, eventos. `pausar`/`continuar` generan
  evento `tipo:'paso'` como el resto. Un paso `pausado` cuenta como "iniciado" para
  la promoción de la OT y **no** frena la auto-finalización de otros (sigue siendo
  parte de la frontera).

Contrato (cambios):

- `PATCH .../pasos/:pasoId` — `accion` suma `'pausar' | 'continuar'`; body suma
  `motivoDetalle?` y `tiempoDeclaradoMin?`.
- `POST /ordenes-trabajo/tablero/pasos/completar-lote` — body suma
  `duracionTandaMin?` (D11).
- `GET /ordenes-trabajo/tablero/mis-tramos` (nuevo) — tramos abiertos del usuario
  con paso/orden/cliente/estimado; alimenta el widget (§7). Ejecuta la
  reconciliación D9 antes de responder. (Vive en el módulo ordenes-trabajo, no en
  produccion: los tramos son dominio del tablero.)
- Las lecturas de tablero/pasos exponen los campos nuevos + `tramoAbierto`
  (usuario, inicioEl) cuando exista.

## 6. UI — tablero y acciones

- `tablero-produccion.tsx`: los botones dependen de `modoRegistro`.
  - `cronometro`: Iniciar / Pausar (popover con motivos D7) / Continuar / Completar /
    Bloquear. Card en `pausado` muestra el motivo y tiempo acumulado.
  - `solo_completar`: Completar / Bloquear (como hoy). Sin cronómetro visible.
- Micro-prompt de tiempo declarado (D8): popover/sheet del design system al detectar
  completar instantáneo — nunca diálogos nativos del navegador.
- Detalle de OT (`produccion-orden-tab.tsx`) y tracking público: mostrar
  `completadoPorNombre` (y `iniciadoPorNombre` si difiere) por paso.

## 7. UI — widget flotante "En curso"

- Montado en el layout `(dashboard)` replicando el patrón de
  `NavigationFeedbackProvider` (`src/components/navigation/navigation-feedback.tsx`:
  fixed + z-index alto): visible en toda la zona autenticada, no solo en el tablero.
- Polling a `/produccion/mis-tramos-abiertos` (~30 s, mismo enfoque que la mesa).
  Sin tramos abiertos → no se renderiza nada.
- Colapsado: pastilla con contador y cronómetro del más antiguo. Expandido: lista de
  pasos en curso del usuario con cronómetro vivo (client-side desde `inicioEl`),
  botones Pausar (motivos) / Completar / ir al paso en el tablero.
- Sin límite de pasos simultáneos (en gráfica es normal largar una máquina y seguir
  con otra cosa); el contador visible autorregula.
- El prompt de inactividad (D13) vive acá: banner en el widget + countdown; sin
  respuesta → auto-pausa y toast informativo.
- Nota conceptual: el cronómetro mide **tiempo de paso** (transcurrido), no mano de
  obra — consistente con MO solo en setup/cleanup.

## 8. Simuladores (gran formato y láser)

- Sin cambios de flujo: selección y completar en lote como hoy.
- Se agrega el campo opcional "¿Cuánto duró la tanda?" prellenado con la suma de
  estimados del lote (D11). Backend prorratea y asienta fuente `medido_lote`.
- Los pasos de estas familias serán `solo_completar`, así que el lote nunca choca
  con tramos abiertos de cronómetro.

## 9. Reportes habilitados (consumo futuro)

Este diseño deja los datos listos para (no se implementan acá):

- Real vs estimado por familia / centro de costo / producto (solo fuentes medidas) →
  recalibrar velocidades y factor PPM.
- Pareto de motivos de pausa (D7) → cuellos reales del taller.
- % de pasos con tiempo válido por operario/estación → KPI de adopción (D8).
- Tiempos por operador (tramos) → productividad, con la salvedad §7 (tiempo de paso,
  no MO pura).
- `ConfiguracionInsights.razonTiemposPctMax` ya existe como umbral de alerta: pasa a
  tener materia prima confiable.

## 10. Casos borde

1. **Completar directo en modo cronómetro sin haber iniciado**: permitido (frontera
   habilitada). Suma de tramos = 0 → D8 (invalido + oferta de declarar). No se
   fabrican tramos.
2. **Segundo usuario inicia/continúa un paso pausado por otro**: permitido; el tramo
   nuevo es suyo, la mesa pasa a él (D6), el evento deja rastro. El tiempo del paso
   suma tramos de ambos.
3. **Intentar iniciar un paso que ya tiene tramo abierto** (otro navegador/usuario):
   400 con mensaje; la UI refresca. Un solo tramo abierto por paso (D2).
4. **Bloquear con tramo abierto**: cierra el tramo (`motivoFin:'bloqueo'`) — el
   tiempo bloqueado no cuenta como trabajo. `desbloquear` NO reabre cronómetro:
   deja `pausado` (el operario decide continuar).
5. **Reconciliación D9 con tramo abierto de hace varios días**: se cierra en el
   corte de jornada del día de `inicioEl` (los días intermedios no suman). Si
   `inicioEl` es posterior al corte de ese día (turno nocturno), se cierra al corte
   del día siguiente.
6. **Tramo que cruza el corte pero el operario sigue trabajando de verdad**: al
   volver a tocar el paso lo encuentra pausado por `fin_jornada`; un toque en
   Continuar abre tramo nuevo. Costo aceptado: se pierde el intervalo entre corte y
   continuar. Alternativa fina por estación: fuera de alcance.
7. **Feriado / fin de semana**: irrelevante para D9 — el corte es del día en que se
   abrió el tramo; nunca queda un tramo abierto cruzando un día no laborable.
8. **`duracionEstimadaMin` null** (paso viejo o familia sin tiempo): D8 usa solo el
   piso de 1 min; D13 usa 60 min; D10 asienta fuente `invalido`; D11 lo prorratea
   por partes iguales del remanente.
9. **Lote con `duracionTandaMin` menor que la suma de estimados**: se prorratea
   igual (la tanda real puede ser más rápida); si es ≤ 0 se ignora y aplica D10.
10. **Reabrir y re-completar** (D12): tiempo recalculado sobre todos los tramos; si
    entre medio cambió el modo en el catálogo, el paso conserva su `modoRegistro`
    snapshot.
11. **Usuario eliminado**: FKs `SetNull` + snapshots de nombre (mismo patrón que
    `OrdenTrabajoEvento.usuarioNombre`).
12. **Simuladores/lote sobre pasos `pausado`**: `completar` acepta origen `pausado`,
    así que el lote los completa igual (cierra tramo si lo hubiera).

## 11. Journey (verificación E2E)

1. Configurar corte de jornada del tenant (default 20:00). Verificar catálogo:
   familia de impresión → `solo_completar`; acabado manual → `cronometro`.
2. OT con item cuya ruta tenga: impresión gran formato → corte manual → armado.
3. **Máquina**: en el simulador gran formato, completar la impresión junto a otros
   trabajos cargando duración de tanda → cada paso queda `hecho`, fuente
   `medido_lote`, tiempo prorrateado, `completadoPor` = operario. Repetir sin cargar
   duración → fuente `estimado`.
4. **Cronómetro feliz**: iniciar el corte desde el tablero → mesa pasa al operario,
   aparece el widget flotante con cronómetro. Pausar con `falta_material` →
   `pausado`, tramo cerrado con motivo. Continuar y completar → `hecho`, fuente
   `medido`, tiempo = suma de tramos, atribución correcta en tablero, detalle de OT
   y tracking.
5. **Instantáneo**: completar el armado sin iniciar → micro-prompt; elegir chip
   "estimado" → fuente `declarado`. Repetir ignorando el prompt → fuente `invalido`.
6. **Olvido**: iniciar un paso, no tocarlo y consultar al día siguiente → el paso
   aparece `pausado` con tramo cerrado a las 20:00 de ayer (`fin_jornada`).
7. **Inactividad**: con estimado corto, dejar correr 3× → el widget pregunta; no
   responder 5 min → `auto_pausa`.
8. **Eventos y reportes**: cada acción visible en la actividad de la OT; la mediana
   por familia solo toma fuentes medidas; el paso reabierto conserva tramos.

## 12. Plan técnico por etapas

- **A — Esquema y motor de acciones**: migración (§4) + backfill; `modoRegistro` en
  catálogo de familias; acciones `pausar`/`continuar`; tramos en `accionPaso`;
  cálculo de `tiempoRealMin`/`tiempoFuente` (D3/D8/D10/D12); atribución (D5);
  auto-claim (D6); reconciliación perezosa (D9); `mis-tramos-abiertos`; ajuste de
  `findDuracionesFamilias` (D14). Tests API (DB aislada `gdi_saas_test`).
- **B — Tablero y detalle**: botones por modo, popover de motivos, card pausada,
  micro-prompt declarado, atribución visible en tablero/detalle/tracking.
- **C — Widget flotante**: provider en layout `(dashboard)`, polling, cronómetros,
  acciones, prompt de inactividad (D13).
- **D — Simuladores**: campo duración de tanda + prorrateo (D11) en gran formato y
  láser.
- **E — Config y pulido**: `corteJornada` editable en la config de producción;
  métrica "pasos sin tiempo" donde corresponda.

A solo ya deja datos confiables y nada visible se rompe (las acciones actuales
siguen funcionando). B–D son incrementales e independientes entre sí.

## 13. Fuera de alcance (futuro)

- Cron real para el cierre de jornada (la reconciliación perezosa es equivalente en
  resultado; un scheduler solo mejora la frescura de lecturas externas).
- Override de `modoRegistro` por tenant o por centro de costo (hoy: catálogo global).
- Corte de jornada por calendario de estación (`Estacion.calendarioJson`) en lugar
  del corte único por tenant; turnos nocturnos formales.
- Umbrales configurables de D8/D13 por tenant.
- Reportes de §9 (los implementa el módulo de reportes inteligentes).
- Costo de MO real vs cobrada a partir de tramos (hoy la MO se cobra por
  setup/cleanup del motor; comparar contra tramos reales es análisis, no costeo).
