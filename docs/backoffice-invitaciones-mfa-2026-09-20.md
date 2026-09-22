# Invitaciones del equipo y MFA obligatorio

**Fecha:** 20 de septiembre de 2026.  
**Estado:** implementado en `codex/rediseno-backoffice-plataforma`.  
**Rutas:** `/plataforma?vista=equipo`, `/backoffice/invitacion`, `/backoffice/seguridad`.

## Recorrido del administrador

1. En Equipo, elegir **Invitar integrante**, indicar correo, rol y motivo. El rol inicial del formulario es Soporte.
2. Copiar el enlace que devuelve Grafo y compartirlo por un canal privado conocido. No se envía un correo automáticamente en esta entrega.
3. La pestaña Invitaciones muestra quién invitó, vencimiento y estado: pendiente, vencida, cancelada o aceptada.
4. Renovar genera un enlace diferente e invalida el anterior; cancelar impide su aceptación. Ambas acciones requieren motivo y quedan auditadas.

Los enlaces vencen a las 72 horas y se pueden aceptar una sola vez. La URL completa sólo se entrega al crear o renovar; no vuelve en los listados ni en el historial.

## Recorrido del invitado

1. Abrir el enlace. Grafo presenta el correo, rol y vencimiento.
2. Si la cuenta ya tiene contraseña, ingresar la contraseña actual. Se conservan su nombre, contraseña y membresías. Si ya usa MFA, también debe completar ese desafío antes de aceptar.
3. Si no tenía contraseña, completar nombre y una contraseña de al menos 12 caracteres. El límite superior respeta los 72 bytes de bcrypt.
4. Activar MFA con una app autenticadora y verificar un código. Guardar los códigos de recuperación y confirmar **Listo**.
5. Continuar a Plataforma. No se crea una empresa ni una membresía de cliente para incorporar staff.

Una cuenta deshabilitada no puede aceptar. Tampoco se admiten invitaciones nuevas a quienes ya son integrantes del equipo. Si quien invitó pierde Administración, se invalidan sus invitaciones pendientes; al aceptar también se comprueba que siga activo y autorizado.

## Política de acceso

Todos los roles de Plataforma requieren MFA activa, confirmación de guardado de recuperación y una sesión que haya verificado el factor vigente. Los guards del servidor aplican la política; ocultar o saltear una pantalla no permite administrar.

Al ingresar sólo con contraseña se puede obtener una sesión limitada para completar el enrolamiento. Ésta permite consultar el contexto, gestionar el MFA propio y cerrar sesión. No permite operar empresas, invitar personas, cambiar permisos ni iniciar soporte. Una sesión de empresa tampoco habilita Plataforma: se debe entrar por Backoffice.

La confirmación de códigos se vincula a la sesión que los generó y a su versión. Confirmar una versión vieja o desde otra sesión no habilita el acceso. Reintentar la confirmación ya realizada de la misma versión es seguro si se perdió la respuesta.

No se puede desactivar MFA mientras se tenga rol de Plataforma. Los usuarios que sólo pertenecen a empresas conservan su política previa. MFA protege la identidad global: activarla, reemplazarla o renovar recuperación revoca las otras sesiones del titular, incluidas las de empresa.

La protección de último administrador exige que quede una cuenta activa con contraseña, MFA y recuperación confirmada. Los cambios del equipo releen la autorización dentro de la transacción y se serializan para evitar revocaciones concurrentes que dejen al sistema sin administración.

## Recuperación cotidiana

### Perdí el teléfono, pero tengo códigos guardados

1. Ingresar con contraseña y un código de recuperación. Cada código funciona una sola vez.
2. En la seguridad propia, elegir **Reemplazar autenticador**.
3. Confirmar contraseña y otro código de recuperación sin usar; si todavía se tiene la app anterior, también sirve un código nuevo de esa app.
4. Vincular y verificar la nueva app. Hasta esta verificación el factor anterior sigue activo; cancelar sólo elimina el reemplazo pendiente.
5. Guardar los nuevos códigos y confirmar. Los códigos anteriores dejan de funcionar y las otras sesiones se cierran.

Si sólo queda un código de recuperación, usarlo para iniciar sesión y solicitar asistencia antes de cerrar esa sesión: el reemplazo exige otro factor válido. No se omite esa verificación por tener una sesión abierta.

### Perdí la hoja de códigos, pero todavía tengo la app

Elegir **Renovar códigos**, confirmar contraseña y un código nuevo de la app, guardar el nuevo juego y confirmar. El juego anterior se invalida. Si se cierra o recarga la página antes de guardar, se deben generar códigos nuevos; Grafo no conserva una copia recuperable en texto plano.

### Perdí la app y todos los códigos

Esta entrega no ofrece un restablecimiento automático ni un botón para que otro administrador eluda MFA. El caso requiere recuperación asistida de infraestructura. Procedimiento a completar antes de operar producción:

1. Abrir un incidente con identidad y cuenta afectada, sin solicitar contraseñas, secretos o códigos por chat.
2. Verificar la identidad por un canal previamente registrado y obtener autorización del responsable de la plataforma; sumar un segundo responsable cuando exista.
3. Un operador autorizado de infraestructura realiza una intervención acotada y transaccional sobre esa identidad: revocar sesiones y desafíos, invalidar factores anteriores y dejar pendiente el nuevo enrolamiento. Registrar actor, motivo, evidencia y resultado; no copiar secretos al registro.
4. El titular vuelve a autenticarse y configura personalmente el nuevo factor. Comprobar acceso y cierre de las sesiones antiguas antes de cerrar el incidente.

La herramienta operativa y el ensayo de ese procedimiento siguen pendientes. No se ha habilitado una cuenta sin MFA como puerta alternativa. Tener un segundo administrador enrolado ayuda a continuar la operación, pero no lo autoriza a restablecer el MFA ajeno desde la UI.

## Implementación y límites

- Tabla global `InvitacionPlataforma`, separada de las invitaciones a empresas. Token aleatorio de 32 bytes; persistencia únicamente de SHA-256. El secreto viaja en el fragmento de la URL y luego en el cuerpo de un POST, con respuestas `no-store`.
- Aceptación y rol en una transacción; bloqueo de identidad compartido con login/MFA. Los desafíos MFA de aceptación están vinculados a la invitación y vuelven a validar su vigencia al consumirse.
- Renovar crea otra invitación para invalidar también los desafíos del enlace anterior. Cancelar no necesita borrar un desafío que pueda estar en uso; la aceptación revalida el registro cancelado.
- MFA reutiliza secretos cifrados, hashes de códigos, límites de intentos y prevención de reutilización TOTP existentes. No hay otro sistema de autenticación paralelo.
- Auditoría de crear, aceptar, renovar y cancelar invitaciones; activar/reemplazar MFA, regenerar y confirmar recuperación. No contiene enlaces, contraseñas, secretos, códigos ni hashes.
- Listados e historial paginados. Soporte consulta; Administración gestiona. Las credenciales MCP y sesiones de impersonación no pueden enrolar ni modificar factores.
- La verificación por sesión acredita MFA en el ingreso o cambio de factor. No es una reautenticación reciente para cada operación sensible; ese refuerzo queda pendiente.

## Puesta en marcha

Aplicar `20260920190000_equipo_invitaciones_mfa` y regenerar Prisma antes de reiniciar la API. La migración ya se aplicó en desarrollo y en la base aislada de pruebas.

Las sesiones anteriores no se marcan artificialmente como verificadas. Al volver a Plataforma, una cuenta sin MFA va al enrolamiento. Si ya tenía MFA, debe volver a ingresar con su factor y renovar/confirmar recuperación si aún no tenía el nuevo registro de confirmación. El primer administrador puede completar este flujo sin necesitar que otro lo habilite.

En producción, `FRONTEND_URL` debe indicar el origen público HTTPS correcto. La clave de cifrado `INTEGRACIONES_ENCRYPTION_KEY` debe estar configurada y respaldada en el gestor de secretos operativo. Cambiarla sin migrar los datos cifrados deja inaccesibles los factores y otras integraciones; su rotación requiere un proceso específico.

## Verificación

- 179 pruebas de API aprobadas: invitaciones, aceptación concurrente, cancelación/renovación, cuenta existente, autorización, MFA, recuperación, reemplazo, sesiones antiguas, impersonación y aislamiento.
- 18 pruebas de interfaz aprobadas: Equipo, invitaciones, login, Empresas y recuperación MFA; incluye conservar los códigos si falla la confirmación y permitir reintentar.
- TypeScript de API y web, revisión de CSS y comprobación de whitespace sin errores.
- Revisión visual de la pantalla de enrolamiento con la cuenta local existente; no se activó ni reemplazó su autenticador durante la prueba.

La prueba de correo real queda fuera: esta entrega genera enlaces y no envía mensajes. La recuperación asistida sin factores necesita su herramienta y ensayo operativo antes de considerarse resuelta.
