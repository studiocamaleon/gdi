# Contribución en los precios de Centro de copiado

Tarifarios muestra y sugiere precios por **margen de contribución**. Las nuevas revisiones comerciales de pedidos con tarifario usan el mismo criterio para el mínimo y la autorización. Las terminaciones se controlan por separado para evitar que su resultado oculte una impresión con contribución insuficiente.

La fórmula es `(venta sin IVA − costos variables − cargas comerciales) / venta sin IVA`. Los costos variables incluyen materiales, proveedores, cargos productivos y componentes cuyo detalle no permite separar tiempo interno. Las cargas incluyen impuestos internos y comisiones con sus bases netas o brutas correspondientes. El tiempo interno de máquina, personal y tiempos extra es estructura que debe cubrir la contribución; no se vuelve a descontar en esta métrica. Es la misma definición de la pestaña Costos de la OT, no una medida de ganancia final.

Ejemplo ficticio: venta neta 100, materiales 20, tiempo interno 15 y cargas comerciales 10. La contribución es 70 (70%); el margen después de imputar tiempo es 55 (55%). El detalle conserva ambos conceptos.

El costo productivo completo permanece en las simulaciones y snapshots. Desactivar «Costear preparación y limpieza» omite esos tiempos productivos; no elimina consumibles, proveedores ni cargos. La preparación comercial del tarifario es un cargo de venta independiente. Este cambio no fuerza el check a desactivado en otros tenants.

Las nuevas revisiones identifican la métrica `CONTRIBUCION`. Los pedidos históricos conservan su control y etiqueta de margen hasta que se recalculan. El porcentaje mínimo configurado pasa a interpretarse como contribución mínima en las nuevas revisiones. Los permisos existentes siguen protegiendo costos y porcentajes; no se elimina el control de autorización. Los precios cargados no se reemplazan automáticamente: las sugerencias se revisan, aplican y publican mediante el flujo habitual.

El cálculo general del motor universal y los canales que usan modalidad MOTOR conservan sus reglas. Este cambio afecta las sugerencias por objetivo del tarifario y el control comercial de los pedidos que usan TARIFARIO.

## Validación local

Verificado en el navegador el 12/10/2026: configuración guardada con setup desactivado; sugerencias de A4 obra en B/N y color para 1, 5 y 10 hojas con objetivo de contribución; recálculo, guardado y reapertura de una OT ficticia; coincidencia con la contribución de Costos. No se aplicaron ni publicaron nuevos precios.

Pruebas cubren separación de tiempos internos y proveedores, componentes anidados, costos faltantes, setup activado/desactivado, tandas, terminaciones, mínimos, autorización y presentación de snapshots históricos. Pasaron las pruebas de API e interfaz, comprobación de tipos y lint de los archivos afectados.

Rama `codex/copiado-contribucion`, dependiente de `codex/copiado-tandas` en `efc45ae66`, aún sin integrar a `main`. Sin migración de datos ni despliegue.

## Recalcular y limpiar el tarifario

Las simulaciones se identifican también por la versión guardada de Centro de copiado y su check de preparación. Cambiar esa configuración invalida costos y sugerencias anteriores, incluidos los resultados de una solicitud que todavía estaba en curso. Recalcular consulta nuevamente el motor; editar sólo la contribución o el redondeo reutiliza los costos vigentes.

«Limpiar valores» permite elegir la vista filtrada (todas sus páginas) o toda la matriz de hojas/CAD. Deja precios pendientes (`null`, no gratuitos), incluidos ceros cargados, y retira simulaciones y referencias personalizadas de ese alcance. Conserva combinaciones, rangos, la otra matriz y versiones publicadas. «Deshacer limpieza» recupera los precios mientras no se hayan editado de nuevo; los costos se recalculan. La operación no guarda ni publica automáticamente. El flujo es limpiar, calcular, revisar, aplicar al borrador, guardar y publicar cuando corresponda.

Las cotizaciones anteriores al costo derivado redondeaban el papel al pliego completo y producían saltos unitarios, incluso sin setup. Las nuevas cotizaciones de Centro de copiado asignan sólo el papel utilizado y conservan las hojas restantes como inventario, según el circuito siguiente. Los snapshots históricos no se reescriben.

Las sugerencias de una misma combinación se ordenan para que el precio unitario no aumente con la cantidad: cada tramo anterior se eleva al mayor precio sugerido posterior cuando hace falta. No se rebajan sugerencias debajo del objetivo; los tramos ajustados pueden tener contribución superior a la pedida y se identifican en la tabla. Se requieren simulaciones válidas de todos sus tramos; un error deja esa combinación sin propuesta, sin impedir las restantes. Rangos propios, papeles, colores y caras se procesan por separado. La contribución se comprueba para la cantidad de referencia de cada celda, no garantiza todas las cantidades interiores del tramo.

Aplicar «Sólo vacíos» conserva los precios ya cargados, por lo que una fila mezclada con precios manuales puede requerir revisión. Para reemplazar una fila completa, limpiar su alcance o elegir «También cargados». Se mantiene la advertencia sobre fronteras que reducen el total del pedido.

Esta corrección se desarrolla en `codex/recalculo-tarifarios`, dependiente de `codex/copiado-contribucion` en `4e025ea23`, aún sin integrar a `main`.


Validado localmente el 13/10/2026: 61 pruebas de sugerencias, simulación y editor, tipos del flujo afectado y lint. En navegador se verificó setup desactivado, limpieza de una vista A4 en ambas caras, recuperación exacta con deshacer, regeneración y aplicación de 22 precios al borrador sin aumentos unitarios por volumen ni errores de consola. Se descartaron los cambios de prueba y se comprobó que los precios guardados quedaron intactos. Sin publicación ni despliegue.


## Papel comprado en otro formato

Centro de copiado obtiene el rendimiento geométrico del mismo conversor de sustrato/pliego del catálogo. El costo del papel es `hojas necesarias × precio por hoja de origen / rendimiento`. Se incluyen las hojas enteras adicionales de merma operativa configurada. La regla se habilita sólo para la plantilla de copiado verificada por el servidor; los demás productos conservan su política de costeo.

Ejemplo ficticio: opalina de 650 × 950 mm a $360 rinde nueve A4 y cuesta $40 por A4. Para 1, 5 y 10 A4 el papel cuesta $40, $200 y $400. El taller necesita 1, 1 y 2 pliegos completos y obtiene 8, 4 y 8 A4 sobrantes. Un SRA3 de 325 × 475 mm a $80 rinde dos A4: para esas cantidades se retiran 1, 3 y 5 hojas y sobran 1, 1 y 0 A4. El rendimiento usa rotación y grilla de corte; no valúa como hojas completas las tiras que quedan fuera de esa grilla.

La cotización congela el plan de corte. Materiales de la OT agrupa los documentos del mismo papel y tamaño antes de redondear el stock necesario. Cotizar y reservar no cortan papel ni cambian existencias. **Registrar consumo** retira los pliegos enteros reservados y devuelve el sobrante a una variante del mismo papel, identificada como A4 cortado (o el tamaño correspondiente), en la misma ubicación. La devolución y el consumo ocurren en una única transacción con la idempotencia habitual. El costo promedio del sobrante es el costo promedio real del pliego dividido por el rendimiento, incluso cuando el stock no tiene valoración. No se acumulan fracciones que aparenten formar nuevos pliegos enteros.

Los consumos parciales devuelven el sobrante al completar el último pliego de cada plan. No se permite modificar un plan ya consumido ni ajustar manualmente sus cantidades; se corrigen las hojas del pedido antes de producir. Si cambian las medidas del material, la operación pide revisión y revierte todos sus movimientos.

Las nuevas cargas priorizan hojas ya cortadas cuando su stock libre alcanza para todos los documentos de ese papel y tamaño. Si no alcanza, usan el formato de origen; esta etapa no mezcla remanentes parciales con nuevos pliegos en una misma combinación. El cálculo de stock descuenta las reservas existentes. Las revisiones de una OT conservan la variante originalmente cotizada para no sustituir el papel ya comprometido. La referencia de precio del papel cortado sigue el valor vigente de su origen; su costo promedio histórico en stock se conserva. Tarifarios siempre calcula la reposición desde el papel de compra, sin depender del saldo circunstancial de sobrantes.

Validación local del 13/10/2026: pruebas de 1, 5 y 10 A4, proyección conjunta de documentos, consumos parciales, reutilización, dos consumos concurrentes, reintentos idempotentes, valoración cero y reversión por cambio de medidas. Las simulaciones locales con setup desactivado verifican el mismo costo variable y control de contribución en Tarifarios y en el cálculo comercial de la OT. Los precios existentes siguen sin cambiar hasta aplicar y publicar sugerencias.

También se comprobó en Chrome el detalle de Tarifarios con ambos papeles y las tres cantidades: costo unitario estable y contribución del 40% al probar los sugeridos redondeados a centavos. Se descartaron las ediciones temporales. La selección de sobrantes sólo considera ubicaciones y almacenes activos, descuenta reservas e incluye la merma del papel en hojas enteras. Las pruebas de interfaz verifican la explicación del corte y el sobrante antes de confirmar el consumo.

Rama `codex/copiado-papel-derivado`, basada en `origin/main` y dependiente de `codex/copiado-staging` (PR #76). Sin migraciones ni despliegue a staging o producción.
