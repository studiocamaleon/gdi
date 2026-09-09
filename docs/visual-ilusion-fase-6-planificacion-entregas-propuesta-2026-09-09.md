# Propuesta de avance: entregas, lotes y planificación automática

**Fecha:** 09/09/2026. **Estado:** diseño funcional y primer prototipo aislado; implementación operativa pendiente.
**Base:** F4 cerrada e integrada en `visual-ilusion/analisis`.
**Rama de trabajo:** `codex/f6-entregas-planificacion`, creada desde `visual-ilusion/analisis` en `e0baa081c`.
**Decisión de producto:** F5 sigue pendiente hasta que el usuario decida si necesita el Centro de corte. Su alcance no se elimina.

## 1. Resultado de negocio que guía el diseño

El usuario indica cuánto necesita entregar y, opcionalmente, para cuándo. Grafoprint propone una organización productiva, calcula fechas y explica sus limitaciones. La creación manual de lotes no debe ser el requisito para obtener esa propuesta.

Caso principal: una OT, un ítem de 200 exhibidores y cuatro compromisos de entrega de 50. Dos entradas:

- Cantidades conocidas, fechas abiertas: sugerir fechas de entrega con margen.
- Cantidades y fechas solicitadas: buscar una organización compatible y mostrar el resultado por entrega.

**Preferencia confirmada por el usuario:** al pedir fechas, adelantar las primeras entregas y mostrar cualquier costo adicional. Se conserva una alternativa económica para comparar.

Los lotes de entrega representan compromisos comerciales. Los lotes productivos representan cantidades físicas en fabricación. Una agrupación de corte puede abastecer varios lotes de armado y varias entregas, conservando las asignaciones. No se identifican por el mismo ID ni se fuerza una relación uno a uno.

## 2. Qué existe y qué falta

| Base existente, revisada en código | Trabajo pendiente |
| --- | --- |
| ETA con capacidad por estación y máquina, calendarios, dependencias y traza de operaciones | Generar y comparar divisiones de demanda; fechas y viabilidad por entrega |
| ETA en frontend y backend; promesas e históricos por ítem | Un contrato común y un único cálculo autoritativo al confirmar la planificación |
| Recetas y componentes congelados, tiempos/costos cotizados y planes de fabricación persistidos | Construir operaciones por cantidad/lote sin alterar la receta vendida ni duplicar operaciones compartidas |
| Entrega de ítems completos y cierre derivado de la OT | Cantidades parciales del mismo ítem, asignaciones a compromisos y saldos de entrega |

Fuentes: `apps/api/src/eta/motor/flujo-produccion.ts`, `apps/api/src/eta/eta.service.ts`, `src/lib/flujo-produccion.ts`, `apps/api/src/ordenes-trabajo/entrega.service.ts` y F6/F11 del Plan Maestro. Los documentos iniciales de ETA describen etapas históricas; el código actual también contempla DAG y recursos de máquina.

## 3. Diseño y caso de aceptación completo

El [diseño funcional inicial](visual-ilusion-fase-6-entregas-planificacion-diseno.md) desarrolla el recorrido **crear OT → distribuir entregas → obtener propuesta → confirmar OT → ejecutar parcialmente → entregar**. Debe mostrar una propuesta calculable y sus estados; una tabla de fechas aislada no alcanza.

Se debe resolver antes de migrar:

1. Compromiso de entrega: cantidad, fecha solicitada, fecha propuesta, fecha comprometida y cantidades entregadas/pendientes. Cambiar una fecha conserva historia.
2. Lote productivo y asignaciones: identidad, cantidades/unidades, operaciones derivadas de la receta, ubicación y genealogía. No crear nuevas recetas maestras por cada lote.
3. Resultado de planificación: alternativas consideradas, lotes propuestos, operaciones, inicios/fines, recursos, fecha por entrega, impacto económico y supuestos.
4. Adopción: confirmar la OT puede confirmar el plan seleccionado en el mismo recorrido. No se propone un Centro de corte ni una aprobación adicional obligatoria. Una simulación por sí sola no reserva capacidad ni reordena trabajos emitidos.
5. Concurrencia: revalidar la carga al confirmar; dos usuarios no pueden comprometer como exclusivo el mismo hueco de capacidad. Los reintentos no duplican planes, lotes ni cantidades.
6. Ejecución: progreso, gates, entregas, ETA y reportes derivados de cantidades reales; las operaciones compartidas conservan una ejecución y sus participaciones.

## 4. Después del diseño: prototipo de cálculo con datos controlados

Probar el exhibidor con cola, calendarios y tiempos conocidos, sin modificar ventas u órdenes reales. Reutilizar la simulación actual para evaluar un conjunto acotado de alternativas: 200, 100+100, 50+50+50+50 y una división adaptada a la primera entrega. Es un punto de partida para medir, no una afirmación de que esas cuatro opciones cubren todos los casos.

Las cantidades pueden agruparse de distinta manera por operación. El prototipo debe representar las transferencias que permiten empezar el armado antes de terminar todo el corte. Siempre debe respetar piezas y componentes completos necesarios para cada producto.

No dividir mecánicamente el tiempo de 200 entre cuatro. Calcular preparación, ejecución, cambios de herramienta, material, layouts, rendimiento y plazos de terceros según el alcance que realmente tenga cada dato. Para dividir un plan geométrico, usar asignaciones de copias/layouts y sus piezas reales; si hace falta reanidar, tratarlo como un candidato nuevo y mostrar su efecto, sin modificar el snapshot original.

Evaluar prioridades en este orden inicial, sujeto a cerrar el diseño: respetar restricciones y trabajos ya comprometidos; cumplir las entregas; comparar costo/preparaciones y fragmentación; evitar producir excesivamente antes sin necesidad. No mejorar una OT ocultando atrasos provocados en otras.

Resultados posibles, expresados sin certificar un óptimo global:

- Se encontró un plan que cumple las fechas bajo los datos y supuestos indicados.
- Se encontró un plan que llega sin el margen configurado.
- No se encontró un plan que cumpla dentro de la búsqueda; mostrar mejor alternativa y cuello de botella.
- No hay información suficiente para confirmar: tiempos, recursos, aprobación/material o fecha de disponibilidad desconocidos. No convertir el desbloqueo inmediato supuesto por el ETA actual en una promesa firme.

La duración de búsqueda, cantidad de candidatos y política de reutilización deben medirse. Usar cola, cancelación/reemplazo de solicitudes obsoletas y reutilización geométrica cuando corresponda; no lanzar varios nestings intensivos por cada edición del formulario.

## 5. Criterios del primer prototipo

| Caso | Resultado exigido |
| --- | --- |
| 200 exhibidores, cuatro entregas de 50 sin fechas | Fechas sugeridas, lotes y operaciones que expliquen cada fecha |
| Mismas cantidades con fechas alcanzables | Propuesta que cubra las cuatro cantidades a tiempo y respete capacidad compartida |
| Primera fecha demasiado exigente | Mejor fecha/alternativa encontrada y operación limitante; no verde ficticio |
| Falta duración o existe un bloqueo sin fecha | Resultado condicionado o sin estimación, sin inventar disponibilidad |
| División agrega preparaciones o material | Diferencia de tiempo y costo visible antes de confirmar; no alterar silenciosamente el precio vendido |
| 100 en corte abastecen dos armados de 50 | Balance exacto de piezas y transferencias, sin esperar innecesariamente todos los 200 ni duplicar corte |
| Dos propuestas compiten por capacidad | Simulación aislada y revalidación al confirmar, con conflicto detectable |
| OT sin entregas parciales | Experiencia y comportamiento compatibles con la OT actual |

Estos casos validan la propuesta de planificación. El cierre de F6 exige además su alcance original completo: ejecución, división/fusión, resultados buenos/rechazados/scrap, QR, auditoría, entregas, permisos y regresiones.

## 6. Implementación posterior por recorridos completos

1. **Entregas y propuesta:** persistir compromisos, devolver escenarios y presentar fechas/cantidades/impacto en la creación de OT. Cerrar el circuito de confirmación con revalidación.
2. **Lotes ejecutables:** materializar la alternativa adoptada, registrar resultados y transferencias por operación, adaptar dependencias/progreso/ETA y conservar balances.
3. **Entrega y cambios:** entregar cantidades del mismo ítem, conservar saldos, actualizar tracking/reportes y admitir revisiones controladas sobre lo pendiente. Nunca replanificar como nuevo lo ya ejecutado.

El diseño se trabaja en `codex/f6-entregas-planificacion`, creada desde `visual-ilusion/analisis`. La implementación comenzará cuando el diseño y el prototipo permitan fijar contratos; todavía no se implementaron migraciones.

## 7. Relación con el Plan Maestro

- **F6:** conserva todo su alcance cuantitativo original y explicita entregas por cantidad/fecha. La generación automática de lotes forma parte del diseño propuesto.
- **F11:** se propone anticipar el núcleo de escenarios, fechas, capacidad y confirmación necesario para F6. Antes de implementarlo se debe registrar qué contratos se comparten y qué criterios de F11 cubre; no declarar F11 completa ni crear dos planificadores.
- **F5:** sigue pendiente de decisión. Una vinculación futura con planes/tandas del Centro de corte será opcional para los lotes productivos. No se anticipa la consolidación entre órdenes de F5.
- **F9/F10:** reservas físicas, lotes de materia prima y abastecimiento permanecen allí. Mientras no estén disponibles, la planificación debe hacer explícitas sus condiciones de disponibilidad; no promete validar inventario/proveedores que todavía no controla.
- **F7/F12–F14:** calidad/reproceso formal, kits, packing y logística multidestino mantienen su alcance. La entrega básica de cantidades del mismo ítem se resuelve en F6.

La secuencia propuesta es **diseño funcional → prototipo de cálculo → contratos definitivos → implementación de F6 con el núcleo necesario de planificación**. No exige implementar F5 ni toda F11 previamente.

El primer prototipo y sus límites se documentan en el [diseño funcional](visual-ilusion-fase-6-entregas-planificacion-diseno.md). El siguiente bloque técnico es conectarlo con mediciones y particiones trazables del producto real; no se habilitó todavía la planificación de una OT.
