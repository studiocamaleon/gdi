# Herramientas y operaciones de corte — implementación pre-F5

Rama: `codex/cotizacion-operaciones-herramientas-corte`, desde `visual-ilusion/analisis`.
Estado: **implementada y validada localmente el 08/09/2026**. Rama todavía no integrada a `visual-ilusion/analisis`; sin despliegue remoto. La API y el worker locales ejecutan esta versión.

## Cómo usarlo

1. En **Maquinaria → Ajustes → Herramientas y preparación**, configurar las posiciones y herramientas reales, cuáles comienzan montadas y los tiempos de preparación, limpieza, carga/descarga, registro y cambios.
2. Agregar **perfiles por herramienta**: operación, material del inventario, rango de espesor, velocidad medida, modalidad de velocidad y pasadas. El desgaste puede estar incluido en el centro de costo o calcularse por metros/horas con costo de reposición y vida útil.
3. En el producto, activar **Cotizar operaciones del archivo por herramienta** en el nodo de corte. La elección automática exige un único perfil compatible por operación; se puede fijar un perfil en **Operaciones sobre las piezas** para resolver alternativas.
4. Al interpretar el DXF, asignar corte completo, corte parcial o hendido a las entidades/capas correspondientes. Las referencias pueden conservarse sin operación.
5. Cotizar y revisar **Recorridos y herramientas** en el detalle y plan de fabricación. El material, espesor y los perfiles deben ser compatibles; los faltantes bloquean la cotización con su explicación.

Ejemplo: diez exhibidores con exterior, cortes parciales y dobleces acumulan por separado los metros de cada operación. Cada recorrido usa su herramienta, velocidad y pasadas. La cantidad real de placas determina carga y registro; la secuencia determina los cambios de herramienta. Al compartir una tanda, preparación y redondeo se calculan una vez y luego se reparten entre componentes.

## Contrato

- Configuración versionada de posiciones, herramientas y tiempos comunes en `Maquina.parametrosTecnicosJson.procesamientoCorte`. Sin migración de esquema.
- Perfiles operativos vinculan una herramienta estable con operación, materiales, rango de espesor, velocidad, pasadas, ancho de corte y parámetros auxiliares.
- Corte completo, corte parcial y hendido se asignan a entidades DXF independientemente del nombre/color de la capa y de su función geométrica. Las referencias conservadas no suman tiempo.
- El producto activa expresamente `cotizarOperacionesVectoriales`. Las recetas anteriores conservan su cálculo. Las recetas por herramientas no participan en la selección automática antigua.
- Secuencia por placa: hendido → corte parcial → corte completo. Las herramientas montadas pueden activarse sin reemplazo; dos herramientas en una misma posición requieren cambio físico. Cambios de perfil son ajustes, no herramientas adicionales.
- Tiempo = preparación + recorridos efectivos + entradas + ajustes + carga/registro por placa + cambios/activaciones + limpieza + otros tiempos del nodo. Se aplica un solo redondeo al trabajo. Tarifa del centro vigente; desgaste específico aparte para evitar cargarlo dos veces.
- Velocidad por pasada multiplica pasadas. Velocidad efectiva del proceso completo no las vuelve a multiplicar ni admite entradas adicionales.
- El snapshot conserva herramientas, perfiles, parámetros y fuentes/entidades, y permite recalcular agrupaciones físicas sin consultar el catálogo vivo.
- La consolidación vuelve a calcular la secuencia real de la tanda. Reparte tiempo y desgaste con el criterio de participación del lote; preparación y redondeo se calculan una vez. Los cargos directos adicionales en el nodo conservan el cálculo independiente.

## Límites deliberados del piloto

Placas y recorridos vectoriales interpretados, sin segmentación automática de operaciones. Un puente con trabajo secuencial. No simula herramientas simultáneas, alimentación continua, estrategias CAM de fresado, aceleraciones ni G-code. Los parámetros de profundidad/presión/RPM describen la receta; la velocidad y pasadas deben calibrarse. El DXF mantiene capas y geometría; no reemplaza el software de control específico de la máquina.

No se conoce el modelo de Visual Ilusión. No se precargan velocidades supuestas en su catálogo.

## Validación terminada

- API completa: **252 suites, 2.281 pruebas y 10 snapshots aprobados**. Permanecen 3 suites / 11 pruebas omitidas. Ejecución: `npm --prefix apps/api test -- --runInBand`.
- Frontend completo: **82 archivos, 702 pruebas aprobadas**, con `npm test`.
- Prueba integrada con PostgreSQL: guardado y actualización por el servicio real de maquinaria → interpretación DXF → cotización persistida → emisión y ejecución de OT. Verifica los tres procesos y sus fuentes, cambia después la velocidad del catálogo y comprueba que se conserva la receta cotizada. Los datos se crean en una transacción revertida de la base de pruebas.
- Pruebas de cantidades 1/10/50, pasadas y velocidad efectiva, posiciones y herramientas montadas, referencias, perfiles incompatibles/ambiguos, espesor, líneas compartidas, consolidación registrada, cambios de placas por impresión y reparto de preparación/tiempo/desgaste.
- Exportación: la capa de corte parcial conserva nombre y geometría. Se mantienen los controles existentes para DXF nativo y fuentes históricas.
- Permisos: se ocultan los nuevos importes de desgaste y reposición cuando el usuario no puede ver costos, conservando la información técnica.
- Interfaz revisada en escritorio y móvil de 390 × 844, incluido el modal y sus errores. Los perfiles por productividad anteriores siguen disponibles y editables. Los borradores utilizados para revisar la UI se descartaron, sin modificar el catálogo real.
- Compilación de API y Next con webpack, TypeScript, ESLint focalizado, `npm run css:guard` y `git diff --check`: aprobados. Next emitió advertencias del optimizador CSS pero completó el build; no se modificó `globals.css`.

La ejecución de pruebas en paralelo con el build produjo dos timeouts; la repetición completa sin esa carga terminó aprobada. La prueba integrada declara un timeout de 45 s y su transacción mantiene un límite de 30 s.

## Relación con F5

Esta ampliación resuelve la estimación técnica y económica previa a producción. F5 sigue pendiente: planes persistentes y revisiones operativas, consolidación entre órdenes, aprobación/liberación y comparación de ejecución. Debe partir del snapshot cotizado, sin reemplazarlo por los perfiles actuales del catálogo.
