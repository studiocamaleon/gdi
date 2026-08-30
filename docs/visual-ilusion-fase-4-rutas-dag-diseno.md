# Fase 4 — Rutas DAG, paralelismo, convergencia y gates

**Estado:** EN DESARROLLO · AMPLIACIÓN DE COMPONENTES CONFIGURABLES

**Rama:** `visual-ilusion/fase-4-rutas-dag`

**Plan rector:** `docs/visual-ilusion-plan-maestro.md`

**Dependencia:** Fase 3 completa e integrada en `visual-ilusion/analisis`.

## 1. Objetivo

Permitir que una definición productiva ejecute ramas simultáneas y las reúna
en puntos controlados, sin cambiar el resultado ni la operatoria de las rutas
lineales actuales.

Ejemplo rector:

```text
Diseño
  ├─ Impresión UV sobre PVC
  ├─ Impresión y corte de cartón
  └─ Corte láser de acrílico
          ↓
       Armado
          ↓
          QC
```

`Armado` sólo queda ejecutable cuando terminaron las tres ramas.

## 2. Decisiones de arquitectura

### 2.1 El paso de OT sigue siendo el nodo ejecutable

`OrdenTrabajoItemPaso` ya concentra estación, máquina, estado, tiempos, mesa,
tercerización y gates documentales. No se crea una segunda entidad de ejecución
que compita con él. La Fase 4 le agrega identidad de nodo y dependencias.

### 2.2 La precedencia es una relación explícita

El orden visual `indice` continúa existiendo como orden topológico estable para
presentación y compatibilidad. Deja de ser la fuente de verdad para decidir si
un paso puede empezar. La fuente de verdad serán aristas relacionales entre un
paso predecesor y uno sucesor.

### 2.3 Una ruta lineal se compila a un DAG trivial

Una ruta histórica `A, B, C` se materializa como:

```text
A → B → C
```

De esta manera usa el mismo evaluador que una ruta paralela, pero conserva su
frontera única y el comportamiento anterior.

### 2.4 Activación opcional y precedencia no se mezclan

`requiereRutaPasoIds` hoy significa arrastre de activación: si se elige un paso
opcional, también deben activarse otros. No representa precedencia productiva y
no se reutiliza para DAG. La topología tendrá su propio contrato.

### 2.5 La receta publicada congela el grafo

El editor trabaja sobre el borrador de receta. Al publicar se congelan nodos,
aristas, gates y referencias de componentes. Cotización y OT conservan esa
revisión; un cambio posterior no reescribe trabajo histórico.

### 2.6 Los componentes fabricados convergen en un nodo

Fase 3 declara, versiona y costea el componente. Fase 4 vincula cada componente
de fabricación separada con:

- su ejecución hija;
- el nodo de incorporación/ensamble del producto padre;
- una dependencia que sólo se satisface cuando el componente requerido está
  terminado y recibido por el flujo principal.

## 3. Contrato persistente previsto

### Definición publicada

- topología `LINEAL | DAG` por revisión de receta;
- nodos congelados con clave estable, tipo, nombre y orden topológico;
- aristas obligatorias dirigidas y tipadas;
- referencia opcional al componente fabricado que origina un nodo/dependencia;
- snapshot canónico incluido en la huella de la receta.

### Ejecución en OT

- `OrdenTrabajoItem` conserva topología y snapshot del grafo;
- `OrdenTrabajoItemPaso` conserva `nodoClave` estable;
- una tabla de dependencias relaciona predecesor y sucesor;
- las dependencias pueden cruzar items de la misma OT para conectar un
  componente fabricado con el ensamble del padre;
- índices y restricciones impiden duplicados, autorreferencias y relaciones
  entre tenants.

## 4. Reglas de ejecutabilidad

Un nodo es ejecutable cuando:

1. está pendiente, en curso o pausado según la acción solicitada;
2. todos sus predecesores obligatorios están hechos;
3. todos sus gates documentales están liberados;
4. todo componente obligatorio vinculado fue completado/recibido;
5. no existe un bloqueo operativo vigente.

Los gates `MATERIAL` y `CALIDAD` se congelan como entidades relacionales por
paso. En esta fase un supervisor puede confirmarlos o revocarlos manualmente y
la resolución queda auditada. La Fase 7 sustituirá la confirmación manual de
`CALIDAD` por una inspección con evidencia; la Fase 9 hará lo mismo con
`MATERIAL` desde reservas/asignaciones reales. El contrato de ejecución no
cambia entre esas fases.

Pueden existir varias fronteras activas simultáneamente.

## 5. Reapertura

Reabrir un nodo hecho sólo es válido si ningún descendiente transitivo comenzó.
Si en una etapa posterior se permite reproceso con descendientes ejecutados, se
modelará como una operación explícita que invalida/controla descendientes; no se
los reescribe silenciosamente.

## 6. Progreso y finalización

- Progreso: ponderación por duración estimada de nodos obligatorios, con
  fallback por cantidad cuando no hay estimaciones confiables.
- Finalización: todos los nodos terminales obligatorios deben estar hechos.
- Una rama rápida no infla artificialmente el avance de una rama costosa.

## 7. Estrategia de implementación

1. Compilador y validador puro de grafos.
2. Persistencia de nodos/aristas en receta y dependencias en OT.
3. Materialización lineal compatible con dependencias explícitas.
4. Evaluador único de frontera y reapertura.
5. Editor controlado de dependencias en el borrador de receta.
6. Paralelismo real en tablero y scheduler ETA.
7. Componentes fabricados como ejecución hija y convergencia.
8. Caso industrial, regresión total y QA responsive.

## 8. Criterios de compatibilidad

- Una OT histórica sin dependencias explícitas conserva la semántica por
  índice como fallback.
- Una OT nueva lineal produce la misma secuencia y progreso que antes.
- No se migran ni reinterpretan órdenes finalizadas.
- El backfill perezoso sigue siendo idempotente.
- La creación concurrente no duplica nodos ni aristas.

## 9. Evidencia requerida para el cierre

- compilador lineal determinístico;
- rechazo de ciclos, claves duplicadas, aristas huérfanas y autorreferencias;
- dos o más nodos simultáneamente ejecutables;
- convergencia bloqueada hasta terminar todos los predecesores;
- reapertura segura por descendientes transitivos;
- componente fabricado ejecutado y conectado al ensamble padre;
- equivalencia demostrada sobre una ruta lineal histórica;
- builds, regresión completa y QA desktop/mobile aprobados.

## 10. Matriz de trazabilidad implementada

| Requisito                  | Implementación                                                      | Evidencia                                                  |
| -------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| Topología lineal/DAG       | Grafo versionado en receta y snapshot de OT                         | Compilador y validador puro; migraciones `171500`/`173000` |
| Compatibilidad lineal      | Compilación `A → B → C` y fallback histórico por índice             | Tests de grafo y regresión acumulada                       |
| Paralelismo y convergencia | Dependencias relacionales y múltiples fronteras activas             | Tests de ramas, tablero y scheduler                        |
| Componentes fabricados     | Ítem hijo congelado y arista terminal → nodo de incorporación padre | Migración `174500` y test de materialización               |
| Gates documentales         | Gate existente de Desarrollo Documental antes de ejecutar           | Tests de seguridad del tablero                             |
| Gates material/calidad     | `OrdenTrabajoPasoGate`, bloqueo backend y resolución auditada       | Migración `183000`, tests backend y render del tablero     |
| Tercerización              | Recepción de compra completa el nodo y libera sucesores             | Regresión de órdenes y producción                          |
| Progreso                   | Ponderación por duración con fallback explícito                     | Tests de flujo y tablero                                   |
| ETA                        | Scheduler DAG en API y cliente con semántica equivalente            | Tests de ETA/flujo y simulación                            |
| Editor/visualizador        | Dependencias, convergencias y gates configurables en borrador       | QA interactivo en Producción/BOM                           |

## 11. Evidencia técnica al 30-08-2026

- Migraciones aplicadas correctamente en las bases de desarrollo y test.
- Backend: 197 suites y 1.944 pruebas aprobadas; 2 suites y 3 pruebas omitidas
  explícitamente por el repositorio.
- Frontend: 54 archivos de test y 542 pruebas aprobadas.
- Builds de API y frontend aprobados.
- QA interactivo desktop del editor: dependencias y gates responden, sin
  overflow horizontal; el borrador utilizado para la prueba se cerró sin
  guardar cambios.
- La aprobación visual/funcional final —incluida la revisión mobile por el
  usuario— permanece como gate de cierre antes de marcar la fase `COMPLETA`.

## 12. Ampliación aprobada: instancia configurable padre–componente

La validación funcional detectó que `cantidad × unidad` sólo describe
correctamente componentes de especificación fija. No alcanza para productos
hijos configurables, por ejemplo un vinilo de medida libre, una tarjeta con
formato elegible o un acrílico cuyas dimensiones dependen del padre.

### 12.1 Decisión de dominio

Un componente fabricado es una **instancia configurable de otro producto**. Su
configuración se construye combinando, campo por campo, uno de estos orígenes:

- `DEFAULT_HIJO`: usar el valor predeterminado declarado por el configurador
  del producto hijo;
- `FIJO`: fijar un valor dentro de la relación padre–componente;
- `PADRE`: copiar un campo público del JobContext del padre;
- `FORMULA`: derivar el valor mediante una expresión segura sobre campos
  públicos del padre;
- `COTIZACION`: solicitar el valor al configurar el padre en una cotización,
  con un valor inicial opcional.

Los orígenes se combinan dentro del mismo componente; no son modos excluyentes
para toda la relación.

### 12.2 Contrato de contexto

- El hijo no recibe ni interpreta el JSON interno completo del padre.
- Cada configurador expone un contrato estable de parámetros públicos con
  clave, tipo, unidad, obligatoriedad, opciones y valor predeterminado.
- Las referencias usan claves públicas (`padre.medidas.ancho`, por ejemplo) y
  quedan versionadas en la receta del padre.
- Las fórmulas iniciales admiten copia y aritmética decimal segura con
  constantes; no ejecutan JavaScript ni acceden a servicios o propiedades no
  declaradas.
- La interfaz no expone claves ni expresiones libres: herencia y cálculo se
  configuran mediante selectores de campo público, operación permitida y valor
  numérico. La expresión canónica, si se conserva por compatibilidad, la genera
  el sistema y nunca depende de que el usuario escriba código correctamente.
- Los parámetros enumerados —material, modo de color, calidad u otros— usan
  siempre las opciones declaradas por el configurador del hijo; no se editan
  como texto libre.
- El resultado se valida contra el mismo esquema/configurador que usa el
  producto hijo cuando se cotiza directamente.
- Cada nivel anidado conoce sólo su padre directo.

### 12.3 Cantidad

La cantidad deja de ser un número ambiguo y se trata como otro binding:

- fija por unidad del padre;
- copiada o calculada desde la cantidad/contexto del padre;
- solicitada al cotizar cuando el caso comercial lo requiera.

La salida siempre se normaliza a la unidad comercial admitida por el producto
hijo y debe ser positiva.

### 12.4 Persistencia y snapshots

La revisión del padre conserva relacionalmente y en su snapshot canónico:

- producto y revisión publicada del hijo;
- bindings por parámetro;
- expresiones y referencias utilizadas;
- configuración fija/default sugerida;
- campos que deben solicitarse al cotizar;
- binding de cantidad;
- nodo de incorporación.

La cotización congela el JobContext completo resultante de cada hijo, su
configuración visible, receta, versión, huella, cantidad y desglose de costo.
La OT materializa ese snapshot sin reevaluarlo contra productos vivos.

### 12.5 UX en la receta/BOM

La BOM sólo muestra una tarjeta resumen del componente. No contiene un editor
de ruta reducido.

- `Configurar uso` abre un workspace amplio para asignar el origen de cada
  parámetro, probar un contexto padre y previsualizar el hijo resultante.
- `Ver/editar producto hijo` navega a la ficha productiva normal del hijo,
  conservando una ruta de regreso al padre.
- Modificar el uso dentro del padre nunca modifica la receta global del hijo.
- La receta padre no se publica si falta una revisión hija, un binding
  obligatorio, una referencia, una unidad compatible o un nodo de
  incorporación válido.

### 12.6 UX en cotización

El sheet del padre presenta tarjetas compactas por componente:

- componentes completamente resueltos se muestran como resumen y no exigen
  interacción;
- componentes con bindings `COTIZACION` muestran los faltantes y una acción
  `Configurar`;
- la acción reutiliza el configurador del hijo en un segundo nivel amplio con
  breadcrumb, no en un modal anidado;
- los valores fijos/heredados/calculados son informativos y sólo los campos
  solicitados son editables;
- no se permite cotizar hasta que padre e hijos sean válidos.

### 12.7 Costeo y ejecución

- Cada hijo se cotiza con el motor universal usando su JobContext normal; el
  motor no necesita saber que fue instanciado por un padre.
- El costo del hijo se incorpora una sola vez al padre y no duplica materiales
  ya absorbidos por su receta.
- La OT hija conserva ese JobContext y despliega la ruta publicada del hijo.
- Sus terminales liberan exactamente el nodo de incorporación del padre.

### 12.8 Invariantes adicionales

- Una revisión publicada no cambia si se modifica un preset o producto vivo.
- No se permiten referencias a campos privados, inexistentes o de tipo/unidad
  incompatible.
- Una fórmula inválida o un campo obligatorio sin resolver impide publicar y
  cotizar.
- No hay recursión infinita ni ciclos entre productos componentes.
- El componente configurado directamente y como hijo produce el mismo
  JobContext canónico ante los mismos valores.
- La experiencia simple de productos sin componentes no agrega pasos ni
  formularios.

### 12.9 Caso rector de aceptación

Configurar `Exhibidor promocional` con un componente `Vinilo impreso blanco`:

- `ancho = padre.ancho - 4 cm`;
- `alto = padre.alto - 6 cm`;
- material, calidad y corte fijos;
- laminado solicitado al cotizar;
- cantidad `1 × cantidad padre`;
- incorporación antes de `Armado final`.

Al cotizar 30 exhibidores de 80 × 180 cm, el sistema debe obtener 30 vinilos
de 76 × 174 cm, pedir únicamente el laminado, costear ambos sin duplicación,
congelar ambos contextos y ejecutar la ruta del vinilo en paralelo antes de
habilitar el armado.

### 12.10 Implementación realizada

- La relación padre–componente versiona `configuracionJson` con bindings por
  parámetro y los cinco orígenes definidos en 12.1.
- El workspace `Configurar uso` deriva el contrato público del configurador
  real del hijo; incluye cantidad, medidas, materiales y parámetros de pasos.
- El sheet comercial muestra únicamente los bindings `COTIZACION`, con sus
  opciones válidas cuando el parámetro proviene de un catálogo.
- El motor resuelve herencias y fórmulas mediante un parser aritmético
  restringido, genera el JobContext normal del hijo y lo costea recursivamente.
- La cotización congela ese contexto en su trazabilidad y la OT lo copia a
  `jobContextSnapshotJson` del ítem hijo antes de desplegar su ruta y conectar
  la convergencia.
- Las recetas anteriores sin bindings conservan `cantidad padre × cantidad`
  como compatibilidad histórica.

La ampliación queda implementada y pendiente de validación funcional final en
un producto rector antes de cambiar el estado global de la fase a `COMPLETA`.
