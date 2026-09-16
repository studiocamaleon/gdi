# Distribuir entregas — reprogramación asistida

Fecha: 10/09/2026. Estado: diseño de referencia con primer alcance implementado.
[Implementación, validación y límites actuales](visual-ilusion-fase-6-reprogramacion-implementada-2026-09-10.md).
Rama: `codex/f6-entregas-planificacion`.

## Prioridad indicada por el usuario

Se posterga el registro cuantitativo de avances, transferencias internas y
resultados buenos/rechazados. El siguiente objetivo es completar el recorrido de
distribución de entregas: ante fechas que no se alcanzan con la cola actual,
ofrecer cambios concretos sobre otros trabajos, con fechas e impacto calculados,
y ejecutar la alternativa que el usuario elija.

La política se mantiene: N entregas generan N lotes completos. No se retoman las
seis variantes de fabricación descartadas por el usuario. Las alternativas de
este incremento son formas de reprogramar la cola para esas mismas entregas.

El alcance cuantitativo original de F6 queda pendiente, no eliminado ni cerrado.
Este incremento anticipa parte de la replanificación de F11; no exige F5 ni
implementa toda F11.

## Qué hace hoy el sistema

- `prototipo-entregas.ts` simula la carga existente y la distribución nueva. Si
  la inserción desplaza operaciones existentes, vuelve a simular esperando al
  final de la cola de cada recurso. No ofrece cambios sobre esos trabajos.
- `planificacion.service.ts` rechaza adoptar propuestas que desplazan trabajos
  o incumplen fechas. Conserva revisiones, detecta cambios de contexto y congela
  los cálculos por cantidad.
- `fijarIniciosLotes` guarda inicios mínimos de los lotes adoptados. Esos límites
  inferiores no equivalen a reservar ventanas ni a publicar un plan de toda la
  cola. Habilitar el estado `DESPLAZA_TRABAJOS` por sí solo sería insuficiente.
- La geometría por cantidad, sus piezas, capas y copias permanecen congeladas.
  Reprogramar sólo fechas no debe volver a ejecutar el nesting.
- El ETA ya separa fin de producción, fecha sugerida con margen de días hábiles
  y fecha solicitada/comprometida. `prototipo-entregas.ts` distingue `cumple` de
  `cumpleConMargen`; `eta-fechas.ts` diferencia llegar con margen, con margen
  insuficiente y tarde. `sumarDiasHabiles` aplica el margen de seguridad en la
  zona del taller, omitiendo fines de semana y días no laborables configurados.

## Fechas comprometidas y margen de seguridad

**Criterio confirmado por el usuario el 10/09/2026:** las primeras propuestas
deben conservar las fechas de entrega. Las que necesitan cambiar alguna fecha
se presentan como último recurso, con ese efecto explícito.

El margen de días hábiles extra del ETA puede absorber una reprogramación.
Hay que comparar la nueva finalización del producto completo con su fecha ya
comprometida, incluyendo dependencias y consecuencias sobre las demás entregas.
Mover una operación no implica que el fin del producto se mueva en igual medida.
Tampoco corresponde sumar nuevamente todo el margen a ese nuevo fin y reemplazar
automáticamente la promesa vigente por la fecha sugerida resultante.

Entre escenarios que alcanzan las nuevas fechas solicitadas, el orden será:

1. **Entregas sin cambios, con margen:** mantiene todos los compromisos y el
   margen de seguridad configurado.
2. **Entregas sin cambios, con margen reducido:** mantiene todos los compromisos,
   pero consume parte o todo el margen de alguna entrega. Mostrar cuáles y
   cuánto margen les queda; no etiquetar ese caso como entrega atrasada.
3. **Requiere cambiar entregas:** sólo como última opción, muestra cada compromiso
   afectado, su fecha actual, la propuesta y la demora. Cambiar esas fechas forma
   parte explícita de la aceptación del escenario.

Dentro de cada grupo, favorecer mover menos trabajos y producir menor demora.
Mostrar el margen restante y cualquier costo adicional calculable para comparar
opciones. Una menor cantidad de movimientos o un costo menor no anteponen una
opción que cambia entregas a otra que conserva todas las fechas. La evaluación
abarca también las consecuencias indirectas en otros lotes y OT.

Ejemplo ilustrativo sin feriados, con margen configurado de dos días hábiles:

| Producción lista antes | Producción lista propuesta | Entrega comprometida | Resultado |
| --- | --- | --- | --- |
| Miércoles 16/09/2026 | Jueves 17/09/2026 | Viernes 18/09/2026 | Conserva la entrega; queda un día hábil de margen. |
| Miércoles 16/09/2026 | Viernes 18/09/2026 | Viernes 18/09/2026 | Conserva la fecha; queda sin días extra de margen. |
| Miércoles 16/09/2026 | Lunes 21/09/2026 | Viernes 18/09/2026 | No alcanza la entrega; requiere proponer y aceptar otra fecha. |

El margen es protección, no una operación productiva ni un plazo obligatorio de
logística. Consumirlo no habilita omitir operaciones o restricciones reales. Con
datos incompletos de tiempos, recursos o calendario, se mantiene la advertencia
de estimación condicionada; no se presenta el cumplimiento como confirmado.

Los cálculos del margen disponible y las demoras deben usar el mismo calendario
de días hábiles y zona del taller que el ETA. Conservar los instantes de producción
y distinguirlos de las fechas civiles prometidas; no restar milisegundos y
dividir por 24 horas para informar días hábiles.

## Recorrido propuesto

1. El usuario indica las cantidades y fechas de entrega durante la creación de
   OT o en una OT pendiente. El sistema evalúa el caso sin mover trabajos ajenos.
2. Si no cumple, distingue la causa: capacidad ocupada, duración propia,
   calendario/recurso faltante u otra condición. Sólo ofrece resolver moviendo
   trabajos cuando esa intervención podría ayudar. No declara imposible una
   solución sólo porque una búsqueda acotada no la encontró.
3. Acción **Ver opciones de reprogramación**. Calcula escenarios sin modificar
   la planificación vigente. Identifica estación/máquina, operaciones, lotes y
   trabajos cuya movilidad permitiría resolver el conflicto.
4. Presenta pocas alternativas completas, con todas las fechas resultantes y
   todos los trabajos afectados. Primero las que conservan las entregas, mostrando
   si consumen margen; al final las que necesitan cambiar una fecha, según el
   orden definido arriba.
5. El usuario puede excluir trabajos que no desea mover. El sistema recalcula
   con esas restricciones; desmarcar uno no deja habilitada una propuesta que
   dependía de moverlo. No se exige que el usuario construya horarios a mano.
6. **Aplicar esta reprogramación** confirma la alternativa completa, después de
   mostrar sus consecuencias. En una OT emitida pendiente aplica los cambios;
   durante la creación los deja preparados y los aplica junto con la emisión.
   Guardar un borrador o abandonarlo no desplaza la producción de otras OT.
7. El tablero y el ETA reflejan la misma revisión aplicada. Si la carga cambió
   entre cálculo y confirmación, se recalcula y muestra la nueva propuesta;
   nunca se aplica silenciosamente un conjunto de cambios diferente.

## Qué debe mostrar cada alternativa

- Si cumple cada entrega solicitada, fecha de producción lista y margen.
- OT, producto/componente, lote y operación afectados; estación/máquina.
- Inicio y fin actuales frente a inicio y fin propuestos.
- Fecha comprometida, finalización anterior y propuesta del producto/lote
  completo, margen anterior y restante. Distinguir **Entrega sin cambios**,
  **Entrega sin cambios · margen reducido** y **Requiere cambiar entrega**.
- Cambios indirectos en operaciones dependientes y otros compromisos afectados.
- Costo adicional calculado cuando corresponda, y condiciones sin confirmar.
  No etiquetar como cero un impacto económico que el modelo no pueda evaluar.

Reprogramar una operación no cambia por sí mismo la fecha prometida al cliente.
Las opciones que siguen cumpliendo esa fecha deben distinguirse de las que
necesitan modificarla. Para estas últimas, la propuesta muestra explícitamente
la fecha comprometida actual, la nueva fecha sugerida y la demora. El cambio
comercial requiere estar incluido y aceptado en la elección, no ser un efecto
oculto del recálculo. No se envían avisos a clientes automáticamente.

## Primer alcance ejecutable propuesto

- Trabajos internos pendientes, con tiempos y recursos suficientes para evaluar
  las fechas. No interrumpir ni rehacer operaciones iniciadas o terminadas.
- Conservar rutas, dependencias, registros impresión/corte y cantidades por
  entrega. Mantener N lotes aunque cambie su posición en la cola.
- Reprogramar operaciones pendientes de lotes existentes preservando sus IDs,
  fuentes y archivos; no sustituir la OT por una nueva ni duplicar sus costos.
- Mantener fijos los trabajos excluidos. Si una consecuencia obliga a moverlos,
  esa alternativa no puede aplicarse bajo la selección actual.
- No resolver falta de material, aprobaciones, duración o capacidad física
  inventando disponibilidad. Exponer el motivo cuando mover trabajos no alcanza.
- No agregar turnos, horas extras, sustitución de máquinas o consolidación de
  órdenes como efectos implícitos; requieren otros escenarios y costos.

## Contrato técnico necesario

Un escenario debe conservar la versión de cola y calendario usada, el origen de
la cotización, restricciones del usuario, plan antes/después por operación,
proyecciones por entrega y la lista exacta de cambios autorizables. La identidad
de una alternativa incluye esos cambios; un ID de política común no basta para
distinguir dos reprogramaciones.

El motor compartido de ETA necesita representar las restricciones publicadas de
la cola, incluyendo trabajos que no se pueden mover y ocupación de estación y
máquina. No basta con alterar prioridades ni guardar fechas mínimas y asumir que
el próximo recálculo mantendrá los intervalos mostrados.

La búsqueda de escenarios ocurre fuera de la transacción, con presupuesto
acotado, cancelación y reutilización de cotizaciones. Al confirmar se revalidan
estado/versiones bajo una coordinación común con las acciones de producción y
las otras publicaciones. El cambio se aplica de forma atómica: nueva
distribución, operaciones reprogramadas, fechas comerciales expresamente
aceptadas y auditoría. Un conflicto o reintento no puede dejar media cola movida.

Se conserva la promesa y el plan anteriores para explicar qué cambió. La fecha
global de una OT se deriva de la entrega más lejana de sus ítems/lotes; no se
sustituye por el fin aislado de una operación. Las fechas civiles siguen en la
zona del taller y los horarios productivos son instantes.

## Criterios de aceptación

1. Cuatro entregas alcanzables sin cambios: conserva el recorrido actual.
2. Conflicto resoluble moviendo trabajo pendiente dentro de su margen: ofrece
   fechas y pasos concretos, sin cambiar la entrega comprometida de ese trabajo.
   Distingue margen completo, reducido y agotado. No vuelve a agregar el margen
   completo para desplazar automáticamente la promesa.
3. Conflicto que requiere cambiar otra entrega: muestra el atraso y solicita la
   aceptación de esa fecha dentro de la alternativa; no la cambia a escondidas.
4. Excluir un trabajo invalida o recalcula las alternativas que lo necesitaban.
5. Mover un componente considera su incorporación y el cierre del producto.
   Todos los efectos en otros lotes/OT están incluidos en la propuesta.
6. Dos usuarios intentan usar el mismo hueco o un operario inicia un trabajo:
   sólo una revisión vigente se aplica; la otra se vuelve a evaluar.
7. Reintentar aplica una sola vez. Guardar un borrador no mueve otras OT.
8. Después de aplicar, recargar el tablero y recalcular ETA conserva la revisión
   y las restricciones publicadas; ninguna operación ocupa dos veces un recurso.
9. Reprogramar fechas mantiene CAD, cantidades por pieza y balance de cada lote.
10. Si ninguna alternativa evaluada cumple, se explicita qué restricción queda y
    se muestran las mejores fechas encontradas, sin prometer una solución falsa.
11. Si hay una opción que conserva todos los compromisos y otra que cambia una
    entrega, la primera siempre aparece antes, aunque mueva más trabajos o tenga
    mayor costo. El efecto comercial de la segunda queda expresamente indicado.
12. Los casos que cruzan fines de semana, feriados o diferencias entre UTC y la
    zona del taller conservan la fecha comprometida correcta e informan margen
    y demora con el calendario de días hábiles del ETA.
