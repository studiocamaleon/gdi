# Editor por componentes: primera etapa

Implementado el 5 de septiembre de 2026 a partir del [relevamiento de Proled](./relevamiento-proled.md).

Este documento registra la primera etapa. La ampliación posterior agrega seis variantes de base y cierre, descritas en [Bases y cierre PVC](./bases-y-cierre-pvc.md).

## Alcance

Los modelos **Acrílico encastrable** (`acrylic-fit`) y **Frente impreso** (`printed-fit`) tienen pestañas de **Cuerpo, Base, Acrílico** —cuando corresponde— y **Encastre**. Los otros diez modelos conservan sus controles anteriores.

La base tiene altura directa, espesor de fondo y espesor de pared. El acrílico tiene espesor y holgura de corte propios; la holgura del encastre cuerpo/base se edita por separado. El cuerpo conserva pared, frente/apoyo y retroceso. Los límites relacionan las medidas para que la base pueda entrar en el conjunto.

La selección identifica el componente en el visor; **Aislar pieza** permite inspeccionarlo y **Volver al conjunto** restaura la vista. El esquema de sección está disponible en una sección plegable para priorizar el espacio de los controles. Color y visibilidad de conjunto siguen siendo configurables. En capas y exportaciones, la pieza trasera pasa a llamarse **Base desmontable** y la placa frontal **Acrílico**.

## Compatibilidad y geometría

- Los IDs de componentes (`body`, `back`, `face`) se mantienen; sólo cambia su nombre de presentación para estos modelos.
- `fitBaseHeight` guarda la altura total de base, incluido el fondo. El valor 0 mantiene la fórmula histórica con `innerReduction`, usada por proyectos y predefiniciones anteriores.
- Al editar un parámetro desde el nuevo panel se resuelve primero esa altura histórica y se guarda explícitamente. Así, cambiar cuerpo o acrílico no vuelve a dimensionar la base.
- El motor sigue colocando la base en su posición de montaje. Aumentar la profundidad del cuerpo desplaza la base dentro del conjunto, conservando su forma y dimensiones de fabricación.
- La validación impide que una base de altura explícita invada el frente, sea menor que su fondo o no alcance el reborde producido por el retroceso del cuerpo. No se reinterpretan las combinaciones antiguas al abrirlas.
- La selección y el aislamiento son estado de vista en React, fuera de `Project`, del cálculo geométrico y de los costos. No se guardan como piezas eliminadas ni filtran los archivos de fabricación.
- No se agregaron aún modelos calados, traba trapezoidal, cola de milano ni DXF de trayectorias. Esta etapa prepara la edición y compatibilidad para esas ampliaciones.

## Verificación

**85 pruebas aprobadas**, incluidas diez nuevas para estos componentes:

- Modificar 10 mm de base conserva cuerpo y acrílico byte a byte en STL.
- Aumentar el cuerpo conserva altura y volumen de base; los vértices del STL normalizado se comparan con tolerancia de 0,00001 mm por redondeo de Float32.
- Abrir proyectos sin `fitBaseHeight` conserva las mallas, incluso con retroceso de cuerpo y reducción interior personalizados.
- Guardado, reapertura y cambio de estilo conservan la altura explícita.
- Cambiar el espesor del acrílico conserva cuerpo y base.
- Se rechazan alturas incompatibles y tipos incorrectos del parámetro nuevo.

Compilación TypeScript/Vite aprobada. Se verificaron en el navegador los dos modelos, edición de alturas, aislamiento y retorno al conjunto, persistencia y diálogo de exportación. La modificación no incorpora una validación física de encastres.
