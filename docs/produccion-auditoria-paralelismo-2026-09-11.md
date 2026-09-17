# Auditoría de paralelismo y capacidad del ETA — 11/09/2026

Análisis solicitado antes de modificar el sistema. Se consultaron las 11 OT abiertas, sus 22 ítems ejecutables, 41 pasos materializados (40 pendientes y uno hecho), estaciones, equipos, calendarios, reservas y cotizaciones congeladas. La vista de Planificación confirmó 40 de 40 operaciones con fecha. Las simulaciones usaron el motor del código actual y una hora fija, 11/09/2026 09:46:22, en America/Argentina/Buenos_Aires, para contrastar la captura. No se modificaron código de aplicación, configuraciones ni órdenes.

## 1. Causa comprobada del caso UV / ecosolvente

La OT-2026-0057 imprime en ecosolvente y no tiene un predecesor UV. Está esperando capacidad compartida, no una dependencia productiva entre esas órdenes.

Hay dos restricciones acumuladas:

- **Estación:** Impresion Gran Formato contiene UV Híbrida, Eco-solvente y DTF UV, pero tiene un puesto. El scheduler ocupa ese puesto durante toda la operación, incluso RUN. Aunque el Gantt dibuja filas por máquina, la capacidad continúa siendo compartida y limita a una operación.
- **Personas en órdenes históricas:** las seis impresiones UV no tienen demanda humana materializada. El fallback ocupa una persona durante toda su duración. La ecosolvente sí tiene fases, pero comparte el equipo Impresor de una persona, que quedó ocupado por las UV.

Ejemplo real del lote A: impresión UV de 281 minutos. Su cotización conserva setup=5, run=274,2857, cleanup=1, más redondeo. Hoy reserva 281 minutos de operario, más 5 minutos entre pasos. Interpretando ese desglose, la atención sería aproximadamente 6,71 minutos, más la separación de 5 minutos; el RUN liberaría a la persona. Antes de trasladar esta interpretación a producción deben verificarse las maniobras periódicas que eventualmente estén incluidas en RUN o falten en el perfil.

### Comparación reproducible, exclusivamente en memoria

Se preservaron duraciones, costos, dependencias, fechas comprometidas, equipos, calendarios y reservas. Para aislar la capacidad se representó cada máquina como recurso independiente de capacidad uno, conservando los puestos para los pasos manuales y el mismo equipo humano. Esto es un escenario de diagnóstico, no una migración de estaciones realizada.

| Escenario | Inicio de impresión Eco-solvente OT-0057 |
| --- | --- |
| Configuración y datos actuales | 22/09 16:40 |
| Recuperar sólo las fases desde las cotizaciones | 22/09 15:06 |
| Independizar sólo la capacidad de cada máquina | 22/09 16:40 |
| Ambas medidas | 15/09 15:05 |

En el último escenario la UV de OT-0050 comienza a las 15:00. Termina su preparación a las 15:05 y sigue imprimiendo; el mismo impresor puede iniciar entonces la preparación de la ecosolvente. Ésta termina a las 15:15. No se solapan sus atenciones al operario. La impresión UV conserva sus 46 minutos y la ecosolvente sus 10 minutos.

Las fechas comparativas son orientativas: no resuelven las otras carencias enumeradas abajo ni son una nueva promesa al cliente.

## 2. Cobertura de los datos históricos

De las 40 operaciones pendientes:

- 39 son internas y una corresponde a proveedor.
- 7 internas ya tienen fases de atención válidas; pertenecen a las OT-0055, 0056 y 0057.
- 32 internas no tienen `demandaHumanaJson`. No deben interpretarse como tiempo humano cero: actualmente se reserva conservadoramente una persona por toda la duración.
- Se encontraron los tiempos originales de las 32 en las trazabilidades congeladas de la cotización o del componente/lote. Coinciden por paso de ruta, máquina y duración. El derivador actual admite las 32; eso permite preparar una recuperación sin cambiar precios ni volver a cotizar.
- La recuperación necesita controles por tecnología: por ejemplo, la guillotina antigua sólo guarda un RUN agregado, mientras que el motor nuevo puede separar corte y recargas. No alcanza con que las sumas coincidan para garantizar que un RUN histórico esté libre de maniobras humanas.

Referencia: `src/lib/demanda-humana.ts`, `apps/api/src/eta/motor/demanda-humana.ts` y materialización en `apps/api/src/ordenes-trabajo/ordenes-trabajo.service.ts` (`pasosDesdeTrazabilidad`). No se propone agregar un campo nuevo de atención al operario: se utiliza el desglose originado en la cotización.

## 3. Calendarios que explican esperas reales de esta planificación

| Recurso | Configuración actual | Efecto |
| --- | --- | --- |
| Gran Formato | Martes y jueves, 10:30–12:00 y 15:00–17:15 | La estación habilita 7 h 30 por semana para sus tres máquinas. |
| Equipo Impresor | Lunes a viernes, 13:00–19:00 | La atención coincide con Gran Formato sólo martes y jueves 15:00–17:15: 4 h 30 por semana. RUN sí puede usar la franja matinal de la estación si la operación ya está preparada. |
| Impresión digital de Produccion | Lunes a viernes, 10:00–13:00 | Las Ricoh están limitadas al turno matinal y comparten un puesto, aun siendo dos máquinas. |
| Pre-impresión | Lunes a viernes, 13:00–19:00 | Un archivo preparado aquí no se puede imprimir en digital ese mismo día bajo estos calendarios. La OT-0055 termina preprensa el viernes 11 y recién imprime el lunes 14. |
| DTF Textil | Sólo jueves, 10:00–18:00 | La OT-0056 se programa el jueves 17 a las 10:00. Coincide con la regla de negocio solicitada. |
| Produccion & Taller | Lunes a viernes, 10:00–19:00; dos puestos, siete máquinas | Puede limitar artificialmente a dos operaciones totales, aunque haya RUN autónomos y personas disponibles. |
| Equipos de taller y diseño | También tienen sábado 10:00–13:00 | Sus estaciones actuales no habilitan sábado: ese horario del equipo no abre por sí mismo producción. |

Son configuraciones almacenadas; debe confirmarse si representan la disponibilidad real antes de cambiarlas. La gran extensión de las barras UV proviene también de estas ventanas, no sólo del problema de paralelismo.

Centro de copiado no tiene operaciones en esta cola. Tiene tres máquinas y un puesto, por lo que presenta la misma limitación potencial de capacidad agregada. DTF UV no tiene trabajo en esta muestra, aunque comparte Gran Formato.

## 4. Cuatro ensambles de lotes sin estación

Los ensambles de los lotes A, B, C y D de OT-0054 usan la familia `ensamble_estructural`. Esa familia no está asignada a ninguna estación activa. Que Taller tenga `trabajo_manual` no incluye automáticamente otras familias manuales.

Los cuatro pasos suman 120 minutos. El motor les asigna una fecha orientativa con calendario predeterminado y sin consumir la capacidad del equipo de Taller. La UI los muestra en “Sin estación”. Debe asignarse expresamente el paso sin máquina a la estación correspondiente y recalcular su impacto. Tener “40 operaciones con fecha” no equivale a tener 40 operaciones con capacidad validada.

La duración de 30 minutos para ensamblar cada lote de 50 proviene de un tiempo fijo de la cotización. Validar operativamente ese parámetro sigue siendo necesario; esta auditoría no confirma que 30 minutos físicos alcancen para los 50 exhibidores.

## 5. Dependencias, plazos y otras observaciones

- Los cuatro lotes conservan la secuencia revisión → impresión de sus piezas → corte → ensamble del mismo lote. No se encontró cruce de dependencias entre lotes.
- OT-0057 conserva impresión ecosolvente → refilado → colocación en taller. No depende de la UV.
- OT-0052 conserva las ramas de bastidor externo y lona impresa/refilada, y sólo luego el ensamblaje. El bastidor tiene plazo de proveedor de 10 días hábiles; no consume máquina ni personas del taller.
- Las dos Ricoh no presentan una dependencia entre sí. En el escenario de capacidad independiente pueden arrancar ambas el 14/09 a las 10:00, con los dos diseñadores disponibles. Actualmente la segunda espera hasta las 10:12.
- OT-0053 tiene una revisión vectorial de 15 minutos en el padre y otra de 15 minutos en el componente Polyfan, dependiente de la primera. El motor respeta la receta. Conviene confirmar si son dos trabajos distintos o una preparación duplicada para el mismo diseño.
- Hay 15 pasos pendientes con fechas productivas guardadas de la distribución. Se conservaron en todos los escenarios. Las fechas solicitadas al cliente no fueron modificadas.
- El tiempo entre pasos configurado es de 5 minutos. El motor lo agrega como ocupación de máquina/puesto y una persona, adicional al setup/cleanup cotizado. Debe definirse si representa una tarea humana real distinta, para evitar computar dos veces el mismo cierre o preparación.

## 6. Limitaciones del código relevantes para la siguiente corrección

### Tareas en curso

No hay ninguna tarea en curso en la muestra: las 40 están pendientes. Sin embargo, `src/lib/flujo-produccion.ts:540–589` y su espejo API presentan dos comportamientos que requieren revisión:

1. Al comenzar una operación con RUN autónomo, se sustituye su secuencia por una reserva humana durante todo el tiempo restante, porque el estado no registra la fase actual. El paralelismo se perdería otra vez al iniciar tareas reales.
2. El tiempo restante se obtiene restando minutos de reloj desde `iniciadoEl`, incluso fuera de los turnos. Una tarea iniciada el día anterior puede quedar estimada en el piso de 5 minutos aunque no haya trabajado durante la noche.

La solución debe distinguir lo que se sabe de la ejecución y lo que se proyecta con el calendario y las fases cotizadas. No debe exigir un nuevo campo arbitrario de atención ni cambiar tiempos de costo para acomodar el Gantt.

### Capacidad y explicación de las esperas

El cuello agregado está en la creación de `servers` por `capacidadConcurrente` y su ocupación completa (`src/lib/flujo-produccion.ts:333–342`, `555–603`, `650`). Un carril visual por máquina no cambia ese límite. La máquina debe aportar su propia capacidad; los puestos manuales deben representar capacidad física manual y el equipo debe aportar la capacidad humana compartida.

Existe además una compatibilidad antigua que construye una clave de máquina a partir de centro de costo y familia cuando no hay `maquinaId`. Conviene retirarla al consolidar la separación: un paso sin máquina no debería inventar capacidad de máquina. No se identificó esa compatibilidad como causa del caso UV–ecosolvente.

El detalle del Gantt debería explicar la causa concreta de la espera (máquina, equipo, calendario, dependencia o reserva) y diferenciar atención verificada de fallback histórico. Hoy el texto general dice que la demanda viene de las fases cotizadas, incluso cuando se aplicó el fallback completo.

## 7. Orden recomendado de trabajo

1. Separar la capacidad de máquinas y puestos manuales dentro de las estaciones, conservando equipos compartidos y calendarios.
2. Recuperar y validar las fases de las OT antiguas desde sus cotizaciones congeladas; conservar supuestos explícitos donde falte desglose suficiente.
3. Resolver la proyección de tareas en curso y el descuento de tiempo laboral, para que el modelo siga funcionando después de iniciar producción.
4. Completar la asignación de ensamble y confirmar calendarios y maniobras de los perfiles.
5. Recalcular ETA y propuestas F6 con el nuevo contexto; las propuestas anteriores deben validarse de nuevo. Mostrar motivos de espera en el Gantt.

Validaciones requeridas: UV y eco en paralelo con un impresor; dos Ricoh y dos diseñadores; láser + hilo + tarea manual con dos personas; colocación que ocupe una o dos personas; DTF sólo jueves; cambios de turno, noches y tareas en curso; reserva de capacidad de cada ensamble; dependencias de los cuatro lotes y redistribución F6.

En esta auditoría se comprobaron los cuatro escenarios en memoria: 40 operaciones programadas en cada uno, sin solapar una misma máquina, sin superar la dotación humana en las reservas emitidas y sin adelantar un paso a sus predecesores. Estas comprobaciones no sustituyen una validación de ejecución física ni certifican un óptimo global. Los tests existentes de atención compartida cubren principalmente máquinas en estaciones separadas; debe añadirse la regresión de varias máquinas dentro de una misma estación.

## Anexo: las 40 operaciones actuales

“Histórica” significa sin fases materializadas, no sin trabajo humano. Horarios del escenario actual, orientativos donde falta configuración. Las referencias de lote son las de las entregas A–D; se omite el paso ya completado de revisión del lote A.

| OT | Lote / ítem | Operación | Recurso | Minutos | Atención | Inicio → fin actual |
| --- | --- | --- | --- | ---: | --- | --- |
| OT-0047 | Tarjetas de visita | Pre-prensa / revisión y armado | Pre-impresión | 10 | Histórica | 11/09 13:00 → 11/09 13:10 |
| OT-0047 | Tarjetas de visita | Impresión por hoja CMYK | Ricoh C8003 | 7 | Histórica | 14/09 10:00 → 14/09 10:07 |
| OT-0047 | Tarjetas de visita | Corte con guillotina | Polar 92 ED | 12 | Histórica | 14/09 10:12 → 14/09 10:24 |
| OT-0048 | Acrilico sin impresion con corte laser | Corte láser | Cortadora Laser CO2 | 32 | Histórica | 11/09 10:00 → 11/09 10:32 |
| OT-0049 | Cartel corpóreo en Polyfan | Revisión y preparación del vector | Pre-impresión | 15 | Histórica | 11/09 13:00 → 11/09 13:15 |
| OT-0049 | Cartel corpóreo en Polyfan | Corte con hilo caliente | Cortadora de hilo caliente | 51 | Histórica | 11/09 13:20 → 11/09 14:11 |
| OT-0050 | Vinilo impreso blanco | Impresión por área CMYK | Impresora UV Hibrida | 46 | Histórica | 15/09 15:00 → 15/09 15:46 |
| OT-0050 | Vinilo impreso blanco | Refilado de vinilo | Produccion & Taller | 8 | Histórica | 15/09 15:51 → 15/09 15:59 |
| OT-0051 | Cartel corpóreo en Polyfan | Revisión y preparación del vector | Pre-impresión | 15 | Histórica | 11/09 13:15 → 11/09 13:30 |
| OT-0051 | Cartel corpóreo en Polyfan | Corte con hilo caliente | Cortadora de hilo caliente | 52 | Histórica | 11/09 14:16 → 11/09 15:08 |
| OT-0052 | Bastidor Backlight | Fabricación de bastidor | Proveedor | 10 días hábiles | Plazo externo | 11/09 09:46 → 25/09 09:46 |
| OT-0052 | Lona Backlight | Impresión por área CMYK | Impresora UV Hibrida | 28 | Histórica | 15/09 15:51 → 15/09 16:19 |
| OT-0052 | Lona Backlight | Refilado de vinilo | Produccion & Taller | 6 | Histórica | 15/09 16:24 → 15/09 16:30 |
| OT-0052 | Cartel Backlight | Ensamblaje final | Produccion & Taller | 102 | Histórica | 25/09 10:00 → 25/09 11:42 |
| OT-0053 | Cartel corpóreo Polyfan con frente acrilico | Revisión y preparación del vector | Pre-impresión | 15 | Histórica | 11/09 13:20 → 11/09 13:35 |
| OT-0053 | Acrilico sin impresion con corte laser | Corte láser | Cortadora Laser CO2 | 22 | Histórica | 11/09 13:40 → 11/09 14:02 |
| OT-0053 | Cartel corpóreo en Polyfan | Revisión y preparación del vector | Pre-impresión | 15 | Histórica | 11/09 14:10 → 11/09 14:25 |
| OT-0053 | Cartel corpóreo en Polyfan | Corte con hilo caliente | Cortadora de hilo caliente | 23 | Histórica | 11/09 15:13 → 11/09 15:36 |
| OT-0054 | Lote A | Impresión por área CMYK + Blanco | Impresora UV Hibrida | 281 | Histórica | 15/09 16:24 → 22/09 16:35 |
| OT-0054 | Lote A | Corte láser | Cortadora Laser CO2 | 259 | Histórica | 22/09 16:40 → 23/09 11:59 |
| OT-0054 | Lote A | Ensamble estructural | Sin estación | 30 | Histórica | 23/09 12:04 → 23/09 12:34 |
| OT-0054 | Lote B | Revisión y preparación del vector | Pre-impresión | 15 | Histórica | 11/09 13:40 → 11/09 13:55 |
| OT-0054 | Lote B | Impresión por área CMYK + Blanco | Impresora UV Hibrida | 281 | Histórica | 22/09 16:55 → 29/09 17:06 |
| OT-0054 | Lote B | Corte láser | Cortadora Laser CO2 | 259 | Histórica | 29/09 17:11 → 30/09 12:30 |
| OT-0054 | Lote B | Ensamble estructural | Sin estación | 30 | Histórica | 30/09 12:35 → 30/09 13:05 |
| OT-0054 | Lote C | Revisión y preparación del vector | Pre-impresión | 15 | Histórica | 11/09 13:50 → 11/09 14:05 |
| OT-0054 | Lote C | Impresión por área CMYK + Blanco | Impresora UV Hibrida | 281 | Histórica | 29/09 17:11 → 08/10 15:07 |
| OT-0054 | Lote C | Corte láser | Cortadora Laser CO2 | 259 | Histórica | 08/10 15:12 → 09/10 10:31 |
| OT-0054 | Lote C | Ensamble estructural | Sin estación | 30 | Histórica | 09/10 10:36 → 09/10 11:06 |
| OT-0054 | Lote D | Revisión y preparación del vector | Pre-impresión | 15 | Histórica | 11/09 14:00 → 11/09 14:15 |
| OT-0054 | Lote D | Impresión por área CMYK + Blanco | Impresora UV Hibrida | 281 | Histórica | 08/10 15:12 → 15/10 15:23 |
| OT-0054 | Lote D | Corte láser | Cortadora Laser CO2 | 259 | Histórica | 15/10 15:28 → 16/10 10:47 |
| OT-0054 | Lote D | Ensamble estructural | Sin estación | 30 | Histórica | 16/10 10:52 → 16/10 11:22 |
| OT-0055 | Folletos / flyers | Pre-prensa / revisión y armado | Pre-impresión | 10 | Fases | 11/09 13:35 → 11/09 13:45 |
| OT-0055 | Folletos / flyers | Impresión por hoja Blanco y negro | Ricoh 9003 | 3 | Fases | 14/09 10:12 → 14/09 10:15 |
| OT-0055 | Folletos / flyers | Corte con guillotina | Polar 92 ED | 6 | Fases | 14/09 10:29 → 14/09 10:35 |
| OT-0056 | Film DTF Textil por metro | Impresión por área CMYK + Blanco | Impresora DTF Textil | 7 | Fases | 17/09 10:00 → 17/09 10:07 |
| OT-0057 | Vinilo impreso blanco | Impresión por área CMYK | Impresora Eco-solvente | 10 | Fases | 22/09 16:40 → 22/09 16:50 |
| OT-0057 | Vinilo impreso blanco | Refilado de vinilo | Produccion & Taller | 5 | Fases | 22/09 16:55 → 22/09 17:00 |
| OT-0057 | Vinilo impreso blanco | Colocacion de vinilos · En taller | Produccion & Taller | 15 | Fases | 22/09 17:05 → 22/09 17:20 |
