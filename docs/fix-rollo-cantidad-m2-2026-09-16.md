# Consumo de rollo y precio por m²

## Caso reproducido

Producto **Vinilo impreso blanco**, una pieza de 150 × 80 cm, CMYK.
El motor eligió Vinilo Ritrama PM80 de 1,52 m de ancho. El acomodo consume
1 m lineal, incluyendo los márgenes de máquina: **1,52 m² de material**.
La superficie comercial y la que recibe tinta son **1,20 m²**.

Antes, el desglose y el costo mostraban `1 m² × $2.000 = $2.000`.
Después: **`1,52 m² × $2.000 = $3.040`**.
La diferencia de $1.040 se incorpora al costo total y al cálculo del precio
de venta según la configuración del producto.

## Causa y corrección

La fórmula `por_unidad_productiva`, con cantidad calculada por el paso, tomaba
`nesting.cantidadCalculada` (metros lineales) y la etiquetaba con la unidad de
stock/uso del material, sin convertir la cantidad. El precio ya estaba
normalizado a esa unidad; faltaba normalizar el consumo.

El sustrato principal de un nesting de rollo ahora convierte esa longitud
antes de aplicar merma y precio, mediante el conversor compartido de unidades:

- Uso en m²: largo consumido × ancho físico completo del rollo elegido.
- Uso en metros lineales: conserva el largo consumido.
- Uso en rollos: largo consumido / largo total de la presentación.
- Una conversión sin datos suficientes se rechaza como costeo inválido.

Se conserva el mecanismo de cantidad de producción: sus outputs y la geometría
del nesting no se cambian. Las reglas explícitas de base × factor, otros
materiales, placas y consumibles siguen sus cálculos propios.

## Alcance

No era un redondeo ni afectaba a todos los productos. Ocurría al combinar un
nesting en metros lineales con consumo automático del sustrato en otra unidad.
La revisión de las configuraciones también encontró rutas de **Carteleria PVC
con vinilo** e **Iman vehicular** que pueden usar Ritrama PM80 en m². El arreglo
es común al motor, sin modificar esas configuraciones ni sus precios.

Las cotizaciones ya guardadas conservan su snapshot: deben recotizarse para
obtener el desglose y precio corregidos. No se reescriben órdenes históricas.

## Validación

- Reproducción de solo lectura con la configuración real de desarrollo, antes
  y después. Cantidad comercial: 1,20 m²; nesting: 1 m lineal; material: 1,52 m².
- Costo del vinilo: $2.000 → $3.040. Tintas: 6 ml por canal, sin cambios.
- 154 pruebas aprobadas en siete suites: motor completo, rollos, placas/PVC,
  equivalencias, merma operativa, consumibles y nesting compuesto.
- Regresión con los algoritmos shelf, maxrects y secuencial; distintas unidades
  de uso, cantidades fraccionarias, merma adicional y equivalencia incompleta.
- TypeScript de la API sin errores. Backend de desarrollo recargado.
