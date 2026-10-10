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

Los tarifarios requerirán identidades estables y revisiones separadas: borrador
editable con versión optimista, y publicaciones inmutables con vigencia. Cada
publicación incluye reglas y celdas; una cotización guarda la versión usada y
el desglose. Canales referencian una política general heredada o una excepción.
La activación explícita es independiente de guardar o simular un borrador.

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
| Cantidades y tramos CAD | Consumo real en ML, acumulación, tramo y redondeo comercial del grupo. | Pendiente |
| Tarifarios y canales | Persistencia, edición, versiones, activación y herencia con aislamiento por tenant. | Pendiente |
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
Se aceptan importes resueltos de hasta 34 enteros y 12 decimales; preparación y
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
