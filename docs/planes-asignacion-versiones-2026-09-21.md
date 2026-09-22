# Asignación interna de versiones de planes

## Resultado

Plataforma → Planes → Versiones → Ver contenido → **Evaluar asignación** permite elegir una empresa, revisar el impacto y asignar la versión publicada. Se admite una suscripción manual existente; las cuentas con cobro externo siguen su integración comercial.

Las versiones internas iniciales, publicadas desde la revisión 2 guardada por el usuario, incluyen:

| Plan | Versión | Usuarios incluidos | Almacenamiento |
| --- | --- | --- | --- |
| Grafo Esencial | 1 | 3 | 250 GB |
| Grafo Pro | 1 | 20 | 500 GB |
| Grafo Avanzado | 1 | 40 | 1500 GB |

Publicarlas conserva snapshots internos; no publica una oferta de venta. La empresa operativa sigue con Founder. La asignación efectiva se probó en la base de tests, dentro de transacciones revertidas.

## Contrato y resolución

- `Suscripcion.planVersionId` identifica el snapshot vigente. `revisionContrato` controla la concurrencia entre asignaciones.
- `contratoSuscripcion()` resuelve la versión asignada o la compatibilidad del plan anterior. Capacidades, sesión, usuarios, archivos y vistas administrativas usan esa resolución.
- Se mantienen el plan comercial, precio, proveedor, estado, trial, adicionales y excepción de almacenamiento. Los adicionales suman plazas; la cuota específica de archivos conserva prioridad sobre la del plan.
- Se rechaza asignar una versión sin adicionales si la empresa tiene plazas adicionales vigentes. Tampoco se permite añadirlos mientras esa versión no los admita.
- En Empresas → Funciones y límites aparece la versión y **Revisar vuelta al contrato anterior**. La vuelta elimina el vínculo operativo después de otro diagnóstico; utiliza las condiciones actuales del plan comercial conservado, no una copia histórica de ese plan mutable.
- Un contrato externo de Paddle con precio conocido vuelve a ser autoritativo y retira la asignación manual. Un precio desconocido no sustituye la versión interna. La contratación de versiones por Paddle queda pendiente.

## Diagnóstico, aplicación e historial

1. Se consultan usuarios activos, invitaciones, bytes guardados, reservas de subidas y compromisos de las funciones que se retirarían.
2. Excesos de cupos y compromisos abiertos detectados bloquean la asignación. Los casos sin conteo automático y el estado físico de impresoras requieren revisión explícita.
3. El administrador indica motivo y acepta las revisiones necesarias.
4. El servidor exige sesión personal de Plataforma, ADMIN activo y MFA; vuelve a leer condiciones y uso. Una huella distinta obliga a actualizar el diagnóstico.
5. La asignación toma el bloqueo de empresa compartido por usuarios, archivos y cambios de suscripción. Actualiza versión/revisión y auditoría en una transacción. El identificador de operación permite reintentar sin duplicar cambios ni eventos.
6. El historial de empresa registra versión anterior, destino, diagnóstico, uso, motivo y revisiones aceptadas. Un reintento con intención distinta se rechaza.

Migración: `20260922010000_asignacion_version_plan`, aplicada en desarrollo y tests. Los snapshots publicados siguen protegidos por la migración de inmutabilidad anterior.

## Evidencia

- 11 pruebas nuevas de integración: publicación/asignación, aislamiento de empresas, cupos efectivos, transición y vuelta, idempotencia, cambios tras el diagnóstico, adicionales/excepciones, compromisos abiertos, roles/sesiones y sincronización de Paddle.
- 107 pruebas de regresión de cupos, almacenamiento, empresas, suscripciones, sesión, cobro y evaluador; 20 pruebas de publicación/comparación/diagnóstico.
- 32 pruebas de interfaz, incluidas seis del diálogo: bloqueos, revisión obligatoria, doble envío, reintento, soporte y reversión.
- TypeScript API/web, lint focal y recorrido autenticado por publicación, historial y diagnóstico. El diagnóstico real detectó contratos externos y operaciones abiertas; no se asignó una versión a la empresa operativa.
- API y workers de cotización/geometría/PDF reiniciados con el resolvedor actualizado.

## Límites y siguiente etapa

- La primera política bloquea compromisos detectados en vez de migrarlos automáticamente. Los módulos sin conteo necesitan revisión manual.
- El bloqueo de empresa serializa contrato, usuarios y almacenamiento. Falta cerrar las carreras con operaciones iniciadas simultáneamente en todos los otros módulos; no se considera terminada la validación integral de cambios de plan.
- Deben probarse los recorridos completos de Esencial, Pro y Avanzado con versiones asignadas y permisos reales, incluidos workers, entradas directas y continuidad histórica.
- Faltan precios, contratación de adicionales, mapeo a Paddle y unificación de registro/checkout/web comercial. Esta entrega no certifica por sí sola todos los caminos de las 65 funciones del catálogo.
