# Conversión de presupuesto a OT

Actualizado: 23/09/2026.

- Convertir un presupuesto aprobado crea una **OT emitida, en estado pendiente**.
  Se materializan los pasos, reservas y enlaces habituales de una emisión.
- Con ETA habilitada, se simula el taller actual dentro de la transacción de
  emisión, con todos los productos seleccionados juntos. Se ignoran las fechas
  antiguas para evitar que un presupuesto vencido en entrega gane prioridad.
- Cada ítem obtiene su fecha según pasos, dependencias, estaciones, máquinas,
  calendarios, días no laborables y margen del tenant. Los productos compuestos
  esperan a su último componente; la OT toma la última entrega de sus ítems.
- La disponibilidad de materiales usa las cantidades físicas de los snapshots
  actuales de la OT, antes de reservar stock. Si necesita compras, se planifica
  conservadoramente desde el día siguiente a la reposición de todo el material.
- Si falta una ruta, estación o tiempo estimable, se informa
  el motivo y se revierte la emisión completa. No queda un borrador ni una OT
  parcialmente guardada. El presupuesto permanece aprobado.
- Los importes siguen siendo los aceptados en el presupuesto; este recálculo
  sólo modifica la planificación de entrega.
- Sin ETA en el plan, se utiliza la fecha comercial. Si ya pasó o no existe,
  se solicita una fecha vigente antes de emitir; no se bloquea la conversión
  por no contratar ETA.
- La OT, las fechas, el estado del presupuesto y el evento de conversión se
  guardan juntos. Se serializa la conversión por empresa y se impide convertir
  el mismo ítem dos veces, incluyendo selecciones simultáneas superpuestas.
- La conversión parcial emite sólo lo seleccionado. Las siguientes conversiones
  consideran la carga de las órdenes anteriores.

Validación: integración con PostgreSQL aislado, emisión real y motor ETA real;
casos de varios ítems, cola previa, reposición, fallo completo, conversión parcial,
plan sin ETA, idempotencia y concurrencia. Los servicios de notificaciones están
simulados: las pruebas no envían mensajes a clientes ni crean OTs de desarrollo.

Cuando falta confirmar la reposición de materiales, la conversión emite la OT con entrega por confirmar. Conserva precios y materiales; registra los faltantes. Una selección automática estricta se revalida al emitir: si cambió el stock, pide revisar sin sustituir silenciosamente el material aprobado.
