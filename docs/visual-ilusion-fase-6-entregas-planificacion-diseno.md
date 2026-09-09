# F6 — Diseño funcional de entregas y planificación por cantidades

**Estado:** DISEÑO, con prototipo y adaptador al catálogo real validados. Planificación de OT no habilitada en la aplicación.
**Rama:** `codex/f6-entregas-planificacion`. **Base:** `visual-ilusion/analisis`, F4 cerrada.
**Referencia:** [propuesta del 09/09](visual-ilusion-fase-6-planificacion-entregas-propuesta-2026-09-09.md) y [Plan Maestro](visual-ilusion-plan-maestro.md).

## 1. Decisiones de producto y límites

El usuario define demanda y compromisos; Grafoprint propone los lotes productivos. F5 continúa pendiente de decisión y no es un requisito para este recorrido. F6 conserva todo el alcance original de lotes físicos, producción y entregas parciales.

**Preferencia confirmada el 09/09:** al solicitar fechas, priorizar las primeras entregas cuanto antes y mostrar cualquier costo adicional. Conservar la comparación económica, identificando también sus fechas y condiciones. Con fechas exigidas, primero buscar cumplimiento y margen; después comparar costo y fragmentación.

Registrar una fecha solicitada no demuestra que sea viable. Simular no confirma ni reserva un hueco. La fecha estimada de producción, la fecha sugerida con margen, la promesa aceptada y la entrega real son datos distintos.

La cotización sigue siendo de 200 exhibidores: distribuir entregas no duplica ítems ni importe. Si fabricar en tandas altera preparación, material o costo, el sistema debe mostrar el impacto. Antes de emitir se resuelve explícitamente su efecto comercial; una replanificación de una OT vendida conserva el snapshot y registra diferencias, sin modificar silenciosamente precio o receta.

## 2. Experiencia propuesta al crear la OT

Dentro del ítem, acción **Distribuir entregas**, opcional. El modo de entrega única sigue disponible. No se añade un módulo Centro de corte ni una pantalla obligatoria de configuración de lotes.

| Momento | Qué ingresa/ve el usuario | Qué hace el sistema |
| --- | --- | --- |
| Distribución | 200 exhibidores → 50/50/50/50; fechas vacías o solicitadas | Comprueba suma, identidad y orden de entregas; no altera cantidad cotizada |
| Solicitud | “Sugerir fechas” o “Evaluar fechas” | Obtiene el contexto actual y calcula alternativas con un presupuesto acotado |
| Calculando | Progreso, posibilidad de seguir editando o cancelar | Una respuesta obsoleta no sustituye la solicitud vigente |
| Propuesta | Fecha solicitada/proyectada/sugerida por entrega, estado y explicación | Recomienda lotes por operación, muestra tiempos, recursos y costos aplicables |
| Comparación | Primera entrega antes frente a menor costo, con fechas y diferencia visible | Conserva alternativas válidas; no atribuye certeza a datos incompletos |
| Confirmación de OT | Resumen del plan elegido dentro del recorrido normal | Revalida cola, catálogo/receta, cantidades, disponibilidad y permisos antes de persistir |
| Contexto cambiado | Qué cambió y la propuesta actualizada | No confirma fechas de una simulación vencida ni mueve otros compromisos en silencio |

Las fechas de disponibilidad pueden coincidir entre varias entregas. Eso no fusiona sus compromisos ni adelanta fechas prometidas. Si se solicita una cadencia (por ejemplo, semanal), deberá representarse como restricción explícita; el piloto no inventa esa separación y todavía no la calcula.

La UI debe usar los componentes y lenguaje Grafoprint existentes: distribución compacta junto al ítem, tabla de entregas y detalle desplegable de fabricación. Evitar tarjetas anidadas para cada pieza, duplicar leyendas o mostrar JSON técnico al comercial. Datos económicos sujetos a los mismos permisos de costos/márgenes que la cotización.

Estados de la propuesta: sin calcular, calculando, cumple con los datos actuales, llega sin margen, no se encontró cumplimiento, condicionada, sin estimación, desactualizada y error recuperable. La sugerencia es una proyección explicable; no se etiqueta como garantía ni como óptimo global.

## 3. Caso principal: 200 exhibidores en cuatro entregas

Cada exhibidor del fixture controlado requiere un cuerpo y dos estantes. No es todavía el catálogo ni la configuración física de Visual Ilusión.

- **Compromisos:** cuatro entregas de 50, con fechas sugeridas o solicitadas.
- **Demanda física:** 200 cuerpos, 400 estantes y 200 armados terminados.
- **Alternativa conjunta:** cortar todas las piezas y terminar los 200; menos preparaciones, primera disponibilidad más tarde.
- **Alternativa por entrega:** grupos completos de 50; primeras unidades antes, más preparaciones.
- **Alternativa mixta:** corte para 100 abastece dos armados de 50. Al terminar corte se liberan las cantidades correspondientes; armado no espera el corte de los últimos 100.

No alcanza con fraccionar minutos ni copiar una ruta cuatro veces. Cada armado de 50 depende de 50 cuerpos y 100 estantes identificados. Las piezas usadas en ese grupo no se vuelven a ofrecer a otro. Una operación compartida se ejecuta una vez y distribuye sus resultados, sin multiplicar su duración/costo.

El reparto de una entrega puede provenir de distintos lotes productivos compatibles y viceversa. La asignación enlaza cantidades físicas disponibles con compromisos, no confunde tanda de máquina, lote productivo y entrega comercial.

## 4. Contratos propuestos para cerrar antes de migrar

| Concepto | Responsabilidad y datos mínimos |
| --- | --- |
| Compromiso de entrega del ítem | Cantidad/unidad, secuencia, fecha solicitada y prometida, estado derivado, historial de cambios |
| Revisión de planificación | Origen de cotización/receta, versión de contexto/carga, supuestos, política, alternativas, plan elegido y procedencia del cálculo |
| Lote productivo | Ítem/origen, cantidad/unidad, identidad y genealogía; estado derivado de operaciones y movimientos |
| Operación de lote | Nodo de receta, cantidad de entrada/salida, recurso, tiempos/costos previstos, inicio/fin planificados y reales |
| Asignación cuantitativa | Relación entre salidas, consumidores y entregas, con unidad y saldo; no duplicar disponibilidad |
| Movimiento/resultado de lote | Entrada, buenas, rechazadas, scrap, transferencias, divisiones/fusiones, actor, fecha, motivo e idempotencia |
| Entrega efectiva | Cantidad entregada contra compromiso/ítem, fecha/actor, reversión auditada y saldo pendiente |

Datos operativos relacionales, por tenant. Geometría pesada e invariantes técnicas siguen en snapshots autónomos compactos. No construir un único JSON mutable para reemplazar los estados, movimientos y cantidades.

La unidad debe distinguir producto terminado, tipo de pieza y material. El piloto usa enteros de unidades terminadas; el esquema final debe fijar precisión decimal, conversiones autorizadas y redondeo por unidad antes de soportar otras familias.

Los endpoints, nombres de tablas y permisos nuevos no están congelados por este documento. Primero se cierra el contrato del adaptador de cotización y la confirmación; después migraciones/API. Hasta entonces no hay nueva escritura comercial.

## 5. Qué debe hacer el planificador y qué aporta el ETA

El planificador prepara alternativas de partición y sus dependencias cuantitativas. El ETA calcula su ejecución temporal contra estaciones, máquinas, calendarios, cola y precedencias. Un único backend será autoritativo al adoptar la propuesta; no se mantendrán reglas divergentes en un segundo motor del frontend.

El adaptador debe obtener tiempos y costos válidos por cantidad y operación. Cuando haya geometría, debe poder asignar copias de layouts conservando su contenido y cantidades, o pedir un candidato geométrico nuevo si es necesario. Reutilizar los planes de F4 no significa que cualquier partición sea geométricamente válida. Cada medición conserva su fuente y revisión.

La selección respeta las restricciones y compromisos existentes, evalúa las entregas y luego aplica la política confirmada. La primera prueba evalúa seis alternativas, no todas las particiones posibles. Encontrar una propuesta que llegue demuestra factibilidad bajo sus supuestos; no encontrarla no demuestra que ninguna solución pueda existir.

Una simulación puede informar tiempos y fechas condicionados si faltan materiales o aprobaciones. La falta de duración no se tapa con un tiempo inventado ni con una mediana presentada como medición del producto. El inventario reservado y el abastecimiento avanzado permanecen en F9/F10.

## 6. Confirmación, cambios y convivencia con la producción actual

La confirmación requiere una versión de carga/contexto y operación atómica con idempotencia. Debe detectar que otra OT, un cambio de capacidad o un avance real invalidó la propuesta. La comparación de escenarios por sí sola no resuelve dos confirmaciones concurrentes; esa persistencia sigue pendiente.

Diseñar ventanas de recurso y su revalidación antes de afirmar que un hueco está comprometido. No basta guardar una fecha sugerida en el ítem. El prototipo actual compara con la cola base y descarta candidatos que desplazan cualquier operación existente; todavía no busca todos los huecos libres ni reserva ventanas.

Una vez emitido: conservar lo ya iniciado/ejecutado, replanificar sólo lo pendiente y registrar revisiones. Cambiar una fecha solicitada, una receta, un costo o un plan vendido no puede ocurrir como efecto oculto del cálculo.

La entrega parcial requiere adaptar el servicio actual, que entrega ítems completos. Ejemplo: 46 buenos, 3 rechazados y 1 scrap en un grupo de 50; entregar 30 deja 16 disponibles y 20 pendientes de ese compromiso. No habilitar entrega de rechazados ni cerrar globalmente la OT. División/fusión, QR, reportes, tracking, gates y progreso por cantidades siguen siendo criterios del cierre completo de F6.

## 7. Primer prototipo técnico

Código aislado: `apps/api/src/eta/planificacion/prototipo-entregas.ts`. Fixture: `apps/api/test/fixtures/f6-planificacion/exhibidor-controlado.ts`. Reutiliza `simularFlujo` del backend sin modificarlo; no tiene controlador, cola, Prisma ni integración en la aplicación.

El prototipo:

- genera alternativas conjunta, por pares, por entrega y con transferencias;
- usa mediciones explícitas para 50/100/150/200, incluyendo preparación;
- conserva cuerpos/estantes/armados y conecta sus precedencias por cantidad;
- devuelve fechas por entrega, costos comparativos, traza y última operación;
- condiciona desconocidos, respeta margen/calendario y detecta desplazamiento de trabajos;
- permite comparar la política económica, manteniendo primeras entregas como preferencia del usuario.

No evalúa geometría real, operaciones tercerizadas, insumos físicos, cantidades fraccionarias ni persistencia/concurrencia transaccional. El fixture declara tiempos/costos sintéticos. No presenta resultados como rendimiento o promesa del producto real.

## 8. Secuencia y criterios para continuar

| Bloque | Salida verificable | Estado |
| --- | --- | --- |
| Diseño funcional y prueba del selector | Dos modos de fechas, alternativas por operación y balance exacto con ETA existente | Primer prototipo probado; evidencia abajo. El contrato operativo sigue en diseño |
| Adaptador al caso real | Leer la receta/snapshot del exhibidor y obtener mediciones y particiones geométricas trazables por alternativa | Implementado y validado para el exhibidor en placas; límites y condiciones en el informe del caso real |
| Contrato autoritativo y persistencia | Plan, compromisos y lotes adoptados sin colisiones ni duplicados; compatibilidad histórica | Pendiente |
| UI de OT | Distribuir entregas, comparar, confirmar/revalidar con estética Grafoprint | Pendiente |
| Ejecución y entrega | Cantidades y movimientos reales, división/fusión, QR, entregas, gates, tracking y reportes | Pendiente |
| Cierre F6 | Regresión acumulada, permisos/tenant, concurrencia, migraciones, builds y aceptación completa | Pendiente |

F11 conserva el alcance de Gantt avanzado, planificación integral con inventario/terceros y replanificación publicada; se comparte el núcleo de escenarios/fechas requerido por F6. No se implementa F5 para habilitar este diseño.

## 9. Evidencia del primer bloque — 09/09/2026

Se ejecutaron 19 pruebas nuevas del piloto y 40 existentes de ETA en backend: **59 aprobadas**. El espejo del ETA en frontend conserva sus **62 pruebas aprobadas**. Lint de los cuatro archivos TypeScript nuevos, build API y `git diff --check` aprobados. No se modificó el motor ETA ni se conectó el prototipo a la aplicación, por lo que no se ejecutaron migraciones ni se escribió una OT real.

Escenario controlado: inicio 09/09/2026 a las 08:00, calendario L–V 08:00–17:00, una mesa de corte con 180 minutos ya comprometidos y un puesto de armado. Margen cero sólo para esta prueba. Importes en unidades monetarias de prueba, sin correspondencia con tarifas reales.

| Política/caso | Propuesta del selector | Disponibilidad sugerida de cada grupo de 50 | Costo de prueba | Diferencia frente a 200 juntos |
| --- | --- | --- | ---: | ---: |
| Referencia: fabricar 200 completos | Conjunta | 14/09 · 14/09 · 14/09 · 14/09 | 1.295 | 0 |
| Adelantar primeras entregas | Fabricar por entrega | 10/09 · 10/09 · 11/09 · 11/09 | 1.520 | +225 |
| Fechas solicitadas 10/09, 14/09, 15/09 y 16/09 | Corte para 100 y terminación por entrega de 50 | 10/09 · 11/09 · 11/09 · 14/09 | 1.360 | +65 |
| Primera fecha solicitada 09/09 | Ningún candidato cumple; mostrar mejor alternativa encontrada | Primera disponibilidad 10/09 | Se conserva comparación | Sin promesa de cumplimiento |
| Material sin confirmar | Propuesta condicionada | Fechas sólo bajo el supuesto indicado | Se conserva comparación | No confirma disponibilidad |

Las fechas de esta tabla son resultados de la simulación del fixture, no una promesa del catálogo real. La última operación y la traza permiten revisar el recorrido que determina cada fecha. La prueba de desplazamiento de trabajos detecta que un candidato toma un hueco antes de una operación que ya debía usarlo; se descarta, pero no se sustituye con una reserva ficticia ni se considera imposible encontrar otra organización.

Reproducción desde `apps/api`:

```sh
npm test -- --runInBand src/eta
TS_NODE_PROJECT=tsconfig.json node -r ts-node/register test/benchmarks/planificacion-f6.ts
```

Informe y trazas locales: `output/f6-planificacion-2026-09-09/INFORME.md` y `resultados.json`. El script no conecta con bases, colas ni servicios externos. Evalúa seis candidatos en aproximadamente 5–12 ms en esta corrida; esa medida excluye cotización, nesting, IO y carga concurrente, y no es una medida de capacidad SaaS.

**Actualización del siguiente bloque:** el adaptador ya fue implementado y validado contra cotizaciones actuales de 50/100/150/200 y la carga local de producción. Conserva placas registradas impresión/corte, costos y dependencias. La validación detectó ensamble fijo de 30 minutos y falta de estación para esa operación; las fechas son condicionadas. Ver [resultados, correcciones y límites](visual-ilusion-fase-6-validacion-catalogo-2026-09-09.md).

**Siguiente bloque técnico:** contratos de plan, compromisos, lotes y confirmación/revalidación concurrente; luego UI y ejecución cuantitativa. Validar tiempo/estación del ensamble antes de usar sus fechas como promesas. Todo ello sigue siendo necesario para cerrar F6.
