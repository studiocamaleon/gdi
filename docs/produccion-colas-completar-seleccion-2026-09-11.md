# Colas de trabajo: los mismos controles de ejecución que el Tablero

Actualizado el 12/09/2026. Colas es una vista unificada por máquina; no constituye otro sistema de ejecución. Se mantienen retiradas las tandas sugeridas y la preparación de tandas.

## Recorrido vigente

1. Abrir una máquina con trabajo. Se mantienen el orden por cantidad, búsqueda, grupos de lectura por material/formato/color y filtros Todos, Listos, En curso, En espera y Pausados.
2. Cada fila ofrece las acciones que corresponden al paso según su estado, modo de registro, permisos y dependencias. El modo `cronometro` admite Iniciar → Pausar/Continuar → Completar; `solo_completar` ofrece Completar y Bloquear. Desbloquear exige supervisión. En Kanban también se conserva Reabrir cuando corresponde; Colas sólo lista trabajo pendiente.
3. Bloquear exige motivo. Pausar usa el mismo catálogo y exige explicación si se elige Otro. El formulario permanece abierto ante un error para no perder lo escrito.
4. Completar un cronómetro sin tiempo medido suficiente abre la consulta de tiempo: valores orientativos, otro tiempo en minutos o **Completar sin tiempo**. El umbral es el mismo que en la API: al menos un minuto o el 10 % del estimado, lo que sea mayor; suma tramos cerrados y el tramo abierto.
5. El operario conserva las reglas de su estación y de Mi mesa. Para un trabajo libre se ofrece **Mover a mi mesa** usando el comando existente. No se reclama silenciosamente ni se omite la asignación. Los supervisores conservan su alcance habitual.
6. La acción actualiza Colas y notifica al widget de tramos en curso. Progreso, etapas siguientes, ETA y cierre de OT se derivan con el núcleo canónico de producción.

## Completar varios trabajos

Las casillas permiten elegir trabajos sin exigir compatibilidad técnica. No agrupan físicamente trabajos ni modifican nesting o compromisos.

**Completar seleccionados** comprueba que todos ofrezcan esa acción. Si uno no puede completarse, identifica el trabajo. Si hay cronómetros con tiempo insuficiente, pide la decisión de tiempo de cada uno **antes de guardar ninguno**. Al terminar la revisión envía toda la selección en una sola solicitud; cancelar, incluso después de responder por algunos trabajos, no completa nada.

Cambiar filtro, página o máquina limpia la selección. Un refresco no descarta silenciosamente integrantes desaparecidos. El guardado admite hasta 50 operaciones, bloquea dobles envíos y conserva la transacción conjunta: cualquier error revierte toda la selección.

## Implementación compartida

- `src/lib/acciones-produccion.ts`: política de controles, criterio de tiempo insuficiente y sugerencias de minutos. Reutiliza el umbral del backend.
- `src/components/produccion/paso-acciones.tsx`: botones y formularios compartidos por Kanban y Colas. El detalle de Kanban conserva los formularios dentro de su panel; Colas los abre en un Dialog. No se duplican las decisiones de ejecución.
- `src/components/produccion/completar-seleccion-cola.tsx`: reúne las decisiones individuales antes del guardado conjunto, reutilizando el mismo formulario de tiempo.
- `AccionesColaController` y `OrdenesTrabajoService.accionesPasos`: las acciones individuales y el completado múltiple usan el mismo núcleo transaccional del Tablero, con sus cerrojos y eventos.
- `tiempos-ejecucion.ts`: suma de tramos cerrados compartida por ambas proyecciones.

### API

`POST /produccion/colas/:maquinaId/pasos/:pasoId/accion` recibe el mismo `AccionPasoOrdenTrabajoDto` que el Tablero: acción, motivo, detalle y datos de tiempo.

`POST /produccion/colas/:maquinaId/completar` recibe `{ pasoIds, tiempos? }`. Cada entrada de tiempos identifica su `pasoId` y lleva `tiempoDeclaradoMin` o `sinTiempoConfirmado: true`. No admite declaraciones duplicadas ni ajenas a la selección.

Todas las vías preservan tenant, permisos, estación, Mi mesa, estado, dependencias, documentos, material/calidad y ejecución compartida. Si el tiempo medido es insuficiente, el comando canónico exige declarar minutos o confirmar explícitamente que se completa sin tiempo. Esta última decisión conserva la fuente `invalido`; nunca inventa minutos. El widget En curso también envía esa confirmación al elegir su opción existente.

Se retiró la excepción de Colas que permitía iniciar pasos `solo_completar`, así como la excepción de asignación que permitía operar trabajos fuera de Mi mesa. No se cambian los modos de registro configurados ni los tiempos cotizados.

## Estilos y retirada

Se conservan las primitivas shadcn y el tema visual aprobado. Los formularios usan Field, Input, ToggleGroup y Dialog. Se eliminaron los estilos globales exclusivos de los antiguos formularios de acciones; `ds-chip` se conserva porque lo usa Salud ETA.

Las sugerencias de rollos, Preparar tanda y sus endpoints/componentes/estilos exclusivos siguen retirados. Los documentos anteriores de tandas son antecedentes, no una implementación pendiente autorizada. Los motores de nesting de cotización/F6 y el ETA general conservan sus funciones.

## Verificación

- Integración PostgreSQL: acciones equivalentes en Colas y Tablero, rechazo de iniciar `solo_completar`, pausa/continuación con tramos, bloqueo/desbloqueo, tiempo medido/declarado/sin tiempo, rollback completo, permisos/tenant/máquina/mesa, doble inicio y declaraciones ajenas o duplicadas.
- Regresión del núcleo atómico, consultas de Colas, registro de tiempos, seguridad del Tablero y recorrido cotización → emisión → ejecución → cierre. Los fixtures que completan instantáneamente confirman explícitamente que no registran tiempo.
- Frontend: combinaciones de acciones/estado/modo/permisos, umbral temporal, selección libre y render de controles.
- Navegador: formulario de bloqueo con motivo obligatorio y cancelación. Prueba aislada con los componentes reales: cancelar un cierre individual no registra nada; cancelar a mitad del cierre múltiple tampoco; completar la revisión produce una única confirmación con las decisiones de ambos trabajos. No se alteraron OT reales.
- TypeScript frontend/API, lint focalizado y guardia CSS.
