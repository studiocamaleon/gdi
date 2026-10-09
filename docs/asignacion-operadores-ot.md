# Operadores por estación y por orden

## Cómo se usa

1. En **Producción → Estaciones**, agregar las personas habilitadas para trabajar allí. Una misma persona puede pertenecer a varias estaciones; conserva un único horario y una agenda compartida.
2. Para cada persona elegir **Habitual** o **De apoyo**. Los habituales participan del reparto automático. Los de apoyo aparecen como alternativa manual y no reciben trabajo automáticamente por estar agregados. Los integrantes existentes siguen como habituales.
3. En una orden nueva o borrador, abrir **Producción → Elegir operadores**. Cada paso muestra su estación y máquina. Elegir una persona o dejar **Automático**; si requiere varias, seleccionar la dotación completa.
4. Pulsar **Revisar disponibilidad** para comparar las fechas de terminación. **Aplicar elección** la lleva al formulario; **Guardar borrador** o **Emitir OT** la persiste. La revisión no reserva capacidad ni garantiza una fecha: depende de la carga actual.
5. Al emitir se vuelve a validar el personal, su horario y la viabilidad del trabajo. Si cambió algo que impide asignarlo, la operación se revierte y la orden queda en borrador.
6. En una OT ya emitida, usar la asignación del paso en Producción: conserva la revisión de impacto y su confirmación. Los pasos iniciados no se transfieren en este bloque.

Elegir otro operador no cambia la máquina ni los costos. Para imprimir en otro equipo hay que elegirlo al configurar/cotizar el producto. La persona debe estar habilitada como habitual o de apoyo y tener el permiso operativo correspondiente; marcarla como apoyo no concede permisos de usuario.

## Límites visibles

- Elegir personal requiere `produccion.supervisar` y la capacidad `asignacion_automatica`, tanto en la interfaz como en la API. Consultar la revisión también requiere la vista de órdenes. La respuesta contiene información operativa, sin costos ni datos del legajo.
- Antes de emitir se pueden elegir los pasos del producto principal. Los componentes fabricados conservan su planificación; la fecha completa se verifica al emitir. Para asignar pasos de componentes, usar Producción después de emitir.
- Si el producto se divide en lotes de entrega, el panel avisa que se asignan desde Producción una vez emitidos. No descarta una elección previa silenciosamente.
- Una recotización normal conserva la elección y vuelve a comprobar sus pasos y habilitaciones. Si se reconstruye una carga del Centro de copiado (por ejemplo agrupar o separar tomos), se crean trabajos nuevos: un aviso pide elegir nuevamente sus operadores.
- La sugerencia de entrega en el formulario considera las elecciones aplicadas. Si desapareció un paso elegido, deja de sugerir una fecha y pide revisarlo.

## Acciones de la ficha

- **Imprimir:** documentos, etiqueta y, cuando corresponde por permisos y contenido, historial de impresión. La etiqueta conserva impresión directa o descarga según la configuración existente.
- **Seguimiento:** copiar el enlace del cliente y ver el QR de retiro. Conserva las restricciones existentes sobre cuándo existe un enlace.

## Datos y publicación

Migración aditiva `20261005220000_personal_habitual_apoyo`: agrega `EstacionEmpleado.asignacionAutomatica` (por defecto verdadero) y `OrdenTrabajoItem.personalPrevistoJson`. Al materializar los pasos, la decisión pasa a `asignacionManualJson`, con autor, fecha e identificador de revisión. La agenda no reemplaza esa decisión al recalcular. Una lectura posterior del tablero no reescribe decisiones materializadas.

Rama `codex/asignacion-operadores`, basada en `codex/permisos-transversales`: depende del PR #22, todavía sin integrar al comenzar este trabajo. No mezclar con ese PR ni fusionar la cadena incidentalmente. Al integrar la dependencia, ajustar la base hacia `main` y volver a revisar el diff.

## Validación local — 05/10/2026

- Base nueva y aislada `grafoprint_operadores_20261005_test`, con todas las migraciones aplicadas, sin semillas ni datos reales. No se modificaron las bases operativas local, staging o producción.
- 85 pruebas de motor, ETA e interfaz y 37 de integración aprobadas (122 en total). Comprobación completa de tipos de web y API aprobada.
- Pruebas del motor en navegador y API: el apoyo no participa automáticamente, se puede elegir manualmente, no ocupa dos estaciones simultáneamente y no completa una dotación doble sin elección.
- Integración con PostgreSQL: modalidades por estación, compatibilidad con clientes que omiten el campo, guardar/reabrir/emitir, conservar al editar, quitar la elección, aislamiento de empresas, rechazo sin supervisión, personal inválido, rollback ante cambios de habilitación y horarios incompatibles.
- Interfaz: apertura bajo demanda, revisión obligatoria antes de aplicar, rechazo de selección obsoleta y controles deshabilitados sin edición. Chrome: selección de apoyo, comparación de fechas, aplicación en memoria y menús Imprimir/Seguimiento con sus acciones.
- Catálogo visual local: `/dev/diseno/operadores`, protegido para no existir fuera de desarrollo. Sus botones y personas son ficticios; no imprime ni modifica una empresa.

## Publicación — 05/10/2026

Revisión `583725508` publicada primero en staging y después en producción con autorización del titular y las mismas imágenes por digest. CI de HTTP/aislamiento y contenedores aprobado; las compilaciones adicionales se hicieron en Fly con tipos habilitados.

Pasaron 24 comprobaciones HTTP/SSR con usuarios y empresa ficticios: modalidad habitual/apoyo, guardar/reabrir/emitir, permisos y separación entre empresas, rollback por habilitación retirada, reasignación posterior conservada y reparto automático sin apoyo ni doble ocupación. Las filas ficticias fueron retiradas.

Chrome: menús Imprimir/Seguimiento, apertura del QR y configuración habitual/apoyo comprobados en staging; estaciones y selector comprobados también en Corporearte, sin guardar cambios. Los integrantes existentes conservan el modo habitual: para ofrecer a otra persona como alternativa, agregarla a la estación como **De apoyo**.

Ambos entornos tienen 306 migraciones y mantienen los tamaños anteriores. Salud y versión de los cuatro procesos comprobadas, Sentry activo y copias posteriores verificadas con fuentes cifradas bajo custodia. No se repitió una restauración SQL completa. No se fusionaron los PR ni se modificó la web comercial. Detalles, imágenes y reversión: [staging](../deploy/staging/VALIDACION.md) y [producción](../deploy/produccion/VALIDACION.md).

## Trabajo compartido en Operación diaria — 07/10/2026

La asignación automática es una previsión de quién atenderá el paso. Cualquier integrante activo, habitual o de apoyo, habilitado en esa estación y con permiso de ejecución puede iniciarlo o completarlo. El listado y el detalle distinguen **Personal previsto** de una asignación exclusiva. Los tramos conservan a quien los trabajó y la finalización registra a quien la confirmó; un relevo no reemplaza esos datos por el nombre previsto.

Una asignación manual del supervisor sigue siendo exclusiva para las personas elegidas. Los trabajos tomados expresamente en **Mi mesa** conservan su funcionamiento; los pasos libres sin previsión requieren **Asignarme**. Compartir tareas no elimina precedencias, aprobaciones, controles de materiales, restricciones de empresa o permisos. Dos acciones simultáneas no duplican el inicio ni la finalización.

La columna **Entrega** muestra la fecha comprometida del ítem (incluido su lote de entrega) y, si falta, la de la OT. Es independiente de **Previsto** y **Real**, que describen cuándo termina el paso. Si ninguna existe, se muestra **Sin fecha**. Se conserva el día de calendario en todas las zonas horarias.

Este cambio no requiere migraciones ni modifica la dotación o los horarios configurados. Rama `codex/operacion-equipo-entrega`, basada en el PR #27 (`codex/ot-facturacion-flujos-archivos`), todavía pendiente de integración. Desarrollo y comprobación local; publicación por separado.

Validación local: 75 pruebas de API (incluidos comandos sobre PostgreSQL aislado, colas, asignación manual y sincronización real de agenda) y 81 de interfaz aprobadas. Tipos completos de API y de los ocho archivos web modificados aprobados; el chequeo global de tipos web alcanzó el límite local de 2 GB, pendiente de CI antes de publicar. Chrome comprobado en claro y oscuro con una muestra ficticia; sin errores de ejecución. La muestra y su servidor temporal se retiraron. No se modificaron datos operativos ni se publicaron entornos.
