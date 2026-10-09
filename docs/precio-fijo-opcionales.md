# Precio fijo y pasos opcionales

El precio fijo incluye los pasos obligatorios del producto. Cada paso OPCIONAL activado se suma aparte, usando su costo completo y el **Margen de los opcionales (%)** configurado en la pestaña Precio. Los pasos CONDICIONALES mantienen su pertenencia al precio base.

El margen se calcula sobre el precio neto del opcional, igual que los demás márgenes de Grafo. Sin cargas de venta, un opcional con costo de $750 y margen del 25% agrega $1.000. No es un recargo del 25% sobre el costo. Con 0% se recupera el costo más las cargas internas de venta; luego se agrega el IVA que corresponda.

## Alcance

- Aplica a precio fijo, fijo con margen mínimo, precio por cantidades exactas y precio por rangos. En los métodos por margen se mantiene el cálculo sobre todo el costo, sin sumar dos veces los opcionales.
- Incluye tiempo manual del comercial, preparación, materiales, cargos y tercerización del opcional. Los opcionales inactivos no se cobran; los que se activan por dependencia se suman una sola vez.
- El fijo con margen mínimo calcula su piso sobre el trabajo incluido, y luego suma los opcionales.
- Los cargos sin margen de pasos obligatorios quedan incluidos. Los cargos sin margen del opcional se recuperan sin utilidad; los globales conservan su traslado.
- En productos compuestos se respeta la regla de cada bloque: los componentes heredados usan la del padre y los bloques con regla propia usan su configuración congelada. Las operaciones internas no se cuentan dos veces.
- Los precios especiales por cliente tienen su propia regla y su propio margen de opcionales en el mismo editor.
- Descuentos, IVA y cargas comerciales se consolidan una sola vez sobre el resultado.

La configuración se guarda como `precioConfigJson.detalle.margenOpcionalesPct`. Su ausencia equivale a 0%; no se inventan márgenes para productos existentes. La API rechaza valores negativos, no numéricos y mayores o iguales a 100%, y la cotización rechaza la combinación de margen y cargas que impide calcular un precio finito.

Las nuevas cotizaciones usan el contrato `motor-universal-v6`. No se recalculan ni modifican las órdenes o cotizaciones guardadas. No hay migración de base de datos.

## Comprobación local — 07/10/2026

131 pruebas del cálculo de precios, tramos, componentes, cargos, tiempo manual, arrastre y metros lineales; 5 regresiones recorriendo el motor completo con catálogo ficticio; 2 pruebas de contrato y persistencia de snapshot en PostgreSQL de tests. También 19 pruebas web, tipos de API y revisión de tipos de los tres archivos web modificados.

El motor se probó con precio base de $10.000, centro de $6.000/h y margen opcional del 25%: 30, 60 y 120 minutos dan totales de $14.000, $18.000 y $26.000 sin impuestos. Sin activar el opcional permanece en $10.000 aunque cambie el tiempo del paso obligatorio. También se verificó un mínimo comercial de 5 unidades y un opcional arrastrado por otro.

En el navegador se comprobó el editor de Grafo con datos ficticios y el cambio de margen conservando el precio base. La muestra temporal fue retirada. La compilación web completa y la validación operativa en staging quedan para el proceso de publicación; no se desplegó staging ni producción.
