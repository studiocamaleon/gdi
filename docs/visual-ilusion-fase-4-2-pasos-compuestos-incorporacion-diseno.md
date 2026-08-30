# Fase 4.2 — Pasos compuestos y operaciones de incorporación

**Estado:** IMPLEMENTADA · PENDIENTE DE VALIDACIÓN FUNCIONAL DEL USUARIO

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

### 2.1 El paso compuesto es un contenedor productivo

Un nodo de la ruta padre puede actuar como **paso compuesto**. Continúa siendo
el nodo visible de convergencia en la ruta principal, pero reúne operaciones
hijas calculables y trazables.

Las operaciones hijas:

- no son productos ni componentes de BOM;
- no tienen receta propia;
- pertenecen al trabajo de incorporación del componente al padre;
- pueden tener cantidad, unidad, tiempo, centro de costo y recurso propios;
- se congelan con la revisión y se materializan con la OT.

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

## 4. Contrato versionado

El catálogo declara el contrato reusable del paso compuesto:

```ts
type DefinicionOperacionCompuesta = {
  codigo: string;
  nombre: string;
  descripcion?: string;
  magnitudEsperada?: string;
  requerida: boolean;
  orden: number;
};
```

Cada revisión de receta guarda la configuración contextual de esas
operaciones:

```ts
type ConfiguracionOperacionCompuesta = {
  operacionCodigo: string;
  activa: boolean;
  componentesCodigos: string[];
  modoTiempo: "FIJO" | "POR_UNIDAD";
  fuenteCantidad?: {
    tipo: "PADRE" | "COMPONENTE";
    componenteCodigo?: string;
    campo: string;
  };
  minutosFijos?: number;
  minutosPorUnidad?: number;
  dotacionOperarios: number;
};
```

La persistencia queda en `ProductoRecetaRevision.pasosCompuestosJson`, separada
de `ProductoRecetaComponente.configuracionJson`. La API valida que el paso, la
operación, los componentes y los outputs públicos existan y no ejecuta
expresiones libres.

## 5. Cálculo de tiempo y costo

### 5.1 Tiempo de trabajo

- `FIJO`: `minutosFijos`.
- `POR_UNIDAD`: `cantidad resuelta × minutosPorUnidad`.
- Horas-persona: `duración × dotación`.
- Costo: horas-persona por costo horario del centro/recurso congelado.

La cantidad se resuelve desde fuentes controladas. Las unidades visibles usan
las mismas convenciones del sheet comercial; las conversiones técnicas se
hacen internamente.

### 5.2 Duración del paso compuesto

En la primera versión, las operaciones dentro de un mismo paso compuesto son
secuenciales. Su duración es:

```text
tiempo base del paso + suma de duraciones de incorporación
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

La BOM presenta además una sección **Pasos compuestos**. Su workspace muestra
las operaciones declaradas en el catálogo y permite configurarlas mediante
controles humanos:

1. nombre de la tarea (`Tensar lona`);
2. componentes que participan (`Lona`, `Cenefas`, `Iluminación`);
3. forma de cálculo (`Tiempo fijo` o `Según una cantidad`);
4. dato público que determina la cantidad (`Perímetro del bastidor`, `Cantidad de
módulos`, `Superficie de chapa`, etc.);
5. ritmo y unidad visibles (`5 min por m`, `0,7 min por módulo`);
6. recurso/centro de costo cuando corresponda.

No se muestran claves técnicas ni fórmulas editables.

### 6.2 En Rutas y flujo

La ruta principal continúa legible. Un paso compuesto muestra un resumen como
`Ensamblaje final · 5 operaciones`. Al expandirlo se ven sus operaciones hijas,
los componentes vinculados y su regla de tiempo. No se duplican como nodos
principales ni ensucian el editor general de pasos.

### 6.3 En cotización y OT

La cotización muestra el tiempo y costo de incorporación separado de la
fabricación de componentes. La OT materializa las operaciones bajo el paso
compuesto para que puedan consultarse y auditarse. El estado operativo inicial
continúa gobernado por el paso padre; no se introduce un segundo workflow
independiente hasta que exista una necesidad real de captura por subtarea.

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
2. Configurar las operaciones declaradas por el paso compuesto y vincular uno
   o varios componentes mediante selectores controlados.
3. Resolver tiempos desde datos del padre y outputs públicos de componentes.
4. Separar claramente costo/tiempo de fabricación e incorporación.
5. Congelar el desglose completo en cotización y OT.
6. Mantener ramas hijas paralelas y bloquear el paso compuesto hasta su
   convergencia.
7. Incorporar la duración del paso compuesto al ETA y progreso sin duplicarla.
8. Rechazar fuentes inexistentes, unidades incompatibles y operaciones
   inválidas antes de publicar.
9. Demostrar equivalencia en rutas y recetas históricas sin operaciones.
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

## 12. Evidencia técnica de implementación

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

## 13. Corrección obligatoria del modelo de autoría

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
