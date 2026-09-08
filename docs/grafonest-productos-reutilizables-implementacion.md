# GrafoNest: archivos reutilizables y planes por patrones

Implementación local del 7 de septiembre de 2026, sobre `visual-ilusion/fase-4-rutas-dag`. No desplegada ni enviada a origin en esta entrega. Se preservaron los demás cambios que ya estaban en el directorio.

## Flujo inicial con componentes individuales

Para el flujo nuevo con varias piezas dentro de un componente, ver **Segundo bloque** al final. Este recorrido inicial se conserva para componentes que usan un solo diseño.

1. En **Producto → Comercial → Piezas y archivos**, cargar uno o varios DXF/SVG. La importación se revisa archivo por archivo. Se elige la silueta exterior, la unidad de las coordenadas y qué otros trazos son corte interior, hendido o geometría ignorada. La miniatura identifica el exterior seleccionado; las medidas se muestran antes de confirmar. Un exterior abierto requiere confirmación explícita de cierre recto.
2. En **Routing → Configuración del componente → Pieza del producto**, elegir el diseño y las piezas por producto terminado. El atajo escribe los bindings existentes: herencia de `geometriasVectoriales.<id>` y cantidad del padre multiplicada por unidades del componente. No hay un segundo multiplicador en el archivo. Para el exhibidor: cuerpo 1, soporte 1, faldón 1, estante 4, costilla 1 y header 1.
3. Publicar la revisión productiva como en el flujo existente. Un cambio productivo del catálogo requiere nueva publicación antes de cotizar con la receta. La consolidación del producto debe estar en `CONSOLIDAR_COMPATIBLES` para reunir los componentes del lote.
4. Al cotizar, el servidor resuelve los diseños guardados. Sus medidas quedan fijas; el catálogo puede habilitar **Reemplazar para esta cotización**, con regreso al diseño del producto. Los cambios de archivo o interpretación generan nuevas referencias, conservando las anteriores.
5. El visor presenta los patrones del resultado: repetición, colores por componente, detalle ampliado, resaltado y balance de demanda. **Ver placas y detalles** abre el visor anterior. **Agregar a la OT** conserva el resultado de la cotización mediante los snapshots existentes; no se introduce otra optimización al crear la orden.

El cierre de interpretación es por archivo/pieza. Los DXF compuestos por trazos separados que no formen un contorno seleccionable deben prepararse en el editor; esta primera versión no inventa uniones ni clasifica automáticamente todos los trazos de CORTE_3 como piezas. Los SVG requieren viewBox y confirmación de unidades; el espacio vacío del viewBox no agranda la silueta. Los hendidos y cortes internos se conservan como operaciones y no habilitan ocupar sus huecos con otras piezas.

## Motor y registro entre procesos

El worker incorpora una cartera de patrones mixtos y puros, candidatos de rejilla y filas alternadas, variantes de balance y un selector entero con SciPy/HiGHS. Busca primero menos placas y después menos patrones con demanda exacta. Respeta la política de giro, margen y separación. La cartera, la selección y la búsqueda nativa comparten el presupuesto del trabajo. Los candidatos se validan geométricamente antes de usarse y se conserva el mejor encontrado.

Las cadenas de impresión y corte compatibles participan en la consolidación. El corte recibe las mismas posiciones globales del lote de impresión; no se vuelve a nestear ni a cobrar el sustrato. Las cadenas con sangrado, paneles o manejo de placa sobresaliente quedan fuera de esta nueva elegibilidad hasta resolver esas restricciones específicamente.

Las operaciones internas acompañan cada transformación y salen en SVG y DXF, separadas como `CORTE_INTERIOR` y `HENDIDO`. Las líneas abiertas se mantienen abiertas; sólo el corte contribuye al perímetro de corte. Dividir automáticamente una pieza que lleva estas operaciones se rechaza para evitar perderlas o desplazarlas incorrectamente: esa división debe prepararse en el original.

La nueva vista agrupa posiciones, geometría, operaciones y arte equivalentes, no sólo cantidades iguales. La selección visible se adapta a cualquier cantidad de patrones. No declara un óptimo geométrico absoluto al terminar el tiempo. La continuación incremental con un botón específico **Continuar optimizando** sigue pendiente: esta versión usa los controles existentes de generar/regenerar y revisar el resultado antes de agregar.

## Persistencia

`GeometriaProducto` guarda una interpretación inmutable y el hash del original, vinculada a `Archivo` dentro del tenant. El servidor relee el archivo al interpretar y rehidrata el SVG canónico al guardar/cotizar; no confía en un SVG adulterado enviado junto a una referencia. Los originales referenciados no se pueden eliminar. La revisión publicada congela la configuración; una cotización que ya contiene una referencia conserva esa versión de archivo, aunque exista otra interpretación posterior.

Migración: `20260907010000_geometrias_producto_reutilizables`, aplicada al PostgreSQL local. Para otro entorno se requiere generar Prisma, aplicar migraciones e instalar `requirements-opennest.txt` en el Python del worker (incluye SciPy 1.13.1). La política de nesting subió a versión 7 para invalidar resultados anteriores.

## Evidencia

- [Resultado del worker productivo y persistencia](benchmarks/exhibidor-50/integracion-worker.json): 450 piezas, 34 placas, 9.651 patrones evaluados, tres elegidos, demanda exacta, dentro de placa y sin solapamientos. A×25, B×5 y C×4. Mínimo demostrado dentro de la cartera, no del espacio completo de soluciones; cota por área: 28 placas.
- Prueba con PostgreSQL real y el controlador de interpretación: los seis archivos se guardan, se releen y generan la demanda de 450 piezas. Una nueva interpretación no reemplaza la referencia histórica; otro tenant no puede leer el archivo. La transacción de prueba se revirtió íntegramente. El almacenamiento se sustituyó por lectura de los archivos locales para esa prueba; no se realizó una subida a través de Chrome.
- 120 pruebas automatizadas aprobadas (98 API y 22 frontend), TypeScript de API/web sin errores y compilación de API correcta. Incluyen importación, escala, operaciones, conservación histórica, cantidades 1/10/50/51, cartera genérica, giros restringidos, cancelación, balance, agrupación visual, exportación, registro impresión–corte y materialización del lote en producción.
- Revisión en Chrome del componente real `NestingViewer` con el resultado real del worker: tres tarjetas, balance 450/450/0, resaltado de estante y ampliación del patrón C. La ruta temporal de QA fue eliminada.

Para repetir el benchmark, compilar la API y ejecutar:

```sh
node apps/api/scripts/nesting-lote-benchmark/verificar-worker.cjs /tmp/grafonest-worker-resumen.json
```

Las condiciones del benchmark siguen siendo las documentadas en `procedencia.json`: placa 564×860 mm, margen 5 mm, cero separación y escala 25,4/72 confirmada para comparar. El cierre del exterior abierto del estante es una hipótesis explícita de esa prueba, no una aprobación de fabricación ni un cierre automático al importar.

## Verificación en Chrome y entorno local

Con el permiso de archivos locales habilitado, se completó la carga múltiple de los seis DXF desde Chrome en **Exhibidor · prueba de archivos y patrones** (`5293ecf0-24d5-44ac-aaf0-36fe46adef0c`). Se guardaron sus interpretaciones y luego los cambios del producto. Después de recargar la página siguen presentes Cuerpo, Soporte, Faldón, Estante, Costilla y Header, con sus medidas y la capa CORTE_3. El formulario bloqueó correctamente el estante abierto hasta confirmar su cierre de 13,88 mm para la comparación; no es una autorización de fabricación. Esta prueba seleccionó sólo exteriores y dejó las operaciones internas sin clasificar.

Durante la prueba se corrigió una superposición: la barra de guardado de la página, en capa 60, tapaba el botón del diálogo de importación, en capa 50. El footer del workspace quedó en capa 30 y se comprobó visualmente y continuando la carga que el diálogo queda accesible.

Esta verificación cubre carga, interpretación, guardado y recuperación en navegador. En esa primera verificación la copia seguía en borrador; la validación de cotización posterior se documenta al final. La prueba del motor de 34 placas y la prueba de persistencia de servidor son las detalladas arriba.

### Configuración de componentes en Chrome

Se configuraron seis ocurrencias de «Corrugado plastico» (material confirmado por el usuario para esta prueba), cada una con su diseño del padre y cantidad por exhibidor: Cuerpo ×1, Soporte ×1, Faldón ×1, Estante ×4, Costilla ×1 y Header ×1. Los componentes se ejecutan en paralelo y convergen en un paso nuevo de Ensamble estructural. La alternativa se llama «Impresión, corte y ensamble del exhibidor» y conserva `CONSOLIDAR_COMPATIBLES`, sin exclusiones. Los pasos antiguos de hilo caliente y pintura siguen omitidos; no se modificó la ruta base compartida.

Después de guardar se releyó la revisión `02e2bcd4-62c9-486c-b6c5-b7d5fc9e531a` desde PostgreSQL. El resolver real de componentes, con los diseños persistidos y cantidad padre 50, produjo 50/50/50/200/50/50 = 450 piezas y tomó las medidas de cada DXF sin overrides comerciales. Esta comprobación no ejecuta la cotización completa ni sustituye la validación de impresión/corte.

Durante el recorrido se corrigió la capa de la vista de configuración, que estaba por encima de los Select y tapaba sus opciones; se verificó visualmente la selección y su persistencia. También se deduplicaron las lecturas del contrato de productos repetidos dentro de una carga del configurador, y el selector ahora muestra los nombres de las piezas en lugar de claves internas.

Recorrido: Identidad → producto compuesto; Comercial → cargar e interpretar los archivos una vez; Routing → agregar los productos hijos en paralelo antes de su paso de incorporación; abrir cada componente y elegir «Diseño del producto» y «Piezas por producto»; aplicar y guardar el modelo; Nesting → consolidar compatibles; completar los parámetros de producción y publicar la revisión; cotizar la cantidad de exhibidores, generar y revisar patrones antes de agregar a la OT. Al terminar la configuración inicial faltaba completar el ensamble y publicar. El usuario completó esos datos y publicó V1 antes de la prueba de cotización siguiente.

PostgreSQL local está operativo. El Redis original no arranca por un AOF corrupto; sus datos no se modificaron. Para esta sesión de desarrollo se levantó `grafonest-desarrollo-redis` en `127.0.0.1:6381`, sin persistencia, y API/worker usan `REDIS_URL=redis://127.0.0.1:6381`. La recuperación del Redis original queda fuera de esta modificación.


## Cotización completa comprobada en Chrome

Con V1 publicada y el ensamble configurado por el usuario, se reprodujo el rechazo de `jobContext`: las fuentes guardadas usan schemaVersion 2 con una referencia inmutable, pero el DTO exigía también la configuración de capas del formato anterior. Ahora acepta referencias estructuralmente válidas y conserva la rehidratación por tenant antes del cálculo.

La prueba detectó dos fallos adicionales: los patrones periódicos de impresión no aportaban demanda al lote compuesto, y el navegador consultaba el progreso cada 500 ms hasta provocar HTTP 429 durante la búsqueda de dos minutos. La impresión vectorial aporta ahora su demanda; las consultas aumentan su intervalo hasta cinco segundos y respetan `Retry-After` al recibir 429, sin crear otro trabajo. Un recálculo pendiente o fallido ya no permite guardar el precio anterior.

Se verificaron las poses de los seis componentes contra el lote global: tanto impresión como corte y el `layout_produccion` exportable conservan exactamente las mismas coordenadas, placas, giros y contornos. No se vuelve a cobrar sustrato en el corte.

Resultado del trabajo `quote-d279d192e31560518697d5854c660b5787f2dedaf7c502ae6c34212824a8e516`: 50 exhibidores, 450 piezas exactas, 34 placas de 860 × 564 mm, margen de 5 mm y separación cero; tres patrones repetidos 25, 5 y 4 veces. El worker tardó 120.965 ms. Chrome recibió el resultado sin error y mostró los tres patrones y $1.002.393 con impuestos. No se emitió una OT por parte del agente. Sigue siendo una prueba con corrugado plástico y con el cierre del estante previamente confirmado; no sustituye la revisión de archivos para fabricación.

Validación de las correcciones: DTO e interpretación (33 pruebas), dispatcher y consolidación (68 pruebas), consulta durable del frontend (4 pruebas), TypeScript web y compilación API sin errores. La prueba del registro del lote verifica también la actualización del layout canónico de impresión.

## Primer bloque: corte compartido, entregables y BOM efectivo

Se incorporó una operación consolidada de corte láser vinculada al lote de impresión. Conserva todas las posiciones y la demanda del plan; reúne la preparación y limpieza una sola vez y conserva el tiempo de recorrido. La firma exige la misma configuración publicada, máquina, perfil, centro de costo y condiciones de preparación. Un plan con cortes distintos, manuales, tercerizados o que agrega material mantiene sus operaciones independientes. En esta etapa sólo se consolida el corte si cubre todos los diseños del layout; los subconjuntos requieren un contrato propio para no arrastrar trayectorias ajenas.

El materializador existente de OT recibe dos lotes: impresión y corte. Una prueba con seis componentes comprueba dos pasos operativos, diez participaciones de trazabilidad sin duración adicional y la secuencia revisión → impresión → corte → ensamble. No se emitió una OT real para esta validación.

Las descargas de producción generan un SVG o DXF por patrón, con la cantidad de copias en el nombre, y un resumen de fabricación. El DXF sólo agrega un comentario de metadatos, nunca texto como geometría de corte. La equivalencia entre patrones incluye las operaciones de corte común, para evitar juntar placas con trayectorias distintas. El cotizador muestra el plan y permite ampliar los patrones antes de agregar el producto.

El BOM usa los pasos efectivos de la revisión: omite los marcados NO_EJECUTAR y sus operaciones internas. La proyección también corrige revisiones ya publicadas, sin modificar su snapshot ni invalidar su hash. En Chrome se verificó que desaparecieron Polyfan y los recursos de los pasos omitidos, incluidos los de los componentes; V1 sigue publicada y vigente.

### Nueva prueba completa

Trabajo `quote-ffc42950f8007c1515b2de2d6e27098f22d79ea9d7e64295463e271cb064f893`: 50 exhibidores, 450 piezas, 34 placas y tres patrones A×25, B×5 y C×4. Duración 121.560 ms. Impresión y corte tienen seis participantes cada uno y exactamente los mismos contornos, giros y posiciones. El corte no agrega material y ahorra $11.595,9125 de costo al compartir la preparación; el total comercial visible es $970.148 con impuestos.

Se comprobó el plan antes de agregar, la ampliación del patrón A, los dos lotes visibles en la ficha del ítem y tres botones DXF para el corte. El DXF A descargado en Chrome coincide byte a byte con la exportación calculada. Un parser DXF independiente abrió los tres archivos: 9/25/25 polilíneas exteriores; con las copias respectivas suman 450 piezas. El ítem quedó en un borrador de cotización local; no se emitió la OT. Continúan las condiciones de prueba documentadas para los DXF del exhibidor.

Validación del bloque: 40 pruebas API y 12 frontend aprobadas, TypeScript web y build API correctos. La API y el worker locales están ejecutando el código compilado.

## Segundo bloque: un componente con varias piezas

Implementado el 7 de septiembre de 2026. Para una colección que comparte material y procesos, la configuración del componente acepta hasta 30 diseños guardados con nombre y cantidad entera por producto. El motor cotiza el producto hijo una vez y multiplica cada demanda por la cantidad de productos. Conserva las identidades y la procedencia de cada archivo, incluyendo CORTE_3. El nesting de impresión sobre placas optimiza la colección completa; el corte reutiliza exactamente sus posiciones y contornos, sin otra búsqueda ni un segundo cargo de sustrato.

### Recorrido recomendado para nuevos productos

1. En **Routing**, agregar un componente con la subruta de material y procesos que corresponda. Crear otro componente cuando cambie esa subruta.
2. Abrir su configuración y activar **Varias piezas con la misma subruta**.
3. En **Piezas de este componente**, cargar los DXF/SVG e interpretar cada exterior, capa y unidad. También se pueden reutilizar los diseños ya guardados en el producto.
4. Dar nombre a cada diseño e indicar **Piezas por producto**. La cantidad del componente hereda la del producto terminado; no hay que agregar otro multiplicador.
5. Aplicar los cambios, guardar el modelo y publicar la revisión. El BOM muestra una sola subruta, sus diseños y las cantidades por producto.
6. Cotizar la cantidad de productos y revisar el **Plan de fabricación** antes de agregar: impresión, corte registrado, patrones y descargas por patrón.

Los archivos se asignan a la configuración del componente dentro de la revisión de la ruta. El almacenamiento de originales e interpretaciones sigue siendo central, por producto y tenant; la asignación nueva referencia esas interpretaciones inmutables y no duplica los DXF. No se modifica la revisión histórica. Esta primera colección requiere archivos guardados; el flujo individual conserva «Definir al cotizar», con ancho o alto proporcional en el sheet y sin repetir ambas medidas en el configurador del componente.

### Exhibidor V2 comprobado

Se publicó V2 (`4e5a64fc-622e-4b25-95d5-bf3a405d0872`) del producto de prueba, conservando V1. Contiene un único componente **Piezas de corrugado**, basado en **Corrugado plastico**, con Cuerpo ×1, Soporte ×1, Faldón ×1, Estante ×4, Costilla ×1 y Header ×1. Los seis archivos se reutilizaron desde el editor en Chrome. La preparación de vector y el ensamble siguen perteneciendo a la ruta del exhibidor.

La cotización completa en Chrome para 50 exhibidores (`quote-b5edc86f08e5ffd0eec863f876fbf86215b281497738737efd1ada259bde533b`) terminó en 120.906 ms: **450 piezas exactas, 34 placas, tres patrones A×25, B×5 y C×4**. Una sola subruta contiene impresión y corte activos. El precio mostrado fue $843.970 con impuestos; impresión calcula su tiempo a partir de las 34 placas, y corte a partir del recorrido del conjunto. También se comprobó una cotización de un exhibidor: nueve piezas en una placa. No se emitió una OT.

Después de la cotización se ajustó la reutilización de contornos para conservar la discretización impresa sin reconstruirla con redondeos. Una verificación con las 450 posiciones reales confirmó igualdad exacta de contornos, coordenadas y giros, y que no se invoca de nuevo al optimizador para cortar. Los tres DXF exportados se abrieron con un parser independiente: 9, 25 y 25 exteriores; multiplicados por 25, 5 y 4 suman 450. Las descargas tienen un archivo por patrón y formato, más el resumen.

Validación del bloque: 109 pruebas API aprobadas (configuración, cantidades 1/10/50/51, referencias por tenant, colección, registro, consolidación, BOM y materialización de OT), más 10 pruebas frontend del contrato y exportación. TypeScript web y la compilación API pasaron; API y worker locales se reiniciaron con esa compilación. En Chrome se verificó el BOM V2 con seis diseños, nueve piezas por producto y su capa CORTE_3. Los detalles de esta ejecución se agregan en `benchmarks/exhibidor-50/integracion-worker.json`.


## Unificación visual de piezas con Grafoprint

Se unificaron la configuración del componente, las piezas de Comercial y el detalle del BOM con los tokens de Grafoprint: superficies cálidas, tipografía de la ficha, etiquetas técnicas, acento naranja y acciones primarias oscuras. `piezas-diseno.module.css` contiene los estilos compartidos y `pieza-vectorial-resumen.tsx` presenta miniaturas y datos de la interpretación en las tres vistas. El editor distribuye las piezas en columnas cuando hay espacio y muestra la cantidad junto al nombre; el BOM usa fichas compactas con cantidades por producto. Se eliminó la tarjeta genérica duplicada del componente y el contenedor adicional de Comercial.

El diálogo de importación usa el mismo tratamiento y muestra capa, dimensiones y nombres legibles de unidades en los selectores. Se verificó con el DXF del cuerpo: CORTE_3 y 384,04 × 424,35 mm al elegir puntos tipográficos. La prueba se canceló sin guardar otra interpretación. También se cambió temporalmente la cantidad de Cuerpo de 1 a 2, se comprobó el resumen de 10 piezas y se restituyó a 1 antes de cancelar el editor. La revisión V3 que ya estaba en borrador se conservó.

Verificación: las tres vistas inspeccionadas en Chrome; Comercial y diálogo comprobados a 760 px, restaurando después el viewport; consola de la pestaña sin errores; TypeScript web, lint de los componentes compartidos y 18 pruebas frontend correctos. `css:guard` mantiene las 43 clases globales fuera de su línea de base que ya existían en `globals.css`; ese archivo no se modificó en este bloque. No se alteró el cálculo de nesting ni la cotización.

## Pasos omitidos fuera del flujo

El editor de la ruta reúne los nodos con `NO_EJECUTAR` en “Pasos omitidos”, una sección plegada por defecto con acceso a la configuración de cada paso para elegir su modo de activación. El lienzo elimina sus tarjetas y los momentos que quedan vacíos, y renumera los momentos visibles. Las dependencias y configuraciones originales se conservan: las altas y el arrastre resuelven sus destinos contra los índices del modelo completo. Se corrigió además el desplazamiento del destino al arrastrar una columna entera hacia la derecha, manteniendo el comportamiento de las flechas del editor de rutas base.

En Chrome, el exhibidor muestra cuatro momentos activos y dos pasos omitidos (Corte con hilo caliente y Pintura). Se abrió Pintura desde la sección, se eligió Obligatorio y se comprobó que recupera sus parámetros operativos; se restituyó Omitir sin guardar cambios en el producto. Se revisó la sección a 760 px y se restauró el tamaño del navegador. Verificación: 15 pruebas de layout, TypeScript web, lint de los archivos afectados y `git diff --check` aprobados. El borrador V3 del usuario se conserva.

## Sheet comercial: piezas compactas y plan en diálogo

Las piezas se presentan en una tabla agrupada por componente de la revisión publicada. Cada fila muestra nombre, medidas, cantidad por producto y total del pedido; el detalle conserva archivo, capa e interpretación. La pertenencia se resuelve por el ID de geometría guardada, sin comparar nombres de archivos. Las fórmulas productivas y los componentes repetibles esperan la cantidad resuelta por la cotización; las cantidades lineales se actualizan inmediatamente. Los archivos fijos no ofrecen botones de reemplazo deshabilitados, y la carga obligatoria permanece visible cuando falta el archivo. Los componentes sin datos pendientes ni repeticiones dejaron de generar una tarjeta automática redundante.

El sheet contiene un resumen con estados pendiente, calculando, requiere atención y calculado. El detalle vive en un diálogo Grafoprint amplio con Patrones, Balance de piezas, Cómo se calculó y Archivos. La ampliación de un patrón se realiza dentro del mismo diálogo. Los lotes distintos conservan su selector; los vínculos explícitos entre impresión y corte agrupan las operaciones sin duplicar el material. Se conservan los resultados de cada operación al descargar, con nombre de lote, proceso, patrón y copias. Los resultados de rollo mantienen su visor de distribución y su consumo en metros lineales. Un plan desactualizado no puede abrirse como vigente.

Verificado en Chrome con 1 y 50 exhibidores: 1 placa/1 patrón/9 piezas y 34 placas/3 patrones/450 piezas, respectivamente. El caso de 50 conserva A×25, B×5 y C×4, 79,68% de aprovechamiento, cero excedentes y $843.970 con impuestos. Se revisaron las cuatro pestañas, el detalle CORTE_3 del estante, la ampliación del patrón B, la tabla y el diálogo a 760 px y la restitución del tamaño de navegador. Escape cierra sólo el plan y devuelve el foco a Ver plan sin perder la cantidad ni el precio. El SVG y DXF descargados del patrón A se verificaron: 9 contornos y 25 copias.

Validación: 34 pruebas frontend aprobadas entre cantidades, agrupación de lotes, estados, exportación y controles vectoriales; TypeScript web y `git diff --check` correctos. El lint de archivos nuevos/modificados no incorpora errores: el sheet grande conserva los mismos siete hallazgos de hooks/compiler presentes antes de este bloque, comparados contra una copia previa. No se modificó la receta publicada ni el borrador V3 y no se emitió ninguna OT.

### Corrección de pies de tarjetas y compatibilidad DXF con Illustrator

Las tarjetas de patrones ahora usan una columna flex y el pie tiene margen superior automático: “Inspeccionar patrón” queda en el borde inferior, independientemente de cuántas piezas se enumeren.

Se reprodujo el error 2067 de Illustrator con el DXF mínimo anterior. Quitar únicamente el comentario inicial no resolvió el problema; reescribir el mismo dibujo con tablas, bloques y referencias internas completas sí permitió abrirlo. El exportador usa `dxf-writer` 1.18.4 para generar un documento AutoCAD 2007 completo, con unidades en milímetros, capas declaradas y handles/propietarios. Se preservan polilíneas cerradas, huecos, operaciones abiertas y Common Line; el comentario de las copias queda dentro de HEADER, sin agregar texto como trayectoria.

Los tres DXF reales se exportaron a `output/grafonest-dxf-illustrator` y se abrieron en Illustrator mediante su API con tamaño original y una unidad por milímetro. Illustrator confirmó 9/25/25 trazados, todos cerrados, y los mismos anchos/altos del DXF. Una auditoría independiente con ezdxf no encontró errores ni reparaciones; se compararon todos los puntos contra el nesting original, con tolerancia de 0,0005 mm del redondeo existente. Se ofrece el ZIP `output/Exhibidor-DXF-corregidos-Illustrator.zip` con los tres archivos y las indicaciones de importación. Diez pruebas de exportación, TypeScript web, lint de los exportadores y `git diff --check` aprobados. No cambian el nesting ni los precios.
