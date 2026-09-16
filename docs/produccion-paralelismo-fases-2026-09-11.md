# Paralelismo de máquinas y fases de operación — 11/09/2026

Implementación del primer bloque acordado después de la [auditoría de planificación](produccion-auditoria-paralelismo-2026-09-11.md). Los tiempos y costos siguen naciendo en la cotización. No se agrega un campo de atención del operario.

## Capacidad productiva

- Cada máquina física, identificada por `maquinaId`, tiene capacidad independiente de una operación. Dos máquinas distintas de una estación pueden funcionar al mismo tiempo.
- Los puestos de la estación limitan únicamente las operaciones sin máquina; la interfaz los identifica como **Puestos manuales**.
- El equipo compartido reserva personas en setup, cleanup, tiempos fijos y maniobras atendidas que contiene la cotización. El RUN autónomo libera esas personas. La máquina conserva su ocupación hasta terminar la operación.
- Se conservan calendarios, dependencias y reservas aceptadas. El tiempo entre pasos sigue reservando el recurso y una persona según la configuración existente.
- Se elimina la inferencia de una máquina por centro de costo y familia. Los pasos manuales no inventan capacidad de máquina.

## Órdenes anteriores

ETA y el tablero recuperan una sola vez la demanda humana ausente desde las trazabilidades congeladas. Se exige coincidencia de paso de ruta, máquina y duración; una coincidencia ambigua no se interpreta como RUN autónomo. No se recupera una tanda consolidada usando el tiempo de un solo participante.

La recuperación consulta por tenant en lotes de 80 pasos y actualiza únicamente `demandaHumanaJson` cuando continúa ausente y las identidades y duración siguen coincidiendo. No cambia precios, cantidades, tiempos cotizados ni fechas comprometidas. Las siguientes lecturas omiten los snapshots de los pasos ya recuperados.

En la muestra real se recuperaron los 32 pasos internos pendientes que no tenían demanda: 31 con fases verificadas y una guillotina histórica con atención conservadora. Esta última no conserva una secuencia que separe cortes y recargas: se mantiene atendida y marcada sin verificar. Sumados los siete pasos que ya tenían fases, hay 38 internos verificados, uno sin verificar y un plazo externo.

## Trabajo iniciado y pausas

Se descuentan los intervalos de ejecución registrados, recortados a los calendarios y al momento actual. Las pausas y horas sin actividad laboral no consumen duración pendiente. Una tarea que ya está en RUN no vuelve a reservar todo el tiempo restante como atención humana ni repite su preparación.

En tareas antiguas sin intervalos se usa el inicio registrado como aproximación. La fase actual es una proyección, no telemetría de la máquina: el detalle lo informa. Agotar la duración estimada no completa automáticamente un paso que el operario todavía no terminó.

## Gantt

La barra conserva su ancho temporal real. Dentro se distinguen **operario en coral**, **RUN de máquina en verde** y **esperas o períodos fuera de horario con rayado**. El tooltip y el detalle muestran las duraciones y la atención sin verificar. La separación entre pasos queda fuera de la barra de la tarea y se incluye en la ocupación de recursos.

También se corrigió el recorrido de las dependencias: el codo ya no sobrepasa el inicio de la tarea sucesora cuando hay pocos píxeles entre tareas. La flecha representa fin del predecesor → inicio del sucesor.

Las propuestas F6 calculadas con el modelo anterior se invalidan por versión del contrato de planificación y deben recalcularse antes de aplicarse.

## Validación

Se contrastaron las 40 operaciones de la misma muestra, manteniendo como referencia el 11/09/2026 a las 09:46:22 en Argentina. La UV de OT-0050 comienza el 15/09 a las 15:00; termina su preparación a las 15:05 y libera al impresor para comenzar la ecosolvente de OT-0057. Ambas máquinas continúan en paralelo, conservando sus duraciones originales de 46 y 10 minutos.

La comprobación de las 40 operaciones, ocho máquinas y cuatro equipos no encontró solapes de una misma máquina, exceso de personas ni dependencias violadas. Las duraciones de los pasos coinciden con la muestra anterior.

Pasaron las pruebas focalizadas de los dos motores, capacidad humana, geometría del Gantt, reservas y planificación de entregas; las integraciones de propuestas, reprogramación y lotes; compilación API, TypeScript del frontend, lint de los cambios y `css:guard`.

## Configuraciones todavía pendientes

Este bloque no cierra F6 ni valida toda la configuración del taller. Siguen pendientes confirmar los calendarios restrictivos de Gran Formato y Digital, asignar estación a los cuatro ensambles de OT-0054 y revisar el desglose histórico de la guillotina. También conviene confirmar los tiempos fijos de ensamble, la doble preparación vectorial de OT-0053 y qué representa la separación de cinco minutos para evitar contabilizar una maniobra dos veces.
