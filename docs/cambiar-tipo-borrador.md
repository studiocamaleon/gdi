# Cambiar entre borrador de OT y presupuesto

En la cabecera de una OT guardada en borrador aparece **Cambiar a presupuesto**. En un presupuesto vigente sin enviar aparece **Cambiar a orden de trabajo**. Hay que guardar o cancelar una edición pendiente antes de cambiar el tipo. Se necesitan las funciones de cotización, órdenes y presupuestos y permiso para gestionar ambos documentos.

La acción conserva cliente (también puede estar sin asignar), canal, vendedor, campaña, observaciones, productos, cantidades, especificaciones, descuentos, fechas, cargos y los snapshots de precios, costos y receta. No vuelve a cotizar. Los adjuntos se trasladan sin duplicar archivos; las reservas de puntos/cupones y la planificación se trasladan al destino. Los PDF generados permanecen en su documento histórico. El tratamiento sin comprobante se conserva también al volver a OT.

OT y presupuesto tienen almacenamiento diferente. Por eso se crea el documento de destino y se archiva el de origen en la misma transacción. Ambos historiales registran el cambio. Se puede volver a cambiar el nuevo borrador. No se emite, cobra, envía ni genera producción al realizar esta acción. La numeración comercial de OT se asigna recién al emitir.

La operación valida estado y versión, permisos, empresa y funciones contratadas. Una identidad determinista por documento de origen permite reintentar sin duplicar. Las solicitudes concurrentes se serializan, y cualquier error revierte también el traslado de archivos, reservas y contador. No se admite cambiar una OT emitida, con producción, cobros o facturas; tampoco un presupuesto enviado, histórico o convertido. Esos documentos conservan su circuito comercial habitual.

## Comprobación

- Pruebas PostgreSQL en `gdi_saas_test`, con empresas y documentos ficticios: ida y vuelta, presupuesto nativo, importes y snapshots, adjuntos por ítem, sin comprobante, reservas y planificación, doble solicitud simultánea, revisión vencida, estados incompatibles, permisos, separación entre empresas y rollback ante fallo.
- Pruebas de interacción de la acción: ambos sentidos, bloqueo durante la solicitud y la edición pendiente, error sin navegación ni pérdida del documento, permisos.
- Regresión de edición y detalle de presupuestos y de conversión comercial; nuevos casos incluidos en CI.

Sin migraciones ni cambios en staging o producción. La mejora parte de `main` y es independiente del lote de cantidad manual y exclusión de pasos.
