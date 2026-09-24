# Páginas legales para la integración de WhatsApp

Preparación local del 24 de septiembre de 2026. No se publicó la web ni se cambió la aplicación de Meta.

## Versión y ubicación

La versión `2026-09-24` se mantiene en `apps/marketing/src/app`:

| Ruta de la web principal | Uso |
| --- | --- |
| `/privacidad` | Política común para el sitio, el sistema y sus integraciones; incluye datos, finalidades, destinatarios y derechos relativos a Meta/WhatsApp. |
| `/terminos` | Condiciones del servicio y de la integración: autorizaciones, consentimiento, plantillas, costos, baja y elegibilidad para coexistencia. |
| `/eliminacion-de-datos` | Instrucciones para solicitar por correo desconexión, supresión de datos o cierre de cuenta. |

Las tres rutas homónimas del sistema redirigen a la web principal y son públicas, incluso para usuarios sin sesión. El registro conserva sus enlaces existentes. La portada, el registro y los propios documentos enlazan la página nueva. No se agregó una segunda copia de los textos.

La vista previa de esta revisión está en `http://localhost:3012`: el puerto 3002 está ocupado por Gotenberg en este equipo. Se ajustó únicamente `MARKETING_SITE_URL` en el `.env.local` del sistema para que los enlaces locales funcionen. Para volver a levantar esta vista previa, desde `apps/marketing`, ejecutar `MARKETING_SITE_URL=http://localhost:3012 ./node_modules/.bin/next dev --hostname 127.0.0.1 -p 3012`.

## Alcance comprobado en el código

- La integración actual de WhatsApp usa WATI. Los textos sobre conexión directa, inbox y coexistencia están condicionados a que esas funciones estén disponibles; no anuncian su lanzamiento ni una aprobación de Meta.
- `IntegracionesService.desconectar` limpia las credenciales de WATI y marca la conexión como desconectada. Conserva la fila y no equivale a borrar contactos, registros, archivos o una cuenta.
- La página nueva ofrece un trámite manual por `soporte@grafoprint.com.ar`. No se implementó un botón, callback de Meta ni proceso automático de borrado.
- La versión predeterminada que registra el API al aceptar términos y `apps/api/.env.example` se actualizaron a `2026-09-24`. Los consentimientos históricos no se modificaron.

## Datos confirmados por el titular

- Dominio: `grafoprint.com.ar`, administrado en Donweb; publicación pendiente.
- Razón social responsable: **GRUPO IDEA SAS**; marca y servicio: **Grafoprint**.
- CUIT: **33-71888258-9**.
- Domicilio legal público: **Julio Argentino Roca 1260, El Calafate, Santa Cruz,
  CP 9405, Argentina**.
- Correo público de soporte y privacidad: **soporte@grafoprint.com.ar**.
  El titular confirmó que funciona. No se enviaron correos de prueba desde esta tarea.
- Responsable interno de solicitudes: **Lucas German Gomez**. Este nombre se
  conserva en la documentación operativa y no se muestra en las páginas públicas.

La identificación fiscal y el domicilio se incorporaron al bloque de contacto
compartido por las tres páginas legales. Los datos provienen del titular;
no constituyen una verificación registral independiente.

## Datos operativos que hay que cerrar por etapa

Para la primera publicación, revisar el alcance real de la web de prelanzamiento,
su hosting, registros técnicos y consultas por correo. Las funciones futuras
del SaaS deben estar descritas como tales. Los siguientes procesos deben estar
resueltos para los datos que ya se traten, y completarse para todos los datos del
sistema antes de recibir clientes reales, incluido el piloto.

1. Organizar el seguimiento de solicitudes y un reemplazo para el responsable.
2. Los proveedores elegidos son Vercel, Fly, Neon y R2. Confirmar sus planes,
   regiones y condiciones reales, además de Redis, correo y otras integraciones
   activadas. La lista amplia heredada de la política debe coincidir con el
   despliegue y distinguir lo activo de lo futuro. Elegir São Paulo para Fly/Neon
   no demuestra que R2 y todos los proveedores alojen los datos en Brasil.
3. Definir la matriz de conservación: contactos, mensajes y adjuntos, registros de entrega, logs, documentos fiscales, credenciales y respaldos. Para cada categoría: responsable, motivo, plazo, método de supresión y proveedores afectados. No se inventó un plazo de 30 o 90 días para respaldos.
4. Probar con datos de ensayo el procedimiento manual de identificación, exportación cuando corresponda, supresión y verificación. Incluir cómo evitar que una restauración o sincronización reincorpore información suprimida. La documentación pública establece compromisos que este procedimiento debe poder cumplir.

Las comprobaciones operativas anteriores están pendientes: las páginas son una versión preparada para revisión, no evidencia de que esos procesos ya estén implementados. La retención técnica no sustituye los plazos legales.

## Publicación coordinada, pendiente de autorización

1. Configurar `MARKETING_SITE_URL` con el origen HTTPS real tanto en marketing como en el sistema. Debe apuntar a marketing, no al dominio de la aplicación, para evitar un bucle de redirección. Configurar `MARKETING_APP_URL` en marketing para login y registro.
2. Publicar primero las páginas de marketing. Después publicar el sistema con las redirecciones para que los enlaces de registro no queden sin destino.
3. Coordinar el despliegue del API y su variable `TERMINOS_VERSION=2026-09-24` con la publicación de los términos. Si el entorno conserva una variable anterior, prevalece sobre el valor predeterminado. No cambiar retroactivamente las aceptaciones ya registradas; definir la comunicación de la actualización a clientes existentes.
4. Verificar por HTTPS y sin sesión las tres páginas, los enlaces de la portada y el recorrido desde registro. Comprobar que el dominio y los metadatos canónicos corresponden al sitio publicado.
5. En Configuración básica de la app Grafoprint en Meta, cargar los destinos públicos de privacidad, términos y la opción de **URL de instrucciones de eliminación de datos**. La página de instrucciones no es un callback de eliminación y no debe configurarse como tal.

Completar estas páginas cubre una parte de la preparación. Access Verification, App Review, permisos, onboarding y pruebas de WhatsApp siguen siendo trámites o desarrollos separados; no quedan aprobados al agregar las URL.

## Verificación realizada

- Actualización de identificación: las tres páginas respondieron HTTP 200 con
  razón social, CUIT, domicilio y correo confirmados; el nombre del responsable
  interno no aparece en el HTML público. ESLint del componente compartido aprobado.
- Build de Next.js de marketing correcto; genera las tres páginas estáticas. No se ejecutó el generador de Grafo 3D, ajeno a estos cambios.
- TypeScript del sistema y lint de los archivos TypeScript/TSX modificados del sistema y marketing sin errores.
- Diez pruebas de ruteo aprobadas: documentos accesibles con o sin sesión, incluyendo sesión de plataforma; rutas con prefijos parecidos continúan protegidas.
- Las tres rutas del sistema responden con redirección y terminan en una página pública con HTTP 200. Se verificaron título y URL canónica propios de cada documento.
- Revisión en Chrome de escritorio y a 390 px de ancho; sin desbordamiento horizontal en los tres documentos. Verificados enlaces entre documentos y desde el pie de la portada.

## Fuentes consultadas

- [Meta: proceso para Tech Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers).
- [Meta: App Review](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review).
- [Meta: onboarding de usuarios de WhatsApp Business](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/).
- [WhatsApp: política de mensajes](https://whatsappbusiness.com/policy/).
- [Ley 25.326, texto oficial actualizado](https://www.argentina.gob.ar/normativa/nacional/64790/actualizacion), especialmente identificación del responsable y derechos de acceso y supresión.
