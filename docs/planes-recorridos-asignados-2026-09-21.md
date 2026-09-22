# Recorridos con versiones de planes asignadas

Fecha: 21/09/2026. Rama: `codex/rediseno-backoffice-plataforma`.

## Qué se comprobó

Las pruebas publican versiones inmutables de Esencial, Pro y Avanzado, diagnostican el cambio y las asignan a una suscripción manual. El evaluador lee ese contrato desde PostgreSQL durante cada recorrido; no se sustituyen las capacidades en memoria.

Se usa exclusivamente `gdi_saas_test`, con el catálogo de `gdi-demo` como base. Cada escenario se revierte por completo al terminar, incluidas publicaciones, asignaciones y operaciones. Las transacciones internas de los servicios conservan su atomicidad mediante savepoints. No se modifican contratos de empresas operativas.

| Recorrido | Esencial | Pro | Avanzado |
| --- | --- | --- | --- |
| Cotizar con el motor y guardar el cálculo | Verificado | Verificado | Verificado |
| Emitir presupuesto con precio autoritativo, consultar enlace público, registrar aprobación comercial | Verificado | Verificado | Verificado |
| Convertir a OT, emitir, ejecutar tareas en orden, cobrar y entregar | Verificado | Verificado | Verificado |
| Necesidades y reserva automática al emitir | Desactivadas por plan | Activadas | Activadas |
| Promesa de entrega según capacidad al emitir | Desactivada | Desactivada | Registrada |
| Cotizar A4 B/N doble faz con rango `1-3,5` y dos copias | Verificado | Verificado | Verificado |
| Impresión conectada y cola | Denegadas | Denegadas | Denegadas |
| Usuarios y GB leídos del contrato publicado | 3 / 250 | 20 / 500 | 40 / 1500 |

El recorrido comercial utiliza un producto de tarjetas del catálogo de prueba. Los cupos de la tabla se verifican como condiciones resueltas, no como una carga física de cientos de GB ni una prueba nueva de concurrencia de altas.

## Cambios de plan y operaciones abiertas

- **Compras en Pro y Avanzado:** crear, emitir y recibir parcialmente. Bajar a Esencial se bloquea mientras la compra siga abierta. La recepción final permite el cambio; las diez unidades ingresadas permanecen en stock. Repetir una recepción con la misma clave no duplica el ingreso.
- **Producción:** retirar tablero y estaciones mediante una nueva versión permitida por el editor conserva la ejecución de una OT emitida previamente. Las OT nuevas usan preparación manual, que debe confirmarse antes de entregar.
- **PDF pendiente:** retirar la función después de encolar un presupuesto hace que el worker la revalide antes de renderizar. Registra el fallo por capacidad no disponible y no llama al generador.
- **HTTP real:** diagnóstico y asignación con los controladores de Plataforma; idempotencia, rechazo de propiedades no permitidas y cambio efectivo de acceso en la siguiente solicitud. Compras y ETA mantienen los permisos personales además del plan.
- **Empresa bloqueada:** las tareas de asignación y captura diaria de capacidad no consultan ni escriben la planificación.
- **MFA:** consultar el perfil con contexto de empresa devuelve los dispositivos recordados de esa identidad; no suma dispositivos de otra persona.

## Correcciones encontradas

1. Los automatismos de ETA comprobaban inclusión en el plan, pero no el estado operativo de la empresa. Ahora `sincronizarAsignaciones`, `capturarEmision`, `capturarCierre` y `snapshotDiario` usan `puedeOperar`.
2. `PlanVersion` pertenece al catálogo global. Se excluyó de la inyección automática de `tenantId`, que provocaba consultas Prisma inválidas bajo un contexto de empresa.
3. `MfaDispositivo` pertenece a la identidad del usuario. Se corrigió la misma clasificación; `MfaService` mantiene su filtro por usuario para consultar los navegadores recordados.

Se actualizaron las justificaciones de aislamiento y una fixture antigua de ejecución productiva para que utilice el servicio real de capacidades.

## Evidencia reproducible

- `apps/api/src/suscripciones/__tests__/planes-asignados-recorrido.integration.spec.ts`: doce escenarios integrales.
- `apps/api/test/soporte-planes-asignados.ts`: publicación, diagnóstico, asignación y reversión de datos de prueba.
- Regresiones de aislamiento, recorridos de capacidades, asignación de planes, ETA, documentos PDF y perfil/MFA.
- Comprobación de tipos de API y de las pruebas nuevas; lint focal de los archivos nuevos.

Resultado de la selección completa: **129 pruebas aprobadas en trece suites**.

Ejecutar desde `apps/api`:

```sh
npx jest --runInBand src/suscripciones/__tests__/planes-asignados-recorrido.integration.spec.ts
```

## Alcance y pendientes

Esta evidencia cubre recorridos concretos, no todas las combinaciones de las 65 funciones. En la prueba HTTP se inyecta una identidad de prueba: no se repite el inicio de sesión desde el navegador. El contrato, los permisos, la validación, el contexto de empresa y la persistencia sí son reales.

No se realizan envíos de WhatsApp, impresión física, contratación Paddle ni renderizado externo. Centro de copiado usa los metadatos de páginas que recibe del modal; no prueba aquí la lectura del PDF en el navegador. CAD y otros productos requieren recorridos propios con contratos asignados.

Actualización posterior: el historial de Compras ya está disponible por HTTP y desde la interfaz aun sin el módulo contratado. Se comprobaron listado y detalle con recepciones reales, permisos de costos e inventario, aislamiento por empresa y denegación de nuevas operaciones. Ver [incremento de cierre comercial](planes-cierre-comercial-2026-09-21.md).

Quedan transiciones de otras funciones y carreras entre cambios de contrato y nuevas operaciones concurrentes. Los savepoints de estas pruebas no equivalen a sesiones concurrentes independientes.

Actualización del 22/09: precios mensuales y adicionales definidos, ofertas versionadas activas en sandbox y catálogo unificado en registro, checkout, web y suscripción. Se completó un recorrido externo con tarjeta ficticia y webhooks auténticos, incluyendo cambios y baja. Ver [prueba externa y cierre del catálogo](planes-cierre-comercial-2026-09-21.md). Esta evidencia complementa las pruebas internas descritas aquí; no valida cobros de producción ni el envío real del correo de alta.

Actualización posterior del 22/09: controles transaccionales en finanzas y campañas, consulta histórica de proyectos tras retirar el módulo, diagnóstico de hitos pendientes y carreras con conexiones PostgreSQL independientes. Ver [continuidad de finanzas y proyectos](planes-continuidad-finanzas-proyectos-2026-09-22.md).

Nuevo incremento del 22/09: reservas y planificación coordinadas con el contrato, previsión sin reservas, emisiones completas en ambos caminos y carreras de reservas entre conexiones. Ver [evidencia y límites](planes-continuidad-reservas-planificacion-2026-09-22.md).

## Continuidad de avisos — 22/09/2026

Encolado, autorización y recuperación de Wati/WhatsApp Web coordinados con el contrato. Historial conservado al retirar el canal y resolución manual auditada sin reenviar. Evidencia y límites en [continuidad de avisos](planes-continuidad-avisos-2026-09-22.md).

## CAD y guardado de cotizaciones · 22/09

Recorrido CAD hasta la OT verificado con los tres planes publicados, sin impresión conectada. Guardado y recotización revalidan el contrato dentro de su transacción; los tomos conservan la misma protección. Ver [evidencia, transiciones y límites](planes-cad-contrato-asignado-2026-09-22.md).
