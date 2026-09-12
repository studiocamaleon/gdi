# F6 — Revisión de fechas y previsión completa de la OT

Fecha: 09/09/2026. Rama: `codex/f6-entregas-planificacion`.

## Caso reportado y corrección

La captura mostraba fin de producción «hoy 16:39» (09/09) y fecha estimada de
10/09. El tenant tiene **un día hábil de margen**: esa diferencia no era un cambio
incorrecto de «hoy», pero la pantalla mezclaba la fecha de producción y la de
entrega. Ahora separa **Producción lista**, **Entrega sugerida** y el margen, con
fecha absoluta y hora. La fecha que se elige se denomina **Entrega prevista**.

La investigación encontró errores independientes de esa presentación:

- La ficha simulaba sólo pasos activos del producto padre, omitiendo los de sus
  componentes. En el exhibidor de 150 tomaba 45 minutos (preprensa y armado) e
  ignoraba impresión y láser. Ahora incorpora el grafo completo, con habilitación
  e incorporación de componentes, reducción de nodos omitidos, ramas paralelas,
  máquina/tecnología y separación entre pasos. La duración total del nodo ya
  incluye sus operaciones internas: no se agregan dos veces.
- Los trabajos compartidos de componentes se proyectan una vez, con la duración
  del lote y todas sus precedencias. No se copia ni recalcula geometría.
- La fecha recomendada y varias etiquetas usaban la zona del navegador. `offsetDate`
  mezclaba aritmética local con `toISOString`, pasando al día siguiente por la noche.
  Ahora las operaciones de calendario usan claves de fecha en la zona del taller.
- Las prioridades del scheduler no recibían `ahora`/`zona` de la simulación. Se
  corrigieron ambos motores; las simulaciones futuras no usan el reloj de ejecución
  para decidir qué está vencido.
- Si parte de una OT no podía estimarse, la ficha conservaba el fin de los pasos
  conocidos y podía recomendarlo. Ahora no recomienda un fin completo inexistente.
- La API aceptaba timestamps en un campo de tipo DATE. Crear/editar OT exige una
  fecha calendario válida y sin hora, también en borradores; evita convertir un
  offset a UTC y guardar otro día. Los instantes de ejecución no cambian.

## Reloj y carga del servidor

`GET /eta/contexto-prevision` usa el tenant de la sesión y el permiso existente
`produccion.ver`. Devuelve sólo el contexto de planificación (sin precios ni
geometrías), el reloj del servidor, zona, margen y separación entre pasos.

La ficha usa ese contexto y lo renueva cada minuto mientras está montada. Sustituye
las cinco peticiones previas por una petición de contexto; el servicio comparte la
lectura que ya emplea ETA. No modifica compromisos ni crea reservas. Una fecha
que el usuario cambió manualmente se conserva y se compara contra la proyección.

La pantalla mantiene las proyecciones con estaciones/calendarios faltantes como
**condicionadas**, con la explicación visible. No se cambiaron tiempos ni estaciones
del catálogo. El ensamble del exhibidor sigue requiriendo validar sus 30 minutos
fijos y configurar una estación adecuada antes de confiar en esa promesa.

## Evidencia y alcance

- Regresión frontend: 140 pruebas aprobadas (136 de lógica y 4 de
  especificaciones), incluyendo 17 nuevas de fechas y
  proyección del producto compuesto. Usan instantes explícitos, medianoche UTC,
  feriados, fin de año y DST chileno.
- Regresión backend ETA/F6/OT: 182 pruebas aprobadas; otras 4 nuevas prueban el
  contrato de fechas al crear y editar OT y validación nocturna por tenant.
- El fixture real de 150 exhibidores produce cuatro operaciones, conserva ambas
  máquinas y respeta preprensa → impresión → láser → armado. En un taller de prueba
  vacío, con todas las estaciones L–V 08–17 y sin margen, comenzar el 09/09 a las 08
  termina el 11/09 a las 17. **Es una prueba controlada, no una fecha prometida del
  taller real**, cuya carga y falta de estación de ensamble condicionan el resultado.
- Las 17 pruebas nuevas también pasan ejecutándose con `TZ=UTC`. TypeScript
  frontend, lint (sin errores), `css:guard` y `git diff --check` aprobados.
- La API se compiló y se reinició; health confirma conexión a la base local.
- No se crearon ventas ni OTs de prueba en los datos del usuario. La verificación
  visual autenticada quedó pendiente: la herramienta de navegador no permitió
  inspeccionar la ficha en esta sesión.

## Continuación de F6

La corrección temporal y de alcance productivo es una base necesaria para guardar
planes fiables. La adopción/confirmación sigue pendiente: no se añadió un campo
que aparente reservar capacidad cuando todavía no la reserva.

El próximo bloque debe persistir una revisión trazable (fuentes de cotización,
contexto de capacidad, fecha de cálculo, condiciones, compromisos y lotes), y
revalidarla en backend contra cambios de carga, calendario, receta y cantidades.
La confirmación requiere control concurrente e idempotencia; un plan condicionado
no debe convertirse en promesa firme. Después se conecta «Distribuir entregas» en
la ficha. F5 continúa fuera de este alcance.
