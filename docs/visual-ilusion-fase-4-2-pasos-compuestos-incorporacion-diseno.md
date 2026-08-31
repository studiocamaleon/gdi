# Fase 4.2 — Pasos compuestos y operaciones de incorporación

**Estado:** EN DESARROLLO · CORRECCIÓN ESTRUCTURAL 4.2.1

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

### 2.1 El paso compuesto es una etapa o subruta reutilizable

Un nodo de la ruta padre puede actuar como **paso compuesto**. Continúa siendo
el nodo visible de convergencia en la ruta principal, pero reúne pasos internos
reales, calculables y trazables.

Los pasos internos:

- no son productos ni componentes de BOM;
- son instancias de las mismas familias de paso que usa una ruta normal;
- pertenecen al trabajo de incorporación del componente al padre;
- conservan parámetros, materiales, máquinas, tercerización, tiempos,
  recursos, costos, documentos y outputs del editor estándar;
- se congelan con la revisión y se materializan con la OT.

El contenedor no tiene tiempo, materiales ni costo propios. Su duración y costo
son el agregado de sus hijos según el DAG interno. No se crea un pseudopaso
paralelo al modelo productivo existente.

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

## 3. Dos grafos, una relación explícita

Se conservan dos grafos distintos:

1. **DAG de cálculo:** ordena la resolución de outputs y reglas.
2. **DAG productivo:** ordena la ejecución física y la convergencia.

Una operación del paso compuesto puede leer:

- parámetros públicos del producto padre;
- outputs públicos del componente al que pertenece;
- outputs públicos de otro componente de la misma receta cuando exista una
  dependencia de cálculo válida.

Una referencia de cálculo no crea por sí sola una precedencia física. La
operación queda físicamente contenida en el nodo compuesto elegido, y ese nodo
sólo se habilita cuando sus predecesores y componentes requeridos terminaron.

## 4. Contrato versionado corregido

El catálogo declara una plantilla reusable de subruta. Cada hijo referencia
una familia de paso real; su código sólo identifica esa ocurrencia dentro del
contenedor:

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

Cada revisión de receta guarda la configuración contextual completa de esos
pasos. `configuracion` usa el mismo contrato que `ProductoConfigPaso`, incluidos
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

Cada hijo se calcula con el motor universal exactamente como un paso normal.
Esto incluye T-1/T-2/T-3/T-4, mecanismos de cantidad, materiales y mermas,
máquinas, centro de costo, dotación y tercerización. Los componentes vinculados
y sus outputs públicos amplían el `JobContext` disponible, pero no crean un
lenguaje de fórmulas alternativo.

### 5.2 Duración del paso compuesto

La duración del contenedor es la ruta crítica de su DAG interno. Si no se
declaran dependencias, se conserva el orden lineal como fallback seguro:

```text
ruta crítica de los pasos internos activos
```

Las ramas que fabrican componentes sí continúan en paralelo. El ETA del
producto usa la ruta crítica hasta la convergencia y luego la duración completa
del paso compuesto. El paralelismo interno del ensamblaje queda como ampliación
posterior y no se infiere silenciosamente.

## 6. Experiencia de usuario

### 6.1 En Producción / BOM

Cada componente fabricado conserva:

- producto hijo;
- resumen humano de la cantidad configurada por regla;
- nodo `Se incorpora en`;
- acción **Configurar uso**, que contiene parámetros y modo de seguimiento;
- acción de eliminación.

La BOM presenta además una sección **Etapas compuestas**. Su workspace muestra
los pasos internos declarados en el catálogo y abre el mismo editor técnico de
un paso normal, contextualizado al producto:

1. paso real (`Tensado de lona`);
2. componentes que participan (`Lona`);
3. parámetros y forma de cálculo;
4. materiales (`Tornillo T1 cada 20 cm de perímetro`);
5. máquina, recurso/centro de costo o proveedor;
6. outputs públicos y dependencias internas.

No se muestran claves técnicas ni fórmulas editables.

### 6.2 En Rutas y flujo

La ruta principal continúa legible. Un paso compuesto muestra un resumen como
`Ensamblaje final · 5 pasos`. Al expandirlo se ven sus pasos internos,
los componentes vinculados y su regla de tiempo. No se duplican como nodos
principales ni ensucian el editor general de pasos.

### 6.3 En cotización y OT

La cotización muestra el tiempo, materiales y costo de incorporación separado
de la fabricación de componentes. La OT materializa los hijos bajo el
contenedor, con sus consumos y recursos, para ejecutarlos y auditarlos sin
aplanarlos ni duplicarlos.

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
- La reapertura y finalización siguen gobernadas por el nodo padre para evitar
  estados imposibles entre padre y subtareas.

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
2. Configurar los pasos internos reales declarados por la etapa y vincular uno
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
