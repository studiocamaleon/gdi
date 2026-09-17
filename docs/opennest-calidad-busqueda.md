# Calidad de búsqueda de GrafoNest — política 8

Actualización del 9 de septiembre: la orientación sigue en versión 8 y la búsqueda
incorpora una política independiente versión 1. El comportamiento vigente del
selector incremental, prioridad de patrones y límites nativos se documenta en
[Mejoras de búsqueda y patrones](grafonest-mejoras-busqueda-patrones-2026-09-09.md).
Las mediciones siguientes corresponden a los cierres anteriores de F4.

## Caso auditado

Puma de 200 cm de ancho: 8 partes (el animal dividido en 2), placas de
1200 × 600 mm, margen de 10 mm y separación de 5 mm. No se modificó la
escala, la separación, el margen ni la segmentación.

El trabajo original del 6 de septiembre de 2026 devolvió 3 placas en
27,2 segundos. Con la búsqueda nueva, el worker activo obtuvo **2 placas en
55,9 segundos**. Las ocho partes atravesaron la validación independiente de
integridad, transformaciones, rotación, límites, solapamientos y separación.
El límite inferior por área es 2, de modo que este caso demuestra el mínimo
de placas. El acomodo no tiene que coincidir con la propuesta manual para
alcanzar ese mínimo.

La entrada sin datos del cliente y una solución válida se conservan en
`apps/api/src/workers/geometria/fixtures/puma-200cm.json`. La prueba geométrica
se ejecuta siempre. Para repetir la búsqueda nativa completa desde la raíz:

```sh
OPENNEST_PYTHON="$PWD/apps/api/.venv-opennest/bin/python" \
OPENNEST_INTEGRATION=1 \
npm --prefix apps/api test -- --runInBand --testPathPatterns=opennest-puma
```

El tiempo y las posiciones exactas pueden variar con la carga de CPU. La prueba
nativa verifica cantidad de placas, integridad de piezas y criterio de parada.

## Revisión de cierre de F4 (7 de septiembre)

La repetición de la aceptación detectó que la búsqueda sólo por tiempo podía
volver a tres placas con la misma entrada. La política 8 agrega dos vueltas
iniciales de Collision con 1.000 iteraciones, con límite externo de 8 segundos
por intento. Ese calendario de relajación es reproducible; si no encuentra el
mínimo, continúan los intentos por tiempo y motores alternativos. Todos comparten
el mismo presupuesto global. No se modifican piezas, margen, separación ni los
ángulos permitidos.

También se asigna el presupuesto por estrategia, no por posición: invertir la
lista de reintentos ya no recorta el tiempo de la orientación libre. La versión
8 se incluye en las claves de trabajos y está sincronizada con el cotizador.

La prueba nativa ahora repite el Puma tres veces: las tres dieron ocho piezas
en dos placas y pasaron la validación geométrica; el conjunto tardó 14,3 s.
Evidencia: `output/cierre-fase-4-2026-09-07/puma-aceptacion.json`.

## Qué limitaba la búsqueda

- El análisis y los trabajos directos solicitaban 30 segundos por defecto.
- El worker imponía otro máximo de 60 segundos.
- Sólo se intentaban las estrategias uniforme, cardinal y libre, con la misma
  semilla. Completar esos intentos también terminaba la búsqueda.
- Python recortaba cada intento a `min(presupuesto, max(1.5, min(20, piezas ×
  rotaciones × 0.08)))` segundos. Los intentos con pocas orientaciones recibían
  muy poco tiempo, aunque su geometría fuera difícil.
- Collision tenía `n_starts=1`. El argumento de iteraciones se configuraba
  entre 160 y 1200, pero el binding instalado lo **ignora cuando hay presupuesto
  por tiempo**: no era un segundo límite efectivo de 400 iteraciones.
- NFP no probaba todas las orientaciones al evaluar una colocación.
- Sólo se marcaba `optimizacionAgotada` si se conservaba la base de respaldo y
  había un error. Un resultado nativo válido pero mejorable podía parecer una
  búsqueda terminada sin limitaciones.

Fuentes del comportamiento del binding: código instalado de
`compas_nest==0.1.1.post4`, especialmente `collision.py::_params`, y
[documentación del motor](https://petrasvestartas.github.io/OpenNest/api/python/).

## Comportamiento actual

1. Se obtiene y valida un acomodo de respaldo antes de optimizar.
2. Se omiten planes con ángulos en los que alguna pieza no cabe físicamente.
3. Se prueban los ángulos permitidos progresivamente y se repiten arranques con
   otras semillas. Se alternan collision y NFP si la búsqueda continúa.
4. Se intenta explícitamente una placa menos que el mejor resultado. También
   hay intentos con la cantidad actual para mejorar su acomodo. Una solución
   parcial nunca reemplaza a una solución completa.
5. Siempre se conserva el mejor resultado validado: primero menor cantidad de
   placas; en empate, menos patrones, más corte común y menor área envolvente. Esto último es
   un criterio de compactación, no una medición exacta de retales recuperables.
6. Ya no se termina por haber completado tres planes. Se continúa hasta
   alcanzar las cotas de placas y patrones, agotar el presupuesto global o cancelar.

Predeterminados: **120.000 ms por trabajo** y **300.000 ms de límite externo**.
`OPENNEST_JOB_TIMEOUT_MS` y `OPENNEST_TIMEOUT_MAX_MS` permiten configurarlos;
valores explícitos de un trabajo se respetan dentro del máximo del worker.
Cada intento tiene hasta 30 segundos, compartidos dentro del presupuesto global,
para poder comparar alternativas. Imports y preparación consumen presupuesto;
se reserva tiempo para devolver el resultado del proceso nativo.

Las rotaciones del contrato se respetan: en la integración vectorial actual,
rotación libre equivale a 72 ángulos de 5° y rotación deshabilitada a 0°.
No se modifican las restricciones de fabricación para obtener menos placas.

`busqueda` informa el presupuesto, cantidad de intentos, candidatos válidos,
límite inferior y motivo de parada. El visor muestra el mínimo alcanzado o
aclara que terminó el tiempo y aún podría existir un acomodo mejor. La política
5 invalida la reutilización de los resultados calculados con políticas previas.

## Límites de la afirmación de calidad

Estos motores son heurísticos. Dar más tiempo y explorar más arranques mejora
la búsqueda, pero **no demuestra el óptimo global de todos los trabajos**.
Alcanzar el límite por área sí prueba la cantidad mínima de placas; no prueba
la mejor orientación visual, el mejor retal ni el menor recorrido de corte.
Si ese límite no es alcanzable por la forma de las piezas, puede consumirse
el presupuesto entero aunque el resultado ya sea el mejor posible.

Un intento que excede su timeout externo se descarta; los candidatos completos
validados de intentos anteriores se conservan. No se recuperan snapshots de un
proceso nativo interrumpido.
