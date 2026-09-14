# Equipos compartidos, estaciones y ETA

> Actualización 14/09: la configuración y planificación por empleados reemplaza
> este modelo al completar cada estación. Este documento conserva el diseño
> anterior; ver [regla vigente y transición](produccion-empleados-horarios-2026-09-14.md).

Actualización: la asignación automática por máquina y la configuración exclusiva de pasos sin máquina están implementadas. Ver [criterio vigente, compatibilidad y pendientes](produccion-estaciones-asignacion-2026-09-10.md).

## Decisión y caso de aceptación

Una estación organiza y recibe operaciones. Una máquina limita su propia capacidad física. Un equipo aporta personas disponibles, y puede atender varias estaciones. Vincular el mismo equipo a cinco estaciones no multiplica sus personas por cinco.

Caso aportado por Lucas:

| Equipo | Personas | Recursos y trabajos que comparten |
| --- | ---: | --- |
| Diseño | 2 | Diseño, láser blanco y negro, láser color |
| Impresión | 1 | UV, ecosolvente, DTF UV |
| Taller | 2 | Corte láser, DTF Textil, laminadora, 3D, guillotina, refilado y colocaciones |

Taller comparte horario. Las colocaciones requieren una o dos personas según el trabajo. DTF Textil produce **todos los jueves**. Los horarios exactos y los tiempos de preparación, limpieza y maniobras todavía requieren validación operativa; los horarios usados en las pruebas son sintéticos.

## Configuración implementada

En Producción → Estaciones se crean equipos con nombre, cantidad de personas, calendario semanal con varias franjas y disponibilidad. Cada estación puede vincularse al mismo equipo. Sus empleados habilitados siguen siendo permisos de ejecución; no multiplican la capacidad del ETA.

Los puestos de una estación representan trabajos físicamente simultáneos. El scheduler exige disponibilidad de puesto, máquina y equipo. Conserva el ruteo existente, cuya prioridad es la máquina real cotizada, luego tecnología y reglas de pasos/familias.

Para DTF Textil conviene una estación específica: calendario de producción sólo los jueves, equipo Taller. Las demás estaciones de Taller conservan sus propios días de producción. Si el jueves es feriado o ya no queda tiempo, el motor avanza a la siguiente ventana disponible; puede continuar un trabajo en otro jueves si excede la capacidad del primero. Este calendario no aplica descuentos de preparación por agrupar OTs ni crea automáticamente una tanda común.

La atención **se deriva de los tiempos existentes de la cotización**, sin otro campo en los perfiles. Se retiró el selector experimental de atención a pedido del usuario:

- Setup, cleanup, tiempo fijo, extras, cargas, recargas, registro de placa y ajustes reservan la dotación del operario.
- La operación automática libera al equipo únicamente cuando la máquina está configurada como autónoma. La operación con operario reserva la dotación durante toda la ejecución. Ver la [configuración por máquina incorporada el 11/09](produccion-operacion-maquina-2026-09-11.md).
- Los pasos sin máquina, como diseño o colocación, reservan personas durante todo el trabajo. Se conserva la dotación cotizada de una o dos personas.

El `runMin` histórico de procesamiento por herramientas incluye manejo, cambios y ajustes además del recorrido. Ahora se conserva internamente una secuencia por placa que separa esos tramos, sin cambiar costo ni minutos. Guillotina conserva las recargas entre ciclos, derivadas de las tandas ya calculadas. El parámetro combinado carga/descarga se reserva como bloque de manejo en el límite del ciclo; no se inventa una división de sus minutos entre ambas maniobras.

Los snapshots antiguos de herramientas que no conservan la secuencia mantienen una reserva conservadora parcial hasta recotizar. Las órdenes emitidas conservan sus tiempos y demanda congelada; este cambio no reescribe órdenes en producción.

## Ejemplos

1. Diseño tiene dos personas. Si ambas están diseñando, las impresiones que necesitan atención esperan. Si una inicia una impresión, podrá atender otro trabajo durante ese tramo.
2. Una colocación de dos horas con una persona deja otra persona disponible en Taller. Con dotación dos, bloquea la capacidad humana completa durante esas dos horas.
3. UV y ecosolvente tienen máquinas distintas pero un mismo impresor. Pueden ejecutar ciclos autónomos simultáneos; sus preparaciones, maniobras y finalizaciones atendidas no se solapan. El motor respeta las reservas de atención futuras, incluida la descarga.
4. Un pedido DTF recibido el viernes se proyecta para el siguiente jueves disponible. Si una colocación ocupa a ambas personas ese jueves por la mañana, DTF espera a que se liberen dentro de esa ventana.

## Recorrido de los datos

1. El motor de cotización genera `demandaHumana`: fases con minutos y personas, sin modificar total de minutos, tarifas ni costo.
2. La OT congela ese dato en cada paso. Editar el perfil no reescribe la ejecución de una orden ya emitida.
3. El ETA recibe los equipos y calendarios actuales junto con la demanda congelada. Reserva personas globalmente entre estaciones, sólo en franjas laborales, y conserva las dependencias de componentes y lotes.
4. La vista comercial y la API ejecutan el mismo algoritmo. Las mediciones por cantidad usadas en Distribuir entregas conservan la demanda humana de su cotización.
5. La agenda aceptada protege también reservas de equipo en otras estaciones. La reprogramación vuelve a simularlas. Cambiar equipo, capacidad o calendario cambia la huella del contexto y exige revisar una propuesta calculada con condiciones anteriores.

La fecha de fin puede extenderse por esperar personas, aun cuando los minutos cotizados no cambien. Un equipo inactivo, una dotación mayor que la disponible o calendarios sin intersección impiden dar una fecha realizable.

## Compatibilidad y límites explícitos

- No se crea ni asigna ningún equipo real automáticamente: faltan horarios y confirmaciones operativas. No se migran estaciones ni se alteran compromisos del cliente por inferencia.
- Las órdenes históricas sin demanda siguen mostrando una previsión conservadora y parcial. No habilitan una reprogramación automática de otras órdenes basada en capacidad no confirmada.
- Las consolidaciones recalculan o concatenan las fases con sus dotaciones cuando sus minutos concilian con la nueva duración. Cuando falta información o no concilian, reservan la dotación máxima conocida y marcan la previsión como parcial; no reutilizan fases con minutos distintos. Una etapa compuesta que agrupa varias máquinas o centros también queda parcial porque no permite demostrar la reserva de todos sus recursos internos.
- Un equipo representa personas intercambiables, con el mismo horario y capacidades para sus estaciones. Cada persona debe contarse en un único equipo. No se implementa asignación individual, pertenencia solapada a varios equipos, ausencias individuales ni combinaciones de equipos para una misma operación.
- El estado en curso no informa qué fase exacta se ejecuta. Se conserva una ocupación humana conservadora; no se libera un operario automáticamente sólo por el tiempo de reloj transcurrido.
- Las reservas antiguas no guardan la distribución exacta de esperas entre fases. Cuando no se pueden reconstruir, se protege conservadoramente su ventana con la dotación máxima.
- El scheduler es determinista y heurístico. Encuentra un plan factible bajo esos datos; no demuestra el óptimo. No se permite editar duraciones en Gantt ni reasignar tareas manualmente entre puestos en esta entrega.

## Validación

Pruebas de paridad navegador/API: dos diseñadores, un impresor compartido, colocaciones de una y dos personas, ciclo autónomo, jueves y feriado, agenda en otra estación del equipo, dotación insuficiente, equipo inactivo, calendarios incompatibles, equipos independientes, cierres e históricos.

Pruebas de integración en base separada: crear y compartir un equipo, editar capacidad/calendario, aislamiento entre tenants, validación de horarios y huella de planificación. Pruebas del motor: el desglose automático conserva exactamente minutos y costo, tanto en un ciclo simple como con recargas y procesamiento por placa.

Resultados de cierre técnico del 10/09:

- Frontend: 121 pruebas aprobadas en siete archivos, incluidas 28 comprobaciones de atención y paridad con API.
- API: 138 pruebas de motor, recargas, herramientas, maquinaria y planificación de entregas aprobadas después de retirar el selector. La verificación previa de integración de equipos, estaciones y aislamiento entre tenants también había sido aprobada.
- Compilación de API y comprobación TypeScript de frontend aprobadas. Migración aplicada en desarrollo local y en la base aislada de pruebas.
- ESLint de los formularios, motor y endpoints nuevos, `css:guard` y `git diff --check` aprobados.
- Formulario de equipos revisado en Chrome: apertura, calendario, desplegables, lectura y cancelación. Se retiró el control adicional de perfiles; se mantienen setup, cleanup y demás parámetros existentes. No se guardaron cambios sobre equipos ni perfiles reales durante esta comprobación.

La siguiente validación operativa consiste en cargar los tres equipos con sus horarios reales, asignar las estaciones y validar tiempos y dotación de los perfiles y productos. Recién con esa calibración se pueden evaluar fechas reales de la gráfica.
