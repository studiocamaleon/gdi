# Validación Fase E — Producto: Rígido impreso (MDF / PVC / otros)

> **Fase E** — Validación con casos reales. Producto #4.
> **Sesión**: 2026-04-24. **Tenant referente**: Corporearte.
> **Método**: Q&A interactivo. Producto genérico que cubre señalética PVC, letras corpóreas MDF, y otros rígidos impresos directos o con vinilo aplicado.

## 1. Journey narrativo

Producto genérico "Rígido impreso custom" que cubre múltiples casos de uso:
- Señalética en PVC (ej: 10cm × 30cm para puerta de oficina, cortada manualmente).
- Letras corpóreas en MDF (logo de empresa para fachada, cortadas en CNC).
- Cuadros decorativos en MDF/foam (cortes simples, eventualmente lijado/laqueado).

```
ESCENA 1 — Recepción del pedido
Cliente pide algo en rígido. ¿Qué material? ¿Qué forma? ¿Cómo se corta?

ESCENA 2 — Diseño (si cliente no trae)

ESCENA 3 — Pre-prensa
Imposición sobre placa madre (ej: MDF 9mm en placas de 1.83 × 2.75m).

ESCENA 4 — Impresión (DECISIÓN COMERCIAL)
A) DIRECTA en máquina híbrida UV flatbed (default).
B) En vinilo + aplicación al rígido (alternativa para algunos casos).

ESCENA 5 — Corte (DECISIÓN COMERCIAL)
A) MANUAL con trincheta/sierra.
B) CNC router.
C) Láser (algunos materiales como acrílico).

ESCENA 6 — Acabado opcional
- Lijado / canteado de bordes.
- Laqueado o barniz protector.

ESCENA 7 — Embalaje.

ESCENA 8 — Entrega o instalación in situ.
```

## 2. Mapeo a familias del catálogo

| # | Paso real | Familia | M-?/T-? | Activación |
|---|---|---|---|---|
| 1 | Diseño | `diseno_grafico` | M-0/T-1\|T-2 | OPCIONAL |
| 2 | Pre-prensa | `pre_prensa` | M-0/T-1 | OBLIGATORIO |
| 3 | Impresión | `impresion_por_pieza` o `impresion_por_area` | M-2 (híbrida UV directa o impresora vinilo) | OBLIGATORIO |
| 4 | Aplicación de vinilo al rígido (solo si camino B) | `operacion_manual` con sub-tipo `aplicacion_vinilo` | M-0/T-2 | CONDICIONAL si impresión = vinilo |
| 5 | Corte | `corte_manual` (NUEVA) o `cnc` o `corte_laser` | M-2 (varias máquinas) | OBLIGATORIO |
| 6 | Lijado/canteado | `lijado_canteado` (NUEVA) | M-0/T-2 | OPCIONAL |
| 7 | Laqueado/barniz | `pintura_superficial` | M-1 (cabina) o M-0 | OPCIONAL |
| 8 | Embalaje | `embalaje` | M-0/T-2 | OBLIGATORIO |
| 9 | Instalación in situ | `instalacion_in_situ` | M-0/T-2 | OPCIONAL |

**Cobertura familias**: 9/9 ✅ — pero requiere **2 familias nuevas** (`corte_manual` y `lijado_canteado`).

## 3. Configuración por paso (puntos clave)

### Paso 3 — Impresión (M-2 con candidatas)
- **Candidatas declaradas en el producto**:
  - Híbrida UV flatbed (impresión directa)
  - Impresora vinilo (para camino "vinilo + aplicación")
- Comercial elige al cotizar.
- Si elige impresora vinilo → activa automáticamente paso 4 (aplicación de vinilo) — modelado como CONDICIONAL.

### Paso 5 — Corte (M-2 con candidatas)
- **Candidatas declaradas en el producto**:
  - Manual (con trincheta/sierra) — familia `corte_manual`
  - CNC router — familia `cnc`
  - Láser — familia `corte_laser`
- Comercial elige al cotizar según material y geometría.
- **Validación de capacidad técnica** (D.7): el motor debe filtrar candidatas según el material elegido (ej: PVC fino entra en cualquiera; MDF 18mm solo en CNC; acrílico también en láser).

### Sin cargos directos específicos del producto.

## 4. Inputs del JobContext

```typescript
{
  productoId: "rigido-impreso-custom",

  // Material y medidas
  materialRigido: "PVC_3mm" | "PVC_5mm" | "MDF_9mm" | "MDF_18mm" | ...,
  piezas: [{ cantidad: 5, anchoMm: 100, altoMm: 300 }, ...],  // GAP H7

  // Decisiones del comercial al cotizar
  metodoImpresion: "DIRECTA_UV" | "VINILO_APLICADO",
  metodoCorte: "MANUAL" | "CNC" | "LASER",

  // Opcionales activados
  opcionalesActivados: {
    paso_diseno: boolean,
    paso_lijado: boolean,
    paso_laqueado: boolean,
    paso_instalacion: boolean
  },
  configPaso_lijado: { /* ... */ },
  configPaso_laqueado: { variante: "mate" | "brillo" }
}
```

## 5. Hallazgos y validaciones

### 🟢 Validaciones confirmadas

| ID | Validación | Cómo cubre |
|---|---|---|
| **H26** | Decisión entre métodos de impresión (directa vs vinilo+aplicación) y métodos de corte (manual vs CNC vs láser) | M-2 en pasos clave. El comercial elige al cotizar. ✅ Una sola ruta cubre las combinaciones. |
| **H28** | Validación de capacidad técnica del corte según material | D.7: motor filtra candidatas según material. UI deshabilita opciones inválidas. ✅ |
| **H29** | Pre-prensa sobre placa madre (rígido) usa el mismo modelo que pliegos (papel) | Familia `pre_prensa` es genérica. Material declara su placa madre. ✅ |

### 🟡 Gaps detectados

| ID | Gap | Severidad | Solución |
|---|---|---|---|
| **H24** | Familia para "corte manual con trincheta/sierra" no existe en el catálogo | MEDIA | Agregar familia nueva `corte_manual` (M-0/T-2) en categoría "Corte y formado". Resuelto en esta sesión. |
| **H25** | Familia para "lijado/canteado" no existe en el catálogo | BAJA | Agregar familia nueva `lijado_canteado` (M-0/T-2) en categoría "Terminaciones". Resuelto en esta sesión. |

## 6. Hallazgos cruzados con los 3 anteriores

Acumulando con Tarjetas + Vinilo + Talonarios, los gaps consolidados:

| ID | Gap | Producto donde apareció | Severidad | Estado |
|---|---|---|---|---|
| **H4** | `modoMedidas: FIJA \| LIBRE \| COMERCIAL_ELIGE` a nivel producto | Tarjetas | MEDIA | Pendiente |
| **H7** | JobContext debe soportar `piezas: [...]` (multi-medida) | Vinilo / Rígido | ALTA | Pendiente |
| **H19** | `paramsPaso` JSON libre por paso del producto | Talonarios | MEDIA | Pendiente |
| **H21** | Cantidad efectiva ≠ pedida (warning D.8) | Talonarios | BAJA | Backlog D.8 |
| **H24** | Familia `corte_manual` | Rígidos | MEDIA | ✅ Resuelto (agregar al catálogo) |
| **H25** | Familia `lijado_canteado` | Rígidos | BAJA | ✅ Resuelto (agregar al catálogo) |

**6 gaps detectados, 4 vigentes (4 productos validados)**. Los 2 nuevos (H24, H25) son agregar familias al catálogo, sin cambios al modelo conceptual.

## 7. Conclusión validación Rígido impreso

- **9 pasos** del journey real → **9 familias del catálogo** (con 2 familias nuevas).
- **3 validaciones** confirmadas (H26, H28, H29).
- **2 gaps** detectados (H24, H25), ambos resueltos en sesión: agregar familias al catálogo.
- **Variantes de método** (impresión + corte) se cubren con M-2 en 1 sola ruta + comercial elige al cotizar.

**Veredicto del producto**: ✅ El modelo conceptual cubre el caso al 95%. Los 2 gaps son agregados al catálogo, sin rediseño.

**Insight clave**: el producto rígido valida que el modelo M-2 de candidatas + selección del comercial al cotizar escala bien para casos con múltiples decisiones combinadas (impresión × corte). NO se necesita explosión combinatoria de rutas alternativas.
