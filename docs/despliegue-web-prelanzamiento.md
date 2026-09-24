# Publicar la web de Grafoprint antes que el sistema

Estado al 24 de septiembre de 2026: web comercial publicada en
<https://grafoprint.com.ar>, proyecto `grafoprint-web` de Vercel Pro.
Commit `604bf17`, rama `meta-tech-provider`, todavía sin integrar en `main`.
El dominio de Donweb ya está conectado; la infraestructura del SaaS sigue pendiente.

Orden completo, responsables y paso posterior al sistema:
[despliegue-paso-a-paso.md](despliegue-paso-a-paso.md). Arquitectura confirmada:
Vercel para marketing; Fly para aplicación, API y workers; Neon y R2.

## Lo preparado

- Web comercial en `apps/marketing`, con modo `prelaunch` predeterminado.
- Portada completa, contacto y páginas `/terminos`, `/privacidad` y
  `/eliminacion-de-datos` públicas.
- Login y registro conducen a `/proximamente`. Los planes muestran el estado
  de lanzamiento; no se consultan precios ni integraciones del backend.
- Grafo3D en `/3d`, compilado desde `apps/forma-studio`, disponible sin cuenta.
- `vercel.json` fija instalación y build. Node 24.x fijado en `package.json`.
- `live` permite recuperar el catálogo y los destinos del SaaS al reconstruir.

El cambio afecta la web comercial. La aplicación local y su API mantienen sus
controles actuales; ocultar sus enlaces no restringe el acceso directo al SaaS.

## Paso 1: cerrar los datos públicos

Dominio principal confirmado: **grafoprint.com.ar**, administrado en **Donweb**.
Correo confirmado como operativo: **soporte@grafoprint.com.ar**. Razón social,
CUIT y domicilio legal incorporados a los documentos. Falta completar la
revisión operativa de los textos en
[meta-tech-provider-paginas-legales.md](meta-tech-provider-paginas-legales.md).
La variante `www` ya redirige con HTTP 308 al dominio principal. Se conservó un
inventario local de los 27 registros originales de Donweb, contrastado por DNS.
Se cambió el A principal a `216.150.1.1`, se eliminó sólo el AAAA antiguo del
dominio raíz y se cambió el CNAME de `www` a
`5b3c32ff13cc88e1.vercel-dns-016.com.`. Los 26 registros restantes se compararon
con el inventario: no hubo otros cambios. Nameservers y registros de correo
permanecen intactos. La entrega real de correo no se probó mediante mensajes.
La publicación de estas páginas ayuda a preparar Meta, pero no equivale a una
aprobación de Tech Provider ni sustituye la integración y su revisión.

## Paso 2: crear el proyecto de la web en Vercel

El proyecto ya se creó con la cuenta y el plan Pro preparados por Lucas.
La versión publicada fue promovida manualmente desde `meta-tech-provider`.
La rama `main` todavía no contiene esta preparación. Para futuras instalaciones,
guardar y subir la versión revisada antes de importar el repositorio, conservando
ambas aplicaciones hermanas:

| Ajuste | Valor |
| --- | --- |
| Root Directory | `apps/marketing` |
| Framework | Next.js |
| Node.js | 24.x |
| Install Command | `npm ci --include=dev` |
| Build Command | `npm run build` |
| Output Directory | Automático de Next.js |
| Archivos fuera de Root Directory | Incluirlos para acceder a `apps/forma-studio` |

`postinstall` instala Grafo3D y `prebuild` genera sus recursos. Ejecutar sólo
`next build` omite esa preparación. No usar `output: export`: la configuración
actual utiliza rewrites y el catálogo de la futura versión live usa servidor.

Variables aplicadas en Production, con el despliegue reconstruido:

```dotenv
MARKETING_SITE_URL=https://grafoprint.com.ar
MARKETING_LAUNCH_MODE=prelaunch
MARKETING_CONTACT_URL=mailto:soporte@grafoprint.com.ar
```

No necesita API, PostgreSQL, Redis, R2 ni credenciales de WhatsApp. No copiar
las variables privadas del monorepo a este proyecto. Separar Preview y
Production; comprobar canónicas y protección del preview antes de indexarlo.
Actualmente Preview conserva `MARKETING_SITE_URL=https://grafoprint-web.vercel.app`.
Para recorrer los enlaces absolutos de un preview, usar en ese entorno su origen
real como `MARKETING_SITE_URL` y reconstruir. Production conserva el dominio final.

Vercel permite incluir fuentes fuera de la raíz mediante sus
[ajustes de monorepo](https://vercel.com/docs/monorepos/monorepo-faq).
Para el sitio comercial, contemplar un plan que admita ese uso:
[Hobby está limitado a uso personal no comercial](https://vercel.com/docs/plans/hobby).
Consultar el [precio vigente](https://vercel.com/pricing) antes de contratar.

## Paso 3: validar el preview y después conectar el dominio

Comprobar escritorio y móvil, todos los accesos de prelanzamiento, contacto,
páginas legales y canónicas. Comprobar Grafo3D, sus workers y WASM, apertura de
un proyecto y exportación; los archivos inexistentes deben responder 404.
Confirmar que no hay llamadas al SaaS. El build completo debe funcionar sin él.

Con el preview revisado, conectar el dominio, esperar HTTPS y verificar las
URL públicas desde una sesión sin autenticar. Las páginas enviadas a Meta
deben estar accesibles sin la protección de acceso del preview.

## Paso 4: preparar el sistema en staging

La arquitectura confirmada y su evaluación están en
[evaluacion-fly-grafoprint.md](evaluacion-fly-grafoprint.md). Staging debe tener
base, colas, bucket y credenciales independientes de producción. Aquí se
construyen y prueban los contenedores Linux del backend y los workers; la
preparación de marketing no valida ese despliegue.

## Paso 5: habilitar el lanzamiento

1. Validar aplicación, login, onboarding, correo, planes y cobros, además de
   archivos, eventos, PDFs y trabajos en segundo plano.
2. Confirmar las ofertas que realmente estarán publicadas y los controles de
   registro de la API (`REGISTRO_PUBLICO_HABILITADO`).
3. Configurar en marketing `MARKETING_APP_URL`, `MARKETING_API_URL` con `/api`
   y, si hacen falta, destinos específicos de login, registro y demo. Desde
   Vercel, la API debe ser accesible; un nombre privado `.internal` de Fly no basta.
4. Cambiar `MARKETING_LAUNCH_MODE=live`, reconstruir y verificar un preview.
5. Publicar esa compilación tras comprobar los flujos completos. La ruta
   `/proximamente` redirige a la portada en modo live.

Para volver al prelanzamiento, reconstruir con `prelaunch` o restaurar su
deployment verificado. Esto sólo cambia la web: si hay que cerrar altas del
SaaS, hacerlo también mediante su control de registro. El plan de rollback de
base de datos y backend es independiente.

## Verificación local realizada

- 18 pruebas de catálogo y configuración aprobadas, incluido prelanzamiento
  sin `fetch` al backend y conservación de ofertas en modo `live`.
- ESLint aprobado en los archivos TypeScript modificados.
- Build completo con Node 24.19.0: Grafo3D, Next y TypeScript, con API inaccesible.
  Todas las rutas de marketing quedaron prerenderizadas en modo `prelaunch`.
- Servidor de la compilación: portada, aviso, legales y Grafo3D respondieron
  200; worker y WASM se sirvieron con su MIME correcto; recurso inexistente 404.
- Chrome: menú móvil sin enlaces a login/registro, aviso a 390 px sin
  desbordamiento horizontal y Grafo3D generando el modelo con exportación habilitada.

El build de Grafo3D conserva avisos de tamaño de bundle y externalización de
`node:module` de Manifold; el motor generó el ejemplo sin errores de consola.

## Verificación en Vercel realizada

- Instalación independiente y build completos; se agregó Vitest como dependencia
  propia de marketing y el comando `typecheck` para los controles de Vercel.
- Lint y TypeCheck aprobados, sin omitir requisitos de promoción.
- Despliegue `dpl_JDUH76bgAShoeCfmgmb2yvyMZyJH` Ready en Production con el
  dominio definitivo, reconstruido desde el commit `604bf17`.
- Portada, `/proximamente`, las tres páginas legales, `/3d`, robots y sitemap:
  HTTP 200 sin autenticación. Recurso inexistente de Grafo3D: HTTP 404.
- URLs canónicas, enlaces, robots y sitemap usan `https://grafoprint.com.ar`;
  no hay enlaces a
  localhost, login o registro del SaaS en las páginas revisadas.
- Grafo3D generó tres componentes y descargó `Isologo Grafoprint-fabricacion.zip`.
  Integridad ZIP correcta, dos STL binarios con tamaños y triángulos coherentes,
  contornos DXF/SVG y documentos JSON legibles. Esta prueba se realizó en el
  alias de Vercel antes de conectar el dominio, con el mismo código publicado.
- Vercel confirma **Valid Configuration** en ambos dominios. HTTPS funciona
  sin omitir la validación del certificado y `www/privacidad` responde HTTP 308
  hacia `https://grafoprint.com.ar/privacidad`.

La web permanece en `prelaunch`. Las URL legales ya están disponibles para
retomar la preparación de Meta. El siguiente despliegue del SaaS requiere su
propia preparación y validación; no se crearon recursos Fly, Neon, R2 ni Redis.

## Validación previa a integrar en main — 24/09/2026

- Vercel conserva `main` como rama de Production. La primera publicación fue
  una promoción manual de `meta-tech-provider`; el PR #1 incorpora esa versión
  y su documentación a la rama habitual de publicación.
- Reejecutados con Node 24.19.0: 18 tests de marketing, 10 de rutas públicas,
  lint de marketing y de los archivos modificados del sistema, comprobaciones
  TypeScript del sistema y de la API. Todos aprobaron.
- Build completo de Grafo3D y marketing aprobado en `prelaunch`, con origen
  `https://grafoprint.com.ar` y API deliberadamente inaccesible. Se generaron
  las nueve páginas estáticas. Persisten los avisos conocidos de tamaño de
  bundle de Grafo3D y de externalización de `node:module` de Manifold.
- App Review fue enviada por el titular y muestra «Revisión en curso».
  Verificación de acceso y aprobación de permisos siguen siendo trámites separados.

El merge publica únicamente el proyecto de marketing configurado en Vercel.
El entorno de staging y la integración directa de WhatsApp siguen pendientes.
