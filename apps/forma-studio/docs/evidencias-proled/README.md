# Evidencias del relevamiento de Proled

Muestras propias y mediciones obtenidas el **05/09/2026**, usando la interfaz autenticada de Proled 2.430. Ver el [relevamiento completo](../relevamiento-proled.md).

- `muestra-160.svg`: contorno exterior de 160×160 mm y hueco central de 60×60 mm. Se utilizó para P6 y para comparar dos exportaciones L3.
- `recorrido-abierto-200.dxf`: polilínea abierta en L, dos tramos de 100 mm; unidades milimétricas. Se utilizó para generar Neon Flex.
- `prueba-componentes.json`: límites y SHA-256 de los STL de dos ZIP L3 descargados. Sólo se cambió la altura de pared interior de base de 30 a 20 mm; tapa y acrílico son idénticos byte a byte.
- `prueba-neon.json`: dimensiones y cantidad de triángulos del STL Neon Flex descargado, a partir de la trayectoria propia.
- `frente-calado-circulos.json`: medición adicional en Proled 2.431, P2 con R Anton de 160 mm. Círculos de 3 mm y separación de 1,5 mm producen un paso de 4,5 mm entre centros.

Los ZIP originales permanecen en la carpeta Descargas del equipo del relevamiento. Este directorio contiene las entradas propias y resultados de medición; no contiene geometría, imágenes ni código de Proled.

## Condiciones para repetir L3

Fuente SVG `muestra-160.svg`; modelo L3; suelo de base 1,5 mm; pared interior 2 mm; pared de tapa 1,5 mm y altura 40 mm; profundidad de labio 4 mm y espesor 2 mm; acrílico 2 mm; tolerancia acrílico 0,2 mm y general 0,5 mm; despiece 0. Exportar con altura de pared interior 30 y 20 mm, respectivamente. Los nombres y horas de archivo están registrados en el JSON.

Los límites se calcularon recorriendo los vértices de los STL binarios L3, y los registros `vertex` del STL ASCII de neón. Los hashes son SHA-256 del archivo STL completo. No constituyen una prueba de imprimibilidad ni de ajuste mecánico físico.
