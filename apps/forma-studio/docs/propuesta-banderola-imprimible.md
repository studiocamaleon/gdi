# Propuesta: banderolas luminosas con estructura impresa

Fecha: 5 de septiembre de 2026. Este documento conserva la propuesta original. La primera implementación está guardada y pendiente de completar su revisión visual y de fabricación; ver [estado de la banderola](./banderola-estado.md). No está validada para instalación.

## Objetivo y restricciones

Nueva familia para carteles tipo pastilla o banderola, tomando como referencia la fotografía del usuario: caja circular perpendicular a la pared y dos caras luminosas. Diámetro variable y acrílicos desmontables, con acceso al sistema de iluminación. El usuario indicó explícitamente que todo debe ser imprimible salvo el acrílico.

La propuesta contempla cuerpo, aros, uniones, brazos, placa de pared, cuna y soportes internos impresos, sin armazón metálico. Los LED, la fuente, cables y los anclajes adecuados al muro siguen siendo componentes comerciales; no se generan como archivos de impresión. El mecanismo de cierre de las piezas se plantea con guías, topes y cuñas impresas reemplazables. No se presupone autorización para sustituir la estructura por perfiles metálicos.

## Receta inicial propuesta

Circular, doble cara, dos acrílicos opales enteros y dos aros desmontables independientes. Probeta inicial nominal de 400 mm de diámetro exterior. La profundidad se definirá con el módulo LED real; 160 mm sirve sólo como punto de exploración, no como profundidad ópticamente validada. Espesores estructurales y holguras se fijarán después de probetas y ensayos, sin presentar valores arbitrarios como aptos para exterior.

| Elemento | Solución propuesta | Parámetros |
|---|---|---|
| Cuerpo | Anillo por sectores con apoyos de acrílico continuos. Uniones guiadas con solape y cuñas, no sólo pegado a tope. | Diámetro exterior, profundidad, pared, nervaduras, segmentos y holgura de unión. |
| Acrílicos A/B | Placas enteras apoyadas por todo el perímetro; cada una se retira hacia su propia cara. | Espesor por cara, holgura radial, holgura axial, apoyo mínimo y retranqueo. |
| Aros A/B | Aros retenedores en sectores; guías y cuñas cautivas reemplazables, con seguro contra salida accidental. | Ancho visible, espesor, solape del acrílico, número de sectores y posición de cierres. |
| Juntas | Laberinto en carcasa y alojamientos para juntas imprimibles flexibles, por ejemplo TPU a ensayar. | Perfil, compresión, drenaje y posición. No implica una clasificación IP. |
| Iluminación | Casete central impreso desmontable con soportes de módulos dirigidos a ambas caras. Interior de acabado claro. | Dimensiones reales del módulo, fijaciones, distancia a cada cara, patrón de distribución y pasos de cable. |
| Montaje | Placa de pared, dos brazos nervados separados verticalmente y cuna amplia que conecta con varios puntos del cuerpo. | Separación de pared, separación entre brazos, sección, nervaduras, placa y patrón de anclajes. |
| Servicio | Retirada de aros y placas por fuera; acceso frontal al casete, conectores y cierres. | Orden de montaje, acceso a cuñas, espacio de herramientas y recorrido de extracción. |

La cuna debe distribuir cargas más allá de una junta entre segmentos. Las uniones del cuerpo y los aros deberían escalonarse para evitar una línea débil continua. Los cierres no deben depender únicamente de la elasticidad sostenida de una pestaña impresa. Deben existir topes mecánicos positivos y piezas de cierre sustituibles.

## Por qué aros y no únicamente pequeñas presillas

Los aros permiten contener toda la periferia del acrílico y repartir el apoyo. Las cuñas o presillas desmontables fijan el aro; no se concentra toda la retención de la placa en pocos puntos pequeños. Se propone retirar el aro, sacar el acrílico hacia afuera y acceder al interior sin descolgar el cuerpo de la pared.

La holgura por dilatación térmica es distinta de la holgura del ensamble impreso. El acrílico debe poder expandirse y conservar el solape suficiente con el aro durante la contracción. No deben usarse automáticamente las tolerancias pequeñas de las letras actuales para una placa de 400–700 mm. [ACRYLITE: fabricación de carteles, expansión y retención perimetral](https://www.acrylite.co/resources/fabrication-manuals/create-signs-with-acrylite-premium-acrylic-sheet).

## Iluminación y cableado

La bandeja/casete central sirve como soporte mecánico impreso, no se considera disipador térmico. Debe seleccionarse un módulo que pueda instalarse sobre ese soporte y verificar su temperatura y fijación según fabricante. Se propone una fuente remota accesible para reducir calor y facilitar servicio, conduciendo baja tensión por un canal del brazo con alivio de tracción. Su ubicación final depende de la instalación.

La distribución de LED debe generarse evitando nervaduras, cierres y las zonas de sombra del soporte. El cálculo inicial puede contar módulos y sumar su potencia nominal; la uniformidad no se deduce sólo del área ni de un cono dibujado en pantalla. Se necesita una muestra con el acrílico, gráfica, profundidad y LED elegidos. [SloanLED: guía de montaje y prevención de sombras en cajas de doble cara](https://sloanled.com/downloads/InstallGuide-SignBOXII.pdf).

Como referencia de dependencia óptica, SignBOX 3 Slim publica una profundidad total mínima de 150 mm para su sistema específico. Ese dato no se traslada como requisito genérico ni valida los 160 mm exploratorios de nuestra propuesta. [SloanLED: SignBOX 3 Slim](https://sloanled.com/news/sloanled-adds-shallow-light-box-support-for-the-emea-region/).

Deben preverse entradas de cable protegidas, drenajes en el punto inferior, ventilación protegida y acceso a conexiones. El sellado de piezas impresas, sobre todo segmentadas, requiere ensayo propio; dibujar una junta no certifica estanquidad.

## Material y comportamiento estructural

ASA es un candidato para carcasa y accesorios de exterior por resistencia UV y temperatura; su elección no valida el brazo. [Prusa: ASA](https://help.prusa3d.com/article/asa_1809). La ficha de PolyLite ASA distingue propiedades XY y Z, por lo que la orientación de impresión forma parte del diseño mecánico. Los resultados de probetas de fabricante tampoco representan automáticamente una pieza impresa con otro proceso. [Polymaker: ficha técnica PolyLite ASA](https://polymaker.com/wp-content/uploads/lana-downloads/PolyLite_ASA_TDS_EN_V5.4.pdf).

El diseño debe verificar peso permanente, palanca, viento, fatiga, fluencia con temperatura, unión entre capas y anclajes. Aumentar diámetro incrementa área expuesta y palanca; un brazo validado para una medida no habilita todas las demás. No se propone una carga admisible ni un espesor de brazo para instalación exterior sin ese cálculo y ensayo. Los primeros prototipos se ensayan en banco y en condiciones controladas, sin personas debajo.

## Incorporación a Grafo3D

Proponer un modo propio `lightbox`, con variantes futuras circular, ovalada, rectangular redondeada y contorno SVG simple. Empezar por circular doble cara; después adaptar montaje paralelo a pared, una cara y suspensión desde techo. Son variantes de instalación con esfuerzos diferentes, no simples giros visuales.

El código actual tiene modos `letters` y `joint`, capas orientadas a letras y materiales filamento/acrílico/PVC. Agregar este producto requiere un modelo de ensamblaje con identificadores estables para A/B, segmentos, aros, soporte, juntas y herrajes. Conviene mantener compatibilidad explícita de proyectos, en lugar de introducir campos de banderolas en el objeto genérico de letras.

Paneles propuestos: **Forma · Cuerpo · Caras · Cierres · Iluminación · Soporte · Producción**. Medidas con debounce y cámara estable. Selección por componente, ocultar/aislar, sección y despiece que respeten el orden de extracción. Arte por cara, legible desde su exterior, con escala/posición propias y sin espejar automáticamente la cara B.

Archivos y costos:

- STL de cada pieza impresa, identificada y orientada para su fabricación. Verificar ancho, alto y altura de impresión, incluidos los cierres y nervaduras.
- DXF/SVG de cada acrílico, conservando su material y espesor. Exportar también plantilla de pared y dimensiones de gráfica visible.
- Despiece, secuencia de montaje y lista de piezas: filamentos rígido/flexible, acrílicos, LED, fuente, cables y anclajes. La fuente y LED son cantidades de catálogo, no volumen de plástico.
- Contrato versionado para Grafo con materiales y procesos separados: impresión, corte, gráfica, montaje y componentes comprados. No sumar dos veces una placa mostrada en 3D y exportada en DXF.
- El estimado de horas actual depende del volumen y caudal; no equivale al tiempo del laminador ni determina la resistencia final.

## Primera implementación y validación propuestas

1. Modelo circular paramétrico, aros y acrílicos independientes; sección y extracción axial sin interferencias.
2. Sectores imprimibles con uniones y cuñas. Probeta corta del asiento, cierre y junta antes de fabricar un aro completo.
3. Placa de pared, dos brazos, cuna y casete LED. Revisión mecánica de orientación y recorridos reales de montaje.
4. Exportación completa, persistencia y costos. Pruebas de sólidos, holguras, continuidad de apoyos y dimensiones de cama.
5. Prototipo de 400 mm: apertura repetida, carga sostenida, temperatura, iluminación y, antes de exterior, exposición y esfuerzos aplicables. Los diámetros mayores se habilitan como prototipos hasta validar sus configuraciones.

El esquema interactivo original es conceptual: exagera espesores y representa los LED simbólicamente; no sirve como plano de mecanizado, simulación lumínica ni cálculo estructural. El alcance de la opción y los archivos ahora implementados se detalla en el punto de guardado enlazado al inicio.
