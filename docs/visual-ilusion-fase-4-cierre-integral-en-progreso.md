# Cierre integral de Fase 4 — bitácora de implementación

Continúa la auditoría del 07/09/2026. Objetivo autorizado: resolver TODOS sus hallazgos y aprobar los recorridos completos antes de cerrar la fase. La auditoría original conserva los resultados anteriores; este archivo registra correcciones y evidencia nueva. **Actualización final: fase cerrada funcionalmente en local.** El [dictamen final](visual-ilusion-fase-4-cierre-integral-2026-09-07.md) reemplaza los pendientes históricos registrados abajo.

## Avance

| Punto | Corrección actual | Evidencia y trabajo restante |
| --- | --- | --- |
| H1 | Control de contracción del DAG con precedencias transitivas y lotes previamente aceptados, antes de aplicar ahorro. Incluye cortes registrados. Guardia de OT previa a modificar dependencias/pasos. | Reproducción PostgreSQL corregida en `output/cierre-fase-4-2026-09-07/verificar-lote-precedencias.cjs`; rechazo sin modificar pasos, costos independientes y cero residuos. Regresiones de ramas paralelas, impresión/corte, opcionales y ciclos conjuntos aprobadas. Falta aceptación operativa completa del conjunto. |
| H2 | Lectura de contexto/traza congelada del hijo, proyección agregada del lote, exclusión de participaciones en simuladores, gates en fronteras, lectura del bastidor hijo y contexto del tablero/registro de tanda. Los planos conservados se presentan con el visor original y el endpoint impide reanidarlos como rectángulos de rollo. | Prueba PostgreSQL de dos ámbitos: una impresión por ámbito, 60 piezas por trabajo y plano idéntico; rechazo de reanidado. Pruebas previas del simulador aprobadas. Pendiente completar regresiones nuevas de permisos/gates y QA visual de la tarjeta. |
| H3 | SQL recursivo por árbol de componentes para rentabilidad, margen por producto/categoría y materiales/tintas. No suma totales de lotes ni operaciones internas que ya están agregadas. Proveedor externo cuenta una vez, descontando sus materiales propios; se conserva su subtotal en etapas compuestas. | PostgreSQL: tres casos GENERAL/MIXTO/POR_COMPONENTE verifican lectura recursiva, proveedor externo, consumibles y desgaste sin duplicación. Reproducción original: variables 120 (antes 20). Falta conciliación sobre todos los recorridos completos. |
| H4 | Filtros de raíces en reportes comerciales y plataforma; participaciones excluidas de productividad, tiempos/medianas y ETA histórico. Panel general y entrega al mostrador distinguen productos comerciales. | Implementado, en validación. Tracking y próximas entregas agrupan el avance de hijos/nietos bajo las raíces y omiten participaciones. PostgreSQL: entrega rechazada con nieto pendiente, parcial, completa y revertida; tracking 2 productos y una sola actividad de impresión; otro tenant rechazado. Falta verificar documentos/áreas vecinas sobre toda la matriz. |
| H5 | Consultas de facturación individual/general traen raíces; preparadores excluyen hijos por identidad y conservan productos gratuitos. | Implementado. PostgreSQL y servicios reales: borrador individual, general y parcial; conserva producto gratuito, descuento, 96,80 de total y dos renglones. Documento y generador PDF aprobados. Se corrigió además el atajo general que usaba el neto como precio final en B. No se emitieron comprobantes reales; falta aceptación de NC/PDF visual en la matriz. |
| H6 | Transporte por referencias compactas para interpretaciones guardadas, resolución por cuenta/archivo/hash incluso dentro de overrides y grupos; presupuesto geométrico separado del contexto comercial. Recotización guarda el contexto rehidratado. | Endpoint HTTP real con ValidationPipe y PostgreSQL: seis fuentes de mil puntos (350 KB completas, menos de 3 KB por referencia), cotizar, guardar, recotizar y reabrir; rechaza hash mezclado y sin autenticación; rollback sin residuos. Pruebas de binding hijo conservan hendido/medidas. Resta aceptación de la cola asíncrona en el recorrido del exhibidor. |
| H7 | El motor conserva el análisis de la cotización hija. OT persiste `trazabilidadSnapshotJson`, recorre todos los ámbitos y asigna IDs de lote por padre ejecutable. Visor recursivo con IDs y vínculos impresión/corte por ámbito. | PostgreSQL: siete ítems, dos ámbitos, cuatro operaciones, cuatro participaciones; repetir materialización no duplica, cambio del maestro no cambia los snapshots. Prueba web de planes con códigos repetidos aprobada. Falta cotización real multinivel y aceptación completa de archivos/ejecución. |
| H8 | Política 8: dos vueltas iniciales con 1.000 iteraciones deterministas en Collision, limitadas externamente a 8 s por intento; después continúan las estrategias por tiempo dentro del presupuesto global. El tiempo de una estrategia ya no depende de su posición al invertir el orden. | Motor real: tres repeticiones consecutivas con 8 piezas en 2 placas, 14,3 s en total incluyendo Jest; márgenes/separaciones/rotaciones y contornos validados. Evidencia `puma-aceptacion.json`. La búsqueda sólo por tiempo había fallado de manera intermitente incluso después del primer ajuste. |

## Migraciones y entorno

- Aplicadas correctamente en `gdi_saas_test`: biblioteca de geometrías `20260907010000_geometrias_producto_reutilizables` y traza de componentes `20260908010000_trazabilidad_componentes_ot`.
- Aplicada la nueva columna nullable también en desarrollo local `gdi_saas` tras verificar host/puerto/base; no se modificaron productos ni órdenes reales. Prisma Client regenerado. Sin reinicio manual de los servidores.
- Pruebas que crean registros usan transacciones de PostgreSQL de prueba y rollback; la prueba anidada modifica un maestro sólo dentro de su transacción revertida.

## Regresiones nuevas

- `ordenes-trabajo/__tests__/consolidacion-produccion.spec.ts`
- `ordenes-trabajo/__tests__/componentes-anidados.integration.spec.ts`
- Ampliadas pruebas del consolidador, cortes registrados, materializador, planes comerciales y view-model del simulador.

## Pendiente transversal

Las cuatro expectativas antiguas fueron corregidas. CSS guard aprobado: 25 clases migradas a cuatro módulos, 12 reglas de producción sin usos retiradas y seis clases compartidas de diálogos Grafoprint incorporadas expresamente a la base (663 líneas menos en globals.css). La suite general detectó además un orden no determinista al elegir anillado en Centro de Copiado: ahora usa el orden de tipos configurados e instalados; su regresión dirigida pasó. Pendientes: nueva corrida final de suites API/web/Python, builds aislados, QA desktop/móvil y matriz integral del informe. No marcar el plan maestro como cerrado hasta tener evidencia de todos los recorridos. No integrar a main ni publicar por la sola finalización de pruebas parciales.

## Ampliaciones de controles durante la integración

- El control de precedencias de nesting ahora recibe los contenedores de nodos compuestos, no sus operaciones privadas.
- Completar tandas láser comparte la frontera del DAG con el simulador: permite nodos paralelos y rechaza gates o predecesores pendientes antes de avanzar. Las tandas con planos conservados no pueden registrar un reacomodo rectangular.
- `fuentes-http.integration.spec.ts` usa controladores y motor reales; la autenticación se inyecta sólo en el servidor de prueba, no pretende sustituir los tests de guards/permisos de la aplicación.
- La prueba de costos recursivos verifica lectura de snapshots de las tres políticas. La aceptación comercial de las políticas sigue respaldada por la integración del motor y falta conciliarla con todas las órdenes de la matriz.

## Resultados generales intermedios

- API antes de los últimos ajustes: 2.248 aprobados, 1 fallo (default de anillado no determinista), 4 omitidos; se corrigió y pasó su suite dirigida. Esta corrida aún no incluía el nuevo recorrido HTTP.
- Web antes de sincronizar política 8: 693 aprobados, 7 fallos por versión del worker desfasada; corregido y pasó la suite del cotizador (11 tests). No se eliminó ninguna validación de versión.
- Se mantienen los logs originales fallidos como evidencia de diagnóstico. Sólo los resultados finales posteriores podrán usarse para cerrar la fase.


## Aceptación ampliada y versión probada (07/09, segunda revisión)

- El servidor habitual de desarrollo seguía ejecutando `apps/api/dist/src/main` compilado antes de estas correcciones. Se mantuvo abierto para no interrumpir al usuario. La aceptación visual usa Next en 3100 y API en 3011 con build aislado, autenticación real, tareas programadas desactivadas y middleware que sólo permite consultas, cotización y exportación. El worker usa Redis efímero propio; no procesa ventas ni trabajos de la cola habitual.
- Builds de API y web aprobados en una copia temporal. Para reproducir el build API se incluyen también los scripts TypeScript externos a `src`, porque determinan la estructura `dist/src` junto con los assets Python.
- Regresión general posterior a H1–H8: **2.255 API aprobadas, 6 omitidas; 700 web aprobadas; 12 Python aprobadas**. Logs `api-regresion-final.log`, `web-regresion-final.json`, `python-regresion-final.log`. Esta corrida precede al nuevo ajuste de Compras y a la recuperación de costos históricos; se repetirá al terminar esos cambios.

### Recorridos aprobados

| Recorrido | Evidencia |
| --- | --- |
| Simple | `recorrido-cotizacion-ot.integration.spec.ts`: Tarjetas reales del seed → guardar → emitir OT → ejecutar → finalizar, importes del snapshot, rechazo de tenant/permisos/fin prematuro e idempotencia. |
| Tres políticas de precio | `motor.spec.ts`, caso F4.2/F4.3/F4.4.2, ampliado para emitir y ejecutar cada cotización GENERAL/MIXTO/POR_COMPONENTE. El material de este caso no es consolidable: no se atribuye un ahorro ficticio. |
| Kit rectangular | `kit-vinilos-ot.integration.spec.ts`: publicación real, 3/30/150 piezas; edición a 40 piezas; configuración inicial vacía y grupos de 10/20 piezas; emisión y ejecución. QA del Kit del catálogo también confirma 3/30/150 y disposición legible en escritorio y 390 × 844. |
| Dos niveles reales | Mismo test del Kit: dos kits con códigos internos repetidos y dos componentes por kit. Motor real aplica consolidación; OT de siete ítems, dos impresiones operativas con identidades separadas; cambios posteriores del maestro no alteran contextos ni traza. Ejecución finalizada. |
| Lotes anidados | `componentes-anidados.integration.spec.ts` ampliado: ejecuta las cuatro operaciones de lote, los dos ensamblajes y el final; participaciones sin tramos ni tiempo duplicado. |
| Concurrencia | `lote-concurrencia.integration.spec.ts`: dos conexiones reales, un solo inicio y cierre; gate auditado; participaciones sincronizadas, sin doble trabajo. Cuenta temporal de prueba eliminada con cero residuos. |
| HTTP y cola | `fuentes-http.integration.spec.ts` con `F4_QUOTE_WORKER_INTEGRATION=1`: seis fuentes de mil puntos por referencias compactas, API+ValidationPipe+Redis+worker reales, consulta por tenant, misma clave reutiliza el trabajo. Aprobado. |
| Exhibidor real | Navegador + worker del build actual, receta v5: 1/10/50/51 unidades → 9/90/450/459 piezas. 50 unidades: 34 placas y tres patrones (25/5/4), 79,68 % de aprovechamiento, sin excedentes. 51 unidades: 34 placas y cinco patrones. Impresión y corte comparten el acomodo. Optimización grande agotó 120 s y entregó una solución válida; no se afirma mínimo geométrico. |
| Resultado del catálogo → OT | `catalogo-local-f4.integration.spec.ts` opt-in: importa sólo maestros publicados capturados, reproduce resultados reales en PostgreSQL de prueba, persiste con el constructor de snapshots del motor y emite/ejecuta OT. **Cinco casos aprobados**, los cuatro tamaños del exhibidor y Backlight. No es una segunda cotización simulada: la evidencia del motor/HTTP está en la captura previa; la reproducción valida persistencia y operación sin ventas en desarrollo. |
| Backlight real | Cotizador 200 × 100 × 20 cm; cálculo reproducido con motor real: total 348.919,46. Bastidor conserva profundidad 200 mm, publica lona 2.200 × 1.200 mm y Lona consume ese output. Una compra de bastidor, dos pasos de lona y un nodo de ensamblaje con operaciones internas. La OT rechaza ensamblaje prematuro y finaliza mediante Compras y producción. |
| Documentos | `facturacion-componentes.integration.spec.ts`: factura completa/parcial, entrada general, descuento y producto gratuito; NC por el total y rechazo de doble acreditación. PDFs de borradores de factura y NC renderizados y revisados, sin recortes ni superposiciones. El estado emitido del origen es sólo una fixture de prueba: no se invocó el proveedor fiscal. |

La comparación de geometría persistida admite 10⁻⁹ mm al normalizar números: PostgreSQL/Prisma puede representar `138.40799999999996` como `138.408`. No se modificó el acomodo para hacer pasar la prueba. Los snapshots leídos antes/después se conservan íntegros.

### Hallazgo adicional H9 — Compras y dependencias

`avanzarCompra` aún exigía índices anteriores y no la topología real de la OT. Se corrigió para respetar dependencias entre componentes, ramas paralelas y gates, impedir deshacer una recepción con descendientes iniciados, serializar contra otras acciones mediante el lock de la orden y evitar eventos duplicados al recibir simultáneamente. El progreso usa la misma ponderación que producción, y deshacer una compra terminal reabre la OT sin perder la primera finalización. Se conserva la secuencia histórica de órdenes sin grafo. `compras-dag.integration.spec.ts`: **dos recorridos aprobados**, incluyendo dos conexiones concurrentes, tenant ajeno y orden entregada.

### Ajustes complementarios

- H6: se detectó y corrigió el límite de profundidad que rechazaba piezas rectangulares dentro de grupos adicionales. Se valida su contrato preciso, sin aumentar indiscriminadamente los límites del contexto comercial.
- Progreso de lotes: las participaciones de duración cero ya no reciben el peso de un trabajo desconocido. Regresión de porcentaje 50 % frente al 75 % incorrecto, tanto con duraciones conocidas como ausentes.
- El aviso de medidas requeridas incluye profundidad para productos 3D.
- En curso: recuperación de tercerización histórica dentro de operaciones internas cuando la revisión anterior no guardaba subtotal agregado; conciliación final y segunda regresión posterior a H9.

### Pendientes concretos para el cierre

- Completar la comprobación ponderada de capas de los tres DXF del pedido de 50 exhibidores (el DXF de una unidad ya fue reimportado sin errores, en mm, con todas sus capas).
- Consolidar evidencia de simulador/archivos anidados y reportes sobre los recorridos de aceptación, sin confundir tests de proyección con una venta real.
- Repetir checks y builds después de H9 y los últimos ajustes; documentar la versión local que queda ejecutándose.
- Actualizar el estado del maestro únicamente al completar esas verificaciones. No merge ni despliegue remoto autorizado.


## Resultado final — cierre del 07/09/2026

Todos los pendientes anteriores fueron completados. H3 histórico pasó 6/6; regresión API posterior a H9: 2.260/2.260, web: 700/700; Python: 12/12. Los cinco casos del catálogo también pasaron reportes/tracking sobre las mismas órdenes. Tarjeta del simulador revisada; archivos anidados aprobados; cuatro DXF reimportados sin errores y balance ponderado exacto. Builds finales API/web aprobados. API, worker y frontend habituales actualizados y operativos; entorno QA detenido. El detalle y los límites están en el [informe final](visual-ilusion-fase-4-cierre-integral-2026-09-07.md). F5 habilitada; sin merge ni despliegue remoto.
