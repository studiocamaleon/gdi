# Cantidades decimales en el cotizador

## Corrección — 06/10/2026, pendiente de publicar

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
DTO y funciones del motor. No se guardaron órdenes reales ni se desplegó esta
corrección. Se agrupa con el resumen de unidades de niveles pendiente del PR #25.
