# Centro de copiado decisiones de oferta y tarifarios

**Estado:** definición funcional cerrada para el alcance inicial; implementación local en curso por bloques.
**Creado y actualizado:** 10 de octubre de 2026.

Centro de copiado necesita representar la forma de vender de cada gráfica: una
oferta de papeles y tamaños, matrices de precios por cantidad, tipo de impresión,
caras y cobertura, y la posibilidad de cobrar distinto según el canal de compra. La
configuración debe seguir siendo sencilla y accesible desde el módulo.

Este es el registro vivo de ese trabajo. Las decisiones confirmadas provienen
de lo acordado con Lucas; las propuestas y preguntas conservan su estado hasta
resolverlas. El cierre funcional y el alcance vigente se resumen en D35 a D38.
Este documento registra el diseño acordado; no acredita cambios implementados.
El avance técnico y las comprobaciones se registran en el
[plan de implementación](centro-copiado-tarifarios-plan-implementacion.md).

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
| D09 | Para impresión en hojas, la unidad se elige por tarifario: hoja física como opción inicial y carilla impresa como alternativa. La sección CAD utiliza ML según D35. | 2026-10-10 |
| D10 | El precio y los tramos usan la misma unidad elegida en el tarifario. Un tramo de 100 en un tarifario por hoja significa 100 hojas físicas, también en doble faz. Resuelve P01 junto con D09. | 2026-10-10 |
| D11 | La acumulación se configura por tarifario: por combinación dentro del pedido como opción inicial y por archivo como alternativa. | 2026-10-10 |
| D12 | En impresión en hojas, la combinación reúne el mismo papel y gramaje, tamaño, K/CMYK, simple/doble faz y tarifario; D27 incorpora la cobertura cuando se cobra diferenciada. Se considera todo el pedido, incluidas distintas cargas de Centro de copiado. Resuelve P02 junto con D11; los grupos CAD siguen D33. | 2026-10-10 |
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
| D29 | Los tomos se integran desde el alcance inicial: su impresión se calcula con la matriz y las terminaciones se agregan aparte según ejemplares y materiales. Los juegos determinan las copias efectivas de los archivos. Se conservan las reglas de acumulación del tarifario, preparación y mínimo por pedido, las reglas físicas de doble faz y los costos reales de preparación y armado. Resuelve tomos y terminaciones de P14; CAD sigue D35 y pouch amplía las terminaciones en D38. | 2026-10-10 |
| D30 | CAD forma parte del alcance inicial con una sección propia dentro del tarifario, una política principal por pedido, preparación y mínimo únicos y simulación de costos de todas sus celdas. Precio y tramos usan la misma unidad CAD, sin acumular hojas. La elección original entre plano/formato, m² y ML queda reemplazada por D35: inicialmente sólo ML. | 2026-10-10 |
| D31 | En CAD por ML se cobra el largo de papel consumido previsto para producir el trabajo, incluidos los márgenes de avance de la configuración productiva. Se determina según el rollo y la orientación de impresión y se multiplica por las copias efectivas. Es la base del precio y del tramo; no se ofrece el largo del plano sin márgenes como modalidad de cobro. El redondeo comercial se define en D32. | 2026-10-10 |
| D32 | En CAD por ML, «Sin redondeo comercial» es la opción inicial y «Redondear hacia arriba» es la alternativa configurable por tarifario, con un incremento positivo expresado en ML. Se conservan por separado el consumo previsto y la cantidad facturada tras el redondeo. La acumulación, el momento de redondear y la cantidad para seleccionar el tramo siguen D33. | 2026-10-10 |
| D33 | En CAD se acumula por combinación dentro del pedido como opción inicial y por archivo como alternativa por tarifario. En ML se agrupa por papel y gramaje, ancho de rollo, K/CMYK y tarifario, con cobertura separada cuando tiene precios diferenciados; se pueden sumar planos de distintas medidas. El consumo sin redondear determina el tramo y el redondeo comercial se aplica una sola vez al total del grupo; en la alternativa por archivo, a cada combinación dentro de éste. El precio del tramo alcanzado se aplica a toda la cantidad facturada. Las reglas antes contempladas para plano/formato y m² quedan fuera del alcance inicial por D35. | 2026-10-10 |
| D34 | Antecedente para una posible modalidad futura de m²: ancho completo del rollo por largo de papel consumido, incluidos márgenes y copias, previo al redondeo comercial de ML. D35 retira m² del alcance inicial por pedido de Lucas; esta referencia no obliga a implementarlo en esta etapa. | 2026-10-10 |
| D35 | En esta etapa, CAD ofrece únicamente precio por ML. Sustituye la elección de unidades de D30 y pospone plano/formato y m², incluida D34. Los tamaños estándar y personalizados se cotizan por el consumo de D31, con las combinaciones, tramos y redondeo de D32 y D33. Sólo se admiten medidas producibles y condiciones ofrecidas; los precios faltantes siguen D21. Resuelve P14. | 2026-10-10 |
| D36 | Los tenants existentes conservan su comportamiento y configuración hasta que un usuario autorizado prepare, revise y active expresamente la nueva oferta y política de precios. Se muestran los cambios antes de activar; no se publica una matriz vacía automáticamente. Los borradores requieren revisión explícita al pasar a la nueva política y los documentos emitidos conservan D24. Resuelve P15a. | 2026-10-10 |
| D37 | Por criterio delegado por Lucas, las combinaciones nuevas se preparan deshabilitadas y se habilitan explícitamente; las celdas nuevas no heredan precios por aproximación y siguen D21. Retirar una combinación impide nuevas ventas y bloquea la emisión de borradores que aún la usan hasta resolverlos. Se conservan versiones, históricos y compromisos vigentes de D24; no se elimina información usada por pedidos. Cambiar los atributos de una combinación crea otra identidad. Resuelve P15b. | 2026-10-10 |
| D38 | Plastificado pouch se incorpora como terminación posible desde el alcance inicial, habilitable por tenant y cotizada aparte de la impresión, con material y trabajo incluidos en su propio cálculo. Se reutiliza la familia existente del motor y se integra en configuración, selección, cotización y persistencia. Los criterios de integración de esta etapa se detallan abajo. | 2026-10-10 |

**Alcance vigente de CAD: sólo ML (D35).** D34 y los ejemplos anteriores de
otras unidades conservados en el registro de cambios son antecedentes.

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

La sección CAD usa ML según D35. Un mismo tarifario puede
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

Esta composición de grupos corresponde a impresión en hojas. En CAD se usan
los criterios de D33: en ML, planos de distintas medidas pueden compartir
grupo si coinciden las condiciones comerciales y el ancho de rollo.

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
ML según D35. Sus rangos se expresan en esa unidad y no reutilizan
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
resuelven en D36, sin cambiar automáticamente la operación de tenants actuales.

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
La habilitación de estas políticas para tenants actuales sigue D36.

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
Las unidades son hojas o carillas en la sección de documentos y ML en CAD
según D35. En CAD también se deben identificar las medidas
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
pedido como un solo libro. El anillado seleccionado para el tomo se cobra
una vez por ejemplar; no se repite por cada archivo incluido. El pouch de D38
usa las hojas físicas seleccionadas, con los juegos del tomo como copias.
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
CAD tienen el alcance propio de D35. El plastificado pouch se integra según D38.

### Alcance y unidades de planos CAD

**Confirmado en D35:** CAD se integra desde la primera entrega con una sección
propia dentro del tarifario del canal y **únicamente precio por metro lineal**.
Esta decisión reemplaza la elección inicial de D30. Plano/formato y m² quedan
fuera de esta etapa y no deben aparecer como modos disponibles ni generar
celdas que el tenant tenga que completar.

Precio y tramos se expresan en ML de papel consumido según D31. El ancho de
rollo y el material quedan identificados, porque el mismo largo en rollos de
distinto ancho no representa el mismo consumo ni necesariamente el mismo precio.

Ejemplo ficticio: 3 ML facturables a $2.500 por ML dan $7.500 de impresión,
antes de preparación, mínimo y demás ajustes aplicables. El tramo considera
metros lineales con cantidades decimales. No se acumulan cantidades CAD con
las de impresión en hojas.

Los formatos estándar y las medidas personalizadas usan el mismo cálculo de
consumo. Se valida que quepan en el rollo según orientación y márgenes, sin
reescalar automáticamente el original. Si las medidas no son producibles,
se explica el impedimento; si la combinación está ofrecida pero no tiene precio
en su tramo, se aplica D21. No hace falta una tarifa fija por cada medida.

CAD y documentos conservan una política principal por pedido según D22. La
sección CAD tiene su unidad y precios propios; no crea otro cargo de preparación
ni otro mínimo: ambos se resuelven una sola vez conforme a D18 y D19. Las
versiones y controles comerciales siguen las decisiones anteriores.

El motor conserva el cálculo de costos según las medidas reales, el material
y la configuración productiva. Todas las celdas CAD, incluidas las expresadas
en ML, deben poder simularse según D28. El precio comercial no cambia las
medidas físicas del plano. Se conserva el recorrido actual de simple faz.

La medida facturable en ML sigue D31 y la modalidad de redondeo, D32. D33
define la acumulación entre tamaños y archivos y el orden del redondeo.
La combinación comercial queda formada por papel y gramaje, ancho de rollo,
K/CMYK, tarifario y cobertura cuando se cobra diferenciada. Se conserva simple
faz para CAD. D35 cierra P14 sin exigir otras modalidades de precio.

### Largo facturable de papel en CAD por ML

**Confirmado en D31:** se cobra el largo de papel consumido. Al cotizar, ese
consumo se calcula con el plan de producción: rollo elegido, orientación del
plano y márgenes de avance correspondientes. Se aplica tanto a formatos
estándar como a medidas personalizadas. La base comercial es el largo de salida
previsto, incluidos esos márgenes; no queda una opción de cobrar sólo el largo
del plano sin ellos.

Ejemplo ficticio: un plano de 600 × 1.200 mm se imprime con los 600 mm a lo ancho
de un rollo compatible. Con 5 mm de margen al comienzo y 5 mm al final, consume
1.210 mm de avance, equivalentes a **1,21 ML**. A una tarifa aplicable de $5.000
por ML y sin redondeo comercial, la impresión cuesta **$6.050** antes de los
demás ajustes del pedido.
Los márgenes del ejemplo son ilustrativos; se usan los de la configuración
productiva correspondiente.

Cada copia aporta su largo de salida previsto. Dos copias del ejemplo aportan
2,42 ML al grupo que corresponda según D33. El consumo acumulado sin redondear
determina el tramo. D32 establece la opción inicial sin redondeo y la alternativa
con incremento configurable; D33 aplica ese redondeo una sola vez al total del
grupo. El precio unitario del tramo se multiplica por la cantidad facturada,
conservando por separado el consumo previsto.

La cotización debe mostrar la medida original, el rollo y orientación previstos,
los márgenes y los ML resultantes. El ancho identifica el material y la tarifa;
la cantidad en ML corresponde al avance sobre ese rollo. La simulación de D28
debe usar el mismo consumo que el cálculo comercial y conservar su desglose.
Los importes comprometidos siguen las reglas de vigencia de D24.

El antecedente de m² de D34 queda fuera de esta etapa según D35.

### Redondeo comercial de cantidades CAD

**Confirmado en D32:** en CAD por ML se utiliza «Sin redondeo comercial» como
opción inicial. Se cobra la cantidad obtenida del consumo previsto de D31,
sin elevarla automáticamente a metros enteros o a otro incremento.

Como alternativa, cada tarifario puede configurar «Redondear hacia arriba» e
indicar el incremento en ML. El incremento debe ser positivo y su unidad debe
estar visible. La cantidad a cobrar es el menor múltiplo del incremento que
alcanza o supera la cantidad evaluada. Si ya coincide con un múltiplo, no se
agrega otro incremento.

Ejemplos ficticios de la transformación de una cantidad base:

| Cantidad base | Modalidad | Cantidad facturada |
| --- | --- | --- |
| 1,21 ML | Sin redondeo comercial | 1,21 ML |
| 1,21 ML | Hacia arriba cada 0,10 ML | 1,30 ML |
| 1,21 ML | Hacia arriba cada 0,50 ML | 1,50 ML |
| 1,30 ML | Hacia arriba cada 0,10 ML | 1,30 ML |

El consumo físico y el costo de producción no aumentan por un redondeo
comercial. Se deben conservar y mostrar por separado el consumo previsto,
la regla de redondeo y la cantidad facturada, también en la simulación de D28.
El redondeo de cantidades de D32 es distinto del redondeo de precios de D23.

Según D33, primero se acumula el consumo previsto del grupo y se determina
el tramo con esa cantidad sin redondear. Después se aplica el redondeo una
sola vez al total del grupo. En la alternativa por archivo se sigue el mismo
orden para cada combinación comercial de ese archivo, incluidas sus copias.

### Acumulación del volumen en planos CAD

**Confirmado en D33:** CAD conserva «Por combinación dentro del pedido» como
opción inicial y «Por archivo» como alternativa por tarifario. Se consideran
las páginas seleccionadas y sus copias efectivas, incluidas las distintas
cargas de Centro de copiado del mismo pedido. No se suman pedidos anteriores
ni unidades de impresión en hojas.

En ML, una combinación reúne el mismo papel y gramaje, ancho de rollo, K/CMYK
y tarifario. La cobertura separa el volumen cuando tiene precios diferenciados
según D27; con precio único no lo separa y se conservan los costos particulares.
Los planos pueden tener medidas diferentes y acumular juntos si coinciden esas
condiciones. Cambiar papel, ancho de rollo o tipo de impresión genera otro grupo.

Ejemplo ficticio de dos archivos con planos de medidas diferentes, iguales
condiciones comerciales y el mismo ancho de rollo. Los consumos incluyen
márgenes de avance y todas las copias:

| Archivo | Consumo previsto | Cantidad para el tramo por combinación | Cantidad para el tramo por archivo |
| --- | --- | --- | --- |
| A | 2,42 ML | 4,03 ML | 2,42 ML |
| B | 1,61 ML | 4,03 ML | 1,61 ML |

En acumulación por combinación, el orden de cálculo en ML es:

1. Sumar los consumos previstos del grupo: **4,03 ML**.
2. Seleccionar el tramo usando esos **4,03 ML sin redondear**.
3. Aplicar una sola vez el redondeo de D32, si está habilitado. Con incremento
   de 0,10 ML, la cantidad facturada es **4,10 ML**; sin redondeo, **4,03 ML**.
4. Multiplicar toda la cantidad facturada por el precio unitario del tramo
   seleccionado, sin cobro progresivo conforme a D13.

En la alternativa por archivo, cada combinación de cada archivo realiza esa
secuencia por separado. En el ejemplo, con incremento de 0,10 ML, A busca el
tramo con 2,42 ML y factura 2,50 ML; B busca con 1,61 ML y factura 1,70 ML.
El total facturado es 4,20 ML, con los precios que correspondan a cada tramo.
No se redondea previamente cada página ni cada copia.

El redondeo comercial no genera volumen para alcanzar otro tramo. Por ejemplo,
si un tramo comienza en 4 ML y un grupo consume 3,96 ML, facturar 4,00 ML por
redondeo no habilita ese tramo: se usa el que corresponda a 3,96 ML. El costo
productivo conserva el consumo previsto, sin sumar el incremento comercial.

La acumulación por plano/formato o por m² queda fuera de esta etapa por D35.

Agregar, quitar o modificar archivos, copias o condiciones de un borrador
recalcula los grupos afectados. Cada archivo conserva sus instrucciones y su
consumo físico. Preparación y mínimo se resuelven una sola vez por pedido según
D18 y D19; la vigencia de cotizaciones sigue D24. La simulación de D28 debe
mostrar consumo, grupo, cantidad para el tramo y cantidad facturada usando
estas mismas reglas.

### Antecedente fuera del alcance inicial: CAD por m²

**D34 queda pospuesta por D35.** Se conserva como referencia para una eventual
ampliación futura, sin comprometer su implementación. El criterio acordado fue
cobrar la superficie del papel consumido previsto
para producir el trabajo. Para cada página seleccionada, se multiplica el
ancho completo del rollo por el largo de salida previsto, incluidos los
márgenes de avance, y por sus copias efectivas. Luego se suman las superficies
según los grupos de D33. Las medidas se convierten a metros antes de multiplicar.

Ejemplo ficticio: un plano de 600 × 1.200 mm se coloca con los 600 mm a lo
ancho de un rollo de 900 mm. Con 5 mm de margen al comienzo y 5 mm al final,
el largo consumido por copia es 1,21 m. La superficie facturable es
**0,90 × 1,21 = 1,089 m² por copia** y **2,178 m² para dos copias**. Se incluye
el ancho completo del papel, también el sobrante lateral.

Se utiliza el largo consumido antes de cualquier redondeo comercial de ML;
ese incremento no representa papel adicional consumido ni debe aumentar la
superficie calculada. La simulación con el motor conserva este mismo desglose,
las medidas originales y la configuración productiva utilizada.

Lucas decidió después limitar la oferta inicial a ML. La simulación de matrices
de esta etapa cubre todas las celdas de las modalidades vigentes: hojas/carillas
y CAD por ML; no requiere construir una matriz de m² o de precio por plano.

### Activación en tenants existentes

**Confirmado en D36:** publicar esta mejora no cambia automáticamente la forma
de cotizar de las empresas existentes. Se conserva su operación con el motor,
oferta y ajustes actuales hasta una activación expresa por un usuario autorizado.

La configuración inicial se prepara como borrador a partir de la oferta actual.
El tenant revisa papeles, gramajes, tamaños, terminaciones, política general,
canales, precios y reglas. La revisión muestra diferencias, combinaciones sin
precio y simulaciones de costos. Crear la estructura no equivale a publicarla.
Los faltantes siguen D21 y no se convierten en precios cero.

La activación utiliza las versiones y fechas de D24. Los pedidos nuevos usan
la política activa; los borradores anteriores se conservan y requieren revisión
explícita y recálculo antes de emitir bajo la nueva política, sin mezclar precios
viejos y nuevos. Los presupuestos emitidos vigentes y órdenes mantienen sus
compromisos. No se reutilizan mínimos o cargos anteriores como una segunda
capa sobre los de D18 y D19.

La migración debe preservar también las selecciones que hoy usan `null` para
«todos» o valores por defecto. Ampliar el catálogo de terminaciones con pouch
no debe habilitarlo automáticamente en empresas que sólo ofrecían anillado.

### Altas, cambios y retiro de combinaciones

**Resuelto en D37 por criterio delegado por Lucas:** la oferta se modifica de
forma explícita y conserva su histórico. Agregar materia prima o una variante
al inventario no la habilita automáticamente para la nueva oferta comercial.

| Cambio | Tratamiento |
| --- | --- |
| Combinación nueva | Preparar deshabilitada; al habilitarla, crear sus celdas vacías o cargar precios expresamente. Si usa tarifario y falta precio, rige D21; si el canal usa motor, debe poder cotizarse por esa política. |
| Cambio de papel, gramaje, tamaño, impresión u otro atributo de identidad | Crear una combinación distinta, conservando la anterior y sus referencias. No reinterpretar cotizaciones guardadas. |
| Retiro comercial | Deshabilitar para nuevas ventas y conservar precios/versiones e histórico. No borrar los registros usados por pedidos. |
| Borrador con combinación retirada | Conservar el contenido, mostrar el motivo y bloquear emisión/cierre hasta elegir una alternativa ofrecida o reactivar expresamente la combinación y revisar el cálculo. Un precio manual o respaldo no habilita una oferta retirada. |
| Presupuesto emitido vigente u orden aceptada | Conservar lo comprometido según D24. Si existe un impedimento productivo real, resolverlo comercialmente mediante una revisión explícita, sin sustitución ni recálculo silencioso. |
| Duplicar un pedido antiguo o revisar uno vencido | Validar contra la oferta y política vigentes; copiar el pedido no reactiva combinaciones retiradas ni prolonga precios vencidos. |

La oferta debe conservar una referencia de versión o instantánea suficiente
para explicar lo vendido. Los cambios se aplican al confirmar su activación;
el servidor vuelve a validar oferta y tarifario al emitir para detectar retiros
ocurridos después de la vista previa. El stock temporal se gestiona por separado
de la decisión comercial de ofrecer una combinación.

### Plastificado pouch como terminación

**Alcance confirmado en D38:** incorporar «Plastificado pouch» a Centro de
copiado, junto con las terminaciones existentes. Su material y trabajo se
cotizan aparte de la impresión según D16. El siguiente criterio de integración
se define a partir del código relevado, para una operación inicial sencilla.

- El tenant habilita pouch desde la configuración de terminaciones y elige
  los materiales/variantes ofrecidos por formato, espesor en micrones y acabado
  disponibles en su catálogo. La selección para una venta debe quedar visible.
- La unidad es **una hoja física plastificada individualmente, con un pouch**.
  Simple y doble faz consumen un pouch por hoja; elegir precio de impresión
  por carilla no cambia este conteo. Se usan las hojas físicas reales, incluida
  la última hoja impar, sin duplicar el material por caras.
- El selector muestra sólo variantes habilitadas que contienen la hoja con
  el margen de sellado del material. Se comprueban dimensiones y orientación;
  una etiqueta «A4» u «Oficio» por sí sola no acredita compatibilidad.
  No se cambia de espesor/acabado ni se achica el original automáticamente.
- Inicialmente se plastifican todas las hojas físicas del archivo seleccionado.
  Para plastificar sólo una parte, se configura como segmento separado. En un
  tomo, el pouch se elige por archivo/segmento y usa sus juegos como copias
  efectivas; el anillado sigue siendo una terminación del tomo por ejemplar.
- Pouch y anillado pueden coexistir donde el armado sea producible. El espesor
  final y las dimensiones de las hojas plastificadas deben participar en la
  validación del anillo y las tapas. Se preserva la selección por segmento al
  guardar y reabrir el tomo.
- El motor calcula material, tiempo y precio de esta terminación con su
  configuración. El importe se agrega una sola vez después del mínimo de
  impresión más preparación; no altera el volumen de impresión ni agrega
  otro cargo de preparación del pedido. Los costos operativos del paso se
  conservan y su IVA se desglosa sin duplicación.
- Si faltan material compatible, configuración productiva o costeo, se conserva
  el borrador con el motivo y se bloquea el cierre de esa selección. No se
  omite el pouch silenciosamente ni se lo cobra como gratuito.

Ejemplos ficticios: un documento de 10 páginas, tres copias y simple faz genera
30 hojas y 30 pouches; en doble faz genera 15 hojas y 15 pouches. Uno de 11
páginas, tres copias y doble faz genera 18 hojas y 18 pouches, cualquiera sea
el tratamiento comercial de la última cara de D15.

La oferta inicial de pouch corresponde a hojas y segmentos de tomos. La ruta
actual CAD conserva sus restricciones de terminaciones; ofrecer CAD por ML
no habilita automáticamente plastificar rollos. El alcance del motor general
para acomodar varias piezas en un pouch también se conserva: este recorrido
de Centro de copiado debe solicitar expresamente plastificado individual.

**Base existente y trabajo necesario:**

| Punto | Evidencia y cambio previsto |
| --- | --- |
| Familia del motor | [Familias de pasos](../apps/api/src/productos-servicios/pasos/familias.ts): `plastificado_pouch`, opcional, material obligatorio en slot `pouch`, relación M-0 y tiempo T-2. Reutilizarla; no exigir una nueva plantilla de máquina para poder ofrecer la terminación. |
| Material y unidades | [Presets de materiales](../apps/api/prisma/seed-modulos/material-presets.js) y [unidades](../apps/api/src/inventario/material-units.ts): `LAMINADO_POUCH`, variantes con medidas, micrones, acabado y unidades por pack. Usar costo/consumo por pouch, respetando la conversión de compra por pack; no confundir una funda con dos unidades por sus caras. |
| Geometría | [Dispatcher del motor](../apps/api/src/motor-universal/nesting-dispatcher.ts) y [configuración de geometría](../apps/api/src/motor-universal/nesting-config.ts): el cálculo actual puede acomodar varias piezas por pouch y descuenta el margen no usable. Agregar un modo explícito de plastificado individual para CC, conservando la validación de encaje y el comportamiento general existente. |
| Catálogo y configuración de CC | [Dominio](../apps/api/src/centro-copiado/centro-copiado.domain.ts), [DTO de configuración](../apps/api/src/centro-copiado/dto/centro-copiado-config.dto.ts) y [pantalla](../src/components/comercial/centro-copiado-config-view.tsx): hoy el catálogo y el DTO sólo admiten Anillado. Ampliar catálogo, habilitación, variantes y validación por tenant. |
| Ruta y disponibilidad | [Provisión de plantilla](../apps/api/src/centro-copiado/provisionar-plantilla.ts) y [salud](../apps/api/src/centro-copiado/centro-copiado-salud.service.ts): incorporar el paso opcional de forma idempotente, sin alterar pasos existentes; comprobar material y configuración de tiempo/costo antes de ofrecerlo. |
| Cotización y guardado | [Servicio](../apps/api/src/centro-copiado/centro-copiado.service.ts), [adaptador](../apps/api/src/centro-copiado/adaptador.ts) y [persistencia de tomos](../apps/api/src/centro-copiado/persistencia-tomo.ts): actualmente el desglose está centrado en anillado. Generalizar el resultado de terminaciones, conservar pouch por segmento y separar impresión por matriz del adicional calculado por el motor. |
| Contrato y venta | [API del navegador](../src/lib/centro-copiado-api.ts) y [selector de CC](../src/components/comercial/centro-copiado-sheet.tsx): transportar variante, cantidad y desglose de pouch en vista previa, guardado, edición y resumen. La unidad del documento sigue siendo hoja/libro según corresponda; agregar pouch no lo convierte en libro. |

El modo individual debe contar una funda por hoja efectiva, sin fingir medidas
mayores para impedir el acomodo. La separación de importes debe usar el mismo
cálculo en todos los recorridos. El código actual desglosa anillado comparando
cotizaciones con y sin el paso; al incorporar matrices y varias terminaciones
hay que preservar un desglose coherente que no cobre nuevamente impresión,
preparación o mínimos ni reste resultados de políticas de precio diferentes.

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
La sección CAD usa únicamente ML conforme a D35; las medidas
en ML se cobran por el largo de papel consumido según D31, con redondeo
configurable según D32 y acumulación según D33.

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

## Cierre de decisiones funcionales

P01 está resuelto en D09 y D10, P02 en D11 y D12, P03 en D13, P04 en D14 y P05
en D15, P06 en D16 a D19, P07 en D20, P08 en D21, P09 en D22 y el alcance de P10
en D23, P11 en D24, P12 en D25 y P13 en D26 y D27. D28 amplía el alcance inicial
con la simulación de costos de todas las celdas de las matrices. D29 resuelve
tomos y terminaciones de P14. D31 a D33 definen el consumo, redondeo y
acumulación CAD. D35 cierra P14 limitando esta etapa a ML; D34 queda como
antecedente fuera de alcance. D36 y D37 cierran P15. D38 incorpora pouch.

| Referencia | Tema | Resolución |
| --- | --- | --- |
| P14 | Formatos y modalidades CAD | Resuelto por D35: sólo ML, con consumo de medidas estándar o personalizadas producibles y ofrecidas. Sin precio por plano/formato o m² en esta etapa. |
| P15a | Empresas existentes | Resuelto por D36: conservar su operación hasta configuración, revisión y activación explícitas. |
| P15b | Altas y retiros de oferta | Resuelto por D37 con criterio delegado: habilitación expresa, retiro sin borrar históricos, revisión de borradores y respeto de compromisos emitidos. |
| Ampliación | Plastificado pouch | Incorporado por D38, con integración sobre la familia del motor existente y cobro por hoja física plastificada. |

**No quedan decisiones de negocio bloqueantes identificadas para el alcance
inicial.** La definición funcional queda cerrada con las decisiones vigentes.

El trabajo restante es diseño técnico, implementación y validación: pantallas,
modelo de datos, permisos concretos e integración del cálculo. Sólo se volverá
a consultar si aparece una elección que cambie el comportamiento comercial
acordado. Las ideas antiguas de comodines y las modalidades CAD pospuestas
no agregan requisitos a la primera entrega.

## Casos y resultados esperados

Todos los ejemplos son ficticios. Los conteos describen documentos separados
cuyas copias comienzan en un frente. La unidad sigue D09 y D10 y la acumulación,
D11 y D12, con cobertura diferenciada según D27. El precio del tramo se aplica
según D13 y los rangos siguen D14.
La clasificación comercial de la última hoja sigue D15. Los casos CAD vigentes
siguen D31 a D33 y D35, con el tramo en ML determinado antes del redondeo
comercial del grupo. Activación y oferta siguen D36 y D37; pouch sigue D38.
Las páginas son las seleccionadas para imprimir, no necesariamente todas las
del archivo original.

| Caso | Entrada | Resultado esperado |
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
| CAD personalizado con márgenes | Plano de 600 × 1.200 mm, con 600 mm a lo ancho de un rollo compatible y 5 mm de margen al comienzo y al final. | Sin redondeo comercial, se cobran 1,21 ML de papel consumido según D31; a $5.000 por ML son $6.050 de impresión. Los 1,20 m del plano no sustituyen el largo de salida. |
| Copias en ML | Dos copias del plano anterior, con la misma configuración productiva y sin otros archivos en el grupo. | Aportan 2,42 ML de papel consumido para elegir el tramo. Sin redondeo se facturan 2,42 ML; con incremento de 0,10 ML, 2,50 ML. El redondeo se aplica una sola vez al grupo, no por copia, según D33. |
| Redondeo comercial en ML | Cantidad base de 1,21 ML y tarifa aplicable de $5.000 por ML. | Sin redondeo: 1,21 ML y $6.050. Con incremento de 0,10 ML: 1,30 ML y $6.500. El consumo productivo sigue siendo 1,21 ML; D32 no modifica la geometría ni el costo por ese ajuste comercial. |
| CAD acumulado entre medidas | Archivos A y B con planos de medidas diferentes, misma combinación ML y ancho de rollo, consumos de 2,42 y 1,61 ML incluidas las copias, e incremento de 0,10 ML. | Por combinación, el tramo se elige con 4,03 ML y se facturan 4,10 ML al precio de ese tramo. Incluye cargas separadas dentro del pedido. |
| CAD por archivo | Los mismos archivos, con la alternativa de acumulación por archivo. | A busca el tramo con 2,42 ML y factura 2,50 ML; B busca con 1,61 ML y factura 1,70 ML. Se facturan 4,20 ML en total, cada parte al precio de su tramo. |
| CAD con distinto rollo | Archivos con el mismo papel y K, pero distinto ancho de rollo. | En ML forman grupos separados; cada uno determina su tramo y aplica su redondeo. |
| Redondeo junto al límite | Consumo del grupo de 3,96 ML, incremento de 0,10 ML y un tramo que comienza en 4 ML. | Se facturan 4,00 ML, pero el tramo se elige con 3,96 ML. El redondeo no habilita el tramo de 4 ML. |
| CAD sólo ML | Se crea un tarifario y se cotizan planos estándar y personalizados. | Precio y tramos se expresan en ML de papel consumido. No se ofrecen ni se generan matrices por plano/formato o m². |
| Pedido mixto | Documentos por hoja y planos por ML dentro del mismo pedido y política principal. | Los tramos se calculan por separado en sus unidades. Preparación y mínimo siguen siendo únicos para el pedido; las celdas de ambas secciones pueden simularse con el motor. |
| Empresa sin activar tarifarios | Se publica la mejora y una empresa continúa con su configuración anterior. | Conserva su comportamiento; crear borradores de oferta o tarifas no los activa. Pouch no se agrega automáticamente a su oferta. |
| Oferta retirada en borrador | Un borrador contiene una combinación retirada antes de emitir. | Se conserva para editar, se muestra el motivo y se bloquea emisión/cierre hasta resolver la oferta y revisar el cálculo. |
| Oferta retirada con compromiso | Se retira un papel usado por un presupuesto emitido vigente. | Se conserva el precio y la configuración comprometidos según D24; las nuevas ventas no ofrecen ese papel. |
| Pouch y caras | Documento de 10 páginas, tres copias, plastificado individual de todas sus hojas. | Simple faz: 30 hojas y 30 pouches. Doble faz: 15 hojas y 15 pouches. El conteo no depende de si la impresión se cobra por hoja o carilla. |
| Pouch con última hoja impar | Documento de 11 páginas, tres copias, doble faz. | 18 hojas y 18 pouches. D15 puede cambiar el precio de impresión de la última hoja, pero no el consumo de fundas. |
| Pouch dentro de tomo | Tomo de cinco juegos con un segmento de dos páginas simple faz seleccionado para pouch y el resto sin plastificar. | 10 pouches para ese segmento; el anillado, si se selecciona, se calcula sobre cinco ejemplares con su espesor final. Reabrir el tomo conserva ambas selecciones sin duplicar cantidades. |
| Pouch incompatible | Hoja que no cabe en el material elegido descontando su margen de sellado. | Se explica la incompatibilidad y se bloquea el cierre hasta corregirla; no se reduce la hoja ni se omite la terminación. |
| Pouch y mínimo | Impresión más preparación quedan bajo el mínimo y se selecciona pouch. | Primero se aplica el mínimo de D19 a impresión más preparación; luego se suma el pouch con su material, trabajo e IVA correspondientes. |

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

La implementación de D35 debe separar los ML comerciales CAD del conteo
de páginas y copias y conservar las medidas reales por página. ML debe
persistirse como modalidad del tarifario y participar en vista previa, guardado,
edición y simulación desde el alcance inicial. Los límites y referencias de
los tramos de ML deben contemplar cantidades decimales. D31 requiere obtener
la cantidad comercial del largo de salida previsto por página y sus copias efectivas,
incluidos los márgenes de avance, conservando por separado las dimensiones del
original. La simulación, vista previa y guardado deben compartir ese cálculo.
Las agrupaciones y el momento del redondeo en ML siguen D33. No se requiere
implementar conversión comercial a m² o precio fijo por formato en esta etapa.

La configuración de D32 debe pertenecer a la versión del tarifario y conservar
la cantidad previa y posterior al ajuste comercial. El cálculo debe manejar
los incrementos decimales sin agregar un paso de redondeo cuando ya se alcanza
un múltiplo exacto. No debe modificar las medidas ni los consumos usados para
costear, ni repetir el ajuste en vista previa, guardado o recotización.

La integración de D33 debe agrupar dentro del pedido y tenant correspondientes,
respetando la modalidad por combinación o por archivo. En ML se conserva la
cantidad sin redondear que determina el tramo y se aplica el incremento una
sola vez al total del grupo. Vista previa, guardado, recotización y simulación
deben compartir ese orden y registrar la composición del grupo, consumo,
tramo, regla de redondeo y cantidad facturada. Si el guardado separa renglones
por archivo, el diseño debe conservar el total comercial del grupo sin
repetir su redondeo ni perder el desglose de consumos físicos.

La implementación de D36 y D37 debe preservar los valores efectivos de la
configuración anterior, versionar o conservar instantáneas de la oferta y
validar su vigencia al emitir. Las migraciones deben ser aditivas y conservar
datos e históricos; no deben regenerar precios ni activar nuevas terminaciones
por ampliar listas por defecto. El cambio de política debe alcanzar todos los
recorridos de cotización y guardado sin alterar pedidos ya comprometidos.

D38 requiere separar las terminaciones por hoja de las de armado por ejemplar.
El registro de cada segmento debe conservar variante de pouch, cantidad física,
consumo, tiempo, precio e impuestos del cálculo. La selección y el modo
individual se validan en el servidor. Los cambios al motor general deben
conservar sus usos existentes de varias piezas por pouch; la configuración
especial de Centro de copiado no debe alterar otras recetas del tenant.

El modelo de almacenamiento y el punto exacto de integración se definirán
en el diseño técnico. La separación por tenant, los permisos, el
desglose comercial y las validaciones de oferta deben conservarse en todos los
recorridos. El tarifario no cambia las cantidades físicas usadas por producción.

## Orden de trabajo propuesto

1. Diseñar el modelo de oferta, versiones, tarifarios y cálculo común con las
   decisiones D01 a D38 vigentes y el cierre CAD sólo ML de D35. Precisar las
   migraciones aditivas y la activación compatible de D36 y D37.
2. Diseñar la experiencia de Oferta, Tarifarios y Canales, incluida la simulación
   de costos de todas las celdas y la configuración de pouch de D38.
3. Implementar oferta, matrices, versiones y canales con un cálculo comercial
   compartido. Integrar hojas/carillas, cobertura, CAD por ML, prioridad de
   precios, preparación, mínimos y controles de margen.
4. Integrar tomos y terminaciones, incluido pouch: catálogo y materiales,
   paso opcional, modo individual, selección por segmento y persistencia del
   desglose. Reutilizar el motor para costos y adicionales.
5. Implementar las herramientas de carga/actualización y simulación completa,
   y conectar edición, recotización y emisión al mismo cálculo.
6. Verificar en local con datos ficticios los casos acordados, la preservación
   de empresas sin activar y la separación por tenant. Para pouch comprobar
   simple/doble faz, impares, copias/juegos, encaje, unidades de pack, combinación
   con anillado, guardado/reapertura y ausencia de cargos duplicados. Verificar
   que el modo general de varias piezas por pouch siga funcionando.
7. Preparar un lote coherente para validación en staging según el
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
| 2026-10-10 | Incorporación de D31: en ML se cobra el largo de papel consumido previsto, incluidos los márgenes de avance, según rollo, orientación y copias. Se descarta cobrar sólo el largo del plano como modalidad. Se agregan ejemplos; redondeos y base facturable de m² permanecen pendientes en P14. | Confirmado parcial |
| 2026-10-10 | Incorporación de D32: sin redondeo comercial como opción inicial en ML y redondeo hacia arriba por incremento configurable por tarifario como alternativa. Se conservan consumo y cantidad facturada por separado. El momento del redondeo y la cantidad para seleccionar el tramo se resolverán con la acumulación CAD en P14. | Confirmado parcial |
| 2026-10-10 | Incorporación de D33: acumulación CAD por combinación dentro del pedido como opción inicial y por archivo como alternativa. En ML se agrupa por papel, gramaje, ancho de rollo, impresión y tarifario, con cobertura cuando se cobra diferenciada; las medidas pueden variar. El consumo sin redondear determina el tramo y se redondea una sola vez por grupo. Se agregan ejemplos de límites, copias y formatos; P14 conserva la base facturable de m² y demás reglas de medidas pendientes. | Confirmado parcial |
| 2026-10-10 | Incorporación de D34: en m² se cobra el ancho completo del rollo por largo consumido, con márgenes y copias, antes del redondeo comercial de ML. Se registra ML como prioridad operativa y m² como alternativa de uso secundario. Revisión de pendientes: quedan P14, P15a y P15b para el cierre funcional; sus propuestas aún requieren confirmación. | Confirmado parcial |
| 2026-10-10 | D35 reemplaza la elección de unidades de D30: CAD sólo por ML en esta etapa. Precio por plano/formato y m² quedan pospuestos, incluida D34. Se actualizan alcance, ejemplos y simulación; P14 queda resuelto. | Confirmado |
| 2026-10-10 | D36 confirma conservar la operación de empresas existentes hasta preparación, revisión y activación explícitas. D37 resuelve altas y retiros por criterio delegado: oferta nueva deshabilitada inicialmente, retiro sin borrar históricos, bloqueo de borradores afectados y respeto de compromisos emitidos. P15a y P15b quedan resueltos. | Confirmado / criterio delegado |
| 2026-10-10 | D38 incorpora plastificado pouch al alcance inicial. Revisión del catálogo de CC, familia del motor, materiales y geometría existentes; definición del recorrido por hoja física y del trabajo de integración en tomos, configuración y guardado. Se cierra la definición funcional y se actualiza el orden de implementación. | Alcance confirmado; implementación pendiente |

### Avance de implementación: editor de tarifarios y canales (10/10/2026)

Disponible en la rama de desarrollo el editor de Configuración → Centro de
copiado: matrices de hojas y CAD por ML, coberturas, reglas comerciales, rangos y
excepciones, carga manual/pegado tabulado, ajustes masivos revisables, duplicación,
versiones inmutables y asignación general con excepciones por canal. Las pantallas
mantienen explícito el estado **en preparación**; publicar no activa todavía el
uso de matrices en pedidos.

El alcance y las pruebas están en el
[registro de implementación](centro-copiado-tarifarios-plan-implementacion.md).
D23 conserva como pendiente dentro de la primera entrega la generación y
aceptación revisada de sugerencias del motor. Las decisiones funcionales
confirmadas no cambian.

### Avance de implementación: simulación de costos (10/10/2026)

El editor permite recorrer todas las celdas, las filtradas o una selección,
incluidos los precios pendientes. Reutiliza el motor para hojas/carillas y CAD
por ML consumidos. Muestra costo por unidad y total, cantidad, cobertura, fecha,
geometría CAD, venta sin IVA y margen productivo. Editar un precio actualiza la
comparación sin cambiar el costo ni su fecha. Preparación y mínimo comerciales
se componen una vez por referencia; la preparación productiva se costea aunque
comercialmente esté incluida. La última hoja impar sólo imprime una cara.

El resultado es una referencia productiva, **antes de comisiones y otros gastos
comerciales**, y no sustituye el futuro control completo de D25. Los resultados
son temporales y corresponden a los costos consultados en ese momento, incluso
al simular una versión histórica. Cambiar la estructura de la matriz invalida
la comparación; los cambios externos de costos requieren volver a simular.
Los permisos de configuración y de márgenes se exigen conjuntamente.

Precisiones de referencia: el primer tramo CAD comienza en cero pero usa un
consumo positivo representable; se pueden cambiar las medidas y copias. Si hay
varias recetas CAD compatibles se exige elegir una. En doble faz por carilla
con última hoja a simple, el volumen doble debe ser par: se usa el primer par
del tramo, o se informa que esa celda no tiene referencia representable.
Los errores de configuración y los recorridos detenidos permanecen explícitos.
Detalles, límites técnicos y pruebas en el registro de implementación.
