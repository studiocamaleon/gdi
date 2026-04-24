# Análisis del Tab Precio — qué se preserva en el Big Bang

> **Fase F** — Análisis previo a la implementación.
> **Sesión**: 2026-04-24. **Objetivo**: identificar qué EXACTAMENTE del módulo "Tab Precio" se preserva intacto en el Big Bang del modelo universal.

## TL;DR

El Tab Precio es un **módulo limpio y aislado del motor de costo**. Recibe COSTO como input y aplica capa comercial encima. Se preserva al 100% sin cambios. El único punto de integración con el motor universal nuevo es: el motor expone "costo total" o "costo por unidad comercial" → Tab Precio lo consume.

## Componentes que se preservan

### Frontend (UI)

| Archivo | LOC | Qué hace |
|---|---|---|
| `src/components/productos-servicios/producto-precio-tab.tsx` | 1522 | UI principal: editor de método de cálculo, impuestos, comisiones, precios especiales por cliente |
| `src/components/productos-servicios/producto-comercial.helpers.ts` | 319 | Helpers: builders, normalización de unidad, formatters, labels |
| `src/components/productos-servicios/productos-servicios-impuestos-manager.tsx` | (verificar) | CRUD del catálogo de esquemas de impuestos del tenant |

### Lógica comercial (encapsulada en el frontend)

- **7 métodos de cálculo de precio**:
  - `margen_variable` — cantidad libre con tramos de margen
  - `por_margen` — precio = costo × (1 + margen) margen fijo
  - `precio_fijo` — precio definido manualmente
  - `fijado_por_cantidad` — cantidades específicas con precio fijo
  - `fijo_con_margen_variable` — cantidades específicas con margen variable
  - `variable_por_cantidad` — rangos de cantidad con precio fijo
  - `precio_fijo_para_margen_minimo` — precio fijo + cuida margen mínimo
- **Impuestos**: esquemas reusables del tenant, items con porcentaje, aplicados sobre precio neto.
- **Comisiones**: 2 tipos (financiera, vendedor), esquemas reusables del tenant.
- **Precios especiales por cliente**: override del standard por cliente (cada cliente puede tener su propia config con cualquiera de los 7 métodos).
- **Unidad comercial**: `unidad` / `m2` / `metro_lineal` — define cómo se cobra.

### Backend (Schema Prisma + endpoints)

Entidades a preservar (relevantes al Tab Precio):

| Entidad / Tipo | Naturaleza |
|---|---|
| `ProductoPrecioConfig` | Embebido en `ProductoServicio` (campo JSON con método + detalle) |
| `ProductoPrecioEspecialCliente[]` | Lista de overrides por cliente |
| `ProductoComisionCatalogo` | Tabla del tenant (esquemas reusables) |
| `ProductoImpuestoCatalogo` | Tabla del tenant (esquemas reusables) |
| Enum `MetodoCalculoPrecioProducto` | Hardcoded en lib |
| Enum `UnidadComercialProducto` | Hardcoded en lib |

Endpoints a preservar:

- `updateProductoPrecio(productoId, precioConfig)`
- `updateProductoPrecioEspecialClientes(productoId, lista)`
- `createProductoComision(comisionData)` / `updateProductoComision(id, data)`
- `updateProductoImpuesto(id, data)`

## Punto de integración con el motor universal

```
┌─ MOTOR UNIVERSAL POR PASOS (NUEVO) ─────────────────────────────────┐
│                                                                      │
│   Recibe: producto + ruta + JobContext                               │
│   Calcula: tiempo + materiales + cargos directos                     │
│   Devuelve: COSTO TOTAL + COSTO POR UNIDAD COMERCIAL                 │
│             + trazabilidad (buckets a-g)                             │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
                        costo: number
                              ↓
┌─ TAB PRECIO (PRESERVADO) ───────────────────────────────────────────┐
│                                                                      │
│   Recibe: costo + producto.precioConfig + cliente (opcional)         │
│   Aplica: método de cálculo de precio                                │
│           + impuestos                                                │
│           + comisiones                                               │
│           + override de cliente (si aplica)                          │
│   Devuelve: precio neto / precio bruto / desglose para vista         │
└──────────────────────────────────────────────────────────────────────┘
```

**Lo único que cambia** entre el sistema viejo y el nuevo desde la perspectiva del Tab Precio: la **fuente del COSTO**. Antes venía de los 5 motores legacy (con sus propios contratos), ahora viene del motor universal con un contrato uniforme.

## Riesgo y mitigación

| Riesgo | Mitigación |
|---|---|
| El motor universal devuelve costo en estructura distinta (ej: por capa, por paso) y el Tab Precio espera 1 número | El motor expone helper `getCostoComercial(unidadComercial)` que normaliza a 1 número (total o por unidad según `unidadComercial` del producto). Tab Precio lo consume sin saber el detalle. |
| Cambian los enums `MetodoCalculoPrecioProducto` o `UnidadComercialProducto` durante la implementación del motor | Los enums viven en `@/lib/productos-servicios` y SE PRESERVAN literal. Si necesitamos agregar valores, se agregan sin romper. |
| El schema de `ProductoPrecioConfig` necesita migrar | NO debería — no depende del motor. Pero si aparece, se hace migración Prisma normal. |

## Veredicto

✅ **Tab Precio se preserva al 100% sin cambios**. El Big Bang del motor de costo NO toca este módulo. La única integración es el flujo `motor → costo → tab precio` que es 1 número.

**Esto es buena noticia para el Big Bang**: el ~40% del flujo comercial del producto (lo que viene después del cálculo de costo) ya está hecho y validado. Solo hay que rehacer el cálculo de costo + UI de catálogo (productos, rutas, máquinas, materiales).
