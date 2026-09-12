# Preparar tanda: comparación de producción y entregas

> **Sustituido el 11/09/2026:** el usuario retiró las tandas sugeridas y su preparación. El alcance vigente es [Colas: consulta y completado múltiple](produccion-colas-completar-seleccion-2026-09-11.md). El contenido siguiente se conserva como antecedente de diseño.

Implementado el 11/09/2026. Esta entrega completa la **revisión previa** del efecto de agrupar. No crea, inicia ni cierra tandas reales. Se suma a la [base de ejecución atómica](produccion-ejecucion-atomica-2026-09-11.md).

## Comportamiento visible

Después de seleccionar trabajos compatibles y abrir «Preparar tanda», el operador ve:

- Identidades de las OT, productos y lotes, material, formato, color y layout conservados.
- Fin estimado de cada impresión y momento en que se liberaría el conjunto.
- Producción lista con la cola actual y con la tanda, junto a la fecha comprometida.
- Qué entregas usan margen disponible, cuáles ya estaban en riesgo y cuáles se demorarían por la agrupación.
- Otras OT afectadas aunque no integren la tanda. Los componentes se agrupan bajo la entrega comercial de su producto o lote, sin multiplicar compromisos.

No se ofrece un botón que simule haber iniciado producción. «Revisar de nuevo» vuelve a consultar el estado vigente; «Cerrar revisión» cierra el modal.

## Reglas de simulación

1. Los archivos elegidos se secuencian en la misma máquina. La tanda ocupa el lugar del primer trabajo seleccionado, en el orden de entregas usado por la preparación.
2. Trabajos que podían hacerse antes conservan su lugar. No se interrumpe una operación en curso ni se intercalan nuevos archivos dentro del conjunto.
3. Se conservan los calendarios, días no laborables, reservas publicadas, preparaciones y todas las duraciones individuales. No se acredita ahorro ni se supone una preparación única.
4. Las operaciones de otras máquinas pueden coincidir durante el tiempo autónomo, respetando el equipo humano compartido y sus maniobras.
5. Los sucesores de cualquier integrante esperan al último archivo. Un producto cuyo último paso sea la impresión también espera esa liberación conjunta.
6. La espera se añade sólo al escenario; no modifica las dependencias guardadas ni duplica operaciones o carga.
7. Una selección de un solo trabajo usa exactamente la simulación actual, sin introducir cambios artificiales por reconstruir su posición.

Las dos alternativas comparten reloj y datos. Los instantes se muestran en la zona del taller, con año; la fecha comercial se conserva como fecha sin conversión UTC.

## Entregas y margen

Se compara el fin de **toda la producción pendiente** del producto/lote con su fecha comprometida. Un contenedor sin pasos propios no cuenta como una operación sin estimación; sus componentes determinan la finalización. Un ítem manual sin ruta ni componentes sí conserva la incertidumbre.

- Si la producción sigue terminando dentro de la fecha comprometida, se mantiene esa entrega. Si el margen configurado ya no cabe completo, se señala «Usa margen disponible».
- Si agrupar posterga la producción más allá de la entrega, se señala el compromiso y una fecha a revisar, incorporando el margen configurado. No se guarda esa fecha.
- El riesgo previo y el efecto de agrupar se informan por separado. Si el atraso existía, siempre se muestra «Ya estaba en riesgo», incluso cuando la tanda lo agrava. En ese caso se agrega «La tanda agrava el atraso»; si lo reduce o conserva, se explica esa diferencia. Un compromiso que recién queda afectado muestra «La tanda pone la entrega en riesgo».
- Una duración, recurso o bloqueo incierto no se convierte en garantía de entrega. Se identifican resultados orientativos y comparaciones sin estimación.

Ejemplo determinista de prueba: el viernes se imprime A de 09:00 a 10:00 y B hasta las 14:00. La terminación de A necesita siete horas. Por separado termina el viernes a las 17:00; esperando la tanda, termina el lunes a las 12:00. Un compromiso para el viernes queda afectado. Si era para el lunes, la producción todavía cabe y utiliza margen, conservando esa fecha.

## Implementación y tamaño

- Ruta `POST /produccion/tandas/:maquinaId/revision`, permiso `produccion.ver`, tenant de sesión y UUID de máquina. DTO existente: 1–50 UUID únicos.
- Una lectura `RepeatableRead` reúne disponibilidad, configuración, contexto ETA y estructura comercial. El cálculo de ambas simulaciones ocurre **después** de cerrar esa transacción.
- Se rechaza la selección completa si contiene integrantes inexistentes, ajenos o de otra máquina. Si hay incompatibilidad o gates pendientes, no se calcula una alternativa engañosa.
- El contexto de revisión no hace backfill, no modifica pasos/OT y no lee snapshots de geometría para recuperar tiempos históricos. Si falta la demanda humana congelada, conserva el supuesto conservador del ETA y su señal orientativa.
- Se devuelve el resumen, hasta 50 comparaciones y los trabajos seleccionados. Los contadores contemplan todas las entregas evaluadas. No se devuelve la traza completa del taller, precios ni CAD.
- El módulo de tandas está separado de Producción porque ETA ya depende de Producción; no introduce una dependencia circular con Órdenes de Trabajo.
- El motor sin la opción interna de tandas conserva su comportamiento previo. El espejo del navegador incorpora la misma regla y tiene prueba de paridad.

## Evidencia

50 pruebas de backend y 74 de frontend, incluidas las regresiones ejecutadas. Entre las nuevas: secuencia/liberación, producto terminal, máquina ocupada, otra OT afectada, margen, atraso previo, datos ausentes, fechas publicadas, feriados, atención humana y operación autónoma en paralelo. Seis integraciones PostgreSQL verifican lectura sin mutaciones, aislamiento, configuración bloqueada, producto con componentes, ausencia de backfill/CAD y cuatro revisiones concurrentes.

TypeScript de frontend y API, lint focalizado y guardia CSS. En Chrome autenticado se revisó el Lote A de OT-2026-0054 y se repitió la consulta; muestra el atraso que ya existía sin atribuirlo a la preparación de un único trabajo. No se modificó ninguna orden real. El modal mantiene la composición visual de Colas y permite desplazar el contenido con el pie de acciones visible.

Medición local del cálculo puro: **1.000 operaciones**, tanda de **50 integrantes**, tres comparaciones completas de **1.006 / 1.248 / 759 ms**; resumen de impacto de **22.124 bytes**. Excluye SQL, HTTP y concurrencia real; no certifica capacidad SaaS de la ruta. La integración de dos trabajos comprueba una respuesta menor a 16 KB sin CAD ni costos.

## Próximo tramo pendiente

### Corrección de riesgo previo (11/09, revisión de la captura de las 20:16)

Antes, la categoría `afecta_entrega` reemplazaba a `ya_en_riesgo` cuando un atraso previo empeoraba. La fila conservaba las fechas correctas, pero ocultaba el antecedente. Ahora la respuesta incluye `riesgoPrevio` y `riesgoConTanda` independientes de la categoría; los contadores distinguen riesgos nuevos y atrasos agravados. El riesgo previo sigue contándose aunque la tanda mejore el plazo.

Las regresiones reproducen los tres ejemplos de la captura: OT-2026-0050 (08/09 comprometido, producción 15/09 → 17/09: riesgo previo y agravado); OT-2026-0059 (23/09, producción 22/09 → 24/09: riesgo nuevo); OT-2026-0054/Lote A (17/09, producción 23/09 → 18/09: riesgo previo reducido). Se verifica también cruzar la fecha comprometida por segundos, sin perder el efecto porque el cambio redondeado en minutos dé cero.

Validación focalizada de esta corrección: 28 pruebas de API (incluidas seis integraciones y cuatro regresiones de nesting de rollos) y ocho de interfaz. Son una ejecución adicional, no una suma de pruebas nuevas a la evidencia anterior.

Pasaron TypeScript del frontend y de producción API (`tsconfig.build.json`), lint de los archivos modificados y `css:guard`. El chequeo de tipos global de API, que incluye todas las pruebas, reporta 98 errores en 40 archivos de otras suites y utilidades de prueba; ninguno corresponde a los archivos cambiados en esta corrección. No se certifica ese chequeo global como aprobado. Detalle local de esa ejecución: `/tmp/gdi-tanda-riesgo-types-20260911.log`.

### Ejecución y nesting

Persistir tanda e integrantes y conectar los comandos reales al núcleo atómico: inicio idempotente, cierre conjunto, excepciones con nota/autor/porcentaje aproximado y remanente para ETA. Antes de publicar un inicio habrá que revalidar la revisión bajo bloqueos, registrar aceptación de los compromisos afectados e impedir que una acción individual eluda el cierre de una tanda activa. La revisión implementada no autoriza ni confirma esas acciones.

La solicitud de incorporar nesting entre OT con distintos anchos se desarrolla en la [propuesta acotada de nesting para tandas](produccion-tandas-nesting-acotado-2026-09-11.md). Sigue siendo una propuesta; la corrección de etiquetas no habilita nuevas compatibilidades ni modifica geometrías.
