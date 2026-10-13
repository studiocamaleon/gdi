# Tandas automáticas de Centro de copiado

Al revisar los precios de una OT, Grafo agrupa los PDF sueltos compatibles de todas sus cargas. En **Archivos**, cada tanda ofrece **Ver PDF de la tanda** y descarga. También se puede abrir antes de guardar, con los originales todavía en memoria.

El PDF incluye las copias de cada documento: se imprime **una sola copia** del archivo resultante. Conserva el orden de los productos, los rangos seleccionados, tamaño, área visible y rotación. En doble faz, cada original y cada copia empiezan en frente; se agrega el reverso vacío cuando corresponde. Los originales se conservan.

La compatibilidad exige misma máquina, producto, moneda/cambio, papel, gramaje, formato y dimensiones, color, cobertura y caras. Los tomos conservan sus juegos y preparaciones existentes; los documentos con terminaciones y CAD siguen separados. No se presume que una fila manual, Word o Excel pueda unificarse: necesita su PDF. Las cargas antiguas sin tamaño del original conservan su preparación hasta cargar el archivo con sus datos completos.

Cada tanda admite hasta 100 MB de originales y 5.000 páginas de salida, contando copias y blancos. El plan se divide antes de superar esos límites. El lector valida nuevamente las páginas, rangos y tamaños; un archivo incompleto, inválido, protegido o reemplazado no produce silenciosamente otro trabajo.

## Costeo y márgenes

Se simula una preparación en el primer miembro de cada tanda y ninguna en los siguientes. Los materiales y el tiempo de impresión de todos los originales se mantienen. La preparación se imputa al primer miembro; por eso los márgenes por producto pueden diferir del margen conjunto de la tanda.

El snapshot conserva tanto el total como los buckets y los pasos recalculados. La OT reabierta y su detalle de tiempos usan ese mismo resultado. Con tarifario se mantienen los precios del canal. Las nuevas revisiones verifican la contribución sobre los costos variables conjuntos, según [Contribución de Centro de copiado](centro-copiado-contribucion.md). En canales de motor se conserva el precio previamente cotizado y se actualiza el costo productivo compartido.

El objetivo de margen se compara a la precisión monetaria cuando los importes ya están redondeados a moneda: no se requiere una autorización por una fracción de centavo del objetivo. Se conserva la evaluación exacta si el costo trae más precisión; una diferencia de una unidad monetaria mínima o una pérdida real continúa requiriendo el control configurado.

Al quitar o cambiar miembros, se debe revisar el pedido; no se permite emitir una tanda incompleta usando la preparación de un miembro ausente. La impresión directa individual indica usar el PDF de Archivos para las tandas de varios productos, evitando enviar por separado lo que se costeó como un único trabajo. Esta mejora entrega un PDF para impresión manual; no cambia la confirmación de pasos ni automatiza la cola QZ de varios productos.

## Desarrollo

Rama `codex/copiado-tandas`, dependiente de `codex/centro-copiado-tarifarios` (base local `b1471868b`, todavía sin integrar a main). Sin migración ni cambios en listas de precios. Las órdenes históricas no se modifican hasta recotizar.

Las pruebas usan datos y PDF ficticios. Cubren compatibilidad, límites, copias, blancos, rangos, conservación de originales, autorización de acceso existente, costeo, snapshots y rechazo de una tanda incompleta. La prueba completa de subida y reapertura necesita CORS válido en el bucket de desarrollo para el origen local, como establece `docs/archivos-r2-diseno.md`.

Validación local del 12/10/2026: PDF descargado de 18 páginas A4, con dos copias de un original de 3 páginas, una copia de otro de 10 y dos reversos vacíos. Se comprobó el orden mediante extracción y renderizado. El borrador guardado conserva costos, desglose, tiempos y margen al reabrir. La descarga no activa el aviso de salida ni desprotege cambios pendientes. La subida y reapertura de los originales queda pendiente de configurar CORS en el almacenamiento de desarrollo; se decidió dejar esa configuración para otro momento.

Comprobaciones: 100 pruebas de API y 46 de interfaz aprobadas; revisión de tipos de los módulos afectados y lint sin errores. No se realizó una impresión física ni un despliegue.
