# Cuadros con varias medidas

## Corrección del 13/10/2026

Al agregar una segunda medida, la cotización dejaba de enviar una medida única y el componente de tela seguía buscando ese ancho y alto. El motor rechazaba la fórmula de demasía aunque todas las medidas estuvieran completas. Además, el derivador de bastidores repetía la primera geometría por la cantidad total del pedido.

La herencia de ancho y alto ahora aplica las fórmulas a cada pieza. Conserva cantidades e identidad, calcula área y perímetro del componente y entrega una sola colección al motor hijo: las telas se acomodan juntas y comparten la preparación. Los componentes de geometría fija y las colecciones configuradas explícitamente conservan su comportamiento.

El bastidor se calcula por medida visible, sumando materiales, cortes y tiempos. La compra de barras se optimiza con el despiece conjunto. Se conserva cada variante en la trazabilidad y el visor permite elegir su medida, mostrando el despiece por bastidor y la compra total del trabajo. Las cotizaciones anteriores siguen siendo legibles; una cotización nueva usa el cálculo corregido.

## Comprobación

- Error reproducido en el navegador de producción al añadir una segunda medida, sin guardar ni emitir documentos.
- 113 pruebas de API aprobadas con Node 24, incluidas regresiones de piezas fijas, colecciones vectoriales, perfiles y bastidores de una sola medida.
- Prueba del motor completo con catálogo ficticio: uno, dos y tres tamaños; materiales, tiempos, precio con margen del 25 % y una sola preparación de impresión.
- Caso geométrico ficticio: un cuadro de 25 × 35 cm y dos de 45 × 55 cm, perfil de 25 mm. Necesita 4,9 m de piezas, 12 cortes y dos barras de 3 m. La tela recibe 8 cm adicionales en cada dimensión, respetando las cantidades 1 y 2.
- Tres pruebas del frontend aprobadas y revisión de tipos de los ocho archivos TypeScript afectados.
- Comprobación en Chrome del componente real en una página local aislada, con datos ficticios: cambiar a 45 × 55 cm actualiza el 3D y los cortes a 450/500 mm, conservando la compra conjunta. No sustituye la prueba del formulario completo en staging.

Sin migraciones ni modificaciones de datos en producción. Pendiente: CI, publicar y comprobar el formulario completo en staging; producción requiere autorización posterior.
