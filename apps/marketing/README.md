# Web comercial de Grafoprint

Landing pública de Grafo, **el sistema operativo de la industria gráfica**.
Su sección de planes consulta el mismo catálogo público que el registro del SaaS.

## Desarrollo y validación

```bash
npm install
npm run dev
npm run lint
npm run build
```

La web se abre en `http://localhost:3002`. `npm start` sirve la compilación de
producción en ese mismo puerto.

Si el renderizador de PDF ocupa el puerto 3002, usar `npx next dev -p 3003`.
Pruebas del catálogo, desde la raíz del monorepo:
`npx vitest run --config apps/marketing/vitest.config.ts`.

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
servidor, sin credenciales. Es obligatoria en producción; en desarrollo usa
`http://localhost:3001/api`. La sección espera una petición real y consulta sin
caché, con un timeout de 5 segundos, para no publicar precios retenidos del build.
`MARKETING_SIGNUP_URL` apunta al onboarding público; `MARKETING_DEMO_URL` puede
ser un correo o una URL comercial. Los enlaces de planes agregan su nombre al
asunto solo cuando el destino es `mailto:`.

Se conservan las rutas de sitemap/robots y las cabeceras existentes.

## Recursos y atribución

- [Aceternity UI · Glowing Effect](https://ui.aceternity.com/components/glowing-effect),
  de Manu Arora, obtenido mediante su registro de componentes. Adaptado a la
  paleta de Grafo, movimiento reducido y cancelación de animaciones.
- Three.js 0.149: geometría construida para esta portada siguiendo el concepto
  de ensamblaje del configurador de cartelería existente.
- Imagen: OpenAI ImageGen. Video: Higgsfield / Seedance 2.5, 8 segundos,
  1080p, sin audio, H.264 optimizado (4,4 MiB). El bucle tiene un reinicio visible
  leve; se puede reemplazar el MP4 por una toma que cierre el recorrido.
