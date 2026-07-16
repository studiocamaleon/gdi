# Órdenes de trabajo — persistencia (diseño)

> 2026-07-15. Fase 3 del plan OT: contrato (hecho) → vista (hecha) →
> **backend de persistencia** → conectar. Contrato TS en
> `src/lib/ordenes-trabajo.ts`; vistas en `/produccion/ordenes`.

## 1. Decisiones de modelo

### OT ≠ Cotización

`Cotizacion` (existente) es el presupuesto: se versiona, vence
(`fechaValidez`), se gana o se pierde. `OrdenTrabajo` es otra entidad: se
emite al taller, progresa y se entrega. El snapshot viaja de una a otra al
aprobar. La OT referencia `cotizacionId` (origen) pero vive su propio ciclo.

### Ciclo de estados

`borrador → pendiente → produccion → finalizada → entregada` (el flujo del
diseño Grafo V2). Transiciones sólo hacia adelante por ahora; cada cambio de
estado genera un evento de auditoría. `progresoPct` es null salvo que
producción informe (futuro tablero); la vista deriva 0/100 de los estados
extremos.

### El item NO duplica el snapshot

Problema planteado: la OT real tiene mucha más información por item de la
que la vista muestra (costos, pasos de producción, specs completas), y a
futuro se agregan secciones (Costos / Producción por item).

Respuesta: `OrdenTrabajoItem` guarda **la proyección visible** (código,
nombre, familia, cantidad, montos, `specsJson` etiqueta/valor,
`adicionalesJson`) y **referencia `cotizacionItemId`**, cuyo `snapshotJson`
ya persiste ruta + pasos + materiales + valores + jobContext completos.
Las secciones futuras leen del snapshot vía esa FK — sin migraciones ni
duplicación. Si una OT se crea sin pasar por el cotizador (histórica,
manual), `cotizacionItemId` queda null y la vista usa el fallback "sin
detalle" que ya existe.

Las specs visibles son el mismo `especificaciones: Record<string,string>`
que hoy arma el sheet de agregar producto (claves enriquecidas tipo
`material`, `medidas`, `personalizaciones`) serializado a
`[{etiqueta, valor}]` al emitir. Cómo curar/ordenar esa lista por familia de
producto queda para la fase "conectar" (es lógica de presentación del
emisor, no del backend).

### Pagos: fuera de alcance

`OrdenTrabajoPago` del contrato es preview del módulo de pagos. El backend
devuelve `pago: null`; el modelo de pagos (cuotas, movimientos, medios) se
diseña como módulo propio colgado de la OT — ver análisis previo: los
disparadores de facturación/cobro son los estados de la OT.

### Numeración

`OT-AAAA-NNNN` por tenant y año. Contador atómico en tabla
`OrdenTrabajoContador (tenantId, anio, ultimo)` con upsert+increment dentro
de la misma transacción que crea la OT (evita huecos por retry y colisiones
por concurrencia; `@@unique([tenantId, numero])` como cinturón). El número
se asigna al crear (los borradores también lo tienen, como en el diseño).

## 2. Modelo Prisma

```
OrdenTrabajo
  id, tenantId, numero (unique por tenant)
  clienteId?, vendedorEmpleadoId?, cotizacionId?
  estado (string, default borrador)
  fechaEmision?, fechaEntrega? (date), observaciones?
  subtotal?, impuestos?, cargosDirectos?, total? (Decimal 14,2 — denormalizados para listado)
  progresoPct? (Int)
  items[], eventos[]

OrdenTrabajoItem
  id, tenantId, ordenId, cotizacionItemId?
  codigo, nombre, familia
  cantidad (Decimal), cantidadUnidad
  subtotal, impuestos, total (Decimal)
  specsJson?, adicionalesJson?
  ordenIndice (Int) — orden visual

OrdenTrabajoEvento
  id, tenantId, ordenId, fecha, tipo, descripcion, usuarioNombre

OrdenTrabajoContador
  tenantId, anio, ultimo — @@id([tenantId, anio])
```

## 3. API (módulo `ordenes-trabajo`)

- `GET /api/ordenes-trabajo` → `OrdenTrabajoListItem[]` (filtros `estado`,
  `q`; orden createdAt desc; nombres de cliente/vendedor resueltos por join).
- `GET /api/ordenes-trabajo/:id` → `OrdenTrabajoDetalle` (items + eventos,
  `pago: null`).
- `POST /api/ordenes-trabajo` → crear (estado inicial `borrador` o
  `pendiente` = emitida; items con proyección + `cotizacionItemId?`).
  Asigna número, calcula denormalizados desde items, genera eventos
  (productos/borrador/número/emisión según corresponda).
- `PATCH /api/ordenes-trabajo/:id/estado` → transición válida hacia
  adelante + evento; `pendiente` fija `fechaEmision` si faltaba.

Convenciones: `@CurrentSession()` + tenantId en todos los where (patrón
clientes), DTOs class-validator, fechas ISO en la respuesta (el contrato TS
del frontend es el contrato de la API).

## 4. Qué sigue (fase "conectar")

1. La propuesta (`propuesta-ficha`) llama `POST /ordenes-trabajo` al emitir
   (reusando `cotizar-y-guardar` para tener `cotizacionItemId` por item) —
   ahí entra el `EmitOverlay` del diseño.
2. Listado/detalle pasan de mock a fetch (server components, mismo contrato).
3. Secciones Costos/Producción por item en el detalle, leyendo del snapshot.
4. Módulo de pagos (diseño propio, cuelga de OrdenTrabajo).
