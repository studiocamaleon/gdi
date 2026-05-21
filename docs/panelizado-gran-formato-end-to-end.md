# Panelizado gran formato end-to-end

## Alcance

El panelizado configurable vive en la configuracion canonica por paso:

`ProductoConfigPaso.paramsPasoJson.nestingConfig.panelizado`

Aplica solamente a pasos de `impresion_por_area` sobre rollo con algoritmos `auto`, `shelf-rollo` o `maxrects-rollo`. `plotter_corte` queda excluido: no muestra UI, no guarda configuracion nueva, no migra configuracion legacy y el dispatcher apaga cualquier panelizado accidental antes de ejecutar nesting.

## Shape canonico

```json
{
  "enabled": true,
  "mode": "automatic",
  "axis": "automatic",
  "overlapMm": 20,
  "maxPanelWidthMm": 0,
  "distribution": "equilibrada",
  "widthInterpretation": "total",
  "manualLayout": null
}
```

- `mode`: `automatic` o `manual`.
- `axis`: `automatic`, `vertical` o `horizontal`. En ejecucion, `automatic` prueba vertical y horizontal y elige el mejor layout.
- `overlapMm`: solape entre paneles.
- `maxPanelWidthMm`: si es `0`, `null` o menor a `300`, el motor usa el ancho imprimible del rollo. El mínimo evita que configuraciones legacy en otra unidad generen tiras demasiado angostas.
- `distribution`: `equilibrada` o `libre`.
- `widthInterpretation`: `total` o `util`.
- `manualLayout`: conserva el formato legacy con `items[]`, `sourcePieceId`, medidas de pieza, `axis`, `panels[]`, medidas utiles, solapes y medidas finales.

## Migracion legacy

El script idempotente esta en:

`apps/api/prisma/scripts/migrate-legacy-wide-format-panelizado.ts`

Uso sugerido desde `apps/api`:

```bash
npx ts-node prisma/scripts/migrate-legacy-wide-format-panelizado.ts
```

Reglas:

- Lee configuracion legacy desde `ProductoServicio.detalleJson.imposicion` cuando existe.
- Si el ambiente legacy no tiene esa columna, intenta leer `ProductoVersion.parametrosJson.imposicion`.
- Relaciona producto legacy y producto actual por `tenantId + codigo`.
- Copia solo a `ProductoConfigPaso` cuyo `RutaPaso.familiaCodigo` es `impresion_por_area`.
- Copia solo si el algoritmo del paso es `auto`, `shelf-rollo`, `maxrects-rollo` o no esta definido.
- No sobrescribe pasos que ya tienen `nestingConfig.panelizado`.
- No copia nada a `plotter_corte`.

Mapeo principal:

- legacy `automatico` -> `automatic`
- legacy `manual` -> `manual`
- legacy `automatica` -> `automatic`
- legacy `vertical` / `horizontal` -> igual
- `manualLayout` / `layoutManual` se conserva sin transformar si es objeto valido.

## Comportamiento esperado

- Si `enabled = false`, el motor conserva el comportamiento actual.
- Si `axis = automatic`, se evaluan vertical y horizontal y se elige el mejor candidato con el criterio existente del nesting de rollo.
- Si `mode = manual`, se usa `manualLayout`. Si no coincide con las piezas actuales, el algoritmo no genera layout para evitar cotizar una division invalida.
- En trabajos mixtos, las piezas que entran completas siguen entrando completas; solo se panelizan las piezas que lo necesitan.
- `plotter_corte` nunca ejecuta panelizado, incluso si llega configuracion vieja o accidental.
