# Backoffice profesional de Grafo: investigación, auditoría y plan

**Fecha:** 20 de septiembre de 2026.  
**Estado:** investigación terminada. Implementados [Empresas, acceso y suscripción](backoffice-empresas-acceso-2026-09-20.md), [Equipo y acceso](backoffice-equipo-acceso-2026-09-20.md), [invitaciones del equipo con MFA obligatorio y recuperación](backoffice-invitaciones-mfa-2026-09-20.md) y [Suscripciones: diagnóstico y consulta auditada de Paddle](backoffice-suscripciones-diagnostico-2026-09-20.md). Continúan pendientes las ampliaciones operativas descritas en cada entrega y las etapas siguientes. Los hallazgos de la auditoría conservan el estado observado antes de estos incrementos.  
**Rama:** `codex/rediseno-backoffice-plataforma`.

**Actualización de planes:** completado el [barrido integral de capacidades y controles](planes-catalogo-capacidades-auditoria-2026-09-20.md), con [inventario técnico](planes-inventario-superficies-2026-09-20.md) y [diseño del editor visual](planes-editor-visual-diseno-2026-09-20.md). Implementado el [editor de borradores](planes-editor-borradores-2026-09-20.md) con la distribución aceptada: Grafo Esencial, Pro y Avanzado, con 3, 20 y 40 usuarios. Precios, almacenamiento y condiciones de adicionales siguen pendientes. Próximo incremento: evaluador y controles por capacidad; publicación versionada después, conservando contratos vigentes.

## 1. Conclusión

Plataforma debe permitir que el equipo opere el SaaS: acompañar empresas, entender su acceso y suscripción, resolver incidentes, controlar lanzamientos y explicar cada intervención. La pantalla de inicio debe mostrar qué requiere atención y conducir a una acción concreta.

Grafo ya tiene piezas aprovechables. La deuda principal está en conectar esas piezas con reglas consistentes y herramientas operativas. La estética renovada se conserva; la organización funcional de las cinco vistas actuales debe evolucionar.

**Primera entrega recomendada:** una ficha de empresa confiable, con estados separados de acceso/cobro, diagnóstico de funciones habilitadas, permisos de staff y un historial consultable. Antes de ampliar los botones de administración, corregir las diferencias entre las acciones locales y Paddle.

## 2. Investigación: patrones que aplican a Grafo

Consulté documentación primaria. Las siguientes son referencias de diseño, no una recomendación de contratar todos estos productos ni migrar nuestra arquitectura.

| Referencia | Hallazgo relevante | Aplicación propuesta en Grafo |
|---|---|---|
| [AWS: control plane y application plane](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/control-plane-vs.-application-plane.html) | Separa la gestión del SaaS de las funciones que utilizan sus clientes. | Mantener identidad, autorización y servicios de Plataforma separados del trabajo cotidiano de las gráficas. |
| [Azure: enfoques para control planes](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/control-planes) | Combina un catálogo de empresas con procesos de alta, mantenimiento y baja; admite evolución desde procesos manuales. | Evolucionar el monolito actual por módulos y automatizar tareas repetidas, sin introducir microservicios por este rediseño. |
| [AWS SaaS Lens: Operate](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/operate.html) | Recomienda observar salud por empresa y nivel de servicio, y altas repetibles incluso cuando las ejecuta el staff. | Ver a quién afecta un incidente y reutilizar el provisionamiento existente para altas asistidas y públicas. |
| [GitLab: Admin area](https://docs.gitlab.com/administration/admin_area/) | Su administración incluye usuarios, información del sistema y tareas de fondo con estados e historial. | Un área operativa con colas e incidentes, además de estadísticas de uso. Es una referencia de administración; no copiamos su modelo de instancia al SaaS. |
| [Paddle: funcionamiento de webhooks](https://developer.paddle.com/webhooks/about/how-webhooks-work/) y [provisionamiento](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/) | Entrega al menos una vez, posible desorden de eventos y reconciliación periódica. | Exponer el registro y la sincronización que ya tenemos; endurecer concurrencia y ofrecer recuperación controlada. |
| [Stripe: Billing Analytics](https://docs.stripe.com/billing/subscriptions/analytics) | Normaliza ingresos recurrentes por mes, distingue pruebas gratuitas y permite rastrear cambios de MRR. | Definir un contrato de métricas propio, basado en las condiciones de cada suscripción y con detalle verificable. No implica sustituir Paddle. |
| [WorkOS: impersonación](https://workos.com/docs/authkit/impersonation) | Documenta motivo, expiración, identificación del operador y restricciones específicas durante el acceso de soporte. | Reutilizar nuestras sesiones temporales y agregar permisos más acotados y trazabilidad de las acciones. |
| [OWASP: registros](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Los eventos necesitan autor, momento, contexto y resultado; hay información sensible que debe excluirse o protegerse. | Auditoría estructurada, consulta controlada y ocultamiento de secretos. Un log de aplicación no equivale a un historial de negocio íntegro. |
| [LaunchDarkly: tipos de flags](https://launchdarkly.com/docs/guides/flags/creating-flags) | Distingue habilitaciones comerciales, lanzamientos y controles operativos. | Separar lo incluido en un plan de los pilotos y de un interruptor de emergencia. |

## 3. Qué revisé realmente en Grafo

Inspección del código de Plataforma, autenticación/MFA, impersonación, suscripciones, Paddle, registro/provisionamiento, modelos Prisma, workers y documentación previa. Se toma el código actual como evidencia; los documentos históricos contienen decisiones ya reemplazadas.

Ejecuté las siete suites existentes de Plataforma, negocio, login de backoffice y webhook de Paddle: **40 pruebas aprobadas**, con la base dedicada `gdi_saas_test`. Las pruebas de Paddle simulan al proveedor; no certifican su configuración en producción. No se realizaron cobros, cambios de plan ni suspensiones sobre clientes reales.

La revisión no incluye una prueba de carga ni una auditoría de la infraestructura desplegada. Las observaciones de escalabilidad se desprenden de las consultas y procesos inspeccionados.

### 3.1 Base que conviene conservar

| Área | Implementación existente | Trabajo pendiente para convertirla en operación profesional |
|---|---|---|
| Acceso del equipo | Login de plataforma; sesión sin empresa; roles `ADMIN` y `SOPORTE`; verificación del rol en API. | Administración de staff, permisos por acción, política MFA y revocación de sesiones. |
| MFA | Alta, verificación, recuperación y desafío al ingresar si está activada. | Enrolamiento accesible para staff y obligatoriedad progresiva para acceder a Plataforma. |
| Empresas | Listado, detalle, creación transaccional, invitación, suspensión/reactivación. | Búsqueda/paginación en servidor, ficha completa, recuperación de invitaciones y estados separados. |
| Alta pública | `RegistroTenant`, verificación de correo y provisionamiento compartido con el alta asistida. | Seguimiento de altas pendientes, errores de provisionamiento y activación real del cliente. |
| Planes | Catálogo, precios mensual/anual, precios históricos, visibilidad pública/interna, funciones y límites. | Edición validada de capacidades, versiones y vista previa de empresas afectadas. |
| Suscripciones | Estado local y del proveedor, mora, gracia, prueba, cancelación programada y fechas de sincronización. | Mostrarlo al staff; unificar comandos administrativos con la lógica de suscripciones. |
| Paddle | Firma del webhook, persistencia de eventos, deduplicación y comparación temporal; reconciliación cada diez minutos. | Diagnóstico visible, resultados diferenciados, reintentos seguros y control del volumen de reconciliación. |
| Autogestión de cobro | Cambio de plan con previsualización, sincronización, portal y comprobantes en el área del cliente. | Reutilizar el dominio con autorización explícita de staff, sin crear otro flujo financiero paralelo. |
| Soporte | Sesiones de 60 minutos, motivo, actor real, cierre y restricciones de rutas. | Modo de lectura predeterminado, permisos por operación y consulta del historial completo. |
| Auditoría | `PlataformaEvento`, registro de cambios principales y sesiones de soporte. | Filtros, paginación, resultados, correlación con operaciones y política de conservación. |
| Operación | Health check de API/PostgreSQL; workers de PDF, geometría, cotización y planificación; registros de integraciones. | Visibilidad central de disponibilidad, errores, atrasos y empresas afectadas. |
| Analítica | Actividad, uso de módulos, ventas del ecosistema y agrupaciones por moneda. | Métricas SaaS diferenciadas, exclusión de cuentas internas y agregaciones que escalen. |

### 3.2 Hallazgos prioritarios

**H1 — Cambiar el plan local y cambiar la suscripción facturada son operaciones diferentes.**

`PlataformaService.cambiarPlan` actualiza `Suscripcion.planId` y la deja activa, sin consultar ni modificar Paddle. Si existe una suscripción externa, sus condiciones de cobro permanecen allí y una sincronización posterior puede restablecer el plan remoto. Es una divergencia de contrato identificable en el código; no se provocó sobre una cuenta real.

Acción propuesta: distinguir asignación manual/cortesía, cambio comercial en el proveedor y excepción temporal de capacidades. Para Paddle, previsualización del efecto económico y operación identificable; el resultado confirmado por el proveedor actualiza el espejo local. Mientras ese camino no exista, la asignación local no debe presentarse como cambio comercial de una suscripción Paddle.

**H2 — Suspender acceso no detiene el cobro.**

`suspenderTenant` modifica `Tenant.activo` y `Suscripcion.estado`. No pausa la suscripción en Paddle. `reactivarTenant` vuelve a marcar la suscripción como activa sin reconstruir su estado comercial previo. La UI llegó a describir la suspensión como pausa de suscripción.

Acción propuesta: separar bloqueo administrativo, restricciones derivadas del pago y estado del proveedor. Reactivar acceso no debe equivaler a dar por pagada una deuda o reabrir una suscripción cancelada. Mostrar el efecto de cada acción antes de ejecutarla.

**H3 — El MRR actual es una aproximación de catálogo.**

`consola()` suma `plan.precioMensual` cuando el estado local es `activa`. No usa el importe contratado por esa suscripción, ciclo anual, descuentos, moneda individual o clasificación de cuenta interna/cortesía. Los precios históricos ya se reconocen para resolver planes, pero no aportan una base financiera completa al MRR.

Acción propuesta: conservar ese dato sólo si se rotula como estimación de catálogo. El MRR comercial necesita importes/ciclo/moneda de las suscripciones, exclusiones definidas e historia. Ejemplo propuesto: una suscripción anual de USD 1.200 aporta USD 100/mes; el plan Founder interno se muestra separado, aunque tenga un precio técnico para probar checkout.

**H4 — “Usuarios activos” y “última actividad” no significan uso reciente.**

Se cuentan memberships habilitadas y se usa el máximo `AuthSession.createdAt` como último acceso. Eso no mide la última acción de negocio; las sesiones de soporte también pueden entrar en ese conjunto.

Acción propuesta: distinguir usuarios habilitados, usuarios que usaron Grafo en una ventana y última actividad de negocio. Excluir soporte, tests y procesos automáticos de métricas de adopción humana.

**H5 — La consola no tiene paginación de empresas en servidor.**

`consola()` obtiene todas las empresas y relaciones; trae las fechas de OTs, cotizaciones y cobros de 84 días para construir series en memoria. El costo crece con el volumen. No se afirma una latencia medida: falta ensayo de carga.

Acción propuesta: endpoints de listado/detalle independientes, filtros y cursores en servidor; agregaciones en base de datos y luego resúmenes periódicos según medición. La carga de una ficha no debe recalcular todo el ecosistema.

**H6 — Auditoría disponible, pero consulta limitada y contrato incompleto.**

El endpoint devuelve los últimos 30 eventos, sin búsqueda histórica desde Plataforma. `PlataformaEvento` no exige campos uniformes de resultado, correlación o antes/después. El script de bootstrap atribuye el evento al usuario afectado, por carecer de actor de consola.

Acción propuesta: servicio común de auditoría y registro de operaciones. Conservar el historial existente; no prometer inmutabilidad física por el simple hecho de que la UI no lo edite.

**H7 — Los controles de staff todavía son básicos.**

El rol se otorga mediante script. MFA sólo desafía a quien ya la activó. `SOPORTE` puede leer Plataforma, pero iniciar impersonación exige `ADMIN`. La impersonación usa permisos del rol administrador de empresa, con prohibiciones específicas; no es de sólo lectura.

Acción propuesta: permisos explícitos para soporte/operación/cobranza, MFA con enrolamiento y recuperación previos a exigirla, y revalidación de privilegios en intervenciones. `Founder` es un plan comercial/interno, no un permiso de staff: nunca usarlo como autorización de Plataforma.

**H8 — Hay datos operativos que no llegan al backoffice.**

`EventoCobro` registra procesamiento y errores, pero no tiene una bandeja de diagnóstico en Plataforma. La reconciliación recorre suscripciones Paddle de forma secuencial. Ya existen colas de trabajos en otras áreas, pero no una vista central de su salud y atraso.

Acción propuesta: reutilizar esos registros, añadir resultados e intentos diferenciados y mostrar antigüedad del último éxito. La reconciliación debe evolucionar a lotes con concurrencia acotada, prioridad por antigüedad y respeto de límites del proveedor.

**H9 — La analítica del ecosistema requiere otra política de lectura.**

`NegocioService` ya devuelve desglose por moneda y la UI advierte cuando mezcla monedas. Sin embargo, los KPIs globales continúan sumando importes crudos. El ranking identifica empresas y es visible con los roles de lectura de Plataforma.

Acción propuesta: presentar importes por moneda; cualquier conversión debe tener fuente, fecha y regla explícitas. Restringir análisis comerciales detallados a quien los necesita. No asumir que ser staff requiere acceso a cada archivo, cliente o margen de todas las gráficas.

## 4. Organización propuesta de la interfaz

Estas son áreas de producto objetivo, no ocho pantallas vacías que haya que publicar inmediatamente. Los accesos aparecen conforme exista una entrega utilizable.

| Área | Pregunta que responde | Contenido principal |
|---|---|---|
| **Inicio** | ¿Qué necesita atención hoy? | Incidentes abiertos, altas trabadas, pagos con problemas, pruebas por terminar y acciones recientes. Cada señal enlaza al caso concreto. |
| **Empresas** | ¿Qué ocurre con esta gráfica? | Directorio con búsqueda, vistas guardadas y ficha integral. Separación entre clientes, pruebas, demos, internas y cortesías. |
| **Suscripciones y cobros** | ¿Qué contrató, cuánto paga y por qué tiene este acceso? | Estado del proveedor, ciclo, mora/gracia, cambios programados, comprobantes/enlaces y sincronización. |
| **Planes y funciones** | ¿Qué incluye cada plan y quién participa de un piloto? | Catálogo validado, límites, versiones, excepciones con vencimiento, habilitaciones piloto y vista previa del impacto. |
| **Operación** | ¿Qué falló y a quién afecta? | API, workers, colas, integraciones, eventos externos y operaciones administrativas. Alertas con responsable, estado y procedimiento de resolución. |
| **Crecimiento** | ¿Las empresas se activan, vuelven y permanecen? | Altas, activación, conversión, adopción, retención y métricas comerciales del SaaS. “Negocio del ecosistema” queda como análisis secundario. |
| **Equipo y acceso** | ¿Quién puede administrar Grafo? | Invitaciones de staff, roles, MFA, sesiones, revocación e intervenciones de soporte. |
| **Auditoría** | ¿Quién hizo qué, cuándo y con qué resultado? | Historial filtrable por empresa, operador, acción, fecha y operación; exportación autorizada y registrada. |

### Ficha de empresa como centro del trabajo

Cabecera: nombre, tipo de cuenta, país, plan, acceso efectivo y alertas. Búsqueda por nombre, correo de administrador o identificador de proveedor; los identificadores técnicos se reservan para el detalle y para copiar referencias.

Pestañas propuestas:

1. **Resumen:** situación de la cuenta, responsables, última actividad real y próximos eventos.
2. **Usuarios y acceso:** usuarios habilitados, invitaciones y diagnóstico de acceso. Revocaciones con alcance por empresa cuando corresponda; un usuario puede pertenecer a varias.
3. **Suscripción:** condiciones comerciales, estado externo/local, sincronización y acciones disponibles.
4. **Funciones y límites:** capacidades efectivas y explicación de por qué una está permitida o bloqueada.
5. **Operación:** fallos de integraciones/trabajos que afectan a esa cuenta; diagnósticos sin secretos.
6. **Historial:** línea de tiempo de altas, planes, pagos, bloqueos e intervenciones.

Conservar el panel lateral para consultas rápidas. Usar una página con URL propia para la ficha completa, para poder compartir enlaces internos, volver con el navegador y conservar filtros. Evitar un componente único que contiene toda la consola y modales anidados para cada tarea.

## 5. Separar estados y fuentes de verdad

| Dimensión | Ejemplos | Fuente |
|---|---|---|
| Ciclo de la empresa | Alta pendiente, operativa, cierre solicitado, archivada | Grafo |
| Acceso administrativo | Normal, restringido, bloqueado; motivo y vigencia | Grafo |
| Cobro | Activa, prueba, mora, cancelación programada, cancelada | Proveedor para contratos externos; registro comercial para contratos manuales |
| Derecho a funciones | Plan/versiones, extras, excepciones aprobadas | Grafo |
| Disponibilidad técnica | Piloto habilitado, función temporalmente desactivada | Grafo |
| Salud operativa | Integración fallida, trabajo atrasado, datos de monitoreo viejos | Medición y eventos |

Ejemplo: una empresa puede estar pagando correctamente y tener un bloqueo administrativo por una incidencia. También puede tener el pago atrasado y seguir operando durante su gracia. Ninguna de esas condiciones debe reducirse a una única etiqueta “Activa”.

Paddle mantiene la autoridad sobre sus operaciones financieras. Grafo calcula acceso y capacidades a partir de ese estado y de políticas administrativas explícitas. Un webhook de pago no debe borrar un bloqueo administrativo independiente.

## 6. Planes, pilotos y controles operativos

El [diseño específico del editor](planes-editor-visual-diseno-2026-09-20.md) desarrolla esta sección. La [auditoría integral](planes-catalogo-capacidades-auditoria-2026-09-20.md) distingue 68 capacidades y recursos; las cuatro claves comerciales actuales no cubren toda esa superficie. También identifica que `todo` elimina cupos y que el catálogo de permisos liga Administración con AFIP. Esos acoplamientos deben resolverse antes de publicar una segmentación comercial completa.

Para una función como impresión directa, el diagnóstico debería explicar:

> Impresión directa: habilitada por Founder. Piloto habilitado. Permiso del usuario presente. Estación de impresión configurada.

O, según el caso:

> Impresión directa: incluida en el plan, pero desactivada temporalmente por una incidencia. Cotización y emisión de OT disponibles.

Reglas propuestas:

- Catálogo tipado de capacidades, con nombre visible, descripción, dependencias, valor predeterminado y validación. Evitar un editor libre de JSON como herramienta diaria.
- Plan comercial y precio por ciclo/versiones; conservar las condiciones anteriores donde corresponda. Cambiar catálogo no debe cambiar silenciosamente lo contratado por todas las empresas.
- Excepciones por empresa con motivo, responsable, inicio y vencimiento; no alterar un plan completo para resolver una cortesía puntual.
- Pilotos por empresa o grupo controlado, separados de las funciones que vende un plan.
- Interruptor operativo por función con efecto explicado y alternativa útil. Un piloto no puede superar un bloqueo de acceso ni otorgar permisos de usuario.
- Previsualización: empresas afectadas, dependencias y resultado antes/después antes de publicar un cambio global.
- Evaluación compartida en API; la UI refleja la decisión y su motivo. Conservar el comportamiento explícito de impresión directa y la compatibilidad legacy durante la migración.

No hace falta contratar una plataforma de flags para el primer catálogo. Si aparecen segmentación compleja y despliegues porcentuales frecuentes, se evalúa un proveedor manteniendo un único punto de resolución de capacidades.

## 7. Journeys que deben funcionar completos

### A. “El cliente pagó y no puede entrar”

1. Buscar empresa y abrir su ficha.
2. Ver por separado acceso administrativo, estado de cobro y última sincronización.
3. Abrir el evento fallido o consultar el estado actual del proveedor mediante una operación registrada.
4. Si el proveedor confirma la regularización, actualizar el espejo y recalcular acceso.
5. Ver resultado, momento y responsable. Si persiste un bloqueo administrativo, mostrar su causa; no levantarlo como efecto accidental del pago.

### B. “Quiero probar impresión directa en tres empresas”

1. Abrir Planes y funciones → Pilotos → Impresión directa.
2. Elegir las empresas elegibles, vigencia y responsable.
3. Revisar qué cambia y qué requisitos de impresora/conector siguen pendientes.
4. Activar y registrar el cambio; comprobar la capacidad efectiva en cada ficha.
5. Poder retirar el piloto conservando cotización, OT e historial. Si hace falta una concesión comercial adicional, registrarla por separado.

### C. “Hay PDFs que no se generan”

1. Inicio muestra una incidencia con cantidad de trabajos y empresas afectadas.
2. Operación permite ver cola, tiempo de espera, worker y último error sanitizado.
3. Tras resolver la causa, reintentar sólo los trabajos elegibles de forma idempotente.
4. Conservar intentos e informar el resultado real.

No usar el mismo botón genérico para todo: reintentar un PDF, emitir un comprobante fiscal, cobrar e imprimir físicamente tienen consecuencias diferentes. En fiscal se debe consultar la operación ya emitida; en impresión, un estado incierto no autoriza una reimpresión automática.

### D. “La prueba no llegó a activarse”

1. Buscar altas pendientes y verificación/invitación enviada, aceptada o vencida.
2. Corregir el problema o regenerar una invitación autorizada sin crear otra empresa.
3. Ver hitos reales: primer acceso, configuración mínima, primera cotización y primera OT.
4. Extender una prueba sólo mediante acción explícita y auditada; conservar fecha original e historial.

### E. “Necesito asistir a una empresa”

1. El diagnóstico de la ficha resuelve lo que pueda sin ingresar en sus datos operativos.
2. Si hace falta acceso de soporte, pedir motivo y alcance, vinculado a un caso cuando exista.
3. Sesión temporal de lectura por defecto, actor visible y cierre disponible.
4. Una intervención que escribe requiere permiso específico y reautenticación cuando sea sensible.
5. Registrar acciones y revocar de inmediato al cerrar, vencer o quitar el permiso de staff.

## 8. Arquitectura y operación propuestas

### Reutilizar el monolito, separar responsabilidades

Mantener NestJS, Prisma y los workers existentes. Organizar Plataforma en consultas de empresas, acciones administrativas, suscripciones, capacidades, operación y auditoría. No llamar servicios de negocio de un tenant desde un contexto global sin establecer explícitamente el alcance.

El mismo dominio de cambio comercial debe atender autogestión y staff con políticas diferentes, evitando duplicar reglas de cobro. Eso no implica exponer los endpoints del cliente a todo el staff.

### Operaciones externas con resultado rastreable

Una acción administrativa con efecto externo necesita identidad de operación, actor, empresa, motivo, parámetros permitidos, estado e intentos. Flujo propuesto: solicitada → en proceso → completada/fallida/requiere conciliación. La pantalla debe poder recuperar el resultado después de recargar.

No mantener una transacción SQL abierta mientras responde Paddle. Persistir la intención, ejecutar mediante el adaptador del proveedor y conciliar. Usar deduplicación, concurrencia por recurso y recuperación de fallos parciales; un simple botón deshabilitado no resuelve los reintentos de red ni dos operadores actuando a la vez.

Los registros de eventos externos deben distinguir recibido, aplicado, ignorado, pendiente y fallido. Hoy `errorTexto` también guarda razones por las que un evento no se aplica: no convertir cada texto en una alerta roja.

### Datos, API y rendimiento

- Separar resumen, listado de empresas, detalle, auditoría y operación. No transportar todo para dibujar cada pestaña.
- Paginación, orden estable y filtros en servidor; índice según consultas verificadas con planes de ejecución.
- Resúmenes para analítica, con fecha de cálculo y datos pendientes claramente visibles.
- Telemetría por empresa en eventos/trazas con acceso restringido; evitar dimensiones ilimitadas en todas las métricas de infraestructura.
- Límites de concurrencia y prioridad por tenant en procesos pesados; medir atraso, duración, fallos y saturación.
- En reconciliación de cobros, priorizar suscripciones desactualizadas/problemáticas y procesar lotes, con límites y reintentos del proveedor.
- Objetivo inicial propuesto de prueba: listados paginados y ficha utilizables con 10.000 empresas sintéticas. Fijar presupuesto de latencia y carga sobre la infraestructura objetivo antes de aprobar producción; no prometerlo a partir de la inspección de código.

### Seguridad operativa

- Permisos por acciones; roles predefinidos como propietario/administración, soporte, cobranza y operación. Añadir roles de analítica/auditoría cuando exista el equipo que los use.
- MFA obligatoria para staff mediante una transición con enrolamiento, códigos de recuperación y acceso de emergencia documentado; evitar bloquear al único administrador durante la migración.
- Reautenticación reciente para otorgar privilegios, cambiar políticas de acceso o realizar intervenciones sensibles.
- Nadie se otorga permisos a sí mismo ni elimina la última cuenta administradora válida por accidente.
- Motivo y vista previa para cambios con impacto; doble intervención para operaciones masivas o irreversibles cuando exista un segundo responsable. No exigir dos personas para cada consulta o tarea rutinaria.
- Ocultar secretos, enlaces firmados, contenido de archivos y payloads personales innecesarios. La exportación de auditoría también es una operación con permiso y registro.

### Continuidad y datos

Estado de respaldos y restauraciones comprobadas, retención, exportaciones y cierre de cuenta forman parte de una operación profesional. Las herramientas de infraestructura realizan el respaldo; Plataforma muestra evidencia y enlaces autorizados. No agregar un botón de restaurar producción sin un procedimiento probado.

La baja debe separar cancelación comercial, restricción de acceso, exportación y eliminación. Los plazos concretos de conservación quedan como política pendiente del negocio y de las obligaciones aplicables; no se fija un plazo legal inventado desde este diseño.

## 9. Qué construir y qué integrar

| Construir en Grafo | Integrar o delegar |
|---|---|
| Ficha de empresa, diagnóstico de acceso, planes/capacidades, pilotos y reglas de soporte. | Operaciones financieras y comprobantes del proveedor de cobro existente. |
| Acciones administrativas específicas y auditoría de negocio. | Almacenamiento/consulta técnica de logs, trazas, alertas de infraestructura. |
| Vista de incidentes por empresa y enlaces a trabajos relevantes. | Gestión completa de tickets en una herramienta de soporte si el volumen lo requiere. |
| Hitos de activación y métricas definidas del producto. | Respaldos, alertas de disponibilidad externa y secretos en infraestructura. |

Plataforma puede centralizar el contexto sin replicar un procesador de pagos, una suite de monitoreo y una mesa de ayuda completos.

## 10. Plan de implementación y criterio de cierre

### Etapa 0 — Contratos y correcciones de base

Separar acceso administrativo y cobro; limitar las acciones locales incompatibles con Paddle; definir permisos y auditoría de comandos; corregir nombres de métricas y distinguir cuentas internas.

**Cierre:** ninguna acción afirma haber cambiado un cobro si sólo alteró la base local; reactivar acceso no borra mora/cancelación; pruebas cubren esos casos, eventos duplicados y sincronizaciones posteriores.

### Etapa 1 — Empresas y equipo: operación diaria completa

Directorio paginado, ficha por URL, estados claros, invitaciones, usuarios/sesiones pertinentes, gestión de staff, MFA, historial filtrable y soporte acotado. Inicio con señales que tienen acción, fecha y responsable.

**Cierre:** el equipo puede resolver un problema habitual de acceso o alta sin consultar la base ni ejecutar scripts; cada intervención queda registrada. Pasan pruebas de aislamiento y de todos los roles.

### Etapa 2 — Suscripciones, planes y pilotos

Diagnóstico y acciones de suscripción, visor de eventos/reconciliación, catálogo de capacidades, precios/versiones, excepciones temporales y pilotos. La vista previa de efectos económicos precede a cualquier cambio facturado.

**Cierre:** cambios de plan, eventos fuera de orden, reintentos y caídas temporales del proveedor convergen al mismo estado; impresión directa puede habilitarse como piloto sin alterar la cotización ni confundir permisos con planes.

### Etapa 3 — Operación, continuidad y recuperación

Salud por servicio/empresa, colas de PDF y otros workers, integraciones, antigüedad de sincronizaciones, incidentes, interruptores operativos y reintentos específicos. Evidencia de respaldo/restauración y procedimientos de respuesta.

**Cierre:** ante un fallo simulado, el equipo identifica afectados, encuentra la causa y recupera trabajos elegibles sin duplicar cobros, comprobantes ni impresiones. Datos viejos o monitoreo desconectado no aparecen como servicio sano.

### Etapa 4 — Crecimiento y ciclo completo del cliente

Activación por hitos, MRR comercial verificable, cohortes y retención, consumo/costo cuando esté medido, análisis por moneda, y cierre/exportación/retención controlados.

**Cierre:** cada indicador importante se puede explicar con sus registros fuente; demos, Founder, cortesías y soporte no distorsionan la lectura comercial. El cierre de cuenta tiene un recorrido probado.

Las protecciones mínimas de datos, facturación y recuperación no se postergan para después de operar clientes: la implementación visible puede ser gradual, pero esas condiciones deben cumplirse antes de habilitar las acciones correspondientes en producción.

## 11. Primer incremento concreto — referencia del plan inicial

El primer trabajo de código recomendado fue **“Empresas: acceso y suscripción confiables”**. Las entregas enlazadas en el estado de este documento registran lo implementado y sus pendientes; la lista siguiente conserva el alcance original:

1. Pruebas de regresión para cambio local sobre suscripción Paddle, bloqueo administrativo seguido de webhook y reactivación con mora.
2. Contrato de acceso efectivo con motivos; migración compatible con los estados actuales, sin reinterpretar automáticamente el motivo histórico de todas las suspensiones.
3. Consulta de ficha de empresa que exponga proveedor, estado, prueba/gracia, próxima fecha, cambio programado y antigüedad de sincronización.
4. Directorio paginado y nueva ficha; diagnóstico visible antes de acciones.
5. Acciones diferenciadas y auditadas. El cambio financiero se integra al dominio de suscripciones con previsualización; hasta entonces se limita la asignación local a los casos que admite.

Se conserva el rediseño visual reciente. Las funciones nuevas se incorporan a esta estructura conforme estén completas; el flujo de compras/stock continúa pausado.

## 12. Decisiones pendientes que no bloquean la auditoría

- Responsables y ensayo del procedimiento de emergencia si se pierden todos los factores; la política de MFA obligatorio y la recuperación con códigos ya están implementadas.
- Alcance de los futuros integrantes de soporte/cobranza y política de acceso a datos comerciales de clientes.
- Qué condiciones definen cliente comercial, cuenta interna, cortesía y prueba para métricas.
- Política de cierre/retención/exportación y entorno real de producción para objetivos de recuperación y rendimiento.
- Reglas comerciales de excepciones y pilotos. La preferencia ya acordada se conserva: impresión directa empieza como piloto explícito en Founder.

No se presupone contratación de proveedores nuevos ni una migración a otra pasarela. Tampoco se cambian estas políticas sobre datos reales como parte de la investigación.

## 13. Índice de evidencia local

| Hallazgo | Código inspeccionado |
|---|---|
| H1/H2 | `apps/api/src/plataforma/plataforma.service.ts`, `cambiarPlan` (574), `suspenderTenant` (619), `reactivarTenant` (649); `apps/api/src/cobro/suscripcion-sync.service.ts`, `aplicar`. |
| H3/H4/H5/H6 | `apps/api/src/plataforma/plataforma.service.ts`, `consola` (163), consultas (186–260), resumen/MRR (404); `apps/api/prisma/schema.prisma`, `PlataformaEvento` y `Suscripcion`. |
| H7 | `apps/api/src/auth/auth.service.ts`, `loginPlataforma` y `emitirTokenImpersonacion`; `apps/api/src/auth/mfa.service.ts`, `desafiar`; guards de Plataforma/impersonación; `apps/api/scripts/otorgar-rol-plataforma.ts`. |
| H8 | `apps/api/src/cobro/cobro-webhook.controller.ts`; `apps/api/src/suscripciones/suscripcion-reconciliacion.scheduler.ts`; módulos `documentos-pdf` y `workers`. |
| H9 | `apps/api/src/plataforma/negocio.service.ts`, `porMoneda`; `src/components/plataforma/consola-view.tsx`, aviso de mezcla de monedas. |
| Base reutilizable | `apps/api/src/suscripciones/suscripciones.service.ts`; `apps/api/src/provisionamiento/tenant-provisioning.service.ts`; `apps/api/src/registro/registro.service.ts`; `apps/api/src/app.service.ts`. |

Este plan reemplaza como guía de evolución del backoffice las partes pendientes de `control-plane-diseno.md`. El documento histórico sigue sirviendo para entender decisiones y migraciones previas; el contrato vigente de Paddle y los hallazgos actuales tienen prioridad para el trabajo futuro.
