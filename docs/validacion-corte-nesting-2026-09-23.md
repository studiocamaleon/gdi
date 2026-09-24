# Corte y nesting — validación de Grafo

Fecha: 23/09/2026. Documento de trabajo para la preparación de producción.

## Qué quedó revisado y corregido

1. Las rutas con perfiles por herramienta exigían geometría vectorial incluso al cotizar rectángulos o estimar placas. CNC, mesa y láser ahora miden el perímetro rectangular o el recorrido manual usando los mismos perfiles, velocidades, pasadas, desgaste y tiempos de manejo.
2. La impresión UV previa exigía piezas aunque se hubiera elegido una estimación por placas. Ahora impresión y corte utilizan las mismas placas declaradas; el sustrato se cobra una sola vez y no se inventan posiciones ni porcentaje de aprovechamiento.
3. El plotter podía volver a acomodar un rollo ya impreso según su propia máquina. Cuando hereda ese trabajo, incluso después de un laminado que conserva el material, mantiene posiciones, orientación, ancho y largo impresos. Rechaza un rollo más ancho que la máquina, un material distinto o posiciones que invaden los márgenes del plotter. Un paso con sustrato propio sigue resolviendo su propio acomodo.
4. Un archivo predeterminado podía reaparecer al elegir medidas o placas. La resolución de fuentes respeta ahora la modalidad elegida y descarta geometría residual del modo anterior.
5. El sheet comparte un selector **Rectangular / Archivo SVG o DXF / Por placas**. La opción activa coincide con los campos visibles. El producto decide cuáles permite; los productos con sólo una modalidad no muestran un selector innecesario.
6. La configuración «Permitir estimación manual por placas» puede habilitarse también en un producto rectangular. Tiene efecto en rutas con herramienta de cotización de corte sobre placas.

## Qué puede cotizarse hoy

| Trabajo | Rectangular | Archivo irregular | Estimación por placas |
|---|---|---|---|
| Acrílico, MDF u otro rígido cortado con láser | Sí | Sí, SVG/DXF interpretado | Sí, si el producto lo habilita |
| Rígido cortado con router CNC | Sí | Sí, contornos de corte | Sí, si el producto lo habilita |
| Material sobre mesa de corte | Sí | Sí; admite corte completo, parcial y hendido con perfiles correspondientes | Sí, recorrido estimado de corte completo |
| UV sobre placa + cualquiera de los cortes anteriores | Sí, mismo layout | Sí, mismo registro físico | Sí, mismas placas totales |
| Vinilo de corte en plotter | Sí, acomodo de cajas en rollo | No hay nesting irregular de contornos sobre rollo en este recorrido | No corresponde |
| Vinilo impreso + plotter | Conserva el rollo impreso | El perfil estima complejidad; no equivale a medir contornos irregulares | No corresponde |
| Adhesivo impreso en hojas + plotter | Usa el área de los pliegos impresos | No hay un nuevo nesting irregular del plotter | No corresponde |

«Sí» describe capacidad del motor, no la configuración automática de todos los productos del catálogo. Requiere material con formato/precio, máquina compatible, perfil y ruta publicados. El permiso `nesting_irregular` continúa controlando el acceso al nesting irregular; esta revisión no altera los planes.

En una impresión UV previa, las posiciones impresas mandan: el corte no puede buscar otro acomodo más eficiente después de imprimir. Un producto de corte solo puede aprovechar los contornos directamente; una ruta UV + corte también debe preservar el registro.

La cotización por placas es una **estimación**: se ingresan las placas totales del trabajo y los metros de corte por placa. Ejemplo: 50 piezas, 2 placas y 15 m de corte por placa = 2 placas y 30 m de recorrido. No se vuelven a multiplicar las placas por las 50 piezas. Si el perfil aplica un tiempo por entrada de herramienta, se debe informar además cuántas entradas tiene cada placa.

La estimación manual actual cubre corte completo. Para medir por separado hendido, medio corte y cortes internos, usar un archivo interpretado con esas operaciones. El cálculo de desbaste 3D, vaciados o trayectorias CAM no queda validado por las pruebas de contornos de esta revisión.

## Cómo configurar los perfiles

### Router CNC y mesa de corte

1. **Máquina:** dimensiones útiles, espesor máximo, centro de costo con tarifa publicada y tiempos de preparación, limpieza, carga/descarga y registro.
2. **Herramientas:** fresa, cuchilla, rueda u otra compatible; operaciones que permite; posición y condición montada; desgaste incluido en el centro o por vida útil.
3. **Perfil por operación/material/espesor:** seleccionar la herramienta, material y rango de espesores. Cargar velocidad con su unidad, cantidad de pasadas y si la velocidad es por pasada o del proceso completo. Si se cotizan entradas, cargar segundos por entrada.
4. **Producto y ruta:** elegir máquina, activar cotización por operaciones y configurar el sustrato. Si hay dos perfiles igualmente compatibles, elegir explícitamente el perfil del producto.
5. **Impresión + corte:** configurar el sustrato en impresión y hacer que corte lo herede. Ambas máquinas deben admitir las placas y el layout. No cargar el mismo material como un segundo consumo.
6. **Validación del taller:** comparar una tirada real con la duración estimada, ajustar la velocidad y tiempos de manejo, y publicar la receta.

Ejemplo de prueba, no una velocidad recomendada: 30 m de contorno, 1.000 mm/min y 2 pasadas producen 60 m procesados y 60 minutos de recorrido, más preparación y manejo. Si se declara velocidad efectiva del proceso completo, las pasadas no vuelven a multiplicar ese tiempo.

Los perfiles CNC antiguos con `tipoOperacion` siguen siendo compatibles cuando la ruta elige uno explícitamente. No se infiere que cualquier perfil de fresado o grabado sea de corte. Para configuraciones nuevas conviene usar los perfiles por herramienta/material/espesor.

### Plotter

Usa perfiles de productividad en m²/h según la complejidad del trabajo. No toma esa cifra como mm/min. El soporte (rollo u hoja) se obtiene del material. Para impresión + corte en rollo, configurar la impresión con márgenes suficientes para el plotter; el sistema avisa si no puede conservar la posición de las piezas.

## Estado de las máquinas de desarrollo revisadas

| Máquina | Estado observado | Pendiente real |
|---|---|---|
| Router CNC 130x180 | Activa, perfil DEMO para acrílico de 3 mm | Calibrar avance y tiempos con producción física |
| Vega 1.6 | Activa, dimensiones y cuatro perfiles DEMO | Confirmar medidas de la máquina y calibrar velocidades |
| Plotter de Corte 160 cm | Activo, 3 perfiles | Contrastar productividad por complejidad con trabajos reales |
| Cortadora Laser CO2 | Activa, 1 perfil | Confirmar cobertura de materiales y espesores de cada producto antes de ampliar el catálogo |

Después de la primera revisión, el usuario autorizó completar estas máquinas en la base local con datos de referencia o simulados. Se conservaron los perfiles existentes de UV, ecosolvente, plotter y láser. Las configuraciones originales de CNC y mesa quedaron respaldadas en `.tmp/demo/corte-maquinas-originales.json`. El catálogo DEMO persiste para seguir probando desde la interfaz; las pruebas automatizadas anteriores siguen usando la base de tests.

## Evidencia de validación

- **851 pruebas backend**, 74 suites: motor, nesting, tiempos, materiales, geometrías, consolidación, selección de perfiles y validación de máquinas. En la última corrida, 850 pasaron juntas y una prueba de archivos grandes excedió 35 s mientras se ejecutaban ambas compilaciones; repetida sola pasó en 1,86 s, sin modificar el timeout.
- Incluye **23 nuevos recorridos integrados**: 18 combinaciones de 3 familias × 3 modalidades × con/sin UV; 3 casos CNC con perfil anterior; 2 de plotter en rollo, solo y con impresión.
- Los recorridos crean máquinas/materiales/productos temporales, cotizan, emiten y finalizan una OT en la base de test. Verifican geometría, recorrido, material cobrado una sola vez y registro compartido. Las comunicaciones y la preparación externa de recorridos se sustituyen por dobles; no ejecutan máquinas físicas.
- **21 pruebas frontend**, incluyendo cambio de modalidades en el sheet completo para las tres familias. Comprueban que no viajen placas o archivos residuales al volver a medidas.
- Revisión visual con la sesión del usuario: selector en acrílico, medidas 20 × 10 cm, cálculo visible; flujo de archivo en Polyfan. Sin emitir ni guardar una OT real.
- TypeScript frontend y compilaciones frontend/backend sin errores. Lint de los componentes revisados sin errores; conserva una advertencia previa de dependencias de un efecto en el editor vectorial.

Comando reproducible backend:

```sh
npm --prefix apps/api test -- --runInBand --testPathPatterns='motor-universal|resolver-fuentes.spec|interpretar-vector.spec|maquinaria-template-profile|maquinaria-template-machine|procesamiento-corte'
```

Archivos para prueba manual: `outputs/qa-corte/rectangulo-200x100.svg` y `outputs/qa-corte/contorno-L-200x100.svg`. Ambos tienen perímetro 600 mm por pieza; sus áreas son distintas (0,02 y 0,015 m²). Para probar cantidad: 50 copias dan 30 m de corte antes de pasadas. Abrir el producto, elegir Archivo, cargar SVG y mantener ancho final 20 cm.

## Antes de desplegar

Esta revisión valida el bloque de cotización/corte; no constituye una aprobación de toda la aplicación para producción. El siguiente paso es contrastar los perfiles DEMO con tiempos y materiales del taller. Para un piloto se pueden mantener inactivas las máquinas incompletas y usar las rutas ya configuradas.

El despliegue requiere además revisar el entorno destino, migraciones pendientes de la rama, worker de geometría, almacenamiento, correo, facturación y comprobación de arranque. No se desplegó ni se enviaron cambios a Git desde esta revisión.


## Catálogo DEMO persistente en la base local

Carga autorizada del 23/09/2026, empresa Grafica Corporearte. Script reproducible: `apps/api/scripts/demo-corte-local.cjs`. Manifest con IDs y resultados: `outputs/qa-corte/demo-local.json`.

### Fuentes y parámetros

- **CNC:** [Amana Tool — Plastic O-Flute Speed Chart](https://www.amanatool.com/pub/media/productattachments/Plastic-O-Flute-Speed-Chart-v9.pdf) publica 70–110 pulgadas/minuto a 18.000 rpm para la fresa de 3 mm (1.778–2.794 mm/min). Se eligieron **2.000 mm/min**, fresa de 3 mm, una pasada de 3 mm para el acrílico DEMO. Es una referencia para simular, no una calibración de este router.
- **Mesa:** [Zünd — Overview of oscillating tools](https://www.zund.com/media/474/download/pri_Overview%20of%20oscillating_tools_8_EN-us.pdf?v=2) respalda la familia de herramientas para corrugado, cartón y espumas; no aporta las velocidades numéricas usadas aquí. Los **6.000 mm/min** de PP, **9.000 mm/min** de cartón, **6.000 mm/min** de medio corte y **12.000 mm/min** de hendido son valores **simulados**.
- CNC: área 1.300 × 1.800 mm. Mesa: área simulada 1.600 × 2.500 mm. Preparación, carga, registro y limpieza de ambos equipos son tiempos de prueba.
- Centros y tarifas: se utilizaron los existentes publicados en septiembre de 2026. Se crearon cuatro materiales separados, cada uno con 100 m² iniciales en **DEMO · Pruebas de corte / Material simulado**. El sustrato consumido es de ese almacén.
- Se completó la unidad de precio `ML` de cuatro variantes existentes de tinta ecosolvente que tenían importe sin unidad. Es una interpretación explícita de prueba; se conservaron los importes y se respaldó su estado en `.tmp/demo/corte-tintas-originales.json`.

### Productos disponibles

Buscar **DEMO** en Agregar producto:

| Producto | Modalidades |
|---|---|
| DEMO · Acrílico cortado en CNC | Rectangular, SVG/DXF y placas |
| DEMO · Acrílico UV + CNC | Rectangular, SVG/DXF y placas |
| DEMO · Corrugado cortado en mesa | Rectangular, SVG/DXF y placas |
| DEMO · Corrugado UV + mesa de corte | Rectangular, SVG/DXF y placas |
| DEMO · Packaging: corte, medio corte y hendido | DXF predeterminado, reemplazable |
| DEMO · Vinilo cortado en plotter | Medidas rectangulares, estimación del perfil por m² |
| DEMO · Vinilo impreso + plotter | Medidas rectangulares, conserva el layout impreso |

### Resultados del recorrido

**15 escenarios cotizados:** 12 combinaciones de CNC/mesa, con/sin UV y tres modalidades; dos de plotter; uno de packaging. Se comprobaron tiempos positivos, cantidades, sustrato cobrado una sola vez y conservación del layout entre impresión y corte.

| OT | Caso | Resultado |
|---|---|---|
| [OT-2026-0076](http://localhost:3000/produccion/ordenes/7e0a53f8-9140-4698-9e73-5095c9634039) | Acrílico UV + CNC irregular, 20 piezas | Entregada; consumió 1,4884 m² |
| [OT-2026-0077](http://localhost:3000/produccion/ordenes/c9ffb15f-6b8d-4d1f-aa25-9a0da3ad0a1b) | Corrugado UV + mesa rectangular, 20 piezas | Entregada; consumió 2 m² |
| [OT-2026-0079](http://localhost:3000/produccion/ordenes/43ee8b11-64ac-41af-92d7-659029957a76) | Vinilo impreso + plotter, 20 piezas | Entregada; consumió 0,822 m² |
| [OT-2026-0081](http://localhost:3000/produccion/ordenes/48a22ecb-58bc-4d13-8128-2b3c64026e22) | Packaging, 20 piezas | Entregada; consumió 1,5 m² |
| [OT-2026-0080](http://localhost:3000/produccion/ordenes/e003cbf1-a5d0-4989-bf84-1f704b9ab804) | Acrílico UV + CNC, estimación de dos placas | Pendiente para revisión; 2,9768 m² reservados |

Las cuatro pruebas completas usaron los servicios reales de emisión, reserva automática, consumo de sustrato, inicio y finalización secuencial de pasos y entrega. La producción se simuló en el software; no se accionaron máquinas ni se tomaron tiempos físicos. El cliente DEMO no tiene contacto y se inhibieron los avisos externos del script. El consumo de tintas no formó parte de este recorrido.

La primera prueba de packaging generó la OT-2026-0078. Su DXF mínimo podía cotizarse, pero el visor CAD lo rechazaba por falta de estructura. Se reemplazó por un DXF completo generado con `dxf-writer`, validado por el lector nativo, y se repitió el recorrido en la **0081**. La 0078 permanece como historial de prueba; no se modificaron sus snapshots ni su geometría emitida. Por eso existen seis OT físicas de este ensayo y el cartón tiene dos consumos de 1,5 m². El manifest conserva esa primera prueba en `fixturesReemplazadas`.

### Corrección encontrada en el motor

Al mandar al worker una interpretación individual guardada (schema 2), sólo se enviaba el SVG de su silueta. Se perdían hendido, medio corte y procedencia del archivo. El control de consistencia rechazaba el resultado porque había menos recorridos. Ahora se envía el problema completo, igual que para las colecciones.

Para 20 copias del troquel de 200 × 100 mm se mantienen **12 m de corte completo, 1,6 m de medio corte y 2 m de hendido**. La prueba de regresión reproduce el paso por la función del worker y compara las tres operaciones. **31 pruebas focalizadas pasaron**, en tres suites; compilación backend correcta.

### Repetir desde la interfaz

1. Crear orden → Productos → Agregar producto → buscar DEMO.
2. CNC o mesa: Rectangular, 20 piezas de **20 × 10 cm**. Revisar precio y aprovechamiento.
3. Archivo: usar `contorno-L-200x100.svg` de `outputs/qa-corte`, conservando ancho final 20 cm.
4. Por placas: cantidad comercial 20; **2 placas totales, 6 m de corte y 10 entradas por placa**. El corte total debe ser 12 m.
5. Packaging: elegir el producto, indicar 20 unidades y abrir **Ver plan**. Tiene DXF predeterminado con las tres operaciones; no requiere subir un archivo.
6. Para revisar reserva, producción y la estimación por placas ya emitida, abrir la OT-2026-0080.

En el navegador se verificaron CNC rectangular, CNC por placas y packaging con su plan de fabricación y agregado al detalle de la propuesta. Los restantes escenarios tienen evidencia de servicios reales en el manifest. También se descargó el DXF del layout de la OT-2026-0081 desde la interfaz y se validó con el lector CAD: **20 exteriores + 20 hendidos + 20 medios cortes**, sin errores de estructura. Copia en `outputs/qa-corte/packaging-layout-A-x1.dxf`.

Se corrigió además la posición de la vista ampliada de aprovechamiento/producción: heredaba el desplazamiento de −50 % del diálogo centrado aunque ya usaba márgenes de pantalla completa. Ahora elimina ese desplazamiento y mantiene el scroll dentro del modal.

Reejecución local (desde `apps/api`, con API compilada):

```sh
node --env-file=.env scripts/demo-corte-local.cjs --aplicar --recorrido
```

Las altas y las emisiones registradas son idempotentes: no se vuelven a ingresar los 100 m² ni a crear las mismas OT. No sobrescribe perfiles o productos DEMO ya editados. El script restringe su uso a `localhost/gdi_saas` y rechaza el entorno de producción.
