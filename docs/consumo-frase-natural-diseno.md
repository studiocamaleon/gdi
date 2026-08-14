# Consumo como frase natural — las 3 formas

Rediseño de **"Cómo se calcula el consumo"** en el editor de pasos (Guiado),
para que el modelador **lea la config como una regla**, igual que se hizo en
Tiempo (ver `tiempo-frase-natural` / `project_tiempo_frase_natural`).

## El problema

El consumo se declaraba con **dos selectores que se referenciaban en círculo**:

- *"Con qué fórmula"* → "Por unidad producida"
- *"¿Por cada cuántos se gasta uno?"* → "Según fórmula del consumo" · "1 por base"

Nadie entendía eso: cada selector mandaba al otro, `"por base"` es la palabra
"base" como sustantivo, y nunca se nombraba la unidad del material ni de qué era
la "unidad producida". El caso testigo fue **Módulo LED**, que además mostraba
perillas de fórmula que el motor **ignora** (su cantidad la fija el derivador
`sembrado_led`).

## La solución: elegir 1 de 3 formas, leídas como frase

| Forma | Cuándo | Frase | Campos del motor |
|---|---|---|---|
| **Lo mide el paso** | sustrato y lo que sigue la geometría (default) | "Gasta *lo que produce el paso* / *los m² que ocupan las piezas* / *los metros lineales*…" | `formula` (`cantidadBase = null`). Con `formulaForzada` de la familia se muestra resuelta, no editable. |
| **Regla propia** | insumos que se cuentan aparte | "Gasta *N* por cada *base*" (broches por pila, ojales por pieza) | `cantidadBase` + `cantidadFactor` |
| **Lo deriva la geometría** | sembrado LED, perfil en barras, cableado | "Gasta *los módulos que siembra el paso…*" (sólo lectura) | `magnitudDerivada` / `cantidadFija` / derivador. Override → regla propia |

Precedencia real del motor (confirmada en relevamiento): **geometría derivada >
base×factor > fórmula**. La base×factor **pisa** la geometría derivada (la
magnitud derivada es el default, no un candado — `motor.service.ts` corta en
`if (slot.cantidadBase) return null;`).

### Decisiones cerradas

1. **La unidad del material se nombra** en la magnitud ("los módulos", "los m²").
   Para "Regla propia" el sustantivo del material se omite por ahora (`materialLabel`
   = null): el material ya se nombra en la fila de arriba. Pendiente opcional.
2. **`formula` + `base×factor` se funden**: "Regla propia" ES la base×factor. Se
   acabó el "según la fórmula" que apuntaba a sí mismo.
3. **Módulo LED se detecta como derivado** (`decl.codigo === "modulos_led"`)
   aunque no declare `magnitudDerivada` — su cantidad viene del derivador. Deja
   de mostrar perillas muertas. Fix de raíz del caso testigo.
4. **La fuente se hereda** de "Sobre qué mide" (`fuenteMedida`) e va inline en la
   frase ("de la lona"), igual que Tiempo.

## Implementación

- Componente `ConsumoReglaGuiado` (`config-pasos-editor-view.tsx`) reemplaza a
  `ConsumoFormulaGuiado` + `BaseConsumoGuiado` (borrados). Renderiza la forma
  activa con encabezado (ícono + título + subtítulo) y la frase con selects
  inline; enlaces para cambiar de forma.
- `schema.ts`: `materiales.consumo` sin etiqueta (el componente se auto-titula)
  y `anchoCompleto`; `materiales.base` plegado (`visible: () => false`, resumen
  conservado para tests); ayuda del grupo `descuento` reescrita.

Verificado en vivo: sustrato de impresión (mide el paso), film de laminado
(INSUMO con fórmula forzada + toggle a regla propia) y Módulo LED (derivado).
