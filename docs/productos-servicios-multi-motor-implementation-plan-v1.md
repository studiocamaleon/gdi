# Plan Técnico de Implementación v1: Arquitectura Multi‑Motor de Costos (Global ERP)

## Objetivo
Implementar una arquitectura multi‑motor real para Productos y Servicios, donde:
- los motores viven en código backend (global ERP, no por tenant),
- cada producto tiene un motor asignado (`motorCodigo` + `motorVersion`),
- existe configuración base por producto y override opcional por variante,
- la cotización resuelve motor/configuración sin fallback hardcodeado legacy.

## Alcance v1
- Catálogo global de motores vía backend.
- Asignación de motor persistente en `ProductoServicio`.
- Config base (`ProductoMotorConfig`) + override variante (`ProductoVarianteMotorOverride`).
- Cotizador e imposición usando resolución efectiva de configuración.
- Migración de datos legacy de `ProductoVarianteAlgoritmoConfig`.
- Eliminación de endpoints runtime legacy `algoritmo-config`.

## Contratos API v1
1. `GET /productos-servicios/motores`
   - Respuesta: `[{ code, version, label, schema }]`.
2. `PUT /productos-servicios/:productoId/motor`
   - Body: `{ motorCodigo, motorVersion }`.
3. `GET /productos-servicios/:productoId/motor-config`
4. `PUT /productos-servicios/:productoId/motor-config`
   - Body: `{ parametros }`.
5. `GET /productos-servicios/variantes/:varianteId/motor-override`
6. `PUT /productos-servicios/variantes/:varianteId/motor-override`
   - Body: `{ parametros }`.

## Modelo de datos
- `ProductoServicio`
  - `motorCodigo: string`
  - `motorVersion: number`
- `ProductoMotorConfig`
  - `tenantId`, `productoServicioId`, `motorCodigo`, `motorVersion`, `parametrosJson`, `versionConfig`, `activo`, timestamps.
- `ProductoVarianteMotorOverride`
  - `tenantId`, `productoVarianteId`, `motorCodigo`, `motorVersion`, `parametrosJson`, `versionConfig`, `activo`, timestamps.
- `CotizacionProductoSnapshot`
  - usa `motorCodigo`, `motorVersion`, `configVersionBase`, `configVersionOverride`.

## Resolución de configuración (runtime)
1. Resolver motor del producto.
2. Cargar última config base activa de producto para ese motor.
3. Cargar último override activo de variante para ese motor.
4. Mezclar: `defaultMotorConfig <- base <- override`.
5. Ejecutar cotización/imposición con resultado trazable.

## Frontend v1
- Crear producto (sidebar): motor obligatorio desde catálogo backend.
- Tab General: selector de motor persistente real.
- Imposición/Cotizador:
  - carga base + override,
  - guarda override por variante.
- Nomenclatura visible unificada: **Motor de costo**.

## Migración de datos
Migración SQL incluida para:
1. Crear columnas/tablas nuevas multi‑motor.
2. Migrar snapshots legacy (algoritmo -> motor).
3. Migrar configuración legacy por variante:
   - base por producto (selección determinística),
   - override por variante solo si difiere.
4. Eliminar dependencia en columnas legacy de snapshot.

## Criterios de aceptación
1. Crear producto con motor y verificar persistencia.
2. Cambiar motor en Tab General y verificar persistencia.
3. Guardar config base/override y leer consistentemente.
4. Cotizar variantes con y sin override y ver diferencias trazables.
5. No existen llamadas frontend a `/algoritmo-config`.

## Estado de implementación (actual)
- Backend multi‑motor: implementado.
- Endpoints nuevos de motor: implementados.
- Frontend de productos/ficha: migrado a contratos de motor.
- Builds `apps/api` y `web`: OK.
- Migración SQL multi‑motor: creada en `apps/api/prisma/migrations/20260316083000_multi_motor_architecture_v1/migration.sql`.
