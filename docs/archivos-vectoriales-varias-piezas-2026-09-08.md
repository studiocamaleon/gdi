# Archivos SVG y DXF con varias piezas

La importación selecciona las piezas detectadas del archivo, incluidas las que están en distintas capas. Se puede limitar la selección a una capa o conservar la interpretación individual anterior.

Cada silueta se incorpora como una pieza de la colección existente, con su nombre y cantidad por producto. Todos los componentes que heredan el diseño del padre reciben esa colección completa. Se conserva el límite de 30 piezas; nunca se importa un subconjunto silenciosamente.

Los contornos se clasifican por contención dentro de su capa: los huecos son cortes internos, y las islas dentro de un hueco son piezas independientes. Los recorridos de otras capas contenidos en una pieza se conservan con ella. Los recorridos que quedan fuera de las piezas requieren revisión o exclusión explícita.

Las interpretaciones se guardan juntas en una transacción. Cada una referencia el mismo archivo original y conserva sólo sus recorridos de fabricación, con los identificadores excluidos para permitir revisarla después. De esta manera cada posición exporta su pieza y sus capas, sin repetir el archivo completo ni multiplicar los datos geométricos por cada silueta.

En la exportación CAD, corte exterior e interior pertenecen a la misma operación de corte completo: una capa no cambia de nombre sólo porque algunas piezas tengan huecos. Se mantienen las separaciones por definiciones y operaciones incompatibles.

Verificación: detección, cortes internos, islas, cantidades, nesting de ambos materiales y exportación DXF nativa; selección y carga de todas las piezas en el frontend; conservación de interpretaciones anteriores. El archivo `puma-logo.svg` cargado en la cuenta local produjo 7 piezas y 4 cortes internos. Los cuatro DXF recientes de acrílico mantuvieron una pieza por archivo.

Las interpretaciones anteriores conservan su contenido. Para incluir contornos que antes no se seleccionaron, hay que revisar las capas y elegir todas las piezas, o volver a importar el archivo.
