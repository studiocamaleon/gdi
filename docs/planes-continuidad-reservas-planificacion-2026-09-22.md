# Continuidad de planes: reservas, previsión y planificación

Fecha: 22/09/2026. Rama: `codex/rediseno-backoffice-plataforma`.

## Comportamiento

| Situación | Resultado |
| --- | --- |
| Emitir una OT con un plan sin Reservas | La OT se guarda sin crear necesidades, reservas ni movimientos de stock |
| Una contratación pendiente retiraría Reservas o Existencias | Se rechazan nuevos compromisos de materiales; no se desactiva silenciosamente la política vigente |
| Consumir o liberar reservas anteriores durante ese cambio | Se permite cerrar las cantidades existentes; no se incorporan necesidades nuevas como efecto secundario |
| Reabrir una OT entregada con necesidades sin consumir | Se vuelve a comprobar que el contrato y el cambio pendiente permitan gestionar esas necesidades |
| Consultar faltantes con Previsión y Existencias, sin Reservas | Se calcula disponibilidad y reposición sin crear compromisos; no exige una política de reservas activa |
| Retirar sólo Previsión | No obliga a cerrar necesidades que siguen cubiertas por Reservas y Existencias |
| Retirar Planificación mientras se calcula una propuesta | La revisión queda fallida con un motivo; no se publican alternativas ni fuentes nuevas para producción |
| Consultar distribuciones después de retirar Planificación | Los GET de OT y cotización siguen disponibles con permisos y aislamiento; los POST para calcular, elegir o reprogramar se rechazan |

Una revisión vencida de un checkout no demuestra que el pago haya sido descartado. Se contemplan los estados `enviando`, `checkout` y `verificar`.

La previsión conserva la exclusión de consumibles definida en la política existente; sin política los excluye. Su respuesta usa `modoReserva: null` cuando no hay reservas activas incluidas en el contrato. La interfaz informa que consultar disponibilidad no reserva materiales.

## Implementación

- Reservas, política, movimientos/transferencias públicas de stock y las transacciones de OT que sincronizan materiales toman primero el lock de contrato. Comprueban las capacidades dentro de la transacción que escribe.
- La sincronización automática distingue una OT nueva sin el complemento de una OT histórica que ya tiene materiales controlados. Esta última no se reinterpreta silenciosamente con un plan sin Reservas.
- Consumir/liberar no ejecuta la reconciliación de necesidades; toma los locks de variantes necesarios para cerrar las reservas existentes sin afectar stock comprometido por otras órdenes.
- Solicitud, reprogramación, selección y materialización de entregas vuelven a comprobar Planificación dentro de su transacción. Se conservan los locks `FOR UPDATE` de la cola que también protegen referencias e inserciones.
- El worker valida antes de reclamar el cálculo y antes de publicar. Una solicitud rechazada por contrato termina en `FALLIDA`, para que el dispatcher no siga recuperándola indefinidamente. Se conserva el token de ejecución que evita que un worker anterior sobrescriba otro resultado.
- Los guards de Planificación se aplican a las escrituras que crean/adoptan planes. La consulta histórica conserva permisos de usuario y filtros por empresa.

## Evidencia

Base exclusiva `gdi_saas_test`, con fixtures sintéticas. No se enviaron pagos, mensajes ni trabajos de impresión.

- `reservas-planes.integration.spec.ts`: **10 casos**, con publicación y asignación reales. Emisión directa y desde borrador, rollback por cambio pendiente, emisión posterior en Esencial, tres estados de contratación, idempotencia de consumo, liberación, reapertura y previsión independiente de reservas.
- `planificacion-planes.integration.spec.ts`: **11 casos**. Cambios antes y durante el cálculo, control antes de publicar, solicitud con comprobación inicial desactualizada, selección bloqueada y consultas HTTP históricas con permisos/aislamiento. El motor de planificación utiliza cotizaciones controladas; la adopción productiva se sustituye para comprobar que no se invoca cuando está prohibida.
- `compras-cambio-plan.integration.spec.ts`: **18 casos** en total, cuatro nuevos de reservas automáticas/manuales frente a asignación de plan en ambos órdenes. Se usan conexiones PostgreSQL independientes y `pg_blocking_pids` para observar la espera. Estas carreras ejercitan la sincronización/comando de reservas; la emisión completa de OT se verifica por separado en la suite anterior.
- Regresión inicial: **125 pruebas** en ocho suites de reservas, emisión, Compras, recorridos asignados y planificación. Después del desacople de previsión, **29 pruebas** de Compras y **48** de planificación/planificación previa/nuevos contratos. Estos grupos se solapan: no sumarlos como pruebas únicas.
- Web: **13 pruebas** de previsión y control de materiales. TypeScript de producción API/web y de los nuevos escenarios aprobado. Lint focal de servicios/pruebas de este bloque y archivos web aprobado; `git diff --check` sin errores.

El lint completo de `inventario.service.ts` y `ordenes-trabajo.service.ts` sigue mostrando **42 errores y 3 advertencias** en código anterior, principalmente tipos inseguros y aserciones. No se presenta ese control amplio como aprobado. Las incorporaciones transaccionales se verificaron con tipos y regresiones.

Los escenarios con savepoints validan persistencia y reglas, no concurrencia entre conexiones. La suite de Compras citada aporta la evidencia de concurrencia real. No se certifica rendimiento a escala SaaS ni se realizó un nuevo recorrido visual en este incremento.

## Pendientes del cierre global

1. Continuidad de avisos implementada en el incremento siguiente: [comportamiento y evidencia](planes-continuidad-avisos-2026-09-22.md). Queda por ampliar el recorrido con servicios y extensión reales.
2. Completar el acceso histórico de finanzas tras retirar módulos y revisar los demás automatismos de producción/lotes.
3. Completar combinaciones del editor, CAD y recorridos de navegador. La cobertura del catálogo sigue siendo parcial.
4. Recuperación administrativa de contrataciones inciertas sin referencia confirmada, sin repetir ni liberar cobros por una búsqueda vacía.
5. Preparación comercial de producción y precios anuales cuando se definan. La prueba externa realizada sigue siendo sólo de Paddle sandbox, con su túnel cerrado.

Antecedentes: [finanzas y proyectos](planes-continuidad-finanzas-proyectos-2026-09-22.md), [prueba comercial](planes-cierre-comercial-2026-09-21.md).
