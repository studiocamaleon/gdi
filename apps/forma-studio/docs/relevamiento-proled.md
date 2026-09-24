# Relevamiento de Proled y oportunidades para Grafo3D

Fecha: **5 de septiembre de 2026**. Referencia: [Proled, aplicación autenticada](https://app.proled3d.com/), versión visible **2.430**, acceso Premium. Comparación contra el código local de Grafo3D de esta fecha, en `apps/forma-studio`.

## Resultado del relevamiento

Proled ofrece **27 estructuras de letras, organizadas en cuatro familias**, y un modo adicional **Neon Flex Beta**. Esas 27 opciones combinan tipos de frente, posición del acrílico y variantes de base/cierre; no representan 27 construcciones completamente distintas que haya que agregar a nuestras doce familias.

Las incorporaciones de mayor interés son:

1. Configuración consistente por **base, cuerpo/tapa, acrílico y encastres**, con componentes independientes en el visor, los archivos y los costos.
2. **Frente calado con difusor acrílico interno**, con seis patrones y protección de bordes.
3. Bases desmontables con borde, al ras, anillo para PVC y doble canal; **cierre de PVC con traba trapezoidal**.
4. **Guillotina con cola de milano** para fabricar carteles mayores que la cama de impresión.
5. **Neon Flex desde líneas centrales DXF**, incluidos recorridos abiertos y túneles de cableado.
6. Cálculo eléctrico, calibración de impresión y simulación sobre fachada.

Grafo3D **ya genera letras de dos piezas encastrables**: `printed-fit`, `acrylic-fit`, ciertas variantes `organic` y la bandeja de `halo`. La carencia no es general. Debemos ampliar las variantes y hacer más clara y uniforme la edición de cada pieza. Actualmente, por ejemplo, la altura interior de `printed-fit` se expresa como una reducción respecto de la exterior; en Proled se introduce directamente la altura de la base.

Este trabajo es un **relevamiento**, sin cambios al motor ni a la interfaz de Grafo3D.

Avance posterior: se implementaron el [editor por componentes](./editor-por-componentes.md), las [seis bases y el cierre de PVC](./bases-y-cierre-pvc.md) y el [frente calado con difusor y seis patrones](./frente-calado.md). El resto de este documento conserva las observaciones de la investigación inicial.

## Método y alcance

- Se mantuvo el proyecto abierto originalmente en una pestaña separada de las pruebas. Las modificaciones se hicieron sobre una pestaña de investigación y muestras propias.
- Se recorrieron los 27 modelos y sus paneles de fabricación; se observaron sus cortes y variantes de catálogo. Se probaron generación, despiece, cambio de un componente, anidado, optimización y exportaciones representativas.
- Se analizaron archivos descargados desde los botones de la aplicación: organización del ZIP, STL, DXF y formato de parámetros. No se utilizó código fuente ni recursos gráficos de Proled para la implementación local.
- La evidencia geométrica detallada se limita a las muestras indicadas más abajo. No se imprimieron piezas, ni se comprobó la totalidad de combinaciones de parámetros, tolerancias y fuentes.
- Los valores registrados son **valores observados durante la sesión**, no valores de fábrica garantizados: algunos ajustes se conservan al cambiar de modelo.
- Las funciones de compartir y perfil comercial se inspeccionaron sin crear enlaces públicos ni guardar cambios en la cuenta. Los plugins no se instalaron.

## Qué resuelve y cómo se utiliza

Transforma texto o vectores en componentes de cartelería LED listos para exportar a impresión 3D y corte plano. El flujo visible es: **ingresar forma → elegir estructura → configurar modelo → herramientas → revisar y exportar**. El modo Neon Flex tiene su propio flujo de entrada y parámetros.

La entrada para letras admite archivo **SVG o DXF**, o texto con fuente, altura y espaciado. Ofrece unidades **mm / in**, actualización explícita del texto y medidas finales de ancho/alto. Se vieron 14 fuentes: Montserrat Black, Poppins Black, Roboto Black, Oswald Bold, Bebas Neue, Anton, Barlow Condensed Black, Archivo Black, Rajdhani Bold, Orbitron Black, Exo 2 ExtraBold, Teko Bold, Russo One y Noto Sans Black.

El catálogo permite buscar y presenta **corte transversal, vista principal y vista de base/PVC**, con identificación de los componentes. Comunica la fabricación y el montaje, además del aspecto exterior. El panel **Parámetros de usuario** permite importar una configuración de otro proyecto; el ZIP de exportación contiene un archivo `.proled3dparams`.

## Catálogo completo

### Las cuatro familias

| Familia | Modelos | Frente y colocación del acrílico |
|---|---:|---|
| L | 7 | Acrílico encastrado desde adentro; tapa con pared y labio de apoyo. |
| F | 8 | Acrílico encastrado a media pared; incluye opciones con el apoyo integrado en la base. |
| C | 6 | Frente sólido impreso, sin acrílico. |
| P | 6 | Frente impreso calado, con acrílico interno como difusor. |

### Las 27 estructuras y su diferencia

| Modelo | Variante observada | PVC | Diferencia que interesa contrastar con Grafo3D |
|---|---|---|---|
| L1 | Base con borde exterior | No | Cierre inferior impreso y reborde exterior independientes de la tapa. |
| L1B | Base exterior L1 + apoyo interno de PVC L4 | Sí | Combina borde exterior, anillo interno y placa de fondo. |
| L2 | Base sin borde exterior | No | Mantiene suelo y pared interior; elimina el reborde corto exterior. |
| L3 | Base al ras de la letra | No | Base desmontable alineada al contorno exterior; variante ensayada por STL. |
| L4 | Base tipo anillo | Sí | Marco de apoyo impreso y PVC de fondo separados. |
| L5 | PVC encastrable con traba | Sí | Traba trapezoidal en tapa; perfil vertical recto, biselado, curvo o angular. |
| L6 | Base al ras, doble canal | No | Segunda pared interior y canal inferior configurables. |
| F1 | Base con borde exterior | No | Variante L1 con asiento del acrílico a media pared. |
| F2 | Base sin borde exterior | No | Variante L2 con asiento del acrílico a media pared. |
| F3 | Base al ras de la letra | No | Variante L3 con asiento del acrílico a media pared. |
| F4 | Base tipo anillo | Sí | Variante L4 con asiento del acrílico a media pared. |
| F5 | PVC encastrable con traba | Sí | Traba trapezoidal y perfil de tapa; acrílico a media pared. |
| F6 | Base al ras, doble canal | No | Doble canal con acrílico a media pared. |
| F6B | Base sin tapa / apoyo de acrílico integrado | No | No tiene componente Tapa; el panel Base incluye el apoyo y las paredes. |
| F7 | Envolvente | No | Suelo y envolvente integrados; no tiene panel Tapa. |
| C1 | Base con borde exterior | No | Frente sólido y cierre inferior con reborde. |
| C2 | Base sin borde exterior | No | Frente sólido y cierre inferior sin reborde. |
| C3 | Base al ras de la letra | No | Pariente funcional de nuestro frente impreso encastrable; no se presume igualdad de sección. |
| C4 | Base tipo anillo | Sí | Frente sólido con marco y placa de fondo. |
| C5 | PVC encastrable con traba | Sí | Frente sólido, cierre trapezoidal y perfiles verticales; perfil angular observado en 3D. |
| C6 | Base al ras, doble canal | No | Frente sólido con doble pared/canal inferior. |
| P1 | Base con borde exterior | No | Frente calado + difusor interno + cierre con reborde. |
| P2 | Base sin borde exterior | No | Frente calado + difusor interno + cierre sin reborde. |
| P3 | Base al ras de la letra | No | Frente calado + difusor interno + base al ras. |
| P4 | Base tipo anillo | Sí | Frente calado, marco y fondo PVC/STL. |
| P5 | PVC encastrable con traba | Sí | Calado, difusor, traba trapezoidal y perfiles de tapa. |
| P6 | Base al ras, doble canal | No | Calado + acrílico + base de doble pared; generación y despiece ensayados. |

Los tipos 2 y 3 tienen controles similares, pero el catálogo diferencia la posición de la base respecto de la letra. No deberían deduplicarse sólo por coincidir sus campos. F6B y F7 también comparten numerosos controles; hace falta comparar secciones antes de tratarlos como equivalentes.

## Parámetros por componente

### Acrílico y tapa

Todos los espesores y alturas se expresan aquí en milímetros.

| Componente / familia | Parámetros observados | Valores de muestra |
|---|---|---|
| Acrílico L/F | Espesor; tolerancia del acrílico | 3; 0,2. Se observó también espesor 2 conservado de otra configuración. |
| Acrílico P | Espesor del acrílico interno | 2. No apareció tolerancia propia en ese panel. |
| Tapa L | Espesor de pared; altura de pared; profundidad del labio; espesor del labio | 1,5; 40; 4; 2 |
| Tapa F1–F6 | Espesor de pared; altura; profundidad del labio; espesor del labio | 2,5; 40; 1,25; 3 |
| Tapa C | Espesor de pared; altura; espesor del frente | 1,5; 40; 1,5 |
| Tapa P | Espesor de pared externa; altura; espesor de cara calada | 2; 40; 1 |
| Tolerancia general | Holgura entre componentes | 0,5; mínimo 0 y paso 0,1 |

La **tapa de Proled incluye paredes laterales**: no siempre significa una lámina plana frontal. Al incorporarlo conviene nombrar los componentes por su función en el montaje —cuerpo, frente, base o cierre trasero— y no traducir los nombres mecánicamente.

### Base y fondo

| Variante | Controles visibles |
|---|---|
| Comunes a bases impresas 1/2/3/4/6 | Espesor del suelo; espesor de pared interior; altura de pared interior. Muestras: 1,5 / 1,5 / 30; en P se observó pared interior 2. |
| 1 | Además: espesor de pared exterior 1,5; altura exterior 3. |
| 2 y 3 | Controles comunes. Diferencia de colocación/forma representada en el catálogo. |
| 4 | Además: anillo interno extra 2; espesor PVC 5; holgura PVC 0,2. |
| L1B | Controles comunes, pared exterior y conjunto anillo/PVC. |
| 5 | Espesor PVC 5 y holgura PVC 0,3; no expone el conjunto habitual de suelo/pared. P5 agrega pared interior 2. |
| 6 | Distancia entre paredes internas 5,8; altura de segunda pared 30; espesor de segunda pared 1,5; altura de canal 2. |
| F6B | Suelo 1,5; pared envolvente 2,5 y altura 40; labio de profundidad 1 y espesor 2; distancia entre paredes 5,8; segunda pared de altura 30 y espesor 1,5; canal 2. |
| F7 | Controles semejantes a F6B; se observaron pared 2 y segunda altura 0. |

En F6B/F7 algunos campos conservan la etiqueta “pared de la tapa”, aunque estén dentro de Base y no exista una tapa independiente. Es una inconsistencia de nomenclatura que no conviene trasladar.

En P4/P5 el campo de espesor del fondo dice **PVC/STL**. La presencia de STL de una placa en un ZIP no basta para inferir que debe imprimirse: para costos debe mantenerse explícito el material y el proceso.

### Cierre trapezoidal y perfiles de los tipos 5

L5, F5, C5 y P5 añaden en Tapa:

- Ancho de traba trapezoidal: muestra 2, mínimo 0,2, paso 0,1.
- Compensación de traba: muestra 0; máximo 29 en la configuración revisada. Puede depender de la geometría.
- Perfil **Recto / Biselado / Curvo / Angular**.
- En los tres perfiles no rectos: dirección hacia afuera/adentro, ángulo, tramo recto superior y tramo recto inferior. Muestras: 5° / 3 / 3. El ángulo expone rango 0–75°, paso 0,1.
- En Biselado: perspectiva **sin perspectiva / reducir arriba / reducir abajo**.
- Holgura de PVC observada: rango 0–1, paso 0,05.

El control declara que modifica sólo el perfil vertical de la pared de la tapa. No es equivalente a nuestra extrusión angular `curved`, que barre la letra completa; se acerca más al motor de perfiles que ya utiliza `organic`, pero requiere una receta nueva de cierre y asiento.

### Frente calado P

El patrón se aplica a la **cara frontal**, delante del difusor acrílico. El ensayo P6 mostró huecos geométricos reales y un borde conservado alrededor del contorno exterior e interior.

| Parámetro | Opciones o muestra | Límite HTML observado |
|---|---|---|
| Forma | Círculo, diamante, cuadrado, hexágono, oblongo, triángulo | Seis opciones |
| Borde seguro sin calar | 4 mm | Mínimo 2; paso 0,1 |
| Margen seguro de calado | 0 mm | Mínimo 0 |
| Diámetro | 3 mm | Mínimo 0,4 |
| Espaciamiento | 1,5 mm | Mínimo 0,1 |
| Rotación | 0° | Paso 1 |
| Ángulo de la forma | 45° | Paso 1 |

Se verificó visualmente el patrón **hexagonal**. Los otros cinco se relevaron como opciones, sin ensayo geométrico individual. La semántica exacta de espaciamiento, margen y orientación debe medirse con muestras controladas antes de implementarla.

## Herramientas y funciones adicionales

| Herramienta | Función observada | Alcance de la prueba |
|---|---|---|
| Editor de nodos | Editar, añadir y quitar nodos en 2D, con vista 3D complementaria. | Interfaz recorrida; no se ensayaron todas las operaciones topológicas. |
| Perforaciones | Orificios de diámetro configurable colocados sobre la vista; selección, eliminación y limpieza. | Panel inspeccionado. |
| Cortes de base | Cargar un SVG igual al original con figuras internas adicionales que se usan como cortes de la base; quitar archivo y contar cortes. | Flujo inspeccionado, sin cargar una segunda máscara. |
| Guillotina | Divide Base y Tapa según cama, margen y cortes definidos por dos puntos sobre contornos. Deshacer/rehacer, inspección 2D/3D por componente y estado de encaje por parte. | Controles recorridos sobre muestra de 160 mm; no se exportó una división. |
| Uniones de guillotina | Base con corte recto o cola de milano; profundidad, ancho, ambas tolerancias, ángulo de solapa y cantidad automática/manual. La tapa usa cortes rectos. | Valores vistos: 6,18 / 24,73 mm; tolerancias 0,1; ángulo 60°. Son valores de muestra, posiblemente calculados. |
| Optimizador de curvas | Acción automática sobre el modelo. | En SVG rectangular informó que no había curvas; en R Bebas Neue informó optimización correcta. No se midió error de aproximación. |
| Anidar | Distribuye DXF de acrílico y PVC por separado; ancho/alto de placa, margen y separación. Giro interno anunciado de 15°. | P6: una pieza de acrílico en placa de 1000×2000, margen 10, separación 5; terminó con una placa y 8,4% de consumo vertical acumulado. |
| Visor | Cubo de orientación CAD, órbita, medidas, iluminación de escena, color/visibilidad por componente y despiece. | Se probó despiece de 60 mm; rango 0–150, paso 1. |
| Iluminación de escena | Intensidad, dirección horizontal y altura de luz; encendido LED. | Intensidad 0,2–2,5; horizontal 0–360°; altura −200 a 200. No confundir con cálculo eléctrico. |
| Compartir 3D | Simulación sobre foto de fachada: cargar foto, marcar plano, definir medida real, posicionar cartel y previsualizar. Enlace con fachada, esquema y precio final opcionales. | Se abrió el flujo; no se creó enlace ni se calibró fotografía. JPG/PNG/WebP, máximo 2 MB anunciado. |
| Perfil comercial | Logo, empresa, teléfono, correo, web y descripción; identidad de nuevos enlaces. | Inspección sin guardar. Logo PNG/JPG/WebP hasta 1 MB; descripción de 120 caracteres. |
| Exportaciones | ZIP por componentes, STL/DXF, parámetros, información técnica y checklist; exportar PNG. | ZIP de letras y de neón inspeccionados. |
| Otros | Temas, idiomas, panel plegable, consola de corrección, soporte, cuenta Premium, avisos y acceso a plugins de CorelDRAW/Illustrator. | No se probaron soporte, compras ni instalación de plugins. Documentación aparece como “Próximamente”. |

El ensayo de anidado con una sola pieza **no demuestra** la calidad del nesting irregular, el aprovechamiento de huecos, la ausencia de colisiones en casos complejos ni el algoritmo empleado. El 8,4% se presenta como consumo **vertical acumulado**, no como porcentaje de área material ocupada.

### Cálculo eléctrico

El panel Iluminación separa las cantidades técnicas de los precios:

- Área frontal iluminada, profundidad y número de piezas.
- Nombre del LED, voltaje, potencia por metro, separación entre tiras y reserva de compra.
- Metros instalados y a comprar; detalle por pieza.
- Cable por pieza, cable principal y cable total.
- Potencia instalada, corriente, margen y fuente mínima requerida.

Existe una acción **Usar profundidad** para la separación entre tiras. Se observaron valores de muestra de 12 V, reserva 8%, cable por pieza 0,5 m, cable principal 10 m y margen de fuente 20%. La potencia estaba en cero, por lo que no se validó una selección real de fuente.

### Cotización y calibración

Incluye filamento por kg, impresión por hora, placas de acrílico/PVC, LED, cables y fuente, conceptos adicionales, desperdicio, ganancia sobre costo e impuestos. Permite peso y tiempo estimados o manuales. Para placas ofrece consumo manual/automático y cálculo por placa, porcentaje de placa o m².

La estimación de impresión distingue **superficies planas y paredes**. Expone dos calibradores descargables, TC1 y TC2, para ingresar peso y tiempo del laminador; además permite ajustar con una pieza real laminada con el mismo perfil. No se descargaron ni copiaron los calibradores.

En P6 de 160×160 mm el cotizador terminó mostrando **256,15 g y 6 h 26 min 45 s**, con la configuración de referencia de la sesión. Son estimaciones de Proled, no mediciones físicas. Los ceros iniciales del panel se actualizaron al cargar: no deben interpretarse como ausencia de función.

**Diferencia comercial relevante:** Proled muestra ganancia agregada sobre costo; nuestra función `costs()` calcula precio a partir de margen sobre venta. El mismo porcentaje no produce el mismo precio. Para incorporar perfiles/calibración y conectar Grafo debemos conservar la distinción explícita.

## Neon Flex Beta

Es un modo específico basado en **líneas centrales DXF**, con conteo de recorridos abiertos/cerrados y longitud total. No es sólo otra opción de frente de letra.

| Parámetro | Muestra |
|---|---:|
| Ancho interno del canal | 5,8 mm |
| Calidad de curva | Baja / Media / Alta; Alta seleccionada |
| Espesor de pared | 1,2 mm |
| Altura de pared | 8 mm |
| Espesor de base | 1,2 mm |
| Ancho de túnel | 5,8 mm |
| Altura de túnel | 3 mm |
| Separación del túnel a la base | 0 mm |
| Diámetro de orificio | 3 mm |

Con una polilínea DXF propia en L, formada por dos segmentos de 100 mm, detectó **1 recorrido abierto, 0 cerrados y 200 mm de longitud**. Generó un canal visible y un STL de **104,1×104,1×9,2 mm**, con 148 triángulos. El ZIP de neón contenía ese STL y un PDF de información del modelo.

Ofrece editor de nodos, túneles y orificios. En este modo se observaron **Guillotina y Optimizador de curvas deshabilitados**, y Cortes de base deshabilitado dentro de Perforaciones. Los botones de cotizador, anidado e iluminación permanecen disponibles; no se presume idéntica cobertura que en letras.

Grafo3D actualmente parte de áreas/contornos cerrados para su neón pleno o de contorno. Para esta función hay que agregar una representación de **trayectorias abiertas**, importación DXF y generación del canal con extremos y esquinas resueltos.

## Pruebas y evidencia geométrica

Las entradas propias y mediciones están en [evidencias-proled](./evidencias-proled/README.md). No se incorporaron STL ni imágenes de Proled al producto.

### Componentes independientes, L3

Entrada: SVG de 160×160 mm con hueco cuadrado central de 60×60 mm. Base de suelo 1,5; pared interior 2; tapa de pared 1,5 y altura 40; acrílico de espesor 2. Despiece llevado a cero antes de exportar.

Se descargaron dos ZIP, cambiando únicamente la altura de pared interior de **30 a 20 mm**:

| Archivo | Antes | Después | Resultado |
|---|---|---|---|
| Base STL | Z = 0…31,5 mm | Z = 0…21,5 mm | Cambia sólo la altura esperada. |
| Tapa STL | Z = 1,5…41,5 mm | Idéntico | SHA-256 igual, archivo completo idéntico. |
| Acrílico STL | Z = 37,5…39,5 mm | Idéntico | SHA-256 igual, archivo completo idéntico. |

Esto comprueba la independencia de esa edición, no de todos los parámetros: cambiar el contorno común o la holgura necesariamente puede afectar más de un componente.

### Otras verificaciones

- R en Bebas Neue, altura 100 y espaciado 0: ancho visible **48,429 mm**. Permite reutilizar la muestra tipográfica ya contrastada con Grafo3D/LetraMaker.
- P6 con SVG propio y patrón hexagonal: generación visible, borde protegido y despiece de base, tapa calada y difusor.
- Anidado del acrílico P6: resultado de una placa con estado finalizado; la UI anuncia inclusión de DXF y datos en el ZIP. No se conserva un ZIP P6 confirmado para medirlo.
- C5 Angular: cambio de perfil y dirección disponibles, tramo superior/inferior y pared perfilada visibles en 3D.
- Neon Flex: generación y dimensiones de STL comprobadas desde una trayectoria abierta de longitud conocida.

### Límites y comportamientos a no trasladar sin comprobar

- Al cambiar de texto R a P6 en esta sesión, el visor se vació y pidió cargar SVG, aunque el texto había sido generado. Se reprodujo al volver desde Neon Flex. Con SVG propio P6 funcionó. No se concluye que la familia P nunca admita texto; hay una transición de entrada a investigar si se busca paridad.
- En Neon Flex la consola conservó el mensaje de cargar DXF aun con modelo y longitud ya calculados. Conviene que nuestros estados dependan del resultado efectivo.
- Durante el despiece de P6 se observaron profundidades distintas en cotizador e iluminación (41,5 y 145,5 mm). No se aisló la causa: la geometría de montaje y la de presentación deben separarse al implementar métricas.
- El archivo `.proled3dparams` tiene un contenedor JSON con versión, modelo base y carga cifrada; no es un proyecto abierto directamente intercambiable. No se intentó descifrarlo.
- El ZIP de letras incluye STL conjuntos y por pieza, DXF individuales de acrílico/PVC, parámetros, `informacion_del_modelo.pdf` y `Checklist.pdf`. Se verificó la estructura; no se auditó el contenido completo de los PDF.

## Correspondencia con nuestras doce familias

La equivalencia de esta tabla es **funcional**, no certifica igualdad de mallas o tolerancias.

| Grafo3D actual | Relación con Proled | Diferencia / decisión pendiente |
|---|---|---|
| Frente acrílico, fondo impreso (`solid-back`) | Comparte finalidad con L/F y los casos integrados. | Distinguir cuerpo único de base/tapa desmontables; no reemplazarlo automáticamente por L1. |
| Fondo abierto (`open-back`) | Comparte pared y asiento de acrílico. | No se identificó un equivalente exacto entre las bases cerradas listadas. |
| Doble apoyo (`double-support`) | Próximo a L4/F4 y sus fondos PVC. | Comparar anillo, apoyos y pieza portante; secciones no verificadas como iguales. |
| Apoyo único (`single-support`) | Próximo a envolventes con un asiento. | No afirmar equivalencia de armado con F6B/F7. |
| Encastre trasero (`back-fit`) | Próximo a cierres PVC 4/5. | Falta la traba trapezoidal parametrizada del tipo 5. |
| Retroiluminada (`halo`) | Tiene su propia bandeja y retención. | Proled separa base y tapa; no se vio una familia dedicada que sustituya todo nuestro halo. |
| Acrílico encastrable (`acrylic-fit`) | Pariente cercano de L/F de dos cuerpos. | Ya tiene tapa interior; ampliar posiciones de acrílico, bases y controles directos. |
| Frente impreso (`printed-fit`) | Pariente cercano de C1–C3. | Ya tiene dos piezas; ampliar bases, alturas independientes y modalidades de cierre. |
| Doble iluminación (`double-led`) | Comparte paredes/canales con tipos 6. | Una base de doble canal no equivale automáticamente a doble iluminación. |
| Letra curva (`curved`) | No equivale al perfil Curvo del tipo 5. | Mantener barrido angular propio; añadir perfil local de pared por separado. |
| Canal neón (`neon`) | Comparte destino productivo con Neon Flex. | Faltan trayectorias abiertas DXF y túneles de cableado. |
| Orgánica (`organic`) | Motor de perfiles útil para tipos 5. | Mantener siete perfiles actuales; añadir recetas específicas y validar asientos/holguras. |

**Familia realmente nueva:** frente calado P. **Variantes de fabricación nuevas:** bases/cierres 1/4/5/6 y combinaciones específicas según comparación de secciones. **Modo de entrada y geometría nuevo:** neón desde trayectorias. No conviene simplemente añadir otras 27 tarjetas planas al selector actual.

## Propuesta técnica para una implementación posterior

Esto es un diseño propio sugerido a partir del comportamiento observado. La inspección de interfaz y exportaciones no permite certificar el framework, biblioteca geométrica, algoritmo de nesting ni arquitectura del servidor de Proled.

Nuestro motor ya usa contornos, Manifold/WASM, componentes con material y métricas, y Three.js para presentar. Podemos extenderlo con un **ensamblaje explícito**:

```text
Fuente común: texto / contorno / trayectoria
  └─ Receta de fabricación
      ├─ Cuerpo o tapa: pared, frente, labio y perfil
      ├─ Base: suelo, paredes, anillo y canales
      ├─ Acrílico: posición, espesor y holgura de corte
      ├─ Fondo PVC: espesor, asiento y holgura
      └─ Uniones: tipo, profundidad y tolerancia
           ↓
      Componentes físicos + montaje + métricas
           ├─ Visor y despiece
           ├─ STL por componente / DXF por material
           └─ Consumos para cotización local y Grafo
```

La identidad de cada componente debe sobrevivir a cambios de parámetros. El despiece y los movimientos de inspección pertenecen a la vista y no deben cambiar dimensiones de fabricación, cantidades ni costos. Las holguras de ensamble, acrílico y PVC deben tener nombres y valores separados, con una definición inequívoca de si se aplican por lado.

La UI debería mostrar sólo los elementos reales de cada receta, con sección de montaje propia y color consistente con el visor. Seleccionar Base debe identificarla visualmente y concentrar sus campos; lo mismo para Acrílico, Cuerpo/Tapa y Fondo. Los controles existentes pueden migrarse con compatibilidad para los proyectos guardados, sin renombrar a ciegas el plano objeto `Parameters`.

Para Grafo, `quoteEnvelope()` ya exporta componente, material, cotas, volumen, área y perímetro. Habría que añadir, con versionado, la receta de cierre, métricas de recorridos/LED, calibración usada y consumos de placa. El motor de costos debe elegir las tarifas y procesos: no sumar nuevamente como materia prima un acrílico representado tanto en STL de vista como en DXF de corte.

## Orden sugerido y validación antes de incorporar

| Etapa | Entrega propuesta | Verificación que debe pasar |
|---|---|---|
| 1 | Editor por componentes y receta base/tapa encastrables, aprovechando `printed-fit`/`acrylic-fit`. | Cambiar altura de base sin alterar tapa/acrílico; despiece sin alterar exportación ni costos; restauración de proyectos actuales. |
| 2 | Bases al ras/con borde/anillo y cierre trapezoidal PVC, con perfiles verticales del tipo 5. | Secciones medidas, sólidos cerrados, asientos y holguras; ensayo físico corto del encastre. |
| 3 | Frente calado y acrílico interno; seis patrones con borde seguro. | Huecos de contorno conservados, resistencia mínima, espesor de cara, STL y DXF coherentes. |
| 4 | Cortes libres y uniones de cola de milano según cama. | Cada parte entra, cortes no dejan sólidos abiertos, uniones enfrentadas coinciden y conservan tolerancia. |
| 5 | DXF y Neon Flex por trayectorias abiertas, túneles y cálculo de longitudes. | Longitud 200 mm de muestra, extremos/esquinas, recorridos curvos/cruces y canal útil verificados. |
| 6 | LED/fuente, calibración por perfil de impresión, anidado por material y fachada. | Consumos independientes de vista, estimaciones contrastadas con laminador, precios con semántica clara y sin doble imputación. |

Para cada nueva receta conviene comparar primero **R de 100 mm** y el **SVG de 160 mm con hueco**, y después una palabra con varias letras y un logo de trazos estrechos. La comparación debe incluir corte transversal, montaje, despiece, cotas STL y contorno DXF; una imagen parecida por sí sola no valida la fabricación.

## Fuentes locales de la comparación

- [`src/core/types.ts`](../src/core/types.ts): familias, parámetros, componentes y cortes actuales.
- [`src/components/ModelParameters.tsx`](../src/components/ModelParameters.tsx): controles actuales por construcción.
- [`src/core/letter-models.ts`](../src/core/letter-models.ts): geometría y componentes existentes.
- [`src/core/source.ts`](../src/core/source.ts): texto y SVG; alcance actual de entrada.
- [`src/core/output.ts`](../src/core/output.ts): distribución, métricas, precios, exportaciones y contrato para Grafo.
- [`modelos-letramaker-premium.md`](./modelos-letramaker-premium.md): contraste anterior de nuestras doce familias.
- [`integracion-grafo.md`](./integracion-grafo.md): integración prevista con el motor de costos.
