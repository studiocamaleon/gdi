# Colas y tandas de producción: propuesta de implementación y UX

> **Sustituido el 11/09/2026:** el usuario retiró las tandas sugeridas y su preparación. El alcance vigente es [Colas: consulta y completado múltiple](produccion-colas-completar-seleccion-2026-09-11.md). El contenido siguiente se conserva como antecedente de diseño.

**Fecha:** 11/09/2026. **Estado:** diseño ampliado de referencia, recortado posteriormente por decisión del usuario.

**Alcance vigente:** [Colas de trabajo y tandas v1](produccion-colas-tandas-v1-2026-09-11.md). Se implementó la consulta por máquina con material, ancho/formato y modo de color; la ejecución conjunta es el próximo desarrollo. La recomendación de formatos, el nesting entre OT y las pantallas adicionales descritas abajo quedan diferidos. Este documento conserva el análisis previo y no debe interpretarse como la lista de funciones ya implementadas.

Continúa el [análisis operativo](produccion-colas-tandas-y-operarios-analisis-2026-09-11.md), incluida la propuesta de porcentaje pendiente aproximado. Las referencias de código describen lo leído en esta revisión; no constituyen una auditoría completa ni pruebas nuevas de la aplicación.

**Revisión de compatibilidad:** la [auditoría de materiales, tandas y geometría](produccion-compatibilidad-tandas-y-geometria-auditoria-2026-09-11.md) amplía y corrige este borrador. Incluye placas rígidas, perfiles/capas, formatos comunes, restricciones de impresión/corte y 44 escenarios de aceptación. Sus restricciones prevalecen sobre las simplificaciones del prototipo anterior. El contrato aún debe revisarse antes de cerrar la implementación.

**Ampliación del recomendador:** evaluar formatos utilizables dentro de Preparar tanda: anchos de rollo y formatos de placa/pliego. La sección 3.2.1 desarrolla rollos y la 3.2.2, rígidos. Una propuesta calculada se distingue de la composición finalmente ejecutada en el RIP.

## 1. Decisión de producto recomendada

Agregar **Producción → Colas de trabajo** como entrada operativa, con dos vistas: **Máquinas** y **Trabajo manual**. Mantener **Planificación** como la vista temporal del mismo trabajo y el **Tablero** como seguimiento por OT/lote. Estaciones conserva su función de configuración.

La cola responde qué se puede hacer y qué se está haciendo; Planificación responde cuándo podrá terminar y cómo afecta las entregas. Una misma operación no se duplica por aparecer en varias vistas.

No crear una entidad configurable «Centro» ni otra máquina o puesto: se reutilizan las estaciones, máquinas físicas y equipos humanos existentes. Tampoco llamar «Mis tareas» a una agenda asignada automáticamente mientras sólo conocemos la capacidad conjunta del equipo. En Trabajo manual sí puede existir el filtro real **Tomadas por mí**, basado en la mesa actual.

**Primera versión funcional:** tandas de impresión por área y por hoja, entre OT distintas, en la máquina ya seleccionada por la cotización. Cola, confirmación, inicio, cierre completo o con pendientes, reanudación y efecto en ETA constituyen un mismo recorrido. Las demás máquinas siguen siendo visibles con su ejecución actual; sus reglas de agrupación se incorporan después mediante adaptadores, sin prometer que impresión y guillotina comparten compatibilidad.

Se incorpora el cálculo de acomodos propuestos entre trabajos compatibles para recomendar ancho de rollo o formato/cantidad de placas y pliegos, con demanda, geometría y restricciones conocidas. Organizar una tanda no autoriza a modificar sus layouts. No se incluye integración automática con el RIP, publicación automática de nuevos archivos combinados de impresión/corte, edición de tiempos, asignación nominal automática de personas, producción por unidades reales ni un editor general de agenda. La composición externa se admite como forma de trabajar; una propuesta calculada no acredita sus consumos o ahorros reales.

## 2. Qué podemos reutilizar y qué debemos ampliar

| Base verificada | Uso propuesto | Brecha concreta |
| --- | --- | --- |
| `Maquina`, `Estacion`, `EquipoProduccion` y calendarios | Navegación por recurso físico y restricciones de capacidad | No representan por sí mismos una tanda ni una asignación individual |
| `OrdenTrabajoItemPaso` y dependencias | Una sola identidad y estado de cada operación | Agregar asociación a tandas e información de impresión incompleta |
| `nestingLoteRol` operativo/participante | Una sola ejecución para el trabajo compartido de F4 | No ofrecer los participantes como trabajos independientes |
| Lotes de entrega F6 | Mostrar producto, lote y su compromiso | La tanda puede reunir lotes sin fusionarlos |
| Acciones de producción y auditoría | Validaciones, progreso, finalización, eventos y permisos | Extraer un núcleo transaccional reutilizable para varias OT |
| Motor de flujo en navegador/API | Calendarios, precedencias, atención humana y máquina | Introducir tandas y remanentes sin doble reserva, con pruebas de paridad |
| Reprogramación F6 | Comparación de escenarios, vigencia y publicación | Hoy está ligada a una distribución de entregas; no es un servicio general para tandas |
| Eventos del sistema | Actualización de cola, tablero, OT y Gantt | Añadir tópicos e invalidación por máquina/tanda sin recargar todo el taller |
| Motor de nesting de rollo y variantes de material | Evaluar la misma demanda en anchos compatibles y recomendar uno | Reponer la coordinación de candidatos dentro de la tanda; las rutas del simulador fueron retiradas |
| Motor de placa/pliego y planes registrados | Evaluar formatos para diseños reorganizables; conservar los layouts protegidos | Validar material, capacidades, imposición y recorrido posterior; el antiguo comparador de rollos no resolvía este caso |
| Perfiles y tecnología efectivos | Explicar y filtrar grupos compatibles | Completar condiciones necesarias de capas/configuración RIP y distinguir datos desconocidos; un mismo nombre/color no prueba equivalencia |
| Shadcn `base-nova`, Base UI, Tailwind 4 y Lucide | Componentes y lenguaje visual común | Componer la vista operativa, sin migración visual global |

### Dos brechas que deben resolverse primero

**Inicio de una máquina.** La acción actual rechaza iniciar/pausar/continuar pasos `solo_completar`; al completarlos registra tiempo estimado. No se puede agregar un botón «Iniciar tanda» que sólo cambie una tarjeta. Debe registrar ejecución y actor, hacer visible la ocupación y respetar la diferencia entre tiempo de máquina y atención humana. Abrir una tanda no abre automáticamente un cronómetro humano durante toda su duración.

**Porcentaje y fases.** `demandaHumanaJson` versión 1 conserva minutos/personas y ciertas marcas de operación de máquina, pero no preserva siempre el significado preparación/producción/cierre. El constructor todavía dispone de `setupMin`, `runMin`, `cleanupMin`, tiempos fijos y extras en el origen. Hace falta una base operativa versionada que conserve esos roles antes de aplicar el porcentaje. No reconstruirlos contando personas ni suponiendo que la primera fase siempre es toda la preparación.

## 3. Recorrido del impresor y pantallas

### 3.1 Entrada a Colas de trabajo

Cabecera compacta con nombre, selector Máquinas/Trabajo manual y búsqueda. Sin bloque introductorio grande ni tarjetas de indicadores que desplacen el trabajo.

En escritorio, lista lateral de máquinas agrupadas por estación. Cada una muestra su nombre real y un resumen breve: en curso, trabajos listos y pendientes de completar. La selección se recuerda por usuario/tenant y admite un enlace directo a máquina o tanda. En tablet se convierte en selector; no se comprime la tabla hasta volverla ilegible.

La zona principal contiene:

1. **En curso:** una fila destacada de la tanda actual, con impresor responsable e integrantes accesibles. La fase prevista se rotula «Según ETA» si no proviene de una confirmación real.
2. **Listos para imprimir:** tabla seleccionable de operaciones realmente elegibles. OT, producto/componente, lote visible, material/configuración, entrega y próxima etapa. Cantidades/layouts planificados en el detalle; nunca como producción confirmada.
3. **Pendientes de completar:** pestaña con porcentaje aproximado, motivo, autor, tiempo pendiente y acción para retomar. Su contador permanece visible.
4. **Historial:** consulta paginada de tandas, integrantes y cierres.

Una tanda ya confirmada pertenece a la cola, no vuelve a aparecer como varios trabajos disponibles. Los trabajos bloqueados no forman parte de Listos; se ofrece acceso a sus motivos en una sección secundaria. No se infiere disponibilidad a partir de una fecha proyectada.

### 3.2 Preparar una tanda

La máquina muestra grupos con tecnología, material, espesor/gramaje, color, caras y perfil efectivos. El impresor selecciona dentro de un grupo; «Seleccionar todo» se limita a ese grupo. Los incompatibles muestran una razón concreta, como «Otro material: vinilo glitter». Los datos faltantes necesarios se muestran como «Compatibilidad por revisar», no como coincidencias. La configuración se prepara una vez y no se convierte en un formulario técnico en cada tanda.

Al agregar integrantes se verifica que exista una presentación de material común a todos. La compatibilidad por parejas no basta. Las condiciones físicas y de proceso se verifican en servidor; una autorización para perjudicar una entrega no permite forzar una mezcla incompatible. La [auditoría de compatibilidad](produccion-compatibilidad-tandas-y-geometria-auditoria-2026-09-11.md) define las dimensiones y los casos.

Al seleccionar varios aparece una barra de acción: **«2 trabajos seleccionados · Preparar tanda»**. Abre un panel lateral que muestra integrantes, máquina, configuración común, orden de archivos y efecto sobre compromisos. Calcula un formato recomendado cuando la demanda y las transformaciones permitidas lo hacen posible; con layouts protegidos muestra el plan conservado y su motivo. La cola sugiere grupos listos por configuración, sin incluir de oficio toda la demanda futura ni alargar la tanda sin revisar entregas.

Si no hay impacto adverso, **Confirmar tanda** es la acción principal. La vista previa no reserva trabajo. La confirmación sí registra sus integrantes y lugar en la cola, después de revalidarlos en el servidor.

Si hay impacto, la misma vista muestra primero los escenarios que conservan las entregas gracias al margen disponible. Cuando se perjudique un compromiso, debe indicar OT/lote, fecha comprometida, producción prevista antes/después y quién autoriza. Recomendación: reutilizar inicialmente `produccion.supervisar`; el impresor sin ese permiso puede preparar el borrador pero necesita la autorización correspondiente. No aparece un botón deshabilitado sin explicación ni se crea una aprobación burocrática para tandas sin impacto.

Aceptar una demora productiva conserva la promesa comercial salvo otra acción explícita que la cambie. La propuesta caduca si cambian trabajos, archivos, agenda, recursos o compromisos relevantes.

### 3.2.1 Ancho recomendado para la tanda

**Momento:** después de elegir los integrantes y antes de Confirmar tanda. El cálculo corre al abrir Preparar tanda y se actualiza si cambian los integrantes; no exige navegar a un simulador ni elegir un ancho para descubrir después si convenía otro.

El panel muestra primero una sola recomendación: **«Rollo de 1,37 m · Mejor aprovechamiento calculado»**, metros lineales estimados, aprovechamiento y disponibilidad conocida. **Ver otros anchos** despliega una comparación compacta con el motivo de cada alternativa. **Ver acomodo propuesto** abre su preview sin perder la selección. Si hay una sola opción válida se muestra esa opción y su consumo estimado, sin un selector innecesario.

Ejemplo puramente ilustrativo: tres trabajos compatibles con 6 m² útiles totales, idéntica demanda en todas las opciones. No es un resultado obtenido del motor ni de OTs reales.

| Ancho del rollo | Largo estimado | Material consumido | Aprovechamiento aproximado |
| --- | ---: | ---: | ---: |
| 1,06 m | 8,00 m | 8,48 m² | 71 % |
| **1,37 m — recomendado** | **5,00 m** | **6,85 m²** | **88 %** |
| 1,52 m | 4,90 m | 7,45 m² | 81 % |

El rollo más ancho usa menos metros lineales y aun así consume más superficie que el recomendado. Para comparar anchos hay que considerar la superficie física consumida, no sólo el largo. El área útil usada como numerador debe ser la misma en todos los candidatos e indicar si representa piezas rectangulares, paneles o layouts conservados; no confundirla con cobertura de tinta.

**Selección recomendada:** entre opciones que cubren todos los integrantes, cumplen restricciones y cuentan con disponibilidad confirmada suficiente, priorizar menor desperdicio/superficie consumida. Mostrar por separado menor costo estimado cuando haya precios comparables; si ambas opciones difieren, hacer visible el motivo sin convertirlo en una decisión opaca. Una mejora de material que perjudique entregas pasa por la revisión de impacto ya prevista. Rotular «Mejor opción calculada»; no prometer el óptimo global.

El impresor puede elegir otro ancho válido. Al hacerlo se actualizan consumo, preview y efecto previsto en tiempos/entregas; no hay otra confirmación salvo la necesaria por un impacto relevante. Confirmar tanda guarda la variante y el ancho elegidos junto con la revisión del cálculo.

#### Qué debe verificar el recomendador

1. **Mismo material físico:** variantes activas equivalentes salvo ancho, dentro del tenant. Conservar color, acabado, adhesivo, gramaje/espesor y demás atributos relevantes. Vinilo blanco no se sustituye por glitter. La compatibilidad de archivos/tinta/caras también se mantiene.
2. **Restricciones de origen:** distinguir un ancho elegido automáticamente de una variante explícitamente fijada o un plan bloqueado. Las alternativas automáticas congeladas en cotización son una base, no autorización para reemplazar cualquier material. Una elección fijada exige revisión operativa explícita antes de cambiarse.
3. **Máquina:** ancho físico admisible y ancho realmente imprimible, márgenes laterales y longitudinales, separación, demasía, orientación, rotación y restricciones del proceso. Un ancho comercial existente no demuestra que esa máquina pueda usarlo.
4. **Demanda completa:** cada candidato incluye todos los trabajos seleccionados y sus cantidades planificadas. Si una pieza no entra o no tiene geometría suficiente, no omitirla para que la opción parezca mejor. Mostrar qué trabajo impide comparar o usar ese ancho. No repanelizar silenciosamente el producto para hacerlo entrar.
5. **Disponibilidad:** diferenciar stock confirmado, insuficiente y sin información. El stock agregado de una variante no demuestra que exista un tramo continuo suficiente de un rollo si no se registran bobinas/remanentes. No convertir desconocido en disponible ni reservar/descontar material por consultar el recomendador. Los casos sin disponibilidad verificable deben mostrar la condición pendiente y no anunciarse como listos para iniciar.
6. **Precios:** normalizar unidad por m²/metro lineal y moneda de comparación, cuando corresponda. Sin precio comparable, recomendar por material y omitir el ahorro monetario. Respetar los permisos de importes del impresor, incluidos los ahorros derivados.

#### Acomodo propuesto y trabajo en el RIP

El motor puede calcular qué ancho conviene y mostrar cómo acomodó los archivos. El impresor sigue trabajando en su RIP. Sin integración o uso de una salida validada del sistema, **el largo y aprovechamiento son los de la propuesta**, no mediciones de lo impreso. Si el RIP usa otro acomodo pueden variar; la etiqueta será «Estimado para el acomodo propuesto».

Para archivos que pueden reorganizarse, evaluar su geometría y demanda conocida sin cambiar escalas ni cantidades. Para un layout vinculado a corte, preservar su revisión y registro: sólo considerar el conjunto como bloque indivisible si eso resulta válido para su flujo de impresión/corte. No separar sus piezas ni regenerar el corte por el mero cambio de ancho. Cuando ni siquiera un traslado de bloque preserve el registro, conservar el ancho/layout original y mostrar la restricción.

Un pendiente que sólo indica «falta 30 %» no identifica cuáles piezas quedaron sin imprimir. Ese porcentaje sirve para el ETA, pero no para crear 30 % de cada pieza y nestear un remanente ficticio. Conservar el ancho de su ejecución previa como referencia y señalar que su composición restante no está determinada. No recomendar un ancho como óptimo para toda una tanda que incluya ese pendiente si no se conoce su geometría restante; se puede seguir organizando su reanudación sin exigir al impresor un recuento de unidades.

#### Integración y rendimiento

Dentro del preview de tanda, un servicio de candidatos toma snapshots/versiones, variantes permitidas y parámetros físicos, y evalúa cada ancho con el motor conservado. El resultado conserva cobertura de integrantes, SKU/ancho, método, consumo estimado, área y motivo de descarte; las coordenadas se cargan sólo al abrir el preview. No copiar el CAD completo en cada fila u opción.

Usar caché por demanda, revisiones de archivos/layouts, máquina, márgenes, rotaciones, variantes y versión del algoritmo. Precio y stock tienen su propia frescura; no reutilizarlos como si fueran inmutables. Si el cálculo demanda tiempo, mostrar «Comparando anchos…» y permitir cancelar; cambios de selección invalidan el resultado anterior. No ejecutar el nesting de todo el taller cada vez que entra un operario a la cola.

La confirmación revalida elegibilidad, material, archivos, disponibilidad conocida, revisión geométrica y agenda. Guarda la opción elegida como propuesta operativa, sin sobrescribir la cotización ni registrar un ahorro como concretado. Si se usa para ajustar tiempos, deben derivarse de esa revisión y perfiles y mantenerse orientativos mientras dependan de reproducir el acomodo en el RIP. No reducir toda la duración en proporción al ahorro de metros ni actualizar reservas a espaldas de F6.

Este agregado recupera la ayuda operativa de elegir el ancho, con trazabilidad de tanda. No reinstala las pantallas o endpoints retirados ni declara resuelta la generación de nuevos archivos de fabricación entre OT.

### 3.2.2 Placas rígidas y pliegos

El mismo momento del recorrido debe ofrecer formatos para las cuatro OT compatibles de PVC de 3 mm. Comparar ancho, alto, cantidad de placas y layouts; no dividir la superficie total de piezas por la superficie de placa. Validar la presentación física, área útil, capacidades relevantes de máquina, orientación, separación, sangrado y el recorrido de corte/terminación posterior. Los datos ausentes no se suponen válidos.

Con diseños independientes y demanda completa puede proponerse un acomodo conjunto. Con layouts vinculados a corte se ofrece una tanda que conserve archivos, revisión y copias. La posibilidad de reorganizarlos requiere un contrato adicional de revisión coordinada de impresión/corte; no se habilita por aceptar un aviso. Una placa compartida no puede generar varios cortes duplicados o ser asignada simultáneamente a máquinas distintas.

En papel se mantienen gramaje, caras, método de doble faz e imposición. Cuadernillos, numeraciones y talonarios no se tratan como piezas libres. Una disposición que mejora el aprovechamiento puede ser inválida para guillotina o alterar el orden de páginas. El preview debe explicar la restricción y conservar el plan cuando corresponda.

La recomendación muestra una opción principal, las otras en «Ver otros formatos», y distingue disponibilidad verificada de desconocida. No afirma ahorro de material cuando sólo agrupa archivos consecutivos. Ver el desarrollo y la matriz de la [auditoría](produccion-compatibilidad-tandas-y-geometria-auditoria-2026-09-11.md).

### 3.3 Confirmar, iniciar y trabajar en el RIP

**Confirmar** deja la tanda en cola. **Iniciar tanda** indica que comenzó su ejecución y registra actor/momento. Cuando puede comenzar de inmediato, un botón **Confirmar e iniciar** puede ejecutar ambas transiciones en una sola operación atómica, sin omitir la revisión de impacto.

La pantalla reúne referencias y descargas existentes. El impresor sigue preparando/enviando en su RIP. No mostrar «Enviado a la impresora» por descargar un archivo ni exigir subir una captura del RIP.

Una máquina física tiene una sola tanda en ejecución; otra máquina puede trabajar simultáneamente según su autonomía y el equipo compartido. No exigir tomar cada integrante a una mesa por separado: el comando de inicio resuelve el reclamo coherente y rechaza integrantes tomados por otra persona, sin apropiárselos silenciosamente.

### 3.4 Cerrar todo o dejar un pendiente

**Completar tanda** abre una confirmación breve con los integrantes visibles y la opción secundaria **No se imprimió todo**. Cerrar sin problemas requiere confirmar una vez; no hay formularios por trabajo.

En la excepción, dentro del mismo panel:

- Seleccionar los trabajos incompletos.
- Para cada afectado, **Falta aproximadamente: __ %** y **Qué quedó pendiente**.
- Autor y momento automáticos. No se solicitan unidades ni minutos.

La acción final describe el resultado: **Guardar cierre · 1 completo y 1 pendiente**. Al guardarse, se cierra el panel, la tanda pasa al historial y los pendientes quedan visibles en la pestaña correspondiente. Se permite abrir el resultado desde el aviso de confirmación. Un error mantiene selección y textos para poder corregirlos.

Los completos avanzan según sus dependencias; el afectado no habilita su etapa siguiente. Una anotación del 30 % no equivale a completar el 70 % de corte ni a declarar unidades disponibles.

### 3.5 Retomar

El pendiente conserva su operación, nota e historial. **Retomar impresión** lo incorpora a una nueva ejecución, individual o junto a trabajos compatibles, con el remanente ya estimado. No se vuelve a preguntar el porcentaje para iniciarlo ni se reenvía automáticamente el archivo original completo.

Se propone aplicar por defecto una preparación de reinicio completa y el cierre pendiente desde los perfiles, rotulando este supuesto. Se ajustará sólo si existe una condición verificable para conservar la preparación. No se pide al operario desglosar setup/cleanup ni editar minutos.

Si el trabajo todavía tiene un impedimento real, se conserva su bloqueo y el acceso a la acción ya disponible para resolverlo. El texto libre no se interpreta automáticamente como una disponibilidad de material ni como una orden para cambiar un gate. Si se necesita separar «incompleto pero retomable» de «incompleto bloqueado», reutilizar el bloqueo explícito existente como acción secundaria, sin hacerlo obligatorio en todos los cierres.

Al concluir, **Completar impresión** resuelve el pendiente y sus sucesores. Si vuelve a quedar incompleto, registra una nueva declaración respecto del total original, conservando las anteriores.

### 3.6 Trabajo manual y Planificación

Trabajo manual reutiliza la mesa y las acciones actuales de los pasos sin máquina. Presentación compacta por estación, con filtros Listas/Tomadas por mí y operación siguiente visible. No introduce puestos ficticios ni separa de la planificación las intervenciones del impresor.

En Gantt, una tanda se representa como ocupación real del recurso; sus integrantes se consultan al seleccionarla. En modo por OT/lote se puede mostrar su relación con la misma banda temporal, sin multiplicar capacidad. Dependencias y entregas conservan el alcance del lote.

El detalle muestra tiempo cotizado, pendiente aproximado y origen de esa aproximación como datos distintos. Un enlace desde la cola abre la tanda/operación correspondiente, evitando volver a buscarla.

## 4. Lenguaje visual y componentes

Referencia: [dashboard de Shadcn](https://ui.shadcn.com/examples/dashboard). Utilizar el `base-nova` ya instalado: tipografía sobria, superficies neutras, bordes suaves, espaciado medido y una acción principal por contexto. Estado acompañado de texto/icono; selección y hover conservan contraste. No colorear cada OT de un tono diferente en la cola.

| Necesidad | Composición propuesta |
| --- | --- |
| Máquinas / Trabajo manual; Listos / Pendientes / Historial | `Tabs` |
| Cola comparable y selección de integrantes | `Table`, `Checkbox`, `Badge` |
| Preparación y detalle sin perder la cola | `Sheet` con título accesible, cuerpo desplazable y acciones visibles |
| Nota y porcentaje | `Field`, `InputGroup`, `Input`, `Textarea`; error junto al campo |
| Impacto o dato que impide ejecutar | `Alert` y detalle de la causa |
| Cierre con resultado inequívoco | `Dialog` o estado de confirmación del mismo `Sheet`, sin superponer ambos |
| Carga, vacío y éxito | `Skeleton`, `Empty`, `sonner` |
| Información complementaria | `Tooltip`; lote, estado y errores nunca sólo en hover |

Reglas de UX para implementación:

- Filas de aproximadamente 56–64 px, con dos líneas de identidad y lote sin truncar. Expandir el detalle; componentes colapsados por defecto.
- Un desplazamiento principal de la cola, cabecera y barra de selección persistentes. Paneles con altura disponible y scroll real; no capturar rueda cuando no desbordan. Conservar la protección horizontal del Gantt contra navegación accidental.
- Pendientes con una etiqueta textual cálida, sin presentar cada caso como error fatal. Rojo reservado para impedimentos o compromisos en riesgo.
- Navegación por teclado, foco visible, labels, títulos de overlays, escape y retorno de foco. No depender de arrastrar para reordenar o actuar.
- Edición concurrente: mensaje concreto «Este trabajo ya fue tomado», refrescando la fila afectada y conservando el borrador válido.
- Datos de ejemplo del boceto claramente identificados. No usarlo como prueba del motor ni convertirlo directamente en una pantalla productiva.
- Estilos de composición en CSS Modules. No tocar `globals.css`, reinstalar el preset ni migrar el resto de la aplicación para esta entrega.

## 5. Modelo técnico propuesto

Los nombres siguientes son orientativos para el diseño; aún no se modificó Prisma.

| Entidad | Datos esenciales | Invariante |
| --- | --- | --- |
| `TandaProduccion` | Tenant, máquina, estado, revisión, orden de cola, confirmador/iniciador, fechas, configuración efectiva, variante/formato y referencia del acomodo elegidos cuando correspondan | Máquina física existente; integrantes estables tras confirmar |
| `TandaProduccionMiembro` | Tanda, paso operativo, orden interno, versión de archivo/layout, base de tiempo, resultado de esa ejecución | Un miembro físico único; los aliases F4 no son miembros extra |
| `AsignacionActivaTanda` | Tenant, paso operativo, tanda | Unicidad por tenant/paso para impedir doble toma; se libera al cerrar/cancelar |
| `PendienteProduccion` | Paso, ejecución origen, porcentaje restante, nota, autor/momento, base de cálculo versionada, resolución | Una declaración vigente, historial inmutable de cambios |
| `TandaProduccionEvento` | Acción, actor, instante, revisión, resultado antes/después, clave de idempotencia | Reintentar no repite cierres ni atribuciones |
| `PropuestaTanda` | Integrantes propuestos, compatibilidad y permiso geométrico, contexto/revisión ETA, candidatos de formato y acomodo, criterio de recomendación, vigencia, impactos y autorización | Vista previa sin asignación; aplicar exactamente el escenario aceptado |

La referencia pesada de geometría queda en su snapshot/revisión original. En la tanda se guardan identificadores y resumen verificable, no otro CAD completo por OT/copias. Conservar FKs y validaciones con `tenantId`; los archivos conservan las restricciones de acceso existentes.

### Estados y una sola autoridad de ejecución

Tanda: **Confirmada → En ejecución → Cerrada**; cancelación antes de ejecución devuelve sus miembros a la cola. Una tanda cerrada puede tener integrantes completos y pendientes: cierre de ejecución y terminación de operación son conceptos distintos.

Recomendación: conservar los estados existentes del paso (`pendiente`, `en_curso`, `pausado`, `bloqueado`, `hecho`) y añadir la condición de impresión incompleta mediante el registro asociado. Inicio de tanda pone sus pasos en curso sin crear tramos humanos ficticios; cierre incompleto los deja pausados o bloqueados si existe un impedimento explícito. `hecho` sigue siendo la única condición que satisface esa dependencia.

No basta cambiar un estado desde el nuevo módulo. Extraer un servicio de comandos que reciba el cliente transaccional, valide y aplique la transición, sincronice participantes F4, recalcule progreso/fin de cada OT, registre eventos y publique las invalidaciones mediante la infraestructura existente. Las rutas individuales deben delegar en ese mismo servicio.

Un paso perteneciente a una tanda activa no puede completarse/reabrirse desde otra pantalla eludiendo el cierre conjunto. Las acciones actuales deben mostrar la tanda y redirigir al contexto correcto o ejecutar el mismo comando autorizado. Cancelación de OT, cambio de archivo, máquina y reapertura deben invalidar propuestas y coordinarse con membresías activas; no dejar reservas huérfanas.

**Trabajo compartido F4:** si un paso operativo imprime piezas de varios componentes, la fila muestra esas referencias y una sola acción. No se puede declarar sólo un alias como completo y liberar su corte mientras el trabajo físico sigue incompleto. Registrar el pendiente sobre la operación común, explicando qué componentes quedan afectados.

## 6. Servicios, comandos y lectura

Separar bajo `apps/api/src/produccion/tandas/` el dominio de tandas, la lectura de colas, la compatibilidad, los comandos y la base de tiempos. El servicio de ejecución compartido debe vivir en un módulo sin dependencia circular entre Producción, Órdenes y ETA.

Contratos orientativos:

| Operación | Propósito |
| --- | --- |
| `GET /produccion/colas/maquinas` | Resumen por recurso accesible, sin geometría |
| `GET /produccion/colas/maquinas/:id` | Trabajos listos, pendientes o historial, con cursor |
| `POST /produccion/tandas/propuestas` | Validar integrantes y permiso geométrico, comparar formatos cuando corresponda y calcular impacto sin reservar |
| `POST /produccion/tandas/propuestas/:id/confirmar` | Reservar miembros y publicar escenario vigente |
| `POST /produccion/tandas/:id/iniciar` | Inicio operativo sin cronometrar toda la atención humana |
| `POST /produccion/tandas/:id/cerrar` | Resultado completo/incompleto de todos sus miembros, atómico |
| `POST /produccion/tandas/:id/cancelar` | Cancelación previa al inicio, con auditoría |
| `POST /produccion/pendientes/:id/retomar` | Nueva ejecución del mismo paso y remanente, sin duplicar demanda |

Se muestran sin el prefijo global `/api`. Validar IDs, versión esperada, campos permitidos, límites de integrantes/texto y permisos en servidor. Un cierre de N integrantes exige un resultado inequívoco para N; no confiar en filas omitidas o filtros del navegador.

**Transacciones:** preview y cómputo fuera de los cerrojos; publicación corta con orden de bloqueos compatible con F6. Revalidar bajo bloqueo tenant, OT/pasos, gates, documentos, asignaciones, recursos y revisión de agenda. Un cierre de varias OT debe afectar todas o ninguna. No hacer N llamadas HTTP ni N transacciones independientes. Reintentos tras respuesta perdida recuperan el resultado por idempotencia; no repiten el cierre.

**Compatibilidad:** adaptadores por impresión por área/hoja construyen una clave explícita de material, máquina, formato/espesor/gramaje, caras, color/configuración y requisitos de registro aplicables. Para comparar anchos de rollo, separar la equivalencia física de material de la variante concreta de suministro; no exigir el mismo SKU si sólo cambia el ancho y el cambio está permitido. Una variante fijada sigue siendo una restricción explícita. Si falta un dato necesario, mostrar el motivo y no agrupar a ciegas. La asignación a la misma máquina no demuestra compatibilidad de material.

**RIP y corte:** conservar layouts de impresión/corte como una unidad referenciada. Se puede ejecutar archivos consecutivos conservados. Si el RIP recompone posiciones de un trabajo que necesita corte por registro, no reutilizar automáticamente el archivo de corte anterior. La importación de geometría o la evidencia de correspondencia queda como ampliación con contrato propio; el piloto no debe declarar ese caso cubierto sólo porque permite cerrar una tanda.

## 7. ETA: contrato y comportamiento

Introducir una representación de **unidad de ejecución** que pueda agrupar varios pasos, con fases y referencias a sus miembros. Los predecesores deben estar satisfechos para ejecutar; los sucesores esperan el cierre de la tanda según el recorrido acordado. Rechazar agrupaciones que generen ciclos.

En archivos consecutivos, usar inicialmente la secuencia de tiempos derivados de cada archivo, sin deducir ahorros silenciosos de preparación. Los intervalos se reservan una vez como trabajo de la tanda, sustituyendo las reservas independientes de sus miembros. Mezclar en el RIP no demuestra una duración o un consumo exacto nuevo.

Base de remanente versionada: roles de preparación, producción variable, cargas/recargas, cierre y extras; minutos derivados, dotación, autonomía y origen de la versión. Conservar las magnitudes originales, sin reescribir la cotización. Históricos sin desglose recuperable se muestran como estimación limitada, sin fabricar fases.

Ejemplo: producción variable original 120 min; falta ~30 %; reinicio 10 min y cierre 5 min derivados de perfiles. Pendiente aproximado: **36 + 10 + 5 = 51 min**, distribuido entre recursos según sus fases. Si la siguiente declaración es 10 %, se calcula sobre 120, no sobre 36. No volver a descontar el tiempo transcurrido del mismo trabajo ya declarado.

La proporcionalidad de la parte variable es un supuesto: no conoce cuántos ciclos de placa faltan. Conservar el tratamiento de atención de cada fase y su incertidumbre. Una nota de falta de material no acredita que exista material; proyecciones que asuman su resolución deben señalarlo como hoy hace el motor con bloqueos.

Cambiar el remanente invalida proyecciones y propuestas pendientes. Cargar 51 min no garantiza terminación en 51 min de reloj; rigen calendarios, equipo compartido, pausas y cola. No transformar un inicio manual en medición fiable de atención humana ni un porcentaje en ahorro o progreso confirmado.

Extender conjuntamente ensamblado de `EtaService`, motor API, motor navegador, worker de Planificación y contratos usados por F6/cotización. Un tenant sin tandas debe conservar los resultados anteriores. Las vistas pueden calcular previews, pero la confirmación tiene autoridad en servidor.

Para publicar cambios de cola, extraer de F6 vigencia, comparación de compromisos y aplicación de agenda. No crear una distribución de entregas artificial para reutilizar sus endpoints. Autorizar el perjuicio conserva auditoría; no cambia automáticamente la promesa comercial.

## 8. Entregas de implementación

| Paso | Entrega concreta | Criterio de salida |
| --- | --- | --- |
| 0. Contrato y UX | Este diseño, auditoría de compatibilidad y prototipo actualizado | Reglas de agrupación, formatos y layouts revisadas; recorrido sin ambigüedad |
| 1. Base operativa | Extracción del comando común, modelo de tandas/asignación/eventos y base de tiempos versionada | Acciones antiguas conservadas; cierre multi-OT atómico; no duplicación F4 |
| 2. Cola real de consulta | Ruta propuesta y tabla por máquina, elegibilidad, archivos referenciados | Sólo trabajo realmente listo; permisos y rendimiento verificados con datos de prueba |
| 2b. Formato recomendado | Comparación de rollos y placas/pliegos dentro de Preparar tanda, preview y elección persistida | Demanda completa, configuración común y permiso geométrico; disponibilidad y limitaciones explícitas; sin ahorro real inventado |
| 3. Recorrido completo de impresión | Confirmar/iniciar/cerrar/retomar, nota y porcentaje, bloqueo de sucesores | Un caso realista completo funciona sin cantidades producidas ni acciones por cada integrante |
| 4. Planificación coherente | Unidades de ejecución, remanentes, comparación/autorización y publicación de impacto | Paridad API/navegador/F6; una sola reserva por trabajo; compromisos preservados o perjuicio autorizado |
| 5. Piloto y escala | Impresión por área y hoja, equipos compartidos, lotes y concurrencia | Matriz siguiente y medición de carga aprobadas |

Los pasos 3 y 4 forman un mismo incremento funcional: no habilitar a tenants tandas que cambien producción sin que el ETA las comprenda. Usar habilitación por tenant durante el piloto; no es una reapertura de los simuladores retirados. El alcance de F5 relacionado con geometría sigue separado y no se declara cerrado por esta entrega.

## 9. Verificación y objetivos SaaS

Pruebas de comportamiento a preparar:

| Caso | Resultado esperado |
| --- | --- |
| Dos operadores eligen el mismo trabajo | Sólo una asignación confirmada; el otro conserva su borrador con conflicto explicable |
| Doble clic / timeout después de guardar | Un único cierre, eventos y progreso coherentes |
| Cierre falla en el segundo integrante | Ninguna OT parcialmente actualizada |
| Un integrante incompleto | Sólo los completos habilitan sus siguientes etapas |
| Operativo F4 con varios aliases | Una reserva y un resultado; aliases sincronizados |
| Lotes A–D de una misma OT | Identidad y fechas separadas; ninguna entrega se completa por otra |
| Declaraciones 30 % y luego 10 % | Base original constante; sin descuento acumulativo |
| Máquina autónoma frente a guillotina atendida | Capacidad humana correcta en ambos casos |
| UV y ecosolvente con un impresor | Solapamiento sólo donde la atención lo permita |
| DTF jueves, feriados y zonas horarias | Calendarios del tenant y fechas locales coherentes |
| Mover dentro del margen de entrega | Mostrar cambio productivo sin anunciar cambio comercial |
| Agrupación perjudica una entrega | Impacto explícito y autorización vigente o rechazo al publicar |
| Trabajo/archivo/gate cambia tras preview | Invalidación y recálculo; no confirmar el escenario viejo |
| Completar desde el tablero un miembro activo | No eludir el cierre de tanda |
| Cancelar OT o máquina desactivada | Sin nuevas ejecuciones inválidas ni reservas huérfanas |
| RIP modifica geometría de corte registrado | No presentar el corte viejo como válido |
| Distintos anchos con el mismo material | Comparar la misma demanda y recomendar por superficie consumida, no sólo por metros lineales |
| Un ancho deja afuera una pieza | Descartarlo para esa selección; no mejorar el score omitiendo integrantes |
| Ancho/variante fijados o material distinto | No sustituirlos silenciosamente por un candidato más económico |
| Stock, precio o composición desconocidos | Condiciones visibles; sin disponibilidad, ahorro ni precisión inventados |
| Pendiente con porcentaje, sin geometría restante | No nestear un remanente ficticio ni prometer un óptimo de toda la tanda |
| Cambio de selección mientras se comparan anchos | Resultado anterior invalidado; la confirmación usa la nueva revisión |
| Sin desglose de tiempos o impedimento sin fecha | Estimación orientativa o sin fecha, con causa visible |
| Acceso de otro tenant / archivos restringidos | Sin lectura ni mutación cruzada |
| Sin tandas en el tenant | Regresión de ETA y ejecución anterior sin cambios |
| Teclado, tablet y listas extensas | Lote, acción y errores visibles; scroll y foco correctos |

Objetivos iniciales de ingeniería, **a medir y no resultados ya logrados**: página de 50 operaciones con payload resumido menor a 200 KB sin geometría; p95 de lectura menor a 500 ms en entorno de referencia; confirmación/cierre ordinario menor a 1 s sin cómputo de preview. Presupuesto de preview separado, con progreso/cancelación si necesita worker y límites de tamaño explícitos.

Medir con varios tenants aislados, 100 sesiones concurrentes y casos de hasta 10.000 operaciones pendientes por tenant; listas paginadas y CAD bajo demanda. Medir CPU, memoria, p95/p99, queries, payload, espera de cerrojos y frescura. Evitar N+1, polling del tablero completo desde cada máquina y recalcular nesting al seleccionar filas. Eventos por máquina/tanda y caché por revisión del tenant deben mantener la coherencia con invalidación selectiva.

## 10. Fuentes de implementación inspeccionadas

- [Modelos actuales](../apps/api/prisma/schema.prisma): Estacion, EquipoProduccion, OrdenTrabajoItemPaso, tramos y eventos.
- [Comandos actuales](../apps/api/src/ordenes-trabajo/ordenes-trabajo.service.ts): transiciones, `solo_completar`, gates, transacción y aliases F4.
- [Snapshot de fabricación](../apps/api/src/produccion/snapshot-paso-produccion.ts).
- [Motor de candidatos de rollo](../apps/api/src/motor-universal/nesting-dispatcher.ts), [configuración geométrica](../apps/api/src/motor-universal/nesting-config.ts), [pruebas existentes de márgenes](../apps/api/src/motor-universal/__tests__/nesting-rollo-margenes.spec.ts) y [contrato de alternativas de material](../apps/api/src/motor-universal/tipos.ts).
- [Antecedente del comparador retirado](simulador-impresion-diseno.md). Sus contratos históricos no sustituyen el nuevo cierre atómico ni autorizan excluir trabajos de una recomendación sin avisar.
- [Desglose humano](../apps/api/src/eta/motor/demanda-humana.ts), [motor API](../apps/api/src/eta/motor/flujo-produccion.ts), [motor navegador](../src/lib/flujo-produccion.ts), [ensamblado ETA](../apps/api/src/eta/eta.service.ts).
- [Bloqueos F6](../apps/api/src/planificacion-entregas/reprogramacion-bloqueo.ts), [publicación](../apps/api/src/planificacion-entregas/reprogramacion-aplicar.ts), [servicio de entregas](../apps/api/src/planificacion-entregas/planificacion.service.ts).
- [Carga de Planificación](../src/components/produccion/use-planificacion.ts), [tablero actual](../src/components/produccion/tablero-produccion.tsx), [navegación](../src/components/navigation/nav-items.ts).
- [Configuración Shadcn](../components.json); documentación oficial de [Table](https://ui.shadcn.com/docs/components/base/table), [Sheet](https://ui.shadcn.com/docs/components/base/sheet), [Field](https://ui.shadcn.com/docs/components/base/field) y [Tabs](https://ui.shadcn.com/docs/components/base/tabs).
