# Producción por colas, tandas e intervenciones del operario

**Fecha:** 11/09/2026. **Estado:** antecedentes de análisis.

**Decisión posterior:** el usuario simplificó el alcance y autorizó comenzar. El [plan vigente de colas y tandas v1](produccion-colas-tandas-v1-2026-09-11.md) registra la primera cola por máquina implementada y las siguientes entregas. Las propuestas de recomendación geométrica de este análisis quedan para otra etapa.

**Actualización del 11/09/2026:** incorporadas las respuestas del usuario a las ocho preguntas. Para el punto 5 se conserva el registro del trabajo incompleto, explicación y autor, bloqueando su etapa siguiente. El usuario propone agregar un porcentaje aproximado para estimar el tiempo pendiente en el ETA. Se recomienda un único campo de porcentaje faltante, referido al trabajo original, con proyección explícitamente orientativa. No se registran unidades ni copias producidas. El recorrido y los límites de cálculo se desarrollan en la sección 12. La identificación sigue siendo el nombre de orden impreso junto al archivo, fuera del sistema. No se implementa el reemplazo con esta actualización.

El usuario autorizó retirar los simuladores existentes y analizar su reemplazo. La eliminación se registra al final. Este documento consolida lo observado en el código, lo confirmado por el usuario y las hipótesis que todavía debemos contrastar con el taller.

**Continuación:** [propuesta de implementación y UX](produccion-colas-tandas-implementacion-y-ux-2026-09-11.md), con pantallas, contratos, integración ETA, entregas de desarrollo y criterios de validación. Sigue siendo un diseño para revisión; no publica el reemplazo.

**Anchos de rollo:** el usuario plantea recuperar la recomendación de ancho que ofrecían los simuladores. Se incorpora al diseño de Preparar tanda: comparar el mismo conjunto de trabajos listos en los anchos compatibles, proponer el mejor aprovechamiento calculado y permitir elegir otra opción antes de confirmar. El consumo corresponde al acomodo propuesto y no demuestra qué se ejecutó finalmente en el RIP. Ver sección 3.2.1 de la propuesta de implementación.

**Compatibilidad y placas rígidas:** la [investigación de tandas, materiales y geometría](produccion-compatibilidad-tandas-y-geometria-auditoria-2026-09-11.md) amplía el recorrido a formatos de placa/pliego y separa pertenecer a una tanda de poder cambiar un layout. Incluye perfiles/capas, corte registrado, imposición, demanda por lote y 44 casos de aceptación. La agrupación simplificada del boceto no es una especificación suficiente. Esta revisión continúa siendo análisis; no implementa el reemplazo.

## 1. La necesidad operativa

El objetivo es que las personas sepan qué producir, con qué archivos, en qué equipo y en qué orden, con pocas decisiones repetitivas. La organización debe reflejar cómo se trabaja realmente: una impresora puede procesar varias OT en una tanda y una persona puede atender varias máquinas.

Un listado por persona, con una tarjeta por paso de cada OT, dejaría al impresor la tarea de reconstruir esas tandas. Una cola por máquina, aislada del resto, tampoco resolvería cuándo esa misma persona debe preparar, recargar o retirar trabajos de otra máquina.

La hipótesis a evaluar es **una organización común del trabajo, presentada por máquina, por persona y por fechas**. Estas vistas deben compartir la asignación, el estado y las dependencias.

## 2. Confirmaciones del usuario

| Tema | Confirmado |
| --- | --- |
| Forma de imprimir | Se imprimen archivos separados de forma consecutiva y también se combinan trabajos en una misma placa o rollo. |
| Responsable de la tanda | El propio impresor confirma sus integrantes. |
| Composición de archivos | Se realiza en el RIP de la máquina. No se confirmó ninguna integración automática entre el RIP y Grafoprint. |
| Trabajo elegible | Sólo archivos de operaciones LISTAS para imprimir, con características compatibles e imprimibles juntos. Se excluye el trabajo meramente proyectado. Vinilo blanco y vinilo glitter no pertenecen a la misma tanda. |
| Traspaso al proceso siguiente | El impresor marca la impresión de la tanda como completada y eso libera los ítems participantes hacia sus siguientes etapas. No se requiere una recepción adicional por este flujo. |
| Falla de un integrante | Se permite liberar los trabajos terminados y dejar pendiente el afectado. La excepción debe conservar la identidad y el estado de cada integrante. |
| Impacto sobre compromisos | Se permite una agrupación que perjudique compromisos sólo de forma explícita, mostrando el impacto y registrando quién la autorizó. |
| Identidad de las salidas | Hoy se imprime el nombre de la orden junto al archivo, fuera del sistema. Se conserva ese procedimiento como referencia; no se requieren nuevas etiquetas, QR ni registros por este análisis. |
| Registro parcial | Identificar el trabajo que quedó incompleto y dejar una explicación; registrar automáticamente usuario y momento. Mantenerlo pendiente y bloquear su etapa siguiente. El usuario propone un porcentaje aproximado para el ETA; se recomienda indicar cuánto falta, sin pedir unidades ni copias producidas. |
| Elección de ancho de rollo | El usuario solicita analizar su incorporación al flujo de tanda para evitar que el impresor compare anchos manualmente. La propuesta lo sitúa antes de confirmar, con recomendación, alternativas, disponibilidad y consumo estimado. |
| Simuladores | Eliminar ahora los módulos de gran formato e impresión láser; analizar antes de construir el reemplazo. |
| Diseño | Dos personas que también atienden impresoras láser. |
| Gran formato | Una persona compartida entre UV, ecosolvente y DTF UV. |
| Taller | Dos personas con el mismo horario; una colocación puede ocupar a una o a ambas. |
| DTF textil | Se produce los jueves. |
| Tiempos | Derivados de cotización y perfiles. No agregar un campo de minutos de atención ni permitir escribir duraciones arbitrarias en el Gantt. |
| Entregas | Conservar los lotes completos por entrega y mostrar el impacto de cambios en nesting, costo y fechas. |
| Registro físico detallado | Unidades buenas/rechazadas/entregadas permanecen postergadas. No introducirlas indirectamente sin acordar el alcance. |

Esperar al final de la tanda es el comportamiento normal confirmado para este taller; se admite la excepción ante la falla de un integrante. La confirmación del impresor basta para liberar lo completado, sin un paso adicional de recepción. Cada operación siguiente conserva sus otros requisitos: que la impresión esté lista no elimina dependencias de otros componentes, documentos o materiales. Que todos los tenants deban trabajar igual sigue abierto.

## 3. Qué existe hoy y qué falta

### Hechos revisados antes del retiro

- Gran formato reunía pasos de impresión por área que podían ejecutarse según sus dependencias. Agrupaba por tecnología/material y comparaba anchos mediante el motor de nesting.
- Impresión láser reunía pasos por hoja, con compatibilidad de máquina, variante de papel, gramaje, pliego de impresión, color y caras.
- Ambos podían completar varios pasos en una acción. El resultado se asentaba en cada paso; no se creaba una tanda general persistente con inicio, integrantes, entregas internas y versión de archivos.
- En gran formato, los planes conservados se excluían del reacomodo y aparecían como tarjetas que abrían la OT. El backend también rechazaba reacomodar planes registrados, vectoriales o de placas. Esa protección cuidaba el vínculo impresión/corte, pero separaba el recorrido de trabajo.
- Por eso hay una fragmentación verificable en el código. No se reprodujo en esta revisión un error concreto de todas las pantallas ni se atribuye toda falla a la implementación de layouts.
- F4 conserva operaciones compartidas entre componentes de un mismo producto; F6 materializa lotes de entrega con rutas y geometría propias. Eso no equivale a una tanda general entre distintas OT.
- El ETA modela máquinas, puestos manuales, equipos humanos, calendarios y fases atendidas/autónomas. La reserva humana indica cuántas personas se necesitan; todavía no asigna una identidad individual a cada intervención.
- «Mi mesa» muestra trabajo tomado o iniciado por el usuario. No constituye una asignación automática de toda su jornada.

### Consecuencia

Podemos reutilizar la base de producción y planificación. La ampliación central sería dar identidad y reglas a la tanda, conectarla con los pasos que abastece y derivar desde allí las intervenciones humanas. El algoritmo de nesting es una capacidad dentro de ese recorrido.

## 4. Distinguir las unidades de trabajo

| Concepto | Qué representa | Ejemplo |
| --- | --- | --- |
| OT e ítem | Pedido y producto comprometidos comercialmente | 200 exhibidores. |
| Lote de entrega | Cantidad del producto con su fecha y ruta | Lote A: 50 exhibidores para el jueves. |
| Operación | Trabajo necesario para avanzar esa ruta | Imprimir las piezas del lote A. |
| Layout | Geometría que se puede repetir, con su revisión | Layout A, 25 copias. |
| Tanda de máquina | Trabajo reunido para ejecutar y transferir como conjunto | Varias impresiones compatibles de las OT 54, 56 y 58. |
| Intervención | Momento en que se necesita una persona | Preparar material, cargar una placa, retirar piezas o hacer un armado. |
| Cola | Secuencia de tandas o intervenciones pendientes | Próximas tandas de la UV; próximas intervenciones del impresor. |

Una tanda puede contener operaciones de distintos lotes y OT sin fusionar sus compromisos. Un lote puede necesitar varias tandas y máquinas. En esta etapa, una operación que no se terminó conserva su identidad y queda pendiente de completar, con una explicación. No se modela su reparto cuantitativo entre tandas ni se genera un saldo de unidades producidas/faltantes.

Una copia del layout no representa automáticamente una unidad del producto final.

## 5. Tres niveles distintos de agrupación

### A. Ejecutar archivos consecutivos

Se reúnen archivos existentes de trabajos compatibles. Cada archivo mantiene sus posiciones, cantidad de copias e identidad. Se ahorran decisiones y eventualmente cambios de configuración.

Ejemplo: tres trabajos láser con el mismo papel y formato pasan seguidos por la misma impresora. Agruparlos no demuestra por sí solo que todas sus preparaciones se hagan una sola vez: puede seguir existiendo una preparación de archivo por trabajo, carga por pila o calibración específica.

Este nivel podría apoyarse en operaciones completas y layouts ya aprobados, sin habilitar todavía el reparto físico de una operación entre tandas.

### B. Combinar trabajos en un nuevo layout

Se combinan físicamente trabajos compatibles en una placa o rollo. El usuario confirmó que hoy esa composición se hace en el RIP de la máquina. La cola de Grafoprint puede identificar los trabajos y cantidades de la tanda sin conocer sus nuevas coordenadas. Que se haya confirmado la tanda no demuestra que Grafoprint haya recibido el layout generado por el RIP.

La recomendación de ancho agrega un cálculo previo de acomodo en Grafoprint. Permite comparar consumos propuestos entre anchos compatibles sin integrar automáticamente el RIP. El resultado conserva geometría e identidades de la propuesta; no acredita la composición real externa. Comparar superficie consumida y cobertura completa de trabajos evita elegir un rollo sólo por su menor largo o por excluir piezas que no entran.

Ejemplo: llenar espacios de una placa con piezas de dos OT. La tanda debe conservar qué aporta a cada OT/lote. Si Grafoprint debe además representar esa composición, generar su corte o calcular consumos exactos desde ella, necesitará el resultado verificable del RIP, con la correspondencia entre posiciones, piezas y copias, y una revisión operativa.

Si después se corta por registro, la geometría y las referencias utilizadas por impresión y corte deben corresponderse. No se pueden reutilizar automáticamente las coordenadas de los archivos anteriores si el RIP las cambió. Queda por relevar cómo se conserva esa correspondencia en el taller: layouts completos con sus marcas, un flujo print/cut del RIP u otro procedimiento. No se presupone que todos los trabajos de gran formato requieran corte por registro.

### C. Unir el traslado al proceso siguiente

Es la regla confirmada: terminar de imprimir una OT dentro de una tanda no la habilita inmediatamente para corte si el taller transfiere toda la tanda junta.

Este nivel puede acompañar tanto archivos consecutivos como un layout mixto. Antes del cierre conjunto puede haber trabajos físicamente impresos que aún esperan al resto. En el flujo confirmado, marcar la tanda completada libera sus integrantes; no se agrega otra confirmación de traslado. La espera anterior al cierre debe reflejarse en el ETA, sin inventar tiempo de impresión o atención humana.

## 6. Recorridos para contrastar

### Recorrido 1 — Láser: varias OT, archivos separados

1. El operador abre su equipo de trabajo y elige la impresora física por su nombre.
2. Ve una propuesta: tres OT listas, mismo papel/pliego/configuración. También ve la entrega más próxima y trabajos excluidos con su motivo.
3. El propio impresor revisa los integrantes y confirma la tanda. Cada archivo conserva sus copias; la tanda deja de incorporar trabajos automáticamente. Si la agrupación afecta compromisos, ve el impacto y se registra la autorización explícita.
4. Prepara la máquina y organiza/envía los archivos desde el RIP. Una descarga o confirmación en la aplicación no equivale a que el RIP haya recibido o terminado el trabajo.
5. Cuando termina la tanda, confirma la impresión del conjunto. Si hubo un problema, identifica qué trabajo no se terminó, deja una explicación e indica el porcentaje faltante aproximado para el ETA. El usuario y el momento se registran automáticamente, sin pedir unidades producidas.
6. Esa confirmación libera los trabajos hacia sus procesos posteriores, sin exigir una recepción adicional. Cada OT sigue su propia ruta; una puede necesitar guillotina y otra laminación. Si falló un integrante, se permite liberar los terminados y mantener pendiente el afectado.

**Confirmado:** el impresor confirma la tanda y su terminación. Queda por definir si él mismo puede autorizar un impacto sobre entregas o si ese permiso corresponde a otro responsable; confirmar una tanda y autorizar una demora son decisiones diferentes.

### Recorrido 2 — UV y ecosolvente con un solo impresor

1. Se arma una tanda UV con layouts conservados. La ecosolvente tiene otra tanda, con su material y configuración.
2. La agenda del impresor le indica preparar y cargar la UV.
3. Durante la operación autónoma de la UV puede preparar la ecosolvente, siempre que termine esa atención antes de la siguiente recarga o retiro requerido por la UV.
4. La persona consulta una agenda común de intervenciones. Las colas de ambas máquinas muestran los mismos compromisos desde cada equipo.
5. Si una impresión se demora, se revisan las intervenciones pendientes. No se confirma automáticamente una recarga porque llegó la hora estimada.

La espera conjunta corresponde a los integrantes de cada tanda. No debemos hacer que toda la producción de dos máquinas espere a terminar el turno del impresor.

### Recorrido 3 — Rollo combinado de distintas OT

1. El sistema identifica trabajos realmente listos y compatibles. Un vinilo blanco no se agrupa con uno glitter aunque ambos puedan procesarse en esa impresora.
2. En Preparar tanda el sistema compara los anchos admitidos para esos integrantes, recomienda uno y muestra consumo/aprovechamiento del acomodo propuesto. El impresor puede ver alternativas y revisa el efecto previsto en entregas antes de confirmar. No se anuncia ese cálculo como ahorro real de una composición del RIP que el sistema desconoce.
3. El impresor organiza los archivos en el RIP. Grafoprint conserva las referencias de archivo, OT/lote y cantidades de la tanda. La representación de una geometría modificada y su corte asociado requieren una correspondencia verificable, todavía por definir.
4. Se imprime y se identifica la salida. Al marcar la impresión completada, se liberan los integrantes al siguiente proceso.
5. Cada trabajo conserva sus siguientes pasos: no necesariamente todos pasan por la misma cortadora o terminación. Ante una falla se puede liberar lo terminado y dejar pendiente el trabajo afectado.

**Confirmado:** la mezcla se hace en el RIP. **Pendiente:** qué resultado puede volver a Grafoprint y cómo se mantiene la correspondencia print/cut cuando corresponde. La capacidad de organizar una cola no implica una integración automática con cada RIP.

### Recorrido 4 — Exhibidores con cuatro entregas

1. La OT conserva los lotes A, B, C y D de 50 unidades, cada uno con su fecha.
2. La cola propone tandas de impresión teniendo en cuenta esos compromisos y sólo con operaciones listas. Esperar al lote D y perjudicar la entrega de A exige mostrar el impacto y registrar una autorización explícita; no puede ocurrir silenciosamente por ahorrar una carga.
3. Los layouts de A se ejecutan con las copias necesarias para cubrir todas sus piezas. Pueden acompañarse de otra OT compatible si no se compromete su salida.
4. Al terminar esa tanda, se libera el material de A a corte usando su revisión de geometría.
5. El armado requiere el conjunto de componentes del lote. Que se hayan impreso muchas placas no demuestra que se puedan armar 50 exhibidores.

**Ejemplo simplificado de balance, ajeno al nesting actual:** un producto necesita 1 cuerpo y 4 estantes. Un layout contiene 10 cuerpos y 4 estantes; otro, 36 estantes. Cinco copias del primero dan 50 cuerpos y 20 estantes: alcanzan para 5 productos. Al agregar cinco copias del segundo se llega a 50 cuerpos y 200 estantes, suficientes para 50 productos de este ejemplo.

Esto exige conservar el balance por tipo de pieza del plan de fabricación. Ese control de lo planificado no implica pedirle al impresor un recuento de producción real. Si informa que la impresión quedó incompleta, el paso sigue pendiente y sus sucesores permanecen bloqueados hasta que confirme haberlo terminado. La nota no permite deducir cuántas placas, piezas o exhibidores están disponibles; el reparto cuantitativo y la liberación parcial dentro de una misma operación quedan fuera de esta etapa.

### Recorrido 5 — Router, corte láser y guillotina

- Router o láser: cola por máquina concreta, orden de layouts, copias, material/espesor, herramienta y archivos pertinentes. Si el layout proviene de impresión, se conserva el registro.
- Guillotina: puede tener tandas de pilas o trabajos que comparten preparación, pero la persona permanece ocupada durante la operación atendida.
- El tratamiento de la atención sigue la configuración de cada máquina. Mostrar una cola de máquina no vuelve autónoma su operación.
- La compatibilidad depende de la tecnología y la operación: mismo material no demuestra que dos trabajos compartan herramienta, fijación, recorrido o preparación.

### Recorrido 6 — DTF los jueves

1. Los trabajos listos se agrupan para una ventana del jueves.
2. Lo que aún espera aprobación o material se conserva en Planificación como trabajo previsto, con su condición pendiente; no se ofrece como integrante elegible de la tanda.
3. Al confirmar la tanda queda definida su composición. Los trabajos nuevos no alargan indefinidamente una tanda iniciada.
4. Si no entra todo en la capacidad del jueves, el sistema debe mostrar qué quedaría fuera y el impacto en sus entregas. No prometer capacidad ilimitada por compartir día de producción.

Queda por acordar qué sucede con un urgente que llega después del cierre de la tanda. La preferencia debe ser visible, no una regla inferida sólo del calendario.

### Recorrido 7 — Diseño, armado y colocaciones

El trabajo sin máquina puede mostrarse como tareas o grupos de tareas. Armado también puede beneficiarse de tandas; la presencia de una máquina no es el único criterio para agrupar.

Dos diseñadores comparten diseño e intervenciones de impresoras. Los dos operarios de taller comparten corte, armado y colocaciones. Una colocación de dos personas debe reservar a ambas y aparecer coordinada en sus agendas; una de una persona deja a la otra disponible.

Por eso no conviene excluir de la vista personal toda actividad relacionada con maquinaria. La preparación de una impresora también es trabajo de una persona.

## 7. Cómo podría verse, sin decidir todavía nuevas pantallas

**Cola por máquina:** tanda actual, próximas tandas confirmadas y propuestas compatibles. Dentro: OT/lote, archivos, layouts/copias, material, condición de disponibilidad y proceso siguiente.

**Trabajo del operario:** intervención actual y próximas intervenciones en las máquinas que atiende, junto con sus tareas manuales. Puede entrar al detalle de una tanda sin volver a buscarla en otra pantalla.

**Planificación:** muestra las tandas, ocupación humana y entregas proyectadas por el mismo motor. Permite entender el impacto de cambiar el orden o agrupar; una revisión se confirma mediante el mecanismo de reprogramación correspondiente.

«Centro de producción» puede ser un nombre de navegación para reunir estas vistas. Antes de crear otra entidad configurable conviene comprobar si las estaciones, máquinas y equipos actuales ya alcanzan. No se debe duplicar una estación ni confundir esta organización con los centros de costo.

La máquina concreta sigue identificada por su nombre e ID. Dos impresoras del mismo tipo pueden tener capacidades y calendarios distintos. Cambiar de una a otra exige revisar compatibilidad y tiempos derivados; no basta mover una tarjeta.

## 8. Condiciones para que la agrupación ayude

1. **Disponibilidad real:** sólo operaciones listas pueden integrar la tanda, con documentos, materiales y predecesores satisfechos según sus requisitos. El trabajo futuro permanece en Planificación; una fecha estimada no lo vuelve elegible. La disponibilidad debe revalidarse al confirmar y antes de ejecutar si cambió el contexto.
2. **Compatibilidad física y de proceso:** variante, formato, espesor/gramaje, caras, color/perfil, orientación, registro, máquina, herramientas o fijación según corresponda. No todas estas variables son requisitos de todas las tecnologías.
3. **Entregas:** medir el impacto de esperar una tanda completa. Si la agrupación perjudica compromisos, mostrarlo y exigir una autorización explícita con identidad del autorizante. Esta autorización no convierte materiales incompatibles o trabajos bloqueados en imprimibles juntos.
4. **Composición estable:** una tanda confirmada o en curso no agrega integrantes por un refresco de pantalla.
5. **Sin duplicar trabajo:** una operación no puede quedar comprometida en dos tandas activas a la vez. La doble confirmación concurrente debe revalidarse en el servidor. Retomar una impresión incompleta conserva la operación y su historial; no crea otra demanda por la cantidad original.
6. **Sin ciclos:** una agrupación no puede introducir esperas circulares entre pasos que dependen unos de otros. El vínculo de liberación conjunta también debe validarse con las dependencias.
7. **Identidad física:** distinguir qué sale y a quién pertenece. El taller imprime el nombre de orden junto al archivo, fuera del sistema. La futura cola debe permitir reconocer esa misma referencia y conservar internamente la relación archivo/OT/ítem/lote. No se incorpora un nuevo proceso de etiquetado. Para varias salidas de una misma OT, se deberá comprobar con un ejemplo que la referencia actual permite distinguirlas sin confusiones.
8. **Trabajo incompleto:** se permite liberar los integrantes terminados y mantener pendiente el afectado. Se identifica el trabajo y se registra una explicación con usuario y momento; el porcentaje faltante aproximado sirve para el ETA, sin recuento de unidades. Sus sucesores siguen bloqueados hasta confirmar la terminación. La misma excepción cubre una impresión que no llegó a empezar, indicando que falta el 100 %.

## 9. Impacto en ETA, costos y progreso

### Tiempo productivo

La tanda debe ocupar la máquina y las personas una sola vez por el trabajo efectivamente compartido. Sus miembros no pueden seguir reservando esas mismas horas de forma independiente.

Tampoco es válido tomar siempre el mayor tiempo de los integrantes ni descontar automáticamente todos los setups. Algunos tiempos son comunes a la tanda, otros pertenecen a cada archivo, copia, carga o cambio de herramienta. Se derivan de los perfiles y de la composición validada.

La espera conjunta debe reflejarse en el inicio de los sucesores. Si el trabajo A termina de imprimir antes que B pero ambos se entregan juntos, A espera sin que eso represente más minutos de impresión.

La cola ejecutable y la previsión del ETA tienen horizontes distintos: la primera sólo reúne trabajos ya listos; el ETA sigue proyectando también los pasos futuros. Una sugerencia de agrupación futura no puede convertirse por sí sola en una tanda confirmada. Las tandas confirmadas deben incorporarse al mismo motor, manteniendo el resto de las operaciones pendientes en la proyección.

Si la composición exacta sólo existe en el RIP, el ETA necesita mostrar la base de su estimación y sus límites. No se infieren ahorro de material, eliminación de preparaciones o minutos exactos de la nueva geometría por el simple hecho de agrupar; se conserva la estimación disponible hasta disponer de una revisión derivada y verificable.

Una nota de impresión incompleta por sí sola no determina cuánto trabajo falta. Con la nueva propuesta, el impresor declara un porcentaje faltante aproximado y el ETA puede estimar la carga pendiente sobre los tiempos originales derivados de la operación. El porcentaje se aplica a la parte variable del trabajo; las preparaciones que deban repetirse y los cierres pendientes se consideran por separado. No se multiplica toda la duración original por el porcentaje ni se descuenta dos veces el avance. La sección 12 detalla esta estimación.

La duración resultante se programa con disponibilidad real, calendarios de máquina y equipo humano, fases atendidas/autónomas y dependencias. Una carga estimada de 45 minutos no implica terminar dentro de 45 minutos de reloj. La nueva fecha se presenta como orientativa y basada en el porcentaje declarado, sin modificar automáticamente la fecha comprometida. Queda por precisar la política de preparación al retomar y cómo tratar una reanudación bloqueada, por ejemplo por falta de material, sin agregar campos de duración al impresor.

### Precio y revisión operativa

La cotización permanece como referencia de lo vendido. Si una consolidación cambia geometría, consumos o tiempos previstos, debe quedar como revisión operativa explicable. No se altera silenciosamente el precio de venta ni se reemplazan archivos ya ejecutados.

El usuario confirmó que una agrupación puede perjudicar compromisos, con autorización identificada. Para que el registro sea interpretable, se propone guardar también momento, tanda/revisión, trabajos y fechas afectadas antes/después; el motivo y el rol habilitado siguen por acordar. Aceptar el impacto productivo no cambia por sí solo la fecha prometida al cliente: ese cambio debe seguir siendo explícito y distinguible de la proyección.

### Progreso

Terminar impresión no completa corte, armado ni entrega. El avance por OT/campaña debe atribuir a cada integrante sólo el trabajo que le corresponde, sin sumar a todas las OT la duración íntegra de una tanda común.

Puede haber operaciones terminadas esperando traslado. Ese estado debe poder explicarse aunque el porcentaje de trabajo haya avanzado. No implica que existan unidades terminadas disponibles para entregar al cliente.

Una operación con impresión incompleta no cuenta como hecha. Se muestra su condición, explicación y porcentaje faltante declarado como estimación para el ETA; ese valor no se suma como progreso confirmado de la OT/campaña. Las otras operaciones que sí se completaron siguen aportando su avance habitual. No se convierte el porcentaje en unidades buenas, rechazadas o disponibles para entregar.

## 10. Relación con las fases del Plan Maestro

La decisión **DM-005** ya separa lote productivo y tanda de máquina. La hipótesis de este documento es compatible con ella.

F5 contempla planes persistentes, revisiones, liberación y consolidación entre órdenes. Un centro general de producción retomaría parte de esas capacidades para varias tecnologías. Con la mezcla en el RIP, debemos distinguir la gestión de la tanda y sus integrantes de la gestión geométrica de un nuevo plan: se puede estudiar la primera sin prometer que Grafoprint generará o conocerá el layout externo. Si se incorpora esa geometría al sistema, siguen siendo necesarios sus controles de revisión y trazabilidad.

F6 aporta entregas y rutas por lote. Una futura liberación parcial por copias de layout requeriría ampliar el seguimiento de asignaciones físicas, hoy postergado. F11 aporta el marco más amplio de planificación.

Esto no declara iniciada F5 ni modifica el alcance aprobado de F6. Primero corresponde decidir los recorridos y la unidad mínima que queremos ejecutar y transferir.

## 11. Límites de la primera versión a discutir

Una alternativa acotada sería organizar tandas de **operaciones completas listas para imprimir**, confirmar sus integrantes y liberar juntas sus salidas, con la excepción acordada para trabajos fallidos. La composición puede realizarse en el RIP; Grafoprint no necesita generar un nuevo nesting para registrar esa agrupación.

El usuario añade la ayuda de elegir el ancho. La propuesta de implementación amplía la preparación con una evaluación geométrica de la misma demanda en varios anchos; sirve para recomendar y conservar una opción antes de ejecutar. El registro de la tanda y la generación de un nuevo archivo de impresión/corte siguen siendo capacidades distintas. Un pendiente declarado sólo por porcentaje no proporciona geometría suficiente para optimizar su remanente.

El límite de esa alternativa es que no conocería automáticamente la nueva geometría ni podría producir un corte registrado o un ahorro exacto a partir de ella. Para trabajos con layouts vinculados a corte hay que definir cómo se conserva su correspondencia antes de declarar el recorrido cubierto. El registro de trabajo incompleto usa estado, nota y un porcentaje aproximado para estimar tiempo: no incluye cantidades físicas parciales ni habilita a avanzar una parte del mismo trabajo. La implementación del reemplazo sigue pendiente de un plan aprobado.

Tampoco basta agrupar visualmente tarjetas: si la tanda afecta el horario o la liberación, debe existir en el modelo que usa el ETA y en las acciones de producción.

Para escala SaaS, conviene consultar colas con datos resumidos y cargar el CAD al abrir el layout. Las copias deben referenciar geometría compartida. Reordenar una cola no debería recalcular nesting ni descargar toda la geometría de todas las OT.

## 12. Respuestas y decisiones pendientes

Se conserva la numeración de las preguntas para seguir la conversación.

| Nº | Pregunta | Respuesta / estado |
| --- | --- | --- |
| 1 | ¿Quién confirma los integrantes? | **Confirmado:** el propio impresor. |
| 2 | ¿Dónde se combinan los archivos? | **Confirmado:** en el RIP de la máquina. La integración y la correspondencia print/cut quedan por relevar. |
| 3 | ¿Qué constituye una tanda? | **Confirmado:** trabajos LISTOS para impresión, con las mismas características relevantes y compatibles. No entran los meramente proyectados. Vinilo blanco y glitter se separan. |
| 4 | ¿Cómo se libera el trabajo? | **Confirmado:** el impresor marca la impresión completada; esa acción libera los ítems de la tanda hacia sus siguientes etapas, conservando los demás requisitos de cada ruta. |
| 5 | ¿Cómo se registra que una operación quedó incompleta? | **Confirmado:** indicar trabajo y explicación, registrar usuario y momento, mantenerlo pendiente y bloquear su etapa siguiente. **Ampliación propuesta por el usuario:** porcentaje aproximado para estimar el tiempo en el ETA. Se recomienda un solo campo de porcentaje faltante. Unidades y copias producidas siguen fuera de alcance. |
| 6 | ¿Qué sucede si falla sólo un integrante? | **Confirmado:** permitir liberar los trabajos completos y mantener pendiente el afectado mediante la excepción del punto 5. |
| 7 | ¿Se permite una agrupación que perjudique compromisos? | **Confirmado:** sí, con impacto explícito y registro de quién autorizó. Falta definir qué rol puede autorizarlo. |
| 8 | ¿Cómo se identifica la salida? | **Confirmado:** se imprime el nombre de orden junto al archivo, fuera del sistema. Mantener ese procedimiento y referencias reconocibles en la cola. No se prescribe etiqueta, QR ni escaneo. |

### Decisión del punto 5 — impresión incompleta y porcentaje orientativo para el ETA

**Criterio confirmado por el usuario:** el registro debe funcionar aunque las piezas, placas, metros o copias no representen de manera simple lo que imprimió el operario. Se identifica qué trabajo no está completo, se deja una explicación y se conserva pendiente su etapa siguiente. La propuesta de informar cantidades impresas y saldos quedó descartada. El usuario propone ahora informar un porcentaje aproximado para alimentar el ETA; la recomendación es pedir únicamente cuánto falta del trabajo original. Se documenta el comportamiento; no se implementa todavía.

Como texto de interfaz se propone **«Impresión incompleta»**. Describe el paso afectado sin dar a entender que ya existen unidades del producto terminado. El nombre definitivo del estado técnico pertenece al diseño de implementación.

#### Caso habitual: se imprime todo

1. El impresor confirma los trabajos listos y compatibles que integran la tanda y los procesa desde el RIP.
2. Al terminar, usa **«Completar tanda»**. La vista deja claro qué trabajos está confirmando como completos, sin pedir una carga de cantidades.
3. Se completan sus operaciones de impresión y se liberan las etapas siguientes que tengan satisfechas todas sus dependencias.

La terminación depende de esa confirmación del impresor; no se deduce del horario estimado ni del envío del archivo al RIP.

#### Excepción: no se imprimió todo

Una tanda contiene la impresión del lote A de exhibidores de una OT y un trabajo de vinilos de otra. La impresión de los exhibidores quedó incompleta; los vinilos están terminados.

1. Al cerrar, el impresor elige **«No se imprimió todo»**.
2. Marca el trabajo de exhibidores, indica **«Falta aproximadamente: 30 %»** y escribe una explicación, por ejemplo: **«Se terminó el material; falta completar la impresión. El archivo está preparado en el RIP.»**
3. Guarda el resultado. La identidad del usuario, la fecha, la máquina y la tanda salen del contexto; no debe volver a ingresarlas.

Se puede señalar más de un integrante incompleto. Cada uno conserva su porcentaje y explicación; una misma nota puede describir un problema común, sin repetir campos innecesarios. Antes de guardar se distingue cuáles se declaran completos y cuáles quedan pendientes. El campo de porcentaje sólo aparece en esta excepción, sin sumar una carga al cierre normal.

| Trabajo de la tanda | Resultado registrado | Etapa siguiente |
| --- | --- | --- |
| Impresión del lote A de exhibidores | Impresión incompleta; falta aproximadamente 30 %, con explicación y autor | Bloqueada por esa impresión pendiente |
| Impresión de vinilos | Impresión completada | Habilitada si cumple sus demás requisitos |

El sistema cierra esa ejecución de la tanda con pendientes identificados. No declara completadas todas sus operaciones. Si un integrante no llegó a imprimirse en absoluto, puede indicar que falta el 100 % de su impresión mediante la misma excepción.

No se pide cuántas unidades salieron, cuántas faltan, cuántas copias de cada layout se imprimieron ni cuánto material se desperdició. El porcentaje es una apreciación del trabajo de impresión pendiente, no un recuento verificable de piezas. Las cantidades comerciales y las del plan de fabricación se conservan como referencia original; no pasan a ser cantidades de producción real.

#### Un único porcentaje, con una referencia clara

- **Campo recomendado:** «Falta aproximadamente: __ %», con la ayuda «Del trabajo de impresión original. Se usa para estimar el tiempo pendiente».
- Se propone un entero de 1 a 100 mientras el trabajo quede incompleto. Para declarar que no falta nada se usa «Completar impresión», con su confirmación explícita, en lugar de liberar etapas al mover un porcentaje.
- Si se muestra cuánto se completó, se deriva como complemento del mismo valor y se rotula como aproximado; no se ingresan dos números ni se cambia de criterio entre pantallas.
- El porcentaje siempre refiere a la operación original identificada por OT, ítem y lote, no a toda la tanda ni a lo que faltaba en el último intento. Si antes faltaba 30 % y luego 10 %, queda 10 % del original; no 10 % de aquel 30 %.
- Se conservan autor, momento y la referencia de cálculo de cada declaración. Una corrección puede aumentar o reducir el faltante sin borrar el historial ni tratarlo como producción física medida.

#### Cómo alimenta el ETA

La estimación separa la parte variable pendiente de los tiempos fijos aún necesarios:

**Tiempo pendiente aproximado = tiempo variable original × porcentaje faltante + preparación necesaria para retomar + cierre pendiente.**

**Ejemplo ilustrativo, no medición del taller:** una impresión tenía 120 minutos de producción variable, además de su preparación y cierre. Si el impresor indica que falta aproximadamente el 30 %, se estiman 36 minutos de producción. Si al retomar corresponden 10 minutos de preparación y 5 de cierre según los perfiles, la carga pendiente aproximada es de **51 minutos**. No se descuentan proporcionalmente esos tiempos fijos.

El motor mantiene la distinción entre máquina y personas: las fases atendidas reservan al equipo; la operación autónoma se trata según la configuración de la máquina. Las recargas o cargas dependientes de ciclos requieren una aproximación coherente con sus perfiles; el porcentaje no revela cuántas placas o ciclos físicos faltan. Cuando no exista un desglose utilizable, se señala la limitación en lugar de presentar una precisión inexistente.

La nueva reserva sustituye la estimación pendiente anterior de esa operación, sin sumarla otra vez ni descontar además el mismo avance por tiempo transcurrido. Los tiempos comunes de una tanda tampoco se repiten por cada integrante. El motor conserva los demás trabajos, colas, calendarios y dependencias para proyectar el final.

La interfaz debe mostrar algo como **«Tiempo pendiente: ~51 min · Estimado según el porcentaje informado por el impresor»**, junto con la fecha orientativa que resulte de la planificación. Estimar 51 minutos de carga no garantiza empezar ahora ni resolver una falta de material. La estimación no cambia la duración cotizada, la cantidad comercial ni la fecha prometida.

#### Qué queda visible y cómo se retoma

- El trabajo afectado se muestra como **«Impresión incompleta · Falta ~30 %»**, con su nota, autor, momento del registro y tiempo pendiente aproximado cuando pueda calcularse.
- Se identifica la operación concreta por OT, ítem y lote cuando corresponda. No se marca toda la OT ni otros lotes como incompletos por asociación visual.
- Corte o terminación que dependan de esa impresión permanecen bloqueados. El registro no habilita a avanzar sólo una parte de ese mismo trabajo.
- El impresor puede retomar el pendiente consultando la nota y el archivo en el RIP. La propuesta es una acción **«Retomar impresión»** sobre el mismo trabajo, conservando el vínculo con la tanda anterior. Falta definir su presentación dentro de la cola y su programación, sin introducir cantidades.
- Al terminarlo efectivamente, confirma **«Completar impresión»** y se liberan sus sucesores según las demás dependencias. Se conserva quién informó el problema y quién confirmó su resolución, con sus momentos respectivos.

Retomar no debe reenviar automáticamente el archivo completo al RIP, duplicar la demanda inicial ni crear un saldo inventado. El sistema conoce que el trabajo está pendiente; el operario conserva el criterio sobre lo que falta imprimir físicamente. Si vuelve a quedar incompleto, puede registrar otra explicación manteniendo el historial.

#### Responsabilidades del sistema y límites

- Guardar juntos el resultado de la tanda, las notas, los porcentajes declarados con su base de cálculo y los estados de sus integrantes. Un reintento de guardado no duplica cierres ni libera dos veces una operación.
- Evitar que un trabajo pendiente se tome simultáneamente en dos tandas activas. Conservar su identidad aunque se retome en otra ejecución.
- Mantener el bloqueo por dependencia hasta la confirmación explícita de impresión completa. No extenderlo a trabajos independientes que ya terminaron.
- No sumar avance parcial arbitrario a la OT o campaña. La operación afectada sigue sin contar como hecha.
- Conservar la cotización, cantidades, archivos y geometría aprobada. Una nota no recalcula el nesting, cambia el precio ni genera un reproceso cuantificado.
- Reproyectar el pendiente usando el porcentaje declarado y los tiempos derivados, separando los tiempos variables de las preparaciones y cierres. Mostrar su carácter orientativo. La política de preparación al retomar y el tratamiento de impedimentos de reanudación siguen por precisar, sin sumar campos de minutos al impresor.

Este recorte permite registrar por qué un trabajo no puede avanzar y aportar una estimación de carga pendiente al ETA. El control de unidades producidas, rechazos, saldos y liberaciones parciales permanece fuera de esta etapa. El porcentaje no completa una operación ni demuestra que una parte del producto esté disponible para la etapa siguiente.

### Respuesta del punto 8 — nombre de orden junto al archivo

El usuario confirmó que hoy se imprime el nombre de orden junto al archivo y que eso se hace fuera del sistema. Se conserva ese procedimiento como forma de identificar la salida. La cola debe mostrar referencias de orden y archivo reconocibles por el impresor y mantener su relación interna con ítem/lote.

No se propone agregar etiquetas, códigos QR, escaneos ni una confirmación de identificación. En un ejemplo con varios ítems o lotes de la misma OT habrá que comprobar que el nombre y el archivo permiten distinguirlos; esto no invalida el procedimiento confirmado ni autoriza reemplazarlo.

Próximos puntos de análisis: precisar la preparación y disponibilidad para retomar una impresión incompleta, con el porcentaje como estimación orientativa; cómo se conserva la correspondencia impresión/corte desde el RIP; y quién puede autorizar un impacto sobre entregas. El registro por trabajo con nota y autor y la identificación del punto 8 se conservan; no se vuelve al recuento de unidades producidas.

## 13. Retiro de los simuladores

Autorizado expresamente por el usuario el 11/09/2026.

Se retiran las páginas de gran formato e impresión láser, sus entradas de navegación, componentes, clientes API, estilos exclusivos, DTO y endpoints de consulta/reacomodo. Se retira también la acción de completar múltiples pasos que usaban exclusivamente esos módulos, con su cálculo de ahorro asociado. Las acciones normales de las OT continúan disponibles.

Se preservan:

- Motores de nesting y cálculo de cotización.
- Planificación, ETA y calendarios.
- Ejecución por operación y operaciones compartidas de productos compuestos.
- Materialización de lotes de entrega y sus dependencias.
- Lectura de snapshots operativos utilizada para preparar recorridos de corte.
- Visores de layouts, previsualización de recorridos y descargas de fabricación desde las OT.
- Registros históricos de ahorro y tiempos ya asentados; no hay borrado de datos ni migración de esquema.

Los tests específicos de las pantallas y endpoints retirados dejan de aplicar. Se conservan las comprobaciones útiles del motor de rollo y de las fronteras ejecutables en sus módulos correspondientes. Las pruebas de componentes anidados y persistencia de geometría verifican ahora directamente el snapshot operativo, sin depender de una pantalla retirada.

Durante este intervalo, la ejecución se realiza desde las OT y el tablero existente. Todavía no hay un nuevo centro ni una nueva cola por tandas.

### Referencias de código y antecedentes

- [Diseño histórico de gran formato](simulador-impresion-diseno.md) y [láser](simulador-laser-diseno.md).
- [Plan Maestro: F5, F6 y DM-005](visual-ilusion-plan-maestro.md).
- [Equipos compartidos](produccion-equipos-compartidos-2026-09-10.md) y [operación de máquina](produccion-operacion-maquina-2026-09-11.md).
- [Lotes ejecutables por entrega](visual-ilusion-fase-6-lotes-ejecutables-2026-09-09.md).
- [Motor de capacidad humana](../apps/api/src/eta/motor/capacidad-humana.ts), [motor de flujo](../apps/api/src/eta/motor/flujo-produccion.ts) y [agrupación del Gantt](../src/lib/planificacion-vista.ts).
- [Snapshot operativo](../apps/api/src/produccion/snapshot-paso-produccion.ts) y [ejecución de OT](../apps/api/src/ordenes-trabajo/ordenes-trabajo.service.ts).

### Validación del retiro

- Web: **890 pruebas aprobadas**, en 100 archivos. Se eliminaron las seis pruebas exclusivas de las dos pantallas retiradas.
- Backend: **96 pruebas aprobadas** en la regresión enfocada; cinco casos optativos omitidos por sus condiciones de ejecución. Incluye estaciones/equipos, parametrización de planificación, fronteras, ejecución concurrente de lotes, componentes anidados, geometría y progreso. No se presenta como una ejecución de toda la suite del repositorio.
- TypeScript web/API, compilación API y build de producción web: correctos. El build web completo se validó en una copia de QA.
- Lint de los archivos web modificados: correcto. Control CSS: correcto; se quitaron 1.120 líneas de estilos exclusivos sin agregar clases globales.
- Las cuatro rutas API retiradas devuelven **404** en el servidor reiniciado, incluyendo consulta de ambos simuladores, reacomodo y completar múltiples pasos.
- Navegador: ambas páginas retiradas muestran 404. Planificación conserva las 11 OT/40 operaciones actuales; el sidebar ofrece Tablero, Planificación y Estaciones. La OT 0054 sigue cargando su producto de 200 unidades y avance de 1%, con sus cuatro lotes.
- No se modificaron datos de las OT existentes ni se ejecutaron acciones productivas durante la revisión del navegador.

[Evidencia local de compilación, pruebas y rutas](../output/retiro-simuladores-2026-09-11/).
