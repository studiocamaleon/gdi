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

Pendiente antes de publicar: revisión del conjunto, validación en staging y autorización de producción. Compilar imágenes de producción en remoto; no reiniciar ni ampliar Docker.
