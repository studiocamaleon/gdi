# Centro de copiado decisiones de oferta y tarifarios

**Estado:** definición funcional en curso, antes de implementar.
**Creado y actualizado:** 10 de octubre de 2026.

Centro de copiado necesita representar la forma de vender de cada gráfica: una
oferta de papeles y tamaños, matrices de precios por cantidad, tipo de impresión
y caras, y la posibilidad de cobrar distinto según el canal de compra. La
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
| D09 | La unidad se elige por tarifario: hoja física como opción inicial y carilla impresa como alternativa. | 2026-10-10 |
| D10 | El precio y los tramos usan la misma unidad elegida en el tarifario. Un tramo de 100 en un tarifario por hoja significa 100 hojas físicas, también en doble faz. Resuelve P01 junto con D09. | 2026-10-10 |
| D11 | La acumulación se configura por tarifario: por combinación dentro del pedido como opción inicial y por archivo como alternativa. | 2026-10-10 |
| D12 | La combinación reúne el mismo papel y gramaje, tamaño, K/CMYK, simple/doble faz y tarifario. Se considera todo el pedido, incluidas distintas cargas de Centro de copiado. Resuelve P02 junto con D11. | 2026-10-10 |
| D13 | El precio unitario del tramo alcanzado se aplica a todas las unidades del grupo comercial. En la alternativa por archivo, se aplica a todas las unidades de cada combinación comercial de ese archivo. La regla vale por hoja o por carilla según el tarifario; no se cobra progresivamente. Resuelve P03; D15 precisa la separación de la última hoja cuando corresponda. | 2026-10-10 |
| D14 | Cada tarifario tiene rangos generales que las combinaciones usan inicialmente. Se pueden definir rangos propios como excepción por combinación. Compartir rangos no implica compartir precios ni acumular volumen entre combinaciones distintas. Resuelve P04. | 2026-10-10 |
| D15 | El tratamiento de la última hoja con una sola cara impresa se configura por tarifario: «Mantener tarifa doble faz» como opción inicial y «Última hoja a simple faz» como alternativa. Se aplica por copia física, también a un archivo de una sola página configurado doble faz. Resuelve P05. | 2026-10-10 |
| D16 | Cada precio de la matriz incluye el papel elegido y la impresión según color y caras. Las terminaciones se cobran aparte cuando se seleccionan, incluidos sus materiales. Aplica a tarifarios por hoja y por carilla. Resuelve los conceptos incluidos de P06; el IVA se define en D17, la preparación en D18 y los mínimos en D19. | 2026-10-10 |
| D17 | La interpretación del precio cargado se elige por tarifario: «IVA incluido» como opción inicial y «Más IVA» como alternativa. Aplica a todas sus combinaciones, incluidas las que tienen rangos propios. Resuelve el IVA dentro de P06; la preparación se define en D18 y los mínimos en D19. | 2026-10-10 |
| D18 | La preparación se configura por tarifario: «Preparación incluida» como opción inicial y «Cargo fijo por pedido» como alternativa, con importe configurable y mostrado por separado. El cargo se aplica una sola vez al conjunto de Centro de copiado del pedido. Resuelve la preparación dentro de P06; los mínimos se definen en D19. | 2026-10-10 |
| D19 | Los mínimos se configuran por tarifario: «Sin mínimo» como opción inicial y «Mínimo de importe por pedido» como alternativa. Se aplica una sola vez sobre impresión más preparación de Centro de copiado; las terminaciones se agregan aparte. Sólo se cobra la diferencia necesaria para alcanzar el mínimo, sin alterar cantidades reales ni tramos. Completa P06 junto con D16 a D18. | 2026-10-10 |

**Simple faz y doble faz tienen precios propios.** La tarifa doble faz no debe
quedar obligatoriamente calculada como dos veces la tarifa simple faz. Una futura
ayuda para completar celdas podrá proponer valores, pero debe permitir editar
cada precio.

### Unidad del precio y de los tramos

**Confirmado en D09 y D10:** cada tarifario permite elegir entre hoja física y
carilla impresa. La opción inicial es por hoja física; esa misma unidad expresa
el precio de cada celda y los límites de los tramos. La elección pertenece al
tarifario y debe mostrarse al cargar y consultar sus precios.

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
El tratamiento de documentos emitidos conserva el pendiente P11.

La acumulación es comercial: no une originales ni exige agruparlos en un tomo.
Los archivos mantienen sus instrucciones de impresión. La preparación sigue
D18; las terminaciones se cobran aparte según D16 y su integración
conserva P14. P02 queda resuelto. Sumar todas las combinaciones indistintamente
no forma parte de las modalidades
acordadas.

### Aplicación del precio del tramo

**Confirmado en D13:** se elige el tramo usando la cantidad determinada por D09
a D12, con la clasificación de caras de D15, y se aplica su precio unitario a
todas las unidades de ese grupo. Cada parte del archivo se cobra por su propia
cantidad multiplicada por el precio de su grupo. En la modalidad «Por archivo»,
cada combinación comercial busca el tramo con su cantidad dentro de ese archivo.

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
los saltos. Los ejemplos muestran la aplicación de la tarifa, que incluye papel
e impresión según D16. El IVA sigue D17, la preparación D18 y los mínimos D19.

### Rangos generales y excepciones por combinación

**Confirmado en D14:** cada tarifario define unos rangos generales y las
combinaciones los usan inicialmente. Cuando una combinación necesita límites
diferentes, puede usar sus propios rangos. La unidad sigue siendo la elegida
para todo el tarifario según D09 y D10.

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
real de papel. La integración del armado de tomos conserva el pendiente P14 y
la ausencia de una tarifa simple necesaria se resolverá según P08.

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
y los mínimos en D19. La política para calcular el precio de las terminaciones
y su integración con tomos se completará en P14.

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

Como propuesta para P10 y P11, cambiar esta modalidad en un tarifario con
precios cargados debería mostrar su impacto antes de guardar. La conversión de
esos precios y el tratamiento de cotizaciones existentes siguen pendientes.

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
modalidades acordadas. Si P09 habilita varios tarifarios dentro de un pedido,
deberá definir cuál determina el único cargo de preparación, sin multiplicarlo
automáticamente por cada tarifario. La preparación integra el importe que se
compara con el mínimo según D19.

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
IVA, respetando D17 y la configuración fiscal del sistema. La prioridad de
descuentos y ajustes manuales respecto del mínimo se resolverá en P07. Si P09
habilita varios tarifarios dentro del pedido, deberá resolver cuál determina
el mínimo único.

El mínimo de hojas facturables por documento existente no es una modalidad del
nuevo esquema acordado. Su migración y la habilitación de los tarifarios se
resolverán en P15, sin cambiar automáticamente la operación de tenants actuales.

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
| Cotización y guardado del módulo | [Servicio de Centro de copiado](../apps/api/src/centro-copiado/centro-copiado.service.ts) y [pedido de cotización](../apps/api/src/centro-copiado/dto/cotizar-centro-copiado.dto.ts) |
| Canales existentes | [Canales de venta](../src/lib/canales-venta.ts) |
| Guardado y recotización desde la ficha | [Ficha comercial](../src/components/comercial/propuesta-ficha.tsx) |

Hay un [diseño anterior de precios manuales](centro-copiado-precio-manual-diseno.md),
del 3 de agosto de 2026. Se conserva como antecedente. Las decisiones vigentes
son las registradas arriba. El volumen por archivo queda como alternativa según
D11; las propuestas de reglas con comodines y retorno automático al motor
continúan sin confirmarse.

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

La estructura propuesta es:

**Papel y gramaje × tamaño × K o CMYK × simple o doble faz × tramo de cantidad.**

La unidad del precio y de los tramos se elige por tarifario según D09 y D10:
hoja física inicialmente, con carilla impresa como alternativa. Los rangos son
generales por tarifario, con excepciones por combinación según D14.

Se proponen dos acciones para generar una matriz:

1. **Generar la estructura:** crear las combinaciones habilitadas y los tramos
   configurados por el tenant.
2. **Completar los precios:** cargar valores, copiar otro tarifario o generar
   sugerencias con el motor para revisarlas y redondearlas.

El motor seguiría calculando los costos y la producción. El tarifario
determinaría el precio de venta, con el desglose comercial correspondiente. La
rentabilidad se recalcularía usando ese precio y los costos y cargos aplicables.

Una actualización de costos podría señalar qué tarifas necesitan revisión. Se
propone que los precios publicados permanezcan fijos hasta activar una nueva
versión. La generación de sugerencias, su cantidad de referencia dentro de cada
tramo y las herramientas de edición masiva todavía requieren definición.

Se propone que el simulador señale los descensos de total entre tramos para que
el tenant revise los precios. Esta ayuda sigue como propuesta y no modifica la
regla de cálculo confirmada en D13.

Para editar los rangos se propone una opción «Usar rangos del tarifario», activa
inicialmente en cada combinación. También se propone poder aplicar rangos a
varias combinaciones seleccionadas y señalar los precios que falten al cambiar
los límites, antes de activar la actualización. El detalle de esas herramientas
conserva el pendiente P10.

### Asignación por canal

Separar la identidad del tarifario de su asignación a canales permite compartir
una misma matriz. Ejemplo ficticio:

| Canal | Política propuesta |
| --- | --- |
| Presencial | Tarifario general |
| WhatsApp | Tarifario general |
| Web | Tarifario online |
| Aplicación móvil | Tarifario online |
| Correo electrónico | Precio calculado por el motor |

Se propone que un canal pueda heredar la política general, elegir un tarifario
o usar el motor. Las opciones exactas, la herencia de precios faltantes y el
comportamiento cuando todavía no se eligió canal siguen pendientes.

Para el portal, el servidor debería determinar el canal según el origen del
pedido y usar el mismo cálculo que la operación interna. El dispositivo desde
el que compra la persona no determina por sí solo el canal: un portal abierto
en un celular puede seguir siendo una compra Web.

### Configuración y explicación del precio

Se propone organizar la configuración en Oferta, Tarifarios y Canales, con un
acceso desde Centro de copiado según los permisos del usuario. Un simulador
permitiría comprobar ejemplos antes de activar una matriz.

Durante la venta se mostrarían las opciones habilitadas y el origen del precio,
por ejemplo: «Tarifario online · A4 · Obra 80 g · K · doble faz · tramo 100–499».
Los costos y márgenes conservarían sus permisos de acceso.

## Decisiones pendientes

P01 está resuelto en D09 y D10, P02 en D11 y D12, P03 en D13, P04 en D14 y P05
en D15. P06 está resuelto en D16 a D19. Las preguntas restantes
deben resolverse antes de activar el recorrido completo.

| Referencia | Pregunta por resolver | Propuesta inicial o aspecto a contrastar |
| --- | --- | --- |
| P07 | ¿Qué prioridad tienen el tarifario, los acuerdos por cliente, descuentos y ajustes manuales? | Definir una prioridad única, permisos y explicación del resultado, incluida su relación con el mínimo de D19. |
| P08 | ¿Qué ocurre ante una combinación sin precio? | Mostrar la falta de tarifa. Usar el motor o heredar otra matriz sólo si la política elegida lo permite explícitamente. |
| P09 | ¿Cómo se elige la política por canal y qué pasa si se cambia el canal de una propuesta? | Definir la política general, la recotización de borradores y el tratamiento de documentos emitidos. Si se habilitan varios tarifarios dentro del pedido, resolver cuál determina el único cargo de preparación de D18 y el mínimo de D19. |
| P10 | ¿Cómo se crean y actualizan los precios? | Elegir el alcance inicial entre carga manual, copia, sugerencias del motor, ajustes por porcentaje, redondeo e importación. |
| P11 | ¿Cuándo entra en vigencia una versión y qué pasa con cotizaciones en curso? | Proponer borrador y versión activa, conservar la aplicada en documentos emitidos y detectar cambios entre vista previa y guardado. |
| P12 | ¿Qué ocurre si el precio deja un margen insuficiente o negativo? | Evaluar aviso, bloqueo o autorización según permisos. |
| P13 | ¿La cobertura de impresión afecta el tarifario o solamente el costo? | La cobertura ya existe en el módulo; definir su relación con la matriz. |
| P14 | ¿Cuál es el alcance inicial de tomos, terminaciones y planos CAD? | Proponer tarifas para impresión en hojas e integrar correctamente tomos y terminaciones existentes; evaluar un tarifario CAD por separado. |
| P15 | ¿Cómo se habilita la nueva oferta en tenants existentes? | Proponer conservar su comportamiento hasta que configuren y activen los cambios. Definir el tratamiento de combinaciones nuevas o retiradas. |

## Casos para acordar resultados

Todos los ejemplos son ficticios. Los conteos describen documentos separados
cuyas copias comienzan en un frente. La unidad sigue D09 y D10 y la acumulación,
D11 y D12. El precio del tramo se aplica según D13 y los rangos siguen D14.
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
| Impresión mixta | Un pedido con K y CMYK, o con papeles distintos. | Por combinación, cada grupo acumula por separado según D12; por archivo, cada uno usa sus propias unidades. |
| Varias cargas | Un archivo de 60 hojas y otro de 50 con la misma combinación, agregados en distintas aperturas de Centro de copiado al mismo pedido. | Por combinación, suman 110. Por archivo, mantienen 60 y 50. Agregar o quitar uno actualiza el volumen del grupo en el borrador. |
| Rango de páginas | Imprimir sólo 10 páginas seleccionadas de un PDF de 100 páginas. | Distinguir la selección de páginas del tramo comercial por cantidad. |
| Límite de tramo | Tarifa ficticia de $100 por hoja de 1 a 99, y $80 desde 100. | D13 determina $9.900 para 99 hojas, $8.000 para 100 y $8.080 para 101. El aviso del simulador sigue como propuesta; no se acordó corregir automáticamente el descenso. |
| Aplicación a todo el grupo | Dos archivos de 60 hojas de la misma combinación, tarifa ficticia de $80 desde 100. | Por combinación, las 120 hojas se cobran a $80: $4.800 por archivo y $9.600 en total. |
| Rangos propios | Tarifario con rangos generales 1–49, 50–199 y 200+, y una combinación con rangos propios 1–19, 20–99 y 100+. | Cada combinación busca su tramo en los rangos que le corresponden. La excepción conserva sus límites cuando cambian los generales. Compartir límites no comparte precios ni volumen. |
| Cambio de canal | La misma carga en Presencial y Web. | Aplicar la política de cada canal y definir qué sucede al cambiarlo antes de guardar. |
| Cambio de tarifa | Cotización con una versión y posterior activación de otra. | Definir conservación de emitidos y recotización de borradores. |
| Oferta incompleta | Papel habilitado con un tamaño no ofrecido, o combinación ofrecida sin tarifa. | Distinguir combinación no vendible de precio pendiente, en interfaz y servidor. |
| Tomo con terminación | Dos originales agrupados con varios juegos y anillado. | Reconciliar tarifa de impresión, preparación, terminaciones, resumen y total guardado. |

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
por documento al nuevo tarifario. La prioridad frente a descuentos sigue P07.

El modelo de almacenamiento y el punto exacto de integración se definirán
después de las reglas funcionales. La separación por tenant, los permisos, el
desglose comercial y las validaciones de oferta deben conservarse en todos los
recorridos. El tarifario no cambia las cantidades físicas usadas por producción.

## Orden de trabajo propuesto

1. Partir de P01 a P06 resueltos en D09 a D19 y completar las reglas comerciales
   pendientes que condicionan el primer alcance.
2. Diseñar la experiencia de Oferta, Tarifarios y Canales, incluido el simulador.
3. Implementar la oferta de tamaños por papel y gramaje con compatibilidad para
   configuraciones existentes.
4. Implementar matrices y asignación por canal como un conjunto, incorporando
   versiones y resolución común del precio.
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
