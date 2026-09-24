# Banderola circular · estado del prototipo

Actualizado el 6 de septiembre de 2026.

## Fabricación opcional por sectores

Por defecto, el cuerpo y cada aro son piezas enteras independientes (`segments = 1`). El selector **Fabricación del cuerpo y los aros** permite dividir cada uno en 4, 6, 8 o 12 sectores para camas pequeñas. Los proyectos conservan su elección. Producción comprueba las dimensiones reales, sin escalar ni dividir automáticamente; el ZIP mantiene un STL por pieza.

Las uniones divididas usan llaves axiales de doble cola de milano, con juntas de aro desplazadas respecto del cuerpo. Las piezas enteras omiten estas juntas, ranuras y llaves. Pasos de cable, drenajes, asientos de acrílico y juntas flexibles opcionales se conservan. El brazo central se fija desde el interior y no usa cunas integradas.

## Un brazo central y tornillos ocultos

En **Brazo y placa de pared → Diseño del soporte** las tres variantes generan un único brazo central, separado del cuerpo:

- **Recto**: cuello recto y discreto.
- **Curvo**: cintura cóncava simétrica y extremos ensanchados, tomando como referencia la imagen del cartel aportada por el usuario. Reemplaza el antiguo arco calado.
- **Clásico**: conserva la nervadura triangular, ahora sin cunas integradas ni pasadores.

Los tres comparten el mismo cuerpo, apoyo curvo, posiciones de fijación y plantilla. El brazo y su placa de pared se imprimen unidos en un STL; el círculo se imprime aparte. La placa se ensancha a lo alto y tiene cuatro anclajes de pared en una matriz de dos filas y dos columnas. Un canal central comunica la pared con el interior del cartel para el cable. El lateral decorado sólo se omite en la zona del apoyo y su margen de 2 mm.

### Unión desde adentro hacia afuera

Cuatro tornillos M4 con arandelas entran desde el interior del cuerpo y roscan en insertos M4 por calor alojados en el brazo. Las cabezas quedan dentro del cartel; no hay tuercas, ventanas ni pasos de fijación en la cara exterior del apoyo. El cuerpo conserva pasos de Ø4,5 mm y asientos interiores planos de Ø10 mm rebajados 0,6 mm.

Los insertos se instalan en la cara del brazo que toca el cuerpo, **antes** de ensamblar. Sus alojamientos son ciegos: diámetro y profundidad configurables, con al menos 2,2 mm nominales hasta la cara exterior del apoyo (se reserva además el pequeño efecto del facetado). El valor inicial es Ø5,6 × 9,1 mm y el apoyo tiene 12 mm de espesor; son valores iniciales del prototipo a ajustar a la ficha del inserto comprado y al filamento real. Como referencia tecnológica, [Ruthex describe insertos M4 × 8,1 mm instalables por calor en agujeros ciegos](https://www.ruthex.de/products/ruthex-gewindeeinsatz-m4-50-stuck-rx-m4x8-1-messing-gewindebuchsen). No se valida por software la retención del inserto en plástico.

La distancia desde el asiento interior a la entrada del inserto es `wall + jointClearance - 0.6`; hasta el fondo es esa distancia más `mountInsertDepth`. Estas medidas **no incluyen la arandela**. Elegir el largo real para lograr el acople de rosca requerido por el fabricante sin tocar ni atravesar el fondo ciego; no se prescribe un largo comercial universal.

Montaje: instalar insertos, presentar brazo y cuerpo, colocar y ajustar los cuatro tornillos desde adentro y cerrar las caras. Para separar el brazo se retiran primero aros y acrílicos; su animación de extracción ocurre entre 80 y 100 %, después de liberar las caras. El cambio de parámetros conserva la cámara.

El ZIP, PDF y contrato Grafo incluyen un soporte impreso, cuatro tornillos M4, cuatro arandelas y cuatro insertos por calor. Los cuatro anclajes al muro se cuentan aparte. Los herrajes no se imprimen ni están incluidos en el costo local. Al desactivar el soporte, sus piezas, compras e instrucciones se omiten.

### Sectores y proyectos anteriores

Con el soporte activo, las juntas de cuerpo se giran medio sector para dejar libre el centro del brazo y el canal de cable. Las juntas de los aros siguen desplazadas respecto de las del cuerpo. Se comprueba que las fijaciones y el canal no invadan las llaves ni sus nervaduras; una combinación incompatible pide ajustar diámetro, altura del cuello o cantidad de sectores. En diámetros pequeños puede ser necesario reducir la división.

Los proyectos anteriores migran al soporte central conservando el estilo, diámetro, profundidad y demás medidas del cartel. El apoyo pasante antiguo se aumenta a 12 mm si hace falta alojar los insertos, y el ancho del brazo a un mínimo de 28 mm. `armSpacing` sólo se acepta por compatibilidad y ya no modifica la geometría. Las cunas, pasadores y soportes dobles anteriores no se generan.

## Dos cierres para los aros envolventes

Cada aro tiene perfil en L: ala frontal que retiene el acrílico y faldón cilíndrico que abraza el cuerpo. Se imprime apoyado sobre su frente. Las medidas y el cierre se comparten entre ambas caras; el espesor y gráfica de cada acrílico siguen siendo independientes.

**Click**, opción inicial de proyectos nuevos: cuatro pestañas en cada aro entero, o dos por sector. Cada pestaña tiene ranuras laterales con extremos redondeados, una zona más delgada, diente con rampa de entrada y uñero exterior. El diente queda en una ranura del cuerpo con holgura axial y radial. No hay agujeros para tornillos ni piezas de cierre adicionales. Parámetros exploratorios: solape 18 mm, espesor flexible 1,2 mm, ancho 10 mm y retención 0,6 mm. Se pueden ajustar desde el editor del aro.

Para abrir, levantar los uñeros hacia afuera y mantener liberadas las pestañas mientras se retira el aro por su cara. En la vista de montaje se muestra una flexión esquemática entre 20 y 40 %, seguida por la traslación del aro entre 40 y 60 %. El modelo exportado no se deforma. Esta animación no predice fuerza, deformación admisible, fatiga ni facilidad de apertura real.

**Tornillos laterales**, alternativa conservada: ocho por aro entero y dos por sector. Paso de aro y piloto ciego en el cuerpo, sin rosca modelada. Parámetros iniciales: paso 3,4 mm, piloto 2,4 × 4 mm. Seleccionar largo bajo cabeza menor que faldón + holgura + profundidad de piloto. Cantidades en ZIP y contrato Grafo; no se exportan tornillos impresos ni se incluyen en el costo local.

Los proyectos guardados antes del cierre click mantienen tornillos hasta elegir la nueva opción. El modo click debe ensayarse con el material y la impresora reales antes de fabricar el cartel completo.

## Lateral orgánico entre aros

En **Cuerpo → Lateral exterior → Perfil del lateral** se puede elegir Liso, Zigzag, Ondas, Barriga, Pedestal (curva S), Bumper, Burbuja o Frisos. Liso sigue siendo el valor inicial y el de proyectos anteriores. Las curvas se comparten con las letras en `organic-relief.ts`; cada producto resuelve sus propios alojamientos y extremos.

El relieve de la banderola se agrega hacia afuera sobre el cilindro nominal. No rebaja ni ondula la pared interior. La franja comienza en `rimOverlap + sideMargin` y termina en `depth - rimOverlap - sideMargin`; ambos extremos vuelven al radio nominal. El margen mínimo es 2 mm, y se requieren al menos 8 mm de franja disponible al activar un perfil. El campo de diámetro conserva la medida nominal de encastre; las dimensiones generales y Producción incluyen el relieve real.

Parámetros: relieve solicitado (0,5–15 mm), paso en zigzag/ondas, forma en ondas/pedestal/burbuja, cantidad y separación de frisos, tramo recto de bumper, margen a los aros e inversión hacia la otra cara para perfiles asimétricos. El editor muestra un esquema y el relieve resultante: las pendientes y los extremos se adaptan al espacio disponible, por lo que una combinación estrecha puede alcanzar menos relieve que el solicitado.

Los tres soportes centrales reservan una zona lisa sólo alrededor de su apoyo curvo. Los drenajes se prolongan hasta atravesar la envolvente decorada. Los perfiles se integran al mismo cuerpo, entero o dividido, y se incluyen en STL, masa, costos y comprobación de cama. La decoración no modifica los acrílicos ni la geometría de los aros.

Las pruebas comprueban todos los perfiles enteros con cierre click y divididos con tornillos, retención de encastres, volumen protegido bajo los aros, continuidad, interior, drenajes, inversión, persistencia y reimportación STL del cuerpo decorado.

## Interior e iluminación

Se retiraron las barras LED, sus apoyos integrados y sus pasadores. Los proyectos anteriores también abren sin ese sistema. Los campos antiguos se aceptan para compatibilidad; no vuelven a generar geometría. El interior conserva únicamente asientos y uniones necesarios para el cartel.

La iluminación queda **pendiente de definir**. No se presenta un conteo LED o potencia como dimensionado. El contrato v3 incluye `lighting: unconfigured`; la fuente del manifiesto comercial queda en `null`. Ningún cambio activa comunicaciones con Grafo.

## Verificación de software

61 pruebas específicas de banderola: sólidos cerrados y conectados, cuerpo y aros enteros, divisiones opcionales, distintos diámetros, acrílicos asimétricos, juntas flexibles, pilotos ciegos, exportación/reimportación STL, costos, persistencia y cama de impresión. En modo click se comprueba retención por interferencia al tirar sin liberar y ausencia de intersecciones en posiciones muestreadas del recorrido con pestañas liberadas, incluidas configuraciones de 200 y 800 mm. Las variantes centrales comprueban cuerpo limpio, despiece posterior a las caras, pasos desde el interior, fondo ciego de los insertos, exterior cerrado, canal de cable, frisos con 12 sectores, extremos de diámetro, orientación de STL, exportación de herrajes y migración del soporte doble. No equivalen a un ensayo mecánico.

Se mantiene la verificación del resto de construcciones en la suite completa y la compilación TypeScript/Vite. Los archivos relevantes son `src/core/lightbox.ts`, `lightbox-geometry.ts`, `lightbox-snap.ts`, `src/components/LightboxEditor.tsx` y sus integraciones de visor, persistencia y exportación.

## Pendiente de fabricación

Probar ajuste, retención y reaperturas del click en una muestra; después comprobar soporte de pared y montaje del conjunto. Definir el nuevo sistema LED, alimentación y fijación. Todavía no se ensayaron carga, temperatura, iluminación ni exposición exterior. No hay carga admisible ni aptitud exterior certificada.
