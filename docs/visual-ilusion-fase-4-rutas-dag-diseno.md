# Fase 4 — Rutas DAG, paralelismo, convergencia y gates

**Estado:** EN DESARROLLO  
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
