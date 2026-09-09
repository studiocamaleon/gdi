# Workers de Grafoprint

Estado: Fases W0 a W4 implementadas el 2026-09-04. **GrafoNest** es el nombre
del motor integrado que ve el usuario; internamente utiliza OpenNest/
`compas_nest` dentro del worker. El costeo reutiliza la misma solución validada
desde el caché compartido.

## Objetivo

Sacar del proceso HTTP el trabajo intensivo o durable sin convertir los
módulos de negocio en microservicios. La API sigue siendo la dueña de los
contratos y persiste el resultado definitivo; los workers ejecutan trabajos
versionados e idempotentes.

## Topología

```text
API NestJS
  └── Redis / BullMQ
        ├── grafo-quotes-v1         -> orquestación durable de cotizaciones
        ├── grafo-geometry-v1       -> nesting rápido y estándar
        └── grafo-geometry-heavy-v1 -> nesting intensivo aislado
```

El proceso de worker usa un `WorkerModule` propio. No importa `AppModule`, por
lo que no levanta HTTP, guards ni los cron que todavía viven en el API.

## Infraestructura disponible

- Redis local persistente en `docker-compose.yml`.
- BullMQ fijado en una versión exacta.
- Cola versionada `grafo-geometry-v1`.
- Contrato con `schemaVersion`, `tenantId` y `correlationId` obligatorios.
- Proceso Nest independiente con concurrencia configurable.
- Apagado ordenado y retención acotada de trabajos completos/fallidos.
- Trabajo `geometry.measure-polygon.v1` para smoke test extremo a extremo.
- Trabajo `geometry.nest-irregular-opennest.v1` para resolver polígonos con
  cantidades, huecos, rotaciones por pieza, margen, separación y varias placas.
- Adaptador oficial `compas_nest` fijado en una versión exacta.
- Motores OpenNest `collision` y `nfp` bajo el mismo contrato JSON.
- Subproceso Python por trabajo, sin shell, con timeout externo que termina el
  grupo de procesos completo.
- Rechazo obligatorio de resultados parciales, fuera de placa, superpuestos,
  con separación insuficiente o con transformaciones inconsistentes.
- Política jerárquica de orientación: GrafoNest prueba primero una orientación
  uniforme, después ángulos cardinales y habilita la rotación libre únicamente
  si puede reducir la cantidad de placas.
- API asíncrona con estados `pendiente`, `procesando`, `completado`, `fallido`
  y `cancelado`, progreso y resultado final.
- Cancelación cooperativa cross-process: un cálculo activo termina su grupo de
  procesos nativos en hasta 250 ms desde que el worker observa la solicitud.
- `claveSolicitud` opcional para deduplicar el mismo input y volver obsoleto el
  trabajo anterior cuando cambian los parámetros de una misma pantalla.
- Aislamiento por tenant tanto para consultar como para cancelar.
- Adaptador productivo SVG/capas/encastres -> OpenNest -> contrato de nesting.
- Caché L1 local y L2 en Redis: cualquier réplica del API puede recuperar el
  layout exacto que vio y aprobó el usuario.
- Solución base segura y determinista antes de invocar el optimizador nativo.
  Si el optimizador agota su presupuesto, la cotización conserva un layout
  completo, validado y reproducible en vez de terminar con error.
- Clasificación de complejidad y cola intensiva separada. Un trabajo con muchas
  piezas, tipos o vértices no puede bloquear los nestings interactivos que
  llegaron después.
- Cotización durable completa: el request HTTP devuelve `202`, y un worker
  continúa resolviendo producto, componentes y nestings aunque el navegador
  cambie de vista o se corte la conexión original.
- Semáforo distribuido por tenant para cotización y geometría. Una ráfaga de
  una empresa se reprograma sin fallar y deja avanzar trabajos de las demás.
- Caché compartida de soluciones validadas durante siete días, configurable
  con `GRAFONEST_CACHE_TTL_SECONDS`.

El job de medición sigue siendo el smoke liviano para separar una falla de
Redis/BullMQ de una falla de la dependencia nativa.

## Ejecución local

```bash
docker compose up -d redis
python3 -m venv apps/api/.venv-opennest
apps/api/.venv-opennest/bin/python -m pip install -r apps/api/requirements-opennest.txt
export OPENNEST_PYTHON="$PWD/apps/api/.venv-opennest/bin/python"
npm --prefix apps/api run worker:dev
```

En otra terminal:

```bash
npm --prefix apps/api run worker:smoke
npm --prefix apps/api run worker:smoke:opennest
OPENNEST_SMOKE_ENGINE=nfp npm --prefix apps/api run worker:smoke:opennest
npm --prefix apps/api run worker:smoke:estado
npm --prefix apps/api run worker:smoke:analisis
```

La API web continúa arrancando sin Redis para los módulos que no usan trabajos
asíncronos. El análisis vectorial productivo sí requiere Redis y el worker.

## Frontera de confianza de W1

- OpenNest nunca se carga dentro del proceso HTTP ni del runtime Node.
- El presupuesto interno del motor es orientativo; el timeout externo del
  worker es el límite real y está además acotado por
  `OPENNEST_TIMEOUT_MAX_MS` (300 segundos por defecto). El análisis solicita
  120 segundos por defecto; ambos valores se pueden configurar.
- Cada salida se trata como candidata no confiable. El validador compara la
  cantidad exacta, ids/copias, transformaciones, rotaciones permitidas,
  límites, solapamientos de área y distancia mínima.
- La separación se impone expandiendo geométricamente cada pieza en la mitad
  del valor pedido y se vuelve a medir sobre los contornos reales. No se confía
  únicamente en el parámetro `spacing` del motor.
- El límite inferior de placas se calcula con área neta y superficie útil,
  más la cantidad de piezas que no pueden compartir placa por su área (por
  ejemplo, dos piezas mayores que media placa). La
  parada exige alcanzar también la cota de patrones. No demuestra el óptimo de
  retales, orientación ni recorrido de corte.
- La política de orientación 8 y de búsqueda 5 repite arranques con semillas distintas y alterna collision/NFP;
  omite orientaciones en las que una pieza no cabe e intenta explícitamente una
  placa menos. No finaliza simplemente por completar uniforme/cardinal/libre.
  Cada intento usa una porción del presupuesto global (hasta 30 segundos), sin
  el antiguo recorte interno por cantidad de piezas. Compara primero placas,
  después patrones y luego longitud de corte compartida y área envolvente.
- El selector recibe la combinación completa conocida si pertenece a la
  cartera actual. La entrega antes de resolver, conserva el ganador de placas
  y limita el segundo objetivo a los patrones del mejor plan con las placas
  elegidas. La formulación primaria conserva su búsqueda sin esa cota adicional.
  Conserva cantidades exactas y declara certificados sólo cuando el
  optimizador los demuestra; una cartera finita no demuestra el óptimo global.
- `busqueda` registra intentos, candidatos válidos, presupuesto, mínimo teórico
  y motivo de finalización. El visor distingue mínimo alcanzado de presupuesto
  agotado. Los resultados incompletos o que incumplen restricciones se descartan
  conservando el mejor candidato completo anterior. La caché lleva la versión
  de la política para no reutilizar resultados de la búsqueda anterior.
- Un crash o segfault nativo sólo falla ese job; no derriba el worker ni el API.

### Motor alternativo y política 5

PackingSolver está integrado como generador opcional de candidatos. Se mantiene
desactivado por defecto (`GRAFONEST_PACKINGSOLVER_ENABLED=0`). No sustituye el
validador ni la lógica de cotización, capas, patrones, biblioteca o checkpoints.
Su resultado declara `grafonest-packingsolver-v1`, `motorEjecutor=packingsolver`
y el SHA-256 del ejecutable. La combinación posterior de sus patrones puede
ganar con procedencia `cartera`; `motoresExplorados` registra ambos pasos.

La instalación reproducible se realiza con:

```sh
python3 apps/api/scripts/install-packingsolver.py
```

El instalador fija el commit de fuente evaluado, exige un checkout sin cambios,
compila Release con HiGHS y deja ejecutable, manifiesto y avisos de dependencias
en `apps/api/.native/packingsolver/<commit>/<sha256>/`. Requiere Git, CMake 3.28
o posterior y C++14. `--source` y `--build` permiten reconstruir una compilación
existente de esa fuente. El camino `PACKINGSOLVER_BIN` se muestra al terminar;
instalar no habilita automáticamente el motor. Hay que definir ese camino y
`GRAFONEST_PACKINGSOLVER_ENABLED=1` en el entorno del worker evaluado.

Cada intento recibe hasta 40 segundos y hasta el 35% del tiempo restante del
trabajo. Para lotes de 100 piezas o más sólo se inicia si dispone de al menos
10 segundos; con menos piezas, de al menos 4. Las mediciones con 15 segundos
mostraron que iniciar la preparación de un lote grande sin tiempo suficiente
perjudica al selector. En lotes grandes explora primero las rotaciones cardinales
permitidas; el resto de la búsqueda conserva las orientaciones del contrato.

El supervisor Python vigila el plazo incluyendo preparación, cancelación y
muerte del padre, y termina el proceso nativo antes de salir. Lee certificados
de tamaño acotado y envía solamente poses; reconstruir contornos sigue siendo
responsabilidad de TypeScript. El tamaño del archivo nativo puede ser mucho
mayor porque repite la geometría. No se lo confunde con el tamaño del mensaje.

`GRAFONEST_PACKINGSOLVER_MEMORY_MB` fija una guardia de RSS del nativo más su
supervisor (1024 MiB por defecto; 64–8192). El muestreo es cada 200 ms, por lo
que puede existir sobrepaso transitorio: **no es un límite duro de sistema** y
no incluye Node, otros solvers ni otros trabajos. `recursosNativos` distingue
RSS nativo y total observado, junto con el motivo de salida. El motor C++ usa
varios hilos; no hay una cuota de CPU por hilo en este adaptador. La habilitación
general depende de completar el control global de CPU/RAM y la aceptación de
concurrencia; esta integración opcional no cierra ese frente.

La caché normal conserva su utilidad. Una solicitud explícita de mejorar, con
tiempo suficiente para PackingSolver y el motor habilitado, vuelve a buscar si
el resultado anterior sólo exploró los motores viejos. Una búsqueda corta para
la que no corresponde iniciar PackingSolver puede reutilizar su presupuesto.

## Contrato consultable de W2

```text
POST   /api/trabajos-geometria/nesting-irregular  -> 202 + trabajo
GET    /api/trabajos-geometria/:id                -> estado/progreso/resultado
DELETE /api/trabajos-geometria/:id                -> cancelación idempotente
```

La API crea su conexión a Redis sólo al usar estos endpoints; el resto del
monolito sigue arrancando sin Redis. Los jobs completos se conservan 24 horas y
los fallidos/cancelados siete días. La cancelación tiene un tombstone separado,
por lo que sigue siendo consultable aunque el job aún no iniciado haya sido
removido de la cola.

El cliente web tiene un contrato y polling abortable reutilizable.

## Conexión productiva de W3

```text
POST   /api/motor-universal/geometria-vectorial/normalizar
POST   /api/motor-universal/geometria-vectorial/preparar
POST   /api/motor-universal/geometria-vectorial/analizar-asincrono -> 202
GET    /api/motor-universal/geometria-vectorial/trabajos/:id
DELETE /api/motor-universal/geometria-vectorial/trabajos/:id
```

`normalizar` es la única puerta de entrada para SVG y DXF. Valida la fuente y
convierte el DXF a un SVG canónico, reconstruyendo contornos exportados como
segmentos conectados y conservando la unidad declarada. Desde ese punto ambos
formatos recorren exactamente el mismo análisis, caché, GrafoNest y costeo.
`preparar` interpreta el SVG canónico sin ejecutar nesting y se conserva como
contrato interno de compatibilidad. El análisis final se encola y la pantalla muestra `En cola`,
`Nestando` y `Validando solución`. Si
cambian las medidas o la configuración, el navegador aborta el polling y pide
cancelar el trabajo obsoleto.

La experiencia comercial productiva es única para cualquier producto con
geometría irregular: se carga un SVG o DXF, se completan medidas, material y cantidad
y el usuario ejecuta explícitamente **Generar nesting**. Subir el archivo o
cambiar un dato invalida el resultado anterior, pero nunca dispara un cálculo
automático. Cuando GrafoNest termina, ese resultado habilita el recálculo del
precio y queda disponible para costo, visualización y producción.

La política comercial del producto define `RECTANGULAR`, `VECTORIAL` o `AMBAS`.
La pantalla muestra únicamente los modos permitidos como **Rectangular** y
**Archivo vectorial**; el formato del archivo no es un modo de cotización. La
estimación manual por placas queda fuera del selector principal y sólo aparece
si el modelador la habilita explícitamente como excepción del producto.

Cada componente se resuelve como una geometría de un solo nivel. El antiguo
selector de capas no forma parte del cotizador: un producto con Polyfan u otros
materiales en distintos niveles se modela como producto compuesto, con un
componente por nivel. Así cada componente conserva su material, espesor, ruta y
nesting, mientras que las geometrías compatibles todavía pueden consolidarse.

Una vez validado, el resultado se guarda durante siete días bajo una clave que
incluye tenant, fuente, medidas, configuración de capas, parámetros y política
de nesting. Esa clave viaja con la cotización: el motor de costos no vuelve a
nestear ni acepta una geometría parecida, sino que recupera el layout exacto.
El contexto transitorio del trabajo se conserva 24 horas para poder finalizar
la conversión aun cuando responda otra réplica del API.

En productos compuestos la superficie efectiva recién se conoce al resolver la
receta de cada hijo. En ese punto el dispatcher también delega al worker: un
SVG compartido puede producir, por ejemplo, un nesting de Polyfan y otro de
acrílico, cada uno con su placa, márgenes y máquina reales. Nunca cae al solver
síncrono por el solo hecho de haber heredado la geometría.

La consolidación de contornos compatibles entre varios componentes también
envía el problema geométrico neutral al mismo worker. No necesita concatenar
los SVG: conserva la identidad y el propietario de cada demanda y devuelve un
único layout validado para costo, visor y OT.

La ruta síncrona anterior queda únicamente como fallback inyectable para tests
y compatibilidad interna. En ejecución productiva usan GrafoNest:

- productos simples con geometría irregular;
- cada componente irregular de un producto compuesto;
- consolidación irregular de componentes compatibles.

No se invoca el optimizador cuando el usuario eligió una estimación manual por
placas o la máquina tiene la política explícita de conservar la composición
original para reutilizar el negativo. Esos dos modos no realizan nesting.

Los nombres técnicos y contratos (`opennest-v1`) se conservan en código, logs y
snapshots para trazabilidad. Los avisos de autoría y licencia se distribuyen en
`THIRD_PARTY_NOTICES.md`.

## Invariantes de la conexión productiva

- La clave de caché incluye fuente, medidas, material, política y versión del
  algoritmo.
- Un cambio de parámetros vuelve obsoleto o cancela el trabajo anterior.
- La solución persistida alimenta costo, visualización, TAP y OT.
- Las colas limitan la concurrencia global y aíslan los trabajos intensivos.
- Agregar réplicas del proceso worker aumenta capacidad sin cambiar contratos:
  BullMQ entrega cada job a una única réplica y Redis conserva estado y
  resultado.

## Cotización durable y escalado horizontal (W4)

```text
POST /api/motor-universal/cotizar-asincrono       -> 202 + trabajo
GET  /api/motor-universal/cotizaciones-asincronas/:id
```

La pantalla comercial usa este recorrido cuando hay geometría vectorial. No
mantiene abierto un request de varios minutos: observa un job durable y muestra
si está en cola o procesando. Cada intento tiene una `claveSolicitud` estable
para sus consultas, pero un recálculo deliberado recibe otra identidad y nunca
reutiliza una cotización vieja después de publicar cambios en una receta.

El worker de cotización no ejecuta Python. Orquesta la receta y espera los jobs
geométricos; éstos viven en sus propias colas y procesos nativos.

Los componentes de un producto compuesto se agrupan por niveles topológicos:
los independientes se cotizan simultáneamente y sólo se espera cuando un hijo
consume outputs de otro. Del mismo modo, los grupos de consolidación con firmas
distintas se encolan juntos. La concurrencia configurada y la cuota del tenant
determinan cuántos usan CPU a la vez sin romper el orden funcional.

Los valores iniciales locales son:

- `WORKER_QUOTE_CONCURRENCY=4`;
- `WORKER_GEOMETRY_CONCURRENCY=1`;
- `WORKER_GEOMETRY_HEAVY_CONCURRENCY=1`.
- `WORKER_TENANT_QUOTE_CONCURRENCY=2`;
- `WORKER_TENANT_GEOMETRY_CONCURRENCY=1`.

En producción se escala agregando réplicas del comando `worker:prod`. La
concurrencia geométrica por réplica debe permanecer cerca de la cantidad de
vCPU realmente reservada; aumentar el número sin CPU disponible sólo agrega
contención. El autoscaling debe mirar profundidad y antigüedad de las tres
colas, CPU y memoria, no solamente tráfico HTTP.

Queda como endurecimiento de producción exportar métricas p50/p95/p99 de
espera y ejecución y ajustar las cuotas con carga real. La separación
fast/heavy ya elimina el bloqueo global más costoso, pero no reemplaza esas
métricas.

## GrafoNest: avances recuperables (9/9/2026)

`NestingCheckpoint` guarda el mejor candidato intermedio por tenant y firma
geométrica, separado de `NestingGuardado`. No habilita un precio definitivo.
Una nueva ejecución recupera sus poses, reconstruye y valida la geometría
original y usa sus patrones como semillas. El estado interno del motor nativo
no se conserva. Publicar un resultado que supera el checkpoint lo limpia en
la misma transacción; cancelar espera las escrituras pendientes.

La cuota geométrica tiene 60 segundos de vigencia y se renueva cada 20 segundos.
Si se pierde o falla su renovación, se detiene el proceso geométrico y el job se
reprograma sin consumir un intento fallido. Las categorías normal e intensiva
siguen separadas. Esto mejora recuperación y exclusión; no equivale a un límite
global de CPU/RAM. Pruebas y límites: `grafonest-transformacion-resultados.md`.

`GRAFONEST_SELECTOR_THREADS` admite 1–8 hilos para HiGHS/BLAS. El valor inicial
es 0 (automático): el ensayo de un hilo redujo CPU pero mostró regresiones de
calidad bajo un presupuesto corto. No se activa esa cuota por defecto. Tampoco
es un límite de memoria ni de hilos de los motores geométricos.

## Admisión compartida y procesos de geometría (9/9/2026)

`CapacidadGeometriaService` reserva capacidad en una transacción Lua de Redis.
Todas las réplicas que atienden las mismas colas comparten `GRAFONEST_POOL_ID`
y la misma configuración. El valor inicial admite dos trabajos normales de
1 CPU/1024 MiB y uno intensivo de 2 CPU/2048 MiB dentro de un total de
4 CPU/4096 MiB. Son **reservas declaradas**, no consumo medido ni cuotas físicas
del sistema operativo. El paralelismo nativo todavía debe quedar limitado por
el despliegue antes de aumentar capacidad o habilitarlo de forma general.

El turno se reparte entre fábricas; cada clase permite un trabajo por fábrica
a la vez. Dentro de una fábrica se respeta prioridad y orden de registro.
Si el pool admite ambas clases simultáneamente, conserva una entrada normal y
reserva lugar para una intensiva pendiente. Si sólo cabe una clase, alterna
cuando ambas esperan. Una preparación extensa no ocupa todos los lugares
interactivos. Las cotizaciones pueden seguir esperando I/O con su propia cuota.

La API registra provisionalmente antes de `queue.add` y confirma después.
Una confirmación tardía no resucita un trabajo terminado. La presencia pendiente
vence a los 30 segundos sin nuevos intentos; esto retira turnos abandonados,
sin borrar el job de BullMQ. Cuando BullMQ lo entrega, se registra nuevamente.
Los permisos activos duran 60 segundos y se renuevan junto a la cuota del tenant
cada 20 segundos. Un dueño anterior no puede renovar ni liberar una reserva
readquirida. Fallos transitorios al admitir o perder un permiso reprograman el
trabajo; errores de configuración requieren corregir el despliegue.

Al finalizar se promueve el próximo job demorado de la misma clase, una vez
liberada la cuota del tenant. El reintento periódico queda como respaldo si
otra réplica ya lo tomó o Redis no permitió promoverlo. La promoción respeta
la prioridad/FIFO dentro de la fábrica y el turno compartido entre fábricas;
no saltea la admisión. Se pasa la cola del worker mediante la interfaz pública
`MinimalQueue`, sin acceder a propiedades protegidas de `Job`.

En macOS/Linux cada runner tiene una guardia mínima independiente de Python/C++.
Espera un descriptor abierto por Node: EOF mata el grupo nativo si Node muere.
Node envía pulsos cada cinco segundos; 45 segundos sin pulso también terminan
el grupo si Node queda suspendido, antes del vencimiento de 60 segundos.
La guardia confirma que está lista antes de lanzar C++, conserva su grupo al
recibir TERM y limpia descendientes que ignoran esa señal. El uso directo de
los runners desde CLI, sin descriptor, conserva su funcionamiento. Este
protocolo de grupos no está implementado para Windows.

Cambiar la configuración exige drenar los trabajos y actualizar coordinadamente
API y workers. Se conserva en Redis para rechazar réplicas incompatibles. Para
un nuevo perfil, usar un nuevo ID compartido después de drenar/reiniciar; no
mezclar workers anteriores que no participen en la admisión. IDs diferentes
sólo aíslan la contabilidad; **no particionan ni enrutan las colas** y no deben
usarse como forma de aumentar artificialmente la capacidad del mismo servidor.

Ensayos reproducibles: `apps/api/test/benchmarks/capacidad-colas.cjs` usa tres
procesos y 106 trabajos con tiempos controlados; `cola-recuperacion.cjs` mata
un worker real de BullMQ después de guardar el plan validado de 900 piezas y
comprueba su recuperación en otro proceso. Ambos usan prefijos Redis y tenants
propios; el segundo exige una base terminada en `_test`.

## Próximos cortes

1. W5: recorrido SVG -> TAP y paquetes de instalación.
2. W6: ETA, PDFs, notificaciones y cron de mantenimiento.
