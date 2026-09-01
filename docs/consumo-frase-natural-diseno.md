# Consumo como frase natural — las 3 formas

Rediseño de **"Cómo se calcula el consumo"** en el editor de pasos (Guiado),
para que el modelador **lea la config como una regla**, igual que se hizo en
Tiempo (ver `tiempo-frase-natural` / `project_tiempo_frase_natural`).

## El problema

El consumo se declaraba con **dos selectores que se referenciaban en círculo**:

- _"Con qué fórmula"_ → "Por unidad producida"
- _"¿Por cada cuántos se gasta uno?"_ → "Según fórmula del consumo" · "1 por base"

Nadie entendía eso: cada selector mandaba al otro, `"por base"` es la palabra
"base" como sustantivo, y nunca se nombraba la unidad del material ni de qué era
la "unidad producida". El caso testigo fue **Módulo LED**, que además mostraba
perillas de fórmula que el motor **ignora** (su cantidad la fija el derivador
`sembrado_led`).

## La solución final: regla controlada con vista previa

La implementación conserva las tres semánticas del motor, pero deja de
presentarlas como fórmulas que el usuario debe interpretar. La pantalla se
organiza como el configurador de uso de componentes:

1. **Origen del consumo**: cálculo automático o regla por cantidad.
2. **Dato que determina el consumo**: imposición, acomodo, cantidad pedida,
   perímetro, personalizaciones, etc. Siempre proviene de una lista controlada.
3. **Resultado que se descuenta**: descripción de la magnitud que resolverá el
   motor, sin códigos internos.
4. **Vista previa de la regla**: frase completa con el nombre real del material.
5. **Merma extra**: ajuste independiente del desperdicio geométrico.

Los cálculos gobernados por el paso —impresión por área/hoja, laminado, montaje
y geometrías derivadas— se muestran como configuración protegida. No se ofrecen
perillas que permitan romper el contrato técnico de ese paso. Los slots libres,
insumos y derivaciones que admiten override pueden cambiar a una regla explícita
por cantidad.

## Correspondencia con las 3 formas del motor

| Forma                      | Cuándo                                         | Frase                                                                                      | Campos del motor                                                                                        |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **Lo mide el paso**        | sustrato y lo que sigue la geometría (default) | "Gasta _lo que produce el paso_ / _los m² que ocupan las piezas_ / _los metros lineales_…" | `formula` (`cantidadBase = null`). Con `formulaForzada` de la familia se muestra resuelta, no editable. |
| **Regla propia**           | insumos que se cuentan aparte                  | "Gasta _N_ por cada _base_" (broches por pila, ojales por pieza)                           | `cantidadBase` + `cantidadFactor`                                                                       |
| **Lo deriva la geometría** | sembrado LED, perfil en barras, cableado       | "Gasta _los módulos que siembra el paso…_" (sólo lectura)                                  | `magnitudDerivada` / `cantidadFija` / derivador. Override → regla propia                                |

Precedencia real del motor (confirmada en relevamiento): **geometría derivada >
base×factor > fórmula**. La base×factor **pisa** la geometría derivada (la
magnitud derivada es el default, no un candado — `motor.service.ts` corta en
`if (slot.cantidadBase) return null;`).

### Decisiones cerradas

1. **El material se nombra** en la vista previa. Se toma la materia prima fija o
   candidata; si todavía no existe, se usa el nombre humano del slot. La regla
   nunca vuelve a decir solamente "lo que produce el paso".
2. **`formula` + `base×factor` se funden**: "Regla propia" ES la base×factor. Se
   acabó el "según la fórmula" que apuntaba a sí mismo.
3. **Módulo LED se detecta como derivado** (`decl.codigo === "modulos_led"`)
   aunque no declare `magnitudDerivada` — su cantidad viene del derivador. Deja
   de mostrar perillas muertas. Fix de raíz del caso testigo.
4. **La fuente se hereda** de "Sobre qué mide" (`fuenteMedida`) y va inline en la
   frase ("de la lona"), igual que Tiempo.
5. **La UI no cambia el modelo de datos**: `formula`, `cantidadBase`,
   `cantidadFactor`, `fuenteMedida` y `mermaAdicionalPct` mantienen su semántica.
   El rediseño es una capa de presentación controlada.

## Relevamiento de productos simples

Antes del rediseño se relevaron 59 productos simples activos, con 87 slots de
material. Cinco casos de categorías distintas quedaron como contratos de prueba:

| Producto                        | Contrato que debe explicar la UI                                             |
| ------------------------------- | ---------------------------------------------------------------------------- |
| Vinilo impreso blanco           | El nesting determina el largo o superficie real del rollo, pliego o placa.   |
| Tarjetas de visita              | La imposición determina los pliegos; el laminado hereda el tamaño producido. |
| Talonarios en papel químico     | 2 broches por cantidad pedida y 1 cartón por pila de talonario.              |
| Imán vehicular                  | El material de montaje se calcula con su propio acomodo.                     |
| Remera de algodón personalizada | El film DTF depende de las estampas activadas y sus medidas.                 |

Estos casos viven en `consumo-presentacion.test.ts` para impedir que una futura
modificación vuelva a exponer fórmulas genéricas o pierda el contexto del paso.

## Implementación

- Componente `ConsumoReglaGuiado` (`config-pasos-editor-view.tsx`) reemplaza a
  `ConsumoFormulaGuiado` + `BaseConsumoGuiado` (borrados). Renderiza el origen,
  los campos controlados, el resultado, la vista previa y la merma.
- `consumo-presentacion.ts` concentra las traducciones de negocio por familia y
  permite probarlas sin renderizar todo el editor.
- `schema.ts`: `materiales.consumo` sin etiqueta (el componente se auto-titula)
  y `anchoCompleto`; `materiales.base` plegado (`visible: () => false`, resumen
  conservado para tests); ayuda del grupo `descuento` reescrita.

Verificado en vivo: sustrato de impresión (mide el paso), film de laminado
(INSUMO con fórmula forzada + toggle a regla propia) y Módulo LED (derivado).
