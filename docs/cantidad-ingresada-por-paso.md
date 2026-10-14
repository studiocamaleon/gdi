# Cantidad ingresada al cotizar por paso

En Tiempo variable se puede elegir **Cantidad ingresada al cotizar** y configurar el nombre del dato y su unidad. El ritmo se expresa en esa misma unidad. Ejemplo: 8 m² por hora, «Superficie a desplotear», unidad «m²».

El vendedor ingresa la cantidad total para ese paso. Es obligatoria y mayor que cero cuando el paso está activo, también si se activa por dependencia. Los pasos opcionales apagados y las condiciones que no se cumplen no la exigen ni la cobran. No se hereda el área del producto si falta el dato. La dificultad conserva su ritmo; preparación, limpieza y otros tiempos configurados siguen sumándose.

Esta fuente calcula el tiempo del paso. No cambia las medidas, el material consumido ni la cantidad comercial del producto. Los materiales del paso conservan sus bases configuradas. Los valores antiguos de tiempo manual u horas fijas no sustituyen este cálculo mientras esté elegida esta fuente.

## Contrato

- Configuración: `paramsPasoJson.productivityQuantitySource = "cantidad_manual"` y `cantidadManual: { etiqueta, unidad }`.
- Entrada: `jobContext.cantidadManual_<configPasoId>`, número finito positivo. La unidad es una etiqueta; no hay conversión implícita de m² a otra unidad.
- Resultado: `pasos[].cantidadManual = { etiqueta, unidad, valor }`, conservado en la trazabilidad de la cotización. La OT conserva ese snapshot y materializa los tiempos estimados como cualquier otro paso.
- El formulario de cotización publica una pregunta numérica con nombre, unidad y clave propia. El cotizador restaura el valor al editar y lo muestra en las especificaciones y el desglose del ítem.
- Los documentos ya emitidos conservan sus snapshots. No requiere migraciones.

## Verificación local con datos ficticios

Caso controlado: ploteo de 12 m², vinilo $2.000/m², tinta $100/m², tarifa de taller $6.000/h, ploteo a 12 m²/h y desploteo a 8 m²/h.

| Paso | Cantidad | Corrida | Tiempo estimado guardado | Costo |
| --- | --- | --- | --- | --- |
| Ploteo | 12 m² | 60 min | 60 min | $31.200, incluye vinilo y tinta |
| Desploteo normal | 5 m² | 37,5 min | 38 min | $3.800 |
| Total | | | 98 min | $35.000 |

Se mantiene el redondeo existente del motor a minutos enteros para el tiempo estimado y su costo. En dificultad alta a 4 m²/h, el desploteo usa 75 minutos y cuesta $7.500, sin modificar el consumo del ploteo.

Las pruebas incluyen campos vacíos e inválidos, decimales, opcionales, arrastre, condiciones, dificultad, restauración del ítem y una OT emitida con servicios reales contra PostgreSQL local de pruebas. La fixture completa se revierte al terminar.
