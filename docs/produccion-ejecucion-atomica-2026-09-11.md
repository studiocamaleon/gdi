# Base de ejecución atómica para Colas y Tandas

**Fecha:** 11/09/2026. **Estado:** base interna implementada y probada; no habilita todavía los botones de inicio/cierre de tanda.

El comando de producción anterior guardaba una operación por transacción. Repetirlo para varias OT podía dejar una parte completada cuando fallara otra. Ahora `accionPaso` conserva su respuesta pública y delega en `accionesPasos`, que aplica el mismo núcleo a 1–50 operaciones y confirma todo junto.

## Comportamiento

- Un error de material, aprobación, dependencia, estado, permisos o pertenencia revierte todas las transiciones del grupo. También revierte auditoría, progreso, tiempos y primera finalización comercial.
- Se verifica cada trabajo: autorizar el primero no autoriza los demás. Se mantienen la habilitación de estación, la mesa del operario y los permisos de supervisión existentes.
- Dos solicitudes sobre los mismos trabajos compiten por las mismas filas, aunque una venga del Tablero y otra sea conjunta. No se duplican cierres ni tramos.
- La operación física de un nesting compartido sigue gobernando sus participantes dentro de la transacción. No se admite ejecutar un participante separado; sus tiempos continúan en cero.
- Las fechas comprometidas y los tiempos de cotización se conservan. El cierre de pasos `solo_completar` sigue registrando tiempo estimado, sin inventar mediciones humanas.
- Los efectos posteriores al commit se ejecutan una vez por OT. La auditoría de producción y los eventos internos se guardan dentro de la transacción.

## Implementación

- `apps/api/src/ordenes-trabajo/ejecucion-pasos-atomica.ts`: límites, rechazo de duplicados y orden de bloqueos.
- `OrdenesTrabajoService.accionesPasos`: transacción exterior y efectos posteriores. No tiene un endpoint público propio.
- `OrdenesTrabajoService.aplicarAccionPaso`: transición compartida, con lecturas y escrituras sobre el cliente transaccional.
- La autorización de estación y `exigirGatesCumplidos` aceptan ese mismo cliente. Los consumidores anteriores de documentos conservan su comportamiento por defecto.

Se toma primero `Tenant FOR KEY SHARE`, luego las OT ordenadas por ID y sus pasos, incluidos los participantes de nesting. El cerrojo de tenant es compatible con otras ejecuciones del mismo tenant; espera una publicación F6 con `FOR UPDATE`. Las transiciones relacionadas se serializan antes de leer las fronteras. No se depende del orden de selección del navegador para adquirir los cerrojos.

Se conserva la reconciliación previa de cronómetros vencidos que ya realizaba el Tablero; es mantenimiento anterior al grupo de transiciones. Dentro del grupo, cada paso lee el resultado de los anteriores. Se retiró la segunda lectura redundante de la misma frontera bajo esos cerrojos. La lectura del paso selecciona sólo los campos operativos y deja fuera la geometría y los snapshots voluminosos.

## Validación

**47 pruebas en nueve suites**, con **14 integraciones nuevas en PostgreSQL** en la base dedicada de pruebas:

- Cierre entre dos OT con atribución, entregas y tiempos conservados.
- Fallo en el último trabajo por material, aprobación documental, dependencia, estación o mesa: rollback de todo el grupo, incluidos eventos internos y finalización comercial.
- Aislamiento por tenant y correspondencia de paso/ítem/OT; duplicados y límites.
- Dos grupos concurrentes en orden inverso; competencia entre comando individual y conjunto.
- Nesting compartido y rechazo de participantes sueltos.
- Inicio de cronómetro revertido si otro paso falla; sin tramos huérfanos.
- Cierre de 50 operaciones y varias acciones de la misma OT con efectos posteriores únicos.

También pasan los recorridos existentes de cotización→OT, componentes anidados, compras/DAG, concurrencia F4, permisos del Tablero, documentos y lectura/preparación de Colas. TypeScript de API y lint focalizado acompañan la revisión. Los fixtures se eliminan; no se ejecutaron trabajos de la cuenta de desarrollo del usuario.

El lint de los archivos nuevos pasa. El servicio general de OT conserva 40 errores y tres advertencias anteriores fuera del bloque intervenido: se comparó el diagnóstico contra su copia previa al cambio y no hay diagnósticos nuevos (regla de formato excluida en esa comparación). No se declara limpio el lint general. La API de desarrollo recompiló y reinició sin errores.

La prueba de 50 operaciones confirma el límite funcional, no certifica rendimiento con cientos de usuarios concurrentes. No se modificaron pantallas ni se aplicaron migraciones en esta entrega.

## Próximo tramo

Agregar persistencia de tanda, integrantes activos y eventos con idempotencia; después conectar inicio y cierre al núcleo común. Continúan pendientes el inicio de máquinas sin cronómetro, las excepciones con nota/porcentaje, los remanentes, la revisión del impacto sobre entregas y la integración ETA. La base actual no valida compatibilidad técnica ni recupera un resultado guardado ante una respuesta perdida; esas responsabilidades pertenecen al comando de tanda.
