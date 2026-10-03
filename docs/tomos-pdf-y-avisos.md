# Tomos PDF y avisos de la OT

## Uso

1. En Centro de copiado, cargar los PDF y elegir las páginas de cada original.
2. Seleccionar los documentos y pulsar **Crear tomo**. No requiere una anilladora; Anillado sigue siendo una terminación opcional. Se conserva la capacidad de plan `terminaciones_copiado` requerida por los tomos.
3. Cambiar el orden con las flechas y elegir los juegos. **Ver PDF del tomo** muestra y permite descargar un único juego, conservando los rangos elegidos. Las copias se indican al imprimir.
4. En doble faz, cada original impar recibe un reverso en blanco, incluido el último: el siguiente original o juego comienza en frente. En simple faz no se agregan blancos. Se conserva tamaño, área visible y rotación de las páginas.
5. Después de guardar, el mismo acceso aparece en **Archivos** de la OT; los originales quedan agrupados en un desplegable. Al editar se vuelve a generar la vista desde los originales y la selección vigente.
6. Para separarlos, editar la carga en **Centro de copiado** y pulsar **Deshacer tomo** en su encabezado. Cada documento conserva su original, rango, papel, color y caras; los juegos actuales pasan a ser las copias de cada documento. Las terminaciones del conjunto dejan de aplicarse y el precio se recalcula como documentos separados, con sus preparaciones individuales. Pulsar **Guardar cambios** y guardar la OT para persistirlo.

El PDF unificado se genera al solicitarlo, sin una nueva copia permanente en el almacenamiento. No se exportan las contraseñas ni credenciales del depósito al navegador. Los originales de órdenes guardadas usan las consultas y descargas autorizadas de Archivos.

Los archivos protegidos o inválidos se rechazan con un mensaje. Word y Excel deben convertirse a PDF para unificarlos. El límite por tomo es 100 MB de originales y 5.000 páginas de salida. No se unifican documentos de simple y doble faz en el mismo archivo: deben separarse. Si cambia papel, tamaño o color, la vista advierte que hay que preparar cada tramo; no amplía las combinaciones admitidas por impresión directa.

## Preparación y precios

Con `cobraSetup` activo, los documentos consecutivos del mismo tomo que comparten máquina, papel, gramaje, tamaño, color y caras pagan una preparación. Los juegos no multiplican ese cargo. Cambiar esa configuración inicia otra preparación. Los documentos sueltos y otros tomos mantienen sus propias preparaciones. Con `cobraSetup` desactivado, no se cobra ninguna.

La regla se aplica tanto a la cotización previa como al compuesto que se guarda y al resumen de precios del Centro de copiado. No modifica retrospectivamente cotizaciones históricas; se aplica al cotizar de nuevo. El anillado conserva su cálculo separado por juego.

La edición mantiene la procedencia de cada documento. Si se divide un tomo guardado, el traslado de archivos sigue siendo único por ítem de origen; los otros destinos conservan copias privadas de sus originales para el guardado habitual. No se debilitan las restricciones de pertenencia de archivos a una OT. Las cargas nuevas con nombres repetidos reciben un sufijo para no reemplazar otro original.

## Interfaz

- El aviso de modo de inicio se muestra únicamente en **Materiales** dentro del formulario de OT. Usa colores, tipografía y superficies de Grafo, sin el Alert anterior. La configuración del modo continúa en Inventario → Stock.
- El Asistente de impresión inicia oculto. Emitir, recibir otra orden o completar la cola no abre el diálogo ni restaura el widget. La apertura es manual; minimizar o cerrar no detiene el seguimiento de impresión.

## Validación y publicación

Rama `codex/tomos-pdf-y-avisos`, dependiente del PR #17 (`codex/recorridos-permisos-comerciales`). Publicada por pedido de Lucas en staging y producción; no fusiona la cadena de PR. Revisiones, imágenes y verificaciones en los registros de despliegue.

Pruebas locales: cinco suites de API (72 comprobaciones) y cuatro de interfaz/lógica del navegador (32 comprobaciones). Incluyen selección de rangos, orden, blancos y rotación, archivos inválidos, límites, lectura privada, nombres ambiguos, precio de cinco originales en uno y diez juegos, cambios de configuración, asistente oculto y continuidad de impresión. Revisión visual en Chrome con PDF ficticios y el componente real del Centro de copiado. Sin emitir documentos reales ni imprimir físicamente.

La revisión global de tipos excedió la memoria local. La compilación completa con tipos y los dos flujos de CI pasaron en el ejecutor remoto para `e11e431b3`. La vista local de revisión usa precios ilustrativos; además de las pruebas API se verificó el motor real, guardado, reapertura y vista PDF en staging con datos ficticios.

### Corrección posterior: deshacer un tomo

PR #19, rama `codex/deshacer-tomo`, dependiente de #18. Publicado en staging y producción con web `061a75873`; API y workers conservan `e11e431b3`. La acción muestra **Deshacer tomo** y conserva los juegos vigentes como copias de cada documento. Después de separar, guardar el Centro de copiado y los cambios de la orden.

La prueba integrada detectó que, al guardar los documentos separados, se enviaban campos internos del cálculo de materiales y el API rechazaba la operación. El transporte ahora conserva sólo los campos admitidos, sin modificar el estado del formulario. Se agregó una regresión.

Pasaron 23 comprobaciones locales, lint, compilación remota completa y CI. En Chrome staging se reabrió un tomo guardado, se cambiaron diez juegos por siete, se separó, guardó y recargó. Ambos documentos conservaron rangos `1,3,5` y `2`, doble faz, siete copias y sus originales de cinco páginas. Los PDF descargados coinciden byte por byte con los originales. El motor calcula dos trabajos, 21 hojas, 28 carillas y las preparaciones individuales. Datos ficticios retirados; producción comprobada sin guardar órdenes reales. Detalle de imágenes y respaldo en los registros de despliegue.
