# Tablero de producción — conexión con órdenes reales

## Actualización 2026-09-17: aviso de OT finalizada

Al completar la tarea que termina todos los pasos de una OT, el Tablero abre
**Producción finalizada** para quien hizo esa acción. El aviso muestra número,
cliente, productos con cantidades y entrega comprometida cuando está informada.
**Entendido** vuelve al tablero; **Ver OT** abre la ficha cuando el usuario tiene
permiso para consultarla. El aviso no registra una entrega.

El `PATCH` individual de ejecución conserva el item reproyectado y agrega
`avisoFinalizacion`, con valor `null` cuando esa acción no cerró la orden.
El resumen se captura dentro de la transacción y bajo el mismo bloqueo de la OT,
con productos raíz para evitar duplicar componentes y lotes. Contiene sólo datos
operativos, sin costos, precios ni contactos. La fecha de entrega es calendario
(`YYYY-MM-DD`) y no se desplaza por zona horaria.

La UI consume esa respuesta desde `useProduccionOperativa`: cierra el detalle del
trabajo antes de abrir `OrdenFinalizadaDialog`. No deduce la finalización de las
filas visibles ni de eventos de otros usuarios, polling, SSE o recargas. Reabrir
y volver a terminar una OT produce un aviso nuevo para esa nueva finalización.
El diálogo se comparte entre Lista y Kanban; no cambia sus filas ni columnas.

Validación: 31 pruebas de API (transacción, seguridad, cierre parcial/completo,
componentes, reapertura y concurrencia) y 37 de frontend. TypeScript web/API,
ESLint y CSS Guard. Recorrido en Chrome con una OT temporal de dos productos:
primer trabajo sin aviso, último con el resumen completo, cierre con Entendido
y recarga sin repetición. Comprobación visual a escritorio, 390 y 320 px; scroll
interno con acciones siempre visibles. La OT se conserva finalizada al cerrar,
sin fecha de entrega efectiva. La fixture local se retira después de probar.

## Actualización 2026-09-14: Lista operativa y consulta de terminados

El tablero tiene dos pestañas, **Lista** y **Kanban**. Lista reemplaza Por items
y conserva su preferencia guardada (`items`). Estaciones tiene su acceso propio
en Producción. Ambas pestañas comparten clasificación exclusiva: Bloqueados,
En espera, Con retraso, Vencen hoy, En curso, Pausados y Listos para iniciar; dentro de cada grupo se ordena
por entrega. Lista usa grupos plegables, columnas alineadas y estados con color,
con componentes HeroUI y CSS Modules. Se retiraron los estilos globales de las
filas y los filtros reemplazados.
Sólo se renderizan secciones con trabajos, también al aplicar filtros. Si no
queda ninguna, la Lista muestra un único mensaje de ausencia de resultados.
El estado pinta la celda completa, incluso cuando la fila crece en pantallas
angostas. En espera usa gris con rayas diagonales; Listo para iniciar usa verde
con texto blanco y cambia a naranja de Grafo en Con retraso. Bloqueado conserva
rojo con texto blanco. Son señales visuales: no cambian la clasificación.
Debajo de En espera se muestra el personal de sus predecesores pendientes,
resuelto por ID contra los trabajos autorizados antes del filtrado visual.
Admite varias personas y pasos. Los tercerizados identifican al proveedor.
Las esperas por requisitos sin pasos pendientes no atribuyen personal ajeno.
La celda En espera abre un tooltip HeroUI al pasar el cursor o recibir foco con
el teclado. Cada dependencia ocupa una línea propia con su producto y lote;
los demás requisitos (materiales, calidad, aprobaciones) mantienen sus líneas
independientes. Paso / Estación muestra el nombre del paso con mayor tamaño y
peso en todas las secciones, sin desplegar allí las dependencias.

La cabecera ubica Lista y Kanban justo debajo del título y subtítulo. Las
métricas se presentan en una franja compacta, sin cards ni filtros por estado
o prioridad. Se conserva la búsqueda y se ofrecen **Asignadas a mí** y
**Estación**; el selector de **Personal asignado** requiere permiso de
supervisión y alcance completo. Las opciones salen de los datos ya autorizados
del tablero y de estaciones, sin consultar el padrón completo de personal.

Los filtros se combinan sobre el mismo paso y mantienen una fila por trabajo.
La columna Paso / Estación representa el próximo paso pendiente dentro de la
estación o del personal elegido, aunque todavía espere dependencias. Prioriza
un paso en ejecución o listo y avanza al siguiente cuando se completa. Conserva
la ruta completa para evaluar requisitos y abrir el detalle. Las métricas
acompañan el resultado filtrado; urgencias y estados pueden superponerse.
El acceso `?estado=blocked` abre la sección Bloqueados sin aplicar filtros ocultos.

Personal asignado muestra las personas de la asignación automática o manual,
con respaldo en el tramo abierto o la mesa; cuando no existe, muestra **Sin asignar**.

**Estados operativos (14/09):** «Bloqueado» queda reservado para el estado explícito
registrado con su motivo. «En espera» se deriva de dependencias o requisitos sin
cumplir (material, calidad, aprobación documental o estación/máquina habilitada).
Las esperas tienen su propia sección; no suman al contador de Bloqueados.
Pausado conserva las acciones y permisos existentes y tiene su grupo cuando no
prevalece una urgencia de entrega. Las esperas y bloqueos prevalecen sobre las
secciones por fecha; los demás mantienen Con retraso/Vencen hoy y su estado real
en la fila. No se agregan estados persistidos ni se modifican transiciones.

La fila usa el mismo paso para nombre, estación y estado. Si hay varias ramas,
se conserva la alerta de un bloqueo explícito; en las restantes se prioriza una
ejecución y luego una rama lista sobre requisitos pendientes. Terminar un paso
permite mostrar el siguiente como Listo para iniciar aunque el trabajo ya haya
empezado. Los tercerizados pedidos conservan su situación de compra.

Colas distingue `bloqueados` de `en_espera` en respuesta, totales y filtro.
Las dos vistas comparten una lectura documental por lote de pasos que respeta
aprobaciones de orden/ítem/paso y la herencia de productos en lotes. Los terminados
siguen consultándose sólo bajo demanda; no se cargan para calcular estos estados.

- `GET /ordenes-trabajo/tablero?vista=activos`: usado en la carga inicial,
  actualización y refresco automático del tablero. Filtra los items terminados
  en la consulta SQL, conservando todos los pasos de cada item activo para su
  progreso y ruta. Los items sin ruta siguen visibles. Los participantes de
  nesting no determinan por sí solos si un item sigue activo.
- Las dependencias a componentes terminados se evalúan con el estado de la
  relación cargada. En esta proyección se omiten las aristas ya satisfechas hacia
  pasos externos ausentes; no se modifican las dependencias persistidas ni el
  motor de planificación. Las dependencias pendientes se conservan.
- `GET /ordenes-trabajo/tablero/terminados`: consulta independiente, sólo al
  desplegar **Ver terminados**. Página de 25, máximo 50; búsqueda por OT, cliente
  o trabajo y rango de entrega (fecha del item, con respaldo en la OT). Ordena por
  creación de la OT descendente y usa `limit + 1` para indicar si hay otra página,
  sin contar ni descargar todo el historial. Incluye items terminados de órdenes
  pendientes, en producción, finalizadas o entregadas. No consulta borradores ni
  canceladas. No participa del refresco periódico.
- `GET /ordenes-trabajo/tablero/items/:itemId`: recupera un solo trabajo para
  abrir su detalle desde un enlace, incluso si ya salió de los activos. Mantiene
  permiso `produccion.ver`, aislamiento por tenant y las acciones existentes.
- El GET del tablero sin `vista=activos` conserva el contrato anterior para
  Estaciones y Planificación.

Cobertura: integración PostgreSQL de filtrado, paginación, permisos, búsqueda,
fechas y equivalencia de ETA con componentes terminados; pruebas de clasificación,
operadores y estación de pasos bloqueados en el frontend.

El relevamiento original se conserva a continuación como antecedente.

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
  **Completar el último paso pendiente la auto-finaliza** (`produccion →
  finalizada`, `progresoPct` 100, evento de sistema; `ordenSeFinaliza`);
  la OT sale del tablero. **Reabrir** un paso de una OT `finalizada` deshace
  la finalización y la vuelve a `produccion` (única acción de paso permitida
  sobre una orden finalizada). La entrega sigue siendo decisión humana en
  Órdenes. *(Corrige la decisión original, que dejaba la finalización manual.)*
- **D3 — Progreso.** `progresoPct` del item = hechos/total (por cantidad de
  pasos, fase 1). El de la orden = sobre el total de pasos de todos sus items;
  se persiste en `OrdenTrabajo.progresoPct` en cada acción (así el listado de
  Órdenes ya muestra avance real sin tocarse).
- **D4 — Estación (fase 1) = centro de costo.** ~~La vista "Por estación"
  agrupa pasos activos por `centroCostoNombre`.~~ **Superada 2026-07-17 por
  las estaciones reales** (docs/estaciones-diseno.md): el paso llega a su
  estación por la FAMILIA con las máquinas como filtro
  (`resolverEstacionDePaso`); lo no resuelto → bucket "Sin estación". El centro de costo quedó como dato informativo del
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
