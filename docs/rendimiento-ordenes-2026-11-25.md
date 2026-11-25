# Rendimiento de órdenes de trabajo

Revisión del 25 de noviembre de 2026 sobre `0e954211a`. En una OT hay tres esperas distintas para el vendedor. La primera termina al habilitarse el botón, la segunda cuando se confirman la orden y sus operaciones asociadas, y la tercera cuando se abre el detalle. Conviene medir las tres por separado.

## Cambios comprobados en local

| Recorrido | Qué ocurría | Cambio |
| --- | --- | --- |
| Habilitar Emitir OT | El cálculo de capacidad del taller bloqueaba incluso órdenes cuyas fechas de producto ya estaban fijadas. | Una fecha manual confirmada puede usarse mientras continúa el cálculo. Una OT con fechas automáticas sigue esperando su estimación. La interfaz indica si espera la fecha, el precio de copiado, el cupón o el descuento. |
| Editar un producto de la OT | Se ordenaba y preparaba el catálogo aun con el selector cerrado. Al editar, se podía elegir otro producto accidentalmente antes de que llegara la configuración solicitada. | La ficha abre con el nombre del renglón y carga su configuración. El catálogo se prepara al agregar o al elegir volver. Si la consulta falla, la ficha permite cancelar o elegir otro producto explícitamente. |
| Confirmar la emisión | Se simulaban etapas con temporizadores y había otros 2,3 segundos desde la confirmación hasta el inicio de la navegación. El detalle consultaba secuencialmente cargos, documentos, clientes y productos. | El indicador sigue las operaciones reales. La navegación empieza al terminar cobros, entrega y adjuntos. Las cuatro lecturas del detalle se solapan después de validar acceso y cargar la OT. |
| Estimar y registrar la promesa de entrega | El motor reconsideraba las mismas dependencias, duraciones y claves durante la simulación. Construía una traza de planificación que la promesa comercial descartaba. | Se reutilizan datos estables dentro de cada corrida. El cotizador y la captura de emisión piden sólo las fechas. Planificación y fotos diarias siguen recibiendo la traza completa. Un índice parcial acelera la consulta de medianas históricas de cada empresa. |
| Abrir el catálogo administrativo | Además de la página de 25 filas, se descargaban **todos** los productos, de 200 en 200, para contar cuántos había en cada categoría. Cada página también consultaba frecuencia de uso en las OT. | La base cuenta los productos por subcategoría de la empresa autenticada. La pantalla solicita sólo la página visible y el catálogo con conteos. Se mantienen los productos inactivos y se excluyen las plantillas internas del conteo. |

## Mediciones

**Motor de entrega.** Una línea por OT, tres pasos consecutivos, tres estaciones de un puesto, calendario predeterminado y reloj fijo. Node 24 local. Se alternó el orden de ejecución de las dos versiones. Cada valor es la mediana de tres procesos, cada uno con una corrida de calentamiento y cinco medidas. La huella de las fechas y del estado de estimación de todos los productos coincidió en cada tamaño.

| OT activas del taller | Pasos | Base | Rama |
| ---: | ---: | ---: | ---: |
| 10 | 30 | 2,1 ms | 1,4 ms |
| 100 | 300 | 53,1 ms | 34,6 ms |
| 300 | 900 | 337,9 ms | 222,5 ms |

El caso reproducible está en `apps/api/test/benchmarks/emision-ot.cjs`. Desde `apps/api`, ejecutar `node test/benchmarks/emision-ot.cjs` con el motor compilado de la revisión elegida, o pasar como argumento la ruta a su módulo CommonJS compilado. La medición cubre sólo el motor en memoria. Las agendas ya publicadas, las máquinas compartidas y las rutas más largas requieren sus propios escenarios.

**Historial en PostgreSQL 16.** Se cargaron 500.000 pasos ficticios repartidos entre 100 empresas, con 17 familias y una mezcla de estados y fuentes de tiempo. Se comparó la consulta de `ProduccionService.findDuracionesFamilias` con los índices por empresa y estado y con el nuevo índice parcial. Se verificó la igualdad de resultados. El conjunto se analizó después de cargarlo y se calentó antes de medir.

| Consulta de medianas | Base | Rama |
| --- | ---: | ---: |
| Una empresa, mediana de nueve ejecuciones | 2,28 ms | 0,77 ms |
| Bloques de PostgreSQL consultados en el plan | 138 | 30 |
| 20 conexiones, p50 | 5,23 ms | 2,56 ms |
| 20 conexiones, p95 | 30,83 ms | 6,48 ms |

La prueba concurrente usó 2.000 consultas por versión, con empresas elegidas al azar y la misma semilla. El p95 expresa cuánto tardó en completarse el 95 % de las consultas. La base contiene datos de 100 empresas. La concurrencia efectiva fue de 20 clientes SQL. El costo de autenticación, la red, la carga de archivos y la navegación del navegador requieren medición de punta a punta.

## Flujos pesados y orden de trabajo

| Prioridad | Flujo | Evidencia en el código | Siguiente comprobación |
| --- | --- | --- | --- |
| 1 | Emisión simultánea y ETA | `OrdenesTrabajoService` espera la captura de la promesa después de crear la orden. `EtaService.correr` ensambla las órdenes activas de la empresa y ejecuta el motor en el hilo de la API. Cada ficha comercial abierta con ETA refresca el contexto cada minuto. | Medir por separado armado de contexto, CPU y escritura de la promesa, y medir la latencia de lectura de una segunda empresa durante varias emisiones. Si el cálculo bloquea las lecturas, evaluar el pool de workers ya usado por la reprogramación, con cupos por empresa y preservando el instante de la promesa. |
| 1 | Catálogo del cotizador y detalle de OT | La creación y el detalle cargan productos comerciales en páginas de 200. El listado calcula usos mediante un conteo de OT distintas por producto. La mejora de conteos administrativos no elimina esta lectura del selector comercial. | Medir bytes y tiempo con 200, 2.000 y 10.000 productos. Pasar la búsqueda y el orden por uso al servidor, cargar sólo la página visible y recuperar directamente los productos de la orden. |
| 1 | Listado de órdenes y tablero | El listado pagina las filas, pero cada navegación también cuenta y agrupa el historial comercial. El tablero reconcilia tramos vencidos, lee las órdenes activas y enriquece sus pasos. | Comparar listado y contadores por separado. Medir filas, bytes y tiempo por estación con 100 y 1.000 OT activas. Evaluar actualización de contadores por cambios y carga por estación conservando la vista general. |
| 2 | Panel general, cobros y reportes | El resumen administrativo del panel lee órdenes finalizadas y entregadas y calcula saldos en la API. El listado general de cobros puede consultar toda la empresa. Los reportes de ventas ya agregan por período en SQL. | Medir panel, cuenta corriente y reporte anual con varios años de historia. Probar agregaciones en SQL para el panel y paginación de cobros contrastando los totales actuales. |
| 2 | Precios, materiales y órdenes con muchos renglones | La emisión guarda las cotizaciones por renglón con un identificador compartido. La previsión cruza demanda, stock y compras abiertas. | Separar tiempos de 1, 10 y 50 renglones, con materiales repetidos y distintos. Evaluar una operación por lote si dominan los viajes a la API. Verificar reintentos y reservas antes de modificar la escritura. |
| 2 | Archivos y PDF | La ficha espera que terminen las cargas asociadas antes de navegar. Los PDF tienen un worker independiente con límites por empresa. | Comparar OT sin archivos, con un PDF y con varios adjuntos. Medir transferencia y espera en cola por empresa. Si se desacopla la carga, deberá poder reanudarse y mostrar qué archivo falta. |

**Próxima validación de capacidad.** En un entorno aislado con datos ficticios, combinar emisión, edición, tablero y lecturas comerciales. Empezar con 20 usuarios simultáneos, subir a 50 y a 100, repartirlos entre empresas y repetir con una empresa que concentre la mayor cola. Registrar p50/p95 de clic a botón habilitado y de clic a detalle, errores, consultas por solicitud, ocupación del pool de conexiones y demora del hilo de la API. Verificar números únicos de OT, fechas, cobros, reservas y que la actividad de una empresa no degrade las lecturas de las demás. Los resultados de esta revisión permiten priorizar ese ensayo.
