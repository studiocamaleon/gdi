# Versiones internas de planes

## Alcance

Plataforma → Planes → **Versiones** permite publicar la revisión guardada de un borrador como una copia fija de sus funciones y cupos. Publicar no asigna empresas, modifica precios, cambia Founder, ejecuta Paddle ni habilita planes en el registro público.

Flujo: editar → guardar borrador → elegir plan en Versiones → revisar contenido y motivo → publicar. Cada versión muestra su número, revisión de origen, autor, fecha, motivo y contenido histórico. Las siguientes ediciones permanecen en el borrador.

El almacenamiento debe estar definido: limitado con cantidad válida o sin límite comercial explícito. El usuario definió posteriormente 250 GB, 500 GB y 1500 GB. La primera versión interna conserva estos valores; los precios comerciales se vincularán en otra etapa.

## Integridad

- `PlanVersion` guarda el contenido completo y el catálogo de funciones/grupos de ese momento. Cambiar etiquetas o dependencias en el código no reinterpreta lo que muestra su historial.
- Restricciones únicas por borrador/número y borrador/revisión. La revisión de origen identifica un reintento: devuelve la misma versión sin duplicar auditoría, incluso después de editar otro borrador.
- Publicación, validación de sesión y auditoría en una transacción. Se comparte el advisory lock de gestión de equipo/edición para serializar publicaciones y revocaciones de staff.
- Se comprueba ADMIN activo, sesión personal de Plataforma vigente y MFA. Soporte sólo consulta. Se rechaza impersonación y MCP.
- El servidor toma el contenido de la revisión persistida; no acepta contenido enviado por el navegador. Revalida catálogo vigente, dependencias, bases, pilotos y cupos.
- PostgreSQL rechaza UPDATE/DELETE de versiones publicadas. No hay endpoints de edición/borrado. El autor queda identificado por UUID y nombre congelado; el evento mantiene su vínculo normal al usuario de staff.
- Historial de 20 versiones por página con cursor por número. Detalle bajo los permisos de Plataforma y respuestas `no-store`.
- La interfaz bloquea publicación si hay cambios sin guardar en ese plan, falta cupo, hay catálogo incompatible o no se pudo consultar historial. Ante conflictos conserva el motivo y permite recargar borradores pasando por la protección de cambios pendientes.

Migración: `20260922000000_versiones_planes`, aplicada en desarrollo y `gdi_saas_test`. No usa seeds, reemplazos de contratos ni actualizaciones de catálogo comercial.

## Validación

- API: suites `planes-versiones`, `planes-borradores`, `planes-comparacion`: 26 pruebas. Incluyen snapshot histórico, idempotencia, revisiones obsoletas, permisos y revocación, dependencias, almacenamiento, inmutabilidad en PostgreSQL y rollback de auditoría.
- Interfaz: `planes-view` y `planes-comparacion`: 18 pruebas. Revisión antes de publicar, envío sólo de revisión/catálogo/motivo, conflictos, roles y fallos de consulta.
- TypeScript API/web, lint focal y revisión autenticada en Chrome de la pestaña y estado real sin publicaciones.
- Las pruebas de snapshots se ejecutan en transacciones revertidas de la base de tests, sin deshabilitar la protección de inmutabilidad.

## Asignación y próximos bloques

La asignación interna a suscripciones manuales y la resolución común de funciones/cupos están implementadas. Ver [asignación de versiones](planes-asignacion-versiones-2026-09-21.md).

1. Recorridos completos de Esencial, Pro y Avanzado con contratos asignados en una empresa de prueba.
2. Ampliar y validar políticas de continuidad ante cambios de funciones, incluyendo operaciones concurrentes.
3. Vincular precios y contratación comercial. Publicar una versión interna no certifica que todos los recorridos de las 65 funciones estén cerrados.
