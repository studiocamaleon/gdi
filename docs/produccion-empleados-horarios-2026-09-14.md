# Estaciones: capacidad y horarios por empleado

Implementado el 14/09/2026. Reemplaza la configuración de equipos y puestos
manuales para las estaciones que guardan empleados y horarios.

## Regla acordada

La concurrencia manual depende de las personas disponibles y de la dotación
cotizada del paso. Dos empleados pueden atender dos pasos de una persona o
un paso de dos personas. No existe un límite físico adicional de puestos en
el modo personal. Las máquinas conservan su propia capacidad y sus fases
atendidas/autónomas. Los minutos, costos y dotaciones congelados en la OT no
se reescriben.

## Configuración

Producción → Estaciones → Configurar → Personal asignado:

- Buscador primero, lista de personas debajo, botón de horario junto a quitar.
- Cada empleado tiene un único calendario laboral, con varias franjas por día,
  compartido entre todas sus estaciones. El modal lo informa antes de editar.
- Copiar un horario es una acción explícita: de otra persona, del equipo
  anterior o de la estación. No se crean horarios ni personas por inferencia.
- Aplicar horario modifica el borrador. Guardar estación persiste las
  asignaciones y los horarios editados en la misma transacción. Cancelar
  descarta el borrador. Quitar una asignación no borra el horario personal.
- Desaparecen el botón Equipos, su editor, el selector de equipo y Puestos
  manuales. Se retiraron el componente y el CSS local sin consumidores.
- El calendario operativo de la estación sigue definiendo cuándo produce:
  por ejemplo DTF sólo los jueves. Se intersecta con el horario de cada persona
  y respeta los feriados/cierres del taller. Se conserva Tiempo entre pasos.
- Los listados de pasos, máquinas y empleados mantienen el límite de 224 px
  o 32 dvh, con desplazamiento interno y encabezado/buscador por fuera.

## Planificación

`capacidad-personal.ts` es un algoritmo puro espejado en frontend y API. Barre
ventanas laborales y reservas, elige primero a las personas libres con menos minutos planificados y exige la
dotación completa en cada tramo. El desempate por ID mantiene un resultado
determinista. La dotación se elige una vez por paso y se conserva entre fases y
jornadas. Si cambia la cantidad requerida, se conserva el núcleo de personas y
se suman integrantes de esa misma dotación. El reparto se publica
automáticamente como asignación operativa por paso/persona/franja; no requiere
un botón general de Aplicar plan. No se implementa seguimiento de fase por persona ni ausencias
fechadas: un calendario semanal vacío representa indisponibilidad semanal.

Las reservas personales son globales entre estaciones. La fase autónoma de
una máquina libera al operario; setup, manejo, cierre y separación conservan
su demanda humana. Las agendas aceptadas guardan IDs y su huella incluye
horarios, elegibilidad y disponibilidad. Una agenda con contexto antiguo no
impone asignaciones personales antiguas: se protege conservadoramente hasta
recalcular. La versión del contexto de propuestas es personal-estable-por-paso-v8.

Los pasos sin personas suficientes o sin horarios coincidentes quedan sin
fecha realizable con un motivo; no reciben capacidad inventada. Las tarjetas
y el simulador dejan de mostrar el denominador de puestos en modo personal.
Los snapshots de ese modo usan reservas en minutos-persona para utilización
y la fecha del plan para el horizonte, no el valor histórico de puestos.

Los permisos de ejecución siguen siendo los existentes. Un empleado puede
aportar disponibilidad sin usuario; eso no crea un usuario ni le concede
permisos. Registrar tareas sigue exigiendo usuario vinculado, habilitación en la estación
y permiso correspondiente. Una asignación automática válida habilita a su
personal sin reclamar una mesa. Se conserva la excepción de supervisión.
La asignación prevista no se convierte en asistencia ni en trabajo real: los
tramos y eventos siguen registrando al usuario que ejecutó la acción.

## Transición de datos existentes

La migración agrega `Empleado.calendarioProduccionJson` y
`Estacion.planificacionPorEmpleados`, inicialmente false para datos anteriores.
No modifica cantidades, personas, estaciones, órdenes ni fechas comprometidas.

Los equipos anteriores no registraban miembros. Por eso una estación anterior
conserva su cálculo hasta que el usuario guarde sus empleados y horarios. El
formulario explica esa transición y permite copiar el horario anterior.
Una estación nueva usa el modo personal desde el formulario. Una estación ya
migrada no puede regresar al modo anterior mediante un cliente antiguo.

Se conservan las tablas, campos y endpoints anteriores como compatibilidad.
`equipoProduccionId` de una estación migrada mantiene sólo su procedencia para
coordinar la transición, aunque el equipo ya no gobierne su calendario o su
capacidad. Las reservas personales descuentan cupos del equipo anterior en
estaciones pendientes de migrar; las reservas anónimas anteriores bloquean
conservadoramente a sus miembros ya identificados. Esto evita sumar capacidad
anterior y personal, a costa de poder sobreestimar esperas durante la transición.
Conviene completar juntas las estaciones que compartían personas.

## Verificación

- Pruebas en ambos motores: dos trabajos de un operario, uno de dos, horarios
  distintos, turnos sin coincidencia, continuidad entre jornadas, IDs duplicados, personas
  compartidas, falta de horario, inactividad, jueves/feriados, fases autónomas,
  agenda aceptada y transición con reservas anteriores.
- Integración en `gdi_saas_test`: horario compartido, persistencia atómica,
  validación, aislamiento entre empresas, retiro de asociación sin borrar
  horario, transición explícita y huella de planificación.
- Pruebas anteriores de capacidad humana, agenda, flujo, estaciones y snapshots.
- Navegador: escritorio y 390 px, copia de horario, edición de hora con control
  nativo, aplicación al borrador, guardado habilitado sólo con datos completos,
  scroll del modal y cancelación. No se guardaron empleados/horarios reales.
- Migración aplicada en desarrollo local y en la base aislada de pruebas.

## Publicación automática del reparto

`EtaService.sincronizarAsignaciones` corre el mismo motor en la API. Se invoca
post-commit al emitir una OT, ejecutar pasos o modificar un reclamo manual.
Una reconciliación cada 30 segundos cubre cambios de horarios, personal,
configuración, edición/cancelación de órdenes y procesos externos, incluso sin
navegadores abiertos. La caché de contexto evita repetir la simulación dentro
del mismo minuto si los datos no cambiaron; los GET de Lista no publican planes.

El resultado se guarda en `OrdenTrabajoItemPaso.asignacionPersonalJson`, separado
de `atencionPlanificadaJson` y de las fechas aceptadas por F6. No modifica costos,
dotaciones, minutos cotizados, compromisos de entrega ni registros de ejecución.
La transacción serializable publica un contexto consistente por empresa y
reintenta conflictos de concurrencia; sólo escribe repartos que cambiaron.
No procesa órdenes terminadas ni consulta su historial para llenar la Lista.

Los reclamos manuales existentes conservan a su persona y el motor completa la
dotación restante. Los pasos iniciados mantienen su personal previsto y a quien
tiene el tramo real abierto: si termina su horario, el trabajo pendiente espera
su siguiente disponibilidad. Si un supervisor ejecuta en reemplazo de otra persona,
su identidad real queda en el tramo y entra en la reserva del trabajo iniciado.
Si no existe una franja realizable, se conserva el personal fijado y se publica
un conflicto; no se lo reemplaza silenciosamente por alguien de otra estación.

Lista muestra el personal del paso visible, varias personas cuando corresponde,
origen automático/manual, ejecutor real por separado y conflictos. El detalle
muestra las franjas en la zona del taller. El filtro «Asignadas a mí» incluye
asignaciones automáticas y reclamos anteriores. Colas y tareas de Estaciones
consumen el mismo reparto. La API revalida permisos y empleado/estación al actuar;
no confía en los indicadores de autorización del navegador.

La misma persona atiende preparación, operación atendida, cierre y separación,
aunque haya una fase autónoma intermedia o se termine su turno. Durante la fase
autónoma sigue libre para otro trabajo, respetando sus reservas de cierre.
El fin estimado puede moverse para esperar su próxima disponibilidad. Un paso
que necesita dos personas mantiene las dos; no reemplaza una al cambiar de
jornada. Los relevos reales ya registrados se conservan en la reconstrucción
histórica y no se reescriben. La política `misma-dotacion-por-paso-v1` invalida
reservas de atención calculadas con la regla anterior.
El equilibrio usa minutos planificados de atención (incluida la preparación),
compartidos entre estaciones; no es un ranking de productividad histórica.
Las preferencias por empleado/paso y políticas configurables por empresa quedan
para una fase posterior. Tampoco se agrega un parte de asistencia multioperario:
las reservas de varias personas no fabrican tramos de ejecución para todas ellas.

Las ventanas y reservas calculadas usan milisegundos enteros. Cada duración
positiva se redondea hacia arriba al entrar a la agenda (menos de 1 ms por fase),
sin modificar minutos ni costos cotizados. Esto evita que residuos decimales
sean interpretados como falta de capacidad y dejen al producto y sus sucesores
sin fecha o personal. Las fases autónomas y la atención personal comparten esa
precisión. El diagnóstico distingue una ventana no encontrada de una dependencia
que todavía no pudo planificarse.

La migración `20260914090000_asignacion_personal_automatica` agrega sólo el campo
derivado. Las estaciones anteriores sin planificación por personal mantienen su
operación; no se infieren nombres a partir de la cantidad de personas del equipo.
