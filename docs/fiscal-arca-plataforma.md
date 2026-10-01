# Certificado ARCA de la plataforma

Implementación local del 01/10/2026; todavía sin despliegue ni certificado real cargado.

## Qué cambia

Plataforma → Facturación ARCA permite cargar juntos el certificado `.crt` y su clave `.key` en PEM, hasta 16 KB por archivo. Administración de Plataforma, con sesión personal y MFA completa, puede reemplazarlos. Soporte sólo consulta estado, CUIT y vencimiento. Ningún endpoint devuelve el certificado, la clave ni el sobre cifrado.

El servidor comprueba el par RSA de al menos 2048 bits, las fechas y el CUIT del titular. Esto no acredita la cadena de confianza ni la autorización fiscal: después se debe verificar WSFE desde Integraciones de la empresa. Guardar no emite comprobantes.

El ambiente lo fija `AFIPSDK_ENVIRONMENT`: `dev` o `prod`. La pantalla no puede cambiarlo. No cargar certificados de producción en homologación. En producción, sin certificado vigente y descifrable la autenticación se bloquea. `AFIPSDK_ACCESS_TOKEN` sigue en los secretos del servidor. Las antiguas variables `AFIPSDK_CERT` y `AFIPSDK_KEY` no se utilizan.

## Protección y rotación

- AES-256-GCM con `INTEGRACIONES_ENCRYPTION_KEY`, fuera de la base, y contexto autenticado que liga el material a plataforma, ambiente y revisión.
- Reemplazo por revisión: dos administradores no pisan silenciosamente el mismo certificado.
- Auditoría atómica del reemplazo, sin material privado. Los errores HTTP del proveedor no reflejan su cuerpo, porque podría contener credenciales.
- AFIP SDK recibe `cert` y `key` sólo al solicitar el ticket. Cada consulta lee la revisión vigente y separa la caché por credencial, revisión, ambiente, CUIT emisor y webservice. No se fuerza la creación de tickets.
- La llave de cifrado debe estar incluida en la custodia de recuperación del entorno. Restaurar sólo la base no alcanza para recuperar las credenciales.

## Modelo SaaS y prueba previa al uso real

El certificado representa a la plataforma; cada empresa conserva su propio CUIT y puntos de venta. Para otros CUITs, hace falta la delegación y autorización correspondientes. Para el mismo CUIT del titular se verifica la autorización del webservice. No guardar claves fiscales personales de clientes.

1. Configurar acceso AFIP SDK y cifrado del entorno nuevo.
2. Aplicar la migración aditiva `20261001040000_certificado_arca_plataforma` y comprobar permisos del rol de aplicación.
3. Entrar a Plataforma con MFA y cargar el par correcto para ese ambiente.
4. Configurar CUIT y punto de venta de webservices en la empresa nueva.
5. Consultar el último número autorizado mediante la verificación existente, sin emitir una factura de ensayo en producción.
6. Habilitar la integración de la empresa tras la verificación. Comprobar el primer comprobante comercial legítimo cuando corresponda.

El adaptador actual implementa WSFE para A/B/C. Exportación E usa WSFEX y no está integrada en este proveedor. El plan de AFIP SDK, sus límites y las autorizaciones de cada empresa se deben verificar antes de habilitar nuevos emisores.

## Fuentes

Revisadas el 01/10/2026:
- [API de AFIP SDK: certificado y clave propios](https://docs.afipsdk.com/integracion/api).
- [Modelo de delegación para múltiples CUITs](https://afipsdk.com/blog/como-obtener-certificado-para-web-services-arca/).
- [Documentación WSAA de ARCA](https://www.arca.gob.ar/ws/documentacion/wsaa.asp).

## Validación

Certificados ficticios, base exclusiva `grafo_arca_<fecha>_test`, migración desde cero y consultas de proveedor simuladas. Se prueban pares inválidos, vigencia, CUIT, cifrado ligado a ambiente/revisión, permisos HTTP, auditoría y reemplazos concurrentes. Se conserva la regresión de permisos por plan, emisión y concurrencia fiscal. La vista previa `/dev/diseno/arca` sólo está disponible en desarrollo y nunca envía credenciales.
