# Varios archivos heredados por componentes

## Comportamiento

El sheet permite cargar varios SVG/DXF para una fuente vectorial del padre cuando hay componentes configurados con «Heredar el diseño vectorial del padre». Se reutilizan la carga por lotes, la interpretación de capas y el editor de cantidades de las piezas. No requiere cambiar ese binding ni crear un componente por archivo.

- La cantidad de la cotización sigue siendo la cantidad de productos.
- Cada archivo tiene su cantidad de piezas por producto.
- Todos los archivos de esa fuente pasan a cada componente que la hereda. Cada componente mantiene su material, máquina, proceso y nesting.
- Las fuentes nombradas diferentes permanecen separadas. Las piezas fijas de una receta, como las de un exhibidor, mantienen su comportamiento.
- Se guardan las colecciones en el contexto de cotización y se restauran al editar el ítem. Las fuentes siguen usando referencias a interpretaciones inmutables, incluidas sus capas.

`coleccionesVectoriales` amplía las fuentes nombradas de `geometriasVectoriales`. Al resolver el componente se convierte en la colección `disenosVectoriales` ya utilizada por el motor. Las medidas requeridas se derivan de los archivos y no se piden nuevamente al comercial.

## Validación tras recuperar la sesión

- 78 pruebas del backend: herencia, cantidades, nesting, DTO, referencias compactas, configuración de componentes y piezas fijas.
- 32 pruebas del frontend: contexto enviado, cantidades, planes por material, transporte de fuentes y exportación de fabricación.
- TypeScript del frontend, compilación de API, ESLint de los componentes modificados y `css:guard` sin errores.
- Navegador: carga SVG/DXF en el cartel real, interpretación y dos piezas visibles; el DXF conserva la capa exterior y una capa de guía.
- Script `apps/api/test/validacion-cartel-archivos-compartidos.ts`: cotiza, guarda, emite y ejecuta el cartel real dentro de una transacción que siempre se revierte. Con Letras1 × 1 y Letras2 × 1, un cartel produce dos piezas tanto en Polyfan como en acrílico. Con diez carteles y Letras2 × 2, produce treinta piezas en cada material. Verifica fuentes, capas, contexto persistido y traslado de los tiempos cotizados a la OT.

## Incorporación en un paso desactivado: corregida

La primera validación no pudo emitir la OT: ambos componentes apuntaban a «Corte con hilo caliente» del padre, un paso configurado como NO EJECUTAR en la cotización. El materializador omitía correctamente ese corte pero exigía encontrarlo para conectar los hijos. Era una inconsistencia al proyectar el flujo cotizado, no una limitación de la carga de archivos.

- Si la incorporación existe, conserva su conexión habitual.
- Si está explícitamente desactivada en la cotización y existe en la receta congelada, conecta los terminales de cada componente con los primeros sucesores activos de esa incorporación, incluyendo bifurcaciones y cadenas de opcionales omitidos.
- Sin sucesores activos, cada componente termina su propia rama. Conserva los predecesores configurados y la OT espera todos los pasos antes de finalizar.
- No agrega operaciones, tiempos ni costos. Si falta una incorporación activa o no hay evidencia de su desactivación, conserva el bloqueo por inconsistencia.

Validación: 16 pruebas de materialización, componentes anidados, proyección de grafos y ejecución; compilación de API correcta. Se emitió y completó también la cotización real `52741294-2254-47cd-8baf-94284b5386cb` sin recalcularla ni republicar: preparación del padre (15 min), preparación de Polyfan (15 min), hilo caliente (23 min) y láser (22 min). Terminó en `finalizada`. Los dos casos de uno y diez carteles también llegaron al cierre de OT. Todas las escrituras se revirtieron.

El recorrido usa los servicios reales de cotización, OT y ejecución; aísla las comunicaciones y la preparación externa de recorridos de corte. Esa última integración no forma parte de esta prueba. Para los casos de archivos sintéticos, las publicaciones se actualizan sólo dentro de la transacción de prueba; la cotización real se valida tal como quedó guardada.

La app, la API, el worker de nesting, PostgreSQL y Redis quedaron levantados después del apagado. Se regeneró la caché de desarrollo de Next; los cambios de código siguen en la rama `codex/cotizacion-operaciones-herramientas-corte`, sin commit ni merge nuevos.
