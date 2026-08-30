# Fase 2 — Desarrollo, archivos versionados y aprobaciones

**Estado:** IMPLEMENTADA Y VALIDADA TÉCNICAMENTE · PENDIENTE VALIDACIÓN FUNCIONAL DEL USUARIO

**Rama:** `visual-ilusion/fase-2-desarrollo-aprobaciones`

**Dependencia cumplida:** Fase 1 integrada en `visual-ilusion/analisis` mediante `a7743725`.

## 1. Resultado que debe entregar la fase

La fase incorpora control documental industrial sin cambiar el significado de los adjuntos actuales. `Archivo` continúa representando el objeto físico privado en storage. Encima se agrega una capa de dominio que permite identificar un documento lógico, conservar revisiones inmutables, pedir decisiones, liberar exactamente una revisión y bloquear producción cuando falte esa liberación.

El recorrido de aceptación obligatorio es:

1. crear un archivo maestro dentro de una campaña;
2. subir V1 y solicitar su aprobación;
3. observar V1 con comentario y conservarla en el historial;
4. subir V2, aprobarla y liberarla;
5. comprobar que V1 quedó obsoleta y que el puntero productivo referencia exclusivamente V2;
6. configurar un gate para una OT o uno de sus pasos;
7. comprobar en backend que la ejecución se rechaza sin liberación y se habilita al cumplirla;
8. resolver una solicitud mediante link público sin exponer costos, otros documentos ni datos de otros clientes.

## 2. Decisiones de arquitectura

### 2.1 Separar objeto físico y semántica documental

- `Archivo` mantiene storage, cuota, MIME, hash, descarga privada y retención.
- `ArchivoMaestro` identifica el propósito lógico: impresión, corte, render, plano, instructivo u otro.
- `ArchivoRevision` vincula una versión inmutable del maestro con un `Archivo` físico.
- Un archivo físico que ya forma parte de una revisión no puede borrarse desde la papelera normal.
- Los adjuntos históricos no se migran automáticamente: el control documental es opt-in y expand-only.

### 2.2 Aprobación reutilizable

- `SolicitudAprobacion` representa el pedido y su estado vigente.
- `DecisionAprobacion` es append-only y congela actor, rol, comentario, fecha y evidencia.
- Los tipos iniciales son cliente, diseño, color/muestra, ingeniería y liberación productiva.
- Una solicitud puede asignarse a un usuario, a un rol del sistema o habilitar decisión externa.
- Observar o rechazar no borra ni reescribe la revisión.

### 2.3 Aprobada no significa liberada

La aprobación documenta conformidad; la liberación es una decisión productiva explícita. `ArchivoMaestro` mantiene dos punteros independientes y auditables:

- revisión aprobada vigente;
- revisión liberada a producción.

Sólo una revisión aprobada puede liberarse. Aprobar una nueva revisión vuelve obsoleta la anterior y quita una liberación anterior para impedir que producción use silenciosamente un archivo reemplazado.

### 2.4 Gates productivos

`GateProduccionDocumento` vincula una OT —y opcionalmente un paso concreto— con el archivo maestro y el tipo de aprobación requerido. El gate se evalúa dentro del backend al:

- mover manualmente una OT a producción;
- iniciar o completar directamente un paso;
- continuar un paso cuando el gate volvió a bloquearse.

La UI sólo explica el bloqueo; no es la barrera de seguridad.

### 2.5 Links públicos

Se amplía la infraestructura `EnlacePublico` con el tipo `APROBACION_DOCUMENTAL`. El token es aleatorio, revocable y puede expirar. La proyección pública contiene exclusivamente empresa, campaña, maestro, revisión, comentario de solicitud y el archivo de esa revisión. No incluye presupuestos, importes, otros archivos, usuarios internos ni entidades vecinas.

## 3. Integración funcional

### Campaña

La ficha incorpora un espacio de “Desarrollo y aprobaciones” con lenguaje visual técnico de OT: maestros por propósito, línea de revisiones, estado, responsable, solicitud vigente, liberación y gates asociados.

### Orden de trabajo

La ficha muestra los documentos liberados y gates pendientes. El operario siempre ve número de revisión, nombre lógico y fecha de liberación; nunca una heurística de “último archivo”.

### Timeline

Crear maestro, agregar revisión, solicitar, observar, aprobar, liberar, revocar link y configurar gate generan eventos de campaña. Las decisiones conservan además su propio registro append-only.

## 4. Seguridad e invariantes transaccionales

- Todos los modelos de negocio llevan `tenantId` y quedan cubiertos por el tenant guard.
- La revisión y su archivo deben pertenecer al mismo tenant y a la entidad controlada.
- El número de revisión se asigna serializadamente por maestro y es único.
- No se edita archivo, autor, hash ni número de una revisión existente.
- Sólo una solicitud pendiente por revisión y tipo.
- Sólo el asignado, el rol asignado o un gestor autorizado puede decidir internamente.
- El link externo sólo resuelve la solicitud exacta mientras esté vigente y no revocado. Sólo permite decidir mientras la solicitud esté pendiente; después conserva una constancia mínima de la decisión hasta vencer o revocarse.
- Aprobar, reemplazar punteros, obsoletar la anterior y registrar decisión/evento ocurre en una transacción.
- Liberar exige una aprobación válida del tipo requerido.
- El gate se vuelve a calcular en cada comando productivo; no confía en un booleano enviado por el cliente.

## 5. Compatibilidad y despliegue

La migración es expand-only: agrega enums, tablas, índices y relaciones opcionales. No cambia filas de `Archivo`, OT, pasos ni campañas existentes. Una empresa que no cree maestros ni gates conserva exactamente el comportamiento actual.

## 6. Contrato visual

- Superficies ejecutivas y resúmenes: lenguaje de Tesorería de Grafoprint.
- Revisión, estados, gates y trazabilidad: lenguaje técnico de Orden de Trabajo.
- Componentes base pueden reutilizar primitives existentes, pero la composición, jerarquía, color y densidad pertenecen a Grafoprint; no se entrega una pantalla shadcn genérica.
- Desktop y mobile son criterios de salida, no una corrección posterior.

## 7. Estrategia de pruebas

- Unitarias de transiciones y autorización.
- Integración de servicio con V1 observada → V2 aprobada → liberada.
- Aislamiento tenant y referencias cruzadas.
- Concurrencia de número de revisión y doble decisión.
- Gate en transición de OT y acción de paso.
- Proyección pública mínima, expiración y revocación.
- Regresión de adjuntos existentes.
- Build Prisma/Nest/Next y recorrido visual autenticado desktop/mobile.

## 8. Criterio de cierre

La fase sólo pasa a `COMPLETA` cuando todos los criterios del Plan Maestro tienen evidencia, el flujo público y el interno funcionan sobre datos reales, el backend impide el bypass productivo y la revisión liberada aparece de forma inequívoca en campaña y OT.

## 9. Implementación entregada

- Persistencia expand-only para maestros, revisiones, solicitudes, decisiones append-only, gates y links públicos.
- Hash SHA-256 calculado al subir archivos de campaña y retención obligatoria al convertirlos en revisiones.
- API tenant-safe para crear maestros/revisiones, solicitar, aprobar, observar, rechazar, liberar, emitir/revocar links y configurar gates.
- Gate backend en transición de OT y comandos iniciar/continuar/completar de pasos.
- Tab “Desarrollo” de campaña, portal público `/a/:token` y tab “Documentos” de OT con la revisión liberada exacta.
- Diseño propio de Grafoprint: resumen ejecutivo de Tesorería y detalle técnico de OT, con reglas responsive; no se incorporó una composición shadcn genérica.
- La infraestructura disponible de notificaciones es WhatsApp hacia clientes y no una bandeja interna genérica. Para no producir mensajes externos no autorizados, esta fase registra solicitudes y decisiones en el timeline visible de campaña; una futura bandeja interna podrá consumir esos eventos sin alterar el dominio.

## 10. Evidencia de validación técnica — 29/08/2026

Recorrido real sobre `CAM-2026-0001` y `OT-2026-0037`:

1. se creó “Arte final cenefa Carrefour”;
2. V1 quedó observada y luego rechazada formalmente por “Cliente QA Visual Ilusión” mediante portal público;
3. V2 se creó con un archivo y hash diferentes, se aprobó externamente y se liberó;
4. V2 permaneció como única revisión liberada aun después de rechazar V1;
5. el link de V1 se revocó y dejó de resolver; la reemisión generó una credencial nueva;
6. el intento de iniciar el primer paso de OT-2026-0037 antes de liberar V2 fue rechazado por el backend;
7. después de liberar V2, el mismo paso pasó a “En curso”;
8. la OT mostró `fase2-arte-v2.svg`, V2, como referencia productiva exacta;
9. la campaña y el portal externo se revisaron en viewport móvil.

Verificaciones automatizadas:

- Prisma schema válido y 204 migraciones al día.
- Build Nest exitoso.
- Build Next exitoso, incluida la ruta dinámica `/a/[token]`.
- 12 suites relevantes y 197 tests aprobados: control documental, aislamiento/tenant guard, archivos, campañas y órdenes/tablero.
- `git diff --check` sin errores.
- `css-guard` continúa señalando diez clases globales preexistentes en `globals.css`; la Fase 2 no modifica ese archivo y todos sus estilos nuevos son CSS Modules.

La fase queda lista para la validación funcional del usuario. No se marca `COMPLETA` ni se integra en `visual-ilusion/analisis` hasta recibir esa conformidad.
