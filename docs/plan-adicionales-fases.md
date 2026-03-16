# Plan Adicionales - 3 Fases

## Objetivo
Estandarizar el comportamiento de Adicionales para casos reales de imprenta digital, separando con claridad `Servicio` y `Acabado`, y mejorando el costeo sin romper compatibilidad.

## Fase 1 - Simplificación de Servicio
- Regla de negocio:
  - `Servicio` no usa materiales.
  - `Servicio` solo usa productividad por tiempo (`time_only`).
- UX:
  - Ocultar `Materiales` cuando `Tipo=Servicio`.
  - Renombrar pestaña `Efectos` a `Costo`.
  - Reemplazar labels técnicos por labels funcionales.
- Costeo:
  - Para servicio, costo por reglas de costo (tiempo fijo o variables).

## Fase 2 - Niveles de Servicio
- Permitir que un servicio tenga niveles (ej. Básico, Intermedio, Avanzado).
- Cada nivel define su propia regla de costo.
- Cotizador permite seleccionar nivel por addon de tipo servicio.

## Fase 3 - Impactos de Precio por Nivel
- Cada regla de costo de nivel puede tener impactos adicionales:
  - monto fijo (`flat`)
  - porcentaje sobre la regla (`porcentaje_regla`)
- Trazabilidad de costos en cotización para entender origen:
  - nivel seleccionado
  - regla aplicada
  - impactos aplicados

## Entregables implementados
- Backend:
  - Endpoints de configuración de costo por servicio:
    - `GET /productos-servicios/adicionales/:id/servicio-pricing`
    - `PUT /productos-servicios/adicionales/:id/servicio-pricing`
  - Validaciones de servicio (`time_only`, sin materiales).
  - Cotización extendida con `addonsConfig[]` (incluye selección de nivel).
- Frontend:
  - Biblioteca Adicionales:
    - pestaña `Costo`
    - configuración de niveles, regla por nivel e impactos.
    - `Materiales` visible solo para `Acabado`.
  - Cotizador de producto:
    - selección de nivel por addon de tipo servicio.

## Compatibilidad
- Se mantiene `addonsSeleccionados`.
- Se agrega `addonsConfig` sin romper contratos existentes.
- Configuración de niveles/costos de servicio se guarda en `metadata` del adicional.
