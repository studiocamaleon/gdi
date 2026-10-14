# Activar o excluir un paso según el estado de otro

En la configuración del paso del producto, elegir **Condicional** y la variable **Estado de otro paso**. Seleccionar el paso de la misma ruta y **Activo** o **Inactivo**.

Ejemplo: Preprensa → Condicional → Estado de otro paso → Diseño gráfico → Es → Inactivo. Diseño permanece opcional. Si el vendedor activa Diseño, Preprensa no agrega costos, tiempos, consumos ni operaciones de OT. Al desactivar Diseño, Preprensa vuelve. El precio final sigue el método comercial del producto (un precio fijo no se reduce automáticamente por reducir el costo).

La condición puede combinarse con las existentes mediante Y/O. No modifica las configuraciones de productos existentes: cada exclusión se configura donde corresponda.

## Contrato

- La regla guarda `pasoActivo_<rutaPasoId>` con valores numéricos 0/1. El identificador de ruta se conserva al duplicar un producto o alternativa y se traduce al sincronizar una nueva versión de ruta.
- El motor resuelve los estados después del arrastre de opcionales, antes de costear. No depende de si Diseño está antes o después de Preprensa. Ignora estados enviados por el cliente y usa un snapshot interno para los pasos relacionados.
- Se rechazan referencias inexistentes/ajenas a la ruta y ciclos, incluso al modificar el paso referenciado. Una referencia eliminada no se interpreta como inactiva.
- Las relaciones se resuelven con datos del pedido. No admiten reglas que dependan de outputs futuros de producción ni de contextos internos de etapas compuestas. Las condiciones anteriores sobre outputs conservan su comportamiento cuando no participan de esta nueva relación.
- Se configura en una ruta concreta, no en la configuración base reutilizable de una familia. No requiere migraciones.

## Comprobación

Las suites `estado-pasos.spec.ts`, `exclusion-pasos-cotizacion.spec.ts` y `config-pasos-integridad.spec.ts` usan datos ficticios, sin escribir en bases de desarrollo, staging o producción. Comprueban activación/desactivación, arrastre, costos/tiempos reales del motor, materialización de operaciones de OT, referencias, ciclos y traducción de versiones. Las pruebas del constructor visual verifican el guardado y la reapertura de las reglas.

La compilación completa se verifica en CI remoto por el límite de memoria del entorno local. No hay despliegue implícito al abrir el PR.
