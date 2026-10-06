# Cantidades decimales en el cotizador

## Corrección — 06/10/2026, publicada en staging y producción

El control compartido de cantidad usaba un campo numérico nativo y convertía
su texto en cada pulsación. Podía perder la coma o el punto antes de completar
`0,5`. Afectaba a la venta directa por metro lineal, independientemente de que
la ruta fuera de plotter, impresión o corte manual.

El campo conserva el texto durante la edición y entrega al cálculo un número.
Acepta coma o punto decimal en los controles por medida; los productos por
unidad mantienen cantidades enteras. Los botones de medidas avanzan de a 0,1;
se pueden escribir otras fracciones, como 0,25. Un campo vacío no cotiza ni
permite agregar el ítem con un valor por defecto.

Al editar un ítem vendido por metro directo, se recuperan los metros guardados,
en lugar de la cantidad técnica de piezas. Por ejemplo, 0,5 metros representa
una franja de 500 mm de largo y una sola pieza técnica; vuelve a mostrar 0,5
al reabrir el configurador.

Los mínimos comerciales siguen vigentes. Si un producto requiere facturar un
mínimo de un metro, ingresar medio metro conserva la medida real y muestra el
aviso del mínimo. No se alteran precios, existencias ni configuración comercial.

## Comprobación

- 29 pruebas web: escritura progresiva, coma y punto, botones, cantidades
  enteras, campo vacío, geometría de medio metro, agregado y reapertura del ítem,
  mínimo comercial y regresiones de cantidad y geometría.
- 49 pruebas API: contrato de entrada con metros fraccionarios y mínimos
  comerciales. La API ya admitía estas medidas; no cambia su código funcional.
- Tipos de los tres archivos web modificados comprobados; lint de los dos
  archivos nuevos y revisión del diff sin errores.

Pruebas de interfaz con datos ficticios y API simulada, más validación real de
DTO y funciones del motor. El recorrido posterior en staging cotizó el producto
Vinilo de corte con 0,5 y 0,25 m y comprobó el campo con coma y vacío en el
navegador. Publicado junto con el lote del PR #26, revisión `a9c2d563d`; no se
guardaron órdenes de ensayo en producción. Ver [el registro de publicación](../deploy/produccion/VALIDACION.md).

## Corrección adicional del precio por largo — 06/10/2026, sólo local

La prueba anterior verificaba la cantidad comercial, pero no comparaba el
consumo ni el precio de distintas fracciones. Se detectó un segundo problema
en el motor: la separación automática entre piezas se convertía en demasía
para una franja completa. Eso reducía otra vez el ancho útil; una franja corta
giraba y una larga no entraba. El plotter, sin layout, seguía con el área cruda
en un slot que necesitaba metros lineales.

La venta directa por metros mantiene la orientación del rollo y no agrega
demasía a partir de una separación implícita. Respeta las demasías explícitas
del paso o de la familia, y los márgenes físicos configurados. Un corte en rollo
sin layout válido se rechaza, en lugar de usar m² como metros. Se conserva el
tratamiento de hojas y pliegos heredados.

Con márgenes longitudinales de 10 mm al inicio y al final, 0,5 m consume
0,52 m y 1 m consume 1,02 m. Los tiempos de preparación siguen siendo fijos:
el precio de medio metro puede superar la mitad del precio de un metro.

- 172 pruebas API aprobadas en ocho suites, incluidas once nuevas que calculan
  nesting, consumo, tiempo y precio para 0,25 / 0,5 / 1 / 1,5 / 2 metros.
- Regresiones cubiertas: impresión en rollo, cotización por piezas, corte sobre
  hojas, mínimos comerciales, demasías explícitas y rechazo de medidas que
  no entran.
- Comparación adicional del motor local contra la configuración vigente,
  usando una transacción de sólo lectura. Sin guardar órdenes ni cambiar datos.
- Revisión de tipos focalizada en los tres archivos TypeScript del cambio.
  La revisión global con límite de 1,5 GB no terminó por falta de memoria;
  la compilación completa queda para el proceso remoto previo al despliegue.

Esta corrección del motor todavía no está publicada en staging ni producción.
