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

**Simple faz y doble faz tienen precios propios.** La tarifa doble faz no debe
quedar obligatoriamente calculada como dos veces la tarifa simple faz. Una futura
ayuda para completar celdas podrá proponer valores, pero debe permitir editar
cada precio.

La decisión sobre caras no define todavía si se cobra por hoja física o carilla,
ni qué cantidad determina el tramo. Esas preguntas siguen pendientes.

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
del 3 de agosto de 2026. Se conserva como antecedente. Sus recomendaciones de
reglas con comodines, cobro por hoja, volumen por documento y retorno automático
al motor no se consideran decisiones confirmadas para este trabajo.

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

La unidad del precio y la cantidad usada para buscar el tramo deben quedar
explícitas. También debe definirse si los rangos son comunes a todo el tarifario
o pueden variar entre combinaciones.

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

Las primeras cinco preguntas definen cómo leer y calcular la matriz. Las demás
deben resolverse antes de activar el recorrido completo.

| Referencia | Pregunta por resolver | Propuesta inicial o aspecto a contrastar |
| --- | --- | --- |
| P01 | ¿Qué unidad expresa el precio y cuál determina el tramo: hojas físicas, carillas impresas, copias o juegos? | Registrar ambas bases explícitamente; pueden ser distintas. Confirmar con casos ficticios que reproduzcan la operación. |
| P02 | ¿El volumen se cuenta por archivo, tomo, carga o pedido completo? ¿Qué combinaciones pueden acumularse? | Evaluar una opción por documento y otra por combinación dentro del pedido; precisar si incluye varias cargas de Centro de copiado. |
| P03 | ¿Se usa la tarifa del tramo para todas las unidades o un cobro progresivo por tramos? | Se propuso aplicar la tarifa alcanzada a todas las unidades; revisar saltos de total en los límites. |
| P04 | ¿Cada matriz comparte rangos o una combinación puede tener sus propios límites? | Evitar imponer los mismos rangos a operaciones que los necesitan distintos. |
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
cuyas copias comienzan en un frente; no fijan todavía la unidad ni la regla de
cobro. Las páginas son las seleccionadas para imprimir, no necesariamente todas
las del archivo original.

| Caso | Entrada | Resultado que falta acordar |
| --- | --- | --- |
| Simple y doble faz | El mismo documento de 10 páginas, una copia, A4 y K, en ambas opciones. | Usar las dos tarifas independientes de D04 y definir sus unidades. Conteo físico: 10 hojas simple y 5 doble. |
| Última cara vacía | 11 páginas, 3 copias, doble faz. | Son 33 carillas y 18 hojas; decidir el tramo y el tratamiento de las 3 hojas finales con una cara sin imprimir. |
| Volumen entre archivos | Un archivo de 100 páginas frente a dos de 50, con igual papel, tamaño, color y caras. | Determinar cuándo deben tener el mismo precio de impresión y cómo interviene la preparación. |
| Páginas y copias | Un archivo de 100 páginas con una copia frente a uno de 10 páginas con diez copias, simple faz. | Ambos suman 100 carillas y hojas; decidir si alcanzan el mismo tramo. |
| Cantidades en doble faz | Un archivo de 10 páginas con una copia frente a diez archivos de una página, todos configurados en doble faz. | Aunque sumen 10 carillas, usan 5 y 10 hojas respectivamente; precisar acumulación y tratamiento de caras vacías. |
| Impresión mixta | Un pedido con K y CMYK, o con papeles distintos. | Definir qué unidades se acumulan para cada tramo y qué tarifa recibe cada parte. |
| Rango de páginas | Imprimir sólo 10 páginas seleccionadas de un PDF de 100 páginas. | Distinguir la selección de páginas del tramo comercial por cantidad. |
| Límite de tramo | Cantidades 49, 50 y 51 para un tarifario que cambia en 50. | Acordar precios totales y advertencias ante saltos no deseados. |
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
precio. Así se puede explicar el cálculo histórico. Si se acumula volumen entre
documentos, la recotización debe considerar al conjunto afectado y distribuir
sus importes de forma consistente.

El modelo de almacenamiento y el punto exacto de integración se definirán
después de las reglas funcionales. La separación por tenant, los permisos, el
desglose comercial y las validaciones de oferta deben conservarse en todos los
recorridos. El tarifario no cambia las cantidades físicas usadas por producción.

## Orden de trabajo propuesto

1. Resolver P01 a P05 con ejemplos y completar las reglas comerciales que
   condicionan el primer alcance.
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
