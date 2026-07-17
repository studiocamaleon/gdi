# Tablero de producción — conexión con órdenes reales

> Análisis 2026-07-16 (rama `feat/tablero-ordenes-reales`). Vistas:
> `src/components/produccion/tablero-produccion.tsx` (mock en
> `src/lib/tablero-produccion-mock.ts`). Datos reales: módulo
> `apps/api/src/ordenes-trabajo/` + snapshot del cotizador
> (`CotizacionItem.trazabilidadJson`, forma `PasoEjecutado` del motor).

## 1. Estado actual

### Lo que muestra el Tablero (100% mock)

Tres vistas sobre `PROD_ITEMS` (items ficticios con ruta de pasos):

| Vista | Qué muestra |
| --- | --- |
| **Por items** | Fila por item: código, OT, cliente, producto, spec, ruta de pasos con estado (`done/current/pending/blocked`), prioridad, entrega, operario, máquina, línea de estado |
| **Por estación** | 13 estaciones hardcodeadas (`STATIONS` + `STEP_TO_STATION`), carga por estación, detalle con "Mi mesa / Pendientes compartidas" |
| **Kanban** | Buckets derivados: No iniciados / Vencen hoy / Con retraso / En curso |
| **Sheet detalle** | Tabs: Ruta / Materiales (mock inline) / Actividad (mock) / Archivos (mock) + acciones "Pausar", "Marcar paso completado" |

Además hay una `TimelineView` **definida pero nunca renderizada** (código
muerto de una iteración anterior; los modos son items/estación/kanban).

### Lo que existe de verdad

- `OrdenTrabajo` (estado `borrador→pendiente→produccion→finalizada→entregada`,
  `fechaEntrega`, `progresoPct` informable, cliente, vendedor, eventos).
- `OrdenTrabajoItem` → FK `cotizacionItemId` al snapshot inmutable del
  cotizador. `trazabilidadJson.pasos: PasoEjecutado[]` trae por paso:
  `rutaPasoOrden`, `familiaCodigo`, `nombreVisible`, `activado`,
  `tiempo.{setupMin,runMin,cleanupMin,totalMin,centroCostoId,centroCostoNombre}`,
  `materiales[]`, `costoTotal`.
- `Estacion`: entidad mínima (nombre, descripción, activo) **sin vínculo** con
  pasos, centros de costo ni máquinas. Hoy no la usa nadie operativamente.
- DB dev al 2026-07-16: 6 OTs (todas `pendiente`), 9 items, todos con
  trazabilidad. Familias reales presentes: `pre_prensa`, `diseno_grafico`,
  `impresion_por_hoja`, `impresion_por_area`, `aplicacion_transfer`,
  `laminado`, `corte_guillotina`, `trabajo_manual`.

## 2. Mapeo campo a campo (mock → real)

| Campo mock (`TableroItem`) | Fuente real | Veredicto |
| --- | --- | --- |
| `code` "ITEM-2487-A" | No existe → derivar `numero` + letra por `ordenIndice` ("OT-0184 · A") | Derivable |
| `otCode` | `OrdenTrabajo.numero` | Directo |
| `customer` / `vendedor` | `cliente.nombre` / `vendedor.nombreCompleto` | Directo |
| `product` / `spec` | `item.nombre` / `item.specsJson` (etiqueta: valor) | Directo |
| `qty` | `cantidad` + `cantidadUnidad` (¡no siempre "u": hay m²!) | Directo |
| `priority` (urgent/high/normal) | **No existe.** Derivar del vencimiento (vencida u hoy → urgente; ≤48 h → alta) | Derivada · campo real = fase futura |
| `dueDate` / `dueIn` | `fechaEntrega` (date-only, a nivel orden) | Derivable |
| `onTrack` | Derivar: hay pasos sin terminar y la entrega está vencida/hoy | Derivada |
| `progressPct` | Pasos hechos / pasos totales | Derivada |
| `statusLine` | Nombre + estado del paso actual | Derivada |
| `blocked` / `blockedReason` | **No existe** → nace con el estado del paso | **Persistir** |
| `steps[].status/end/progress` | **No existe** → materializar pasos de producción | **Persistir** |
| `steps[].dur` | `tiempo.totalMin` de la trazabilidad | Snapshot al materializar |
| `operator` | **No existe** (asignación de operario a item/paso) | Fase futura · UI degrada a "—" |
| `machine` | Proxy: `centroCostoNombre` del paso actual | Proxy |
| `PROD_ACTIVITY` | `OrdenTrabajoEvento` (nivel orden, no item) | Real nivel orden |
| Materiales (sheet) | `trazabilidad.pasos[].materiales` | Proyección real |
| Archivos (sheet) | **No existe** (persistir PDFs = fase 2 de medidas-PDF) | Ocultar |
| `STATIONS` + `STEP_TO_STATION` | **No existe vínculo.** Proxy real: centro de costo del paso; categorías = `CategoriaFamiliaCodigo` de la familia del paso | Proxy fase 1 |
| KPI "↑2 vs ayer" / pill "En vivo" | Sin fuente | Quitar |

## 3. Decisiones

- **D1 — Materializar pasos.** Nueva entidad `OrdenTrabajoItemPaso`, creada al
  **emitir** la OT (crear con estado `pendiente` o salir de `borrador`) desde
  `trazabilidad.pasos` filtrando `activado`. Snapshot por paso: índice, nombre
  visible, `familiaCodigo`, centro de costo (id+nombre), duración estimada
  (min). El snapshot del cotizador sigue inmutable; la ejecución vive acá.
- **D2 — Estados del paso.** `pendiente | en_curso | hecho | bloqueado`
  (+`motivoBloqueo`, `iniciadoEl`, `completadoEl`). Acciones: iniciar,
  completar, bloquear, desbloquear, reabrir. Iniciar el primer paso de una
  orden `pendiente` la **auto-promueve a `produccion`** (evento de sistema).
  Completar todos los pasos NO auto-finaliza la orden (la finalización/entrega
  sigue siendo decisión humana en Órdenes).
- **D3 — Progreso.** `progresoPct` del item = hechos/total (por cantidad de
  pasos, fase 1). El de la orden = sobre el total de pasos de todos sus items;
  se persiste en `OrdenTrabajo.progresoPct` en cada acción (así el listado de
  Órdenes ya muestra avance real sin tocarse).
- **D4 — Estación (fase 1) = centro de costo.** ~~La vista "Por estación"
  agrupa pasos activos por `centroCostoNombre`.~~ **Superada 2026-07-17 por
  las estaciones reales** (docs/estaciones-diseno.md): el paso llega a su
  estación por la FAMILIA (`mapaFamiliaEstacion`); familias sin estación →
  bucket "Sin estación". El centro de costo quedó como dato informativo del
  paso.
- **D5 — Qué órdenes entran al tablero.** `pendiente` + `produccion`.
  Borradores no se emitieron; finalizadas/entregadas ya no son trabajo vivo.
- **D6 — Items editables en `pendiente`.** Agregar/editar/quitar item
  re-materializa sus pasos (no puede haber ejecución previa: ejecutar promueve
  a `produccion`, que congela items).
- **D7 — Backfill perezoso.** OTs emitidas antes de este cambio no tienen
  pasos: el GET del tablero materializa on-demand (idempotente) los items con
  trazabilidad y sin pasos de órdenes activas.
- **D8 — Items sin snapshot** (manuales/históricos): quedan sin pasos; el
  tablero los muestra con chip "Sin ruta de producción" y sin acciones de paso.
- **D9 — La ruta es una SECUENCIA (pasos activos).** Siempre hay un paso
  activo: el que está listo para hacerse porque es el primero o el anterior ya
  se completó. La vista **Por estación** muestra únicamente pasos activos (los
  futuros todavía no son trabajo de nadie y no engordan la cola). El backend
  valida lo mismo: iniciar/completar/bloquear sólo sobre el paso activo
  (`pasoEjecutable`), y reabrir sólo el último hecho sin nada posterior
  arrancado (`pasoReabrible`).
- **D10 — UI degrada lo que no existe.** Operario → se omite; Archivos →
  oculto; "En vivo" y "vs ayer" → fuera; `TimelineView` muerta → fuera;
  "Pausar item" → reemplazado por bloquear/desbloquear paso.

## 4. Contrato (implementado)

`GET /ordenes-trabajo/tablero` → `{ items: TableroItemData[] }`, tenant-scoped,
órdenes activas. Es el dataset COMPLETO (sin paginar): los KPIs/contadores los
deriva el front sin mentir. Contrato en `src/lib/tablero-produccion.ts`
(reemplaza al mock como fuente de tipos):

```ts
type TableroPasoEstado = "pendiente" | "en_curso" | "hecho" | "bloqueado";
type TableroPasoData = {
  id: string; indice: number; nombre: string;
  familiaCodigo: string; categoriaFamilia: string;
  centroCostoId: string | null; centroCostoNombre: string | null;
  duracionEstimadaMin: number | null;
  estado: TableroPasoEstado; motivoBloqueo: string | null;
  iniciadoEl: string | null; completadoEl: string | null;
};
type TableroItemData = {
  id: string; ordenId: string; ordenNumero: string; ordenEstado: string;
  itemIndice: number; codigo: string; nombre: string;
  clienteNombre: string; vendedorNombre: string;
  cantidad: number; cantidadUnidad: string;
  specs: Array<{ etiqueta: string; valor: string }>;
  fechaEntrega: string | null;
  sinRuta: boolean; pasos: TableroPasoData[];
};
```

Materiales y actividad NO viajan en el payload del tablero (la trazabilidad
pesa): el sheet de detalle los trae con `GET /ordenes-trabajo/:id` al abrirse
(materiales = proyección de `snapshot.trazabilidad.pasos[].materiales`;
actividad = eventos de la orden).

`PATCH /ordenes-trabajo/:ordenId/items/:itemId/pasos/:pasoId`
`{ accion: 'iniciar'|'completar'|'bloquear'|'desbloquear'|'reabrir', motivo? }`
→ valida transición + orden activa, recalcula `progresoPct`, registra evento
(`tipo: 'paso'`), auto-promueve `pendiente→produccion` al primer
iniciar/completar (evento `estado` de sistema). Devuelve el item re-proyectado;
el front refresca el dataset completo porque la promoción afecta a los items
hermanos de la orden.

## 5. Fases

- **Fase A (esta rama, HECHA 2026-07-16):** migración `OrdenTrabajoItemPaso`
  (`20260717022648`) + materialización (emisión, edición de items, backfill
  perezoso) + endpoint tablero + acciones de paso + las tres vistas del tablero
  leyendo datos reales + sheet con Ruta/Materiales/Actividad reales. Tests API
  del mapeo y las transiciones. Verificado E2E con las 6 OTs reales de dev:
  iniciar/completar/bloquear/desbloquear desde el sheet, auto-promoción
  `pendiente→produccion`, progreso reflejado en el listado de Órdenes.
- **Estaciones reales (HECHA 2026-07-17):** ver docs/estaciones-diseno.md —
  familias por estación (únicas), máquinas, empleados, capacidad; el tablero
  agrupa por estación real con carga sobre capacidad.
- **Fase B (futuras):** asignación de operarios y "mi mesa" persistente,
  prioridad manual a nivel orden/item, sub-progreso dentro del paso (pliegos),
  archivos del item, actividad por item (hoy es por orden), timeline.
