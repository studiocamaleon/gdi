# Transformación de GrafoNest: ejecución y aceptación

Objetivo activo: mejorar calidad, velocidad y escalabilidad del motor completo,
conservar los contratos de cotización y fabricación y documentar casos medidos.
La auditoría de referencia es `output/auditoria-grafonest-2026-09-09/INFORME.md`.
No se considera terminado por completar un solo bloque ni por aprobar pruebas unitarias.

**H10 corregido y validado el 09/09:** persistencia y emisión de 150 exhibidores
aprobadas con transacciones normales; snapshot 36,6 MB → 286 KB, conservando
geometría, capas, cantidades y costos. Ver el [cierre de F4](visual-ilusion-fase-4-cierre-2026-09-09.md).
Este cierre funcional no declara terminada la transformación del algoritmo ni
el trabajo de capacidad física descrito más abajo.

| Frente | Estado actual | Evidencia requerida para cerrar |
| --- | --- | --- |
| Candidatos, tiempo y contratos entre motores | Primer bloque implementado | Timeout conserva plan; validación y persistencia del motor alternativo |
| Objetivo placas → patrones → operaciones | Implementado; política 6 reduce la cartera sólo con mínimo de placas certificado para el plan conocido; ensayo de selector 64/6 → 64/5 sin cambiar cantidades | Comparador, selección y almacenamiento coherentes con archivos reales; ampliar curvas de calidad integradas |
| Instrumentación y procedencia | Fases y procedencia implementadas; medición de recursos parcial | Tiempos por fase, ganador frente a última búsqueda, memoria, descartes y certificados |
| Biblioteca entre cantidades | Patrones y combinaciones completas implementados; medidas 1/25/50/100/101/200 | Remapeo, restricciones, tenant, Common Line, DXF y TAP probados; ampliar diversidad y seguimiento de calidad |
| Geometría reutilizable y memoria | Preparación por tipo/orientación y pose implementada; reutilización exacta de validación entre placas, con memoria acotada. 900 piezas: materializar/validar 400 → 92 ms; no es tiempo total del nesting | Ampliar diversidad, memoria y concurrencia; conservar validación original y Common Line |
| Generación dirigida y mejoras locales | Pendiente | Curvas de calidad mejores con presupuesto igual; regresión en corpus diverso |
| Entrega temprana y checkpoints | Planes completos reutilizables y checkpoints compactos implementados; recuperación BullMQ real del plan 900 piezas/64 placas/5 patrones después de SIGKILL | Entrega de una búsqueda todavía activa y consistencia con el snapshot de OT |
| Capacidad y aislamiento entre fábricas | Admisión Redis compartida, turnos por fábrica, reserva normal/intensiva y guardia independiente implementados. Tres workers/106 jobs; SIGKILL y SIGSTOP probados; despertar reduce lote controlado 96,9 → 28,3 s | Cuotas físicas CPU/RAM del despliegue; ampliar carga y reducir variación/sondeo de pendientes |
| Comparación contra otro motor nativo | Adaptador opcional integrado; instalación versionada, supervisor, 13 casos y contratos DXF/TAP probados. Serie controlada: exhibidor 64/6 frente a 67/6; Puma 0,38 s frente a 4,50 s | Ampliar repeticiones/cantidades a presupuesto completo; habilitación general sólo con evidencia favorable y recursos controlados |
| Integración completa y ejemplos finales | Biblioteca → DXF/TAP y regresiones de cotización → OT verificadas; cierre integral pendiente | Validar el motor finalmente adoptado con herramientas, costos y corpus completo; informe reproducible |

Corpus de aceptación: exhibidor 1/25/50/100/101/200, Puma y letras, centenares de
formas únicas, concavidades, huecos, separación positiva, giro fijo, Common Line,
área de máquina menor que placa, segmentación y capas heredadas. Medir frío y
caliente y concurrencia, sin declarar percentiles a partir de una corrida aislada.

Invariantes: demanda exacta sin duplicados; sin solapamientos; separación, márgenes
y giros autorizados; contornos y capas originales; no degradar el mejor plan; datos
aislados por tenant; ninguna actualización silenciosa de órdenes confirmadas.

Las cotas y los certificados deben declarar su alcance. Un óptimo dentro de una
cartera finita no demuestra un óptimo geométrico global. La aspiración de liderazgo
industrial requiere comparación reproducible; no se deduce de los ejemplos locales.

Próximos puntos concretos surgidos de las mediciones:

- Combinación conocida resuelta: el 64/5 de 100 unidades aporta 128/5 para 200
  sin invocar motor ni selector. Retorno medido 3,92 s incluyendo aprendizaje y
  validación del script. El 9 de septiembre, tras contrastar la receta vigente,
  cotización y archivos con capas, se incorporó el 64/5 de 100 unidades a la caché
  y biblioteca del exhibidor. Una cotización nueva lo recuperó en 1,758 s.
  El escalado a 200 sigue siendo una medición experimental; no se modificaron
  recetas ni órdenes confirmadas. Ver el registro de resultados y su evidencia.
- Reutilización exacta actualizada: API y worker comprueban planes completos de
  la biblioteca antes de devolver un guardado. La cotización real de 50 unidades
  pasó automáticamente de 34/3 a 32/5 en 4,259 s, con 450 piezas y diez archivos
  SVG/DXF con capas verificados. No abre otra búsqueda ni acredita más presupuesto.
- La política 3 también evita arrancar procesos al alcanzar ambas cotas y
  permite buscar un encaje irregular cuando la base rectangular excede maxPlacas.
- El adaptador nativo opcional comparte el reloj externo, conserva candidatos
  ante cancelación y reconstruye originales. Su habilitación general queda
  pendiente del corpus y control global de recursos. El reloj interno del
  ejecutable no sustituye el límite externo que incluye su preparación.
- Checkpoints separados del precio definitivo: un proceso nuevo recuperó las
  900 piezas del plan 64/5 después de SIGKILL. Las poses redujeron el JSON de
  4.430.115 a 100.305 bytes (97,74%). La recuperación BullMQ también pasó:
  conservó 900 piezas/64 placas/5 patrones después de SIGKILL. Falta entregar
  candidatos de una búsqueda activa con consistencia del snapshot de OT.
- Completar control de CPU/RAM y prioridad entre fábricas antes de habilitar
  más paralelismo. La biblioteca evita trabajo; no sustituye esos controles.
- No activar un hilo por defecto todavía: bajó CPU pero empeoró algunos
  candidatos con cinco segundos y dos procesos. Tampoco mantener la cota
  adicional de placas en el MILP: alteró su búsqueda corta desfavorablemente.
  La política 4 conserva el plan inicial y limita sólo el objetivo secundario
  a la cantidad de patrones del ganador; no afirma una mejora global probada.
- La política 6 reduce columnas con certificado entero sólo si un plan conocido
  alcanza el mínimo de placas de su cartera. Caso congelado a 15 s: 64/6 → 64/5;
  motor completo frío a 120 s con nativo experimental: 64/7 → 64/6. No reduce
  después del primario frío: esa variante empeoró seis → ocho patrones y se
  descartó. Falta ampliar repeticiones y cantidades antes de extrapolar calidad.
- La admisión compartida reserva recursos declarados, pero no impone cuotas
  físicas. Los jobs pendientes conservan el reintento como respaldo y se
  despiertan al liberar su clase. Queda variación: el ensayo inicial del lote
  dio 10,7 s y la serie controlada 28,3 s (frente a 96,9 s sin despertar).
  No extrapolar estos trabajos controlados de 30 ms al tiempo de geometría.
