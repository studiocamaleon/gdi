# Varios archivos vectoriales al cotizar productos simples

## Comportamiento

El cotizador de un producto simple con corte vectorial permite seleccionar varios SVG y DXF juntos. Cada archivo se interpreta por separado: contorno exterior para nesting, unidades y capas conservadas con sus operaciones. Comparte material y procesos con los otros diseños del producto y tiene nombre y cantidad por producto propios.

La cantidad de productos multiplica cada diseño. Cinco productos con un frente y dos soportes generan cinco frentes y diez soportes. Los m² y recorridos se derivan de esas quince piezas; no se ingresan como cantidad de productos.

Se admiten hasta treinta diseños, archivos de hasta 512 KB y cantidades por diseño de 1 a 10.000. Si un archivo falla, los ya incorporados se conservan y se puede continuar con los archivos pendientes. El cálculo espera a que termine la interpretación de la selección.

## Contrato y compatibilidad

- Se usa `jobContext.disenosVectoriales`, ya soportado por el motor, también en la raíz del producto simple. No se crean componentes artificiales en la receta.
- Las referencias de geometría se guardan sin alterar la receta del catálogo. El permiso comercial habilita la interpretación de sus archivos, conservando las verificaciones de tenant, producto y archivo.
- Se mantienen los diseños predeterminados y sus restricciones, incluyendo los identificadores de las fuentes requeridas que todavía no tienen archivo.
- Se descartan las medidas rectangulares residuales antes de enviar una colección. El motor deriva áreas, perímetros y demanda desde las fuentes.
- Los SVG históricos sin procedencia se mantienen al editar. Los archivos nuevos guardan su interpretación y las capas del original.
- Hilo caliente conserva su editor específico de segmentación y encastres.
- El plan del cotizador incluye las piezas del producto raíz y conserva las referencias para exportar sus capas.

## Validación

- Navegador, producto **Acrilico sin impresion con corte laser**: selección múltiple de SVG y DXF, confirmación secuencial, incorporación de cuatro diseños, eliminación individual y edición de cantidades.
- Caso de dos diseños: frente 100 × 60 mm, soporte 80 × 40 mm, cantidades 1 y 2 por producto; cinco productos resultan en quince piezas, una placa y 0,062 m².
- El nesting muestra la capa `GUIA_SOPORTE` en las diez copias. La exportación DXF desde el plan responde HTTP 201.
- Guardado del ítem en borrador y reapertura: conserva ambos archivos, cantidades, medidas y capas. No se emitió la OT de prueba del navegador.
- Integración PostgreSQL con rollback: colección SVG + DXF → costos de corte completo, parcial y hendido → cotización guardada → emisión y ejecución de OT, conservando el snapshot ante cambios posteriores de maquinaria.
- Regresiones de transporte de fuentes, exportación CAD, validación de cantidades, planes y SVG históricos; TypeScript del frontend, build de API, ESLint de archivos modificados y `css:guard`.

El worker local debe iniciarse con el Python que tiene las dependencias de GrafoNest: `OPENNEST_PYTHON=/Users/lucasgomez/gdi-saas/apps/api/.venv-opennest/bin/python`. Usar el Python del sistema sin esas dependencias consume el tiempo de búsqueda y termina con el acomodo de respaldo.
