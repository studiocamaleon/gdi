# Descuentos en órdenes ya creadas

En la ficha de una OT, los botones de descuento y cupón del resumen permiten ajustar el precio sin entrar a editar sus productos. Se puede aplicar un porcentaje, un monto neto, un cupón habilitado o quitar el descuento. El ajuste también está disponible cuando la orden está en producción o terminada.

## Controles

- Requiere acceso a Órdenes y permiso para gestionarlas. No requiere acceso a costos; se conserva la proyección de datos por permisos.
- No se admite en órdenes canceladas ni con facturación emitida, preparada o en proceso. Se comprueban tanto los importes como los comprobantes vinculados.
- El total nuevo no puede quedar por debajo de lo cobrado ni ser negativo después de un canje de puntos. Primero se debe resolver la diferencia en los cobros.
- Se respeta el máximo de descuento sin aprobación configurado para operadores. Los cupones conservan sus reglas de alcance, vigencia, cliente y usos.
- La versión de la orden y los bloqueos de base impiden sobrescribir ajustes concurrentes. Un cupón reaplicado no duplica su uso; quitarlo y volver a aplicarlo vuelve a consumirlo cuando corresponde.

## Datos que cambian

El servidor calcula a partir del neto de lista histórico de cada línea y sus alícuotas guardadas. El descuento reemplaza al anterior; no se acumula sobre el precio ya descontado. Los montos se reparten entre las líneas y se redondean según la configuración regional. Un cupón afecta solamente los productos que alcanza; un descuento manual general o «Quitar descuento» actúa sobre toda la OT.

Se recalculan impuestos por fuera, cargos porcentuales, total y descuento total. El saldo utiliza el nuevo total y los cobros existentes. Se guarda una revisión de precio y un evento con el usuario y los importes anterior y nuevo. El presupuesto original, los costos de producción, materiales, archivos, pasos, tiempos y avance se conservan.

No se generan facturas, devoluciones ni mensajes al cliente al ajustar el precio. Una OT facturada necesita resolver sus comprobantes mediante el circuito correspondiente antes de cambiar su precio.

## Verificación

Pruebas unitarias de prorrateo, alícuotas y límites; pruebas con PostgreSQL aislado de conservación de pasos y presupuesto, concurrencia, usos de cupones, comprobantes preparados, cobros, permisos de descuento y separación entre empresas; pruebas de interfaz de aplicación y rechazo sin modificar la ficha. Los resultados de despliegue y del recorrido real se registran en los documentos de validación de cada entorno.
