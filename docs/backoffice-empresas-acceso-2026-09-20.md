# Plataforma: empresas, acceso y suscripción confiables

Fecha: 20/09/2026. Rama: `codex/rediseno-backoffice-plataforma`.

## Entrega

Acceso desde `/plataforma?vista=tenants`. La sección se llama **Empresas**.

- Directorio paginado en servidor (25 por página; API máximo 100), con búsqueda por nombre, slug, correo del administrador y referencia externa. Filtro explícito de bloqueo administrativo.
- Ficha con enlace propio mediante `empresa=<uuid>`; volver conserva búsqueda y página. Pestañas Resumen, Suscripción, Funciones y límites, Usuarios e Historial.
- El directorio y las fichas consultan sólo sus datos. El contexto de staff se obtiene con un endpoint pequeño; la consola agregada se carga al visitar Observabilidad o Impersonación.
- Acceso efectivo explicado: operativo, solo lectura o bloqueado. Se muestran por separado el contrato del proveedor, el estado local y el bloqueo.
- Fechas de prueba, mora, gracia, próximo cobro, cambios programados y últimas sincronizaciones. Sin registro se muestra explícitamente; no se infiere el importe contratado a partir del catálogo.
- Funciones consultables con motivo de inclusión/restricción, límites, usuarios habilitados e historial de intervenciones paginado.

## Reglas administrativas

1. **Bloquear acceso** modifica sólo el acceso del tenant, guarda motivo y fecha y registra la intervención. Conserva contrato, proveedor, estado y fechas de suscripción.
2. **Levantar bloqueo** habilita el acceso administrativo; si el contrato continúa inactivo, la cuenta queda en solo lectura. No reactiva contratos cancelados ni regulariza deudas.
3. **Asignar plan manual** está disponible sólo para suscripciones manuales sin referencia externa y cuentas sin plan. Conserva estado y fechas de un contrato existente. No renueva pruebas al cambiar de plan.
4. El API rechaza la asignación local sobre suscripciones externas, aunque el cliente intente llamar el endpoint directamente. El cambio comercial de Paddle sigue disponible desde Plan y facturación de la empresa; su nueva operación administrativa con previsualización queda para la etapa de suscripciones.
5. Las tres acciones exigen motivo por API. La UI muestra el efecto antes de confirmar y evita envíos repetidos mientras la operación está pendiente.
6. Mutación y auditoría son transaccionales. El bloqueo de fila serializa intervenciones sobre la misma empresa; una asignación manual verifica de forma condicional que no haya aparecido una vinculación externa concurrente.
7. La caché local de sesiones se invalida al cambiar acceso. Otras réplicas conservan el TTL existente, de hasta 30 segundos, indicado en el formulario.

El diagnóstico de acceso es compartido con el control de escrituras y capacidades. Pruebas o gracias vencidas restringen las escrituras aunque el cron todavía no haya actualizado el estado persistido. Las lecturas y las rutas de recuperación autorizadas conservan su comportamiento.

La inclusión de funciones comparte un evaluador con los controles de la API. Impresión directa sigue requiriendo habilitación explícita; ni `todo` ni una cuenta legacy la habilitan por sí solos.

## Compatibilidad y despliegue

Migración aditiva `20260920160000_tenant_bloqueo_acceso`: añade motivo y fecha nullable a Tenant. Aplicada en las bases locales de desarrollo y test; no cambia filas históricas ni estados de suscripción.

Los bloqueos anteriores sin metadatos se muestran como históricos sin motivo registrado. Una suscripción que el flujo anterior dejó suspendida no se reactiva automáticamente al quitar el bloqueo: requiere revisar su contrato. Los eventos antiguos siguen disponibles.

Los endpoints de cambio de plan, suspensión y reactivación devuelven ahora la ficha de empresa, en lugar de toda la consola. Reactivar y asignar plan requieren `motivo`. API y frontend deben desplegarse juntos después de la migración.

## Validación

- Pruebas de integración con PostgreSQL dedicado de test: bloqueo seguido de confirmación de pago, reactivación con baja/mora, cambio de plan externo rechazado, conservación de fechas, bloqueos históricos, concurrencia, filtros, aislamiento por empresa y paginación más allá de 30 eventos.
- Regresiones de Plataforma, roles, impersonación, login, webhook de Paddle, control de escrituras e impresión directa.
- Pruebas de UI: consulta paginada con filtros, respuesta demorada de otra empresa descartada, acciones ocultas para soporte, motivo obligatorio, envío duplicado y error recuperable.
- TypeScript de API/frontend, ESLint, control de CSS y `git diff --check`.
- Revisión visual en la app local del directorio y fichas, datos de Paddle, funciones e historial. Sin ejecutar cambios administrativos sobre las empresas existentes.

## Siguientes etapas

Equipo/MFA, permisos más específicos, cambios comerciales desde Plataforma con previsualización, pilotos y excepciones, operación técnica y métricas comerciales siguen el [plan general](backoffice-profesional-investigacion-y-plan-2026-09-20.md). La consola histórica aún realiza agregaciones amplias cuando se visita Observabilidad; se desacopló del directorio, no se reemplazó todavía su motor de analítica.
