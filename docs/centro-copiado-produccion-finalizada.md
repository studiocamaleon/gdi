# Centro de copiado: producción finalizada al emitir

En una OT nueva o en borrador, cada ítem de Centro de copiado permite **Marcar producción finalizada**. La selección conserva la cotización y los precios del tarifario. No registra cobro, entrega ni factura.

Al emitir, los pasos activados del cálculo se guardan como hechos, con fecha y responsable de registro. El tiempo asentado copia la duración estimada y conserva la fuente `estimado`; no se crean tramos de cronómetro. La pestaña Producción mantiene la vista habitual y el avance ponderado por pasos.

Estos registros no generan una ruta activa: no crean precedencias, gates, asignaciones, recorridos ni trabajos pendientes en las colas. Tampoco se incluyen en la preparación automática de documentos para imprimir. En una OT mixta sólo los otros ítems siguen el circuito operativo. Si todos están marcados, la OT queda finalizada al emitir.

Los reportes habituales incluyen las operaciones completadas, sus tiempos estimados y la utilización del centro. La eficiencia y los tiempos cronometrados de operadores conservan su criterio de mediciones reales. Las necesidades y reservas de materiales mantienen el circuito de inventario existente; el consumo se registra explícitamente desde Materiales.

La selección se puede cambiar hasta la emisión. Luego conserva el historial: no se permite reabrir estos pasos, recotizar ni quitar el ítem finalizado.

Validación: emisión directa y desde borrador; impresión con plastificado pouch; orden mixta; precios y materiales; rechazo para productos ajenos a Centro de copiado; reporte real de producción, tiempos y utilización; lectura repetida sin duplicados. Pruebas con datos ficticios en la base aislada de tests.
