# Planes: catálogo y editor de borradores

**Fecha:** 20 de septiembre de 2026.  
**Estado:** entrega 1 implementada, con persistencia y migración local aplicadas.  
**Acceso:** Plataforma → Planes y funciones.  
**Rama:** `codex/rediseno-backoffice-plataforma`.

## Propuesta aceptada

| Plan | Usuarios incluidos | Alcance inicial |
|---|---|---|
| Grafo Esencial | 3 | Cotización completa, productos simples y compuestos, copiado y CAD, presupuestos y aprobación, OT, producción manual, archivos, seguimiento/QR, etiquetas descargables, clientes/proveedores, cobros/saldos, existencias/movimientos, resumen y fiscal para Argentina. |
| Grafo Pro | 20 | Esencial más reservas, faltantes y abastecimiento, compras/recepciones, tesorería y cuentas a pagar, recurrentes, precios especiales/cupones/fidelización, proyectos/campañas, arte y revisiones, WhatsApp y reportes comerciales/financieros. |
| Grafo Avanzado | 40 | Pro más capacidad y planificación de producción, fecha estimada, escenarios, asignación automática, optimización de colas y reportes productivos. |

Los tres permiten usuarios adicionales pagos en la propuesta, con precio pendiente. Almacenamiento queda por definir y no se propone un cupo comercial de órdenes/presupuestos. Seguridad, MFA, roles y configuración de cuenta son base común.

Impresión conectada y asistente permanecen como piloto Founder. MCP queda como piloto interno; exportaciones y recorridos de fabricación son adicionales futuros. No se pueden incluir accidentalmente en un borrador comercial.

## Interfaz implementada

- **Funciones:** matriz compacta de 65 capacidades y tres planes, buscador, filtro de diferencias, grupos plegables y encabezado persistente. Cada función despliega su explicación, requisitos, cobertura del control por plan y revisión operativa pendiente. La base de cuenta no se puede quitar.
- **Usuarios y oferta:** nombre, descripción, usuarios incluidos, opción de adicionales y almacenamiento pendiente/limitado/ilimitado. Muestra los precios como pendientes; no inventa importes.
- **Revisión:** dependencias y errores de composición, funciones pendientes de validar, controles de acceso pendientes y requisitos para publicar.
- **Planes actuales:** conserva el acceso al catálogo vigente, separado de esta propuesta.
- El botón guarda sólo los planes modificados y muestra la cantidad dentro. Los errores conservan la edición; recargar tras un conflicto pide descartar explícitamente. Hay protección al salir mediante la navegación de Plataforma y al recargar/cerrar la página. El historial atrás/adelante del navegador no tiene una confirmación específica en este incremento.

Administración puede editar; soporte puede consultar. La matriz muestra todas las opciones relevadas, aunque todavía no se puedan comercializar: incluir una función en la propuesta no certifica su madurez ni la cobertura de sus restricciones.

## Persistencia y permisos

`PlanBorrador` es un modelo global de Plataforma, sin empresa. La migración `20260920220000_planes_borradores` crea y precarga los tres borradores. No modifica `Plan`, `Suscripcion`, derechos de empresas ni precios.

`GET /api/plataforma/planes-borradores` devuelve catálogo y borradores. `PUT` guarda un lote de cambios con versión del catálogo y revisión de cada borrador. La API valida campos, claves, límites, base obligatoria y dependencias, y rechaza capacidades privadas/adicionales.

El guardado exige una sesión personal vigente de administración con MFA completo. Dentro de la transacción se vuelve a verificar usuario y sesión, usando el mismo bloqueo que la gestión del equipo. Control de revisión y lote atómico: un conflicto devuelve 409 y no deja algunos planes guardados y otros pendientes. Cada cambio registra autor, antes/después y revisión en `PlataformaEvento`.

El catálogo tipado y los validadores son compartidos por API e interfaz, con claves estables y versión explícita. El contenido en JSON es interno; no se expone un editor libre de JSON.

## Validación

- API: 29 pruebas entre catálogo/borradores y aislamiento de empresas. Incluyen grafo sin ciclos, distribución acumulativa, DTO, permisos, MFA, auditoría, conflicto concurrente, reversión de lote y conservación de planes vigentes.
- Interfaz: 8 pruebas de distribución, lectura para soporte, edición/guardado, dependencias, búsqueda/diferencias, recursos, error/conflicto y revisión comercial.
- TypeScript de web y API, lint de los archivos nuevos y control de CSS global.
- Revisión visual con los componentes reales y datos de prueba en una vista local aislada. La sesión de Plataforma disponible requiere completar MFA; no se modificó esa protección para probar el editor.

Estas comprobaciones no equivalen a probar restricciones comerciales en todo el ERP ni cobros en Paddle.

## Pendiente antes de comercializar

**Actualización 21/09:** se implementó el [primer evaluador y comparación con empresas](planes-evaluador-desacople-2026-09-21.md), con el desacople inicial de reservas y previsión. La lista siguiente conserva el alcance completo que debe cerrarse antes de comercializar.

1. Capturar derechos y límites vigentes y construir el evaluador por capacidad, con diagnóstico de diferencias antes de aplicarlo.
2. Completar y probar controles en API, servicios, procesos diferidos e integraciones para los módulos que se diferencian. Resolver los hallazgos de `todo`, cupos, almacenamiento y dependencia fiscal del catálogo auditado.
3. Validar operativamente las funciones señaladas, en particular compras, reservas y previsión de disponibilidad.
4. Definir precios, almacenamiento y condiciones de usuarios adicionales.
5. Publicar versiones inmutables, vincular precios/checkout y crear migraciones revisables de suscripciones. El guardado actual no publica ni asigna planes.
6. Implementar adicionales confirmados por el proveedor y usar una oferta común en marketing, registro y suscripción.

Referencias: [auditoría de capacidades](planes-catalogo-capacidades-auditoria-2026-09-20.md) y [secuencia de implementación](planes-editor-visual-diseno-2026-09-20.md).
