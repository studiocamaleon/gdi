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
