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
  `OPENNEST_TIMEOUT_MAX_MS` (60 segundos por defecto).
- Cada salida se trata como candidata no confiable. El validador compara la
  cantidad exacta, ids/copias, transformaciones, rotaciones permitidas,
  límites, solapamientos de área y distancia mínima.
- La separación se impone expandiendo geométricamente cada pieza en la mitad
  del valor pedido y se vuelve a medir sobre los contornos reales. No se confía
  únicamente en el parámetro `spacing` del motor.
- El límite inferior de placas se calcula con área neta y superficie útil. Si
  una alternativa ordenada alcanza ese mínimo matemático, el worker detiene la
  búsqueda: una orientación más libre no podría ahorrar material.
- Un crash o segfault nativo sólo falla ese job; no derriba el worker ni el API.

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

## Próximos cortes

1. W5: recorrido SVG -> TAP y paquetes de instalación.
2. W6: ETA, PDFs, notificaciones y cron de mantenimiento.
