# Fase 4.2 — Pasos compuestos y operaciones de incorporación

**Estado:** EN DESARROLLO · CORRECCIÓN OPERATIVA 4.2.2

> Decisión del 31/08/2026: una etapa compuesta es **un único paso operativo**.
> Sus operaciones internas conservan la configuración completa de un paso para
> calcular tiempo, materiales, recursos y costo, pero son privadas del modelo
> de cálculo: no generan tarjetas, estados, responsables ni registros de
> inicio/fin independientes en la OT. La etapa se inicia y completa una sola
> vez. El snapshot conserva el desglose técnico para explicación y auditoría.

> Revisión del 30/08/2026: la validación con un caso real demostró que una
> “operación” reducida a nombre, magnitud y tiempo no alcanza. Tensar una lona,
> colocar una chapa o cablear iluminación son pasos productivos completos:
> pueden consumir materiales, usar máquinas/centros de costo, ser
> tercerizados, declarar parámetros y publicar outputs. Desde esta revisión,
> toda mención histórica a “operaciones hijas” debe leerse como **pasos
> internos reales**. El modelo reducido queda deprecado y sólo se conserva
> para migrar borradores existentes.

> Corrección del 30/08/2026: la validación funcional determinó que las
> operaciones no pertenecen a cada componente fabricado. Pertenecen a la
> instancia versionada del paso compuesto dentro de la receta. El componente
> solamente declara cómo se configura y en qué nodo se incorpora.

**Rama:** `visual-ilusion/fase-4-rutas-dag`

**Dependencias:** Fase 4 y ampliación 4.1.

## 1. Problema que resuelve

La Fase 4 permite fabricar componentes en ramas independientes y hacerlos
converger antes de un nodo del producto padre. La Fase 4.1 permite que esos
componentes intercambien únicamente outputs públicos para calcular sus
parámetros. Todavía falta representar con precisión el trabajo necesario para
incorporar cada componente al producto final.

Un único tiempo genérico en `Ensamblaje final` no alcanza. Tensar una lona,
colocar una chapa, instalar cuatro cenefas o montar cien módulos LED usan
distintos inductores, ritmos, recursos y costos.

El caso rector es un Cartel Backlight:

```text
Bastidor ───────────────────────────┐
Lona: impresión → refilado ─────────┤
Cenefas: corte → preparación ───────┼──→ Ensamblaje final → Control
Iluminación: armado del kit ─────────┘

Ensamblaje final
├── Tensar lona
├── Colocar cenefas
├── Montar módulos LED
├── Realizar conexión eléctrica
└── Probar iluminación
```

## 2. Decisión de dominio

### 2.1 El paso compuesto es una etapa calculable y operativamente atómica

Un nodo de la ruta padre puede actuar como **etapa compuesta**. Continúa siendo
el nodo visible de convergencia en la ruta principal y reúne operaciones
internas calculables y trazables. En ejecución sigue siendo un único paso.

Las operaciones internas:

- no son productos ni componentes de BOM;
- reutilizan las mismas familias y el mismo editor técnico que un paso normal;
- pertenecen al trabajo de incorporación del componente al padre;
- conservan parámetros, materiales, máquinas, tercerización, tiempos,
  recursos, costos, documentos y outputs del editor estándar;
- se congelan con la revisión como desglose técnico privado;
- no se materializan como pasos independientes de la OT.

La etapa no agrega un tiempo o costo adicional al de sus operaciones. Su
duración, materiales, recursos y costo son el agregado calculado de ellas. El
resultado se materializa en una sola instancia operativa con estado
`pendiente | en_curso | pausado | bloqueado | hecho`.

### 2.2 La incorporación pertenece al paso compuesto de la receta padre

La fabricación de un componente pertenece a la receta del producto hijo. El
trabajo de instalar uno o varios componentes pertenece a la instancia del paso
compuesto dentro de la receta padre.

Por lo tanto, el componente sólo define su configuración de uso, su modo de
seguimiento y el nodo donde converge. Las operaciones se configuran una única
vez en ese nodo compuesto y pueden vincular uno o varios componentes. El mismo
producto `Lona Backlight` puede tensarse en un cartel, pegarse en otro producto
o entregarse sin montaje, sin modificar su receta de fabricación.

### 2.3 Fabricación e incorporación nunca se contabilizan dos veces

- La cotización hija aporta materiales, recursos y tiempo de **fabricación**.
- La instancia del paso compuesto aporta recursos y tiempo de
  **incorporación**.
- Ese paso también puede aportar preparación/cierre general mediante
  operaciones propias sin componente asociado.
- El costo total suma las tres capas una sola vez y conserva su desglose.

## 3. Dos niveles, una frontera operativa explícita

Se conservan dos grafos distintos:

1. **DAG de cálculo:** ordena la resolución de outputs y reglas.
2. **DAG productivo:** ordena componentes y etapas operativas visibles.

Una operación del paso compuesto puede leer:

- parámetros públicos del producto padre;
- outputs públicos del componente al que pertenece;
- outputs públicos de otro componente de la misma receta cuando exista una
  dependencia de cálculo válida.

Una referencia de cálculo no crea por sí sola una precedencia física. La
operación queda contenida en el nodo compuesto elegido y no crea una
dependencia productiva propia. La etapa completa sólo se habilita cuando sus
predecesores y componentes requeridos terminaron.

## 4. Contrato versionado corregido

El catálogo declara una plantilla reutilizable de operaciones. Cada operación
referencia una familia de paso real; su código sólo identifica esa ocurrencia
dentro de la etapa:

```ts
type DefinicionPasoInternoCompuesto = {
  codigo: string;
  familiaCodigo: string;
  nombreVisible?: string;
  requerida: boolean;
  orden: number;
  requiereCodigos: string[];
};
```

Cada revisión de receta guarda la configuración contextual completa de esas
operaciones. `configuracion` usa el mismo contrato que `ProductoConfigPaso`, incluidos
los slots de materiales y los datos de tercerización:

```ts
type ConfiguracionPasoInternoCompuesto = {
  pasoCodigo: string;
  familiaCodigo: string;
  nombreVisible: string;
  activa: boolean;
  componentesCodigos: string[];
  requiereCodigos: string[];
  configuracion: UpsertProductoConfigPasoDto;
};
```

La persistencia versionada queda en
`ProductoRecetaRevision.pasosCompuestosJson`, separada de
`ProductoRecetaComponente.configuracionJson`. La API valida con el mismo
validador del editor de pasos que la familia, materiales, máquina, proveedor,
parámetros y dependencias existan. No se ejecutan expresiones libres.

## 5. Cálculo de tiempo y costo

Cada operación se calcula internamente con el motor universal como un paso normal.
Esto incluye T-1/T-2/T-3/T-4, mecanismos de cantidad, materiales y mermas,
máquinas, centro de costo, dotación y tercerización. Los componentes vinculados
y sus outputs públicos amplían el `JobContext` disponible, pero no crean un
lenguaje de fórmulas alternativo.

### 5.2 Consolidación de la etapa

La primera versión consolida las operaciones internas en secuencia, porque una
etapa atómica representa un mismo proceso y un mismo registro de ejecución:

```text
suma de las duraciones de las operaciones internas activas
```

Las ramas que fabrican componentes sí continúan en paralelo. Si una tarea
interna necesita planificación, responsable, estación, estado o precedencia
propios, debe modelarse como paso normal fuera de la etapa y no como operación
interna. No se infiere paralelismo privado que el tablero no pueda observar.

## 6. Experiencia de usuario

### 6.1 En el Editor de producción

Cada componente fabricado conserva:

- producto hijo;
- resumen humano de la cantidad configurada por regla;
- nodo `Se incorpora en`;
- acción **Configurar uso**, que contiene parámetros y modo de seguimiento;
- acción de eliminación.

Las **Etapas compuestas** aparecen dentro del mismo flujo. Su inspector muestra
las operaciones declaradas en el catálogo y abre el mismo editor técnico de
un paso normal, contextualizado al producto:

1. paso real (`Tensado de lona`);
2. componentes que participan (`Lona`);
3. parámetros y forma de cálculo;
4. materiales (`Tornillo T1 cada 20 cm de perímetro`);
5. máquina, recurso/centro de costo o proveedor;
6. outputs públicos y dependencias internas.

No se muestran claves técnicas ni fórmulas editables.

### 6.2 En el flujo principal

La ruta principal continúa legible. Una etapa muestra un resumen como
`Ensamblaje final · 5 operaciones`. Al expandirla se ven sus operaciones,
los componentes vinculados y su regla de tiempo. No se duplican como nodos
principales ni ensucian el editor general de pasos.

### 6.3 En cotización, OT y Tablero

La cotización muestra el tiempo, materiales y costo de incorporación separado
de la fabricación de componentes. La OT materializa **una única etapa** con la
duración, costo y recursos consolidados. El tablero ofrece una sola acción de
inicio, pausa, bloqueo y finalización. El desglose interno puede consultarse
como explicación o instrucciones, pero no posee estado propio.

## 7. Validaciones e invariantes

- Toda operación apunta a un nodo existente de la ruta padre.
- El nodo destino coincide con el nodo de incorporación del componente.
- Códigos de operación únicos dentro de la revisión.
- Tiempos, ritmos, cantidades y dotaciones son positivos.
- La fuente seleccionada existe en un contrato público versionado y su unidad
  es compatible con la unidad de cálculo.
- Un componente opcional ausente no genera operaciones ni costo.
- Una revisión publicada es inmutable.
- Las recetas históricas sin operaciones conservan exactamente su resultado.
- El costo de fabricación del hijo no se replica dentro del paso compuesto.
- Nunca se crean estados operativos para las operaciones internas.
- Iniciar, pausar, bloquear, completar o reabrir actúa exclusivamente sobre la
  etapa padre.
- El tiempo y costo no se contabilizan dos veces entre etapa y operaciones.

## 8. Snapshot y trazabilidad

La cotización congela por operación:

- componente y revisión que la originaron;
- fuente pública y valor resuelto;
- cantidad/unidad visibles y técnicas;
- modo, ritmo, duración y dotación;
- recurso y tarifa usados;
- costo calculado;
- nodo compuesto de destino.

La OT copia el snapshot sin recalcular contra configuraciones vivas. Una nueva
revisión del hijo, del padre o de las operaciones no altera trabajos emitidos.

## 9. Compatibilidad y despliegue

- `configuracionJson.version = 1` continúa aceptándose.
- La nueva forma se lee como versión 2 y normaliza los bindings existentes.
- No se modifica automáticamente ninguna receta publicada.
- Las relaciones sin operaciones equivalen a la conducta actual.
- El campo histórico `nodoIncorporacionClave` continúa siendo la referencia de
  convergencia y no cambia su significado.

## 10. Criterios de salida

1. Configurar `Ensamblaje final` como paso compuesto sin alterar el orden de la
   ruta principal.
2. Configurar las operaciones internas declaradas por la etapa y vincular uno
   o varios componentes mediante selectores controlados.
3. Resolver tiempos desde datos del padre y outputs públicos de componentes.
4. Separar claramente materiales, costo y tiempo de fabricación e
   incorporación.
5. Congelar el desglose completo en cotización y OT.
6. Mantener ramas hijas paralelas y bloquear el paso compuesto hasta su
   convergencia.
7. Incorporar la duración del paso compuesto al ETA y progreso sin duplicarla.
8. Rechazar familias, materiales, recursos, fuentes o dependencias inválidas
   antes de publicar.
9. Demostrar equivalencia en rutas y recetas históricas sin etapas compuestas.
10. Aprobar pruebas backend/frontend, builds y QA desktop/mobile.
11. Emitir una OT y comprobar que `Ensamblaje final` genera una sola tarjeta y
    un solo estado, sin acciones independientes para sus operaciones internas.

## 11. Caso rector de aceptación

Para un Cartel Backlight de 150 × 100 cm:

- `Tensar lona`: perímetro publicado por Bastidor × 5 min/m;
- `Instalar 4 cenefas`: cantidad de cenefas × 6 min/unidad;
- `Montar 100 módulos LED`: cantidad publicada por Iluminación × 0,7
  min/módulo;
- `Conexión y prueba`: 20 min fijos.

Las ramas de Bastidor, Lona, Cenefas e Iluminación pueden fabricarse en
paralelo. `Ensamblaje final` se bloquea hasta recibirlas, muestra el detalle de
sus cuatro operaciones, calcula duración y costo trazables y luego libera
`Control final`.

## 12. Evidencia histórica de la implementación reemplazada

- Migraciones aplicadas: `20260830190000_fase_4_2_pasos_compuestos` y
  `20260830203000_fase_4_2_autoria_pasos_compuestos`, tanto en desarrollo como
  en la base aislada de pruebas.
- Suite completa de API: 200 suites y 1.958 pruebas aprobadas; 2 suites y 3
  pruebas omitidas por su propia configuración.
- Suite completa de frontend: 55 archivos y 544 pruebas aprobadas.
- Builds de producción de API y frontend aprobados.
- Lint de los contratos y componentes nuevos de Fase 4.2 aprobado; el lint
  completo conserva observaciones previas fuera del alcance de esta ampliación.
- `git diff --check` sin errores.
- El guard de CSS conserva 10 observaciones preexistentes de estilos globales;
  la Fase 4.2 incorpora sus nuevos estilos exclusivamente mediante CSS Modules.
- Smoke visual aprobado en el catálogo: alta `Paso simple | Paso compuesto`,
  explicación de autoría y ausencia de errores de navegador.
- Pendiente: recorrido funcional del usuario con un producto real y QA final
  desktop/mobile antes de declarar cerrada la ampliación.

La evidencia anterior corresponde al modelo reducido y no habilita el cierre
de 4.2.1. Se conserva para trazabilidad, no como aceptación vigente.

## 13. Corrección obligatoria del modelo de autoría

> **Registro histórico, reemplazado por 4.2.1:** esta fue la primera
> corrección de autoría (sacar operaciones del componente), pero todavía
> trataba esas operaciones como objetos reducidos. La sección 14 es la decisión
> vigente: la autoría pertenece a la etapa y sus hijos son pasos reales.

### 13.1 Propiedad de las operaciones

Un paso reutilizable puede declararse `SIMPLE` o `COMPUESTO`. El paso compuesto
define únicamente su catálogo de operaciones posibles: identidad, descripción,
dimensión de cálculo admitida, obligatoriedad y defaults operativos. No conoce
productos, componentes ni outputs concretos.

Al incluirlo en una ruta, la receta del producto crea una instancia versionada
del paso compuesto. Esa instancia configura qué operaciones aplican, qué
componentes participan, qué output público gobierna cada tiempo, el ritmo y la
dotación. Por lo tanto:

- catálogo: define qué trabajo puede realizarse;
- ruta: define cuándo se realiza y su posición en el DAG;
- BOM/receta: vincula componentes y configura reglas contextuales;
- cotización: resuelve los valores concretos;
- OT: congela y ejecuta el desglose resultante.

Una operación puede utilizar varios componentes y un componente puede
participar en varias operaciones. Las operaciones no se guardan dentro de
`configuracionJson` del componente.

### 13.2 Fila de componente

La fila de un componente fabricado sólo muestra:

- producto componente;
- nodo `Se incorpora en`;
- acceso a `Configurar uso`;
- resumen humano de cantidad y modo de ejecución;
- acción de eliminación.

El campo numérico de cantidad desaparece: la cantidad se resuelve mediante el
binding `cantidad` de `Configurar uso`. El valor relacional histórico se
conserva únicamente como fallback compatible.

La política se expresa como modo operativo, no como naturaleza del componente:

- `INDEPENDIENTE`: genera flujo/ítem hijo ejecutable y convergencia;
- `INLINE`: se calcula con receta propia pero no genera seguimiento separado.

La elección se mueve a la configuración avanzada de uso y por defecto es
`INDEPENDIENTE`.

### 13.3 Autoría en la BOM

La BOM agrega una sección `Pasos compuestos`. Cada nodo compuesto presenta sus
operaciones declaradas y un acceso `Configurar operaciones`. Ese workspace
permite activar operaciones, vincular uno o varios componentes y seleccionar
fuentes públicas controladas del padre o de los hijos, sin fórmulas libres.

## 14. Implementación 4.2.1

- El catálogo de la etapa ahora selecciona familias/pasos reales y guarda una
  subruta reusable; los nombres libres sólo son etiquetas visibles de una
  ocurrencia real.
- La BOM abre el editor estándar para cada hijo, incluyendo parámetros del
  oficio, materiales, máquinas, centros, dotación y tercerización.
- La receta persiste `version: 2`, configuraciones completas y dependencias
  internas; la versión 1 se sigue leyendo para migrar borradores existentes.
- El snapshot materializa los hijos con `contenedorClave`, slots y recursos.
- Al cotizar, el motor reemplaza el contenedor por esos pasos y los procesa con
  el motor universal, evitando sumar un tiempo propio del contenedor.
- Los borradores creados con operaciones reducidas muestran explícitamente que
  falta elegir el paso real antes de aplicar la nueva etapa; no se inventa una
  equivalencia que pueda alterar materiales o costos.

Validación técnica de esta corrección:

- builds de API y frontend aprobados;
- TypeScript frontend aprobado;
- 99 pruebas focalizadas de recetas, pasos compuestos y motor aprobadas;
- lint de los archivos nuevos/modificados de UI aprobado; el editor reutilizado
  conserva observaciones históricas fuera del alcance de esta corrección;
- QA en navegador aprobado para el catálogo, selección controlada, edición sin
  pérdida de foco y apertura de la etapa sin componentes vinculados;
- el guard de CSS conserva diez observaciones globales preexistentes; los
  estilos nuevos viven en CSS Modules.

## 15. Cierre 4.2.2 — orden real de resolución y caso Backlight

La validación del caso rector detectó una brecha adicional: materializar los
pasos internos como pasos reales no alcanza si se los ejecuta antes de
resolver las recetas hijas. En ese orden, `Tensar lona` existe y puede tener
materiales y centro de costo, pero todavía no puede leer el perímetro publicado
por `Lona Backlight`.

El orden contractual definitivo es:

```text
parámetros y pasos del padre
  → componentes fabricados en orden de cálculo
  → outputs públicos de cada componente
  → pasos internos de las etapas compuestas
  → cargos, costo total, ETA y snapshot
```

Cada paso interno conserva la lista explícita de componentes vinculados. Si
está vinculado a un único componente, sus outputs públicos amplían el
`JobContext` de ese paso y pueden alimentar las mismas primitivas controladas
de cantidad, geometría, materiales y tiempo que usa una ruta normal. Todos los
outputs quedan además disponibles bajo un espacio de nombres por componente
para evitar ambigüedad cuando un paso relaciona más de uno. Los outputs que
publique el paso interno vuelven al contexto del padre y quedan disponibles
para los pasos internos posteriores.

El configurador controlado de componentes expone también las magnitudes
geométricas derivadas del padre: superficie total y perímetro total. En los
productos a medida, `cantidad` conserva un significado único: cantidad de
piezas enteras. La unidad comercial en m² o metros lineales se calcula desde
la geometría. Así, una `Lona Backlight` para un cartel de 150 × 100 cm recibe
una pieza con esas medidas; su motor valoriza 1,5 m² sin pedir el área otra vez
ni usar fórmulas de texto.

El contenedor continúa sin costo ni duración propios. Los cargos porcentuales
de la cotización se calculan recién después de incorporar los costos de los
pasos internos.

### 15.1 Clasificación de catálogos

La clasificación no crea motores diferentes:

- `Producto simple`: tiene receta y ruta propias, sin productos fabricados
  hijos.
- `Producto compuesto`: su receta incorpora uno o más productos fabricados.
- `Componente`: es el rol de un producto dentro de otra receta, no un tercer
  tipo de producto.
- `Paso simple`: una operación productiva real.
- `Etapa compuesta`: una subruta reutilizable formada por pasos simples
  reales.

Los catálogos deben ofrecer filtros y señales visuales para estas categorías
sin duplicar entidades ni pantallas de edición.

### 15.2 Caso de aceptación desde cero

`Cartel Backlight` será el producto padre compuesto. Su contrato público
declara ancho, alto, profundidad, cantidad de caras y tipo de iluminación. Sus
componentes fabricados candidatos son `Bastidor Backlight`, `Lona Backlight`,
`Juego de cenefas` y, sólo cuando realmente tengan una ruta independiente,
`Fondo trasero` y `Sistema de iluminación`.

La etapa `Ensamblaje final` agrupa pasos reales como colocar fondo, montar
iluminación, cablear, tensar lona y colocar cenefas. Tornillos, cables, fuentes
y módulos instalados directamente permanecen como materiales de esos pasos.

El cierre exige cotizar al menos un cartel de 150 × 100 cm y demostrar que:

1. cada hijo recibe su configuración controlada;
2. sus outputs públicos llegan al paso interno vinculado;
3. fabricación e incorporación se contabilizan una sola vez;
4. el DAG y el ETA respetan la convergencia;
5. cotización y OT conservan el snapshot completo.

### 15.3 Trazabilidad y representación de la ruta

La cotización no debe aplanar la estructura productiva para presentarla. El
snapshot conserva, además de los costos consolidados:

- el nodo de incorporación de cada componente fabricado;
- la subruta ejecutada por cada componente;
- la etapa contenedora de cada paso interno;
- el nombre congelado de la etapa y los componentes vinculados a cada paso.

En Producción, las subrutas de los componentes se muestran como ramas
paralelas, seguidas por una convergencia. La etapa compuesta aparece como un
nodo visible y desplegable; sus pasos reales viven dentro de ella, no como
pasos sueltos de la ruta padre. Esta jerarquía es sólo de presentación y
trazabilidad: los tiempos, materiales y costos continúan perteneciendo a los
pasos reales, por lo que no se duplican al mostrar el contenedor.

## 16. Corrección 4.2.2 — consolidación operativa

Las secciones 14 y 15 describen correctamente la reutilización del editor y el
orden de cálculo, pero queda reemplazada su semántica de ejecución: los pasos
internos son **operaciones privadas de cálculo**, no pasos operativos hijos.

El límite contractual es:

```text
operaciones internas completas
  → motor universal
  → tiempos + materiales + recursos + costos desglosados
  → consolidación
  → una etapa en cotización
  → un paso y un estado en OT/Tablero
```

El snapshot de cotización conserva `operacionesInternas[]` para explicar el
resultado. Al emitir la OT, ese arreglo se copia como detalle consultable de la
etapa, mientras `OrdenTrabajoItemPaso` recibe una sola fila con el
`nodoClave` del contenedor. Ninguna operación interna puede iniciarse,
pausarse, bloquearse, completarse o reabrirse por separado.

Si una tarea necesita centro, responsable, calendario, compra, dependencia o
estado propios durante la ejecución, no pertenece dentro de una etapa
compuesta: debe modelarse como paso normal del flujo principal.

## 17. Ampliación 4.2.4 — activación interna de componentes fabricados

Un componente fabricado conserva la semántica completa de su propia ruta. Al
usarlo dentro de un producto compuesto, sus pasos no dejan de ser obligatorios,
opcionales o condicionales. Se separan dos decisiones que no deben confundirse:

- la activación del nodo componente en el producto padre decide si existe toda
  la subruta;
- la activación de un paso interno decide qué recorrido ejecuta esa subruta una
  vez incluido el componente.

El contrato público del hijo incorpora sus pasos opcionales como decisiones
booleanas controladas. La instancia del componente puede fijarlas activas o
inactivas, resolverlas desde un dato público del padre o solicitarlas durante
la cotización. El valor resuelto se escribe en
`opcionalesActivados.<configPasoId>` dentro del `JobContext` aislado del hijo.
Al descubrir un opcional nuevo, el origen predeterminado es **Definir al
cotizar**: aparece desmarcado en el sheet, pero no se omite silenciosamente. El
modelador puede reemplazar esa conducta por una decisión fija, heredada o por
el predeterminado del producto hijo.

Los pasos condicionales no se convierten en interruptores. Conservan su regla y
se evalúan automáticamente contra el `JobContext` final del componente. El
configurador sólo informa qué datos gobiernan la condición y valida que esos
datos estén incluidos en el contrato público, heredados, fijados o solicitados
al cotizar.

En el sheet comercial, los opcionales del padre permanecen en `Opcionales` y
los del hijo aparecen dentro de la tarjeta del componente. En el lienzo del
padre el componente sigue siendo un único nodo; el resultado puede resumir la
cantidad de decisiones internas, pero no aplana sus pasos sobre la ruta
principal.

La cotización y la OT congelan, por cada componente:

- el `JobContext` hijo completo, incluidas sus activaciones;
- los pasos opcionales activados y omitidos;
- los condicionales evaluados y su resultado;
- la revisión de receta, costos, tiempos y outputs resultantes.

Caso mínimo de aceptación: `Lona Backlight` declara `Diseño gráfico` como
opcional y `Tinta blanca` como condicional al modo de impresión. Desde `Cartel
Backlight`, diseño puede fijarse o preguntarse al cotizar; tinta blanca nunca
se marca manualmente y se activa al resolver `CMYK + Blanco`. En ambos casos el
componente continúa existiendo y la convergencia del padre espera su terminal
real, sin quedar bloqueada por pasos omitidos.

### Estado de implementación y validación

La ampliación 4.2.4 quedó implementada y entra en validación funcional. El
contrato público del componente, el configurador contextual, el sheet
comercial, el motor de cotización y la materialización de la OT comparten la
misma decisión resuelta. La OT omite los pasos internos inactivos y recompone
las aristas de la subruta para mantener su DAG ejecutable.

Validación técnica del 31 de agosto de 2026:

- build de frontend y API aprobados;
- 57 archivos y 551 pruebas de frontend aprobadas;
- 202 suites, 1.969 pruebas y 10 snapshots de API aprobados;
- QA visual del configurador contextual aprobado sin errores ni advertencias
  de consola.
