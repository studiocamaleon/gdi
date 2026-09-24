# Grafo3D gratuito en la web

## Alcance

Integración local del editor de `codex/grafo3d` (commit `2057c0391`) en la web
comercial. Destino previsto: `https://grafoprint.com.ar/3d`. El usuario confirmó
que la web todavía no está desplegada. Esta entrega prepara el primer despliegue;
no modifica DNS, hosting, datos del SaaS ni el motor de costos.

## Implementación

- Aplicación independiente en `apps/forma-studio`, con fuentes, workers, motor
  WASM y exportadores propios. Revisión de URLs dinámicas para respetar `/3d/`.
- PostCSS aislado del frontend SaaS; utiliza el plugin Tailwind de Vite.
- Instalación y compilación automáticas desde `apps/marketing`.
- Archivos generados en `apps/marketing/public/grafo3d`, fuera del control de
  versiones. Reescrituras de Next mantienen la URL pública `/3d`.
- Acceso desde navegación de escritorio/móvil y sección de portada.
- Identificación como herramienta gratuita, explicación del guardado local y
  enlace a Grafoprint. Metadatos, URL canónica y entrada de sitemap.
- Contrato de fabricación y calculador orientativo existentes conservados.
  No hay cotización autenticada contra Grafo en esta etapa.

## Validación

- Build del editor (TypeScript + Vite) y build de producción de marketing: OK.
- Lint de marketing: OK.
- Suite de Grafo3D: 14 archivos, 390 pruebas aprobadas.
- Suite de marketing: 11 pruebas aprobadas.
- Servidor Next de producción local: `/3d` y `/3d/` entregan HTML correcto;
  75 archivos comparados byte por byte con el compilado; WASM con su MIME
  correcto; recurso inexistente responde 404; sitemap incluye `/3d`.
- Navegador: generación del modelo inicial, fuentes y miniaturas, guardado y
  recuperación después de recargar; controles adaptados a pantalla chica.
- Descarga real desde el editor: ZIP de 23 archivos, con 5 STL, 5 SVG, 10 DXF,
  2 JSON y un LEEME. ZIP íntegro y tamaños de STL coherentes con sus triángulos.

## Publicación

Seguir [el README de marketing](../apps/marketing/README.md#grafo3d-en-el-mismo-dominio).
El build necesita ambas aplicaciones del repositorio; el runtime sólo necesita
el despliegue de Next y sus archivos públicos. Configurar el dominio/HTTPS y
`MARKETING_SITE_URL` cuando se elija el hosting. Los proyectos del navegador
local no se trasladan solos al dominio: se exportan e importan como JSON.

La siguiente etapa funcional será el adaptador autenticado al motor de Grafo,
comenzando con una letra con cuerpo impreso, frente acrílico y fondo de PVC.
