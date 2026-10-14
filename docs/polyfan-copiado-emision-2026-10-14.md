# Polyfan y emisión inmediata de Centro de copiado

Correcciones desarrolladas desde `origin/main`, en `codex/polyfan-copiado-emision`. Sin migraciones ni cambios de datos de staging o producción.

## Comportamiento

- Polyfan respeta la modalidad rectangular explícita del producto. Una pieza de 1150 × 90 mm cabe en la placa de 1200 × 600 mm, también rotada. Se conservan las restricciones físicas de máquina, márgenes y material. Los rectángulos acomodados aportan los contornos necesarios para el recorrido de hilo caliente.
- En modalidad por placas, la cantidad proviene de «Placas totales del trabajo». Se oculta la cantidad general y no se arrastra como multiplicador desde otra modalidad. También se comprueban CNC, láser y troquelado digital.
- Copiado conserva la fecha comercial cuando ETA está incompleta, al reconstruir una carga y cuando una respuesta de precios llega después de editar la fecha.
- Elegir o cambiar cliente revisa automáticamente el pedido de copiado mediante su tarifario. No lo recotiza con el circuito genérico de productos; una respuesta de un cliente anterior se descarta y se calcula el contexto vigente.
- Si todos los ítems son de copiado y tienen la producción marcada finalizada, la acción es «Emitir y entregar». No solicita fecha: usa hoy, en la zona horaria configurada, para la OT y todos sus ítems. Reemplaza fechas anteriores o futuras, también en borradores.
- Exige permiso de entrega y cobros por el 100% del total. Primero emite, después registra los cobros y finalmente entrega. Si un cobro falla, informa que la OT ya existe y que sigue pendiente de entrega. La entrega comprueba los pagos activos en el servidor, sin confiar en el saldo cacheado.

## Comprobación local

- 69 pruebas de interfaz: navegación y emisión, cliente y precios, fechas, edición de cargas y modalidades de geometría.
- 69 pruebas de API: corte rectangular, pago completo y emisión/reservas. Incluye PostgreSQL aislado, con empresas ficticias y reversión de los fixtures: los pagos anulados no cuentan, las aplicaciones no se duplican y un centavo pendiente impide entregar.
- Tipos de los archivos modificados y lint de interfaz. La comprobación global de tipos de la web excedió el límite local de 1400 MB; la compilación completa corresponde a CI remoto.
- Chrome: ficha y formulario de cobro reales en una vista local aislada, con respuestas simuladas. Sin pago, botón bloqueado con explicación; con el total, emisión y entrega sin pedir fecha. El ítem y la OT muestran hoy al terminar. Esta prueba visual no sustituye el recorrido integrado en staging.

Las nuevas regresiones están incluidas en CI. Pendiente publicar el lote en staging y comprobar allí el recorrido completo antes de producción. Los PR de tandas, aviso de descuento, pagos duplicados y conciliación son trabajos independientes; no están incorporados en esta rama.
