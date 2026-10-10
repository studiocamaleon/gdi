# Cambiar fechas desde Planificación

La vista permite seleccionar una operación, abrir **Ver detalle** y, en
**Fechas de producción y entrega**, pulsar **Reprogramar**. El formulario abre
**Fecha con el cliente** y permite acompañar esa fecha en producción:

- **Automático**: propone horarios según el calendario y la capacidad. Para
  **Este paso**, exige que la operación se realice dentro del día acordado.
  Para **Todo el ítem o lote pendiente**, busca un inicio cercano que permita
  terminar a tiempo. Conserva el trabajo ya iniciado.
- **Elegir inicio**: permite indicar fecha y hora de inicio de producción y
  comprueba que el trabajo llegue al compromiso. Es el inicio más temprano
  solicitado; el horario posible aparece en la propuesta.
- **Conservar**: cambia el compromiso y conserva las ventanas de producción.

Por ejemplo, para una instalación pospuesta diez días, seleccionar su paso,
abrir **Reprogramar**, elegir la nueva fecha y mantener **Automático → Este
paso**. La vista previa muestra juntos el cambio de instalación y el compromiso.
Si ese día no tiene capacidad u horario, no traslada la visita silenciosamente
al día siguiente: informa que la propuesta no se puede confirmar.

**Sólo producción** permite ajustar el inicio del paso y sus sucesores, o de
todo el ítem/lote pendiente, conservando la fecha con el cliente. Los horarios
siempre corresponden a la zona del taller.

**Revisar impacto** no escribe. Muestra horarios anteriores y propuestos,
operaciones afectadas, restricciones y entregas que requieren revisión. Cambiar
la fecha, hora o alcance invalida esa vista previa. **Confirmar cambio** guarda la
propuesta y actualiza el calendario. El motivo es opcional y queda en el historial.

## Reglas

- Reprogramar conserva duraciones cotizadas, requisitos operativos, estados y
  registros de ejecución. **Sólo producción** conserva las promesas comerciales;
  el ajuste combinado guarda producción y compromiso en una misma transacción.
- El ajuste automático de un ítem busca una propuesta factible por días, con
  un máximo de ocho simulaciones candidatas, reutilizando el motor de capacidad.
  No es un optimizador global del taller. El ajuste de un paso conserva las
  ventanas previas y mueve los sucesores pendientes cuando corresponde.
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
entrega requiere `comercial.ordenes.gestionar`; el ajuste combinado exige ambos.
Se comprueba también el permiso al confirmar, aunque el formulario se hubiera
abierto antes. Si el usuario sólo puede gestionar órdenes, puede cambiar la fecha
conservando producción, pero no ajustar sus horarios.

La revisión vence en dos minutos. Está firmada y vinculada al usuario, empresa,
paso, solicitud, contexto e impacto. La confirmación vuelve a consultar y simular
bajo una transacción serializable; rechaza cambios concurrentes. Los bloqueos
son por empresa, sólo durante la confirmación. Una confirmación duplicada no
publica un segundo cambio.

Se guardan ventanas y atención planificada en los campos existentes, referencia
con historial, evento de la OT con diferencias e invalidación interna del tablero.
No hay migraciones, servicios nuevos ni envíos a clientes. El contrato acepta las
solicitudes anteriores y agrega `ajusteProduccion`, `alcanceProduccion`,
`fechaProduccion` y `horaProduccion`. La fecha y hora manuales sólo corresponden
al ajuste manual; se rechazan las combinaciones incompatibles.

## Refinamiento local — fecha acordada y producción

- API: 59 pruebas en siete suites. Frontend: 45 pruebas en cuatro suites.
  Tipos de los nueve archivos de código modificados, ESLint, `css:guard` y
  comprobación de espacios del diff sin errores.
- Pruebas nuevas: instalación diez días después con un paso previo terminado,
  ítem completo con trabajo que necesita empezar el día hábil anterior, fecha
  sin horario disponible, ajuste manual, permisos combinados, lotes hermanos y
  rechazo por inicio concurrente sin guardar parcialmente el compromiso.
- Chrome local a 1920 px y 390 × 844: selección automática, manual y conservación,
  invalidación de la propuesta al editar, vista previa y confirmación de una
  instalación ficticia en memoria. Acciones disponibles en móvil y consola sin
  errores ni advertencias.
- Este refinamiento se publicó en staging como `c9f30c26e`. La versión inicial
  con dos acciones separadas queda registrada abajo como antecedente.

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

## Staging inicial — 09/10/2026, 20:50 UTC

Versión `4697aafee` publicada en web, API y ambos workers, sin migraciones ni
cambios de recursos. Desde Planificación se comprobó en Chrome la apertura del
editor, modificación de fecha, selección de paso o ítem, invalidación de una
propuesta anterior y simulación de producción y entrega contra la API real.
Las simulaciones se cancelaron; no se confirmó un cambio sobre las órdenes
existentes. La persistencia y las protecciones de concurrencia quedan cubiertas
por las pruebas de integración locales. Consola sin errores ni advertencias.

Compilación remota con TypeScript habilitado y CI aprobados. Imágenes, recuperación
y alcance detallados en [la validación de staging](../deploy/staging/VALIDACION.md).

## Staging unificado — 09/10/2026, 22:16 UTC

Versión `c9f30c26e` en web, API y ambos workers. Compilaciones completas en Fly
con TypeScript habilitado. Se conservaron los tamaños de las seis máquinas y
las 312 migraciones; salud, accesos restringidos y respaldo posterior verificados.

Desde Planificación → Ver detalle → Reprogramar se simularon los tres modos
en la empresa demo. Automático ubicó el paso dentro de la nueva fecha acordada;
Elegir inicio permitió un comienzo anterior; Conservar mantuvo la producción.
Cada cambio invalidó la propuesta anterior. Las simulaciones se cancelaron y
se comprobó la fecha original. No se confirmó una reprogramación sobre las
órdenes existentes; la persistencia está cubierta por la integración local.
Consola sin errores ni advertencias durante el recorrido.

Los workflows de GitHub no pudieron ejecutar sus comprobaciones: Docker Hub
devolvió límite de descargas y errores de autenticación/tiempo de espera al
obtener imágenes. Se conserva esa limitación en el PR, aunque ambas imágenes
completaron su compilación y revisión de tipos en Fly. Producción sin cambios.
