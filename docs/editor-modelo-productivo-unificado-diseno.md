# Editor del modelo productivo unificado

Estado: diseño aprobado para implementación incremental
Fecha: 2026-08-31
Alcance: cierre de Fase 4.2 y base de las fases productivas posteriores

## 1. Problema que resuelve

La configuración productiva quedó dividida entre dos lugares que compiten como
fuente de verdad:

- el editor de pasos configura la ruta principal, sus recursos, materiales y
  tiempos;
- la receta/BOM configura componentes fabricados, su incorporación y parte de
  las dependencias.

Para el usuario un componente fabricado también forma parte del recorrido del
producto: tiene dependencias, una subruta propia y un punto de convergencia con
el flujo principal. Por lo tanto no debe autorizarse en una pantalla separada
del recorrido.

## 2. Decisión de producto

En **Identidad** se declara la estructura del producto:

- `SIMPLE`: se fabrica mediante pasos propios y no admite productos hijos.
- `COMPUESTO`: su modelo productivo puede combinar pasos propios, componentes
  fabricados y etapas compuestas.

Esta decisión condiciona la experiencia y las validaciones, pero no crea dos
motores ni dos editores. Ambos tipos utilizan el mismo grafo productivo.

Una etapa compuesta no vuelve compuesto al producto: es una etapa operativa
única cuyo costo y duración se obtienen de tareas internas. Puede existir en un
producto simple o compuesto.

## 3. Fuente única de autoría

La pestaña **Producción** y su editor son la única fuente de autoría del modelo
productivo. El grafo admite nodos heterogéneos:

```text
PASO
COMPONENTE_FABRICADO
ETAPA_COMPUESTA
GATE / DOCUMENTO
```

Un nodo `COMPONENTE_FABRICADO` no simula ser un paso. Referencia un producto
hijo y una revisión de su ruta. En el producto padre configura:

- producto y vía/revisión hija;
- cantidad y unidad;
- bindings fijos, heredados o solicitados al cotizar;
- dependencias de entrada y punto de convergencia;
- política de seguimiento y outputs públicos.

El editor de un producto simple muestra pasos y etapas compuestas. El editor de
un producto compuesto agrega componentes fabricados a la misma paleta y al
mismo grafo.

## 4. BOM como proyección

La BOM deja de ser una segunda pantalla de autoría. Es una proyección
consolidada, calculada y versionada desde el grafo:

- materiales consumidos por pasos;
- componentes fabricados y sus revisiones;
- recursos, documentos y aprobaciones;
- costos, tiempos y cantidades consolidadas.

Publicar congela el grafo, las revisiones hijas, bindings y la BOM resultante.
La vista BOM puede inspeccionar y comparar versiones, pero no mantener una
configuración paralela.

### 4.1 Proyección multinivel

La proyección BOM debe conservar la estructura de ensamble completa y no
limitarse a las líneas directas de la revisión raíz. Cada componente fabricado
referencia una revisión hija exacta; esa revisión se expande recursivamente
hasta materiales, componentes comprados o subcomponentes fabricados.

La vista distingue expresamente:

- **directo**: pertenece a la revisión del nodo seleccionado;
- **acumulado**: incluye todos los niveles descendientes;
- **cantidad maestra**: regla o binding versionado, todavía sin un pedido;
- **cantidad resuelta**: valor concreto congelado por una cotización u OT.

El producto y sus componentes fabricados son nodos de ensamble. Los materiales,
consumibles, packaging y componentes comprados son hojas. Un paso o una etapa
compuesta no crean por sí solos un nivel de BOM: se muestran como origen de
consumo o punto de incorporación.

### 4.2 Separación con el Workflow

El Workflow responde **cómo y cuándo se fabrica**; la BOM responde **de qué se
compone y en qué cantidad**. La BOM no duplica el grafo ni vuelve a mostrar su
topología `LINEAL|DAG`. Vincula cada línea con el paso que la consume y cada
subensamble con el nodo donde se incorpora.

La pantalla de producto presenta por defecto dos lecturas de la misma revisión:

1. `Multinivel`: árbol expandible de productos, subensambles y materiales;
2. `Consolidado`: roll-up de materiales y cantidades compatibles, sin perder la
   trazabilidad de los niveles que aportaron cada consumo.

Recursos, documentos y aprobaciones se mantienen como información técnica de
la revisión o del nodo seleccionado; no compiten con la jerarquía física de la
BOM.

## 5. Compatibilidad y transición

La implementación será compatible con los datos actuales:

1. se agrega al producto la estructura explícita `SIMPLE|COMPUESTO`;
2. los productos con componentes existentes se migran a `COMPUESTO`;
3. el editor consume una proyección unificada de pasos y componentes aunque la
   persistencia transitoria continúe usando las tablas actuales;
4. las acciones del inspector escriben mediante los servicios existentes de
   pasos y revisiones, evitando una migración destructiva;
5. cuando la nueva autoría esté validada, la vista BOM queda sólo como
   proyección y publicación.

Cambiar de `SIMPLE` a `COMPUESTO` conserva toda la ruta. Volver a `SIMPLE` se
permite únicamente si ninguna revisión o borrador contiene componentes.

## 6. Invariantes

- Un componente pertenece a una vía productiva concreta, no globalmente al
  producto.
- Un producto `SIMPLE` no puede guardar ni publicar componentes fabricados.
- No se puede seleccionar el propio producto ni crear ciclos de composición.
- Las dependencias externas apuntan al límite del subgrafo del componente; la
  ruta hija no se aplana para editarla desde el padre.
- La etapa compuesta materializa un único estado operativo en la OT.
- El cálculo puede inspeccionar sus tareas internas, pero producción no obliga
  a operar cada una por separado.
- La OT conserva un snapshot reproducible aunque luego cambien el padre, el
  hijo o sus rutas.

## 7. Journey objetivo

Para `Cartel Backlight`:

1. En Identidad se elige **Producto compuesto**.
2. En Producción se abre la vía `Estándar`.
3. Desde la paleta se agregan `Bastidor Backlight` y `Lona Backlight` como
   componentes, se configuran sus bindings y se conectan en paralelo.
4. Se agrega la etapa compuesta `Ensamble` y ambos componentes convergen en
   ella.
5. Se agrega `Control final` después de Ensamble.
6. El usuario guarda un borrador y revisa la BOM consolidada.
7. Al publicar se congelan el grafo y las revisiones hijas.

El usuario no debe abandonar el editor para decidir dónde se fabrica o se
incorpora un componente.

## 8. Criterios de salida

- Identidad permite declarar y guardar la estructura del producto.
- El catálogo usa la estructura explícita para separar simples y compuestos.
- El editor adapta su paleta y mensajes sin duplicar el motor.
- Los componentes existentes aparecen como nodos del recorrido seleccionado.
- Agregar, configurar y quitar un componente se realiza desde el editor.
- Las dependencias y la incorporación se editan en el mismo contexto visual.
- BOM se presenta como resultado consolidado y no como autoría duplicada.
- Cotización, publicación y OT siguen aceptando productos existentes.
- Existe validación automatizada para las transiciones y el journey simple y
  compuesto.

## 9. Revisión de arquitectura visual — grafo jerárquico

La primera integración técnica demostró que reunir el editor de pasos y el
editor de receta en una misma URL no alcanza: incrustar ambas interfaces sigue
presentando dos herramientas mentales, dos jerarquías y dos ciclos de guardado.

La siguiente iteración reemplaza esa composición por un único editor
jerárquico. La vía productiva es el elemento raíz y todos sus elementos se
presentan como nodos del mismo grafo:

- `PASO`: operación atómica, sin hijos;
- `ETAPA`: contenedor operativo de pasos reales, con un único estado en la OT;
- `COMPONENTE`: referencia versionada a otro producto y a su subruta.

Una etapa responde cómo se agrupa y controla un trabajo. Un componente responde
qué subproducto debe fabricarse. No son equivalentes aunque ambos puedan
expandirse visualmente.

### 9.1 Jerarquía de interacción

El editor utiliza una única carcasa:

1. cabecera de vía y revisión;
2. navegador jerárquico con todos los tipos de nodo;
3. lienzo del flujo con raíces, ramas y convergencias;
4. inspector contextual para el nodo seleccionado;
5. estado único de borrador, validación y publicación.

La representación primaria es horizontal en escritorio: el tiempo avanza de
izquierda a derecha y cada columna corresponde a un momento productivo. Varios
nodos apilados en una misma columna expresan ejecución paralela. En pantallas
angostas la misma proyección rota a una secuencia vertical, sin modificar el
grafo persistido.

El orden se edita directamente sobre la hoja de ruta:

- soltar entre columnas crea un momento secuencial;
- soltar sobre una columna incorpora el nodo al bloque paralelo;
- la posición resultante reemplaza los selectores rutinarios de predecesor e
  incorporación;
- el inspector conserva únicamente la configuración propia del nodo.

Los formularios rutinarios no se abren como una segunda pantalla oscura. Una
etapa se recorre mediante breadcrumb dentro del mismo editor. Un componente
permite configurar su uso en el padre e inspeccionar la subruta congelada, pero
no modificar silenciosamente el producto hijo.

### 9.2 Reglas de composición

- Cualquier tipo de nodo puede ser raíz de la vía.
- Una vía puede tener varias raíces paralelas.
- Una etapa contiene inicialmente sólo pasos; no componentes.
- La ruta de un componente puede contener pasos, etapas y otros componentes.
- Los inputs del componente se resuelven mediante bindings controlados.
- El padre sólo consume outputs que el componente publique como contrato.
- Documentos, materiales disponibles y controles de calidad se modelan como
  requisitos de la vía o de un nodo, no como secciones paralelas al flujo.

### 9.3 Lenguaje visual

La superficie sigue el lenguaje técnico de la Orden de Trabajo: fondo claro,
jerarquía tipográfica sobria, bordes estructurales y naranja Grafoprint como
acento. Paso, etapa y componente comparten anatomía de tarjeta y conectores; se
distinguen por icono, etiqueta y comportamiento al expandirse, no por tres
sistemas visuales diferentes.

### 9.4 Implementación incremental

1. Introducir un contrato de proyección `NodoProductivo` común para los tres
   tipos, conservando temporalmente la persistencia existente.
2. Unificar el navegador lateral y eliminar la lista separada de componentes.
3. Construir el lienzo claro y el inspector contextual.
4. Mover la edición de componentes, dependencias y etapas al inspector.
5. Unificar el estado visible del borrador y el guardado de definiciones.
6. Validar el journey completo de Cartel Backlight, la BOM y la materialización
   en OT antes de retirar las superficies anteriores.

## 10. Estado de implementación

Primera iteración estructural implementada el 2026-08-31:

- la vía se abre por defecto como contexto raíz del editor;
- la hoja de ruta reemplaza al navegador lateral mientras se edita el modelo;
- el lienzo horizontal presenta los tres tipos con una anatomía visual común;
- las columnas expresan secuencia y los nodos apilados expresan paralelismo;
- el orden puede modificarse mediante drag-and-drop y se traduce nuevamente a
  dependencias del grafo;
- los componentes sin predecesores aparecen como raíces y pueden converger en
  cualquier paso o etapa posterior;
- la selección de un nodo abre su inspector contextual;
- la edición completa de un paso reutiliza el editor técnico existente;
- configurar el uso de un componente o el interior de una etapa profundiza en
  el mismo espacio de trabajo, sin abrir un modal oscuro independiente;
- la creación de componentes es explícita y controlada: ya no incorpora
  automáticamente el primer producto disponible;
- guardar el modelo conserva la revisión abierta y el contexto de navegación.

Segunda iteración de interacción implementada el 2026-08-31:

- los botones globales separados de `Paso` y `Componente` se retiraron de la
  cabecera;
- cada conector entre momentos ofrece un `+` contextual que crea un nuevo
  momento exactamente en esa posición;
- cada columna ofrece una única acción `Agregar en paralelo`, evitando sugerir
  un orden falso entre nodos simultáneos;
- un selector único permite elegir `Paso de producción`, `Componente
fabricado` o `Etapa compuesta` y luego el elemento concreto;
- en mobile las acciones de alta permanecen visibles; en escritorio aparecen
  por hover o foco de teclado;
- el alta mínima de pasos y etapas persiste inmediatamente la dependencia
  elegida, mientras que los componentes se incorporan al borrador abierto y se
  guardan junto con el resto del modelo;
- las restricciones transitorias del backend (un bloque de componentes debe
  converger en un paso o etapa del padre) se validan antes de modificar el
  grafo.

La persistencia continúa siendo compatible con los servicios actuales: los
pasos guardan su configuración mediante el servicio de ruta y el modelo guarda
dependencias, componentes, documentos y etapas en la revisión de receta. La
siguiente iteración deberá unificar el indicador visible de cambios pendientes,
la validación/publicación y la prueba integral del journey de Cartel Backlight
antes de retirar definitivamente las superficies anteriores.

## 11. Contrato de interacción de los nodos

Decisión aprobada el 2026-08-31 para reemplazar los inspectores persistentes:

- un clic selecciona el nodo y mantiene visible su posición en el recorrido;
- doble clic o `Enter` abre su espacio de configuración;
- clic derecho abre un menú contextual en el punto de interacción;
- el botón `•••` de la tarjeta abre exactamente el mismo menú y cubre teclado y
  pantallas táctiles;
- el asa de arrastre conserva como única responsabilidad cambiar la posición.

Las acciones siguen una anatomía común:

- `Configurar`: abre el editor específico del nodo;
- `Reemplazar`: utiliza el mismo selector de alta y conserva el momento y la
  rama del nodo reemplazado;
- `Eliminar de la vía`: retira el nodo y reconecta los momentos adyacentes;
- los pasos heredados de la plantilla base no pueden reemplazarse ni eliminarse
  desde el producto: esas acciones se realizan en la definición de la ruta para
  evitar cambios que reaparezcan al recargar.

Un reemplazo descarta únicamente la configuración propia del nodo anterior. Si
el nodo participa en referencias que no pueden migrarse de forma segura, la
operación debe advertirlo o impedirse; nunca debe dejar referencias silenciosas
a una clave inexistente.

Los requisitos de inicio de un paso (`material disponible` y `control de
calidad`) forman parte de su configuración contextual y dejan de requerir un
inspector independiente debajo del lienzo.

### 11.1 Espacio de configuración común

Paso, componente y etapa utilizan una misma carcasa técnica, alineada con la
Orden de Trabajo:

1. volver a la hoja de ruta;
2. etiqueta del tipo y breadcrumb cuando corresponda;
3. nombre y explicación breve del alcance;
4. contenido específico del nodo sobre una superficie clara;
5. pie estable con `Cancelar` y la acción primaria.

El tipo se distingue por icono y acento —paso neutro, componente naranja y
etapa ámbar—, no mediante tres layouts diferentes. Los formularios de edición
no se apilan dentro de modales oscuros. Los modales quedan reservados para
elegir un nodo, confirmar una acción destructiva o explicar una incompatibilidad.

La Hoja de ruta es el único navegador estructural del modelo. Al configurar un
paso —incluidas las subtareas de una etapa compuesta— el sidebar histórico de
pasos, componentes y etapas se oculta: el formulario usa todo el ancho y sólo
conserva un breadcrumb y la acción de volver a su contexto inmediato. En este
modo tampoco se ofrecen controles `Anterior`/`Siguiente`, porque permitirían
navegar el árbol por una segunda interfaz paralela al grafo.

## 12. Requisitos documentales en la Hoja de ruta

Decisión aprobada el 2026-08-31: la Hoja de ruta reemplaza los gates manuales
genéricos de `material disponible` y `control de calidad` por condiciones con
una fuente de verdad concreta. Los consumos de material continúan dentro del
paso; la disponibilidad futura provendrá de reservas y asignaciones reales. El
control de calidad se representa como paso/etapa o, cuando corresponda, como
una aprobación documental. El soporte relacional de los gates operativos se
conserva para compatibilidad, pero deja de ofrecerse como configuración manual
en la Hoja de ruta.

Cada requisito documental declara uno de tres alcances congelados en la OT:

- `ORDEN`: bloquea el ingreso de toda la OT a producción y cualquier ejecución;
- `ITEM`: bloquea exclusivamente la ruta o subruta del producto que lo declaró;
- `PASO`: bloquea el nodo seleccionado, sin detener ramas independientes.

Los requisitos propios de un componente se definen en la receta del producto
hijo. Al usarlo en un producto compuesto se heredan con la revisión exacta del
componente y se muestran en el nodo padre como información de sólo lectura. No
se duplican ni se editan silenciosamente desde el padre. Los documentos del
conjunto se declaran en la ruta padre.

La interacción queda centralizada así:

- la cabecera de la Hoja de ruta abre los requisitos generales de alcance
  `ORDEN` o `ITEM`;
- el menú contextual de un paso o etapa abre los requisitos `PASO` de ese nodo;
- el menú contextual de un componente permite revisar los documentos
  heredados y navegar a su producto de origen;
- las tarjetas muestran un indicador documental, nunca un gate manual sin
  semántica de negocio.

Un requisito sin tipo de aprobación crea el documento esperado y lo hace
visible, pero no bloquea. Para bloquear debe exigir una aprobación concreta y
una revisión liberada a producción.

## 13. Pasos omitidos en una ruta de producto

Decisión cerrada el 2026-09-02: `NO_EJECUTAR` significa que un paso heredado
de la ruta reutilizable **no participa en este producto**, pero no elimina el
nodo estructural ni modifica la plantilla compartida.

La representación depende del contexto:

- en el editor del modelo el nodo permanece en su posición, atenuado, con
  borde discontinuo y la etiqueta `Omitido`; desde allí puede configurarse y
  reactivarse;
- en el resumen del producto se muestra únicamente el recorrido activo y se
  informa por separado cuántos pasos quedaron omitidos;
- en cotización, costos, tiempos y OT el nodo no existe operativamente: no
  consume materiales, recursos ni tiempo y no crea un estado de producción;
- al proyectar el grafo activo se contraen los nodos omitidos. Por ejemplo,
  `A → omitido → B` se ejecuta y visualiza como `A → B`;
- si se omite una rama completa, la contracción conserva las dependencias hasta
  el primer descendiente activo. Nunca convierte un descendiente en una raíz o
  en un paralelo accidental;
- reactivar el paso restaura su posición y sus dependencias originales porque
  el grafo completo sigue versionado en la receta.

La ruta guardada conserva así dos lecturas consistentes: el **grafo de diseño**,
que permite entender y revertir la omisión, y el **grafo efectivo**, que
representa exactamente lo que se cotiza y se fabrica.
