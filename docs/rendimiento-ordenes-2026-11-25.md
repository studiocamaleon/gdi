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

**Cobertura de las pruebas.** Los recorridos siguientes miden la emisión en el navegador y la API bajo distintas concurrencias. Para extender el ensayo a órdenes más complejas, queda combinar varios renglones, cobros, reservas y archivos durante una carga sostenida y conciliar sus efectos al finalizar.

## Pruebas en staging

Se compararon `101ed9327` y `9264c668b` con Chrome, servicios despiertos, el mismo producto y cliente ficticio y una sola línea por OT. El tiempo de emisión termina al ver el número de la OT en el detalle. Son tres observaciones por revisión en cada recorrido sin lectores adicionales. La tabla muestra sus medianas.

| Recorrido medido en el navegador | Antes | PR #135 |
| --- | ---: | ---: |
| Agregar el renglón hasta que el botón Emitir OT queda habilitado con fecha automática | 612 ms | 601 ms |
| Editar el renglón hasta disponer de su configuración | 234 ms | 216 ms |
| Apariciones del catálogo al editar | 3 de 3 | 0 de 3 |
| Crear la OT en la API desde el navegador | 1007 ms | 824 ms |
| Clic en Emitir OT hasta ver el detalle | 4,60 s | 2,06 s |

En un control independiente se retuvo la tarea de cálculo del taller dentro del navegador. La fecha automática esperó en las dos versiones. En la versión anterior, la fecha ingresada a mano siguió esperando el cálculo durante toda la observación de 1,8 s. En la rama, el botón quedó habilitado en 27 ms con el cálculo aún pendiente. Al liberarlo, la fecha elegida se conservó.

En la ronda con lectores simultáneos se hizo una emisión adicional por versión. El clic al detalle pasó de 4.496 ms a 2.045 ms. En la candidata se completaron 40 lecturas de tablero (p95 de 234 ms) y 40 de listado (p95 de 216 ms) entre dos empresas. En total se conciliaron ocho OT de staging con sus números, empresas, renglones y fechas. [Registro de publicación](../deploy/staging/VALIDACION.md).

## Emisión simultánea con 20 empresas

El ensayo local del 25 de noviembre usó la API de la revisión `9264c668b`, PostgreSQL 16 con ocho conexiones de aplicación y Valkey en una Mac de 8 GB. Se cargaron 20 empresas ficticias con el generador `f6-saas-seed.cjs`. Diecinueve tenían 100 pasos de taller y una tenía 1.000 al inicio. Se prepararon un cliente, un producto y cotizaciones de una línea por empresa antes de medir. La API autenticó las identidades de prueba. Las tareas programadas y las integraciones externas estuvieron desactivadas.

Se ejecutaron tres rondas por nivel, con una solicitud simultánea por usuario. El 10 % emitió una OT a partir de una cotización preparada, el 20 % abrió el producto, el 30 % consultó órdenes y el 40 % abrió el tablero. En cada ronda hubo emisiones en el taller de mayor carga. El reloj incluye petición HTTP, autenticación de la solicitud y lectura de la respuesta en loopback. La preparación de la cotización, la navegación web y la transferencia por Internet se midieron por separado en staging.

| Usuarios simultáneos | Solicitudes | Emisiones | Emitir OT p50 / p95 | Abrir producto p95 | Listado p95 | Tablero p95 | Mayor pausa del hilo de la API |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 60 | 6 | 7,99 / 8,09 s | 81 ms | 100 ms | 131 ms | 3,81 s |
| 50 | 150 | 15 | 9,11 / 19,99 s | 99 ms | 264 ms | 302 ms | 7,60 s |
| 100 | 300 | 30 | 24,47 / 25,55 s | 248 ms | 888 ms | 683 ms | 15,36 s |

Las 510 solicitudes principales completaron el recorrido esperado. El máximo observado de conexiones SQL activas fue de 2, 4 y 7 sobre 8 disponibles, con una muestra cada 200 ms. Para detectar lo que ocurre cuando una lectura llega **después** de iniciarse el cálculo, otra sesión hizo solicitudes al listado de su propia empresa mientras se emitían OT. En el intervalo de 100 usuarios hubo 13 lecturas de esta sesión. Tres terminaron sin respuesta HTTP. La lectura exitosa más lenta tardó 10,89 s y una fallida llegó a 14,87 s. La API también registró siete errores de transacción `P2028` al intentar encolar el aviso de orden recibida. La prueba no incluyó envíos a clientes. Los números de OT, renglones, fechas y promesas de emisión coincidieron en las 56 órdenes de la primera serie de laboratorio (51 de carga, una de control y cuatro perfiladas).

**Dónde se gasta el tiempo.** Se repitió la emisión a solas dos veces en el taller grande. Tardó 8,53 y 7,97 s. La API simuló el taller dos veces por emisión, al sincronizar el reparto automático y al registrar la promesa de entrega. Las dos simulaciones sumaron 8,18 y 7,67 s de ejecución síncrona. Las dos lecturas de contexto sumaron 184 y 152 ms. PostgreSQL registró 195 y 192 sentencias, incluidos los límites de transacción. En el taller pequeño, las emisiones de control tardaron 465 y 254 ms. Las mediciones usan datos sintéticos y describen este equipo y esta distribución de carga.

**Comparación con la versión anterior.** Se clonó la misma base ficticia para cada revisión, con el índice correspondiente a cada una. Se emitieron tres órdenes por tamaño de taller y revisión, con los mismos clientes, cotizaciones y estado inicial. En el taller de mayor carga, la mediana de la petición de emisión bajó de 8,08 s en `101ed9327` a 7,30 s en `9264c668b`. En el pequeño pasó de 215 a 209 ms. Estas mediciones con una sola petición aíslan el efecto del cambio sobre la API.

**Prioridad para la siguiente corrección.** Sacar la simulación del hilo que recibe las solicitudes. El reparto automático calcula dentro de una transacción serializable y puede cambiar las asignaciones que usa la promesa. Reutilizar el primer resultado requiere comprobar que el estado de entrada conserva las mismas asignaciones y fechas. Contrastar la solución con esta misma mezcla de carga, verificar las promesas persistidas y comprobar que la sesión de otra empresa siga respondiendo durante las emisiones. Revisar también la entrega fiable del evento de notificación cuando vence la transacción.
