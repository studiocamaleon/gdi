# Producción → Planificación: renovación del Gantt

Actualización: la asignación automática por máquina y la configuración exclusiva de pasos sin máquina están implementadas. Ver [criterio vigente, compatibilidad y pendientes](produccion-estaciones-asignacion-2026-09-10.md).

Fecha: 10/09/2026. Estado: primera renovación visual de consulta implementada. Reprogramación general y asignaciones individuales pendientes.

Actualización del mismo día: se implementó una base de [equipos compartidos y demanda de las fases del proceso](produccion-equipos-compartidos-2026-09-10.md) en el ETA de navegador y API. Resuelve capacidad humana compartida entre estaciones, sin asignar personas o puestos individuales. La configuración de los equipos reales requiere calibración. El usuario pidió avanzar con una estética shadcn moderna, tomando como referencia su [dashboard](https://ui.shadcn.com/examples/dashboard); se implementó la primera vista de consulta descrita al final del documento.

## Decisiones de producto

El usuario propone una vista amplia de planificación, con modos **Por recursos** y **Por órdenes**, estaciones desplegables en puestos y reprogramación manual con revisión de impacto. Las tres capturas aportadas son referencias visuales; sus datos de demostración, horarios y controles no definen reglas del sistema.

**La duración nace en la cotización y se muestra como dato de lectura.** El Gantt permite proponer cuándo fabricar; no permite estirar una barra, cambiar minutos, alterar la receta ni cambiar de máquina para conseguir otra velocidad sin recotizar.

Para entregas parciales se conserva la decisión de F6: fabricar por entrega, con lotes capaces de completar las unidades comprometidas. Mover una operación no vuelve a distribuir piezas, cambiar layouts ni recalcular nesting.

## Comparación con el sistema actual

| Aspecto | Gantt actual | Renovación propuesta |
|---|---|---|
| Ubicación | Originalmente pestaña Simulación; ahora solo en Planificación | Página Planificación que utiliza el espacio disponible; acceso desde Producción |
| Agrupación | Carriles por estación y una agenda de proyección | Dos vistas del mismo plan: recursos y órdenes |
| Filas | Subfilas de 26 px, etiquetas pequeñas | Recursos de aproximadamente 72–80 px; tareas de 52–60 px, ajustadas con datos reales |
| Puestos | Capacidad simultánea y subfilas visuales por solapamiento | Estación desplegable en puestos identificados por el plan |
| Órdenes y lotes | Color por OT, foco de recorrido por lote | OT → producto → lote → operaciones/componentes; resumen, cantidad y entrega visibles |
| Color | Una tinta por OT y contornos de atraso | Superficies neutras de shadcn, selección oscura, dependencias atenuadas y riesgo diferenciado; estados con texto e icono |
| Dependencias | Recorrido del lote seleccionado y aristas de predecesores | Conservar relaciones reales, mostrando por defecto las de la selección |
| Calendario | Eje laboral comprimido, zoom y feriados reales | Reutilizarlo; cabecera y columna izquierda fijas, navegación por período |
| Intervención | Inspección y reproducción de decisiones del motor | Panel lateral de detalle, propuesta de movimiento, impacto y publicación |
| Fechas de entrega | Riesgo y fechas en detalle | Hitos de entrega por lote y fin de la OT; distinguir producción lista y compromiso comercial |
| Controles | Replay y decisiones del scheduler ocupan el encabezado | Búsqueda, período, zoom, filtros y estado del plan; diagnóstico técnico secundario |

Verificación local del 10/09: la vista contiene 19 ítems, 33 pasos programados y siete carriles, incluidos los lotes A–D de OT-0054. Estos números describen el conjunto consultado, no una prueba de capacidad o de exactitud global del ETA.

## Qué reutilizamos y qué falta

### Base existente

- `src/components/produccion/simulacion-view.tsx`: transforma la traza en barras, carriles, selección y dependencias.
- `src/lib/simulacion-flujos.ts`: identifica el flujo de un lote y evita mezclar los otros lotes de la OT.
- `src/lib/eje-laboral.ts`: convierte fechas a posiciones según calendarios laborales, zona horaria y días no laborables. No debemos sustituirlo por la semana fija 9–19 de la referencia.
- `src/lib/flujo-produccion.ts` y su equivalente en API: calculan capacidad y dependencias. La vista actual simula en el navegador; el escenario publicable debe tener autoridad en backend.
- F6 ya tiene evaluación de reprogramación, comparación de compromisos, bloqueo por empresa, comprobación de vigencia, aplicación transaccional e idempotencia. Su alcance actual es una revisión de distribución de entregas.

### Brechas que condicionan la implementación

1. **Una subfila dibujada no equivale a un puesto asignado.** Hoy `fila` se calcula para evitar solapamientos gráficos; el motor utiliza una lista de disponibilidades concurrentes sin devolver una identidad estable de puesto. Antes de ofrecer «Puesto 1/Puesto 2» como asignación real, la traza debe identificar dónde reservó capacidad.
2. **No existe un editor general de agenda.** Los contratos de reprogramación de F6 están asociados a planes de entregas. Hay que extraer capacidades compartidas y ofrecer un contrato general por operación; no crear una distribución ficticia para poder mover una tarea.
3. **Falta la conversión inversa del eje laboral.** Arrastrar requiere convertir una coordenada a una fecha válida. Debe probarse en saltos de fin de semana, feriados, varias franjas, cambios horarios y calendarios diferentes entre estaciones.
4. **La lectura debe ser coherente con la publicación.** El tablero actual refresca ítems periódicamente y calcula la simulación local. Para publicar, se necesita una revisión verificable de tareas, reservas, recursos, calendarios, compromisos y hora de cálculo del servidor.
5. **Capacidad incompleta no es disponibilidad confirmada.** Las operaciones sin recurso, calendario o duración fiable deben permanecer visibles con su causa. Las dependencias normales de un flujo futuro no deben mostrarse como un bloqueo de material.

## Experiencia prevista

### Por recursos

Una fila resumen por estación, con carga del período. Se podrá desplegar cuando tenga varias máquinas o puestos. Las tareas se mostrarán una sola vez en su recurso asignado; el resumen de estación agregará la carga sin volver a contabilizar las tareas.

Una máquina física y un puesto humano son restricciones distintas: una tarea puede necesitar ambos. Se mostrará un recurso principal en el carril y los recursos adicionales en el detalle. No se debe crear capacidad extra porque una máquina aparezca en dos agrupaciones.

Los puestos necesitarán una identidad estable para poder mostrar y conservar asignaciones. Un modelo persistente ligado a estación es una hipótesis de diseño, pendiente de analizar antes de implementar o migrar datos. Una máquina existente conserva su identidad de `Maquina`; no se duplica como otra máquina. La relación entre ambos tipos de recurso se definirá antes de cualquier migración, con pruebas de capacidad compartida entre estaciones.

### Reparto automático entre puestos: análisis previo, todavía sin implementar

**Corrección de alcance del usuario, 10/09/2026:** primero analizar el reparto equitativo y luego implementar la asignación automática. La reasignación manual entre puestos queda para una etapa posterior. Esta revisión no modifica el motor ni asigna tareas reales.

El motor actual calcula el primer momento libre de la estación y ocupa el puesto cuya disponibilidad es más temprana (`servers`, `ocupar`). Con empate conserva el primer índice. Esto es una aproximación de capacidad disponible; no compara carga acumulada ni devuelve el puesto elegido en la traza. Las subfilas gráficas tampoco representan esa asignación.

**Criterio recomendado para evaluar:** equidad de carga laboral entre puestos compatibles, subordinada a las entregas y dependencias. Contar tareas por sí solo puede repartir mal el trabajo.

Ejemplo ilustrativo, con dos puestos equivalentes, ambos libres y el mismo horario, y cuatro tareas independientes:

| Reparto | Puesto 1 | Puesto 2 |
|---|---|---|
| Dos tareas para cada uno | 6 h + 2 h = 8 h | 2 h + 2 h = 4 h |
| Carga equilibrada | 6 h = 6 h | 2 h + 2 h + 2 h = 6 h |

El segundo reparto termina antes y distribuye mejor las horas. Es un resultado deseable para este caso, no una garantía de que una regla voraz encuentre siempre el mejor reparto. Con tareas indivisibles, reservas o dependencias, las cargas pueden quedar diferentes y seguir siendo correctas.

Reglas propuestas, en orden:

1. Considerar puestos habilitados y compatibles con la operación, su máquina y calendario. Dos puestos no permiten usar simultáneamente una misma máquina física de capacidad uno.
2. Conservar la prioridad de entregas y la elegibilidad por dependencias. No demorar un trabajo urgente para que las cargas se vean iguales ni mover tareas iniciadas.
3. Para cada operación, evaluar el inicio y fin viables en cada puesto, considerando la ocupación previa, preparación y reservas. Priorizar la opción que no empeore las entregas y permita terminar antes.
4. Entre opciones con el mismo resultado temporal, preferir la menor carga proporcional en un horizonte común de planificación. Si la disponibilidad de los puestos es igual, basta comparar horas ocupadas; con turnos distintos se compara ocupación sobre horas disponibles. Un puesto sin disponibilidad no es candidato.
5. Si sigue el empate, conservar una asignación previa válida y equivalente; en su defecto usar una identidad estable. El refresco periódico no debe cambiar tareas de carril arbitrariamente.

La carga incluye el trabajo pendiente y el tiempo de preparación que realmente ocupa el puesto, sin contar noches, esperas por dependencias ni trabajos terminados. La duración cotizada permanece intacta. Un puesto es capacidad productiva; no implica asignar automáticamente la tarea a una persona ni medir su rendimiento.

El criterio de menor fin y desempate por carga da una base previsible, pero puede dejar mejoras posibles según el orden de las tareas. Antes de implementarlo se deben contrastar ejemplos de 6/2/2/2 horas, tareas de llegada diferida, calendarios distintos, una máquina compartida y entregas urgentes; comparar la carga y las fechas contra el motor actual. La ventana de medición será común al escenario, independiente de los filtros o zoom del Gantt. Evaluar intercambios entre tareas pendientes solo si no empeoran compromisos ni generan cambios de asignación innecesarios; no se presupone una optimización global.

Primera entrega futura: asignaciones automáticas visibles, con su carga y motivo, de solo lectura. Segunda entrega futura: reasignar manualmente entre puestos compatibles, previsualizando el impacto y confirmándolo. Ninguna de las dos se habilita por este análisis.

### Por órdenes

La OT muestra cliente, tramo productivo y entrega final. Al desplegar:

- Producto y cantidad total.
- Lote A · 50 unidades · entrega comprometida; luego B, C y D.
- Operaciones del lote, con componente y recurso. Componentes complejos podrán agruparse sin duplicar operaciones.

Las órdenes sin distribución no muestran un nivel de lote artificial. Las barras resumen no ocupan recursos. El rombo de entrega es un compromiso comercial; no es un paso productivo. La entrega final de la OT corresponde a la más lejana de sus ítems y entregas.

Seleccionar una tarea resalta sus predecesoras y sucesoras pertinentes. Si hay una dependencia compartida entre lotes, se identifica como compartida; no se añaden las otras rutas completas de la OT.

### Panel de operación

Mostrar OT, cliente, producto, lote, cantidad, componente, recurso, inicio, fin y duración cotizada de solo lectura. Separar:

- Fin de la operación.
- Producción lista del lote y de la OT.
- Entrega comprometida del lote y de la OT.
- Margen laboral disponible antes y después de la propuesta.

El usuario podrá proponer un día y una hora mediante formulario o arrastre horizontal. Ambas acciones utilizarán el mismo servicio. No habrá tiradores para redimensionar barras. La reasignación vertical entre puestos se difiere: cuando se incorpore, solo será admisible entre puestos compatibles que mantengan la máquina/proceso cotizados y después de revisar su impacto.

## Reprogramación con un ejemplo

Ejemplo ilustrativo, sin modificar OTs reales: el Lote B de 50 exhibidores tiene cuatro horas cotizadas de impresión. Se propone adelantarlo al martes a las 09:00.

1. Se selecciona o arrastra esa operación. El sistema prepara un borrador y conserva las cuatro horas laborales, aunque crucen un descanso o varios días.
2. El servidor valida dependencias, capacidad, calendario, reservas y estado de ejecución. Si el horario no es viable, explica la causa y ofrece horarios o movimientos posibles; no acepta silenciosamente otra fecha.
3. Se muestra una comparación con el plan vigente. Por ejemplo, mover la impresión de otra OT del martes al miércoles mantiene su entrega del viernes, aunque consume parte de su margen. Esa opción aparece antes que una que requiera cambiar una entrega.
4. Cada OT afectada muestra inicio/fin anteriores y propuestos, producción lista, margen y entrega. Los movimientos indirectos de corte o armado también se incluyen.
5. «Aplicar reprogramación» confirma exactamente ese conjunto de cambios. Si hace falta cambiar una entrega, debe verse y aceptarse expresamente. El sistema no envía mensajes al cliente automáticamente.
6. Si otro usuario inició una tarea o modificó la agenda mientras se revisaba, la propuesta caduca y se vuelve a calcular antes de aplicar. Cancelar el borrador conserva la agenda vigente.

«Fijar horario» se reservará para una restricción explícita de inicio, con explicación de sus efectos y posibilidad de retirarla. El primer alcance mueve una operación pendiente; arrastrar una OT o un lote completo se difiere porque requiere otra semántica de dependencias y reservas.

## Plan de implementación y criterios de salida

### Paso 0 — Acceso independiente: incorporado en esta revisión

- Sidebar Producción → Planificación y ruta `/produccion/planificacion`.
- Reutilización del Gantt actual con su cargador, permisos, alcance de datos y actualización.
- Página sin los indicadores generales ni las pestañas exteriores del tablero, con ancho disponible y área de desplazamiento propia.
- La pestaña Simulación se retiró del tablero a pedido del usuario. Quedan Por items, Por estación y Kanban; el Gantt se consulta en Planificación. Una preferencia antigua de abrir Simulación vuelve a Por items para evitar una vista sin pestaña.
- No se habilita reprogramación manual ni edición de duración.

Este paso organiza el acceso; **no constituye la renovación visual completa**.

### Paso 1 — Renovación visual de consulta: implementada

- Extraer una vista de planificación que no dependa de montar todo el tablero.
- Modelo de presentación común para ambos modos, generado a partir de los mismos pasos y dependencias.
- Por recursos inicialmente agrupa estaciones y máquinas identificables. Desplegar puestos reales queda condicionado al paso 2; no usar subfilas visuales como identidad.
- Por órdenes con producto, lote, tareas, resúmenes e hitos; selección persistente al cambiar de modo.
- Filas legibles y estética shadcn, panel lateral de lectura, búsqueda, fechas y horas pendientes de toda la cola accesible.
- Altura contenida, cabeceras fijas y desplazamiento horizontal/vertical accesible. El panel lateral tiene scroll propio y acciones visibles.
- Búsqueda filtra la presentación, no elimina trabajos del cálculo de capacidad. Los indicadores deben aclarar su alcance.
- Cola visible de operaciones sin programar y motivo; información desconocida diferenciada de un conflicto confirmado.

**Salida:** los mismos pasos conservan fechas, duraciones y dependencias al alternar modos. OT-0054 permite leer sus cuatro lotes individualmente. No hay filas, carga ni tareas duplicadas. Funciona con teclado y con etiquetas largas.

### Paso 2 — Recursos y escenario canónico

- Revisar primero el análisis de reparto equitativo anterior con ejemplos; no implementar asignaciones ni migraciones antes de resolver ese criterio.
- Luego devolver una asignación automática estable por operación, máquina y puesto desde el motor; migrar puestos solo si se confirma el contrato propuesto. La primera versión muestra el reparto, sin reasignación manual.
- Unificar la lectura de planificación en backend con el motor usado por F6. Evitar una segunda implementación de reglas.
- Contrato de lectura compacto: revisión/contexto, hora de servidor, zona, recursos, calendarios, operaciones, dependencias, compromisos, supuestos y tareas no programadas.
- Identificar claramente qué fechas son proyecciones y cuáles son reservas/restricciones publicadas.
- Definir restricciones de inicio solicitado frente a horario fijo, permisos de gestión y comportamiento de tareas iniciadas o tercerizadas.

**Salida:** cada puesto tiene una asignación demostrable y la suma de capacidades no aumenta por cambiar de vista. Navegador y servicio de escenarios coinciden para el mismo contexto.

### Paso 3 — Reprogramación asistida desde el Gantt

Contratos orientativos, a cerrar con el paso 2:

- Preparar escenario: revisión de origen + operación + inicio solicitado. El puesto lo determina el motor con el criterio acordado; su elección manual se difiere a una ampliación posterior. **No acepta duración, precio ni velocidad.**
- Resultado: movimientos propuestos, conflictos, dependencias afectadas, fechas de entrega y margen antes/después, supuestos y vigencia.
- Aplicar: identificador de escenario, revisión esperada, aceptación explícita de cambios de entrega e idempotencia. No confiar en fechas recalculadas por el navegador.

Extraer y reutilizar la validación y aplicación de reprogramaciones F6. Registrar restricciones y cambios de forma auditable. Aplicar agenda y compromisos aceptados en una transacción, con bloqueo y aislamiento por empresa. No permitir publicaciones sobre información parcial por permisos; la evaluación debe considerar toda la carga pertinente sin revelar trabajos no autorizados.

Primero habilitar propuesta por formulario; después conectar el arrastre al mismo contrato y a la conversión inversa del eje laboral. Revisar antes de aplicar, deshacer el borrador y retirar restricciones publicadas con una nueva revisión.

**Salida:** adelantar una impresión reprograma sus consecuencias de forma coherente; una propuesta vencida o concurrente no pisa cambios; no cambia ninguna duración ni entrega sin la aceptación correspondiente.

### Paso 4 — Validación integral y escala SaaS

- Casos con 1 y varios puestos, máquina compartida, tareas paralelas, pasos en curso y proveedores externos.
- OT simple, compuesta, cuatro lotes de 50, dependencias compartidas y varias entregas por OT.
- Fechas locales, medianoche, viernes/lunes, feriados, turnos partidos, cambio horario y calendarios distintos.
- Impacto que conserva entrega, consume margen y exige nueva entrega, en ese orden de preferencia.
- Dos usuarios aplicando cambios sobre el mismo contexto; doble clic; error de red; reintento idempotente; permisos de consulta y gestión.
- Filtrar una OT no libera recursos ni cambia las fechas; cambiar vista tampoco.
- Carga medida con 500, 2.000 y 10.000 operaciones: tamaño de respuesta, tiempo de cálculo, primer render, scroll y selección. Definir presupuestos a partir de esas mediciones antes de dar la etapa por cerrada.
- Virtualizar filas y rango visible cuando las mediciones lo requieran. El DTO del Gantt no debe transportar geometrías SVG/DXF ni resultados completos de nesting.
- Cancelar solicitudes de previsualización obsoletas; conservar la revisión del borrador cuando llegan actualizaciones periódicas y avisar si perdió vigencia.

## Relación con el Plan Maestro

Es una evolución del núcleo de planificación anticipado con F6 y parte de la experiencia prevista en F11. La nueva página y las dos agrupaciones pueden avanzar sin F5. La reprogramación general necesita los pasos de contrato y validación anteriores.

No se declara completa F11: continúan pendientes sus alcances de planificación hacia atrás, disponibilidad integral de materiales/proveedores, mantenimiento avanzado, dotación y precisión plan/real. Tampoco se agrega registro de cantidades producidas por pieza, que el usuario pospuso.

## Validación de esta revisión

Las comprobaciones siguientes corresponden al acceso independiente inicial. La validación de la renovación visual aparece en la actualización posterior. Los pasos 2–4 siguen pendientes.

- TypeScript sin errores (`tsc --noEmit`).
- ESLint de las páginas, cargador, navegación y tablero modificados: correcto.
- `css:guard`: correcto, sin clases globales nuevas.
- 104 pruebas existentes de simulación, foco por lote, eje laboral y flujo productivo: correctas.
- Comprobación inicial en Chrome con la sesión local: Planificación carga los datos reales y toma todo el ancho disponible. Tras la corrección de alcance se retiró Simulación del tablero y se mantiene como acceso exclusivo en Planificación. No se modificaron órdenes ni reservas durante la verificación.

## Primera renovación de consulta — 10/09/2026

La página usa `PlanificacionView` y ya no monta todo `TableroProduccion`. Reutiliza el cargador, los permisos, el motor `simularFlujo`, el eje laboral y la zona del tenant. No introduce reglas de programación nuevas.

- Shadcn Base UI existente: controles de agrupación, búsqueda, período, zoom, tarjetas compactas y paneles laterales. Los estilos son locales a la página; no se modifica el tema global de la app.
- Recursos: estaciones en orden productivo y máquinas con identidad disponible. Las pistas gráficas evitan superponer botones; **no representan puestos ni asignaciones de personas**. La carga muestra minutos laborales pendientes del conjunto completo, no el ancho de las barras ni sólo la semana visible.
- Órdenes: OT → producto → lote → operaciones, con componentes en su lote correspondiente. Los productos sin distribución no reciben un lote artificial. Cada operación tiene una sola fila de detalle; los niveles superiores son resúmenes que no suman carga adicional.
- Selección persistente entre modos y dependencias de la cadena seleccionada. Una dependencia compartida no incorpora por sí sola las otras rutas completas de la OT.
- Fechas comprometidas visibles por lote y entrega final de la OT. El panel distingue fin de operación, fin del lote/producto y fin de la OT. Los conjuntos esperan a todos sus componentes; una estimación incompleta no muestra un fin completo.
- Estados: falta de estimación o hipótesis de desbloqueo se indican como revisión; no se presentan como atrasos confirmados. Se comparan días en la zona del tenant, sin convertir una entrega de fecha sola en medianoche UTC.
- Cabecera y columna fijas, área de scroll contenida, navegación semanal y vista ampliada. El panel lateral abre desde el encabezado, desplaza su contenido y conserva el pie visible.
- Actualización manual, al volver a la página, por eventos del tablero y cada minuto mientras la pestaña está visible. Se evitan solicitudes superpuestas; ante error se conserva la última lectura con un aviso. La búsqueda y los controles visuales no vuelven a calcular el ETA.
- Cola de operaciones sin fecha y su motivo. Los accesos con alcance parcial advierten que no confirman la capacidad global del taller.

Verificación: 106 pruebas correctas del modelo de presentación, agrupación por lotes, secuencia de preparación/impresión/corte/armado, dependencias, eje laboral y motor ETA. TypeScript, ESLint de los archivos de esta entrega y `css:guard` correctos. Comprobación en Chrome con OT-0054: cuatro lotes de 50, búsqueda sin cambio de fechas, apertura del detalle, fechas distintas de componente/lote/OT y dependencia completada visible.

Esta entrega es de lectura. Continúan pendientes el escenario canónico en servidor, la asignación real por puesto y la reprogramación general desde el Gantt. La calibración de equipos/calendarios y las mediciones de escala SaaS se mantienen como trabajos posteriores; esta revisión visual no los declara resueltos.

### Ajustes de lectura y selección de la misma revisión

- Se retiró el encabezado visual a pedido del usuario y se movió Actualizar a la barra de controles.
- El clic en una tarea selecciona y resalta dependencias sin abrir el modal. Ver detalle abre el panel de forma explícita.
- Cada tarea se dibuja individualmente con el ancho exacto de su intervalo en el eje laboral, sin un mínimo artificial ni etiquetas externas. Las barras pequeñas omiten texto recortado y muestran un tooltip con tarea, OT, lote, cliente, duración e inicio/fin en la zona del taller, también accesible con teclado. Sólo los intervalos simultáneos se separan en pistas visuales.
- La escala inicial muestra dos jornadas por pantalla, con opción de una jornada y scroll horizontal por todo el período. Cabecera y columna de recursos se mantienen fijas. La grilla y las marcas horarias comparten posiciones exactas; cambiar el zoom conserva el punto temporal de lectura. Ver recorrido filtra la cadena y ajusta el período, conservando esta escala ampliada. No elimina carga del ETA ni recalcula duraciones; volver a Semana, Ahora o cambiar la búsqueda recupera la vista general.
- Validación adicional: 19 pruebas correctas de proporcionalidad y recorte de barras, selección del recorrido y foco por lote; TypeScript, ESLint y control de CSS correctos. Comprobación en Chrome del tooltip de una tarea de 15 minutos, escalas de uno/dos días, scroll horizontal y recorrido del Lote B, con el calendario visible durante la selección.

### Inicio de la planificación desde ahora

- El calendario comienza en el mismo instante de consulta que usa el motor ETA, en lugar de la medianoche del día seleccionado. La primera jornada muestra sólo el tiempo que queda; después del cierre avanza a la próxima jornada laboral, respetando feriados.
- La navegación no permite períodos anteriores al día actual; volver a Ahora actualiza la consulta y lleva el scroll horizontal al origen. Las consultas futuras y el recorrido conservan el límite inferior de ahora, también después de cambiar de día con la vista abierta.
- Se verificó el comportamiento existente del motor: una tarea pendiente conserva toda su duración y se vuelve a proyectar desde ahora o desde su próximo espacio disponible. Las iniciadas muestran el restante estimado; las completadas quedan fuera de esta consulta. Las fechas comprometidas y los registros de la OT no se modifican.
- Validación: 106 pruebas del eje laboral, modelo de Planificación y motor, incluyendo pendientes vencidos, dependencia de una tarea en curso, zona horaria, feriados y jornadas parciales. En Chrome, el calendario nocturno comienza en la siguiente jornada y Ahora devuelve el scroll horizontal a cero.

### Zoom horizontal e hitos de entrega — 11/09/2026

- El selector de una/dos jornadas se reemplazó por una barra deslizable de zoom, de 25% a 400% en pasos de 5%, con porcentaje visible y botones − / + para saltar al nivel de referencia anterior/siguiente. Se puede operar con mouse, táctil o teclado. El 100% conserva la escala inicial. Cambia el ancho del eje, manteniendo las proporciones de tareas, fases y dependencias y el punto temporal de lectura. Desplegar/Plegar filas controla únicamente el árbol vertical.
- Por recursos hay una fila fija de entregas debajo del calendario. Cada hito corresponde a un producto o lote comercial, sin duplicarlo por componente o máquina. La búsqueda y el recorrido filtran los hitos sin cambiar sus fechas. Los coincidentes se agrupan y el tooltip identifica cada compromiso.
- Por órdenes los rombos tienen mayor contraste y área de interacción, con tooltip accesible también por teclado. Se mantienen los hitos de producto/lote y la entrega final de la OT. Una fecha sin hora se representa al cierre de la jornada; los días no laborables conservan su fecha explícita en el tooltip aunque el eje los comprima. Sólo se dibujan compromisos dentro del período consultado.
- Validación: 50 pruebas del modelo de presentación, eje y geometría; TypeScript, lint focalizado y `css:guard`. Comprobación en Chrome del zoom 100% → 75% → 50%, ampliación conservando scroll temporal, entregas de OT-0055 y Lote A de OT-0054, y rombos en la vista por órdenes.
