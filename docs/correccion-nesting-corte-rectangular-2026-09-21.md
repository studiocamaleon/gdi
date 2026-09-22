# Nesting de corte al cotizar por medidas

## Problema y alcance

En «Acrilico impreso en UV», el corte láser configurado con cantidad directa
no producía aprovechamiento al elegir Rectangular. El modo `medidas` desactiva
correctamente el nesting vectorial, pero faltaba su alternativa rectangular.
Esto es independiente de la corrección anterior de piezas interpretadas como m²,
documentada en `correccion-consumo-sustrato-sin-nesting-2026-09-21.md`.

## Comportamiento implementado

- Láser, CNC y mesa de corte digital ejecutan acomodo rectangular cuando se
  cotizan por medidas. La activación se basa en el contrato de la familia.
- Se reutiliza el nesting rectangular existente: cantidades uniformes o
  mezcladas, varias placas, separación, márgenes y rotación.
- Se conserva el formato físico comprado y se limita el acomodo a la zona
  accesible de la cortadora. La placa sobresaliente usa la configuración real
  de la máquina y se explica en el visor; una placa o pieza incompatible
  genera un error de cotización.
- Si hay un layout previo de impresión, se conservan sus posiciones y se
  comprueba material, medidas, cantidades, márgenes y separación. No se
  reacomodan piezas que ya quedaron ubicadas para imprimir. Un material
  declarado heredado sigue sin cobrarse otra vez.
- Los outputs de corte publican piezas terminadas, mientras el nesting cuenta
  placas. El tiempo sigue calculándose por recorrido. Una geometría vectorial
  residual no reemplaza las medidas rectangulares elegidas.
- Las estrategias de costo explícitas prevalecen. Para recetas antiguas de
  cantidad directa sin estrategia definida se conserva superficie exacta.
  Las recetas `CALCULADO_POR_PASO` mantienen el default de placa completa.
  Las reglas explícitas de consumo base × factor o por pieza se conservan.
- Los m² físicos no se reconstruyen dividiendo importes monetarios redondeados.
  Si hay piezas de distintas medidas, se suma su superficie real.
- Cambia la versión de la clave de cotización asíncrona para no reutilizar
  resultados anteriores sin nesting. Los documentos históricos no se reescriben.

Los modos SVG y estimación por placas conservan sus recorridos. Hilo caliente
no recibe este fallback: su familia exige geometría para generar el recorrido.

## Verificación

Caso real, sólo cálculo: 33 piezas de 90 × 40 mm, acrílico de 8 mm,
placa 1220 × 1220 mm, láser 1300 × 1000 mm con sobresaliente en Y:

- 1 placa, 33 placements, 7,981725 % de aprovechamiento.
- 0,1188 m²; costo de material ARS 13.568,93.
- 8,58 m de perímetro, 7,15 minutos de corte; costo de taller conservado.
- Verificado en Chrome: la pestaña Aprovechamiento muestra las piezas y el
  aviso de sobresaliente de 220 mm. No se guardó ni emitió una OT de prueba.

160 tests en 9 suites pasan, incluyendo 18 casos nuevos del recorrido
rectangular, regresiones de nesting vectorial, unidades, costos, merma,
outputs y trabajos asíncronos. TypeScript de API y del nuevo test sin errores.

Ejecutar desde `apps/api`:

```sh
npx jest --runInBand --testPathPatterns='corte-rectangular-nesting|nesting-dispatcher.spec|nesting-config|material-sustrato-sin-nesting|material-placa-unidad-precio|material-rollo-unidad-consumo|outputs-canonicos|consumibles-merma-operativa|cotizacion-jobs.service.spec'
```
