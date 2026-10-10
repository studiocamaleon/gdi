# Planificación en pantallas pequeñas

La planificación prioriza el calendario en pantallas de hasta 1280 px de ancho o 800 px de alto. Los tres indicadores se resumen en una línea; al abrirla aparecen las cantidades completas y el detalle de entregas vencidas, en riesgo y por confirmar. En un escritorio amplio se conservan las tarjetas.

Agrupación, período, búsqueda y actualización permanecen visibles. «Opciones de vista» reúne dependencias, zoom y despliegue de filas. «Referencias» contiene la leyenda, el calendario laboral y la fecha de consulta. El estado de la planificación y las acciones de la tarea seleccionada siguen accesibles al pie del calendario.

«Ampliar planificación» ocupa la pantalla con el calendario. Se conserva agrupación, búsqueda, período, zoom, filas abiertas, selección y desplazamiento. La posición horizontal se ajusta a la escala real del nuevo ancho; si se estaba al final, se mantiene ese extremo. Los paneles de detalle, estado y reprogramación pertenecen al diálogo ampliado. Escape cierra primero el panel que se está usando, y al cerrar la ampliación el foco vuelve a su botón.

En móvil se reduce la columna fija de recursos y se mantiene visible el nombre del día junto a su fecha. Se elimina la altura fija de 560 px que empujaba el calendario fuera de la pantalla.

## Comprobación local — 10/10/2026

Prueba en Chrome con los componentes reales, sus estilos y el motor de planificación. Se utilizó una muestra aislada de siete órdenes y 21 operaciones ficticias, con las lecturas de API sustituidas por datos en memoria. No se inició API, workers ni Docker; no hubo escrituras en bases ni llamadas a servicios externos.

| Pantalla | Resultado |
| --- | --- |
| 1920 × 1080 | Tarjetas completas y calendario de 667 px de alto. |
| 1366 × 768 | Resumen compacto y calendario de 506 px de alto. |
| 1134 × 647 | Calendario de 385 px; al ampliar, 433 px y ancho de 1108 px. |
| 390 × 844 | Controles en dos filas, selección y acciones visibles; sin desborde de página. |
| 320 × 568 | Calendario de 272 px sin selección, dos recursos visibles; sin desborde de página. |

Los tamaños incluyen el encabezado simulado de 52 px y, en notebook/escritorio, una barra lateral de 224 px. En la comprobación posterior se reprodujo también una barra de 89 px para móvil: la altura se limita al espacio disponible del contenedor y las acciones siguen visibles en 390 × 844 y 320 × 568.

Recorridos verificados: resumen, referencias, búsqueda por OT, agrupación por órdenes, zoom 75%, ampliación y retorno, selección, desplazamiento en ambos ejes y anclaje al extremo derecho. También detalle → reprogramación → edición de motivo → Escape → detalle → cierre; el calendario ampliado se conserva y el foco vuelve correctamente. No se confirmó ninguna reprogramación contra una API real.

Validación automatizada: 67 pruebas entre modelo, geometría, eje laboral, hook, reprogramación y conservación de posición. ESLint de los archivos modificados, TypeScript de esos componentes y sus dependencias, `css:guard` y `git diff --check` sin errores. La comprobación TypeScript global agotó la memoria disponible; se sustituyó por la comprobación acotada. No se compiló la imagen de producción en la Mac.

Esta mejora depende temporalmente del PR #56 (`codex/publicacion-analisis-seguimiento`), que contiene la reprogramación y los componentes publicados usados por esta vista. No incluye el cambio del límite de archivos del PR #57.

## Comprobación en staging — 10/10/2026

Web publicada en `53ba3fc53d0b4de15618cabe11b2de208d2a3db0`, [PR #58](https://github.com/studiocamaleon/gdi/pull/58). API y workers conservan `15014c464`. La compilación completa con TypeScript pasó en Fly; no se omitió la comprobación global por la limitación de memoria local.

Chrome autenticado con la empresa demo: en 1134 × 647 el calendario pasó de 132 a 385 px de alto. Ampliado mide 433 × 1108 px dentro de un diálogo que ocupa los 1134 × 647 completos. Búsqueda por OT, agrupación por órdenes, zoom 75%, selección y filas abiertas se conservan al ampliar y volver. Detalle → Reprogramar → edición de motivo → Escape → detalle → cierre mantiene el calendario; al cerrar la ampliación el foco vuelve a su botón. Se canceló sin guardar fechas.

En 390 × 844, la barra superior real ocupa dos filas. Se corrigió el límite de altura para que Referencias, Estado y las acciones de la tarea seleccionada permanezcan visibles, sin desborde horizontal de página. Se volvió a comprobar notebook y ampliación con la imagen final. Consola sin errores ni advertencias. Evidencia visual fuera de Git y registro operativo en [VALIDACION.md](../deploy/staging/VALIDACION.md).

Lucas aprobó la prueba. La vista se publicó en producción dentro de `bbc881d4d` y el PR #59, junto con #21 y #57. Ver el [registro de producción](../deploy/produccion/VALIDACION.md).
