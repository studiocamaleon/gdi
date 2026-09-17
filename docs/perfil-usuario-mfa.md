# Perfil de usuario y MFA

El perfil se abre desde el avatar del menú. Tiene tres secciones: Perfil,
Seguridad y Empresas, con el tema de marca claro de Grafo. Permite editar el
nombre, cambiar o quitar la foto, cambiar la contraseña y administrar MFA.
El correo se muestra como dato de consulta. El botón Guardar se habilita con
cambios y lleva el contador dentro.

## Identidad y foto

Nombre, foto y MFA pertenecen a `User`, compartido entre empresas. Las rutas
`auth/perfil` derivan el usuario de la sesión: no aceptan un identificador de
usuario enviado por el cliente. Están disponibles para todos los roles y con
suscripción inactiva; se rechazan sesiones de impersonación y credenciales MCP.

La foto se prepara a 512 × 512 en el navegador. El servidor admite hasta
512.000 bytes, valida JPEG/PNG/WEBP, limita la decodificación a 16 megapíxeles
y vuelve a generar WEBP sin metadatos. No admite SVG ni imágenes animadas.
Se guarda en el driver existente (R2 en producción, local en desarrollo), con
una versión UUID y URL firmada de 60 segundos. La versión previa se elimina
tras guardar la nueva. Si falla la limpieza, se registra el fallo; si falla
la actualización de base, se intenta retirar el objeto nuevo.

`CurrentUser.fotoPerfilVersion` actualiza el avatar de la barra lateral tras
el refresco. Sin foto o ante error de descarga se muestran las iniciales.
La subida no utiliza la cuota de archivos de una empresa: es un único avatar
pequeño de la identidad global.

## Activación y uso de MFA

1. El usuario confirma su contraseña actual.
2. Se genera un secreto pendiente durante diez minutos, vinculado a esa sesión.
   El QR se genera en el servidor, sin servicios externos. También puede
   copiarse la clave para ingresarla manualmente.
3. Se activa únicamente al verificar un código de la app autenticadora.
4. Se muestran diez códigos de recuperación una sola vez. Pueden copiarse o
   descargarse; la UI pide confirmar que se guardaron antes de cerrar ese paso.

Se usa TOTP SHA-1, seis dígitos, períodos de treinta segundos y tolerancia de
un período a cada lado, compatible con apps autenticadoras habituales.
[Implementación OTPAuth](https://github.com/hectorm/otpauth).
El paso TOTP ya utilizado no puede repetirse. Cada código de recuperación es
aleatorio (80 bits), se almacena hasheado y sólo sirve una vez.

Con MFA activo, contraseña correcta produce un desafío opaco de cinco minutos,
no una sesión ni un JWT. `POST /auth/mfa/verificar` exige TOTP o recuperación
antes de emitirlos. El desafío está ligado a la contraseña y versión de MFA;
al completar se revalidan usuario, rol de plataforma o membresía/red de empresa.
El login de plataforma también lo aplica. Aceptar una invitación de una cuenta
con MFA dirige al login, sin emitir una sesión que evite el segundo factor.

Hay límites por IP en los endpoints y cinco intentos por desafío. Cinco errores
de factor bloquean nuevos intentos de esa identidad por cinco minutos. Los
contadores persisten aun cuando se rechaza el código. El consumo y la emisión
de sesión se serializan mediante un bloqueo de la fila User, para impedir
reutilización concurrente. Activar, desactivar y renovar códigos también
serializan sobre esa identidad.

Desactivar MFA o renovar códigos exige contraseña actual y un factor válido.
Las tres operaciones revocan otras sesiones y desafíos; la sesión actual sigue
abierta. La invalidación de la caché de sesiones es local a cada réplica, como
el resto del sistema: otras réplicas tienen la ventana existente de 30 segundos.
Una cuenta sin su app ni códigos de recuperación requiere recuperación asistida;
no se agrega un bypass público ni un botón administrativo para quitar MFA.

## Persistencia y despliegue

- Migración aditiva `20260918001500_perfil_usuario_mfa`.
- Modelos globales `UserMfa` y `MfaChallenge`, exentos del filtro de tenant.
- Secretos activos y pendientes cifrados con AES-256-GCM mediante el servicio
  existente `SecretosService` y `INTEGRACIONES_ENCRYPTION_KEY`.
- La clave debe conservarse en el gestor de secretos y en la estrategia de
  recuperación del entorno. Cambiarla sin migrar el cifrado impide verificar
  MFA existente, además de afectar las integraciones que ya la usan.
- Sin clave válida, desarrollo informa que la activación no está disponible;
  producción falla al iniciar, siguiendo el contrato existente del servicio.
- El barrido de sesiones elimina desafíos vencidos y secretos pendientes vencidos.
- Los endpoints que entregan secretos/códigos y el estado usan `no-store`.

## Validación

47 pruebas de API: activación, cifrado, códigos de un uso, concurrencia,
revocación, vencimiento, límites de intentos, cambio de contraseña, restricciones
por IP, login de plataforma, invitaciones, fotos, edición del nombre, aislamiento
y regresiones de sesión/impersonación. Se ejecutan sobre `gdi_saas_test` con
usuarios temporales y limpieza acotada a los datos de cada prueba.

TypeScript web y API (configuración de producción), ESLint de archivos editados,
CSS Guard y revisión en Chrome en escritorio, 390 px y 320 px. Se comprobaron
edición pendiente, contador de cambios, correo de consulta, pestañas y scroll.
No se modificó la identidad ni la configuración MFA de la cuenta usada para
la revisión visual.
