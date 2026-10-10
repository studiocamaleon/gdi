# Centro de copiado decisiones de oferta y tarifarios

**Estado:** definición funcional en curso, antes de implementar.
**Creado y actualizado:** 10 de octubre de 2026.

Centro de copiado necesita representar la forma de vender de cada gráfica: una
oferta de papeles y tamaños, matrices de precios por cantidad, tipo de impresión,
caras y cobertura, y la posibilidad de cobrar distinto según el canal de compra. La
configuración debe seguir siendo sencilla y accesible desde el módulo.

Este es el registro vivo de ese trabajo. Las decisiones confirmadas provienen
de lo acordado con Lucas; las propuestas y preguntas conservan su estado hasta
resolverlas. Crear este documento no aprueba todavía una implementación.

## Decisiones confirmadas

| Referencia | Decisión | Fecha |
| --- | --- | --- |
| D01 | Cada tenant debe poder generar una matriz que represente su operación, sus rangos de cantidad, papeles y tamaños. | 2026-10-10 |
| D02 | Se debe poder configurar qué tamaños se ofrecen para cada tipo de papel. Las listas generales de papeles y tamaños no alcanzan. | 2026-10-10 |
| D03 | El tipo de impresión forma parte de la matriz: K y CMYK. | 2026-10-10 |
| D04 | Las caras son otro eje de la matriz: debe existir un precio independiente para simple faz y otro para doble faz. | 2026-10-10 |
| D05 | Cada canal de venta puede tener una matriz, si el tenant así lo decide. No se debe exigir una matriz diferente por canal. | 2026-10-10 |
| D06 | La configuración debe seguir siendo fácil y accesible desde Centro de copiado. | 2026-10-10 |
| D07 | El diseño debe contemplar un futuro portal de pedidos desde el celular, con precios que puedan diferir de los de mostrador. | 2026-10-10 |
| D08 | Registrar y resolver las decisiones antes de implementar. | 2026-10-10 |
| D09 | Para impresión en hojas, la unidad se elige por tarifario: hoja física como opción inicial y carilla impresa como alternativa. La sección CAD tiene su propia unidad según D30. | 2026-10-10 |
| D10 | El precio y los tramos usan la misma unidad elegida en el tarifario. Un tramo de 100 en un tarifario por hoja significa 100 hojas físicas, también en doble faz. Resuelve P01 junto con D09. | 2026-10-10 |
| D11 | La acumulación se configura por tarifario: por combinación dentro del pedido como opción inicial y por archivo como alternativa. | 2026-10-10 |
| D12 | La combinación reúne el mismo papel y gramaje, tamaño, K/CMYK, simple/doble faz y tarifario; D27 incorpora la cobertura cuando se cobra diferenciada. Se considera todo el pedido, incluidas distintas cargas de Centro de copiado. Resuelve P02 junto con D11. | 2026-10-10 |
| D13 | El precio unitario del tramo alcanzado se aplica a todas las unidades del grupo comercial. En la alternativa por archivo, se aplica a todas las unidades de cada combinación comercial de ese archivo. La regla vale por hoja o por carilla según el tarifario; no se cobra progresivamente. Resuelve P03; D15 precisa la separación de la última hoja cuando corresponda. | 2026-10-10 |
| D14 | Cada tarifario tiene rangos generales que las combinaciones usan inicialmente. Se pueden definir rangos propios como excepción por combinación. Compartir rangos no implica compartir precios ni acumular volumen entre combinaciones distintas. Resuelve P04. | 2026-10-10 |
| D15 | El tratamiento de la última hoja con una sola cara impresa se configura por tarifario: «Mantener tarifa doble faz» como opción inicial y «Última hoja a simple faz» como alternativa. Se aplica por copia física, también a un archivo de una sola página configurado doble faz. Resuelve P05. | 2026-10-10 |
| D16 | Cada precio de la matriz incluye el papel elegido y la impresión según color y caras. Las terminaciones se cobran aparte cuando se seleccionan, incluidos sus materiales. Aplica a tarifarios por hoja y por carilla. Resuelve los conceptos incluidos de P06; el IVA se define en D17, la preparación en D18 y los mínimos en D19. | 2026-10-10 |
| D17 | La interpretación del precio cargado se elige por tarifario: «IVA incluido» como opción inicial y «Más IVA» como alternativa. Aplica a todas sus combinaciones, incluidas las que tienen rangos propios. Resuelve el IVA dentro de P06; la preparación se define en D18 y los mínimos en D19. | 2026-10-10 |
| D18 | La preparación se configura por tarifario: «Preparación incluida» como opción inicial y «Cargo fijo por pedido» como alternativa, con importe configurable y mostrado por separado. El cargo se aplica una sola vez al conjunto de Centro de copiado del pedido. Resuelve la preparación dentro de P06; los mínimos se definen en D19. | 2026-10-10 |
| D19 | Los mínimos se configuran por tarifario: «Sin mínimo» como opción inicial y «Mínimo de importe por pedido» como alternativa. Se aplica una sola vez sobre impresión más preparación de Centro de copiado; las terminaciones se agregan aparte. Sólo se cobra la diferencia necesaria para alcanzar el mínimo, sin alterar cantidades reales ni tramos. Completa P06 junto con D16 a D18. | 2026-10-10 |
| D20 | El tarifario del canal es la base; el acuerdo del cliente tiene prioridad dentro de su alcance. Los descuentos adicionales son explícitos y sujetos a permisos, sin acumulación automática. El precio manual es una excepción autorizada, con motivo y registro del importe anterior, que reemplaza el importe elegido sin volver a aplicarle el descuento previo. Se respeta el mínimo de D19 después de descuentos o precios manuales. Resuelve P07. | 2026-10-10 |
| D21 | Ante una combinación ofrecida sin precio aplicable, la opción inicial es «Precio pendiente», con bloqueo del cierre. Cada tarifario puede configurar explícitamente un respaldo a otro tarifario compatible o al motor. Si el respaldo tampoco resuelve el precio, permanece pendiente. Se conserva el borrador y se identifica el origen del precio resuelto; el respaldo mantiene las reglas de preparación y mínimos del tarifario activo. Resuelve P08. | 2026-10-10 |
| D22 | Centro de copiado tiene una política general, motor o tarifario predeterminado, que los canales heredan por defecto. Cada canal puede elegir un tarifario activo específico o usar el motor. Todo el pedido usa un canal y una política principal; cambiar el canal de un borrador recalcula Centro de copiado y muestra el impacto antes de confirmar. Los documentos emitidos conservan sus precios. Resuelve P09. | 2026-10-10 |
| D23 | El alcance inicial para crear y actualizar precios incluye generación de la estructura, carga manual, pegado desde Excel, duplicación independiente de tarifarios, sugerencias del motor y ajustes masivos por porcentaje o importe por unidad, con redondeo opcional. Los cambios se preparan en borrador y se revisan antes de aplicarlos y activarlos. La importación de archivos Excel/CSV queda para una segunda etapa. Resuelve el alcance de P10; la vigencia sigue D24. | 2026-10-10 |
| D24 | Las versiones publicadas del tarifario son inmutables y se activan inmediatamente o de forma programada. Las cotizaciones nuevas usan la versión vigente; los borradores anteriores requieren actualización explícita antes de emitir. Se respetan los presupuestos emitidos durante su validez y los importes ya aprobados u órdenes emitidas. Se conserva el histórico y se revisa cualquier cambio de versión entre vista previa y confirmación. Resuelve P11. | 2026-10-10 |
| D25 | Cada tarifario tiene un mínimo de margen configurable. Por debajo se exige autorización con motivo como opción inicial, incluido el margen negativo; el bloqueo estricto es la alternativa. Se evalúa impresión más preparación después de ajustes comerciales y mínimo de importe, con terminaciones aparte. No se elevan automáticamente los precios de la matriz. El margen no verificable requiere revisión y las aprobaciones corresponden al cálculo revisado. Se respetan los compromisos de D24. Resuelve P12. | 2026-10-10 |
| D26 | Los precios diferenciados por cobertura forman parte del alcance inicial. Su configuración por tarifario y el efecto sobre la acumulación de volumen se completan en D27. | 2026-10-10 |
| D27 | Cada tarifario puede usar «Precio único para todas las coberturas» como opción inicial o «Precios por cobertura», ambas disponibles desde la primera entrega. En la segunda modalidad los importes por nivel son independientes y la cobertura separa la acumulación de volumen. Con precio único se comparte el grupo comercial y se conserva el costeo por cobertura de cada archivo. Resuelve P13 junto con D26. | 2026-10-10 |
| D28 | El alcance inicial incluye simular con el motor los costos de todas las celdas de las matrices, para todas las combinaciones ofrecidas y tramos, incluso antes de cargar precios de venta. La matriz debe permitir comparar costos, precios y márgenes para decidir los importes comerciales. Cada simulación identifica sus cantidades y supuestos; no modifica automáticamente precios ni garantiza el margen de todo pedido posible. Amplía D23. | 2026-10-10 |
| D29 | Los tomos se integran desde el alcance inicial: su impresión se calcula con la matriz y las terminaciones se agregan aparte según ejemplares y materiales. Los juegos determinan las copias efectivas de los archivos. Se conservan las reglas de acumulación del tarifario, preparación y mínimo por pedido, las reglas físicas de doble faz y los costos reales de preparación y armado. Resuelve tomos y terminaciones de P14; el alcance y las unidades CAD se definen en D30. | 2026-10-10 |
| D30 | CAD forma parte del alcance inicial con una sección propia dentro del tarifario. Ofrece precio por plano y formato como opción inicial, y por m² o metro lineal (ML) como alternativas configurables. ML es un requisito obligatorio desde la primera entrega y puede quedar guardado como modo habitual del tarifario. Precio y tramos usan la misma unidad CAD, sin acumular hojas. Se mantiene una política principal por pedido, preparación y mínimo únicos, y simulación de costos de todas las celdas. Las medidas personalizadas y la acumulación CAD continúan en P14. | 2026-10-10 |

**Simple faz y doble faz tienen precios propios.** La tarifa doble faz no debe
quedar obligatoriamente calculada como dos veces la tarifa simple faz. Una futura
ayuda para completar celdas podrá proponer valores, pero debe permitir editar
cada precio.

### Unidad del precio y de los tramos

**Confirmado en D09 y D10:** para impresión en hojas, cada tarifario permite
elegir entre hoja física y carilla impresa. La opción inicial es por hoja
física; esa misma unidad expresa el precio de cada celda y los límites de los
tramos. La elección pertenece al tarifario y debe mostrarse al cargar y
consultar sus precios.

La sección CAD elige su unidad por separado según D30. Un mismo tarifario puede
cotizar documentos por hoja y planos CAD por ML, conservando la política
principal del pedido sin mezclar sus cantidades para determinar tramos.

En un tarifario por hoja, simple faz y doble faz tienen precios propios por hoja
física. En uno por carilla, tienen precios propios por carilla impresa. La
alternativa por carilla conserva el eje de caras confirmado en D04.

Ejemplo ficticio de un archivo con 20 páginas seleccionadas y 3 copias, a una
página por cara:

| Modalidad | Hojas físicas | Carillas impresas | Cantidad para un tarifario por hoja | Cantidad para uno por carilla |
| --- | --- | --- | --- | --- |
| Simple faz | 60 | 60 | 60 | 60 |
| Doble faz | 30 | 60 | 30 | 60 |

Cada copia comienza en un frente. El conteo incluye las copias y sólo las páginas
seleccionadas para imprimir. «100 doble faz» en el tarifario inicial significa
100 hojas físicas, con hasta 200 caras impresas.

P01 queda resuelto. El cobro de la última hoja con una sola cara impresa sigue
D15. Mezclar una unidad para el precio y otra para los tramos no forma parte de
la modalidad inicial acordada.

### Acumulación del volumen entre archivos

**Confirmado en D11 y D12:** la opción inicial suma las unidades de los archivos
que comparten papel y gramaje, tamaño, tipo de impresión, caras y tarifario
dentro del mismo pedido. Cada archivo conserva su cantidad; el volumen del
grupo determina el tramo comercial. Simple y doble faz acumulan por separado,
igual que K y CMYK. La unidad de acumulación sigue D09 y D10.

Según D26 y D27, la cobertura también separa los grupos cuando el tarifario
cobra precios diferenciados por nivel. Con precio único para todas las
coberturas, no separa la acumulación comercial, aunque cada archivo conserva
su costeo. Los ejemplos de esta sección comparan archivos con la misma cobertura.

Como alternativa por tarifario, el tenant puede elegir «Por archivo». En ese
modo cada archivo determina su tramo con sus propias unidades, incluidas sus
copias o juegos efectivos, sin sumar las de otros archivos. Si D15 reclasifica
la última hoja como simple faz, las partes simple y doble de ese archivo buscan
sus tramos por separado.

Ejemplo ficticio con A4, Obra 80 g, simple faz y el mismo tarifario por hoja. Las
cantidades ya incluyen las copias:

| Archivo | Hojas físicas | Impresión | Volumen por combinación | Volumen por archivo |
| --- | --- | --- | --- | --- |
| A | 60 | K | 110 | 60 |
| B | 50 | K | 110 | 50 |
| C | 10 | CMYK | 10 | 10 |

El alcance incluye las distintas aperturas y cargas de Centro de copiado del
pedido actual. En un borrador, agregar, quitar o modificar documentos debe
recalcular los grupos afectados. No se acumulan pedidos anteriores del cliente.
El tratamiento de versiones y documentos emitidos sigue D24.

La acumulación es comercial: no une originales ni exige agruparlos en un tomo.
Los archivos mantienen sus instrucciones de impresión. La preparación sigue
D18; las terminaciones se cobran aparte según D16 y su integración con tomos
sigue D29. P02 queda resuelto. Sumar todas las combinaciones indistintamente
no forma parte de las modalidades
acordadas.

### Aplicación del precio del tramo

**Confirmado en D13:** se elige el tramo usando la cantidad determinada por D09
a D12, con la clasificación de caras de D15 y la cobertura de D27, y se aplica
su precio unitario a todas las unidades de ese grupo. Cada parte del archivo
se cobra por su propia cantidad multiplicada por el precio de su grupo. En la
modalidad «Por archivo», cada combinación comercial busca el tramo con su
cantidad dentro de ese archivo.

Ejemplo ficticio de una combinación con tarifa por hoja:

| Tramo | Precio por hoja |
| --- | --- |
| 1 a 99 hojas | $100 |
| 100 hojas o más | $80 |

Un grupo de 120 hojas se cobra a $80 por hoja: **120 × $80 = $9.600**. Si lo
forman dos archivos de 60 hojas, cada uno aporta $4.800. La regla también se
aplica a todas las carillas cuando esa sea la unidad del tarifario. No se cobra
una parte a la tarifa anterior y otra a la siguiente.

Esta modalidad puede producir descensos del total al cambiar de tramo. En el
ejemplo, 99 hojas cuestan $9.900, 100 cuestan $8.000 y 101 cuestan $8.080. P03
queda resuelto con esos resultados; no se acordó una corrección automática de
los saltos. D23 incorpora el aviso de esos descensos al revisar actualizaciones.
Los ejemplos muestran la aplicación de la tarifa, que incluye papel
e impresión según D16. El IVA sigue D17, la preparación D18 y los mínimos D19.

### Rangos generales y excepciones por combinación

**Confirmado en D14:** cada tarifario define unos rangos generales y las
combinaciones los usan inicialmente. Cuando una combinación necesita límites
diferentes, puede usar sus propios rangos. La unidad sigue siendo la elegida
para la sección de impresión en hojas según D09 y D10; la sección CAD utiliza
la unidad propia de D30. Sus rangos se expresan en esa unidad y no reutilizan
automáticamente los límites definidos para hojas o carillas.

Ejemplo ficticio de un tarifario por hoja:

| Combinación | Rangos en hojas | Origen de los rangos |
| --- | --- | --- |
| Obra 80 g, A4, K, simple faz | 1–49 / 50–199 / 200 o más | Generales del tarifario |
| Obra 80 g, A4, K, doble faz | 1–49 / 50–199 / 200 o más | Generales del tarifario |
| Obra 80 g, A3, CMYK, simple faz | 1–19 / 20–99 / 100 o más | Propios de la combinación |

Cada combinación conserva sus precios independientes, incluso si comparte los
límites con otras. La acumulación sigue D11 y D12: tener los mismos rangos no
une los grupos comerciales.

Las combinaciones con rangos propios conservan sus límites al modificar los
generales; las que usan los generales siguen esa definición. P04 queda resuelto.
La edición de límites y la carga de precios afectados deben considerarse juntas
para que el tarifario mantenga una interpretación clara.

### Última hoja con una sola cara impresa

**Confirmado en D15:** el tarifario usa inicialmente «Mantener tarifa doble faz».
Todas las hojas del trabajo conservan esa clasificación comercial, incluida la
última con el dorso vacío. En un tarifario por carilla sólo se cuentan las caras
impresas; el dorso vacío no agrega una unidad.

La alternativa «Última hoja a simple faz» reclasifica comercialmente esa hoja
como simple. Se aplica antes de acumular volumen y buscar los tramos: las partes
simple y doble usan sus propias combinaciones, rangos y precios. En el modo por
combinación pueden acumular con otros archivos compatibles; en el modo por
archivo se mantienen separadas dentro de cada archivo, sin sumar otros.

Ejemplo ficticio de 11 páginas seleccionadas y 3 copias doble faz, cada una
iniciada en una hoja nueva: 18 hojas físicas, de las cuales 15 están impresas de
ambos lados y 3 de un solo lado; en total, 33 carillas impresas.

| Política del tarifario | Clasificación por hoja | Clasificación por carilla |
| --- | --- | --- |
| Mantener tarifa doble faz | 18 doble faz | 33 doble faz |
| Última hoja a simple faz | 15 doble faz y 3 simple faz | 30 doble faz y 3 simple faz |

Con precios ficticios por hoja de $160 doble y $100 simple para los tramos
aplicables, los importes son $2.880 y $2.700 respectivamente. Reclasificar no
garantiza un descuento: puede cambiar los tramos y, por carilla, la tarifa simple
puede ser mayor que la doble. Se aplica el precio propio de cada combinación;
no se divide automáticamente la tarifa doble por dos.

La política se evalúa por cada copia física según el armado efectivo. Acumular
volumen comercial no une originales ni permite reutilizar dorsos vacíos entre
archivos. Un archivo de una sola página configurado doble faz conserva la tarifa
doble en la opción inicial y pasa a simple en la alternativa. La reclasificación
afecta al precio; no cambia las instrucciones físicas de impresión ni el consumo
real de papel. La integración del armado de tomos sigue D29 y
la ausencia de una tarifa simple necesaria se resuelve según D21.

### Conceptos incluidos en el precio de la matriz

**Confirmado en D16:** la tarifa cubre el papel elegido y la impresión con el
tamaño, tipo de impresión y caras de la combinación. El importe se expresa por
hoja o por carilla según el tarifario; en ambos casos contempla el papel
necesario para producir el trabajo.

| Concepto | Tratamiento comercial |
| --- | --- |
| Papel elegido | Incluido en la tarifa |
| Impresión según color y caras | Incluida en la tarifa |
| Preparación | Incluida inicialmente; cargo fijo por pedido como alternativa según D18 |
| Anillado y sus materiales | Se cobra aparte cuando se selecciona |
| Otras terminaciones que se incorporen | Se cobran aparte cuando se seleccionan |

El costo de papel e impresión se conserva para conocer la rentabilidad, pero no
se vuelve a sumar al precio comercial de la matriz. Tampoco se duplican los
materiales de una terminación al agregar su importe. La visualización del
desglose no cambia qué conceptos están incluidos.

P06 queda resuelto en D16 a D19. El IVA se define en D17, la preparación en D18
y los mínimos en D19. Las terminaciones existentes se integran con los tomos
según D29, conservando su cálculo separado de la impresión.

### IVA en los precios del tarifario

**Confirmado en D17:** cada tarifario permite elegir cómo se interpreta el
importe cargado en sus celdas:

- **IVA incluido**, como opción inicial: el importe ya contiene el IVA que
  corresponda. No se vuelve a sumar al cobrar.
- **Más IVA**, como alternativa: el importe es neto y se agrega el IVA que
  corresponda para obtener el precio final.

La elección es común a todas las combinaciones y tramos del tarifario, también
a las excepciones de rangos de D14, y se debe mostrar al cargar y consultar
precios. Aplica tanto a precios por hoja como por carilla.

Ejemplo ficticio con un precio cargado de $121 por unidad y una alícuota
hipotética del 21 %, sólo para ilustrar el cálculo:

| Modalidad | Precio neto | IVA | Precio final por unidad |
| --- | --- | --- | --- |
| IVA incluido | $100 | $21 | $121 |
| Más IVA | $121 | $25,41 | $146,41 |

Esta decisión define cómo se carga el precio; no fija una alícuota ni determina
si corresponde aplicar IVA. Eso debe respetar la configuración fiscal vigente
del sistema. Las terminaciones mantienen su tratamiento fiscal correspondiente
y se agregan por separado según D16, sin duplicar el impuesto.

La revisión de cambios de D23 debe mostrar el impacto de editar un tarifario
con precios cargados. La conversión de importes al cambiar la modalidad de IVA
requiere precisión en el diseño de edición; no se debe tratar como un simple
cambio de etiqueta. El tratamiento de cotizaciones existentes sigue D24.

### Preparación incluida o cargo fijo por pedido

**Confirmado en D18:** cada tarifario permite elegir entre:

- **Preparación incluida**, como opción inicial: no se agrega un cargo separado
  al precio de la matriz.
- **Cargo fijo por pedido**, como alternativa: el tarifario define un importe
  que se agrega una sola vez al conjunto de Centro de copiado del pedido y se
  muestra por separado.

La regla es independiente de la acumulación por combinación o por archivo.
Agregar archivos en distintas aperturas del módulo, cambiar las combinaciones
o aumentar las copias no multiplica el cargo. Reclasificar comercialmente la
última hoja como simple faz según D15 tampoco genera otra preparación.

Ejemplo ficticio: un pedido contiene tres archivos, dos A4 K y uno A4 CMYK,
todos con el mismo tarifario. Con preparación incluida, el adicional es $0.
Con un cargo fijo final de $500 por pedido, el adicional total es $500, aunque
los archivos se carguen por separado o se impriman varias copias.

El costo operativo de preparar el trabajo debe conservarse para medir la
rentabilidad, incluso cuando no se cobre aparte. El cargo comercial fijo no
define cuántas preparaciones físicas necesita producción. La integración deberá
separar ambos conceptos: hoy el indicador de cobro también permite omitir los
tiempos de preparación y limpieza del costo del motor.

Cobrar por archivo o por configuración de impresión no forma parte de las
modalidades acordadas. D22 establece una única política principal por pedido:
cuando usa un tarifario, éste determina el cargo único de preparación. Un
tarifario de respaldo no agrega otro cargo. La preparación integra el importe
que se compara con el mínimo según D19.

### Mínimo de importe por pedido

**Confirmado en D19:** cada tarifario permite elegir entre:

- **Sin mínimo**, como opción inicial: se cobra el importe calculado sin agregar
  un ajuste por mínimo.
- **Mínimo de importe por pedido**, como alternativa: se define un piso de cobro
  para impresión más preparación de Centro de copiado.

El mínimo se evalúa una sola vez para el conjunto de Centro de copiado del
pedido, aunque haya varios archivos, combinaciones o cargas del módulo. Si la
suma de impresión y preparación no alcanza el mínimo, se agrega únicamente la
diferencia, identificada como «Ajuste por importe mínimo». Si ya lo alcanza o
supera, no hay ajuste.

Las terminaciones se suman después: su importe no permite alcanzar el mínimo
de impresión y preparación. Tampoco se incluyen otros productos del pedido en
esa comparación. El mínimo no exige imprimir más copias ni cambia las hojas,
carillas, consumo de papel o cantidades usadas para buscar los tramos.

Ejemplo ficticio con importes finales: 3 hojas a $100 suman $300 de impresión.
La preparación por pedido cuesta $500; impresión más preparación suman $800.

| Modalidad | Impresión más preparación | Ajuste por mínimo | Total antes de terminaciones |
| --- | --- | --- | --- |
| Sin mínimo | $800 | $0 | $800 |
| Mínimo de $1.000 | $800 | $200 | $1.000 |

Si se agrega un anillado de $1.200, los totales son $2.000 y $2.200,
respectivamente. Si impresión más preparación ya suman $1.500, un mínimo de
$1.000 no agrega ningún ajuste. Las 3 hojas reales del primer ejemplo se
conservan en producción y en el cálculo del tramo.

La comparación debe usar importes en la misma moneda y sobre la misma base de
IVA, respetando D17 y la configuración fiscal del sistema. El mínimo se respeta
después de descuentos y precios manuales según D20. El tarifario principal
del pedido determina el mínimo único según D22; consultar un respaldo no
incorpora el mínimo de esa otra fuente.

El mínimo de hojas facturables por documento existente no es una modalidad del
nuevo esquema acordado. Su migración y la habilitación de los tarifarios se
resolverán en P15, sin cambiar automáticamente la operación de tenants actuales.

### Prioridad de precios y descuentos

**Confirmado en D20:** el precio se resuelve con este orden:

1. El tarifario del canal determina el precio base por combinación y tramo.
2. Un acuerdo aplicable del cliente reemplaza ese precio dentro de su alcance.
   Fuera de las combinaciones y canales cubiertos, se usa el tarifario del canal.
3. Un descuento adicional se aplica explícitamente sobre el precio resultante,
   con los permisos correspondientes. El precio por volumen ya está incorporado
   en el tramo; no se repite como un descuento adicional.
4. Se agrega la preparación y se comprueba el mínimo sobre impresión más
   preparación, considerando los descuentos o precios manuales aplicados.
5. Las terminaciones se agregan aparte según D16 y D19.

No se elige automáticamente el menor precio entre tarifario y acuerdo. El
alcance del acuerdo debe ser explícito: por ejemplo, un cliente con A4 K a $90
sólo en mostrador paga esa tarifa allí y puede usar los $80 del tarifario online.
Si el acuerdo de $90 cubre ambos canales, prevalece en los dos.

Ejemplo ficticio con preparación incluida, sin mínimo y un descuento aplicado
sólo a impresión; los importes mostrados son finales:

| Paso | Importe |
| --- | --- |
| Tarifario del canal para 100 hojas a $100 | $10.000 |
| Acuerdo aplicable del cliente a $90 por hoja | $9.000 |
| Descuento adicional autorizado del 10 % | $8.100 |

Tener un precio especial no impide un descuento adicional, pero éste debe ser
explícito. Se admite un único descuento efectivo por concepto, porcentual o por
importe; uno nuevo reemplaza al anterior. No se acumulan descuentos
automáticamente ni se modifica el costo de producción al aplicarlos.

El precio manual requiere permiso y motivo. Reemplaza el importe del concepto
elegido y conserva el valor anterior para explicar el cambio; el descuento
previo de ese concepto no se vuelve a aplicar sobre el importe manual. Deben
quedar registrados el origen del precio, el ajuste, su motivo y quién lo realizó.

Tanto los descuentos como los precios manuales respetan el mínimo del tarifario.
Si impresión más preparación quedan en $900 y el mínimo es $1.000, se agrega un
ajuste de $100 y se cobran $1.000 antes de terminaciones. No se acordó una
excepción que permita ignorar ese mínimo.

Los permisos concretos y su implementación se definirán al diseñar el recorrido;
la política ante márgenes insuficientes o negativos sigue D25. D21 define
qué hacer si no se puede obtener un precio, y D24 la conservación o revisión de
estos valores al cambiar una cotización. El cálculo y desglose fiscal deben
seguir D17 y las reglas del sistema, sin duplicar descuentos ni impuestos.

### Combinaciones sin precio y respaldo explícito

**Confirmado en D21:** una combinación no ofrecida no puede seleccionarse para
la venta; un precio manual no modifica la oferta. Una combinación ofrecida puede
tener el precio pendiente para la cantidad y el tramo solicitados.

Cada tarifario permite elegir cómo resolver un precio faltante:

| Política | Comportamiento |
| --- | --- |
| Precio pendiente, opción inicial | Informar la combinación y el tramo sin precio y esperar su resolución. |
| Otro tarifario como respaldo | Consultar el tarifario compatible elegido explícitamente por el tenant e identificarlo como origen del precio. |
| Motor como respaldo | Calcular el precio con el motor e identificar ese origen. |

Si la fuente de respaldo no puede resolver el precio, éste permanece pendiente.
No se busca una combinación parecida ni se toma silenciosamente otro papel,
caras o tramo. Una celda vacía no equivale a $0; ni el descuento ni el mínimo
del pedido pueden reemplazar un precio faltante.

Ejemplo ficticio: el tarifario Online ofrece A3, Ilustración 150 g, CMYK y doble
faz, pero no tiene precio para el tramo 100–199. Ante un pedido de 120 hojas,
sin respaldo se informa «Precio pendiente para esta combinación y tramo».
Con un respaldo configurado y válido, se usa el precio que esa fuente resuelva
y se muestra su origen.

Mientras exista un precio pendiente, se permite conservar el borrador. Los
importes conocidos se muestran como parciales; no se permite confirmar la
venta ni cobrarla como un pedido completo. Para el futuro portal, queda prevista
la posibilidad de conservarlo como solicitud de cotización, sin confirmar una
compra con total incompleto.

Un usuario con los permisos correspondientes puede completar el tarifario o
asignar un precio manual según D20 para resolver un caso puntual. Si un acuerdo
aplicable del cliente ya define un precio válido, se respeta su prioridad y no
queda pendiente por la sola ausencia del precio general. Un descuento que
requiere una base todavía faltante no resuelve esa ausencia.

La misma política se aplica si D15 requiere un precio simple faz para la última
hoja y ese precio falta. El respaldo conserva las reglas del tarifario activo
sobre preparación y mínimos: no importa ni duplica los cargos de la otra fuente.
El precio recibido debe ser compatible con la unidad y el tratamiento de IVA
del cálculo; no se confunde un precio por carilla con uno por hoja, ni un importe
neto con uno final. Las validaciones de compatibilidad se precisarán en el diseño
técnico.

### Elección de la política por canal

**Confirmado en D22:** el tenant define una política general para Centro de
copiado: usar el motor o un tarifario predeterminado. Cada canal tiene estas
opciones:

| Configuración del canal | Resultado |
| --- | --- |
| Usar la política general, opción inicial | Heredar la política configurada para Centro de copiado. |
| Usar un tarifario específico | Aplicar el tarifario activo elegido para ese canal. |
| Usar el motor | Cotizar con el motor, aunque la política general use una matriz. |

Varios canales pueden compartir el mismo tarifario sin duplicarlo. Ejemplo
ficticio con Tarifario General como política general:

| Canal | Configuración | Política efectiva |
| --- | --- | --- |
| Presencial | Usar la política general | Tarifario General |
| WhatsApp | Usar la política general | Tarifario General |
| Web | Usar un tarifario específico | Tarifario Online |
| Correo electrónico | Usar el motor | Motor |

El sistema resuelve automáticamente la política a partir del canal del pedido.
Todo Centro de copiado del pedido usa un único canal y una única política
principal, también para los archivos que se agreguen después. Si una celda usa
un respaldo según D21, éste aporta el precio faltante; la preparación y el
mínimo siguen perteneciendo al tarifario principal.

Si el pedido ya tiene canal, el módulo lo toma. Si falta, se puede preparar la
carga, pero hay que elegirlo antes de obtener una cotización válida. En el futuro
portal, el servidor asigna el canal correspondiente al origen del pedido. El
dispositivo no lo determina: comprar desde un celular en el portal sigue siendo
una compra Web.

Cambiar el canal de un borrador recalcula todo Centro de copiado y muestra el
importe anterior y el nuevo antes de confirmar el cambio. Se vuelven a evaluar
los acuerdos del cliente y se señalan descuentos y precios manuales para revisar
su vigencia en el nuevo canal. Si el recálculo deja un precio pendiente, se aplica
D21 y no se presenta un total parcial como una cotización completa.

Ejemplo ficticio, con preparación incluida y sin mínimo: 100 hojas cuestan
$10.000 en Presencial y $8.000 en Web. Al cambiar el canal del borrador, el
sistema muestra ese efecto sobre el conjunto de Centro de copiado del pedido.

Los documentos emitidos conservan sus precios. La vigencia de versiones y el
tratamiento de cambios posteriores en los tarifarios siguen D24.
La habilitación de estas políticas para tenants actuales conserva P15.

### Creación y actualización de precios

**Confirmado en D23:** el recorrido inicial consiste en generar la estructura,
completar los importes y revisar los cambios antes de aplicarlos.

La estructura se genera a partir de papeles y tamaños ofrecidos, K/CMYK,
simple/doble faz, cobertura según D27 y rangos configurados, incluidas las
excepciones de D14. Las celdas comienzan vacías, como precios pendientes según
D21. Los importes de simple y doble faz conservan su independencia.

Las herramientas iniciales para completar precios se pueden combinar:

| Herramienta | Uso |
| --- | --- |
| Carga manual y pegado desde Excel | Trasladar los precios que el tenant ya utiliza a las celdas de la matriz. |
| Duplicar un tarifario | Crear una copia independiente y ajustar sus valores, por ejemplo Online a partir de General. |
| Simular costos de la matriz completa | Calcular con el motor todas sus celdas y comparar costos, precios y márgenes según D28, incluso si aún no hay precios cargados. |
| Sugerir precios con el motor | Obtener una base calculada que el tenant revisa y puede modificar. |

Actualizar General no modifica automáticamente su copia Online. Duplicar es
distinto del respaldo de D21 y de compartir el mismo tarifario entre canales
según D22.

Las sugerencias del motor usan una cantidad de referencia por tramo: inicialmente
el comienzo del rango, editable dentro de él. Para 50–199 se usan 50 unidades;
para 200+, 200. Son hojas o carillas según D09 y D10. El resultado es un precio
fijo editable, coherente con los conceptos incluidos y el tratamiento de IVA
del tarifario. Un cambio posterior de costos no modifica automáticamente los
precios publicados; se pueden pedir nuevas sugerencias para revisarlos.
La simulación de costos de todas las celdas sigue D28 y está disponible aunque
el tenant prefiera cargar sus precios manualmente en lugar de aceptar sugerencias.

Para actualizar precios se seleccionan celdas y se puede:

- Aumentar o reducir por porcentaje.
- Sumar o restar un importe por unidad.
- Aplicar un redondeo opcional.
- Solicitar nuevas sugerencias del motor para la selección.

Ejemplo ficticio: seleccionar sólo Obra 80 g, CMYK, aumentar el 12 % y redondear
hacia arriba a múltiplos de $10. Una celda de $130 pasa a $145,60 y queda en
$150. Los precios fuera de la selección no cambian.

Antes de aplicar se muestran los valores anteriores, los nuevos y las celdas
afectadas. La revisión señala los precios pendientes, los descensos del total
al cambiar de tramo y los canales que comparten el tarifario. El aviso de
descensos no cambia el cálculo de D13 ni corrige importes automáticamente.
Las nuevas combinaciones y cambios de rangos deben señalar qué precios necesitan
completarse.

Los cambios se preparan en borrador y se revisan antes de activarlos. La vigencia
y el tratamiento de cotizaciones existentes siguen D24. La importación de
archivos Excel/CSV queda fuera del alcance inicial y se abordará en una segunda
etapa; el pegado desde Excel sí forma parte de D23.

### Vigencia de versiones y cotizaciones en curso

**Confirmado en D24:** la versión del tarifario y la validez de un presupuesto
son conceptos distintos. Actualizar el tarifario no modifica el precio de un
presupuesto ya emitido ni acorta su validez.

Cada actualización crea una nueva versión, que se prepara en borrador y se
revisa antes de activar. Una versión publicada conserva sus precios y reglas;
para modificarlos se crea otra. «Activar ahora» es la opción inicial y
«Programar fecha y hora» la alternativa, usando la zona horaria del tenant.
Al entrar en vigencia, la nueva versión reemplaza a la anterior para las
cotizaciones nuevas. Las versiones anteriores permanecen en el historial.

| Situación | Tratamiento acordado |
| --- | --- |
| Cotización nueva | Usar la versión vigente. |
| Borrador con una versión anterior | Conservar lo mostrado, avisar que hay precios nuevos y exigir actualización explícita antes de emitir. |
| Presupuesto emitido y válido | Mantener el precio ofrecido hasta su vencimiento. |
| Presupuesto vencido sin aceptar | Conservar su histórico; para continuar, preparar una nueva revisión con precios vigentes. |
| Presupuesto aprobado u orden emitida | Conservar los importes acordados aunque después cambie el tarifario. |

Se reutiliza la validez del presupuesto que ya configura el tenant, sin agregar
un segundo vencimiento propio de Centro de copiado. La nueva revisión de un
presupuesto conserva la anterior según el recorrido de versiones existente.

Ejemplo ficticio: se emite un presupuesto de $10.000 con siete días de validez.
Al día siguiente entra en vigencia una versión que cotiza el mismo trabajo a
$12.000. Las cotizaciones nuevas usan $12.000; el presupuesto emitido mantiene
$10.000 durante su validez. Un borrador todavía no emitido muestra ambos
importes y requiere revisar la actualización antes de emitir. Los siete días
son ilustrativos, no un nuevo valor predeterminado.

Actualizar un borrador recalcula todo Centro de copiado: cantidades y tramos,
preparación, mínimo y acuerdos aplicables. Los descuentos y precios manuales se
señalan para revisión. No se mezclan versiones al agregar archivos al pedido.
Para conservar un precio anterior en un borrador se puede recurrir al precio
manual autorizado de D20, respetando el mínimo vigente.

Si la versión cambia entre la vista previa y la confirmación, el sistema avisa
y exige revisar el nuevo cálculo. No confirma silenciosamente un importe
diferente del mostrado. Cada cotización conserva la versión, las reglas y los
importes usados, incluidos los provenientes de respaldos, acuerdos del cliente
o ajustes manuales.

El recorrido se integra con las [versiones de presupuestos](presupuestos-versiones-descarte.md)
y la [conversión de presupuestos a órdenes](presupuestos-conversion-ot.md), que
conserva los importes aceptados. No se sobrescriben documentos históricos.

### Márgenes insuficientes o negativos

**Confirmado en D25:** el mínimo de margen es configurable por tarifario.
La opción inicial exige autorización con motivo cuando el resultado queda por
debajo de ese mínimo, también si es negativo. Como alternativa, el tarifario
puede establecer un bloqueo estricto que impida emitir mientras no se alcance
el mínimo. En ambos casos se conserva el borrador y se muestra el problema.
El control no aumenta automáticamente los precios cargados en la matriz.

El mínimo de importe de D19 y el mínimo de margen son controles distintos:
alcanzar el importe mínimo no garantiza rentabilidad. El margen se evalúa sobre
el conjunto de impresión más preparación del pedido, después de acuerdos,
descuentos, precios manuales y ajuste por mínimo. Se considera la venta sin IVA,
los costos de producción y preparación y los cargos aplicables, sin duplicarlos.
Las terminaciones se controlan aparte; su ganancia no compensa una pérdida de
impresión para superar este control.

Para una venta neta positiva, el margen porcentual es la diferencia entre venta
neta y costos y cargos aplicables, dividida por la venta neta, por cien. No debe
confundirse con un porcentaje de recargo sobre el costo.

Ejemplo ficticio con una venta neta de $10.000 y un mínimo de margen del 15 %:

| Costos y cargos | Resultado | Margen y tratamiento |
| --- | --- | --- |
| $8.000 | Quedan $2.000 | 20 %: supera este control. |
| $9.200 | Quedan $800 | 8 %: requiere autorización o queda bloqueado, según la política. |
| $10.500 | Se pierden $500 | −5 %: requiere autorización o queda bloqueado, según la política. |

El 15 % es sólo ilustrativo: no se fija un porcentaje universal. Un permiso para
modificar el precio manualmente no equivale a autorizar una excepción de margen.
La autorización debe identificar al responsable, su motivo y el cálculo
revisado. Si cambia el pedido o los valores de ese cálculo antes de emitir,
se vuelve a evaluar; no se conserva una aprobación para un resultado diferente.

El problema debe mostrarse tanto al revisar el tarifario como al cotizar un
pedido. La revisión de la matriz usa las referencias del cálculo; no garantiza
el margen de todos los trabajos posibles. La cotización evalúa las cantidades
y costos del pedido concreto. Si falta costeo, se indica «Margen no verificable»
y se exige revisión, sin asumir que el costo es cero.

La autorización, cuando corresponda, debe resolverse antes de emitir el
presupuesto o la orden. En el futuro portal, el pedido queda pendiente de
revisión antes de permitir su cierre y pago. Este control no resuelve precios
pendientes de D21 ni habilita combinaciones no ofrecidas.

Los presupuestos emitidos y vigentes y los importes ya aprobados u órdenes
emitidas conservan el tratamiento de D24. Una suba posterior de costos puede
generar una alerta interna, pero no modifica el precio comprometido ni lo
somete retroactivamente a este bloqueo.

### Precios por cobertura

**Confirmado en D26:** el alcance inicial incluye precios diferenciados por
cobertura. La configuración debe permitir representar su efecto comercial
además de conservar su uso para calcular costos y margen.

**Confirmado en D27:** se ofrecen dos modalidades por
tarifario desde la primera entrega: «Precio único para todas las coberturas»
como opción inicial y «Precios por cobertura» como alternativa. La primera
mantiene una celda por combinación y tramo; la segunda permite cargar importes
independientes para los niveles existentes Borrador, Normal y Alta. No se impone
un recargo porcentual entre niveles. Las ayudas de copia y ajuste masivo de D23
permiten facilitar la carga de esos importes.

En la modalidad con precios diferenciados se suma la cobertura a la
combinación comercial de D12: cada nivel acumula su propio volumen y busca su
tramo. Con precio único, la cobertura no separa la acumulación comercial,
pero cada archivo conserva su costeo. La alternativa por archivo de D11
sigue sin sumar unidades de otros archivos.

Ejemplo ficticio: 60 hojas con cobertura Normal y 50 con cobertura Alta,
con el mismo papel, tamaño, color y caras, en acumulación por combinación.
Con precios diferenciados buscan sus tramos con 60 y 50 hojas, respectivamente.
Con precio único buscan el tramo con 110 hojas, manteniendo los costos de
cada archivo. Dos archivos de 60 y 50 hojas con la misma cobertura y los demás
atributos iguales suman 110 en ambas modalidades.

La cobertura se conserva por archivo y debe quedar identificada al explicar
un precio diferenciado. Los rangos propios siguen D14, los acuerdos D20 y las
versiones D24. Si falta un precio para el nivel solicitado, se aplica D21; no se
sustituye por otro nivel de forma implícita. El diseño deberá precisar los
controles de selección y registro, incluida la compatibilidad de los respaldos.
El futuro portal deberá resolver cómo se determina la cobertura antes de
confirmar el precio, sin presuponer un análisis automático del archivo.

### Simulación de costos de todas las matrices

**Confirmado en D28:** desde el alcance inicial, el usuario debe poder simular
con el motor los costos de todas las celdas de cada tarifario. Esto incluye cada
papel y gramaje, tamaño ofrecido, K/CMYK, simple/doble faz, cobertura y tramo,
con sus rangos generales o propios. La simulación está disponible para todas
las matrices del tenant, incluidos los tarifarios específicos de canales.

El recorrido debe permitir calcular la matriz completa y volver a calcular una
selección al revisar precios. También deben poder simularse las celdas vacías:
el costo sirve como referencia para decidir un precio, sin obligar a aceptarlo
desde el motor. Los resultados deben mostrar el costo estimado por unidad y
total del escenario, el precio de venta si existe, y el margen resultante. Un
precio pendiente conserva ese estado; conocer su costo no completa la celda.

Cada resultado usa una cantidad de referencia dentro de su tramo, según D23:
inicialmente el comienzo, editable dentro del rango. Por ejemplo, la celda
50–199 se simula inicialmente con 50 unidades y permite comprobar 100 o 199;
la celda 200+ comienza con 200. Esto cubre todas las celdas de la matriz, sin
presentar una simulación a una cantidad como garantía para todo el tramo.
Las unidades son hojas o carillas en la sección de documentos, o las unidades
CAD elegidas según D30. En CAD también se deben identificar las medidas
y el rollo usados en el escenario, necesarios para convertir las unidades
comerciales en un trabajo que el motor pueda costear.

Los supuestos deben quedar visibles: cantidad, cobertura, caras y composición
del pedido de referencia. El cálculo debe respetar los costos operativos aunque
la preparación esté incluida, y mostrar cómo inciden preparación y mínimo en
el precio total del escenario, una sola vez por pedido. Los costos, cargos y
márgenes se comparan sobre bases coherentes según D17 y D25, sin considerar el
IVA como ganancia. Las terminaciones se mantienen aparte según D16.

En tarifarios con precios diferenciados se simula cada nivel. Con precio único
también deben poder compararse los costos de Borrador, Normal y Alta frente al
mismo precio de venta, para detectar el impacto de la cobertura en el margen.
Cambiar el precio que se está evaluando debe permitir ver el nuevo margen, sin
confundir ese ajuste comercial con un cambio en el costo de producción.

El motor usa la configuración productiva y los costos del tenant; no se crea
una fórmula paralela de costos para las matrices. Se debe identificar cuándo
se calculó cada resultado y con qué referencias. Si falta configuración o el
motor no puede costear una celda, se muestra el motivo sin reemplazarlo por
cero ni presentar su margen como verificado. Una simulación parcial no se
presenta como completa.

Simular no cambia precios cargados, activa versiones ni aprueba excepciones de
margen. Las sugerencias y su aceptación siguen D23, la publicación D24 y los
controles de margen D25. Los costos y márgenes mantienen sus permisos internos;
no se muestran al cliente por el hecho de tener un tarifario online.

### Tomos y terminaciones

**Confirmado en D29:** los tomos forman parte del alcance inicial. La impresión
de sus archivos se calcula con la misma matriz que los documentos sueltos;
las terminaciones se agregan aparte según los ejemplares y materiales que
corresponden. Un tomo agrupa el armado, pero conserva las combinaciones
comerciales de sus archivos.

Los juegos del tomo determinan las copias efectivas de cada archivo. A partir
de ellas se calculan las hojas o carillas y se aplica la clasificación de caras
de D15 antes de buscar los tramos. La acumulación sigue D11, D12 y D27: por
combinación puede sumar documentos compatibles de otros tomos o sueltos del
mismo pedido; por archivo cada original conserva su grupo comercial. Generar
un PDF unificado del tomo no convierte sus originales en un único archivo a
efectos de esa regla comercial.

Ejemplo ficticio: un tomo reúne un archivo de 20 páginas K y otro de 2 páginas
CMYK, ambos A4 y simple faz, con 10 juegos anillados y tarifario por hoja.

| Concepto | Cantidad y tratamiento |
| --- | --- |
| Impresión K | 200 hojas, con la combinación y el tramo que correspondan. |
| Impresión CMYK | 20 hojas, con su propia combinación y tramo. |
| Anillado | 10 anillados, con los materiales correspondientes a cada ejemplar. |

Cada ejemplar contiene 22 hojas en este ejemplo. El cálculo del anillado debe
usar el espesor y los materiales de ese ejemplar, no tratar las 220 hojas del
pedido como un solo libro. La terminación seleccionada para el tomo se cobra
una vez por ejemplar según su cálculo; no se repite por cada archivo incluido.
Las terminaciones existentes conservan su configuración y cálculo separados
de la impresión, incluidos sus materiales, según D16.

La preparación comercial sigue D18 y el mínimo sigue D19: se resuelven una sola
vez sobre impresión más preparación de Centro de copiado en el pedido. Crear
varios tomos no multiplica esos cargos. El motor debe conservar los costos
reales de preparación y armado, aunque el cobro comercial esté incluido o sea
un cargo fijo por pedido. El control de margen sigue D25, con terminaciones
aparte.

Se conserva el armado físico existente: en doble faz cada original comienza
en un frente y mantiene los reversos vacíos necesarios. Las reglas de D15 se
aplican a las últimas hojas correspondientes de cada original y juego. Agrupar
originales no habilita ocupar esos reversos con páginas del siguiente archivo
ni cambia la cantidad real de papel.

La vista previa, el tomo guardado, su edición y el resumen del pedido deben
coincidir y conservar el desglose de impresión, preparación, ajuste por mínimo
y terminaciones, aunque el tomo se muestre como un único renglón. Los planos
CAD tienen el alcance propio de D30 y las reglas restantes de P14.

### Alcance y unidades de planos CAD

**Confirmado en D30:** CAD se integra desde la primera entrega con una sección
propia dentro del tarifario del canal. El tenant elige su modalidad comercial:

| Modalidad | Precio y cantidad para el tramo |
| --- | --- |
| Por plano y formato | Precio por ejemplar del formato correspondiente; el tramo se expresa en cantidad de planos. Es la opción inicial al crear la sección CAD. |
| Por metro cuadrado | Precio por m²; el tramo se expresa en m². |
| Por metro lineal | Precio por ML para el material y ancho de rollo correspondientes; el tramo se expresa en ML. |

**Metro lineal es obligatorio en el alcance inicial.** Debe poder configurarse,
guardarse y utilizarse como modalidad habitual del tarifario. «Por plano y
formato» es sólo el valor inicial al crear la configuración: no sustituye una
elección guardada de ML ni exige volver a elegirla en cada pedido. El ancho de
rollo y el material deben quedar identificados, porque el mismo largo en rollos
de distinto ancho no representa el mismo consumo ni necesariamente el mismo
precio.

Ejemplos ficticios, con cantidades comerciales ya determinadas y un precio
unitario aplicable al tramo correspondiente:

| Modalidad | Cantidad | Precio unitario | Importe de impresión |
| --- | --- | --- | --- |
| Plano y formato | 3 planos A1 | $3.000 por plano | $9.000 |
| Metro cuadrado | 2,5 m² | $4.000 por m² | $10.000 |
| Metro lineal | 3 ML en un ancho de rollo determinado | $2.500 por ML | $7.500 |

Son ejemplos independientes, antes de preparación, mínimo y demás ajustes
aplicables. Un tramo CAD de 3 ML considera 3 metros lineales, no 3 planos ni
3 hojas. Los m² y ML admiten cantidades decimales. No se acumulan cantidades
CAD con las de impresión en hojas para buscar tramos.

CAD y documentos conservan una política principal por pedido según D22. La
sección CAD tiene su unidad y precios propios; no crea otro cargo de preparación
ni otro mínimo: ambos se resuelven una sola vez conforme a D18 y D19. Las
versiones y controles comerciales siguen las decisiones anteriores.

El motor conserva el cálculo de costos según las medidas reales, el material
y la configuración productiva. Todas las celdas CAD, incluidas las expresadas
en ML, deben poder simularse según D28. El precio comercial no cambia las
medidas físicas del plano. Se conserva el recorrido actual de simple faz.

P14 continúa abierto para definir el tratamiento de medidas personalizadas,
la medida facturable en m² y ML, márgenes, redondeos, acumulación entre tamaños
y archivos y el detalle de las combinaciones CAD. No se da por acordado cobrar
el desperdicio o redondear cantidades sólo por elegir una unidad comercial.

## Base actual del módulo

La implementación revisada permite configurar por tenant papeles y gramajes,
formatos generales, máquinas, terminaciones, preparación, mínimos y margen fijo
o por volumen. También contempla precios especiales por cliente. La selección
de formatos cruza las variantes del papel con los tamaños que pueden producir.

Faltan la selección comercial de tamaños por papel, la matriz de precios de
venta y su asignación por canal. El pedido de cotización del módulo recibe
documentos, grupos y cliente, pero todavía no recibe el canal de venta.

| Comportamiento | Referencia de código |
| --- | --- |
| Configuración por tenant | [CentroCopiadoConfig](../apps/api/prisma/schema.prisma) y [campos de configuración](../apps/api/src/centro-copiado/dto/centro-copiado-config.dto.ts) |
| Pantalla de configuración | [Configuración de Centro de copiado](../src/components/comercial/centro-copiado-config-view.tsx) |
| Formatos producibles y cálculo de hojas | [Adaptador de documentos](../apps/api/src/centro-copiado/adaptador.ts) y [opciones del navegador](../src/lib/centro-copiado-api.ts) |
| Cobertura por archivo y consumo por nivel | [Selector de Centro de copiado](../src/components/comercial/centro-copiado-sheet.tsx) y [cobertura de tóner](../apps/api/src/productos-servicios/cobertura-toner.ts) |
| Armado físico y cotización de tomos | [Tomos PDF y avisos](tomos-pdf-y-avisos.md) y [servicio de Centro de copiado](../apps/api/src/centro-copiado/centro-copiado.service.ts) |
| Cotización actual de planos CAD | [Servicio CAD](../apps/api/src/centro-copiado/centro-copiado-cad.service.ts) y [catálogo comercial CAD](../apps/api/src/centro-copiado/catalogo-cad.service.ts) |
| Cotización y guardado del módulo | [Servicio de Centro de copiado](../apps/api/src/centro-copiado/centro-copiado.service.ts) y [pedido de cotización](../apps/api/src/centro-copiado/dto/cotizar-centro-copiado.dto.ts) |
| Canales existentes | [Canales de venta](../src/lib/canales-venta.ts) |
| Guardado y recotización desde la ficha | [Ficha comercial](../src/components/comercial/propuesta-ficha.tsx) |

Hay un [diseño anterior de precios manuales](centro-copiado-precio-manual-diseno.md),
del 3 de agosto de 2026. Se conserva como antecedente. Las decisiones vigentes
son las registradas arriba. El volumen por archivo queda como alternativa según
D11. Las propuestas de reglas con comodines continúan sin confirmarse; el
respaldo al motor sólo se admite con configuración explícita según D21.

## Modelo funcional propuesto

### Oferta por papel y gramaje

Configurar las combinaciones que la gráfica decide vender, dentro de las que
puede producir. Propuesta: distinguir también el gramaje, porque un mismo papel
puede ofrecer tamaños diferentes según su espesor.

Ejemplo ficticio de oferta:

| Papel | Gramaje | Tamaños ofrecidos |
| --- | --- | --- |
| Obra | 80 g | A4, Oficio y A3 |
| Ilustración mate | 150 g | A4 y A3 |
| Ilustración mate | 300 g | A3 |

Poder obtener un tamaño cortando una hoja mayor no obliga a ofrecerlo. Tanto los
selectores como el servidor deberían validar la oferta elegida. La falta
temporal de stock se trataría por separado de la habilitación comercial.

### Matrices de precios

Para impresión en hojas, la estructura propuesta es:

**Papel y gramaje × tamaño × K o CMYK × simple o doble faz × cobertura × tramo de cantidad.**

La disponibilidad de precios por cobertura desde el alcance inicial sigue D26.
La modalidad de precio único y el efecto sobre la acumulación siguen D27:
la cobertura es un eje comercial sólo cuando se cobra de forma diferenciada.

La unidad del precio y de los tramos de impresión en hojas se elige por
tarifario según D09 y D10: hoja física inicialmente, con carilla impresa como
alternativa. Los rangos son generales por tarifario, con excepciones por
combinación según D14.
La sección CAD usa su propia unidad y precios conforme a D30; las medidas
personalizadas y la agrupación de sus combinaciones se completarán en P14.

La generación de estructura, carga manual, pegado desde Excel, duplicación,
sugerencias del motor y actualizaciones masivas están confirmadas en D23.
La simulación con el motor de los costos de todas sus celdas sigue D28.

El motor seguiría calculando los costos y la producción. El tarifario
determinaría el precio de venta, con el desglose comercial correspondiente. La
rentabilidad se recalcula usando ese precio y los costos y cargos aplicables;
su control sigue D25, sin elevar automáticamente el precio de la matriz.

Una actualización de costos podría señalar qué tarifas necesitan revisión.
Los precios publicados no cambian automáticamente al actualizar costos según
D23; la vigencia de las versiones sigue D24. La revisión de cambios señala
los descensos de total entre tramos sin modificar la regla de D13.

Para editar los rangos se propone una opción «Usar rangos del tarifario», activa
inicialmente en cada combinación. También se propone poder aplicar rangos a
varias combinaciones seleccionadas. Señalar los precios que falten al cambiar
los límites forma parte de D23. El detalle de la interfaz se completará al
diseñar la edición de matrices.

### Asignación por canal

La política general heredada, las excepciones por canal y la política principal
única por pedido están confirmadas en D22. Separar el tarifario de su asignación
permite compartir una matriz entre canales. La interfaz para configurar esa
relación se diseñará junto con Oferta y Tarifarios; los precios faltantes y su
respaldo explícito siguen D21.

### Configuración y explicación del precio

Se propone organizar la configuración en Oferta, Tarifarios y Canales, con un
acceso desde Centro de copiado según los permisos del usuario. La simulación
de costos de la matriz completa es parte del alcance inicial confirmado en D28;
la presentación de resultados y los controles se definirán al diseñar la interfaz.

Durante la venta se mostrarían las opciones habilitadas y el origen del precio,
por ejemplo: «Tarifario online · A4 · Obra 80 g · K · doble faz · tramo 100–499».
Los costos y márgenes conservarían sus permisos de acceso.

## Decisiones pendientes

P01 está resuelto en D09 y D10, P02 en D11 y D12, P03 en D13, P04 en D14 y P05
en D15, P06 en D16 a D19, P07 en D20, P08 en D21, P09 en D22 y el alcance de P10
en D23, P11 en D24, P12 en D25 y P13 en D26 y D27. D28 amplía el alcance inicial
con la simulación de costos de todas las celdas de las matrices. D29 resuelve
tomos y terminaciones de P14, y D30 el alcance y las unidades de CAD. P14
conserva las medidas personalizadas y las reglas restantes de CAD.
Las preguntas restantes deben resolverse antes de activar el recorrido completo.

| Referencia | Pregunta por resolver | Propuesta inicial o aspecto a contrastar |
| --- | --- | --- |
| P14 | ¿Cómo se cobran las medidas personalizadas y se acumula el volumen CAD? | D30 confirma CAD inicial por plano/formato, m² o ML, con ML obligatorio y configurable como modo habitual. Definir medida facturable, márgenes, redondeos, formatos no tarifados, acumulación y detalle de combinaciones. Mantener la simulación de costos con el motor. |
| P15 | ¿Cómo se habilita la nueva oferta en tenants existentes? | Proponer conservar su comportamiento hasta que configuren y activen los cambios. Definir el tratamiento de combinaciones nuevas o retiradas. |

## Casos para acordar resultados

Todos los ejemplos son ficticios. Los conteos describen documentos separados
cuyas copias comienzan en un frente. La unidad sigue D09 y D10 y la acumulación,
D11 y D12, con cobertura diferenciada según D27. El precio del tramo se aplica
según D13 y los rangos siguen D14.
La clasificación comercial de la última hoja sigue D15. Las demás reglas
conservan los pendientes indicados en cada caso.
Las páginas son las seleccionadas para imprimir, no necesariamente todas las
del archivo original.

| Caso | Entrada | Resultado acordado o decisión pendiente |
| --- | --- | --- |
| Simple y doble faz | El mismo documento de 10 páginas, una copia, A4 y K, en ambas opciones. | Tarifario por hoja: 10 unidades simple y 5 doble. Por carilla: 10 en ambas modalidades. Precios independientes según D04. |
| Última cara vacía | 11 páginas, 3 copias, doble faz. | Opción inicial: 18 hojas o 33 carillas a tarifa doble. Alternativa: 15 hojas dobles y 3 simples, o 30 carillas dobles y 3 simples. Cada parte busca su tramo según D15. |
| Volumen entre archivos | Un archivo de 100 páginas frente a dos de 50, una copia, simple faz y la misma combinación y tarifario. | Por combinación, ambos escenarios consideran 100 hojas y aplican la tarifa alcanzada a todas ellas. Por archivo, consideran 100 frente a 50 por archivo. La preparación sigue D18 y no se multiplica por la cantidad de archivos. |
| Páginas y copias | Un archivo de 100 páginas con una copia frente a uno de 10 páginas con diez copias, simple faz. | Ambos aportan 100 unidades, por hoja o por carilla. A igualdad de combinación y tarifario y sin otros archivos, tienen la misma cantidad para buscar el tramo. |
| Cantidades en doble faz | Un archivo de 10 páginas con una copia frente a diez archivos de una página, todos configurados en doble faz. | Suman 10 carillas, pero usan 5 y 10 hojas. La opción inicial conserva tarifa doble para todos; la alternativa reclasifica como simples las diez hojas de los archivos de una página. La acumulación sigue D11. |
| Separación dentro de un archivo | Un archivo de 11 páginas con 3 copias, modo por archivo y última hoja a simple faz. | Busca el tramo doble con 15 hojas y el simple con 3; en un tarifario por carilla usa 30 y 3 respectivamente. No acumula otros archivos. |
| Conceptos incluidos | Impresión en A4, Obra 80 g y K, con anillado seleccionado. | La matriz cubre papel e impresión. El anillado y sus materiales se agregan aparte una sola vez. Los costos de papel e impresión no se suman nuevamente al precio. El IVA sigue D17, la preparación D18 y los mínimos D19. |
| IVA incluido o adicional | Precio cargado de $121 por unidad, con una alícuota hipotética del 21 %. | IVA incluido: $100 netos + $21 de IVA = $121 finales. Más IVA: $121 netos + $25,41 de IVA = $146,41 finales. La alícuota y su aplicación provienen de la configuración fiscal, no de este ejemplo. |
| Preparación por pedido | Tres archivos del mismo tarifario, dos A4 K y uno A4 CMYK, agregados en distintas cargas y con varias copias. | Preparación incluida: sin adicional. Cargo fijo final de $500: $500 una sola vez en el pedido. Cambiar las copias o aplicar última hoja a simple faz no agrega cargos. El costo operativo de preparación se conserva en ambas modalidades. |
| Mínimo de importe | Importes finales ficticios: 3 hojas a $100, preparación de $500 y mínimo de $1.000. | Impresión más preparación suman $800; se agrega un ajuste de $200 y se cobran $1.000 antes de terminaciones. Sin mínimo se cobran $800. Se conservan las 3 hojas reales y su tramo. |
| Mínimo con terminación | El caso anterior con anillado de $1.200. | Con mínimo, $1.000 más $1.200 de anillado: $2.200. El anillado no absorbe el ajuste de $200 ni permite alcanzar el mínimo. |
| Mínimo alcanzado | Impresión más preparación suman $1.500 y el mínimo es $1.000. | No se agrega ajuste; se cobran $1.500 antes de terminaciones. El mínimo nunca reemplaza un importe mayor. |
| Acuerdo y descuento | 100 hojas con tarifa de $100, acuerdo aplicable de $90 y descuento explícito del 10 % sobre impresión; preparación incluida y sin mínimo. | El acuerdo reemplaza el precio del canal: $9.000. El descuento autorizado deja $8.100. No se descuenta nuevamente por volumen. |
| Acuerdo por canal | A4 K a $90 para un cliente sólo en mostrador; tarifario online a $80. | En mostrador se aplica el acuerdo de $90 y online la tarifa de $80. Si el acuerdo cubriera ambos canales, se aplicarían $90 en los dos; no se elige el menor automáticamente. |
| Precio manual | Impresión a $9.000 y descuento previo del 10 %; un usuario autorizado fija un importe manual de $8.500, con motivo; preparación incluida y sin mínimo. | La impresión queda en $8.500. Se registra el valor anterior de $8.100 y el nuevo importe, sin volver a descontar el 10 % sobre éste. |
| Descuento o precio manual frente al mínimo | Impresión más preparación quedan en $900 después de aplicar descuentos o un precio manual, con mínimo de $1.000. | Se agrega un ajuste de $100 y se cobran $1.000 antes de terminaciones. El mínimo se mantiene según D20. |
| Impresión mixta | Un pedido con K y CMYK, o con papeles distintos. | Por combinación, cada grupo acumula por separado según D12; por archivo, cada uno usa sus propias unidades. |
| Varias cargas | Un archivo de 60 hojas y otro de 50 con la misma combinación, agregados en distintas aperturas de Centro de copiado al mismo pedido. | Por combinación, suman 110. Por archivo, mantienen 60 y 50. Agregar o quitar uno actualiza el volumen del grupo en el borrador. |
| Rango de páginas | Imprimir sólo 10 páginas seleccionadas de un PDF de 100 páginas. | Distinguir la selección de páginas del tramo comercial por cantidad. |
| Límite de tramo | Tarifa ficticia de $100 por hoja de 1 a 99, y $80 desde 100. | D13 determina $9.900 para 99 hojas, $8.000 para 100 y $8.080 para 101. D23 señala el descenso al revisar cambios; no se corrige automáticamente. |
| Aplicación a todo el grupo | Dos archivos de 60 hojas de la misma combinación, tarifa ficticia de $80 desde 100. | Por combinación, las 120 hojas se cobran a $80: $4.800 por archivo y $9.600 en total. |
| Rangos propios | Tarifario con rangos generales 1–49, 50–199 y 200+, y una combinación con rangos propios 1–19, 20–99 y 100+. | Cada combinación busca su tramo en los rangos que le corresponden. La excepción conserva sus límites cuando cambian los generales. Compartir límites no comparte precios ni volumen. |
| Canal heredado o específico | Política general con Tarifario General; Presencial y WhatsApp heredan, Web elige Tarifario Online y Correo electrónico el motor. | Se resuelve una política principal por pedido según su canal. Los canales heredados comparten el tarifario sin duplicarlo. |
| Canal pendiente | Carga de archivos en un pedido sin canal. | Se permite preparar la carga, pero se requiere elegir canal para obtener una cotización válida. El portal asigna su canal desde el servidor. |
| Cambio de canal | Borrador con 100 hojas, preparación incluida y sin mínimo: $10.000 en Presencial y $8.000 en Web. | Se recalcula todo Centro de copiado y se muestra el cambio de importe antes de confirmarlo. Se reevalúan acuerdos del cliente y se señalan descuentos y precios manuales para revisar su vigencia. |
| Respaldo y política principal | El tarifario principal necesita un precio de otro tarifario configurado como respaldo. | El respaldo aporta ese precio; preparación y mínimo siguen siendo los del principal. No se convierte en una segunda política del pedido. |
| Estructura nueva | Oferta de papeles y tamaños con rangos generales y excepciones. | Se generan las celdas correspondientes con importes vacíos, identificados como pendientes. No se fuerza doble faz al doble del precio simple. |
| Copia independiente | Crear Online como copia de General y luego actualizar General. | Los precios de Online no cambian por esa actualización. Compartir un tarifario y usar un respaldo son operaciones diferentes de copiar. |
| Referencia del motor | Tramos 50–199 y 200+ en un tarifario por hoja. | Se sugieren precios usando inicialmente 50 y 200 hojas, respectivamente, con referencia editable dentro del tramo. Los valores aceptados quedan fijos y editables; no siguen automáticamente los costos. |
| Actualización masiva | Sólo las celdas Obra 80 g, CMYK; aumento del 12 % y redondeo hacia arriba a múltiplos de $10. | Una celda de $130 pasa a $145,60 y queda en $150. Se muestra el antes y después; no se alteran precios fuera de la selección. |
| Cambio de tarifa | Un trabajo cuesta $10.000 con la versión anterior y $12.000 con la nueva. | Cotizaciones nuevas: $12.000. Borradores anteriores: aviso y actualización explícita antes de emitir. Presupuestos emitidos vigentes: $10.000 durante su validez; aprobados u órdenes emitidas conservan sus importes. |
| Activación programada | Una versión está programada para una fecha y hora del tenant. | La versión anterior sigue vigente hasta ese momento. Al activarse la nueva, se usa para cotizaciones nuevas sin sobrescribir el histórico. |
| Presupuesto vencido | Presupuesto de $10.000 ya vencido y sin aceptar; versión vigente cotiza a $12.000. | El presupuesto anterior conserva sus importes. Para continuar se prepara una nueva revisión con precios vigentes, sin modificar el documento anterior. |
| Cambio durante la confirmación | La vista previa usa una versión que se reemplaza antes de confirmar. | El sistema avisa y exige revisar el nuevo cálculo; no confirma silenciosamente un importe diferente. |
| Margen insuficiente | Venta neta de impresión más preparación de $10.000, costos y cargos de $9.200 y mínimo de margen del 15 %. | El 8 % requiere autorización con motivo como opción inicial; con bloqueo estricto no se emite. No se aumenta automáticamente el precio. |
| Margen negativo | La misma venta neta, con costos y cargos de $10.500. | El −5 % sigue D25: autorización o bloqueo estricto. Un precio manual autorizado no aprueba por sí solo esta excepción. |
| Terminación con ganancia | Impresión más preparación quedan debajo del mínimo de margen, pero el anillado permite que el pedido completo lo supere. | La ganancia del anillado no elimina el control de margen sobre impresión más preparación. Las terminaciones se controlan aparte. |
| Costeo incompleto | Existe precio de venta, pero faltan costos necesarios para verificar el margen. | Se muestra «Margen no verificable» y se exige revisión; no se reemplazan costos desconocidos por cero. |
| Pedido modificado tras autorizar | Un borrador recibe aprobación de margen y luego cambian cantidades, precio o costos del cálculo. | Se reevalúa el margen; la aprobación anterior no autoriza un resultado distinto. Un presupuesto ya emitido conserva D24. |
| Costos posteriores a la emisión | Aumenta el costo de un trabajo con presupuesto emitido todavía válido. | Puede mostrarse una alerta interna; se mantiene el precio comprometido sin aplicar retroactivamente el bloqueo de D25. |
| Coberturas distintas | 60 hojas con cobertura Normal y 50 con cobertura Alta, iguales los demás atributos, en acumulación por combinación. | Se acumulan 60 y 50 por separado con precios diferenciados, o 110 con precio único, manteniendo los costos de cada archivo, según D27. |
| Simulación de matriz completa | Tarifario con varios papeles, tamaños, colores, caras, coberturas y tramos, con celdas cargadas y vacías. | Se pueden simular los costos de todas las celdas con el motor según D28. Cada resultado identifica su cantidad de referencia; las celdas vacías muestran costo, pero siguen sin precio ni margen de venta verificable. |
| Simulación con precio único | Una celda tiene el mismo precio para todas las coberturas. | Se pueden comparar los costos y márgenes de Borrador, Normal y Alta frente a ese precio; no se crean precios comerciales diferenciados por simularlos. |
| Simulación incompleta | El motor puede costear algunas combinaciones, pero una carece de configuración necesaria. | Se identifica la celda y el motivo pendiente; no se informa costo cero ni se presenta la matriz completa como verificada. |
| Oferta incompleta | Papel habilitado con un tamaño no ofrecido, o combinación ofrecida sin precio aplicable. | El tamaño no ofrecido no se puede seleccionar ni habilitar con un precio manual. La combinación ofrecida sigue D21: precio pendiente inicialmente o respaldo explícito. |
| Precio pendiente | 120 hojas A3, Ilustración 150 g, CMYK y doble faz; celda del tramo 100–199 vacía y sin respaldo ni acuerdo aplicable. | Se conserva el borrador con aviso de precio pendiente, sin tratar la celda como $0 ni usar el mínimo para completar el precio. No se permite confirmar o cobrar el pedido como completo. |
| Respaldo válido | El caso anterior con otro tarifario compatible o el motor elegidos explícitamente como respaldo. | Si la fuente resuelve el precio, se usa y se identifica su origen. Se mantienen la preparación y el mínimo del tarifario activo, sin duplicar cargos. Si no lo resuelve, continúa pendiente. |
| Acuerdo con celda vacía | El tarifario general no tiene precio, pero un acuerdo aplicable del cliente define un precio válido para esa combinación. | Se usa el acuerdo según D20. La celda vacía del tarifario no causa por sí sola un precio pendiente. |
| Última hoja sin tarifa simple | D15 exige reclasificar la última hoja a simple faz, pero falta el precio simple requerido. | Se aplica D21 a esa parte. No se inventa el precio dividiendo la tarifa doble ni se omite la hoja del total. |
| Tomo con terminación | Un archivo de 20 páginas K y otro de 2 páginas CMYK, ambos simple faz, con 10 juegos anillados y tarifa por hoja. | Se cotizan 200 hojas K y 20 CMYK con sus combinaciones y tramos, más 10 anillados con sus materiales. El espesor corresponde a 22 hojas por ejemplar. Preparación y mínimo siguen al nivel del pedido según D29. |
| Volumen entre tomos y sueltos | Dos tomos y un documento suelto contienen archivos de la misma combinación comercial. | En acumulación por combinación suman sus unidades efectivas dentro del pedido. En modalidad por archivo, cada original conserva su grupo aunque se genere un PDF unificado del tomo. |
| Tomo con originales impares | Dos originales de 3 páginas cada uno, ambos doble faz, con 10 juegos. | Cada original comienza en frente: 4 hojas por juego, 40 hojas y 60 carillas impresas en total. D15 define su clasificación comercial; no se reutilizan los dorsos vacíos entre originales. |
| CAD en ML | Cantidad comercial de 3 ML, con precio aplicable de $2.500 por ML para su material y ancho de rollo. | Impresión: $7.500. El tramo se busca con 3 ML; se conservan aparte las cantidades físicas y medidas del trabajo. |
| Modalidad CAD guardada | Un tarifario tiene CAD configurado por metro lineal y se abre un pedido nuevo que lo utiliza. | Se aplica ML sin volver a la opción inicial por plano/formato ni pedir que se elija otra vez. |
| Pedido mixto | Documentos por hoja y planos por ML dentro del mismo pedido y política principal. | Los tramos se calculan por separado en sus unidades. Preparación y mínimo siguen siendo únicos para el pedido; las celdas de ambas secciones pueden simularse con el motor. |

## Integración técnica por definir

El precio debe ser consistente entre vista previa, construcción de renglones,
guardado, edición, recotización y resumen. Hoy esos recorridos tienen entradas
distintas y algunos vuelven a invocar directamente al motor. La política debe
resolverse en el servidor y alcanzar todos esos caminos.

Se propone conservar en cada cotización el canal, tarifario y versión aplicados,
la combinación, el tramo, las cantidades y unidades usadas, y el origen del
precio. Así se puede explicar el cálculo histórico. En la modalidad por
combinación confirmada en D11, la recotización debe considerar al conjunto
afectado y aplicar a cada parte del archivo el precio unitario de su grupo sobre
sus propias unidades, según D13 y D15. La clasificación de caras debe resolverse
antes de acumular volumen y seleccionar los tramos.

La preparación de D18 debe resolverse al nivel del pedido y mantener un único
cargo al agregar, editar o recotizar archivos. El cálculo del costo operativo
de preparación debe separarse de la elección de cobrarlo aparte. El mínimo de
D19 se evalúa una sola vez sobre impresión más preparación, con un ajuste por
la diferencia y terminaciones aparte. Se debe conservar ese desglose sin
modificar las cantidades reales ni aplicar simultáneamente el mínimo anterior
por documento al nuevo tarifario. La prioridad frente a descuentos sigue D20.

La resolución común de D20 debe conservar el precio base, el acuerdo aplicado
y su alcance, el descuento efectivo o precio manual, los permisos comprobados
y el registro del ajuste. Ningún recorrido debe reaplicar un descuento ya
incorporado al importe ni permitir omitir el mínimo mediante un precio manual.

La política de D21 debe validarse en el servidor: conservar el estado pendiente
y el total parcial en borradores, e impedir el cierre con precios sin resolver.
El cálculo debe registrar la fuente de respaldo cuando se use, validar su
compatibilidad y evitar referencias circulares entre tarifarios. Usar el motor
como respaldo no debe agregar nuevamente preparación, mínimos o terminaciones
que se resuelven por separado en el tarifario activo.

La política de D22 debe resolverse en el servidor a partir del canal del pedido,
incluida la herencia general. La vista previa, las cargas posteriores y el
guardado deben usar esa misma política principal. El cambio de canal de un
borrador exige recalcular el conjunto y comprobar acuerdos y ajustes vigentes,
sin conservar accidentalmente importes de canales diferentes ni alterar precios
de documentos emitidos.

La edición de D23 debe identificar las celdas afectadas y mostrar el resultado
antes de aplicarlo. Las sugerencias del motor deben registrar su cantidad de
referencia y respetar la unidad, caras y conceptos del tarifario. La publicación
no debe confundirse con guardar un borrador; la regla de activación sigue D24.
La conversión de importes al cambiar unidad o modalidad de IVA requiere
definirse explícitamente en el diseño de edición, sin reinterpretar valores
existentes de forma silenciosa.

La aplicación de D24 debe conservar las versiones publicadas y las reglas e
importes efectivos de cada cotización, incluidas sus fuentes de respaldo. La
activación inmediata o programada debe resolver una única versión vigente por
tarifario y comprobar cambios entre vista previa y confirmación. Actualizar un
borrador debe operar sobre todo Centro de copiado, sin mezclar versiones; los
presupuestos emitidos o aprobados conservan sus importes según su estado y
validez. La aprobación y conversión existentes deben usar esos valores guardados.

El control de D25 debe aplicarse en el servidor a todos los recorridos que
emiten presupuestos u órdenes o cierran y cobran pedidos. Debe distinguir el
precio de venta del piso de margen que hoy puede elevar precios calculados,
y aprovechar el recorrido existente de aprobación comercial sin confundir su
margen bruto con el margen que contempla los costos y cargos de D25. El diseño
debe precisar la integración con los permisos y controles generales del tenant,
conservar el cálculo autorizado y reevaluar los borradores modificados. No se
deben alterar importes históricos ni compromisos vigentes de D24.

El diseño inicial debe contemplar los precios por cobertura de D26 y D27 en la
estructura, edición, resolución de precios y guardado del cálculo histórico.
La cobertura integra la clave comercial sólo en la modalidad diferenciada y
se conserva para el costeo de cada archivo en ambas modalidades. Los respaldos
y acuerdos deben respetar el nivel solicitado cuando forme parte del precio.

La simulación de D28 debe reutilizar el motor y alcanzar todas las celdas,
registrando resultados y errores por combinación y cantidad de referencia.
La ejecución completa o por selección, el progreso y la actualización de
resultados ante cambios de costos deben diseñarse sin sobrescribir precios ni
confundir un resultado anterior con una simulación actual. Las cantidades de
referencia, unidades y supuestos productivos deben ser coherentes con D23,
incluido el desglose de preparación, mínimo y cargos para evaluar D25.

La integración de D29 debe resolver los precios de impresión antes de componer
el renglón del tomo, conservando originales, juegos y cantidades comerciales.
Los materiales y costos de terminación deben calcularse por ejemplar y sumarse
sin duplicación. Los costos operativos de preparación deben separarse del cargo
comercial único de D18; unificar o guardar un tomo no puede reiniciar los grupos
del pedido ni aplicar otra vez su mínimo. La vista previa, edición, persistencia
y resumen deben usar el mismo desglose.

La implementación de D30 debe separar las unidades comerciales CAD del conteo
de páginas y copias y conservar las medidas reales por página. ML debe
persistirse como modalidad del tarifario y participar en vista previa, guardado,
edición y simulación desde el alcance inicial. Los límites y referencias de
los tramos de m² y ML deben contemplar cantidades decimales. Cambiar de unidad
requiere revisar los rangos e importes de la nueva versión, sin reinterpretar
valores guardados de forma silenciosa. Las conversiones de medidas facturables
y agrupaciones se completarán al resolver P14.

El modelo de almacenamiento y el punto exacto de integración se definirán
después de las reglas funcionales. La separación por tenant, los permisos, el
desglose comercial y las validaciones de oferta deben conservarse en todos los
recorridos. El tarifario no cambia las cantidades físicas usadas por producción.

## Orden de trabajo propuesto

1. Partir de P01 a P13 resueltos en D09 a D27 y del alcance de simulación de D28,
   incorporar tomos y terminaciones según D29, CAD y sus unidades según D30,
   y completar las reglas comerciales pendientes que condicionan el primer alcance.
2. Diseñar la experiencia de Oferta, Tarifarios y Canales, incluida la simulación
   de costos de todas las celdas de las matrices.
3. Implementar la oferta de tamaños por papel y gramaje con compatibilidad para
   configuraciones existentes.
4. Implementar matrices y asignación por canal como un conjunto, incorporando
   versiones, precios por cobertura, tomos, terminaciones, CAD con ML desde el
   inicio y resolución común del precio.
5. Verificar en local cotización, guardado, recotización, tomos, terminaciones,
   permisos y separación entre tenants con datos ficticios.
6. Preparar un lote coherente para validación en staging según el
   [flujo de trabajo del proyecto](flujo-pull-requests.md).

El portal online es un consumidor futuro de esta base. Su construcción y las
fechas de implementación no forman parte de las decisiones tomadas hasta ahora.

## Cómo mantener las decisiones

Cada definición nueva debe actualizar la sección afectada y el registro de
cambios, indicando fecha y estado. Cuando Lucas confirme una pregunta pendiente,
se incorpora su resolución a las decisiones confirmadas con su referencia y se
actualizan los ejemplos afectados. Una propuesta no pasa a confirmada por el
solo hecho de estar documentada.

Si cambia una decisión, se conserva su referencia y se registra qué la reemplaza
y por qué. Los ejemplos seguirán usando datos ficticios y los pendientes
resueltos dejarán de aparecer como preguntas abiertas.

## Registro de cambios

| Fecha | Cambio | Estado |
| --- | --- | --- |
| 2026-10-10 | Apertura del registro de oferta y matrices por tenant y canal. Incorporación de las propuestas y preguntas del análisis inicial. | Definición funcional en curso |
| 2026-10-10 | Confirmación explícita de precios independientes para simple faz y doble faz como eje de la matriz, D04. | Confirmado |
| 2026-10-10 | P01 resuelto: hoja física como opción inicial y carilla impresa como alternativa por tarifario; precio y tramos usan la misma unidad. Incorporación de D09 y D10 y actualización de ejemplos. | Confirmado |
| 2026-10-10 | P02 resuelto: acumulación por combinación dentro del pedido como opción inicial y por archivo como alternativa por tarifario. Incluye distintas cargas del mismo pedido y recálculo de los grupos afectados en borradores. Incorporación de D11 y D12 y actualización de ejemplos. | Confirmado |
| 2026-10-10 | P03 resuelto: el precio unitario del tramo alcanzado se aplica a todas las unidades del grupo o archivo, según la modalidad de acumulación. Incorporación de D13 y ejemplos de cálculo y límites. El aviso del simulador conserva su estado de propuesta. | Confirmado |
| 2026-10-10 | P04 resuelto: rangos generales por tarifario con excepciones por combinación. Incorporación de D14 y ejemplos; precios y acumulación permanecen independientes entre combinaciones. | Confirmado |
| 2026-10-10 | P05 resuelto: mantener tarifa doble faz inicialmente, con última hoja a simple faz como alternativa por tarifario. Incorporación de D15; precisión de D13 y de la acumulación al separar partes del mismo archivo. Actualización de ejemplos por hoja y por carilla. | Confirmado |
| 2026-10-10 | P06 parcialmente resuelto: papel e impresión incluidos en la tarifa; terminaciones y sus materiales aparte al seleccionarlas. Incorporación de D16. IVA, preparación y mínimos siguen pendientes. | Confirmado parcial |
| 2026-10-10 | IVA resuelto dentro de P06: IVA incluido como opción inicial y más IVA como alternativa por tarifario. Incorporación de D17 y ejemplo de cálculo. Preparación y mínimos siguen pendientes. | Confirmado parcial |
| 2026-10-10 | Preparación resuelta dentro de P06: incluida como opción inicial y cargo fijo por pedido como alternativa por tarifario. Incorporación de D18, ejemplo y separación entre costo operativo y cobro comercial. Los mínimos siguen pendientes. | Confirmado parcial |
| 2026-10-10 | P06 resuelto: sin mínimo como opción inicial y mínimo de importe por pedido como alternativa por tarifario, sobre impresión más preparación y con terminaciones aparte. Incorporación de D19 y ejemplos del ajuste por la diferencia, sin alterar cantidades ni tramos. La prioridad frente a descuentos y ajustes se conserva en P07. | Confirmado |
| 2026-10-10 | P07 resuelto: acuerdo del cliente prioritario dentro de su alcance, descuentos explícitos y precio manual autorizado, respetando el mínimo. Incorporación de D20, orden de aplicación y ejemplos por canal, descuento y ajuste manual. | Confirmado |
| 2026-10-10 | P08 resuelto: precio pendiente con bloqueo del cierre como opción inicial y respaldo explícito a otro tarifario compatible o al motor como alternativa por tarifario. Incorporación de D21, conservación del borrador y ejemplos de respaldo, acuerdo aplicable y última hoja sin tarifa. | Confirmado |
| 2026-10-10 | P09 resuelto: política general heredada por defecto, excepciones por canal y una política principal por pedido, con recálculo al cambiar el canal del borrador. Incorporación de D22 y ejemplos; preparación y mínimo pertenecen al tarifario principal, y los documentos emitidos conservan sus precios. | Confirmado |
| 2026-10-10 | Alcance de P10 resuelto: carga manual, pegado desde Excel, duplicación, sugerencias del motor y ajustes masivos con redondeo; importación de archivos para una segunda etapa. Incorporación de D23, cantidad de referencia por tramo, revisión de cambios y ejemplos. La vigencia se conserva en P11. | Confirmado |
| 2026-10-10 | P11 resuelto: versiones publicadas inmutables, activación inmediata o programada y actualización explícita de borradores antes de emitir. Incorporación de D24, respeto de presupuestos vigentes y de importes aprobados, ejemplos y control de cambios entre vista previa y confirmación. | Confirmado |
| 2026-10-10 | P12 resuelto: mínimo de margen configurable por tarifario, autorización con motivo por debajo del mínimo incluido el margen negativo y bloqueo estricto como alternativa. Incorporación de D25, cálculo sobre impresión más preparación, terminaciones aparte, revisión del costeo incompleto y de pedidos modificados, sin cambiar automáticamente los precios ni alterar compromisos vigentes. | Confirmado |
| 2026-10-10 | Incorporación de D26: precios por cobertura dentro del alcance inicial. P13 se precisa para resolver modalidades por tarifario, selección de cobertura y acumulación de volumen; se incorpora una propuesta con ejemplo, todavía sin confirmar esas reglas. | Confirmado parcial |
| 2026-10-10 | P13 resuelto con D27: precio único como opción inicial y precios independientes por cobertura como alternativa desde la primera entrega; la cobertura separa volumen sólo cuando se cobra diferenciada. Se actualizan D12, D26 y ejemplos. | Confirmado |
| 2026-10-10 | Incorporación de D28: simulación con el motor de los costos de todas las celdas de las matrices desde el alcance inicial, incluidas las celdas sin precio. Comparación de costo, venta y margen con cantidades de referencia explícitas, sin modificar automáticamente precios. | Confirmado |
| 2026-10-10 | Incorporación de D29: tomos desde el alcance inicial, impresión por matriz y terminaciones aparte por ejemplares y materiales. Se conservan acumulación, preparación y mínimo por pedido, armado físico y costeo real. Se actualizan ejemplos; P14 continúa abierto para planos CAD. | Confirmado parcial |
| 2026-10-10 | Incorporación de D30: CAD desde el inicio, por plano y formato como opción inicial y por m² o ML como alternativas. ML queda explícitamente obligatorio, configurable y persistente como modo habitual. Se precisa la separación respecto de las unidades de hojas, la política principal del pedido y la simulación completa. P14 conserva medidas personalizadas y demás reglas CAD. | Confirmado parcial |
