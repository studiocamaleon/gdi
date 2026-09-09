# GrafoNest: registro de implementación y mediciones

Estado: trabajo integral en curso. No reemplaza la matriz de aceptación de
`grafonest-transformacion-plan-ejecucion.md` ni certifica un óptimo global.

## Corrección de cotización de 150 exhibidores — 9 de septiembre, 12:10 ART

El incidente `7A55BDEC` no era una pieza demasiado grande. El worker había
calculado 96 placas, pero `NestingGuardado.guardar` falló al confirmar una
transacción que excedió el límite predeterminado de 5.000 ms (5.094 ms).
El adaptador convirtió ese fallo operativo en `NestingIrregularError`; el
dispatcher devolvió `null` y el guard de impresión diagnosticó incorrectamente
que una pieza de 384,042 × 424,347 mm no entraba en la placa de 860 × 564 mm.

Correcciones:

- La escritura final tiene un límite explícito de 30 s y devuelve sólo la clave,
  evitando transferir de vuelta todo el JSON. Se conserva el lock por demanda,
  el comparador y la protección contra resultados posteriores peores.
- API y worker conservan una solución validada aunque falle su persistencia.
  Intentan recuperar un ganador concurrente o un commit de confirmación incierta;
  nunca aceptan piezas faltantes ni geometría inválida como alternativa.
- Fallos, cancelación y timeout del worker se propagan como errores del cálculo,
  también a través de los componentes. El sheet ofrece reintentar sin sugerir
  cambios de medidas, material o panelizado.
- Una nueva solicitud puede reintentar un job fallido de Redis; no queda atada
  al mismo error durante su período de retención.

Validación de la cotización real con el input exacto del incidente:
**150 productos, 1.350 piezas, 96 placas y 5 layouts**. Repeticiones:
75 + 12 + 3 + 3 + 3. La cotización completa demoró **4.182 ms** reutilizando el
plan guardado (medición local). Impresión y corte conservan las cantidades;
los documentos originales coinciden con los de 50 unidades multiplicados por
3. Se exportaron cinco SVG y cinco DXF, y se reinterpretaron estos últimos
para comprobar las capas de fabricación.

También se inyectó un fallo del worker en el producto real: el error del padre
es ahora `nesting_calculo_fallido`, conserva el nombre del componente y ofrece
reintentar. El resultado geométrico real (6.692.105 bytes) se escribió desde cero
**sólo en `gdi_saas_test`** y se recuperó íntegro; guardar, incluida su validación,
tomó 6.584 ms. El tenant de prueba se eliminó después.

118 pruebas de API y 7 de presentación aprobadas; build y control CSS aprobados.
Evidencia y scripts: `output/grafonest-transformacion-2026-09-09/error-150/`.
No se crearon propuestas ni órdenes, ni se modificaron recetas. Esta corrección
no demuestra un óptimo global ni reemplaza el trabajo pendiente del algoritmo.

## Mejora automática entre cantidades antes de reutilizar — 9 de septiembre, 11:40 ART

Los accesos directos de `GeometriaJobsService` y `OpenNestService` consultan ahora
las combinaciones completas de la biblioteca antes de devolver un nesting exacto
guardado. La comparación vive en `NestingsGuardadosService`: filtra candidatos
por placas/patrones, reconstruye y valida la geometría original y conserva el
mejor con el comparador existente. La escritura usa el lock habitual y vuelve a
leer al ganador por si otra solicitud publicó una mejora concurrente.

Esta consulta no invoca motores ni selectores, no redondea repeticiones ni da por
realizada una búsqueda nueva. Conserva el diagnóstico y presupuesto explorado
anterior, registrando la biblioteca como origen de la nueva geometría. Si no hay
mejora, o falla la biblioteca, sigue disponible el resultado exacto validado.
Las preparaciones que aún deben explorar mantienen su recorrido de búsqueda.

Validación en el producto real, misma receta y configuración:

| Exhibidor, 50 unidades | Antes | Después |
| --- | ---: | ---: |
| Placas | 34 | **32** |
| Patrones | 3 | **5** |
| Piezas exactas | 450 | 450 |
| Costo total vigente | 265.937,63 | 256.281,29 |

El plan se obtuvo **automáticamente al cotizar**, sin una publicación manual:
los patrones del 64/5 de 100 se repiten 25 + 4 + 1 + 1 + 1 veces. La cotización
completa retornó en **4.259 ms**, incluyendo cola/servicios/lectura y persistencia;
es una medición local. Impresión y corte comparten las 32 placas. Se verificaron
los documentos originales y cantidades contra la cotización anterior y se
exportaron/reinterpretaron los cinco DXF, además de sus cinco SVG, con sus capas.
No se modificaron recetas ni órdenes confirmadas.

**65 pruebas aprobadas en cinco suites y build aprobado.** Las regresiones
incluyen ambos accesos sin cola/solver, remapeo de IDs, menos placas aunque haya
más patrones, desempate por patrones, persistencia, aislamiento de configuración
y tenant, repeticiones fraccionarias, biblioteca no disponible, plan inválido,
cancelación y conservación del presupuesto de búsqueda.

Evidencia reproducible:
`output/grafonest-transformacion-2026-09-09/reutilizacion-entre-cantidades/`.
La mejora de generación dirigida sigue pendiente; reutilizar 32/5 no demuestra
que 32 sea el mínimo geométrico para 50 unidades.

## Exhibidor: plan 64/5 disponible al cotizar — 9 de septiembre, 11:06 ART

Se incorporó el candidato experimental de 64 placas / 5 patrones al nesting
guardado y a la biblioteca del producto **Exhibidor · prueba de archivos y
patrones**, para 100 unidades. Antes se reutilizaban 67 placas / 4 patrones.

La firma de las geometrías, cantidades y restricciones del experimento coincide
exactamente con la demanda generada por la receta vigente: 900 piezas, placa de
860 × 564 mm, margen de 5 mm. El resultado volvió a pasar la validación geométrica.
La cotización se probó primero con el candidato inyectado, sin modificar la caché.
Después se publicó mediante los servicios existentes, dentro de una transacción,
y se verificó que la biblioteca pudiera reconstruir también el plan 64/5.

Una cotización nueva mediante la cola real recuperó el resultado en **1.758 ms**
(una medición local, no una garantía de latencia). Impresión y corte comparten
las 64 placas; las 900 piezas y sus documentos de fabricación son los mismos.
El costo total con las tarifas vigentes pasó de **504.955,26 a 490.192,62**;
el costo por producto, de 5.049,55 a 4.901,93. No es el precio de venta.

Se generaron los cinco SVG y cinco DXF con las funciones de exportación del
frontend y los controladores reales, leyendo los originales del storage
configurado. Los DXF se volvieron a interpretar y se verificó la presencia de
sus capas; el inventario de documentos y cantidades coincide con el plan anterior.
Los patrones se repiten **50 + 8 + 2 + 2 + 2 = 64** veces, con 900 piezas exactas.
Las colisiones de nombres de capa mantienen el prefijo legible de la pieza,
por ejemplo `Faldón_CORTE_3`, según las reglas existentes del exportador.

Evidencia y respaldo anterior:
`output/grafonest-transformacion-2026-09-09/promocion-exhibidor-100/`.
Incluye las cotizaciones anterior/candidata/posterior, firmas, los diez archivos,
validación de reutilización y scripts de captura, validación y publicación.
No se modificaron recetas ni órdenes existentes. Esta comprobación no incluyó
crear o ejecutar una OT, ni habilitar globalmente PackingSolver.

**Siguiente frente:** generación dirigida de patrones y retroalimentación del
selector durante la búsqueda. El 64/5 ya es reutilizable para este caso; todavía
no está demostrado que el motor lo descubra desde cero dentro de un presupuesto
dado, ni que 64 placas o cinco patrones sean el óptimo geométrico global.

## Reutilización geométrica y reducción certificada — política 6

La prioridad sigue siendo **menos placas; con igual cantidad de placas, menos
patrones distintos**. La política 6 incorpora tres cambios:

- La materialización prepara la geometría por tipo y orientación y cada pose
  del patrón una vez. Repetir placas copia esos puntos ya preparados. Conserva
  la precisión de seis decimales y objetos independientes para cada copia.
  El caché de orientaciones retiene como máximo 100.000 vértices por llamada.
- El validador comprueba cantidades, identidad, transformación y límites de
  **cada pieza**. Sólo reutiliza intersecciones/separaciones de placas cuyas
  coordenadas y huecos son exactamente iguales, sin redondear la firma. Las
  firmas se limitan a cuatro millones de caracteres por llamada. Si hay pares
  Common Line se mantiene toda la validación individual de placas.
- Cuando un plan inicial ya alcanza un mínimo de placas certificado dentro
  de la cartera, el selector descarta columnas que no pueden participar en
  ningún plan de hasta esa cantidad de placas. Dedica el presupuesto restante
  a reducir patrones. La cartera general recibe primero los patrones del
  mejor resultado conocido, para poder representar esa combinación inicial.

### Ganancia de materialización y validación

Tres repeticiones por versión/caso, alternando el orden, misma geometría,
dependencias y proceso de Node; GC antes de cada medición. Se comparó con
copias compiladas del materializador y validador anteriores a este cambio.
La tabla muestra la **mediana de la suma de ambas etapas**, no el tiempo total
del motor ni un percentil de producción.

| Caso | Piezas | Antes | Ahora |
| --- | ---: | ---: | ---: |
| Exhibidor, 100 unidades | 900 | 399,61 ms | 92,28 ms |
| Exhibidor, 200 unidades | 1.800 | 807,30 ms | 121,66 ms |
| Exhibidor, 500 unidades | 4.500 | 1.985,40 ms | 218,33 ms |
| Puma | 8 | 7,905 ms | 8,114 ms |
| Pieza dentro de un hueco | 2 | 0,194 ms | 0,202 ms |
| Common Line | 8 | 0,317 ms | 0,375 ms |
| Giro fijo y separación | 8 | 0,086 ms | 0,104 ms |
| 200 formas únicas | 200 | 10,672 ms | 11,226 ms |

Los casos de 200 y 500 unidades son repeticiones explícitas del plan conocido
de 100; no son nuevas búsquedas óptimas. En los ocho casos, la materialización
anterior y actual fue idéntica por comparación profunda. El beneficio aparece
al repetir placas; los casos pequeños no muestran una mejora de velocidad.

### Selector: cambio aceptado y variante descartada

Matrices congeladas del exhibidor, procesos nuevos, presupuesto de 15.000 ms
incluyendo imports/preparación, cantidades verificadas con enteros independientes
de HiGHS. Serie final con una repetición por par:

| Cartera y punto de partida | Columnas | Selector anterior | Política 6 |
| --- | ---: | --- | --- |
| Base conocida, 67 placas/4 patrones | 6.692 | 67 placas/4 patrones | 67 placas/4 patrones |
| Sin plan inicial | 8.807 | 67 placas/6 patrones | 67 placas/6 patrones |
| Plan nativo conocido, 64 placas/6 patrones | 8.499 | 64 placas/6 patrones | **64 placas/5 patrones** |

En el último caso se conservaron 6.051 columnas. La cota exacta por enteros
fue 63,5984 placas: cualquier solución entera de **esa cartera** necesita al
menos 64. Preparar y comprobar el certificado tomó 15,98 ms en esa corrida.
El retorno completo fue 13,78 s antes y 13,58 s ahora; la mejora relevante es
un patrón menos bajo el mismo presupuesto, no esa pequeña diferencia de tiempo.
No se demostró que cinco sea el mínimo de patrones ni que 64 sea el mínimo
geométrico global. El plan de 900 piezas/64 placas/5 patrones se reconstruyó
desde las poses y contornos originales y aprobó ambos validadores.

La primera variante también reducía la matriz después del objetivo primario
sin plan inicial. En dos repeticiones empeoró ese caso de seis a ocho patrones,
aunque conservara todas las soluciones posibles: una formulación distinta
cambia la búsqueda que HiGHS logra hacer dentro del tiempo disponible.
Esa variante **se descartó**. La versión adoptada sólo reduce antes del primario,
con un plan conocido que ya alcanza la cota entera; la serie final confirmó que
la búsqueda fría conserva seis patrones. En las dos pruebas exploratorias el
caso nativo también mejoró de seis a cinco patrones.

Los metadatos de certificados de la tabla exploratoria fueron corregidos a
partir del último candidato de cada stdout: la selección del primer empate
había omitido certificados posteriores. No cambiaron placas, patrones ni
tiempos. Se conservaron los archivos originales y la tabla corregida por separado.

### Alcance del certificado

SciPy/HiGHS sólo propone los pesos duales del problema lineal; véase la
[documentación de linprog en SciPy 1.13.1](https://docs.scipy.org/doc/scipy-1.13.1/reference/optimize.linprog-highs.html).
El código los convierte a enteros y vuelve a comprobar todas las desigualdades.
Con matriz de cantidades `A`, demanda `d`, escala `S`, pesos enteros `Y` y
repeticiones enteras no negativas `x`, se cumple:

```text
A x = d                       A_j · Y ≤ S para cada columna
S · sum(x) = d · Y + sum_j (S − A_j · Y) x_j
```

Todos los residuos son no negativos. Si ya tenemos un plan de `B` placas,
una columna con residuo estrictamente mayor que `S B − d · Y` no puede usarse
ni una vez en ningún plan de hasta `B` placas. La igualdad se conserva. Se
verifican rangos antes de operar para evitar overflow y se conserva la cartera
si no hay certificado. El LP recibe como máximo 0,5 s; no se intenta con menos
de 128 columnas o con menos de 0,25 s restantes. Una comprobación adicional
con BigInt verificó el certificado del exhibidor independientemente de NumPy.

### Evidencia y regresiones

Carpeta: `output/grafonest-transformacion-2026-09-09/validacion-patrones/`.
Incluye fuentes anteriores, mediciones geométricas, matrices y poses congeladas,
exploración descartada (`selector-exploratorio/`), comparación aceptada
(`selector-condicional/`) y comprobación geométrica/entera independiente.

**142 pruebas API aprobadas en 23 suites; 31 Python aprobadas; build aprobado.**
Tres pruebas Puma optativas de la suite no se ejecutaron sin
`OPENNEST_INTEGRATION=1`; las mediciones nativas corren en procesos separados.
Las regresiones incluyen una copia desplazada 0,005 mm que crea solapamiento,
giros inválidos y cantidades duplicadas en placas repetidas, independencia de
objetos, Common Line, capas DXF de fabricación y enumeración exhaustiva de todos
los planes factibles pequeños, además de índices originales tras la reducción.

La reducción se puede desactivar con `GRAFONEST_SELECTOR_REDUCCION=0`.
PackingSolver continúa desactivado por defecto. Los ensayos no reemplazan
resultados comerciales ni modifican órdenes confirmadas.

### Comparación del motor completo

Exhibidor de 100 unidades, 900 piezas, sin biblioteca/DB/caché comercial y con
120 segundos de búsqueda. Ambas variantes usan el mismo build de la política 6,
incluida la reutilización geométrica; **sólo cambia el flag de reducción del
selector**. PackingSolver se habilitó exclusivamente en los procesos del ensayo.
Una corrida por variante, seriales, Next pausado y reanudado en `finally`:

| Variante | Placas | Patrones | Primer hito con la calidad final | Retorno |
| --- | ---: | ---: | ---: | ---: |
| Reducción desactivada | 64 | 7 | 43,12 s | 120,003 s |
| Reducción activada | 64 | 6 | 89,65 s | 119,995 s |

Las dos recibieron del generador nativo un plan de 64 placas/12 patrones y
lo combinaron después. La reducción obtuvo un patrón menos dentro del mismo
presupuesto, pero **no aceleró la llegada al primer 64/7** (43,12 frente a
44,63 s). Ambas agotaron el presupuesto. No se afirma que el motor termine
antes ni que esta diferencia de calidad esté garantizada en toda corrida.
La cartera se genera por tiempo y puede variar; el A/B congelado anterior
aisla el selector con más precisión. Los resultados finales pasaron la
validación geométrica independiente del arnés.

El plan conocido de 64/5 sigue siendo mejor que estos dos resultados fríos;
se obtuvo con otra cartera y no se proporcionó como semilla al ensayo. Por eso
la biblioteca de combinaciones conocidas sigue siendo relevante. Ninguno de
estos resultados constituye prueba de optimalidad geométrica global.

Evidencia completa, hashes de fuente/build/binario y fases:
`validacion-patrones/integrado/`. Reproducción (requiere el binario opcional ya
instalado y un PID de Next local que el arnés pueda pausar):

```sh
PACKINGSOLVER_BIN=/ruta/al/packingsolver_irregular \
  apps/api/.venv-opennest/bin/python \
  apps/api/test/benchmarks/medir-selector-integrado.py PID_NEXT
```

El selector aislado se reproduce con `selector-reduccion.py`; la comparación
geométrica con `node --expose-gc apps/api/test/benchmarks/validacion-patrones.cjs`
y la reconstrucción de 64/5 con `verificar-seleccion-reducida.cjs`. Esos arneses
usan las matrices, poses y fuentes históricas guardadas en la carpeta indicada.

La API y el worker locales se reiniciaron con las colas vacías y la política 6
compilada. API y frontend respondieron HTTP 200; el pool quedó sin pendientes
ni permisos activos. Reducción habilitada, PackingSolver deshabilitado.
Estado verificado: `validacion-patrones/estado-runtime.json`. Siguen pendientes
la entrega temprana de búsquedas activas, generación dirigida, ampliación del
corpus y cuotas físicas de CPU/RAM; este bloque no cierra la transformación.

## Capacidad compartida, recuperación de cola y guardia independiente

La API y los workers comparten una admisión atómica en Redis: turnos entre
fábricas, prioridad/FIFO dentro de cada fábrica, reservas de capacidad y una
entrada normal disponible ante trabajos intensivos. La API registra antes de
encolar y confirma después; no resucita jobs terminados. Una presencia pendiente
vence a los 30 segundos sin nuevos intentos para retirar turnos abandonados.
El job de BullMQ permanece y puede volver a registrarse. Los permisos activos
se renuevan cada 20 segundos y vencen a los 60; se comprueba su propietario.

Fallos transitorios de admisión y pérdida de permisos reprograman el trabajo.
Los procesos Python/nativos tienen una guardia independiente: EOF del descriptor
de Node termina el grupo si el coordinador muere. Node envía pulsos cada cinco
segundos; 45 segundos de silencio terminan el grupo si queda suspendido. La
guardia está lista antes de lanzar C++ y limpia hijos que ignoran SIGTERM.
Este protocolo se probó en macOS; usa grupos POSIX y no está implementado para
Windows. No reemplaza cuotas físicas de CPU/RAM del despliegue.

### Ensayos reales de este bloque

Carpeta base: `output/grafonest-transformacion-2026-09-09/`.

| Caso | Resultado y alcance |
| --- | --- |
| Tres workers, ráfaga de 100 trabajos de A y pedidos de otras fábricas | 106 completados una sola vez. B entró después de un trabajo de A; FIFO conservado. Convivieron normales e intensivos. Reservas máximas: 4 CPU/4096 MiB, sin permisos ni pendientes al terminar. Tiempos de trabajo controlados; no es velocidad de nesting. |
| Despertar el próximo trabajo al liberar lugar | Serie controlada: 96.944 ms sin despertar → 28.295 ms con despertar (70,8% menos tiempo de lote). Misma implementación salvo el despertar desactivado sólo en el arnés. Una corrida previa dio 10.694 ms con despertar: persiste variación; no extrapolar un percentil. |
| Caída real de worker BullMQ con SIGKILL | Otro proceso recuperó el checkpoint validado de 900 piezas, 64 placas y 5 patrones. Sin evento fallido y sin publicar el avance como precio terminado. Descendientes detenidos en 12 ms; retorno total 72.712 ms, incluyendo espera del permiso de 60 s y validación/búsqueda controlada. |
| Coordinador suspendido con SIGSTOP | Después de dos pulsos previos, sus descendientes terminaron en 43.954 ms desde la suspensión, antes de los 60 s del permiso. Node se reanudó y reconoció la interrupción. |
| Puma real, tres repeticiones por motor | Todas 2 placas/2 patrones. Motor actual: 4.279, 3.883 y 3.943 ms. Nativo opcional: 414, 338 y 390 ms. Incluye la nueva guardia y validación original; frío, sin DB/caché comercial. |

La serie controlada pausa temporalmente Next.js, conserva API/worker inactivos,
alterna el orden de las variantes geométricas y no ejecuta compilaciones ni
otras pruebas durante la medición. Se reanudó Next.js en `finally`. Condiciones,
hashes de fuentes/binario, eventos, estados de reserva y resultados completos:
`capacidad-serie-controlada/`. La comparación de cola sólo tiene una corrida
por variante; los seis Puma tampoco establecen percentiles de producción.

Recuperación final: `cola-recuperacion-final/aceptacion.json` y sus logs.
En BullMQ 6.3.4, `attemptsMade` también aumenta al completar correctamente:
el informe final lo llama `intentosFinalizados=1`, con `eventosFallidos=0`.
Los 93 intentos iniciados incluyen reprogramaciones de espera; no son 93
ejecuciones del solver. El primer ensayo histórico había etiquetado ese campo
incorrectamente como `intentosFallidos`; no usar esa etiqueta para interpretarlo.
Suspensión: `guardia-suspension/aceptacion.json`.

Validación automatizada de este bloque: **85 pruebas API en 12 suites y 22
pruebas Python aprobadas**. El build final pasó
(`build-capacidad-listo.log`). Los ensayos BullMQ y de suspensión se ejecutan
por separado. Los prefijos Redis y tenants de prueba se limpiaron. Los fallos
intermedios de compilación por tipos de BullMQ se conservaron en sus logs y se
corrigieron usando su interfaz pública y tipos explícitos.

La API y el worker locales se reiniciaron coordinadamente con las colas vacías.
API y frontend respondieron HTTP 200; los workers iniciaron ambas clases y el
pool quedó sin permisos activos ni pendientes. Evidencia:
`estado-runtime-capacidad.json`. El motor nativo continúa deshabilitado en la app.

Pendiente: imponer CPU/RAM físicamente en el despliegue, ampliar carga real por
fábrica, reducir variación/sondeo de jobs demorados, entrega temprana de búsquedas
activas y generación dirigida de patrones. La reserva declarada no garantiza
consumo físico ni certifica escalabilidad industrial. PackingSolver sigue
desactivado por defecto; estos ensayos no modificaron nestings comerciales.

## Integración opcional de PackingSolver — política 5

El generador nativo está integrado en el mismo ciclo de candidatos, validación,
comparación, checkpoints y combinación de patrones. La instalación fija la
fuente `a7e533033d9c6ee3ff286513720afe6660b5989f`; la reconstrucción Release con
HiGHS conservó el SHA-256 del binario ensayado:
`12ea2ff76af71faffaf2b923cadcdbb4087f9972dd0a66baaac3c4bedb5fc861`.
El instalador adjunta manifiesto y avisos de las dependencias. El motor permanece
**desactivado por defecto** y no se importaron resultados experimentales a las
cotizaciones guardadas. Su habilitación general requiere completar el control
de capacidad y la validación de concurrencia de la matriz de aceptación.

Cambios verificados durante esta integración:

- PackingSolver propone poses; GrafoNest reconstruye contornos y huecos
  originales, comprueba cantidades, giros, márgenes, separación y Common Line.
  El motor alternativo tiene procedencia propia tanto en persistencia como en
  el contrato comercial. Un resultado inválido o una falla del ejecutable
  conserva la mejor solución anterior y permite continuar con los otros motores.
- El supervisor termina el nativo cuando se cancela, vence el plazo, desaparece
  el padre o se excede la guardia de memoria. Se probaron procesos reales que
  ignoran SIGTERM y una caída del coordinador con SIGKILL. La guardia mide RSS
  nativo más supervisor; no es un límite duro de sistema ni de todos los jobs.
- Los certificados nativos repiten geometría y espacios de formato. Un límite
  inicial de 8 MiB frenaba el exhibidor a los diez segundos con
  `certificado-excesivo`, aunque sólo se habían observado 190 MiB de RSS nativo.
  Se corrigió esa confusión: lectura de archivo acotada según la memoria
  configurada y transmisión únicamente de poses. El diagnóstico permitió
  distinguir esta causa de un supuesto agotamiento de RAM.
- La preparación nativa no tiene sentido para un lote grande si sólo le quedan
  cinco segundos. La comparación inicial con 15 segundos mostró regresiones
  en 50, 100, 101 y 200 unidades. Ahora exige al menos diez segundos propios
  para 100 piezas o más; conserva el umbral de cuatro para casos pequeños.
- La generación posterior de patrones recibe tiempo relativo al presupuesto
  restante. Antes, después de una fase nativa de 40 segundos, su plazo absoluto
  ya había vencido y no ampliaba la cartera. La regresión simula esa secuencia.
- La cota inferior agrega un límite por cantidad de piezas grandes. Por ejemplo,
  seis piezas de área neta 5.100 mm² en placas de 10.000 mm² requieren seis
  placas: no caben dos juntas. La suma de áreas sólo daba una cota de cuatro.
  El razonamiento también contempla tercios, cuartos, etc., conserva huecos y
  admite exactamente dos piezas que ocupan media placa. No es una heurística
  que sacrifique calidad para terminar antes.

### Pruebas y método de comparación

108 pruebas de API en 17 suites, 20 pruebas comerciales del frontend en dos
suites y ocho pruebas reales del supervisor Python aprobadas (136 en total).
La compilación de producción pasó. Las pruebas incluyen
persistencia/checkpoint con procedencia nativa y biblioteca → DXF conservando
entidades originales de corte/hendido, arco, círculo y texto. Se generaron dos
TAP reales desde el resultado nativo del Puma, cada uno con tres repeticiones:
24 piezas en seis placas. El lector independiente verificó cierre, límites,
velocidad de 350 mm/min, longitud y tiempo calculado. No se afirma una prueba
física en una máquina por validar esos archivos.

El corpus reproducible contiene 13 casos: Puma, exhibidor 1/25/50/100/101/200,
concavidad, pieza dentro de un hueco, giro fijo con separación, máximo de una
placa, Common Line y 200 formas únicas. Cada variante nace fría, tiene el mismo
presupuesto y pasa la validación original. No usa datos comerciales ni biblioteca
aprendida de una corrida anterior. El caso de una placa conserva el error del
motor anterior en vez de omitirlo de la comparación.

La primera serie está en `corpus-nativo-15s/`; la segunda, en
`corpus-nativo-adaptativo-15s/`, detectó recompilación concurrente de Next.js
(más de tres núcleos ocupados). Sirve para conservar evidencia funcional y
variabilidad, **no para atribuir diferencias de velocidad al cambio**. La serie
controlada pausa temporalmente ese servidor, mantiene la API activa y no ejecuta
compilaciones ni otros benchmarks simultáneos. Reanuda el servidor al terminar.
Se guardan las condiciones, el hash del binario y las fuentes exactas en
`serie-controlada/`. Son ejemplos locales individuales, no percentiles ni una
garantía de alcanzar el óptimo geométrico global.

Reproducción (elegir carpetas de salida nuevas, con la computadora sin otras
compilaciones activas):

```sh
npm --prefix apps/api run build
python3 apps/api/scripts/install-packingsolver.py
# Usar la ruta de PACKINGSOLVER_BIN que devuelve el instalador.
PACKINGSOLVER_BIN=/ruta/packingsolver_irregular \
  node apps/api/test/benchmarks/grafonest-corpus.cjs \
  output/grafonest-mejoras-2026-09-09/entrada-100.json /tmp/corpus-nuevo 15000
GRAFONEST_CORPUS_CASOS=exhibidor-100 PACKINGSOLVER_BIN=/ruta/packingsolver_irregular \
  node apps/api/test/benchmarks/grafonest-corpus.cjs \
  output/grafonest-mejoras-2026-09-09/entrada-100.json /tmp/exhibidor-120s 120000
```

La preparación, validación y terminación de procesos forman parte del tiempo de
retorno. Que un buen candidato aparezca antes no significa que el sheet ya lo
haya recibido: la entrega durante una búsqueda activa sigue pendiente.

### Resultados con el frontend pausado

Ambas variantes utilizan la política 5 final; la diferencia es habilitar el
generador PackingSolver. No se confunde esta comparación con la del algoritmo
anterior a todas las mejoras del proyecto. Misma máquina macOS ARM64 de ocho
CPU lógicas, sin biblioteca ni persistencia; un proceso por vez.

| Caso | Sin generador alternativo | Con generador alternativo | Retorno completo sin / con |
| --- | --- | --- | --- |
| Exhibidor, 100 unidades / 900 piezas | 67 placas, 6 patrones | 64 placas, 6 patrones | 119,93 / 120,01 s |
| Puma, 8 piezas | 2 placas, 2 patrones | 2 placas, 2 patrones | 4,50 / 0,38 s |
| Pieza dentro de un hueco | 1 placa, 1 patrón | 1 placa, 1 patrón | 0,41 / 0,16 s |
| Giro fijo y separación de 3 mm | 4 placas, 2 patrones | 4 placas, 2 patrones | 14,97 / 15,00 s |
| Dos triángulos, máximo una placa | No obtiene solución | 1 placa, 1 patrón | Error / 0,15 s |
| Common Line, 8 piezas | 4 placas, 2 patrones | 2 placas, 2 patrones | 15,00 / 14,94 s |
| 200 formas diferentes | 1 placa, 1 patrón | 1 placa, 1 patrón | 1,10 / 0,91 s |
| Seis piezas cóncavas mayores que media placa | 6 placas, 2 patrones | 6 placas, 2 patrones | 4 / 3 ms |

En 200 formas se omite correctamente el generador nativo por presupuesto corto;
la diferencia de 0,19 s no se atribuye a él. En las seis piezas cóncavas, ambas
variantes usan la nueva cota y terminan sin motores: las series anteriores sin
esa cota consumían los 15 segundos para devolver las mismas seis placas.

El exhibidor llegó a 64 placas/12 patrones durante la fase geométrica. La
combinación pequeña redujo a siete patrones a los 44,21 s y la cartera ampliada
a seis a los 89,95 s. La fase de generación dispuso efectivamente de seis
segundos después de la corrección de su reloj. El retorno completo siguió
siendo de dos minutos. La cota inferior de placas sigue en 56: **64 no queda
certificado como óptimo global**.

Frente al mejor consumo conocido del motor previo, 67 placas, son tres placas
menos (4,48%). Otras corridas anteriores habían conseguido 67 placas/4 patrones;
no se oculta esa referencia: la nueva corrida reduce material pero tiene dos
patrones más que aquel plan. La reducción de 12 a 6 patrones se compara a
igual consumo de 64 placas. Se respeta la prioridad acordada placas → patrones.

El máximo RSS observado del generador fue 330,77 MiB; nativo más supervisor,
376,50 MiB. Node terminó con 134,28 MiB de RSS, que no es su pico. Estas medidas
no incluyen el pico del selector ni equivalen al consumo global bajo concurrencia.
El mismo certificado que antes transmitía 1.982.180 bytes pasó a 11.221 bytes
al conservar sólo poses: reducción del 99,43%, sin alterar coordenadas.

Evidencia: `serie-controlada/exhibidor-100/`, `serie-controlada/geometrias/`,
`comparacion-transporte.json` y `portafolio-tap/` dentro de
`output/grafonest-transformacion-2026-09-09/`. Se conservan entradas, resultados,
certificados, hitos, descartes y errores. La mejora integral de GrafoNest sigue
abierta; la adopción general, la entrega temprana y la capacidad entre fábricas
no se consideran terminadas por estos ejemplos.

API y worker reiniciados con la política 5 al terminar las pruebas. El generador
alternativo continúa desactivado por defecto. La API respondió HTTP 200 y las
colas comercial, geométrica e intensiva estaban vacías antes del reemplazo de
procesos. No se alteraron órdenes ni nestings guardados de clientes.

## El selector conserva la combinación inicial — política 4

El selector recibe la combinación completa del mejor resultado cuando se puede
representar en su cartera. Verifica las cantidades y la entrega antes de llamar
a HiGHS. La primera optimización conserva su formulación anterior; se compara
con el plan inicial y se retiene el ganador. La segunda optimización limita el
número de patrones al del mejor plan con las placas elegidas. Reducir placas
sigue teniendo prioridad, aunque exija más patrones.

Esto es conservación de un candidato y uso de una cota en el segundo objetivo;
no guarda el árbol de búsqueda de HiGHS. La capa exterior ya conservaba el mejor
resultado: la mejora consiste en que el selector también recibe y conserva esa
combinación, en lugar de devolver una combinación peor o fallar sin candidato.
Cada candidato vuelve a pasar por materialización y validación independiente.
Se verificó la combinación de 67 placas/900 piezas del caso real.

Se descartaron dos variantes tras medirlas:

- Un hilo por trabajo: redujo CPU, pero hubo resultados peores con dos procesos
  y cinco segundos. `GRAFONEST_SELECTOR_THREADS` queda disponible entre 1 y 8;
  el valor por defecto 0 conserva la configuración automática. La opción se
  pasa a HiGHS mediante SciPy 1.13.1 y se fijan los límites BLAS antes de importar
  NumPy. No constituye un límite global de CPU/RAM de GrafoNest. Véanse el
  [control de hilos de HiGHS](https://ergo-code.github.io/HiGHS/dev/parallel/)
  y el adaptador instalado `scipy/optimize/_milp.py`.
- Una cota adicional de placas en la primera optimización: modificó las
  heurísticas de HiGHS y empeoró algunas corridas cortas. Fue retirada.

Los ensayos sin límite externo también detectaron respuestas posteriores al
presupuesto interno. La serie de aceptación usa cinco segundos reales para
recibir candidatos y 250 ms de gracia para terminar el proceso, como el worker.
El tiempo final puede incluir esa terminación, pero ninguna respuesta recibida
después del límite cuenta como candidata. `wait4` mide CPU y pico RSS de cada
proceso Python completo, incluidos sus hilos nativos. La suma de picos individuales
es una cota de reserva, no un pico simultáneo medido del servidor.

### Medición final con límite externo

La misma cartera fija de 6.692 patrones y demanda de 900 piezas; tres tandas
individuales y tres tandas de dos procesos por variante. Ejecuciones alternadas,
sin usar colas o tenants comerciales. Hilos automáticos en ambas variantes.

| Punto de partida | Selector anterior, 9 ejecuciones | Selector actual, 9 ejecuciones |
| --- | --- | --- |
| Base 74 placas/8 patrones | 3 × 67/12; 4 × 82/10; 1 × 84/7; 1 sin candidato | 5 × 67/12; 4 × 74/8 |
| Combinación conocida 67/4 | 6 × 67/12; 3 × 82/10 | 9 × 67/4 |

Son resultados del **selector aislado**. La orquestación anterior ya protegía
el plan existente: no significa que se estuvieran reemplazando cotizaciones
67/4 por 82/10. En la versión actual, el propio selector conserva ese piso de
calidad y aporta la combinación al objetivo secundario.

Con el plan conocido, el primer candidato llegó entre **219 y 306 ms**. La
búsqueda continuó hasta consumir su presupuesto; en cuatro de los seis procesos
concurrentes fue necesario el corte externo, conservando el 67/4 que ya habían
entregado. No se presenta ese primer hito como tiempo completo del sheet.

Medianas de tiempo completo: con el plan conocido, anterior 4,67 s individual /
4,69 s dos procesos; actual 4,69 s / 5,02 s. El costo de CPU por tanda concurrente
fue 9,27 s y 9,41 s respectivamente. No hay una aceleración general demostrada:
la mejora medida es conservar una combinación mejor desde el comienzo. Con la
base inicial hay variabilidad; falta ampliar corpus y presupuestos antes de
atribuir una mejora universal a la búsqueda.

Evidencia final: `recursos-selector/base-limite-externo/` y
`recursos-selector/inicial-limite-externo/`. Las carpetas `con-base`,
`con-plan-inicial*`, `base-final` y `plan-inicial-final` contienen ensayos previos,
incluidos los que carecían de corte externo; no son la serie de aceptación.
`recursos-selector/validacion-inicial.json` registra la validación geométrica
del plan conocido. El script conserva stdout, stderr, recursos, hitos y fallos;
no elimina fallos de la comparación. Son pocas repeticiones locales, no p95.

Reproducción después del build (cambiar carpeta de salida):

```sh
GRAFONEST_BENCH_THREADS=0 apps/api/.venv-opennest/bin/python \
  apps/api/test/benchmarks/selector-recursos.py \
  output/grafonest-transformacion-2026-09-09/recursos-selector/entrada-inicial.json \
  output/grafonest-transformacion-2026-09-09/recursos-selector/runner-anterior.py \
  apps/api/src/workers/geometria/python/patrones_runner.py /tmp/selector-nueva-medicion
```

Para el caso sin plan optimizado conocido usar `entrada-base.json`.

Pruebas: 41 casos en cinco suites de núcleo/selección/biblioteca/checkpoints y
49 en once suites de persistencia, colas, límites y fabricación DXF. Once casos
de Python incluyen conservación del plan al agotarse la primera fase, prioridad
de placas sobre patrones, rechazo de una combinación inválida y cuotas de hilos.
Build aprobado después de retirar la cota primaria. La búsqueda es versión 4;
la firma geométrica se mantiene: no se invalidan órdenes ni se fuerza a cotizar
de nuevo un plan guardado. Una solicitud explícita de mejora sí usa la política nueva.

La prueba SIGKILL se repitió con el build final de política 4: recuperó 900
piezas/64 placas/5 patrones y limpió el checkpoint al publicar. Evidencia:
`checkpoint-politica-4/`. API y worker locales reiniciados después de verificar
las tres colas sin trabajos pendientes/activos; API respondió HTTP 200.

## Recuperación durable de avances — 9/9/2026

Cada mejora validada se puede guardar en `NestingCheckpoint`, separada de la
cotización terminada. Al iniciar otra búsqueda con la misma geometría y tenant,
se recupera como candidato y se incorporan sus patrones al selector. Se conserva
el mejor plan entre caché y checkpoint; no se recupera el estado interno del
algoritmo C++. No se declara que la búsqueda terminó ni se cuenta presupuesto
explorado sólo por recuperar ese avance.

El escritor mantiene una escritura activa y el último candidato pendiente.
La transacción comparte el bloqueo del caché definitivo: una escritura tardía
de peor calidad no pisa el mejor resultado ni borra un checkpoint mejor. Al
publicar el resultado, el checkpoint superado se elimina. Cancelar espera la
escritura pendiente. Un registro corrupto se descarta sin bloquear una nueva
búsqueda o la publicación de un resultado válido.

Se guardan posiciones y giros, sin copiar todos los vértices. Al recuperar se
reconstruyen los originales con la precisión de exportación y se validan demanda,
geometría, márgenes, separación, huecos y Common Line. Para las 900 piezas reales
del exhibidor: **100.305 bytes frente a 4.430.115 bytes**, reducción de **97,74%**
del JSON de referencia. No es una medición de espacio físico de PostgreSQL.

Prueba real de interrupción entre procesos:

1. Un proceso Node guarda el candidato conocido de 64 placas/5 patrones en un
   tenant temporal de `gdi_saas_test`; todavía no hay resultado comercial.
2. Se lo termina con SIGKILL después del commit.
3. Otro proceso recupera y valida las 900 piezas, conserva 64/5 y publica el
   resultado completo; el checkpoint queda limpio.

El runner está controlado para ubicar la caída de forma reproducible: es una
prueba de persistencia/procesos, no una nueva medición de optimización ni un
ensayo de recuperación de trabajos stalled de BullMQ. El primer ensayo compacto
detectó que una promesa pendiente no mantiene vivo Node; se agregó un temporizador
al hijo de prueba. La evidencia final es `checkpoint-recuperacion-poses-v2/`.

También se corrigió la cuota distribuida: si no se puede renovar, se detiene el
solver y se reprograma el trabajo después de guardar su avance. El permiso vence
en un minuto tras una caída, en lugar de permanecer durante todo el presupuesto
de cinco minutos. Las cuotas interactiva/intensiva permanecen separadas.

Verificación: 43 pruebas en seis suites de núcleo/checkpoints/cuotas; 17 pruebas
en cuatro suites de integración y servicios, incluyendo el caso adicional de
registro corrupto. Hay suites repetidas entre ambos grupos: no sumar como casos
únicos. Build de producción aprobado. Migración aditiva
`20260909030000_nesting_checkpoints` aplicada a desarrollo y prueba; permisos del
rol `grafo_app` verificados.

Reproducción después del build:

```sh
node apps/api/test/benchmarks/checkpoint-recuperacion.cjs /tmp/checkpoint-nueva-prueba
```

## Planes completos y entrega por reutilización — política 3

La biblioteca conserva ahora la combinación de patrones y sus repeticiones,
además de las poses. Se normaliza por divisor común para no guardar por separado
100 y 200 unidades del mismo plan. Sólo escala si conserva cantidades exactas
de todas las piezas y repeticiones enteras; nunca redondea placas ni fabrica excedentes.
El máximo es 32 combinaciones y 256 patrones, dentro de 2 MiB por familia/tenant.
El JSON anterior sigue siendo legible y se actualiza al aprender, sin otra migración.

Las referencias son estables ante el reordenamiento de claves de PostgreSQL y
los cambios de un último bit al convertir números con Prisma. Su firma usa los
seis decimales de exportación; las poses almacenadas no se alteran. El caso real
detectó este segundo detalle, que se agregó como regresión a las pruebas.

Una cotización puede devolver el plan completo validado sin arrancar el selector
ni un motor nativo. Se registra `PLAN_REUTILIZADO`, con cero presupuesto nuevo
explorado. `buscarMejora` sigue buscando y conserva el ganador: reutilización no
equivale a óptimo global ni impide preparar un plan mejor después.

También se permite continuar cuando la base por cajas supera el máximo de placas:
dos triángulos pueden encajar en una placa aunque sus rectángulos necesiten dos.
Si no se encuentra un plan completo, se devuelve un error, nunca una base fuera
del límite. Cuando ya se alcanzan las cotas de placas **y** patrones, se evita
arrancar el proceso nativo. Common Line se aplica y valida antes de esa salida.

### Mediciones con la combinación experimental conocida de 64 placas/5 patrones

Cada cantidad vuelve a empezar únicamente con el plan de 100, usando un tenant
temporal de `gdi_saas_test`. No hereda resultados de las otras cantidades.

| Unidades | Piezas | Placas | Patrones | Plan validado | Retorno completo | Búsqueda nueva |
| ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 9 | 1 | 1 | 0,02 s | 0,24 s | No: ambas cotas alcanzadas |
| 25 | 225 | 17 | 7 | 5,68 s | 10,26 s | Sí: no escala exactamente |
| 50 | 450 | 32 | 5 | 0,87 s | 1,27 s | No: combinación reutilizada |
| 100 | 900 | 64 | 5 | 2,06 s | 2,91 s | No: combinación reutilizada |
| 101 | 909 | 65 | 8 | 5,08 s | 10,63 s | Sí: no escala exactamente |
| 200 | 1800 | 128 | 5 | 2,82 s | 3,92 s | No: combinación reutilizada |

El retorno incluye aprendizaje final y validación adicional del script. Son
mediciones individuales de reutilización, no benchmarks de búsqueda fría ni p95.
El resultado de 25 unidades tiene un patrón más que otra serie alimentada con
una biblioteca distinta. Eso señala que hace falta seguir mejorando la generación
y conservar diversidad; estas mediciones no demuestran mejora universal.

Control con el plan comercial anterior de 67/4: 100 unidades devuelven 67/4 en
2,63 s y 200 devuelven 134/4 en 3,60 s, sin motor ni selector. Este control también
usa el tenant de prueba. **No se reemplazaron los resultados comerciales por el
64/5 experimental.** API y worker locales están activos con la política 3.

Reproducción, después del build:

```sh
GRAFONEST_BENCH_REFERENCE=output/grafonest-transformacion-2026-09-09/biblioteca-patrones-nativos/resultado-100.json \
node apps/api/test/benchmarks/grafonest-biblioteca.cjs /tmp/planes-completos-nueva-medicion
GRAFONEST_BENCH_CANTIDADES=100,200 \
node apps/api/test/benchmarks/grafonest-biblioteca.cjs /tmp/planes-comerciales-nueva-medicion
```

Definir `GRAFONEST_BENCH_BUSCAR_MEJORA=1` mantiene la búsqueda completa aun cuando
se dispone de una combinación conocida. Evidencia final de esta serie:
`biblioteca-planes-completos-v2/` y `biblioteca-planes-comerciales/`. La primera
carpeta `biblioteca-planes-completos/` conserva el ensayo anterior a corregir las
referencias numéricas: no representa la entrega rápida final.

### Fabricación y regresiones de integración

- Prueba PostgreSQL nueva: importar DXF con seis entidades, asignar hendido,
  aprender un patrón con giros 0°/90°, duplicar de 4 a 8 piezas, exportar y releer
  el DXF de un patrón. Conserva capas, arcos, círculos y texto; suma 2400 mm de
  hendido y duplica el perímetro de corte, sin modificar la fuente original.
- Prueba TAP con motor real: aprender las dos placas del Puma, triplicar a 24
  piezas/seis placas y generar dos archivos, cada uno repetido tres veces.
  Se releen los TAP: recorridos cerrados, velocidad 350 mm/min, límites de máquina
  respetados y longitudes/tiempos coherentes con las métricas del generador.
  Esta verificación de archivo no sustituye una prueba física de máquina.
- 100 casos del núcleo y biblioteca verificados en 16 suites, incluyendo la
  repetición de la suite de persistencia después de actualizar su caso de
  búsqueda ampliada para que no parta de un óptimo ya demostrado.
- 38 pruebas adicionales de API en nueve suites: DXF, preparación de recorridos,
  instalación, componentes anidados y cotización → emisión → ejecución de OT.
  Las cinco capturas del catálogo F4 verifican cantidades, costos y placements
  congelados. Transacciones revertidas en base de prueba; comunicaciones aisladas.
- 27 pruebas de interfaz/exportación en cuatro archivos: agrupación, SVG/DXF,
  descargas y selección del plan cotizado. Build de API aprobado.
- 32 pruebas de operaciones de corte, consolidación, recorridos vectoriales y
  cotización → OT con herramientas aprobadas en cuatro suites adicionales.
- Puma con la política 3: fixture y tres ejecuciones del motor real aprobadas
  (cuatro pruebas, 14,66 s en total), conservando sus dos placas.

TAP reproducible: `node apps/api/test/benchmarks/biblioteca-tap.cjs /tmp/tap-biblioteca`.
Archivos y análisis en `output/grafonest-transformacion-2026-09-09/biblioteca-tap/`.
Manifiesto de 39 fuentes de esta verificación: `fuentes-sha256-politica-3.json`
en la carpeta de evidencia. API HTTP 200 y ambas colas geométricas disponibles
después del reinicio; no había trabajos activos al reemplazar los procesos.
La entrega de candidatos de una búsqueda aún activa, control global de recursos
y adopción del motor alternativo siguen pendientes. Los checkpoints de este
apartado se implementaron después, según el registro anterior.

## Biblioteca, geometría y diagnóstico — 9/9/2026

La política de búsqueda 2 incorpora una biblioteca persistente de patrones por
tenant y familia geométrica. La firma incluye contornos, huecos, orientaciones,
placa, margen, separación y configuración Common Line; excluye cantidades,
semilla, presupuesto, nombres, motor y máximo de placas. Una placa válida se
puede repetir en otra tirada compatible, independientemente del motor que la encontró.

Se guardan poses y recorridos compartidos, sin duplicar los contornos de cada
copia. Máximo: 256 patrones y 2 MiB por familia. Cada patrón recuperado se
reconstruye desde la geometría original y atraviesa el validador independiente.
Una entrada corrupta no invalida las otras. Las referencias de corte compartido
se renumeran al repetir un patrón; las capas del diseño actual siguen siendo
transformadas por el adaptador de fabricación existente.

El solver consulta primero una cartera pequeña con patrones aprendidos y restos
de la base. Después continúa la generación y búsqueda general, conservando el
mejor candidato. Los aciertos de caché del API también alimentan la biblioteca
para aprovechar acomodos anteriores sin volver a nestearlos.

Se eliminó la expansión de toda la tirada para cosechar un solo patrón repetido
y dos agrupaciones que copiaban/filtraban arrays innecesariamente. Se registran
fases y tiempos acumulados; `origenSolucion` identifica dónde nació el acomodo
ganador aunque una búsqueda posterior no lo mejore.

Migración aditiva: `20260909020000_biblioteca_patrones`, aplicada en desarrollo
y tests. API y worker reiniciados con la nueva implementación; salud HTTP 200
y workers de ambas colas listos. No se modificaron órdenes confirmadas.

## Exhibidor con una biblioteca conocida

Se partió, para **cada caso**, únicamente de los cuatro patrones del resultado
de 100 unidades conservado en la auditoría. Las corridas usaron la base dedicada
`gdi_saas_test`, un tenant temporal y el motor real con presupuesto de 10 s.
Se eliminó el tenant al terminar. No se tocaron los nestings comerciales.

| Unidades | Piezas exactas | Placas | Patrones | Primer hito con esa calidad | Retorno completo |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 9 | 1 | 1 | 1,18 s | 1,21 s |
| 25 | 225 | 17 | 6 | 3,14 s | 10,17 s |
| 50 | 450 | 34 | 5 | 3,45 s | 10,21 s |
| 100 | 900 | 67 | 4 | 2,30 s | 10,62 s |
| 101 | 909 | 68 | 6 | 4,33 s | 10,51 s |
| 200 | 1800 | 134 | 4 | 4,05 s | 11,11 s |

El retorno incluye aprendizaje final y validación del script; la búsqueda tiene
su reloj propio. Los hitos son de placas/patrones, no necesariamente de la misma
pose final. Para 100, el bloque anterior sin biblioteca había alcanzado 67/4 a
los 35,3 s. No es una comparación de caché fría contra fría: el beneficio medido
consiste precisamente en reutilizar patrones ya conocidos. Son corridas individuales.

La memoria RSS registrada corresponde a Node al terminar cada caso, no al pico
total de los procesos nativos. Falta la medición completa bajo concurrencia.

Reproducción:

```sh
npm --prefix apps/api run build
node apps/api/test/benchmarks/grafonest-biblioteca.cjs /tmp/medicion-biblioteca-nueva
```

La interfaz mantiene sus presupuestos previos. Este bloque todavía no entrega
el resultado al sheet antes de terminar el trabajo ni persiste checkpoints de
todos los candidatos intermedios. Ambos pertenecen al objetivo activo.

## Pruebas de este bloque

90 pruebas en 15 suites de TypeScript aprobadas, incluyendo geometría, colas,
persistencia, Common Line, adaptadores y la biblioteca. Prueba específica de
jobs aprobada después de conectar el aprendizaje en los aciertos de caché del
API. Compilación de producción aprobada. Los límites de tipado global de tests
ajenos detectados en el primer bloque siguen fuera de esta afirmación.

Evidencia: `output/grafonest-transformacion-2026-09-09/biblioteca/` y scripts en
`apps/api/test/benchmarks/`. La validación de capas exportadas y cotización a OT
debe ampliarse en el cierre integral; estas pruebas no sustituyen ese recorrido.

## Comparación nativa en preparación

Se compiló [PackingSolver](https://github.com/fontanf/packingsolver/tree/a7e533033d9c6ee3ff286513720afe6660b5989f),
commit `a7e533033d9c6ee3ff286513720afe6660b5989f`, en Release con HiGHS, sin CLP,
con dos trabajos de compilación simultáneos. Sigue aislado del cotizador.

El adaptador de prueba normaliza el orden de los anillos que exige ese motor
y reconstruye los resultados con todos los puntos originales. Rechaza espejado
y usa la validación existente de demanda, rotación, márgenes, separación y huecos.
No se interpretan certificados del motor como garantía suficiente.

Primer Puma real: candidato de dos placas y dos patrones validado a los 305 ms;
proceso completo 1,06 s. Hubo dos ensayos previos rechazados por incompatibilidad
del formato de huecos y selección del optimizador matemático; se conservaron
también sus logs. Falta repetir con carga controlada y el resto del corpus antes
de decidir su incorporación.

En el exhibidor, la búsqueda con 72 orientaciones entregó 67 placas/11 patrones
a los 19,0 s y alcanzó el límite externo de 40 s (30 s del motor más preparación).
Con cuatro orientaciones cardinales, todas permitidas por el contrato original,
entregó 65 placas/11 patrones a los 12,0 s. El certificado final contenía 64
placas/12 patrones, pero su reconstrucción inicial produjo un error numérico
en la operación booleana del validador.

Al reconstruir con seis decimales, la misma precisión utilizada por el runner
actual y las exportaciones, las 900 piezas de ese certificado pasaron la validación
independiente original. No se cambiaron margen, separación, cantidad, escala ni
los límites de validación. Esta precisión se incorporó también a la materialización
de patrones para poder reutilizar esas poses. Se conservan el certificado, el
rechazo inicial y la reconstrucción validada; no se presenta el tiempo del rechazo
como un tiempo medido de aceptación de la corrección.

Después se alimentó la biblioteca con los 12 patrones del certificado nativo
de 64 placas. Cada corrida volvió a partir sólo de esa referencia, sin heredar
lo aprendido por la corrida anterior:

| Unidades | Placas | Patrones | Hito de esa calidad | Retorno completo |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 64 | 5 | 3,52 s | 10,54 s |
| 101 | 65 | 9 | 4,48 s | 10,58 s |
| 200 | 128 | 9 | 9,37 s | 11,15 s |

La combinación de un generador geométrico mejor con el selector reduce tanto
placas como programas respecto del certificado nativo de 12 patrones. Todavía
hay una oportunidad explícita: repetir el plan de 100 con 64 placas/5 patrones
dos veces daría 128 placas/5 patrones. El selector de la corrida aislada de 200
no contaba con ese plan ya simplificado. Debe conservarse también la combinación
conocida como candidato inicial para evitar redescubrirla entre miles de columnas.

Se agregó una regresión mínima con dos piezas reales para la precisión numérica:
`fixtures/precision-patron-real.json`. Reproduce los bordes casi coincidentes del
certificado y valida la materialización con la precisión de exportación.

Reproducir la segunda serie, después del build:

```sh
GRAFONEST_BENCH_REFERENCE=output/grafonest-transformacion-2026-09-09/packingsolver-exhibidor-cardinal/resultado-precision-exportacion.json \
GRAFONEST_BENCH_CANTIDADES=100,101,200 \
node apps/api/test/benchmarks/grafonest-biblioteca.cjs /tmp/biblioteca-con-patrones-nativos
```

El motor alternativo y sus resultados **siguen aislados de la aplicación**.
La biblioteca y la precisión común sí están implementadas; no se reemplazó el
nesting comercial guardado con ninguna solución experimental.
