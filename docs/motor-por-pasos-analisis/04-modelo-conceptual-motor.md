# Modelo conceptual del motor por pasos

> **Fase C** del análisis del motor por pasos.
> **Sesión**: 2026-04-23. **Estado**: COMPLETO.
> **Método**: análisis interactivo. NO escribir código.
>
> ⚠️ **Nota 2026-04-24**: el sub-tema "Ruta de producción reusable" (`07-ruta-de-produccion.md`) afina el modelo de input del motor. Ahora el motor recibe `producto + rutaSeleccionada (de las alternativas) + pasosExtras + JobContext`. El DAG se construye desde la ruta seleccionada + pasos extras inline del producto.

## Propósito

Definir cómo va a funcionar el motor por pasos como pieza de software. Este doc establece:
- El **flujo macro**: qué entra, qué hace, qué sale.
- El **bucle por paso**: las decisiones que toma cada paso al ejecutar.
- La **estructura de la ruta** como DAG (no lineal pura).
- El **manejo de errores**.
- El **modelo de sub-productos** (recursión).
- El **modelo de selectores** (ramas alternativas).
- La separación **motor puro** vs **persistencia**.

Es input directo para Fase D (resoluciones por paso) y para el roadmap final de extracciones.

---

## 1. Flujo macro

```
┌──────────────────────────────────────────────────────────────────────┐
│                      ENTRADA AL MOTOR                                │
│                                                                      │
│   • productoServicioId       (qué producto cotizar)                  │
│   • cantidad                 (cuántas unidades pide el cliente)      │
│   • período                  (mes, para tarifas)                     │
│   • opcionesSeleccionadas    (cuáles opcionales activar)             │
│   • selecciones              (papel, color, medidas, variante)       │
│   • cliente                  (para reglas comerciales)               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
       ┌──────────────────────────────────────────────────┐
       │ 1. INICIALIZACIÓN                                │
       │   • Cargar producto + ruta (DAG)                 │
       │   • Inicializar JobContext con inputs            │
       │   • Pre-cargar tarifas y precios del período     │
       └──────────────────────────────────────────────────┘
                              ↓
       ┌──────────────────────────────────────────────────┐
       │ 2. ITERAR NODOS DE LA RUTA (orden topológico)    │
       │   Por cada nodo, según su tipo:                  │
       │     • PASO_SIMPLE  → ejecutar bucle a-h          │
       │     • SUB_PRODUCTO → recursión                   │
       │     • SELECTOR     → decidir rama                │
       └──────────────────────────────────────────────────┘
                              ↓
       ┌──────────────────────────────────────────────────┐
       │ 3. COMPONER RESULTADO                            │
       │   • TOTAL = Σ pasos cotizados                    │
       │   • UNITARIO = TOTAL / cantidad                  │
       │   • SUBTOTALES por bucket                        │
       │   • Generar shape de snapshot (caller persiste)  │
       └──────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│                       SALIDA DEL MOTOR                               │
│                                                                      │
│   • total, unitario                                                  │
│   • subtotales (centroCosto, materiasPrimas, cargosFlat)             │
│   • pasos[] (con trazabilidad A-G por paso)                          │
│   • warnings[]                                                       │
│   • snapshotShape (listo para persistir si el caller decide)         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. El bucle por paso (9 sub-tareas a-i)

Cada paso simple ejecuta esta secuencia interna:

```
a. ¿Está activo?
   • OBLIGATORIO  → siempre
   • OPCIONAL     → si lo eligió comercial
   • CONDICIONAL  → si cumple regla del JobContext
   → si NO está activo, skip al siguiente

b. Resolver MÁQUINA + PERFIL
   • Si paso es M-1: una sola opción
   • Si paso es M-2: leer selección del JobContext
   • M-0: no aplica

c. Calcular TIEMPO
   • Resolver el modo de tiempo según modosTiempoHabilitados:
     - 1 modo → motor automático
     - varios → comercial elige al cotizar
   • T-1 fijo: leer tiempo del paso
   • T-2 productividad propia: cantidad / productividad_paso
   • T-3 productividad máquina: cantidad / productividad_perfil
   • T-4 input manual: leer tiempo ingresado por el comercial
   • Sumar setup + run + cleanup + tiempoFijo

d. Calcular MATERIALES consumidos
   • Por cada material declarado del paso
   • Aplicar lógica según tipo de material (papel/rígido/vinilo/etc.)
   • Cantidad × precio (con strategy correspondiente)

e. Calcular CARGOS FLAT
   • Tercerizaciones, viáticos, royalties, costo mínimo

f. Calcular COSTO TOTAL del paso
   • costoCentroCosto = (timing.totalMin / 60) × tarifa
   • costoMateriales  = Σ materiales
   • costoCargosFlat  = Σ flats
   • costoTotal       = suma de los 3 buckets

g. Generar TRAZABILIDAD A-G del paso
   (ver doc 03-catalogo-y-trazabilidad.md §2)

h. Escribir OUTPUTS CANÓNICOS al JobContext
   (ver doc 03-catalogo-y-trazabilidad.md §1)
   → para que pasos siguientes los puedan leer

i. (Solo pasos PRE) MUTAR valores MUTABLES del JobContext
   → Solo pasos `modificacion_pre` ejecutan esta sub-tarea.
   → Pueden modificar medidas físicas (altoMm, anchoMm, m2_pedidos).
   → Pasos siguientes leerán los valores ya modificados.
   → Ej: bolsillo_lona muta altoMm += 200 (margen para bolsillos).
```

**Nota sobre el orden**: los pasos PRE deben ejecutarse ANTES que los pasos de producción que dependen de las medidas modificadas. El orden topológico del DAG garantiza esto (los pasos PRE están conectados como predecesores).

---

## 3. Estructura de la ruta = DAG

La ruta del producto es un **grafo dirigido acíclico**, no una lista lineal.

### Tipos de nodo

| Tipo | Descripción | Comportamiento del motor |
|---|---|---|
| **PASO_SIMPLE** | Ejecuta una familia (ej. `impresion_por_hoja`). | Corre el bucle a-h. |
| **SUB_PRODUCTO** | Es la cotización completa de OTRO producto componente. | Recursiona: cotiza ese producto y agrega su costo como un "paso". |
| **SELECTOR** | Decide entre N ramas alternativas según contexto. | Solo se ejecuta UNA rama (las otras se saltan). |

### Ejemplo visual

```
        [INICIO]
            ↓
     [Diseño] ─ opcional
            ↓
     [Pre-prensa]
            ↓
     [SELECTOR: tirada]
        ↙        ↘
   [Offset]   [Digital]      ← solo una rama se ejecuta
        ↘        ↙
     [Guillotinar]
            ↓
     [SUB-PRODUCTO: Tapa]    ← cotiza otro producto entero
            ↓
     [Encuadernar]
            ↓
     [Embalar]
            ↓
        [FIN]
```

### Orden de ejecución

El motor recorre el DAG en **orden topológico**: garantiza que si un nodo A produce algo que B necesita, A se ejecuta antes que B.

---

## 4. Sub-productos (recursión)

### Definición

Un **sub-producto** es un producto que se compone dentro de otro producto.

Ejemplo: un libro encuadernado típicamente tiene:
- Block (cuerpo del libro)
- Tapa (dura o blanda)

Cada uno es un **producto independiente con su propia ruta**. El libro completo los **compone**.

### Cómo se modela

En la ruta del producto padre, hay un nodo tipo `SUB_PRODUCTO` que apunta al producto componente.

### Cantidad del sub-producto

**Por defecto**: 1:1 con la cantidad del padre. Si pido 100 libros, la tapa se cotiza para 100 unidades.

**Configurable**: el padre puede declarar otra relación. Ej. para 1 caja de packaging necesito 4 cantoneras y 2 separadores.

### Recursión segura

El motor debe **detectar ciclos**:
- Producto A → componente B → componente A → infinito.
- Si se detecta, lanzar `CircularSubProductError`.

---

## 5. Selectores (ramas alternativas)

### Definición

Un **selector** es un nodo que decide entre N ramas. **Solo se ejecuta una rama**.

Ejemplo: producto "Tarjetas de visita" tiene un selector "Tirada" con 2 ramas:
- Tirada baja (< 500): rama Digital láser
- Tirada alta (≥ 500): rama Offset

### Tipos de decisión

| Tipo | Quién decide | Ejemplo |
|---|---|---|
| **AUTOMÁTICO** | Regla del motor evalúa el JobContext | `if jobContext.cantidad >= 500 → Offset` |
| **MANUAL** | El comercial al cotizar (UI le pide elegir) | "¿Querés Latex o UV?" |

Ambos tipos coexisten. La familia del selector declara cuál de los dos modos usa.

### Implementación conceptual

```typescript
class Selector {
  modo: 'AUTOMATICO' | 'MANUAL'
  ramas: { id, condicion?, label }[]
  
  evaluar(jobContext, seleccionesUsuario): ramaElegidaId {
    if (modo === 'AUTOMATICO') {
      // Encontrar primera rama cuya condición se cumpla
      return this.ramas.find(r => r.condicion(jobContext)).id
    } else {
      // Leer del input del usuario
      return seleccionesUsuario.selectorId === this.id
    }
  }
}
```

---

## 6. Manejo de errores

### Principio: cortar inmediato con error claro

Si falla algo crítico durante la ejecución, el motor lanza una **excepción tipada** y para. No devuelve un número erróneo ni completa parcialmente.

### Tipos de error esperados

```typescript
class MissingTarifaError extends Error {
  centroCostoId: string
  centroCostoNombre: string
  periodo: string
}

class MissingMaterialError extends Error {
  materialId: string
  materialNombre: string
}

class MissingMaquinaError extends Error {
  pasoId: string
  pasoNombre: string
}

class InvalidJobContextError extends Error {
  campo: string
  esperado: string
  recibido: any
}

class CircularSubProductError extends Error {
  cadena: string[]   // ej: ['libro', 'tapa', 'libro']
}

class NestingFailedError extends Error {
  pasoId: string
  motivo: string  // ej: "pieza no entra en sustrato"
}
```

### Manejo en el caller

El caller (controller del endpoint) atrapa el error y devuelve HTTP 400 con mensaje claro:

```
HTTP 400 Bad Request
{
  "error": "MissingTarifa",
  "message": "No hay tarifa PUBLICADA para 'Impresión Laser' en el período 2026-04",
  "paso": "Impresión Laser: Color",
  "centroCostoId": "..."
}
```

El frontend muestra el mensaje al comercial para que tome acción (ej. publicar la tarifa).

---

## 7. Motor PURO + caller persiste

### Decisión

El motor es **función pura**:
- Input: parámetros + acceso a DB de lectura
- Output: resultado completo + shape de snapshot listo para persistir
- NO inserta en DB
- NO llama servicios externos

### Quien persiste

El **caller** (el endpoint controller que invoca al motor) decide:
- ¿Es cálculo en pantalla? → no persiste, solo devuelve resultado al frontend.
- ¿Es formalización de cotización? → toma el `snapshotShape` del motor y hace el INSERT.
- ¿Es conversión a orden de trabajo? → toma snapshot existente y crea registro de orden.

### Beneficios

- Motor reutilizable desde varios endpoints.
- Motor testeable sin necesidad de DB.
- Motor independiente del framework (funciona en Nest, en script standalone, en CLI).

---

## 8. Pseudocódigo completo

```typescript
function cotizarPorRuta(input: CotizacionInput, deps: MotorDeps): CotizacionResult {
  // 1. Inicialización
  const producto    = deps.cargarProducto(input.productoServicioId)
  const ruta        = deps.cargarRuta(producto.rutaId)              // DAG
  const jobContext  = inicializarJobContext(input, producto)
  
  // Pre-cargar recursos
  const centrosIds  = ruta.todosLosCentrosCosto()
  const tarifas     = deps.loadTarifasHorarias(centrosIds, input.periodo)
  const materialIds = ruta.todosLosMateriales()
  const precios     = deps.loadPreciosMateriales(materialIds, input.tenantId, input.periodo)
  
  const recursos = { tarifas, precios }
  
  // 2. Iterar nodos del DAG en orden topológico
  const pasosCotizados: PasoCotizado[] = []
  
  for (const nodo of ruta.ordenTopologico()) {
    
    if (nodo.tipo === 'PASO_SIMPLE') {
      const cotizado = ejecutarPasoSimple(nodo, jobContext, recursos)
      if (cotizado) pasosCotizados.push(cotizado)
    }
    
    else if (nodo.tipo === 'SUB_PRODUCTO') {
      // RECURSIÓN
      const cantidadSub = nodo.cantidadEsHeredada
        ? input.cantidad
        : nodo.cantidadConfigurada
      
      const subResult = cotizarPorRuta({
        productoServicioId: nodo.subProductoId,
        cantidad: cantidadSub,
        periodo: input.periodo,
        ...
      }, deps)
      
      pasosCotizados.push(adaptarSubProductoComoPaso(subResult))
    }
    
    else if (nodo.tipo === 'SELECTOR') {
      const ramaElegidaId = nodo.evaluar(jobContext, input.selecciones)
      jobContext.ramasSeleccionadas[nodo.id] = ramaElegidaId
      // Las próximas iteraciones del loop verán esto y skipean ramas no elegidas
    }
  }
  
  // 3. Componer resultado
  const subtotales = {
    centroCosto:    pasosCotizados.reduce((s, p) => s + p.costoCentroCosto, 0),
    materiasPrimas: pasosCotizados.reduce((s, p) => s + p.costoMateriales, 0),
    cargosFlat:     pasosCotizados.reduce((s, p) => s + p.costoFlat, 0),
  }
  const total = subtotales.centroCosto + subtotales.materiasPrimas + subtotales.cargosFlat
  const unitario = total / input.cantidad
  
  return {
    total,
    unitario,
    subtotales,
    pasos: pasosCotizados,
    warnings: jobContext.warnings,
    snapshotShape: construirShapeSnapshot(input, pasosCotizados, total, unitario, jobContext, recursos),
  }
}


function ejecutarPasoSimple(paso, jobContext, recursos) {
  // a. ¿Activo?
  if (!isPasoActivo(paso, jobContext)) return null
  
  // b. Resolver máquina + perfil
  const { maquina, perfil } = resolverMaquinaYPerfil(paso, jobContext)
  
  // c. Tiempo (T-1 / T-2 / T-3 según familia)
  const timing = calcularTiempo(paso, perfil, jobContext)
  
  // d. Materiales
  const materiales = calcularMateriales(paso, jobContext, recursos.precios)
  
  // e. Cargos flat
  const cargosFlat = calcularCargosFlat(paso, jobContext)
  
  // f. Costo
  const tarifa = recursos.tarifas.get(paso.centroCostoId)
  if (!tarifa) {
    throw new MissingTarifaError(paso.centroCostoId, paso.centroCostoNombre, jobContext.periodo)
  }
  
  const costoCentroCosto = calculateOperationCost(timing.totalMin, tarifa)
  const costoMateriales  = materiales.reduce((s, m) => s + m.costoTotal, 0)
  const costoFlat        = cargosFlat.reduce((s, c) => s + c.monto, 0)
  
  // g. Trazabilidad A-G
  const traza = construirTrazabilidad(paso, maquina, perfil, materiales, timing, costoCentroCosto, costoMateriales, costoFlat, jobContext)
  
  // h. Escribir outputs canónicos al JobContext
  escribirOutputsCanonicos(paso, jobContext, materiales, timing)
  
  return {
    paso,
    traza,
    costoCentroCosto,
    costoMateriales,
    costoFlat,
    costoTotal: costoCentroCosto + costoMateriales + costoFlat,
  }
}
```

---

## 9. Resumen del modelo

```
┌─ EL MOTOR POR PASOS ───────────────────────────────────────────────┐
│                                                                     │
│  1. Es función PURA (no persiste, no efectos colaterales).         │
│  2. Recibe un producto + cantidad + selecciones + período.         │
│  3. Carga la ruta como DAG (no lineal).                            │
│  4. Itera nodos en orden topológico:                                │
│     • PASO_SIMPLE → ejecuta a-h                                    │
│     • SUB_PRODUCTO → recursiona                                    │
│     • SELECTOR → decide rama                                       │
│  5. Cada paso simple resuelve: activación, máquina, tiempo,        │
│     materiales, cargos flat, costo, trazabilidad, outputs.         │
│  6. Si algo falla, lanza error tipado (no completa parcial).       │
│  7. Devuelve resultado completo + shape de snapshot.               │
│  8. El caller decide si persiste el snapshot.                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. Próximos pasos

1. **Fase D — Resoluciones por paso** (próxima): mapear exhaustivamente las decisiones que cada paso resuelve al ejecutar:
   - ¿Cómo elige la máquina si hay alternativas?
   - ¿Cómo elige el perfil?
   - ¿Cómo resuelve el material si hay variantes?
   - ¿Qué inputs lee del JobContext y cómo los valida?
   - ¿Qué warnings genera?
   - Etc.

2. **Fase E — Validación con casos reales**: ejecutar el modelo en papel sobre 3-5 productos.

3. **Fase F — Gap analysis**: estado actual vs modelo futuro.

4. **Fase G — Roadmap revisado** de extracciones, ahora informado por todo el modelo.
