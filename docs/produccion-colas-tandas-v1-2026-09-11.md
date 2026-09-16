# Colas de trabajo y tandas: alcance inicial acordado

> **Sustituido el 11/09/2026:** el usuario retiró las tandas sugeridas y su preparación. El alcance vigente es [Colas: consulta y completado múltiple](produccion-colas-completar-seleccion-2026-09-11.md). El contenido siguiente se conserva como antecedente de diseño.

**Fecha:** 11/09/2026. **Estado:** consulta por máquina, revisión de preparación con comparación ETA y base interna de ejecución atómica implementadas. Persistencia e inicio/cierre de tandas en la interfaz y su efecto durante la ejecución real siguen pendientes.

**Referencia visual aprobada:** [Sistema visual Shadcn](sistema-visual-shadcn.md). Primero se completa el recorrido de Colas; luego se elige otra vista para migrar.

Este documento define el alcance vigente tras simplificar el [diseño anterior](produccion-colas-tandas-implementacion-y-ux-2026-09-11.md). El usuario prioriza reunir el trabajo de cada máquina y reducir acciones repetitivas del impresor. La recomendación de formatos y el nesting entre OT quedan para otra etapa.

**Revisión de alcance solicitada el 11/09 a las 20:16:** se analiza incorporar nesting rectangular de rollos y placas, permitiendo presentaciones de distintos anchos y excluyendo acomodos protegidos. Ver [propuesta acotada](produccion-tandas-nesting-acotado-2026-09-11.md). Todavía no modifica el comportamiento implementado que describe este documento.

## 1. Decisiones de producto

- Una cola por **máquina física**, usando su identidad y nombre existentes. Dos impresoras del mismo tipo conservan colas distintas.
- Material, ancho/formato previsto y **modo de color** visibles por trabajo. En placas se muestran ancho × alto; en rollos, el ancho.
- Grupos visuales por material identificado, formato, color, tecnología, perfil y caras. Ayudan a leer; no constituyen una validación completa de compatibilidad ni autorizan modificar un layout.
- El impresor prepara los archivos en el RIP. Grafoprint no genera un archivo combinado, no recalcula nesting, no recomienda un ancho y no acredita ahorro.
- Las siguientes entregas permitirán registrar inicio y cierre conjuntos de trabajos elegibles. La OT, el ítem y el lote de entrega mantienen sus identidades.
- Los simuladores retirados no se recuperan. El trabajo sin máquina sigue accesible desde el Tablero.

**Ejemplo:** diez trabajos en vinilo blanco a 1,37 m y uno a 1,05 m aparecen en grupos separados. El impresor ve el panorama para decidir cómo organizar su producción en el RIP. La pantalla no afirma que 1,37 m sea el óptimo ni modifica el formato cotizado. CMYK y CMYK + blanco se distinguen aunque compartan material y ancho.

## 2. Entrega implementada

Ruta **Producción → Colas de trabajo** (`/produccion/colas`).

| Zona | Comportamiento actual |
| --- | --- |
| Lista de máquinas | Sólo máquinas con operaciones pendientes, ordenadas de mayor a menor cantidad (desempate por nombre). Estación, cantidad y búsqueda; selector en pantallas pequeñas. ScrollArea de Shadcn con barra discreta. |
| Cola | Pestañas Todos, Listos, En curso, En espera y Pausados. Búsqueda por OT, cliente, producto/componente, lote o tarea. |
| Trabajo | OT, producto/componente, lote, cantidad prevista, material, ancho/formato, modo de color, entrega y estado. |
| Esperas | Explica dependencias sin completar, material/calidad pendientes, aprobaciones documentales y recurso no habilitado. |
| Layout | Marca las referencias compartidas, registradas o vinculadas a geometría que requieren conservar la disposición. |
| Acceso operativo | «Ver trabajo» abre el detalle existente del ítem en el Tablero. |
| Actualización | Botón Actualizar, actualización al volver a la ventana y cada minuto si está visible. Conserva las filas durante la actualización en segundo plano. |
| Preparación | Selección individual o de los listos de un grupo, hasta 50 operaciones. Revisión en servidor, resumen por OT/lote, formatos conservados y comparación de fechas con ETA. Todavía no inicia producción. |

«Listo» deriva de estados y condiciones actuales, nunca de una fecha futura del Gantt. No acredita por sí solo una nueva revisión técnica del archivo: se respetan los controles de aprobación configurados. Las acciones existentes continúan validando permisos y condiciones al ejecutarse.

Los grupos se forman dentro de cada página; si hay más páginas se indica expresamente. El orden base prioriza la fecha de entrega; agrupar visualmente reúne trabajos de esa configuración y no impone una nueva secuencia de producción.

### Procedencia de los datos

Se consultan los metadatos congelados del paso de fabricación. Si la ejecución es compartida, prevalece el plan común vigente. Cuando su formato difiere del individual, la fila conserva también «Cotizado: …». No se toma el color global de un producto compuesto para atribuírselo sin evidencia a todos sus componentes.

En componentes históricos sin traza propia, se busca el cálculo congelado del ancestro y se recorre el camino exacto de códigos de componentes hasta el ítem. Esto también cubre componentes anidados. No se identifica un componente por su nombre ni sólo por compartir una ruta. Una traza propia siempre prevalece; no se recalcula ni se modifica la OT. La proyección de metadatos continúa dentro de PostgreSQL, sin enviar geometría al cliente.

Los datos ausentes se muestran como tales. No se deduce el material por el nombre del producto, ni el ancho del rollo a partir del tamaño de una pieza. Dos materiales sin identidad no forman un único grupo por carecer ambos de datos.

Los participantes de un nesting compartido no se ofrecen como ejecuciones físicas adicionales. La fila operativa se identifica como «Ejecución compartida»; su detalle conserva la información del plan existente.

### API y tamaño de las consultas

- `GET /produccion/colas`: catálogo de máquinas y contadores.
- `GET /produccion/colas/:maquinaId`: cola filtrada y paginada; 50 filas por defecto, máximo 100.
- `POST /produccion/colas/:maquinaId/preparacion`: revisión de lectura de 1–50 UUID únicos. No persiste una tanda ni modifica operaciones.
- `POST /produccion/tandas/:maquinaId/revision`: revisión de preparación y comparación ETA. La interfaz usa esta ruta; la revisión anterior de configuración sigue disponible.
- Las lecturas requieren `produccion.ver` y el tenant de la sesión. Consultar una máquina de otra empresa devuelve no encontrada.
- La consulta de metadatos proyecta claves concretas en PostgreSQL. No transfiere ni descomprime placements, contornos o geometría CAD para construir una fila; no expone costos de cotización.
- Para calcular disponibilidad y contadores se leen los estados y relaciones de las operaciones pendientes de la máquina seleccionada. La paginación limita la respuesta y los snapshots leídos, pero no esa primera lectura de estados. No se ha certificado todavía rendimiento con grandes colas concurrentes de esta nueva ruta.
- Esta entrega es de consulta: no crea tandas, no migra datos y no modifica estados, compromisos o tiempos ETA.

## 3. Próxima entrega: ejecución conjunta

Los puntos 1 y 2 funcionan como revisión de preparación. Los comandos operativos de los puntos 3–6 requieren persistencia y pruebas antes de habilitar sus botones:

1. El impresor entra a su máquina y selecciona trabajos **Listos** dentro de una configuración compatible.
2. «Preparar tanda» muestra OT/lotes incluidos, orden de trabajo y configuraciones existentes. Conserva los anchos y layouts individuales; no supone un ancho común ni vuelve a anidar las piezas.
3. «Iniciar tanda» registra impresor, fecha e integrantes una sola vez. Servidor vuelve a validar disponibilidad, permisos y compatibilidad; no admite un mismo paso en dos tandas activas.
4. «Completar tanda» propone finalizar todos los trabajos. El impresor sólo interviene en las excepciones: deja un ítem pendiente con nota y porcentaje aproximado faltante.
5. El cierre conjunto libera las etapas siguientes de los ítems completos. Un ítem pendiente continúa bloqueando sus sucesores. Se registra quién confirmó cada cierre/excepción.
6. Cola, Tablero, OT y Planificación reflejan el mismo resultado. Retomar un pendiente usa su remanente, con ETA expresamente aproximado.

### Preparación disponible (11/09/2026)

1. Elegir una máquina de impresión y marcar trabajos listos; alternativamente «Seleccionar listos» en un grupo. Los pendientes o bloqueados no se incorporan.
2. La primera selección fija la configuración; otros materiales, tecnologías, modos de color, perfiles, caras o formatos quedan fuera. Limpiar permite elegir otro grupo.
3. «Preparar tanda» consulta nuevamente disponibilidad y metadatos de **todos** los IDs seleccionados en una transacción de lectura `RepeatableRead`.
4. Muestra OT, cliente, producto, lote, cantidad original, entrega comprometida, material, formato, color, perfil, caras y referencias de layout. El orden de revisión sigue las entregas; no publica una nueva secuencia productiva.
5. «Revisar de nuevo» repite la consulta; «Cerrar revisión» vuelve a la cola y conserva la selección en esa pantalla. Cambiar máquina, filtro, búsqueda o página limpia la selección. Recargar la página también la descarta.

**Alcance estricto de esta revisión:** impresión por área o por hoja, un único formato conocido por operación, coincidencia de variante de material, tecnología, modo de color, perfil y caras. Se preservan los archivos individuales, incluso cuando el trabajo refiere a un layout compartido. No se permite reunir anchos distintos ni sustituir material mediante este flujo. Un dato necesario desconocido impide seleccionarlo y la fila explica la causa. Las demás máquinas conservan su consulta habitual.

Si un integrante desaparece, cambia de máquina, se completa o pertenece a otro tenant, la revisión falla completa; nunca devuelve una tanda reducida sin avisar. Un gate nuevo o una configuración distinta aparece como selección que necesita revisión. Un refresco de la cola que cambie integrantes invalida la selección completa. No se confía en firmas ni datos de configuración enviados por el navegador.

La coincidencia de metadatos es una preparación preliminar: no verifica el contenido del archivo RIP ni reemplaza los controles técnicos del comando de inicio. Antes de ese comando falta cerrar la firma de configuración completa, su vigencia y las restricciones particulares de impresión/corte. La revisión no reserva capacidad, no cambia ETA, no promete un ancho óptimo ni acredita ahorros. La suma de tiempos previstos conserva las duraciones existentes; si falta una, se indica que los datos están incompletos.

**Pendientes para cerrar Colas:** inicio/cierre atómicos e idempotentes; excepciones con nota y porcentaje; reanudación y remanentes; coherencia ETA y autorización de impacto sobre compromisos; invalidación entre vistas; pruebas de concurrencia y carga. La preparación no da estos puntos por terminados.

### Trabajo técnico necesario

**Base común implementada (11/09):** el comando individual del Tablero y el nuevo núcleo interno `accionesPasos` usan la misma transición. Permiten confirmar de 1 a 50 operaciones de distintas OT en una sola transacción; un fallo revierte estados, progreso, tiempos, eventos y primera finalización. Las autorizaciones y aprobaciones se leen dentro de esa transacción. Esta base conserva las reglas vigentes de registro y no habilita por sí sola tandas de máquina. Detalles y evidencia en [Ejecución atómica para tandas](produccion-ejecucion-atomica-2026-09-11.md).

**Persistencia:** tanda, integrantes e historial de ejecución/cierre; índices por tenant, máquina, estado y paso. Una ejecución compartida F4 conserva su unidad operativa y el alcance sobre sus participantes. No permitir separar silenciosamente sólo un participante al registrar una excepción.

**Comandos atómicos:** núcleo común y bloqueos en orden estable disponibles. Falta envolverlos con persistencia de tanda, membresía e idempotencia del comando de tanda. Si un integrante dejó de ser elegible, se revierte la operación completa. No usar un bucle de llamadas HTTP individuales.

**Registro de máquinas:** hoy muchos pasos usan `solo_completar`, cuyo comando rechaza iniciar/pausar/continuar. Resolver esa limitación explícitamente para las tandas; no alterar sólo la tarjeta o el cronómetro de una persona.

**Compatibilidad:** misma máquina física y configuración efectiva de producción. Material, tecnología y color distintos no se mezclan; respetar perfil, caras y restricciones particulares. Un grupo visual de la primera entrega no basta como firma de validación. Datos necesarios desconocidos impiden confirmar una mezcla. Las diferencias de ancho siguen visibles y no significan que Grafoprint haya validado recomponer esos archivos sobre otro rollo.

**ETA:** una tanda organiza la ejecución; no elimina automáticamente preparaciones, consumos ni duraciones cotizadas. Reservar cada operación una sola vez, respetando tiempo de máquina, atención humana, calendarios y dependencias. Durante la ejecución, los sucesores de una tanda esperan su cierre conjunto. Al cerrar con excepciones, los completos pueden avanzar y los pendientes conservan su bloqueo.

**Porcentajes:** preservar preparación, producción y cierre como fases antes de estimar remanentes. No multiplicar indiscriminadamente todas las fases por el porcentaje faltante. El dato se refiere al trabajo original, mantiene su autor y nota, y no se convierte en unidades producidas verificadas.

**Compromisos:** revisar el efecto de esperar al cierre conjunto. Si agrupar perjudica una entrega, presentarlo antes de confirmar y registrar quién lo autorizó. Nunca cambiar en silencio una fecha comprometida ni permitir una incompatibilidad técnica mediante esa autorización.

## 4. Validación de esta entrega

Entrega inicial: **22 pruebas de backend** y **3 de frontend**. Con preparación: **43 de backend** (incluyen diez integraciones con PostgreSQL en la base de pruebas) y **8 de frontend**.

- Material, color por paso, formatos mixtos y formatos efectivos de ejecución compartida.
- Geometría diferida no accedida, snapshot comprimido y respuesta de prueba menor a 10 KB sin CAD ni precios. Ese límite corresponde al fixture, no es una promesa de tamaño para todas las páginas.
- Dependencias DAG entre componentes, secuencia histórica, gates y estados de ejecución.
- Máquinas del mismo nombre, exclusión de participantes, paginación, lectura sin cambios de estado y aislamiento entre tenants.
- Componentes históricos recuperados desde la cotización del padre, hermanos que reutilizan la misma ruta, componentes anidados, código inexistente y prioridad del cálculo propio.
- Orden descendente por cantidad de trabajo y desaparición de una máquina al completar todas sus operaciones.
- Agrupación de diez trabajos a 1,37 m, uno a 1,05 m y separación por color; etiquetas de lote y fecha comercial sin desplazamiento horario.
- TypeScript de frontend y API de producción, lint focalizado y guardia CSS.

En la validación inicial no había sesión en el navegador de prueba. Posteriormente se verificó la consulta con una sesión real de Chrome: filtros, búsqueda, cambio de máquina y estados vacíos, además de la composición a 1280/390 px. La preparación se revisó con el Lote A de OT-2026-0054; conserva el corrugado de 860 × 564 mm, CMYK + blanco y su layout. No se iniciaron ni modificaron órdenes reales.

**Corrección del entorno local (18:30):** la API estaba ejecutando `node dist/src/main.js` con la compilación de las 16:04, anterior al controlador nuevo. Eso producía `Cannot GET /api/produccion/colas` aunque las pruebas del código fuente pasaran. Se recompiló la API y se reemplazó ese proceso por `npm run start:dev`, con recarga de cambios. Se verificó el registro de ambas rutas y la respuesta HTTP de autenticación (401, en lugar de 404). La lectura directa del servicio compilado sobre los datos locales devuelve 16 máquinas y 22 operaciones, sin modificar registros. También se ajustó la página para ocupar el ancho disponible. El control de la ruta en el proceso activo forma parte del cierre de esta entrega.

A las 18:30:57–58, las peticiones autenticadas de la aplicación al listado de máquinas y al detalle de una cola respondieron **200**, en 85 ms y 130 ms respectivamente. Esto verifica la conexión de la pantalla con la API activa; no sustituye una revisión visual completa ni una prueba de carga.

**Ajustes de lectura y presentación (18:43):** la OT-2026-0052 conserva Lona Backlight, ancho 1,37 m y CMYK dentro del componente de su cotización padre. La nueva lectura lo recupera correctamente. La lista local muestra ocho máquinas con carga 6, 6, 3, 2, 2, 1, 1 y 1. Los servidores de desarrollo quedaron como procesos independientes de la ejecución temporal de herramientas, manteniendo recarga de cambios.

Antes de cerrar la entrega de ejecución conjunta faltan las pruebas de concurrencia, doble clic/reintentos, cambio de disponibilidad al confirmar, permisos de ejecución, cierres con excepciones, herencia de lotes/ejecuciones compartidas, auditoría y paridad ETA API/navegador, además del recorrido visual autenticado.

**Validación de preparación:** 43 pruebas de backend de Colas (incluidas 10 integraciones PostgreSQL), selección de frontend, tipos de frontend/API, lint focalizado y guardia CSS. Se cubren divergencias de material/tecnología/color/perfil/caras/formato/familia, datos ausentes, límites del DTO, cambios de disponibilidad, lectura sin mutaciones, aislamiento y conservación de layouts. El recorrido visual de iniciar/cerrar continúa pendiente porque esos comandos aún no están implementados.


### Revisión del impacto de una tanda (11/09, 20:25)

«Preparar tanda» ahora muestra cuándo terminaría cada impresión, cuándo se liberaría el conjunto a la etapa siguiente y el efecto sobre las entregas del taller. Distingue un cambio que cabe dentro del margen, un atraso previo y una demora adicional que supera el compromiso. Compara la producción completa de cada producto/lote, no sólo la impresión. No crea ni inicia una tanda ni reprograma fechas.

La comparación ocupa la posición del primer trabajo seleccionado y conserva lo que podía producirse antes. Un solo integrante conserva exactamente la proyección actual. Las preparaciones y tiempos cotizados permanecen completos, con la misma ocupación humana y de máquina. El cálculo ocurre fuera de la transacción de lectura y no recupera snapshots CAD ni escribe metadatos históricos; una atención ausente se mantiene orientativa.

Detalles, casos validados, límites y pendientes en [Revisión ETA de tandas](produccion-tandas-revision-eta-2026-09-11.md). La persistencia del inicio/cierre y las excepciones todavía no están disponibles en la interfaz.
