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
| D13 | El precio unitario del tramo alcanzado se aplica a todas las unidades del grupo comercial. En la alternativa por archivo, se aplica a todas las unidades de ese archivo. La regla vale por hoja o por carilla según el tarifario; no se cobra progresivamente. Resuelve P03. | 2026-10-10 |
| D14 | Cada tarifario tiene rangos generales que las combinaciones usan inicialmente. Se pueden definir rangos propios como excepción por combinación. Compartir rangos no implica compartir precios ni acumular volumen entre combinaciones distintas. Resuelve P04. | 2026-10-10 |

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

P01 queda resuelto. El cobro de la última hoja con una sola cara impresa (P05)
sigue pendiente. Mezclar una unidad para el precio y otra para los tramos no
forma parte de la modalidad inicial acordada.

### Acumulación del volumen entre archivos

**Confirmado en D11 y D12:** la opción inicial suma las unidades de los archivos
que comparten papel y gramaje, tamaño, tipo de impresión, caras y tarifario
dentro del mismo pedido. Cada archivo conserva su cantidad; el volumen del
grupo determina el tramo comercial. Simple y doble faz acumulan por separado,
igual que K y CMYK. La unidad de acumulación sigue D09 y D10.

Como alternativa por tarifario, el tenant puede elegir «Por archivo». En ese
modo cada archivo determina su tramo con sus propias unidades, incluidas sus
copias o juegos efectivos, sin sumar las de otros archivos.

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
Los archivos mantienen sus instrucciones de impresión. El tratamiento de
preparación y terminaciones conserva sus pendientes propios. P02 queda resuelto;
sumar todas las combinaciones indistintamente no forma parte de las modalidades
acordadas.

### Aplicación del precio del tramo

**Confirmado en D13:** se elige el tramo usando la cantidad determinada por D09
a D12 y se aplica su precio unitario a todas las unidades de ese grupo. Cada
archivo se cobra por su propia cantidad multiplicada por ese precio común. En
la modalidad «Por archivo», cada uno busca el tramo con su propia cantidad.

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
los saltos. Los ejemplos muestran la aplicación de la tarifa; sus conceptos
incluidos y cargos adicionales conservan el pendiente P06.

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

P01 está resuelto en D09 y D10, P02 en D11 y D12, P03 en D13 y P04 en D14. P05
completa la definición inicial de cómo contar y cobrar las caras. Las demás
preguntas deben resolverse antes de activar el recorrido completo.

| Referencia | Pregunta por resolver | Propuesta inicial o aspecto a contrastar |
| --- | --- | --- |
| P05 | En doble faz, ¿cómo se cobra la última hoja cuando tiene una sola cara impresa? | Confirmar si toda la tirada lleva tarifa doble faz o si la última hoja usa tarifa simple. D04 no resuelve este caso. |
| P06 | ¿Qué incluye el precio cargado? | Precisar papel, impresión, IVA, preparación, mínimos y terminaciones para evitar cobros duplicados. |
| P07 | ¿Qué prioridad tienen el tarifario, los acuerdos por cliente, descuentos y ajustes manuales? | Definir una prioridad única, permisos y explicación del resultado. |
| P08 | ¿Qué ocurre ante una combinación sin precio? | Mostrar la falta de tarifa. Usar el motor o heredar otra matriz sólo si la política elegida lo permite explícitamente. |
| P09 | ¿Cómo se elige la política por canal y qué pasa si se cambia el canal de una propuesta? | Definir la política general, la recotización de borradores y el tratamiento de documentos emitidos. |
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
Las demás reglas conservan los pendientes indicados en cada caso.
Las páginas son las seleccionadas para imprimir, no necesariamente todas las
del archivo original.

| Caso | Entrada | Resultado acordado o decisión pendiente |
| --- | --- | --- |
| Simple y doble faz | El mismo documento de 10 páginas, una copia, A4 y K, en ambas opciones. | Tarifario por hoja: 10 unidades simple y 5 doble. Por carilla: 10 en ambas modalidades. Precios independientes según D04. |
| Última cara vacía | 11 páginas, 3 copias, doble faz. | Conteo: 33 carillas y 18 hojas. D09 y D10 fijan la unidad; P05 debe resolver el tratamiento comercial de las 3 hojas finales con una cara sin imprimir. |
| Volumen entre archivos | Un archivo de 100 páginas frente a dos de 50, una copia, simple faz y la misma combinación y tarifario. | Por combinación, ambos escenarios consideran 100 hojas y aplican la tarifa alcanzada a todas ellas. Por archivo, consideran 100 frente a 50 por archivo. La preparación conserva su pendiente. |
| Páginas y copias | Un archivo de 100 páginas con una copia frente a uno de 10 páginas con diez copias, simple faz. | Ambos aportan 100 unidades, por hoja o por carilla. A igualdad de combinación y tarifario y sin otros archivos, tienen la misma cantidad para buscar el tramo. |
| Cantidades en doble faz | Un archivo de 10 páginas con una copia frente a diez archivos de una página, todos configurados en doble faz. | Aunque sumen 10 carillas, usan 5 y 10 hojas respectivamente. D11 define cómo acumularlas; P05 conserva el tratamiento comercial de las hojas con una cara vacía. |
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
afectado y aplicar a cada archivo el precio unitario común sobre sus propias
unidades, según D13.

El modelo de almacenamiento y el punto exacto de integración se definirán
después de las reglas funcionales. La separación por tenant, los permisos, el
desglose comercial y las validaciones de oferta deben conservarse en todos los
recorridos. El tarifario no cambia las cantidades físicas usadas por producción.

## Orden de trabajo propuesto

1. Partir de P01 a P04 resueltos en D09 a D14, resolver P05 con ejemplos y
   completar las reglas comerciales que condicionan el primer alcance.
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
