# Simulador de impresión con datos reales — diseño

> 2026-07-17, rama `feat/simulador-real`. El v1 mock ya definió la UX
> (tecnología → material → nesting client-side con sugerencia de ancho);
> esta fase lo conecta a la cola real y agrega el completar en LOTE.
> Journey: el impresor manda varios archivos juntos a la máquina — acá ve
> todo lo imprimible consolidado, elige ancho con ahorro visible, imprime,
> y marca todo impreso de una, sin ir card por card en el tablero.

## 1. Decisiones

- **D1 — Alcance: familia `impresion_por_area` en FRONTERA** de órdenes
  vivas (mismo criterio de secuencia del tablero: es lo imprimible YA y lo
  único completable). Incluye naturalmente las personalizaciones DTF (usan
  por_area en el motor). Digital por hoja/pieza queda FUERA (decisión
  usuario 2026-07-17).
- **D2 — Piezas desde `nestingResult.placements`** del snapshot (la verdad
  física: post-panelizado y con demasía), fallback `jobContext.piezas`
  (mm). Sin datos → job "sin medidas": fuera del nesting, dentro del lote.
- **D3 — Agrupación: tecnología → MATERIA PRIMA → compatibilidad física**:
  se re-nestean juntos anchos distintos únicamente cuando coinciden los demás
  atributos de variante (color, gramaje, acabado, adhesivo, etc.). Compartir
  materia prima y ancho no vuelve intercambiables dos SKUs.
- **D4 — Anchos sugeridos = variantes activas de esa materia prima** con
  `atributosVarianteJson.anchoMm`, su `precioReferencia` (por ml) y stock
  (`Σ StockMateriaPrimaVariante.cantidadDisponible`).
- **D5 — El nesting consolidado lo ejecuta el backend con el motor real** y
  los parámetros congelados en el snapshot. El frontend sólo representa el
  resultado y elige un rollo concreto; no posee un packer alternativo.
- **D6 — Ahorro en $ además de ml** (decisión usuario): baseline = Σ por
  job de `consumedLengthMm × precioMl de la variante cotizada` (lo que
  consumiría imprimir cada uno por separado como se cotizó); propuesta =
  largo consolidado × precioMl de la variante del ancho elegido. El navegador
  envía sólo `{ varianteId, anchoMm }`; el servidor recalcula y valida todos
  los consumos, costos, compatibilidad y stock antes de guardar el ahorro.
- **D7 — Completar en lote**: `POST /ordenes-trabajo/tablero/pasos/
  completar-lote { pasoIds }` — reusa la acción individual por paso
  (mismas validaciones de frontera/estado, eventos, promoción de orden,
  auto-finalización). Resultado PARCIAL honesto: `{ completados,
  errores: [{pasoId, motivo}] }`. Completa directo desde `pendiente`
  (igual que la acción del tablero, decisión usuario).
- **D8 — En vivo**: mismo polling de 15 s del tablero (pausa oculta +
  foco), pausado mientras hay un lote en vuelo. La selección vive por
  pasoId: si otro operario completa un paso, desaparece solo de la cola.

## 2. Contrato

`GET /produccion/simulador` (todo en una respuesta, server-side):

```ts
{
  jobs: Array<{
    pasoId, itemId, ordenId: string;
    codigo: string;            // "OT-0003 · A"
    cliente, producto: string;
    fechaEntrega: string | null;
    tecnologia: string | null; // código del catálogo de maquinaria
    materiaPrimaId: string | null;
    materiaPrimaNombre: string | null;
    varianteCotizada: { id, sku, anchoMm, precioMl } | null;
    consumoCotizadoMm: number | null;
    piezas: Array<{ anchoMm, altoMm, cantidad }>;  // [] = sin medidas
  }>;
  materiales: Array<{
    materiaPrimaId, nombre: string;
    anchos: Array<{ varianteId, sku, anchoMm, precioMl: number | null,
                    stockMl: number | null }>;
  }>;
}
```

`POST /ordenes-trabajo/tablero/pasos/completar-lote`
`{ pasoIds: string[], ahorro?: { varianteId, anchoMm } }`
→ `{ completados: number, errores: Array<{ pasoId, motivo }> }`.

## 3. Casos borde

- Item con frontera de impresión BLOQUEADA → no aparece (no es
  completable; el tablero ya lo señala).
- Paso sin trazabilidad (OT manual) → job "sin medidas", grupo "Sin
  material"; sólo lote.
- Materia prima con una sola variante de ancho → sin comparador (como el
  film DTF del mock).
- Variante sin precioReferencia → opción sin $, sugerencia por
  desperdicio igual.
- Lote parcial (un paso ya completado por otro / bloqueado a mitad) → los
  demás se completan; errores visibles con motivo.
- Pieza más ancha que todos los rollos → "no entra" (ya lo maneja el
  mock); sigue completable.

## 4. Journey (verificación E2E)

1. Con OTs reales en producción: la cola muestra los pasos por_area en
   frontera agrupados por tecnología real y materia prima real, con los
   anchos del inventario y su stock.
2. Comparador de anchos: ml + % + $ por opción, mejor marcada; ahorro $
   vs. lo cotizado por separado.
3. Excluir un job del batch recalcula todo.
4. "Marcar impresos (N)" completa los pasos del batch → el tablero (en
   otra pestaña) los avanza solo; la cola del simulador baja.
5. Un paso completado desde el tablero desaparece del simulador al
   siguiente poll.

## 5. Después (fuera de v1)

Descuento de stock al completar (cuando inventario tenga consumo por
paso); "enviar a impresión" como estado intermedio en_curso del lote;
export del acomodo (PDF/PNG) para el operador de máquina; digital por
hoja como cola simple si el taller lo pide.
