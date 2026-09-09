# Publicación automática de productos y recetas

## Decisión

Por pedido del usuario, guardar una configuración válida publica automáticamente su receta. Reemplaza el requisito de publicación manual de la Fase 3: el historial sigue versionado, pero el comercial no debe recorrer las rutas de cada componente y sus padres para poder cotizar.

## Funcionamiento

- Las modificaciones de identidad y configuración del producto, rutas alternativas, orden de pasos, recursos de un paso, cargos asociados y pasos extras sincronizan todas las rutas activas del producto y sus padres.
- Guardar componentes, documentos y dependencias actualiza y publica la receta. Los hijos se resuelven antes que sus padres, también en composiciones de varios niveles.
- La cotización comprueba las dependencias y recupera automáticamente publicaciones pendientes anteriores al cambio, o configuraciones alteradas por otras vías. Se mantiene la compatibilidad de productos sin receta mientras no se incorporen al versionado.
- Sólo se crea una nueva versión ante un cambio productivo. Guardar lo mismo no genera publicaciones adicionales.
- Las publicaciones se serializan por cuenta con un bloqueo transaccional de PostgreSQL, compartido entre API y workers. Una publicación y la actualización de sus dependencias son atómicas.
- La ruta preferida del hijo se selecciona en el mismo orden que en el motor; las otras alternativas conservan sus versiones propias. Una alternativa incompleta no bloquea las alternativas válidas.
- Las publicaciones anteriores, los snapshots de cotización y las órdenes existentes conservan su contenido.
- Los eventos de una actualización en cadena agrupan la recarga de la bandeja de notificaciones, para evitar una consulta por cada publicación.

## Edición

Se puede abrir directamente una versión publicada en el editor. Al guardar se crea su sucesora automáticamente; desaparece la confirmación previa para crear un borrador.

El editor envía su revisión base. Si entre dos acciones se publicó una actualización técnica, el guardado puede continuar siempre que las definiciones editables no hayan cambiado. Si otra sesión modificó componentes, documentos, dependencias o nodos compuestos, se conserva el bloqueo de concurrencia para evitar sobrescribirlos.

Si faltan materiales, máquinas, configuración de pasos o hay referencias inválidas, se conservan las definiciones guardadas pendientes y se informa el problema concreto. La publicación automática no omite esas validaciones.

## Verificación

- Integración con PostgreSQL: producto simple, padre y abuelo; propagación; snapshots anteriores; guardado repetido; edición sobre una publicación técnica; conflictos reales; alternativas independientes; recuperación al cotizar; publicaciones concurrentes en conexiones separadas.
- Interceptor: espera la publicación antes de responder, resuelve el propietario antes de eliminar un paso y no publica un guardado rechazado.
- Regresión del Kit de Vinilos hasta emisión/ejecución de OT y del motor F4.2/F4.3/F4.4.2 con pricing y nesting consolidado.
- Compilación de API, TypeScript frontend, ESLint, `css:guard` y revisión de diferencias.
- Cuenta local Grafica Corporearte: se sincronizaron 20 productos que ya tenían recetas, sin bloqueos de publicación. El cartel quedó vigente en V19 y abrió directamente su editor.

El script `apps/api/test/sincronizar-publicaciones-local.ts` permite recuperar publicaciones existentes de una cuenta explícita. Es una operación persistente; no altera configuraciones técnicas ni cotizaciones u órdenes guardadas.

El problema previo del nodo de incorporación de Polyfan al emitir la OT es independiente de las publicaciones; esta tarea no cambia ese flujo productivo.
