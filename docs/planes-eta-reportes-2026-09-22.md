# Planes: continuidad de ETA y reportes operativos

Fecha: 22/09/2026. Incremento sobre P05 (`eta_capacidad`) y A04 (`reportes_produccion`).

## Comportamiento

- Una cotización o una OT puede seguir trabajando con fechas manuales sin ETA. El reparto de personal conserva su control independiente P04.
- Crear una promesa de emisión o guardar la foto diaria exige P05 y una cuenta operativa. Un checkout pendiente que retire P05 detiene nuevas publicaciones, incluso si su fecha local de revisión ya venció.
- El cálculo se realiza fuera de la transacción de escritura. Al publicar se toma el mismo cerrojo de empresa que usa el cambio de contrato y se vuelven a verificar las condiciones. Una retirada durante el cálculo descarta la publicación.
- Las fotos por estación e ítem se escriben en una única transacción. Un error de escritura revierte la foto completa.
- La promesa de emisión sólo se guarda para una OT todavía activa. Los reintentos conservan la promesa original y no la duplican. No se añadió un índice único ni se eliminaron posibles duplicados históricos.
- El contexto recupera fases históricas en memoria, sin modificar pasos durante una consulta. El reparto conserva su camino liviano sin recuperación; el backfill explícito de la operación de producción sigue disponible.
- Al finalizar una OT se registran sus tiempos reales y se cierran promesas anteriores, aunque se haya retirado ETA o la cuenta haya pasado a sólo lectura después de confirmar la finalización. Es un efecto interno posterior al commit, sin nueva simulación ni nueva promesa. Se verifica empresa, OT y estado finalizado/entregado bajo cerrojo.
- Las métricas históricas compartidas admiten **P05 o A04**. El endpoint de ETA exige P05 y el de Reportes exige A04, además de sus permisos personales. Retirar ambas funciones deniega el análisis, pero conserva los registros.
- Cambiar umbrales de Reportes exige A04 dentro de su transacción. Su lectura interna sigue disponible para construir el resumen básico sin añadirle una dependencia de A04.
- Actualizar manualmente la foto diaria exige supervisión. Devuelve `ok: false` si el contrato impide guardarla; el cron sólo cuenta fotos efectivamente publicadas.
- El margen de entrega de cada foto usa la fecha del ítem cuando existe y, en su defecto, la de la OT.

## Evidencia

135 pruebas de API aprobadas en 15 suites, contra `gdi_saas_test`:

- `eta-planes.integration.spec.ts`: 16 casos con versiones publicadas y asignadas; tres planes, retirada durante cálculo, tres estados de checkout, independencia P05/A04, cierre sin ETA, cuenta vencida, aislamiento, cancelación, reintentos y rollback de foto incompleta.
- `eta-concurrencia.integration.spec.ts`: dos conexiones PostgreSQL reales. Capturas simultáneas guardan una única promesa. Una publicación espera al bloqueo de cuenta y relee el acceso tras el commit; se comprobó la espera con `pg_blocking_pids`.
- Regresiones: reparto automático, asignación por plan, parametrización de planificación, planificación por plan, proyecciones de reportes, contratos asignados de los tres planes, recorrido de Esencial sin complementos, recuperación histórica, métricas y snapshots.
- Contrato del controlador: permiso de supervisión y resultado de publicación omitida.
- Compilación TypeScript de la API, lint de los archivos de este incremento y `git diff --check`: sin errores.

## Límites de la evidencia

- La retirada de versión durante el cálculo usa una asignación real intercalada dentro del fixture con savepoints. La prueba con conexiones independientes verifica el mismo cerrojo frente al bloqueo de cuenta, no una contratación real de Paddle.
- Las fotos son observaciones del cálculo y no una reserva de agenda. No garantizan que el estado de producción permanezca sin cambios entre su lectura y publicación.
- El cierre sigue siendo best-effort posterior al commit de la OT: esta corrección no agrega una cola durable de reconciliación ni repara masivamente registros antiguos incompletos.
- No hubo navegación visual ni llamadas externas nuevas en este incremento. No se modificaron precios, versiones comerciales vigentes ni contratos de empresas reales.
- A04 continúa marcado como cobertura parcial: este incremento prueba su independencia respecto de ETA y sus umbrales, no todas las combinaciones de informes y permisos.
