# Conservar las capas visibles del DXF en fabricación

Revisión e implementación del 7 de septiembre de 2026.

## Implementación disponible

- La carga DXF usa `ezdxf==1.4.2` para inventariar las entidades visibles. Respeta capas apagadas, congeladas, bloqueadas, visibilidad individual e instancias de bloques. Normaliza saltos de línea Windows antes de leer.
- El diálogo Grafoprint separa **Conservar** y **Uso**, con controles por capa y por entidad. La silueta seleccionada se conserva siempre. «Revisar capas» relee un original ya subido y permite guardar una nueva interpretación. Las interpretaciones y cotizaciones existentes no se migran automáticamente.
- `fuenteJson.fabricacion` (versión 1, opcional en fuentes v2) guarda identidad de cada entidad, capa, tipo CAD, color, tipo de línea, rol opcional, conservación, puntos locales, longitud en mm y precisión de esa longitud. Conserva el origen, factor de unidades, hash del original y referencia a la interpretación. Textos y referencias sin recorrido tienen longitud nula.
- La matriz de cada colocación acompaña al documento por el contrato neutral, OpenNest, lotes compuestos e impresión/corte con registro compartido. Las referencias no cambian la silueta, cantidades ni costos. El documento participa en hashes y equivalencia de patrones.
- La descarga DXF por patrón obtiene las entidades nativas desde el original autorizado por tenant y verificado por hash. Conserva curvas, textos, capas y recursos, separa nombres en conflicto y aplica la misma transformación a toda la pieza. Con corte común sólo añade complementos, evitando duplicar los exteriores resueltos. Si el original no está disponible, informa el error y no entrega un DXF incompleto.
- La salida SVG conserva las referencias y nombres mediante grupos/atributos `data-capa`, `data-entidad` y `data-operacion`, con la misma transformación. Es una representación gráfica aproximada de curvas y textos; el DXF es la salida CAD nativa.
- Las entidades no compatibles deben convertirse en el archivo original o excluirse explícitamente antes de guardar. No se omiten silenciosamente. La división automática de una pieza con recorridos conservados queda bloqueada hasta que se prepare su partición en el original.

La futura asignación de herramientas y cálculo de tiempos puede referenciar `geometriaId` + `entidadId`, filtrar por conservación/rol y utilizar `longitudMm` junto con `precisionLongitud`. Esta entrega conserva esa base; no incorpora nuevas fórmulas de tiempos ni selecciona herramientas automáticamente.

### Runtime y comprobaciones

El proceso API necesita Python con `ezdxf` además del worker de nesting. Instalar `apps/api/requirements-opennest.txt`; `DXF_PYTHON` permite elegir otro ejecutable. Por defecto se usa `OPENNEST_PYTHON`, la venv local o `python3`. Nest copia los scripts Python al build. No requiere una migración de base de datos adicional.

Se agregaron pruebas de conservación, exclusiones, giros cardinales, lectura por tenant/hash, exportación nativa, fallos sin degradación, equivalencia de patrones, bloques, visibilidad, saltos de línea Windows, capas/tipos de línea/fuentes en conflicto y registro impresión/corte. También se verificó el diálogo con el DXF real del cuerpo del exhibidor: 26 entidades visibles en cuatro capas.

## Diagnóstico previo a la implementación


El archivo original se sube completo y la interpretación conserva `archivoId` y su hash. La pérdida está en la representación utilizada para fabricar y exportar:

1. `piezas-archivos-producto.tsx` inicializa `operaciones: []`. Cada entidad adicional queda en **Ignorar** si no se clasifica manualmente.
2. `interpretar-vector.ts` guarda únicamente el exterior y las entidades seleccionadas como `HENDIDO` o `CORTE_INTERIOR`.
3. `operaciones-vectoriales.ts` y `contrato-nesting.ts` ya trasladan y giran las operaciones con cada colocación. Mantienen abiertas las líneas abiertas.
4. `nesting-vectorial-export.ts` exporta esas operaciones usando el tipo como capa DXF. Aunque conserva `capa` en los datos, no la utiliza al escribir el archivo. SVG tampoco conserva los nombres originales de las capas.
5. El importador usa `dxf.toPolylines()`: aproxima curvas con segmentos y omite entidades que ese conversor no admite. Agregar una opción «Conservar» no alcanza para garantizar fidelidad de todo el documento CAD.

Prueba reproducida en memoria con tres capas:

| Capa de entrada | Interpretación actual | Exportación actual |
| --- | --- | --- |
| CORTE_EXTERIOR | Exterior para nesting | CORTE |
| DOBLEZ_ORIGINAL | Hendido, elegido manualmente | HENDIDO |
| GUIAS_VISIBLES | Sin clasificar | No aparece |

La documentación del exhibidor confirma que sus primeras interpretaciones guardaron sólo los exteriores. Las capas adicionales pueden recuperarse a partir del original si éste sigue disponible; no pueden reconstruirse desde el SVG simplificado.

## Comportamiento propuesto

La selección para nesting debe definir qué geometría se acomoda. Conservar una capa debe definir qué contenido acompaña a cada copia. Asignar una operación debe definir qué trazos intervienen en procesos y costos.

| Contenido | Se conserva | Participa en el nesting | Uso productivo |
| --- | --- | --- | --- |
| Silueta elegida | Sí | Define la pieza | Corte exterior |
| Capa de hendido | Sí, con su nombre | Acompaña posición y giro | Hendido si se clasifica como tal |
| Corte interior | Sí, con su nombre | Acompaña la pieza; no habilita encastres automáticamente | Corte interior |
| Guías, marcas y otras capas visibles | Sí, por defecto | No agrega piezas ni cambia su silueta | Sin operación asignada |
| Capas apagadas/congeladas y entidades invisibles | Permanecen en el original | No | Excluidas de la salida de fabricación por defecto |

Una capa bloqueada sigue siendo visible. Además de los flags de la capa, hay que respetar la visibilidad de cada entidad: el inspector actual no comprueba `original.visible === false`. Autodesk documenta ambos niveles por separado: [LAYER](https://help.autodesk.com/cloudhelp/2015/ENU/AutoCAD-DXF/files/GUID-D94802B0-8BE8-4AC9-8054-17197688AFDB.htm) y [códigos comunes de entidad](https://help.autodesk.com/cloudhelp/2023/ENU/AutoCAD-DXF/files/GUID-3610039E-27D1-4E23-B6D3-7E60B22BB5BD.htm).

## Interfaz Grafoprint

Mantener el diálogo y su estética actual. Mostrar una tabla por capa con muestra de color, nombre original, cantidad de entidades, **Conservar al exportar** y **Uso**. Las entidades de una misma capa se pueden desplegar si necesitan funciones diferentes.

- Las capas visibles nacen conservadas. «Sin operación» reemplaza el significado ambiguo de «Ignorar».
- Excluir de la exportación es una decisión separada de clasificar como hendido o corte.
- El exterior seleccionado se distingue en la vista previa y no se duplica como trazo complementario.
- Nombres como HENDIDO o DOBLEZ pueden sugerir una función, pero la conservación no depende de acertar esa clasificación.
- La vista previa permite encender y apagar capas para revisarlas. Ocultarlas en la vista previa no cambia lo guardado.

## Datos y exportación

Conservar tres representaciones relacionadas: el DXF original inmutable, la geometría simplificada de nesting y un documento de fabricación versionado con las entidades conservadas.

El documento de fabricación debe registrar identidad estable de entidad, capa original, color y tipo de línea, geometría nativa o referencia verificable al original, función asignada y exclusión explícita. Guardar también la transformación de coordenadas del archivo a la pieza normalizada. Los identificadores deben incluir la instancia de bloque cuando existan INSERT repetidos.

Puede añadirse un bloque opcional versionado a `fuenteJson`, conservando la lectura de fuentes anteriores. El SVG exterior y `operaciones` siguen siendo proyecciones compatibles de esa misma interpretación; no deben transformarse en dos configuraciones editables independientes. La clasificación de fabricación y las capas conservadas entran en la huella de la fuente, la caché y la equivalencia de patrones.

Cada colocación debe aplicar a todas sus entidades la misma conversión de unidad, normalización, giro y traslación que al exterior. Nunca recalcular un origen independiente por capa. Esto también aplica a piezas repetidas, componentes y lotes compartidos entre impresión y corte.

Para DXF, generar un documento nuevo con las entidades CAD originales conservadas y transformadas, sus capas y recursos necesarios. Evitar reconstruir toda la exportación a partir de las polilíneas del nesting. Evaluar `ezdxf` dentro del proceso Python que ya utiliza el proyecto; no está instalado actualmente. Sus módulos de [transformación](https://ezdxf.readthedocs.io/en/stable/transform.html) e [importación de entidades y recursos](https://ezdxf.readthedocs.io/en/stable/xref.html) ofrecen esta base, pero tienen entidades no soportadas y errores que no siempre lanzan excepciones. La implementación debe auditar sus resultados y declarar cualquier contenido no conservable.

Para SVG, exportar grupos por capa con nombre y propiedades equivalentes, sin prometer equivalencia completa de funciones CAD como cotas, bloques o fuentes tipográficas.

Cuando dos archivos tengan capas del mismo nombre con propiedades o funciones diferentes, conservarlas separadas con un nombre de pieza o archivo como prefijo. Unirlas sólo si sus definiciones coinciden. En corte común, exportar las trayectorias exteriores resueltas una sola vez; las capas complementarias acompañan cada pieza sin duplicar el exterior original.

Los trazos fuera del exterior deben seguir guardados. Una guía de referencia no modifica la demanda de material; una operación física que sale del exterior requiere revisar el área real de trabajo. Si un archivo incluye varias piezas, la pertenencia de cada entidad debe resolverse antes de repetirla: no copiar indiscriminadamente el documento completo en cada pieza.

## Orden de implementación y compatibilidad

1. Inventariar entidades visibles y propiedades, distinguir conservación de función y guardar la interpretación versionada.
2. Propagar las referencias y transformaciones por todo el recorrido del nesting. Validar primero exteriores, hendidos y referencias abiertas de los DXF del exhibidor.
3. Incorporar la exportación CAD con capas originales y la exportación SVG por grupos. Validar apertura y superposición en Illustrator y en el software de fabricación utilizado.
4. Agregar una acción para recuperar capas de archivos ya subidos. Crear una interpretación nueva a partir del original; actualizar la receta mediante su flujo de revisión y publicación. Las cotizaciones y órdenes históricas conservan sus versiones.

No basta con cambiar el valor por defecto del selector: hay que cerrar también persistencia, transformaciones, nombres de capa y fidelidad de las entidades exportadas.

## Validación requerida

- Contorno exterior, hendido abierto y referencias: importar, guardar, cotizar, exportar y reimportar conservando nombres, cantidades y posiciones.
- Capas visibles, apagadas, congeladas, bloqueadas y entidades invisibles; bloques y capas sin tabla explícita.
- Unidades distintas y origen desplazado; copias giradas a 0°, 90°, 180° y 270°.
- Curvas, bulges, splines y texto admitido: comparar geometría y registrar tipos no soportados.
- Componentes de varias piezas y cantidades; ninguna guía altera las cantidades ni los costos de corte.
- Patrones con el mismo exterior y diferentes capas complementarias: no agruparlos como equivalentes.
- Impresión/corte vinculados y corte común: registro conservado y sin trayectorias duplicadas.
- Referencias históricas, límites de tamaño y autorización de acceso al archivo original.

En esta revisión pasaron las 11 pruebas existentes de interpretación/operaciones y las 14 de exportación/patrones. Verifican la funcionalidad actual; todavía no cubren la conservación automática de todas las capas propuesta aquí.

## Corrección de entrega verificada — 7 de septiembre de 2026

Los visores de patrones y placas muestran ahora los recorridos conservados, incluidos los que no tienen operación asignada. El corte que hereda un acomodo de impresión conserva también el propietario y la interpretación de cada pieza.

Para las interpretaciones antiguas se recuperan las capas desde el original inmutable, comprobando su hash y la coincidencia geométrica. Esta recuperación ocurre en lectura: no cambia el exterior usado para cotizar, las posiciones, las operaciones costeadas ni el snapshot. Si no se puede comprobar la correspondencia, se informa el problema y no se entrega una exportación incompleta. Las fuentes antiguas de corte sin propietario se vinculan por el ID del diseño de su componente.

La exportación DXF copia entidades CAD originales con sus capas y recursos. La equivalencia de capas compara los materiales y estilos referenciados, no sus handles locales a cada documento. Los handles diferentes de recursos equivalentes no provocan renombrados innecesarios; las propiedades o funciones realmente distintas siguen separadas.

El caso del exhibidor se verificó desde la interfaz: seis diseños, nueve piezas y cuatro cierres rectos de estante ya confirmados. El DXF contiene 54 entidades en milímetros; el anterior contenía sólo nueve polilíneas en CORTE. La validación CAD no detectó errores. Se verificaron además exclusiones, copias giradas, referencias sin operación, recuperación histórica y errores de integridad.

En la descarga final se conservan 124 segmentos curvos nativos. CORTE_3 del faldón usa ACI 7 y el resto ACI 250: esa diferencia real se conserva en una capa separada. El DXF verificado está en `output/capas-dxf/exhibidor-patron-A-x1.dxf`.
