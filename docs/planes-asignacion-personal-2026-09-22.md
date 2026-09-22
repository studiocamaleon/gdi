# Asignación de personal independiente del plan de ETA · 22/09/2026

## Hallazgos corregidos

1. El reparto automático comprobaba P04 antes de abrir la transacción, pero no dentro de ella. Un cambio de contrato posterior a esa lectura podía dejar pasar un reparto nuevo.
2. El formulario de asignación supervisada y su motor compartido comprobaban ETA (P05), en lugar de su propia función (P04). El botón también dependía de ETA. El editor admitía combinaciones que luego no funcionaban como se ofrecían.
3. El diagnóstico no advertía que quedarían asignaciones de personal sin recálculo automático.

## Contrato operativo

- P04 permite reparto automático y asignación supervisada con simulación. Usa el motor de planificación compartido; no exige comprar P05. Los endpoints públicos de ETA siguen exigiendo P05.
- Los permisos de supervisión siguen siendo obligatorios para proponer y confirmar una reasignación. P04 no concede esos permisos.
- Reparto y confirmación toman el lock de empresa antes de leer el contrato y escribir. La transacción SERIALIZABLE conserva la coherencia de personal, calendarios y tareas. Los conflictos de SQL crudo `40001`/`40P01` se reconocen además de `P2034`: el automatismo reintenta de forma acotada y el formulario pide revisar nuevamente.
- Un checkout pendiente que retira P04 pausa nuevos repartos y rechaza confirmaciones, incluso si venció la revisión comercial. No se considera un error recurrente del scheduler. Otras funciones y ejecución de tareas siguen disponibles.
- Al retirar P04 se conservan personas, franjas, elección del supervisor, referencia prevista y tiempos. Los operarios asignados pueden terminar lo comprometido; un supervisor conserva su ejecución manual. Se detiene el recálculo y se oculta la reasignación avanzada.
- El cambio de plan cuenta pasos abiertos con asignación, explica esta continuidad y exige reconocerla. La huella incluye identidad, estado y contenido de las asignaciones: una modificación invalida el diagnóstico aunque el número de trabajos no cambie.
- Una asignación previa puede quedar en conflicto si cambia el taller. Retirar la función no resuelve ese conflicto ni reasigna personas silenciosamente; por eso el diagnóstico pide revisarlo con el supervisor.

## Evidencia

`asignacion-planes.integration.spec.ts`: **11 pruebas nuevas**, con versiones publicadas y empresas sintéticas dentro de transacciones revertidas en `gdi_saas_test`:

- Esencial, Pro y Avanzado.
- P04 sin P05: reparto, revisión y confirmación; P05 sin P04: ETA habilitada y reasignación denegada.
- Retirada con un operario asignado: conserva responsables y referencia; permite iniciar y completar su tarea.
- Retirada entre control inicial y transacción, tanto en automatismo como en confirmación supervisada.
- Diagnóstico obsoleto después de modificar una asignación, conservando la misma cantidad de pasos.
- Pausa y rechazo de nuevos compromisos ante los estados comerciales `enviando`, `checkout` y `verificar`.

Regresión: **45 pruebas existentes** de reparto automático, asignación supervisada y contratos; **20 recorridos integrales** de planes; **10 pruebas web**, incluidas dos nuevas que verifican el botón de reasignación con P04/P05 opuestos y la conservación del nombre del operario. El bloque de [colas productivas](planes-colas-productivas-2026-09-22.md) se comprobó por separado y nuevamente en los recorridos afectados.

Verificación conjunta final: **136 pruebas API en 11 suites**, incluidas las 60 de colas, y **10 pruebas web**. TypeScript de producción API/web, lint focal y control de CSS aprobados. Las pruebas no emiten avisos a clientes, cobros ni impresiones reales.

Los cambios intercalados de plan usan una conexión y savepoints; no son una carrera nueva entre conexiones PostgreSQL independientes. Las pruebas anteriores sí ejercitan dos repartos simultáneos y permitieron detectar el conflicto SQL crudo. La hora se fija sólo en el contexto de simulación de las pruebas; producción conserva su reloj real.

No requiere migración ni modifica ofertas o contratos de empresas operativas. Faltan los otros bloques indicados en el documento general y la preparación de producción. La comprobación visual del tablero con estos contratos se cubrió por renderizado automatizado; no se cambió el plan del tenant operativo para probarlo en Chrome.
