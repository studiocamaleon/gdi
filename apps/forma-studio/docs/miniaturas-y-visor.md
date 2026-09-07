# Miniaturas de construcción y precisión del visor

Las trece tarjetas usan renders propios de los sólidos del motor. Un anillo cortado por la mitad permite ver paredes, apoyos y tapas; el naranja identifica la sección del cuerpo. La letra curva usa el texto «3D», Orgánica muestra el perfil de ondas y Frente calado muestra hexágonos con el difusor debajo. Son ejemplos de cada familia, no una previsualización de los parámetros del proyecto abierto.

Las imágenes están en `public/style-previews/`, a 512 × 384, con transparencia. Las tarjetas usan `<img>` y no crean visores WebGL adicionales. Se revisaron las miniaturas de LetraMaker como referencia funcional; no se reutilizan sus imágenes ni su código.

Para regenerarlas, desde `apps/forma-studio`, con las dependencias de la app y Blender instalado:

```sh
npx tsx scripts/export-style-previews.ts /tmp/grafo3d-style-previews.json
blender --background --factory-startup --python scripts/render-style-previews.py -- /tmp/grafo3d-style-previews.json public/style-previews
```

En macOS, el ejecutable puede ser `/Applications/Blender.app/Contents/MacOS/Blender`. Se puede agregar uno o varios identificadores de estilo al final de ambos comandos para exportar y renderizar sólo esas imágenes. El render usa cuatro hilos; conviene ejecutar las pruebas geométricas después de terminarlo. Los microbiseles son exclusivos de las miniaturas; no se aplican a los datos de fabricación.

## Alejamiento de la cámara

El visor usaba planos de recorte fijos de 0,1 y 30.000 mm. En carteles de varios metros, al alejar la cámara dos superficies separadas por décimas o milímetros podían caer en el mismo valor del buffer de profundidad. Esto provocaba rayas y alternancia de triángulos incluso sin cuadrícula.

`fitCameraDepth` ajusta los planos cercano y lejano al volumen visible transformado al espacio de la cámara, con margen para orbitar, acercarse y ver la cuadrícula. Los límites del modelo se calculan al cambiar sus piezas, visibilidad o despiece; al mover la cámara sólo se transforman sus ocho esquinas. El plano de sombras y la cuadrícula conservan la prueba de profundidad, pero no escriben sobre el buffer como si fueran superficies opacas.

Las pruebas verifican que dos caras a 0,1 mm conserven más de ocho niveles de separación en un buffer de 24 bits, hasta una distancia de 100 metros; también cubren el acercamiento y la cámara entre piezas. El caso visual de GRAFO de 2640,4 × 1015 mm se comprobó en Chrome con zoom alejado y cuadrícula visible. No se modifican las posiciones, espesores ni archivos STL/DXF.
