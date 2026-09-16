# Tandas con nesting rectangular: propuesta acotada

> **Sustituido el 11/09/2026:** el usuario retiró las tandas sugeridas y su preparación. El alcance vigente es [Colas: consulta y completado múltiple](produccion-colas-completar-seleccion-2026-09-11.md). El contenido siguiente se conserva como antecedente de diseño.

11/09/2026. **Estado: propuesta actualizada con la preferencia explícita del usuario; integración no implementada.** Parte del problema observado: trabajos del mismo vinilo, tecnología y color, cotizados en distintos anchos, no pueden seleccionarse juntos en la preparación actual. Amplía el alcance del [v1 de colas y tandas](produccion-colas-tandas-v1-2026-09-11.md) sin restaurar los simuladores eliminados. Conserva las restricciones de la [auditoría de compatibilidad y geometría](produccion-compatibilidad-tandas-y-geometria-auditoria-2026-09-11.md).

## Recomendación

**La cola debe proponer automáticamente los trabajos a consolidar y el ancho recomendado.** El usuario rechaza tener que seleccionar primero las OT y recorrer un asistente para obtener esa recomendación. Se recupera la idea operativa del antiguo simulador de gran formato dentro de Colas, sin restaurar sus pantallas ni sus endpoints eliminados.

Empezar por **impresión en rollos de diseños rectangulares independientes**. Luego reutilizar el flujo para placas rectangulares con separación y ruta posterior conocidas. No extender automáticamente a todas las tecnologías, imposiciones o tareas de corte.

«Excluir layouts» significa excluir de la redistribución los **acomodos existentes que necesitan conservarse**: patrones de exhibidores, contornos irregulares, impresión registrada con corte, imposiciones, paneles/secuencias y operaciones físicas compartidas. El nuevo nesting también produce un acomodo, pero no tiene permiso para desarmar esos planes. Los trabajos protegidos siguen visibles y pueden conservar su ejecución original.

## Recorrido del impresor

1. Al abrir una máquina, ver propuestas de tandas ya calculadas, formadas por trabajos listos y compatibles. Pueden incluir vinilos cotizados en 1,05 m y 1,37 m cuando esas presentaciones sean intercambiables para todos sus integrantes.
2. Cada propuesta muestra material y color, cantidad de trabajos, ancho recomendado, largo o cantidad de placas, aprovechamiento y efecto sobre las entregas. Un resumen expandible permite ver OT/lotes, anchos cotizados y acomodo; no hace falta abrirlo para obtener la recomendación.
3. Si la propuesta sirve, el impresor la acepta al iniciar la tanda mediante una acción conjunta, cuando los archivos estén preparados en el RIP. No tiene que elegir cada trabajo ni solicitar manualmente el cálculo. El servidor revalida la propuesta antes de registrar ese inicio.
4. Para apartarse de lo sugerido: separar uno o varios trabajos, deshacer toda la agrupación o elegir otro ancho válido. El sistema recalcula el resto automáticamente. «Desanidar» significa deshacer la agrupación propuesta; no editar geometrías protegidas.
5. Si una variante perjudica compromisos, mostrar el efecto concreto y requerir la aceptación registrada correspondiente. No presentar un atraso previo como causado por la tanda. La propuesta visible no inicia producción, reserva capacidad ni modifica fechas por sí sola.
6. La aceptación guarda el plan productivo y su revisión, vinculados a integrantes y ejecución. Inicio/cierre conjuntos respetan los controles atómicos. La cotización y el precio comercial permanecen como antecedentes; cualquier diferencia productiva queda explícita.

## Cómo se comportan las recomendaciones automáticas

- La búsqueda considera la cola lista completa de la máquina, no sólo los trabajos de una página o filtro de búsqueda. La vista actual agrupa dentro de cada página; ese agrupador visual no alcanza como motor de recomendaciones.
- Proponer conjuntos compatibles sin repetir un mismo trabajo en varias tandas recomendadas activas. No intentar reunir toda la cola en un único rollo: los límites de geometría y el efecto en entregas pueden justificar varias tandas del mismo material.
- Priorizar las propuestas que conservan los compromisos y no agravan atrasos existentes; dentro de las alternativas viables, comparar consumo/aprovechamiento. Una urgencia puede quedar separada automáticamente aunque comparta material. Las opciones que empeoran entregas se presentan como alternativas con consecuencias explícitas, nunca como reprogramación silenciosa.
- El ancho recomendado resulta del cálculo sobre todas las piezas y formatos permitidos. Mostrar «recomendado» o «mejor opción calculada»; no prometer un óptimo global ni confundir mínimo largo con mínimo consumo de material.
- Separar trabajos es una decisión que se conserva para esa revisión de la cola. Una actualización no debe volver a agrupar silenciosamente lo que el operador separó. Ofrecer restaurar la recomendación; si cambian los trabajos o dejan de estar listos, avisar y revalidar.
- Una tanda aceptada o iniciada no se recompone automáticamente cuando entra otra OT. Los trabajos nuevos generan propuestas pendientes; separar después del inicio requiere un flujo operativo diferente, fuera de este ajuste de recomendaciones.
- Calcular por tenant/máquina/grupo en segundo plano con versiones, caché e invalidación por cambios relevantes. Deduplicar solicitudes concurrentes y limitar candidatos e instancias; no ejecutar un nesting completo por cada render, tecla o usuario conectado. La cola debe seguir accesible mientras se recalcula y distinguir una propuesta vigente de una desactualizada.
- No atribuir a una recomendación una reserva real. Dos operadores pueden verla, pero la confirmación atómica sólo admite un inicio para sus integrantes; el segundo recibe una actualización clara del estado.

Las acciones concretas y su presentación siguen siendo diseño por implementar. El objetivo de UX es que aceptar lo calculado sea el recorrido breve, y la selección/configuración manual quede disponible al ajustar o separar.

En placas, un ejemplo elegible serían carteles rectangulares independientes, del mismo PVC de 3 mm y con impresión y separación compatibles. El algoritmo calcula los acomodos y placas necesarios. Si el corte necesita un archivo registrado, o una placa compartida no puede seguir una ruta de separación conocida, no pertenece al primer alcance.

## Qué existe y qué falta

| Parte | Base verificada | Integración pendiente |
|---|---|---|
| Rollos | `evaluateRollLayoutForConfiguredAlgorithm` en `apps/api/src/motor-universal/nesting-dispatcher.ts`: compara/valida los motores de rollo configurados | Adaptar demanda de múltiples OT y recorrer candidatos de ancho válidos |
| Placas | `nestGrid2DMulti` en `apps/api/src/productos-servicios/nesting/algorithms/grid-2d-multi.ts`: tamaños distintos, varias placas y pertenencia por pieza | Elegibilidad de impresión/separación y elección de formato común |
| Demanda | `NestingEjecutado.demandaRectangular` conserva identidad, medidas y cantidad | Verificar completitud, restricciones y revisión vigente de cada integrante; evitar colisiones de identificadores entre OT |
| Material | `MateriaPrima` y `MateriaPrimaVariante` distinguen material y presentación | Definir equivalencia explícita y acotada: variar formato preservando todos los atributos físicos y de proceso relevantes |
| ETA | Revisión actual compara cola individual y archivos consecutivos, conservando tiempos | Calcular tiempo y demanda humana del nuevo plan aceptado con sus perfiles; no acreditar ahorros ficticios por sumar/restar las duraciones anteriores |
| Tanda real | Base atómica de acciones y revisión previa | Persistencia de integrantes/plan, revalidación y autorización, inicio/cierre idempotentes y excepciones |

La compatibilidad v1 incluye tanto el formato como el ID de la variante de material. Quitar sólo la comparación del ancho no resuelve la equivalencia física. Tampoco alcanza con compartir nombre, tecnología, color o material padre: las variantes pueden diferir en propiedades distintas del ancho.

Como evidencia limitada de reutilización, las cuatro pruebas existentes de `nesting-rollo-margenes.spec.ts` pasaron: reproducen márgenes y demanda, un acomodo conjunto y su pertenencia. No prueban todavía el recorrido de tandas con distintos anchos ni su exportación al RIP.

## Reglas que no se simplifican

- Sólo operaciones listas, de la misma máquina y configuración admitida. Debe existir un formato común para **todos** los trabajos, no sólo compatibilidad de a pares.
- Preservar tecnología, perfil efectivo, color/capas/caras, propiedades del material, márgenes, sangrado, separaciones y rotaciones permitidas. La falta de datos bloquea la recomendación concreta y explica el motivo.
- Validar el soporte y el área imprimible real de la máquina. Una superficie total de stock no acredita un largo continuo de bobina.
- Preservar identidad tenant/OT/ítem/lote/diseño y cantidades exactas. Un porcentaje aproximado pendiente no puede transformarse en cantidades de cada diseño: las reanudaciones sin demanda exacta conservan su plan.
- No basta `layoutConservado === false` para autorizar redistribución: hace falta evidencia positiva de diseños independientes y ruta posterior compatible.
- No duplicar el procesamiento de una placa compartida en varios cortes ni ponerla en dos recursos simultáneamente. Este caso exige modelar una ejecución común o queda excluido del piloto.
- Mantener preparación, cargas, recargas, limpieza y reservas humanas según el proceso configurado. La agrupación no las elimina automáticamente.
- Búsqueda acotada por cantidad de diseños/instancias/formatos, fuera de transacciones largas. Al confirmar, revalidar estado, compatibilidad, versión de geometría y capacidad; no aceptar una vista previa obsoleta.

## Acomodo calculado y archivo que se imprime

El impresor prepara hoy los archivos en el RIP. El dibujo del nesting y el archivo de impresión son entregables distintos. El flujo puede recomendar un ancho y un acomodo desde el sistema; para afirmar que el consumo y los tiempos corresponden a lo ejecutado, debe conservarse ese acomodo al preparar la impresión.

La primera entrega debe definir cómo se usa el resultado: referencia identificada para reproducir en el RIP, o exportación de un archivo compuesto validado. No se ha comprobado una integración automática con el RIP. Una exportación nueva requiere verificar escala, arte, sangrados y configuración de impresión; no se resuelve exportando sólo rectángulos. Si el operador cambia la composición, los ahorros calculados permanecen orientativos y no se registran como consumo real.

## Secuencia propuesta y criterio de aceptación

1. Contrato de elegibilidad, equivalencia de presentaciones y demanda rectangular con trazabilidad; casos negativos de materiales y layouts protegidos.
2. Propuestas automáticas de rollos sobre toda la cola lista: grupos entre anchos cotizados distintos, ancho recomendado visible, preview y validación de encaje/cantidad. Incluir separación manual respetada al refrescar y recalcular sólo lo necesario. Resolver aquí la salida utilizable por el impresor.
3. Persistir la revisión elegida y su demanda productiva, conectarla con ETA, inicio/cierre conjunto y excepciones. Validar concurrencia, permisos, aislamiento por tenant y prevención de dobles ejecuciones.
4. Aplicar el mismo recorrido a placas rectangulares elegibles, incluyendo su separación posterior.

La ampliación se considera funcional cuando un operador encuentra propuestas ya calculadas para trabajos reales de anchos diferentes, puede usarlas directamente o separar trabajos y recalcular, y puede confirmar su impacto y ejecutar/cerrar la tanda sin perder trazabilidad ni romper las etapas siguientes. Mostrar un acomodo aislado o exigir armar primero la selección manual no satisface el recorrido acordado.
