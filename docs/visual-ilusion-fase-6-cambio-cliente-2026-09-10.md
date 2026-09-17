# F6 — Conservar entregas al cambiar el cliente

Se corrigieron tres puntos del mismo recorrido:

- Antes del primer guardado, la huella del formulario incluía `clienteId`, por
  lo que impedía guardar una distribución ya elegida. Ahora compara la fabricación
  por separado y conserva cantidades, fechas, revisión y elección.
- El guardado utiliza una cotización comercial del cliente actual. La transacción
  verifica equivalencia productiva con el origen del plan antes de cambiar su
  vínculo: receta, entradas, componentes, materiales, recursos, tiempos, costos
  y layouts. Sólo excluye precios y telemetría del cálculo. Cambiar el diagnóstico
  de un nesting reutilizado no cambia su fabricación.
- En una OT persistida, la edición directa del cliente enviaba una relación
  `connect` a `updateMany`, que sólo admite campos escalares. Se corrigió para
  cliente y vendedor. Las dos vías de edición conservan la huella de un plan válido
  cuando sólo cambia el cliente y los demás datos comerciales; no renuevan el ETA
  ni rehabilitan una fuente productiva que ya había cambiado.

No se omiten las comprobaciones de empresa, cliente actual, versión, cantidades,
producción ni vigencia del escenario. Si la fabricación o la cola realmente
cambiaron, sigue siendo necesario revisar la distribución.

Validado en base de pruebas separada: primer guardado con cuatro entregas y
precio diferente para el nuevo cliente, bloqueo ante otras piezas y ambas vías
de edición de una OT guardada. Pruebas unitarias comprueban máquinas, tiempos,
layouts, cantidades, archivos, costos y período, además de precios y telemetría.
Regresión de reprogramación, TypeScript, compilación, ESLint focalizado y CSS.

No requiere migraciones. No se modificaron OTs reales ni se realizó commit/push.
