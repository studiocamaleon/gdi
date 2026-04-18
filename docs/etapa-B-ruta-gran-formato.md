# Etapa B.1 — Ruta del piloto gran formato (vinilo adhesivo blanco UV)

**Producto piloto:** Vinilo adhesivo blanco (id: `668f59e6-c62e-47ed-9624-80469defdc15`)
**Variante fixture:** "Genérico" 1000×500mm (id: `2a0f807e-ebe9-4706-b5ba-07a439474f25`)
**Máquina de impresión:** Hibrida UV (id: `ae862a5b-829d-4fd3-9c06-12aeabf5086d`, plantilla `IMPRESORA_UV_MESA_EXTENSORA`)
**Sustrato:** Vinilo adhesivo blanco 63cm rollo (variantes existentes del catálogo)

## Ruta de producción (5 pasos)

```
┌──────────────┐   ┌──────────────────────┐   ┌─────────────┐   ┌─────────┐   ┌───────────┐
│  pre_prensa  │ → │  impresion_por_area  │ → │  laminado   │ → │  corte  │ → │ embalaje  │
│   (fijo)     │   │    (m² × tarifa)     │   │ (opcional)  │   │  (fijo) │   │  (fijo)   │
└──────────────┘   └──────────────────────┘   └─────────────┘   └─────────┘   └───────────┘
```

### Paso 1 — Pre-prensa
- **Familia:** `pre_prensa`
- **Tiempo:** 15 min fijo por trabajo (independiente de cantidad/tamaño)
- **Centro de costo:** Pre-prensa (tarifa horaria del centro)
- **Material:** ninguno
- **Activación:** obligatoria

### Paso 2 — Impresión por área
- **Familia:** `impresion_por_area`
- **Tiempo:** `setup + (areaM² / productividadM²h) × 60` minutos
  - setup = 5 min arranque
  - productividad ≈ 4 m²/h en UV (placeholder; refinable)
- **Centro de costo:** Hibrida UV
- **Material:**
  - Sustrato: `areaM² × (1 + merma)` m² de vinilo → precio por m² del rollo
  - Tinta UV: `areaM² × 15 ml/m²` → precio por ml (placeholder)
- **Output emitido:** `m2Impresos`
- **Activación:** obligatoria

### Paso 3 — Laminado UV (opcional)
- **Familia:** `laminado`
- **Tiempo:** `setup + (m2Impresos / productividadLaminadoM²h) × 60`
  - setup = 3 min
  - productividad ≈ 20 m²/h
- **Centro de costo:** Hibrida UV (mismo, placeholder — ideal sería una laminadora)
- **Material:** Film UV laminado = `m2Impresos × 1.05` m² (5% merma) × precio m²
- **Activación:** opcional (se activa con opcionalesSeleccionados)

### Paso 4 — Corte perimetral
- **Familia:** `corte`
- **Tiempo:** `cantidadPiezas × 2 min` (tiempo por pieza)
- **Centro de costo:** Post-prensa (mismo centro que guillotina)
- **Material:** ninguno
- **Activación:** obligatoria

### Paso 5 — Embalaje
- **Familia:** `operacion_manual`
- **Tiempo:** `cantidadPiezas × 1 min` (tiempo por pieza)
- **Centro de costo:** Post-prensa
- **Material:** Bolsas/embalaje — 1 unidad por pieza × precio bolsa (cargo flat pequeño)
- **Activación:** obligatoria

## Variables del Job Context

Lo que el motor espera recibir en el payload:

| Variable | Tipo | Origen | Ejemplo |
|---|---|---|---|
| `cantidad` | int | Payload | 1, 5, 10 (cantidad de piezas) |
| `anchoMm` | number | Payload.parametros | 1000 (ancho de cada pieza en mm) |
| `altoMm` | number | Payload.parametros | 500 (alto de cada pieza en mm) |
| `conLaminado` | boolean | Payload.opcionalesSeleccionados | true/false |
| `periodo` | string | Payload | "2026-04" |

## Reglas de selección aplicables (opcional en piloto)

- **Merma por tipo de vinilo**: si `sustrato.tipo=calandrado` → merma 8%; si `fundido` → merma 5%.
  - No aplicada en piloto (usa merma fija 5%).
- **Selección de perfil UV**: según gramaje del sustrato → perfil rapido/normal/lento.
  - No aplicada en piloto (usa perfil default).

## Casos de validación (para B.3)

| # | Descripción | Cantidad | Medidas | Opcionales | Total esperado (rango) |
|---|---|---:|---|---|---|
| G1 | 1 pieza mediana con laminado | 1 | 1000×500mm | laminado UV | ~$4.000–$6.000 |
| G2 | 2 piezas grandes con corte | 2 | 2000×800mm | — | ~$8.000–$12.000 |
| G3 | 10 stickers chicos | 10 | 500×500mm | — | ~$6.000–$9.000 |
| G4 | 1 rotulación larga | 1 | 3000×600mm | — | ~$8.000–$12.000 |

El rango es orientativo — el motor v2 debe converger en valores dentro de un rango razonable para cada caso. Los valores exactos se fijan como golden tras corrida inicial + revisión del usuario.
