# Simulación manual de nesting en Colas

Implementada el 12/09/2026. Complementa la vista de Colas después del retiro de tandas y recomendaciones automáticas.

## Recorrido

1. La cola agrupa por material del catálogo, con su nombre como único encabezado. Cada fila conserva ancho/formato, modo de color, perfil y caras. El impresor selecciona trabajos y pulsa **Simular nesting**. Si mezcla materiales, el botón queda deshabilitado con una explicación visible; la selección sigue disponible para completar trabajos juntos.
2. El servidor obtiene las piezas del cálculo vigente de cada ítem. Los paneles mantienen dimensiones, solapes y la rotación configurada en el producto al cotizar. Se deshace la orientación del acomodo anterior antes de buscar otro.
3. Se consulta la máquina de la cola y se comparan los anchos activos del catálogo del mismo material que admite su ancho útil. Diferentes anchos de variante pueden participar; acabado, espesor y otras características materiales deben coincidir. No se exige igual color, perfil, tecnología, estado ni asignación a mesa.
4. El modal recomienda la alternativa de menor superficie consumida entre las soluciones encontradas. Muestra metros lineales, m², aprovechamiento, dibujo proporcional con OT/panel, otros anchos y los motivos por los que alguno no cabe.
5. El usuario puede cambiar el ancho visualizado y descargar el dibujo como SVG de referencia. No se genera un archivo RIP.

El permiso es `produccion.ver`: es una consulta. Las acciones de iniciar, bloquear y completar siguen teniendo sus permisos y validaciones propias.

## Alcance y conservación

- Rectángulos y paneles **ya calculados sobre rollo** de productos simples. No cambia ni genera panelizados. Los productos compuestos y sus componentes conservan su layout; la relación de componentes en la OT bloquea una nueva simulación tanto en UI como en servidor, incluso cuando el nesting no trae una marca de layout vinculado. Los lotes de un producto simple no se consideran componentes sólo por tener un padre.
- Los layouts registrados/vinculados y las geometrías irregulares no se desarman para inventar piezas rectangulares. Las placas no están habilitadas en esta herramienta.
- Cada pieza conserva el permiso de rotación guardado. Si falta, se informa en lugar de asumir que se puede girar.
- Se resuelven los márgenes actuales de la máquina con las mismas reglas del cotizador: configuración del paso, ajustes guardados de la OT, defaults de la familia y demasía. Si los trabajos requieren valores distintos, se aplica el mayor margen y separación por eje. La demasía se incorpora una sola vez y los márgenes de cabecera/pie se aplican al acomodo conjunto.
- Los anchos proceden del catálogo del material y se descartan los que superan el ancho máximo de la máquina o no dejan espacio útil para todas las piezas. Si falta el ancho útil, se solicita configurar la máquina. No se agregan restricciones de color, perfil o estado; la combinación sigue siendo decisión del impresor. No se asegura stock.
- No hay escrituras en OT, costos, existencias, ETA, pasos, tandas o planificación. Dos operaciones seleccionadas del mismo ítem no duplican sus piezas.
- La recomendación es heurística y compara superficie física consumida, no precio del material ni garantía de óptimo matemático global.

## Implementación y rendimiento

`POST /produccion/colas/:maquinaId/simular-nesting` recibe exclusivamente `{ pasoIds: string[] }`. UUID, duplicados, pertenencia al tenant y a la máquina se validan en servidor. Nunca se aceptan medidas ni permisos de rotación enviados por el navegador.

El listado habitual mantiene su consulta de metadatos. Sólo para los trabajos panelizados de la página hace una lectura adicional conjunta de sus paneles calculados, usando el mismo recorrido de snapshots de OT, cotización y componentes anidados. Prioriza el cálculo de ejecución vigente cuando existe. Proyecta dimensiones e índices; si los placements están comprimidos, utiliza el lector de snapshots y devuelve únicamente las medidas agrupadas. La geometría para dibujar se obtiene al solicitar una simulación. No se envían contornos, costos ni snapshots técnicos en el listado.

La columna **Medidas** muestra únicamente dimensiones y cantidades físicas para producir, con el formato de la OT: `N u. × ancho × alto cm`, una línea por medida. Para piezas sin panelizar usa `jobContext.piezas`, con respaldo de `medidaCustomMm` y cantidad física. En panelizados muestra cada panel del cálculo guardado: deshace la rotación del acomodo y conserva los solapes ya incluidos; no divide la pieza completa para inventar paneles. Las medidas del producto padre y de terminación no se consultan ni se muestran en esta vista. No se usa la cantidad comercial en m² como tamaño ni como cantidad de piezas. Sin medidas verificables se informa el dato faltante, sin reemplazar los paneles por la pieza entera.

Caso OT 0052: la cola muestra `Para producir: 1 pieza · 170 × 120 cm`, según el cálculo de la Lona Backlight. No agrega la medida del cartel terminado ni el `1 m2` administrativo del hijo. La cotización y los tiempos se conservan.

### Relación con el motor de cotización

`simulacion-rollo.ts` es un adaptador al cálculo compartido de las OT: llama a `evaluateRollLayoutForConfiguredAlgorithm` del dispatcher para Shelf, MaxRects o selección automática. Plotter CAD conserva el motor secuencial usado en cotización. Se retiró el packer independiente de Colas. Los motores compartidos admiten ahora una restricción de rotación por pieza, sin cambiar el comportamiento de las OT que usan el permiso global.

`resolveNestingConfig` también es compartido: usa la máquina de la cola, los parámetros vigentes de los pasos y defaults del tenant, con la precedencia habitual de `configPasoRuntime` guardado en la OT. En órdenes antiguas cuya receta ya no está disponible, conserva demasía y separación del resultado guardado; no utiliza sus márgenes como sustituto de los de la máquina actual. Los permisos de rotación y las dimensiones físicas se mantienen desde la cotización. Si varias recetas tienen distintas preferencias de algoritmo, se compara automáticamente Shelf y MaxRects. Los paneles ya incluyen sus solapes y no se repanelizan.

La paridad corresponde a las mismas piezas y reglas de entrada. Al consolidar varias OT cambia el conjunto a acomodar, y por tanto puede cambiar la disposición y el consumo respecto de cada OT por separado. El panelizado previo se conserva, incluso si otro ancho permitiría una división diferente. La cotización de placas dispone de sus algoritmos Grid e irregular, aún sin integración en esta herramienta manual.

El modal identifica la máquina, informa su ancho máximo y los márgenes/separaciones efectivos, y dibuja el área disponible. El contrato de respuesta vive en `simulacion-nesting.types.ts`, separado de las dependencias del motor para la UI.

La identidad del material se resuelve con una consulta de variantes por página, limitada al tenant. La agrupación usa `materiaPrimaId`, nunca el nombre ni el ancho. La habilitación de nesting usa `materialNestingClave`, calculada con la misma identidad de material que el servidor revalida al simular; ignora dimensiones de rollo, pero conserva acabado, espesor y otras características. Sin identidad confirmada se explica el dato faltante. Los grupos reflejan la página y filtros activos.

Límites: 50 trabajos, 1000 piezas/paneles, 30 anchos. El cómputo corre en `worker_threads`, hasta dos simulaciones simultáneas por proceso y una por tenant. Tiempo máximo de 20 segundos y memoria acotada por worker. No se devuelven soluciones que omitan piezas o excedan el ancho.

El modal reutiliza su solicitud si React repite el efecto de apertura; al cerrarse deja de aplicar la respuesta, sin cancelar y relanzar un cálculo que el servidor ya está ejecutando. El servidor comparte sólo cálculos en curso del mismo tenant, máquina y selección de pasos; una selección distinta sigue sujeta al límite. La referencia se libera al terminar o fallar, por lo que un reintento posterior calcula de nuevo con los datos vigentes. No hay caché de resultados terminados.

## Validación

- Pruebas de paridad de posiciones y consumo con Shelf, MaxRects, auto y secuencial; consolidación de 200 piezas con los mismos 28700 mm que cotización. Paneles, orientación individual, márgenes, separación por eje, ausencia de superposiciones, anchos imposibles y lectura de geometría comprimida.
- Integración: cambiar márgenes o ancho útil de la máquina cambia inmediatamente la simulación; los ajustes de la OT mantienen la misma precedencia y la demasía no se duplica.
- Integración en base de pruebas: distinto ancho/color/tecnología/estado del mismo material; aislamiento de tenant y máquina; rechazo de material diferente; sin cambios en los pasos.
- Regresión del listado y de los controles de Colas. Prueba del SVG y del contrato del cliente.
- Consulta real en navegador: OT 0050 + 0059 + 0060, cuatro piezas/paneles en la Impresora UV Hibrida (ancho máximo 1800 mm, márgenes 10/10/100/100 mm). Rollo 1520 mm recomendado: 4400 mm, 6,688 m². Rollo 1370 mm: 4900 mm, 6,713 m². Rollo 1060 mm descartado por el ancho de los paneles existentes.
- Navegador: selección, cálculo, cambio de ancho, detalle de paneles/rotación, descarga SVG y rechazo de materiales diferentes.
- Agrupación por material: 55 pruebas de Colas, selección, extracción y simulación; comprobación en navegador de OT 0050 y 0059 bajo un solo encabezado y bloqueo del botón al sumar la lona de OT 0052. Completar seleccionados conserva la selección mixta y sus validaciones operativas.
- Medición local con el motor compartido, incluyendo inicio del worker (no un SLA): 100 piezas / tres anchos, 920 ms; 1000 piezas / tres anchos, 1117 ms. Se verificó que todas las alternativas contengan todas las piezas. Respuesta de 1000 piezas / tres anchos: 256877 bytes antes de compresión HTTP.

## UI y mantenimiento

El modal adopta la marca clara de Grafo junto con Colas (15/09): papel cálido, métricas técnicas, primer indicador grafito y selección naranja. Combina el diálogo y controles Shadcn existentes con `ActionButton` de HeroUI, propagando el tema a sus portales. Su distribución y scroll viven en `simular-nesting-cola.module.css`, sin estilos globales. El dibujo reutiliza `NestingCanvas`: conserva las posiciones, proporciones y desplazamiento del rollo, con encabezado y cierre accesibles mientras se recorre el contenido. La presentación no cambia el cálculo, la recomendación ni la descarga.
