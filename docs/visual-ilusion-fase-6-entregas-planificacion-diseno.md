# F6 — Diseño funcional de entregas y planificación por cantidades

**Estado posterior del 11/09/2026:** el alcance acordado de distribución,
reprogramación y Planificación superó la [validación integral](visual-ilusion-fase-6-validacion-integral-2026-09-11.md)
y la [validación SaaS](visual-ilusion-fase-6-validacion-saas-2026-09-11.md).
El alcance cuantitativo original permanece postergado por decisión del usuario.
Los hitos siguientes conservan el registro histórico de cómo se llegó a este estado.

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
| Contrato autoritativo y persistencia | Plan, compromisos y lotes adoptados sin colisiones ni duplicados; compatibilidad histórica | Propuestas y lotes con rutas adoptados; ejecución cuantitativa y reservas firmes pendientes |
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

## 10. Base temporal y previsión comercial — 09/09/2026

Se corrigió una diferencia previa a confirmar planes: la ficha estimaba sólo los
pasos del padre, omitiendo fabricación de componentes y sus dependencias. Ahora
proyecta el grafo completo de la cotización, conserva recursos y trabajos
compartidos y obtiene la carga, el reloj, la zona y la separación entre pasos del
mismo contexto del backend ETA. No cambia cantidades, precios, nesting ni recetas.

La fecha de entrega es un día de calendario estricto (AAAA-MM-DD). Los inicios y
fines productivos siguen siendo instantes UTC que se muestran en la zona del
taller. El margen suma días hábiles en esa zona; no transforma «hoy» en mañana.
Una proyección incompleta no fija una recomendación y los supuestos se muestran.

Esto **no habilita aún el guardado/adopción de planes de F6**. Se conserva la
secuencia del bloque 8: revisiones persistidas, compromisos y lotes con revalidación
concurrente; después UI y ejecución. La ficha comercial actual sigue siendo una
previsión informativa, sin reserva de capacidad. El análisis completo está en
[la revisión de fechas](visual-ilusion-fase-6-fechas-2026-09-09.md).

## 11. Propuestas persistidas y UI — 09/09/2026

El siguiente incremento conecta el adaptador con OT guardadas: distribución por
cantidad/fecha, cálculo en segundo plano, revisiones y elección de alternativa.
La preferencia no modifica la OT ni reserva capacidad. En aquel incremento se
conservaron los estados condicionados y la observación sobre tiempos fijos de
ensamble; el criterio de cierre posterior se aclara en la sección 15. La implementación, pruebas
y límites están en [propuestas persistidas](visual-ilusion-fase-6-propuestas-persistidas-2026-09-09.md).
La referencia anterior a que no existía guardado/UI corresponde al estado previo
a este incremento. Sigue pendiente la adopción operativa y ejecución cuantitativa.


## 12. Distribución antes del primer guardado de OT — 09/09/2026

La distribución también se define durante **Crear orden**, después de agregar el
producto. Se preparan cotización, entregas y propuesta sin emitir ni numerar una
OT. Al guardar borrador o emitir directamente, se conserva la revisión y su
alternativa en la misma transacción de alta. Los cambios de producto, cantidad o
cliente requieren revisar la distribución; una solicitud fallida o en curso no
se incorpora como si estuviera lista. Se conservan las ediciones locales al
cerrar el modal y se permite quitar una distribución de la orden en preparación.

Este cambio corrige el recorrido inicial de §11, que requería una OT guardada.
Sigue siendo una propuesta, sin reserva ni sustitución de rutas productivas.
[Implementación, pruebas y límites](visual-ilusion-fase-6-entregas-antes-de-guardar-2026-09-09.md).

## 13. Fabricación por entrega — simplificación del 09/09/2026

La decisión comercial reemplaza la selección entre seis alternativas: **N entregas implican N tandas completas**, una por entrega. El motor del piloto conserva los otros candidatos para investigación, pero la API comercial sólo calcula y permite elegir `por-entrega`. Cotiza el total como referencia económica y una vez cada cantidad distinta solicitada: 200 en cuatro entregas de 50 necesita 200/50, sin evaluar 100/150.

Si la inserción inicial desplaza operaciones de otras OT, se vuelve a simular esperando detrás de la carga ya proyectada de cada recurso. Es una solución conservadora: no busca todos los huecos posibles, no reserva capacidad y mantiene los controles de fechas, recursos y calendario. Una fecha incumplida se bloquea incluso si existen además condiciones pendientes; esas condiciones ya no ocultan el atraso. La UI explica el motivo de cualquier bloqueo junto al botón.

El nesting de las tandas se compara con **la trazabilidad guardada de la cotización original**. Se verifica cada copia física por layout (posición, rotación, contornos, cortes internos, capas/recorridos, fabricación, perfil, máquina, material y configuración visual), el inventario total de copias y el corte vinculado a impresión. No se deduce conservación porque el total de placas coincida. Se conservan referencias a los índices de las placas originales cuando el reparto es exacto; ningún CAD adicional cruza la API de planificación.

Si los resultados por tanda conservan los layouts, no se pide aceptación de cambios. Si cambian o el histórico no permite verificarlos, se exige aceptar explícitamente el ajuste y el costo adicional antes de guardar la distribución. La decisión se guarda junto a actor/fecha y se reinicia en cada revisión. El servidor aplica el mismo control. La UI permite inspeccionar copias de layouts por tanda.

Caso real de referencia: Exhibidor 200, 128 placas, layouts con 100/16/4/4/4 copias. Cuatro tandas de 50 usan cada una 25/4/1/1/1 copias: conserva las 128 placas y el registro de impresión/corte. Los tiempos y preparaciones provienen de las cotizaciones de cada cantidad; no se divide el costo total por cuatro.

Límite: esta comparación valida los layouts que devuelve el cálculo por cantidad. Si devuelve otra disposición, no demuestra que sea imposible encontrar alguna partición alternativa de los originales; exige aceptación del cambio propuesto. No se recortan layouts, no se fabrican sobrantes implícitos ni se trasladan piezas incompletas a entregas posteriores. En este incremento se guardaban la propuesta y las fechas. La adopción de rutas y archivos se implementó en el hito siguiente (§14).


## 14. Adopción de lotes, rutas y archivos — 09/09/2026

Al guardar la elección en una OT emitida, o emitir un borrador con distribución,
el producto comercial se convierte en contenedor de N lotes técnicos. Cada lote
usa el cálculo congelado de su cantidad, su fecha, sus operaciones y componentes.
No se vuelve a ejecutar el nesting durante la adopción. En borrador quedan los
lotes y sus cálculos disponibles, sin incorporar todavía operaciones a la cola.

La fuente pesada se conserva comprimida una vez por cantidad/revisión y la UI
carga sólo el lote seleccionado. Los archivos y sus copias se consultan desde ese
lote. El total comercial continúa en el ítem original: los hijos técnicos no suman
otra venta. La proyección respeta los inicios elegidos y el producto completo
espera a todos sus lotes; la fecha sigue siendo una previsión sujeta al taller.

La sustitución se valida y aplica en una transacción. Los reintentos reutilizan
las mismas identidades; no se reemplaza trabajo iniciado ni se descartan adjuntos
o condiciones manuales de los trabajos. Quitar una distribución pendiente restaura
la fabricación original. Las aprobaciones del producto también condicionan sus
lotes. Las propuestas antiguas sin cálculos durables deben recalcularse antes de
adoptarse, sin transformar automáticamente órdenes anteriores.

[Implementación, evidencia y límites](visual-ilusion-fase-6-lotes-ejecutables-2026-09-09.md).
Este hito por sí solo no cierra F6 ni agrega una reserva firme de capacidad.
El usuario postergó posteriormente unidades buenas/rechazadas y despachos
parciales para priorizar Distribuir entregas y reprogramar trabajos competidores.

## 15. Validación integral de distribución y reprogramación — 11/09/2026

El recorrido ya incluye preparación anterior al guardado, cambio de cliente,
borrador, elección de una reprogramación, emisión transaccional, conservación de
intervalos humanos, rutas y archivos por lote y finalización de los 16 pasos de
cuatro entregas de 50. La OT sólo finaliza cuando terminan todos sus lotes.
Se corrigieron las reservas humanas reconstruidas en ventanas con esperas y el
margen mostrado contra una nueva fecha de entrega.

[Informe de validación, configuración observada y límites](visual-ilusion-fase-6-validacion-integral-2026-09-11.md).
El registro cuantitativo sigue postergado. El usuario confirmó que los tiempos y
calendarios actuales son ejemplos de desarrollo: calibrar el taller real no es
un pendiente de este incremento. Se agregaron 19 pruebas de integración para
verificar que persistir cambios de horarios, feriados, equipos, dotaciones,
puestos, modos de máquina, separación, zona y margen produzca el efecto esperado
en ETA y propuestas de entregas. La regresión enfocada aprobó 96 pruebas API y
167 web/motores. Este cierre no certifica carga multiusuario ni el alcance
completo de F11.
