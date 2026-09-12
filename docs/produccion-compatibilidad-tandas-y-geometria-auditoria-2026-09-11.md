# Tandas: compatibilidad de producción, materiales y geometría

**Fecha:** 11/09/2026. **Estado:** investigación y propuesta para revisión; no implementación aprobada. Amplía y corrige el [diseño de colas y UX](produccion-colas-tandas-implementacion-y-ux-2026-09-11.md).

**Decisión posterior de alcance:** el [plan v1](produccion-colas-tandas-v1-2026-09-11.md) prioriza colas y registro conjunto de trabajos conservando sus planes. El recomendador de formatos y los nuevos nestings aquí investigados quedan diferidos. Las restricciones de compatibilidad y de conservación de layouts siguen siendo relevantes; los 44 escenarios de este documento son una matriz de análisis, no 44 pruebas automatizadas ejecutadas.

## 1. Resultado de la investigación

**Actualización del 11/09 a las 20:16:** el usuario vuelve a evaluar nesting en rollos y placas por la limitación de agrupar distintos anchos. La [propuesta acotada](produccion-tandas-nesting-acotado-2026-09-11.md) prioriza rollos rectangulares y deja fuera los acomodos protegidos; sigue pendiente de implementación.

La agrupación debe responder tres preguntas independientes: **¿los trabajos están listos?, ¿pueden producirse con la misma configuración?, ¿se permite modificar su disposición física?** Una respuesta afirmativa a las dos primeras permite organizar una tanda; no autoriza por sí sola a crear un nuevo layout compartido.

La selección debe partir de una máquina física y de grupos de configuración compatible. Tecnología, material y modo de color son obligatorios, pero insuficientes para algunos procesos. También importan perfil efectivo, caras, capas, orientación, formato utilizable y las restricciones de los pasos posteriores. La elegibilidad y la compatibilidad deben volver a comprobarse en el servidor; un checkbox deshabilitado no protege una confirmación.

Las cuatro OT de PVC de 3 mm pertenecen al alcance del diseño. Si coinciden sus condiciones, pueden ofrecerse como una tanda. Para recomendar una placa compartida debe existir además demanda geométrica completa y un recorrido posterior compatible. Con archivos registrados para corte, la opción inicial segura es conservar cada layout y sus copias. Reacomodar requiere una revisión que mantenga coordinadas impresión y corte.

**La recomendación pasa de «mejor ancho de rollo» a «mejor formato utilizable para esta selección»:** ancho y largo consumido en rollos; ancho, alto y cantidad de placas/pliegos en soportes planos. No se promete una recomendación geométrica para trabajos cuya geometría restante o restricciones no se conocen.

## 2. Alcance y método

Se revisaron las familias de impresión por área/hoja, el catálogo de tecnologías y perfiles, snapshots de fabricación, consolidación F4, geometría vinculada a corte, reparto de layouts F6, nesting rectangular de rollo/placa e imposición de cuadernillos/talonarios. También se inspeccionó la copia local de los simuladores retirados para identificar reglas recuperables y limitaciones históricas. No se restauraron sus rutas.

Se contrastaron las decisiones geométricas con documentación primaria de ONYX, Caldera y Fiery. Sus reglas se citan con el producto/versión correspondiente; no se presume que el taller use esos RIP ni que Grafoprint tenga conexión con ellos. Los ejemplos numéricos de recorridos son ilustrativos, no cotizaciones ni resultados de OT reales.

La revisión cubre las familias identificadas en el código y los escenarios de taller descritos. No certifica todas las combinaciones de máquinas, materiales, archivos o RIP de todos los tenants. Los procesos no reconocidos o los datos incompletos necesitan una salida explícita, en lugar de una compatibilidad inventada.

## 3. Hallazgos verificables en la aplicación

| Hallazgo | Consecuencia para el diseño |
| --- | --- |
| La tecnología distingue UV, ecosolvente, látex, sublimación, DTF textil, DTF UV, láser, inkjet y fotoduplicación. La plantilla de impresión por área abarca varias de ellas. | No agrupar por familia `impresion_por_area`, estación o nombre «gran formato». Resolver tecnología y máquina efectivas. [^codigo-tecnologia] |
| `NestingEjecutado` conserva máquina, perfil por ID/nombre, sustrato, tecnología, color, caras, tintas, placements, demanda y referencias de layouts compartidos/registrados. | Existe una buena base para construir el contexto de cada operación; no hace falta reconstruirlo a partir del nombre del producto. [^codigo-snapshot] |
| La firma F4 incluye producto padre, revisión de receta y aspectos económicos, además de configuración geométrica/productiva. | No reutilizar ese hash como criterio de tandas entre OT: su alcance es distinto. Dos OT compatibles pueden tener precios o productos distintos. Extraer conceptos, no copiar la firma completa. [^codigo-f4] |
| F4 representa operaciones compartidas con un operativo y participantes. El snapshot efectivo reemplaza la disposición individual por la compartida. | Una ejecución física debe aparecer una sola vez. No seleccionar aliases como si fueran otros archivos imprimibles. [^codigo-snapshot] |
| La consolidación de cortes registrados agrupa sobre un layout congelado, sin ejecutar nuevamente el nester. Considera también configuración y procesamiento del corte. | Cambiar impresión sin actualizar su corte puede romper una garantía que ya existe. [^codigo-corte] |
| F6 verifica contenido por pieza y cantidad; compara huellas con posiciones, geometría, proceso y copias enteras. | Menos placas o iguales cantidades totales no prueban que cada lote tenga los conjuntos completos. Conservar esa comprobación al agrupar. [^codigo-f6] |
| El perfil genérico de gran formato declara productividad, preparación, cierre, recarga y canales. No declara de forma completa orden de capas, configuración ICC/RIP o espejo por capa. | El mismo perfil/color no demuestra por sí solo equivalencia completa de impresión. Hace falta una configuración operativa identificable y versionada para los procesos que la requieran. [^codigo-perfil] |
| La configuración de gran formato dispone de ancho de rollo, mesa y márgenes; su definición retiró altura máxima de cabezal porque no se validaba. | No afirmar que hoy se verifica integralmente el espesor admisible en toda impresora plana. Identificar esta brecha antes de habilitar sustituciones de placas. [^codigo-perfil] |
| El motor conserva alternativas de rollo cuando el material lo eligió automáticamente y no hay selección comercial explícita. | Una variante fijada no se cambia silenciosamente. Las alternativas del motor tampoco sustituyen la comprobación de equivalencia física para una tanda. [^codigo-variantes] |
| Existen motores de rollo y de placa con piezas de distintas medidas; también helpers de imposición/secuencia. | Podemos reutilizar cálculo geométrico, pero esos motores no son un validador de compatibilidad industrial entre OT. [^codigo-geometria] |

### Antecedentes de los simuladores retirados

El simulador de gran formato separaba visualmente por tecnología, materia prima y atributos de variante, ignorando el ancho para comparar presentaciones. Su clave de agrupación visual no incorporaba máquina, perfil, caras ni modo de color. El endpoint de cálculo recibía grupos y llamaba al acomodo; no equivalía a un contrato completo de compatibilidad de ejecución. El de láser tenía una clave más específica: máquina, variante, gramaje, formato, color y caras, con rechazo de información faltante.

El acomodo histórico preservaba los planes compartidos/registrados, el nesting irregular y las superficies `sheet`: no constituía una solución general de agrupación de rígidos. También podía calcular un candidato de ancho excluyendo los trabajos que no entraban y devolverlos como incompatibles. Esto sirve como diagnóstico, pero no debe convertirse en una recomendación del conjunto completo. La nueva comparación debe cubrir **todos** los seleccionados o declarar el candidato inviable.

Estos hallazgos corresponden al código retirado inspeccionado en `/tmp/retiro-simuladores-20260911/antes/`, no a endpoints que sigan disponibles. Los [documentos históricos de gran formato](simulador-impresion-diseno.md) y [láser](simulador-laser-diseno.md) quedan como antecedentes, no como especificación de reemplazo.

## 4. Qué significa «iguales»

Los trabajos no necesitan tener el mismo diseño, tamaño terminado, cliente o cantidad. Necesitan compartir las condiciones de ejecución relevantes. Tampoco deben fusionarse porque sus etiquetas se parecen.

### 4.1 Condiciones para pertenecer a una tanda

| Dimensión | Criterio propuesto |
| --- | --- |
| Ámbito | Mismo tenant y máquina física. Dos impresoras del mismo modelo tienen colas separadas. |
| Disponibilidad operativa | Operación lista, archivos aprobados/vigentes según sus gates, dependencias satisfechas, sin bloqueo ni pertenencia a otra tanda activa. La fecha estimada no acredita disponibilidad. |
| Proceso | Tecnología y operación efectivas iguales: DTF textil ≠ DTF UV ≠ ecosolvente, aunque todos se coticen por m². |
| Material | Identidad física compatible: composición/producto, color, acabado, adhesivo, espesor o gramaje, tratamiento y atributos que el proceso utiliza. Familia «vinilo», «PVC» o un nombre libre no bastan. |
| Perfil | Misma configuración operativa efectiva y revisión: calidad/productividad, preparación y parámetros relevantes. No comparar sólo nombres como «Estándar». |
| Color | Mismos canales de salida requeridos. CMYK ≠ CMYK + blanco ≠ CMYK + blanco + barniz. La cantidad de colores de la imagen no determina los canales de producción. |
| Capas y caras | Igual modo de impresión, secuencia de capas cuando corresponda, frente/dorso, espejo y método de doble faz. |
| Alimentación/formato | Rollo, hoja o placa y una presentación común permitida para todos. Un cambio de tamaño físico/carga no debe quedar oculto dentro de una tanda homogénea. |
| Condiciones especiales | Restricciones documentadas de orientación, secado/curado, preparación de superficie, configuración de transferencia, terminación en línea o montaje sobre plantilla. |
| Agenda | No define compatibilidad material, pero sí si conviene confirmar juntos. Impacto sobre todas las entregas, capacidad humana y calendarios. |

Los identificadores de archivo y sus revisiones se conservan para trazabilidad; no tienen que ser iguales entre trabajos. El color de origen de un PDF RGB/CMYK tampoco sustituye el modo de salida: su tratamiento de color debe ser compatible con el flujo configurado. ONYX distingue medio, configuración de tinta, modo de impresión, gestión de color y datos de la imagen de origen. [^onyx]

**Valores faltantes:** distinguir «no aplica» de «desconocido». Dos valores desconocidos no prueban igualdad. Si falta una condición necesaria, mostrar «Compatibilidad por revisar» y su causa; no incluir el trabajo en una sugerencia automática. Resolverla en la configuración/preparación correspondiente, sin obligar a repetir campos técnicos en cada tanda. Esto no elimina la ejecución individual existente de trabajos que cumplen sus gates actuales.

**Normalización:** usar códigos y unidades canónicas, no equivalencias por texto libre. Las normalizaciones conocidas de BN/B&N o eco-solvente pueden reutilizarse con pruebas. No descartar todos los atributos desconocidos ni eliminar recursivamente cualquier campo llamado `anchoMm`: sólo las dimensiones de presentación expresamente declaradas intercambiables.

### 4.2 Cómo recomendar otro ancho sin contradecir «mismo material»

Un rollo de vinilo blanco de 1,06 m y otro de 1,37 m pueden ser presentaciones del mismo material; uno blanco y otro glitter no. La equivalencia se define en catálogo/configuración, no se adivina por precio o semejanza de nombres. Si no puede acreditarse, conservar el SKU exacto.

Cada trabajo tiene un conjunto de presentaciones permitidas. La tanda usa su **intersección global**. No basta comprobar parejas: A permite 1,06/1,37; B, 1,37/1,52; C, 1,06/1,52. Cada pareja comparte un ancho, pero no hay uno común a los tres. La UI debe recomputar las opciones al agregar cualquier integrante.

Una presentación elegida explícitamente en la OT es un conjunto de una sola opción mientras no exista una revisión autorizada. La revisión puede cambiar una restricción válida; nunca vuelve físicamente compatibles materiales o tecnologías incompatibles.

### 4.3 Configuración reutilizable, sin formulario técnico para el impresor

La propuesta es completar el perfil/flujo operativo con una identidad versionada que describa los ajustes necesarios para agrupar. Por ejemplo: «UV PVC blanco · CMYK · una cara · calidad normal» y «UV transparente · blanco de base + CMYK · impresión espejada» son configuraciones distintas.

No hace falta replicar todas las pantallas del RIP ni agregar un campo de atención del operario. Sí hace falta saber qué configuración se está declarando equivalente. Los parámetros humanos siguen derivándose de preparación, operación de máquina, cargas y cierre, respetando la autonomía configurada.

Si el RIP se configura fuera del sistema, se debe distinguir **configuración declarada** de **ajustes verificados en el RIP**. Un perfil con nombre no demuestra que el archivo importado o enviado use esos ajustes. La correspondencia puede prepararse una vez; no se debe anunciar sincronización sin integración real.

## 5. Permisos de transformación geométrica

| Situación | Organización permitida | Recomendación geométrica |
| --- | --- | --- |
| Archivos consecutivos con configuración común | Una tanda con sus archivos y orden conservados | Estimar con sus disposiciones conocidas; no atribuir ahorro de mezcla. |
| Diseños independientes con demanda y restricciones conocidas | Tanda; posible propuesta conjunta | Evaluar acomodo en rollo o placa. Mantener escala, cantidad, identidad y orientación permitida. |
| Layout terminado, impuesto, panelizado manualmente o con composición original | Tanda conservando cada plano y copias | No desarmar para rellenar huecos. Preservar soporte/formato fijado. |
| Impresión vinculada a corte/recorrido | Tanda con la pareja de archivos y revisión conservadas | No generar nueva disposición sin mantener registro y salida de corte coherente. |
| Bloques registrados que un flujo validado permite trasladar | Sólo transformaciones admitidas de todo el bloque | El bloque incluye marcas, márgenes, origen y capas. Igual bounding box no acredita validez. |
| Geometría incompleta o pendiente expresado sólo en porcentaje | Organizar la ejecución/reanudación con sus referencias | No calcular piezas restantes ni prometer ancho/placa óptimos. |

Estos son permisos internos y explicaciones de la UI, no seis elecciones obligatorias del operario. El sistema determina qué puede ofrecer. Ante duda sobre un layout, se conserva; no se obliga a aceptar un renesting para usar la cola.

### Registro de impresión y corte

La unidad protegida incluye posición relativa del diseño y contorno, escala, rotación/espejo, origen, marcas de registro, márgenes, capas, referencia del material y dispositivo/proceso de corte. Trasladar un dibujo manteniendo su forma puede ser insuficiente si el corte sigue usando coordenadas absolutas o las marcas quedan fuera del área legible.

La documentación de Caldera trata expresamente las restricciones de espejo, marcas y reordenamiento en doble faz. En PrimeCenter, las capas tienen configuración de espejo y marcas, y su exportación puede afectar la alineación. Son ejemplos concretos de por qué «mismo color y tamaño» no es una garantía de registro. [^caldera-duplex] [^caldera-capas]

Si se habilita una nueva disposición registrada entre OT, debe existir una revisión operativa única que vincule impresión, cortes, piezas por OT/lote y sus cantidades; validar todos sus archivos antes de sustituir el plan ejecutable. No sobrescribir la cotización. Mientras esa capacidad no exista, la agrupación conserva los layouts. Un consentimiento del impresor no corrige un archivo de corte desalineado.

**Nesting sólo de corte:** dos piezas pueden encajar por sus contornos dejando zonas próximas o vacías. Eso no prueba que las cajas de imagen, fondos o sangrados impresos puedan superponerse. El acomodo de impresión necesita la huella imprimible real o un bloque conservador verificado; no basta copiar un resultado eficiente de corte irregular.

## 6. Casos por familia

### 6.1 Rollos de gran formato

UV, látex y ecosolvente deben partir de tecnología, máquina, material y perfil efectivos. Respetar orientación de material/diseño, márgenes, sangrado, separaciones, dimensiones útiles y cualquier secuencia de paneles. Tener el mismo material no autoriza rotar una pieza que debe conservar sentido.

Comparar todos los seleccionados en los anchos permitidos. Para una demanda constante, el largo más corto no siempre consume menos m²; mostrar ambos. No utilizar cobertura de tinta como aprovechamiento de material. Precio, unidad y moneda se comparan separadamente; no mostrar ahorros económicos derivados a un rol que no puede ver importes.

La cantidad agregada en stock no acredita un tramo continuo de bobina. Si no se conocen bobinas/remanentes, declarar la limitación y resolver disponibilidad sin inventarla. Una recomendación no reserva ni descuenta existencias por sí sola. Recarga, cambio de rollo y preparación no desaparecen porque los trabajos compartan material.

### 6.2 DTF textil, DTF UV y sublimación

Son grupos distintos. Además de la tecnología, preservar tipo de film/papel, modo de color y configuración de capas/orientación/transferencia que corresponda al proceso configurado. No trasladar una suposición de espejo o blanco de una tecnología a otra.

Los pasos posteriores de aplicación, transferencia o laminación conservan sus dependencias y recursos. Imprimir una tanda no completa automáticamente esos pasos. El calendario de DTF textil de los jueves debe seguir vigente; reunir trabajos no inventa capacidad otro día ni vuelve listos los archivos que todavía no lo están.

### 6.3 Placas rígidas: las cuatro OT de PVC de 3 mm

Ejemplo ilustrativo: en la impresora UV aparecen cuatro operaciones listas sobre **el mismo PVC blanco de 3 mm, CMYK, una cara y perfil normal**. Se ofrece el grupo de cuatro. Una quinta de PVC de 5 mm, una sexta con blanco y una séptima en otra máquina aparecen en grupos diferentes, con la diferencia visible.

Al preparar las cuatro se evalúa:

1. Variantes/formato común permitidos: ancho y alto reales, espesor, acabado y demás atributos. No asumir que «placa» siempre significa la placa madre completa; puede tratarse de un formato precortado.
2. Alimentación física, área imprimible, márgenes, sujeción y capacidad relevante de la máquina. Un área de mesa declarada no certifica todas las capacidades físicas; los datos ausentes se deben resolver antes de ofrecer una sustitución como válida.
3. Demanda exacta: diseños, cantidades, sangrados y rotaciones. No dividir m² totales por m² de placa ni usar sólo lo visible en una miniatura.
4. Layouts protegidos y ruta posterior. Si hay corte registrado, conservarlo salvo revisión conjunta. Si deben pasar por máquinas distintas, una placa física compartida necesita un recorrido de separación/traspaso conocido.
5. Placas necesarias, formatos, layouts distintos, aprovechamiento y efecto en preparación/entregas. Mostrar «Mejor opción calculada», sin afirmar óptimo global.

**Dos resultados válidos:** con diseños independientes y condiciones suficientes, proponer el acomodo conjunto de las cuatro OT. Con layouts registrados, proponer imprimir sus archivos originales en una misma tanda, conservando cada plano; no anunciar menos placas sin un cálculo y unos archivos que lo justifiquen.

No mezclar dos placas físicas pequeñas sobre la cama como si fueran una placa grande continua. Ese montaje necesita su propia plantilla, posiciones y validación; una caja rectangular del tamaño de la cama no representa el soporte cargado.

### 6.4 Impresión por hoja y láser

La compatibilidad incluye papel exacto/equivalencia autorizada, gramaje, formato, caras, perfil y modo de color. Diferenciar impresión láser de otras tecnologías que también produzcan hojas. La máquina física, el método de doble faz y la terminación en línea forman parte del contexto.

Volantes simples pueden admitir una propuesta de imposición conjunta si se conoce la demanda y cómo separarlos. Un cuadernillo ya impuesto no se desarma como rectángulos independientes: páginas, frente/dorso, pliegos y orden de alzado deben mantenerse. Lo mismo ocurre con talonarios, numeración, copias y datos variables. Los helpers actuales ya modelan diferencias entre aprovechar poses y conservar secuencias de producción. [^codigo-imposicion]

La fuente oficial de Fiery distingue optimización para mínimo material de disposiciones que facilitan cortes horizontales/verticales. Por eso un acomodo de mayor aprovechamiento no es automáticamente la mejor opción para un producto que se termina en guillotina. [^fiery]

### 6.5 Duplicadora, CAD y otras máquinas

En duplicadora, mismo papel y tinta no implica una única preparación para originales diferentes: deben conservarse las preparaciones por máster/original/cara. La definición actual contempla máster y doble faz. Una tanda consecutiva no acredita ahorro de esos tiempos. [^codigo-perfil]

Para CAD u otros trabajos secuenciales, mantener escala, orden y orientación cuando el flujo lo exija. No convertir automáticamente toda entrada de plotter en un nesting mezclado.

Corte láser, CNC, hilo caliente, mesa de corte, guillotina, impresión 3D y laminación requieren adaptadores propios de agrupación. Su compatibilidad incluye herramientas, operación, material, espesor, recorrido y restricciones físicas específicas. La cola puede mostrarlos sin habilitar una acción de tanda de impresión. Compartir la palabra «máquina» no es un criterio suficiente.

## 7. Lotes, piezas y liberación de etapas

La identidad mínima de una operación no es el nombre del archivo: incluye tenant, OT, ítem/componente, lote de entrega, paso operativo y revisión. Dos diseños con las mismas medidas o el mismo `pieceId` local pueden pertenecer a OT distintas. Duplicar o fusionar por nombre/medida produciría cantidades incorrectas.

Para un lote de 50 exhibidores, el plan debe seguir acreditando todos los tipos de piezas necesarios para esos 50 conjuntos. La tanda puede imprimir también otros lotes; no puede sustituir esa comprobación por un total global de placas o piezas. Conservar copias enteras de layouts y sus multiplicidades, salvo una revisión nueva aceptada y validada. Las huellas actuales de F6 son una base útil, no una autorización automática para mezclar OT. [^codigo-f6]

Al cerrar, los integrantes completos liberan sus siguientes etapas; los incompletos permanecen pendientes con nota, porcentaje aproximado y autor. Un operativo F4 compartido no se descompone en aliases independientes por marcar una excepción: mientras no exista una correspondencia de terminación más fina, el pendiente afecta a la operación física común y se explica visualmente.

Una placa combinada puede introducir una dependencia física nueva: por ejemplo, cuatro OT comparten una placa que debe cortarse antes de separarlas. No se deben publicar cuatro cortes independientes que vuelvan a procesar la misma placa cuatro veces, ni asignarla simultáneamente a dos cortadoras. Sin un recorrido compatible y una identidad de ejecución común, conservar layouts o rechazar la mezcla física.

Esperar a terminar toda la tanda, como se hace en el taller, puede retrasar una OT corta al agruparla con otra extensa. El preview debe simular esa liberación conjunta y las esperas posteriores configuradas; nunca adelantar el corte sólo porque matemáticamente terminó el primer archivo. Una restricción de secado/curado existente tampoco se elimina al completar impresión.

El porcentaje pendiente sirve para ETA; **no identifica qué geometría quedó pendiente**. No generar el 30 % de cada diseño, reducir copias fraccionariamente ni recomendar una placa para un remanente desconocido. Retomar sigue siendo posible con una estimación declarada, sin forzar un conteo de piezas al impresor.

## 8. UI propuesta después de esta revisión

La navegación sigue siendo **Producción → Colas de trabajo → máquina física**. La tecnología aparece como contexto, especialmente en estaciones con varias máquinas; no reaparecen simuladores separados.

Dentro de la máquina, mostrar grupos de trabajo listo con una cabecera descriptiva, por ejemplo:

> PVC blanco · 3 mm · CMYK · una cara · Normal — 4 trabajos

Una segunda cabecera separa otra configuración, aunque coincida el material. El detalle desplegable explica perfil, presentación permitida y restricciones sin llenar todas las filas de parámetros. La tabla mantiene OT, producto/componente, lote, compromiso y estado de archivo visibles. Los trabajos sin compatibilidad verificable tienen una sección secundaria con el dato concreto por revisar.

**Recorrido principal:** elegir grupo → seleccionar integrantes → Preparar tanda → revisar recomendación e impacto → Confirmar o Confirmar e iniciar. Seleccionar todo opera sólo dentro del grupo compatible. Una búsqueda puede encontrar trabajos de otros grupos, pero no mezclarlos. Si se conservan filas incompatibles a la vista, mostrar la causa junto a la fila, no únicamente en un tooltip.

La cabecera de grupo representa condiciones de producción comunes; el selector de integrantes también verifica que exista un formato común para el conjunto completo. No basta una agrupación visual estática. Si agregar un trabajo deja la intersección vacía, mostrar «No hay un formato permitido para estos trabajos» y mantener intacta la selección anterior válida.

En Preparar tanda, una recomendación principal y «Ver otros formatos»:

| Tipo de trabajo | Información principal |
| --- | --- |
| Rollo reorganizable | Ancho, largo estimado, m², aprovechamiento, disponibilidad y alcance del cálculo. |
| Placa/pliego reorganizable | Formato ancho × alto, cantidad de placas/pliegos, layouts, aprovechamiento y disponibilidad. |
| Layouts protegidos | «Se conservan los layouts y archivos de corte», copias por layout e integrantes. Sin ahorro de reacomodo ficticio. |
| Datos geométricos insuficientes | Causa concreta y ejecución con referencias existentes cuando corresponda. Sin ranking inventado. |

El preview de acomodo muestra OT/lote por diseño o bloque y mantiene su leyenda acotada con scroll sólo cuando hace falta. No usa el mismo color para sugerir que todos pertenecen a una misma OT. El nombre de orden impreso sigue gestionándose fuera del sistema; no se incorpora un escaneo o etiquetado nuevo.

**Incompatibilidad física:** no hay «forzar de todos modos». **Perjuicio de agenda:** puede existir autorización con responsable y registro, como se acordó. No presentar ambos problemas como una misma advertencia aceptable.

El boceto interactivo anterior sirve para discutir densidad, navegación y cierre. Su agrupación simplificada no constituye la especificación de compatibilidad y debe actualizarse después de revisar este contrato.

## 9. Matriz de validación que debe preceder a la implementación

Los siguientes son casos de aceptación propuestos; no son pruebas nuevas que ya hayan pasado.

| # | Caso | Resultado esperado |
| ---: | --- | --- |
| 1 | DTF textil y ecosolvente, mismo tamaño | Grupos y tandas separados. |
| 2 | DTF textil y DTF UV, ambos CMYK + blanco | Separados. |
| 3 | Misma tecnología en dos máquinas físicas | Colas separadas; sin reasignación implícita. |
| 4 | Vinilo blanco y glitter | Separados. |
| 5 | PVC blanco 3 mm y 5 mm | Separados. |
| 6 | Mismo material base, distinto acabado/adhesivo/tratamiento | Separados si cambia la condición productiva. |
| 7 | CMYK y CMYK + blanco | Separados. |
| 8 | CMYK + blanco con orden de capas diferente | Separados aunque coincida la etiqueta de color. |
| 9 | Mismo nombre de perfil, diferente configuración/revisión | No asumir equivalencia. |
| 10 | Una cara y doble faz; o doble faz con otro método | Separados. |
| 11 | Tecnología, perfil o material necesarios desconocidos | Sin sugerencia de compatibilidad; causa visible. |
| 12 | Tres selecciones compatibles por parejas pero sin formato global | No confirmar el conjunto. |
| 13 | Variantes equivalentes salvo ancho, permitidas por todos | Comparar anchos comunes. |
| 14 | Variante fijada comercialmente | Conservarla; no sustituir sin revisión. |
| 15 | Ancho candidato deja una OT fuera | Candidato inviable para la selección completa. |
| 16 | Pieza entra sólo rotada, pero no se permite rotación | Candidato inviable. |
| 17 | Pieza requeriría nuevo panelizado | No repanelizar silenciosamente. |
| 18 | Paneles existentes con solape, orden y orientación | Conservar su contrato y cantidades. |
| 19 | Cuatro OT compatibles de PVC 3 mm con diseños libres | Ofrecer tanda y evaluar formatos/acomodo conjunto. |
| 20 | Las mismas cuatro, con impresión y corte registrados | Conservar layouts; nueva mezcla exige revisión coordinada. |
| 21 | Placa cabe en impresión, pero no en el corte posterior | No recomendar un recorrido imposible. |
| 22 | Placa del tamaño de la cama con varias piezas precortadas montadas | No tratar el montaje como soporte continuo sin plantilla válida. |
| 23 | Marcas/sangrados/origen fuera del área al mover un bloque | Rechazar esa transformación. |
| 24 | Corte irregular válido pero huellas impresas se solapan | No reutilizarlo como acomodo de impresión. |
| 25 | Mismo papel/color, cuadernillos o datos numerados distintos | Conservar imposiciones/secuencias. |
| 26 | Disposición eficiente imposible de separar con la guillotina prevista | No recomendarla como ejecutable. |
| 27 | Duplicadora, originales distintos | No descontar todos los máster/setup como si fuera uno. |
| 28 | Dos OT con `pieceId` o nombre de archivo coincidente | Identidades y demanda separadas. |
| 29 | Layout A × 25 contiene varias piezas por conjunto | Copias enteras y balance por pieza/lote; sin redondeos productivos inventados. |
| 30 | Operativo y participantes F4 visibles en distintas OT/vistas | Una única membresía y ejecución física. |
| 31 | Placa común con cortes posteriores distintos | Mezcla sólo con recorrido compartido/separación validado. |
| 32 | Un miembro con ~30 % pendiente sin detalle geométrico | ETA aproximado; sin renesting de cantidades ficticias. |
| 33 | Primer archivo termina antes, pero se cierra toda la tanda junta | ETA refleja espera hasta cierre y dependencias posteriores. |
| 34 | Agrupación retrasa producción dentro del margen de entrega | Mostrar desplazamiento y compromiso conservado. |
| 35 | Agrupación perjudica una entrega | Autorización de agenda explícita y auditada. |
| 36 | Archivo/dependencia/variante cambia después del preview | Caducar propuesta y revalidar, sin ejecutar lo anterior. |
| 37 | Dos impresores confirman el mismo paso | Una sola asignación; conflicto entendible y atómico. |
| 38 | Stock agregado suficiente, continuidad de bobina desconocida | No acreditar continuidad; disponibilidad pendiente de verificar. |
| 39 | Papel/placa sin existencia o variante inactiva | No recomendar como disponible para iniciar. |
| 40 | Precio en otra unidad/moneda o sin permiso económico | Comparación normalizada/autorizada o sólo física. |
| 41 | DTF jueves y selección de trabajos aún no listos | Calendario conservado; trabajos futuros fuera de la tanda confirmable. |
| 42 | IDs de otro tenant o archivos restringidos | Sin lectura ni mutación cruzada. |
| 43 | Nueva tecnología sin adaptador | Cola visible con ejecución soportada; sin mezcla genérica automática. |
| 44 | Cierre/reintento/reapertura o cancelación concurrente | Sin doble liberación, reservas huérfanas ni pérdida de auditoría. |

## 10. Qué conservar y qué falta antes de cerrar el plan

**Conservar:** motores geométricos, snapshots inmutables, identidad de pasos y aliases F4, balances y layouts F6, calendario/atención humana, comandos de ejecución y auditoría. No restaurar simuladores ni crear otro catálogo paralelo de máquinas.

**Completar primero en el diseño:**

1. Un contexto de producción efectivo y versionado por operación, con datos conocidos, no aplicables o faltantes. El snapshot histórico y la configuración vigente se contrastan; consultar sólo el catálogo actual no puede reinterpretar silenciosamente una OT anterior.
2. Un contrato de compatibilidad por familia, incluida la equivalencia explícita de presentaciones de material, los formatos permitidos y las restricciones que no están modeladas todavía. Perfiles RIP declarados cuando corresponda, sin formulario repetitivo por tanda.
3. Un permiso geométrico independiente de la pertenencia a tanda. Diseñar la revisión impresión/corte antes de ofrecer nuevas mezclas registradas.
4. Adaptadores de candidatos para rollo y placa/pliego sobre los motores existentes, con demanda completa y rutas posteriores verificables. El primer alcance no puede limitarse al rollo y anunciar que resuelve también rígidos.
5. Una UI con grupos explicables y acciones acordes a lo realmente calculable. Ajustar el prototipo a este contrato antes de considerarlo una referencia funcional.

Una estimación en Grafoprint no certifica la composición ejecutada en un RIP externo. Si el impresor utiliza otra disposición, cambian los supuestos de consumo/tiempo; conservar la procedencia y la incertidumbre. No registrar ahorros reales ni cambiar la promesa comercial automáticamente.

Para escala SaaS, calcular firmas/resúmenes de forma económica al preparar la cola y cargar geometría por selección. Evitar comparar todas las parejas de todas las OT o ejecutar un nesting por fila. Cachear por revisiones, demanda y restricciones; stock/precios/agenda necesitan su propia vigencia. Los trabajos grandes requieren presupuesto de cómputo, cancelación y límites; el límite interno de 100.000 instancias del motor rectangular es una protección, no un tamaño objetivo para cada request. [^codigo-geometria]

## 11. Verificación realizada y límites

Se ejecutaron cinco suites unitarias existentes sobre las bases reutilizables: `grid-2d-multi`, `maxrects-rollo`, imposición de cuadernillo, `layouts-entregas` y márgenes de rollo. **Resultado: 5 suites, 40 pruebas aprobadas**; ejecución local reportada por Jest: 0,542 s. No es una medición de rendimiento de tandas ni un benchmark SaaS.

No se agregaron pruebas nuevas, código de producto, migraciones ni cambios de OT. Los 44 escenarios anteriores siguen siendo criterios a implementar y verificar. Tampoco se validó una integración RIP, un archivo combinado real o todo el catálogo de un tenant; la documentación de fabricantes fundamenta restricciones, no certifica las capacidades actuales de la aplicación.

## Fuentes

Todas las fuentes externas se consultaron el 11/09/2026. Las referencias locales corresponden al árbol de trabajo de esta revisión.

[^codigo-tecnologia]: [Normalización de tecnologías](../src/lib/maquinaria-tecnologias.ts) y [familias de pasos](../apps/api/src/productos-servicios/pasos/familias.ts).
[^codigo-snapshot]: [Tipos de fabricación y nesting](../apps/api/src/motor-universal/tipos.ts) y [snapshot operativo](../apps/api/src/produccion/snapshot-paso-produccion.ts).
[^codigo-f4]: [Consolidación F4 y firmas](../apps/api/src/motor-universal/nesting-compuesto-shadow.ts), construcción de `firmaBase` para rollo y placa.
[^codigo-corte]: [Consolidación de cortes registrados](../apps/api/src/motor-universal/consolidar-cortes-registrados.ts), `consolidarCortesRegistrados`.
[^codigo-f6]: [Adaptador geométrico de F6](../apps/api/src/eta/planificacion/adaptador-cotizacion.ts) y [comparación de layouts de entregas](../apps/api/src/eta/planificacion/layouts-entregas.ts).
[^codigo-perfil]: [Definiciones de maquinaria y perfiles](../src/lib/maquinaria-templates.ts) y [canales/consumibles de impresión](../apps/api/src/maquinaria/consumibles-impresion.ts).
[^codigo-variantes]: [Motor universal](../apps/api/src/motor-universal/motor.service.ts), `resolverOpcionesNestingRollo`.
[^codigo-geometria]: [Motor de placa con medidas mixtas](../apps/api/src/productos-servicios/nesting/algorithms/grid-2d-multi.ts) y [motor MaxRects de rollo](../apps/api/src/productos-servicios/nesting/algorithms/maxrects-rollo.ts).
[^codigo-imposicion]: [Imposición de cuadernillos](../apps/api/src/productos-servicios/nesting/helpers/cuadernillo-imposicion.ts) y [agrupación de talonarios](../apps/api/src/productos-servicios/nesting/helpers/talonario-grouping.ts).
[^onyx]: [ONYX 25 — Printer and Media Tab](https://help.onyxgfx.com/25/ONYXGo/Content/Job%20Editor/Tool%20Tabs/Printer%20%26%20Media%20Tab_Thrive.htm). Diferencia medio, tinta, modo de impresión, gestión de color y selección del dispositivo de corte.
[^caldera-duplex]: [Caldera — Double-sided printing: Combinations](https://helpdesk.caldera.com/hc/en-us/articles/4403971789329-Double-sided-printing-Combinations), actualizado el 03/01/2025. Restricciones de combinación de doble faz con espejo, corte y nesting automático.
[^caldera-capas]: [Caldera — Multi-layer in PrimeCenter](https://helpdesk.caldera.com/hc/en-us/articles/39756101632529-Multi-layer-in-PrimeCenter), actualizado el 24/02/2026; funcionalidad introducida en 4.4 y diferencias documentadas para 4.5. Configuración de capas, espejo, marcas y exportación.
[^fiery]: [Fiery Command WorkStation 7.0 — Nesting layout options in Job Editor](https://help.fiery.com/cws_hsij/7.0/en-us/GUID-5EDE8808-2B45-4C37-A0AF-88630B26C8D5.html). Orientación y alternativas de acomodo para corte horizontal/vertical.
