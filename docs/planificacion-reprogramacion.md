# Cambiar fechas desde Planificación

La vista permite seleccionar una operación, abrir **Ver detalle** y, en
**Fechas de producción y entrega**, elegir:

- **Reprogramar producción**: cambiar fecha y hora de inicio del paso y sus
  sucesores, o de todo el ítem/lote que todavía está pendiente. La hora corresponde
  a la zona del taller. Es el inicio más temprano solicitado; el calendario, los
  recursos disponibles y las dependencias determinan el horario posible.
- **Cambiar entrega**: modificar explícitamente el compromiso del producto o del
  lote elegido. La vista previa muestra también la entrega final de la OT.

**Revisar impacto** no escribe. Muestra horarios anteriores y propuestos,
operaciones afectadas, restricciones y entregas que requieren revisión. Cambiar
la fecha, hora o alcance invalida esa vista previa. **Confirmar cambio** guarda la
propuesta y actualiza el calendario. El motivo es opcional y queda en el historial.

## Reglas

- Reprogramar producción conserva las promesas comerciales, duraciones cotizadas,
  requisitos operativos, estados y registros de ejecución.
- El ítem completo incluye sus componentes. Si el paso pertenece a un lote de
  entrega, se cambia ese lote, no sus hermanos. Los sucesores se recalculan con
  las precedencias del motor, incluidas las rutas antiguas por índice.
- Los pasos iniciados y los ítems entregados no se reprograman. Tampoco se puede
  mover una dependencia pendiente cuyo sucesor ya se inició.
- Se reutiliza el motor de capacidad existente, sus horarios, feriados, recursos y
  reservas. Una agenda incompleta no se puede confirmar. Los bloqueos pendientes
  se advierten y siguen impidiendo ejecutar el trabajo cuando corresponda.
- Un inicio previo sin ventana final puede representar disponibilidad de material.
  Se conserva como inicio mínimo en la referencia aceptada, incluso después de
  reprogramar nuevamente. No se modifica stock ni se confirma su recepción.
- El inicio de producción admite un horizonte de 119 días. La fecha de entrega
  es una fecha civil sin hora. Ambas se validan en la zona del taller.
- Cambiar una entrega conserva las demás promesas, también las que antes heredaban
  la fecha de la orden. El cierre de la OT es el último compromiso de sus productos;
  queda sin fecha si todavía hay productos sin compromiso.
- En productos distribuidos por lotes hay que seleccionar el lote concreto para
  cambiar su entrega. Un componente compartido no puede cambiar todas las entregas
  de forma implícita.
- Las operaciones agrupadas en un trabajo conjunto de nesting no se pueden mover
  por separado desde este editor. Se informa esa limitación antes de guardar.

## Acceso y persistencia

Las rutas `POST /ordenes-trabajo/tablero/pasos/:pasoId/reprogramacion/simular` y
`/confirmar` requieren acceso a Planificación y la capacidad
`planificacion_avanzada`. Producción requiere `produccion.supervisar`; cambiar una
entrega requiere `comercial.ordenes.gestionar`. Se comprueba también el permiso al
confirmar, aunque el formulario se hubiera abierto antes.

La revisión vence en dos minutos. Está firmada y vinculada al usuario, empresa,
paso, solicitud, contexto e impacto. La confirmación vuelve a consultar y simular
bajo una transacción serializable; rechaza cambios concurrentes. Los bloqueos
son por empresa, sólo durante la confirmación. Una confirmación duplicada no
publica un segundo cambio.

Se guardan ventanas y atención planificada en los campos existentes, referencia
con historial, evento de la OT con diferencias e invalidación interna del tablero.
No hay migraciones, servicios nuevos ni envíos a clientes. La entrega y la
producción se editan por separado.

## Validación local del 09/10/2026

- API: 54 pruebas en siete suites (15 de integración de esta mejora, dos HTTP y
  regresiones de asignación, referencias, lotes y reprogramación de capacidad).
- Frontend: 92 pruebas en cinco suites, incluyendo revisión, invalidación por
  cambio de alcance, confirmación, errores, vencimiento y cálculos del calendario.
- Tipos de los archivos modificados, ESLint del frontend, `css:guard` y diff sin
  errores de espacios. La compilación completa de contenedores corresponde a CI.
- Comprobación en Chrome local a 1920 px y 390 × 844: selección de alcance, vista
  previa, confirmación, cierre y edición de entrega; sin desbordamiento horizontal
  ni errores de consola. Acciones fijas visibles en pantalla pequeña.
- La muestra de `/dev/diseno/reprogramacion` usa datos ficticios en memoria y no
  llama a la API. La persistencia se prueba con empresas temporales en
  `gdi_saas_test`. No se operaron staging ni producción.

Rama `codex/planificacion-reprogramacion`, dependiente del PR #52
(`codex/colas-pantallas-pequenas`). La base conserva la versión desplegada y sus
correcciones previas todavía sin integrar en `main`. Al integrar esa cadena,
actualizar la base del PR y revisar el diff.

## Staging — 09/10/2026

Versión `4697aafee` publicada en web, API y ambos workers, sin migraciones ni
cambios de recursos. Desde Planificación se comprobó en Chrome la apertura del
editor, modificación de fecha, selección de paso o ítem, invalidación de una
propuesta anterior y simulación de producción y entrega contra la API real.
Las simulaciones se cancelaron; no se confirmó un cambio sobre las órdenes
existentes. La persistencia y las protecciones de concurrencia quedan cubiertas
por las pruebas de integración locales. Consola sin errores ni advertencias.

Compilación remota con TypeScript habilitado y CI aprobados. Imágenes, recuperación
y alcance detallados en [la validación de staging](../deploy/staging/VALIDACION.md).
