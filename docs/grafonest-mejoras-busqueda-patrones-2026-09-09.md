# GrafoNest: primera mejora de búsqueda y patrones

Implementado el 9 de septiembre de 2026, después de la auditoría integral. La
política de orientación conserva su versión 8; la política de búsqueda tiene
versión independiente 1. No requiere una migración adicional de base de datos.

## Criterio de fabricación

Todos los candidatos y los nestings persistidos se comparan en este orden:

1. Menor cantidad de placas.
2. A igual cantidad de placas, menor cantidad de patrones distintos.
3. En empate, más recorrido compartido mediante Common Line.
4. En empate, menor envolvente ocupada.

Por ejemplo, 67 placas con 4 patrones ganan a 67 placas con 10 patrones, aunque
el segundo acomodo sea algo más compacto. Un plan de 66 placas sigue ganando a
uno de 67; no se agregó una equivalencia monetaria entre placas y preparaciones.

Los patrones se cuentan por identidad de pieza, posición, rotación y recorridos
Common Line, a la precisión de seis decimales de las exportaciones. Se ignoran
números de copia y de placa. Las cantidades por tipo, por sí solas, no bastan:
la distribución también debe coincidir para reutilizar un archivo de fabricación.
El conteo se aplica a resultados previamente validados del mismo problema.

## Correcciones implementadas

- El selector entrega su primer plan completo antes de intentar reducir los
  patrones. Cada entrega se materializa y valida en Node. Si el segundo objetivo
  vence, falla o produce una selección inválida, se conserva el candidato válido
  anterior. Un JSON parcial no se considera un resultado.
- El selector reparte el tiempo desde el arranque, incluyendo preparación, y
  reserva margen para entregar resultados. Un único patrón ya prueba el mínimo
  de patrones y evita ejecutar el segundo objetivo.
- NFP usa el modo 1 de la versión instalada de OpenNest: el modo 2 ignoraba el
  límite de tiempo y sustituía la semilla. Los runners usan cancelación cooperativa
  con plazo global; el límite externo del proceso sigue siendo el respaldo.
  Los snapshots nativos pasan por la misma validación geométrica independiente.
- Se elimina la segunda validación idéntica cuando Common Line está deshabilitado.
- Una solución del motor alternativo conserva su procedencia en `motorEjecutor`,
  manteniendo el contrato solicitado en `motor`. Puede validarse y recuperarse
  de la persistencia sin perderse por esa diferencia de procedencia.
- Alcanzar la cota de placas no termina por sí solo la búsqueda si quedan patrones
  por reducir. También se exige alcanzar una cota necesaria de patrones: uno si
  todas las demandas son divisibles por las placas, dos en caso contrario.
- Los diagnósticos distinguen timeout, geometría inválida y error del motor.
- Los acomodos guardados anteriores siguen sirviendo para cotizar. Una nueva
  preparación puede ejecutar la política corregida, sin considerar sus antiguos
  minutos de búsqueda como tiempo explorado con esta versión. Tampoco una escritura
  tardía de un worker anterior puede revertir la nueva versión de diagnóstico.

## Medición real: 100 exhibidores

Entrada conservada de la auditoría: seis tipos de pieza, 900 piezas en total,
placa de 860 × 564 mm, margen de 5 mm, sin Common Line. Corrida nueva, sin caché
ni escritura en los nestings comerciales, con presupuesto global de 120 segundos.

| Hito | Tiempo desde el inicio | Placas | Patrones |
| --- | ---: | ---: | ---: |
| Primer plan del selector validado | 10,2 s | 67 | 10 |
| Segundo objetivo validado | 35,3 s | 67 | 4 |
| Fin de la búsqueda completa | 120,2 s | 67 | 4 |

Se generaron 8.846 patrones candidatos. El selector certificó el mínimo de placas
y de patrones **dentro de esa cartera**. La cota geométrica por área sigue siendo
56 placas: no hay prueba de óptimo geométrico global. Los intentos nativos
posteriores no aportaron una mejora válida y se descartaron.

El resultado comercial anterior era también 67 placas y 4 patrones después de
una búsqueda de cinco minutos. En la repetición de auditoría anterior, una búsqueda
nueva de cinco minutos había perdido el selector al vencer su timeout y terminó
con 74 placas. Son corridas individuales; la cartera depende del tiempo disponible
y la carga de CPU. Esto demuestra recuperación y conservación de calidad en el
caso observado, no un factor universal de aceleración.

**El sheet todavía espera el trabajo completo.** Los 10,2 y 35,3 segundos son hitos
internos del motor, no tiempos nuevos de respuesta de la interfaz. El mejor candidato
se conserva en memoria durante la búsqueda y se persiste al terminar; esta entrega
no incorpora checkpoints ante caída del worker.

## Validación

- 78 pruebas TypeScript en 14 suites: selector, subprocesos, comparación, caché,
  colas, geometría, Common Line, adaptación al cotizador y patrones repetidos.
- 5 pruebas Python: selección exacta, entrega antes de un fallo secundario,
  infeasibilidad y cancelación/snapshot con límites de tiempo.
- Puma real: tres ejecuciones nativas, las tres con ocho piezas en dos placas;
  cuatro pruebas de la suite aprobadas en 13,2 segundos en total.
- Compilación de producción del backend aprobada.
- La comprobación TypeScript global incluyendo todos los tests detecta errores
  preexistentes en suites ajenas a este bloque. No equivale a tener todo el
  repositorio sin deuda de tipos; las suites afectadas y el build sí pasan.

Evidencia y script de reproducción: `output/grafonest-mejoras-2026-09-09/`.
Auditoría previa: `output/auditoria-grafonest-2026-09-09/INFORME.md`.

## Siguiente bloque propuesto

Crear una biblioteca de patrones reutilizables entre cantidades y alimentar el
selector con los patrones de soluciones conocidas. Después, entregar el resultado
validado al cotizador sin esperar las mejoras posteriores y persistir checkpoints.
Medir ese recorrido antes de sustituir el núcleo nativo: OpenNest ya ejecuta C++.
Este primer bloque no implementa esas tres extensiones.
