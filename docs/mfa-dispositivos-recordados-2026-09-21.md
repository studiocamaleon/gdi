# Recordar MFA durante 30 días

## Experiencia

Al ingresar un código MFA aparece **Recordar este dispositivo durante 30 días**, desmarcado por defecto. Después de una verificación correcta, este navegador puede volver a ingresar con contraseña durante 30 días sin otro código. El plazo es fijo y no se renueva al usarlo. Otro navegador, otra identidad o el vencimiento vuelven a requerir MFA.

Empresa y Plataforma se recuerdan por separado. Recordar el acceso de empresa no permite omitir el MFA del backoffice. Siguen vigentes la contraseña, el estado del usuario, la membresía, las restricciones de red y el rol de Plataforma. Las acciones sensibles conservan sus verificaciones actuales.

En Perfil → MFA, **Olvidar dispositivos recordados** revoca los recuerdos de ambos ámbitos y las sesiones que ingresaron gracias a ellos. Si incluye la sesión actual, se vuelve al login. Cerrar sesión normalmente conserva el recuerdo: el siguiente acceso sigue pidiendo contraseña. Cambiar o recuperar la contraseña invalida por huella; cambiar el autenticador, desactivar MFA o renovar los códigos invalida por versión y revocación.

## Implementación

- `MfaDispositivo`: credencial aleatoria de 32 bytes, SHA-256 en base, usuario, ámbito, huella de contraseña, versión MFA, verificación original, vencimiento fijo, último uso y revocación. Nunca se guarda el token en claro en base.
- La emisión ocurre sólo después de consumir un segundo factor, dentro de la misma transacción y bajo el lock de identidad usado por login y revocación. Un desafío fallido no emite confianza.
- El login con recuerdo registra la fecha de verificación original y el dispositivo en `AuthSession`; no afirma que el usuario acaba de ingresar un código.
- El API entrega la credencial al BFF mediante un encabezado privado, excluyéndola del JSON. El BFF crea una cookie `HttpOnly`, `SameSite=Strict`, sin dominio compartido, y `Secure` en producción. No se guarda en localStorage.
- El BFF sólo envía esas cookies en los endpoints de autenticación. No acepta un encabezado de confianza provisto por el navegador ni devuelve el encabezado privado al frontend. Los encabezados están incluidos en la redacción de logs del API.
- La purga elimina dispositivos vencidos cuando ya no tienen sesiones activas vinculadas, conservando la posibilidad de revocar esas sesiones mientras viven.
- Migración `20260921220000_mfa_dispositivos_recordados`, aplicada en desarrollo y en `gdi_saas_test`. Desplegar la migración y regenerar Prisma antes de publicar API y web.

## Verificación

Pruebas de integración: contraseña obligatoria, ausencia/alteración/vencimiento del token, fecha fija, separación empresa/Plataforma, identidad distinta con igual contraseña y versión MFA, restricciones de red y rol, revocación, cambio de contraseña, renovación de códigos, opt-in y acceso personal sin impersonación/MCP. Pruebas de transporte confirman la exclusión del token del JSON y del navegador.

Pruebas web: opt-in en ambos logins, error y reintento, revocación desde perfil, cookies privadas, encabezados malformados y no confiar en encabezados escritos por el cliente. Las verificaciones no cambian el MFA de cuentas reales.

Resultado de cierre del incremento conjunto: 56 pruebas API en 6 suites y 21 pruebas web en 5 suites. Una prueba de enrolamiento excedió 5 s al ejecutar TypeScript/lint en paralelo; la suite se volvió a ejecutar con menos carga y pasó sin cambiar su timeout ni su implementación. TypeScript API/web, lint focal y control CSS correctos. API reiniciada, Backoffice respondió HTTP 200 y la API rechazó un login vacío con HTTP 400. La revisión visual con sesión quedó pendiente: el navegador integrado conservó una pantalla de conexión fallida.
