# Grafo: experiencia 3D para la industria gráfica

Actualización: 15 de septiembre de 2026.

## Dirección acordada

**Titular: «El sistema operativo de la industria gráfica».**

La web debe evolucionar hacia una experiencia futurista, cinematográfica y realista: cartelería modelada en 3D que se abre por capas, materiales creíbles y un recorrido por una planta. La identidad actual aporta la marca y el naranja; se puede ampliar con grafito, metal, vidrio y superficies claras para la lectura.

Los planes son **acumulativos: Impresión → Cartelería → Industrial**. Cartelería incluye Impresión; Industrial incluye Cartelería e Impresión. Los precios, límites y asignación definitiva de funciones están pendientes de definición.

Este documento reemplaza la dirección inicial más editorial. Documenta investigación y propuesta; no representa una implementación de la experiencia ni un render ya producido.

## Idea central

**Grafo conecta lo que vendés con todo lo que necesitás para producirlo.**

El recorrido visual muestra operaciones de complejidad creciente. El visitante ve primero qué se fabrica, luego cómo se construye y finalmente cómo se coordina su producción. Cada escena conecta con una función concreta del SaaS.

Bajada propuesta para la portada:

> Cotización, producción y gestión conectadas para impresión, cartelería y operaciones industriales.

Acciones propuestas: **Ver Grafo en acción** y **Explorar planes**. El acceso al sistema permanece visible. La acción de demo debe tener un destino concreto: hoy comparte un mailto con ventas Enterprise.

## Recorrido de la página

### 1. Entrada: una industria conectada

Titular legible desde el primer instante. Junto a él, una vista cinematográfica de una planta gráfica contemporánea: impresión, fabricación de cartelería y estaciones de terminación dentro de un mismo entorno coherente. Iluminación cuidada, superficies reales, actividad breve y controlada.

Mostrar de inmediato las etiquetas **Impresión · Cartelería · Industrial**. El usuario puede saltar a la parte que le interesa sin recorrer obligatoriamente toda la animación.

La planta es una representación de la actividad; no se presenta como una instalación real de un cliente ni como telemetría de máquinas sin una integración comprobada.

### 2. Impresión: del pedido al material

La cámara se acerca a una zona de impresión. Un trabajo aparece sobre el material; se muestran corte y terminación cuando correspondan al ejemplo elegido.

Una única tarjeta del producto acompaña la escena: presupuesto con material, medida, cantidad y ruta. Se utiliza una captura del sistema con datos de demostración.

Mensaje propuesto: **«Cotizá y organizá cada trabajo de impresión».**

Lo que debe entenderse: Grafo conecta el presupuesto con la orden y su producción. La animación ilustra el proceso; no implica control directo de la máquina.

### 3. Cartelería: revelar la construcción

El objeto protagonista es un cartel backlight basado en el modelo existente en Grafo. Se ve ensamblado y encendido; después se separan frente, cenefa, iluminación, estructura y fondo, según las partes reales del modelo.

Cada revelado muestra una relación de gestión:

- Frente/material → consumo y especificación.
- Bastidor/refuerzos → cómputo de materiales.
- LEDs/fuente → componentes y costo.
- Conjunto terminado → orden y tareas de producción.

Mensaje propuesto: **«Cada componente, contemplado en tu cotización».**

Añadir una indicación persistente: **«Incluye todo lo de Impresión».**

La apertura debe mantener las mismas piezas, materiales y proporciones al avanzar y retroceder. Las etiquetas y la interfaz se componen en HTML para conservar legibilidad y poder actualizar los textos.

### 4. Industrial: entender la planta completa

La cámara se aleja del cartel y vuelve al conjunto de la planta. Se destacan estaciones y el recorrido de una orden. La progresión visual muestra qué cambia cuando hay más trabajos, máquinas y personas que coordinar.

Una vista real de planificación o del tablero acompaña el recorrido. Se prioriza una idea por escena: carga por estación, asignación o trazabilidad, según el producto disponible.

Mensaje propuesto: **«Coordiná toda tu producción desde una sola vista».**

Añadir: **«Incluye todo lo de Cartelería e Impresión».**

Usar rutas de cámara predeterminadas para que el recorrido resulte entendible, fluido y fácil de seguir con scroll. Una exploración libre puede estudiarse después como demo opcional.

### 5. Producto, confianza y planes

Después de la experiencia, mostrar con calma las pantallas reales, integraciones, pruebas de uso y planes. Mantener la estructura comercial existente y elevar su jerarquía visual.

Titular de planes: **«Un sistema que crece con tu operación».**

| Nivel | Mensaje principal | Acumulación visible | Enfoque de funciones propuesto |
| --- | --- | --- | --- |
| Impresión | Ordená tus trabajos de impresión | Base común | Cotización, órdenes y gestión del flujo de impresión |
| Cartelería | Cotizá y fabricá trabajos con más componentes | Todo lo de Impresión + | Configuración 3D, estructuras, materiales y procesos de cartelería |
| Industrial | Coordiná operaciones más complejas | Todo lo de Cartelería + | Planificación, capacidad, asignación y trazabilidad de la producción |

La tabla define comunicación, no habilitaciones finales del producto. Todas las tarjetas siguen visibles y comparables. Cada nivel muestra principalmente qué agrega; una matriz ampliable permite revisar el detalle completo. La recomendación de un nivel puede orientarse por tipo de trabajos y complejidad operativa, sin asociar automáticamente impresión a empresas pequeñas.

La selección de nivel puede cambiar la escena destacada y preseleccionar el interés en una demo. No debe ocultar que el plan superior conserva los anteriores.

## Tecnología: asignar cada medio al trabajo adecuado

### Escena técnica de cartelería

La base preferida es geometría 3D real con piezas separadas. Se puede elevar el modelo existente o modelar y refinar una versión de presentación en Blender, exportada a GLB para la web. Three.js permite cargar escenas glTF/GLB y controlar el instante de sus animaciones.

Esta vía da control explícito sobre componentes, proporciones, cámara y apertura. El realismo requiere trabajar materiales, iluminación, biseles, contactos, espesores y referencias constructivas; no aparece automáticamente por usar 3D.

### Recorrido cinematográfico de planta

Usar una secuencia renderizada o clips breves preparados con Higgsfield. Mantener referencias compartidas de planta, producto, iluminación y cámaras para que los cortes pertenezcan al mismo entorno.

La consulta de solo lectura al MCP de Higgsfield devolvió opciones de video con imágenes de referencia y fotogramas inicial/final, incluyendo Cinema Studio Video y Seedance 2.5. Es una disponibilidad de herramientas, no una prueba de calidad sobre este proyecto.

El preset público **Exploded View** genera un efecto de separación en capas. Es útil para explorar dirección visual. Para comunicar una construcción concreta, la geometría y continuidad deben validarse; un clip generativo no aporta por sí mismo un modelo 3D editable.

También están expuestas herramientas 3D Jutsu que editan escenas Blender y permiten exportar `.blend` y `.glb`. Esa capacidad es distinta de la generación de video. No se creó un proyecto 3D ni se iniciaron generaciones durante esta investigación.

### Interfaz comercial

Aceternity UI y Motion aportan navegación, selección de nivel, transiciones de texto y acompañamiento del scroll. El objeto 3D y el recorrido cinematográfico necesitan sus propios recursos visuales.

La implementación recomendada es híbrida: un cartel interactivo real, recorrido de planta preproducido y UI de la página en HTML/React. En móvil, servir la versión apropiada de los clips y una imagen inicial optimizada; cargar la interacción 3D cuando corresponda. Un solo contexto 3D activo y animaciones pausadas fuera de pantalla.

## Base aprovechable en el repositorio

`src/components/carteleria/viewport-3d.tsx` ya construye un cartel con Three.js, materiales físicos, estructura, refuerzos, frente, LEDs, fuente y grupos de piezas. Incluye día/noche, visibilidad por capas y apertura animada mediante `EXPLODE_Z` y `explodeT`.

Esto se verificó leyendo la implementación; en esta revisión no se inspeccionó su calidad visual en ejecución ni se midió el costo de trasladarlo a la landing. Debe evaluarse si conviene extraer la geometría compartida o producir un modelo de presentación a partir de las mismas medidas y componentes.

La aplicación de marketing sirve `landing.html` mediante un Route Handler. Para integrar los componentes React originales de Aceternity, adaptar el contenido conservado a una página React y limitar la ejecución cliente a las escenas que la necesiten. Preservar SEO, enlaces configurables, registro y parámetros de plan durante esa adaptación.

## Calidad y comunicación

- Presentar titular, oferta y navegación antes de que carguen los recursos pesados.
- Mantener controles para avanzar, pausar o saltar las escenas; sonido solo si se solicita.
- Evitar que una animación impida consultar el producto o los planes.
- Capturas y textos deben comunicar funciones existentes; los límites de los tres niveles se definen por separado.
- Los objetos técnicos se validan con una referencia constructiva; los rótulos comerciales quedan fuera del video generado.
- Comprobar movimiento reducido, navegación por teclado, comportamiento móvil y estabilidad de la página.
- Documentar la procedencia de las cifras actualmente fijadas en la landing: 38 %, 4×, 100 % y 12k. La investigación no confirmó esos resultados.
- Recuperar la navegación móvil completa y resolver los enlaces provisionales actuales.

## Primer entregable recomendado

Una secuencia de cartelería de **8–12 segundos como objetivo creativo**, controlable al desplazarse:

1. Cartel terminado en un entorno coherente con la planta.
2. Cambio de cámara que revela espesor, materiales y luz.
3. Apertura en capas con correspondencia entre piezas y cómputo.
4. Reensamblaje y conexión visual con la orden de trabajo.

Preparar fotogramas de referencia, geometría, materiales y posiciones de cámara antes de producir el recorrido completo. La escena debe demostrar tanto el nivel de realismo como la claridad de la explicación. Después se amplía al recorrido acumulativo Impresión → Cartelería → Industrial.

## Fuentes

- [Higgsfield: Exploded View](https://higgsfield.ai/motion/c75a47c8-6a28-4a2a-92dc-6e6359d555fe).
- [Higgsfield: catálogo comercial](https://higgsfield.ai/commercial).
- [Three.js: GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).
- [Three.js: AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html).
- [Aceternity UI: catálogo](https://ui.aceternity.com/components).
- [Aceternity UI: Sticky Scroll Reveal](https://ui.aceternity.com/components/sticky-scroll-reveal).
- [Motion: accesibilidad](https://motion.dev/docs/react-accessibility).
- Consulta directa de las herramientas MCP de Higgsfield: `models_recommend`, documentación de `scene_builder_3d_run_python`, `scene_builder_3d_get_glb` y `scene_builder_3d_get_blend`.
