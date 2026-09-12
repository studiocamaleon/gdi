# Fechas comprometidas y fin previsto en Planificación — 11/09/2026

## Hallazgo

Se contrastaron en modo de solo lectura las 11 OT activas y 40 operaciones de Grafica Corporearte. El cálculo de referencia usa el 11/09/2026 a las 11:02:16 en la zona del tenant, `America/Argentina/Buenos_Aires`.

No se encontraron diferencias entre las fechas comprometidas de la base y las transportadas al Gantt, desplazamientos de fecha por zona horaria, operaciones con fin anterior al inicio ni sucesores que comiencen antes de terminar sus predecesores en esta muestra.

El ejemplo es OT-2026-0047, Tarjetas de visita. Tiene guardada la entrega para el 08/09 desde antes de esta consulta. Todavía tiene producción pendiente:

| Operación | Proyección |
| --- | --- |
| Pre-prensa | Viernes 11/09, 13:00–13:10 |
| Impresión Ricoh C8003 | Lunes 14/09, 10:00–10:07 |
| Guillotina | Lunes 14/09, 10:19–10:31 |

Pre-impresión está configurada por la tarde y Digital de lunes a viernes de 10:00 a 13:00. La impresión espera la siguiente ventana habilitada. El fin previsto del producto y de la OT es 14/09 a las 10:31; la entrega comprometida continúa siendo 08/09. Esto representa un compromiso vencido, no una nueva entrega prometida.

La guillotina histórica conserva atención humana sin verificar. Por eso el ETA del conjunto sigue siendo orientativo. El aviso de falta de certeza estaba ocultando el aviso de incumplimiento al compartir un único estado excluyente.

## Corrección

- Se evalúan por separado el vencimiento de la fecha comprometida, el fin previsto posterior a esa fecha y la certeza de la estimación.
- El detalle identifica explícitamente **fin previsto** y **entrega comprometida**, tanto para producto/lote como para la OT. Compara las fechas del mismo conjunto de componentes.
- Una entrega vencida o una proyección posterior a la entrega tiene su propio aviso. Puede convivir con el aviso orientativo, que muestra la operación pendiente de verificar cuando se dispone del motivo.
- Los indicadores cuentan primero OT vencidas con producción pendiente, después otras OT cuya proyección supera el compromiso y finalmente las restantes que necesitan confirmar su ETA. Cada OT se cuenta una sola vez; los componentes terminados no generan un aviso de producción pendiente.
- No tener compromiso de entrega ya no se presenta como estar dentro de una fecha comprometida.
- No se modificaron fechas de órdenes, tiempos cotizados ni calendarios.

En esta consulta hay siete OT con compromiso vencido: 0047–0051 (08/09), 0052 (09/09) y 0053 (10/09). La 0054 tiene compromiso futuro, pero la proyección actual lo supera. Los cuatro ensambles de sus lotes ya tienen estación asignada en la configuración actual; eso actualiza el pendiente registrado en la auditoría anterior. Los calendarios restrictivos y el desglose histórico de la guillotina requieren validación funcional del taller y no se alteraron para acomodar el resultado.

## Validación

- 32 pruebas de presentación de planificación y fechas ETA, incluyendo fecha vencida con proyección orientativa, misma fecha, ausencia de compromiso y cambio de día en la zona del tenant.
- TypeScript, ESLint de los archivos modificados, `css:guard` y comprobación de espacios del diff.
- Navegador con datos reales: OT-0047 muestra 08/09 como compromiso vencido, 14/09 10:31 como fin previsto y el motivo de la guillotina en un aviso independiente. Los indicadores muestran siete vencidas y una en riesgo.

Esta revisión valida la coherencia de las fechas de la muestra y su presentación; no cierra F6 ni confirma por sí sola todos los parámetros productivos del taller.
