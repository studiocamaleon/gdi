# Ruta de producción como entidad reusable

> **Sub-tema transversal** del análisis del motor por pasos.
> **Sesión**: 2026-04-24. **Estado**: ✅ CERRADO (10 decisiones).
> **Disparador**: pregunta del usuario en D.7 sobre dónde viven las validaciones del modelado y reuso de rutas entre productos.
> **Impacto**: cambia el modelado en Fase A, C, D. Habilita el caso "rutas alternativas" del feedback original.

## Propósito

Decidir cómo se modela el **proceso productivo** de un producto en el sistema:
- ¿Cada producto declara su ruta inline o referencia una entidad reusable?
- ¿Qué declara la ruta y qué declara el producto?
- ¿Un producto puede tener múltiples rutas alternativas?
- ¿Cómo se versiona la ruta? ¿Cómo se snapshotea en cotizaciones?

---

## 1. Reparto en 3 capas

```
┌─ FAMILIA (catálogo del SISTEMA, hardcodeado) ───────────────────────┐
│   Editado por: equipo de producto (vos / yo).                        │
│   Declara:                                                           │
│   • Tipo (M-0 / M-1 / M-2)                                           │
│   • Tipos de tiempo soportados (T-1..T-4)                            │
│   • Mecanismos de cantidad soportados (DIRECT / HEREDAR / etc.)      │
│   • Modos de activación soportados                                   │
│   • Slots requeridos (codigo, tipo, requerido)                       │
│   • Multiplicadores soportados (caras, tipoCopia, etc.)              │
│   • Outputs canónicos que escribe                                    │
│   • Inputs que necesita del JobContext                               │
│   NO se toca por tenant.                                              │
└──────────────────────────────────────────────────────────────────────┘

┌─ RUTA DE PRODUCCIÓN (entidad reusable del TENANT) ──────────────────┐
│   Editado por: modelador del tenant (admin).                         │
│   Declara:                                                           │
│   • Lista ORDENADA de pasos                                          │
│   • Cada paso = referencia a familia                                 │
│   ESO ES TODO. La ruta es ESQUELETO MÍNIMO.                          │
│   No declara modos, máquinas, materiales — los deja al producto.    │
│   Reusable por N productos.                                          │
└──────────────────────────────────────────────────────────────────────┘

┌─ PRODUCTO (entidad comercial del TENANT) ───────────────────────────┐
│   Editado por: modelador del tenant (admin).                         │
│   Declara:                                                           │
│   • REFERENCIA a 1 o N rutas alternativas                           │
│   • Para cada paso de la(s) ruta(s):                                 │
│       - Modo de activación elegido (cuando familia soporta varios)  │
│       - Mecanismo de cantidad elegido                                │
│       - Modo de tiempo elegido                                       │
│       - Multiplicadores activos                                      │
│       - Materiales concretos en cada slot (ver D.5)                  │
│       - Máquina específica (M-1) o candidatas (M-2)                  │
│       - Cargos directos pre-declarados (D.6)                         │
│   • Pasos extras puntuales (opcional, inline al producto)           │
│   • Atributos comerciales (nombre, precio, imagen, descripción)     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Diagrama de relaciones

```
                   FAMILIA (catálogo sistema, hardcoded)
                     │ N
                     │ "es referenciada por"
                     ↓ N
             PASO DE RUTA  ←─────────────  RUTA (entidad tenant)
                                                │ N
                                                │ "es referenciada por"
                                                ↓ N
                                          PRODUCTO (entidad tenant)
                                                │ 1
                                                │ "tiene"
                                                ↓ N
                                       PASOS EXTRAS (inline)


                                          PRODUCTO
                                              │ 1
                                              │ "configura"
                                              ↓ N (1 por paso de la ruta)
                                       CONFIG DE PASO
                                       (modos + slots llenos)
```

---

## 3. Rutas alternativas (1 producto = N rutas)

Un producto puede declarar **múltiples rutas alternativas** para producir lo mismo. El comercial elige al cotizar (o el motor propone una con regla automática + override).

```
Producto "Tarjetas de Visita"
  ├── Ruta alternativa "Vía láser"   (3 pasos)
  ├── Ruta alternativa "Vía offset"  (4 pasos)  ← preferida
  └── Regla auto-selección (opcional, JsonLogic):
         si tirada > 1000 → "Vía offset"
         sino             → "Vía láser"
```

### Selección al cotizar (modelo híbrido)

1. Motor evalúa la regla auto-selección contra el JobContext.
2. Si la regla devuelve una ruta válida → propuesta default.
3. Si no hay regla o no resuelve → usa la marcada "preferida".
4. Comercial ve la propuesta + las otras opciones, puede cambiar (override).

Coherente con D.2 (perfiles de máquina con regla auto + override manual del comercial).

### Habilitación del caso "gap routings alternativos"

Esto resuelve el gap identificado en el feedback original del experto: "tarjetas láser corta tirada vs. offset digital tirada larga = 2 rutas distintas, mismo producto".

---

## 4. Override del producto sobre la ruta heredada

El producto puede **agregar pasos extras puntuales** que la ruta no contempla.

```
Ruta "Cartelería estructural" = [pre-prensa, impresión vinilo, soldadura,
                                  ensamble estructural, instalación in situ]

Producto "Cartel iluminado Bar Pepe"
  ├── Usa ruta "Cartelería estructural"
  ├── Configura cada paso de la ruta (materiales, máquinas, modos)
  └── Agrega paso extra puntual: "instalación eléctrica luminoso"
        (este paso vive INLINE en el producto, no es reusable)
```

**Reglas**:
- El producto puede AGREGAR pasos extras (entre cualquier 2 pasos de la ruta o al final).
- El producto NO puede saltear pasos opcionales de la ruta — para eso, otra ruta o ruta alternativa.
- Pasos extras son **inline al producto**, no reusables. Si algo se repite mucho, se promueve a la ruta.

---

## 5. Productos con flujo único (no reusable)

Decisión: la ruta SIEMPRE es entidad separada en DB. **NO existen rutas inline en productos.**

### UX combinada (sin fricción para casos únicos)

En la UI de "Crear producto", el modelador puede:

```
┌─ Crear Producto ────────────────────────────────────────────────────┐
│   Nombre: [Cartel iluminado Bar Pepe          ]                      │
│   Ruta de producción:                                                │
│     ○ Elegir ruta existente: [seleccionar...   ▼]                    │
│     ● Crear ruta nueva ad-hoc:                                       │
│         Nombre ruta: [Cartelería iluminada custom                ]   │
│         Pasos:                                                       │
│           1. [pre-prensa            ▼] (familia)                    │
│           2. [impresión por área    ▼]                              │
│           3. [corte láser           ▼]                              │
│           4. [soldadura             ▼]                              │
│           5. [instalación eléctrica ▼]                              │
│           6. [instalación in situ   ▼]                              │
│           [+ Agregar paso]                                          │
│   [...resto de configuración del producto...]                        │
└──────────────────────────────────────────────────────────────────────┘
```

Internamente, al guardar, el sistema crea **2 entidades en DB**: la ruta + el producto. Para el modelador es 1 sola pantalla.

**Ventaja**: modelo de datos uniforme (siempre 1 ruta como entidad), UX sin fricción.

---

## 6. Versionado de rutas (opt-in con heurística)

### Cómo funciona

Cuando el modelador edita una ruta y guarda:

```
┌─ Guardar cambios en ruta ───────────────────────────────────────────┐
│                                                                      │
│   Cambios detectados:                                                │
│   • Agregaste paso "proof" entre "pre-prensa" e "impresión"         │
│                                                                      │
│   ⚠ Cambio estructural detectado (afecta cálculos)                   │
│   Sugerencia: NUEVA VERSIÓN                                          │
│                                                                      │
│   ○ Patch in-place (productos heredan al instante)                   │
│   ● Nueva versión (productos siguen en versión anterior hasta        │
│                    decidir migrar)                                    │
│                                                                      │
│   [Cancelar]  [Guardar]                                              │
└──────────────────────────────────────────────────────────────────────┘
```

### Heurística de sugerencia default

| Tipo de cambio | Sugerencia automática |
|---|---|
| Cambio en nombre, descripción, ícono, tags | **Patch in-place** |
| Agregar paso | **Nueva versión** |
| Quitar paso | **Nueva versión** |
| Cambiar familia de un paso | **Nueva versión** |
| Cambiar orden de pasos | **Nueva versión** |

El modelador puede ignorar la sugerencia y elegir lo otro. Pre-aviso si hace patch in-place de un cambio estructural.

### Migración de productos a versión nueva

Productos no se mueven automáticamente. Cuando el modelador entra a un producto, ve aviso: "Tu ruta tiene v(N+1) disponible (cambios: X). ¿Actualizar?". Decide producto por producto.

---

## 7. Snapshots en cotizaciones

Cuando una cotización formal se cierra, se guarda **snapshot completo** (consistente con decisión previa de Fase A):

- Snapshot de la **ruta** (versión usada, lista de pasos en orden con sus familias).
- Snapshot del **producto** (configuración de modos, materiales, máquinas).
- Snapshot de los **valores calculados** (tiempos, costos, totales).
- Snapshot de los **cargos directos** aplicados (paso y cotización).
- Snapshot de la **ruta alternativa elegida** (si el producto tenía varias).
- Snapshot de los **pasos extras** del producto (si tenía).

Al re-abrir o re-imprimir la cotización meses después, todo aparece exactamente como en el momento de cierre, aunque la ruta/producto/materiales hayan cambiado en el catálogo.

Trazabilidad histórica máxima.

---

## 8. Resumen de las 10 decisiones

| # | Decisión | Detalle |
|---|---|---|
| 1 | Modelo en 3 capas | Familia (sistema) / Ruta (esqueleto) / Producto (configuración) |
| 2 | Ruta = familias + orden | Esqueleto mínimo, máximo reuso |
| 3 | Producto cierra modos | Activación, cantidad, tiempo, multiplicadores |
| 4 | Producto declara concretos | Materiales, máquinas, cargos directos, atributos comerciales |
| 5 | 1 producto = N rutas alternativas | Comercial elige al cotizar |
| 6 | Selección rutas alt. | Híbrido: regla auto + override comercial |
| 7 | Producto puede agregar pasos extras | Inline al producto, no reusables |
| 8 | Ruta siempre entidad separada en DB | Sin "ruta inline en producto"; UX combinada al crear |
| 9 | Versionado opt-in con heurística | Modelador decide patch vs nueva versión, sistema sugiere |
| 10 | Snapshots completos en cotización formal | Ruta + producto + materiales + valores + cargos |

---

## 9. Implicaciones para otros sub-temas

### Para D.7 (validaciones del motor)

Las validaciones de **conectividad de pasos** (output de N → input de N+1) ahora se chequean al **guardar la RUTA** (Journey 1 nuevo: editar ruta), no en cada producto. Las validaciones de **slots requeridos sin material** se chequean al **guardar el PRODUCTO** (Journey 1 viejo). El motor mantiene chequeo defensivo en runtime (Tipo C).

### Para Fase A (catálogo de familias)

Sin cambios — la familia sigue siendo la unidad de catálogo. Ahora la familia se referencia desde la RUTA, no directo desde el producto.

### Para Fase C (modelo conceptual del motor)

El motor recibe como input:
- Producto (con configuración de modos + materiales + máquinas)
- Ruta seleccionada (de las alternativas del producto, vía regla auto u override del comercial)
- Pasos extras del producto (si tiene)
- JobContext (cantidad, medidas, opcionales activados, etc.)

Y construye el DAG con: pasos de la ruta seleccionada (en orden) + pasos extras del producto (donde corresponda).

### Para Fase E (validación con casos reales)

Al walkear los 3 productos representativos, validar:
- ¿Cuáles realmente comparten ruta?
- ¿Cuáles tienen rutas alternativas y cuántas?
- ¿Cuáles necesitan pasos extras inline?
- ¿La heurística de versionado captura los casos típicos?

---

## 10. Lo que NO está cerrado en este sub-tema

- **Rutas globales del sistema** (plantillas pre-armadas que el sistema provee a tenants nuevos): no se decidió. Por ahora, cada tenant arma sus rutas desde cero. Si se incorpora después, sería una "biblioteca de rutas" global referenciable.
- **Migración de productos legacy** (los que ya existen sin ruta): se aborda cuando se planifique la implementación técnica.
- **UI detallada del versionado**: la propuesta del modal es ilustrativa. Diseño UX real va en el plan técnico.
