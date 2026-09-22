# Equipo y acceso de Plataforma

**Estado:** directorio, permisos e invitaciones implementados, con MFA obligatorio; actualizado el 20 de septiembre de 2026. Véase el [flujo de invitaciones y recuperación](backoffice-invitaciones-mfa-2026-09-20.md).  
**Ruta:** `/plataforma?vista=equipo`.  
**Rama:** `codex/rediseno-backoffice-plataforma`.

## Qué puede hacer el equipo

- Consultar integrantes con búsqueda y paginación; distinguir rol, estado de la cuenta, MFA y sesiones activas de backoffice.
- Ver la matriz de permisos de Administración y Soporte.
- Administración puede invitar integrantes por correo mediante un enlace, cambiar su rol, quitar su acceso a Plataforma o cerrar sus sesiones de Plataforma. El destinatario acepta con su cuenta existente o crea su propia contraseña si aún no tiene cuenta.
- Las acciones requieren una sesión personal de backoffice y un motivo de 5 a 300 caracteres. Soporte tiene lectura; no puede gestionar personas ni iniciar impersonaciones.
- Cada titular debe activar MFA y confirmar que guardó sus códigos de recuperación para operar Plataforma. Puede renovar sus códigos o reemplazar su autenticador después de validar su contraseña y segundo factor. El staff no puede desactivar MFA.
- El historial reúne cambios de equipo, operaciones MFA de staff y los otorgamientos/revocaciones anteriores realizados por el script de administración. No es un historial de todos los inicios de sesión.

## Independencia de las empresas

`User.rolPlataforma` controla el backoffice. Las membresías y roles de empresa siguen independientes.

Un cambio de rol o baja revoca las sesiones de Plataforma, cierra impersonaciones y elimina desafíos MFA pendientes cuyo destino sea Plataforma. Conserva sesiones ordinarias y membresías de empresas. Si la persona modifica su propio rol o se quita el acceso, su sesión actual también se cierra; al cerrar sólo sus otras sesiones se conserva la actual.

MFA, en cambio, protege la identidad global: activarla o modificarla también revoca las otras sesiones de empresa del titular. El formulario informa este alcance antes de confirmar.

## Consistencia y autorización

- Guards del servidor para lectura y administración. El servicio vuelve a comprobar el rol y la sesión del actor dentro de la transacción.
- Cambios del equipo serializados con un advisory lock transaccional de PostgreSQL; lectura del destinatario bajo bloqueo de identidad compatible con el login/MFA existentes.
- No se puede degradar o revocar al último administrador activo con contraseña, MFA y recuperación confirmada desde esta API. Dos administradores no pueden quitarse acceso mutuamente en una carrera: el segundo pierde autorización antes de escribir.
- Cada actualización lleva el rol que veía el operador; si cambió, el servidor rechaza la operación para evitar sobrescribir una decisión más reciente.
- Alta repetida y cambio al mismo rol se rechazan. Roles desconocidos, campos adicionales y motivos vacíos también se rechazan.
- `PlataformaGuard` rechaza sesiones de impersonación y credenciales MCP. El guard de autenticación comprueba que una impersonación siga perteneciendo a un ADMIN, incluso si un cambio de rol ocurrió fuera de esta pantalla.
- Auditoría y actualización se confirman juntas. La auditoría no guarda contraseñas, secretos TOTP, códigos ni sus hashes.
- Directorio e historial paginados. El directorio sólo selecciona el estado de MFA y agrega cantidad de sesiones; no descarga todas las sesiones ni la configuración sensible.

## Endpoints

| Método | Ruta | Alcance |
|---|---|---|
| GET | `/plataforma/equipo` | Directorio paginado, filtros y roles |
| GET | `/plataforma/equipo/historial` | Historial paginado del equipo |
| POST | `/plataforma/equipo` | Otorgar acceso a una cuenta existente |
| PUT | `/plataforma/equipo/:id` | Cambiar rol, revocar acceso o cerrar sesiones |
| GET / POST | `/plataforma/equipo/invitaciones` | Consultar o crear invitaciones |
| POST | `/plataforma/equipo/invitaciones/:id` | Cancelar o renovar un enlace |

La interfaz de seguridad reutiliza `/auth/perfil/mfa` y el componente `PerfilMfa`. No se agregó un segundo mecanismo de autenticación ni una tabla duplicada de operadores.

## Alcance pendiente

1. Envío automático y seguimiento de correos de invitación. Por ahora Administración comparte el enlace por un canal privado conocido.
2. Confirmación reciente de identidad para acciones especialmente sensibles y herramienta de recuperación asistida para quien perdió tanto el autenticador como todos sus códigos. Ningún administrador puede leer o restablecer el segundo factor de otra persona desde esta pantalla.
3. Roles adicionales sólo cuando haya responsabilidades reales que separen soporte, finanzas y operación.

El script existente queda como herramienta operativa externa para el alta inicial, no como parte del flujo diario de gestión de equipo. Las garantías de último administrador descritas aquí corresponden a la nueva API; un operador con acceso directo a infraestructura puede modificar la base por fuera del producto.

## Verificación

Validación del primer incremento: 168 pruebas de API y 12 pruebas de interfaz aprobadas; TypeScript de API y web, ESLint de los archivos trabajados y control de CSS sin errores. La ampliación de invitaciones y MFA se verifica en su documento específico.

- Pruebas de API: permisos, validación, cuentas no elegibles, datos sensibles, auditoría, roles obsoletos, cierre de sesiones, preservación de membresías y concurrencia entre administradores.
- Regresiones de MFA: activación, desafío de login, recuperación, revocación y auditoría sin secretos.
- Pruebas de interfaz: lectura de Soporte, gestión restringida al backoffice, alta con rol mínimo, motivo obligatorio, envío único, errores recuperables, cierre de sesión propia y protección del modal mientras se guardan códigos MFA.
- Revisión en navegador de directorio, permisos, alta y seguridad con la estética Grafo. No se cambiaron permisos ni se activó MFA en cuentas existentes para la prueba visual.

El directorio inicial no requirió migración adicional. Invitaciones y MFA obligatorio agregan `20260920190000_equipo_invitaciones_mfa`.
