# F6 — Validación integral de entregas y reprogramación

Fecha: 11/09/2026. Rama: `codex/f6-entregas-planificacion`.

**Ampliación posterior:** la [validación SaaS](visual-ilusion-fase-6-validacion-saas-2026-09-11.md)
agrega carga concurrente, optimización exacta del ETA y fallos reales de procesos,
Redis y PostgreSQL. El total acumulado llega a 3.588 pruebas únicas aprobadas;
allí se documenta también el estado actualizado del tipado global de las pruebas.

**Resultado:** recorrido de Distribuir entregas y reprogramación validado con
pruebas automatizadas, navegador, API, worker, PostgreSQL y archivos reales.
Se corrigieron dos problemas antes de repetir las comprobaciones afectadas.
Este hito no cierra los avances cuantitativos ni los despachos parciales que el
usuario decidió postergar, ni el alcance completo de F11.

## 1. Entorno y alcance

- Regresión de API contra `gdi_saas_test`, con aislamiento forzado antes de los
  imports. Las migraciones usan tanto `DATABASE_URL` como `MIGRATE_DATABASE_URL`
  apuntando a esa base.
- Recorrido del catálogo actual contra una copia independiente,
  `gdi_saas_f6_qa_20260911`, API en 3011 e interfaz en 3012. Usuario exclusivo
  de pruebas. Los envíos de notificaciones y los cron de esa API se deshabilitaron.
- Las órdenes y los pasos de fabricación reales no se modificaron para ensayar
  escenarios. La nueva columna de agenda se agregó también a la base local para
  activar la corrección, sin recalcular ni mover órdenes existentes.
- Se preservan los tiempos y precios cotizados. Las acciones de ejecución de
  prueba representan fabricación simulada; no mediciones del taller real.

## 2. Problemas encontrados y correcciones

### Agenda humana que cambiaba al volver a consultar

La reprogramación conservaba el inicio y el fin de cada paso, pero no sus
intervalos precisos de atención humana. Si una máquina terminaba su operación
autónoma y esperaba a que el operario pudiera descargarla, esa espera extendía la
ventana. Al reconstruir la agenda, el caso conservador podía tratar toda la
ventana como trabajo humano. Dos máquinas con esa espera se bloqueaban entre sí
y la consulta devolvía horas distintas de las aceptadas.

Ahora se guardan los intervalos de operario y el fin de ocupación de la máquina,
separados del presupuesto y de las fases cotizadas. Al consultar se recuperan
únicamente si coinciden ventana, demanda, equipos, dotación, calendarios,
separación, zona y feriados. Un cambio de configuración invalida la reserva
antigua. El contexto se serializa de forma canónica porque JSONB puede reordenar
las claves.

Implementación: `agenda-atencion.ts` en ambos motores, campo
`OrdenTrabajoItemPaso.atencionPlanificadaJson`, propagación por ETA/tablero y
publicación transaccional de la reprogramación. Migración:
`20260911153000_f6_agenda_atencion`. Se actualizó la huella de planificación a
`agenda-atencion-preservada-v4`: una propuesta anterior debe recalcularse antes
de publicarse con el nuevo contrato.

Pruebas de regresión: cuatro escenarios API de capacidad compartida, tres
pruebas web de persistencia/JSONB/paridad con API y aserciones transaccionales de
persistencia. El escenario con dos máquinas esperando descarga falla sin esta
corrección y conserva las mismas horas después de aplicarla.

### Margen restante comparado contra la fecha anterior

Cuando la alternativa requería cambiar una entrega, la tabla mostraba la nueva
fecha pero calculaba el margen contra la anterior. Ahora el margen se calcula
contra la fecha propuesta que el usuario está evaluando. El caso que cambia la
entrega al 14/09 verifica dos días hábiles restantes.

### Ajuste de una prueba anterior al contrato de maquinaria

Una prueba de corte daba por autónoma una máquina sin parametrizar. Se reemplazó
esa expectativa por la matriz autónoma / con operario / sin verificar. Se
conservan los tiempos y costos; sólo la máquina explícitamente autónoma libera
personas durante su operación. No se cambió el comportamiento de producción
para hacer pasar la prueba.

## 3. Recorrido del producto real

Producto: **Exhibidor · prueba de archivos y patrones**, 200 unidades.
Orden exclusiva de la copia QA: **OT-2026-0058**.

| Etapa | Comprobación y resultado |
|---|---|
| Cotización | Worker real: 128 placas, 5 layouts y 1.800 piezas. Precio final $2.665.944. |
| Distribuir antes de guardar | Se ingresan cuatro entregas; se generan cuatro filas de 50. El cálculo conserva layouts completos y muestra el costo adicional de fabricar por entrega. |
| Conservar nesting | Cada lote usa 25/4/1/1/1 copias de los cinco layouts: 32 placas. Los cuatro suman las 128 originales. |
| Guardar elección | Cierra el modal, muestra la tabla de lotes y cambia el acceso a Editar distribución. |
| Cambiar cliente | Se cambió a Imprenta Imagen antes del guardado. Se conservaron las cuatro entregas y la fabricación. |
| Guardar borrador | Cuatro lotes de 50, total 200, sin pasos ejecutables ni reserva productiva publicada. |
| Reabrir y recalcular | Detecta el contrato anterior como desactualizado y permite recalcular. |
| Fecha imposible con trabajo iniciado | No ofrece mover la OT que ya estaba en producción. No habilita una alternativa inviable. |
| Escenario reprogramable | En la copia QA se preparó una variante con el trabajo competidor todavía pendiente. Se calcularon fechas y movimientos de esa OT. |
| Aceptación explícita | La opción que cambia compromisos sólo se habilita después de aceptar ese impacto. Guardarla en borrador no mueve la otra OT. |
| Emitir | Publica lotes, agenda de ambas órdenes y fechas aceptadas en la misma transacción. Quedan 16 pasos ejecutables, cuatro por lote. |
| Consultar otra vez | Cero diferencias entre ventanas publicadas y simulación del contexto persistido al mismo instante de referencia. |
| Capacidad | Máximos observados: taller 2/2 personas, impresor 1/1, diseñadores 2/2. Sin sobreasignación. |
| Archivos | 20 SVG y 20 DXF generados con los exportadores y endpoints reales, uno de cada formato por layout/lote. |
| Impresión y corte | Posición, rotación, pieza y placa coinciden entre ambos. En impresión no se ofrece la descarga de archivos de corte. |
| Gantt | Por recursos y por órdenes; filtro de OT, lotes A–D, detalle de fases y dependencias del mismo lote. El hito del lote A coincide con el 25/09. |
| Ejecutar | La API rechaza ensamblar antes de completar dependencias. Se ejecutan los 16 pasos, respetando su orden. |
| Finalizar | Progreso 25/50/75/100 %. La OT sólo pasa a finalizada después del cuarto lote. Precio final conservado en todos los pasos. |

Las fechas finalmente elegidas en el escenario fueron 25/09, 15/10, 22/10 y
26/10. La fecha final de OT es el 26/10. Son resultados de la configuración de
la copia y del instante de prueba, no fechas nuevas comprometidas a un cliente.

Cada lote tiene exactamente 50 cuerpos, 50 soportes, 50 faldones, 200 estantes,
50 costillas y 50 headers: **450 piezas que componen 50 exhibidores completos**.
No se validó solamente el número de placas: también la demanda por tipo de pieza
y su conservación en impresión/corte.

Evidencia en [`output/f6-validacion-integral-2026-09-11`](../output/f6-validacion-integral-2026-09-11):
`borrador-real.json`, `emision-real.json`, `archivos-real.json`,
`ejecucion-real.json` y carpeta `archivos/`.

## 4. Matriz adicional de reprogramación y persistencia

Las pruebas automatizadas cubren:

- Reprogramar producción consumiendo margen hábil sin cambiar la promesa.
- Priorizar conservar todas las entregas antes que mover menos trabajos.
- Informar y aceptar las fechas que sí deben cambiar.
- Excluir trabajos y rechazar opciones que dependan de ellos.
- No mover trabajos iniciados, ni tratar una cola sin calendario como viable.
- Considerar la competencia por operarios aunque las máquinas sean distintas.
- No reservar capacidad al calcular ni al elegir en un borrador.
- Aplicación atómica e idempotente; emitir directamente o desde borrador.
- Vencimiento de propuestas y cambios de capacidad, fuentes o revisión.
- Trabajo iniciado concurrentemente: esperar el bloqueo, releer y revertir todo
  si dejó de ser reprogramable.
- Dos guardados simultáneos: una sola OT; sin duplicar lotes, rutas ni contador.
- Aislamiento entre tenants y control de permisos.
- Cambiar cliente/precio conserva una fabricación equivalente; cambiar cantidad
  o receta no hereda una distribución incompatible.
- Retirar una distribución pendiente restaura rutas y fechas originales.
- La fecha final considera todos los ítems comerciales, incluidos los que no
  tienen entregas parciales.
- Fechas civiles, zona horaria, fines de semana y feriados.

## 5. Regresión y compilación

| Comprobación | Resultado |
|---|---|
| API completa | 2.630 pruebas y 10 snapshots aprobados; 12 optativas se ejecutaron aparte. |
| Optativas de catálogo | 5 aprobadas: fuentes históricas, OT y ejecución de exhibidor/backlight. |
| Redis y benchmarks | 4 optativas aprobadas: snapshot grande por worker/Redis y tres benchmarks placa/rollo. |
| Puma con motor nativo | 3 repeticiones aprobadas: ocho piezas en dos placas. También pasa la validación geométrica del fixture, ya incluida en la suite general. |
| Interfaz | 886 pruebas aprobadas. |
| Runners Python | 31 pruebas aprobadas: selección/reducción de layouts, límites de procesos y supervisión del motor nativo. |
| TypeScript, lint de los archivos corregidos y CSS guard | Aprobados. |
| Build API y build web de producción | Aprobados. Web compilada en copia aislada para conservar el servidor de desarrollo del usuario. |

Total de pruebas únicas API + web: **3.528 aprobadas**, incluyendo las optativas.
Con las 31 pruebas Python, el total es **3.559 aprobadas**.
Los tests de escenarios del margen se repitieron después de la última corrección.

### Ampliación: respuesta a las parametrizaciones

Por aclaración del usuario, los valores actuales son ejemplos de desarrollo.
El criterio de aceptación es que guardar un parámetro produzca el cambio esperado
en ETA y Planificación. Calibrar esos valores con mediciones del taller real no
es un requisito de cierre de este incremento.

Se incorporaron **19 pruebas de integración** en
`apps/api/src/eta/parametrizacion-planificacion.integration.spec.ts`. Cada caso
crea un tenant aislado en PostgreSQL de pruebas, persiste su configuración,
vuelve a leerla mediante `EtaService.contextoSimulacion` y verifica la proyección.
Las estaciones, los equipos, los feriados y la configuración general se guardan
mediante sus servicios reales. Los modos de máquina, la zona y las duraciones de
ejemplo se preparan en la base como fixtures; esto no sustituye una prueba de sus
formularios. No se modificaron los parámetros del tenant del usuario.

| Parámetro | Efecto comprobado |
|---|---|
| Apertura de estación | Pasar de las 09:00 a las 11:00 desplaza dos horas los trabajos, conservando sus minutos cotizados y fechas comprometidas. |
| Horario del equipo | Las fases humanas se ubican en la intersección con el horario de la estación. Sin intersección no se presenta una fecha confirmable. |
| Día fijo y feriado | Producción sólo los jueves: cerrar el jueves 17/09 desplaza al jueves 24/09; quitar el feriado recupera el 17/09. |
| Jornada cortada | Salta el receso y conserva los 100 minutos activos del trabajo. |
| Máquina autónoma o atendida | Con una persona, dos máquinas autónomas pueden operar en paralelo; si ambas requieren atención continua, sus trabajos se serializan. |
| Personas disponibles | Pasar de una a dos permite operar dos máquinas atendidas simultáneamente. Volver a una restaura la restricción. |
| Equipo compartido entre estaciones | Compartir personas introduce competencia entre máquinas de estaciones distintas; equipos independientes permiten paralelismo. |
| Puestos manuales | Un puesto limita a una tarea sin máquina aunque haya dos personas; dos puestos permiten ambas. |
| Máquina física | Aumentar personas o puestos no permite dos trabajos simultáneos en la misma máquina. |
| Dotación de la operación | Una maniobra de dos personas no se agenda con un equipo de una; al ampliar el equipo reserva las dos personas durante esa maniobra. |
| Separación entre pasos | Se respeta la general, la propia y el valor cero, sin aumentar la duración cotizada. |
| Recurso inactivo | Desactivar el equipo, la estación o la máquina retira capacidad confirmada; no se presenta como una programación viable y verificada. |
| Zona horaria | La apertura de las 09:00 se interpreta en la zona del tenant, sin desplazar la fecha civil comprometida. |
| Tiempos de una nueva cotización | Un ejemplo de 160 minutos se proyecta con esos 160 minutos y sus fases humanas exactas. El Gantt no edita tiempos. |
| Margen de entrega | Agregar dos días hábiles con un feriado mueve la entrega sugerida del 14/09 al 17/09, sin mover el fin productivo ni cambiar el costo. |
| Calendario y propuestas F6 | Las nuevas tandas usan el horario vigente y conservan las mediciones de la cotización. |
| Agenda ya publicada | Al volver a leerla conserva las ventanas; reducir el equipo de dos personas a una invalida los intervalos antiguos y elimina el paralelismo incompatible. |

Esta ampliación aprobó **96 pruebas de API y 167 de interfaz/motores**,
incluidas las 19 nuevas y la regresión de reprogramación, persistencia, costos,
fechas y paridad entre motores. La suite completa anterior no se volvió a
ejecutar: sólo se agregaron pruebas y documentación. La cobertura acumulada pasa
a **3.578 pruebas únicas aprobadas** contando las 31 de Python. Lint del nuevo
archivo aprobado. Los resultados de tipos se distinguen por alcance:

- Configuración de producción de API (`tsconfig.build.json`): aprobada.
- Archivo nuevo, sus dependencias y las declaraciones de tipos del proyecto:
  aprobados.
- `tsc --noEmit` global, que además incluye todos los tests: informa 106
  diagnósticos en 43 archivos de pruebas y soporte existentes, sin diagnósticos
  en el archivo nuevo. Son discrepancias de tipado de fixtures y mocks; las
  suites ejecutadas pasan. Ese chequeo global no se declara aprobado y su
  normalización no se incluyó en esta ampliación funcional.

Registros: `parametrizacion-api-final.log`, `parametrizacion-web.log`,
`parametrizacion-typescript-build.log`, `parametrizacion-typescript-prueba.log`
y `parametrizacion-typescript.log`, en la carpeta de evidencia de este informe.

La primera ejecución optativa de Puma usó `python3` del sistema, sin
`compas_nest`, y devolvió la solución de respaldo de tres placas. Repetida con
`OPENNEST_PYTHON=apps/api/.venv-opennest/bin/python` (ruta absoluta al ejecutar),
pasó 4/4 en 14,1 segundos. No se modificaron expectativas ni motor para ocultar
esa diferencia de entorno. Se conservan ambos registros. La ruta del Python
validado quedó configurada en el `.env` local para los siguientes arranques;
ese archivo no forma parte del código versionado.

Durante el cierre hubo un error local `MISCONF` de persistencia de Redis y se
detuvieron procesos de API/worker. Redis volvió a informar persistencia RDB/AOF
correcta. Se reiniciaron API y worker con el build validado y el Python nativo
correcto. No se borraron colas reales ni se deshabilitó la persistencia para
sortear el error.

La API y la interfaz QA quedaron detenidas y sus pestañas cerradas. Se conserva
la base aislada para reproducir la evidencia. El control de Docker Desktop
dejó de responder: se solicitó detener el Redis efímero de pruebas en 6387, pero
no se pudo confirmar la eliminación de su contenedor. Esta limitación de limpieza
se registra en `limpieza-redis-qa.log`; no se reinició Docker completo para no
interrumpir los demás servicios. Redis real en 6379 volvió a responder con
persistencia correcta, y API/worker locales quedaron activos.

## 6. Tamaño, límites y cierre del alcance acordado

La revisión de reprogramación del caso real ocupa **247.357 bytes** de JSON.
La geometría no se adjunta repetida a las alternativas. Las fuentes productivas
pesadas siguen comprimidas y compartidas por cantidad/revisión; cada archivo CAD
contiene la geometría correspondiente a su layout.

Esto verifica tamaño y funcionamiento de este caso, pero no es una prueba de
carga con cientos de usuarios simultáneos. Tampoco certifica el óptimo global
del nesting ni prueba físicamente impresoras/controladores.

La configuración observada en la copia explica parte de las fechas extensas:

- Gran Formato produce martes y jueves, 10:30–12:00 y 15:00–17:15.
- Su impresor está disponible de lunes a viernes, 13:00–19:00. Las maniobras
  que requieren persona y máquina sólo coinciden en el turno de la tarde.
- DTF Textil está limitado a los jueves.
- El producto conserva 15 minutos fijos de revisión del vector y 30 minutos
  fijos de ensamble para todas las cantidades evaluadas. La UI lo advierte.

No se alteraron estos parámetros. Son ejemplos de desarrollo, según confirmó
el usuario. Se verificó que el sistema respete su efecto en las fechas y la
capacidad; sustituirlos por mediciones reales queda fuera de este hito y no es
un pendiente funcional de F6.

El bloque **Distribuir entregas + reprogramación** queda validado en este
alcance. Continúan postergados, por decisión del usuario, cantidades buenas y
rechazadas, transferencias, genealogía de divisiones/fusiones y despachos
parciales con saldos. La reasignación manual del Gantt y el resto de F11 tampoco
se declaran implementados por esta validación.
