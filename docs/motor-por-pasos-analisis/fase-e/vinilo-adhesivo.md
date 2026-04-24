# Validación Fase E — Producto: Vinilo adhesivo (gran formato)

> **Fase E** — Validación con casos reales. Producto #2.
> **Sesión**: 2026-04-24. **Tenant referente**: Corporearte.
> **Método**: Q&A interactivo con dueño del negocio.

## 1. Journey narrativo (palabras del dueño)

> "Por lo general lo que es vinilo adhesivo blanco impreso, suele ser para aplicar en vidrieras, o paredes, son varios paños de misma o distintas medidas, hoy día nosotros cotizamos eso por m² pero sin contemplar desperdicios, anchos, ni nada, tenemos un precio fijo por m² y lo calculamos así (que está mal) pero en escencia lo que el sistema debería hacer es:
>
> primero lo mismo de siempre (si el cliente tiene diseño o no para agregar ese paso), luego según las medidas de paños, pasar por el nesting para calcular la cantidad correcta de material (incluyendo márgenes y desperdicios)
>
> Luego ese material puede laminarse (con rollo de vinilo de laminado), y hay que ver si es con colocación o sin (acá la colocación puede ser en nuestro taller, o fuera de nuestro taller en distintas zonas para evaluar el costo fijo del traslado (no es lo mismo colocar a dos cuadras de la grafica que en el aeropuerto (a 25 km).
>
> Por lo general cada producto de gran formato define su material (vinilo blanco, otro producto: vinilo microperforado y así) lo que sí dentro de cada material hay variantes de medidas (que el nesting recorre para elegir el ancho de rollo más óptimo para la impresión)
>
> También puede ser que un vinilo sea troquelado en plotter de corte (para stickers) por ejemplo, con medio corte o corte profundo o completo.
>
> También en el vinilo depende en qué tecnología se va a imprimir (ecosolvente, latex, uv) de eso depende la máquina que se usará, cambia el precio y además también según la máquina podría ser que se imprima en tintas CMYK o con tintas adicionales como barniz o blanco."

## 2. Mapeo a familias del catálogo

| # | Paso real | Familia | Tipo | Activación |
|---|---|---|---|---|
| 1 | Diseño (si cliente no trae) | `diseno_grafico` | M-0 | OPCIONAL |
| 2 | Pre-prensa (cálculo nesting de paños) | `pre_prensa` | M-0 | OBLIGATORIO |
| 3 | Impresión por área | `impresion_por_area` | M-1 o M-2 (varias tecnologías) | OBLIGATORIO |
| 4 | Laminado | `laminado` | M-1 | OPCIONAL |
| 5 | Troquelado en plotter de corte | `plotter_corte` | M-1 | OPCIONAL |
| 6 | Instalación en sitio | `instalacion_in_situ` | M-0 | OPCIONAL |

**Más cargos directos asociados a cotización** (cuando hay instalación):
- Viático por zona (MONTO_FIJO_PLANO con sub-elección de zona).

**Cobertura familias**: 6/6 ✅.

## 3. Rutas alternativas

**Para Corporearte hoy**: 1 sola ruta (impresión + acabados opcionales).

**Variantes de configuración del paso impresión** (NO son rutas alternativas):
- Tecnología (M-2): ecosolvente / látex / UV — el comercial elige.
- Perfil de impresora: CMYK / CMYK+barniz / CMYK+blanco / CMYK+barniz+blanco — motor selecciona automático según `tintasAdicionales` del JobContext, comercial puede override (D.2).

## 4. Configuración por paso

### Paso 1 — Diseño (mismo modelado que Tarjetas)

### Paso 2 — Pre-prensa
- **Activación**: OBLIGATORIO.
- **Tiempo**: T-1 (fijo por trabajo).
- **Outputs**: nesting calculado para los paños del JobContext.

### Paso 3 — Impresión por área
- **Activación**: OBLIGATORIO.
- **Máquina**: M-2. El producto declara las máquinas candidatas (ecosolvente, látex, UV). Comercial elige al cotizar (tecnología).
- **Tiempo**: T-3 (productividad del perfil).
- **Materiales**:
  - Slot `sustrato_principal`: HARDCODED en cada producto (Vinilo blanco / Microperforado / Espejado son productos distintos cada uno con su material). Material declara variantes de **anchos de rollo** que el nesting recorre para elegir el óptimo.
  - Slot `tinta_o_consumibles`: vinculado al perfil de la máquina (cada perfil tiene sus consumibles propios — CMYK, barniz, blanco).
- **Selección automática del perfil**: motor evalua `reglaAutoSeleccion` de cada perfil contra `tintasAdicionales` del JobContext. Override manual del comercial disponible (D.2).
- **Validación de capacidad técnica**: el modelador filtra al armar producto (no incluye máquinas incompatibles); el motor valida en runtime contra ancho mínimo/máximo del rollo y JobContext.

### Paso 4 — Laminado
- **Activación**: OPCIONAL.
- **Máquina**: M-1.
- **Tiempo**: T-3 (m/min lineal).
- **Materiales**: slot `film_laminado` (rollo de laminado vinilo).

### Paso 5 — Plotter de corte (troquelado)
- **Activación**: OPCIONAL.
- **Máquina**: M-1.
- **Tiempo**: T-3.
- **Multiplicador / parámetro al cotizar**: `tipoCorte: "MEDIO" | "PROFUNDO" | "COMPLETO"` — cliente elige al cotizar. Cada tipo afecta tiempo y desgaste de cuchilla.

### Paso 6 — Instalación in situ
- **Activación**: OPCIONAL.
- **Máquina**: M-0.
- **Tiempo**: T-2 (m²/h o h/punto).
- **Cargo directo asociado a cotización**: "Viático por zona" (CABA, GBA Norte, etc.). Cuando se activa instalación fuera del taller, comercial selecciona zona, monto fijo se suma a la cotización.

## 5. Inputs del JobContext

```typescript
{
  productoId: "vinilo-adhesivo-blanco",

  // GAP H7 corregido: lista de paños con cantidades distintas
  piezas: [
    { cantidad: 3, anchoMm: 2000, altoMm: 1000 },
    { cantidad: 5, anchoMm: 500, altoMm: 500 }
  ],

  // Tecnología (cuando paso impresión es M-2)
  tecnologia: "ecosolvente" | "latex" | "uv",  // comercial elige al cotizar

  // Tintas adicionales (motor las usa para seleccionar perfil)
  tintasAdicionales: ("barniz" | "blanco")[],  // ej: ["barniz"]

  // Opcionales activados
  opcionalesActivados: {
    paso_diseno_grafico: boolean,
    paso_laminado: boolean,
    paso_plotter_corte: boolean,
    paso_instalacion_in_situ: boolean
  },

  // Configuración de pasos opcionales
  configPaso_diseno: { modoTiempo: "T-1" | "T-2", horas?: number },
  configPaso_laminado: { variante: "..." },
  configPaso_plotter: { tipoCorte: "MEDIO" | "PROFUNDO" | "COMPLETO" },
  configPaso_instalacion: { m2_instalados: number, zona: "CABA" | "GBA_NORTE" | ... }
}
```

## 6. Smoke test

**Caso típico**: 1 paño 2x1m vinilo blanco impreso (sin laminado, sin colocación).

- **Pasos activos**: pre-prensa + impresión + (sin opcionales) = **2 pasos** principales.
- **Costo esperado**: indeterminado (dueño no recordaba). Validación pendiente con seed real.

## 7. Hallazgos y validaciones

### 🟢 Validaciones confirmadas (modelo cubre el caso)

| ID | Validación | Cómo cubre |
|---|---|---|
| **H8** | Tecnología de impresión (eco/látex/UV) | M-2 con candidatas declaradas en producto. Comercial elige al cotizar. ✅ |
| **H9** | Tintas adicionales (barniz/blanco) | Perfiles distintos de la máquina, cada uno con su `reglaAutoSeleccion`. Motor selecciona automático según `tintasAdicionales` del JobContext, override manual disponible. ✅ Cubierto por D.2 sin agregar nada nuevo. |
| **H10** | Profundidad de corte (medio/profundo/completo) | Parámetro/multiplicador del paso al cotizar (igual patrón que esquinas en redondeo de Tarjetas). ✅ |
| **H11** | Material define tecnología compatible | Modelador filtra al armar producto; motor valida en runtime (D.7). ✅ |
| **H12** | Instalación = tiempo + viático fijo por zona | Tiempo del paso (T-2) + cargo directo MONTO_FIJO_PLANO con sub-elección de zona, a nivel cotización. ✅ |
| **H13** | Variantes de medidas (anchos de rollo) dentro del material | Material declara sus variantes; nesting recorre para elegir ancho óptimo (`shelf-rollo.ts` ya implementado). ✅ |

### 🟡 Gaps detectados (modelo NO cubre / cubre parcialmente)

| ID | Gap | Severidad | Solución propuesta |
|---|---|---|---|
| **H7** | JobContext debe soportar LISTAS de piezas con cantidades distintas (no solo 1 medida única) | ALTA | Cambiar `cantidad: number + medidaPiezaMm` por `piezas: [{cantidad, anchoMm, altoMm}, ...]`. El nesting actual (`nestMultiMedida`) ya lo soporta, falta declararlo en el modelo conceptual y propagar a familias que usen nesting (impresion_por_area, plotter_corte, etc.). Afecta UI del comercial (carga lista de paños). |

## 8. Conclusión validación Vinilo adhesivo

- **6 pasos** del journey real → **6 familias del catálogo**, mapeo limpio. ✅
- **6 validaciones** confirmadas (H8, H9, H10, H11, H12, H13).
- **1 gap** detectado (H7) — listas de paños en JobContext. Severidad ALTA porque impacta UI del comercial y modelo conceptual.

**Veredicto del producto**: ✅ El modelo conceptual cubre el caso al ~90%. El gap H7 es crítico (sin él, vinilo no cotiza correctamente) pero la solución es directa.

---

## 9. Hallazgos cruzados con Tarjetas

Acumulando con la validación de Tarjetas (`tarjetas-de-visita.md`), los gaps consolidados al cierre del Producto #2:

| ID | Gap | Detectado en | Severidad |
|---|---|---|---|
| **H4** | `modoMedidas: FIJA \| LIBRE \| COMERCIAL_ELIGE` a nivel producto | Tarjetas | MEDIA |
| **H7** | JobContext debe soportar `piezas: [...]` (listas multi-medida) | Vinilo | ALTA |

Ambos gaps son del **modelo del JobContext / producto**, no del catálogo de familias ni del motor en sí. La solución de H7 podría incorporar H4 si se diseña con cuidado: el campo `piezas` siempre es lista, y para productos con medida fija el modelador declara `medidaDefaultMm` que se usa cuando el cliente no carga medidas custom.
