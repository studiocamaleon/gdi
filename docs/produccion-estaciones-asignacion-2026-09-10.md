# Estaciones: asignación por máquina o por paso sin máquina

## Alcance implementado

La estación agrupa máquinas y trabajo sin máquina. Los equipos compartidos representan a las personas; no se crean personas ni estaciones adicionales por cada regla. Se mantiene la duración calculada en la cotización.

- Un paso con `maquinaId` se asigna sólo a la estación activa que contiene esa máquina habilitada. No cae en reglas de tecnología, paso o familia si falta la asignación.
- Sin máquina, la configuración permite exclusivamente familias que admiten ejecución M-0. Una estación puede tener máquinas y recibir también trabajo manual.
- Un paso propio del tenant puede tener asignación específica; si no tiene, hereda la asignación de su plantilla. No depende del orden alfabético de las estaciones.
- Si hay asignaciones manuales ambiguas del mismo nivel, el paso queda sin estación. La antigua regla explícita `paso` prevalece sobre `familia` para preservar esa decisión histórica hasta normalizar la estación.
- Los tercerizados mantienen su flujo de proveedores.
- La falta de máquina en una familia que la exige no convierte una OT histórica en trabajo manual. La proyección queda orientativa y señala qué revisar.

El criterio se aplica al tablero, ETA de backend y navegador, cotización hipotética, distribución de entregas y permisos para ejecutar pasos. El contrato de contexto de F6 cambió para exigir recalcular propuestas anteriores antes de aplicarlas.

## Configuración y compatibilidad

El editor muestra una lista de **Pasos sin máquina** y una lista de **Máquinas**. Se retiraron los selectores de tecnología y el ajuste avanzado superpuesto por familia/paso. Se conservan equipos, empleados, capacidad física y calendarios.

La lectura del catálogo y las estaciones excluye reglas de tecnología y reglas de pasos que exigen máquina. La base conserva esas filas antiguas hasta editar la estación; al guardar, se normalizan sus asignaciones manuales. No requiere migración de esquema ni reescritura de OTs. Un cliente antiguo que intente guardar una regla tecnológica recibe una explicación para actualizar la pantalla.

La API valida el tenant de cada paso propio y máquina. Una asignación manual no puede repetirse en otra estación, aunque tenga máquinas. Los guardados se serializan por empresa y revalidan el estado final en la transacción para evitar duplicados concurrentes. Conflictos históricos ajenos a la estación editada no bloquean su corrección.

## Configuración local pendiente

Auditoría de lectura del tenant local, 10/09/2026:

- Ocho máquinas activas sin estación: Anilladora, Cortadora Laser CO2, Cortadora de hilo caliente, Impresora DTF UV, Plancha Termica, Plotter de Planos CAD, Ricoh DX 2430 y Ricoh PRO C5100.
- La estación Laser CO2 tenía reglas de corte/grabado, pero no tenía asignada la cortadora. Ahora figura sin asignaciones hasta vincular la máquina.
- La Impresora Eco-solvente está asignada a Impresion UV. Se conserva esa pertenencia explícita. La estación llamada Impresion Eco-solvente está vacía.
- Los equipos humanos todavía no están configurados. La limpieza de asignación no certifica por sí sola la capacidad humana ni las fechas de entrega del taller.

No se reasignaron máquinas ni se modificaron horarios reales basándose en nombres. La pantalla lista las máquinas sin estación activa para completar esas decisiones.

## Validación

- Contrato de ruteo ejecutado contra frontend y backend: identidad de máquina, estaciones/máquinas inactivas, ausencia de máquina obligatoria, manuales en estaciones mixtas, herencia, ambigüedades y terceros.
- Regresión de ETA del exhibidor de 150 unidades con las máquinas asignadas explícitamente, incluyendo impresión y corte.
- Pruebas de distribución por entregas y de capacidad humana compartida.
- Integración contra base de pruebas: crear y mover máquinas, desactivar estaciones, editar datos antiguos y resolver dos guardados concurrentes.
- Pruebas de permisos de ejecución para evitar que una impresión sin máquina asignada se reclame mediante una regla manual.
- TypeScript, compilación API, lint de archivos frontend afectados y CSS guard. Revisión en navegador del catálogo manual, editor, alerta de máquinas pendientes y carga de Planificación.

## Próximo paso

Completar la pertenencia de las máquinas y los equipos/calendarios reales. Después, avanzar con los carriles del Gantt por máquina y por puesto sin usar las subfilas visuales como si fueran recursos asignados. La reasignación manual y la reprogramación desde el Gantt siguen fuera de este cambio.
