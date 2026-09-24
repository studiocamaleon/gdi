# Grafoprint: publicación de la web y despliegue del sistema

Plan revisado el **24/09/2026** con el repositorio y documentación oficial.
Decisiones del titular incorporadas. La primera publicación de marketing ya
está disponible en Vercel; las etapas del dominio y del SaaS siguen pendientes.
No se modificó DNS.

## Avance de la primera publicación — 24/09/2026

- Lucas creó la cuenta de Vercel, conectó GitHub y activó Pro.
- Proyecto `grafoprint-web`, equipo `camaleon`, raíz `apps/marketing`, Node 24.x.
- Web temporal: <https://grafoprint-web.vercel.app>.
- Commit publicado: `604bf177c615ca9b5fa10b78b50f99d838ceffd9`, de
  `meta-tech-provider`, promovido después de aprobar Lint y TypeCheck.
- Despliegue: `dpl_2PazpEPg3Axeckis4egVkmxkJe8F`. En Vercel es Production;
  su finalidad en esta etapa es revisar la web antes de conectar el dominio.
- Variables de Production y Preview: `MARKETING_LAUNCH_MODE=prelaunch`,
  `MARKETING_SITE_URL=https://grafoprint-web.vercel.app` y
  `MARKETING_CONTACT_URL=mailto:soporte@grafoprint.com.ar`.
- [PR borrador #1](https://github.com/studiocamaleon/gdi/pull/1), sin integrar
  en `main`. Los envíos a la rama generan previews; la promoción de esta
  versión fue manual. No publicar otro estado de `main` antes de integrarla.
- Se comprobaron las páginas públicas por HTTPS sin sesión, sus enlaces y
  URLs canónicas. Grafo3D generó el ejemplo y descargó un paquete íntegro con
  STL, DXF, SVG y JSON. La portada se revisó también en Chrome.
- Se leyó la zona de Donweb y se guardó un inventario local de sus 27 registros,
  contrastado por consultas DNS. No se alteraron dominio ni correo.
- Vercel muestra un aviso de dirección de facturación pendiente. Lucas debe
  completar los datos correspondientes a su medio de pago en la cuenta.

Siguiente paso: revisar la web temporal y conectar `grafoprint.com.ar` y `www`
con los valores que indique Vercel, conservando el correo. Luego cambiar
`MARKETING_SITE_URL` al dominio definitivo y reconstruir la web. La infraestructura
Fly, Neon, R2 y Redis permanece pendiente.

## 1. Arquitectura y alcance acordados

| Componente | Destino | Momento |
| --- | --- | --- |
| Web comercial, Grafo3D y páginas legales | Vercel | Primera publicación |
| Aplicación Next.js de usuarios | Fly.io | Después, primero en pruebas |
| API Nest | Fly.io | Junto con la aplicación |
| Worker general: geometría, cotización y planificación | Fly.io, proceso separado | Junto con los flujos que usan colas |
| Worker de PDF | Fly.io, proceso separado | Antes de activar PDF asíncrono |
| Gotenberg, renderizador de PDF | Fly.io, servicio privado | Con el worker de PDF |
| PostgreSQL | Neon | Primero en pruebas, luego producción separada |
| Archivos de clientes | Cloudflare R2, privados | Primero en pruebas, luego producción separada |
| Redis, almacenamiento de las colas BullMQ | Propuesto: Upstash administrado vía Fly, tarifa fija | Pendiente de elegir plan y aprobar presupuesto |
| Correo transaccional | Resend, integración existente en código | Verificación y configuración pendientes |
| Dominio y correo de soporte | Donweb | Conservar durante la publicación |

Dominio comercial confirmado: `grafoprint.com.ar`. Para el sistema se propone
`app.grafoprint.com.ar` y para la API `api.grafoprint.com.ar`. Para pruebas,
`staging.grafoprint.com.ar` y `api-staging.grafoprint.com.ar`. Reservar esos nombres
en el diseño no crea registros ni recursos. No hacen falta ahora para la web.

Preferencia técnica: una región inicial, São Paulo, para Fly (`gru`) y Neon
(`aws-sa-east-1`); verificar capacidad, latencia y costo al aprovisionar.
No presupone que Vercel, R2 y todos los proveedores almacenen datos en Brasil.
Neon documenta sus [regiones](https://neon.com/docs/introduction/regions);
R2 distingue [ubicación y sugerencias de ubicación](https://developers.cloudflare.com/r2/reference/data-location/).

## 2. Estado inicial del relevamiento

- El modo de prelanzamiento y las páginas legales están preparados localmente.
  Login/registro llevan a un aviso, el contacto funciona mediante un enlace de
  correo y no se consulta la API para planes, integraciones o nesting.
- Grafo3D funciona separado del SaaS y se incorpora al build de marketing.
- Los datos públicos incorporados son GRUPO IDEA SAS, marca Grafoprint,
  CUIT 33-71888258-9, Julio Argentino Roca 1260, El Calafate, Santa Cruz,
  CP 9405, y soporte@grafoprint.com.ar. Lucas German Gomez atenderá internamente
  las solicitudes. No faltan esos datos de identificación.
- Hay cambios sin commit en la rama `meta-tech-provider`. El remoto configurado
  es `studiocamaleon/gdi`; la referencia local de rama principal es `origin/main`.
  No se verificó en este paso que el remoto contenga los cambios locales.
- No hay Dockerfiles, manifiestos Fly ni workflows de despliegue preparados en
  el repositorio. La preparación de Vercel no cubre esos componentes.
- La integración WhatsApp existente usa WATI. Desplegar este código no habilita
  por sí solo la conexión directa de Meta, el inbox ni la coexistencia.

## 3. Cerrar la versión que se publicará

**Trabajo técnico**, con revisión de contenido de Lucas.

1. Revisar el diff completo y agrupar los cambios de esta publicación sin
   descartar otros trabajos. No subir archivos `.env`, claves ni datos locales.
2. Revisar textos, contacto, imágenes y afirmaciones comerciales. Confirmar el
   alcance de Grafo3D y el aviso de próximo lanzamiento en escritorio y móvil.
3. Revisar la política y el procedimiento de solicitudes para lo que empieza a
   operar ahora: visitantes, consultas por correo, registros técnicos y hosting.
   Las funciones futuras del SaaS deben estar identificadas como tales. La
   revisión operativa completa de clientes, mensajes, archivos y respaldos se
   termina antes del piloto con datos reales; no depende sólo de tener una URL.
4. Guardar los cambios en un commit revisado, subir la rama y realizar la
   integración acordada a la rama de publicación. Usar `main` como producción
   sólo una vez que contenga la versión correcta. No publicar accidentalmente
   el estado anterior de `main` al importar el repositorio.
5. Conservar el identificador del commit y los resultados de validación. Vercel
   obtiene código de GitHub: no puede publicar cambios que sólo existen en esta Mac.

Comprobaciones realizadas: build completo con Node 24, 18 pruebas de marketing,
revisión de rutas, páginas legales, móvil y motor Grafo3D. La instalación en
Vercel y la descarga real de una exportación también están verificadas. Queda
conectar y validar el dominio propio. Ver [detalle de validación](despliegue-web-prelanzamiento.md).

**Resultado necesario:** una versión identificada y revisada, disponible para el
proveedor de despliegue. Todavía no se cambia el dominio.

## 4. Preparar Vercel

**Lucas:** titularidad de la cuenta, facturación y acceso a GitHub.
**Trabajo técnico:** configuración del proyecto.

1. Usar una cuenta/equipo administrado por la empresa, con recuperación de acceso
   y autenticación de dos factores. Registrar el responsable y la facturación.
2. Contemplar Vercel Pro para esta web comercial. El plan Hobby está reservado a
   [uso personal no comercial](https://vercel.com/docs/plans/hobby). Revisar el
   precio mostrado y configurar alertas de consumo antes de contratar.
3. Conectar GitHub con acceso al repositorio necesario e importar
   `studiocamaleon/gdi` como un proyecto de marketing independiente.
4. Confirmar la rama de producción acordada y estos ajustes:

| Ajuste | Valor |
| --- | --- |
| Root Directory | `apps/marketing` |
| Framework | Next.js |
| Node.js | 24.x |
| Install Command | `npm ci --include=dev` |
| Build Command | `npm run build` |
| Output Directory | Automático de Next.js |
| Include source files outside of the Root Directory in the Build Step | Activado |

La carpeta hermana `apps/forma-studio` es necesaria: `postinstall` instala sus
dependencias y `prebuild` genera Grafo3D. No reemplazar el comando por `next build`
ni activar exportación estática. El ajuste de acceso entre carpetas está en la
[documentación de monorepos de Vercel](https://vercel.com/docs/monorepos/monorepo-faq).

## 5. Configurar variables y probar el primer despliegue

Para la publicación definitiva, en el entorno Production:

```dotenv
MARKETING_SITE_URL=https://grafoprint.com.ar
MARKETING_LAUNCH_MODE=prelaunch
MARKETING_CONTACT_URL=mailto:soporte@grafoprint.com.ar
```

La web no necesita credenciales de base, R2, Redis, correo transaccional ni Meta.
Tampoco necesita todavía `MARKETING_APP_URL` o `MARKETING_API_URL`.

1. Desplegar primero sin conectar el dominio. La URL asignada por Vercel permite
   probar la versión antes de cambiar Donweb.
2. Separar variables de Preview y Production. Para recorrer un preview completo,
   usar su origen estable real como `MARKETING_SITE_URL` y reconstruir. La web
   genera enlaces absolutos con esa variable: si conserva el dominio definitivo,
   algunos clics pueden llevar todavía al sitio anterior de Donweb.
3. Una vez conocido el alias de prueba, actualizarlo y repetir el deployment si
   hace falta. Mantener el preview protegido/no indexable; `noindex` no sustituye
   protección de acceso cuando se requiera. No mezclar sus valores con producción.
4. Revisar portada, menú, aviso, enlaces de contacto, términos, privacidad,
   eliminación de datos, imágenes, videos, canónicas, robots y sitemap.
5. Probar Grafo3D: cargar un ejemplo, modificarlo, guardar/abrir y descargar una
   exportación; verificar workers, WASM y un recurso inexistente con respuesta 404.
6. Comprobar móvil, consola y red del navegador: no debe haber peticiones al SaaS
   por planes o integraciones ni enlaces de registro comercial habilitados.
7. Compilar la versión Production con el dominio definitivo antes del cambio DNS.
   El modo de lanzamiento se evalúa al compilar: cambiar una variable exige
   reconstruir y desplegar.

**Resultado necesario:** deployment revisado, versión y variables identificadas,
listo para asociar el dominio. Un build verde solo no completa esta etapa.

## 6. Resguardar DNS y conectar el dominio

**Trabajo conjunto en Vercel y Donweb.** Primero exportar o documentar la zona
completa, incluido TTL, registros de correo y verificaciones de otros servicios.
La consulta pública siguiente no equivale a ese respaldo del panel.

Lectura DNS del 24/09/2026, sin modificaciones:

| Nombre y tipo | Valor observado |
| --- | --- |
| Dominio, NS | `ns3.hostmar.com` y `ns4.hostmar.com` |
| `grafoprint.com.ar`, A | `200.58.111.128` |
| `grafoprint.com.ar`, AAAA | `2800:6c0:2::a:16f` |
| `www.grafoprint.com.ar`, CNAME | `grafoprint.com.ar` |
| Dominio, MX | prioridad 0: `mail.grafoprint.com.ar`; prioridad 20: `mx1.grafoprint.com.ar` |
| Dominio, SPF en TXT | `v=spf1 include:comp.hostmar.com -all` |
| `_dmarc.grafoprint.com.ar`, TXT | `v=DMARC1; p=none` |
| `mail.grafoprint.com.ar`, A / AAAA | `200.58.111.128` / `2800:6c0:2::a:16f` |
| `mx1.grafoprint.com.ar`, A | `200.58.122.206` |

1. En Vercel, agregar `grafoprint.com.ar` y `www.grafoprint.com.ar` al proyecto;
   definir el primero como principal y redirigir `www` hacia él.
2. Copiar los registros exactos que indique ese proyecto. No usar una IP de
   Vercel tomada de memoria ni un CNAME genérico de un tutorial.
3. En Donweb: **Mis servicios → Dominios → Gestionar → Nameservers y Zona DNS**.
   Editar los registros web existentes. Donweb indica que el campo Nombre debe
   incluir el dominio completo; adaptar la notación `@`/`www` del proveedor a
   ese formulario. [Procedimiento de Donweb](https://soporte.donweb.com/hc/es/articles/18274192917012--C%C3%B3mo-crear-y-modificar-la-Zona-DNS).
4. Resolver tanto el A como el AAAA actuales según lo que solicite Vercel. Si
   queda un AAAA antiguo, una conexión IPv6 puede seguir llegando a Donweb.
5. Conservar los NS y todos los registros de correo, incluidos los A/AAAA propios
   de `mail`, MX, SPF, DKIM y DMARC. Que la IP de `mail` coincida con la vieja web
   no significa que deba cambiarse también. No cancelar el servicio que mantiene
   la casilla de soporte.
6. Esperar validación de DNS y certificado HTTPS; comprobar dominio principal,
   redirección `www`, HTTP → HTTPS y acceso desde redes distintas cuando sea posible.
7. Lucas verifica recepción y envío de la casilla de soporte después del cambio.
   Esta guía no envía mensajes ni hace pruebas de correo por su cuenta.
8. Revisar otra vez páginas legales sin sesión, enlaces, canónicas, sitemap y
   Grafo3D en el dominio final. Los proyectos locales del editor guardados bajo
   otro origen no aparecen automáticamente en el dominio nuevo.

No hace falta trasladar el dominio ni los nameservers a Vercel o Cloudflare.
La [guía de dominios de Vercel](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
explica la verificación y los registros asignados. Ante un problema, restaurar
el deployment anterior o los registros web documentados según la causa;
los cambios DNS no son instantáneos.

**Resultado necesario:** web pública en HTTPS, aviso de prelanzamiento correcto,
legales accesibles y correo de Donweb operativo. La aplicación sigue sin abrirse.

## 7. Retomar Meta con las URL públicas

Una vez comprobadas, quedan disponibles:

- `https://grafoprint.com.ar/privacidad`
- `https://grafoprint.com.ar/terminos`
- `https://grafoprint.com.ar/eliminacion-de-datos`

Usarlas en la configuración correspondiente de Grafoprint en Meta cuando se
ejecute ese paso. La última es una URL de **instrucciones**, no un callback de
borrado. El proceso de Tech Provider, Access Verification/App Review y la
integración técnica requieren su propio seguimiento. La web pública no sustituye
una demostración funcional que Meta solicite ni concede permisos avanzados.
Referencia: [guía de Tech Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers).

Podemos continuar esa preparación mientras construimos el entorno de pruebas,
sin habilitar todavía registros o cobros de clientes.

## 8. Preparar el código para el sistema antes de crear servidores

**Trabajo técnico pendiente**, independiente de publicar marketing.

1. Crear contenedores Linux reproducibles y `.dockerignore`. Contexto desde la
   raíz: la API usa `grafo-hotwire-linker-v1`; la app Next importa también algunos
   módulos puros de `apps/api/src`. Copiar sólo una de esas carpetas no alcanza.
2. Separar construcción y ejecución; generar Prisma e incluir los assets de
   Nest, fuentes, scripts Python y Lua. Instalar las dependencias Python fijadas.
   Probar los motores de geometría en Linux; no activar PackingSolver, hoy
   deshabilitado, sólo por cambiar el hosting.
3. Crear manifiestos por entorno para frontend, API, worker general, worker PDF
   y Gotenberg. Se propone separarlos en aplicaciones Fly para poder ajustar
   recursos, releases y secretos. La API y los workers pueden reutilizar una imagen.
4. Definir puertos internos, escucha alcanzable desde Fly, comprobaciones de
   salud, reinicios, cierre ordenado y tiempo para terminar trabajos en curso.
   La API todavía necesita revisar su apagado ordenado. Un endpoint que devuelve
   200 no demuestra por sí solo que DB, Redis y colas estén operativos.
5. Mantener API y workers activos para tareas programadas y BullMQ. No depender
   del tráfico HTTP para despertarlos: el [autostop de Fly](https://fly.io/docs/launch/autostop-autostart/)
   no es un monitor de nuestras colas. Para el primer piloto, evitar también el
   apagado automático del frontend y del renderizador mientras se validan tiempos.
6. Verificar proxy real, IP de cliente, `TRUST_PROXY`, cookies, CORS y eventos SSE
   a través del frontend. No fijar un número de saltos de proxy sin probar ambos
   recorridos: frontend → API privada y acceso público a la API.
7. Crear un inventario completo de variables por proceso y entorno. El ejemplo
   actual no incluye `MIGRATE_DATABASE_URL`, aunque Prisma la necesita. Distinguir
   secretos, configuración pública, valores de build y valores de ejecución.
8. Preparar un pipeline: instalación y pruebas relevantes, build de imágenes,
   despliegue a staging, migración serializada, verificación y promoción controlada
   de la misma versión a producción. Preparar rollback compatible con el esquema.
9. Crear un procedimiento de inicialización idempotente para administrador de
   plataforma, permisos, catálogo y planes que se necesiten. El `prisma:seed`
   actual elimina datos de demostración: **no usarlo en producción**.
10. Resolver la migración de privilegios antes del ensayo Neon: contiene
    `ALTER DEFAULT PRIVILEGES FOR ROLE postgres`, pero ese rol puede no ser el
    migrador real del proveedor. Si `grafo_app` no existe, omite sus GRANT.
    Definir y probar el orden de roles/migraciones y el provisionado correctivo,
    sin editar a ciegas migraciones históricas ya aplicadas.

**Resultado necesario:** archivos de despliegue revisados y builds Linux
ejecutables; todavía no se considera validado el sistema en la nube.

## 9. Crear el entorno de pruebas: cuentas y presupuesto

Staging significa una instalación para ensayar sin datos reales de clientes.
Es distinta de la URL Preview de la web comercial.

1. Lucas mantiene titularidad, recuperación y facturación de Fly, Neon,
   Cloudflare y Resend. Confirmar Redis y sus costos antes de aprovisionarlo.
2. Acordar un presupuesto inicial por componente y configurar alertas. Incluir
   máquinas, base, Redis, R2, transferencia, correo, backups y las dos instalaciones
   cuando exista producción. Una alerta no siempre detiene el gasto.
3. Registrar nombres y región. Los nombres de aplicaciones Fly deben estar
   disponibles; los ejemplos de esta guía no son nombres ya reservados.
4. Crear credenciales independientes por entorno y guardar la configuración
   sensible en los gestores correspondientes, con recuperación documentada.
   No incorporarla al repo, a la web de Vercel ni a variables `NEXT_PUBLIC_*`.
5. Definir el control de acceso a staging antes de exponerlo. Registro público
   cerrado por defecto, usuarios de prueba creados por el procedimiento interno
   y correos limitados a destinatarios de ensayo. `noindex` solo no restringe acceso.

## 10. Neon: primero base de pruebas y permisos

1. Crear un proyecto de pruebas en São Paulo y elegir conscientemente la versión
   de PostgreSQL. El desarrollo usa PostgreSQL 16; no introducir una actualización
   mayor incidental sin validar las migraciones y extensiones.
2. Crear base y roles según el procedimiento preparado: migrador con permisos de
   esquema y `grafo_app` con permisos de ejecución acotados, sin superusuario,
   creación de tablas ni bypass de aislamiento. Verificar pertenencia a otros
   roles: el nombre de un usuario no demuestra sus privilegios efectivos.
3. Obtener conexiones TLS: `DATABASE_URL` de ejecución y conexión directa
   `MIGRATE_DATABASE_URL` para migraciones. Probar el pooler con Prisma 6 y límites
   por proceso; la suma de conexiones de todas las réplicas cuenta. No hace falta
   migrar a Prisma 7 para usar Neon. [Integración oficial](https://neon.com/docs/guides/prisma).
4. Aplicar el historial sobre una base vacía con `npm run prisma:migrate:deploy`
   desde `apps/api`, en un paso de release único. No usar `migrate dev` en producción
   ni lanzar migraciones simultáneas desde cada worker.
5. Verificar `pg_trgm`, permisos sobre tablas/secuencias existentes y futuras,
   y comportamiento de las operaciones reales con el rol de ejecución.
6. Ejecutar el bootstrap preparado y crear datos sintéticos de prueba.
7. Definir cómputo mínimo/máximo, suspensión y recuperación según el plan. Ensayar
   reconexión, mantenimiento y restauración antes de seleccionar la configuración
   de producción. Los sondeos, workers y crons pueden mantener la base activa;
   no estimar costos suponiendo largos períodos dormida.

El historial de restauración de PostgreSQL no incluye el contenido de R2.

## 11. Redis: preparar las colas

1. Recomendación pendiente de confirmación: Upstash administrado vía Fly, región
   cercana a los procesos y tarifa fija. BullMQ consulta Redis incluso sin nuevos
   trabajos; [Fly recomienda tarifa fija para ese uso](https://fly.io/docs/upstash/redis/).
2. Usar una instancia exclusiva de staging y otra de producción al llegar a esa
   fase. No conectar workers de prueba a las colas productivas.
3. Configurar `REDIS_URL` con la conexión Redis compatible con ioredis/BullMQ, no
   un endpoint REST. Verificar conectividad privada/TLS según la URL provista.
4. Mantener deshabilitada la eliminación automática de claves por falta de espacio
   y alertar por memoria, fallos y atraso de colas. [BullMQ requiere noeviction](https://docs.bullmq.io/guide/going-to-production).
5. Validar trabajos, reintentos, expiración de locks, reconexión y recuperación
   después de detener un worker. Definir retención de trabajos terminados y cómo
   reconciliar la cola con PostgreSQL después de una restauración.

## 12. R2: archivos privados y recuperación

1. Activar R2 en la cuenta Cloudflare. Esto no exige mover el DNS del dominio.
2. Crear un bucket privado de staging; crear otro independiente para producción
   en su momento. No habilitar acceso público ni un dominio público de archivos.
3. Crear credenciales S3 de lectura/escritura acotadas al bucket de cada entorno;
   registrar `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_BUCKET`.
   El endpoint personalizado sólo se usa si hace falta. [Credenciales oficiales](https://developers.cloudflare.com/r2/api/tokens/).
4. Configurar CORS para el origen exacto de la aplicación de ese entorno, los
   métodos/headers que usa el cliente y exposición de `ETag` para multipart.
   Las URLs firmadas requieren igualmente [CORS al usarlas desde el navegador](https://developers.cloudflare.com/r2/buckets/cors/).
5. Probar subida simple y multipart, descarga, expiración y renovación de URLs,
   acceso entre empresas y limpieza de cargas abandonadas. Los archivos grandes
   deben viajar directamente entre navegador y R2, según el flujo implementado.
6. Preparar política y mecanismo de copia/recuperación de archivos. Tener un
   bucket durable no protege por sí solo de un borrado lógico con credenciales
   válidas. Probar recuperación coordinada con la base y conservar las claves
   necesarias para descifrar las credenciales de integraciones.
7. Documentar ubicación y retención reales. No afirmar que R2 reside en São Paulo
   por haber elegido esa región para Fly y Neon.

## 13. Correo e integraciones de ensayo

1. Verificar en Resend el dominio o subdominio elegido y copiar sus registros
   específicos en Donweb, conservando el correo existente. No reemplazar el MX
   de la casilla ni crear dos registros SPF sobre el mismo nombre. Comprobar la
   [verificación del dominio](https://resend.com/docs/dashboard/domains/introduction).
2. Configurar clave de API y remitentes del entorno: `RESEND_FROM`,
   `RESEND_PRESUPUESTOS_FROM` y `RESEND_REPLY_TO`. Los valores actuales proponen
   `registro@`, `cotizaciones@` y respuestas a `soporte@grafoprint.com.ar`.
3. Probar los flujos de correo implementados con destinatarios de ensayo; comprobar
   que los enlaces apuntan al entorno correcto y registrar entrega y errores.
   Limitar los envíos de staging antes de habilitar formularios accesibles.
4. Paddle permanece en sandbox hasta terminar catálogo, precios, moneda,
   impuestos aplicables y pruebas de suscripción/webhooks. Que un producto esté
   publicado en marketing no configura automáticamente su cobro.
5. Facturación ARCA/AFIP se valida en homologación; certificados y delegaciones
   productivas se tratan antes de habilitar esa función a clientes reales.
6. QZ Tray y la extensión de WhatsApp siguen requiriendo instalaciones y pruebas
   en puestos del usuario. Desplegar Fly no sustituye esos componentes locales.

## 14. Desplegar los procesos de staging

Con base migrada, Redis, bucket, secretos y builds preparados:

1. Crear las aplicaciones Fly sin un despliegue automático improvisado;
   completar y revisar los manifiestos y variables antes de arrancar procesos.
2. Publicar Gotenberg con acceso sólo interno y sus límites/restricciones de
   render conservados. Configurar `PDF_RENDER_URL` hacia su dirección privada.
3. Arrancar los workers con los comandos existentes: `npm run worker:prod` y
   `npm run worker:pdf:prod`, dentro de la imagen del backend y con sus recursos.
4. Arrancar la API con `npm run start:prod`; configurar registro cerrado,
   conexiones, credenciales, orígenes, términos y proxy. Mantener inicialmente
   `PRESUPUESTO_PDF_ASYNC=false` hasta validar el recorrido PDF completo.
5. Arrancar el frontend Next con `API_URL` hacia la API privada, con prefijo `/api`,
   y `MARKETING_SITE_URL=https://grafoprint.com.ar`. El navegador usa su BFF de
   mismo origen; no necesita conocer la dirección privada de Fly.
6. Asociar los dominios de staging y certificados con los valores que entregue
   Fly. Exponer por HTTPS sólo frontend y la API necesaria para las integraciones;
   Gotenberg y workers no necesitan un servicio público.
7. Verificar origen público en `FRONTEND_URL` y `REGISTRO_PUBLICO_URL`, URLs de
   webhooks, CORS de R2 y control de acceso de staging. `API_PUBLIC_URL` hoy es
   una variable del driver local de archivos; no sustituye la configuración de
   URLs de cada integración en R2/producción.
8. Ejecutar la prueba de humo completa y activar PDF asíncrono únicamente cuando
   worker, renderizador, almacenamiento y descarga estén comprobados.

La lista de variables aquí es una referencia de las piezas principales. El
inventario por proceso del paso 8 deberá ser exhaustivo antes de ejecutar esta etapa.

## 15. Pruebas que habilitan pasar a producción

| Área | Evidencia necesaria |
| --- | --- |
| Acceso | Login, cierre de sesión, invitaciones/registro cuando corresponda, roles y dos empresas aisladas |
| Navegación | Aplicación completa, legales y enlaces correctos sin destinos locales |
| Archivos | Subida y descarga reales, multipart, permisos, expiración, reinicios sin pérdida de objetos |
| Cálculo | Corpus representativo de geometría/nesting, cotización y planificación con concurrencia |
| Eventos | SSE, reconexión y actualización de estado atravesando la app y el proxy |
| PDF | Cola, fuentes, contenido, reintentos, concurrencia y descarga del resultado |
| Tareas programadas | Ejecución con poco tráfico; ausencia de duplicación al escalar/reiniciar |
| Integraciones | Correo de ensayo; Paddle sandbox y homologación fiscal si se incluyen al lanzar |
| Operación | Reinicio de API/worker durante trabajos, conectividad perdida, memoria y pools bajo carga |
| Recuperación | Restaurar base y archivos en otro entorno y reconciliar trabajos; medir pérdida máxima y tiempo de recuperación |
| Privacidad | Procedimiento verificable de solicitudes y eliminación, incluidos proveedores y restauraciones |
| Despliegue | Migración ensayada, comprobación después del release y vuelta a versión compatible |

Medir CPU, memoria, concurrencia, latencia y volumen de eventos. Los valores
`GRAFONEST_POOL_CPU` y `GRAFONEST_POOL_MEMORY_MB` son reservas lógicas; no crean
recursos en Fly. Decidir réplicas y presupuesto con esas mediciones. Una máquina
por servicio puede servir al piloto, pero no ofrece tolerancia a su caída.

## 16. Crear producción y comenzar con un piloto cerrado

1. Acordar los recursos medidos, presupuesto, responsables de incidentes y
   objetivos de recuperación. Configurar alertas de caída, error, cola atrasada,
   uso de disco/memoria, conexiones, backups y consumo.
2. Crear base Neon, Redis, bucket R2, aplicaciones Fly y credenciales de
   producción separados de staging. No clonar datos de clientes hacia pruebas.
3. Ejecutar migraciones y bootstrap sobre la base vacía. Si hay información local
   o clientes existentes que conservar, preparar y ensayar una migración de datos
   aparte; copiar tablas sin archivos/relaciones no es un plan de migración.
4. Desplegar las mismas imágenes/versiones ya ensayadas, con configuración
   productiva. Mantener `REGISTRO_PUBLICO_HABILITADO=false` inicialmente.
5. Conectar `app.grafoprint.com.ar` y `api.grafoprint.com.ar` a Fly, validar TLS,
   orígenes, IP de cliente, enlaces y URLs externas. Marketing permanece prelaunch.
6. Hacer pruebas controladas y un piloto con usuarios invitados. Antes de cargar
   datos reales deben estar activos respaldos, procedimiento de privacidad y
   acceso de soporte. Documentar recuperación de `INTEGRACIONES_ENCRYPTION_KEY`:
   cambiarla sin migración impide descifrar credenciales existentes.
7. Configurar Paddle live y demás integraciones productivas que efectivamente
   entren al lanzamiento. Ensayar cambios/cancelaciones, firmas e idempotencia
   de webhooks. No habilitar una integración pendiente sólo para completar una lista.

## 17. Abrir el sistema y activar la web comercial

1. Confirmar funciones disponibles, precios/ofertas publicados y correspondencia
   con el catálogo real. Tener correo y onboarding productivos comprobados.
2. Configurar en marketing `MARKETING_APP_URL=https://app.grafoprint.com.ar` y
   `MARKETING_API_URL=https://api.grafoprint.com.ar/api`; Vercel no alcanza un
   nombre privado `.internal` de Fly. Conservar el origen público de marketing.
3. Preparar y verificar una compilación `MARKETING_LAUNCH_MODE=live`. El registro
   público de API tiene su propio interruptor: habilitarlo en la ventana acordada
   y probar un alta completa antes de dirigir tráfico desde la portada.
4. Publicar marketing live y verificar inmediatamente login, registro, oferta,
   aceptación de términos, correo y cobro si corresponde. La versión de términos
   del API debe coincidir con la publicada; no alterar aceptaciones históricas.
5. Observar métricas y errores del primer período de uso y corregir desviaciones.

Si hay que frenar nuevas altas, cerrar el registro en la API y restituir una
versión verificada de marketing prelaunch. Eso no restaura la base ni revierte
cobros. Volver a una imagen anterior sólo es válido si puede trabajar con el
esquema actual; una restauración de base es otra operación y puede perder cambios.

## 18. Qué hacemos primero y quién interviene

El siguiente bloque de trabajo es **cerrar la versión de marketing y preparar
su proyecto Vercel** —pasos 3 a 5—. Después se revisa el resultado y se cambia DNS.
No hace falta contratar todavía los servicios del SaaS para completar ese bloque.

| Lucas | Trabajo técnico |
| --- | --- |
| Acceso de titular a GitHub, Vercel y Donweb; facturación | Revisión de cambios, build y configuración del proyecto |
| Revisión del contenido y funcionamiento comercial esperado | Validación móvil, Grafo3D, enlaces, legales, variables y DNS |
| Verificación de su casilla después del cambio | Registro de la versión publicada y procedimiento de reversión |
| Más adelante: presupuesto, Redis, piloto y alcance comercial | Contenedores, Neon, colas, R2, Fly, pruebas y automatización |

Los detalles de IP, nombres de recursos, tokens y capacidad final se completan
cuando los proveedores los asignen y tengamos mediciones. No son valores que se
puedan fijar correctamente de antemano en un plan.
