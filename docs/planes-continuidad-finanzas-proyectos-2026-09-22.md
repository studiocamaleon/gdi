# Continuidad de planes: finanzas y proyectos

Fecha: 22/09/2026. Rama: `codex/rediseno-backoffice-plataforma`.

## Comportamiento

El contrato se vuelve a comprobar dentro de la transacción que guarda la operación. Si hay una contratación pendiente que retiraría una función necesaria, se rechaza el **nuevo compromiso** antes de modificar importes, numeración o estados. Un intento pendiente no concede las funciones del plan de destino.

| Operación | Durante un cambio que retira su función |
| --- | --- |
| Crear un egreso, activar una plantilla o generar un período recurrente | Se rechaza |
| Pagar o anular una deuda anterior, desactivar una plantilla | Se permite si el contrato vigente y el estado de la empresa permiten operar |
| Registrar un cheque de tercero o emitir uno propio | Se rechaza si el cambio retira Valores o Tesorería |
| Anular un pago o revertir un valor y reabrir un compromiso | Se rechaza si el cambio retira la gestión necesaria |
| Crear o reabrir una campaña; agregar o reabrir hitos pendientes; agregar vínculos | Se rechaza si se retira Proyectos |
| Completar/cancelar una campaña o sus hitos; quitar vínculos | Se conserva con el contrato vigente |
| Consultar campañas después de retirar Proyectos | Listado y detalle siguen disponibles, con permiso comercial y filtro por empresa; la interfaz no ofrece gestión |

El diagnóstico cuenta también las campañas completadas o canceladas que conservan hitos pendientes o en curso. Cerrarlas no oculta esas tareas frente a una reducción de plan. Para resolverlas se pueden completar o cancelar sus hitos antes del cambio.

## Transacciones y concurrencia

- `CapacidadesEmpresaService.exigirOperacionTx` toma el lock de empresa antes de otros locks, comprueba las funciones actuales y, cuando corresponde, la continuidad del compromiso frente al destino pendiente.
- El lock compartido realiza `UPDATE Tenant SET updatedAt = updatedAt`. Conserva los valores y toma un bloqueo de fila compatible con referencias foráneas (`NO KEY UPDATE`), pero crea una versión de la fila que permite detectar un snapshot anterior en una transacción `SERIALIZABLE`. Un simple `SELECT ... FOR NO KEY UPDATE` no cubría ese caso.
- Asignación manual, cuotas y sincronización de suscripciones participan del protocolo. Las operaciones financieras reintentan hasta tres veces los conflictos de serialización/deadlock de PostgreSQL (`P2034` o `P2010` con SQLSTATE `40001`/`40P01`). Sólo se repiten transacciones locales abortadas; nunca se repite por este mecanismo un envío de pago externo incierto.
- El generador de recurrentes vuelve a leer la plantilla bajo el lock: si se desactivó o el período ya se emitió, no genera otro egreso. La marca del período se guarda junto al egreso, sin escrituras posteriores fuera de esa transacción.
- La acreditación automática omite empresas que no pueden operar y conserva su consulta de pendientes. El barrido avanza por páginas de 500 registros para que las cuentas omitidas no posterguen indefinidamente a otras empresas.
- Las campañas validan la transición de estado dentro de la transacción. Los vínculos verifican además que el cliente y la asignación anterior del documento sigan siendo los leídos; un cambio concurrente se rechaza sin sobrescribirlo ni auditar un vínculo inexistente.

## Evidencia

Pruebas sobre `gdi_saas_test`; sin pagos, correos o mensajes externos ni cambios en empresas operativas.

- `apps/api/src/suscripciones/__tests__/finanzas-cambio-plan.integration.spec.ts`: **9 casos** con contratos publicados y datos revertidos al finalizar. Tres estados pendientes, deuda anterior, cheques, reversión, plantilla desactivada entre lecturas, consulta en sólo lectura y paginación con 500 cobros de una empresa dada de baja seguidos de otra empresa operativa.
- `apps/api/src/campanas/__tests__/campanas-planes.integration.spec.ts`: **5 casos** de continuidad, revalidación antes de numerar, diagnóstico de hitos y consulta histórica por HTTP después de una asignación real. Se comprueban permisos, aislamiento y denegación de opciones/escrituras.
- `apps/api/src/compras/__tests__/compras-cambio-plan.integration.spec.ts`: **14 casos** con fixtures confirmadas y conexiones PostgreSQL independientes. Se agregaron una transferencia `SERIALIZABLE` que espera al cambio de plan, reintenta y rechaza la transferencia sin mover fondos, y cuatro carreras de creación/reapertura de campañas en ambos órdenes. Se observa la espera real mediante `pg_blocking_pids`; no se simulan los locks.
- Regresión financiera: **111 pruebas** de egresos, recurrentes, tesorería y capacidades opcionales. Regresión de contratos/cupos: **101 pruebas**. Webhook y ejecución/cobros: **24 pruebas**. Asignación, recorridos comerciales y campañas: **51 pruebas** (este grupo repite la suite de asignación y los cinco casos de campañas; no sumar los grupos como pruebas únicas).
- Interfaz: **21 pruebas** de capacidades, historial de Compras y contratación. TypeScript de producción API/web, tipos de los nuevos escenarios, lint focal y `git diff --check` aprobados. Las páginas de campañas reutilizan las vistas existentes con la gestión condicionada al plan; este incremento no cambia su diseño visual.

Los escenarios con savepoints comprueban persistencia y reglas, no concurrencia entre conexiones. La suite de Compras citada es la que aporta esa evidencia de concurrencia real. El test de paginación no es una medición de rendimiento a escala SaaS.

## Pendientes del cierre global

1. Avisos avanzó en el [incremento de continuidad de canales](planes-continuidad-avisos-2026-09-22.md). Reservas/necesidades y planificación avanzaron en el [incremento posterior](planes-continuidad-reservas-planificacion-2026-09-22.md), con pruebas de concurrencia y límites explícitos.
2. Consulta histórica de Egresos, Tesorería, Valores y Recurrentes completada en el [incremento posterior](planes-historial-financiero-2026-09-22.md). Los reportes conservan su control propio.
3. Verificar las demás combinaciones del editor, CAD y recorridos de navegador pendientes.
4. Completar la recuperación administrativa de contrataciones inciertas sin referencia confirmada. No liberar ni repetir un cobro basándose sólo en una búsqueda sin resultados.
5. Preparar el entorno comercial de producción. Los precios anuales siguen sin definirse; no se ofrecen ni se infieren.

La prueba externa de Paddle sandbox, cancelada al terminar y con el túnel temporal cerrado, se documenta en [cierre comercial](planes-cierre-comercial-2026-09-21.md).
