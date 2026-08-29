# Fase 1 — Diseño técnico de Proyecto / Campaña

**Estado:** implementación base completada; validación funcional en curso
**Rama:** `visual-ilusion/fase-1-campanas`
**Plan rector:** `docs/visual-ilusion-plan-maestro.md`
**Contrato visual:** `docs/visual-ilusion-lenguaje-visual.md`

## 1. Objetivo y límites

Campaña agrega una capa de coordinación opcional sobre el flujo existente. No reemplaza Cliente, Cotización ni Orden de Trabajo, no duplica sus importes y no cambia su ciclo. Un registro histórico o nuevo puede seguir teniendo `proyectoCampanaId = null`.

La fase entrega el núcleo completo: persistencia, API, permisos, auditoría, archivos, hitos, equipo, vínculos, dashboard agregado, navegación e interfaz. Arte versionado, BOM, lotes, reservas, kits y logística conservan sus fases asignadas.

## 2. Decisiones

### Dominio y permisos

- Ruta funcional: `/comercial/campanas`.
- Lectura: `comercial.ver`; mutaciones: `comercial.gestionar`.
- No se crea un permiso nuevo: Campaña coordina la venta y la ejecución, pero introducir `campanas.*` dejaría roles personalizados existentes sin acceso y obligaría a una política de backfill arbitraria.
- Los costos y márgenes de la respuesta usan `@OcultaMargenes()`.

### Identidad y numeración

- Nombre Prisma: `ProyectoCampana` sin `ñ`; API y UI usan “campaña”.
- Código `CAM-AAAA-NNNN`, consecutivo por tenant/año mediante `ProyectoCampanaContador` y transacción serializable.
- Unicidad por `(tenantId, codigo)`; el nombre no es único porque una campaña puede repetirse por temporada o región.

### Relaciones

- Cada campaña pertenece a exactamente un cliente.
- `Cotizacion.proyectoCampanaId` y `OrdenTrabajo.proyectoCampanaId` son FKs opcionales directas: la cardinalidad dominante es una campaña por documento y una campaña contiene muchos documentos.
- Al crear o vincular se exige que campaña y documento pertenezcan al tenant y al mismo cliente. Si la OT nace de una cotización con campaña, la hereda; una contradicción se rechaza.
- Desvincular no elimina ni modifica el documento fuente.
- Equipo es n:n mediante `ProyectoCampanaMiembro`; responsable principal es una FK separada y puede formar parte o no del equipo.

### Estados

Estados persistidos en minúscula: `borrador`, `activo`, `pausado`, `completado`, `cancelado`.

Transiciones permitidas:

```text
borrador ──> activo ──> pausado ──> activo
    │          │           │
    └──────────┴───────────┴──> cancelado
               └──────────────> completado
completado ──> activo
```

Reabrir una completada es explícito y auditado. `cancelado` es terminal en Fase 1. Completar es una decisión humana; la API devuelve señales de OTs abiertas e hitos pendientes para que la UI advierta, sin bloquear artificialmente.

Prioridades: `baja`, `normal`, `alta`, `critica`. Tipos son texto breve opcional para no fijar antes de observar el catálogo real de cada tenant.

Hitos: `pendiente`, `en_curso`, `completado`, `cancelado`. Completar fija `completadoEl`; reabrir lo limpia.

### Concurrencia y borrado

- Edición de campaña e hitos usa `updatedAt` como versión optimista.
- No hay borrado físico de campaña en esta fase. Se cancela para conservar trazabilidad.
- Eventos y contadores son append-only.

## 3. Modelo persistente

### `ProyectoCampana`

Identidad, tenant/cliente, código, nombre, descripción, tipo, estado, prioridad, fechas planificadas/reales, responsable, observaciones y timestamps. Relaciones a equipo, hitos, eventos, archivos, cotizaciones y OTs.

### `ProyectoCampanaMiembro`

Campaña, empleado y función opcional. Único por campaña/empleado.

### `ProyectoCampanaHito`

Título, descripción, responsable, fecha objetivo, estado, notas, orden, fecha real de completitud y timestamps.

### `ProyectoCampanaEvento`

Fecha, tipo, descripción humana, actor con nombre congelado, origen y `datosJson`. Registra alta, edición, transición, cambios de equipo/hitos y vínculos/desvínculos.

### `ProyectoCampanaContador`

Clave `(tenantId, anio)` y último correlativo.

### Archivos

Se agrega `ArchivoScope.CAMPANA` y FK `Archivo.proyectoCampanaId`. El servicio transversal valida existencia/tenant antes de firmar la subida y conserva cuota, papelera y descarga actuales.

## 4. Contrato API

Base: `/campanas`.

- `GET /campanas`: búsqueda, cliente, estado, prioridad, responsable, ventana de fecha y paginación; incluye stats.
- `POST /campanas`: alta con equipo e hitos iniciales.
- `GET /campanas/:id`: ficha, dashboard, equipo, hitos, documentos y timeline.
- `PATCH /campanas/:id`: edición con versión optimista.
- `PATCH /campanas/:id/estado`: transición explícita.
- `POST /campanas/:id/hitos`, `PATCH /campanas/:id/hitos/:hitoId`.
- `PUT /campanas/:id/equipo`: reemplazo atómico del conjunto final.
- `POST /campanas/:id/cotizaciones/:cotizacionId` y `DELETE` equivalente.
- `POST /campanas/:id/ordenes/:ordenId` y `DELETE` equivalente.
- `GET /campanas/opciones?clienteId=`: proyección liviana para formularios.

Las mutaciones relevantes ejecutan cambio y evento en una misma transacción.

## 5. Dashboard y fuentes

- `presupuestado`: suma de cotizaciones vinculadas no rechazadas ni vencidas.
- `vendido`: suma de OTs vinculadas no canceladas.
- `facturado` y `cobrado`: denormalizados existentes de esas OTs.
- `costoEstimado`: suma del `CotizacionItem.costoTotal` efectivamente referenciado por items de OTs vinculadas, sin contar dos veces el mismo item de OT.
- `margenEstimado = vendido - costoEstimado`; porcentaje sólo si vendido es mayor a cero.
- Producción: OTs por estado y progreso ponderado por cantidad de OTs con dato; se etiqueta como avance disponible, no como avance físico perfecto.
- Materiales: `disponible: false` con explicación hasta que Fases 3/9 creen demanda y reservas. No se inventa un semáforo.
- Entregas: vencidas, próximas y entregadas según `fechaEntrega`/estado de OT.

Los campos `costo*` y `margen*` se podan para quien no tenga `finanzas.ver_margenes`.

## 6. Integración con documentos existentes

- Emisión de presupuesto acepta `proyectoCampanaId?` y valida mismo cliente.
- Creación de OT acepta `proyectoCampanaId?`; si hay cotización, hereda su campaña cuando el payload no la indica.
- Conversión de presupuesto a OT propaga la campaña.
- Ediciones focalizadas permiten cambiar/desvincular campaña bajo las mismas reglas y dejan evento tanto en campaña como en documento cuando corresponda.
- Las respuestas de presupuesto y OT incluyen una referencia liviana `{ id, codigo, nombre } | null` y la UI enlaza a la ficha.
- Ficha de cliente muestra sus campañas sin cargar dashboards completos.

## 7. Interfaz

Familia primaria Gestión ejecutiva, con bloque secundario de Operación técnica. El listado es tabla operacional y la ficha tiene encabezado, banda KPI, hitos/timeline y tablas de presupuestos/OTs. Shadcn sólo aporta primitivas accesibles; identidad y layout viven en CSS Modules siguiendo el contrato visual.

## 8. Migración y seguridad

- Migración expand-only: tablas nuevas, enum de archivo y FKs opcionales.
- No hay backfill semántico: los documentos existentes quedan en null.
- Índices por tenant/estado/cliente/responsable/fecha y por las nuevas FKs.
- Todas las consultas se acotan por tenant; además, servicios verifican coherencia de cliente para evitar vínculos cruzados dentro del mismo tenant.
- El SQL se prueba sobre una copia restaurada antes de declarar la fase completa.

## 9. Pruebas mínimas

- máquina de estados y estado terminal;
- numeración concurrente por tenant/año;
- aislamiento tenant en lectura, vínculo, hito y archivo;
- rechazo de cliente inconsistente;
- herencia campaña cotización → OT;
- ampliación con dos cotizaciones y dos OTs sin mutar originales;
- dashboard contra fuentes y poda de márgenes;
- optimistic locking;
- flujos legacy con FKs null;
- API build, frontend type/lint, CSS guard y QA visual responsive.

## 10. Evidencia de implementación — 2026-08-29

La implementación base quedó registrada en el commit `41ead4c3` e incluye modelo,
migración expand-only, API, navegación, listado, ficha, edición, equipo, hitos,
archivos, timeline e integración opcional con presupuestos y órdenes de trabajo.

Validaciones ejecutadas:

- `prisma validate`: esquema válido;
- `prisma migrate status`: 203 migraciones aplicadas y base local al día;
- migración ensayada previamente sobre una copia restaurada: cinco tablas nuevas,
  tres FKs documentales y documentos legacy conservados en `null`;
- build de NestJS y build de producción de Next.js: correctos;
- 44 pruebas focalizadas de campañas, archivos y presupuestos: correctas;
- 105 pruebas de órdenes de trabajo y seguridad de tablero: correctas;
- 12 pruebas de permisos/navegación: correctas;
- lint focalizado de los módulos nuevos de Campañas: correcto;
- `git diff --check`: correcto.

Pendiente para declarar la fase `COMPLETA`:

- ejecutar el journey autenticado de aceptación con dos presupuestos y dos OTs;
- QA visual desktop/móvil en una sesión autenticada;
- completar pruebas de servicio sobre aislamiento tenant, conflicto optimista,
  vínculos cruzados y poda de márgenes;
- revisar el guard global de CSS. Hoy falla por diez reglas globales preexistentes;
  esta fase no modificó `src/app/globals.css`.
