# Centro de copiado — precio de venta manual (grilla) — Diseño

**Fecha:** 2026-08-03
**Estado:** DISEÑO — sin implementar (pospuesto). Analizado con el usuario; se
documenta para retomar. Primero se resuelve el modelo de tiempo (ver §7).

---

## 1. Problema

El precio de un centro de copiado muchas veces **no** sale del costo × margen: el
mostrador tiene un **tarifario** ("A4 B/N simple = $50/hoja; de 100+ = $40"). El
usuario quiere poder **fijar el precio de venta a mano**, pero que el **costo lo
siga calculando el motor** (para margen y reportes reales).

## 2. Lo que ya existe (catálogo)

Los productos tienen métodos de precio que **pisan el precio, no el costo**
(`aplicar-precio.service.ts`):

- `variable_por_cantidad` → tramos `{ hastaCantidad, precio }` (rangos).
- `fijado_por_cantidad` → `{ cantidad exacta, precio }`.

El costo lo calcula el motor; el margen sale de `precioManual − costo`. O sea: el
modelo "costo del motor + precio manual" **ya está resuelto para UNA dimensión: la
cantidad, por producto**.

## 3. Por qué el centro de copiado no entra en ese molde

La grilla de CC es **multidimensional**: `papel × tamaño × color × faz × rango de
cantidad`. Una lista de tramos por cantidad no alcanza, y una grilla completa
explota (5 papeles × 6 tamaños × 2 colores × 2 faz = **120 filas** × brackets).
Impracticable de cargar a mano.

## 4. Propuesta: REGLAS con comodín + fallback al motor

En vez de una grilla completa, una **lista de reglas** con dimensiones opcionales
y resolución **"más específica gana"** (el mismo patrón "librito" de impuestos y
comisiones). Vive en la **config de Centro de copiado**, no en el `precioConfig`
del producto.

```
ReglaPrecioCC = {
  papel?: materiaPrimaId,     // ausente = cualquier papel
  tamano?: string,            // ausente = cualquier tamaño
  color?: 'BN' | 'COLOR',     // ausente = cualquiera
  faz?: 1 | 2,                // ausente = cualquiera
  brackets: [{ hastaHojas: number, precioPorHoja: number }],  // orden asc.
}
```

Ejemplos:
- `{ color: BN, faz: 1 → 1-50: $50/hoja · 51+: $40 }` (cualquier papel/tamaño)
- `{ tamano: A3, color: COLOR → 1-20: $300 · 21+: $250 }` (override específico)
- Lo que no matchee ninguna regla → **cae al motor × margen** (grilla *sparse*).

Así el tenant carga 3-5 reglas amplias en lugar de 120 celdas.

### 4.1. Resolución
Por documento, con `(papel, tamaño, color, faz, hojas)`:
1. Filtrar reglas cuyas dimensiones declaradas matcheen (comodín = matchea).
2. Elegir la **más específica** (más dimensiones declaradas; desempate por orden).
3. Dentro de la regla, elegir el bracket por `hojas` (`hastaHojas` asc.).
4. `precio = precioPorHoja × hojas`. Sin regla → precio del motor.

## 5. Dónde se aplica: override en el servicio de CC (post-motor)

El motor cotiza normal (costo + clicks + tóner + tiempo) → se obtiene el **costo**.
El servicio de CC busca la regla y **reemplaza el precio de venta**, recalculando
IVA sobre ese precio. **Costo y margen quedan del motor** (`margen = precioManual −
costo`). No toca el motor genérico — vive en el módulo, como el resto de CC.

## 6. UX (editor de reglas en la config de CC)

Tabla de reglas: cada fila con selects opcionales (papel/tamaño/color/faz, con
"Cualquiera") + sub-tabla de brackets (`hastaHojas`, `precioPorHoja`). Vista previa
"para 10 hojas A4 B/N simple → $X" para validar la resolución.

## 7. Decisiones abiertas

1. **Por hoja física vs por carilla** (importa en doble faz).
2. **Bracket por documento vs por carga total** (¿el volumen mira las hojas del
   documento o la suma de toda la carga?).
3. **Margen negativo**: precio manual < costo → ¿avisar (recomendado) o bloquear?
4. **Convivencia con la edición manual del renglón** en la ficha (¿la regla es un
   default pisable o es fija?).
5. **Cobertura**: ¿el precio manual también varía por nivel de cobertura, o eso lo
   absorbe el margen? (Probablemente lo absorbe el margen: el precio manual es
   precio de venta, la cobertura afecta el costo.)

## 8. Recomendación

Reglas con comodín + fallback al motor + override en el servicio de CC; **por hoja
física**, **bracket por documento**, **aviso (no bloqueo)** si el margen sale
negativo. Es lo más simple de cargar y no toca el motor.

## 9. Relación con otros módulos

- Reusa el concepto de `variable_por_cantidad`/`fijado_por_cantidad` (catálogo),
  extendido a multi-dimensión.
- Patrón "librito"/reglas más-específico-gana: igual que impuestos y comisiones.
- Depende de que el modelo de **tiempo** de CC esté resuelto (real + mínimo), si no
  el costo base contra el que se compara el margen manual sigue saltando por el
  `ceil` de minutos.
