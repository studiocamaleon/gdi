# Web comercial de Grafoprint

Landing pública independiente del SaaS y de la API.

## Desarrollo

```bash
npm install
npm run dev
```

Se abre en `http://localhost:3002`.

## Despliegue

Crear un proyecto independiente usando `apps/marketing` como directorio raíz.
Configurar las variables documentadas en `.env.example`; especialmente
`MARKETING_SIGNUP_URL`, que debe apuntar al onboarding público cuando exista.

La fuente visual migrada es `src/landing.html`, con sus estilos e interacciones
separados en `public/marketing.css` y `public/marketing.js`. Se tomó únicamente
`web/Grafoprint Web v2.html` del ZIP entregado; el resto del archivo no forma
parte del deploy.
