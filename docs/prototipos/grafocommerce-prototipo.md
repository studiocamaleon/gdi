# GrafoCommerce — Prototipo de experiencia

Fecha: 22/09/2026. Rama: `codex/grafocommerce`.

## Alcance

La [fuente de la propuesta](grafocommerce-prototipo.html) es un fragmento interactivo para revisar en la conversación. Usa la identidad visual de Grafo y una tienda de ejemplo de Gráfica Corporearte.

Recorridos incluidos:

1. Portada y catálogo con tarjetas de visita y lona a medida.
2. Configuración, cálculo ilustrativo y PDF de ejemplo o selección local de un nombre de archivo.
3. Carrito con varios productos; edición, eliminación y adjunto pendiente.
4. Datos de comprador ficticios, retiro y elección entre pago online simulado y transferencia.
5. Confirmación y seguimiento del pedido.
6. Recepción en Grafo, confirmación de transferencia, aprobación individual de archivos y creación de una OT de prueba.
7. Consulta del pedido por el cliente después de la aceptación.

Se puede ajustar el acento y el espaciado con los controles de diseño del visor. La apariencia acompaña el tema claro u oscuro de la aplicación. La composición se adapta a escritorio y móvil.

## Límites de la muestra

- Los precios se calculan con fórmulas locales ilustrativas. No se conectan al motor ni representan tarifas del tenant.
- Plazos, impuestos, materiales y condiciones de archivo son ejemplos para discutir la interacción.
- El comprador es ficticio. No se solicitan credenciales ni datos de tarjeta; tampoco se envían correos.
- Seleccionar un PDF sólo registra su nombre. No se lee ni sube el contenido, ni se valida su calidad de impresión.
- Aprobar un archivo y emitir una OT cambian estados locales; no crean registros ni inician producción.
- El prototipo conserva hasta ocho ítems por carrito y los últimos tres pedidos de prueba en el estado del visor. Estos son límites del prototipo, no del add-on comercial.
- La navegación lateral de Grafo aporta contexto; el único módulo simulado es Commerce.
- La administración de catálogo, apariencia, dominios y cobros todavía no está prototipada.

## Verificación realizada

Pruebas mediante navegador sobre el fragmento renderizado:

- Tarjetas: elegir 1.000 unidades y laminado mate; importe de muestra de AR$ 71.240.
- Lona: 120 × 200 cm, dos unidades, ojales perimetrales; importe de muestra de AR$ 84.600.
- Carrito combinado: AR$ 155.840, con configuraciones y archivos conservados.
- Ancho de 180 cm: agregar al carrito bloqueado con explicación del rango permitido.
- Ítem sin PDF: checkout bloqueado hasta adjuntar el archivo de ejemplo.
- Transferencia: pedido recibido con pago pendiente y aceptación deshabilitada.
- Confirmación del pago más aprobación parcial: la OT permanece bloqueada.
- Aprobación de ambos archivos: creación de una única `OT-DEMO-001`; botón de emisión deshabilitado después.
- Vista del cliente refleja la OT emitida y el estado de los archivos.
- Edición de un ítem a 250 unidades: actualiza el mismo ítem y su importe.
- Pago online simulado: entra confirmado, con archivos todavía pendientes de revisión.
- Presentación revisada en escritorio y en anchos de navegador de 390 y 320 px; sin desborde horizontal en las vistas comprobadas.
- Sin errores de JavaScript registrados durante los recorridos probados.

## Decisiones a revisar

- Densidad de la ficha y posición del resumen de precio.
- Exigir PDF antes de confirmar frente a permitir aportarlo después.
- Aceptación manual inicial antes de emitir la OT.
- Alcance del checkout y del retiro/envío para el piloto.
- Presentación pública de las opciones de cada familia de producto.

El [plan maestro](../grafocommerce-plan-maestro.md) mantiene el alcance general, las decisiones pendientes y las etapas de implementación.
