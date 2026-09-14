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

Producción → Estaciones → Configurar → Empleados de la estación:

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
ventanas laborales y reservas, elige IDs determinísticamente y exige la
dotación completa en cada tramo. Puede haber relevos entre franjas; las
personas elegidas son reservas de planificación, no una asignación operativa
obligatoria. No se implementa seguimiento de fase por persona ni ausencias
fechadas: un calendario semanal vacío representa indisponibilidad semanal.

Las reservas personales son globales entre estaciones. La fase autónoma de
una máquina libera al operario; setup, manejo, cierre y separación conservan
su demanda humana. Las agendas aceptadas guardan IDs y su huella incluye
horarios, elegibilidad y disponibilidad. Una agenda con contexto antiguo no
impone asignaciones personales antiguas: se protege conservadoramente hasta
recalcular. La versión del contexto de propuestas cambia a personas-horarios-v5.

Los pasos sin personas suficientes o sin horarios coincidentes quedan sin
fecha realizable con un motivo; no reciben capacidad inventada. Las tarjetas
y el simulador dejan de mostrar el denominador de puestos en modo personal.
Los snapshots de ese modo usan reservas en minutos-persona para utilización
y la fecha del plan para el horizonte, no el valor histórico de puestos.

Los permisos de ejecución siguen siendo los existentes. Un empleado puede
aportar disponibilidad sin usuario; eso no crea un usuario ni le concede
permisos. Tomar/registrar tareas sigue exigiendo usuario vinculado y permiso
correspondiente; se conserva la excepción de supervisión. Este cambio es del
cálculo de planificación, no un nuevo bloqueo de los botones de ejecución.

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
  distintos, turnos sin coincidencia, relevos, IDs duplicados, personas
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
