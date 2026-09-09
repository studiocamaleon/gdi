# Nestings guardados y preparación por cantidad

Implementado sobre `codex/cotizacion-operaciones-herramientas-corte`.

## Comportamiento

En **Producto → Comercial → Nestings guardados**, se pueden preparar hasta 20 cantidades de producto terminado usando las piezas y la configuración guardadas del flujo principal. El motor aplica las cantidades por pieza y la configuración de componentes existentes. El procesamiento continúa en el worker al salir de la ficha, y cada cantidad conserva estado, fecha y errores. Los productos que todavía necesitan archivos o selecciones comerciales deben completar su configuración; el sistema muestra el diagnóstico del cotizador.

Los acomodos vectoriales obtenidos desde cualquier cotización también se guardan automáticamente en PostgreSQL. Se pueden recuperar después de reiniciar la aplicación y sin depender de la retención de trabajos de Redis. La pantalla enumera las preparaciones solicitadas desde el catálogo; la reutilización automática funciona aunque una cantidad no figure en esa lista.

La identidad geométrica incluye contornos, huecos, cantidades, rotaciones permitidas, placa, márgenes, separación, corte común y versión de la política. Excluye nombres, identificadores comerciales, orden de las piezas, semilla y duración de la búsqueda. Un resultado obtenido con más tiempo también sirve al sheet con presupuesto normal. El tenant se mantiene en la clave compuesta de base de datos. IDs canónicos permiten recuperar las posiciones con las identidades actuales, incluyendo las referencias de corte común.

Se guarda el resultado del solver, antes de incorporar las capas, operaciones, propietarios y recursos del producto. El adaptador vuelve a aplicar esa información desde la configuración vigente. Se comprueba nuevamente integridad, transformaciones, límites, solapamientos y separación al recuperar un resultado. Un registro corrupto se descarta. Una indisponibilidad del motor no queda guardada como resultado permanente. La escritura conserva el mejor candidato, con exclusión mutua breve; no mantiene una transacción abierta durante la búsqueda.

Los precios y tiempos operativos se calculan otra vez. Los trabajos de cotización completos dejaron de reutilizarse como respuesta económica; sólo se comparten trabajos en curso. Los nestings tienen su propia persistencia. Los scopes de demandas compuestas incluyen el problema concreto, evitando que una cantidad cancele otra preparación del mismo producto. Se corrigió además el envío de la configuración de corte común al worker en ambos caminos de análisis vectorial.

## Datos y ejecución

Migración aditiva `20260909010000_nestings_guardados`: tablas `NestingGuardado` y `PreparacionNestingProducto`, con pertenencia al tenant y borrado en cascada. Aplicada en desarrollo y en la base dedicada de pruebas. Las preparaciones usan la cola existente de cotización con prioridad inferior a los pedidos interactivos. Una preparación no crea una cotización comercial ni una OT.

## Validación real

Producto **Exhibidor · prueba de archivos y patrones**. Preparaciones de 1 y 50 productos iniciadas desde Chrome; se salió de la sección y se volvió a comprobar que ambos resultados quedaron preparados.

- 1 exhibidor: 5.916 ms para la preparación completa.
- 50 exhibidores: 123.788 ms para la preparación completa.
- Nueva cotización normal de 50: **2.763 ms**, incluyendo cola, costeo y recuperación de resultados.
- Se conservaron **450 piezas en 34 placas**, en impresión y corte.
- Se compararon ambos nestings con todas sus posiciones y metadatos de fabricación. Tolerancia numérica de 0,00000001 mm por representación de punto flotante; no hubo cambios de geometría, capas ni acomodo.
- Todos los buckets de costo resultaron iguales con los mismos recursos y tarifas: costo total 265.937,6290565.
- Los registros del worker confirman `nesting_reutilizado`; la segunda cotización no ejecutó otra búsqueda nativa.

El script `apps/api/test/validacion-nestings-guardados.ts` repite la comparación a través de la cola normal. Requiere el producto real y la preparación de 50 terminada. Se ejecuta desde `apps/api` con `TS_NODE_TRANSPILE_ONLY=true node node_modules/ts-node/dist/bin.js --project tsconfig.json test/validacion-nestings-guardados.ts`. Los resultados y costos corresponden a la configuración local durante esta validación.

Se agregaron pruebas de identidad e invalidación, recuperación desde otra instancia, aislamiento entre tenants, rechazo de resultados corruptos, separación de demandas simultáneas, conservación del corte común y recálculo de cotizaciones terminadas. La UI tiene validación de cantidades y lista con altura máxima y scroll propio. Se verificó la nueva sección en Chrome con estética Grafoprint.

Cierre: 39 pruebas API y 8 pruebas frontend aprobadas, compilación API y TypeScript web correctos, lint de los archivos nuevos y guardia CSS sin errores. Después de reiniciar API y worker con la compilación final, la misma validación de 50 exhibidores terminó en 1.475 ms y conservó los dos nestings y todos los costos.


## Búsqueda ampliada desde Comercial

La preparación anticipada dispone de **hasta 300 segundos por nesting**, mientras la cotización interactiva conserva los **120 segundos** por defecto. Un producto con distintos problemas de nesting o varias cantidades puede necesitar más tiempo total. Si ya se demostró el mínimo de placas, no se consume tiempo adicional por obligación; esto no representa un óptimo universal de recorridos o retales.

La política se activa sólo dentro del job de preparación mediante `AsyncLocalStorage` y viaja explícitamente al worker geométrico como `buscarMejora`. No modifica variables de entorno compartidas ni presupuestos de otras cotizaciones concurrentes. Se respeta el límite de infraestructura `OPENNEST_TIMEOUT_MAX_MS`; la espera del cotizador siempre admite al menos el presupuesto de búsqueda más un minuto y los leases del worker se renuevan durante la ejecución.

La persistencia usa una identidad independiente de la duración y registra `presupuestoExploradoMs`. Una preparación de cinco minutos amplía una búsqueda previa de dos; el sheet puede usar inmediatamente cualquier resultado compatible. Se parte del acomodo guardado y se conserva el mejor candidato según placas, corte común y compactación. Aunque no se mejore, se recuerda el esfuerzo realizado para evitar repetir la misma búsqueda larga. Un trabajo antiguo que termine después no pisa una mejora.

Las claves anteriores de dos minutos se recuperan y promueven automáticamente. La consulta persistente ocurre antes de encolar, por lo que un worker ocupado mejorando el nesting no obliga a esperar para usar el resultado guardado. El análisis SVG también materializa ese resultado más reciente sin quedar ligado al análisis temporal anterior. Preparación e interacción tienen scopes distintos para evitar cancelarse mutuamente.

Pruebas añadidas: separación de presupuestos concurrentes, búsqueda hasta 300 segundos con reloj controlado, ampliación de esfuerzo y conservación del resultado anterior, recuperación de claves previas, uso inmediato del resultado por el sheet y materialización de SVG sin espera. La regresión focalizada completa pasó 43 pruebas API; también pasaron TypeScript web, compilación API, lint de los archivos revisados y guardia CSS.

### Validación de la búsqueda ampliada

Se volvió a preparar la cantidad 50 del exhibidor real: el job geométrico recibió `timeoutMs: 300000` y `buscarMejora: true`; seguía activo después de los 120 segundos. La preparación completa terminó en **308.565 ms** (búsqueda más validación, persistencia y costeo). No se encontró un candidato mejor: se conservaron las **450 piezas, 34 placas y 3 patrones**, y se registró un presupuesto explorado de 300.000 ms. La información del acomodo ganador sigue correspondiendo a la búsqueda anterior que lo obtuvo.

Mientras la búsqueda ampliada estaba activa, una cotización normal de los mismos 50 exhibidores terminó en **1.505 ms**, usando el acomodo guardado sin cancelar la preparación. Después de terminar, el script de validación normalizó y comparó ambos nestings (impresión y corte), posiciones, capas y todos los costos: la reutilización tardó **1.188 ms**, con los mismos resultados. Estos tiempos incluyen el trabajo de cotización, no sólo la consulta de caché. Más tiempo permite probar más candidatos; en este caso no redujo las placas.
