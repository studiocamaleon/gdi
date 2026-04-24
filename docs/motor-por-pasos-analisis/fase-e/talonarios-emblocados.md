# Validación Fase E — Producto: Talonarios

> **Fase E** — Validación con casos reales. Producto #3.
> **Sesión**: 2026-04-24. **Tenant referente**: Corporearte.
> **Método**: Q&A interactivo + lectura del código actual + reuso de `docs/validacion-negocio-2026-04/talonarios-emblocados-event-storming.md`.

## 1. Journey narrativo (palabras del dueño)

> "Los talonarios por lo general tienen tamaños estandar (pero igual pueden pedir cotización por alguna medida en particular). Ahí la pregunta siempre es: si es duplicado o triplicado y qué tipo de papel: papel común obra o papel químico autocopiativo. Por lo general se imprime en un tamaño de página 22x34 (pero esto puede variar según la empresa) y hay que calcular según el tamaño cuántas poses entran en el tamaño de pliego para saber cómo se va a imprimir. Quizás por ej: 2 talonarios por hoja.
>
> Algunos talonarios pueden ser encolados o pueden ser abrochados (con broches) y puntillado (para poder sacar el original por ej).
>
> Lo típico es venderlo en 'múltiplos' de la cantidad de poses que salgan en el pliego, es decir, si entran dos poses por pliego, se venden en múltiplos de dos."

## 2. Modelo de hojas / copias / poses

Conceptos clave (validados con código actual `talonario-grouping.ts`):

```
Inputs del trabajo:
  • numerosXTalonario       → hojas por talonario (ej: 50, 100, 200)
  • tipoCopia               → 1 (simple), 2 (duplicado), 3 (triplicado)
  • cantidadTalonarios      → cuántos talonarios pedidos
  • modoTalonarioIncompleto → "aprovechar_pliego" | "pose_completa"
                              (decisión del MODELADOR del producto)

Calculados por pre_prensa:
  • posesXPliego            → cuántos talonarios entran en un pliego (nesting)
  • talonariosPorGrupo      → = posesXPliego (se imprimen en grupos de N)
  • talonariosEfectivos     → cuántos se producen realmente
                              (puede > cantidadTalonarios en modo "pose_completa")
  • pliegosXCapa            → pliegos necesarios para una capa (= numerosXTalonario × grupos)
  • pliegosDesperdicio      → pliegos con poses vacías

Total pliegos impresos = pliegosXCapa × tipoCopia
```

**Material por capa** (cada capa = 1 hoja del talonario):

| Capa | Material típico | Cuándo se usa |
|---|---|---|
| 1 (original) | CB (carbon back) o Papel obra | SIEMPRE |
| 2 (copia 1) | CFB (carbon front+back) o Papel obra blanco | Si `tipoCopia >= 2` |
| 3 (copia 2) | CF (carbon front) o Papel obra de color | Si `tipoCopia == 3` |

## 3. Mapeo a familias del catálogo

| # | Paso real | Familia | Activación |
|---|---|---|---|
| 1 | Diseño | `diseno_grafico` | OPCIONAL |
| 2 | Pre-prensa (imposición + grouping de poses) | `pre_prensa` | OBLIGATORIO |
| 3 | Impresión hoja capa 1 (original) | `impresion_por_hoja` | OBLIGATORIO |
| 4 | Impresión hoja capa 2 (copia 1) | `impresion_por_hoja` | CONDICIONAL `tipoCopia >= 2` |
| 5 | Impresión hoja capa 3 (copia 2) | `impresion_por_hoja` | CONDICIONAL `tipoCopia >= 3` |
| 6 | Numeración | `modificacion_post` sub-tipo `numeracion` | OPCIONAL |
| 7 | Compaginado (ordenar hojas en multi-copia) | `conteo_manual` o `operacion_manual` | OBLIGATORIO si `tipoCopia > 1` |
| 8 | Engomado / emblocado | `engomado_emblocado` | Ruta "Emblocado" |
| 9 | Engrapado lateral | `encuadernado_engrapado` | Ruta "Abrochado" |
| 10 | Puntillado / perforado | `modificacion_post` sub-tipo `perforacion` | OPCIONAL |
| 11 | Corte guillotina | `corte_guillotina` | OBLIGATORIO |
| 12 | Embalaje | `embalaje` | OBLIGATORIO |

**Cobertura familias**: 12/12 ✅. Todas existen.

## 4. Rutas alternativas (decidido en sesión)

Producto **"Talonario"** declara **2 rutas alternativas**:

```
Producto "Talonario"
  ├── Ruta "Emblocado"  (con paso 8: engomado_emblocado)
  └── Ruta "Abrochado"  (con paso 9: encuadernado_engrapado)
```

Comercial elige al cotizar. Resuelve emblocado vs abrochado sin duplicar productos.

## 5. Configuración por paso

### Paso 2 — Pre-prensa
- **Activación**: OBLIGATORIO.
- **`paramsPaso`** (JSON libre, configurado por modelador):
  - `modoTalonarioIncompleto: "aprovechar_pliego" | "pose_completa"` (decisión fija del producto)
- **Outputs canónicos al JobContext**:
  - `posesXPliego`
  - `talonariosEfectivos`
  - `pliegosXCapa`
  - `pliegosDesperdicio`

### Paso 3 — Impresión capa 1
- **Activación**: OBLIGATORIO.
- **Materiales**: slot `sustrato_principal` con material capa 1 (CB / Papel obra).
- **Cantidad**: B - HEREDAR_DEL_OUTPUT_CANONICO (lee `pliegosXCapa` de pre_prensa).

### Paso 4 — Impresión capa 2
- **Activación**: CONDICIONAL `tipoCopia >= 2` (regla JsonLogic).
- **Materiales**: slot `sustrato_principal` con material capa 2 (CFB / Papel obra blanco).
- **Cantidad**: B - HEREDAR_DEL_OUTPUT_CANONICO (lee `pliegosXCapa`).

### Paso 5 — Impresión capa 3
- **Activación**: CONDICIONAL `tipoCopia >= 3`.
- **Materiales**: slot `sustrato_principal` con material capa 3 (CF / Papel obra color).
- **Cantidad**: B - HEREDAR_DEL_OUTPUT_CANONICO.

### Paso 6 — Numeración
- **Activación**: OPCIONAL.
- **Familia**: `modificacion_post` sub-tipo `numeracion`.
- **`paramsPaso`**:
  - `formato: "numerico" | "alfanumerico"`
  - `digitos: number`
  - `inicioEn: number`

### Paso 7 — Compaginado
- **Activación**: CONDICIONAL `tipoCopia > 1`.
- **Tiempo**: T-2 (talonarios/h).

### Paso 8 — Engomado/emblocado (en Ruta "Emblocado")
- **Activación**: OBLIGATORIO.
- **Materiales**: slots opcionales:
  - `carton_base` (opcional)
  - `hoja_blanca_superior` (opcional)
  - `tapa_cartulina` (opcional, modelado como material complejo según H17)

### Paso 9 — Engrapado (en Ruta "Abrochado")
- **Activación**: OBLIGATORIO en esta ruta.

### Pasos 10-12 — sin particularidades vs otros productos.

## 6. Inputs del JobContext

```typescript
{
  productoId: "talonarios",

  // Cantidades
  cantidad: number,                    // talonarios pedidos
  numerosXTalonario: number,           // hojas por talonario
  tipoCopia: 1 | 2 | 3,                // simple/duplicado/triplicado

  // Medidas (si modoMedidas = COMERCIAL_ELIGE — gap H4)
  modoMedidas: "FIJA" | "LIBRE",
  medidaCustomMm?: { ancho: number, alto: number },

  // Selección de ruta alternativa
  rutaSeleccionada: "Emblocado" | "Abrochado",

  // Opcionales activados
  opcionalesActivados: {
    paso_diseno: boolean,
    paso_numeracion: boolean,
    paso_puntillado: boolean
  },

  // Configuración de pasos opcionales
  configPaso_numeracion: {
    formato: "numerico" | "alfanumerico",
    digitos: number,
    inicioEn: number
  },
  configPaso_engomado_emblocado: {
    incluirCartonBase: boolean,
    incluirHojaBlanca: boolean,
    incluirTapaCartulina: boolean
  }
}
```

## 7. Hallazgos y validaciones

### 🟢 Validaciones confirmadas

| ID | Validación | Cómo cubre |
|---|---|---|
| **H14** | Multi-copia con pasos CONDICIONAL en la ruta (1 paso impresión por capa, condicional según tipoCopia) | D.1 ✅ |
| **H15** | Material distinto por capa (CB / CFB / CF) | Cada paso de impresión declara su slot con material concreto. D.5 ✅ |
| **H16** | Numeración como `modificacion_post` sub-tipo `numeracion` | Catálogo ✅ |
| **H17** | Tapa de talonario = MATERIAL OPCIONAL del paso `engomado_emblocado` (no sub-producto) | D.5 con slots opcionales ✅. Decisión del dueño: simplifica el modelo, no se necesita recursión para este caso. |
| **H20** | Multi-copia se modela con pasos condicionales hardcodeados, NO con primitiva de iteración | Ruta declara N pasos de impresión, condicionales por tipoCopia. Para cuádruple (raro), se agrega un paso extra. ✅ Sin primitiva nueva. |
| **H22** | Emblocado vs abrochado como 2 rutas alternativas del MISMO producto | Sub-tema 07 ✅ |
| **H23** | Modo `talonarioIncompleto` es decisión FIJA del modelador (no del comercial) | Va en `paramsPaso` del paso pre_prensa del producto. |

### 🟡 Gaps detectados

| ID | Gap | Severidad | Solución propuesta |
|---|---|---|---|
| **H19** | Parámetros custom de la familia que el modelador llena en el producto (ej: modoTalonarioIncompleto, formato de numeración) | MEDIA | Agregar al esquema del producto: `paramsPaso: Record<string, any>` por cada paso de la ruta. La familia declara qué params soporta (con tipo y validación). El modelador los llena al armar el producto. Hay que documentarlo en sub-tema 07 (capas Familia/Ruta/Producto). |
| **H21** | Cantidad efectiva ≠ cantidad pedida (modo `pose_completa` cobra más talonarios) — comercial debería ver el dato | BAJA | Caso candidato para D.8 warnings: "warning informativo: cantidad efectiva = X (pediste Y, modo pose_completa imprime grupo extra)". Agregar al backlog de D.8 cuando se aborde. |

## 8. Hallazgos cruzados con Tarjetas + Vinilo

Acumulando con las validaciones de los 3 productos, los gaps del modelo:

| ID | Gap | Producto donde apareció | Severidad |
|---|---|---|---|
| **H4** | `modoMedidas: FIJA \| LIBRE \| COMERCIAL_ELIGE` a nivel producto | Tarjetas | MEDIA |
| **H7** | JobContext debe soportar `piezas: [...]` (listas multi-medida) | Vinilo | ALTA |
| **H19** | `paramsPaso` JSON libre por paso del producto | Talonarios | MEDIA |
| **H21** | Cantidad efectiva ≠ pedida (warning D.8) | Talonarios | BAJA |

**3 gaps de modelado del producto + 1 gap de D.8 warnings**. Los 3 primeros se resuelven con cambios incrementales al schema del producto. H21 se resuelve cuando se aborde D.8.

## 9. Conclusión validación Talonarios

- **12 pasos** del journey real → **12 familias del catálogo**, mapeo limpio. ✅
- **7 validaciones** confirmadas (H14, H15, H16, H17, H20, H22, H23).
- **2 gaps** detectados (H19 medianos, H21 bajo).
- **Producto más complejo de los 3 validados**: tiene multi-copia + multi-material + rutas alternativas + parámetros custom + sub-producto-como-material. **El modelo cubre todos los casos** con cambios menores.

**Veredicto del producto**: ✅ El modelo conceptual cubre el caso al ~90%. Los 2 gaps detectados son incrementales y tienen solución concreta propuesta.
