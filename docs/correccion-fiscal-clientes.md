# Clientes y corrección de facturas

La pantalla de nuevo comprobante mostraba sólo los primeros 200 clientes y la corrección abría un formulario vacío, con Consumidor Final como receptor. Ahora la búsqueda consulta todo el padrón por nombre, razón social o CUIT (con o sin guiones), permite recorrer páginas de 30 y conserva la selección. Al elegir una orden consulta expresamente su cliente, aunque esté fuera de la página inicial. La vista muestra razón social, CUIT y condición fiscal antes de crear el borrador; la fecha inicial usa la zona de la empresa.

Desde el detalle de una factura emitida, **Nota de crédito** abre la corrección total con los datos originales. **Crear borrador de nota de crédito** copia sus ítems, descuentos, alícuotas, moneda, cotización y todos los vínculos con órdenes. Este paso no solicita CAE ni envía avisos. La emisión continúa en el detalle mediante la acción existente, con el permiso independiente de anular.

Una nota conserva el receptor y la letra de la factura original, aunque la ficha del cliente haya cambiado. Al emitirse, el circuito existente libera el importe facturado y conserva los cobros de las órdenes. La nueva factura se prepara desde la orden y toma los datos actuales del cliente; los cobros se vuelven a imputar sin duplicar deuda. La corrección total no se ofrece si hay otra nota vigente o pendiente: se muestra su acceso para revisarla. Las notas parciales anteriores requieren revisar su saldo antes de otra corrección, y se mantiene el circuito parcial de las órdenes.

Si razón social, CUIT, condición fiscal o nombre cambian después de preparar una factura, se rechaza su primer envío antes de asignar un número o contactar al proveedor. El operador puede descartar el borrador y preparar uno nuevo. Los envíos ya admitidos o inciertos conservan su identidad para la consulta y recuperación; las facturas emitidas nunca se reescriben.

El detalle y el PDF leen el CUIT histórico, incluso cuando era nulo, y el detalle muestra la razón social y condición fiscal guardadas. No se reemplazan con los datos posteriores de la ficha.

Referencias oficiales: [ARCA: corrección mediante nota asociada](https://www.afip.gob.ar/genericos/guiavirtual/consultas_detalle.aspx?id=6490326) y [ARCA: mismo receptor del comprobante original](https://servicioscf.afip.gob.ar/publico/abc/consultas_detalle.aspx?id=24548274).

## Verificación local

108 pruebas de API y 32 de interfaz aprobadas. Incluyen factura B pagada, cambio del receptor a RI, NC B, nueva factura A por el mismo total, conservación y nueva imputación del pago; documentos agrupados; descuentos; distintas alícuotas; USD; CUIT agregado posteriormente; rechazo de crédito duplicado; cliente fuera del primer límite; búsqueda con guiones; permisos HTTP y separación entre empresas. Los proveedores fiscales y los avisos se simulan: no se emiten comprobantes reales.

Base PostgreSQL temporal independiente, con migraciones del proyecto y exclusivamente datos ficticios. No se usaron datos ni credenciales de staging para ejecutar el sistema local, ni se modificaron bases existentes. Sin migraciones nuevas. Tipos de los módulos afectados y lint de interfaz comprobados; la compilación completa se ejecuta en CI remoto.

Validación visual local completada en Chrome: búsqueda y selección de un cliente fuera del límite anterior, datos fiscales y letra resultante, vista de corrección con receptor y total originales. Los fixtures visuales temporales se retiraron.

## Verificación en staging

El [PR #130](https://github.com/studiocamaleon/gdi/pull/130) se publicó en staging con revisión funcional `821dd09e5e1d785e5f76a3e3690f056448104267`. Compilaciones remotas y CI aprobados, sin alertas abiertas de CodeQL. Con el código compilado se repitió el circuito B pagada → NC B → nueva A: total y pago de 121 conservados, saldo cero, identidad original de la nota y rechazo del borrador desactualizado. Se comprobaron búsquedas fuera del límite anterior, por ID y por CUIT con guiones. Todos los datos fueron ficticios, se usó exclusivamente el proveedor manual y la transacción se revirtió por completo; no hubo emisiones fiscales ni avisos externos.

La revisión ejecutada en web, API y ambos workers coincide. Web/API responden 200; la búsqueda anónima responde 401 y la API privada rechaza el acceso directo con 403. Recursos y encendido bajo demanda conservados; retención temporal liberada. Versiones, respaldo y reversión en [el registro de staging](../deploy/staging/VALIDACION.md).

## Publicación en producción

Lucas autorizó publicar e integrar el cambio y confirmó que deben utilizarse los datos actuales del cliente. Se promovieron las mismas imágenes verificadas, sin reconstruir. Chrome comprobó la búsqueda, la identidad actual y su letra A, y la corrección con identidad, letra e importe originales. La API y el worker fiscal conservaron su configuración, y la consulta de conexión con ARCA de producción fue correcta. La comprobación no creó borradores, notas de crédito ni facturas reales.

La nota se prepara desde **Nota de crédito** en la factura original y se revisa antes de emitirla. Después se abre la orden vinculada y se vuelve a facturar con los datos actuales; el pago se conserva. Antes de emitir, el operador debe revisar la identidad fiscal y los importes del borrador. Ver [el registro de producción y su reversión](../deploy/produccion/VALIDACION.md).
