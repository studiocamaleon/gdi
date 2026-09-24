# Web comercial de Grafoprint

Landing pública de Grafo, **el sistema operativo de la industria gráfica**.
Puede publicarse en prelanzamiento sin desplegar el SaaS. Cuando se activa el
modo `live`, su sección de planes consulta el mismo catálogo público que el registro.

## Desarrollo y validación

```bash
npm ci --include=dev
npm run dev
npm run lint
npm test
npm run build
```

La web se abre en `http://localhost:3002`. `npm start` sirve la compilación de
producción en ese mismo puerto.

Grafo3D se abre en **`/3d`**, gratis y sin registro. `npm install` / `npm ci`
instalan también las dependencias bloqueadas de `../forma-studio`; `npm run dev`
y `npm run build` compilan el editor antes de arrancar Next. Usar Node 24.x,
fijado en `package.json`, y las dependencias de desarrollo durante el build.

Si el renderizador de PDF ocupa el puerto 3002, usar `npx next dev -p 3003`.
Al arrancar directamente con `npx`, ejecutar primero `npm run grafo3d:build`.
Pruebas del catálogo y del modo de lanzamiento: `npm test` desde esta carpeta.
Vitest forma parte de sus dependencias de desarrollo para que la instalación
independiente y la comprobación de tipos en Vercel no dependan de la raíz del monorepo.

## Estructura

- `src/app/page.tsx`: contenido, secciones, planes y metadatos estructurados.
- `src/app/layout.tsx` y `globals.css`: tipografía, SEO y diseño adaptable.
- `src/components/sign-scene.tsx`: cartel backlight real en Three.js; frente,
  módulos LED, bastidor y fondo se separan con el scroll o los controles.
- `src/components/cinematic-media.tsx`: video de planta con póster optimizado,
  reproducción al entrar en pantalla y pausa al salir o esconder la pestaña.
- `src/components/production-journey.tsx`: ejemplo interactivo de una orden.
- `src/components/ui/glowing-effect.tsx`: efecto de borde de Aceternity UI.
- `src/lib/site-config.ts`: destinos configurables de registro, login y contacto.
- `public/media`: póster y video de planta generados para esta propuesta.

El HTML original (`src/landing.html`, `public/marketing.css` y
`public/marketing.js`) se conserva como referencia; la portada ya no lo carga.

## Contenido comercial

`MARKETING_LAUNCH_MODE=prelaunch` es el modo predeterminado. La portada conserva
las demostraciones y las páginas legales; los accesos y el registro conducen a
`/proximamente`. Los planes muestran un aviso deliberado, sin precios ni errores
de conexión. Ni planes, ni integraciones, ni nesting consultan la API. Grafo3D
funciona de manera independiente y permanece accesible.

Sólo el valor exacto `live` activa los enlaces al SaaS y el catálogo. Cualquier
otro valor mantiene el prelanzamiento. El modo se evalúa durante la compilación:
**cambiarlo requiere reconstruir y desplegar la web**. No es un control de
seguridad para la aplicación ni reemplaza `REGISTRO_PUBLICO_HABILITADO` en la API.

En modo `live`:

Los nombres, descripciones, precios, recomendación, trial, usuarios y espacio
proceden de `GET /registro/planes`. Las ofertas versionadas incluyen las funciones
de su contrato publicado y el importe de los usuarios adicionales. La anualidad
sólo aparece si tiene un precio activo. No se presume herencia entre planes.

Los botones de prueba llevan el código y el identificador de la oferta al
registro. Si una oferta cambió, el registro pide revisar las condiciones actuales.
Los planes a consultar conservan el contacto comercial. Esta web no modifica
facturación ni permisos. Un fallo o catálogo vacío muestra un estado de consulta,
sin precios ni capacidades de respaldo. El catálogo anterior permanece visible
hasta retirarlo explícitamente en Plataforma, una vez activada la nueva oferta.

La escena 3D y la orden de ejemplo son demostraciones visuales; no calculan
materiales ni precios. La planta es un recurso conceptual generado, no una
filmación de un cliente. Se conserva la referencia a Gráfica Corporearte de la
web original.

## Accesibilidad y carga

Navegación por teclado, menú móvil, enlace para saltar al contenido, controles
explícitos para video y 3D, y pestañas navegables con flechas. Se respeta
`prefers-reduced-motion`: sin reproducción automática ni apertura por scroll.
El 3D se carga cerca del visor, suspende el render fuera de pantalla y muestra
una explicación alternativa si WebGL no está disponible.

## Configuración y despliegue

Usar `apps/marketing` como directorio raíz y las variables de `.env.example`.
`MARKETING_API_URL` es la base de la API, incluido `/api`, consultada sólo por el
servidor, sin credenciales. Es necesaria para el catálogo en modo `live`; en desarrollo usa
`http://localhost:3001/api`. La sección espera una petición real y consulta sin
caché, con un timeout de 5 segundos, para no publicar precios retenidos del build.
`MARKETING_SIGNUP_URL` apunta al onboarding público; `MARKETING_DEMO_URL` puede
ser un correo o una URL comercial. Los enlaces de planes agregan su nombre al
asunto solo cuando el destino es `mailto:`.

En prelanzamiento sólo configurar `MARKETING_SITE_URL` y, opcionalmente,
`MARKETING_CONTACT_URL` (por defecto, el correo de soporte). `MARKETING_DEMO_URL`
no se usa en ese modo: el contacto no depende de un sistema de reservas ni de
una aplicación publicada. No se recopilan suscripciones a una lista de espera.

Para Vercel, `vercel.json` fija Next.js, instalación con npm y build completo.
Configurar **Root Directory: `apps/marketing`**, Node 24.x, salida automática de
Next y **Include source files outside of the Root Directory in the Build Step**
para acceder a `apps/forma-studio`. No instalar ni compilar todo el monorepo.
Guía de publicación y activación: [despliegue-web-prelanzamiento.md](../../docs/despliegue-web-prelanzamiento.md).

Se conservan las rutas de sitemap/robots y las cabeceras existentes.

### Grafo3D en el mismo dominio

El editor conserva su aplicación Vite en `apps/forma-studio`. El script
`scripts/build-grafo3d.mjs` genera sus recursos con base `/3d/` y copia el
compilado a `public/grafo3d`, ignorado en Git. Next sirve `/3d` mediante una
reescritura interna a ese HTML y `/3d/*` a sus archivos. No se utiliza iframe
ni se incorpora el motor geométrico WASM al bundle de la portada.

El despliegue debe incluir el repositorio completo, con ambas carpetas hermanas:

- Directorio de la web: `apps/marketing`.
- Instalación: `npm ci --include=dev` (su `postinstall` instala Grafo3D).
- Compilación: `npm run build` (su `prebuild` prepara Grafo3D).
- Servidor: `npm start`, o `npx next start -p "$PORT"` si el proveedor asigna puerto.
- Sitio público: `MARKETING_SITE_URL` con el dominio confirmado para generar las
  URLs canónicas y el sitemap. El dominio principal confirmado es
  `grafoprint.com.ar`, administrado en Donweb; los subdominios de la app y API
  en `.env.example` siguen siendo propuestas.
  En `live`, configurar además los destinos reales del SaaS y la API.

En proveedores que limitan el acceso al directorio de la aplicación, habilitar
la inclusión de archivos externos a `apps/marketing`: la carpeta
`apps/forma-studio` es necesaria durante instalación y build. El resultado
estático queda dentro de `public` y no necesita otro servidor en producción.
El hosting debe conservar MIME `application/wasm` y permitir los workers del
mismo origen. Las rutas inexistentes conservan el 404; no se responde HTML a
peticiones de recursos que no existen.

Para editar el editor con recarga instantánea, usar su servidor propio:
`npm --prefix apps/forma-studio run dev` desde la raíz del repositorio. Para ver
esos cambios bajo `/3d`, repetir `npm run grafo3d:build` en marketing y recargar
la página. Los proyectos locales de distintos dominios/puertos no se comparten;
se trasladan descargando y abriendo el JSON.

La publicación de esta etapa no conecta el motor de costos de Grafo ni crea
cuentas: geometría, proyectos y exportaciones se procesan en el navegador.
El calculador local sigue siendo orientativo y permite modificar sus tarifas.

### Isologo interactivo en la portada

La sección Grafo3D muestra el isologo con cuerpo, acrílico y base. El visor
Three.js se carga al entrar en pantalla, renderiza sólo cuando cambia la vista
y usa geometría precalculada por el motor de Grafo3D. La barra muestra un despiece
de presentación: acrílico hacia arriba, cuerpo fijo y base hacia abajo. El
editor conserva las trayectorias de extracción de fabricación de cada encastre.
La demostración inicial se reproduce una
sola vez; respeta movimiento reducido y se interrumpe al usar la barra.

El botón abre `/3d?ejemplo=grafoprint`, con el mismo SVG y parámetros. Ese
ejemplo guarda su borrador en `forma.autosave.grafoprint`, separado del borrador
habitual `forma.autosave`. Los proyectos guardados siguen en la biblioteca.

Fuente del ejemplo: `apps/forma-studio/src/core/grafoprint-demo.ts`. Al cambiar
sus parámetros, regenerar los recursos versionados de `public/demos`:

```bash
cd apps/forma-studio
npx tsx scripts/export-grafoprint-demo.ts
```

Después recompilar Grafo3D como se indica arriba para actualizar también el editor.

## Recursos y atribución

- [Aceternity UI · Glowing Effect](https://ui.aceternity.com/components/glowing-effect),
  de Manu Arora, obtenido mediante su registro de componentes. Adaptado a la
  paleta de Grafo, movimiento reducido y cancelación de animaciones.
- Three.js 0.149: geometría construida para esta portada siguiendo el concepto
  de ensamblaje del configurador de cartelería existente.
- Imagen: OpenAI ImageGen. Video: Higgsfield / Seedance 2.5, 8 segundos,
  1080p, sin audio, H.264 optimizado (4,4 MiB). El bucle tiene un reinicio visible
  leve; se puede reemplazar el MP4 por una toma que cierre el recorrido.
