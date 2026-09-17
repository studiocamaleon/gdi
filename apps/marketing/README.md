# Web comercial de Grafoprint

Landing pública independiente del SaaS y de la API. La portada presenta a Grafo
como **el sistema operativo de la industria gráfica**, con niveles acumulativos:
Print → Sign → Industrial.

## Desarrollo y validación

```bash
npm install
npm run dev
npm run lint
npm run build
```

La web se abre en `http://localhost:3002`. `npm start` sirve la compilación de
producción en ese mismo puerto.

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

Los planes muestran capacidades acumulativas y abren una consulta con el equipo.
Se recuperaron los precios de la web original: Print cuesta USD 190/mes, Sign
cuesta USD 290/mes e Industrial se cotiza a medida. Los límites de usuarios y la
correspondencia con códigos de suscripción se definirán comercialmente. Esta web
no modifica facturación ni permisos del SaaS. El registro general sigue usando
su URL configurada.

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
