# Exhibidor: importación DXF y registro entre impresión y láser

Validado localmente el 6 de septiembre de 2026 con `prueba nesting_estantex200.dxf`
y el producto **Exhibidor de carton corrugado**.

## Contorno que no debía fabricarse

El archivo contiene una SPLINE en `GRAFICA` (entidad `7B`) y un rectángulo
LWPOLYLINE en `CORTE_2` (entidad `7D`). La tabla LAYER declara `flags = 1` para
`CORTE_2`: está congelada. La biblioteca `dxf` incluía sus puntos aunque esa
capa estuviera oculta en el CAD.

La importación ahora excluye capas congeladas y apagadas antes de calcular la
caja del diseño. Informa cuáles omitió. Una capa solamente bloqueada se sigue
importando; el bloqueo no equivale a ocultarla. Se conserva la unión de
entidades LINE de una misma capa incluso cuando el DXF no tiene tabla LAYER.

Referencia: [LAYER en la especificación DXF de Autodesk](https://help.autodesk.com/cloudhelp/2018/ENU/AutoCAD-DXF/files/GUID-D94802B0-8BE8-4AC9-8054-17197688AFDB.htm).

## Medidas

El archivo declara `$INSUNITS = 0`: no informa una unidad física. `$MEASUREMENT`
no permite deducir una escala precisa. El importador conserva esa incertidumbre
y ofrece elegir la unidad o ingresar una medida final conocida.

| Geometría | Ancho | Alto |
| --- | ---: | ---: |
| Incluyendo el rectángulo oculto, en unidades del archivo | 462,34349 | 499,43621 |
| Sólo el contorno visible, en unidades del archivo | 293,06512 | 499,43621 |
| Contorno visible interpretado en puntos, convertido a mm | 103,38686 | 176,19000 |

El usuario indicó aproximadamente 103 × 176 mm. Por esa correspondencia se
eligieron puntos tipográficos para esta prueba (25,4 / 72 mm por punto). Es una
inferencia a partir de la medida conocida, no una unidad declarada en el DXF.
No se aplica ese factor automáticamente a otros archivos sin unidades.

Los DXF que sí declaran una unidad compatible siguen cargando automáticamente
sus dimensiones físicas. El selector escala siempre desde las coordenadas
originales para evitar conversiones acumulativas al cambiar de unidad.

Referencia: [INSUNITS en Autodesk](https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-A58A87BB-482B-4042-A00A-EEF55A2B4FD8.htm).

## Impresión y corte

La receta recibe la fuente `geometriasVectoriales.principal` en el componente
`Corrugado plastico`. El láser hereda el sustrato de impresión. Antes no
ejecutaba el nesting porque `usarDisenoVectorial` no estaba activado en ese paso:
se confundía habilitar otra carga comercial con recibir geometría ya cargada.

El motor y el dispatcher ahora reconocen la geometría recibida por las familias
de corte vectorial. El láser usa el layout de impresión existente: conserva
placa, escala, posiciones y giros. Continúa verificando material y área de
máquina; no vuelve a acomodar independientemente las piezas impresas.

`piezas_cortadas` publica la cantidad de piezas, sin confundirla con la cantidad
de placas. El material se consume en impresión y no se duplica en el láser.

## Comprobaciones realizadas

La configuración actual multiplica por cuatro las piezas del componente y usa
el material llamado `Corrugado plastico`, aunque el nombre comercial del padre
dice cartón. Se respetó esa receta publicada.

| Cantidad comercial | Piezas físicas | Placas de 860 × 564 mm | Registro impresión/corte |
| --- | ---: | ---: | --- |
| 1 | 4 | 1 | Mismas coordenadas y rotaciones |
| 50 | 200 | 9 | Mismas coordenadas y rotaciones en todas las placas |

Actualización posterior: el [patrón de filas alternadas](exhibidor-patron-repetido.md)
mejora esta misma prueba a **25 piezas por placa y 8 placas para 200 piezas**,
conservando dimensiones, márgenes y registro. La tabla anterior documenta el
resultado rectangular previo a esa mejora.

Se verificaron los resultados reales de la cola de cotización y ambas pestañas
de producción en Chrome. El SVG importado contiene una sola pieza visible.
La cotización de una unidad resultó en $50.006 con impuestos según los costos
y la receta locales de esta prueba. No se emitió una orden.

Regresiones automatizadas: DXF real y capas visibles/congeladas/apagadas/
bloqueadas, conversión de unidades, selección de nesting con vector heredado,
registro con placa rotada en la máquina y cantidad de piezas entregadas al
paso siguiente. TypeScript de frontend y API sin errores.
