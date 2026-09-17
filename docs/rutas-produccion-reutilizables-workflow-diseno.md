# Rutas de producción reutilizables como Workflow

## 1. Decisión

Una ruta reutilizable deja de ser una lista lineal de pasos y pasa a ser una
plantilla versionada de Workflow. Puede ser lineal o DAG y admite tres clases de
nodo:

- **Paso de producción:** operación individual configurable en el producto.
- **Etapa consolidada:** conjunto reutilizable de operaciones internas que en
  producción se ejecuta con un solo estado.
- **Componente fabricado:** producto hijo con receta y ruta propias, que se
  fabrica dentro del recorrido del producto padre.

La plantilla define estructura y precedencias. La configuración contextual
(materiales, máquinas, bindings, opcionales, documentos y uso de componentes)
continúa perteneciendo al producto que incorpora la ruta.

## 2. Fuente de verdad y compatibilidad

Cada `RutaVersion.snapshotJson` conserva el contrato completo del Workflow:

- versión del contrato;
- topología `LINEAL` o `DAG`;
- nodos tipados;
- aristas dirigidas;
- proyección compatible de pasos.

Los nodos Paso y Etapa siguen materializándose como `RutaPaso`. Esto preserva
las claves foráneas y configuraciones existentes (`ProductoConfigPaso`). Los
componentes viven en el snapshot de la versión y se materializan como
componentes de receta al aplicar la plantilla a un producto compuesto.

Las rutas históricas que sólo contienen `pasos` se leen automáticamente como:

`Paso 1 → Paso 2 → … → Paso N`

No se reescriben versiones publicadas ni productos ya asociados.

## 3. Reglas del grafo reutilizable

- Las claves de nodo son únicas dentro de la versión.
- No se admiten ciclos, autorreferencias ni aristas duplicadas.
- Toda arista debe referenciar nodos existentes.
- El orden estable es topológico; varios nodos en el mismo momento expresan
  paralelismo.
- La ruta debe conservar al menos un Paso o una Etapa como nodo del flujo
  principal.
- Un Componente debe identificar un producto hijo concreto y activo.
- En esta iteración, un Componente puede recibir precedencias desde nodos del
  padre y debe converger en un Paso o Etapa del padre.
- Una plantilla con componentes sólo puede aplicarse a un producto declarado
  como compuesto.

## 4. Aplicación a un producto

Al asociar la versión de una ruta:

1. se materializan las configuraciones base de sus Pasos y Etapas;
2. al crear el primer borrador de receta, se copian las dependencias entre
   nodos principales;
3. los nodos Componente se convierten en componentes de receta;
4. las aristas de entrada del componente se convierten en predecesores de su
   subruta;
5. la arista de salida define su nodo de incorporación;
6. desde ese momento el producto puede contextualizar el modelo sin modificar
   la plantilla reusable.

Una nueva versión de la ruta no muta automáticamente productos existentes. La
migración debe ser explícita para conservar trazabilidad y snapshots.

## 5. UX

El editor de rutas reutilizables usa el mismo lenguaje visual de la Hoja de
ruta del producto:

- lienzo horizontal por momentos;
- tarjetas diferenciadas para Paso, Etapa y Componente;
- incorporación secuencial o en paralelo;
- controles de zoom/ajuste cuando el recorrido crece;
- identidad Grafoprint, sin convertir el formulario en una grilla técnica.

La ficha del producto sigue siendo el lugar donde se completa la receta. El
editor reusable no configura parámetros comerciales ni consume materiales por
el producto: sólo define el contrato estructural reutilizable.

## 6. Criterios de aceptación

- Crear una ruta lineal sólo con pasos conserva el comportamiento anterior.
- Crear una ruta DAG con dos componentes en paralelo que convergen en una etapa
  guarda y vuelve a mostrar exactamente ese Workflow.
- Duplicar una ruta duplica nodos y dependencias sin compartir identidades de
  Paso/Etapa.
- Asociar una ruta con componentes a un producto simple informa el conflicto.
- El primer borrador de un producto compuesto hereda componentes y
  dependencias de la plantilla.
- Editar una ruta usada crea una nueva versión y no modifica las asociaciones
  existentes.
- Una ruta histórica sin contrato Workflow sigue abriendo como lineal.
