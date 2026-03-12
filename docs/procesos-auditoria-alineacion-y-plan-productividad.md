# Auditoria de Alineacion - Modulo Procesos

Fecha: 2026-03-11

## 1) Objetivo de esta auditoria

Verificar si la implementacion actual de `Procesos` cumple al 100% lo definido en:

- `docs/procesos-functional-analysis.md`
- `docs/procesos-implementation-plan.md`
- `docs/procesos-template-functional-catalog.md`

Y definir un plan cerrado para que `Modo productividad` (`fija|formula|tabla`) quede funcional al 100%.

---

## 2) Estado de cumplimiento (documentacion vs implementacion)

### Cumple

1. CRUD de procesos por tenant y route en sidebar de `Costos`.
2. Versionado basico con `currentVersion` + historial en `ProcesoVersion`.
3. Tipos de proceso `maquinaria|manual|mixto`.
4. Proceso manual sin maquina/perfil (validado en backend).
5. Centro autocompletado por centro principal de maquina si falta.
6. Warning por mismatch maquina-centro (no bloqueo).
7. Unidades operativas en enum canonico (no texto libre).
8. Codigo de proceso y codigos de operacion generados por sistema.
9. Endpoint de snapshot tecnico por periodo y endpoint de versiones.

### Parcial

1. `Modo productividad` existe en datos/UI, pero no existe motor real:
   - El calculo usa `runMin` persistido, sin interpretar `modoProductividad`.
   - `reglaVelocidadJson` y `reglaMermaJson` se guardan, pero no se ejecutan.
2. Integracion con `Costos`:
   - Se toma tarifa `PUBLICADA` del periodo.
   - Falta snapshot persistido de evaluacion (hoy la respuesta es en memoria).
3. Catalogo de plantillas de proceso:
   - Hay base por plantilla de maquinaria.
   - Falta completar familias/variantes como en catalogo funcional (muchas solo tienen una base simplificada).

### Pendiente / Huecos

1. Vista UI de costo tecnico por operacion y total dentro del flujo de edicion/listado.
2. Pruebas de servicio/integracion de `Procesos` (hoy no hay suite del modulo).
3. Validacion explicita de consistencia entre unidad del centro y unidad de la operacion.
4. Regla completa de costo tecnico (insumos/desgaste/tercerizado): hoy solo `costoTiempo`.
5. Contrato tecnico robusto para `Cotizacion` con entradas de contexto (cantidad, variables de producto/configuracion).

---

## 3) Relacion del modulo Procesos con otros modulos

## Costos (actual)

- `Procesos` depende de `CentroCosto` para calcular `costoTiempo` con tarifa `PUBLICADA` por periodo.
- Si no hay tarifa publicada, se generan advertencias y el resultado no valida para cotizar.
- Falta cerrar mapeo formal `unidadBaseFutura` del centro vs `unidadSalida/unidadTiempo` de operacion.

## Maquinaria (actual)

- Operacion puede vincular `maquinaId` y `perfilOperativoId`.
- En procesos de `maquinaria`, se valida que la maquina coincida con la plantilla del proceso.
- Falta explotar datos de maquinaria en costo tecnico (consumibles, desgaste, factores reales de perfil).

## Productos y servicios (futuro inmediato)

- `ProductoServicio` debera referenciar una o mas `ProcesoDefinicion` habilitadas.
- La cotizacion debera invocar evaluacion tecnica de proceso con contexto del producto:
  - cantidad
  - material
  - calidad/modo
  - terminaciones opcionales
- El resultado tecnico de `Procesos` sera el costo base a partir del cual se aplican reglas comerciales.

## Produccion / Shop Floor / BI (futuro)

- `Procesos` sera la ruta versionada de referencia para ordenes.
- Produccion capturara real vs estimado por operacion.
- BI explotara desvio de tiempos, merma y costo.

---

## 4) Brechas criticas priorizadas

## P0 (bloquea “100% documentacion”)

1. No existe motor de productividad para `fija|formula|tabla`.
2. `snapshot-costo` no calcula `run` por reglas; solo usa `runMin` manual.
3. No hay pruebas del modulo `Procesos`.

## P1 (alto impacto)

1. No hay UI de evaluacion tecnica por operacion/total integrada al panel.
2. Falta validacion formal unidad centro vs unidad operacion.
3. No hay persistencia de snapshot evaluado para auditoria comercial.

## P2 (iteracion siguiente)

1. Falta costo de insumos/desgaste/tercerizado por operacion.
2. Falta completar variantes avanzadas de plantillas de proceso del catalogo.

---

## 5) Especificacion funcional cerrada para Modo productividad (100%)

## 5.1 Regla general de calculo de run

Por operacion:

1. `cantidadObjetivoSalida` (input de evaluacion).
2. `cantidadRun`:
   - `cantidadObjetivoSalida * (1 + mermaRunPct/100)`
   - `+ mermaSetup` (si aplica y en la unidad definida para setup).
3. `productividadOperativa` segun `modoProductividad`.
4. `runMin = cantidadRun / productividadOperativa`, convertido a minutos segun `unidadTiempo`.

Total de tiempo:

`totalMin = setupMin + runMin + cleanupMin + tiempoFijoMin`

Costo tiempo:

`costoTiempo = (totalMin / 60) * tarifaCentroPublicada(periodo)`

## 5.2 Modo `fija`

- Requiere `productividadBase > 0`.
- `productividadOperativa = productividadBase`.
- `reglaVelocidadJson` opcional (solo metadatos, no obligatoria).

## 5.3 Modo `formula`

- Requiere `productividadBase > 0`.
- Requiere `reglaVelocidadJson` con esquema `formula_v1`.
- No se permite `eval` libre; se usa DSL/AST validado.

Contrato propuesto (`reglaVelocidadJson`):

```json
{
  "tipo": "formula_v1",
  "expresion": {
    "op": "mul",
    "args": [
      { "var": "PB" },
      { "var": "factor_material" },
      { "var": "factor_calidad" }
    ]
  },
  "variables": {
    "factor_material": { "source": "context", "key": "material.factor", "default": 1 },
    "factor_calidad": { "source": "context", "key": "calidad.factor", "default": 1 }
  },
  "bounds": { "min": 0.0001, "max": 100000 }
}
```

## 5.4 Modo `tabla`

- Requiere `reglaVelocidadJson` con esquema `tabla_v1`.
- Permite buscar productividad por rangos y atributos.
- Debe tener fallback (`productividadBase` o valor fijo) para no romper evaluacion.

Contrato propuesto (`reglaVelocidadJson`):

```json
{
  "tipo": "tabla_v1",
  "ejes": [
    { "key": "tirada", "type": "number_range" },
    { "key": "calidad", "type": "enum" }
  ],
  "filas": [
    { "tirada": { "min": 1, "max": 100 }, "calidad": "alta", "productividad": 80 },
    { "tirada": { "min": 101, "max": 1000 }, "calidad": "alta", "productividad": 140 }
  ],
  "fallback": { "type": "productividad_base" }
}
```

## 5.5 Regla de merma

`reglaMermaJson` opcional con misma idea (`formula_v1` o `tabla_v1`) para ajustar merma dinamica segun contexto.
Si no existe, usa `mermaSetup` y `mermaRunPct` fijos.

---

## 6) Plan de implementacion tecnico (cerrado)

## Fase A - Contrato de datos y validacion

1. Definir JSON schemas versionados:
   - `reglaVelocidadJson`: `formula_v1 | tabla_v1`
   - `reglaMermaJson`: `formula_v1 | tabla_v1`
2. Validar por modo en backend:
   - `fija`: `productividadBase` obligatoria
   - `formula`: regla formula valida obligatoria
   - `tabla`: regla tabla valida obligatoria
3. Agregar validacion de compatibilidad unidad centro vs operacion.

## Fase B - Motor de productividad

1. Crear servicio puro `ProcesoProductividadEngine` con:
   - `computeProductividadOperativa(...)`
   - `computeRunMin(...)`
   - `computeMerma(...)`
2. Soportar fuentes de variable:
   - `productividadBase`
   - contexto de evaluacion
   - metadatos de maquina/perfil (cuando aplique)
3. Asegurar fallback deterministico y mensajes de advertencia.

## Fase C - Evaluacion tecnica para cotizacion

1. Nuevo endpoint recomendado:
   - `POST /procesos/:id/evaluar-costo`
2. Input minimo:
   - `periodo`
   - `cantidadObjetivo`
   - `contexto` (material, calidad, extras)
3. Output:
   - detalle por operacion (setup/run/cleanup, productividad aplicada, merma aplicada)
   - costo tiempo por operacion + total
   - advertencias
   - `validaParaCotizar`
4. `snapshot-costo` actual se mantiene como wrapper legacy o modo simplificado.

## Fase D - UI

1. En operacion, hacer UI condicional por `Modo productividad`:
   - `fija`: input simple
   - `formula`: builder de formula (variables + preview)
   - `tabla`: editor de filas/rangos
2. Agregar simulador en panel:
   - cantidad + contexto
   - previsualizacion de `runMin`, merma y costo por operacion
3. Agregar tab “Costo tecnico” en `Procesos`.

## Fase E - Pruebas

1. Unit tests del motor:
   - `fija`, `formula`, `tabla`
   - fallbacks
   - redondeos
2. Tests de servicio:
   - validaciones cruzadas
   - sin tarifa publicada
   - unidad incompatible
3. E2E basico del flujo crear proceso -> evaluar costo.

---

## 7) Criterios de aceptacion para dar “100% alineado”

1. `modoProductividad` impacta efectivamente el `runMin` calculado.
2. `formula` y `tabla` se validan y ejecutan sin logica ad-hoc en frontend.
3. Se expone costo tecnico por operacion y total en UI.
4. Existe validacion unidad centro vs unidad operacion.
5. El contrato de evaluacion es consumible por `Productos y servicios` sin recalculo duplicado.
6. Existen pruebas automaticas del modulo `Procesos`.

---

## 8) Decision recomendada inmediata

Ejecutar primero P0 completo (motor + validaciones + pruebas base) antes de seguir ampliando templates o costo de insumos/desgaste.
Sin eso, `Procesos` sigue almacenando campos correctos pero sin comportamiento tecnico completo.
