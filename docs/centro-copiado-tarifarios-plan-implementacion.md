# Centro de copiado: implementación de oferta y tarifarios

Estado: implementación local en curso. Base funcional:
[decisiones D01–D38](centro-copiado-oferta-tarifarios-decisiones.md).
Rama: `codex/centro-copiado-tarifarios`, desde `origin/main` actualizado,
incorporando la rama documental por avance directo. Sin despliegues.

## Diseño técnico

El motor conserva geometría, materiales, tiempos, costos e impuestos. Una capa
comercial de Centro de copiado resuelve la oferta y el precio de impresión del
pedido completo, antes de componer sus renglones. Los adicionales conservan su
cálculo y se agregan una sola vez. Todos los recorridos deben consumir ese mismo
resultado: cotizar, construir, guardar, editar, recotizar y emitir.

La oferta se identifica por papel/gramaje y tamaño en hojas, y material/ancho
de rollo en CAD. Primero se incorpora la restricción opcional por gramaje a la
configuración actual. Ausente conserva la selección general existente;
presente expresa una lista explícita de formatos. Una lista vacía ofrece cero
formatos. El selector y el servidor cruzan oferta y posibilidad productiva.
El JSON existente permite esta ampliación sin migrar ni borrar datos.

Los tarifarios tienen identidades estables y revisiones separadas: borrador
editable con control de revisión, y publicaciones inmutables con vigencia. Cada
publicación incluye las reglas y celdas implementadas. La integración pendiente
hará que una cotización guarde la versión usada y el desglose, y que los canales
referencien una política general heredada o una excepción. La activación
explícita es independiente de guardar o simular un borrador.

El cálculo comercial trabajará con cantidades decimales controladas y cantidades
físicas independientes. Orden: resolver política/oferta → clasificar caras y
cobertura → acumular → buscar tramo → redondear ML → resolver precio/acuerdo →
ajustes autorizados → preparación y mínimo únicos → terminaciones → control
de margen. Un precio pendiente conserva su estado hasta resolverlo.

La simulación reutilizará los adaptadores y el motor para todas las celdas;
guardará cantidad, configuración productiva y errores. No publicará precios.
Pouch reutilizará su familia del motor con un modo individual explícito, material
compatible y selección persistida por segmento.

## Bloques y validación

| Bloque | Resultado verificable | Estado |
| --- | --- | --- |
| Oferta por papel y gramaje | Configurar formatos, conservar selecciones al guardar y rechazar combinaciones no ofrecidas en la API. | Implementado y probado localmente con servicios simulados; prueba de entorno y CI pendientes |
| Cantidades y tramos en hojas | D09–D15, D27 y cantidades de D29: acumulación del pedido, caras, cobertura y juegos. | Implementado como cálculo puro y probado; conexión al cotizador pendiente |
| Composición comercial del pedido | IVA, preparación y mínimo únicos, terminaciones aparte. | Implementado como cálculo puro y probado; resolución fiscal e integración pendientes |
| Prioridad y controles comerciales | Acuerdos/ajustes autorizados, respaldos y margen. | Pendiente; la composición recibe importes ya resueltos |
| Cantidades y tramos CAD | Consumo real en ML, acumulación, tramo y redondeo comercial del grupo. | Implementado como cálculo puro y probado con el planificador actual; conexión al cotizador pendiente |
| Tarifarios y canales | Persistencia, edición, versiones, activación y herencia con aislamiento por tenant. | API de tarifarios, versiones y política general/canales en borrador con vista previa comprobada; interfaz y activación operativa pendientes |
| Recorridos del pedido | Vista previa, guardado, recálculo y emisión comparten cantidades, versiones y precios. | Pendiente |
| Pouch y tomos | Material por hoja, caras/copias/juegos correctos, edición y adicionales sin duplicación. | Pendiente |
| Herramientas de precios | Matriz, pegado, duplicación, ajustes masivos y simulación de todas las celdas. | Pendiente |
| Validación del conjunto | Empresas sin activar, permisos, históricos y casos funcionales; después CI y staging autorizado. | Pendiente |

Las pruebas usan datos ficticios. Las suites que necesitan PostgreSQL se
ejecutan sólo en una base local de test. No usar seeds ni resets sobre local con
datos; no compilar contenedores o web de producción en esta Mac.

## Registro de verificación

### 10 de octubre de 2026 — oferta por papel y gramaje

- En Configuración → Centro de copiado → Oferta, cada papel permite heredar
  formatos generales o elegirlos por gramaje. Sólo se muestran formatos que
  pueden producir las variantes activas de ese gramaje. Un gramaje puede quedar
  sin formatos ofrecidos. Las restricciones generales se aplican además de las
  particulares, y desactivar un formato general conserva la selección particular.
- La selección se guarda en `papelesJson`, se recupera al editar y viaja en las
  opciones del cotizador. Elegir todos los papeles no descarta sus restricciones.
  No requiere migraciones, seeds ni cambios de precios.
- El servidor valida pertenencia del papel, gramajes, formatos y duplicados al
  configurar, y rechaza combinaciones no ofrecidas al cotizar o construir un
  pedido. Omitir gramaje con varios gramajes disponibles no permite eludir la
  oferta explícita. Una lista general de tamaños vacía ya no se interpreta como
  “todos”. La oferta heredada sin restricciones nuevas conserva su funcionamiento.
- La prueba rápida busca una combinación ofrecida de papel, gramaje y tamaño;
  exige guardar cambios antes de probar para evitar usar dos configuraciones.
- Pruebas API: 22 casos en oferta, adaptador, dominio y módulo. Las nuevas pruebas
  cubren el contrato anidado, validación operativa, actualización y lectura con
  Prisma simulado, y rechazo de material ajeno antes de escribir.
- Pruebas web: 27 casos entre API cliente, configuración y cotizador. Incluyen
  guardar y recuperar la oferta con los controles reales, volver a heredar,
  gramajes sin formatos, formatos globales deshabilitados y permiso de gestión.
- ESLint de los archivos web modificados y revisión del diff sin errores.
  Revisión de tipos limitada a los archivos modificados; la comprobación global
  se interrumpió por el costo de recursos locales y queda para CI.
- Pendiente: prueba con PostgreSQL y recorrido visual en un entorno de aplicación,
  CI y apertura del PR. No se desplegó staging ni producción. No están
  implementados aún las matrices comerciales, sus versiones/canales, pouch ni la
  simulación masiva de costos; conservan el alcance inicial del documento funcional.

Para comprobar el bloque en un entorno de aplicación: habilitar A3 para un papel
de 80 g y sólo A4 para el mismo papel de 150 g, guardar y volver a abrir. Confirmar
que el cotizador sólo ofrece los formatos elegidos por gramaje y rechaza un pedido
A3/150 g enviado directamente a la API. Usar materiales y empresa ficticios.

Una prueba de este bloque no acredita la integración del módulo completo.

### 10 de octubre de 2026 — cantidades, acumulación y tramos en hojas

Implementado en [comercial/calculo-hojas.ts](../apps/api/src/centro-copiado/comercial/calculo-hojas.ts),
con [contratos explícitos](../apps/api/src/centro-copiado/comercial/tipos.ts) y
[validación de reglas, combinaciones y precios](../apps/api/src/centro-copiado/comercial/validaciones.ts).
Es una función pura sin conexiones a base de datos ni llamadas al motor. Los
endpoints actuales todavía no aplican esta capa: la activación depende de integrar
tarifarios, sus versiones y el resto de la composición comercial. No se cambió
el cobro actual ni se publicaron matrices automáticamente.

**Entrada y alcance:** una empresa, un pedido con todas sus cargas de hojas y una
versión de la sección hojas del tarifario principal. El servidor que la invoque
debe resolver antes permisos, oferta vigente y gramaje efectivo; el cálculo
rechaza gramaje sin resolver y un tarifario de otra empresa. Los identificadores
de carga y documento distinguen archivos, incluso con igual nombre o con el mismo
ID local en cargas diferentes. No se deduplican por nombre ni se acumulan otros
pedidos. Las versiones se identifican en el resultado; su persistencia y vigencia
todavía pertenecen al bloque pendiente de tarifarios.

- Unidad por hoja o carilla, compartida por el precio y el tramo. Se preservan
  además hojas físicas y carillas impresas, independientemente de cómo se facture.
- Acumulación por combinación del pedido o por archivo. Cada combinación separa
  papel, gramaje, tamaño, K/CMYK y caras. Las coberturas se separan sólo en la
  modalidad de precios diferenciados; siempre se conserva la cobertura productiva
  del archivo. La pertenencia a un tomo no separa el volumen comercial.
- Última hoja impar: mantener doble faz o reclasificar a simple antes de agrupar.
  Se aplica por original y copia efectiva. Los juegos del tomo reemplazan las
  copias del documento. No se ocupan dorsos vacíos con páginas del siguiente
  original ni se modifica la instrucción de impresión.
- Rangos generales con excepciones completas por combinación. Se representan
  mediante inicios inclusivos, comenzando en 1; el siguiente inicio determina el
  final del anterior y el último queda abierto. Se rechazan límites repetidos,
  desordenados, fraccionarios y celdas de precios que no correspondan a un tramo.
- El tramo alcanzado aplica a todas las unidades. Cada parte conserva su aporte
  y el importe resultante; sumar, quitar o editar archivos requiere pasar de nuevo
  el conjunto del pedido, sin mantener acumuladores de llamadas anteriores.
- Un precio faltante conserva la cantidad y el estado `PRECIO_PENDIENTE`.
  El importe completo queda en `null` y el importe parcial conocido se identifica
  aparte. No se reutiliza otra cobertura, otra cara ni otro tramo. El respaldo
  explícito y el bloqueo de emisión aún deben conectarse a los recorridos reales.
  Un cero cargado expresamente es distinto de una celda vacía.
- Importes como cadenas decimales exactas, sin redondear por archivo ni aplicar
  todavía IVA, descuentos, cargos, mínimos o terminaciones. La convención de IVA
  se interpreta en la composición posterior. Como límite técnico de entrada se
  aceptan hasta 18 dígitos enteros y 8 decimales por precio; las cantidades físicas
  deben ser enteros seguros y se comprueban también al acumular. Se usa precisión
  decimal propia, sin alterar la del motor universal.

Ejemplos ficticios comprobados:

| Caso | Resultado |
| --- | --- |
| 60 y 50 hojas compatibles en cargas distintas; $100 desde 1 y $80 desde 100 | Por combinación: 110 × $80 = $8.800. Por archivo: $6.000 + $5.000 = $11.000. |
| 99 / 100 / 101 hojas con esos precios | $9.900 / $8.000 / $8.080; se conserva el descenso acordado. |
| 11 páginas, 3 copias, doble faz; $160 doble y $100 simple por hoja | 18 hojas y 33 carillas. Mantener doble: $2.880. Reclasificar: 15 dobles + 3 simples = $2.700. |
| Misma cantidad, tarifario por carilla | 33 carillas dobles, o 30 dobles y 3 simples; nunca se factura el dorso vacío como carilla. |
| Dos originales de 3 páginas doble faz y 10 juegos | 40 hojas y 60 carillas. Con reclasificación: 20 hojas dobles y 20 simples; cada original conserva su frente. |
| Faltan los precios simples del ejemplo de 11 páginas | 18 hojas conservadas, parcial conocido $2.400 y total pendiente; no se omiten las tres hojas simples. |

**Verificación:** 80 pruebas nuevas de cálculo y validación, más 30 pruebas
existentes de oferta, adaptador, dominio, módulo y preparación/tomos:
**110 pruebas aprobadas en 7 suites**, con Node 24.19.0 y datos ficticios.
Se comprobaron tipos y las reglas ESLint de la API sobre los seis archivos
nuevos. La ejecución de ESLint con el proyecto completo superó el límite local
de memoria; se usó un programa TypeScript limitado a esos archivos, conservando
las mismas reglas de lint. La comprobación global sigue pendiente para CI.

**Próximos bloques:** composición de IVA, preparación, mínimo, acuerdos y ajustes;
cantidades y tramos CAD sobre consumo en ML; persistencia y activación de
tarifarios/versiones/canales, y conexión común a vista previa, guardado y emisión.
Las terminaciones y la simulación masiva mantienen su alcance acordado. Sin
migraciones, cambios de datos, despliegues ni nuevas pantallas en este bloque.

### 10 de octubre de 2026 — IVA, preparación y mínimo del pedido

Implementado en [comercial/composicion-pedido.ts](../apps/api/src/centro-copiado/comercial/composicion-pedido.ts),
con [contratos internos](../apps/api/src/centro-copiado/comercial/composicion-pedido.types.ts).
Este bloque implementa la aritmética de D17–D19. Recibe todos los conceptos de
impresión del pedido con sus importes resueltos y una única versión de la política
principal. Comprueba coincidencia de empresa, tarifario, versión y moneda; rechaza
conceptos duplicados. No es un DTO público ni recibe directamente precios del
navegador. Las pruebas conectan la salida del cálculo de hojas con esta composición.

- **IVA:** incluido por defecto o más IVA. Se exige una alícuota explícita por
  concepto, preparación y ajuste al mínimo; cero también es explícito. La función
  interpreta la convención comercial pero no decide qué alícuota corresponde,
  no presupone 21 % y no sustituye la configuración fiscal existente. Admite
  alícuotas distintas y conserva neto + IVA = total.
- **Preparación:** incluida o cargo fijo una sola vez en el pedido. Cargas,
  combinaciones, caras, archivos y tomos no multiplican el adicional. El importe
  configurado se conserva separado del importe ajustado cuando el servidor ya
  resolvió un ajuste autorizado. Este cálculo no recibe ni modifica los costos o
  tiempos de preparación productiva.
- **Mínimo:** se compara impresión más preparación en la misma convención de IVA,
  después de los ajustes recibidos y del redondeo monetario. Se agrega sólo la
  diferencia, como concepto separado; las cantidades y tramos no se modifican.
  Un respaldo no aporta otra preparación ni otro mínimo. Sin impresiones, ambos
  cargos son cero; un trabajo con precio explícito cero sí conserva sus cargos.
- **Terminaciones:** se agregan después del mínimo con su propio desglose fiscal
  ya calculado. No se les aplica nuevamente el IVA del tarifario. Se comprueba
  que neto e IVA sumen su total y que tengan la precisión monetaria del pedido.
  Un precio de terminación pendiente deja el total del pedido pendiente.
- **Precios faltantes:** un mínimo o cargo conocido nunca completa una impresión
  sin precio. Los conceptos, subtotales y total que dependen del precio faltante
  quedan en `null`; se expone aparte el parcial conocido. `CALCULADO` sólo indica
  que la composición tiene importes completos, no que se haya autorizado emitir.

**Redondeo e integración:** se recibe la precisión monetaria resuelta del tenant
(de 0 a 6 decimales), con redondeo de mitades hacia arriba. Se redondea una vez
por grupo comercial después de acumular y resolver su importe, no por archivo ni
unidad. Los subtotales suman los conceptos redondeados; el mínimo se redondea con
la misma precisión y se compara contra esa suma cobrable. Con IVA incluido se
conserva el total y el IVA es la diferencia con el neto redondeado; con más IVA se
calcula sobre el neto redondeado. No se aplica este redondeo a las cantidades CAD.
En este bloque se aceptaron importes resueltos de hasta 34 enteros y 12 decimales
(ampliados a 20 decimales al incorporar CAD, según el registro siguiente); preparación y
mínimo configurados admiten hasta 18 enteros. La aritmética decimal evita convertir
los importes a `Number` y rechaza el desbordamiento de las sumas.

Ejemplos ficticios comprobados:

| Caso | Resultado |
| --- | --- |
| Precio $121, IVA incluido, alícuota de prueba 21 % | Neto $100 + IVA $21 = $121. |
| Precio $121, más IVA, alícuota de prueba 21 % | Neto $121 + IVA $25,41 = $146,41. |
| Impresión $300 + preparación $500; mínimo $1.000; terminación final $1.200 | Ajuste de $200; total final $2.200 con tarifario de IVA incluido. |
| Mismos importes de impresión/preparación/mínimo netos, más IVA de prueba 21 % | Ajuste neto $200; $1.210 antes de terminación y $2.410 finales. |
| Impresión ya ajustada a $8.100 y preparación ajustada a $400; mínimo $9.000 | Ajuste $500; total $9.000, sin repetir descuentos. |
| Dos cargas con un tomo de 3 juegos y reclasificación de la última hoja impar | 20 hojas reales; impresión $2.900, una preparación de $500 y ajuste $600 para mínimo $4.000. |
| Impresión conocida $100 y otra sin precio, preparación $500, terminación $1.200 | Parcial conocido $1.800; mínimo y total pendientes. |

**Verificación:** 67 pruebas nuevas más las 110 de los bloques anteriores:
**177 pruebas aprobadas en 8 suites**, con Node 24.19.0. Tipos y ESLint sin errores
ni advertencias en los tres archivos nuevos, usando el programa TypeScript
limitado y las reglas reales de la API para respetar los recursos de la Mac.
Sin conexiones a bases de datos ni operaciones sobre staging o producción.

**Pendientes:** seleccionar acuerdos y respaldos por alcance, aplicar descuentos
y precios manuales con permisos/motivo/auditoría, resolver alícuotas desde la
configuración fiscal real, controlar costos/márgenes y conectar la composición a
cotizar/guardar/emitir. El contrato ya admite importes finales ajustados; las
pruebas de esos importes no acreditan la implementación del resolvedor ni de sus
permisos. CAD por ML, publicación de versiones/canales, pouch y simulación de
todas las celdas siguen dentro del alcance inicial pendiente. No se activó el
nuevo esquema en tenants actuales. Comprobación global en CI y apertura del PR
pendientes; la sesión no dispone de GitHub autenticado para crearlo.

### 10 de octubre de 2026 — CAD por ML consumidos, tramos y redondeo

Implementado en [comercial/calculo-cad.ts](../apps/api/src/centro-copiado/comercial/calculo-cad.ts),
con [contratos CAD](../apps/api/src/centro-copiado/comercial/tipos-cad.ts) y
[validaciones](../apps/api/src/centro-copiado/comercial/validaciones-cad.ts).
Se implementa el cálculo puro de D31–D35: la única unidad comercial CAD es ML;
los formatos estándar y las medidas personalizadas comparten ese cálculo.

- Recibe todas las cargas CAD del pedido y una versión de la sección CAD del
  tarifario principal. El servidor debe resolver antes la oferta, el gramaje y
  la configuración productiva del rollo. Se verifica la empresa del tarifario y
  se rechazan cargas o documentos duplicados, manteniendo los IDs locales de
  cada carga separados. Los nombres de archivo no identifican el volumen.
- Reutiliza `planPaginaCad`, el mismo planificador de orientación a escala real
  usado en cotización e impresión. El largo consumido es el lado orientado en
  avance más ambos márgenes productivos, por las copias efectivas. Se conservan
  el plan, las medidas originales, el rollo, la orientación, los márgenes, las
  copias y el consumo de cada página. Una lámina que no cabe se rechaza; nunca
  se reduce automáticamente para hacerla entrar.
- Respeta la selección de páginas originales y sus excepciones de copias. Las
  excepciones fuera del rango no suman consumo; cada excepción reemplaza las
  copias generales de esa página. Mantiene los límites actuales de 5.000 páginas
  seleccionadas y 10.000 impresiones por documento, simple faz, sin tomos ni
  terminaciones CAD. No cambia el límite productivo actual del planificador:
  rollos de 300 a 914,4 mm y margen de 5 mm. Ampliar ese rango o los márgenes
  requiere ampliar previamente la configuración productiva compartida.
- Acumula por papel/gramaje, ancho de rollo, K/CMYK y cobertura cuando tiene
  precios diferenciados. Distintas medidas de plano pueden acumular juntas.
  La alternativa por archivo agrega la identidad de carga y documento al grupo.
  La cobertura productiva siempre se conserva aunque el precio sea único.
- Los rangos generales y sus excepciones CAD se expresan como inicios decimales
  inclusivos desde cero; el próximo inicio es un límite superior exclusivo y el
  último queda abierto. Esto permite consumos menores a un metro sin inventar
  un mínimo de 1 ML. `4`, `4.0` y `4.00` identifican el mismo límite. Las
  excepciones sustituyen los rangos generales; se rechazan duplicados, precios
  sin tramo y límites desordenados. No se reutilizan los rangos de hojas.
- Primero se suma el consumo real y se elige su tramo. Después se aplica, si
  corresponde, el menor múltiplo del incremento que alcanza ese consumo. Se
  redondea una sola vez por grupo, nunca por página o copia. El precio del tramo
  alcanzado se aplica a todos los ML facturables, sin cobro progresivo. El
  redondeo no habilita otro tramo ni aumenta el consumo físico de producción.
- El grupo expone el importe de sus ML reales y el importe del ajuste comercial
  por separado. Las partes conservan sus consumos e importes sin duplicar ese
  ajuste. Al integrar renglones por archivo habrá que conservar ese total de
  grupo; no volver a redondear cada parte ni perder el ajuste al persistir.
- Un precio faltante conserva las cantidades y deja el total pendiente; el
  parcial conocido queda identificado aparte. Un cero cargado explícitamente
  sí es un precio. Los precios por combinación siguen siendo independientes.

**Precisión:** las cantidades e incrementos usan cadenas decimales con hasta 12
decimales de ML y límite de cantidad segura; se rechaza exceso de precisión o
magnitud, sin redondearlo silenciosamente. El largo orientado y los márgenes se
suman en decimal para evitar que un residuo binario agregue otro incremento al
cobrar. Por ejemplo, 1,12 + 10 mm se conserva como 11,12 mm, aunque la suma binaria
del plan resulte 11,120000000000001. No se cambia la geometría productiva.
ML con 12 decimales por precio con 8 requieren hasta 20 decimales intermedios:
se amplió la admisión de importes resueltos de la composición a ese límite y la
precisión decimal local a 80 dígitos, sin cambiar la configuración del motor ni
el redondeo monetario final. Preparación y mínimo configurados conservan sus
límites anteriores. Hojas y CAD comparten la validación de precios de matriz.

Ejemplos ficticios comprobados, con $5.000/ML desde 0 y $4.000/ML desde 4:

| Caso | Consumo real | Facturable | Resultado |
| --- | --- | --- | --- |
| Plano 600 × 1.200 mm, margen 5 mm en ambos extremos, sin redondeo | 1,21 ML | 1,21 ML | $6.050. |
| Dos copias del anterior, incremento 0,10 ML | 2,42 ML | 2,50 ML | $12.500; no se redondea cada copia. |
| Archivos con 2,42 y 1,61 ML, acumulación por combinación e incremento 0,10 ML | 4,03 ML | 4,10 ML | $16.400 al precio del tramo desde 4. |
| Mismos archivos, acumulación por archivo | 4,03 ML | 4,20 ML | $21.000; ambos archivos usan el tramo inicial. |
| Consumo por debajo del cambio de tramo, incremento 0,10 ML | 3,96 ML | 4,00 ML | $20.000; el redondeo no habilita el precio desde 4. |
| Múltiplo exacto del incremento de 0,10 ML | 1,30 ML | 1,30 ML | Sin incremento adicional. |
| Pedido mixto: 3 hojas a $100, un plano de 1,21 ML, preparación $500 y mínimo $7.000, IVA incluido | 3 hojas y 1,21 ML, separados | Mismas cantidades | $6.350 de impresión + una preparación $500 + ajuste $150 = $7.000. |

**Verificación:** 85 pruebas nuevas de CAD, las 177 del bloque anterior y 32
pruebas existentes de geometría CAD, PDF y rangos de páginas: **294 pruebas
aprobadas en 13 suites**, con Node 24.19.0. Tipos y ESLint sobre los nueve archivos
TypeScript nuevos o modificados, con las reglas reales de la API y el programa
limitado para respetar los recursos locales. Las pruebas no conectaron bases de
datos ni enviaron trabajos a impresoras.

**Pendientes de integración:** resolver oferta y configuraciones productivas
vigentes desde el catálogo real, incorporar estas reglas a las versiones de
tarifario y llevar el desglose a vista previa, guardado y emisión. La prueba de
pedido mixto conecta matemáticamente hojas, CAD y composición; todavía no activa
este recorrido en los endpoints existentes. Preparación y mínimo se compondrán
una vez sobre todos los grupos de hojas y CAD, nunca en dos llamadas separadas.
La simulación de todas las celdas deberá reutilizar estos mismos consumos. No
se implementaron precio por plano/formato ni por m². Sin migraciones, cambios
de datos, despliegues ni activaciones automáticas. CI global y PR siguen pendientes.

### 10 de octubre de 2026 — guardado y versiones de tarifarios

Implementada la base de persistencia de D24 en
[tarifarios](../apps/api/src/centro-copiado/tarifarios/centro-copiado-tarifarios.service.ts).
La migración aditiva crea `CentroCopiadoTarifario` para el borrador y
`CentroCopiadoTarifarioVersion` para cada publicación; no convierte configuraciones
existentes ni activa precios en la operación.

- Cada borrador guarda nombre, revisión y contenido validado. El contenido de
  esquema 1 incluye moneda, sección de hojas y/o CAD por ML, rangos generales y
  excepciones, precios independientes, cobertura, acumulación, última hoja impar,
  redondeo CAD, convención de IVA, preparación y mínimo. La tasa de IVA sigue
  perteneciendo al sistema fiscal. La modalidad de cobertura es por tarifario.
- Se reutilizan las validaciones semánticas del cálculo comercial. Se rechazan
  combinaciones o tramos repetidos, precios para tramos inexistentes, estructuras
  inválidas y propiedades no admitidas. Los precios conservan cadenas decimales;
  `null` o celda ausente siguen pendientes y cero sigue siendo explícito.
  Límites de entrada: 5.000 combinaciones por sección y 100 tramos por lista.
- Los papeles deben existir en la empresa autenticada. Guardar un precio no
  habilita el papel ni el formato: la oferta y la capacidad productiva se
  comprobarán de nuevo al activar/cotizar. No se copian precios ni identidades
  de otra empresa. Un tarifario puede prepararse con celdas pendientes sin que
  eso permita cerrar un pedido; el bloqueo operativo de D21 sigue por integrar.
- Editar y publicar exigen la revisión vista por el usuario. Una escritura
  concurrente queda rechazada con conflicto y pide recargar. Publicar incrementa
  la revisión del borrador y el número de publicación en la misma transacción.
  Nombre, reglas y precios pertenecen siempre a la revisión que se confirmó.
- Cada publicación copia el contenido completo y registra autor y fecha.
  Se impiden cambios y borrados individuales también en PostgreSQL. La
  eliminación integral de una empresa conserva el comportamiento en cascada del
  sistema; las pruebas comprueban que sus fixtures pueden retirarse completos.
- La vigencia inmediata usa la hora del servidor. La programada exige un instante
  futuro ISO con zona horaria explícita, hasta milisegundos; la futura interfaz
  lo convertirá desde la zona del tenant. No se admiten fechas ambiguas ni dos
  publicaciones del mismo tarifario para el mismo instante.
- La consulta de versión vigente elige la mayor fecha de vigencia no posterior
  al instante consultado. No requiere un cron que mute el historial. El número
  de publicación indica el orden de creación, no reemplaza la fecha de vigencia.
  Publicar otra versión inmediata conserva las publicaciones futuras ya
  programadas; la interfaz deberá mostrarlas al revisar la publicación.
- Reintentar la misma publicación y revisión devuelve la versión existente,
  incluso con solicitudes simultáneas. Cambiar su modo o fecha en un reintento
  produce conflicto. No se reprograman versiones publicadas silenciosamente.
- Creación, edición y publicación se auditan dentro de su transacción. Un fallo
  de auditoría revierte también la escritura, el contador y la revisión.

**API:** `GET/POST /centro-copiado/tarifarios`, `GET/PUT /:id`,
`GET /:id/versiones`, `GET /:id/versiones/:versionId`, `GET /:id/vigente` y
`POST /:id/publicar`, bajo el mismo prefijo. Listados de hasta 50 registros con
`desplazamiento` y siguiente página; el contenido se obtiene por detalle.
Las lecturas exigen `configuracion.copiado.ver`, las escrituras
`configuracion.copiado.gestionar`, además de la capacidad Centro de copiado.
Empresa y autor salen de la sesión; los IDs de recursos se filtran por empresa.
Las consultas no crean configuraciones ni eventos. No hay rutas para editar o
eliminar versiones publicadas.

**Verificación local:** 48 pruebas nuevas, incluidas las de HTTP con sesiones,
roles y guardas reales; 294 de regresión: **342 aprobadas en 15 suites**, Node
24.19.0. Se aplicaron las 313 migraciones desde cero, sin seeds, en una base
PostgreSQL local exclusiva de test, retirada al finalizar después de comprobar
que los fixtures se eliminaron. Se comprobaron escrituras simultáneas,
reintentos, límites exactos de vigencia, conversión de huso horario, historial
inmutable, aislamiento por empresa/material, permisos y reversión transaccional.
Una prueba lee la versión persistida y calcula seis hojas doble faz con diez
carillas a $100,50/hoja: $603, conservando los IDs de tarifario y versión.
Tipos y ESLint sin errores ni advertencias en los siete archivos nuevos;
el grafo del módulo también resuelve el controlador y servicio agregados.
Se agregaron estas suites y las de cálculo comercial al workflow de CI.

**Alcance pendiente:** esta API aún no tiene editor visual ni asignación general
por canal. Publicar no cambia las cotizaciones existentes ni activa la matriz
para un tenant. El contrato persistido se ampliará con respaldos y controles de
margen al implementar sus resolvedores; esas decisiones no se consideran
implementadas por guardar la matriz. Faltan también la actualización explícita
de borradores de pedidos antes de emitir, el respeto de versiones en los
recorridos operativos, herramientas de carga/simulación de todas las celdas y
pouch. Permanecen dentro del alcance inicial. No se aplicó la migración sobre
bases de desarrollo con datos, staging ni producción. CI global y apertura de
PR pendientes por falta de GitHub autenticado en la sesión.

### 10 de octubre de 2026 — política general y excepciones por canal en preparación

Implementada la configuración en borrador de D22 y su resolución contra las
versiones publicadas de D24 en
[centro-copiado-politica.service.ts](../apps/api/src/centro-copiado/tarifarios/centro-copiado-politica.service.ts).
La migración aditiva crea `CentroCopiadoPoliticaBorrador`, separado de la
configuración que usa hoy el cotizador. Toda respuesta de configuración identifica
su estado `BORRADOR` y `operativa: false`; no existe un endpoint de activación.

- Política general: motor o tarifario. Cada canal permite heredar, usar motor o
  elegir un tarifario específico. Se reutiliza el catálogo de canales actual:
  mostrador, WhatsApp, email, Web y app móvil. No se deduce el canal del dispositivo.
  Los canales históricos no se asignan como nuevos en este recorrido; sus pedidos
  existentes conservan el funcionamiento anterior hasta integrar la migración.
- Una empresa sin configuración obtiene virtualmente motor como política general
  y herencia en todos los canales, con revisión cero. Consultar o previsualizar no
  escribe filas, eventos ni configuraciones. El primer guardado explícito crea la
  revisión uno y los posteriores exigen la revisión que se está editando.
- El guardado reemplaza el documento completo y exige las cinco opciones de canal,
  para que una omisión accidental no borre una excepción. Se rechazan propiedades
  desconocidas, modalidades ambiguas e identificadores de tarifarios ajenos o
  inexistentes, también en las excepciones. Compartir una matriz no la duplica.
- Se permite preparar la asignación de un tarifario todavía sin publicación. La
  vista previa lo muestra pendiente hasta que tenga una versión vigente; no usa el
  borrador como precio ni lo sustituye por el motor. Si falta la referencia
  persistida, también queda pendiente, sin revelar datos de otra empresa.
- La selección usa la última fecha de vigencia que ya comenzó. Una publicación
  futura entra exactamente en su fecha; editar el borrador del tarifario no afecta
  la versión seleccionada. Los cinco canales de una vista previa usan una misma
  revisión de política y una lectura consistente de PostgreSQL.
- Se compara la moneda del tarifario con la configurada para la empresa, usando el
  valor predeterminado del sistema cuando todavía no hay datos de empresa. Una
  diferencia queda pendiente como `MONEDA_INCOMPATIBLE`: no se convierten precios
  automáticamente ni se cambia el origen al motor.
- La referencia de selección conserva empresa, revisión de política, canal,
  moneda, tarifario y versión cuando corresponde. La comprobación interna detecta
  cambios en cualquiera de ellos, incluso cambiar de canal cuando ambos usan el
  mismo motor o tarifario. Exige revisar la preparación; no autoriza importes ni
  confirma una venta. El guardado del pedido deberá repetir ese control dentro de
  su transacción al integrar la emisión, junto con los controles restantes.
- La vista previa expone el origen general/canal, estado motor/tarifario/pendiente
  y un resumen de la versión, sin repetir las celdas en cada canal. El resolvedor
  interno entrega la sección completa de esa versión para alimentar el cálculo.
- El guardado tiene control de revisión y auditoría transaccional. Dos primeros
  guardados simultáneos o dos ediciones de la misma revisión sólo aceptan uno;
  un fallo de auditoría revierte toda la escritura. La auditoría conserva la
  política completa y su autor, además de la revisión.

**API:** `GET/PUT /centro-copiado/politica-precios/borrador` y
`GET /centro-copiado/politica-precios/borrador/previsualizacion`.
Lectura con `configuracion.copiado.ver`; escritura con
`configuracion.copiado.gestionar`, siempre con la capacidad Centro de copiado.
Empresa y autor provienen de la sesión. No se acepta activar ni cambiar empresa o
usuario mediante el cuerpo o un encabezado. El resolvedor interno exige un canal
válido también para motor; esa exigencia aún no modifica las rutas operativas.

**Verificación:** 50 pruebas nuevas y 342 anteriores: **392 pruebas aprobadas en
17 suites** con Node 24.19.0. Se aplicaron las 314 migraciones desde cero en una
base local exclusiva de test, sin seeds, retirada al finalizar después de comprobar
la limpieza de sus datos ficticios. Pruebas de HTTP con sesiones, roles y
permisos reales, incluida la revocación de gestión sin renovar la sesión;
concurrencia, aislamiento, moneda, vigencia y protección del borrador. Tipos y
ESLint sin errores ni advertencias en los seis archivos nuevos; esquema Prisma y
YAML de CI válidos, y dependencias del módulo comprobadas. Las dos suites nuevas
quedan incorporadas al workflow existente.

Ejemplo ficticio comprobado con matrices publicadas: dos archivos de 100 carillas
cada uno, doble faz, acumulan **100 hojas físicas** en un único grupo. Mostrador
hereda la matriz general a $100/hoja y obtiene $10.000; Web usa su excepción a
$80/hoja y obtiene $8.000. La prueba resuelve cada canal desde PostgreSQL y aplica
su versión al cálculo del pedido completo. No demuestra todavía el cambio de
canal desde la pantalla ni su confirmación en un pedido real.

**Pendientes:** interfaz para editar la política y ver sus efectos; activación
explícita después de completar acuerdos, respaldos, márgenes y revisión del
cálculo; conexión con cotizar/guardar/recotizar/emitir sin mezclar versiones ni
alterar compromisos vigentes. La simulación de todas las celdas y pouch siguen en
el alcance inicial. Este bloque no cambia el cotizador actual, ni aplica la
migración en desarrollo con datos, staging o producción. PR y CI remota siguen
pendientes por falta de GitHub autenticado en la sesión.

### 10 de octubre de 2026 — editor de tarifarios y canales en Configuración

Se agregan las pestañas **Tarifarios** y **Canales** dentro de Configuración →
Centro de copiado. Consumen las APIs de borradores y versiones ya implementadas.
La pantalla identifica el estado **en preparación**: publicar una versión o
asignarla a un canal todavía no activa matrices en pedidos.

- Crear y duplicar tarifarios independientes, guardar con control de revisión,
  consultar publicaciones inmutables y publicar inmediatamente o para una fecha
  futura. La fecha se interpreta en la zona horaria de la empresa, rechazando
  horas inexistentes o ambiguas por cambios horarios. Después de publicar se
  vuelve a leer la revisión; si esa lectura falla, se informa que la publicación
  tuvo éxito y se bloquean nuevas escrituras hasta recargar.
- Generar combinaciones de hojas desde la oferta **guardada**, respetando papel,
  gramaje, formatos producibles y formatos ofrecidos. Agregar filas no pisa
  precios ni excepciones existentes. CAD genera sus filas desde los perfiles
  productivos, deduplicadas por papel, gramaje, ancho de rollo e impresión;
  siempre por ML. El catálogo CAD del editor tiene una ruta de lectura con
  permiso de configuración y mantiene las capacidades de Centro de copiado/CAD.
- Editar simple/doble faz, K/CMYK y coberturas independientes, rangos generales y
  excepciones por combinación. El tramo y el precio usan la misma unidad según
  D10: hojas físicas o carillas; CAD usa ML consumidos. Las reglas de acumulación,
  hoja impar, IVA, preparación, mínimo y redondeo CAD se pueden configurar.
- Los importes viajan como cadenas decimales exactas; se acepta coma decimal, sin
  separadores de miles. Vacío conserva `null` (pendiente); cero es un precio
  explícito. La edición no convierte monedas. Una moneda incompatible se advierte
  también en la selección por canal.
- Pegado de bloques tabulados desde Excel sobre una celda y ajustes masivos por
  porcentaje o importe por unidad, con incremento opcional de redondeo hacia
  arriba. Ambos muestran antes/después y requieren aplicar al borrador; un bloque
  inválido no modifica parcialmente precios. El ajuste afecta las combinaciones
  que coinciden con la búsqueda, en todas sus páginas, y conserva pendientes.
  El pegado se limita a las filas de la página visible, sin encabezados.
- Cambiar cobertura o unidad exige revisión y deja pendientes los precios que ya
  no son comparables. Cambiar IVA advierte que se conserva el número cargado y
  cambia su interpretación. Al retirar rangos con precios se pide confirmación;
  los inicios conservados mantienen sus importes y los nuevos quedan pendientes.
- Los borradores se conservan al cambiar de pestaña. Cambiar de tarifario o
  recargar con cambios requiere guardar o descartar; se advierte al cerrar o
  recargar el navegador. Un conflicto de revisión conserva lo escrito. Esta
  protección no intercepta aún toda navegación interna fuera de Configuración.
- La política general permite motor o tarifario; mostrador, WhatsApp, email, Web
  y app móvil permiten herencia o excepción. La vista previa consulta la selección
  guardada, muestra origen/versión/pendiente y se oculta mientras hay cambios.
  Una respuesta tardía no reemplaza una edición o un guardado posterior. La vista
  se actualiza al volver a Canales o explícitamente, sin sondeo automático.
- Consulta disponible con permiso de lectura; modificaciones con permiso de
  gestión. Los selectores recorren todas las páginas del catálogo. Las matrices
  muestran 20 combinaciones por página y la revisión masiva 50 celdas por página.

La verificación local pasó **44 pruebas frontend y 40 de API**. Incluye reglas
numéricas, generación y pegado, formularios,
conflictos, publicación, lectura por permisos y respuestas tardías. Los tests de
formularios sustituyen sólo los selectores flotantes por controles nativos porque
jsdom no provee su geometría; los controles Base UI reales se comprobaron además
en el navegador con datos ficticios y una API de demostración aislada. No se
considera una prueba completa de pedido real. Las suites se agregan al workflow
existente de CI; la ejecución remota depende de abrir el PR. Se comprobaron tipos
y ESLint de los archivos afectados, además del YAML del workflow. La base aislada
se migró sin seed, quedó sin empresas ni usuarios ficticios al terminar y se
eliminó. No se compiló producción en la Mac.

**Siguiente bloque:** simulación de costos de todas las celdas y sugerencias del
motor (D23/D28), manteniendo precios por cobertura desde el inicio. Continúan
pendientes los respaldos, acuerdos/descuentos/autorización, control de márgenes,
pouch y conexión operativa de cotizar/guardar/recotizar/emitir. La importación de
archivos Excel/CSV sigue para segunda etapa. Este editor no aplica migraciones a
bases con datos ni despliega staging o producción.
