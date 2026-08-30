# Fase 2.5 — Tiempo real y notificaciones internas

**Estado:** EN DESARROLLO  
**Rama:** `visual-ilusion/fase-2-5-tiempo-real-notificaciones`  
**Base:** Fases 1 y 2 integradas en `visual-ilusion/analisis`

## 1. Propósito

Eliminar la necesidad de recargar manualmente Campañas, Órdenes de trabajo,
Tablero y aprobaciones cuando otra persona produce un cambio, y crear una
bandeja global reutilizable por todo Grafoprint.

No es un subsistema de mensajería externa. `NotificacionEvento` y
`NotificacionWhatsapp` continúan perteneciendo a WhatsApp. Esta fase incorpora
eventos internos durables y notificaciones personales dentro de la aplicación.

## 2. Resultado funcional

- Una única conexión en vivo por sesión del dashboard.
- Campana junto a “Cerrar sesión”, contador de no leídas y panel de actividad.
- Notificaciones destinadas sólo a usuarios pertinentes.
- Actualización selectiva de una campaña, una OT o el tablero según tópicos.
- Reconexión con cursor, sin perder eventos ocurridos durante un corte breve.
- Polling de respaldo cuando SSE no esté disponible.
- Persistencia completa: abrir otra pestaña o volver a iniciar sesión conserva
  la bandeja y el estado leído/no leído.

## 3. Arquitectura

### 3.1 Evento durable

`EventoSistema` es append-only, está aislado por tenant y usa una secuencia
monótona (`BigInt`) como cursor. Guarda tipo, entidad, actor congelado, texto,
enlace, severidad y tópicos de invalidación. La creación ocurre dentro de la
misma transacción que el cambio de negocio siempre que esa mutación ya sea
transaccional.

### 3.2 Bandeja personal

`NotificacionInterna` relaciona un evento con un usuario y registra lectura y
archivo. La audiencia se resuelve en servidor y se deduplica. En el primer
alcance se consideran:

- usuario asignado explícitamente;
- responsable y equipo de una campaña;
- solicitante/asignado de una aprobación;
- actor sólo cuando también deba recibir el resultado; por defecto se excluye;
- roles o permisos indicados por la regla del evento.

Una notificación jamás cruza tenants, incluso si un mismo correo participa en
más de una empresa.

### 3.3 Canal en vivo

`GET /eventos-sistema/stream` usa SSE autenticado a través del BFF. El payload
de invalidación contiene únicamente `eventoId`, `tipo`, `topicos` y fecha. El
detalle de la bandeja se obtiene mediante endpoints autorizados.

El stream consulta el outbox durable por cursor; por eso funciona con varias
instancias del API sin memoria compartida. En la primera conexión comienza en
el último evento existente. En una reconexión respeta `Last-Event-ID` y entrega
lo pendiente en orden. Un heartbeat evita que proxies cierren una conexión
ociosa.

### 3.4 Degradación

Si SSE se desconecta, `EventSource` reintenta y la aplicación activa un polling
visible cada 15 segundos para contador y cambios. Al recuperar el stream el
polling se detiene. La entrega en vivo puede fallar sin revertir la operación de
negocio; la fila durable permite recuperarla.

## 4. Contrato de tópicos

- `campana:{uuid}`: cabecera, métricas, hitos, vínculos, archivos o desarrollo.
- `orden:{uuid}`: estado, avance, pasos, gates o documentación de una OT.
- `tablero-produccion`: composición y avance del tablero.
- `notificaciones:{userId}`: cambió la bandeja personal.

El cliente invalida sólo los recursos relacionados. No se transmiten campañas,
órdenes ni documentos completos por SSE.

## 5. Catálogo inicial de eventos

| Familia    | Ejemplos                                                                        | Severidad habitual         |
| ---------- | ------------------------------------------------------------------------------- | -------------------------- |
| Campaña    | creada, editada, estado, equipo, hito, vínculo                                  | INFO / ÉXITO               |
| Documento  | nueva revisión, aprobación solicitada, observada, rechazada, aprobada, liberada | INFO / ADVERTENCIA / ÉXITO |
| Producción | OT iniciada, avance, bloqueo documental, paso completado, OT finalizada         | INFO / ADVERTENCIA / ÉXITO |

Los nombres técnicos son estables y versionables; los textos visibles pueden
evolucionar sin cambiar el contrato del cliente.

## 6. Experiencia visual

La campana sigue el lenguaje de Grafoprint: topbar sobria, tipografía y bordes
del producto, acento naranja para no leídas y detalle técnico inspirado en la
Orden de trabajo. No se utilizará una composición genérica de shadcn.

En escritorio el panel se ancla a la campana. En mobile ocupa el ancho útil,
mantiene áreas táctiles cómodas y no genera scroll horizontal. Incluye estados
vacío, conectando, en vivo y respaldo activo.

## 7. Reglas de actualización de UI

- No reemplazar datos mientras exista una mutación local en curso.
- No cerrar modales ni sobrescribir formularios abiertos.
- Si llega un evento durante edición, marcar una actualización pendiente y
  aplicarla al quedar la pantalla segura.
- Campañas vuelve a pedir detalle, desarrollo y archivos según el tópico.
- Tablero reutiliza su función de refresco y sus protecciones de drag/mutación.
- OT reutiliza su recarga funcional; no se fuerza un reload del navegador.

## 8. Seguridad y operación

- Todos los endpoints requieren sesión de tenant y `panel.ver`.
- Listado, conteo y marcado filtran siempre por `tenantId + userId`.
- El BFF conserva el token httpOnly, propaga `Last-Event-ID` y transmite el body
  sin bufferizar.
- Límite de retención configurable; inicialmente no se borra información
  reciente necesaria para reconexión y auditoría.
- Índices por tenant/cursor y por usuario/lectura evitan scans globales.

## 9. Validación obligatoria

1. Dos sesiones distintas sobre una misma campaña.
2. Una aprueba o avanza una OT y la otra cambia sin recarga manual.
3. La notificación aparece sólo a la audiencia autorizada.
4. Lectura individual y “marcar todas” persisten.
5. Corte y reconexión recuperan eventos sin duplicar notificaciones.
6. SSE desconectado activa polling de respaldo.
7. Dos tenants no pueden observar eventos ni notificaciones entre sí.
8. Formularios/modales abiertos no pierden cambios locales.
9. Desktop y mobile sin overflow, con estados vacío y múltiples no leídas.

## 10. Criterio de cierre

La fase se considera completa cuando el flujo Campaña → documento/aprobación →
OT/Tablero se sincroniza entre dos sesiones, la bandeja global persiste y las
pruebas de aislamiento, cursor, reconexión y responsive quedan aprobadas. Hasta
entonces no comienza la Fase 3.

## 11. Estado de implementación al 29/08/2026

Implementado:

- migración y modelos `EventoSistema` / `NotificacionInterna`;
- publicación transaccional desde Campañas, desarrollo/aprobaciones y acciones
  productivas de OT;
- endpoints tenant-safe de bandeja, conteo, lectura, cursor incremental y SSE;
- replay por `Last-Event-ID`, heartbeat y polling de respaldo cada 15 segundos;
- BFF streaming sin buffer y cancelación ligada a la request del navegador;
- proveedor único del dashboard, campana Grafoprint, badge y panel responsive;
- invalidación selectiva de Campaña, ficha OT y Tablero sin pisar una edición
  local activa;
- pruebas unitarias de audiencia, aislamiento de lectura y serialización BigInt;
- prueba real base → SSE → badge/panel dentro de 2,5 segundos;
- builds Nest y Next, suite frontend de 541 tests y suites backend relevantes.

Validación de cierre completada el 29/08/2026:

- recorrido real con dos usuarios del mismo tenant y permisos distintos: el
  destinatario recibió el cambio por SSE y una única notificación persistente;
  el actor excluido conservó el contador en cero;
- desconexión y reconexión con `Last-Event-ID` recuperaron el evento siguiente;
  el endpoint incremental devolvió el mismo evento como respaldo de polling;
- “marcar todas” llevó el contador a cero y el estado leído persistió después
  de cerrar e iniciar sesión nuevamente;
- aislamiento tenant, autorización, audiencia y serialización del cursor
  quedaron cubiertos por las pruebas automatizadas del servicio;
- con un modal de edición abierto, un evento remoto de la campaña no cerró el
  formulario ni reemplazó sus valores locales;
- panel verificado en escritorio, tablet y mobile: conexión en vivo visible,
  estado vacío correcto, panel dentro del viewport y sin overflow horizontal;
- sin errores de consola durante el recorrido y con eliminación verificada de
  todos los usuarios, relaciones, eventos y notificaciones temporales de QA;
- builds Nest/Next aprobados, 541 pruebas frontend aprobadas y 1.911 pruebas
  backend aprobadas. Permanece un único fallo preexistente y ajeno a esta fase
  en el catálogo de capacidades (`layout_produccion`).

**Estado final:** COMPLETA. La revisión futura del catálogo de audiencias por
negocio queda como gobernanza evolutiva de cada nueva familia de eventos y no
bloquea el contrato base validado en esta fase.
