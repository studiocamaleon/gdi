# Fase 4.1 — Composición contextual y outputs públicos

**Estado:** IMPLEMENTADA — pendiente de validación funcional del usuario

**Rama:** `visual-ilusion/fase-4-rutas-dag`

**Dependencias:** Fases 3 y 4.

## 1. Problema que resuelve

La primera implementación de componentes fabricados aisló correctamente la
receta y el `JobContext` de cada hijo, pero sólo permitió alimentarlos desde el
contrato comercial del padre. Un hijo no podía publicar resultados calculados
para que otro hijo los consumiera. Además, el editor ocultaba los parámetros
del oficio al tercerizar un paso, aunque el motor los necesita para calcular la
geometría y los outputs del trabajo encargado.

El caso rector es Cartel Backlight:

```text
entradas del cartel
       ↓
bastidor (calcula geometría)
       ├── lona bruta ──→ lona impresa
       └── cenefa ──────→ kit de cenefas

producción física:
bastidor ───────────────┐
lona impresa ───────────┼──→ ensamblaje
kit de cenefas ─────────┘
```

La dependencia para calcular medidas se resuelve al cotizar. No obliga a
serializar la fabricación física.

## 2. Decisiones de dominio

### 2.1 Tercerizar no elimina la definición del trabajo

Un paso tercerizado conserva familia y parámetros del oficio. Sólo deja de
usar máquina, centro y tiempo internos. Los materiales internos se configuran
únicamente cuando la empresa los aporta.

### 2.2 No existe un JobContext global mutable entre hijos

Cada producto conserva su `JobContext`. La comunicación ocurre mediante un
contrato explícito de outputs públicos, con claves estables y etiquetas
humanas. Nunca se expone el cache interno del motor ni identificadores de pasos
como API de composición.

### 2.3 Cálculo y producción son grafos distintos

- El DAG de cálculo ordena componentes para resolver parámetros y cotizarlos.
- El DAG productivo ordena OTs y nodos físicos.
- Una arista de cálculo no crea automáticamente una precedencia productiva.
- La convergencia física continúa definida por el nodo de incorporación.

### 2.4 Los resultados se congelan

La cotización guarda para cada componente:

- `JobContext` resuelto;
- revisión y huella de receta;
- outputs públicos calculados;
- dependencias de cálculo utilizadas;
- costo y desglose recursivo.

La OT materializa esos snapshots; nunca recalcula con una receta posterior.

## 3. Contrato de outputs públicos

El catálogo se deriva de declaraciones existentes de las familias:

- outputs canónicos numéricos;
- geometrías promovidas por `derivador.publicaCanon`;
- hojas de geometría exponen sus campos escalares utilizables, por ejemplo
  `lonaBrutaMm.anchoMm` y `lonaBrutaMm.altoMm`.

Cada output público declara:

- clave canónica;
- etiqueta humana;
- tipo de dato;
- unidad técnica;
- unidad visible;
- origen productivo.

El resultado de cotización sólo devuelve las claves declaradas. Claves
reservadas, caches y datos arbitrarios del `JobContext` no se publican.

## 4. Bindings entre componentes

Una regla puede tomar su valor desde:

- un dato público del padre;
- un output público de otro componente de la misma receta.

La UI presenta ambos mediante selectores. La persistencia usa una referencia
estructurada; no acepta rutas ni fórmulas escritas por el usuario.

```ts
fuente: {
  tipo: "PADRE" | "COMPONENTE";
  componenteCodigo?: string;
  campo: string;
}
```

Se mantienen las operaciones controladas `COPIAR`, `SUMAR`, `RESTAR`,
`MULTIPLICAR` y `DIVIDIR`, con las unidades comerciales del sheet.

## 5. Resolución topológica

Las dependencias se infieren de las fuentes `COMPONENTE` de los bindings.

1. validar que el componente referenciado exista y no sea el mismo;
2. validar que el output exista en el contrato público de su receta;
3. detectar ciclos antes de guardar/publicar;
4. resolver primero los componentes sin dependencias;
5. cotizarlos y publicar sus outputs en el contexto de composición;
6. resolver los descendientes;
7. conservar el orden visual para desempates estables.

Un componente opcional no puede ser fuente obligatoria de otro componente
requerido. Una dependencia ausente produce un error accionable, nunca un valor
vacío ni costo cero silencioso.

## 6. Compatibilidad

- Las recetas sin fuentes de componente conservan su orden y resultado.
- `campoPadre`, `padreClave` y expresiones históricas continúan leyéndose.
- Las configuraciones antiguas se normalizan al abrir el editor.
- No se modifica ni publica automáticamente ninguna receta existente.
- El output público es aditivo en la trazabilidad y no altera precios por sí
  mismo.

## 7. Criterios de salida

- Un paso `estructura_bastidor` tercerizado permite editar Tipo de bastidor y
  los demás parámetros declarados por la familia.
- Un componente Bastidor publica al menos interior, lona bruta, fondo y cenefa
  cuando su derivador los calcula.
- Un segundo componente puede heredar de forma controlada ancho y alto de la
  lona bruta publicada por Bastidor.
- El motor resuelve hijos fuera de orden visual mediante el DAG de cálculo.
- Un ciclo Bastidor → Lona → Bastidor se rechaza antes de cotizar.
- El snapshot de cotización y OT conserva outputs y contextos hijos.
- Las ramas físicas continúan pudiendo ejecutarse en paralelo y convergen sólo
  donde lo define el DAG productivo.
- Las recetas históricas y los pasos tercerizados sin parámetros conservan su
  comportamiento.

## 8. Validación del caso Cartel Backlight

La migración del producto real se hará en una revisión nueva y no forma parte
de una conversión automática. Antes de publicarla se compararán modelo actual y
modelo compuesto en:

- medidas exteriores e interiores;
- lona bruta;
- despiece y desarrollo de cenefa;
- materiales y costos;
- ETA y paralelismo;
- BOM, trazabilidad y snapshots de OT.

## 9. Evidencia de implementación

- El editor mantiene **Parámetros del oficio** al tercerizar un paso; se
  verificó en la ruta tercerizada de Cartel Backlight con Tipo de bastidor,
  profundidad, demasía y refuerzos visibles.
- El formulario de cada producto expone un catálogo controlado de outputs
  públicos con etiquetas y unidades humanas.
- El configurador de componentes permite seleccionar datos del padre o salidas
  de componentes hermanos sin escribir fórmulas ni rutas técnicas.
- El motor resuelve el grafo de cálculo topológicamente, publica los outputs de
  cada hijo y los congela junto con sus dependencias en la trazabilidad.
- La materialización de OT reutiliza el `JobContext` congelado y conserva los
  outputs públicos como respaldo para snapshots anteriores incompletos.
- La API rechaza referencias inexistentes, ciclos, autorreferencias y
  dependencias obligatorias sobre componentes opcionales.
- Se admite cantidad decimal positiva para hijos vendidos por magnitudes como
  m²; no se fuerza artificialmente una cantidad entera.
- Validación automatizada: 1.954 pruebas API y 544 pruebas frontend aprobadas;
  builds API/frontend y chequeo TypeScript aprobados.
- Validación visual sin persistencia: Cartel Backlight publicó “Lona bruta ·
  ancho” y el componente Lona Backlight pudo seleccionarla con ajuste en cm.
