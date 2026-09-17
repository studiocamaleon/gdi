# Fase 4 — revisión final del alcance ampliado, 9 de septiembre de 2026

> **Actualización posterior del 09/09:** H10 corregido y validado con transacciones normales. El estado vigente y las nuevas mediciones están en el [cierre de ampliaciones de F4](visual-ilusion-fase-4-cierre-2026-09-09.md). El dictamen y los fallos que siguen se conservan como evidencia de la auditoría previa a esa corrección.

**Dictamen: NO cerrar todavía las ampliaciones actuales. Un bloqueo funcional reproducido impide guardar y emitir pedidos grandes.** El cierre histórico del 07/09, integrado en `visual-ilusion/analisis`, conserva su evidencia; este informe evalúa la rama `codex/cotizacion-operaciones-herramientas-corte` con los cambios locales posteriores.

No hace falta seguir ampliando el algoritmo hasta demostrar el óptimo global. Hace falta completar un cierre acotado de persistencia y emisión, y luego integrar la rama. F5 es el siguiente frente recomendado, sujeto a resolver ese bloqueo.

## 1. Alcance revisado

| Bloque | Estado y evidencia actual |
| --- | --- |
| F4 original: flujos DAG, ramas, convergencia, gates, reapertura, ETA | Sin regresiones encontradas en la suite general y los recorridos históricos. Se conservan las reglas de ejecución y finalización. |
| F4.1–4.2: bindings, outputs, dimensiones, nodos compuestos, incorporación y componentes anidados | Pruebas generales aprobadas; Backlight histórico vuelve a ejecutarse. El circuito de herramientas cotización→OT y la incorporación opcional forman parte de la regresión actual. |
| F4.3: precio general, mixto y por componente; reportes y facturación | Regresión aprobada. Conciliación comercial, costos variables, producción y tracking en las mismas órdenes de aceptación. |
| F4.4: nesting compartido y planes congelados | Cantidades, posiciones, impresión/corte y lectura posterior se conservan en los ensayos. El volumen del snapshot de 150 revela H10 al usar transacciones normales. |
| Piezas rectangulares/vectoriales, varios archivos, herencia, DXF multipieza y capas | Regresión aprobada; transporte por referencias probado con HTTP y worker reales. Los DXF de 150 se verificaron en la corrección inmediatamente anterior, con sus cinco layouts y capas. |
| Publicación automática | Integración, concurrencia y snapshots históricos aprobados. El precio se vuelve a calcular en una solicitud nueva; sólo la geometría se reutiliza. |
| Herramientas y perfiles de corte desde cotización | Implementación probada para placas y tres operaciones secuenciales, con snapshots y costos. No acredita calibración ni compatibilidad completa con los equipos instalados de Visual Ilusión. |
| GrafoNest: biblioteca, preparación por cantidades, calidad, checkpoints y colas | Regresión aprobada. Puma real vuelve a dar dos placas en tres repeticiones. Los planes conocidos de 50/100/150 conservan 32/64/96 placas y cinco layouts. La evolución de calidad y capacidad industrial sigue teniendo backlog propio. |
| Plantilla de instalación y TAP | Regresión de fuentes, preparación, exportación e interiores aprobada. Se conserva la evidencia operativa de OT-53 del 08/09; no se volvió a enviar ni aprobar un archivo para máquina. |

## 2. H10 — bloqueo de cierre: persistencia comercial y emisión con planes grandes

**Prioridad alta. Reproducido con el resultado real de 150 exhibidores: 1.350 piezas, 96 placas y cinco layouts.**

La cotización asíncrona y el guardado reutilizable de GrafoNest ya funcionan. El problema aparece después, en dos transacciones distintas que siguen usando el límite predeterminado de Prisma de 5.000 ms:

| Operación real | Resultado observado |
| --- | --- |
| `MotorUniversalService.cotizarYGuardar` | `P2028` en `cotizacionItem.create`; 7.086 ms transcurridos dentro de la transacción de 5.000 ms. Retorno completo del intento: 7.592 ms. Cero ítems persistidos tras el fallo. |
| `OrdenesTrabajoService.create` | `P2028` en la creación del ítem hijo durante la materialización; 9.701 ms dentro de la transacción de 5.000 ms. Retorno completo del intento: 11.874 ms. Cero órdenes tras el fallo. |

La segunda prueba prepara primero un snapshot en la base de pruebas para poder examinar la emisión aunque la primera operación falle. Usa el servicio normal de OT y las transacciones normales de Prisma; no modifica la cuenta comercial. La preparación externa de recorridos y las comunicaciones permanecen aisladas por el soporte de aceptación.

El resultado comercial serializado mide **36.616.933 bytes**. Casi todo pertenece al componente: el nesting de impresión ocupa 21.615.010 bytes y el de corte 7.553.626 bytes, además de otros datos del paso. Hay información geométrica repetida en el resultado y en sus proyecciones. El volumen está medido; la distribución exacta del tiempo entre serialización, consultas y transferencia requiere instrumentación al corregirlo.

Puntos de entrada de la corrección:

- `apps/api/src/motor-universal/motor.service.ts`: `cotizarYGuardar`, `recotizarItem` y `buildCotizacionItemData`.
- `apps/api/src/ordenes-trabajo/ordenes-trabajo.service.ts`: creación, materialización de componentes y snapshots de sus pasos.
- `apps/api/test/soporte-recorridos-f4.ts`: complementar el soporte por rollback con aceptación que conserve los límites transaccionales reales.

### Por qué no lo detectaba la regresión general

El soporte histórico introduce una transacción exterior para revertir toda la prueba, y sustituye las transacciones interiores por callbacks sobre ella. Esto es útil para verificar reglas y ausencia de residuos, pero **no comprueba los límites reales de cada comando**.

Con ese soporte, 50 y 100 se ejecutaron correctamente. El recorrido de 150 superó los 60 segundos globales del ensayo. Al ampliar sólo el límite exterior a 180 segundos e instrumentar los callbacks, terminó y concilió cantidades/reportes en 79,7 segundos; el callback de emisión consumió 25,7 segundos. Esto motivó la reproducción anterior con transacciones normales, que confirmó el bloqueo. El ensayo ampliado no se presenta como aprobación de rendimiento ni como solución del problema.

### Cierre acotado propuesto

1. Preparar y serializar los datos pesados fuera de las transacciones de escritura cuando sea posible; evitar devolver grandes JSON en escrituras que sólo necesitan un ID.
2. Reducir duplicación geométrica conservando un contrato inmutable de plan/layout y sus referencias. No referenciar la caché mutable como fuente histórica de una OT ni perder capas, transformaciones, cantidades o herramientas.
3. Definir presupuestos transaccionales explícitos para las operaciones que lo requieran, apoyados en mediciones. Revisar también agregar y recotizar ítems; no arreglar únicamente el botón observado.
4. Reprobar guardar→reabrir→recotizar→emitir→ejecutar para 50/100/150 con límites normales, idempotencia, rollback e importes históricos intactos.
5. Integrar los cambios de la rama en `visual-ilusion/analisis` y pasar el gate acumulado sobre esa integración.

**No se implementó esa corrección productiva durante esta revisión.** Se documenta para que el cierre siguiente tenga un alcance concreto y comprobable. El arreglo anterior de `NestingsGuardadosService` no resolvía estas otras transacciones.

## 3. Resultado de las verificaciones

| Control | Resultado y límite |
| --- | --- |
| API general | 276 suites, 2.451 pruebas y 10 snapshots aprobados. 11 pruebas omitidas en la corrida general. |
| Web general | 86 archivos, 738 pruebas aprobadas después de corregir una expectativa antigua de “patrón”. |
| Catálogo histórico opt-in | 5/5: exhibidor 1/10/50/51 y Backlight → persistencia → OT → ejecución → reportes/tracking. 80,7 s. Usa soporte con rollback exterior. |
| Catálogo actual ampliado | 50/100 aprobados con el soporte anterior; 150 aprobado en el ensayo exterior ampliado, pero bloqueado con transacciones normales: H10. |
| HTTP y worker opt-in | Aprobado contra Redis efímero separado. Se actualizó la expectativa de reutilización de ID: una nueva cotización recalcula precio. El nuevo job también se espera y verifica. |
| Motor irregular real | Puma: fixture geométrico y tres repeticiones de producción aprobadas (4/4), 14,9 s en total. |
| CAD Python | 12/12 aprobadas. |
| Migraciones | 229/229 aplicadas tanto en desarrollo como en `gdi_saas_test`; sin pendientes ni fallidas. Esto es comprobación de estado, no un nuevo ensayo de restauración/despliegue. |
| CSS y diferencias | Aprobados. No se modificó CSS ni componentes de interfaz en esta revisión. |
| Build | Se conserva el build API aprobado en la corrección inmediatamente anterior; esta revisión cambió sólo dos pruebas y documentación. No se repitió un build Next ni una revisión visual completa. |

De las once omisiones generales se ejecutaron aparte los cinco casos de catálogo y las tres búsquedas reales de Puma. Los tres benchmarks opt-in de placa/rollo no se repitieron. Tampoco se ensayó carga de producción multiempresa, cuotas físicas CPU/RAM, ni máquinas/controladores reales.

Los dos tests de diagnóstico de H10 completan correctamente su reproducción, pero su resultado de negocio es **fallido**. No sumarlos como recorridos funcionales aprobados.

## 4. Qué no debe mantener abierta F4

| Pendiente | Destino propuesto |
| --- | --- |
| Óptimo geométrico global, generación dirigida, mayor corpus de rendimiento | Evolución continua de GrafoNest. No es un requisito adicional automático de F4. |
| Cuotas físicas de CPU/RAM, presión de memoria, carga prolongada multiempresa | Infraestructura/endurecimiento antes de despliegue industrial o de ampliar concurrencia. |
| Plan genérico con revisión, aprobación/liberación, cola de corte y vínculos print/cut/TAP | F5. `NestingGuardado`, biblioteca y checkpoints son reuso de cálculo; no reemplazan el ciclo operativo. Ya existe `RecorridoVectorialRevision` con estados: F5 debe integrar esa base, no duplicarla. |
| Consolidación entre órdenes, asignaciones por trabajo y ejecución del plan | F5. Los lotes compartidos actuales se limitan al producto y sus ámbitos. |
| Lotes físicos, parciales, buenas/rechazadas/scrap, división y fusión | F6, apoyada en contratos de F5. |
| Calidad formal y reproceso; reservas y movimientos físicos | F7 y F9, respectivamente. |

### Límite del piloto de maquinaria

Se volvió a ejecutar el diagnóstico de funciones de herramientas. Permanecen las limitaciones documentadas: un perfil por tipo de operación dentro de un nodo, exterior obligado a corte completo, ausencia de módulos/adaptadores físicos y falta de un perfil de salida ligado al controlador.

Ejemplos que todavía requieren ampliar el contrato: dos recorridos de hendido con recetas distintas, medio corte de vinilo sin atravesar el soporte, o validar que la herramienta elegida pueda montarse en un alojamiento concreto. No se conocen aún las variantes y accesorios exactos de las Vega ni el software y configuración instalados. No se debe prometer compatibilidad industrial completa a partir de sus nombres.

Estas capacidades se proponen como primer bloque técnico previo a liberar el piloto de F5, manteniendo **operaciones, herramientas y estimación económica desde la cotización**. El Centro de corte recibe esa receta congelada y registra sus cambios operativos; no inventa por primera vez costos después de vender.

## 5. Próxima fase recomendada

Una vez corregido H10 e integrada la rama, continuar con **F5: Centro de corte**:

1. Confirmar un circuito real de Visual Ilusión y definir las relaciones recorrido→receta→herramienta→salida. Cotizarlo y reimportar sus archivos con el operador. No requiere soportar todos los accesorios de todas las máquinas.
2. Reabrir el plan cotizado, revisarlo, aprobarlo y liberarlo a una máquina con archivos y trazabilidad. Una revisión posterior conserva la versión vendida y la ejecutada.
3. Agregar la consolidación entre órdenes compatibles y medir diferencias planificado/real.

Ejemplo: un exhibidor ya se cotiza con sus piezas y operaciones. F5 permite al taller decidir qué revisión fabricar, en qué mesa y con qué archivo, registrando quién lo liberó. Después F6 permitirá que 40 exhibidores estén terminados, 60 en armado y 50 aún en corte sin marcar falsamente toda la OT como finalizada.

## 6. Cambios y evidencia conservada

Esta revisión modificó únicamente dos pruebas desactualizadas:

- `src/components/comercial/geometrias-vectoriales-cotizacion.test.tsx`: texto “layout”.
- `apps/api/src/motor-universal/__tests__/fuentes-http.integration.spec.ts`: nueva cotización tras un cálculo completado; espera y verifica su resultado.

La rama está tres commits por delante de `visual-ilusion/analisis`, además de los cambios locales sin commit de GrafoNest y artefactos ajenos que deben separarse al preparar la entrega. No se hizo commit, push ni merge durante esta revisión.

Evidencia: `output/revision-final-fase-4-2026-09-09/`. Incluye logs generales, capturas de cotización, diagnóstico de máquinas, tamaños, migraciones, arneses y `transacciones-reales-150.json`. Los archivos temporales usados dentro de `apps/api` se retiraron; se conservaron sus fuentes en esa carpeta. El tenant temporal y el Redis efímero se eliminaron. No se crearon propuestas ni OT en la cuenta de desarrollo.
