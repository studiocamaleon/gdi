# Elección automática de materiales según stock

Estado: implementado · 23/09/2026.

## Configuración

En **Producto → Ruta → Paso → Materiales → Elegir automáticamente**, cada material tiene su propia política:

| Política | Comportamiento |
| --- | --- |
| Considerar todas | Mantiene el criterio actual. Puede cotizar materiales que necesitan reposición. Es el valor inicial de todos los productos existentes. |
| Priorizar stock disponible | Aplica el criterio habitual entre alternativas suficientes. Si ninguna alcanza, permite cotizar con reposición y muestra una advertencia. |
| Sólo stock disponible | Descarta alternativas insuficientes. Si ninguna alcanza, requiere cambiar la selección o la configuración. |

La ficha conserva el criterio de elección (costo, aprovechamiento o capacidad); la política limita qué candidatos pueden participar. No es una configuración global de la empresa ni del material: el mismo material puede tener políticas distintas según el trabajo.

## Interfaz del cotizador

- La selección automática queda oculta mientras el motor pueda resolverla con el stock requerido. Tampoco se muestran avisos del cálculo anterior mientras se recalcula.
- Si aparece un faltante, el cotizador muestra las alternativas técnicamente evaluadas. El comercial confirma explícitamente una variante para guardar el ítem con reposición, también cuando el motor devolvió una cotización con advertencia.
- La marca **Recomendado** proviene del criterio del motor (costo, aprovechamiento o capacidad), no del material predeterminado del catálogo. Recomendar no preselecciona ni autoriza la excepción.
- Los rollos se presentan en tarjetas de **Ancho de rollo**, con una ilustración de rollo desplegado y cota. Largo, acabado y otros atributos comunes se muestran una sola vez; las diferencias permanecen en cada tarjeta. Las unidades se interpretan según la plantilla de material.
- Después de elegir, la sección permanece disponible para cambiar la excepción. **Volver a selección automática** la retira y recalcula. Si se resuelve, la sección vuelve a ocultarse.
- Los selectores comerciales de rollos reutilizan las mismas tarjetas. Los selectores de acabados y colores conservan su eje específico.

El diagnóstico identifica el `configPasoId` y el `slotCodigo` para no mezclar materiales de distintos pasos con el mismo nombre. La consolidación comunica el consumo definitivo, incluida la demanda conjunta.

## Qué significa disponible

- Existencias físicas en ubicaciones y almacenes activos, menos reservas de otras OTs.
- Al editar una OT se reconocen sus propias reservas. La consulta no las libera.
- Debe alcanzar para el consumo físico completo del candidato, en la unidad de stock, incluyendo acomodo y merma. Una placa cotizada por superficie útil puede necesitar una placa física completa.
- La demanda de los otros ítems de la propuesta se informa al motor; los pasos y componentes comparten un saldo temporal. La consolidación vuelve a verificar el lote y evita contar varias veces la misma placa o rollo.
- Las compras pendientes no se consideran existencia actual. Las cantidades o conversiones desconocidas no se toman como disponibles.
- Requiere el módulo de existencias habilitado y saldos registrados.

La consulta sólo lee stock. No genera movimientos, compras ni reservas.

## Emisión y cambios posteriores

La reserva y los faltantes siguen el flujo habitual de la OT. Para selecciones estrictas, la emisión vuelve a comprobar el stock bajo los bloqueos de inventario y dentro de su transacción. Si cambió, pide revisar; no sustituye el material ni cambia el precio aprobado.

Las políticas generales y las elecciones explícitas siguen permitiendo cotizar y emitir con faltantes. Al convertir un presupuesto, si falta la fecha de reposición, se emite con **entrega por confirmar**. Las rutas y tiempos deben seguir siendo válidos.

La política se conserva al guardar, duplicar y publicar recetas. La opción predeterminada no cambia la huella de las recetas anteriores: la migración no obliga a volver a publicarlas.

## Alcance

Se elige una alternativa completa por material/paso. No se divide automáticamente el trabajo entre varios anchos con stock parcial. El stock expresa cantidades por variante; no inventa disponibilidad de un retazo con una geometría determinada.

Los pliegos automáticos con materia prima propia respetan los candidatos del material del paso cuando se activa esta política: sus variantes deben estar incluidas en esa lista.

## Verificación

Pruebas del motor: variantes agotadas, saldos positivos insuficientes, reservas, merma, rollos, placas físicas, demanda de otros ítems, excepción manual, consolidación y políticas por plan.

Pruebas con PostgreSQL aislado: emisión, faltantes, reservas propias, cambio de stock, conservación del presupuesto y entrega por confirmar. No se crean OTs ni se envían mensajes de prueba en la empresa real.
