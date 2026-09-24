# Identidad de Grafo3D

Desde el 24/09/2026, el encabezado utiliza **grafoprint. 3D**: el mismo isologo de tres nodos, tipografía Geist (peso 650), composición y punto naranja de la web de Grafoprint, con «3D» en naranja al final. El componente `Grafoprint3dBrand` conserva la geometría de `apps/marketing/src/components/brand.tsx`. La fuente se sirve localmente desde `public/brand/geist-latin.woff2`; el texto sigue el color del tema y la marca usa el naranja de la web, `#ff7546`. El favicon también utiliza el isologo original.

La interfaz mantiene sus colores de trabajo:

- Naranja: `#fd6900`.
- Grafito: `#0b1117`.

El naranja identifica acciones principales, controles activos y selecciones. Los fondos usan grises neutros; las selecciones tienen un fondo naranja suave. La interfaz oscura usa grafito con texto claro y un naranja ligeramente más luminoso. Los tokens semánticos viven en `src/styles.css`, incluidos las miniaturas, las mesas y los paneles del visor. La cuadrícula y la iluminación 3D son neutras.

Los proyectos nuevos usan cuerpo grafito, frente claro y detalles naranjas. Los colores guardados en proyectos existentes siguen siendo elecciones del diseño. Los ejes mantienen colores diferenciados para facilitar su identificación.

El nombre visible de la aplicación es Grafo3D. Se conservan el nombre técnico del paquete, las claves locales `forma.*`, el formato `.forma.json` y el identificador de integración `forma-studio` para no romper proyectos existentes.
