# Publicar la web de Grafoprint antes que el sistema

Preparación local al 24 de septiembre de 2026. No se creó infraestructura,
no se contrató hosting y no se publicó ningún entorno.

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
Al publicar, configurar la variante `www` para redirigir al dominio principal.
Antes de editar DNS, revisar sus registros actuales y conservar los del correo.
Se consultó DNS público: hay A y AAAA de la web, y MX/hosts de correo de Donweb.
El inventario observado está en la guía general. No se modificó Donweb ni se
revisó/exportó la zona completa del panel; hacer ese respaldo antes del cambio.
La publicación de estas páginas ayuda a preparar Meta, pero no equivale a una
aprobación de Tech Provider ni sustituye la integración y su revisión.

## Paso 2: crear el proyecto de la web en Vercel

Este paso es futuro; requiere autorización para publicar/contratar.
Antes de importar, guardar y subir la versión revisada al repositorio y confirmar
la rama de publicación. Los cambios locales actuales no se publican automáticamente
por conectar GitHub. No importar un `main` que todavía no contenga esta preparación.
Importar el repositorio conservando ambas aplicaciones hermanas:

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

Configurar para ese entorno:

```dotenv
MARKETING_SITE_URL=https://grafoprint.com.ar
MARKETING_LAUNCH_MODE=prelaunch
MARKETING_CONTACT_URL=mailto:soporte@grafoprint.com.ar
```

No necesita API, PostgreSQL, Redis, R2 ni credenciales de WhatsApp. No copiar
las variables privadas del monorepo a este proyecto. Separar Preview y
Production; comprobar canónicas y protección del preview antes de indexarlo.
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
Esta verificación es local. Instalación limpia y ejecución en Vercel, exportación
de archivos y revisión final de contenido siguen en la validación del preview.
